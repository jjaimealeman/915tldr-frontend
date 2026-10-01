#!/usr/bin/env node
// 05-04 Tasks 1-2: ARCH-01's zero-reads gate — leg 1b (the deployed Worker has no D1 binding) and
// leg 2 (a scripted request pass's D1 rowsRead delta against v1's normal background for a
// comparable window). D-01's method is "structure plus a load test", not a literal per-Worker
// zero reported by D1 analytics: 05-RESEARCH.md Question 1 confirmed, by live schema
// introspection, that Cloudflare's D1 analytics dataset has no scriptName/workerName dimension at
// all — it cannot attribute rows read to a calling Worker. Leg 2 is therefore a
// databaseId-filtered DELTA measurement (the load window's rowsRead against a 7-day comparable
// baseline), not an attribution query.
//
// Credential handling mirrors `src/lib/server/d1-client.ts` and `tools/ci-build.mjs`:
// CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN read from `process.env` only, via `./lib/cf-graphql.mjs`,
// never logged. Every network/clock boundary is an injectable deps seam (`fetchImpl`, `now`,
// `sleep`) — this project's own established convention.
//
// Exit codes (CLI): 0 = PASS (or a successful `--baseline-only` run), 2 = FAIL, 3 = INCONCLUSIVE.
// `--force-window` lets a pass START even while the window touches the v1 ingest slot (an even
// UTC hour, :00-:20) — the resulting verdict is still INCONCLUSIVE regardless, never PASS/FAIL;
// the flag only exists to exercise that path deliberately, not to bypass it.
//
// Request pacing: this file never exceeds the configured rate (10 requests/second by default)
// against the request mix's own host, and caps the total request count at 20,000
// (T-05-18, roadmap's own DoS-against-self mitigation).

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { queryCloudflareGraphql, introspectType, redact } from './lib/cf-graphql.mjs';

export const PRODUCTION_D1_DATABASE_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77';
export const PUBLIC_WORKER_SCRIPT = '915tldr-v2';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const DEFAULT_REQUESTS = 3000;
export const MAX_REQUESTS = 20_000;
export const DEFAULT_RATE_PER_SECOND = 10;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_SEED = 5;
export const ANALYTICS_CATCHUP_POLL_MS = 60_000;
export const ANALYTICS_CATCHUP_MAX_WAIT_MS = 15 * 60 * 1000;
const REQUEST_COMPLETION_FLOOR = 0.95;
const BASELINE_MIN_SAMPLES = 5;
const INGEST_SLOT_END_MINUTE = 20; // v1 ingest cron: even UTC hour, :00 through :20

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`load-test-zero-reads: ${name} is not set in the environment`);
  return value;
}

// ---------------------------------------------------------------------------
// Window math
// ---------------------------------------------------------------------------

function floorToFiveMinutes(date) {
  const ms = date.getTime();
  return new Date(ms - (ms % FIVE_MINUTES_MS));
}

function ceilToFiveMinutes(date) {
  const ms = date.getTime();
  const rem = ms % FIVE_MINUTES_MS;
  return rem === 0 ? new Date(ms) : new Date(ms + (FIVE_MINUTES_MS - rem));
}

/**
 * Returns `count` windows of identical length at the same UTC clock time on each of the previous
 * `count` days (oldest first: `count` days ago .. 1 day ago), each aligned OUTWARD to 5-minute
 * boundaries (start floored, end ceiled) so a sub-5-minute input window still fully covers the
 * dataset's own 5-minute buckets rather than under-covering them.
 */
export function comparableWindows({ start, end }, count = 7) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    throw new Error('load-test-zero-reads: comparableWindows requires valid start/end dates');
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new Error('load-test-zero-reads: comparableWindows requires end after start');
  }

  const alignedStart = floorToFiveMinutes(startDate);
  const alignedEnd = ceilToFiveMinutes(endDate);
  const durationMs = alignedEnd.getTime() - alignedStart.getTime();

  const windows = [];
  for (let dayOffset = count; dayOffset >= 1; dayOffset--) {
    const shiftMs = dayOffset * 24 * 60 * 60 * 1000;
    const windowStart = new Date(alignedStart.getTime() - shiftMs);
    const windowEnd = new Date(windowStart.getTime() + durationMs);
    windows.push({ start: windowStart.toISOString(), end: windowEnd.toISOString() });
  }
  return windows;
}

/**
 * Sample mean, SAMPLE standard deviation (n-1 denominator — this baseline is a sample of 7
 * windows out of all possible comparable windows, not the whole population), median and n, over
 * an array of numbers (one rowsRead total per comparable window).
 */
export function summarizeBaseline(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('load-test-zero-reads: summarizeBaseline requires a non-empty array');
  }
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { mean, stdDev, median, n };
}

/**
 * The smallest per-request D1 row leak this baseline's variance could reliably distinguish from
 * v1's normal background noise, at `requests` requests — `3 * sigma / requests`
 * (docs/phase-05/zero-reads-gate.md's own "Detection floor" definition).
 */
export function detectionFloor(sigma, requests) {
  if (!(requests > 0)) {
    throw new Error('load-test-zero-reads: detectionFloor requires requests > 0');
  }
  return (3 * sigma) / requests;
}

// ---------------------------------------------------------------------------
// D1 analytics (leg 2)
// ---------------------------------------------------------------------------

/**
 * Sums `rowsRead` for `PRODUCTION_D1_DATABASE_ID` over `window` ({start, end} ISO strings),
 * confirming via live introspection — NOT a guessed field name — that the dataset still exposes a
 * `rowsRead` sum and a `datetimeFiveMinutes` dimension before querying it (05-RESEARCH.md
 * Question 1's own introspection method, repeated here rather than assumed stable forever).
 */
export async function fetchD1RowsRead(window, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;

  const sumFields = await introspectType('AccountD1AnalyticsAdaptiveGroupsSum', { fetchImpl, env });
  if (!sumFields.includes('rowsRead')) {
    throw new Error('load-test-zero-reads: D1 analytics sum type has no rowsRead field — schema has changed');
  }
  const dimFields = await introspectType('AccountD1AnalyticsAdaptiveGroupsDimensions', { fetchImpl, env });
  if (!dimFields.includes('datetimeFiveMinutes')) {
    throw new Error(
      'load-test-zero-reads: D1 analytics dimensions type has no datetimeFiveMinutes field — schema has changed'
    );
  }

  const accountId = requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID');
  const query = `query($accountTag: string!, $databaseId: string!, $start: Time!, $end: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        d1AnalyticsAdaptiveGroups(
          limit: 400
          filter: { databaseId: $databaseId, datetimeFiveMinutes_geq: $start, datetimeFiveMinutes_lt: $end }
        ) {
          sum { rowsRead }
        }
      }
    }
  }`;
  const data = await queryCloudflareGraphql(
    {
      query,
      variables: { accountTag: accountId, databaseId: PRODUCTION_D1_DATABASE_ID, start: window.start, end: window.end },
    },
    { fetchImpl, env }
  );
  const groups = data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
  return groups.reduce((sum, g) => sum + (g?.sum?.rowsRead ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Deployed-binding check (leg 1b)
// ---------------------------------------------------------------------------

/**
 * Returns the list of binding TYPE strings from a Workers script settings API response
 * (`GET /accounts/{id}/workers/scripts/{name}/settings`) — confirmed live against this account's
 * own deployed Worker: a D1 binding reports `type: "d1"`, a KV binding `type: "kv_namespace"`.
 */
export function parseDeployedBindings(settingsResponse) {
  const bindings = settingsResponse?.result?.bindings;
  if (!Array.isArray(bindings)) {
    throw new Error('load-test-zero-reads: deployed-bindings response missing result.bindings');
  }
  return bindings.map((b) => (typeof b?.type === 'string' ? b.type : null)).filter(Boolean);
}

/** Fetches `PUBLIC_WORKER_SCRIPT`'s live settings and reports whether any D1-typed binding exists. */
export async function fetchDeployedBindings(deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;
  const accountId = requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID');
  const token = requireEnv(env, 'CLOUDFLARE_API_TOKEN');

  let response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${PUBLIC_WORKER_SCRIPT}/settings`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    throw new Error(redact(`load-test-zero-reads: ${err instanceof Error ? err.message : String(err)}`, env));
  }

  const body = await response.json();
  if (!response.ok || body?.success === false) {
    throw new Error(redact(`load-test-zero-reads: deployed-bindings request failed (HTTP ${response.status})`, env));
  }

  const bindingTypes = parseDeployedBindings(body);
  return { bindingTypes, hasD1Binding: bindingTypes.includes('d1') };
}

// ---------------------------------------------------------------------------
// Request mix (Task 2)
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) — same seed, same sequence, every run, every platform. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministically Fisher-Yates-shuffles a COPY of `items` and returns the first `count`. */
function seededSample(items, count, seed) {
  const rand = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export const HOT_ARTICLE_SAMPLE = 20;
export const ARCHIVED_ARTICLE_SAMPLE = 20;
export const STATIC_TAG_SAMPLE = 10;
export const ARCHIVED_TAG_SAMPLE = 10;

/**
 * The gate's own request mix (roadmap criterion 1, D-03): homepage, every category, 20 hot
 * articles, 20 archived articles, 10 static tags, 10 archived tags, the sitemap index and the RSS
 * feed — exactly 71 unique paths, sampled deterministically for a given `seed` so a re-run
 * requests the same URLs. Throws if fewer than 20 archived articles or 10 archived tags are
 * available — D-03 requires the archive path to be genuinely inside the measured pass, not
 * padded out with duplicates to hit a count.
 */
export function buildRequestMix({
  categories,
  hotArticlePaths,
  archivedArticlePaths,
  staticTagPaths,
  archivedTagPaths,
  seed = DEFAULT_SEED,
}) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('load-test-zero-reads: buildRequestMix requires at least one category');
  }
  if (!Array.isArray(hotArticlePaths) || hotArticlePaths.length < HOT_ARTICLE_SAMPLE) {
    throw new Error(
      `load-test-zero-reads: buildRequestMix requires at least ${HOT_ARTICLE_SAMPLE} hot article paths, got ${hotArticlePaths?.length ?? 0}`
    );
  }
  if (!Array.isArray(archivedArticlePaths) || archivedArticlePaths.length < ARCHIVED_ARTICLE_SAMPLE) {
    throw new Error(
      `load-test-zero-reads: buildRequestMix requires at least ${ARCHIVED_ARTICLE_SAMPLE} archived article paths, got ${archivedArticlePaths?.length ?? 0}`
    );
  }
  if (!Array.isArray(staticTagPaths) || staticTagPaths.length < STATIC_TAG_SAMPLE) {
    throw new Error(
      `load-test-zero-reads: buildRequestMix requires at least ${STATIC_TAG_SAMPLE} static tag paths, got ${staticTagPaths?.length ?? 0}`
    );
  }
  if (!Array.isArray(archivedTagPaths) || archivedTagPaths.length < ARCHIVED_TAG_SAMPLE) {
    throw new Error(
      `load-test-zero-reads: buildRequestMix requires at least ${ARCHIVED_TAG_SAMPLE} archived tag paths, got ${archivedTagPaths?.length ?? 0}`
    );
  }

  const paths = [
    '/',
    ...categories.map((slug) => `/${slug}`),
    ...seededSample(hotArticlePaths, HOT_ARTICLE_SAMPLE, seed),
    ...seededSample(archivedArticlePaths, ARCHIVED_ARTICLE_SAMPLE, seed + 1),
    ...seededSample(staticTagPaths, STATIC_TAG_SAMPLE, seed + 2),
    ...seededSample(archivedTagPaths, ARCHIVED_TAG_SAMPLE, seed + 3),
    '/sitemap-index.xml',
    '/rss.xml',
  ];

  const unique = [...new Set(paths)];
  if (unique.length !== paths.length) {
    throw new Error('load-test-zero-reads: buildRequestMix produced duplicate paths — inputs overlap unexpectedly');
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Window validity helpers
// ---------------------------------------------------------------------------

/** True when any instant in `[start, end)` falls inside the v1 ingest slot — an even UTC hour's
 * first `INGEST_SLOT_END_MINUTE` minutes (D-09/the roadmap's own 2-hour-interval ingest cron). */
export function windowTouchesIngestSlot(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours())
  );
  while (cursor.getTime() < end.getTime()) {
    if (cursor.getUTCHours() % 2 === 0) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + INGEST_SLOT_END_MINUTE * 60 * 1000;
      if (start.getTime() < slotEnd && end.getTime() > slotStart) return true;
    }
    cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

function inconclusive(base, rule) {
  return { ...base, verdict: 'INCONCLUSIVE', rule, reason: rule };
}

/**
 * Decides PASS / FAIL / INCONCLUSIVE for the zero-reads gate. Validity rules are checked FIRST,
 * each producing its own named INCONCLUSIVE rule (must_haves' own ARCH-01 concurrency list) —
 * nothing here can turn an unreliable measurement into a PASS. `hasD1Binding` fails the gate
 * regardless of the measured delta: leg 1b (structural) is not a tie-breaker against leg 2.
 */
export function decideZeroReadsVerdict(input) {
  const {
    baseline,
    loadRowsRead,
    hasD1Binding,
    buildOverlap = false,
    touchesIngestSlot = false,
    analyticsNotCaughtUp = false,
    zeroTotalWindow = false,
    requestsCompletedRatio = 1,
    unconfirmedArchivedUrl = false,
    requests = {},
    window = {},
  } = input;

  const base = {
    requests,
    window,
    baseline: baseline ?? null,
    loadRowsRead: loadRowsRead ?? null,
    detectionFloorRowsPerRequest:
      baseline && requests?.sent > 0 ? detectionFloor(baseline.stdDev, requests.sent) : null,
  };

  if (buildOverlap) {
    return inconclusive(base, 'build-overlap: the window overlaps a v2 build (commit or builtAt changed)');
  }
  if (touchesIngestSlot) {
    return inconclusive(base, 'ingest-slot: the window touches the v1 ingest slot (even UTC hour, :00-:20)');
  }
  if (analyticsNotCaughtUp) {
    return inconclusive(base, 'analytics-not-caught-up: no D1 analytics data point at or after the window end');
  }
  if (!baseline || baseline.n < BASELINE_MIN_SAMPLES) {
    return inconclusive(base, 'insufficient-baseline: fewer than 5 usable baseline samples');
  }
  if (zeroTotalWindow) {
    return inconclusive(
      base,
      'zero-total-window: a window measured zero total rowsRead — a broken check, not a quiet database'
    );
  }
  if (requestsCompletedRatio < REQUEST_COMPLETION_FLOOR) {
    return inconclusive(base, 'incomplete-pass: fewer than 95% of planned requests completed');
  }
  if (unconfirmedArchivedUrl) {
    return inconclusive(
      base,
      'unconfirmed-archive-path: an archived URL lacked the archive Server-Timing metric, or a hot URL unexpectedly carried one'
    );
  }

  const excess = loadRowsRead - baseline.mean;
  const zScore = baseline.stdDev > 0 ? excess / baseline.stdDev : excess > 0 ? Infinity : 0;
  const threshold = baseline.mean + 3 * baseline.stdDev;

  if (hasD1Binding) {
    return {
      ...base,
      excess,
      zScore,
      verdict: 'FAIL',
      reason: 'deployed Worker has a D1 binding — leg 1b (structural) fails regardless of the measured delta',
    };
  }

  if (loadRowsRead > threshold) {
    return {
      ...base,
      excess,
      zScore,
      verdict: 'FAIL',
      reason: `load window rowsRead (${loadRowsRead}) exceeds baseline mean + 3*sigma (${threshold})`,
    };
  }

  return {
    ...base,
    excess,
    zScore,
    verdict: 'PASS',
    reason: 'load window rowsRead is within baseline mean + 3*sigma and the deployed Worker has no D1 binding',
  };
}

// ---------------------------------------------------------------------------
// Preflight + request pass (Task 2)
// ---------------------------------------------------------------------------

const ARCHIVE_SERVER_TIMING_METRIC = 'archive';

function hasArchiveServerTiming(headers) {
  const value = typeof headers?.get === 'function' ? headers.get('server-timing') : headers?.['server-timing'];
  return typeof value === 'string' && value.includes(ARCHIVE_SERVER_TIMING_METRIC);
}

/**
 * Preflight (must_haves): an archived URL whose response lacks the archive Server-Timing metric,
 * or a hot URL whose response has one, makes the run INCONCLUSIVE before any measured request is
 * sent. Returns `{ ok: true }` or `{ ok: false, path, reason }`.
 */
export async function runPreflight({ hotPaths, archivedPaths, baseUrl, fetchImpl = fetch }) {
  for (const p of hotPaths) {
    const res = await fetchImpl(`${baseUrl}${p}`, { redirect: 'manual' });
    if (hasArchiveServerTiming(res.headers)) {
      return { ok: false, path: p, reason: `hot URL ${p} unexpectedly carried the archive Server-Timing metric` };
    }
  }
  for (const p of archivedPaths) {
    const res = await fetchImpl(`${baseUrl}${p}`, { redirect: 'manual' });
    if (!hasArchiveServerTiming(res.headers)) {
      return { ok: false, path: p, reason: `archived URL ${p} lacked the archive Server-Timing metric` };
    }
  }
  return { ok: true };
}

const NAVIGATE_HEADERS = {
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Site': 'none',
  Accept: 'text/html',
};
const PLAIN_HEADERS = {};

/**
 * Repeats `mix` cyclically to reach `totalRequests`, alternating navigation and plain request
 * headers, in batches of `concurrency` requests with `sleep(intervalMs)` between batches so the
 * pass never exceeds `ratePerSecond` — `sleep`/`now`/`fetchImpl` are all injected (this project's
 * own established seam) so a unit test can drive this with a fake clock and fake transport.
 */
export async function runPass({
  mix,
  totalRequests,
  baseUrl,
  concurrency = DEFAULT_CONCURRENCY,
  ratePerSecond = DEFAULT_RATE_PER_SECOND,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!(totalRequests > 0)) {
    throw new Error('load-test-zero-reads: runPass requires totalRequests > 0');
  }
  if (totalRequests > MAX_REQUESTS) {
    throw new Error(`load-test-zero-reads: runPass refuses to exceed MAX_REQUESTS (${MAX_REQUESTS})`);
  }
  const intervalMs = (1000 / ratePerSecond) * concurrency;

  let sent = 0;
  let completed = 0;
  let cycle = 0;
  const results = [];

  while (sent < totalRequests) {
    const batchSize = Math.min(concurrency, totalRequests - sent);
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      const index = (sent + i) % mix.length;
      const path = mix[index];
      const useNavigate = (sent + i) % 2 === 0;
      batch.push({ path, headers: useNavigate ? NAVIGATE_HEADERS : PLAIN_HEADERS });
    }
    sent += batchSize;

    await Promise.all(
      batch.map(async ({ path, headers }) => {
        try {
          const res = await fetchImpl(`${baseUrl}${path}`, { redirect: 'manual', headers });
          completed += 1;
          results.push({ path, status: res.status, serverTiming: res.headers?.get?.('server-timing') ?? null });
        } catch {
          results.push({ path, status: null, serverTiming: null });
        }
      })
    );

    cycle += 1;
    if (sent < totalRequests) {
      await sleep(intervalMs);
    }
  }

  return { sent, completed, results, completionRatio: completed / sent };
}

// ---------------------------------------------------------------------------
// Orchestration + CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    baselineOnly: false,
    requests: DEFAULT_REQUESTS,
    at: null,
    evidence: null,
    json: false,
    archivePlan: 'dist/archive-plan.json',
    seed: DEFAULT_SEED,
    forceWindow: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline-only') { args.baselineOnly = true; continue; }
    if (arg === '--requests') { args.requests = Number(argv[++i]); continue; }
    if (arg.startsWith('--requests=')) { args.requests = Number(arg.slice('--requests='.length)); continue; }
    if (arg === '--at') { args.at = argv[++i]; continue; }
    if (arg.startsWith('--at=')) { args.at = arg.slice('--at='.length); continue; }
    if (arg === '--evidence') { args.evidence = argv[++i]; continue; }
    if (arg.startsWith('--evidence=')) { args.evidence = arg.slice('--evidence='.length); continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--archive-plan') { args.archivePlan = argv[++i]; continue; }
    if (arg.startsWith('--archive-plan=')) { args.archivePlan = arg.slice('--archive-plan='.length); continue; }
    if (arg === '--seed') { args.seed = Number(argv[++i]); continue; }
    if (arg.startsWith('--seed=')) { args.seed = Number(arg.slice('--seed='.length)); continue; }
    if (arg === '--force-window') { args.forceWindow = true; continue; }
  }
  if (!Number.isFinite(args.requests) || args.requests <= 0) {
    throw new Error(`load-test-zero-reads: --requests must be a positive number, got ${args.requests}`);
  }
  return args;
}

async function writeEvidence(dir, name, data) {
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

/**
 * Baseline-only mode: computes the 7 comparable windows, fetches D1 rowsRead for each, summarizes
 * them, computes the detection floor at `requests`, and fetches the deployed Worker's bindings.
 * No request pass is run — `--baseline-only` is the mode this plan's Task 1 proves live.
 */
async function runBaselineOnly({ at, requests, evidence, deps }) {
  const { env = process.env } = deps;
  const anchor = at ? new Date(at) : new Date();
  const windowLengthMs = 10 * 60 * 1000; // a 10-minute anchor window, aligned outward to 5 min
  const windows = comparableWindows(
    { start: new Date(anchor.getTime() - windowLengthMs), end: anchor },
    7
  );

  const rawResponses = [];
  const totals = [];
  for (const window of windows) {
    const total = await fetchD1RowsRead(window, deps);
    totals.push(total);
    rawResponses.push({ window, total });
  }
  if (totals.some((t) => t === 0)) {
    throw new Error(
      'load-test-zero-reads: a baseline window measured zero total rowsRead — this is a broken query against a database that reads millions of rows a day, not a quiet one'
    );
  }

  const baseline = summarizeBaseline(totals);
  const floor = detectionFloor(baseline.stdDev, requests);
  const bindings = await fetchDeployedBindings(deps);

  await writeEvidence(evidence, 'd1-baseline-windows.json', rawResponses);
  await writeEvidence(evidence, 'deployed-bindings.json', bindings);

  const result = {
    mode: 'baseline-only',
    windows,
    windowTotals: totals,
    baseline,
    requests,
    detectionFloorRowsPerRequest: floor,
    deployedWorkerHasD1Binding: bindings.hasD1Binding,
    bindingTypes: bindings.bindingTypes,
  };

  console.log(
    `[load-test-zero-reads] baseline: n=${baseline.n} mean=${baseline.mean.toFixed(1)} ` +
      `stdDev=${baseline.stdDev.toFixed(1)} median=${baseline.median} ` +
      `detectionFloor(${requests} req)=${floor.toFixed(4)} rows/req`
  );
  console.log(`[load-test-zero-reads] deployedWorkerHasD1Binding: ${bindings.hasD1Binding}`);

  return { exitCode: 0, result };
}

/**
 * runLoadTest(opts) — the whole tool, baseline-only or the full pass + verdict. `deps` carries the
 * injectable seam (`fetchImpl`, `now`, `sleep`, `env`) so tests never perform real I/O.
 */
export async function runLoadTest(opts = {}) {
  const {
    baselineOnly = false,
    requests = DEFAULT_REQUESTS,
    at = null,
    evidence = null,
    archivePlanPath = 'dist/archive-plan.json',
    seed = DEFAULT_SEED,
    forceWindow = false,
    baseUrl = 'https://dev.915tldr.com',
    requestMixInput = null,
    deps = {},
  } = opts;

  const resolvedDeps = { fetchImpl: deps.fetchImpl ?? fetch, env: deps.env ?? process.env };
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  if (baselineOnly) {
    return runBaselineOnly({ at, requests, evidence, deps: resolvedDeps });
  }

  if (!requestMixInput) {
    throw new Error(
      'load-test-zero-reads: a full pass requires requestMixInput (categories/hot/archived/tag paths) — see --archive-plan'
    );
  }

  const windowStart = now();
  if (!forceWindow) {
    const provisionalEnd = new Date(windowStart.getTime() + 1);
    if (windowTouchesIngestSlot(windowStart.toISOString(), provisionalEnd.toISOString())) {
      throw new Error(
        'load-test-zero-reads: refusing to start — this window touches the v1 ingest slot (even UTC hour, :00-:20); pass --force-window to proceed anyway (the verdict will still be INCONCLUSIVE)'
      );
    }
  }

  const mix = buildRequestMix({ ...requestMixInput, seed });

  const preflight = await runPreflight({
    hotPaths: requestMixInput.hotArticlePaths.slice(0, HOT_ARTICLE_SAMPLE),
    archivedPaths: requestMixInput.archivedArticlePaths.slice(0, ARCHIVED_ARTICLE_SAMPLE),
    baseUrl,
    fetchImpl: resolvedDeps.fetchImpl,
  });

  if (!preflight.ok) {
    const result = decideZeroReadsVerdict({
      baseline: null,
      loadRowsRead: null,
      hasD1Binding: false,
      unconfirmedArchivedUrl: true,
      requests: { sent: 0, completed: 0 },
      window: {},
    });
    return { exitCode: 3, result: { ...result, preflight } };
  }

  const pass = await runPass({
    mix,
    totalRequests: requests,
    baseUrl,
    fetchImpl: resolvedDeps.fetchImpl,
    sleep,
  });

  const windowEnd = now();
  const touchesIngestSlot = windowTouchesIngestSlot(windowStart.toISOString(), windowEnd.toISOString());

  // Wait for analytics to catch up to the window end (injectable sleep; capped wait).
  let analyticsNotCaughtUp = false;
  let waited = 0;
  // A caller-supplied `checkCaughtUp` lets tests avoid a real polling loop entirely; the live CLI
  // path always polls (see main()).
  const checkCaughtUp = deps.checkCaughtUp ?? (async () => true);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const caughtUp = await checkCaughtUp();
    if (caughtUp) break;
    if (waited >= ANALYTICS_CATCHUP_MAX_WAIT_MS) {
      analyticsNotCaughtUp = true;
      break;
    }
    await sleep(ANALYTICS_CATCHUP_POLL_MS);
    waited += ANALYTICS_CATCHUP_POLL_MS;
  }

  const loadWindow = { start: windowStart.toISOString(), end: windowEnd.toISOString() };
  const loadRowsRead = analyticsNotCaughtUp ? null : await fetchD1RowsRead(loadWindow, resolvedDeps);

  const baselineWindows = comparableWindows(loadWindow, 7);
  const baselineTotals = [];
  for (const window of baselineWindows) {
    baselineTotals.push(await fetchD1RowsRead(window, resolvedDeps));
  }
  const zeroTotalWindow = baselineTotals.some((t) => t === 0) || loadRowsRead === 0;
  const baseline = baselineTotals.length > 0 ? summarizeBaseline(baselineTotals) : null;

  const bindings = await fetchDeployedBindings(resolvedDeps);

  await writeEvidence(evidence, 'request-pass.json', pass.results);
  await writeEvidence(evidence, 'baseline-windows.json', { windows: baselineWindows, totals: baselineTotals });
  await writeEvidence(evidence, 'load-window.json', { window: loadWindow, rowsRead: loadRowsRead });

  const verdict = decideZeroReadsVerdict({
    baseline,
    loadRowsRead,
    hasD1Binding: bindings.hasD1Binding,
    touchesIngestSlot,
    analyticsNotCaughtUp,
    zeroTotalWindow,
    requestsCompletedRatio: pass.completionRatio,
    requests: { sent: pass.sent, completed: pass.completed },
    window: loadWindow,
  });

  const exitCode = verdict.verdict === 'PASS' ? 0 : verdict.verdict === 'FAIL' ? 2 : 3;
  return { exitCode, result: verdict };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { exitCode, result } = await runLoadTest({
      baselineOnly: args.baselineOnly,
      requests: args.requests,
      at: args.at,
      evidence: args.evidence,
      seed: args.seed,
      forceWindow: args.forceWindow,
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exitCode = exitCode;
  } catch (err) {
    console.error(redact(`load-test-zero-reads: ${err instanceof Error ? err.message : String(err)}`, process.env));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

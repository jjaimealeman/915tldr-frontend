#!/usr/bin/env node
// 05-17 Task 1/2: ARCH-08's per-request CPU-outlier measurement, built on the Cloudflare Workers
// Observability telemetry REST API — NOT the `workersInvocationsAdaptive` GraphQL dataset
// `tools/measure-worker-kv-cpu.mjs` reads, which only returns aggregate quantiles/max and cannot
// list or count individual over-budget requests (confirmed by the 05-REVIEW.md verifier via live
// schema introspection, and re-confirmed here).
//
// Verified firsthand on 2026-10-02 (full record: docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json)
// against the REAL API, not training data or planning-stage assumptions:
//   - Endpoint: POST /accounts/{account_id}/workers/observability/telemetry/query
//   - The per-invocation dataset is `cloudflare-workers` — it must be named explicitly via
//     `parameters.datasets: ["cloudflare-workers"]`; omitting `datasets` silently queries a
//     different, metadata-only dataset with no $workers.* fields at all (no error, just the
//     wrong data) — a mistake this file's queries deliberately guard against by always sending it.
//   - `view: "events"` returns a raw per-request event list (`result.events.events`), newest
//     first, capped at `limit`. Omitting `view` instead returns a time-bucketed COUNT
//     calculation (`result.calculations[0].aggregates[0].value`), used here for the true window
//     total as a cross-check against measure-worker-kv-cpu.mjs's GraphQL aggregate.
//   - CPU time field: `$workers.cpuTimeMs`, already in MILLISECONDS (unlike the GraphQL
//     `workersInvocationsAdaptive` dataset, which reports microseconds) — no conversion here.
//   - `queryId` does NOT need to reference a pre-saved query (POST .../observability/queries,
//     which 403'd under this project's Read-only observability scope): any syntactically valid
//     string works as an AD-HOC query id as long as `parameters` is supplied alongside it.
//   - A server-side numeric filter on `$workers.cpuTimeMs` (operation `gt`) is supported and used
//     here to keep the outlier fetch small.
//   - No cursor/offset pagination exists on this endpoint (a top-level `offset` key is rejected by
//     the API's own schema validation) — the only provable-complete signal is
//     `events.length < limit`; `events.length === limit` cannot prove there isn't a next page, so
//     `fetchInvocationEvents` throws rather than silently under-reporting.
//   - `limit` has a hard server-side ceiling of 2000 (Zod `too_big`, confirmed both that 2001 is
//     rejected and 2000 is accepted). Combined with the no-cursor finding above, this endpoint
//     cannot enumerate more than 2000 raw events for ANY query, ever — a busy window (the 05-12
//     gate window has ~8,477 total invocations) cannot have every invocation listed this way.
//     `minCpuMs` keeps the outlier fetch (the actual ARCH-08 dispute) far under that ceiling; the
//     window TOTAL instead comes from `fetchTotalInvocationCount`'s count-view calculation, which
//     is not subject to the events-view's 2000-row cap.
//   - Retention: Workers Logs on the Paid plan is 7 days (developers.cloudflare.com/workers/observability/logs/workers-logs).
//   - Required token permission: Account -> Workers Observability -> Read (dashboard custom-token
//     permission group). This scope is sufficient for `keys`, `values`, and `query` (both views);
//     it does NOT grant creating a saved query (403 confirmed) — not needed by this tool.
//   - No key name in the dataset matches /cold|isolate|startup|warm/i (checked against the full
//     151-key set) — this API cannot directly confirm or rule out a cold isolate; see
//     `findColdStartKeys` and docs/phase-05/arch-08-cpu-outliers.md's "IN-01 correlation" section.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { redact } from './lib/cf-graphql.mjs';
import { PUBLIC_WORKER_SCRIPT, CPU_BUDGET_MS, CPU_HARD_FAIL_MS } from './measure-worker-kv-cpu.mjs';

export { PUBLIC_WORKER_SCRIPT, CPU_BUDGET_MS, CPU_HARD_FAIL_MS };

export const TELEMETRY_DATASET = 'cloudflare-workers';
const TELEMETRY_QUERY_PATH_TEMPLATE = (accountId) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`;

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`measure-worker-cpu-outliers: ${name} is not set in the environment`);
  return value;
}

// ---------------------------------------------------------------------------
// normalizeInvocationEvent — the ONLY place a raw telemetry event is read. Every other function
// in this file operates on normalized events. Allow-listed fields only; a raw event's client IP,
// user agent, headers, and every geo/TLS field are read nowhere in this file and therefore can
// never reach disk.
// ---------------------------------------------------------------------------

/**
 * Converts one raw `cloudflare-workers` dataset event (the VERIFIED shape recorded in
 * api-shape.json: `{ timestamp, $workers: { event: { path, response, request: { cf } },
 * scriptVersion, outcome, wallTimeMs, cpuTimeMs }, $metadata: { requestId } }`) into
 * `{ timestamp, path, status, cpuTimeMs, wallTimeMs, scriptVersion, colo, outcome, requestId }`.
 * A field missing from the verified shape normalizes to `null`, never a thrown error — this
 * function must never fail on a legitimately-shaped event just because one optional field (e.g.
 * colo, on a non-fetch event type) is absent.
 */
export function normalizeInvocationEvent(raw) {
  const workers = raw?.['$workers'] ?? {};
  const metadata = raw?.['$metadata'] ?? {};
  const event = workers.event ?? {};
  const request = event.request ?? {};
  const cf = request.cf ?? {};
  const response = event.response ?? {};

  return {
    timestamp: raw?.timestamp ?? null,
    path: event.path ?? null,
    status: typeof response.status === 'number' ? response.status : null,
    cpuTimeMs: typeof workers.cpuTimeMs === 'number' ? workers.cpuTimeMs : null,
    wallTimeMs: typeof workers.wallTimeMs === 'number' ? workers.wallTimeMs : null,
    scriptVersion: workers.scriptVersion?.id ?? null,
    colo: cf.colo ?? null,
    outcome: workers.outcome ?? null,
    requestId: metadata.requestId ?? null,
  };
}

// ---------------------------------------------------------------------------
// summarizeCpuOutliers — pure, over normalized events only
// ---------------------------------------------------------------------------

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

/**
 * `{ total, overBudget, overHardFail, p99Ms, maxMs, outliers }` over a normalized-event array.
 * `outliers` is every event with `cpuTimeMs >= budgetMs`, sorted by CPU descending — this is the
 * per-request COUNT this plan exists to produce, never an aggregate quantile/max standing in for
 * a count (the exact mistake ARCH-08's dispute traces back to).
 */
export function summarizeCpuOutliers(events, { budgetMs = CPU_BUDGET_MS, hardFailMs = CPU_HARD_FAIL_MS } = {}) {
  const total = events.length;
  const cpuValues = events.map((e) => e.cpuTimeMs ?? 0).sort((a, b) => a - b);
  const maxMs = cpuValues.length ? cpuValues[cpuValues.length - 1] : 0;
  const p99Ms = percentile(cpuValues, 99);
  const overBudget = events.filter((e) => (e.cpuTimeMs ?? 0) >= budgetMs).length;
  const overHardFail = events.filter((e) => (e.cpuTimeMs ?? 0) >= hardFailMs).length;
  const outliers = events
    .filter((e) => (e.cpuTimeMs ?? 0) >= budgetMs)
    .slice()
    .sort((a, b) => (b.cpuTimeMs ?? 0) - (a.cpuTimeMs ?? 0));

  return { total, overBudget, overHardFail, p99Ms, maxMs, outliers };
}

// ---------------------------------------------------------------------------
// Live fetch — Workers Observability telemetry API
// ---------------------------------------------------------------------------

async function postTelemetryQuery(body, { fetchImpl, env }) {
  const accountId = requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID');
  const token = requireEnv(env, 'CLOUDFLARE_API_TOKEN');

  let response;
  try {
    response = await fetchImpl(TELEMETRY_QUERY_PATH_TEMPLATE(accountId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(redact(`measure-worker-cpu-outliers: ${err instanceof Error ? err.message : String(err)}`, env));
  }

  let parsed;
  try {
    parsed = await response.json();
  } catch (err) {
    throw new Error(
      redact(`measure-worker-cpu-outliers: failed to parse response JSON: ${err instanceof Error ? err.message : String(err)}`, env)
    );
  }

  if (!response.ok || parsed?.success === false) {
    const firstError = parsed?.errors?.[0]?.message ?? `HTTP ${response.status}`;
    throw new Error(redact(`measure-worker-cpu-outliers: API error: ${firstError}`, env));
  }

  return parsed.result;
}

/** Shared pagination-safety fetch: runs one `events`-view query with `extraFilters` appended to
 * the standard scriptName filter, and throws rather than returning a page that cannot be proven
 * complete (`events.length === limit` — see the no-cursor/offset finding in api-shape.json). */
async function fetchEventsPage({ from, to, extraFilters = [], limit }, { fetchImpl, env, queryId }) {
  const body = {
    queryId,
    view: 'events',
    timeframe: { from, to },
    limit,
    parameters: {
      datasets: [TELEMETRY_DATASET],
      filters: [{ key: '$workers.scriptName', operation: 'eq', type: 'string', value: PUBLIC_WORKER_SCRIPT }, ...extraFilters],
    },
  };

  const result = await postTelemetryQuery(body, { fetchImpl, env });
  const rawEvents = result?.events?.events ?? [];

  if (rawEvents.length === limit) {
    throw new Error(
      `measure-worker-cpu-outliers: result page is incomplete — ${rawEvents.length} events returned at limit=${limit} and this endpoint has no cursor/offset to fetch a next page (verified — see api-shape.json); narrow the window/filter or raise --limit and re-run rather than trust a partial count`
    );
  }

  return rawEvents.map(normalizeInvocationEvent);
}

/**
 * Fetches every invocation event for `PUBLIC_WORKER_SCRIPT` in `[from, to]` (inclusive bounds —
 * matching the gate window's own convention) with `cpuTimeMs > minCpuMs`, as VERIFIED, normalized
 * events. Pages until the API's own completeness signal (`events.length < limit`); if a page
 * comes back exactly at `limit`, completeness cannot be proven (the endpoint has no cursor/offset
 * — verified, see api-shape.json) and this throws rather than silently reporting a partial count
 * as complete.
 */
export async function fetchInvocationEvents({ from, to, minCpuMs = 0, limit = 1000 }, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;
  const extraFilters =
    minCpuMs > 0 ? [{ key: '$workers.cpuTimeMs', operation: 'gt', type: 'number', value: minCpuMs }] : [];
  return fetchEventsPage(
    { from, to, extraFilters, limit },
    { fetchImpl, env, queryId: '00000000-0000-0000-0000-000000000000' }
  );
}

/**
 * Fetches EVERY invocation of one exact `path` in `[from, to]` — used by `--correlate` to get the
 * TRUE full-window repeat count and occurrence timestamps for each outlier's path (not just the
 * handful of outlier events themselves), since `$workers.event.path` is confirmed filterable with
 * `operation: "eq"` (verified: a bogus control path returns exactly 0 matches). Subject to the
 * same 2000-row/no-cursor cap as any other `events`-view query — a single archived article's
 * repeat count within one gate window has not been observed anywhere near that cap, but a path
 * that IS that busy throws rather than under-reporting, same as `fetchInvocationEvents`.
 */
export async function fetchPathEventHistory(path, { from, to, limit = 1900 }, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;
  return fetchEventsPage(
    { from, to, extraFilters: [{ key: '$workers.event.path', operation: 'eq', type: 'string', value: path }], limit },
    { fetchImpl, env, queryId: '00000000-0000-0000-0000-000000000002' }
  );
}

/** Fetches the true total invocation count for `PUBLIC_WORKER_SCRIPT` in `[from, to]` via the
 * telemetry API's own COUNT calculation (no `view` — the time-bucketed series this project's
 * verification found is NOT subject to the `events`-view's `limit` cap), for a side-by-side
 * cross-check against `tools/measure-worker-kv-cpu.mjs`'s GraphQL aggregate. */
export async function fetchTotalInvocationCount({ from, to }, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;
  const body = {
    queryId: '00000000-0000-0000-0000-000000000001',
    timeframe: { from, to },
    limit: 1,
    parameters: {
      datasets: [TELEMETRY_DATASET],
      filters: [{ key: '$workers.scriptName', operation: 'eq', type: 'string', value: PUBLIC_WORKER_SCRIPT }],
    },
  };
  const result = await postTelemetryQuery(body, { fetchImpl, env });
  return result?.calculations?.[0]?.aggregates?.[0]?.value ?? 0;
}

// ---------------------------------------------------------------------------
// IN-01 correlation — evidence only, no root-cause assertion
// ---------------------------------------------------------------------------

/**
 * Per outlier: `samePathCount` (invocations of that path anywhere in `allEvents`), `samePathRank`
 * (1 = first chronological occurrence of that path), `gapSincePrevSameColoMs` /
 * `firstInColoInWindow` (colo-scoped — `null`/`false`-safe-guarded by `coloAvailable: false` when
 * the data carries no colo, e.g. non-fetch events), `gapSincePrevSameVersionMs`,
 * `offsetFromWindowStartS`, `wallTimeMs`, `cpuTimeMs`. Every figure here is a DATA POINT, not a
 * verdict — `docs/phase-05/arch-08-cpu-outliers.md`'s "IN-01 correlation" section is explicit that
 * none of this proves a cold isolate, only supports or fails to support one.
 */
export function correlateOutliers(outliers, allEvents, { windowStartMs } = {}) {
  const sortedByTime = allEvents.slice().sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const windowStart = windowStartMs ?? (sortedByTime[0]?.timestamp ?? 0);
  const coloAvailable = sortedByTime.some((e) => e.colo !== null && e.colo !== undefined);

  return outliers.map((outlier) => {
    const samePath = sortedByTime.filter((e) => e.path !== null && e.path === outlier.path);
    const samePathCount = samePath.length;
    const samePathRank = samePath.findIndex((e) => e.timestamp === outlier.timestamp && e.requestId === outlier.requestId) + 1;

    let gapSincePrevSameColoMs = null;
    let firstInColoInWindow = null;
    if (coloAvailable && outlier.colo) {
      const sameColo = sortedByTime.filter((e) => e.colo === outlier.colo);
      const idx = sameColo.findIndex((e) => e.timestamp === outlier.timestamp && e.requestId === outlier.requestId);
      firstInColoInWindow = idx === 0;
      gapSincePrevSameColoMs = idx > 0 ? outlier.timestamp - sameColo[idx - 1].timestamp : null;
    }

    const sameVersion = sortedByTime.filter((e) => e.scriptVersion !== null && e.scriptVersion === outlier.scriptVersion);
    const versionIdx = sameVersion.findIndex((e) => e.timestamp === outlier.timestamp && e.requestId === outlier.requestId);
    const gapSincePrevSameVersionMs =
      outlier.scriptVersion !== null && versionIdx > 0 ? outlier.timestamp - sameVersion[versionIdx - 1].timestamp : null;

    return {
      requestId: outlier.requestId,
      path: outlier.path,
      colo: outlier.colo,
      coloAvailable,
      samePathCount,
      samePathRank,
      gapSincePrevSameColoMs,
      firstInColoInWindow,
      gapSincePrevSameVersionMs,
      offsetFromWindowStartS: (outlier.timestamp - windowStart) / 1000,
      wallTimeMs: outlier.wallTimeMs,
      cpuTimeMs: outlier.cpuTimeMs,
    };
  });
}

/** Returns every key name in `keyNames` matching /cold|isolate|startup|warm/i — an empty array
 * (not an error) when none exist, which is this project's own verified finding against the real
 * `cloudflare-workers` dataset's 151 keys (see api-shape.json). */
export function findColdStartKeys(keyNames) {
  const pattern = /cold|isolate|startup|warm/i;
  return keyNames.filter((key) => pattern.test(key));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { from: null, to: null, minCpuMs: 0, json: false, evidence: null, correlate: false, limit: 1000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from') { args.from = argv[++i]; continue; }
    if (arg === '--to') { args.to = argv[++i]; continue; }
    if (arg === '--min-cpu-ms') { args.minCpuMs = Number(argv[++i]); continue; }
    if (arg === '--limit') { args.limit = Number(argv[++i]); continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--correlate') { args.correlate = true; continue; }
    if (arg === '--evidence') { args.evidence = argv[++i]; continue; }
  }
  if (!args.from || !args.to) {
    throw new Error('measure-worker-cpu-outliers: --from and --to are required (ISO 8601 timestamps)');
  }
  return args;
}

async function writeEvidence(dir, name, data) {
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

export async function runMeasurement(opts = {}) {
  const { from, to, minCpuMs = 0, limit = 1000, evidence = null, correlate = false, deps = {} } = opts;
  const resolvedDeps = { fetchImpl: deps.fetchImpl ?? fetch, env: deps.env ?? process.env };
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);

  const events = await fetchInvocationEvents({ from: fromMs, to: toMs, minCpuMs, limit }, resolvedDeps);
  const totalFromCountQuery = await fetchTotalInvocationCount({ from: fromMs, to: toMs }, resolvedDeps);
  const summary = summarizeCpuOutliers(events, { budgetMs: CPU_BUDGET_MS, hardFailMs: CPU_HARD_FAIL_MS });

  await writeEvidence(evidence, 'events.normalized.json', events);
  await writeEvidence(evidence, 'summary.json', { window: { from, to }, totalFromCountQuery, ...summary });

  let correlation = null;
  if (correlate) {
    // samePathCount/samePathRank need the TRUE full-window occurrence list for each outlier's
    // path, not just the handful of outlier events themselves — otherwise two outliers sharing a
    // path would report samePathCount:2 when the real figure (an archived article hit by a
    // recurring poller) can be in the hundreds. Colo-level population is NOT similarly expanded
    // (every outlier observed shares one colo carrying the bulk of this window's ~8,477
    // invocations, which the 2000-row/no-cursor cap makes infeasible to enumerate in full) — see
    // `coloPopulationCaveat` below and docs/phase-05/arch-08-cpu-outliers.md's IN-01 section.
    const distinctPaths = [...new Set(summary.outliers.map((o) => o.path).filter(Boolean))];
    const pathHistories = await Promise.all(
      distinctPaths.map((p) => fetchPathEventHistory(p, { from: fromMs, to: toMs }, resolvedDeps))
    );
    const byRequestId = new Map();
    for (const e of [...events, ...pathHistories.flat()]) {
      byRequestId.set(e.requestId ?? `${e.timestamp}:${e.path}`, e);
    }
    const correlationUniverse = [...byRequestId.values()];

    correlation = correlateOutliers(summary.outliers, correlationUniverse, { windowStartMs: fromMs });
    await writeEvidence(evidence, 'correlation.json', {
      coloPopulationCaveat:
        'samePathCount/samePathRank are TRUE full-window counts (fetched per-path via $workers.event.path eq, unaffected by the outlier-only fetch). firstInColoInWindow/gapSincePrevSameColoMs are NOT computed against the full per-colo population — every outlier here shares one colo that likely carries most of this window\'s ~8,477 invocations, and enumerating all of them is blocked by the verified 2000-row/no-cursor cap. Treat the colo fields as scoped to the known population (outliers + their paths\' full history) only, not as a true "first ever at this colo" claim.',
      outliers: correlation,
    });
  }

  console.log(
    `[measure-worker-cpu-outliers] window ${from}..${to}: total(events-view, minCpuMs=${minCpuMs})=${summary.total} ` +
      `totalFromCountQuery=${totalFromCountQuery} overBudget(>=${CPU_BUDGET_MS}ms)=${summary.overBudget} ` +
      `overHardFail(>=${CPU_HARD_FAIL_MS}ms)=${summary.overHardFail} p99=${summary.p99Ms}ms max=${summary.maxMs}ms`
  );

  return { exitCode: 0, result: { window: { from, to }, totalFromCountQuery, ...summary, correlation } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { exitCode, result } = await runMeasurement({
      from: args.from,
      to: args.to,
      minCpuMs: args.minCpuMs,
      limit: args.limit,
      evidence: args.evidence,
      correlate: args.correlate,
    });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCode;
  } catch (err) {
    console.error(redact(`measure-worker-cpu-outliers: ${err instanceof Error ? err.message : String(err)}`, process.env));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

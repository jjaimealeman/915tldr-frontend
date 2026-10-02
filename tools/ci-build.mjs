#!/usr/bin/env node
// D-15/REND-02/REND-04 (04-09): the Workers Builds build/deploy wrapper. Two guarantees, both
// unconditional: (1) a failing build never spawns `wrangler` — `commitLastGood` only ever runs
// after a REAL, successful production deploy; (2) a failed build/deploy never fails silently — it
// pushes exactly one ntfy notification naming the failed check, the commit, and the branch, with
// every secret redacted.
//
// Plain Node ESM, not TypeScript — `pnpm run build:ci` (the `build` step) can run under
// Workers Builds with NO KV/D1 credentials present at all (only a wrangler deploy needs them), so
// `src/lib/server/build-state.ts` (which reads `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` at
// call time) is imported ONLY inside the deploy path, via a dynamic `import()` — never at module
// load time, and never reached by the `build` step.
//
// Every network/process boundary is an injectable deps seam (`spawnImpl`/`notifyImpl`/
// `commitImpl`/`setTimer`/`clearTimer`) — this project's own established convention (see
// `src/lib/server/build-state.ts`'s `fetchImpl`, `src/content/loaders/changelog-loader.ts`'s
// `fetchJson`) — so `tests/unit/ci-build.test.mjs` never spawns a real process, sends a real ntfy
// push, or writes real KV.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** T-04-35: the ordered list of module names this project's own fail-loud checks throw from
 * (d1-articles-loader's console-prefixed log lines, the changelog loader, the D1/KV chokepoint
 * modules, the D1-import structural guard, and the listing helpers) — `classifyFailure` names
 * the build's own failure reason instead of a bare exit code whenever one of these appears. */
const CHECK_PATTERNS = [
  'd1-articles-loader',
  'changelog-loader',
  'd1-client',
  'kv-manifest',
  'build-state',
  'assert-no-d1',
  'listing',
  // 05-08: the archive tier's own fail-loud modules — same `<module>: <message>` convention.
  'archive-sync',
  'partition-archive',
  'assert-file-count',
  'hot-window',
  'tiering',
  'tier-facts',
  'r2-client',
];

/** T-04-35/T-04-36: env keys whose exact value must never appear in a notification body.
 * R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY added 05-08 — the archive tier's own R2 credentials. */
const SECRET_ENV_KEYS = ['CLOUDFLARE_API_TOKEN', 'NTFY_TOKEN', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];

/** Any 40+ character run of token-shaped characters is redacted too, even with no matching env
 * var — catches a token echoed by a subprocess under a name this list doesn't know about. */
const TOKEN_LIKE_RE = /[A-Za-z0-9_-]{40,}/g;

/** T-04-38: WORKERS_CI is a string like "1" or "true" when set by the platform; anything else
 * (unset, "0", "false") means "not running under Workers Builds". */
function isTruthyFlag(value) {
  return Boolean(value) && value !== '0' && value !== 'false';
}

/** D-15: default watchdog threshold — 18 minutes, ahead of Workers Builds' hard 20-minute
 * per-build ceiling (developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing). */
const DEFAULT_WATCHDOG_MS = 18 * 60 * 1000;

const NUMBER_OF_TAIL_LINES = 200;

/** 05-08: mirrors `tools/archive-sync.mjs`'s own exported `BUILD_STARTED_AT_PATH` constant,
 * duplicated here rather than imported — this file never statically imports archive-sync.mjs (it
 * only ever spawns it as a child process, same arm's-length relationship it already has with
 * `pnpm run build`), following this file's own established convention of duplicating small,
 * stable constants/predicates (see `isTruthyFlag` above) rather than acquiring a new static
 * dependency for one string. Both phases of archive-sync.mjs measure their deadlines from this
 * file's mtime/contents. */
const BUILD_STARTED_AT_PATH = '.astro/ci-build-started-at';

/** 05-08: mirrors archive-sync.mjs's own `RESULT_LINE_PREFIX` constant (duplicated, not imported
 * — same reasoning as `BUILD_STARTED_AT_PATH` above). */
const RESULT_LINE_PREFIX = 'ARCHIVE_SYNC_RESULT ';

/**
 * Writes `.astro/ci-build-started-at` (epoch seconds), creating `.astro/` if it doesn't exist yet
 * — real default used outside tests. Both archive-sync.mjs phases (pre's 840s deadline, post's
 * 1020s deadline) measure their own deadline from this file's contents, so it must be written
 * before `pnpm run build` starts, not after.
 */
function defaultMarkBuildStart() {
  mkdirSync(dirname(BUILD_STARTED_AT_PATH), { recursive: true });
  writeFileSync(BUILD_STARTED_AT_PATH, String(Math.floor(Date.now() / 1000)));
}

/**
 * Scans `tail` for the last line starting with archive-sync.mjs's own `ARCHIVE_SYNC_RESULT `
 * prefix and parses the JSON that follows it. Returns `null` (never throws) when no such line is
 * present or the JSON after the prefix doesn't parse — a missing/malformed result line from a
 * spawned archive-sync run is a signal to alert on, not a reason to crash this wrapper.
 */
export function parseArchiveSyncResult(tail) {
  const lines = String(tail ?? '').split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith(RESULT_LINE_PREFIX)) continue;
    try {
      return JSON.parse(line.slice(RESULT_LINE_PREFIX.length));
    } catch {
      return null;
    }
  }
  return null;
}

/** 05-08 Task 2: mirrors `tools/archive-sync.mjs`'s own `isR2WriteBlocked` predicate, inverted —
 * a deploy counts as "production" whenever archive-sync would NOT block its own R2 writes: the
 * branch is `main`, or there's no `WORKERS_CI` at all (a local run deploys to the same production
 * Worker/bucket archive-sync itself targets). Kept in sync deliberately (orchestrator directive)
 * so this wrapper's hot-window guard and archive-sync's write-boundary guard never disagree about
 * what counts as "production". */
function isProductionDeploy(env) {
  return env.WORKERS_CI_BRANCH === 'main' || !isTruthyFlag(env.WORKERS_CI);
}

/** Default `loadHotWindowImpl` — dynamically imports `src/lib/archive/hot-window.ts` (never
 * statically imported, same reasoning as `defaultCommitImpl`'s dynamic import of
 * `build-state.ts`: the `build` step must never load this file at all). Reads and validates
 * `src/lib/archive/hot-window.json` via that module's own `loadHotWindow()` (which itself calls
 * `parseHotWindow`). */
async function defaultLoadHotWindow() {
  const { loadHotWindow } = await import('../src/lib/archive/hot-window.ts');
  return loadHotWindow();
}

/** Builds the daily-report ntfy body (REND-11: static file count vs. the 100,000 ceiling/80,000
 * fail line, archived page count, hot-window status/days, backlog) from
 * `archive-sync.mjs`'s own `dailyReport.body` shape. Spells out `PROVISIONAL` in the hot-window
 * line whenever the window in force is `fallback-provisional` (D-07) — an operator must never
 * have to cross-reference `hot-window.json` themselves to notice a fallback shipped. */
function formatDailyReportBody(body = {}) {
  const provisionalSuffix = body.hotWindowStatus === 'fallback-provisional' ? ' — PROVISIONAL' : '';
  return [
    `static files: ${body.staticFileCount ?? '?'} / ${body.ceiling ?? STATIC_ASSET_CEILING_FALLBACK} (fail at ${body.failAt ?? '?'})`,
    `archived pages: ${body.archivedCount ?? '?'}`,
    `hot window: ${body.hotWindowStatus ?? 'unknown'}, ${body.hotWindowDays ?? '?'} days${provisionalSuffix}`,
    `backlog: ${body.backlog ?? 0}`,
  ].join('\n');
}

/** Fallback ceiling text for `formatDailyReportBody` if a caller somehow omits `ceiling` — kept
 * as a named constant rather than a bare `100000` literal so the number's meaning is obvious at
 * the call site. */
const STATIC_ASSET_CEILING_FALLBACK = 100_000;

/**
 * Scans `tail` from the end for the last line that parses as JSON on its own (no prefix) —
 * `tools/assert-file-count.mjs --json`'s own output shape. Returns `null` (never throws) when no
 * line parses.
 */
function parseLastJsonLine(tail) {
  const lines = String(tail ?? '').split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * T-04-35: strips every secret value this project knows the name of, then sweeps any remaining
 * 40+ character token-shaped run. Order matters: named-value redaction runs first so a token
 * shorter than 40 characters is still caught by name; the generic sweep then catches anything the
 * named list missed (an unnamed credential, a session id, etc).
 */
export function redact(text, env = {}) {
  let out = String(text ?? '');
  for (const key of SECRET_ENV_KEYS) {
    const value = env?.[key];
    if (value) {
      out = out.split(value).join('[REDACTED]');
    }
  }
  out = out.replace(TOKEN_LIKE_RE, '[REDACTED]');
  return out;
}

/**
 * Scans `outputTail` line by line and returns the line naming one of this project's own
 * fail-loud modules (T-04-35's `CHECK_PATTERNS`) — an operator reading the ntfy push then knows
 * exactly which check failed, not just that "the build" failed. Falls back to a bare
 * `astro build exited <code>` when nothing in the tail names a known check.
 *
 * 04-10 (D-15 real-build drill, Workers Builds spike): a real failing build proved the original
 * "first line containing the substring anywhere" rule mis-attributes the failure whenever an
 * EARLIER, successful step's own output happens to mention a check's name — a shell command echo
 * (`$ node --test tests/ci-fixtures/assert-no-d1.test.mjs`) or a PASSING test's own description
 * (`✔ Case 1 (ARCH-02): a page-shaped fixture that reaches d1-client.ts transitively through a
 * helper is rejected`) both substring-match a CHECK_PATTERNS entry despite naming no failure at
 * all. Every real throw in this codebase follows one consistent convention — `` `${moduleName}:
 * ${message}` `` (see src/content/loaders/changelog-loader.ts, src/lib/server/d1-client.ts,
 * src/lib/server/kv-manifest.ts, src/lib/server/build-state.ts, src/lib/listing.ts) — so this now
 * prefers a line ANCHORED on `<pattern>:` at the start (after trimming, and after skipping `$
 * `-prefixed command echoes, which are never a failure) before falling back to the original loose
 * substring scan for any error shape that doesn't follow that convention.
 */
export function classifyFailure(outputTail, exitCode) {
  const lines = String(outputTail ?? '').split('\n');

  // Pass 1: prefer a line anchored on this project's own `<check>: <message>` throw convention.
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$ ')) continue; // shell command echo, never a failure
    for (const pattern of CHECK_PATTERNS) {
      if (trimmed.startsWith(`${pattern}:`)) return trimmed;
    }
  }

  // Pass 2: fall back to a loose substring match (still skipping command echoes) for any real
  // error shape that doesn't follow the anchored convention above.
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$ ')) continue;
    if (CHECK_PATTERNS.some((pattern) => trimmed.includes(pattern))) return trimmed;
  }

  return `astro build exited ${exitCode}`;
}

/**
 * Real process spawn — tees stdout/stderr straight through (so a live Workers Builds log still
 * shows everything a bare `pnpm run build` would) while also keeping the last
 * `NUMBER_OF_TAIL_LINES` lines for `classifyFailure` to scan. Never throws: a spawn error (e.g.
 * the binary is missing) resolves as a failed run rather than rejecting, so `runCi` always gets a
 * `{ code, tail }` result to act on.
 */
function defaultSpawn(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ code: 1, tail: String(err?.message ?? err) });
      return;
    }

    const tailLines = [];
    const onData = (streamName) => (chunk) => {
      const text = chunk.toString();
      (streamName === 'stderr' ? process.stderr : process.stdout).write(text);
      for (const line of text.split('\n')) {
        tailLines.push(line);
        if (tailLines.length > NUMBER_OF_TAIL_LINES) tailLines.shift();
      }
    };
    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    child.on('error', (err) => resolve({ code: 1, tail: String(err?.message ?? err) }));
    child.on('exit', (code) => resolve({ code: code ?? 1, tail: tailLines.join('\n') }));
  });
}

/**
 * HTTP header VALUES must be byte-safe (Latin1) — undici's `fetch()` throws a `TypeError` for any
 * header value containing a code point above 255 ("Cannot convert argument to a ByteString").
 * This project's own error messages routinely use em-dashes, en-dashes and curly quotes (see this
 * very file's own comments, and `changelog-loader.ts`'s real thrown messages), so a REAL failure
 * title must be normalized before use as the ntfy `Title` header, or the notifier crashes
 * uncaught.
 *
 * 04-10 finding (D-15 drill): after `classifyFailure()` was fixed to correctly name the real
 * failing check, the corrected title crashed the entire `ci-build` process with exactly this
 * `ByteString` `TypeError` — defeating "a failure never fails silently" (D-15's whole point) at
 * the exact moment the notification mattered most. Common typographic punctuation is normalized
 * to its ASCII equivalent; anything else outside Latin1 is stripped rather than crashing.
 * `body` (the POST payload, not a header) is NOT subject to this restriction and is sent as-is.
 */
export function toHeaderSafe(text) {
  return String(text ?? '')
    .replace(/[–—]/g, '-') // en dash, em dash
    .replace(/[‘’]/g, "'") // curly single quotes
    .replace(/[“”]/g, '"') // curly double quotes
    .replace(/…/g, '...') // ellipsis
    .replace(/[^\x00-\xff]/g, ''); // strip anything else outside Latin1
}

/**
 * Real ntfy push (jja-ntfy skill's own protocol: `POST {server}/{topic}`, `Title`/`Priority`/
 * `Tags` headers, optional Bearer auth). Never called with a raw secret — every caller routes
 * `body`/`title` through `redact()` first, and `title` through `toHeaderSafe()` here (the header
 * boundary, not `redact()`'s job).
 *
 * 05-08 Task 2: `priority`/`tags` are now overridable (defaults unchanged — `high`/
 * `rotating_light`, the original failure-notification shape); the daily report uses
 * `low`/`bar_chart`, the file-count alarm uses `high`/`warning`.
 */
async function defaultNotify({ env, title, body, priority = 'high', tags = 'rotating_light' }) {
  const server = env.NTFY_SERVER ?? 'https://ntfy.sh';
  const topic = env.NTFY_TOPIC;
  const headers = {
    Title: toHeaderSafe(title),
    Priority: priority,
    Tags: tags,
  };
  if (env.NTFY_TOKEN) headers.Authorization = `Bearer ${env.NTFY_TOKEN}`;
  await fetch(`${server}/${encodeURIComponent(topic)}`, { method: 'POST', headers, body });
}

/**
 * The only place this file ever touches `src/lib/server/build-state.ts` — a dynamic import, so
 * the `build` step (which may run with no KV credentials at all) never loads a module whose
 * top-level code path can throw on a missing `CLOUDFLARE_API_TOKEN`. Only reached after a REAL,
 * successful `wrangler deploy`.
 */
async function defaultCommitImpl({ buildHash }) {
  const { commitLastGood } = await import('../src/lib/server/build-state.ts');
  const { resolveBuildHash } = await import('../src/lib/build-info.ts');
  const resolvedHash = buildHash ?? resolveBuildHash(process.env).hash;
  await commitLastGood({ buildHash: resolvedHash });
}

/**
 * Runs `spawnFn` while a watchdog timer (`watchdogMs`, default 18 minutes) races it. If the
 * watchdog fires first, it calls `onWatchdog()` once and then keeps waiting for `spawnFn` to
 * finish on its own — D-15 requires a warning before Workers Builds' 20-minute ceiling, never a
 * kill (this wrapper has no mechanism to kill the child process it spawned, by design: a build
 * that's merely slow, not stuck, must be allowed to finish).
 */
async function runWatched({ spawnFn, setTimer, clearTimer, watchdogMs, onWatchdog, log }) {
  const handle = setTimer(async () => {
    try {
      await onWatchdog();
    } catch (err) {
      log(`[ci-build] watchdog notification failed: ${err?.message ?? err}`);
    }
  }, watchdogMs);

  try {
    return await spawnFn();
  } finally {
    clearTimer(handle);
  }
}

/**
 * runCi({ step, env, spawnImpl, notifyImpl, commitImpl, setTimer, clearTimer, log }) — the whole
 * wrapper. `step` is `'build' | 'deploy' | 'all'`. Returns the process exit code the CLI should
 * use (0 = success).
 *
 * Guarantees enforced here, not left to caller discipline:
 *  - `WORKERS_CI` set + no `NTFY_TOPIC` fails immediately, before anything is spawned (T-04-38).
 *  - The build is always spawned with `BUILD_STATE_REQUIRE_BASELINE=1` — a deploying build must
 *    never run without a last-good baseline to check against (04-03).
 *  - `deploy` only ever calls `commitImpl` after `wrangler deploy` itself exits 0.
 *  - `all` never spawns a deploy step if the build step failed.
 *  - Every notification body/title passes through `redact()`.
 */
export async function runCi(opts = {}) {
  const {
    step,
    env = process.env,
    spawnImpl = defaultSpawn,
    notifyImpl = defaultNotify,
    commitImpl = defaultCommitImpl,
    markBuildStart = defaultMarkBuildStart,
    loadHotWindowImpl = defaultLoadHotWindow,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
    log = (...args) => console.log(...args),
  } = opts;

  const commit = env.WORKERS_CI_COMMIT_SHA ?? 'local';
  const branch = env.WORKERS_CI_BRANCH ?? 'local';
  const buildUuid = env.WORKERS_CI_BUILD_UUID ?? 'local';
  const inCi = isTruthyFlag(env.WORKERS_CI);
  const watchdogMs = Number(env.BUILD_WATCHDOG_MS) > 0 ? Number(env.BUILD_WATCHDOG_MS) : DEFAULT_WATCHDOG_MS;

  async function sendNotification(title, rawBody, { priority = 'high', tags = 'rotating_light' } = {}) {
    const body = redact(rawBody, env);
    const safeTitle = redact(title, env);
    if (!env.NTFY_TOPIC) {
      log(`[ci-build] NTFY_TOPIC not set — logging only: ${safeTitle}\n${body}`);
      return;
    }
    await notifyImpl({ env, title: safeTitle, body, priority, tags });
  }

  async function notifyFailure(check) {
    const title = `915 TLDR build failed: ${check}`;
    const body = `${check}\ncommit: ${commit}\nbranch: ${branch}\nbuild: ${buildUuid}`;
    await sendNotification(title, body);
  }

  async function notifyWatchdog() {
    const title = `915 TLDR build still running: watchdog (${watchdogMs}ms)`;
    const body = `build has exceeded ${watchdogMs}ms and has not finished\ncommit: ${commit}\nbranch: ${branch}\nbuild: ${buildUuid}`;
    await sendNotification(title, body);
  }

  // T-04-38: a deploying build must never run unmonitored. Checked before anything is spawned,
  // for both the 'build' and 'all' steps (either can be the one Workers Builds invokes as its
  // configured "build command").
  if ((step === 'build' || step === 'all') && inCi && !env.NTFY_TOPIC) {
    log(
      '[ci-build] refusing to run: WORKERS_CI is set but NTFY_TOPIC is not — a deploying build must never run unmonitored (set NTFY_TOPIC)'
    );
    return 1;
  }

  if (step === 'build' || step === 'all') {
    // 05-08: written BEFORE the build spawns — both archive-sync.mjs phases measure their own
    // deadline (pre: 840s, post: 1020s) from this file's contents, so it must reflect the real
    // start of THIS build, not some earlier moment.
    markBuildStart();

    const buildResult = await runWatched({
      spawnFn: () =>
        spawnImpl('pnpm', ['run', 'build'], {
          env: { ...env, BUILD_STATE_REQUIRE_BASELINE: '1' },
        }),
      setTimer,
      clearTimer,
      watchdogMs,
      onWatchdog: notifyWatchdog,
      log,
    });

    if (buildResult.code !== 0) {
      const check = classifyFailure(buildResult.tail, buildResult.code);
      await notifyFailure(check);
      return buildResult.code;
    }

    if (step === 'build') return 0;
  }

  if (step === 'deploy' || step === 'all') {
    // 05-08 Task 2: a production deploy (main CI branch, or any local run — a local deploy
    // targets the same production Worker/bucket) must never ship a fallback-provisional hot
    // window (D-07b) silently. Checked BEFORE any spawn at all — no archive-sync pre, no
    // file-count gate, no wrangler. ALLOW_FALLBACK_HOT_WINDOW=1 is the deliberate, named override
    // for the rare case the owner actually wants to ship the fallback (05-05's own D-07 escape
    // hatch, extended here to the real deploy path).
    if (isProductionDeploy(env)) {
      let hotWindow;
      try {
        hotWindow = await loadHotWindowImpl();
      } catch (err) {
        await notifyFailure(`hot-window: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      if (hotWindow.status === 'fallback-provisional' && !isTruthyFlag(env.ALLOW_FALLBACK_HOT_WINDOW)) {
        await notifyFailure(
          'hot-window: refusing to ship a fallback-provisional hot window without ALLOW_FALLBACK_HOT_WINDOW=1 (D-07b)'
        );
        return 1;
      }
    }

    // 05-08: the real deploy sequence — archive-sync pre (upload new-to-archive pages, move back
    // anything that fails/misses the deadline) -> the file-count gate re-run on the FINAL
    // dist/client (pre may have moved pages back into it) -> wrangler deploy (or a dry run
    // rehearsal, CI_BUILD_DEPLOY_DRY_RUN=1) -> commitLastGood -> archive-sync post (re-upload
    // changed pages, orphan cleanup, backlog/daily-report bookkeeping). commitLastGood AND
    // archive-sync post are BOTH skipped entirely in a dry run (CI_BUILD_DEPLOY_DRY_RUN=1 deploys
    // nothing, so nothing may be committed or deleted; CR-01, 05-13). Pre and the file-count gate
    // can abort the whole deploy (D-13); post never can (D-10/D-12) — a failed or resultless post
    // run is logged, not treated as a build failure, since `wrangler deploy` (and therefore the
    // site) already succeeded by the time post runs. Every informational alert gathered along the
    // way (pre's own alerts, the file-count warn alarm, post's alerts/daily-report) is sent AFTER
    // the deploy succeeds — never blocking it, never gating it. A dry run still delivers every
    // alert it gathered before the wrangler step (pre's alerts, the file-count warn alarm).
    const pendingAlerts = [];

    const preResult = await spawnImpl('node', ['tools/archive-sync.mjs', 'pre', '--json'], { env });
    if (preResult.code !== 0) {
      const check = classifyFailure(preResult.tail, preResult.code);
      await notifyFailure(`archive-sync: ${check}`);
      return preResult.code;
    }
    const preParsed = parseArchiveSyncResult(preResult.tail);
    if (preParsed) {
      for (const alert of preParsed.alerts ?? []) {
        pendingAlerts.push({ title: '915 TLDR archive alert: pre-deploy sync', body: alert });
      }
    } else {
      pendingAlerts.push({
        title: '915 TLDR archive alert: pre-deploy sync',
        body: 'archive-sync: pre-deploy sync produced no parseable ARCHIVE_SYNC_RESULT line',
      });
    }

    const countResult = await spawnImpl('node', ['tools/assert-file-count.mjs', '--json'], { env });
    if (countResult.code !== 0) {
      const check = classifyFailure(countResult.tail, countResult.code);
      await notifyFailure(`assert-file-count: ${check}`);
      return countResult.code;
    }
    const countParsed = parseLastJsonLine(countResult.tail);
    if (countParsed?.status === 'warn') {
      pendingAlerts.push({
        title: '915 TLDR archive alarm: file count',
        body: `archive: static file count ${countParsed.count} / ${countParsed.ceiling ?? STATIC_ASSET_CEILING_FALLBACK} (fail at ${countParsed.failAt ?? '80000'}) — approaching the ceiling`,
        priority: 'high',
        tags: 'warning',
      });
    }

    const dryRun = isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN);
    const wranglerArgs = dryRun
      ? ['exec', 'wrangler', 'deploy', '--dry-run', '--config', 'wrangler.jsonc', '--outdir', '.wrangler/ci-dry-run']
      : ['exec', 'wrangler', 'deploy', '--config', 'wrangler.jsonc'];
    const deployResult = await spawnImpl('pnpm', wranglerArgs, { env });

    if (deployResult.code !== 0) {
      const check = classifyFailure(deployResult.tail, deployResult.code);
      await notifyFailure(`wrangler deploy: ${check}`);
      return deployResult.code;
    }

    if (dryRun) {
      // CR-01 (05-13): a dry run deployed nothing — commitLastGood must never commit against a
      // build that was never actually deployed, and archive-sync post must never mutate the
      // production bucket (re-upload, orphan deletion) on its behalf. Confining both inside this
      // branch is the single dry-run predicate; the pendingAlerts loop below still runs for both
      // branches so pre's alerts and the file-count warn alarm are still delivered.
      log('[ci-build] dry run: skipping archive-sync post — it mutates the production bucket and this run deployed nothing');
    } else {
      await commitImpl({ buildHash: commit !== 'local' ? commit.slice(0, 7) : undefined });

      const postResult = await spawnImpl('node', ['tools/archive-sync.mjs', 'post', '--json'], { env });
      const postParsed = parseArchiveSyncResult(postResult.tail);
      if (postResult.code !== 0 || !postParsed) {
        const check = classifyFailure(postResult.tail, postResult.code);
        pendingAlerts.push({
          title: '915 TLDR archive alert: post-deploy sync',
          body: `archive-sync: post-deploy sync failed or produced no result — ${check}`,
        });
      } else {
        for (const alert of postParsed.alerts ?? []) {
          pendingAlerts.push({ title: '915 TLDR archive alert: post-deploy sync', body: alert });
        }
        if (postParsed.dailyReport?.due) {
          pendingAlerts.push({
            title: '915 TLDR archive daily report',
            body: formatDailyReportBody(postParsed.dailyReport.body ?? {}),
            priority: 'low',
            tags: 'bar_chart',
          });
        }
      }
    }

    // D-10/D-12: every alert above is informational — the deploy itself already succeeded (or
    // never started). A notification failure here (e.g. ntfy unreachable) must never surface as
    // this function's own return value.
    for (const alert of pendingAlerts) {
      try {
        await sendNotification(alert.title, alert.body, { priority: alert.priority, tags: alert.tags });
      } catch (err) {
        log(`[ci-build] archive alert notification failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return 0;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const step = process.argv[2];
  if (!['build', 'deploy', 'all'].includes(step)) {
    console.error('Usage: node tools/ci-build.mjs <build|deploy|all>');
    process.exitCode = 1;
    return;
  }
  const code = await runCi({ step, env: process.env });
  process.exitCode = code;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

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
];

/** T-04-35/T-04-36: env keys whose exact value must never appear in a notification body. */
const SECRET_ENV_KEYS = ['CLOUDFLARE_API_TOKEN', 'NTFY_TOKEN'];

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
 */
async function defaultNotify({ env, title, body }) {
  const server = env.NTFY_SERVER ?? 'https://ntfy.sh';
  const topic = env.NTFY_TOPIC;
  const headers = {
    Title: toHeaderSafe(title),
    Priority: 'high',
    Tags: 'rotating_light',
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
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
    log = (...args) => console.log(...args),
  } = opts;

  const commit = env.WORKERS_CI_COMMIT_SHA ?? 'local';
  const branch = env.WORKERS_CI_BRANCH ?? 'local';
  const buildUuid = env.WORKERS_CI_BUILD_UUID ?? 'local';
  const inCi = isTruthyFlag(env.WORKERS_CI);
  const watchdogMs = Number(env.BUILD_WATCHDOG_MS) > 0 ? Number(env.BUILD_WATCHDOG_MS) : DEFAULT_WATCHDOG_MS;

  async function sendNotification(title, rawBody) {
    const body = redact(rawBody, env);
    const safeTitle = redact(title, env);
    if (!env.NTFY_TOPIC) {
      log(`[ci-build] NTFY_TOPIC not set — logging only: ${safeTitle}\n${body}`);
      return;
    }
    await notifyImpl({ env, title: safeTitle, body });
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
    const deployResult = await spawnImpl('pnpm', ['exec', 'wrangler', 'deploy', '--config', 'wrangler.jsonc'], {
      env,
    });

    if (deployResult.code !== 0) {
      const check = classifyFailure(deployResult.tail, deployResult.code);
      await notifyFailure(`wrangler deploy: ${check}`);
      return deployResult.code;
    }

    await commitImpl({ buildHash: commit !== 'local' ? commit.slice(0, 7) : undefined });
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

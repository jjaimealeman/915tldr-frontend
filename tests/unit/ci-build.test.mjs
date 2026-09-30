#!/usr/bin/env node
// 04-09 Task 1 (RED, then made GREEN by tools/ci-build.mjs): pins the Workers Builds wrapper's
// fail-loud contract (D-15/REND-02) — a failing build must never reach `wrangler deploy`, a
// failure must never fail silently, and `commitLastGood` only ever runs after a REAL successful
// production deploy. Every spawn/notify/commit boundary is a stubbed deps seam
// (`spawnImpl`/`notifyImpl`/`commitImpl`/`setTimer`/`clearTimer`), following this project's own
// `fetchImpl` convention (see tests/unit/build-state.test.mjs) — this suite never spawns a real
// process, sends a real ntfy push, or writes real KV.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCi, classifyFailure, redact, toHeaderSafe } from '../../tools/ci-build.mjs';

const EIGHTEEN_MINUTES_MS = 18 * 60 * 1000;

function noopTimer() {
  return 'timer-handle';
}
function noopClear() {}
function noopLog() {}

// ---------------------------------------------------------------------------
// classifyFailure
// ---------------------------------------------------------------------------

test('classifyFailure: picks the first line naming a known check, for every named check', () => {
  const checks = [
    'd1-articles-loader',
    'changelog-loader',
    'd1-client',
    'kv-manifest',
    'build-state',
    'assert-no-d1',
    'listing',
  ];
  for (const check of checks) {
    const tail = `some earlier noise\nError: ${check} threw during build\nmore noise after`;
    assert.equal(
      classifyFailure(tail, 1),
      `Error: ${check} threw during build`,
      `expected the line naming "${check}" to be picked`
    );
  }
});

test('classifyFailure: picks the FIRST matching line when more than one is present', () => {
  const tail = 'noise\nd1-client: connection refused\nkv-manifest: bulk write failed\n';
  assert.equal(classifyFailure(tail, 1), 'd1-client: connection refused');
});

test('classifyFailure: falls back to "astro build exited <code>" when nothing matches', () => {
  assert.equal(classifyFailure('nothing relevant in this output at all', 2), 'astro build exited 2');
});

test('classifyFailure: falls back cleanly on empty/undefined output', () => {
  assert.equal(classifyFailure('', 137), 'astro build exited 137');
  assert.equal(classifyFailure(undefined, 1), 'astro build exited 1');
});

test('classifyFailure: a real build\'s benign command-echo/passing-test lines that merely MENTION a check name must not be picked over the actual failing check (04-10 regression, D-15 real Workers Builds drill)', () => {
  // Trimmed, but otherwise verbatim, from a real local `node tools/ci-build.mjs build` run
  // (04-10 Task 2's D-15 drill, V1_CHANGELOG_URL pointed at an empty-entries data: URL) — the
  // ORIGINAL classifyFailure misattributed this failure to the "$ node --test
  // tests/ci-fixtures/assert-no-d1.test.mjs" command echo, purely because "assert-no-d1" is both
  // a CHECK_PATTERNS entry and the literal filename of an earlier, successful build step.
  const tail = [
    '$ pnpm run guard:config && pnpm run test:build-gate && astro build',
    '$ node tools/check-config-guards.mjs',
    '[check-config-guards] no violations found (ARCH-04, ARCH-05, T-03-01)',
    '$ node --test tests/ci-fixtures/assert-no-d1.test.mjs',
    '✔ Case 1 (ARCH-02): a page-shaped fixture that reaches d1-client.ts transitively through a helper is rejected (1.577085ms)',
    'ℹ pass 8',
    'ℹ fail 0',
    '[content] Syncing content',
    'changelog-loader: v1 changelog.json has zero entries — refusing to build (the /changelog empty-state failure, REND-03)',
    '  Location:',
    '    /repo/src/content/loaders/changelog-loader.ts:103:11',
    '[assert-no-d1] matched zero candidate files under src/pages/**, src/islands/**, or src/middleware.ts across the ENTIRE build (all internal passes) — the matcher is broken, not necessarily the codebase.',
    '[ELIFECYCLE] Command failed with exit code 1.',
  ].join('\n');
  assert.equal(
    classifyFailure(tail, 1),
    'changelog-loader: v1 changelog.json has zero entries — refusing to build (the /changelog empty-state failure, REND-03)'
  );
});

// ---------------------------------------------------------------------------
// redact
// ---------------------------------------------------------------------------

test('redact: removes the exact values of CLOUDFLARE_API_TOKEN and NTFY_TOKEN', () => {
  const env = { CLOUDFLARE_API_TOKEN: 'cf-secret-value-123', NTFY_TOKEN: 'ntfy-secret-value-456' };
  const text = `token=cf-secret-value-123 other=ntfy-secret-value-456 fine=hello`;
  const out = redact(text, env);
  assert.ok(!out.includes('cf-secret-value-123'));
  assert.ok(!out.includes('ntfy-secret-value-456'));
  assert.match(out, /\[REDACTED\]/);
  assert.match(out, /fine=hello/);
});

test('redact: removes any 40+ character token-like run even without a matching env var', () => {
  const env = {};
  const longToken = 'a1b2c3'.repeat(10); // 60 chars, token-shaped
  const text = `Authorization: Bearer ${longToken}`;
  const out = redact(text, env);
  assert.ok(!out.includes(longToken));
  assert.match(out, /\[REDACTED\]/);
});

test('redact: leaves ordinary short text untouched', () => {
  const out = redact('build failed: mode=warm rowsRead=5911', {});
  assert.equal(out, 'build failed: mode=warm rowsRead=5911');
});

// ---------------------------------------------------------------------------
// toHeaderSafe (04-10 regression, D-15 real drill)
// ---------------------------------------------------------------------------

test('toHeaderSafe: normalizes em-dash/en-dash/curly quotes/ellipsis to ASCII equivalents', () => {
  assert.equal(
    toHeaderSafe('changelog-loader: v1 changelog.json has zero entries — refusing to build'),
    'changelog-loader: v1 changelog.json has zero entries - refusing to build'
  );
  assert.equal(toHeaderSafe('a – b'), 'a - b');
  assert.equal(toHeaderSafe('‘quoted’ and “double”'), "'quoted' and \"double\"");
  assert.equal(toHeaderSafe('wait…'), 'wait...');
});

test('toHeaderSafe: strips any remaining code point above 255 rather than throwing', () => {
  const out = toHeaderSafe('build failed \u{1F6A8} now');
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new
    new Headers({ Title: out });
  });
  assert.ok(!/[^\x00-\xff]/.test(out));
});

test('toHeaderSafe: the exact real message that crashed the notifier (04-10 D-15 drill) round-trips through a real Headers object without throwing', () => {
  const realMessage =
    'changelog-loader: v1 changelog.json has zero entries — refusing to build (the /changelog empty-state failure, REND-03)';
  const safe = toHeaderSafe(realMessage);
  assert.doesNotThrow(() => new Headers({ Title: safe }));
});

test('toHeaderSafe: leaves plain ASCII untouched', () => {
  assert.equal(toHeaderSafe('astro build exited 1'), 'astro build exited 1');
});

test('toHeaderSafe: handles null/undefined without throwing', () => {
  assert.equal(toHeaderSafe(undefined), '');
  assert.equal(toHeaderSafe(null), '');
});

// ---------------------------------------------------------------------------
// runCi — step "all": a failing build never reaches deploy
// ---------------------------------------------------------------------------

test('runCi step=all: a build that exits 1 returns non-zero, spawns no wrangler process, notifies exactly once', async () => {
  const spawnCalls = [];
  const notifyCalls = [];
  const spawnImpl = async (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    return { code: 1, tail: 'astro build failed: boom' };
  };
  const code = await runCi({
    step: 'all',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {
      throw new Error('commitImpl must never be called after a failing build');
    },
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(spawnCalls.length, 1, 'only the build spawn should have happened');
  assert.ok(
    !spawnCalls.some((c) => (c.args ?? []).some((a) => String(a).includes('wrangler')) || String(c.cmd).includes('wrangler')),
    'no wrangler process should ever be spawned after a failing build'
  );
  assert.equal(notifyCalls.length, 1, 'notify should be called exactly once');
});

// ---------------------------------------------------------------------------
// runCi — notification shape
// ---------------------------------------------------------------------------

test('runCi: notification title is "915 TLDR build failed: <check>" and body carries commit/branch/build uuid', async () => {
  const notifyCalls = [];
  const spawnImpl = async () => ({ code: 1, tail: 'Error: kv-manifest write failed: 500' });
  const code = await runCi({
    step: 'build',
    env: {
      NTFY_TOPIC: 'test-topic',
      WORKERS_CI_COMMIT_SHA: 'abcdef1234567',
      WORKERS_CI_BRANCH: 'main',
      WORKERS_CI_BUILD_UUID: 'build-uuid-1',
    },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(notifyCalls.length, 1);
  assert.equal(notifyCalls[0].title, '915 TLDR build failed: Error: kv-manifest write failed: 500');
  assert.match(notifyCalls[0].body, /abcdef1234567/);
  assert.match(notifyCalls[0].body, /main/);
  assert.match(notifyCalls[0].body, /build-uuid-1/);
});

test('runCi: notification body falls back to "local" for commit/branch/build uuid outside Workers Builds', async () => {
  const notifyCalls = [];
  const spawnImpl = async () => ({ code: 1, tail: 'boom' });
  await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].body, /local/);
});

test('runCi: notification body is passed through redact (no raw token leaks)', async () => {
  const notifyCalls = [];
  const secretToken = 'super-secret-cf-token-value';
  const spawnImpl = async () => ({ code: 1, tail: 'boom' });
  await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'test-topic', CLOUDFLARE_API_TOKEN: secretToken },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(notifyCalls.length, 1);
  assert.ok(!notifyCalls[0].body.includes(secretToken));
  assert.ok(!notifyCalls[0].title.includes(secretToken));
});

// ---------------------------------------------------------------------------
// runCi — WORKERS_CI without NTFY_TOPIC must fail before spawning anything
// ---------------------------------------------------------------------------

test('runCi step=build: WORKERS_CI set with no NTFY_TOPIC fails before spawning, message names NTFY_TOPIC', async () => {
  const spawnCalls = [];
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: { WORKERS_CI: '1' },
    spawnImpl: async (...args) => {
      spawnCalls.push(args);
      return { code: 0, tail: '' };
    },
    notifyImpl: async () => {
      throw new Error('notify must not be called — there is no topic to notify to');
    },
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (msg) => logs.push(msg),
  });

  assert.notEqual(code, 0);
  assert.equal(spawnCalls.length, 0, 'nothing should be spawned before the preflight check passes');
  assert.ok(logs.some((l) => String(l).includes('NTFY_TOPIC')));
});

test('runCi step=all: the same WORKERS_CI-without-NTFY_TOPIC preflight also applies', async () => {
  const spawnCalls = [];
  const code = await runCi({
    step: 'all',
    env: { WORKERS_CI: '1' },
    spawnImpl: async (...args) => {
      spawnCalls.push(args);
      return { code: 0, tail: '' };
    },
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.notEqual(code, 0);
  assert.equal(spawnCalls.length, 0);
});

// ---------------------------------------------------------------------------
// runCi — deploy step: commitLastGood only after a real successful deploy
// ---------------------------------------------------------------------------

test('runCi step=deploy: wrangler exit 0 calls commitImpl exactly once', async () => {
  const commitCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: {},
    spawnImpl: async () => ({ code: 0, tail: '' }),
    notifyImpl: async () => {
      throw new Error('notify must not be called on a successful deploy');
    },
    commitImpl: async (a) => commitCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(commitCalls.length, 1);
});

test('runCi step=deploy: wrangler exit 1 never calls commitImpl, and notifies', async () => {
  const commitCalls = [];
  const notifyCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: async () => ({ code: 1, tail: 'wrangler: authentication error' }),
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async (a) => commitCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(commitCalls.length, 0);
  assert.equal(notifyCalls.length, 1);
});

// ---------------------------------------------------------------------------
// runCi — watchdog: notifies once past BUILD_WATCHDOG_MS, never kills the build
// ---------------------------------------------------------------------------

test('runCi: watchdog notifies once past the default 18-minute threshold and does not kill the build', async () => {
  let resolveSpawn;
  const spawnCalls = [];
  const spawnImpl = async (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    return new Promise((resolve) => {
      resolveSpawn = resolve;
    });
  };

  let capturedFn;
  let capturedMs;
  const setTimer = (fn, ms) => {
    capturedFn = fn;
    capturedMs = ms;
    return 'timer-handle';
  };
  const clearedHandles = [];
  const clearTimer = (h) => clearedHandles.push(h);

  const notifyCalls = [];
  const notifyImpl = async (a) => notifyCalls.push(a);

  const runPromise = runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl,
    setTimer,
    clearTimer,
    log: noopLog,
  });

  // Let the microtask queue advance so spawnImpl has been invoked and the watchdog timer armed.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(spawnCalls.length, 1);
  assert.equal(capturedMs, EIGHTEEN_MINUTES_MS);
  assert.equal(typeof capturedFn, 'function');

  // Simulate the watchdog firing while the build is still "running".
  await capturedFn();
  assert.equal(notifyCalls.length, 1, 'the watchdog should notify exactly once');

  // The build later finishes successfully — the watchdog must not have killed it (only one spawn
  // call ever happened) and success must not trigger a second notify.
  resolveSpawn({ code: 0, tail: '' });
  const code = await runPromise;
  assert.equal(code, 0);
  assert.equal(spawnCalls.length, 1, 'the watchdog must never spawn a second/replacement process');
  assert.equal(notifyCalls.length, 1, 'a successful build must not add a second notify');
  assert.ok(clearedHandles.includes('timer-handle'), 'the watchdog timer must be cleared once the build settles');
});

test('runCi: watchdog honors BUILD_WATCHDOG_MS override', async () => {
  let capturedMs;
  const setTimer = (fn, ms) => {
    capturedMs = ms;
    return 'h';
  };
  await runCi({
    step: 'build',
    env: { BUILD_WATCHDOG_MS: '60000' },
    spawnImpl: async () => ({ code: 0, tail: '' }),
    setTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(capturedMs, 60000);
});

// ---------------------------------------------------------------------------
// runCi — no NTFY_TOPIC outside CI: log only, no network request
// ---------------------------------------------------------------------------

test('runCi: outside CI with no NTFY_TOPIC, a failure is logged only and notifyImpl is never called', async () => {
  const notifyCalls = [];
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: {},
    spawnImpl: async () => ({ code: 1, tail: 'boom' }),
    notifyImpl: async (a) => notifyCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (msg) => logs.push(msg),
  });

  assert.notEqual(code, 0);
  assert.equal(notifyCalls.length, 0);
  assert.ok(logs.length > 0);
});

// ---------------------------------------------------------------------------
// runCi — deploying builds always require a baseline
// ---------------------------------------------------------------------------

test('runCi step=build and step=all: the build is spawned with BUILD_STATE_REQUIRE_BASELINE=1', async () => {
  for (const step of ['build', 'all']) {
    let firstCallEnv;
    const spawnImpl = async (cmd, args, opts) => {
      if (!firstCallEnv) firstCallEnv = opts?.env;
      return { code: 0, tail: '' };
    };
    // eslint-disable-next-line no-await-in-loop
    await runCi({
      step,
      env: {},
      spawnImpl,
      commitImpl: async () => {},
      setTimer: noopTimer,
      clearTimer: noopClear,
      log: noopLog,
    });
    assert.equal(firstCallEnv?.BUILD_STATE_REQUIRE_BASELINE, '1', `step=${step}`);
  }
});

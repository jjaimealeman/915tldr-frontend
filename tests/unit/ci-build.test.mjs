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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runCi,
  classifyFailure,
  redact,
  toHeaderSafe,
  parseArchiveSyncResult,
  isPerPageBuildLine,
  createPageLineFilter,
} from '../../tools/ci-build.mjs';

const EIGHTEEN_MINUTES_MS = 18 * 60 * 1000;

// A always-'derived' hot window, injected into deploy/all tests below that don't care about the
// 05-08 Task 2 hot-window guard — keeps those tests hermetic (no real fs read of
// src/lib/archive/hot-window.json) and immune to that file's own status changing later.
const DERIVED_HOT_WINDOW = { status: 'derived', provisional: false, days: 202, basis: 'test', decision: 'test' };
async function fakeLoadHotWindow() {
  return DERIVED_HOT_WINDOW;
}

function noopTimer() {
  return 'timer-handle';
}
function noopClear() {}
function noopLog() {}

// ---------------------------------------------------------------------------
// CR-02 (05-20): package.json contract — deploy routed through ci-build.mjs,
// never a bare wrangler deploy; guard:archive-synced script present
// ---------------------------------------------------------------------------

test('package.json (CR-02, 05-20): scripts.deploy routes through tools/ci-build.mjs deploy and never calls a bare wrangler deploy; guard:archive-synced is defined', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.scripts.deploy, /tools\/ci-build\.mjs deploy/);
  assert.doesNotMatch(pkg.scripts.deploy, /\bwrangler\s+deploy\b/);
  assert.equal(pkg.scripts['guard:archive-synced'], 'node tools/assert-archive-synced.mjs');
});

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

test('classifyFailure (05-08 Task 2): picks the first line naming a known archive-tier check, for every new pattern', () => {
  const checks = ['archive-sync', 'partition-archive', 'assert-file-count', 'hot-window', 'tiering', 'tier-facts', 'r2-client'];
  for (const check of checks) {
    const tail = `some earlier noise\n${check}: something went wrong\nmore noise after`;
    assert.equal(
      classifyFailure(tail, 1),
      `${check}: something went wrong`,
      `expected the line naming "${check}" to be picked`
    );
  }
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

test('redact (05-08 Task 2): removes R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY values', () => {
  const env = { R2_ACCESS_KEY_ID: 'r2-key-abc-value', R2_SECRET_ACCESS_KEY: 'r2-secret-xyz-value' };
  const text = 'key=r2-key-abc-value secret=r2-secret-xyz-value fine=hello';
  const out = redact(text, env);
  assert.ok(!out.includes('r2-key-abc-value'));
  assert.ok(!out.includes('r2-secret-xyz-value'));
  assert.match(out, /\[REDACTED\]/);
  assert.match(out, /fine=hello/);
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
  const notifyCalls = [];
  const code = await runCi({
    step: 'build',
    env: { WORKERS_CI: '1' },
    spawnImpl: async (...args) => {
      spawnCalls.push(args);
      return { code: 0, tail: '' };
    },
    // REND-11 follow-up (quick 261002-s2r): sendNotification's new try/catch would swallow a
    // thrown-to-detect-a-call notifyImpl, silently hiding a regression. Record calls instead.
    notifyImpl: async (a) => notifyCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (msg) => logs.push(msg),
  });

  assert.notEqual(code, 0);
  assert.equal(spawnCalls.length, 0, 'nothing should be spawned before the preflight check passes');
  assert.equal(notifyCalls.length, 0, 'notify must not be called — there is no topic to notify to');
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
  const notifyCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: {},
    spawnImpl: async () => ({ code: 0, tail: '' }),
    // REND-11 follow-up (quick 261002-s2r): see the note on the WORKERS_CI-without-NTFY_TOPIC
    // test above — record calls rather than throw, so the new try/catch can't swallow detection.
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async (a) => commitCalls.push(a),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(commitCalls.length, 1);
  assert.equal(notifyCalls.length, 0, 'notify must not be called on a successful deploy');
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
      loadHotWindowImpl: fakeLoadHotWindow,
      setTimer: noopTimer,
      clearTimer: noopClear,
      log: noopLog,
    });
    assert.equal(firstCallEnv?.BUILD_STATE_REQUIRE_BASELINE, '1', `step=${step}`);
  }
});

// ---------------------------------------------------------------------------
// parseArchiveSyncResult (05-08 Task 1)
// ---------------------------------------------------------------------------

test('parseArchiveSyncResult: parses the ARCHIVE_SYNC_RESULT JSON line out of a noisy tail', () => {
  const tail = [
    '[archive-sync] pre: uploaded=50 failed=0 movedBack=30428 disabled=false',
    'ARCHIVE_SYNC_RESULT {"phase":"pre","uploaded":50,"failed":0,"deferred":0,"movedBack":30428,"deleted":0,"backlog":null,"alerts":[],"dailyReport":null,"disabled":false}',
  ].join('\n');
  const result = parseArchiveSyncResult(tail);
  assert.equal(result.phase, 'pre');
  assert.equal(result.uploaded, 50);
  assert.equal(result.movedBack, 30428);
});

test('parseArchiveSyncResult: returns null when no result line is present', () => {
  assert.equal(parseArchiveSyncResult('nothing relevant here\nno result line at all'), null);
});

test('parseArchiveSyncResult: returns null (not throws) on a malformed JSON tail', () => {
  assert.equal(parseArchiveSyncResult('ARCHIVE_SYNC_RESULT {not valid json'), null);
});

test('parseArchiveSyncResult: returns null on empty/undefined input', () => {
  assert.equal(parseArchiveSyncResult(''), null);
  assert.equal(parseArchiveSyncResult(undefined), null);
});

// ---------------------------------------------------------------------------
// runCi — deploy step: the archive-sync/file-count/wrangler/commit/archive-sync sequence
// (05-08 Task 1 tracer)
// ---------------------------------------------------------------------------

function fakeArchiveSyncTail(phase, overrides = {}) {
  const base = {
    phase,
    uploaded: 0,
    failed: 0,
    deferred: 0,
    movedBack: 0,
    deleted: 0,
    backlog: phase === 'post' ? { count: 0, since: null } : null,
    alerts: [],
    dailyReport: phase === 'post' ? { due: false } : null,
    disabled: false,
    ...overrides,
  };
  return `[archive-sync] ${phase}: ok\nARCHIVE_SYNC_RESULT ${JSON.stringify(base)}`;
}

test('runCi step=deploy: writes the build-start marker is NOT part of the deploy step (build-only), and spawns archive-sync pre, assert-file-count, assert-archive-synced, wrangler deploy, commitImpl, then archive-sync post, in that order (CR-02, 05-20)', async () => {
  const calls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (args.some((a) => String(a).includes('assert-archive-synced.mjs'))) {
      return { code: 0, tail: '[assert-archive-synced] ok: no plan and no archive files' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return { code: 0, tail: '' };
    if (args.includes('post')) return { code: 0, tail: fakeArchiveSyncTail('post') };
    return { code: 0, tail: '' };
  };
  const commitCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: {},
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(
    calls.length,
    5,
    'expected exactly 5 spawn calls: archive-sync pre, assert-file-count, assert-archive-synced, wrangler deploy, archive-sync post'
  );
  assert.ok(calls[0].args.some((a) => String(a).includes('archive-sync.mjs')) && calls[0].args.includes('pre'));
  assert.ok(calls[1].args.some((a) => String(a).includes('assert-file-count.mjs')));
  assert.ok(calls[2].args.some((a) => String(a).includes('assert-archive-synced.mjs')));
  assert.ok(calls[3].cmd === 'pnpm' && calls[3].args.includes('wrangler'));
  assert.ok(calls[4].args.some((a) => String(a).includes('archive-sync.mjs')) && calls[4].args.includes('post'));
  assert.equal(commitCalls.length, 1, 'commitImpl must be called exactly once, after a real deploy');
});

test('runCi step=deploy (CR-02, 05-20): assert-archive-synced exiting 1 aborts before wrangler/commitImpl/post, notifies exactly once with a title naming assert-archive-synced', async () => {
  const calls = [];
  const notifyCalls = [];
  const commitCalls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (args.some((a) => String(a).includes('assert-archive-synced.mjs'))) {
      return {
        code: 1,
        tail: 'assert-archive-synced: dist/ was partitioned but archive-sync pre has not run for this build',
      };
    }
    return { code: 0, tail: '' };
  };
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(calls.length, 3, 'only pre, assert-file-count, and assert-archive-synced should have spawned');
  assert.ok(
    !calls.some((c) => (c.args ?? []).some((a) => String(a).includes('wrangler')) || String(c.cmd).includes('wrangler')),
    'no wrangler process should ever be spawned after a failing assert-archive-synced'
  );
  assert.ok(
    !calls.some((c) => (c.args ?? []).some((a) => String(a).includes('archive-sync.mjs')) && c.args.includes('post')),
    'archive-sync post must never spawn after a failing assert-archive-synced'
  );
  assert.equal(commitCalls.length, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].title, /assert-archive-synced/);
});

test('runCi step=deploy: CI_BUILD_DEPLOY_DRY_RUN=1 runs wrangler deploy --dry-run with --outdir and never calls commitImpl', async () => {
  let wranglerArgs;
  const spawnImpl = async (cmd, args) => {
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) {
      wranglerArgs = [...args];
      return { code: 0, tail: '' };
    }
    if (args.includes('post')) return { code: 0, tail: fakeArchiveSyncTail('post') };
    return { code: 0, tail: '' };
  };
  const commitCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: { CI_BUILD_DEPLOY_DRY_RUN: '1' },
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.ok(wranglerArgs, 'wrangler deploy should still be spawned in a dry run');
  assert.ok(wranglerArgs.includes('--dry-run'));
  assert.ok(wranglerArgs.includes('--config'));
  assert.ok(wranglerArgs.includes('wrangler.jsonc'));
  assert.ok(wranglerArgs.includes('--outdir'));
  assert.ok(wranglerArgs.includes('.wrangler/ci-dry-run'));
  assert.equal(commitCalls.length, 0, 'commitImpl must never be called in a dry run — no real deploy happened');
});

test('runCi step=deploy: archive-sync pre exiting 1 aborts before wrangler/commitImpl, notifies exactly once with a title naming archive-sync', async () => {
  const calls = [];
  const notifyCalls = [];
  const commitCalls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 1, tail: 'archive-sync: archive index unreadable — boom' };
    return { code: 0, tail: '' };
  };
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(calls.length, 1, 'only the archive-sync pre spawn should have happened');
  assert.ok(
    !calls.some((c) => (c.args ?? []).some((a) => String(a).includes('wrangler')) || String(c.cmd).includes('wrangler')),
    'no wrangler process should ever be spawned after a failing archive-sync pre'
  );
  assert.equal(commitCalls.length, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].title, /archive-sync/);
});

// ---------------------------------------------------------------------------
// runCi — build step: writes the build-start marker before spawning the build
// (05-08 Task 1)
// ---------------------------------------------------------------------------

test('runCi step=build: calls markBuildStart before spawning the build', async () => {
  const events = [];
  const spawnImpl = async () => {
    events.push('spawn');
    return { code: 0, tail: '' };
  };
  const markBuildStart = () => {
    events.push('mark');
  };
  const code = await runCi({
    step: 'build',
    env: {},
    spawnImpl,
    markBuildStart,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(code, 0);
  assert.deepEqual(events, ['mark', 'spawn']);
});

test('runCi step=all: also calls markBuildStart before spawning the build', async () => {
  const events = [];
  const spawnImpl = async () => {
    events.push('spawn');
    return { code: 0, tail: '' };
  };
  const markBuildStart = () => {
    events.push('mark');
  };
  await runCi({
    step: 'all',
    env: {},
    spawnImpl,
    markBuildStart,
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(events[0], 'mark');
  assert.equal(events[1], 'spawn');
});

// ---------------------------------------------------------------------------
// runCi — deploy step: hot-window production guard, archive alerts, the
// 70,000 file-count alarm, and the daily report (05-08 Task 2)
// ---------------------------------------------------------------------------

/** `markResult` (Task 2, REND-11 follow-up quick 261002-s2r): the result returned for a
 * `mark-daily-report` spawn, default `{ code: 0, tail: '' }`. `events`, if given, records
 * `{ kind: 'mark-daily-report', args }` in call order — pair with a `notifyImpl` that also
 * pushes into the same array to assert ordering (B1). */
function fakeDeploySpawnImpl({ preOverrides, countTail, wranglerResult, postOverrides, postResult, markResult, events } = {}) {
  return async (cmd, args) => {
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre', preOverrides ?? {}) };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: countTail ?? '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return wranglerResult ?? { code: 0, tail: '' };
    if (args.includes('post')) {
      if (postResult) return postResult;
      return { code: 0, tail: fakeArchiveSyncTail('post', postOverrides ?? {}) };
    }
    if (args.includes('mark-daily-report')) {
      events?.push({ kind: 'mark-daily-report', args: [...args] });
      return markResult ?? { code: 0, tail: '' };
    }
    return { code: 0, tail: '' };
  };
}

test('runCi step=deploy (production, local run): a fallback-provisional hot window with no ALLOW_FALLBACK_HOT_WINDOW blocks before any spawn, notifies once with a check starting "hot-window:"', async () => {
  const spawnCalls = [];
  const notifyCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: async (cmd, args) => {
      spawnCalls.push({ cmd, args });
      return { code: 0, tail: '' };
    },
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {
      throw new Error('commitImpl must never be called when the hot-window guard blocks');
    },
    loadHotWindowImpl: async () => ({
      status: 'fallback-provisional',
      provisional: true,
      days: 30,
      basis: 'test',
      decision: 'test',
    }),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(spawnCalls.length, 0, 'nothing should be spawned once the hot-window guard blocks');
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].title, /hot-window:/);
});

test('runCi step=deploy: ALLOW_FALLBACK_HOT_WINDOW=1 lets a fallback-provisional hot window proceed, and the daily report body says PROVISIONAL', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: {
      dailyReport: {
        due: true,
        body: {
          staticFileCount: 29937,
          ceiling: 100000,
          failAt: 80000,
          archivedCount: 30478,
          hotWindowStatus: 'fallback-provisional',
          hotWindowDays: 30,
          backlog: 0,
        },
      },
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic', ALLOW_FALLBACK_HOT_WINDOW: '1' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: async () => ({
      status: 'fallback-provisional',
      provisional: true,
      days: 30,
      basis: 'test',
      decision: 'test',
    }),
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  const report = notifyCalls.find((c) => /daily report/i.test(c.title));
  assert.ok(report, 'expected a daily report notification');
  assert.match(report.body, /PROVISIONAL/);
  assert.equal(report.priority, 'low');
});

test('runCi step=deploy: a non-production CI build (WORKERS_CI=1, branch != main) skips the hot-window guard entirely', async () => {
  const spawnImpl = fakeDeploySpawnImpl({});
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feature/phase-05' },
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async () => {},
    loadHotWindowImpl: async () => {
      throw new Error('loadHotWindowImpl must not be called for a non-production build');
    },
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(code, 0);
});

test('runCi step=deploy: a pre result with failed pages sends exactly one ntfy naming the count and that previous copies are still serving, after a successful deploy', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    preOverrides: {
      failed: 3,
      alerts: ['archive-sync: 3 page(s) failed to upload — previous state (static) still serving'],
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1, 'exactly one notification for this run');
  assert.match(notifyCalls[0].body, /3 page\(s\) failed/);
  assert.match(notifyCalls[0].body, /still serving/);
});

test('runCi step=deploy: a post result with failed pages sends exactly one ntfy naming the count and that previous copies are still serving', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: {
      failed: 2,
      alerts: ['archive-sync: 2 page(s) failed to re-upload — previous copies still serving'],
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].body, /2 page\(s\) failed/);
  assert.match(notifyCalls[0].body, /still serving/);
});

test('runCi step=deploy: a post backlog alert older than 20h sends one ntfy (D-10)', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: {
      alerts: ['archive-sync: archive re-render backlog older than 20h (D-10)'],
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].body, /backlog older than 20h/);
});

test('runCi step=deploy: a pre result with disabled:true lets the deploy proceed and sends one ntfy saying the archive tier is disabled', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    preOverrides: {
      disabled: true,
      alerts: ['archive-sync: archive tier disabled for this build — R2 credentials are not set in the environment'],
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].body, /disabled/i);
});

test('runCi step=deploy: assert-file-count status "warn" sends one high-priority ntfy naming the count against 100,000, and the deploy proceeds', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    countTail: '{"count":72000,"ceiling":100000,"failAt":80000,"status":"warn"}',
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  const alarm = notifyCalls.find((c) => /72000/.test(c.body));
  assert.ok(alarm, 'expected an alarm naming the count');
  assert.match(alarm.body, /100000|100,000/);
  assert.equal(alarm.priority, 'high');
});

test('runCi step=deploy: assert-file-count exiting non-zero aborts the deploy with a failure notification (D-13)', async () => {
  const notifyCalls = [];
  const calls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 1, tail: '[assert-file-count] FAIL: count 85000 >= fail threshold 80000' };
    }
    return { code: 0, tail: '' };
  };
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {
      throw new Error('commitImpl must never be called');
    },
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].title, /assert-file-count/);
  assert.ok(!calls.some((c) => String(c.cmd).includes('wrangler') || (c.args ?? []).some((a) => String(a).includes('wrangler'))));
});

test('runCi step=deploy: dailyReport.due false sends no daily report notification', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({ postOverrides: { dailyReport: { due: false } } });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.ok(!notifyCalls.some((c) => /daily report/i.test(c.title)));
});

test('runCi step=deploy: a post spawn that exits non-zero sends one alert ntfy but the deploy step still returns 0', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({ postResult: { code: 1, tail: 'archive-sync: boom' } });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0, 'the deploy already succeeded before post ran — post can never fail it');
  assert.equal(notifyCalls.length, 1);
});

test('runCi step=deploy: a post spawn that omits the ARCHIVE_SYNC_RESULT line sends one alert ntfy but the deploy step still returns 0', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({ postResult: { code: 0, tail: '[archive-sync] post: ok, but no result line' } });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1);
});

// ---------------------------------------------------------------------------
// CR-01 (05-13): a deploy that deployed nothing never reaches post-sync
// ---------------------------------------------------------------------------

test('CR-01 (05-13): CI_BUILD_DEPLOY_DRY_RUN=1 never spawns archive-sync post, never calls commitImpl, returns 0, and logs the skip line', async () => {
  const calls = [];
  const logLines = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return { code: 0, tail: '' };
    if (args.includes('post')) return { code: 0, tail: fakeArchiveSyncTail('post') };
    return { code: 0, tail: '' };
  };
  const commitCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: { CI_BUILD_DEPLOY_DRY_RUN: '1' },
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logLines.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(
    !calls.some((c) => c.args.some((a) => String(a).includes('archive-sync.mjs')) && c.args.includes('post')),
    'a dry run must never spawn archive-sync post'
  );
  assert.equal(commitCalls.length, 0, 'commitImpl must never be called in a dry run');
  assert.ok(
    logLines.some((line) => line.includes('dry run: skipping archive-sync post')),
    'expected the dry-run skip line to be logged'
  );
});

test('CR-01 (05-13): a dry run still delivers every pre-sync alert it gathered', async () => {
  const notifyCalls = [];
  const spawnImpl = fakeDeploySpawnImpl({
    preOverrides: {
      alerts: ['archive-sync: 2 page(s) failed to upload — previous state (static) still serving'],
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { CI_BUILD_DEPLOY_DRY_RUN: '1', NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {
      throw new Error('commitImpl must never be called in a dry run');
    },
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.equal(notifyCalls.length, 1, 'the dry-run alert must still be delivered exactly once');
  assert.match(notifyCalls[0].body, /2 page\(s\) failed/);
  assert.match(notifyCalls[0].body, /still serving/);
});

test('CR-01 (05-13): a failed wrangler deploy (non-dry-run) never spawns post, never calls commitImpl, returns non-zero, notifies once naming wrangler deploy', async () => {
  const calls = [];
  const notifyCalls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return { code: 1, tail: 'Error: authentication failed' };
    if (args.includes('post')) return { code: 0, tail: fakeArchiveSyncTail('post') };
    return { code: 0, tail: '' };
  };
  const commitCalls = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async (a) => commitCalls.push(a),
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.notEqual(code, 0);
  assert.ok(
    !calls.some((c) => c.args.some((a) => String(a).includes('archive-sync.mjs')) && c.args.includes('post')),
    'a failed wrangler deploy must never spawn archive-sync post'
  );
  assert.equal(commitCalls.length, 0);
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].title, /wrangler deploy/);
});

// ---------------------------------------------------------------------------
// REND-11 follow-up (quick 261002-s2r): ntfy delivery outcome is logged
//
// These tests drive the path runCi -> sendNotification -> the REAL defaultNotify -> an injected
// fake fetchImpl -> log. None of them passes `notifyImpl`, so the production notifier runs.
// ---------------------------------------------------------------------------

const REND11_LOGS = [];

test('REND-11 follow-up: a 2xx ntfy response logs exactly one HTTP <status> line, no (not delivered)', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return { status: 200 };
  };
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'sekrit-topic-123' },
    spawnImpl: async () => ({ code: 2, tail: '' }),
    fetchImpl,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });
  REND11_LOGS.push(...logs);

  assert.equal(code, 2);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://ntfy.sh/sekrit-topic-123');
  assert.equal(
    logs.filter((l) => l.startsWith('[ci-build] ntfy ')).length,
    1,
    `expected exactly one ntfy outcome line, got: ${JSON.stringify(logs)}`
  );
  assert.ok(
    logs.includes('[ci-build] ntfy "915 TLDR build failed: astro build exited 2": HTTP 200'),
    `expected the HTTP 200 outcome line, got: ${JSON.stringify(logs)}`
  );
});

test('REND-11 follow-up: a non-2xx ntfy response resolves (not reject) and logs HTTP <status> (not delivered)', async () => {
  const fetchImpl = async () => ({ status: 429 });
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'sekrit-topic-123' },
    spawnImpl: async () => ({ code: 2, tail: '' }),
    fetchImpl,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });
  REND11_LOGS.push(...logs);

  assert.equal(code, 2);
  assert.ok(
    logs.includes('[ci-build] ntfy "915 TLDR build failed: astro build exited 2": HTTP 429 (not delivered)'),
    `expected the HTTP 429 (not delivered) line, got: ${JSON.stringify(logs)}`
  );
});

test('REND-11 follow-up: a rejected fetch resolves (not reject), logs a (not delivered) line, and never names the topic', async () => {
  const fetchImpl = async () => {
    throw new Error('Failed to parse URL from https://ntfy.sh/sekrit-topic-123');
  };
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'sekrit-topic-123' },
    spawnImpl: async () => ({ code: 2, tail: '' }),
    fetchImpl,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });
  REND11_LOGS.push(...logs);

  assert.equal(code, 2);
  assert.ok(
    logs.some((l) => l.endsWith('(not delivered)')),
    `expected a (not delivered) line, got: ${JSON.stringify(logs)}`
  );
  assert.ok(
    !logs.some((l) => l.includes('sekrit-topic-123')),
    `no log line may contain the topic, got: ${JSON.stringify(logs)}`
  );
});

test('REND-11 follow-up: no log line ever contains the topic, token or body text; NTFY_TOKEN is sent as a Bearer header', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return { status: 200 };
  };
  const logs = [];
  const code = await runCi({
    step: 'build',
    env: { NTFY_TOPIC: 'sekrit-topic-123', NTFY_TOKEN: 'tok-abc-123' },
    spawnImpl: async () => ({ code: 2, tail: '' }),
    fetchImpl,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });
  REND11_LOGS.push(...logs);

  assert.equal(code, 2);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].opts.headers.Authorization, 'Bearer tok-abc-123');

  // Across every REND-11 follow-up test run so far (tests 1-3 above plus this one): no log line
  // may contain the topic, the token value, or the notification body text (commit:/branch:).
  for (const line of REND11_LOGS) {
    assert.ok(!line.includes('sekrit-topic-123'), `log line leaked the topic: ${line}`);
    assert.ok(!line.includes('tok-abc-123'), `log line leaked the token: ${line}`);
    assert.ok(!line.includes('commit:'), `log line leaked body text: ${line}`);
    assert.ok(!line.includes('branch:'), `log line leaked body text: ${line}`);
  }
});

test('REND-11 follow-up: deploy path — a non-2xx daily-report send logs HTTP <status> (not delivered)', async () => {
  const fetchImpl = async () => ({ status: 503 });
  const logs = [];
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: {
      dailyReport: {
        due: true,
        body: {
          staticFileCount: 29937,
          ceiling: 100000,
          failAt: 80000,
          archivedCount: 30478,
          hotWindowStatus: 'derived',
          hotWindowDays: 202,
          backlog: 0,
        },
      },
    },
  });
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 't' },
    spawnImpl,
    fetchImpl,
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(
    logs.includes('[ci-build] ntfy "915 TLDR archive daily report": HTTP 503 (not delivered)'),
    `expected the daily-report (not delivered) line, got: ${JSON.stringify(logs)}`
  );
});

// ---------------------------------------------------------------------------
// Task 2 (REND-11 follow-up, quick 261002-s2r): daily-report marker written only after a
// confirmed send (archive-sync `mark-daily-report` handoff)
// ---------------------------------------------------------------------------

test('B1: a confirmed daily-report send spawns mark-daily-report exactly once, AFTER the notify call, and logs the marker-set line', async () => {
  const events = [];
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: { dailyReport: { due: true, date: '2026-10-02', body: {} } },
    events,
  });
  const logs = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async (a) => {
      events.push({ kind: 'notify', title: a.title });
    },
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  const markEvents = events.filter((e) => e.kind === 'mark-daily-report');
  assert.equal(markEvents.length, 1, 'expected exactly one mark-daily-report spawn');
  assert.deepEqual(markEvents[0].args, ['tools/archive-sync.mjs', 'mark-daily-report', '--date', '2026-10-02']);
  const notifyIdx = events.findIndex((e) => e.kind === 'notify');
  const markIdx = events.findIndex((e) => e.kind === 'mark-daily-report');
  assert.ok(notifyIdx >= 0 && markIdx > notifyIdx, 'mark-daily-report must be spawned AFTER the daily-report notify call');
  assert.ok(logs.includes('[ci-build] daily-report marker set to 2026-10-02'));
});

test('B2: a thrown daily-report notify never spawns mark-daily-report; logs "marker left unchanged"', async () => {
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: { dailyReport: { due: true, date: '2026-10-02', body: {} } },
  });
  const spawnCalls = [];
  const wrappedSpawn = async (cmd, args) => {
    spawnCalls.push({ cmd, args: [...args] });
    return spawnImpl(cmd, args);
  };
  const logs = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: wrappedSpawn,
    notifyImpl: async (a) => {
      if (/daily report/i.test(a.title)) throw new Error('simulated ntfy rejection');
    },
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(
    !spawnCalls.some((c) => c.args.includes('mark-daily-report')),
    'no mark-daily-report spawn may happen when the send was not confirmed delivered'
  );
  assert.ok(logs.some((l) => l.includes('marker left unchanged')));
});

test('B3 (the REND-11 regression, end to end): no notifyImpl, a non-2xx fetchImpl never spawns mark-daily-report', async () => {
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: { dailyReport: { due: true, date: '2026-10-02', body: {} } },
  });
  const spawnCalls = [];
  const wrappedSpawn = async (cmd, args) => {
    spawnCalls.push({ cmd, args: [...args] });
    return spawnImpl(cmd, args);
  };
  const fetchImpl = async () => ({ status: 429 });
  const logs = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: wrappedSpawn,
    fetchImpl,
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(!spawnCalls.some((c) => c.args.includes('mark-daily-report')));
});

test('B4: a mark-daily-report spawn that exits non-zero logs "daily-report marker not written" and the classified reason, runCi still returns 0', async () => {
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: { dailyReport: { due: true, date: '2026-10-02', body: {} } },
    markResult: {
      code: 1,
      tail: 'archive-sync: refusing daily-report marker write — R2 credentials are not set in the environment',
    },
  });
  const logs = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(
    logs.some((l) => l.includes('daily-report marker not written') && l.includes('R2 credentials are not set')),
    `expected a marker-not-written line naming the reason, got: ${JSON.stringify(logs)}`
  );
});

test('B5: dailyReport.due with no date still sends the report, never spawns mark-daily-report, and names the missing date', async () => {
  const spawnImpl = fakeDeploySpawnImpl({
    postOverrides: { dailyReport: { due: true, body: {} } }, // no `date` field
  });
  const spawnCalls = [];
  const wrappedSpawn = async (cmd, args) => {
    spawnCalls.push({ cmd, args: [...args] });
    return spawnImpl(cmd, args);
  };
  const notifyCalls = [];
  const logs = [];
  const code = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: wrappedSpawn,
    notifyImpl: async (a) => notifyCalls.push(a),
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: (...args) => logs.push(args.join(' ')),
  });

  assert.equal(code, 0);
  assert.ok(notifyCalls.some((c) => /daily report/i.test(c.title)), 'the report must still be sent');
  assert.ok(!spawnCalls.some((c) => c.args.includes('mark-daily-report')));
  assert.ok(
    logs.some((l) => l.includes('daily report has no valid date')),
    `expected a line naming the missing date, got: ${JSON.stringify(logs)}`
  );
});

test('B6: CI_BUILD_DEPLOY_DRY_RUN=1 never spawns post or mark-daily-report, even with a due:true-shaped fake post (extends CR-01, 05-13)', async () => {
  const calls = [];
  const spawnImpl = async (cmd, args) => {
    calls.push({ cmd, args: [...args] });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return { code: 0, tail: '' };
    if (args.includes('post')) {
      return { code: 0, tail: fakeArchiveSyncTail('post', { dailyReport: { due: true, date: '2026-10-02', body: {} } }) };
    }
    return { code: 0, tail: '' };
  };
  const code = await runCi({
    step: 'deploy',
    env: { CI_BUILD_DEPLOY_DRY_RUN: '1' },
    spawnImpl,
    notifyImpl: async () => {},
    commitImpl: async () => {
      throw new Error('commitImpl must never be called in a dry run');
    },
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });

  assert.equal(code, 0);
  assert.ok(!calls.some((c) => c.args.includes('post')), 'a dry run must never spawn archive-sync post');
  assert.ok(!calls.some((c) => c.args.includes('mark-daily-report')), 'a dry run must never spawn mark-daily-report');
});

// ---------------------------------------------------------------------------
// Task 3 (quick 261002-s2r): build step's per-page listing reduced to counts so the deploy
// step's own output survives in the Workers Builds log
// ---------------------------------------------------------------------------

test('C1: isPerPageBuildLine is true for every real per-page build-line shape', () => {
  const trueCases = [
    '00:07:06   ├─ /404.html (+138ms)',
    '00:08:20   ├─ /tag/uscis.html (restored)',
    '00:07:13   ├─ /about.html (cached)',
    '  ├─ /a.html (+1.23s)',
    '  ├─ /a.html (+1m 5s)',
    '\x1b[90m00:07:06   ├─ /404.html (+138ms)\x1b[39m', // ANSI SGR wrapped
    '00:07:06   ├─ /404.html (+138ms)\r', // trailing \r
  ];
  for (const line of trueCases) {
    assert.equal(isPerPageBuildLine(line), true, `expected true for: ${JSON.stringify(line)}`);
  }
});

test('C2: isPerPageBuildLine is false for lines that must survive the filter', () => {
  const falseCases = [
    '00:06:51 [WARN] [vite]',
    '00:06:56 [build] Rearranging server assets...',
    'tag pages: 19965 tags',
    '[archive] hot window: derived ...',
    '00:07:06   ├─ /x.html (+3ms) (file not created, response body was empty)',
    '00:07:06   ├─ /x.html[archive] note', // page line with console output glued on
    '✔ Case 1 (ARCH-02): ...',
    '',
  ];
  for (const line of falseCases) {
    assert.equal(isPerPageBuildLine(line), false, `expected false for: ${JSON.stringify(line)}`);
  }
});

test('C3: createPageLineFilter suppresses page lines with periodic progress + a final summary; non-page lines pass through verbatim, across split chunks', () => {
  const written = [];
  const filter = createPageLineFilter({ write: (s) => written.push(s), progressEvery: 2 });

  // Split one page line and one normal line across chunk boundaries.
  filter.push('00:07:06   ├─ /a.html (+1');
  filter.push('0ms)\n00:06:51 [WARN] [vite] something\n');
  filter.push('00:07:07   ├─ /b.html (restored)\n');
  filter.push('00:07:08   ├─ /c.html (cached)\n');

  const n = filter.end();
  const output = written.join('');

  assert.equal(n, 3);
  assert.ok(output.includes('00:06:51 [WARN] [vite] something\n'), 'non-page line must survive verbatim with its newline');
  assert.ok(!output.includes('├─'), 'no raw page line may appear in the output');
  const progressLines = written.filter((l) => l.includes('pages rendered so far'));
  assert.equal(progressLines.length, 1, 'expected one progress line per 2 suppressed lines (3 lines -> 1 progress line)');
  assert.ok(
    progressLines[0] ===
      '[ci-build] astro build: 2 pages rendered so far (per-page listing suppressed; CI_BUILD_FULL_LOG=1 shows it)\n'
  );
  assert.ok(output.trimEnd().endsWith(`[ci-build] astro build: suppressed ${n} per-page output lines (CI_BUILD_FULL_LOG=1 shows them)`));
});

test('C3b: a trailing partial line with no newline is written by end() unless it is a page line', () => {
  const written1 = [];
  const f1 = createPageLineFilter({ write: (s) => written1.push(s), progressEvery: 5000 });
  f1.push('00:06:51 [WARN] [vite] trailing no newline');
  const n1 = f1.end();
  assert.ok(written1.includes('00:06:51 [WARN] [vite] trailing no newline'), 'the trailing non-page partial line must be written');
  assert.equal(n1, 0);

  const written2 = [];
  const f2 = createPageLineFilter({ write: (s) => written2.push(s), progressEvery: 5000 });
  f2.push('00:07:06   ├─ /trailing.html (+5ms)');
  const n2 = f2.end();
  assert.ok(!written2.some((l) => l.includes('/trailing.html')), 'a trailing partial PAGE line must never be written');
  assert.equal(n2, 1);
});

test('C4: runCi spawns the build with filterPageLines true by default, false with CI_BUILD_FULL_LOG=1; no deploy-step spawn ever carries it', async () => {
  const calls1 = [];
  const spawnImpl1 = async (cmd, args, opts) => {
    calls1.push({ cmd, args: [...args], opts });
    return { code: 0, tail: '' };
  };
  const code1 = await runCi({ step: 'build', env: {}, spawnImpl: spawnImpl1, setTimer: noopTimer, clearTimer: noopClear, log: noopLog });
  assert.equal(code1, 0);
  const buildCall1 = calls1.find((c) => c.cmd === 'pnpm' && c.args.includes('run') && c.args.includes('build'));
  assert.equal(buildCall1.opts.filterPageLines, true);

  const calls2 = [];
  const spawnImpl2 = async (cmd, args, opts) => {
    calls2.push({ cmd, args: [...args], opts });
    return { code: 0, tail: '' };
  };
  const code2 = await runCi({
    step: 'build',
    env: { CI_BUILD_FULL_LOG: '1' },
    spawnImpl: spawnImpl2,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(code2, 0);
  const buildCall2 = calls2.find((c) => c.cmd === 'pnpm' && c.args.includes('run') && c.args.includes('build'));
  assert.equal(buildCall2.opts.filterPageLines, false);

  const calls3 = [];
  const deploySpawnImpl = async (cmd, args, opts) => {
    calls3.push({ cmd, args: [...args], opts });
    if (args.includes('pre')) return { code: 0, tail: fakeArchiveSyncTail('pre') };
    if (args.some((a) => String(a).includes('assert-file-count.mjs'))) {
      return { code: 0, tail: '{"count":100,"ceiling":100000,"failAt":80000,"status":"ok"}' };
    }
    if (args.some((a) => String(a).includes('assert-archive-synced.mjs'))) {
      return { code: 0, tail: '[assert-archive-synced] ok' };
    }
    if (cmd === 'pnpm' && args.includes('wrangler')) return { code: 0, tail: '' };
    if (args.includes('post')) {
      return { code: 0, tail: fakeArchiveSyncTail('post', { dailyReport: { due: true, date: '2026-10-02', body: {} } }) };
    }
    if (args.includes('mark-daily-report')) return { code: 0, tail: '' };
    return { code: 0, tail: '' };
  };
  const code3 = await runCi({
    step: 'deploy',
    env: { NTFY_TOPIC: 'test-topic' },
    spawnImpl: deploySpawnImpl,
    notifyImpl: async () => {},
    commitImpl: async () => {},
    loadHotWindowImpl: fakeLoadHotWindow,
    setTimer: noopTimer,
    clearTimer: noopClear,
    log: noopLog,
  });
  assert.equal(code3, 0);
  assert.ok(
    calls3.every((c) => c.opts?.filterPageLines === undefined),
    'no deploy-step spawn may ever carry filterPageLines'
  );
});

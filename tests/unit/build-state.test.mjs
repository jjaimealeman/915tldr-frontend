#!/usr/bin/env node
// 04-03 Task 1 (RED, then made GREEN by src/lib/server/build-state.ts): pins the shrink-evaluation
// rules (D-14), last-good KV read/validate, and the pending-build-state merge/commit discipline.
// Every network call is a stubbed `fetchImpl`, following tests/unit/manifest-schema.test.mjs's
// hermetic-env convention — this suite never touches real KV.

import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LAST_GOOD_KEY,
  readLastGood,
  writePendingBuildState,
  readPendingBuildState,
  commitLastGood,
  evaluateShrink,
  resetPendingBuildState,
} from '../../src/lib/server/build-state.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const ENV_KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'RENDER_MANIFEST_KV_NAMESPACE_ID'];
const savedEnv = {};

before(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
  process.env.CLOUDFLARE_API_TOKEN = 'test-token';
  process.env.RENDER_MANIFEST_KV_NAMESPACE_ID = 'test-namespace-id';
});

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// evaluateShrink
// ---------------------------------------------------------------------------

test('evaluateShrink: growth (previous {a,b,c}, current {a,b,c,d}) is ok', () => {
  const result = evaluateShrink({
    label: 'test',
    previous: { count: 3, ids: ['a', 'b', 'c'] },
    currentIds: ['a', 'b', 'c', 'd'],
  });
  assert.equal(result.ok, true);
});

test('evaluateShrink: an explained removal (c) is ok and the note names c', () => {
  const result = evaluateShrink({
    label: 'test',
    previous: { count: 3, ids: ['a', 'b', 'c'] },
    currentIds: ['a', 'b'],
    explained: ['c'],
  });
  assert.equal(result.ok, true);
  assert.match(result.note, /\bc\b/);
});

test('evaluateShrink: an unexplained removal with allowance 0 throws, naming c and the count delta', () => {
  assert.throws(
    () =>
      evaluateShrink({
        label: 'test',
        previous: { count: 3, ids: ['a', 'b', 'c'] },
        currentIds: ['a', 'b'],
        explained: [],
        allowance: 0,
      }),
    (err) => {
      assert.match(err.message, /^test: never-shrink check failed/);
      assert.match(err.message, /\bc\b/);
      assert.match(err.message, /\b1\b/); // the count delta
      return true;
    }
  );
});

test('evaluateShrink: same removal with allowance 1 is ok, and the note says the allowance was used', () => {
  const result = evaluateShrink({
    label: 'test',
    previous: { count: 3, ids: ['a', 'b', 'c'] },
    currentIds: ['a', 'b'],
    explained: [],
    allowance: 1,
  });
  assert.equal(result.ok, true);
  assert.match(result.note.toLowerCase(), /allowance/);
});

test('evaluateShrink: an empty current set always throws, regardless of allowance or bootstrap', () => {
  assert.throws(() =>
    evaluateShrink({
      label: 'test',
      previous: { count: 3, ids: ['a', 'b', 'c'] },
      currentIds: [],
      allowance: 1000,
      bootstrap: true,
      requireBaseline: false,
    })
  );
});

test('evaluateShrink: previous null, requireBaseline true, bootstrap false throws naming BUILD_STATE_BOOTSTRAP and the KV key', () => {
  assert.throws(
    () =>
      evaluateShrink({
        label: 'test',
        previous: null,
        currentIds: ['a'],
        requireBaseline: true,
        bootstrap: false,
      }),
    (err) => {
      assert.match(err.message, /BUILD_STATE_BOOTSTRAP/);
      assert.match(err.message, new RegExp(LAST_GOOD_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    }
  );
});

test('evaluateShrink: previous null, requireBaseline true, bootstrap true is ok', () => {
  const result = evaluateShrink({
    label: 'test',
    previous: null,
    currentIds: ['a'],
    requireBaseline: true,
    bootstrap: true,
  });
  assert.equal(result.ok, true);
});

test('evaluateShrink: previous null, requireBaseline false is ok, and the note carries a "no baseline" warning', () => {
  const result = evaluateShrink({
    label: 'test',
    previous: null,
    currentIds: ['a'],
    requireBaseline: false,
  });
  assert.equal(result.ok, true);
  assert.match(result.note.toLowerCase(), /no baseline/);
});

// ---------------------------------------------------------------------------
// readLastGood
// ---------------------------------------------------------------------------

function makeStubFetch(responses = []) {
  const calls = [];
  let i = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return next;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

function notFoundResponse() {
  return { ok: false, status: 404, json: async () => { throw new Error('no body'); }, text: async () => 'not found' };
}

function malformedJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('bad json'); },
    text: async () => 'not json',
  };
}

const VALID_LAST_GOOD = {
  schemaVersion: '1',
  buildHash: 'abc1234',
  recordedAt: '2026-09-26T00:00:00.000Z',
  articles: { count: 2, ids: ['a', 'b'] },
  changelog: { count: 12 },
};

test('readLastGood: KV 404 returns null', async () => {
  const fetchImpl = makeStubFetch([notFoundResponse()]);
  const result = await readLastGood({ fetchImpl });
  assert.equal(result, null);
});

test('readLastGood: valid JSON returns the parsed object', async () => {
  const fetchImpl = makeStubFetch([okResponse(VALID_LAST_GOOD)]);
  const result = await readLastGood({ fetchImpl });
  assert.deepEqual(result, VALID_LAST_GOOD);
});

test('readLastGood: malformed JSON throws', async () => {
  const fetchImpl = makeStubFetch([malformedJsonResponse()]);
  await assert.rejects(() => readLastGood({ fetchImpl }));
});

test('readLastGood: missing articles.ids throws', async () => {
  const bad = { ...VALID_LAST_GOOD, articles: { count: 2 } };
  const fetchImpl = makeStubFetch([okResponse(bad)]);
  await assert.rejects(() => readLastGood({ fetchImpl }), /articles\.ids/);
});

// ---------------------------------------------------------------------------
// writePendingBuildState / readPendingBuildState — real filesystem, isolated tmp cwd
// ---------------------------------------------------------------------------

let tmpDir;
let originalCwd;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'build-state-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tmpDir, { recursive: true, force: true });
});

test('writePendingBuildState merges sections across calls', async () => {
  await writePendingBuildState({ articles: { count: 2, ids: ['a', 'b'] } });
  await writePendingBuildState({ changelog: { count: 12 } });

  const pending = await readPendingBuildState();
  assert.deepEqual(pending.articles, { count: 2, ids: ['a', 'b'] });
  assert.deepEqual(pending.changelog, { count: 12 });

  const raw = JSON.parse(await readFile(path.join(tmpDir, '.astro', 'build-state.pending.json'), 'utf8'));
  assert.deepEqual(raw.articles, { count: 2, ids: ['a', 'b'] });
  assert.deepEqual(raw.changelog, { count: 12 });
});

// ---------------------------------------------------------------------------
// Serialized, atomic pending writes (quick 261002-tl2) — reproduces the 2026-10-02 race:
// `build-state: failed to read pending build state: Unexpected non-whitespace character after
// JSON at position 1867519`, found in the real `.astro/build-state.pending.json`
// (1,867,745 bytes) during `pnpm run test:regression`. T1, T2, T4 and T5 are deterministic RED
// against the current unlocked read-merge-write. T3, T6, T7 and T8 pin the contract and may
// already pass.
// ---------------------------------------------------------------------------

function makeId(i) {
  return `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

function makeIds(count, offset = 0) {
  return Array.from({ length: count }, (_, i) => makeId(i + offset));
}

function pendingFilePath() {
  return path.join(tmpDir, '.astro', 'build-state.pending.json');
}

async function readRawPendingFile() {
  return readFile(pendingFilePath(), 'utf8');
}

test('T1: concurrent writes of different sections, no file on disk yet — both sections survive (lost-update RED)', async () => {
  const articleIds = makeIds(50_000);
  await Promise.all([
    writePendingBuildState({ articles: { count: articleIds.length, ids: articleIds } }),
    writePendingBuildState({ changelog: { count: 12 } }),
  ]);

  const raw = JSON.parse(await readRawPendingFile()); // must parse — no torn/interleaved write
  assert.deepEqual(raw.articles, { count: articleIds.length, ids: articleIds });
  assert.deepEqual(raw.changelog, { count: 12 });
});

test('T2: the observed 2026-10-02 corruption signature — a shorter concurrent write over a longer seeded state (RED)', async () => {
  const seedIds = makeIds(50_010);
  await writePendingBuildState({ articles: { count: seedIds.length, ids: seedIds }, changelog: { count: 18 } });

  const newIds = makeIds(50_000);
  await Promise.all([
    writePendingBuildState({ articles: { count: newIds.length, ids: newIds } }),
    writePendingBuildState({ changelog: { count: 18 } }),
  ]);

  const rawText = await readRawPendingFile();
  const raw = JSON.parse(rawText); // must parse with no trailing bytes from the stale longer copy
  assert.deepEqual(raw.articles, { count: newIds.length, ids: newIds });
});

test('T3: FIFO order — two concurrent writes of the same section land in issue order', async () => {
  const p1 = writePendingBuildState({ changelog: { count: 1 } });
  const p2 = writePendingBuildState({ changelog: { count: 2 } });
  await Promise.all([p1, p2]);

  const pending = await readPendingBuildState();
  assert.deepEqual(pending.changelog, { count: 2 });
});

test('T4: read-your-writes — readPendingBuildState waits for an in-flight write issued before it (RED)', async () => {
  const writePromise = writePendingBuildState({ changelog: { count: 7 } });
  const pending = await readPendingBuildState();
  assert.deepEqual(pending.changelog, { count: 7 });
  await writePromise;
});

test('T5: every write is an atomic replace — the inode changes, no temp file survives (RED)', async () => {
  await writePendingBuildState({ changelog: { count: 1 } });
  const first = await stat(pendingFilePath());

  await writePendingBuildState({ changelog: { count: 2 } });
  const second = await stat(pendingFilePath());

  assert.notEqual(first.ino, second.ino);

  const entries = await readdir(path.join(tmpDir, '.astro'));
  assert.deepEqual(entries, ['build-state.pending.json']);
});

test('T6: no torn reads — a raw poll during a ~3MB in-flight write never sees invalid JSON', async () => {
  const seedIds = makeIds(1_000);
  await writePendingBuildState({ articles: { count: seedIds.length, ids: seedIds } });

  const bigIds = makeIds(70_000);
  const writePromise = writePendingBuildState({ articles: { count: bigIds.length, ids: bigIds } });

  let settled = false;
  writePromise.then(() => {
    settled = true;
  });

  let pollCount = 0;
  while (!settled) {
    await new Promise((resolve) => setImmediate(resolve));
    if (settled) break;
    pollCount += 1;
    const text = await readRawPendingFile();
    JSON.parse(text); // throws on a torn/partial read
  }

  await writePromise;
  assert.ok(pollCount > 0);
});

test('T7: the queue recovers after a rejection — a following write still resolves', async () => {
  await rm(path.join(tmpDir, '.astro'), { recursive: true, force: true });
  await writeFile(path.join(tmpDir, '.astro'), 'not a directory'); // .astro is a FILE, not a dir

  await assert.rejects(() => writePendingBuildState({ changelog: { count: 3 } }), /build-state:/);

  await rm(path.join(tmpDir, '.astro'), { force: true });

  await writePendingBuildState({ changelog: { count: 3 } });
  const pending = await readPendingBuildState();
  assert.deepEqual(pending.changelog, { count: 3 });
});

test('T8: a corrupt pending file is never treated as empty — write rejects, file left unchanged', async () => {
  await mkdir(path.join(tmpDir, '.astro'), { recursive: true });
  await writeFile(pendingFilePath(), '{"articles":{}}garbage', 'utf8');

  await assert.rejects(
    () => writePendingBuildState({ changelog: { count: 1 } }),
    /failed to read pending build state/
  );

  const raw = await readRawPendingFile();
  assert.equal(raw, '{"articles":{}}garbage');
});

// ---------------------------------------------------------------------------
// commitLastGood
// ---------------------------------------------------------------------------

test('commitLastGood refuses when a required section is missing, names the section, issues no PUT', async () => {
  await writePendingBuildState({ articles: { count: 2, ids: ['a', 'b'] } });
  const fetchImpl = makeStubFetch();

  await assert.rejects(
    () => commitLastGood({ buildHash: 'abc1234', requiredSections: ['articles', 'changelog'], fetchImpl }),
    /changelog/
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('commitLastGood writes to KV when every required section is present', async () => {
  await writePendingBuildState({ articles: { count: 2, ids: ['a', 'b'] } });
  const fetchImpl = makeStubFetch([okResponse({})]);

  await commitLastGood({ buildHash: 'abc1234', requiredSections: ['articles'], fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.equal(body.buildHash, 'abc1234');
  assert.deepEqual(body.articles, { count: 2, ids: ['a', 'b'] });
  assert.ok(!('expiration' in body) && !('expiration_ttl' in body));
});

// ---------------------------------------------------------------------------
// resetPendingBuildState (quick 261002-tl2 Task 2) — the build-start reset that clears a
// stale/corrupt pending file (and any stray write-temp file) left by an earlier run, so Workers
// Builds' `.astro/` cache (D-06) can never carry a corrupt or stale file into a new build.
// ---------------------------------------------------------------------------

test('T9: reset removes the pending file and stray temp files, leaves other .astro/ entries untouched', async () => {
  const astroDir = path.join(tmpDir, '.astro');
  await mkdir(astroDir, { recursive: true });

  const corrupt = '{"articles":{}}garbage';
  await writeFile(pendingFilePath(), corrupt, 'utf8');
  await writeFile(path.join(astroDir, 'build-state.pending.json.123-abc.tmp'), 'stray', 'utf8');

  const startedAtContent = '1700000000';
  const dataStoreContent = '{"some":"store"}';
  await writeFile(path.join(astroDir, 'ci-build-started-at'), startedAtContent, 'utf8');
  await writeFile(path.join(astroDir, 'data-store.json'), dataStoreContent, 'utf8');

  const result = await resetPendingBuildState();
  assert.deepEqual(result, { removed: true, bytes: Buffer.byteLength(corrupt, 'utf8'), strayTempFiles: 1 });

  const entries = await readdir(astroDir);
  assert.ok(!entries.includes('build-state.pending.json'));
  assert.ok(!entries.includes('build-state.pending.json.123-abc.tmp'));

  assert.equal(await readFile(path.join(astroDir, 'ci-build-started-at'), 'utf8'), startedAtContent);
  assert.equal(await readFile(path.join(astroDir, 'data-store.json'), 'utf8'), dataStoreContent);
});

test('T10: reset with no .astro/ directory at all resolves cleanly, does not throw', async () => {
  await rm(path.join(tmpDir, '.astro'), { recursive: true, force: true });
  const result = await resetPendingBuildState();
  assert.deepEqual(result, { removed: false, bytes: 0, strayTempFiles: 0 });
});

test('T11: a stale section cleared by reset can no longer satisfy a required-section check', async () => {
  await writePendingBuildState({ articles: { count: 2, ids: ['a', 'b'] }, changelog: { count: 12 } });
  await resetPendingBuildState();
  await writePendingBuildState({ articles: { count: 3, ids: ['a', 'b', 'c'] } });

  const fetchImpl = makeStubFetch();
  await assert.rejects(
    () => commitLastGood({ buildHash: 'abc1234', requiredSections: ['articles', 'changelog'], fetchImpl }),
    /changelog/
  );
  assert.equal(fetchImpl.calls.length, 0);
});

test('T12: the real tool removes a corrupt pending file, prints one line, leaves the sentinel intact; a second run says "no previous file"', async () => {
  const astroDir = path.join(tmpDir, '.astro');
  await mkdir(astroDir, { recursive: true });
  await writeFile(pendingFilePath(), '{"articles":{}}garbage', 'utf8');
  const startedAtContent = '1700000000';
  await writeFile(path.join(astroDir, 'ci-build-started-at'), startedAtContent, 'utf8');

  const toolPath = path.join(REPO_ROOT, 'tools', 'reset-pending-build-state.mjs');
  const stdout1 = execFileSync(process.execPath, [toolPath], { cwd: tmpDir, encoding: 'utf8' });
  const lines1 = stdout1.trim().split('\n');
  assert.equal(lines1.length, 1);
  assert.match(lines1[0], /^\[build-state\] reset pending build state: removed previous file \(\d+ bytes\)/);

  const entries = await readdir(astroDir);
  assert.ok(!entries.includes('build-state.pending.json'));
  assert.equal(await readFile(path.join(astroDir, 'ci-build-started-at'), 'utf8'), startedAtContent);

  const stdout2 = execFileSync(process.execPath, [toolPath], { cwd: tmpDir, encoding: 'utf8' });
  assert.match(stdout2, /no previous file/);
});

test('T13: package.json scripts.build runs the reset first, before astro build', async () => {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const buildScript = pkg.scripts.build;
  assert.ok(buildScript.startsWith('node tools/reset-pending-build-state.mjs && '));
  assert.ok(buildScript.indexOf('reset-pending-build-state') < buildScript.indexOf('astro build'));
});

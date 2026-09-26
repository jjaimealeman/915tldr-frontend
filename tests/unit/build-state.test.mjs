#!/usr/bin/env node
// 04-03 Task 1 (RED, then made GREEN by src/lib/server/build-state.ts): pins the shrink-evaluation
// rules (D-14), last-good KV read/validate, and the pending-build-state merge/commit discipline.
// Every network call is a stubbed `fetchImpl`, following tests/unit/manifest-schema.test.mjs's
// hermetic-env convention — this suite never touches real KV.

import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  LAST_GOOD_KEY,
  readLastGood,
  writePendingBuildState,
  readPendingBuildState,
  commitLastGood,
  evaluateShrink,
} from '../../src/lib/server/build-state.ts';

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

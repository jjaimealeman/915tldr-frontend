#!/usr/bin/env node
// REND-03: replays v1's /changelog empty-state failure. v1's changelog page fetched
// changelog.json client-side (a `useFetch` race — see 915tldr.com2/app/pages/changelog.vue) and
// rendered nothing useful when that fetch came back empty or failed. In this project's static,
// build-time-fetched architecture the equivalent failure input is "the v1 changelog.json source
// returns zero entries" — this is a REPLAY OF THE INPUT that caused the historical failure, not a
// reproduction of v1's client-side race itself (a static build has no client-side fetch to race).
//
// What "deploys nothing" means here: `pnpm run deploy` (`wrangler deploy`) only ever runs after
// `pnpm run build` exits 0 — the deploy step is never reached if the build fails. 04-09's own
// wrapper test proves that ordering directly; this test only needs to prove the build itself
// fails loud, which section 2 below does with a REAL `astro build`, not a mock.
//
// Section 1 exercises the loader directly (stubbed seams, no network) for the fail-loud cases
// that changelog-loader.test.mjs already covers in more detail — kept here too because this file
// is the plan's designated regression-test artifact for REND-03/FIX-05 and should stand on its
// own without requiring a reader to cross-reference the unit test file.
//
// Section 2 is the real-build replay: spawns a genuine `pnpm run build` with `V1_CHANGELOG_URL`
// pointed at a `data:` URL serving `{"entries":[]}` — Node's `fetch()` resolves `data:` URLs
// (confirmed, 04-08-PLAN.md <planner_findings>), so this exercises the loader's REAL default
// `fetchJson` (`fetch` itself), not a test-only branch in production code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { changelogLoader } from '../../src/content/loaders/changelog-loader.ts';

// ---------------------------------------------------------------------------
// Section 1: unit-level fail-loud replay (stubbed seams, no network).
// ---------------------------------------------------------------------------

function makeStore() {
  const map = new Map();
  return {
    keys: () => Array.from(map.keys()),
    values: () => Array.from(map.values()),
    entries: () => Array.from(map.entries()),
    set: ({ id, data, digest }) => {
      map.set(id, { id, data, digest });
      return true;
    },
    get: (key) => map.get(key),
    has: (key) => map.has(key),
    delete: (key) => map.delete(key),
    clear: () => map.clear(),
    addModuleImport: () => {},
  };
}

function jsonResponse(body, opts = {}) {
  return { ok: opts.ok ?? true, status: opts.status ?? 200, statusText: opts.statusText ?? 'OK', json: async () => body };
}

async function parseData({ data }) {
  return data;
}

function generateDigest(data) {
  return JSON.stringify(data).length.toString();
}

async function run(loader) {
  const store = makeStore();
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  await loader.load({ store, parseData, generateDigest, logger });
  return store;
}

const SIX_D1_ROWS = [
  { id: 1, date: 1700000000, title: 't1', items: JSON.stringify(['a']) },
  { id: 2, date: 1700000001, title: 't2', items: JSON.stringify(['a']) },
  { id: 3, date: 1700000002, title: 't3', items: JSON.stringify(['a']) },
  { id: 4, date: 1700000003, title: 't4', items: JSON.stringify(['a']) },
  { id: 5, date: 1700000004, title: 't5', items: JSON.stringify(['a']) },
  { id: 6, date: 1700000005, title: 't6', items: JSON.stringify(['a']) },
];

test('REND-03 replay: v1 changelog.json with zero entries fails the build loud, naming the check', async () => {
  const loader = changelogLoader({
    fetchJson: async () => jsonResponse({ entries: [] }),
    queryD1: async () => SIX_D1_ROWS,
    readLastGood: async () => null,
    writePending: async () => {},
    env: {},
  });
  await assert.rejects(() => run(loader), (err) => {
    assert.match(err.message, /changelog-loader/);
    assert.match(err.message, /zero entries/);
    return true;
  });
});

test('REND-03 replay: D1 public_changelogs with zero rows fails the build loud, naming public_changelogs', async () => {
  const loader = changelogLoader({
    fetchJson: async () =>
      jsonResponse({ entries: Array.from({ length: 15 }, (_, i) => ({ date: '2026-01-01', title: `t${i}`, items: [`i${i}`] })) }),
    queryD1: async () => [],
    readLastGood: async () => null,
    writePending: async () => {},
    env: {},
  });
  await assert.rejects(() => run(loader), /public_changelogs/);
});

test('REND-03 replay: a shrunken total (below the last-good baseline) fails the build loud, naming never-shrink', async () => {
  const loader = changelogLoader({
    fetchJson: async () =>
      jsonResponse({ entries: Array.from({ length: 5 }, (_, i) => ({ date: '2026-01-01', title: `t${i}`, items: [`i${i}`] })) }),
    queryD1: async () => SIX_D1_ROWS,
    readLastGood: async () => ({
      schemaVersion: '1',
      buildHash: 'x',
      recordedAt: 'x',
      articles: { count: 0, ids: [] },
      changelog: { count: 18 },
    }),
    writePending: async () => {},
    env: {},
  });
  await assert.rejects(() => run(loader), /never-shrink check failed/);
});

// ---------------------------------------------------------------------------
// Section 2: the real-build replay.
// ---------------------------------------------------------------------------

test('REND-03 real-build replay: a real `pnpm run build` against an empty v1 changelog.json exits non-zero and names the failure', async () => {
  const dataUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify({ entries: [] }));

  let failed = false;
  let combinedOutput = '';
  try {
    execFileSync('pnpm', ['run', 'build'], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, V1_CHANGELOG_URL: dataUrl },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    });
  } catch (err) {
    failed = true;
    combinedOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
  }

  assert.ok(failed, 'a build against a zero-entry v1 changelog.json must exit non-zero');
  assert.match(combinedOutput, /changelog-loader/);
  assert.match(combinedOutput, /zero entries/);
});

#!/usr/bin/env node
// 04-08 Task 1 (RED, then made GREEN): pins the dual-source changelog loader (D-13) — merge of
// v1's changelog.json with D1's public_changelogs, exact-duplicate removal, sort order, the
// never-shrink check (both the CHANGELOG_MIN_EXPECTED floor and the last-good ratchet-up), and
// the writePendingBuildState contract. Drives the real Loader against a minimal fake
// LoaderContext (Map-backed store) and the `deps` test seams — no real network/D1/KV access.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  changelogLoader,
  changelogSchema,
  DEFAULT_V1_CHANGELOG_URL,
  CHANGELOG_MIN_EXPECTED,
} from '../../src/content/loaders/changelog-loader.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V1_FIXTURE = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/v1-changelog.json'), 'utf8'));
const D1_FIXTURE = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/d1-public-changelogs.json'), 'utf8'));

function jsonResponse(body, opts = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    json: async () => body,
  };
}

function makeStore() {
  const map = new Map();
  return {
    get: (key) => map.get(key),
    entries: () => Array.from(map.entries()),
    values: () => Array.from(map.values()),
    keys: () => Array.from(map.keys()),
    set: ({ id, data, digest }) => {
      map.set(id, { id, data, digest });
      return true;
    },
    delete: (key) => map.delete(key),
    clear: () => map.clear(),
    has: (key) => map.has(key),
    addModuleImport: () => {},
    _raw: map,
  };
}

function makeLogger() {
  const lines = [];
  return {
    info: (msg) => lines.push(['info', msg]),
    warn: (msg) => lines.push(['warn', msg]),
    error: (msg) => lines.push(['error', msg]),
    lines,
  };
}

function generateDigest(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function parseData({ data }) {
  return data;
}

async function run(loader, { store } = {}) {
  const s = store ?? makeStore();
  const logger = makeLogger();
  await loader.load({ store: s, parseData, generateDigest, logger });
  return { store: s, logger };
}

function baseDeps(overrides = {}) {
  return {
    fetchJson: async () => jsonResponse(V1_FIXTURE),
    queryD1: async () => D1_FIXTURE,
    readLastGood: async () => null,
    writePending: async () => {},
    env: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

test('DEFAULT_V1_CHANGELOG_URL is v1s live changelog.json', () => {
  assert.equal(DEFAULT_V1_CHANGELOG_URL, 'https://915tldr.com/changelog.json');
});

test('changelogSchema validates a well-shaped entry and rejects a malformed one', () => {
  const good = { id: 'json:2026-09-19:0', date: '2026-09-19', title: 'x', items: ['a'], source: 'v1-json' };
  assert.doesNotThrow(() => changelogSchema.parse(good));
  assert.throws(() => changelogSchema.parse({ ...good, date: '09/19/2026' }));
  assert.throws(() => changelogSchema.parse({ ...good, items: [] }));
  assert.throws(() => changelogSchema.parse({ ...good, source: 'bogus' }));
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('happy path: merges both sources, sorted newest first, D1 epoch dates become YYYY-MM-DD, items preserved verbatim', async () => {
  const loader = changelogLoader(baseDeps());
  const { store } = await run(loader);

  const expectedTotal = V1_FIXTURE.entries.length + D1_FIXTURE.length;
  assert.equal(store.keys().length, expectedTotal);

  const entries = store.values().map((e) => e.data);
  // newest-first
  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i - 1].date >= entries[i].date, `${entries[i - 1].date} should be >= ${entries[i].date}`);
  }

  // Every D1 row's items appear verbatim and its date is a real YYYY-MM-DD conversion.
  for (const row of D1_FIXTURE) {
    const items = JSON.parse(row.items);
    const match = entries.find((e) => e.id === `d1:${row.id}`);
    assert.ok(match, `expected an entry with id d1:${row.id}`);
    assert.deepEqual(match.items, items);
    assert.match(match.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(match.title, row.title);
    assert.equal(match.source, 'd1');
  }

  // Every v1 JSON entry appears verbatim.
  V1_FIXTURE.entries.forEach((entry, index) => {
    const match = entries.find((e) => e.id === `json:${entry.date}:${index}`);
    assert.ok(match, `expected an entry with id json:${entry.date}:${index}`);
    assert.deepEqual(match.items, entry.items);
    assert.equal(match.title, entry.title);
    assert.equal(match.source, 'v1-json');
  });
});

test('an entry duplicated exactly (same date, title, items) across sources appears once, as the v1-json copy', async () => {
  const dupe = { date: '2026-01-01', title: 'Duplicate entry', items: ['same', 'items'] };
  const v1WithDupe = { entries: [dupe, ...V1_FIXTURE.entries] };
  const d1WithDupe = [
    // 18:00Z is 11:00 MST in America/Denver (no DST in January) — same calendar day, so this
    // converts to the same "2026-01-01" date string the v1-json copy uses.
    { id: 999, date: Math.floor(new Date('2026-01-01T18:00:00Z').getTime() / 1000), title: dupe.title, items: JSON.stringify(dupe.items) },
    ...D1_FIXTURE,
  ];
  const loader = changelogLoader(
    baseDeps({
      fetchJson: async () => jsonResponse(v1WithDupe),
      queryD1: async () => d1WithDupe,
    })
  );
  const { store } = await run(loader);
  const entries = store.values().map((e) => e.data);
  const matches = entries.filter((e) => e.title === dupe.title && e.date === '2026-01-01');
  assert.equal(matches.length, 1, 'the exact duplicate must appear exactly once');
  assert.equal(matches[0].source, 'v1-json', 'the surviving copy must be the v1-json one');
  // total is one less than the naive sum (the d1 duplicate was dropped)
  assert.equal(store.keys().length, v1WithDupe.entries.length + d1WithDupe.length - 1);
});

test('entries differing in any field (even same date+title) both appear', async () => {
  const a = { date: '2026-01-01', title: 'Same title', items: ['version a'] };
  const b = { date: '2026-01-01', title: 'Same title', items: ['version b'] };
  const loader = changelogLoader(
    baseDeps({
      // Padded with the real fixture entries so the total clears CHANGELOG_MIN_EXPECTED — this
      // test is about dedup key precision, not the never-shrink floor.
      fetchJson: async () => jsonResponse({ entries: [a, b, ...V1_FIXTURE.entries] }),
    })
  );
  const { store } = await run(loader);
  const entries = store.values().map((e) => e.data);
  const matches = entries.filter((e) => e.title === 'Same title');
  assert.equal(matches.length, 2, 'entries differing in items must both survive');
});

// ---------------------------------------------------------------------------
// Fail-loud: JSON source
// ---------------------------------------------------------------------------

test('JSON payload with zero entries rejects with a message containing "zero entries"', async () => {
  const loader = changelogLoader(baseDeps({ fetchJson: async () => jsonResponse({ entries: [] }) }));
  await assert.rejects(() => run(loader), /zero entries/);
});

test('JSON fetch non-2xx rejects naming the check', async () => {
  const loader = changelogLoader(
    baseDeps({ fetchJson: async () => jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }) })
  );
  await assert.rejects(() => run(loader), /changelog-loader.*v1 changelog\.json fetch failed/);
});

test('JSON fetch network rejection rejects naming the check', async () => {
  const loader = changelogLoader(
    baseDeps({
      fetchJson: async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      },
    })
  );
  await assert.rejects(() => run(loader), /changelog-loader.*v1 changelog\.json fetch failed/);
});

test('JSON invalid-JSON body rejects naming the check', async () => {
  const loader = changelogLoader(
    baseDeps({
      fetchJson: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    })
  );
  await assert.rejects(() => run(loader), /changelog-loader.*v1 changelog\.json is not valid JSON/);
});

test('a malformed v1 entry (missing/empty required field) rejects naming the entry index', async () => {
  const loader = changelogLoader(
    baseDeps({ fetchJson: async () => jsonResponse({ entries: [{ date: '2026-01-01', title: '', items: ['x'] }] }) })
  );
  await assert.rejects(() => run(loader), /index 0/);
});

// ---------------------------------------------------------------------------
// Fail-loud: D1 source
// ---------------------------------------------------------------------------

test('D1 returning zero rows rejects naming public_changelogs', async () => {
  const loader = changelogLoader(baseDeps({ queryD1: async () => [] }));
  await assert.rejects(() => run(loader), /public_changelogs/);
});

test('a D1 row with invalid JSON items rejects naming the row id', async () => {
  const loader = changelogLoader(
    baseDeps({ queryD1: async () => [{ id: 42, date: 1700000000, title: 'x', items: 'not json' }] })
  );
  await assert.rejects(() => run(loader), /row 42/);
});

test('a D1 row with items that is not a non-empty array of strings rejects naming the row id', async () => {
  const loader = changelogLoader(
    baseDeps({ queryD1: async () => [{ id: 43, date: 1700000000, title: 'x', items: JSON.stringify([]) }] })
  );
  await assert.rejects(() => run(loader), /row 43/);
});

// ---------------------------------------------------------------------------
// Never-shrink check
// ---------------------------------------------------------------------------

test('last good count 18, current 17 (real D1 rows), ALLOWED_CHANGELOG_SHRINK unset -> rejects with never-shrink; =1 -> resolves', async () => {
  const eleven = Array.from({ length: 11 }, (_, i) => ({ date: '2026-01-01', title: `t${i}`, items: [`i${i}`] }));
  // 11 json + 6 d1 = 17
  const failing = changelogLoader(
    baseDeps({
      fetchJson: async () => jsonResponse({ entries: eleven }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 0, ids: [] },
        changelog: { count: 18 },
      }),
    })
  );
  await assert.rejects(() => run(failing), /never-shrink check failed/);

  const resolving = changelogLoader(
    baseDeps({
      fetchJson: async () => jsonResponse({ entries: eleven }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 0, ids: [] },
        changelog: { count: 18 },
      }),
      env: { ALLOWED_CHANGELOG_SHRINK: '1' },
    })
  );
  await assert.doesNotReject(() => run(resolving));
});

test('no last-good baseline and total below CHANGELOG_MIN_EXPECTED rejects citing the constant', async () => {
  const four = Array.from({ length: 4 }, (_, i) => ({ date: '2026-01-01', title: `t${i}`, items: [`i${i}`] }));
  const loader = changelogLoader(
    baseDeps({
      fetchJson: async () => jsonResponse({ entries: four }), // 4 + 6 = 10, below CHANGELOG_MIN_EXPECTED
      readLastGood: async () => null,
    })
  );
  await assert.rejects(() => run(loader), new RegExp(`CHANGELOG_MIN_EXPECTED \\(${CHANGELOG_MIN_EXPECTED}\\)`));
});

test('no last-good baseline and total at or above CHANGELOG_MIN_EXPECTED resolves', async () => {
  const loader = changelogLoader(baseDeps({ readLastGood: async () => null }));
  // baseDeps fixtures total = V1_FIXTURE.length + D1_FIXTURE.length, which is >= CHANGELOG_MIN_EXPECTED
  assert.ok(V1_FIXTURE.entries.length + D1_FIXTURE.length >= CHANGELOG_MIN_EXPECTED);
  await assert.doesNotReject(() => run(loader));
});

test('ratchet-up: once a baseline of 18 exists, the floor is 18 (not CHANGELOG_MIN_EXPECTED), even though 18 > CHANGELOG_MIN_EXPECTED', async () => {
  assert.ok(18 > CHANGELOG_MIN_EXPECTED, 'this test only proves something if 18 exceeds the floor constant');
  const seventeen = Array.from({ length: 17 - D1_FIXTURE.length }, (_, i) => ({
    date: '2026-01-01',
    title: `t${i}`,
    items: [`i${i}`],
  }));
  const eighteen = Array.from({ length: 18 - D1_FIXTURE.length }, (_, i) => ({
    date: '2026-01-01',
    title: `t${i}`,
    items: [`i${i}`],
  }));
  const withBaseline18 = (entries) =>
    baseDeps({
      fetchJson: async () => jsonResponse({ entries }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 0, ids: [] },
        changelog: { count: 18 },
      }),
    });

  await assert.rejects(() => run(changelogLoader(withBaseline18(seventeen))), /never-shrink check failed/);
  await assert.doesNotReject(() => run(changelogLoader(withBaseline18(eighteen))));
});

// ---------------------------------------------------------------------------
// On success: writePendingBuildState
// ---------------------------------------------------------------------------

test('on success, writePendingBuildState is called with { changelog: { count } }', async () => {
  const pendingCalls = [];
  const loader = changelogLoader(baseDeps({ writePending: async (patch) => pendingCalls.push(patch) }));
  await run(loader);
  assert.equal(pendingCalls.length, 1);
  assert.equal(pendingCalls[0].changelog.count, V1_FIXTURE.entries.length + D1_FIXTURE.length);
});

test('a failed run never calls writePendingBuildState', async () => {
  let called = false;
  const loader = changelogLoader(
    baseDeps({ fetchJson: async () => jsonResponse({ entries: [] }), writePending: async () => { called = true; } })
  );
  await assert.rejects(() => run(loader));
  assert.ok(!called);
});

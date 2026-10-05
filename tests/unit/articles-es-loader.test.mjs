#!/usr/bin/env node
// 06-06 Task 2: pins the Spanish loader — cold/warm mode selection, the budget check, per-row
// mapping (available/held/malformed), the D-14-style never-shrink check (with the Spanish-specific
// "no translation has ever existed" exception), and the after-success meta/pending-state updates.
// Drives the real Loader against a minimal fake LoaderContext (Map-backed store/meta) and the
// `deps` test seams — no real D1/KV network access, following tests/unit/articles-loader.test.mjs's
// harness convention.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  articlesEsLoader,
  ES_LOADER_STATE_VERSION,
  ES_COLD_RESYNC_INTERVAL_SECONDS,
  ES_SYNC_OVERLAP_SECONDS,
  ES_ROWS_READ_BUDGET,
} from '../../src/content/loaders/articles-es-loader.ts';

function makeStore(seed = []) {
  const map = new Map();
  for (const entry of seed) map.set(entry.id, entry);
  return {
    get: (key) => map.get(key),
    entries: () => Array.from(map.entries()),
    values: () => Array.from(map.values()),
    keys: () => Array.from(map.keys()),
    set: ({ id, data, digest }) => {
      const existing = map.get(id);
      if (existing && digest !== undefined && existing.digest === digest) return false;
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

function makeMeta(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get: (key) => map.get(key),
    set: (key, value) => map.set(key, value),
    has: (key) => map.has(key),
    delete: (key) => map.delete(key),
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
  // Mirrors the real Content Layer: re-throw a validation-shaped error on an invalid row rather
  // than silently accepting it, matching `articleEsSchema`'s own closed-enum/regex contract.
  if (typeof data.uuid !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.uuid)) {
    throw new Error('invalid uuid');
  }
  if (!['en', 'es', 'und'].includes(data.sourceLanguage)) {
    throw new Error('invalid sourceLanguage');
  }
  return data;
}

function translationRow(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    source_language: 'en',
    title: 'El Paso enfrenta riesgo de inundación',
    summary: 'Se pronostican fuertes lluvias.',
    key_points: null,
    grounding_status: 'clean',
    updated_at: 1790099986,
    ...overrides,
  };
}

const NOW = 3_000_000;

function baseDeps(overrides = {}) {
  return {
    now: () => NOW,
    fetchAll: async () => ({ rows: [], rowsRead: 0 }),
    fetchChangedSince: async () => ({ rows: [], rowsRead: 0 }),
    readLastGood: async () => null,
    writePending: async () => {},
    env: {},
    ...overrides,
  };
}

async function run(loader, { store, meta } = {}) {
  const s = store ?? makeStore();
  const m = meta ?? makeMeta();
  const logger = makeLogger();
  await loader.load({ store: s, meta: m, parseData, generateDigest, logger });
  return { store: s, meta: m, logger };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test('constants: exported values match the documented design', () => {
  assert.equal(ES_LOADER_STATE_VERSION, '1');
  assert.equal(ES_COLD_RESYNC_INTERVAL_SECONDS, 604_800);
  assert.equal(ES_SYNC_OVERLAP_SECONDS, 7_200);
  assert.equal(typeof ES_ROWS_READ_BUDGET, 'number');
  assert.ok(ES_ROWS_READ_BUDGET > 0);
});

// ---------------------------------------------------------------------------
// Behavior bullet 1: previous null, current rows 0 — succeeds, empty pending section
// ---------------------------------------------------------------------------

test('previous Spanish baseline null and current rows 0: succeeds, writes an empty pending section', async () => {
  let pendingWritten = null;
  const loader = articlesEsLoader(
    baseDeps({
      readLastGood: async () => null,
      writePending: async (patch) => {
        pendingWritten = patch;
      },
    })
  );

  await run(loader);

  assert.deepEqual(pendingWritten, { articlesEs: { count: 0, ids: [] } });
});

// ---------------------------------------------------------------------------
// Behavior bullet 2: lastGood exists with no articlesEs section, current rows > 0 — bootstraps
// even with BUILD_STATE_REQUIRE_BASELINE set
// ---------------------------------------------------------------------------

test('lastGood exists with no articlesEs section and current rows > 0: bootstraps even when BUILD_STATE_REQUIRE_BASELINE=1', async () => {
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({ rows: [translationRow()], rowsRead: 1 }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'abc',
        recordedAt: '2026-01-01T00:00:00.000Z',
        articles: { count: 10, ids: ['a'] },
        // no `articlesEs` key at all — every pre-Phase-6 baseline
      }),
      env: { BUILD_STATE_REQUIRE_BASELINE: '1' },
    })
  );

  const { store } = await run(loader);

  assert.equal(store.keys().length, 1);
  assert.ok(store.has('201187fa-6484-4516-99d5-7e41da203323'));
});

// ---------------------------------------------------------------------------
// Behavior bullet 3: previous count 500, current rows 0 — throws, names articles-es
// ---------------------------------------------------------------------------

test('previous baseline count 500 and current rows 0: throws a never-shrink error naming articles-es', async () => {
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({ rows: [], rowsRead: 0 }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'abc',
        recordedAt: '2026-01-01T00:00:00.000Z',
        articles: { count: 10, ids: ['a'] },
        articlesEs: { count: 500, ids: Array.from({ length: 500 }, (_, i) => `id-${i}`) },
      }),
    })
  );

  await assert.rejects(() => run(loader), (err) => {
    assert.match(err.message, /^articles-es:/);
    return true;
  });
});

// ---------------------------------------------------------------------------
// Behavior bullet 4: previous [a,b,c], current [a,b] with allowance 0 throws; [a,b,c,d] succeeds
// ---------------------------------------------------------------------------

test('unexplained shrink with allowance 0 throws; growth succeeds', async () => {
  const UUID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
  const UUID_B = 'aaaaaaaa-0000-4000-8000-000000000002';
  const UUID_C = 'aaaaaaaa-0000-4000-8000-000000000003';
  const UUID_D = 'aaaaaaaa-0000-4000-8000-000000000004';

  const lastGood = {
    schemaVersion: '1',
    buildHash: 'abc',
    recordedAt: '2026-01-01T00:00:00.000Z',
    articles: { count: 10, ids: ['a'] },
    articlesEs: { count: 3, ids: [UUID_A, UUID_B, UUID_C] },
  };

  const shrinkLoader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({
        rows: [translationRow({ uuid: UUID_A }), translationRow({ uuid: UUID_B })],
        rowsRead: 2,
      }),
      readLastGood: async () => lastGood,
    })
  );
  await assert.rejects(() => run(shrinkLoader));

  const growthLoader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({
        rows: [
          translationRow({ uuid: UUID_A }),
          translationRow({ uuid: UUID_B }),
          translationRow({ uuid: UUID_C }),
          translationRow({ uuid: UUID_D }),
        ],
        rowsRead: 4,
      }),
      readLastGood: async () => lastGood,
    })
  );
  const { store } = await run(growthLoader);
  assert.equal(store.keys().length, 4);
});

// ---------------------------------------------------------------------------
// Behavior bullet 5: a warm pass whose rowsRead exceeds the budget throws before any mutation
// ---------------------------------------------------------------------------

test('a warm pass whose rowsRead exceeds ES_ROWS_READ_BUDGET throws before any store mutation', async () => {
  const seedEntry = { id: '201187fa-6484-4516-99d5-7e41da203323', data: { uuid: '201187fa-6484-4516-99d5-7e41da203323' }, digest: 'seed' };
  const store = makeStore([seedEntry]);
  const meta = makeMeta({ stateVersion: ES_LOADER_STATE_VERSION, lastCold: String(NOW - 1000), lastSync: String(NOW - 1000) });

  const loader = articlesEsLoader(
    baseDeps({
      fetchChangedSince: async () => ({ rows: [translationRow()], rowsRead: ES_ROWS_READ_BUDGET + 1 }),
    })
  );

  await assert.rejects(() => run(loader, { store, meta }), /rows-read budget exceeded/);
  // Store untouched — the seed entry is exactly as it was before the throw.
  assert.equal(store.keys().length, 1);
  assert.deepEqual(store.get(seedEntry.id), seedEntry);
});

// ---------------------------------------------------------------------------
// Behavior bullet 6: a held row upserted over a previously available entry replaces it
// ---------------------------------------------------------------------------

test('a held row upserted over a previously available entry replaces it with available:false and null text', async () => {
  const uuid = '201187fa-6484-4516-99d5-7e41da203323';
  const seedData = {
    uuid,
    sourceLanguage: 'en',
    available: true,
    title: 'Título anterior',
    summary: 'Resumen anterior',
    keyPoints: ['Punto 1'],
    updatedAt: 1000,
  };
  const store = makeStore([{ id: uuid, data: seedData, digest: generateDigest(seedData) }]);
  const meta = makeMeta({ stateVersion: ES_LOADER_STATE_VERSION, lastCold: String(NOW - 1000), lastSync: String(NOW - 1000) });

  const loader = articlesEsLoader(
    baseDeps({
      fetchChangedSince: async () => ({
        rows: [translationRow({ uuid, grounding_status: 'held', title: null, summary: null })],
        rowsRead: 1,
      }),
    })
  );

  const { store: finalStore } = await run(loader, { store, meta });

  const updated = finalStore.get(uuid);
  assert.equal(updated.data.available, false);
  assert.equal(updated.data.title, null);
  assert.equal(updated.data.summary, null);
  assert.equal(updated.data.keyPoints, null);
});

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

test('mode selection: an empty store is always cold, regardless of meta', async () => {
  let usedFetchAll = false;
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => {
        usedFetchAll = true;
        return { rows: [], rowsRead: 0 };
      },
    })
  );
  const meta = makeMeta({ stateVersion: ES_LOADER_STATE_VERSION, lastCold: String(NOW) });
  await run(loader, { meta });
  assert.ok(usedFetchAll);
});

test('mode selection: a non-empty store with current stateVersion and fresh lastCold is warm', async () => {
  let usedFetchChangedSince = false;
  const seedEntry = { id: '201187fa-6484-4516-99d5-7e41da203323', data: { uuid: '201187fa-6484-4516-99d5-7e41da203323' }, digest: 'seed' };
  const loader = articlesEsLoader(
    baseDeps({
      fetchChangedSince: async (since) => {
        usedFetchChangedSince = true;
        return { rows: [], rowsRead: 0 };
      },
    })
  );
  const store = makeStore([seedEntry]);
  const meta = makeMeta({ stateVersion: ES_LOADER_STATE_VERSION, lastCold: String(NOW - 1000), lastSync: String(NOW - 500) });
  await run(loader, { store, meta });
  assert.ok(usedFetchChangedSince);
});

test('mode selection: ARTICLES_FORCE_COLD=1 forces cold even when warm conditions are met', async () => {
  let usedFetchAll = false;
  const seedEntry = { id: '201187fa-6484-4516-99d5-7e41da203323', data: { uuid: '201187fa-6484-4516-99d5-7e41da203323' }, digest: 'seed' };
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => {
        usedFetchAll = true;
        return { rows: [], rowsRead: 0 };
      },
      env: { ARTICLES_FORCE_COLD: '1' },
    })
  );
  const store = makeStore([seedEntry]);
  const meta = makeMeta({ stateVersion: ES_LOADER_STATE_VERSION, lastCold: String(NOW - 1000), lastSync: String(NOW - 500) });
  await run(loader, { store, meta });
  assert.ok(usedFetchAll);
});

// ---------------------------------------------------------------------------
// Malformed row handling
// ---------------------------------------------------------------------------

test('a row with malformed key_points JSON is excluded from the store and counted as malformed', async () => {
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({
        rows: [translationRow({ key_points: '{not valid json' })],
        rowsRead: 1,
      }),
      readLastGood: async () => null,
    })
  );

  const { store, logger } = await run(loader);

  assert.equal(store.keys().length, 0);
  const line = logger.lines.find(([level]) => level === 'info')[1];
  assert.match(line, /malformed=1/);
  assert.match(line, /rows=1/);
});

test('a row with an invalid uuid is excluded from the store and counted as malformed, not thrown', async () => {
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({
        rows: [translationRow({ uuid: 'not-a-uuid' })],
        rowsRead: 1,
      }),
      readLastGood: async () => null,
    })
  );

  const { store, logger } = await run(loader);

  assert.equal(store.keys().length, 0);
  const line = logger.lines.find(([level]) => level === 'info')[1];
  assert.match(line, /malformed=1/);
});

// ---------------------------------------------------------------------------
// Summary log line shape
// ---------------------------------------------------------------------------

test('summary log line: reports mode, rows, available, held, malformed, rowsRead, budget', async () => {
  const loader = articlesEsLoader(
    baseDeps({
      fetchAll: async () => ({
        rows: [
          translationRow({ uuid: 'aaaaaaaa-0000-4000-8000-000000000001', grounding_status: 'clean' }),
          translationRow({ uuid: 'aaaaaaaa-0000-4000-8000-000000000002', grounding_status: 'held', title: null, summary: null }),
        ],
        rowsRead: 2,
      }),
      readLastGood: async () => null,
    })
  );

  const { logger } = await run(loader);

  const line = logger.lines.find(([level]) => level === 'info')[1];
  assert.match(line, /^\[articles-es\] mode=cold rows=2 available=1 held=1 malformed=0 rowsRead=2 budget=\d+$/);
});

#!/usr/bin/env node
// 04-03 Task 2 (RED, then made GREEN): pins the full loader — cold/warm/warm+sweep mode
// selection, per-mode rows-read budgets, the D-14 never-shrink check, category validation,
// manifest bulk-write/bulk-delete (including the schema-version rewrite-all path), and the
// after-success meta/pending-state updates. Drives the real Loader against a minimal fake
// LoaderContext (Map-backed store/meta) and the `deps` test seams — no real D1/KV network access.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  articlesLoader,
  LOADER_STATE_VERSION,
  SWEEP_INTERVAL_SECONDS,
  SWEEP_OVERLAP_SECONDS,
  COLD_RESYNC_INTERVAL_SECONDS,
  WARM_ROWS_READ_BUDGET,
  SWEEP_ROWS_READ_BUDGET,
  COLD_ROWS_READ_BUDGET,
} from '../../src/content/loaders/articles-loader.ts';

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
  return data;
}

function makeArticle(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    title: 'El Paso faces Level 3 flash flood risk',
    slug: 'el-paso-faces-level-3-flash-flood-risk',
    summary: 'Heavy rain is forecast through the weekend.',
    keyPoints: null,
    url: 'https://example.com/article',
    publishedAt: 1790099986,
    category: { slug: 'weather', name: 'Weather' },
    tags: [{ slug: 'flooding', name: 'Flooding' }],
    source: { slug: 'ktsm', name: 'KTSM', websiteUrl: 'https://ktsm.com' },
    ...overrides,
  };
}

function storeEntry(article) {
  return { id: article.uuid, data: article, digest: generateDigest(article) };
}

const NOW = 3_000_000;

function baseDeps(overrides = {}) {
  return {
    now: () => NOW,
    fetchWindow: async () => ({ publicArticles: [], nonPublic: [], rowsRead: 0 }),
    fetchAll: async () => ({ publicArticles: [], nonPublic: [], rowsRead: 0, requestCount: 0 }),
    fetchByIds: async () => ({ publicArticles: [], nonPublic: [], rowsRead: 0, requestCount: 0 }),
    fetchChangedSince: async () => ({ ids: [], rowsRead: 0 }),
    readLastGood: async () => null,
    writeManifest: async () => {},
    deleteManifest: async () => {},
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

test('exported constants match the plan', () => {
  assert.equal(LOADER_STATE_VERSION, '1');
  assert.equal(SWEEP_INTERVAL_SECONDS, 86_400);
  assert.equal(SWEEP_OVERLAP_SECONDS, 7_200);
  assert.equal(COLD_RESYNC_INTERVAL_SECONDS, 604_800);
  assert.equal(WARM_ROWS_READ_BUDGET, 25_000);
  assert.equal(SWEEP_ROWS_READ_BUDGET, 100_000);
  assert.equal(COLD_ROWS_READ_BUDGET, 1_500_000);
});

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

test('mode is cold when the store is empty', async () => {
  let fetchAllCalled = false;
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => {
        fetchAllCalled = true;
        return { publicArticles: [makeArticle()], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
    })
  );
  await run(loader);
  assert.ok(fetchAllCalled);
});

test('mode is cold when meta.stateVersion differs from LOADER_STATE_VERSION', async () => {
  let fetchAllCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => {
        fetchAllCalled = true;
        return { publicArticles: [article], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({ stateVersion: '0', lastCold: String(NOW) });
  await run(loader, { store, meta });
  assert.ok(fetchAllCalled);
});

test('mode is cold when meta.lastCold is absent', async () => {
  let fetchAllCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => {
        fetchAllCalled = true;
        return { publicArticles: [article], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION });
  await run(loader, { store, meta });
  assert.ok(fetchAllCalled);
});

test('mode is cold when meta.lastCold is older than COLD_RESYNC_INTERVAL_SECONDS', async () => {
  let fetchAllCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => {
        fetchAllCalled = true;
        return { publicArticles: [article], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({
    stateVersion: LOADER_STATE_VERSION,
    lastCold: String(NOW - COLD_RESYNC_INTERVAL_SECONDS - 1),
    lastSweep: String(NOW),
  });
  await run(loader, { store, meta });
  assert.ok(fetchAllCalled);
});

test('mode is cold when ARTICLES_FORCE_COLD=1, even when otherwise warm-eligible', async () => {
  let fetchAllCalled = false;
  let fetchWindowCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      env: { ARTICLES_FORCE_COLD: '1' },
      fetchAll: async () => {
        fetchAllCalled = true;
        return { publicArticles: [article], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
      fetchWindow: async () => {
        fetchWindowCalled = true;
        return { publicArticles: [], nonPublic: [], rowsRead: 0 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  await run(loader, { store, meta });
  assert.ok(fetchAllCalled);
  assert.ok(!fetchWindowCalled);
});

test('mode is warm+sweep when meta.lastSweep is absent (store otherwise warm-eligible)', async () => {
  let sweepCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
      fetchChangedSince: async () => {
        sweepCalled = true;
        return { ids: [], rowsRead: 0 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW) });
  await run(loader, { store, meta });
  assert.ok(sweepCalled);
});

test('mode is warm+sweep when meta.lastSweep is older than SWEEP_INTERVAL_SECONDS', async () => {
  let sweepCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
      fetchChangedSince: async () => {
        sweepCalled = true;
        return { ids: [], rowsRead: 0 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({
    stateVersion: LOADER_STATE_VERSION,
    lastCold: String(NOW),
    lastSweep: String(NOW - SWEEP_INTERVAL_SECONDS - 1),
  });
  await run(loader, { store, meta });
  assert.ok(sweepCalled);
});

test('mode is warm (no sweep) when lastCold and lastSweep are both recent', async () => {
  let sweepCalled = false;
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
      fetchChangedSince: async () => {
        sweepCalled = true;
        return { ids: [], rowsRead: 0 };
      },
    })
  );
  const store = makeStore([storeEntry(article)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  await run(loader, { store, meta });
  assert.ok(!sweepCalled);
});

// ---------------------------------------------------------------------------
// Cold behavior
// ---------------------------------------------------------------------------

test('cold: store ends with exactly the public set', async () => {
  const kept = makeArticle();
  const stale = makeArticle({ uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'stale-article' });
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => ({ publicArticles: [kept], nonPublic: [], rowsRead: 1, requestCount: 1 }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 2, ids: [kept.uuid, stale.uuid] },
      }),
      env: { ALLOWED_ARTICLE_SHRINK: '1' },
    })
  );
  const store = makeStore([storeEntry(kept), storeEntry(stale)]);
  const meta = makeMeta(); // empty meta -> cold via stateVersion mismatch anyway
  const { store: finalStore } = await run(loader, { store, meta });
  assert.deepEqual(finalStore.keys().sort(), [kept.uuid]);
});

test('cold: entries whose digest is unchanged are not reported as changed', async () => {
  const unchanged = makeArticle();
  let writeManifestCalls = [];
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => ({ publicArticles: [unchanged], nonPublic: [], rowsRead: 1, requestCount: 1 }),
      writeManifest: async (entries) => writeManifestCalls.push(entries),
    })
  );
  const store = makeStore([storeEntry(unchanged)]);
  const meta = makeMeta({ manifestSchemaVersion: '2' }); // already current schema, so no rewrite-all
  await run(loader, { store, meta });
  assert.equal(writeManifestCalls.length, 1);
  assert.equal(writeManifestCalls[0].length, 0, 'unchanged article must not be manifest-written');
});

test('cold: nonPublic uuids in the previous last-good ids count as explained (no throw)', async () => {
  const kept = makeArticle();
  const nowNonPublicUuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => ({
        publicArticles: [kept],
        nonPublic: [{ uuid: nowNonPublicUuid, reason: 'duplicate' }],
        rowsRead: 1,
        requestCount: 1,
      }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 2, ids: [kept.uuid, nowNonPublicUuid] },
      }),
    })
  );
  // Should not throw — the removal is explained (observed nonPublic reason).
  await run(loader);
});

// ---------------------------------------------------------------------------
// Warm behavior
// ---------------------------------------------------------------------------

test('warm: public window rows are set', async () => {
  const article = makeArticle();
  const unrelated = makeArticle({ uuid: '99999999-9999-9999-9999-999999999999', slug: 'pre-existing-unrelated' });
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
    })
  );
  // A non-empty store is required for warm mode — an empty store always forces cold (bullet 1).
  const store = makeStore([storeEntry(unrelated)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  const { store: finalStore } = await run(loader, { store, meta });
  assert.ok(finalStore.has(article.uuid));
});

test('warm: nonPublic window rows present in the store are deleted and counted as explained', async () => {
  const kept = makeArticle();
  const removed = makeArticle({ uuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc', slug: 'removed-article' });
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({
        publicArticles: [kept],
        nonPublic: [{ uuid: removed.uuid, reason: 'duplicate' }],
        rowsRead: 2,
      }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 2, ids: [kept.uuid, removed.uuid] },
      }),
    })
  );
  const store = makeStore([storeEntry(kept), storeEntry(removed)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  const { store: finalStore } = await run(loader, { store, meta });
  assert.ok(!finalStore.has(removed.uuid));
  assert.ok(finalStore.has(kept.uuid));
});

test('warm: entries outside the window are untouched', async () => {
  const outside = makeArticle({ uuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd', slug: 'outside-window' });
  const inWindow = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [inWindow], nonPublic: [], rowsRead: 1 }),
    })
  );
  const outsideEntry = storeEntry(outside);
  const store = makeStore([outsideEntry]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  const { store: finalStore } = await run(loader, { store, meta });
  assert.deepEqual(finalStore.get(outside.uuid), outsideEntry);
});

// ---------------------------------------------------------------------------
// warm+sweep behavior
// ---------------------------------------------------------------------------

test('warm+sweep: ids from fetchChangedSince are re-fetched via fetchByIds and applied like window rows', async () => {
  const windowArticle = makeArticle();
  const sweepArticle = makeArticle({ uuid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', slug: 'sweep-article' });
  let fetchByIdsCalledWith = null;
  let fetchChangedSinceCalledWith = null;
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [windowArticle], nonPublic: [], rowsRead: 1 }),
      fetchChangedSince: async (since) => {
        fetchChangedSinceCalledWith = since;
        return { ids: [42], rowsRead: 1 };
      },
      fetchByIds: async (ids) => {
        fetchByIdsCalledWith = ids;
        return { publicArticles: [sweepArticle], nonPublic: [], rowsRead: 1, requestCount: 1 };
      },
    })
  );
  const unrelated = makeArticle({ uuid: '88888888-8888-8888-8888-888888888888', slug: 'pre-existing-unrelated' });
  const store = makeStore([storeEntry(unrelated)]);
  const lastSweep = NOW - SWEEP_INTERVAL_SECONDS - 1;
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(lastSweep) });
  const { store: finalStore } = await run(loader, { store, meta });

  assert.equal(fetchChangedSinceCalledWith, lastSweep - SWEEP_OVERLAP_SECONDS);
  assert.deepEqual(fetchByIdsCalledWith, [42]);
  assert.ok(finalStore.has(sweepArticle.uuid));
  assert.ok(finalStore.has(windowArticle.uuid));
});

// ---------------------------------------------------------------------------
// Budget check — throws BEFORE any store mutation, manifest write or meta update
// ---------------------------------------------------------------------------

test('warm rowsRead above WARM_ROWS_READ_BUDGET throws, and the store/manifest/meta are untouched', async () => {
  const article = makeArticle();
  let writeManifestCalled = false;
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({
        publicArticles: [article],
        nonPublic: [],
        rowsRead: WARM_ROWS_READ_BUDGET + 1,
      }),
      writeManifest: async () => {
        writeManifestCalled = true;
      },
    })
  );
  const seed = makeArticle({ uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff', slug: 'pre-existing' });
  const store = makeStore([storeEntry(seed)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });

  await assert.rejects(
    () => run(loader, { store, meta }),
    new RegExp(`warm rows-read budget exceeded: ${WARM_ROWS_READ_BUDGET + 1} > ${WARM_ROWS_READ_BUDGET}$`)
  );

  assert.equal(store.keys().length, 1);
  assert.deepEqual(store.get(seed.uuid), storeEntry(seed));
  assert.ok(!writeManifestCalled);
  assert.equal(meta.get('stateVersion'), LOADER_STATE_VERSION);
  assert.equal(meta.get('lastCold'), String(NOW));
});

// ---------------------------------------------------------------------------
// Shrink-check failure — throws BEFORE any store mutation, manifest write or meta update
// ---------------------------------------------------------------------------

test('a failed shrink check throws, and the store/manifest/meta are untouched', async () => {
  const kept = makeArticle();
  const vanished = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let writeManifestCalled = false;
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [kept], nonPublic: [], rowsRead: 1 }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 2, ids: [kept.uuid, vanished] },
      }),
      writeManifest: async () => {
        writeManifestCalled = true;
      },
    })
  );
  const store = makeStore([storeEntry(kept)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });

  await assert.rejects(() => run(loader, { store, meta }), /never-shrink check failed/);

  assert.equal(store.keys().length, 1);
  assert.deepEqual(store.get(kept.uuid), storeEntry(kept));
  assert.ok(!writeManifestCalled);
});

// ---------------------------------------------------------------------------
// Category validation
// ---------------------------------------------------------------------------

test('an article with a category slug outside CATEGORIES throws naming the uuid and slug', async () => {
  const bad = makeArticle({ category: { slug: 'not-a-real-category', name: 'Bogus' } });
  const unrelated = makeArticle({ uuid: '77777777-7777-7777-7777-777777777777', slug: 'pre-existing-unrelated' });
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [bad], nonPublic: [], rowsRead: 1 }),
    })
  );
  const store = makeStore([storeEntry(unrelated)]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  await assert.rejects(
    () => run(loader, { store, meta }),
    new RegExp(`${bad.uuid}.*not-a-real-category|not-a-real-category.*${bad.uuid}`)
  );
});

// ---------------------------------------------------------------------------
// Manifest: bulk-write changed, bulk-delete removed, schema-version rewrite-all
// ---------------------------------------------------------------------------

test('manifest: changed entries are bulk-written as v2; removed uuids are bulk-deleted', async () => {
  const kept = makeArticle();
  const removed = makeArticle({ uuid: '11111111-1111-1111-1111-111111111111', slug: 'removed' });
  const writeManifestCalls = [];
  const deleteManifestCalls = [];
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({
        publicArticles: [kept],
        nonPublic: [{ uuid: removed.uuid, reason: 'duplicate' }],
        rowsRead: 2,
      }),
      readLastGood: async () => ({
        schemaVersion: '1',
        buildHash: 'x',
        recordedAt: 'x',
        articles: { count: 2, ids: [kept.uuid, removed.uuid] },
      }),
      writeManifest: async (entries) => writeManifestCalls.push(entries),
      deleteManifest: async (ids) => deleteManifestCalls.push(ids),
    })
  );
  const store = makeStore([storeEntry(removed)]); // kept is new; removed pre-exists
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW), manifestSchemaVersion: '2' });
  await run(loader, { store, meta });

  assert.equal(writeManifestCalls.length, 1);
  assert.equal(writeManifestCalls[0].length, 1);
  assert.equal(writeManifestCalls[0][0].articleId, kept.uuid);
  assert.equal(writeManifestCalls[0][0].schemaVersion, '2');

  assert.equal(deleteManifestCalls.length, 1);
  assert.deepEqual(deleteManifestCalls[0], [removed.uuid]);
});

test('manifest: a manifestSchemaVersion mismatch writes every FETCHED public entry on a WARM build, but leaves the meta key stale (04-followups WR-02)', async () => {
  const a = makeArticle();
  const b = makeArticle({ uuid: '22222222-2222-2222-2222-222222222222', slug: 'second-article' });
  const writeManifestCalls = [];
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [a, b], nonPublic: [], rowsRead: 2 }),
      writeManifest: async (entries) => writeManifestCalls.push(entries),
    })
  );
  // a is already in the store at its current digest (would NOT normally be reported as changed).
  const store = makeStore([storeEntry(a)]);
  const meta = makeMeta({
    stateVersion: LOADER_STATE_VERSION,
    lastCold: String(NOW),
    lastSweep: String(NOW),
    manifestSchemaVersion: '1', // stale — current is MANIFEST_SCHEMA_VERSION ('2')
  });
  await run(loader, { store, meta });

  assert.equal(writeManifestCalls.length, 1);
  assert.equal(writeManifestCalls[0].length, 2, 'both public entries fetched by this warm window must be written, not just the changed one');
  // WR-02 fix: a WARM build only ever sees its own sync window (here, exactly {a, b} via the
  // fetchWindow mock) — not the full public corpus — so clearing the stale flag here would wrongly
  // report every OTHER un-fetched article as migrated too. The flag must stay stale until a cold
  // pass has actually rewritten the entire corpus (see the next test).
  assert.equal(meta.get('manifestSchemaVersion'), '1', 'a warm build must NOT clear the stale schema-version flag');
});

test('manifest: a manifestSchemaVersion mismatch writes every public entry and clears the meta key ONLY on a COLD build (04-followups WR-02)', async () => {
  const a = makeArticle();
  const b = makeArticle({ uuid: '22222222-2222-2222-2222-222222222222', slug: 'second-article' });
  const writeManifestCalls = [];
  const loader = articlesLoader(
    baseDeps({
      env: { ARTICLES_FORCE_COLD: '1' },
      fetchAll: async () => ({ publicArticles: [a, b], nonPublic: [], rowsRead: 2, requestCount: 1 }),
      writeManifest: async (entries) => writeManifestCalls.push(entries),
    })
  );
  const store = makeStore([storeEntry(a)]);
  const meta = makeMeta({
    stateVersion: LOADER_STATE_VERSION,
    lastCold: String(NOW),
    lastSweep: String(NOW),
    manifestSchemaVersion: '1', // stale — current is MANIFEST_SCHEMA_VERSION ('2')
  });
  await run(loader, { store, meta });

  assert.equal(writeManifestCalls.length, 1);
  assert.equal(writeManifestCalls[0].length, 2, 'a cold build writes the full public corpus');
  assert.equal(meta.get('manifestSchemaVersion'), '2', 'a cold build (full-corpus fetch) is the one pass allowed to clear the stale flag');
});

// ---------------------------------------------------------------------------
// After success: writePendingBuildState + meta updates
// ---------------------------------------------------------------------------

test('after success: writePendingBuildState is called with the final store ids; meta lastSync/stateVersion updated', async () => {
  const article = makeArticle();
  let pendingCalls = [];
  const loader = articlesLoader(
    baseDeps({
      fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
      writePending: async (patch) => pendingCalls.push(patch),
    })
  );
  // Seed the store with an OLDER version of the same article (different digest) — a non-empty
  // store is required for warm mode, and using the same uuid keeps the expected final id set
  // exactly [article.uuid] rather than pulling in an unrelated id.
  const store = makeStore([storeEntry(makeArticle({ summary: 'a stale summary from a prior build' }))]);
  const meta = makeMeta({ stateVersion: LOADER_STATE_VERSION, lastCold: String(NOW), lastSweep: String(NOW) });
  const { meta: finalMeta } = await run(loader, { store, meta });

  assert.equal(pendingCalls.length, 1);
  assert.deepEqual(pendingCalls[0].articles.ids, [article.uuid]);
  assert.equal(pendingCalls[0].articles.count, 1);
  assert.equal(finalMeta.get('stateVersion'), LOADER_STATE_VERSION);
  assert.equal(finalMeta.get('lastSync'), String(NOW - 259_200));
});

test('after a cold build, meta.lastCold is updated to now', async () => {
  const article = makeArticle();
  const loader = articlesLoader(
    baseDeps({
      fetchAll: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1, requestCount: 1 }),
    })
  );
  const { meta } = await run(loader);
  assert.equal(meta.get('lastCold'), String(NOW));
});

// ---------------------------------------------------------------------------
// D-14 carried forward: an empty store after sync is always a failure
// ---------------------------------------------------------------------------

test('an empty result set throws (D-14: zero rows is always a failure)', async () => {
  const loader = articlesLoader(baseDeps({ env: { BUILD_STATE_BOOTSTRAP: '1' } }));
  await assert.rejects(() => run(loader));
});

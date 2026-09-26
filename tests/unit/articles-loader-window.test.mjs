#!/usr/bin/env node
// Task 2 (04-01-PLAN.md): pins articlesLoader()'s window-sync semantics — digest-based change
// detection, non-public removal, the D-14 empty-store fail-loud guarantee, and that manifest
// writes happen only for changed entries. Drives the real Loader against a minimal fake
// LoaderContext (Map-backed store/meta) and the `deps` test seams — no real D1/KV network access.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { articlesLoader, SYNC_WINDOW_SECONDS } from '../../src/content/loaders/articles-loader.ts';

function makeStore() {
  const map = new Map();
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
    delete: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    has: (key) => map.has(key),
    addModuleImport: () => {},
  };
}

function makeMeta() {
  const map = new Map();
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    has: (key) => map.has(key),
    delete: (key) => {
      map.delete(key);
    },
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

test('SYNC_WINDOW_SECONDS is 3 days', () => {
  assert.equal(SYNC_WINDOW_SECONDS, 259_200);
});

test('fetchWindow is called with since = now() - SYNC_WINDOW_SECONDS', async () => {
  let calledWith;
  const store = makeStore();
  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async (since) => {
      calledWith = since;
      return { publicArticles: [makeArticle()], nonPublic: [], rowsRead: 0 };
    },
    writeManifest: async () => {},
  });

  await loader.load({ store, meta: makeMeta(), parseData, generateDigest, logger: makeLogger() });

  assert.equal(calledWith, 2_000_000 - 259_200);
});

test('meta.lastSync is set to the sync window start, as a string', async () => {
  const store = makeStore();
  const meta = makeMeta();
  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async () => ({ publicArticles: [makeArticle()], nonPublic: [], rowsRead: 0 }),
    writeManifest: async () => {},
  });

  await loader.load({ store, meta, parseData, generateDigest, logger: makeLogger() });

  assert.equal(meta.get('lastSync'), String(2_000_000 - 259_200));
});

test('public rows are set with a digest', async () => {
  const article = makeArticle();
  const store = makeStore();
  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async () => ({ publicArticles: [article], nonPublic: [], rowsRead: 1 }),
    writeManifest: async () => {},
  });

  await loader.load({ store, meta: makeMeta(), parseData, generateDigest, logger: makeLogger() });

  const stored = store.get(article.uuid);
  assert.ok(stored, 'expected the public article to be stored');
  assert.equal(stored.digest, generateDigest(article));
});

test('a non-public uuid already in the store is deleted', async () => {
  const keptArticle = makeArticle({
    uuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    slug: 'kept-article',
  });
  const removedUuid = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  const store = makeStore();
  store.set({ id: removedUuid, data: makeArticle({ uuid: removedUuid }), digest: 'stale-digest' });

  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async () => ({
      publicArticles: [keptArticle],
      nonPublic: [{ uuid: removedUuid, reason: 'duplicate' }],
      rowsRead: 1,
    }),
    writeManifest: async () => {},
  });

  await loader.load({ store, meta: makeMeta(), parseData, generateDigest, logger: makeLogger() });

  assert.equal(store.has(removedUuid), false);
  assert.ok(store.has(keptArticle.uuid));
});

test('an empty store after sync throws with "store is empty"', async () => {
  const store = makeStore();
  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async () => ({ publicArticles: [], nonPublic: [], rowsRead: 0 }),
    writeManifest: async () => {},
  });

  await assert.rejects(
    () => loader.load({ store, meta: makeMeta(), parseData, generateDigest, logger: makeLogger() }),
    /store is empty/
  );
});

test('writeManifest is called only with changed entries, each schemaVersion "2" with slug', async () => {
  const unchangedArticle = makeArticle({
    uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    slug: 'unchanged-article',
  });
  const changedArticle = makeArticle({
    uuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    slug: 'changed-article',
  });

  const store = makeStore();
  // Pre-seed the store with the "unchanged" article at the exact digest it will compute to
  // again — store.set() must report no change (false), and it must not appear in the manifest
  // write.
  store.set({
    id: unchangedArticle.uuid,
    data: unchangedArticle,
    digest: generateDigest(unchangedArticle),
  });

  const writeManifestCalls = [];
  const loader = articlesLoader({
    now: () => 2_000_000,
    fetchWindow: async () => ({
      publicArticles: [unchangedArticle, changedArticle],
      nonPublic: [],
      rowsRead: 42,
    }),
    writeManifest: async (entries) => {
      writeManifestCalls.push(entries);
    },
  });

  await loader.load({ store, meta: makeMeta(), parseData, generateDigest, logger: makeLogger() });

  assert.equal(writeManifestCalls.length, 1);
  const entries = writeManifestCalls[0];
  assert.equal(entries.length, 1, 'only the changed article should be manifest-written');
  assert.equal(entries[0].articleId, changedArticle.uuid);
  assert.equal(entries[0].schemaVersion, '2');
  assert.equal(entries[0].slug, 'changed-article');
});

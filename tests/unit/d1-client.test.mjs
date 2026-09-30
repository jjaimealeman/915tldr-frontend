#!/usr/bin/env node
// Task 2 (04-01-PLAN.md): pins fetchPublicArticlesWindow's stitch rules, chunking discipline,
// rows-read accounting, and key_points parsing — every network call replaced by a stubbed
// fetchImpl, following tests/unit/manifest-schema.test.mjs's hermetic-env convention. No real D1
// access in this file.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchPublicArticlesWindow,
  chunkIds,
  D1_MAX_BOUND_PARAMS,
  queryD1WithMeta,
} from '../../src/lib/server/d1-client.ts';

const ENV_KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
const savedEnv = {};

before(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
  process.env.CLOUDFLARE_API_TOKEN = 'test-token';
});

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// Fixtures / stub helpers
// ---------------------------------------------------------------------------

function d1Response(results, rowsRead) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      result: [{ success: true, results, meta: { rows_read: rowsRead } }],
    }),
    text: async () => '',
  };
}

function d1ResponseNoMeta(results) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, result: [{ success: true, results }] }),
    text: async () => '',
  };
}

/** Sequential stub: `responses` is consumed in order, one per `fetchImpl` call. Records each
 * call's parsed request body on `.calls` so a test can assert param count/shape without
 * inspecting a real network call. */
function makeSequentialFetch(responses) {
  const calls = [];
  let i = 0;
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return next;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function articleRow(overrides = {}) {
  return {
    id: 1,
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    title: 'El Paso faces Level 3 flash flood risk',
    slug: 'el-paso-faces-level-3-flash-flood-risk',
    summary: 'Heavy rain is forecast through the weekend.',
    key_points: null,
    url: 'https://example.com/article',
    published_at: 1790099986,
    source_id: 1,
    status: 'processed',
    is_duplicate: 0,
    ...overrides,
  };
}

const CATEGORY_ROW = { article_id: 1, slug: 'weather', name: 'Weather' };
const SOURCE_ROW = { id: 1, slug: 'ktsm', name: 'KTSM', website_url: 'https://ktsm.com' };

// ---------------------------------------------------------------------------
// Stitch rules
// ---------------------------------------------------------------------------

test('a processed, non-duplicate row with a primary category is public', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow()], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);

  const result = await fetchPublicArticlesWindow(0, { fetchImpl });

  assert.equal(result.publicArticles.length, 1);
  assert.equal(result.nonPublic.length, 0);
  assert.equal(result.publicArticles[0].uuid, '201187fa-6484-4516-99d5-7e41da203323');
  assert.deepEqual(result.publicArticles[0].category, { slug: 'weather', name: 'Weather' });
  assert.deepEqual(result.publicArticles[0].source, {
    slug: 'ktsm',
    name: 'KTSM',
    websiteUrl: 'https://ktsm.com',
  });
});

test('is_duplicate 1 is nonPublic with reason "duplicate"', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow({ is_duplicate: 1 })], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);

  const result = await fetchPublicArticlesWindow(0, { fetchImpl });

  assert.equal(result.publicArticles.length, 0);
  assert.deepEqual(result.nonPublic, [
    { uuid: '201187fa-6484-4516-99d5-7e41da203323', reason: 'duplicate' },
  ]);
});

test('status "pending" is nonPublic with reason "not-processed"', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow({ status: 'pending' })], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);

  const result = await fetchPublicArticlesWindow(0, { fetchImpl });

  assert.equal(result.publicArticles.length, 0);
  assert.deepEqual(result.nonPublic, [
    { uuid: '201187fa-6484-4516-99d5-7e41da203323', reason: 'not-processed' },
  ]);
});

test('no primary category is nonPublic with reason "no-primary-category"', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow()], 1),
    d1Response([], 0), // no category row for this article
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);

  const result = await fetchPublicArticlesWindow(0, { fetchImpl });

  assert.equal(result.publicArticles.length, 0);
  assert.deepEqual(result.nonPublic, [
    { uuid: '201187fa-6484-4516-99d5-7e41da203323', reason: 'no-primary-category' },
  ]);
});

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

test('chunkIds splits at D1_MAX_BOUND_PARAMS (100) by default', () => {
  const ids = Array.from({ length: 250 }, (_, i) => i + 1);
  const chunks = chunkIds(ids);
  assert.equal(chunks.length, 3);
  assert.deepEqual(
    chunks.map((c) => c.length),
    [100, 100, 50]
  );
});

test('a window of 250 article ids issues category and tag statements whose params arrays each have length <= 100', async () => {
  const articleRows = Array.from({ length: 250 }, (_, i) =>
    articleRow({ id: i + 1, uuid: `uuid-${i + 1}` })
  );
  const responses = [
    d1Response(articleRows, 250),
    // 3 category chunks (100, 100, 50), 3 tag chunks (100, 100, 50), 1 sources query.
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
  ];
  const fetchImpl = makeSequentialFetch(responses);

  await fetchPublicArticlesWindow(0, { fetchImpl });

  const categoryChunkCalls = fetchImpl.calls.slice(1, 4);
  const tagChunkCalls = fetchImpl.calls.slice(4, 7);
  for (const call of [...categoryChunkCalls, ...tagChunkCalls]) {
    assert.ok(
      call.body.params.length <= D1_MAX_BOUND_PARAMS,
      `expected <= 100 params, got ${call.body.params.length}`
    );
  }
  assert.deepEqual(
    categoryChunkCalls.map((c) => c.body.params.length),
    [100, 100, 50]
  );
  assert.deepEqual(
    tagChunkCalls.map((c) => c.body.params.length),
    [100, 100, 50]
  );
});

// ---------------------------------------------------------------------------
// rowsRead accounting
// ---------------------------------------------------------------------------

test('rowsRead sums meta.rows_read across every statement', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow()], 10),
    d1Response([CATEGORY_ROW], 5),
    d1Response([], 3),
    d1Response([SOURCE_ROW], 2),
  ]);

  const result = await fetchPublicArticlesWindow(0, { fetchImpl });

  assert.equal(result.rowsRead, 20);
});

test('a response without meta.rows_read throws', async () => {
  const fetchImpl = makeSequentialFetch([d1ResponseNoMeta([articleRow()])]);

  await assert.rejects(() => fetchPublicArticlesWindow(0, { fetchImpl }), /rows_read/);
});

test('queryD1WithMeta throws when meta.rows_read is missing', async () => {
  const fetchImpl = makeSequentialFetch([d1ResponseNoMeta([])]);
  await assert.rejects(() => queryD1WithMeta('SELECT 1', [], { fetchImpl }), /rows_read/);
});

// ---------------------------------------------------------------------------
// key_points parsing
// ---------------------------------------------------------------------------

test('key_points \'["a","b"]\' parses to [\'a\', \'b\']', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow({ key_points: '["a","b"]' })], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);
  const result = await fetchPublicArticlesWindow(0, { fetchImpl });
  assert.deepEqual(result.publicArticles[0].keyPoints, ['a', 'b']);
});

test('key_points null stays null', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow({ key_points: null })], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);
  const result = await fetchPublicArticlesWindow(0, { fetchImpl });
  assert.equal(result.publicArticles[0].keyPoints, null);
});

test('malformed key_points JSON throws naming the uuid', async () => {
  const fetchImpl = makeSequentialFetch([
    d1Response([articleRow({ key_points: '{bad' })], 1),
    d1Response([CATEGORY_ROW], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ]);
  await assert.rejects(
    () => fetchPublicArticlesWindow(0, { fetchImpl }),
    /201187fa-6484-4516-99d5-7e41da203323/
  );
});

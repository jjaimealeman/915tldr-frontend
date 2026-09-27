#!/usr/bin/env node
// 04-03 Task 1 (RED, then made GREEN): pins the cold-path D1 fetchers — fetchAllArticlesStitched
// (keyset pagination, LIMIT 5000, tags keyset over (article_id, tag_id)), fetchArticlesStitchedByIds
// (chunked IN-list over all three tables) and fetchChangedSince — plus stitchArticles reuse. Every
// network call is a stubbed fetchImpl, following tests/unit/d1-client.test.mjs's convention.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAllArticlesStitched,
  fetchArticlesStitchedByIds,
  fetchChangedSince,
  stitchArticles,
  D1_MAX_BOUND_PARAMS,
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

function d1Response(results, rowsRead) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, result: [{ success: true, results, meta: { rows_read: rowsRead } }] }),
    text: async () => '',
  };
}

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

const SOURCE_ROW = { id: 1, slug: 'ktsm', name: 'KTSM', website_url: 'https://ktsm.com' };

// ---------------------------------------------------------------------------
// stitchArticles — shared by every fetcher
// ---------------------------------------------------------------------------

test('stitchArticles: a processed non-duplicate row with a resolved category is public', () => {
  const { publicArticles, nonPublic } = stitchArticles(
    [articleRow()],
    [{ article_id: 1, slug: 'weather', name: 'Weather' }],
    [],
    [SOURCE_ROW]
  );
  assert.equal(publicArticles.length, 1);
  assert.equal(nonPublic.length, 0);
  assert.deepEqual(publicArticles[0].category, { slug: 'weather', name: 'Weather' });
});

test('stitchArticles: a NULL summary is nonPublic with reason missing-summary (Rule 1/2 fix — real production data)', () => {
  const { publicArticles, nonPublic } = stitchArticles(
    [articleRow({ summary: null })],
    [{ article_id: 1, slug: 'weather', name: 'Weather' }],
    [],
    [SOURCE_ROW]
  );
  assert.equal(publicArticles.length, 0);
  assert.deepEqual(nonPublic, [{ uuid: articleRow().uuid, reason: 'missing-summary' }]);
});

test('stitchArticles: an empty-string summary is also nonPublic with reason missing-summary', () => {
  const { publicArticles, nonPublic } = stitchArticles(
    [articleRow({ summary: '   ' })],
    [{ article_id: 1, slug: 'weather', name: 'Weather' }],
    [],
    [SOURCE_ROW]
  );
  assert.equal(publicArticles.length, 0);
  assert.deepEqual(nonPublic, [{ uuid: articleRow().uuid, reason: 'missing-summary' }]);
});

test('stitchArticles: non-processed row is nonPublic (explained removal candidate)', () => {
  const { publicArticles, nonPublic } = stitchArticles(
    [articleRow({ status: 'pending' })],
    [{ article_id: 1, slug: 'weather', name: 'Weather' }],
    [],
    [SOURCE_ROW]
  );
  assert.equal(publicArticles.length, 0);
  assert.deepEqual(nonPublic, [{ uuid: articleRow().uuid, reason: 'not-processed' }]);
});

// ---------------------------------------------------------------------------
// fetchAllArticlesStitched — keyset pagination
// ---------------------------------------------------------------------------

test('fetchAllArticlesStitched: pages articles by id with LIMIT 5000 until a short page', async () => {
  const fullPage = Array.from({ length: 5000 }, (_, i) => articleRow({ id: i + 1, uuid: `uuid-${i + 1}` }));
  const shortPage = [articleRow({ id: 5001, uuid: 'uuid-5001' })];

  const responses = [
    d1Response(fullPage, 5000), // articles page 1 (full — must page again)
    d1Response(shortPage, 1), // articles page 2 (short — stop)
    d1Response([], 0), // categories page 1 (short — stop)
    d1Response([], 0), // tags page 1 (short — stop)
    d1Response([SOURCE_ROW], 1), // sources
  ];
  const fetchImpl = makeSequentialFetch(responses);

  const result = await fetchAllArticlesStitched({ fetchImpl });

  // 2 article pages + 1 category page + 1 tag page + 1 sources query = 5 requests
  assert.equal(fetchImpl.calls.length, 5);
  // Second article page must cursor from the last id of the first page (5000).
  assert.equal(fetchImpl.calls[1].body.params[0], 5000);
  assert.equal(result.rowsRead, 5000 + 1 + 0 + 0 + 1);
  assert.equal(result.publicArticles.length + result.nonPublic.length, 5001);
});

test('fetchAllArticlesStitched: tags keyset pagination uses the (article_id, tag_id) tuple', async () => {
  const responses = [
    d1Response([articleRow()], 1), // articles (short page)
    d1Response([{ article_id: 1, slug: 'weather', name: 'Weather' }], 1), // categories (short page)
    d1Response([{ article_id: 1, tag_id: 7, slug: 'flooding', name: 'Flooding' }], 1), // tags (short page)
    d1Response([SOURCE_ROW], 1), // sources
  ];
  const fetchImpl = makeSequentialFetch(responses);

  await fetchAllArticlesStitched({ fetchImpl });

  const tagsCall = fetchImpl.calls[2];
  assert.match(tagsCall.body.sql, /\(atg\.article_id,\s*atg\.tag_id\)/);
  assert.deepEqual(tagsCall.body.params, [0, 0]);
});

test('fetchAllArticlesStitched: every issued statement binds at most 100 parameters', async () => {
  const responses = [
    d1Response([articleRow()], 1),
    d1Response([], 0),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ];
  const fetchImpl = makeSequentialFetch(responses);

  await fetchAllArticlesStitched({ fetchImpl });

  for (const call of fetchImpl.calls) {
    assert.ok(call.body.params.length <= D1_MAX_BOUND_PARAMS);
  }
});

test('fetchAllArticlesStitched: reuses the same stitch rules as the window fetch (duplicate excluded)', async () => {
  const responses = [
    d1Response([articleRow({ is_duplicate: 1 })], 1),
    d1Response([{ article_id: 1, slug: 'weather', name: 'Weather' }], 1),
    d1Response([], 0),
    d1Response([SOURCE_ROW], 1),
  ];
  const fetchImpl = makeSequentialFetch(responses);

  const result = await fetchAllArticlesStitched({ fetchImpl });

  assert.equal(result.publicArticles.length, 0);
  assert.deepEqual(result.nonPublic, [{ uuid: articleRow().uuid, reason: 'duplicate' }]);
});

// ---------------------------------------------------------------------------
// fetchArticlesStitchedByIds — chunked IN over all three tables
// ---------------------------------------------------------------------------

test('fetchArticlesStitchedByIds: chunks a 250-id request at D1_MAX_BOUND_PARAMS for all three tables', async () => {
  const ids = Array.from({ length: 250 }, (_, i) => i + 1);
  const responses = [
    // articles: 3 chunks (100, 100, 50)
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    // categories: 3 chunks
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    // tags: 3 chunks
    d1Response([], 0),
    d1Response([], 0),
    d1Response([], 0),
    // sources
    d1Response([SOURCE_ROW], 1),
  ];
  const fetchImpl = makeSequentialFetch(responses);

  await fetchArticlesStitchedByIds(ids, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 10);
  for (const call of fetchImpl.calls) {
    assert.ok(call.body.params.length <= D1_MAX_BOUND_PARAMS, `expected <= 100 params, got ${call.body.params.length}`);
  }
});

test('fetchArticlesStitchedByIds: returns publicArticles/nonPublic/rowsRead summed across all calls', async () => {
  const responses = [
    d1Response([articleRow()], 10),
    d1Response([{ article_id: 1, slug: 'weather', name: 'Weather' }], 5),
    d1Response([], 3),
    d1Response([SOURCE_ROW], 2),
  ];
  const fetchImpl = makeSequentialFetch(responses);

  const result = await fetchArticlesStitchedByIds([1], { fetchImpl });

  assert.equal(result.publicArticles.length, 1);
  assert.equal(result.rowsRead, 20);
});

// ---------------------------------------------------------------------------
// fetchChangedSince — one statement, updated_at OR processed_at
// ---------------------------------------------------------------------------

test('fetchChangedSince returns internal ids from one statement selecting on updated_at OR processed_at', async () => {
  const fetchImpl = makeSequentialFetch([d1Response([{ id: 5 }, { id: 9 }], 2)]);

  const result = await fetchChangedSince(1_000, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  assert.match(fetchImpl.calls[0].body.sql, /updated_at\s*>\s*\?/);
  assert.match(fetchImpl.calls[0].body.sql, /processed_at\s*>\s*\?/);
  assert.deepEqual(result.ids, [5, 9]);
  assert.equal(result.rowsRead, 2);
});

#!/usr/bin/env node
// 06-06 Task 1: pins `fetchTranslationsAll`'s keyset pagination (cursor on `t.article_id`, LIMIT
// 5000 pages) and `fetchTranslationsChangedSince`'s single bound-parameter query — every network
// call replaced by a stubbed `fetchImpl`, following tests/unit/d1-client.test.mjs's hermetic-env
// convention. No real D1 access in this file.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTranslationsAll,
  fetchTranslationsChangedSince,
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
    json: async () => ({
      success: true,
      result: [{ success: true, results, meta: { rows_read: rowsRead } }],
    }),
    text: async () => '',
  };
}

/** Sequential stub: `responses` is consumed in order, one per `fetchImpl` call. Records each
 * call's parsed request body on `.calls` so a test can assert the bound-parameter shape. */
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

function translationCursorRow(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    article_id: 1,
    source_language: 'en',
    title: 'El Paso enfrenta riesgo de inundación',
    summary: 'Se pronostican fuertes lluvias durante el fin de semana.',
    key_points: null,
    grounding_status: 'clean',
    updated_at: 1790099986,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fetchTranslationsAll
// ---------------------------------------------------------------------------

test('fetchTranslationsAll: a single short page (< 5000) returns all rows and stops after one request', async () => {
  const row = translationCursorRow();
  const fetchImpl = makeSequentialFetch([d1Response([row], 1)]);

  const result = await fetchTranslationsAll({ fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(result.rowsRead, 1);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.rows[0], {
    uuid: row.uuid,
    source_language: row.source_language,
    title: row.title,
    summary: row.summary,
    key_points: row.key_points,
    grounding_status: row.grounding_status,
    updated_at: row.updated_at,
  });
  // `article_id` is the internal keyset cursor column — never leaked to the public TranslationRow.
  assert.equal('article_id' in result.rows[0], false);
});

test('fetchTranslationsAll: binds language = es as a literal, and article_id > cursor as the only bound param', async () => {
  const fetchImpl = makeSequentialFetch([d1Response([translationCursorRow()], 1)]);

  await fetchTranslationsAll({ fetchImpl });

  const { body } = fetchImpl.calls[0];
  assert.match(body.sql, /t\.language = 'es'/);
  assert.match(body.sql, /t\.article_id > \?/);
  assert.deepEqual(body.params, [0]);
});

test('fetchTranslationsAll: a full page (exactly 5000) triggers a second page using the last row\'s article_id as the next cursor', async () => {
  const page1 = Array.from({ length: 5000 }, (_, i) =>
    translationCursorRow({
      uuid: `201187fa-6484-4516-99d5-7e41da${String(i).padStart(6, '0')}`,
      article_id: i + 1,
    })
  );
  const page2 = [translationCursorRow({ uuid: '301187fa-6484-4516-99d5-7e41da203999', article_id: 5001 })];

  const fetchImpl = makeSequentialFetch([d1Response(page1, 5000), d1Response(page2, 1)]);

  const result = await fetchTranslationsAll({ fetchImpl });

  assert.equal(fetchImpl.calls.length, 2); // page1 (full, 5000), page2 (1 row, < 5000, stops)
  assert.equal(fetchImpl.calls[1].body.params[0], 5000);
  assert.equal(result.rows.length, 5001);
  assert.equal(result.rowsRead, 5001);
});

test('fetchTranslationsAll: zero rows on the first page returns an empty result with rowsRead accounted', async () => {
  const fetchImpl = makeSequentialFetch([d1Response([], 0)]);

  const result = await fetchTranslationsAll({ fetchImpl });

  assert.deepEqual(result.rows, []);
  assert.equal(result.rowsRead, 0);
  assert.equal(fetchImpl.calls.length, 1);
});

// ---------------------------------------------------------------------------
// fetchTranslationsChangedSince
// ---------------------------------------------------------------------------

test('fetchTranslationsChangedSince: binds exactly one parameter (sinceEpoch) against updated_at >= ?', async () => {
  const row = translationCursorRow();
  const fetchImpl = makeSequentialFetch([d1Response([row], 1)]);

  const result = await fetchTranslationsChangedSince(1_700_000_000, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  const { body } = fetchImpl.calls[0];
  assert.match(body.sql, /t\.language = 'es' AND t\.updated_at >= \?/);
  assert.deepEqual(body.params, [1_700_000_000]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rowsRead, 1);
});

test('fetchTranslationsChangedSince: returns every row in one unpaginated response (no second request issued)', async () => {
  const rows = Array.from({ length: 50 }, (_, i) =>
    translationCursorRow({ uuid: `201187fa-6484-4516-99d5-7e41da${String(i).padStart(6, '0')}`, article_id: i + 1 })
  );
  const fetchImpl = makeSequentialFetch([d1Response(rows, 50)]);

  const result = await fetchTranslationsChangedSince(0, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(result.rows.length, 50);
  assert.equal(result.rowsRead, 50);
});

test('fetchTranslationsChangedSince: a row with a null title/summary (held translation) passes through untouched', async () => {
  const row = translationCursorRow({ title: null, summary: null, grounding_status: 'held' });
  const fetchImpl = makeSequentialFetch([d1Response([row], 1)]);

  const result = await fetchTranslationsChangedSince(0, { fetchImpl });

  assert.equal(result.rows[0].title, null);
  assert.equal(result.rows[0].summary, null);
  assert.equal(result.rows[0].grounding_status, 'held');
});

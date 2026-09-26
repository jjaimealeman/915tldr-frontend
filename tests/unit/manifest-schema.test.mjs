#!/usr/bin/env node
// 03-04 Task 2: schema completeness, hash stability, writer-rejection, and bulk-batching
// assertions for src/lib/server/kv-manifest.ts (moved here in the T-03-02a security
// remediation — see docs/phase-03/render-manifest.md's "Guard enforcement" section). Follows
// the `node:test` structure of
// design/tests/unit/summary-markdown.test.mjs — plain `test()` blocks, no spawning.
//
// Every real network call is replaced with a stubbed `fetchImpl` passed via each function's
// `opts` parameter (see kv-manifest.ts) — this suite never touches the real KV namespace. Env
// vars used to build request URLs are set to hermetic dummy values for the duration of this
// file and restored afterward, so the suite does not depend on real Cloudflare credentials being
// present in whatever environment runs it (CI included).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANIFEST_SCHEMA_VERSION,
  KV_BULK_WRITE_MAX_PAIRS,
  buildManifestEntry,
  computeContentHash,
  validateManifestEntry,
  putManifestEntry,
  putManifestEntriesBulk,
  getManifestEntry,
} from '../../src/lib/server/kv-manifest.ts';

// ---------------------------------------------------------------------------
// Hermetic env — dummy values, restored after this file's tests run.
// ---------------------------------------------------------------------------

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
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides = {}) {
  return {
    id: '201187fa-6484-4516-99d5-7e41da203323',
    title: 'El Paso faces Level 3 flash flood risk',
    summary: 'Heavy rain is forecast through the weekend.',
    category: 'weather',
    published_at: 1790099986,
    tags: 'flooding,weather,el-paso',
    ...overrides,
  };
}

async function makeEntry(rowOverrides = {}, entryOverrides = {}) {
  const entry = await buildManifestEntry(makeRow(rowOverrides), { buildHash: 'abc1234' });
  return { ...entry, ...entryOverrides };
}

/** A minimal fetch-shaped stub. `responses` is consumed in order; each call records its
 * (url, init) pair on `.calls` so a test can assert request count/shape without inspecting a
 * real network call. */
function makeStubFetch(responses = []) {
  const calls = [];
  let i = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)] ?? { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    i += 1;
    return next;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function okResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function notFoundResponse() {
  return { ok: false, status: 404, json: async () => { throw new Error('no body'); }, text: async () => 'not found' };
}

function malformedJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token in JSON');
    },
    text: async () => 'not json',
  };
}

// ---------------------------------------------------------------------------
// buildManifestEntry: every D-04 category present, translation identity per Option C
// ---------------------------------------------------------------------------

test('buildManifestEntry returns all required fields, non-empty, with translationGroupId equal to articleId and language "en"', async () => {
  const entry = await buildManifestEntry(makeRow(), { buildHash: 'abc1234' });

  for (const field of [
    'articleId',
    'translationGroupId',
    'language',
    'contentHash',
    'schemaVersion',
    'renderedAt',
    'buildHash',
    'category',
    'publishedAt',
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(entry, field), `missing field "${field}"`);
  }

  // The prohibited outcome (03-04-PLAN.md): a field that is structurally always null. Assert the
  // VALUE, not merely that the key is present.
  assert.equal(entry.translationGroupId, '201187fa-6484-4516-99d5-7e41da203323');
  assert.notEqual(entry.translationGroupId, null);
  assert.equal(entry.language, 'en');
  assert.equal(entry.schemaVersion, MANIFEST_SCHEMA_VERSION);
});

test('buildManifestEntry accepts an explicit language override (forward-compatible with Phase 6 "es" entries)', async () => {
  const entry = await buildManifestEntry(makeRow(), { buildHash: 'abc1234', language: 'es' });
  assert.equal(entry.language, 'es');
  // Even for a hypothetical Spanish entry, translationGroupId is never null.
  assert.equal(entry.translationGroupId, '201187fa-6484-4516-99d5-7e41da203323');
});

// ---------------------------------------------------------------------------
// contentHash: stable, order-independent, and scoped to exactly title/summary/tags
// ---------------------------------------------------------------------------

test('two calls with the same source row produce the same contentHash', async () => {
  const a = await computeContentHash(makeRow());
  const b = await computeContentHash(makeRow());
  assert.equal(a, b);
});

test('changing title changes contentHash', async () => {
  const base = await computeContentHash(makeRow());
  const changed = await computeContentHash(makeRow({ title: 'A different headline' }));
  assert.notEqual(base, changed);
});

test('changing summary changes contentHash', async () => {
  const base = await computeContentHash(makeRow());
  const changed = await computeContentHash(makeRow({ summary: 'A different summary.' }));
  assert.notEqual(base, changed);
});

test('changing tags changes contentHash', async () => {
  const base = await computeContentHash(makeRow());
  const changed = await computeContentHash(makeRow({ tags: 'flooding,weather' }));
  assert.notEqual(base, changed);
});

test('changing a field outside title/summary/tags (status) does not change contentHash', async () => {
  const base = await computeContentHash(makeRow());
  // computeContentHash only ever sees title/summary/tags, so a row carrying an extra `status`
  // field (as the real SourceArticleRow union with ArticleRow does) cannot affect the hash.
  const changed = await computeContentHash({ ...makeRow(), status: 'processed-but-different' });
  assert.equal(base, changed);
});

test('tag order does not change contentHash (order-independent serialisation)', async () => {
  const a = await computeContentHash(makeRow({ tags: 'weather,flooding,el-paso' }));
  const b = await computeContentHash(makeRow({ tags: 'el-paso,flooding,weather' }));
  assert.equal(a, b);
});

test('null tags and empty-string tags normalize identically (GROUP_CONCAT returns null for zero tags)', async () => {
  const a = await computeContentHash(makeRow({ tags: null }));
  const b = await computeContentHash(makeRow({ tags: '' }));
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// putManifestEntry: validation before any network call
// ---------------------------------------------------------------------------

test('putManifestEntry rejects an entry missing a required field, before any network call', async () => {
  const entry = await makeEntry();
  delete entry.category;
  const fetchImpl = makeStubFetch();

  await assert.rejects(() => putManifestEntry(entry, { fetchImpl }), /missing or empty required field "category"/);
  assert.equal(fetchImpl.calls.length, 0, 'no network call should have been made');
});

test('putManifestEntry rejects an entry whose contentHash is not 64 hex characters', async () => {
  const entry = await makeEntry({}, { contentHash: 'not-a-real-hash' });
  const fetchImpl = makeStubFetch();

  await assert.rejects(() => putManifestEntry(entry, { fetchImpl }), /contentHash.*64 hex characters/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('putManifestEntry rejects an entry whose publishedAt is not a number', async () => {
  const entry = await makeEntry({}, { publishedAt: '1790099986' });
  const fetchImpl = makeStubFetch();

  await assert.rejects(() => putManifestEntry(entry, { fetchImpl }), /publishedAt.*must be a number/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('putManifestEntry rejects an entry whose language is not "en" or "es"', async () => {
  const entry = await makeEntry({}, { language: 'fr' });
  const fetchImpl = makeStubFetch();

  await assert.rejects(() => putManifestEntry(entry, { fetchImpl }), /language.*"en" or "es"/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('putManifestEntry writes a valid entry exactly once, with no expiration/TTL in the request body', async () => {
  const entry = await makeEntry();
  const fetchImpl = makeStubFetch([okResponse({})]);

  await putManifestEntry(entry, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 1);
  const body = JSON.parse(fetchImpl.calls[0].init.body);
  assert.ok(!('expiration' in body) && !('expiration_ttl' in body), 'TTL on a manifest write');
});

// ---------------------------------------------------------------------------
// putManifestEntriesBulk: batching, empty input, whole-batch validation
// ---------------------------------------------------------------------------

test('putManifestEntriesBulk([]) issues zero requests and does not throw', async () => {
  const fetchImpl = makeStubFetch();
  await putManifestEntriesBulk([], { fetchImpl });
  assert.equal(fetchImpl.calls.length, 0);
});

test('putManifestEntriesBulk splits 25,000 entries into exactly 3 requests', async () => {
  const entries = [];
  for (let i = 0; i < 25_000; i += 1) {
    entries.push(await makeEntry({ id: `uuid-${i}` }));
  }
  const fetchImpl = makeStubFetch([okResponse({})]);

  await putManifestEntriesBulk(entries, { fetchImpl });

  assert.equal(fetchImpl.calls.length, 3, `expected 3 requests, got ${fetchImpl.calls.length}`);
  const sizes = fetchImpl.calls.map((c) => JSON.parse(c.init.body).length);
  assert.deepEqual(sizes, [KV_BULK_WRITE_MAX_PAIRS, KV_BULK_WRITE_MAX_PAIRS, 5_000]);
});

test('putManifestEntriesBulk validates every entry before issuing any request', async () => {
  const good = await makeEntry({ id: 'good-1' });
  const bad = await makeEntry({ id: 'bad-1' }, { publishedAt: 'not-a-number' });
  const fetchImpl = makeStubFetch();

  await assert.rejects(() => putManifestEntriesBulk([good, bad], { fetchImpl }));
  assert.equal(fetchImpl.calls.length, 0, 'no batch should be written if any entry in it is invalid');
});

test('putManifestEntriesBulk request bodies carry no expiration/TTL', async () => {
  const entries = [await makeEntry({ id: 'a' }), await makeEntry({ id: 'b' })];
  const fetchImpl = makeStubFetch([okResponse({})]);

  await putManifestEntriesBulk(entries, { fetchImpl });

  const body = JSON.parse(fetchImpl.calls[0].init.body);
  for (const item of body) {
    assert.ok(!('expiration' in item) && !('expiration_ttl' in item));
  }
});

// ---------------------------------------------------------------------------
// getManifestEntry: absent vs. present vs. malformed are three distinct outcomes
// ---------------------------------------------------------------------------

test('getManifestEntry returns null for an absent key (404)', async () => {
  const fetchImpl = makeStubFetch([notFoundResponse()]);
  const result = await getManifestEntry('does-not-exist', { fetchImpl });
  assert.equal(result, null);
});

test('getManifestEntry returns a parsed entry for a present key', async () => {
  const entry = await makeEntry();
  const fetchImpl = makeStubFetch([okResponse(entry)]);
  const result = await getManifestEntry(entry.articleId, { fetchImpl });
  assert.deepEqual(result, entry);
});

test('getManifestEntry throws for a malformed stored value, rather than returning null', async () => {
  const fetchImpl = makeStubFetch([malformedJsonResponse()]);
  await assert.rejects(() => getManifestEntry('some-id', { fetchImpl }));
});

// ---------------------------------------------------------------------------
// MANIFEST_SCHEMA_VERSION
// ---------------------------------------------------------------------------

test('MANIFEST_SCHEMA_VERSION is exported and every built entry records it', async () => {
  assert.equal(typeof MANIFEST_SCHEMA_VERSION, 'string');
  assert.ok(MANIFEST_SCHEMA_VERSION.length > 0);
  const entry = await buildManifestEntry(makeRow(), { buildHash: 'abc1234' });
  assert.equal(entry.schemaVersion, MANIFEST_SCHEMA_VERSION);
});

// ---------------------------------------------------------------------------
// validateManifestEntry is directly exported and usable standalone
// ---------------------------------------------------------------------------

test('validateManifestEntry accepts a well-formed entry without throwing', async () => {
  const entry = await makeEntry();
  assert.doesNotThrow(() => validateManifestEntry(entry));
});

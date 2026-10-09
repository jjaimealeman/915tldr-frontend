// 07-05 Task 3 (SOC-08 / D-20): unit tests for tools/measure-share-fetches.mjs. The Cloudflare
// GraphQL API is faked through an injected fetchImpl, the way tests/unit/derive-hot-window.test.mjs
// does it; this suite never touches the network and never needs a real token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareFetchQuery,
  summariseShareFetches,
  verifyShareFetchSchema,
  fetchShareGroups,
  SHARE_SCHEMA_TYPES,
} from '../../tools/measure-share-fetches.mjs';
import { ZONE_TAG_915TLDR } from '../../tools/derive-hot-window.mjs';

const SINCE = '2026-10-08T12:00:00Z';
const UNTIL = '2026-10-08T13:00:00Z';
const PATHS = ['/og-image.png', '/og-image-es.png'];

test('buildShareFetchQuery carries the host, paths and window in variables, never in the query text', () => {
  const { query, variables } = buildShareFetchQuery({ host: 'dev.915tldr.com', paths: PATHS, since: SINCE, until: UNTIL });
  assert.equal(variables.zoneTag, ZONE_TAG_915TLDR);
  assert.equal(variables.filter.datetime_geq, '2026-10-08T12:00:00.000Z');
  assert.equal(variables.filter.datetime_lt, '2026-10-08T13:00:00.000Z');
  assert.equal(variables.filter.clientRequestHTTPHost, 'dev.915tldr.com');
  assert.deepEqual(variables.filter.clientRequestPath_in, PATHS);
  assert.match(query, /httpRequestsAdaptiveGroups/);
  assert.match(query, /\bcount\b/);
  assert.match(query, /sum\s*\{\s*edgeResponseBytes\s*\}/);
  for (const dim of ['clientRequestPath', 'userAgent', 'edgeResponseStatus']) assert.match(query, new RegExp(dim));
  assert.ok(!query.includes('dev.915tldr.com'), 'host must not be concatenated into the query');
  assert.ok(!query.includes('og-image'), 'paths must not be concatenated into the query');
  assert.doesNotMatch(query, /mutation/i);
});

test('buildShareFetchQuery validates its arguments', () => {
  const ok = { host: 'dev.915tldr.com', paths: PATHS, since: SINCE, until: UNTIL };
  assert.throws(() => buildShareFetchQuery({ ...ok, since: undefined }), /since is required/);
  assert.throws(() => buildShareFetchQuery({ ...ok, since: 'not a date' }), /since/);
  assert.throws(() => buildShareFetchQuery({ ...ok, until: 'nope' }), /until/);
  assert.throws(() => buildShareFetchQuery({ ...ok, since: UNTIL, until: SINCE }), /before/);
  assert.throws(() => buildShareFetchQuery({ ...ok, host: 'Dev Host; drop' }), /host/);
  assert.throws(() => buildShareFetchQuery({ ...ok, host: 'a/b' }), /host/);
  assert.throws(() => buildShareFetchQuery({ ...ok, paths: ['og-image.png'] }), /path/);
  assert.throws(() => buildShareFetchQuery({ ...ok, paths: [] }), /path/);
});

test('buildShareFetchQuery defaults until to now', () => {
  const now = new Date('2026-10-08T14:00:00Z');
  const { variables } = buildShareFetchQuery({ host: 'dev.915tldr.com', paths: PATHS, since: SINCE, now });
  assert.equal(variables.filter.datetime_lt, '2026-10-08T14:00:00.000Z');
});

const WHATSAPP_UA = 'WhatsApp/2.23.20.0';
const GROUPS = [
  { count: 3, sum: { edgeResponseBytes: 124617 }, dimensions: { clientRequestPath: '/og-image.png', userAgent: WHATSAPP_UA, edgeResponseStatus: 200 } },
  { count: 1, sum: { edgeResponseBytes: 0 }, dimensions: { clientRequestPath: '/og-image.png', userAgent: WHATSAPP_UA, edgeResponseStatus: 304 } },
  { count: 5, sum: { edgeResponseBytes: 207695 }, dimensions: { clientRequestPath: '/og-image.png', userAgent: 'facebookexternalhit/1.1', edgeResponseStatus: 200 } },
  { count: 2, sum: { edgeResponseBytes: 85048 }, dimensions: { clientRequestPath: '/og-image-es.png', userAgent: 'Twitterbot/1.0', edgeResponseStatus: 200 } },
];

test('summariseShareFetches gives one row per path, user agent and status, with bytes per request and file size', () => {
  const rows = summariseShareFetches(GROUPS, { '/og-image.png': 41539, '/og-image-es.png': 42524 });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => [r.path, r.count]), [
    ['/og-image-es.png', 2],
    ['/og-image.png', 5],
    ['/og-image.png', 3],
    ['/og-image.png', 1],
  ]);
  const wa = rows.find((r) => r.userAgent === WHATSAPP_UA && r.status === 200);
  assert.equal(wa.totalBytes, 124617);
  assert.equal(wa.bytesPerRequest, 124617 / 3);
  assert.equal(wa.fileBytes, 41539);
  const notModified = rows.find((r) => r.status === 304);
  assert.equal(notModified.bytesPerRequest, 0);
});

test('summariseShareFetches keeps raw user agents and reports fileBytes null for an unknown path', () => {
  const rows = summariseShareFetches(GROUPS, {});
  assert.ok(rows.some((r) => r.userAgent === WHATSAPP_UA));
  assert.ok(rows.every((r) => r.fileBytes === null));
  assert.deepEqual(summariseShareFetches([], {}), []);
});

const FIELDS = {
  [SHARE_SCHEMA_TYPES.group]: ['count', 'dimensions', 'sum'],
  [SHARE_SCHEMA_TYPES.sum]: ['edgeResponseBytes'],
  [SHARE_SCHEMA_TYPES.dimensions]: ['clientRequestPath', 'userAgent', 'edgeResponseStatus'],
  [SHARE_SCHEMA_TYPES.filter]: ['datetime_geq', 'datetime_lt', 'clientRequestHTTPHost', 'clientRequestPath_in'],
};

test('verifyShareFetchSchema resolves when every required field exists', async () => {
  await verifyShareFetchSchema(async (name) => FIELDS[name]);
});

test('verifyShareFetchSchema rejects naming the first missing field', async () => {
  const missing = { ...FIELDS, [SHARE_SCHEMA_TYPES.sum]: [] };
  await assert.rejects(verifyShareFetchSchema(async (name) => missing[name]), /edgeResponseBytes/);
  const noFilter = { ...FIELDS, [SHARE_SCHEMA_TYPES.filter]: ['datetime_geq', 'datetime_lt', 'clientRequestHTTPHost'] };
  await assert.rejects(verifyShareFetchSchema(async (name) => noFilter[name]), /clientRequestPath_in/);
});

function graphqlFetch(body, { ok = true, status = 200 } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

test('fetchShareGroups posts the query with the bearer token and returns the groups', async () => {
  const fetchImpl = graphqlFetch({ data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: GROUPS }] } } });
  const built = buildShareFetchQuery({ host: 'dev.915tldr.com', paths: PATHS, since: SINCE, until: UNTIL });
  const groups = await fetchShareGroups(built, { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'test-token-not-real' } });
  assert.equal(groups.length, 4);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, 'Bearer test-token-not-real');
  const sent = JSON.parse(fetchImpl.calls[0].init.body);
  assert.deepEqual(sent.variables.filter.clientRequestPath_in, PATHS);
});

test('a GraphQL error surfaces as a thrown, redacted error and never contains the token', async () => {
  const token = 'abcdefghijklmnopqrstuvwxyz0123456789ABCD'; // 40 chars, token shaped
  const fetchImpl = graphqlFetch({ errors: [{ message: `zone is not authorized (token ${token})` }] });
  const built = buildShareFetchQuery({ host: 'dev.915tldr.com', paths: PATHS, since: SINCE, until: UNTIL });
  await assert.rejects(
    fetchShareGroups(built, { fetchImpl, env: { CLOUDFLARE_API_TOKEN: token } }),
    (err) => {
      assert.match(err.message, /not authorized/);
      assert.ok(!err.message.includes(token), err.message);
      return true;
    }
  );
});

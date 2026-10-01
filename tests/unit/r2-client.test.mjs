#!/usr/bin/env node
// Task 4 (05-02-PLAN.md): pins r2-client.ts's key discipline (assertArchiveKey's accept/reject
// matrix), its 1,000-key deleteObjects batching, and its secret-hygiene guarantee (an error built
// from the SDK error's name/Code/httpStatusCode only, never err.message). The fake client is a
// plain object whose `send(command)` records `command.constructor.name` and `command.input` and
// returns/rejects per test — mirrors `tests/unit/d1-client.test.mjs`'s own fetchImpl-stub style,
// applied to this module's `client.send()` seam instead of `fetch`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHIVE_BUCKET_NAME,
  R2_CREDENTIAL_ENV_KEYS,
  hasR2Credentials,
  assertArchiveKey,
  createArchiveStore,
} from '../../src/lib/server/r2-client.ts';

const ENV_KEYS = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const savedEnv = {};

before(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
  process.env.R2_ACCESS_KEY_ID = 'test-access-key-id';
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-access-key';
});

after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** Records every `send()` call (`{ name, input }`) and resolves/rejects per `responses`, consumed
 * in order — mirrors `tests/unit/d1-client.test.mjs`'s `makeSequentialFetch` shape, applied to
 * this module's `client.send()` seam. A response entry may be a plain value (resolve) or
 * `{ reject: err }` (reject). */
function makeFakeClient(responses) {
  const calls = [];
  let i = 0;
  const client = {
    async send(command) {
      calls.push({ name: command.constructor.name, input: command.input });
      const next = responses[Math.min(i, responses.length - 1)];
      i += 1;
      if (next && typeof next === 'object' && 'reject' in next) {
        throw next.reject;
      }
      return next;
    },
  };
  client.calls = calls;
  return client;
}

function notFoundError() {
  const err = new Error('simulated not found');
  err.name = 'NotFound';
  err.$metadata = { httpStatusCode: 404 };
  return err;
}

// ---------------------------------------------------------------------------
// assertArchiveKey accept/reject matrix
// ---------------------------------------------------------------------------

test('assertArchiveKey accepts a lowercase-uuid article key', () => {
  assert.equal(
    assertArchiveKey('articles/3f2504e0-4f89-11d3-9a0c-0305e82c3301.html'),
    'articles/3f2504e0-4f89-11d3-9a0c-0305e82c3301.html'
  );
});

test('assertArchiveKey accepts a tag key', () => {
  assert.equal(assertArchiveKey('tags/el-paso.html'), 'tags/el-paso.html');
});

test('assertArchiveKey accepts a _meta key', () => {
  assert.equal(assertArchiveKey('_meta/archive-index.json'), '_meta/archive-index.json');
});

test('assertArchiveKey accepts a _probe key', () => {
  assert.equal(assertArchiveKey('_probe/roundtrip-1.txt'), '_probe/roundtrip-1.txt');
});

test('assertArchiveKey rejects a traversal attempt', () => {
  assert.throws(() => assertArchiveKey('articles/../x.html'), /r2-client: invalid archive key/);
});

test('assertArchiveKey rejects an uppercase uuid', () => {
  assert.throws(
    () => assertArchiveKey('articles/3F2504E0-4F89-11D3-9A0C-0305E82C3301.html'),
    /r2-client: invalid archive key/
  );
});

test('assertArchiveKey rejects an underscore/uppercase tag slug', () => {
  assert.throws(() => assertArchiveKey('tags/El_Paso.html'), /r2-client: invalid archive key/);
});

test('assertArchiveKey rejects a leading slash', () => {
  assert.throws(() => assertArchiveKey('/tags/a.html'), /r2-client: invalid archive key/);
});

test('assertArchiveKey rejects an unknown top-level prefix', () => {
  assert.throws(() => assertArchiveKey('other/a.html'), /r2-client: invalid archive key/);
});

test('assertArchiveKey rejects trailing path garbage', () => {
  assert.throws(() => assertArchiveKey('tags/a.html/../../b'), /r2-client: invalid archive key/);
});

test('assertArchiveKey rejects an empty string', () => {
  assert.throws(() => assertArchiveKey(''), /r2-client: invalid archive key/);
});

test('a rejected key never reaches send() — putObject', async () => {
  const client = makeFakeClient([]);
  const store = createArchiveStore({ client });
  await assert.rejects(
    () => store.putObject('other/a.html', 'x', { contentType: 'text/plain', sha256: 'abc' }),
    /r2-client: invalid archive key/
  );
  assert.equal(client.calls.length, 0);
});

test('a rejected key never reaches send() — headObject', async () => {
  const client = makeFakeClient([]);
  const store = createArchiveStore({ client });
  await assert.rejects(() => store.headObject('/tags/a.html'), /r2-client: invalid archive key/);
  assert.equal(client.calls.length, 0);
});

test('a rejected key never reaches send() — deleteObjects', async () => {
  const client = makeFakeClient([]);
  const store = createArchiveStore({ client });
  await assert.rejects(
    () => store.deleteObjects(['tags/ok.html', 'other/a.html']),
    /r2-client: invalid archive key/
  );
  assert.equal(client.calls.length, 0);
});

test('listKeys rejects a prefix outside the four allowed archive prefixes', async () => {
  const client = makeFakeClient([]);
  const store = createArchiveStore({ client });
  await assert.rejects(() => store.listKeys('other/'), /r2-client: invalid archive key prefix/);
  assert.equal(client.calls.length, 0);
});

// ---------------------------------------------------------------------------
// putObject
// ---------------------------------------------------------------------------

test('putObject sends one PutObjectCommand with Bucket, Key, ContentType and Metadata.sha256', async () => {
  const client = makeFakeClient([{}]);
  const store = createArchiveStore({ client });
  await store.putObject('articles/3f2504e0-4f89-11d3-9a0c-0305e82c3301.html', '<html></html>', {
    contentType: 'text/html',
    sha256: 'deadbeef',
  });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].name, 'PutObjectCommand');
  assert.equal(client.calls[0].input.Bucket, ARCHIVE_BUCKET_NAME);
  assert.equal(client.calls[0].input.Key, 'articles/3f2504e0-4f89-11d3-9a0c-0305e82c3301.html');
  assert.equal(client.calls[0].input.ContentType, 'text/html');
  assert.deepEqual(client.calls[0].input.Metadata, { sha256: 'deadbeef' });
});

// ---------------------------------------------------------------------------
// headObject
// ---------------------------------------------------------------------------

test('headObject returns null when send rejects with a NotFound error', async () => {
  const client = makeFakeClient([{ reject: notFoundError() }]);
  const store = createArchiveStore({ client });
  const result = await store.headObject('tags/el-paso.html');
  assert.equal(result, null);
});

test('headObject rethrows any other error as "r2-client: head <key> failed: <code>"', async () => {
  const err = new Error('simulated throttling');
  err.name = 'ThrottlingException';
  const client = makeFakeClient([{ reject: err }]);
  const store = createArchiveStore({ client });
  await assert.rejects(
    () => store.headObject('tags/el-paso.html'),
    /^Error: r2-client: head tags\/el-paso\.html failed: ThrottlingException$/
  );
});

test('headObject returns sha256/size/etag from a successful response', async () => {
  const client = makeFakeClient([
    { Metadata: { sha256: 'abc123' }, ContentLength: 42, ETag: '"etag-value"' },
  ]);
  const store = createArchiveStore({ client });
  const result = await store.headObject('tags/el-paso.html');
  assert.deepEqual(result, { sha256: 'abc123', size: 42, etag: '"etag-value"' });
});

// ---------------------------------------------------------------------------
// deleteObjects batching
// ---------------------------------------------------------------------------

test('deleteObjects(2500 keys) issues exactly 3 DeleteObjects commands (1000/1000/500)', async () => {
  const keys = Array.from({ length: 2500 }, (_, i) => `_probe/key-${i}.txt`);
  const client = makeFakeClient([
    { Deleted: Array.from({ length: 1000 }, () => ({})) },
    { Deleted: Array.from({ length: 1000 }, () => ({})) },
    { Deleted: Array.from({ length: 500 }, () => ({})) },
  ]);
  const store = createArchiveStore({ client });
  const result = await store.deleteObjects(keys);
  assert.equal(client.calls.length, 3);
  assert.equal(client.calls[0].input.Delete.Objects.length, 1000);
  assert.equal(client.calls[1].input.Delete.Objects.length, 1000);
  assert.equal(client.calls[2].input.Delete.Objects.length, 500);
  assert.equal(result.deleted, 2500);
  assert.deepEqual(result.errors, []);
});

// ---------------------------------------------------------------------------
// Secret hygiene
// ---------------------------------------------------------------------------

test('a send() rejection whose message embeds the secret never leaks it in the thrown error', async () => {
  const sentinel = 'sentinel-secret-value-should-never-appear-in-errors';
  process.env.R2_SECRET_ACCESS_KEY = sentinel;
  const err = new Error(`signing failed using secret ${sentinel}`);
  err.name = 'SignatureDoesNotMatch';
  const client = makeFakeClient([{ reject: err }]);
  const store = createArchiveStore({ client });
  await assert.rejects(
    () => store.headObject('tags/el-paso.html'),
    (thrown) => {
      assert.ok(!String(thrown.message).includes(sentinel), 'thrown error must not contain the secret');
      assert.match(thrown.message, /SignatureDoesNotMatch/);
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// hasR2Credentials
// ---------------------------------------------------------------------------

test('hasR2Credentials is true when all three env values are present', () => {
  assert.equal(
    hasR2Credentials({
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    }),
    true
  );
});

test('hasR2Credentials is false when CLOUDFLARE_ACCOUNT_ID is missing', () => {
  assert.equal(
    hasR2Credentials({ R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' }),
    false
  );
});

test('hasR2Credentials is false when R2_ACCESS_KEY_ID is empty', () => {
  assert.equal(
    hasR2Credentials({
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: 'secret',
    }),
    false
  );
});

test('hasR2Credentials is false when R2_SECRET_ACCESS_KEY is missing', () => {
  assert.equal(
    hasR2Credentials({ CLOUDFLARE_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key' }),
    false
  );
});

test('R2_CREDENTIAL_ENV_KEYS names exactly the two R2-specific env vars', () => {
  assert.deepEqual([...R2_CREDENTIAL_ENV_KEYS], ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']);
});

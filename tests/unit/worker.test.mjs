// D-08: TDD RED/GREEN suite for src/worker.ts — the Worker's fetch handler is exercised by
// importing the default export directly with fake `env` objects (ASSETS.fetch returns a sentinel
// 404-shaped Response; RENDER_MANIFEST.get is a stub that records every call). No real network
// call, no real Cloudflare binding, ever touches this suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/worker.ts';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

const SENTINEL_404 = new Response('not found', { status: 404 });

// assetsCalls is module-scoped so makeEnv's closure can push to it; each test resets it first.
let assetsCalls;

function makeEnv({ kvValue = null, kvThrows = false } = {}) {
  const kvCalls = [];
  return {
    kvCalls,
    env: {
      ASSETS: {
        fetch: async (request) => {
          assetsCalls.push(request);
          return SENTINEL_404;
        },
      },
      RENDER_MANIFEST: {
        get: async (key) => {
          kvCalls.push(key);
          if (kvThrows) throw new Error('KV unavailable');
          return kvValue;
        },
      },
    },
  };
}

test('worker: a GET for a non-canonical path with a stubbed KV entry answers 301 with the canonical Location plus the original query string, and exactly one KV get call', async () => {
  assetsCalls = [];
  const { env, kvCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
  });

  const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}?utm_source=x`, {
    method: 'GET',
  });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), `/crime/new-title-${UUID}?utm_source=x`);
  assert.equal(kvCalls.length, 1);
  assert.equal(kvCalls[0], `manifest:${UUID}`);
  assert.equal(assetsCalls.length, 0);
});

test('worker: no uuid in the path falls through to env.ASSETS.fetch with zero KV calls', async () => {
  assetsCalls = [];
  const { env, kvCalls } = makeEnv();

  const request = new Request('https://dev.915tldr.com/crime', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(kvCalls.length, 0);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a KV get that throws falls through to env.ASSETS.fetch, never a 500', async () => {
  assetsCalls = [];
  const { env } = makeEnv({ kvThrows: true });

  const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a POST request falls through to env.ASSETS.fetch with zero KV calls', async () => {
  assetsCalls = [];
  const { env, kvCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
  });

  const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'POST' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(kvCalls.length, 0);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a not-found manifest entry (loop guard / invalid entry) falls through to env.ASSETS.fetch', async () => {
  assetsCalls = [];
  const { env } = makeEnv({ kvValue: null });

  const request = new Request(`https://dev.915tldr.com/article/${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
});

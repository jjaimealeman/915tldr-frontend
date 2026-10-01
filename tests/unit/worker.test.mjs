// D-08: TDD RED/GREEN suite for src/worker.ts — the Worker's fetch handler is exercised by
// importing the default export directly with fake `env` objects (ASSETS.fetch returns a sentinel
// 404-shaped Response; RENDER_MANIFEST.get and ARCHIVE_BUCKET.get/head are stubs that record every
// call). No real network call, no real Cloudflare binding, ever touches this suite.
//
// 05-03 Task 2 extends this file with the tag archive branch, HEAD support, 503 R2-error
// handling, Server-Timing, and the full per-request-shape KV-count matrix (ARCH-08). Values this
// suite pins (measured live against dev.915tldr.com before writing any code, 2026-09-30):
//   - a live static HTML page's Content-Type header is exactly `text/html` (no charset param)
//   - its Cache-Control is exactly `public, max-age=0, must-revalidate`
//   - a trailing-slash/`.html`-suffix tag path redirects with status 307 to the bare slug path
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/worker.ts';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

const SENTINEL_404 = new Response('not found', { status: 404 });
const LIVE_CONTENT_TYPE = 'text/html';
const LIVE_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

function makeArchiveBody(text, etag = 'W/"archive-etag"') {
  return {
    httpEtag: etag,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
  };
}

// assetsCalls/consoleErrors are module-scoped so makeEnv's closure and the console.error spy can
// push to them; each test resets them first.
let assetsCalls;
let consoleErrors;
let originalConsoleError;

function makeEnv({
  kvValue = null,
  kvThrows = false,
  r2GetValue = null,
  r2GetThrows = false,
  r2HeadValue = null,
  r2HeadThrows = false,
} = {}) {
  const kvCalls = [];
  const r2GetCalls = [];
  const r2HeadCalls = [];
  return {
    kvCalls,
    r2GetCalls,
    r2HeadCalls,
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
      ARCHIVE_BUCKET: {
        get: async (key) => {
          r2GetCalls.push(key);
          if (r2GetThrows) throw new Error('R2 unavailable');
          return r2GetValue;
        },
        head: async (key) => {
          r2HeadCalls.push(key);
          if (r2HeadThrows) throw new Error('R2 unavailable');
          return r2HeadValue;
        },
      },
    },
  };
}

test.beforeEach(() => {
  assetsCalls = [];
  consoleErrors = [];
  originalConsoleError = console.error;
  console.error = (...args) => consoleErrors.push(args.join(' '));
});

test.afterEach(() => {
  console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Pre-existing redirect/fallthrough behavior (Phase 4 / Task 1) — unchanged
// ---------------------------------------------------------------------------

test('worker: a GET for a non-canonical path with a stubbed KV entry answers 301 with the canonical Location plus the original query string, and exactly one KV get call', async () => {
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
  const { env, kvCalls } = makeEnv();

  const request = new Request('https://dev.915tldr.com/crime', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(kvCalls.length, 0);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a KV get that throws falls through to env.ASSETS.fetch, never a 500', async () => {
  const { env } = makeEnv({ kvThrows: true });

  const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a POST request falls through to env.ASSETS.fetch with zero KV calls', async () => {
  const { env, kvCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
  });

  const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'POST' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(kvCalls.length, 0);
  assert.equal(assetsCalls.length, 1);
});

test('worker: a not-found manifest entry (invalid entry) falls through to env.ASSETS.fetch', async () => {
  const { env } = makeEnv({ kvValue: null });

  const request = new Request(`https://dev.915tldr.com/article/${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
});

// ---------------------------------------------------------------------------
// 05-03 Task 1: canonical article path served from R2
// ---------------------------------------------------------------------------

test('worker: a canonical article path with an archived R2 object is served 200 from R2 with one KV get, one R2 get, zero ASSETS calls', async () => {
  const { env, kvCalls, r2GetCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived article body'),
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'archived article body');
  assert.equal(kvCalls.length, 1);
  assert.equal(r2GetCalls.length, 1);
  assert.equal(r2GetCalls[0], `articles/${UUID}.html`);
  assert.equal(assetsCalls.length, 0);
});

test('worker: a canonical article path whose R2 object is missing falls through to env.ASSETS.fetch (404) and logs one console.error naming the uuid', async () => {
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: null,
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
  assert.equal(consoleErrors.length, 1);
  assert.ok(consoleErrors[0].includes(UUID), 'console.error must name the uuid');
});

// ---------------------------------------------------------------------------
// 05-03 Task 2: tag archive branch, suffix parity, HEAD, 503, Server-Timing
// ---------------------------------------------------------------------------

test('worker: GET /tag/<slug> with an archived R2 object is served 200 with zero KV calls, one R2 get, Server-Timing naming r2', async () => {
  const { env, kvCalls, r2GetCalls } = makeEnv({
    r2GetValue: makeArchiveBody('archived tag body'),
  });

  const request = new Request('https://dev.915tldr.com/tag/el-paso', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'archived tag body');
  assert.equal(kvCalls.length, 0);
  assert.equal(r2GetCalls.length, 1);
  assert.equal(r2GetCalls[0], 'tags/el-paso.html');
  assert.equal(assetsCalls.length, 0);
  const timing = response.headers.get('Server-Timing');
  assert.ok(timing.includes('archive;desc=r2'), timing);
  assert.ok(timing.includes('r2;dur='), timing);
});

test('worker: GET /tag/<slug> with no R2 object falls through to env.ASSETS.fetch with no console.error', async () => {
  const { env } = makeEnv({ r2GetValue: null });

  const request = new Request('https://dev.915tldr.com/tag/unarchived-tag', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response, SENTINEL_404);
  assert.equal(assetsCalls.length, 1);
  assert.equal(consoleErrors.length, 0);
});

test('worker: GET /tag/<slug>/ redirects with the status measured live (307), Location /tag/<slug> plus the query string, zero KV/R2 calls', async () => {
  const { env, kvCalls, r2GetCalls } = makeEnv();

  const request = new Request('https://dev.915tldr.com/tag/el-paso/?page=2', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('Location'), '/tag/el-paso?page=2');
  assert.equal(kvCalls.length, 0);
  assert.equal(r2GetCalls.length, 0);
});

test('worker: GET /tag/<slug>.html redirects with status 307, Location /tag/<slug>, zero KV/R2 calls', async () => {
  const { env, kvCalls, r2GetCalls } = makeEnv();

  const request = new Request('https://dev.915tldr.com/tag/el-paso.html', { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get('Location'), '/tag/el-paso');
  assert.equal(kvCalls.length, 0);
  assert.equal(r2GetCalls.length, 0);
});

test('worker: the tag branch is evaluated before uuid extraction — GET /tag/foo-<uuid> makes zero KV calls', async () => {
  const { env, kvCalls } = makeEnv({ r2GetValue: null });

  const request = new Request(`https://dev.915tldr.com/tag/foo-${UUID}`, { method: 'GET' });
  await worker.fetch(request, env);

  assert.equal(kvCalls.length, 0);
});

test('worker: HEAD for an archived article uses ARCHIVE_BUCKET.head (never get) and returns 200 with no body', async () => {
  const { env, r2GetCalls, r2HeadCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2HeadValue: { httpEtag: 'W/"head-etag"' },
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'HEAD' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(r2HeadCalls.length, 1);
  assert.equal(r2GetCalls.length, 0);
});

test('worker: HEAD for an archived tag uses ARCHIVE_BUCKET.head (never get) and returns 200 with no body', async () => {
  const { env, r2GetCalls, r2HeadCalls } = makeEnv({
    r2HeadValue: { httpEtag: 'W/"head-etag"' },
  });

  const request = new Request('https://dev.915tldr.com/tag/el-paso', { method: 'HEAD' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(r2HeadCalls.length, 1);
  assert.equal(r2GetCalls.length, 0);
});

test('worker: an R2 get that throws answers 503 with Retry-After and Cache-Control no-store, and never logs the request header value', async () => {
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetThrows: true,
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, {
    method: 'GET',
    headers: { 'X-Secret-Canary': 'do-not-log-this-value' },
  });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  for (const line of consoleErrors) {
    assert.ok(!line.includes('do-not-log-this-value'), `log line leaked a header value: ${line}`);
  }
});

test('worker: an R2 head that throws (HEAD request) answers 503 with Retry-After and Cache-Control no-store', async () => {
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2HeadThrows: true,
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'HEAD' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('worker: archived 200 responses carry the live-measured Content-Type, Cache-Control and an ETag from the R2 object', async () => {
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived body', 'W/"etag-123"'),
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.headers.get('Content-Type'), LIVE_CONTENT_TYPE);
  assert.equal(response.headers.get('Cache-Control'), LIVE_CACHE_CONTROL);
  assert.equal(response.headers.get('ETag'), 'W/"etag-123"');
});

test('worker: the archived-article Server-Timing includes both kv;dur and r2;dur alongside archive;desc=r2', async () => {
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived body'),
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  const timing = response.headers.get('Server-Timing');
  assert.ok(timing.includes('archive;desc=r2'), timing);
  assert.ok(timing.includes('kv;dur='), timing);
  assert.ok(timing.includes('r2;dur='), timing);
});

// ---------------------------------------------------------------------------
// ARCH-08: per-request-shape KV get count matrix — every shape is 0 or 1, never more
// ---------------------------------------------------------------------------

test('worker: KV get count matrix — every request shape performs 0 or 1 KV get, never more', async () => {
  const archivedEntry = { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' };
  const shapes = [
    {
      name: 'article canonical (archived)',
      request: () => new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvValue: archivedEntry, r2GetValue: makeArchiveBody('x') }),
      expectedKv: 1,
    },
    {
      name: 'article non-canonical (redirect)',
      request: () => new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvValue: archivedEntry }),
      expectedKv: 1,
    },
    {
      name: 'article with unknown uuid (no manifest entry)',
      request: () => new Request(`https://dev.915tldr.com/article/${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvValue: null }),
      expectedKv: 1,
    },
    {
      name: 'tag canonical (archived)',
      request: () => new Request('https://dev.915tldr.com/tag/el-paso', { method: 'GET' }),
      env: () => makeEnv({ r2GetValue: makeArchiveBody('x') }),
      expectedKv: 0,
    },
    {
      name: 'tag with trailing-slash suffix',
      request: () => new Request('https://dev.915tldr.com/tag/el-paso/', { method: 'GET' }),
      env: () => makeEnv(),
      expectedKv: 0,
    },
    {
      name: 'tag with .html suffix',
      request: () => new Request('https://dev.915tldr.com/tag/el-paso.html', { method: 'GET' }),
      env: () => makeEnv(),
      expectedKv: 0,
    },
    {
      name: 'no uuid, no tag shape',
      request: () => new Request('https://dev.915tldr.com/crime', { method: 'GET' }),
      env: () => makeEnv(),
      expectedKv: 0,
    },
    {
      name: 'POST request',
      request: () => new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'POST' }),
      env: () => makeEnv({ kvValue: archivedEntry }),
      expectedKv: 0,
    },
    {
      name: 'HEAD request (canonical archived article)',
      request: () => new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'HEAD' }),
      env: () => makeEnv({ kvValue: archivedEntry, r2HeadValue: { httpEtag: 'W/"x"' } }),
      expectedKv: 1,
    },
    {
      name: 'KV throws',
      request: () => new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvThrows: true }),
      expectedKv: 1,
    },
    {
      name: 'R2 get throws (canonical article)',
      request: () => new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvValue: archivedEntry, r2GetThrows: true }),
      expectedKv: 1,
    },
    {
      name: 'R2 miss (canonical article, no archived object)',
      request: () => new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' }),
      env: () => makeEnv({ kvValue: archivedEntry, r2GetValue: null }),
      expectedKv: 1,
    },
  ];

  for (const shape of shapes) {
    const { env, kvCalls } = shape.env();
    await worker.fetch(shape.request(), env);
    assert.ok(
      kvCalls.length === 0 || kvCalls.length === 1,
      `${shape.name}: expected 0 or 1 KV call, got ${kvCalls.length}`
    );
    assert.equal(kvCalls.length, shape.expectedKv, `${shape.name}: expected exactly ${shape.expectedKv} KV call(s)`);
  }
});

// ---------------------------------------------------------------------------
// 05-03 Task 3: edge cache for archived GETs
// ---------------------------------------------------------------------------

function makeFakeCache() {
  const store = new Map();
  const matchCalls = [];
  const putCalls = [];
  return {
    matchCalls,
    putCalls,
    store,
    cache: {
      match: async (req) => {
        matchCalls.push(req.url);
        return store.get(req.url);
      },
      put: async (req, res) => {
        putCalls.push(req.url);
        store.set(req.url, res);
      },
    },
  };
}

function makeCtx() {
  const waits = [];
  return { waits, ctx: { waitUntil: (p) => waits.push(p) } };
}

let originalCaches;
let hadCaches;

test.beforeEach(() => {
  hadCaches = 'caches' in globalThis;
  originalCaches = hadCaches ? globalThis.caches : undefined;
});

test.afterEach(() => {
  if (hadCaches) {
    globalThis.caches = originalCaches;
  } else {
    delete globalThis.caches;
  }
});

test('worker: first GET for an archived article is a cache miss — KV + R2 run, response is cached via ctx.waitUntil with max-age=300, client response keeps the static-parity Cache-Control', async () => {
  const { cache, putCalls, store } = makeFakeCache();
  globalThis.caches = { default: cache };
  const { waits, ctx } = makeCtx();
  const { env, kvCalls, r2GetCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived body'),
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env, ctx);
  await Promise.all(waits);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'archived body');
  assert.equal(response.headers.get('Cache-Control'), LIVE_CACHE_CONTROL);
  assert.equal(kvCalls.length, 1);
  assert.equal(r2GetCalls.length, 1);
  assert.equal(putCalls.length, 1);

  const [storedKey] = store.keys();
  const stored = store.get(storedKey);
  assert.equal(stored.headers.get('Cache-Control'), 'public, max-age=300');
});

test('worker: a second GET for the same archived article path (different query string) is served from the cache with zero KV and zero R2 calls, Server-Timing names edge-cache, Cache-Control rewritten to static-parity', async () => {
  const { cache, putCalls } = makeFakeCache();
  globalThis.caches = { default: cache };
  const { waits, ctx } = makeCtx();
  const { env, kvCalls, r2GetCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived body'),
  });

  const firstRequest = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}?a=1`, { method: 'GET' });
  await worker.fetch(firstRequest, env, ctx);
  await Promise.all(waits);
  assert.equal(putCalls.length, 1);

  const secondRequest = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}?a=2`, { method: 'GET' });
  const response = await worker.fetch(secondRequest, env, ctx);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'archived body');
  assert.equal(kvCalls.length, 1, 'no additional KV call on the cache hit');
  assert.equal(r2GetCalls.length, 1, 'no additional R2 call on the cache hit');
  assert.equal(response.headers.get('Cache-Control'), LIVE_CACHE_CONTROL);
  const timing = response.headers.get('Server-Timing');
  assert.ok(timing.includes('archive;desc=edge-cache'), timing);
});

test('worker: the same archived tag path is cached and re-served the same way as an article', async () => {
  const { cache, putCalls } = makeFakeCache();
  globalThis.caches = { default: cache };
  const { waits, ctx } = makeCtx();
  const { env, r2GetCalls } = makeEnv({ r2GetValue: makeArchiveBody('tag body') });

  await worker.fetch(new Request('https://dev.915tldr.com/tag/el-paso', { method: 'GET' }), env, ctx);
  await Promise.all(waits);
  assert.equal(putCalls.length, 1);

  const response = await worker.fetch(
    new Request('https://dev.915tldr.com/tag/el-paso?p=2', { method: 'GET' }),
    env,
    ctx
  );
  assert.equal(response.status, 200);
  assert.equal(r2GetCalls.length, 1, 'no additional R2 call on the cache hit');
  const timing = response.headers.get('Server-Timing');
  assert.ok(timing.includes('archive;desc=edge-cache'), timing);
});

test('worker: HEAD never reads or writes the cache', async () => {
  const { cache, matchCalls, putCalls } = makeFakeCache();
  globalThis.caches = { default: cache };
  const { ctx } = makeCtx();
  const { env } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2HeadValue: { httpEtag: 'W/"x"' },
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'HEAD' });
  await worker.fetch(request, env, ctx);

  assert.equal(matchCalls.length, 0);
  assert.equal(putCalls.length, 0);
});

test('worker: a 301 redirect, a 404 fallthrough and a 503 are never cached', async () => {
  const { cache, putCalls } = makeFakeCache();
  globalThis.caches = { default: cache };
  const { ctx } = makeCtx();

  // 301 (non-canonical redirect)
  {
    const { env } = makeEnv({
      kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    });
    const request = new Request(`https://dev.915tldr.com/politics/old-title-${UUID}`, { method: 'GET' });
    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 301);
  }

  // 404 fallthrough (canonical article, missing R2 object)
  {
    const { env } = makeEnv({
      kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
      r2GetValue: null,
    });
    const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
    const response = await worker.fetch(request, env, ctx);
    assert.equal(response, SENTINEL_404);
  }

  // 503 (R2 throws)
  {
    const { env } = makeEnv({
      kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
      r2GetThrows: true,
    });
    const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 503);
  }

  assert.equal(putCalls.length, 0);
});

test('worker: with globalThis.caches undefined, archived GETs still serve from R2 with no throw', async () => {
  delete globalThis.caches;
  const { env, r2GetCalls } = makeEnv({
    kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'new-title' },
    r2GetValue: makeArchiveBody('archived body'),
  });

  const request = new Request(`https://dev.915tldr.com/crime/new-title-${UUID}`, { method: 'GET' });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'archived body');
  assert.equal(r2GetCalls.length, 1);
});

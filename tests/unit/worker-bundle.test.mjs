// D-08 (05-03 Task 1): drives the REAL wrangler-bundled Worker (the output of
// `pnpm exec wrangler deploy --dry-run --config wrangler.jsonc --outdir .wrangler/dry-run-05`),
// not the TypeScript source directly — this is what actually gets deployed, bundling
// `src/worker.ts`, `src/lib/article-redirect.ts` and `src/lib/archive/archive-route.ts` together.
// Skips cleanly (never fails) when the dry-run output is absent, since that output is a gitignored
// build artifact that must be regenerated before this suite runs (see package.json's verify step
// for this plan, which always runs the dry-run immediately before this test file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRY_RUN_WORKER_JS = path.join(REPO_ROOT, '.wrangler/dry-run-05/worker.js');
const BUNDLE_EXISTS = fs.existsSync(DRY_RUN_WORKER_JS);

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const ARTICLE_PATH = `/crime/some-slug-${UUID}`;
const ARTICLE_HTML = '<!doctype html><html><body>archived article body</body></html>';

function makeEnv({ kvValue, r2Body } = {}) {
  const kvCalls = [];
  const r2Calls = [];
  const assetsCalls = [];
  return {
    kvCalls,
    r2Calls,
    assetsCalls,
    env: {
      ASSETS: {
        fetch: async (request) => {
          assetsCalls.push(request);
          return new Response('not found', { status: 404 });
        },
      },
      RENDER_MANIFEST: {
        get: async (key) => {
          kvCalls.push(key);
          return kvValue ?? null;
        },
      },
      ARCHIVE_BUCKET: {
        get: async (key) => {
          r2Calls.push(key);
          if (r2Body === undefined) return null;
          return {
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(r2Body));
                controller.close();
              },
            }),
          };
        },
        head: async () => null,
      },
    },
  };
}

test(
  'worker-bundle: a GET for an archived article canonical path is served from R2 with one KV get, one R2 get, zero ASSETS calls',
  { skip: BUNDLE_EXISTS ? false : 'dry-run bundle not found — run the dry-run build first' },
  async () => {
    const { default: worker } = await import(DRY_RUN_WORKER_JS);

    const { env, kvCalls, r2Calls, assetsCalls } = makeEnv({
      kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'some-slug' },
      r2Body: ARTICLE_HTML,
    });

    const request = new Request(`https://dev.915tldr.com${ARTICLE_PATH}`, { method: 'GET' });
    const response = await worker.fetch(request, env);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), ARTICLE_HTML);
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal(kvCalls.length, 1);
    assert.equal(kvCalls[0], `manifest:${UUID}`);
    assert.equal(r2Calls.length, 1);
    assert.equal(r2Calls[0], `articles/${UUID}.html`);
    assert.equal(assetsCalls.length, 0);
  }
);

test(
  'worker-bundle: a canonical article path whose R2 object is missing falls through to env.ASSETS.fetch',
  { skip: BUNDLE_EXISTS ? false : 'dry-run bundle not found — run the dry-run build first' },
  async () => {
    const { default: worker } = await import(DRY_RUN_WORKER_JS);

    const { env, assetsCalls } = makeEnv({
      kvValue: { schemaVersion: '2', articleId: UUID, category: 'crime', slug: 'some-slug' },
    });

    const request = new Request(`https://dev.915tldr.com${ARTICLE_PATH}`, { method: 'GET' });
    const response = await worker.fetch(request, env);

    assert.equal(response.status, 404);
    assert.equal(assetsCalls.length, 1);
  }
);

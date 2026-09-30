import { test, expect } from '@playwright/test';
import http from 'node:http';
import { openPage, THEME_STORAGE_KEY } from './support/harness.ts';

const BASE_URL = 'http://127.0.0.1:4319';

/**
 * Sends a raw, unnormalized HTTP request path. Used for the literal `/../`
 * traversal case, since fetch()/Playwright's `request` fixture normalize the
 * URL client-side before it ever hits the wire, which would hide the exact
 * bug this test defends against.
 */
function rawGet(rawPath: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 4319,
        path: rawPath,
        method: 'GET',
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('GET /__health returns 200 with body ok @harness', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/__health`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe('ok');
});

test('GET /tests/fixtures/harness.html returns 200 html @harness', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/tests/fixtures/harness.html`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('text/html; charset=utf-8');
});

test('literal /../ traversal returns 404 @harness', async () => {
  const res = await rawGet('/../package.json');
  expect(res.status).toBe(404);
});

test('percent-encoded ../ traversal returns 404 @harness', async () => {
  const res = await rawGet('/%2e%2e/package.json');
  expect(res.status).toBe(404);
});

test('nested percent-encoded traversal under /mockups/ returns 404 @harness', async () => {
  const res = await rawGet('/mockups/..%2f..%2fpackage.json');
  expect(res.status).toBe(404);
});

test('POST /tests/fixtures/harness.html returns 405 @harness', async ({ request }) => {
  const res = await request.post(`${BASE_URL}/tests/fixtures/harness.html`);
  expect(res.status()).toBe(405);
});

test('openPage blocks third-party requests @harness', async ({ page }) => {
  const { blocked } = await openPage(page, 'harness');
  // Fixture page references https://example.com/ (link) and an example.com
  // image; neither should be reachable, and blockThirdParty should have
  // recorded at least the image request (an eager subresource load).
  await page.waitForTimeout(250);
  expect(blocked.some((url) => url.includes('example.com'))).toBe(true);
});

test('a route handler registered before openPage still receives local requests @harness', async ({ page }) => {
  let localRequestSeen = false;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      localRequestSeen = true;
    }
    await route.fallback();
  });
  await openPage(page, 'harness');
  expect(localRequestSeen).toBe(true);
});

test('openPage seeds theme into localStorage before page scripts run @harness', async ({ page }) => {
  await openPage(page, 'harness', { theme: 'dark' });
  const seen = await page.evaluate(() => document.documentElement.dataset.seen);
  expect(seen).toBe('dark');
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe('dark');
});

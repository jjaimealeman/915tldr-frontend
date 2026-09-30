// 04-06 Task 3: proves the built 404 page, its build-time suggestion index, and public/_redirects
// against REAL built output under dist/client — following tests/unit/listing-pages.test.mjs's
// established "assert on rendered output, skip if unbuilt" convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

// Mirrors src/pages/404-index.json.ts's own NOT_FOUND_INDEX_COUNT — that module cannot be
// imported directly under plain `node --test` (it imports the `astro:content` virtual module,
// which only resolves inside Astro's own Vite build), so the value is duplicated here rather
// than imported, matching this suite's own dist-output-only testing convention.
const NOT_FOUND_INDEX_COUNT = 500;

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

function readDist(relPath) {
  return readFileSync(path.join(DIST_CLIENT, relPath), 'utf8');
}

function distFileExists(relPath) {
  return existsSync(path.join(DIST_CLIENT, relPath));
}

// ---------------------------------------------------------------------------
// 404.html
// ---------------------------------------------------------------------------

test('not-found: 404.html exists, is noindex, and has at least one static card plus the suggestions section', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('404.html'), 'expected dist/client/404.html to exist');
  const html = readDist('404.html');

  assert.match(html, /<meta name="robots" content="noindex"/, 'expected the noindex meta tag');

  const cardCount = (html.match(/<article data-card/g) ?? []).length;
  assert.ok(cardCount >= 1, `expected at least 1 static "Recent stories" card, got ${cardCount}`);

  assert.match(
    html,
    /<section data-404-suggestions[^>]*hidden[^>]*aria-live="polite"[^>]*>/,
    'expected the initially-hidden suggestions section with aria-live="polite"'
  );
});

test('not-found: 404.html\'s inline script uses only textContent, never an HTML-string sink (T-04-25)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const html = readDist('404.html');
  const scriptMatches = [...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)];
  const pageScript = scriptMatches.map((m) => m[1]).find((body) => body.includes('404-index.json'));
  assert.ok(pageScript, 'expected to find the 404 suggestions inline script');

  assert.match(pageScript, /\.textContent\s*=/, 'expected at least one .textContent assignment');
  assert.doesNotMatch(pageScript, /\.innerHTML\s*=/, 'must never assign .innerHTML');
  assert.doesNotMatch(pageScript, /\.outerHTML\s*=/, 'must never assign .outerHTML');
  assert.doesNotMatch(pageScript, /\.insertAdjacentHTML\s*\(/, 'must never call .insertAdjacentHTML');
});

// ---------------------------------------------------------------------------
// 404-index.json
// ---------------------------------------------------------------------------

test('not-found: 404-index.json parses, has <= NOT_FOUND_INDEX_COUNT entries, is <= 100KB, and every path maps to a real built page (same-build consistency)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('404-index.json'), 'expected dist/client/404-index.json to exist');

  const raw = readDist('404-index.json');
  const sizeBytes = Buffer.byteLength(raw, 'utf8');
  assert.ok(sizeBytes <= 100 * 1024, `expected 404-index.json <= 100KB, got ${sizeBytes} bytes`);

  const index = JSON.parse(raw);
  assert.ok(Array.isArray(index), 'expected 404-index.json to parse as an array');
  assert.ok(
    index.length <= NOT_FOUND_INDEX_COUNT,
    `expected at most ${NOT_FOUND_INDEX_COUNT} entries, got ${index.length}`
  );
  assert.ok(index.length > 0, 'expected at least one entry (the corpus is non-empty)');

  for (const entry of index) {
    assert.equal(typeof entry.t, 'string');
    assert.ok(entry.t.length > 0, 'expected a non-empty title');
    assert.equal(typeof entry.p, 'string');
    assert.ok(entry.p.startsWith('/'), `expected an absolute path, got ${entry.p}`);

    // Same-build consistency: every path in the index must exist in THIS build's own output —
    // build.format: 'file' means /crime/slug-uuid maps to dist/client/crime/slug-uuid.html.
    const expectedFile = path.join(DIST_CLIENT, `${entry.p}.html`);
    assert.ok(
      existsSync(expectedFile) && statSync(expectedFile).isFile(),
      `expected ${entry.p} to map to an existing built file (${expectedFile})`
    );
  }
});

// ---------------------------------------------------------------------------
// public/_redirects
// ---------------------------------------------------------------------------

test('not-found: _redirects carries the D-11/D-12 rules', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('_redirects'), 'expected dist/client/_redirects to exist');
  const redirects = readDist('_redirects');

  assert.match(redirects, /^\/categories \/ 301$/m);
  assert.match(redirects, /^\/sources \/ 301$/m);
  assert.match(redirects, /^\/new \/ 301$/m);
  assert.match(redirects, /^\/sitemap\.xml \/sitemap-index\.xml 301$/m);
});

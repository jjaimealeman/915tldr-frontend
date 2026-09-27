// 04-05: proves every listing page type (home, the 8 category indexes — Task 2; tag pages, /tags,
// source pages — Task 3) against REAL built pages under `dist/client`, not the source templates.
// Follows tests/unit/chrome.test.mjs / tests/unit/article-markup.test.mjs's `node:test` +
// `assert/strict` + regex-over-real-HTML conventions (this project's established style for
// asserting on rendered output rather than a full DOM parse).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/lib/categories.ts';
import { HOME_FEED_COUNT, CATEGORY_PAGE_COUNT, SOURCE_PAGE_COUNT, TAGS_INDEX_COUNT } from '../../src/lib/listing.ts';

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

/** Every `time[datetime]` occurrence in document order — one per card (lead + grid), since
 * ArticleCard always renders exactly one `<time datetime>` per card. */
function extractCardDatetimes(html) {
  return [...html.matchAll(/<time datetime="([^"]+)">/g)].map((m) => m[1]);
}

/** Counts `<article data-card` / `<article data-lead` occurrences — every ArticleCard variant
 * renders as one or the other. */
function countCards(html) {
  const cardMatches = html.match(/<article data-card/g) ?? [];
  const leadMatches = html.match(/<article data-lead/g) ?? [];
  return cardMatches.length + leadMatches.length;
}

function assertDescending(datetimes, label) {
  const epochs = datetimes.map((d) => new Date(d).getTime());
  for (let i = 1; i < epochs.length; i++) {
    assert.ok(epochs[i] <= epochs[i - 1], `expected ${label} to be sorted newest-first (index ${i} out of order)`);
  }
}

function extractCanonical(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test('listing-pages: index.html exists with HOME_FEED_COUNT cards, newest-first, canonical https://915tldr.com/', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('index.html'), 'expected dist/client/index.html to exist');
  const html = readDist('index.html');

  assert.equal(countCards(html), HOME_FEED_COUNT, `expected exactly ${HOME_FEED_COUNT} cards on the homepage`);

  const datetimes = extractCardDatetimes(html);
  assert.equal(datetimes.length, HOME_FEED_COUNT);
  assertDescending(datetimes, 'homepage cards');

  assert.equal(extractCanonical(html), 'https://915tldr.com/');
});

// ---------------------------------------------------------------------------
// Category indexes (FIX-04)
// ---------------------------------------------------------------------------

test('listing-pages: each of the 8 category indexes exists with the right nav/card/canonical shape', { skip: !DIST_BUILT && SKIP_REASON }, async (t) => {
  for (const category of CATEGORIES) {
    await t.test(category.slug, () => {
      const relPath = `${category.slug}.html`;
      assert.ok(distFileExists(relPath), `expected dist/client/${relPath} to exist`);
      const html = readDist(relPath);

      // aria-current="page" on its own nav link.
      const navMatch = html.match(/<nav aria-label="Sections">([\s\S]*?)<\/nav>/);
      assert.ok(navMatch, 'expected a <nav aria-label="Sections"> block');
      const ownLinkRe = new RegExp(`<a[^>]*data-nav-category="${category.slug}"[^>]*>`);
      const ownLinkMatch = navMatch[1].match(ownLinkRe);
      assert.ok(ownLinkMatch, `expected a nav link for "${category.slug}"`);
      assert.match(ownLinkMatch[0], /aria-current="page"/, `expected aria-current="page" on ${category.slug}'s own nav link`);

      // <= 30 cards, sorted newest-first by their own time[datetime].
      const cardCount = countCards(html);
      assert.ok(cardCount <= CATEGORY_PAGE_COUNT, `expected at most ${CATEGORY_PAGE_COUNT} cards, got ${cardCount}`);
      assertDescending(extractCardDatetimes(html), `${category.slug} cards`);

      // Canonical.
      assert.equal(extractCanonical(html), `https://915tldr.com/${category.slug}`);

      // FIX-04: the category's own article directory still exists alongside <slug>.html, for
      // categories that have articles at all.
      const articleDir = path.join(DIST_CLIENT, category.slug);
      if (cardCount > 0) {
        assert.ok(existsSync(articleDir) && statSync(articleDir).isDirectory(), `expected dist/client/${category.slug}/ to exist`);
        const files = readdirSync(articleDir).filter((f) => f.endsWith('.html'));
        assert.ok(files.length > 0, `expected at least one article file under dist/client/${category.slug}/`);
      }
    });
  }
});

test('listing-pages: at least 9 top-level HTML files exist (index + 8 categories)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const topLevelHtml = readdirSync(DIST_CLIENT).filter((f) => f.endsWith('.html') && statSync(path.join(DIST_CLIENT, f)).isFile());
  assert.ok(topLevelHtml.length >= 9, `expected at least 9 top-level .html files, got ${topLevelHtml.length}`);
});

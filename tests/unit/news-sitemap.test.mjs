// 04-07 Task 3 (tdd="true"): behavior cases for the pure selectors in src/lib/seo-feeds.ts,
// plus dist-output checks for news-sitemap.xml and sitemap-index.xml, following
// tests/unit/listing.test.mjs's node:test + assert/strict structure and minimal-fixture
// convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  selectNewsWindow,
  newsSitemapXml,
  NEWS_WINDOW_SECONDS,
  NEWS_MAX_URLS,
} from '../../src/lib/seo-feeds.ts';

/** Minimal fixture matching the ArticleData shape's render-relevant fields (tests/unit/listing.test.mjs's own pattern). */
function article({
  uuid,
  publishedAt,
  categorySlug = 'crime',
  categoryName = 'Crime',
  title = `Title ${uuid}`,
  slug = `slug-${uuid}`,
}) {
  return {
    uuid,
    title,
    slug,
    summary: 'summary',
    keyPoints: null,
    url: 'https://example.com/a',
    publishedAt,
    category: { slug: categorySlug, name: categoryName },
    tags: [],
    source: { slug: 'ktsm', name: 'KTSM', websiteUrl: 'https://example.com' },
  };
}

// ---------------------------------------------------------------------------
// selectNewsWindow — behavior cases from 04-07-PLAN.md Task 3
// ---------------------------------------------------------------------------

test('selectNewsWindow: an article at exactly now - 172800 is included', () => {
  const now = 1_000_000_000;
  const articles = [article({ uuid: 'a', publishedAt: now - NEWS_WINDOW_SECONDS })];
  const result = selectNewsWindow(articles, now);
  assert.equal(result.length, 1);
  assert.equal(result[0].uuid, 'a');
});

test('selectNewsWindow: an article at now - 172801 is excluded', () => {
  const now = 1_000_000_000;
  const articles = [article({ uuid: 'a', publishedAt: now - NEWS_WINDOW_SECONDS - 1 })];
  const result = selectNewsWindow(articles, now);
  assert.equal(result.length, 0);
});

test('selectNewsWindow: a future-dated article (now + 60) is included', () => {
  const now = 1_000_000_000;
  const articles = [article({ uuid: 'a', publishedAt: now + 60 })];
  const result = selectNewsWindow(articles, now);
  assert.equal(result.length, 1);
});

test('selectNewsWindow: 1,500 in-window articles returns exactly 1,000, newest first', () => {
  const now = 1_000_000_000;
  const articles = [];
  for (let i = 0; i < 1500; i += 1) {
    articles.push(article({ uuid: String(i).padStart(4, '0'), publishedAt: now - i }));
  }
  const result = selectNewsWindow(articles, now);
  assert.equal(result.length, NEWS_MAX_URLS);
  assert.equal(result[0].uuid, '0000'); // publishedAt = now, newest
  for (let i = 1; i < result.length; i += 1) {
    assert.ok(result[i - 1].publishedAt >= result[i].publishedAt, 'expected newest-first order');
  }
});

test('selectNewsWindow: equal publishedAt breaks ties by uuid ascending', () => {
  const now = 1_000_000_000;
  const articles = [
    article({ uuid: 'bbb', publishedAt: now }),
    article({ uuid: 'aaa', publishedAt: now }),
  ];
  const result = selectNewsWindow(articles, now);
  assert.deepEqual(result.map((a) => a.uuid), ['aaa', 'bbb']);
});

test('selectNewsWindow: does not mutate its input array', () => {
  const now = 1_000_000_000;
  const input = [article({ uuid: 'a', publishedAt: now }), article({ uuid: 'b', publishedAt: now - 10 })];
  const originalOrder = input.map((a) => a.uuid);
  selectNewsWindow(input, now);
  assert.deepEqual(input.map((a) => a.uuid), originalOrder);
});

// ---------------------------------------------------------------------------
// newsSitemapXml — behavior cases from 04-07-PLAN.md Task 3
// ---------------------------------------------------------------------------

test('newsSitemapXml: escapes & and < in titles', () => {
  const xml = newsSitemapXml(
    [article({ uuid: 'a', publishedAt: 1000, title: 'Crime & Punishment <redacted>' })],
    'https://915tldr.com'
  );
  assert.match(xml, /<news:title>Crime &amp; Punishment &lt;redacted&gt;<\/news:title>/);
  assert.doesNotMatch(xml, /Crime & Punishment/, 'raw & must not appear unescaped');
});

test('newsSitemapXml: emits one <url> per entry', () => {
  const xml = newsSitemapXml(
    [article({ uuid: 'a', publishedAt: 1000 }), article({ uuid: 'b', publishedAt: 900 })],
    'https://915tldr.com'
  );
  const urlCount = (xml.match(/<url>/g) ?? []).length;
  assert.equal(urlCount, 2);
});

test('newsSitemapXml: renders a valid, empty urlset for zero entries (a quiet news day is not a loader failure)', () => {
  const xml = newsSitemapXml([], 'https://915tldr.com');
  assert.match(xml, /<urlset[^>]*>[\s\S]*<\/urlset>/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 0);
});

test('newsSitemapXml: uses the sitemap 0.9 and Google News 0.9 namespaces', () => {
  const xml = newsSitemapXml([], 'https://915tldr.com');
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.match(xml, /xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);
});

// ---------------------------------------------------------------------------
// Dist-output checks (skip if unbuilt) — tests/unit/not-found.test.mjs's own convention
// ---------------------------------------------------------------------------

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

function countHtmlFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countHtmlFiles(path.join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      count += 1;
    }
  }
  return count;
}

test('news-sitemap: news-sitemap.xml exists, parses, and every loc maps to a real built article page', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('news-sitemap.xml'), 'expected dist/client/news-sitemap.xml to exist');
  const xml = readDist('news-sitemap.xml');
  assert.match(xml, /<urlset[^>]*>[\s\S]*<\/urlset>/, 'expected news-sitemap.xml to parse as a urlset');

  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    const relPath = loc.replace('https://915tldr.com', '');
    assert.ok(distFileExists(`${relPath}.html`), `expected ${loc} to map to a real built article page`);
  }

  const version = JSON.parse(readDist('version.json'));
  const builtAtMs = new Date(version.builtAt).getTime();
  const pubDates = [...xml.matchAll(/<news:publication_date>(.*?)<\/news:publication_date>/g)].map(
    (m) => new Date(m[1]).getTime()
  );
  for (const pubDateMs of pubDates) {
    const ageHours = (builtAtMs - pubDateMs) / (1000 * 60 * 60);
    assert.ok(ageHours <= 48, `expected publication_date within 48h of build, got ${ageHours.toFixed(1)}h`);
  }
});

test('news-sitemap: sitemap-index.xml exists and references at least one child sitemap', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('sitemap-index.xml'), 'expected dist/client/sitemap-index.xml to exist');
  const xml = readDist('sitemap-index.xml');
  const childLocs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.ok(childLocs.length >= 1, 'expected at least one child sitemap');
});

test('news-sitemap: across all sitemap children, URL count equals built HTML file count (minus 404.html), no trailing slashes except root, no /404', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const indexXml = readDist('sitemap-index.xml');
  const childLocs = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  const allSitemapUrls = [];
  for (const childLoc of childLocs) {
    const relPath = childLoc.replace('https://915tldr.com', '');
    const childXml = readDist(relPath.replace(/^\//, ''));
    const urls = [...childXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    allSitemapUrls.push(...urls);
  }

  const htmlFileCount = countHtmlFiles(DIST_CLIENT) - 1; // minus 404.html
  assert.equal(allSitemapUrls.length, htmlFileCount, 'expected sitemap URL count to equal built HTML page count minus 404');

  for (const url of allSitemapUrls) {
    const pathname = new URL(url).pathname;
    assert.ok(pathname === '/' || !pathname.endsWith('/'), `expected ${url} to carry no trailing slash`);
    assert.notEqual(pathname, '/404', 'expected /404 to never appear in the sitemap');
  }
});

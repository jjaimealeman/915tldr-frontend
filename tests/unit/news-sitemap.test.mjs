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
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';
import { staleDistReason, builtEsTagPagesAreNoindex, builtOptOutPagesExist } from '../helpers/dist-fresh.mjs';
import { OPT_OUT_PATHS } from '../../src/lib/opt-out.ts';

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
//
// 06-11 (I18N-06): `newsSitemapXml` now takes already-localised `{ path, title, publishedAt }`
// entries (not `ArticleData[]`) plus an optional `{ language }` — `newsEntry()` below builds the
// same `/category/slug-uuid` path the old fixture's `ArticleData` shape implied, so these cases
// stay otherwise unchanged.
// ---------------------------------------------------------------------------

/** `{ path, title, publishedAt }` — `newsSitemapXml`'s own input shape post-06-11. */
function newsEntry({ uuid, publishedAt, title = `Title ${uuid}`, categorySlug = 'crime', slug = `slug-${uuid}` }) {
  return { path: `/${categorySlug}/${slug}-${uuid}`, title, publishedAt };
}

test('newsSitemapXml: escapes & and < in titles', () => {
  const xml = newsSitemapXml(
    [newsEntry({ uuid: 'a', publishedAt: 1000, title: 'Crime & Punishment <redacted>' })],
    'https://915tldr.com'
  );
  assert.match(xml, /<news:title>Crime &amp; Punishment &lt;redacted&gt;<\/news:title>/);
  assert.doesNotMatch(xml, /Crime & Punishment/, 'raw & must not appear unescaped');
});

test('newsSitemapXml: emits one <url> per entry', () => {
  const xml = newsSitemapXml(
    [newsEntry({ uuid: 'a', publishedAt: 1000 }), newsEntry({ uuid: 'b', publishedAt: 900 })],
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

test('newsSitemapXml: defaults to <news:language>en</news:language> when no options are passed', () => {
  const xml = newsSitemapXml([newsEntry({ uuid: 'a', publishedAt: 1000 })], 'https://915tldr.com');
  assert.match(xml, /<news:language>en<\/news:language>/);
});

test('newsSitemapXml: { language: "es" } emits <news:language>es</news:language>', () => {
  const xml = newsSitemapXml(
    [newsEntry({ uuid: 'a', publishedAt: 1000 })],
    'https://915tldr.com',
    { language: 'es' }
  );
  assert.match(xml, /<news:language>es<\/news:language>/);
  assert.doesNotMatch(xml, /<news:language>en<\/news:language>/);
});

test('newsSitemapXml: an invalid language throws rather than silently coercing', () => {
  assert.throws(() => {
    newsSitemapXml([newsEntry({ uuid: 'a', publishedAt: 1000 })], 'https://915tldr.com', {
      // @ts-expect-error — deliberately invalid for this test
      language: 'fr',
    });
  });
});

test('newsSitemapXml: loc is built from entry.path, not category/slug/uuid fields', () => {
  const xml = newsSitemapXml(
    [{ path: '/es/crime/foo-uuid-1234', title: 'Título', publishedAt: 1000 }],
    'https://915tldr.com',
    { language: 'es' }
  );
  assert.match(xml, /<loc>https:\/\/915tldr\.com\/es\/crime\/foo-uuid-1234<\/loc>/);
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

// Post-phase-06 closeout: the expected URL count below now also subtracts the `/es/tag/*` pages
// (owner decision: noindex + dropped from the Spanish sitemap). A dist built BEFORE that change
// still lists them, so this cross-check reports a visible skip naming the stale source instead of
// asserting a count the old build cannot satisfy; it runs in full after any `pnpm build`.
const SITEMAP_COUNT_STALE = staleDistReason(
  [
    'src/pages/es/tag/[slug].astro',
    'src/pages/opt-out.astro',
    'src/pages/es/opt-out.astro',
    'src/lib/i18n/sitemap.ts',
    'astro.config.mjs',
  ],
  // "Shows the closeout behaviour" = BOTH changes are in the build (the tag noindex and the two
  // opt-out pages). A build from before either one cannot satisfy the new expected count.
  () => builtEsTagPagesAreNoindex() && builtOptOutPagesExist()
);

test('news-sitemap: across all sitemap children, URL count equals built HTML file count plus archived page count (minus 404.html and the deliberately unlisted pages), no trailing slashes except root, no /404', { skip: (!DIST_BUILT && SKIP_REASON) || SITEMAP_COUNT_STALE || false }, () => {
  const indexXml = readDist('sitemap-index.xml');
  const childLocs = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  const allSitemapUrls = [];
  for (const childLoc of childLocs) {
    const relPath = childLoc.replace('https://915tldr.com', '');
    const childXml = readDist(relPath.replace(/^\//, ''));
    const urls = [...childXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    allSitemapUrls.push(...urls);
  }

  // 05-06: the sitemap plugin runs during `astro build`, BEFORE tools/partition-archive.mjs moves
  // archive-tier article/tag pages out of dist/client — so every sitemap URL still names a page
  // this build rendered, whether it ended up served as a static asset (dist/client) or from R2
  // (dist/archive). "Static or archived" (same rule the other tests in this task apply): the
  // expected count is the static HTML file count PLUS the archived page count from
  // dist/archive-plan.json, not dist/client's file count alone.
  // 06-09: `plan.counts` keeps English and Spanish archived counts in SEPARATE fields
  // (`archivedArticles`/`archivedTags` vs. `archivedArticlesEs`/`archivedTagsEs` —
  // tools/partition-archive.mjs's own `planPartition` never merges them, since every other
  // consumer of the English-named fields expects an English-only count). `countHtmlFiles` above
  // recurses into every subdirectory, so it already counts BOTH languages' static files — the
  // archived-page addend must include both languages too, or this cross-check undercounts by
  // exactly the Spanish archived-page total.
  const planPath = path.join(REPO_ROOT, 'dist', 'archive-plan.json');
  let archivedPageCount = 0;
  if (existsSync(planPath)) {
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    archivedPageCount =
      (plan.counts?.archivedArticles ?? 0) +
      (plan.counts?.archivedTags ?? 0) +
      (plan.counts?.archivedArticlesEs ?? 0) +
      (plan.counts?.archivedTagsEs ?? 0);
  }

  // 06-10: a Spanish 404 page (`dist/client/es/404.html`) now exists alongside the English one —
  // the sitemap excludes BOTH (same "never list a 404" rule this test's own closing assertion
  // checks for the English one), so the subtraction below must count whichever 404 pages this
  // build actually produced, not a hardcoded "1".
  const notFoundPageCount = ['404.html', 'es/404.html'].filter((rel) => distFileExists(rel)).length;
  const htmlFileCount = countHtmlFiles(DIST_CLIENT) - notFoundPageCount;

  // 06-11 (I18N-06/D-05/T-06-42): an untranslated `/es` article page (English-fallback content
  // served under `/es`, already `noindex` at the page level) is now correctly EXCLUDED from every
  // sitemap file (`spanishSitemapExclusions`, `astro.config.mjs`'s `filter`) — a real, intended
  // drop, not a bug this cross-check should flag. The excluded count is read straight from the
  // same Spanish tier facts the exclusion itself keys off, covering both the hot (still in
  // `dist/client`) and archived (already moved to `dist/archive`) portions in one number, since
  // `writeArticleFactsEs` records every article regardless of tier.
  const tierFacts = readTierFacts();
  const untranslatedEsArticleCount = tierFacts.articlesEs.filter((entry) => !entry.translated).length;

  // Post-phase-06 closeout (owner decision 2026-10-07): every `/es/tag/<slug>` page is `noindex`
  // and filtered out of the sitemap by `isSitemapExcludedPath`. `tagsEs` records one fact per
  // Spanish tag page regardless of tier (hot or archived), so its length is exactly the number of
  // pages the filter removes — the same "read it from the facts the exclusion keys off" approach
  // the untranslated-article subtraction above uses.
  const excludedEsTagPageCount = tierFacts.tagsEs.length;

  // Task C: `/opt-out` and `/es/opt-out` are real built HTML pages (counted by `countHtmlFiles`)
  // that are noindex utility pages and deliberately absent from every sitemap file.
  const excludedOptOutPageCount = OPT_OUT_PATHS.length;

  assert.equal(
    allSitemapUrls.length,
    htmlFileCount + archivedPageCount - untranslatedEsArticleCount - excludedEsTagPageCount - excludedOptOutPageCount,
    'expected sitemap URL count to equal built HTML page count (minus 404 pages) plus archived page count, minus untranslated /es fallback articles (06-11 exclusion) minus the noindex /es/tag/* pages and minus the two opt-out utility pages (closeout exclusions)'
  );

  for (const url of allSitemapUrls) {
    const pathname = new URL(url).pathname;
    assert.ok(pathname === '/' || !pathname.endsWith('/'), `expected ${url} to carry no trailing slash`);
    assert.notEqual(pathname, '/404', 'expected /404 to never appear in the sitemap');
  }
});

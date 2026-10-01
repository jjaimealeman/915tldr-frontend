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
import { SOURCE_SLUG_RE } from '../../src/lib/article-url.ts';

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

// ---------------------------------------------------------------------------
// Tag pages, /tags, source pages (Task 3)
// ---------------------------------------------------------------------------

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

/** Every article HTML file under a category directory (`dist/client/<category>/<slug>-<uuid>.html`). */
function findArticleHtmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    for (const inner of readdirSync(full)) {
      const innerFull = path.join(full, inner);
      if (statSync(innerFull).isFile() && ARTICLE_FILE_RE.test(inner)) {
        found.push(innerFull);
      }
    }
  }
  return found;
}

function sampleEvenly(items, count) {
  if (items.length <= count) return items;
  const step = items.length / count;
  const sampled = [];
  for (let i = 0; i < count; i++) {
    sampled.push(items[Math.floor(i * step)]);
  }
  return sampled;
}

function tagSlugsIn(html) {
  return new Set([...html.matchAll(/<a href="\/tag\/([a-z0-9-]+)">/g)].map((m) => m[1]));
}

// 05-06 (Task 3, REND-09): a tag with 10+ articles stays static (`dist/client/tag/*.html`); every
// other tag renders once and moves to `dist/archive/tags/*.html` (tools/partition-archive.mjs) —
// together they must equal `.astro/tag-build-log.json`'s own authoritative `tagCount`, and
// `dist/client/tag` must hold EXACTLY the tags whose facts count >= 10 (D-08, inclusive at 10).
test('listing-pages: dist/client/tag + dist/archive/tags together equal the build-time authoritative tag count; dist/client/tag holds exactly the >=10-article tags', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const tagDir = path.join(DIST_CLIENT, 'tag');
  assert.ok(existsSync(tagDir), 'expected dist/client/tag/ to exist');
  const tagFiles = readdirSync(tagDir).filter((f) => f.endsWith('.html'));
  assert.ok(tagFiles.length > 0, 'expected at least one static tag page');

  const archiveTagDir = path.join(REPO_ROOT, 'dist', 'archive', 'tags');
  const archivedTagFiles = existsSync(archiveTagDir) ? readdirSync(archiveTagDir).filter((f) => f.endsWith('.html')) : [];

  // Cross-check against the exact count `tag/[slug].astro`'s own getStaticPaths computed at
  // build time (src/pages/tag/[slug].astro writes this — see that file's own comment).
  const buildLogPath = path.join(REPO_ROOT, '.astro', 'tag-build-log.json');
  assert.ok(existsSync(buildLogPath), 'expected .astro/tag-build-log.json to exist after a build');
  const buildLog = JSON.parse(readFileSync(buildLogPath, 'utf8'));
  assert.equal(
    tagFiles.length + archivedTagFiles.length,
    buildLog.tagCount,
    'static + archived tag page count must together match getStaticPaths\'s own authoritative count'
  );

  // D-08 precision: dist/client/tag holds EXACTLY the tags with a full article count >= 10 —
  // cross-checked against the build's own tier facts (one entry per tag, the full uncapped count).
  const tierFactsPath = path.join(REPO_ROOT, '.astro', 'tier-facts-tags.json');
  assert.ok(existsSync(tierFactsPath), 'expected .astro/tier-facts-tags.json to exist after a build');
  const tierFacts = JSON.parse(readFileSync(tierFactsPath, 'utf8'));
  const hotSlugs = new Set(tierFacts.entries.filter((e) => e.count >= 10).map((e) => e.slug));
  const staticSlugs = new Set(tagFiles.map((f) => f.replace(/\.html$/, '')));
  assert.equal(staticSlugs.size, hotSlugs.size, 'expected dist/client/tag to hold exactly the >=10-article tags');
  for (const slug of staticSlugs) {
    assert.ok(hotSlugs.has(slug), `dist/client/tag/${slug}.html exists but its fact count is < 10`);
  }

  // Sanity cross-check via sampling: every tag slug linked from a sample of up to 200 real
  // article pages must have its own built tag page, in EITHER tier. A partial sample can never
  // prove the full set of tag pages is *exactly* the full set of linked tags (most tags won't
  // appear in any given 200-article sample), but it does prove no sampled article links to a tag
  // with no page in either tier.
  const articleFiles = findArticleHtmlFiles(DIST_CLIENT).sort();
  const sample = sampleEvenly(articleFiles, 200);
  const archivedSlugSet = new Set(archivedTagFiles.map((f) => f.replace(/\.html$/, '')));
  for (const filePath of sample) {
    const html = readFileSync(filePath, 'utf8');
    for (const slug of tagSlugsIn(html)) {
      assert.ok(
        staticSlugs.has(slug) || archivedSlugSet.has(slug),
        `article ${path.relative(DIST_CLIENT, filePath)} links to /tag/${slug}, but neither dist/client/tag/${slug}.html nor dist/archive/tags/${slug}.html exists`
      );
    }
  }
});

test('listing-pages: a sampled tag page lists at most TAG_PAGE_COUNT cards, newest first', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const tagDir = path.join(DIST_CLIENT, 'tag');
  const tagFiles = readdirSync(tagDir).filter((f) => f.endsWith('.html'));
  assert.ok(tagFiles.length > 0, 'expected at least one tag page to sample');
  const html = readFileSync(path.join(tagDir, tagFiles[0]), 'utf8');

  const cardCount = countCards(html);
  assert.ok(cardCount <= 30, `expected at most 30 cards on a tag page, got ${cardCount}`);
  assertDescending(extractCardDatetimes(html), `tag page ${tagFiles[0]} cards`);
});

test('listing-pages: dist/client/tags.html has at most TAGS_INDEX_COUNT tag links', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('tags.html'), 'expected dist/client/tags.html to exist');
  const html = readDist('tags.html');
  const links = [...html.matchAll(/<a href="\/tag\/[a-z0-9-]+">/g)];
  assert.ok(links.length <= TAGS_INDEX_COUNT, `expected at most ${TAGS_INDEX_COUNT} tag links, got ${links.length}`);
  assert.equal(extractCanonical(html), 'https://915tldr.com/tags');
});

test('listing-pages: dist/client/source/ holds exactly 3 files', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const sourceDir = path.join(DIST_CLIENT, 'source');
  assert.ok(existsSync(sourceDir), 'expected dist/client/source/ to exist');
  const sourceFiles = readdirSync(sourceDir).filter((f) => f.endsWith('.html'));
  assert.equal(sourceFiles.length, 3, 'expected exactly 3 source pages (3 fixed RSS sources)');

  for (const file of sourceFiles) {
    const html = readFileSync(path.join(sourceDir, file), 'utf8');
    const cardCount = countCards(html);
    assert.ok(cardCount <= SOURCE_PAGE_COUNT, `expected at most ${SOURCE_PAGE_COUNT} cards on ${file}, got ${cardCount}`);
    assertDescending(extractCardDatetimes(html), `source page ${file} cards`);
    const expectedSlug = file.replace(/\.html$/, '');
    assert.equal(extractCanonical(html), `https://915tldr.com/source/${expectedSlug}`);
  }
});

// 04-followups (WR-01): `source/[slug].astro`'s getStaticPaths now validates every source slug
// against SOURCE_SLUG_RE before it becomes a file name — the same discipline TAG_SLUG_RE already
// applies to tag pages (`.planning/phases/04-static-generation-templates-seo/04-REVIEW.md`).
test('SOURCE_SLUG_RE: accepts lowercase-hyphen-digit slugs, rejects path-traversal and uppercase', () => {
  assert.match('ktsm', SOURCE_SLUG_RE);
  assert.match('el-paso-matters', SOURCE_SLUG_RE);
  assert.doesNotMatch('KTSM', SOURCE_SLUG_RE, 'uppercase must not match');
  assert.doesNotMatch('../etc/passwd', SOURCE_SLUG_RE, 'path traversal must not match');
  assert.doesNotMatch('source/slug', SOURCE_SLUG_RE, 'a slash must not match');
  assert.doesNotMatch('', SOURCE_SLUG_RE, 'empty string must not match');
});

test(
  'listing-pages: every built dist/client/source/*.html file name satisfies SOURCE_SLUG_RE (WR-01 guard proven against the real build)',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const sourceDir = path.join(DIST_CLIENT, 'source');
    const sourceFiles = readdirSync(sourceDir).filter((f) => f.endsWith('.html'));
    assert.ok(sourceFiles.length > 0, 'expected at least one built source page to check');
    for (const file of sourceFiles) {
      const slug = file.replace(/\.html$/, '');
      assert.match(slug, SOURCE_SLUG_RE, `built source page file name "${file}" must satisfy SOURCE_SLUG_RE`);
    }
  }
);

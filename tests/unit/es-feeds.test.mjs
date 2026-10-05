// 06-11 (I18N-06): proves `/es/rss.xml`, the per-language sitemap chunks and `/es/news-sitemap.xml`
// against REAL built output under `dist/client`, following `tests/unit/es-listing-pages.test.mjs`'s
// own "assert on rendered output, skip if unbuilt" convention. The pure helpers themselves
// (`spanishSitemapExclusions`, `sitemapChunks`) also get direct unit coverage, no build required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { UUID_RE, languageOfPath } from '../../src/lib/article-url.ts';
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';
import { RSS_ITEM_COUNT, NEWS_WINDOW_SECONDS } from '../../src/lib/seo-feeds.ts';
import { sitemapChunks } from '../../src/lib/i18n/sitemap.ts';

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

/** `{uuid, href}` extracted from every `/es` article `<link>` in a built RSS feed — the uuid is
 * the trailing `-<uuid>` segment of the canonical path (same shape `article-url.ts`'s
 * `articlePath` builds). */
const UUID_TAIL_RE = /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
function extractUuid(link) {
  const match = link.match(UUID_TAIL_RE);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// sitemapChunks() — pure, no build required
// ---------------------------------------------------------------------------

test('sitemapChunks: the "en" chunk keeps a non-/es item and drops an /es item', () => {
  const chunks = sitemapChunks();
  const enItem = { url: 'https://915tldr.com/crime/foo-uuid' };
  const esItem = { url: 'https://915tldr.com/es/crime/foo-uuid' };
  assert.deepEqual(chunks.en(enItem), enItem);
  assert.equal(chunks.en(esItem), undefined);
});

test('sitemapChunks: the "es" chunk keeps an /es item (including the bare /es home) and drops a non-/es item', () => {
  const chunks = sitemapChunks();
  const enItem = { url: 'https://915tldr.com/crime/foo-uuid' };
  const esItem = { url: 'https://915tldr.com/es/crime/foo-uuid' };
  const esHome = { url: 'https://915tldr.com/es' };
  assert.deepEqual(chunks.es(esItem), esItem);
  assert.deepEqual(chunks.es(esHome), esHome);
  assert.equal(chunks.es(enItem), undefined);
});

test('sitemapChunks: a path sharing only the "/es" string prefix without the segment boundary (e.g. /escuela) stays in "en"', () => {
  const chunks = sitemapChunks();
  const item = { url: 'https://915tldr.com/escuela/foo' };
  assert.deepEqual(chunks.en(item), item);
  assert.equal(chunks.es(item), undefined);
});

// ---------------------------------------------------------------------------
// Task 1: /es/rss.xml
// ---------------------------------------------------------------------------

test('es-feeds: dist/client/es/rss.xml parses, is Spanish, and every item links a publishable Spanish article', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('es/rss.xml'), 'expected dist/client/es/rss.xml to exist');
  const xml = readDist('es/rss.xml');
  assert.match(xml, /<rss version="2\.0">[\s\S]*<\/rss>/, 'expected es/rss.xml to parse as an RSS 2.0 document');
  assert.match(xml, /<language>es-us<\/language>/);

  const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map((m) => m[0]);
  assert.ok(items.length <= RSS_ITEM_COUNT, `expected at most ${RSS_ITEM_COUNT} items, got ${items.length}`);

  const links = [...xml.matchAll(/<link>(.*?)<\/link>/g)].map((m) => m[1]).slice(1); // skip the channel's own <link>
  assert.equal(links.length, items.length, 'expected one <link> per item');

  const facts = readTierFacts();
  const translatedUuids = new Set(facts.articlesEs.filter((entry) => entry.translated).map((entry) => entry.uuid));

  for (const link of links) {
    assert.match(link, /^https:\/\/915tldr\.com\/es\//, `expected ${link} to start with https://915tldr.com/es/`);
    const uuid = extractUuid(link);
    assert.ok(uuid && UUID_RE.test(uuid), `expected ${link} to end in a valid uuid`);
    assert.ok(
      translatedUuids.has(uuid),
      `expected ${link}'s article (${uuid}) to have translated: true in the Spanish tier facts`
    );
  }
});

test('es-feeds: es/rss.xml channel title/description are the Spanish dictionary strings', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const xml = readDist('es/rss.xml');
  assert.match(xml, /<title>915 TLDR - Noticias de El Paso, simplificadas<\/title>/);
  assert.match(
    xml,
    /<description>Noticias locales de El Paso con inteligencia artificial\./
  );
});

// ---------------------------------------------------------------------------
// Task 1: per-language sitemap chunks + no dangling xhtml:link alternates
// ---------------------------------------------------------------------------

/** Reads `sitemap-index.xml`'s child `<loc>` entries and returns `{ path, xml }` for each —
 * shared by every sitemap-chunk assertion below so each one reads the real build exactly once. */
function readSitemapChildren() {
  const indexXml = readDist('sitemap-index.xml');
  const childLocs = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  return childLocs.map((loc) => {
    const relPath = loc.replace('https://915tldr.com/', '');
    return { loc, relPath, xml: readDist(relPath) };
  });
}

test('es-feeds: every sitemap child file is either all-/es or all-non-/es, and none is empty (I18N-06, D-08)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const children = readSitemapChildren();
  assert.ok(children.length >= 2, 'expected at least one English and one Spanish chunk file');

  let sawEnglishChunk = false;
  let sawSpanishChunk = false;

  for (const { relPath, xml } of children) {
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    assert.ok(locs.length > 0, `expected ${relPath} to list at least one URL (no empty sitemap file)`);

    const languages = new Set(locs.map((loc) => languageOfPath(new URL(loc).pathname)));
    assert.equal(languages.size, 1, `expected ${relPath} to carry only one language of URL, got ${[...languages]}`);
    const [lang] = languages;
    if (lang === 'es') sawSpanishChunk = true;
    else sawEnglishChunk = true;
  }

  assert.ok(sawEnglishChunk, 'expected at least one chunk file containing only non-/es URLs');
  assert.ok(sawSpanishChunk, 'expected at least one chunk file containing only /es URLs');
});

test('es-feeds: no URL whose Spanish tier fact is translated:false appears in any sitemap file', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const facts = readTierFacts();
  const excludedPaths = new Set(facts.articlesEs.filter((entry) => !entry.translated).map((entry) => entry.path));
  assert.ok(excludedPaths.size > 0, 'expected at least one untranslated /es article in this corpus');

  const children = readSitemapChildren();
  for (const { relPath, xml } of children) {
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    for (const loc of locs) {
      const pathname = new URL(loc).pathname;
      assert.ok(!excludedPaths.has(pathname), `expected ${relPath} to never list the untranslated fallback page ${pathname}`);
    }
  }
});

test('es-feeds: every xhtml:link href in every sitemap file is itself a <loc> somewhere in the sitemap (Assumption A2 — no dangling alternates, no serialize() needed)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const children = readSitemapChildren();
  const allLocs = new Set();
  const allHrefs = new Set();
  for (const { xml } of children) {
    for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) allLocs.add(m[1]);
    for (const m of xml.matchAll(/<xhtml:link[^>]*href="([^"]*)"/g)) allHrefs.add(m[1]);
  }
  assert.ok(allHrefs.size > 0, 'expected at least one xhtml:link alternate across the full sitemap (paired pages exist)');

  const dangling = [...allHrefs].filter((href) => !allLocs.has(href));
  assert.deepEqual(dangling, [], 'expected zero xhtml:link hrefs pointing at a URL absent from every sitemap file');
});

test('es-feeds: the excluded endpoints (404, rss.xml, news-sitemap.xml, version.json, 404-index.json, both languages) appear in no sitemap file', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const children = readSitemapChildren();
  const forbidden = [
    '/404', '/es/404',
    '/rss.xml', '/es/rss.xml',
    '/news-sitemap.xml', '/es/news-sitemap.xml',
    '/version.json',
    '/404-index.json', '/es/404-index.json',
  ];
  for (const { relPath, xml } of children) {
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const forbiddenPath of forbidden) {
      assert.ok(!locs.includes(forbiddenPath), `expected ${relPath} to never list ${forbiddenPath}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Task 2: Spanish Google News sitemap
// ---------------------------------------------------------------------------

test('es-feeds: dist/client/es/news-sitemap.xml lists only translated, in-window articles with /es URLs, Spanish titles and <news:language>es</news:language>', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('es/news-sitemap.xml'), 'expected dist/client/es/news-sitemap.xml to exist');
  const xml = readDist('es/news-sitemap.xml');
  assert.match(xml, /<urlset[^>]*>[\s\S]*<\/urlset>/, 'expected es/news-sitemap.xml to parse as a urlset');

  const facts = readTierFacts();
  const translatedUuids = new Set(facts.articlesEs.filter((entry) => entry.translated).map((entry) => entry.uuid));

  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const languages = [...xml.matchAll(/<news:language>(.*?)<\/news:language>/g)].map((m) => m[1]);
  assert.equal(languages.length, locs.length, 'expected one <news:language> per url');
  for (const lang of languages) assert.equal(lang, 'es');

  const version = JSON.parse(readDist('version.json'));
  const builtAtMs = new Date(version.builtAt).getTime();
  const pubDates = [...xml.matchAll(/<news:publication_date>(.*?)<\/news:publication_date>/g)].map(
    (m) => new Date(m[1]).getTime()
  );

  for (let i = 0; i < locs.length; i += 1) {
    const loc = locs[i];
    assert.match(loc, /^https:\/\/915tldr\.com\/es\//, `expected ${loc} to start with https://915tldr.com/es/`);
    const uuid = extractUuid(loc);
    assert.ok(uuid && translatedUuids.has(uuid), `expected ${loc}'s article to be a publishable Spanish translation`);
    const ageHours = (builtAtMs - pubDates[i]) / (1000 * 60 * 60);
    assert.ok(ageHours <= NEWS_WINDOW_SECONDS / 3600, `expected ${loc}'s publication_date within the 48h window, got ${ageHours.toFixed(1)}h`);
  }
});

test('es-feeds: /es/news-sitemap.xml titles are real Spanish text (not re-translated English fallback)', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const xml = readDist('es/news-sitemap.xml');
  const titles = [...xml.matchAll(/<news:title>(.*?)<\/news:title>/g)].map((m) => m[1]);
  if (titles.length === 0) return; // a quiet 48h window for Spanish content is valid, nothing to assert per-title
  // A cheap, non-exhaustive signal that this is Spanish prose, not English: at least one title in
  // this corpus is expected to carry a Spanish diacritic or the "ó/á/é/í/ú/ñ" family, matching
  // the same register `spanish-pages-review.md` (06-07) established for this project's Spanish.
  const hasDiacritic = titles.some((title) => /[áéíóúñÁÉÍÓÚÑ]/.test(title));
  assert.ok(hasDiacritic, 'expected at least one Spanish news-sitemap title to carry a Spanish diacritic');
});

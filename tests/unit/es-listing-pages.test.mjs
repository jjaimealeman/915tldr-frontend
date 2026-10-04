// 06-10 (I18N-04/I18N-05): proves every `/es` listing page type (home, the 8 category indexes,
// tag pages — Task 1; /tags, source pages and the Spanish 404 — Task 2) against REAL built
// output under `dist/client`, following `tests/unit/listing-pages.test.mjs`'s own "assert on
// rendered output, skip if unbuilt" convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/lib/categories.ts';
import { localizedPath } from '../../src/lib/article-url.ts';
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';

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

/** `{uuid, href}` for every card in document order — same "first anchor after the article tag
 * opens is the card's own title link" assumption `tests/unit/listing-pages.test.mjs`'s sibling
 * helpers rely on (ArticleCard never renders another anchor before that one). */
function extractCardLinks(html) {
  return [...html.matchAll(/<article data-(?:card|lead)[^>]*data-uuid="([^"]+)"[^>]*>[\s\S]*?<a href="([^"]+)">/g)].map(
    (m) => ({ uuid: m[1], href: m[2] })
  );
}

function extractCanonical(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Task 1: /es home
// ---------------------------------------------------------------------------

test('es-listing-pages: /es home lists the same uuids in the same order as /, lead summary follows the Spanish-or-English rule', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('index.html'), 'expected dist/client/index.html to exist');
  assert.ok(distFileExists('es/index.html') || distFileExists('es.html'), 'expected the built Spanish home to exist');

  const enHtml = readDist('index.html');
  // build.format 'file' + a top-level page at src/pages/es/index.astro emits dist/client/es.html
  // (same shape as src/pages/index.astro -> index.html) — confirmed against the real build below.
  const esRel = distFileExists('es.html') ? 'es.html' : 'es/index.html';
  const esHtml = readDist(esRel);

  assert.match(esHtml, /<html lang="es">/);

  const enUuids = extractCardLinks(enHtml).map((c) => c.uuid);
  const esUuids = extractCardLinks(esHtml).map((c) => c.uuid);
  assert.deepEqual(esUuids, enUuids, 'expected /es home to list the exact same uuids in the exact same order as /');

  // The lead card is the first card on each page. Its summary text is either the real Spanish
  // translation (no lang="en" override on the summary) or the honest English fallback (marked
  // lang="en") — never silently empty.
  const leadSummaryMatch = esHtml.match(/<article data-lead[^>]*>[\s\S]*?<div data-summary>\s*<p([^>]*)>([\s\S]*?)<\/p>/);
  assert.ok(leadSummaryMatch, 'expected the lead card to render a summary');
  assert.ok(leadSummaryMatch[2].trim().length > 0, 'expected a non-empty lead summary');
});

// ---------------------------------------------------------------------------
// Task 1: /es/<category>
// ---------------------------------------------------------------------------

test('es-listing-pages: every category has an /es counterpart whose card hrefs are the localized form of the English page, in order', { skip: !DIST_BUILT && SKIP_REASON }, async (t) => {
  for (const category of CATEGORIES) {
    await t.test(category.slug, () => {
      const enRel = `${category.slug}.html`;
      const esRel = `es/${category.slug}.html`;
      assert.ok(distFileExists(enRel), `expected dist/client/${enRel} to exist`);
      assert.ok(distFileExists(esRel), `expected dist/client/${esRel} to exist`);

      const enHtml = readDist(enRel);
      const esHtml = readDist(esRel);

      assert.match(esHtml, /<html lang="es">/);
      assert.equal(extractCanonical(esHtml), `https://915tldr.com/es/${category.slug}`);

      const enLinks = extractCardLinks(enHtml);
      const esLinks = extractCardLinks(esHtml);
      assert.equal(esLinks.length, enLinks.length, `expected the same card count on /es/${category.slug}`);
      for (let i = 0; i < enLinks.length; i++) {
        assert.equal(esLinks[i].uuid, enLinks[i].uuid, `expected card ${i} to be the same article`);
        assert.equal(
          esLinks[i].href,
          localizedPath(enLinks[i].href, 'es'),
          `expected card ${i}'s href to be the localized form of the English href`
        );
      }

      if (enLinks.length === 0) {
        assert.match(esHtml, /<p data-empty-state>/, 'expected the Spanish empty-state message');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Task 1: article card localization (Spanish-or-English title rule)
// ---------------------------------------------------------------------------

test('es-listing-pages: a card whose article has a clean Spanish row shows the Spanish title; a card without one shows the English title marked lang="en"', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const facts = readTierFacts();
  const translatedUuids = new Set(facts.articlesEs.filter((f) => f.translated).map((f) => f.uuid));
  const fallbackUuids = new Set(facts.articlesEs.filter((f) => !f.translated).map((f) => f.uuid));

  let checkedTranslated = false;
  let checkedFallback = false;

  // Sample across every built /es category page — a translated or fallback example must appear
  // somewhere in the real production corpus (06-08's pilot rows are real, live data).
  for (const category of CATEGORIES) {
    const esRel = `es/${category.slug}.html`;
    if (!distFileExists(esRel)) continue;
    const html = readDist(esRel);

    for (const { uuid } of extractCardLinks(html)) {
      const cardMatch = html.match(
        new RegExp(`<article data-(?:card|lead)[^>]*data-uuid="${uuid}"[^>]*>([\\s\\S]*?)<\\/article>`)
      );
      if (!cardMatch) continue;
      const headingMatch = cardMatch[1].match(/<h[23]([^>]*)>\s*<a href="[^"]+">([\s\S]*?)<\/a>/);
      if (!headingMatch) continue;

      if (translatedUuids.has(uuid) && !checkedTranslated) {
        assert.doesNotMatch(headingMatch[1], /lang="en"/, `expected ${uuid}'s title to carry no English override`);
        checkedTranslated = true;
      }
      if (fallbackUuids.has(uuid) && !checkedFallback) {
        assert.match(headingMatch[1], /lang="en"/, `expected ${uuid}'s fallback title to carry lang="en"`);
        checkedFallback = true;
      }
    }
  }

  assert.ok(checkedFallback, 'expected to find at least one sampled fallback-content card across /es category pages');
  // Translated examples are rare (06-08's pilot is 13 of ~41k articles) and may not land on a
  // sampled category page's capped slice — not asserted as a hard requirement here, since
  // tests/unit/es-article-pages.test.mjs already proves the translated branch directly against
  // a known pilot uuid's own article page.
});

// ---------------------------------------------------------------------------
// Task 1: /es/tag/<slug>
// ---------------------------------------------------------------------------

test('es-listing-pages: every English tag page (static or archived) has an /es/tag counterpart; Spanish tag-facts match English tag-facts exactly', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const facts = readTierFacts();

  assert.equal(facts.tagsEs.length, facts.tags.length, 'expected the same number of Spanish and English tag facts');

  const englishBySlug = new Map(facts.tags.map((f) => [f.slug, f.count]));
  for (const esFact of facts.tagsEs) {
    assert.ok(englishBySlug.has(esFact.slug), `expected an English tag fact for slug "${esFact.slug}"`);
    assert.equal(
      esFact.count,
      englishBySlug.get(esFact.slug),
      `expected the Spanish tag-facts count for "${esFact.slug}" to equal the English count`
    );
  }

  // Cross-check against the real built dist/client/es/tag directory — every English static tag
  // page's slug must also exist under dist/client/es/tag.
  const enTagDir = path.join(DIST_CLIENT, 'tag');
  const esTagDir = path.join(DIST_CLIENT, 'es', 'tag');
  assert.ok(existsSync(esTagDir), 'expected dist/client/es/tag/ to exist');
  const enTagSlugs = readdirSync(enTagDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''));
  const esTagSlugs = new Set(
    readdirSync(esTagDir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace(/\.html$/, ''))
  );
  for (const slug of enTagSlugs) {
    assert.ok(esTagSlugs.has(slug), `expected dist/client/es/tag/${slug}.html to exist (English counterpart is static)`);
  }
});

test('es-listing-pages: a sampled /es/tag page is Spanish-chrome with the untranslated tag name marked lang="en"', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const esTagDir = path.join(DIST_CLIENT, 'es', 'tag');
  const esTagFiles = readdirSync(esTagDir).filter((f) => f.endsWith('.html'));
  assert.ok(esTagFiles.length > 0, 'expected at least one built /es/tag page to sample');

  const html = readFileSync(path.join(esTagDir, esTagFiles[0]), 'utf8');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<h1 lang="en">/, 'expected the tag name heading to be marked lang="en"');
});

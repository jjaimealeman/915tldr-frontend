// Post-phase-06 closeout, task A (owner decision 2026-10-07, 06-VERIFICATION.md "Owner decisions"
// #3): the 20,105 `/es/tag/*` URLs are NOT indexable while their cards are mostly English
// fallback. They render `noindex`, are dropped from the Spanish sitemap, and — because a noindex
// page must never be advertised as a language alternate — their English twins (`/tag/*`) declare
// `self` alternates instead of an `es` pair. This is exactly the held-article precedent
// (`enArticleLanguageModel`: no clean translation -> `'self'`).
//
// Layers, cheapest first:
//   1. pure decision (`tagPageSeo`) and the sitemap predicate — always run, no build needed.
//   2. source wiring — both tag templates must actually use that decision.
//   3. full-corpus rendered HTML (static AND archived) + the real sitemap files — need a dist built
//      after these sources were last edited (see tests/helpers/dist-fresh.mjs); otherwise a VISIBLE
//      skip naming the stale source, never a silent pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tagPageSeo } from '../../src/lib/i18n/tag-page.ts';
import { isSitemapExcludedPath, sitemapChunks } from '../../src/lib/i18n/sitemap.ts';
import { alternateLinks } from '../../src/lib/i18n/hreflang.ts';
import { staleDistReason, builtEsTagPagesAreNoindex } from '../helpers/dist-fresh.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_ARCHIVE = path.join(REPO_ROOT, 'dist', 'archive');
const ARCHIVE_PLAN_PATH = path.join(REPO_ROOT, 'dist', 'archive-plan.json');

// ---------------------------------------------------------------------------
// 1. Pure decisions
// ---------------------------------------------------------------------------

test('tagPageSeo: a Spanish tag page is noindex with no alternates; an English tag page is indexable with self alternates only', () => {
  assert.deepEqual(tagPageSeo('es'), { noindex: true, alternates: 'none' });
  assert.deepEqual(tagPageSeo('en'), { noindex: false, alternates: 'self' });
});

test('tagPageSeo: throws on an invalid language, never guesses', () => {
  assert.throws(() => tagPageSeo('fr'), /language/i);
  assert.throws(() => tagPageSeo(undefined), /language/i);
});

test('tagPageSeo (en): feeding it to alternateLinks emits en + x-default and NO es entry', () => {
  const links = alternateLinks({
    canonicalPath: '/tag/downtown',
    lang: 'en',
    mode: tagPageSeo('en').alternates,
    origin: 'https://915tldr.com',
  });
  assert.deepEqual(
    links.map((l) => l.hreflang),
    ['en', 'x-default']
  );
});

test('isSitemapExcludedPath: every /es/tag/<slug> is excluded; the rest of the Spanish surface and all English tag pages are not', () => {
  assert.equal(isSitemapExcludedPath('/es/tag/downtown'), true);
  assert.equal(isSitemapExcludedPath('/es/tag/a-b-c'), true);
  // Kept, per the owner decision and the task scope:
  assert.equal(isSitemapExcludedPath('/es/tags'), false);
  assert.equal(isSitemapExcludedPath('/es/source/ktsm'), false);
  assert.equal(isSitemapExcludedPath('/es'), false);
  assert.equal(isSitemapExcludedPath('/es/crime/some-story-0d1f2a3b-0000-4000-8000-000000000000'), false);
  // English tag pages stay in the English sitemap:
  assert.equal(isSitemapExcludedPath('/tag/downtown'), false);
  assert.equal(isSitemapExcludedPath('/tags'), false);
  // Segment-exact: a look-alike must not be swallowed.
  assert.equal(isSitemapExcludedPath('/es/tagline'), false);
  assert.equal(isSitemapExcludedPath('/es/tag'), false);
});

test('sitemapChunks still partitions by language only — exclusion is the filter\'s job, not the chunker\'s', () => {
  const chunks = sitemapChunks();
  const item = { url: 'https://915tldr.com/es/tag/downtown' };
  assert.deepEqual(chunks.es(item), item);
  assert.equal(chunks.en(item), undefined);
});

// ---------------------------------------------------------------------------
// 2. Source wiring
// ---------------------------------------------------------------------------

function source(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

test('src/pages/es/tag/[slug].astro and src/pages/tag/[slug].astro both take their robots/hreflang props from tagPageSeo()', () => {
  for (const [rel, lang] of [
    ['src/pages/es/tag/[slug].astro', 'es'],
    ['src/pages/tag/[slug].astro', 'en'],
  ]) {
    const src = source(rel);
    assert.match(src, /import \{ tagPageSeo \} from '[^']*i18n\/tag-page\.ts'/, `${rel} must import tagPageSeo`);
    assert.match(src, new RegExp(`\\{\\.\\.\\.tagPageSeo\\('${lang}'\\)\\}`), `${rel} must spread tagPageSeo('${lang}') onto <Base>`);
  }
});

test('astro.config.mjs sitemap filter drops paths through isSitemapExcludedPath()', () => {
  const src = source('astro.config.mjs');
  assert.match(src, /isSitemapExcludedPath\(pathname\)/);
  assert.match(src, /import \{[^}]*isSitemapExcludedPath[^}]*\} from '\.\/src\/lib\/i18n\/sitemap\.ts'/);
});

// ---------------------------------------------------------------------------
// 3. Full-corpus rendered output (static + archived) and the real sitemap files
// ---------------------------------------------------------------------------

const STALE = staleDistReason(
  [
    'src/pages/es/tag/[slug].astro',
    'src/pages/tag/[slug].astro',
    'src/lib/i18n/tag-page.ts',
    'src/lib/i18n/sitemap.ts',
    'astro.config.mjs',
  ],
  builtEsTagPagesAreNoindex
);

function walkHtml(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) out.push(...walkHtml(full).map((p) => path.join(entry, p)));
    else if (info.isFile() && entry.endsWith('.html')) out.push(entry);
  }
  return out.map((p) => p.split(path.sep).join('/'));
}

/** `{ path, absFile }` for every built tag page (both languages), static and archived. */
function tagPages() {
  const pages = [];
  for (const rel of walkHtml(path.join(DIST_CLIENT, 'tag'))) {
    pages.push({ path: `/tag/${rel.replace(/\.html$/, '')}`, absFile: path.join(DIST_CLIENT, 'tag', rel) });
  }
  for (const rel of walkHtml(path.join(DIST_CLIENT, 'es', 'tag'))) {
    pages.push({ path: `/es/tag/${rel.replace(/\.html$/, '')}`, absFile: path.join(DIST_CLIENT, 'es', 'tag', rel) });
  }
  if (existsSync(ARCHIVE_PLAN_PATH)) {
    const plan = JSON.parse(readFileSync(ARCHIVE_PLAN_PATH, 'utf8'));
    for (const entry of plan.entries) {
      if (/^\/(es\/)?tag\//.test(entry.path)) {
        pages.push({ path: entry.path, absFile: path.join(DIST_ARCHIVE, entry.key) });
      }
    }
  }
  return pages;
}

const hasNoindex = (html) => /<meta name="robots" content="noindex"\s*\/?>/.test(html);
const alternatesOf = (html) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => ({
    hreflang: m[1],
    href: m[2],
  }));

test(
  'tag-noindex: every built /es/tag page (static AND archived) is noindex with no alternates; every English /tag page declares en + x-default only',
  { skip: STALE ?? false },
  () => {
    const pages = tagPages();
    const esPages = pages.filter((p) => p.path.startsWith('/es/tag/'));
    const enPages = pages.filter((p) => p.path.startsWith('/tag/'));
    assert.ok(esPages.length > 1000, `expected a large real /es/tag corpus, got ${esPages.length}`);
    assert.equal(enPages.length, esPages.length, 'English and Spanish tag page counts must match (D-02: tags are identity)');

    const failures = [];
    for (const { path: pagePath, absFile } of esPages) {
      const html = readFileSync(absFile, 'utf8');
      if (!hasNoindex(html)) failures.push(`${pagePath}: Spanish tag page is indexable`);
      if (alternatesOf(html).length > 0) failures.push(`${pagePath}: noindex Spanish tag page declares alternates`);
    }
    for (const { path: pagePath, absFile } of enPages) {
      const html = readFileSync(absFile, 'utf8');
      if (hasNoindex(html)) failures.push(`${pagePath}: English tag page must stay indexable`);
      const langs = alternatesOf(html).map((a) => a.hreflang);
      if (langs.join(',') !== 'en,x-default') {
        failures.push(`${pagePath}: expected alternates [en, x-default], got [${langs.join(', ')}]`);
      }
    }
    assert.deepEqual(failures.slice(0, 20), [], `${failures.length} tag-page robots/hreflang violation(s)`);
  }
);

test(
  'tag-noindex: no sitemap file lists an /es/tag/ URL or offers one as an xhtml:link alternate; /es/tags and English tag URLs are still listed',
  { skip: STALE ?? false },
  () => {
    const indexXml = readFileSync(path.join(DIST_CLIENT, 'sitemap-index.xml'), 'utf8');
    const children = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace('https://915tldr.com/', ''));
    assert.ok(children.length >= 2);

    let sawEnglishTag = false;
    let sawEsTagsIndex = false;
    for (const rel of children) {
      const xml = readFileSync(path.join(DIST_CLIENT, rel), 'utf8');
      assert.doesNotMatch(xml, /https:\/\/915tldr\.com\/es\/tag\//, `${rel} must not mention any /es/tag/ URL (loc or xhtml:link)`);
      if (/<loc>https:\/\/915tldr\.com\/tag\//.test(xml)) sawEnglishTag = true;
      if (/<loc>https:\/\/915tldr\.com\/es\/tags<\/loc>/.test(xml)) sawEsTagsIndex = true;
    }
    assert.ok(sawEnglishTag, 'English /tag/ URLs must remain in the English sitemap');
    assert.ok(sawEsTagsIndex, '/es/tags (the index) must remain in the Spanish sitemap');
  }
);

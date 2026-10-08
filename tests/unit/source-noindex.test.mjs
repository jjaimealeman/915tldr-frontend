// Post-phase-06 polish, task B (owner decision 2026-10-07/08, "agreed, yes"): the `/es/source/*`
// pages follow the Spanish tag pages (tests/unit/tag-noindex.test.mjs). A Spanish source page lists
// cards whose titles/summaries are mostly the English fallback, so it is `noindex`, carries NO
// alternates, and is dropped from the Spanish sitemap; because a noindex page must never be
// advertised as a language alternate, its English twin (`/source/<slug>`) declares `self`
// alternates (en + x-default, no `es`).
//
// Unlike tags, source pages are never archived: there are only a handful (one per RSS source),
// they are always static files under dist/client, and `archive-plan.json` has no `source` kind. So
// the "archived objects wait ~2 builds for re-upload" window that applies to tags does not apply.
//
// Layers, cheapest first: (1) pure decision + sitemap predicate, always run; (2) source wiring;
// (3) rendered HTML + real sitemap files, gated on a fresh dist (tests/helpers/dist-fresh.mjs) —
// a VISIBLE skip against a stale dist, never a silent pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { sourcePageSeo, tagPageSeo } from '../../src/lib/i18n/tag-page.ts';
import { isSitemapExcludedPath, sitemapChunks } from '../../src/lib/i18n/sitemap.ts';
import { alternateLinks } from '../../src/lib/i18n/hreflang.ts';
import { staleDistReason, builtEsSourcePagesAreNoindex } from '../helpers/dist-fresh.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');

// ---------------------------------------------------------------------------
// 1. Pure decisions
// ---------------------------------------------------------------------------

test('sourcePageSeo: a Spanish source page is noindex with no alternates; an English source page is indexable with self alternates only', () => {
  assert.deepEqual(sourcePageSeo('es'), { noindex: true, alternates: 'none' });
  assert.deepEqual(sourcePageSeo('en'), { noindex: false, alternates: 'self' });
});

test('sourcePageSeo: throws on an invalid language, never guesses', () => {
  assert.throws(() => sourcePageSeo('fr'), /language/i);
  assert.throws(() => sourcePageSeo(undefined), /language/i);
});

test('generalising the helper did not change tag behaviour', () => {
  assert.deepEqual(tagPageSeo('es'), { noindex: true, alternates: 'none' });
  assert.deepEqual(tagPageSeo('en'), { noindex: false, alternates: 'self' });
});

test('sourcePageSeo (en): feeding it to alternateLinks emits en + x-default and NO es entry', () => {
  const links = alternateLinks({
    canonicalPath: '/source/kvia',
    lang: 'en',
    mode: sourcePageSeo('en').alternates,
    origin: 'https://915tldr.com',
  });
  assert.deepEqual(
    links.map((l) => l.hreflang),
    ['en', 'x-default']
  );
});

test('isSitemapExcludedPath: every /es/source/<slug> is excluded; the rest of the surface (including /es/tags and English source pages) is not', () => {
  assert.equal(isSitemapExcludedPath('/es/source/kvia'), true);
  assert.equal(isSitemapExcludedPath('/es/source/el-paso-matters'), true);
  // Kept:
  assert.equal(isSitemapExcludedPath('/es/tags'), false);
  assert.equal(isSitemapExcludedPath('/es'), false);
  assert.equal(isSitemapExcludedPath('/es/crime/some-story-0d1f2a3b-0000-4000-8000-000000000000'), false);
  assert.equal(isSitemapExcludedPath('/source/kvia'), false);
  // Segment-exact: look-alikes and deeper paths must not be swallowed.
  assert.equal(isSitemapExcludedPath('/es/source'), false);
  assert.equal(isSitemapExcludedPath('/es/sources'), false);
  assert.equal(isSitemapExcludedPath('/es/sourcefoo/kvia'), false);
  assert.equal(isSitemapExcludedPath('/es/source/kvia/extra'), false);
  // Tags are still excluded, exactly as before:
  assert.equal(isSitemapExcludedPath('/es/tag/downtown'), true);
});

test('sitemapChunks still partitions by language only — exclusion is the filter\'s job', () => {
  const chunks = sitemapChunks();
  const item = { url: 'https://915tldr.com/es/source/kvia' };
  assert.deepEqual(chunks.es(item), item);
  assert.equal(chunks.en(item), undefined);
});

// ---------------------------------------------------------------------------
// 2. Source wiring
// ---------------------------------------------------------------------------

test('src/pages/es/source/[slug].astro and src/pages/source/[slug].astro both take their robots/hreflang props from sourcePageSeo()', () => {
  for (const [rel, lang] of [
    ['src/pages/es/source/[slug].astro', 'es'],
    ['src/pages/source/[slug].astro', 'en'],
  ]) {
    const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.match(src, /import \{ sourcePageSeo \} from '[^']*i18n\/tag-page\.ts'/, `${rel} must import sourcePageSeo`);
    assert.match(src, new RegExp(`\\{\\.\\.\\.sourcePageSeo\\('${lang}'\\)\\}`), `${rel} must spread sourcePageSeo('${lang}') onto <Base>`);
  }
});

// ---------------------------------------------------------------------------
// 3. Rendered output and the real sitemap files (fresh dist only)
// ---------------------------------------------------------------------------

const STALE = staleDistReason(
  [
    'src/pages/es/source/[slug].astro',
    'src/pages/source/[slug].astro',
    'src/lib/i18n/tag-page.ts',
    'src/lib/i18n/sitemap.ts',
  ],
  builtEsSourcePagesAreNoindex
);

const htmlIn = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')) : [];
const hasNoindex = (html) => /<meta name="robots" content="noindex"\s*\/?>/.test(html);
const alternatesOf = (html) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => m[1]);

test(
  'source-noindex: every built /es/source page is noindex with no alternates; every English /source page declares en + x-default only',
  { skip: STALE ?? false },
  () => {
    const esFiles = htmlIn(path.join(DIST_CLIENT, 'es', 'source'));
    const enFiles = htmlIn(path.join(DIST_CLIENT, 'source'));
    assert.ok(esFiles.length >= 3, `expected the real source pages, got ${esFiles.length}`);
    assert.deepEqual(esFiles.sort(), enFiles.sort(), 'English and Spanish source pages must be the same set');

    const failures = [];
    for (const f of esFiles) {
      const html = readFileSync(path.join(DIST_CLIENT, 'es', 'source', f), 'utf8');
      if (!hasNoindex(html)) failures.push(`/es/source/${f}: Spanish source page is indexable`);
      if (alternatesOf(html).length > 0) failures.push(`/es/source/${f}: noindex page declares alternates`);
    }
    for (const f of enFiles) {
      const html = readFileSync(path.join(DIST_CLIENT, 'source', f), 'utf8');
      if (hasNoindex(html)) failures.push(`/source/${f}: English source page must stay indexable`);
      const langs = alternatesOf(html);
      if (langs.join(',') !== 'en,x-default') failures.push(`/source/${f}: expected [en, x-default], got [${langs.join(', ')}]`);
    }
    assert.deepEqual(failures, []);
  }
);

test(
  'source-noindex: no sitemap file lists an /es/source/ URL or offers one as an xhtml:link alternate; English /source/ URLs and /es/tags are still listed',
  { skip: STALE ?? false },
  () => {
    const indexXml = readFileSync(path.join(DIST_CLIENT, 'sitemap-index.xml'), 'utf8');
    const children = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace('https://915tldr.com/', ''));
    assert.ok(children.length >= 2);
    let sawEnglishSource = false;
    let sawEsTagsIndex = false;
    for (const rel of children) {
      const xml = readFileSync(path.join(DIST_CLIENT, rel), 'utf8');
      assert.doesNotMatch(xml, /https:\/\/915tldr\.com\/es\/source\//, `${rel} must not mention any /es/source/ URL (loc or xhtml:link)`);
      if (/<loc>https:\/\/915tldr\.com\/source\//.test(xml)) sawEnglishSource = true;
      if (/<loc>https:\/\/915tldr\.com\/es\/tags<\/loc>/.test(xml)) sawEsTagsIndex = true;
    }
    assert.ok(sawEnglishSource, 'English /source/ URLs must remain in the English sitemap');
    assert.ok(sawEsTagsIndex, '/es/tags (the index) must remain in the Spanish sitemap');
  }
);

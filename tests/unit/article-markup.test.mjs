// 04-04 (Task 3): proves the full approved article template — AI disclosure, outlet attribution,
// tags, structured data and canonical — against REAL built article pages under `dist/client`, not
// the source template. Follows `tests/tracer/tracer.test.mjs`'s sampling pattern (one outer test,
// per-file `t.test` subtests) and `tests/unit/build-stamp.test.mjs`/`chrome.test.mjs`'s
// `findArticleHtmlFiles`/skip-reason conventions for the `<slug>-<uuid>.html` output shape
// (`build.format: 'file'`).
//
// Scope note (T-04-17 / must_haves "Attribution appears exactly once per article"): the
// exactly-one-disclosure/exactly-one-attribution assertions are scoped to WITHIN the article's own
// `<article data-reading-column>` element, not the whole document — `src/layouts/Base.astro`
// (04-02) renders its own separate, site-wide `[data-attribution]` statement in the page footer on
// every page type (`Summaries of reporting by KTSM, KVIA...`), which is a distinct concept from a
// single article's own outlet attribution and is not part of this plan's scope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { textOf, decodeEntities } from '../helpers/html-text.mjs';
import { readBuiltPage } from '../helpers/built-page.mjs';
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';
import { t } from '../../src/lib/i18n/dictionary.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';
const SAMPLE_SIZE = 25;

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

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

/** Evenly-spaced sample across the sorted file list — not the first N (which would only ever
 * exercise the same handful of categories/dates), and not random (non-reproducible). */
function sampleEvenly(items, count) {
  if (items.length <= count) return items;
  const step = items.length / count;
  const sampled = [];
  for (let i = 0; i < count; i++) {
    sampled.push(items[Math.floor(i * step)]);
  }
  return sampled;
}

function extractArticleRegion(html) {
  const match = html.match(/<article data-uuid="[^"]+" data-category="[^"]+" data-reading-column>([\s\S]*?)<\/article>/);
  assert.ok(match, 'expected an <article data-reading-column> block');
  return match[1];
}

function extractJsonLdNodes(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1])
  );
}

test(
  'article-markup: sampled article pages carry the full trust surface and structured data',
  { skip: !DIST_BUILT && SKIP_REASON },
  async (t) => {
    const files = findArticleHtmlFiles(DIST_CLIENT).sort();
    assert.ok(files.length > 0, 'expected at least one built article HTML file under dist/client');
    const sample = sampleEvenly(files, SAMPLE_SIZE);

    for (const filePath of sample) {
      const relPath = path.relative(DIST_CLIENT, filePath);

      await t.test(relPath, () => {
        const html = readFileSync(filePath, 'utf8');
        const articleHtml = extractArticleRegion(html);

        // Exactly one disclosure / attribution within the article's own trust surface.
        const disclosureMatches = articleHtml.match(/<p data-ai-disclosure>/g) ?? [];
        const attributionMatches = articleHtml.match(/<p data-attribution>/g) ?? [];
        assert.equal(disclosureMatches.length, 1, 'expected exactly one AI disclosure inside the article');
        assert.equal(attributionMatches.length, 1, 'expected exactly one attribution inside the article');

        // Exactly one canonical link; href equals origin + this file's own path (no .html).
        const canonicalMatches = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
        assert.equal(canonicalMatches.length, 1, 'expected exactly one canonical link');
        const expectedPath = `/${relPath.replace(/\.html$/, '')}`;
        assert.equal(canonicalMatches[0][1], `https://915tldr.com${expectedPath}`);

        // Exactly one NewsArticle, one BreadcrumbList; no Person node anywhere.
        const jsonLdNodes = extractJsonLdNodes(html);
        const newsArticleNodes = jsonLdNodes.filter((n) => n['@type'] === 'NewsArticle');
        const breadcrumbNodes = jsonLdNodes.filter((n) => n['@type'] === 'BreadcrumbList');
        const personNodes = jsonLdNodes.filter((n) => n['@type'] === 'Person');
        assert.equal(newsArticleNodes.length, 1, 'expected exactly one NewsArticle node');
        assert.equal(breadcrumbNodes.length, 1, 'expected exactly one BreadcrumbList node');
        assert.equal(personNodes.length, 0, 'expected no Person node anywhere in JSON-LD');
        const newsArticle = newsArticleNodes[0];

        // disclosure href === attribution href === NewsArticle.isBasedOn.url, and it's http(s).
        const disclosureHrefMatch = articleHtml.match(/<p data-ai-disclosure>[\s\S]*?<a href="([^"]+)"/);
        const attributionHrefMatch = articleHtml.match(/<p data-attribution>[\s\S]*?<a href="([^"]+)"/);
        assert.ok(disclosureHrefMatch, 'expected an href on the disclosure link');
        assert.ok(attributionHrefMatch, 'expected an href on the attribution link');
        assert.equal(disclosureHrefMatch[1], newsArticle.isBasedOn.url);
        assert.equal(attributionHrefMatch[1], newsArticle.isBasedOn.url);
        assert.match(disclosureHrefMatch[1], /^https?:\/\//, 'disclosure href must be http(s)');

        // Outlet name agreement: disclosure text, attribution link text, [data-source] text.
        const sourceMatch = articleHtml.match(/<span data-source>([^<]*)<\/span>/);
        assert.ok(sourceMatch, 'expected a [data-source] element');
        const sourceName = decodeEntities(sourceMatch[1]);

        const disclosureTextMatch = articleHtml.match(/<p data-ai-disclosure>([\s\S]*?)<a /);
        assert.ok(disclosureTextMatch, 'expected disclosure text before its link');
        assert.ok(
          textOf(disclosureTextMatch[1]).includes(sourceName),
          `disclosure text should name the source "${sourceName}"`
        );

        const attributionLinkTextMatch = articleHtml.match(
          /<p data-attribution>Original reporting: <a[^>]*>([\s\S]*?)<svg/
        );
        assert.ok(attributionLinkTextMatch, 'expected the attribution link text before its icon');
        assert.equal(textOf(attributionLinkTextMatch[1]).trim(), sourceName);

        // Document order: body < disclosure < attribution < tags (when present) < rail (when
        // present). Computed against the full document since the rail is a sibling of <article>,
        // not nested inside it (design/mockups/article.html's own structure).
        const bodyIndex = html.indexOf('data-article-body');
        const disclosureIndex = html.indexOf('data-ai-disclosure');
        const attributionIndex = html.indexOf('data-attribution');
        const tagsIndex = html.indexOf('data-tags');
        const railIndex = html.indexOf('data-rail');
        assert.ok(bodyIndex >= 0, 'expected a data-article-body element');
        assert.ok(disclosureIndex > bodyIndex, 'body must precede disclosure');
        assert.ok(attributionIndex > disclosureIndex, 'disclosure must precede attribution');
        let lastGateIndex = attributionIndex;
        if (tagsIndex !== -1) {
          assert.ok(tagsIndex > attributionIndex, 'attribution must precede tags');
          lastGateIndex = tagsIndex;
        }
        if (railIndex !== -1) {
          assert.ok(railIndex > lastGateIndex, 'tags (or attribution, if no tags) must precede the rail');
        }

        // headline === decoded h1 text.
        const h1Match = articleHtml.match(/<h1>([\s\S]*?)<\/h1>/);
        assert.ok(h1Match, 'expected an <h1>');
        assert.equal(textOf(h1Match[1]), newsArticle.headline);

        // keywords absent when there is no tags section.
        if (tagsIndex === -1) {
          assert.ok(
            !('keywords' in newsArticle),
            'expected no keywords property on NewsArticle when there is no tags section'
          );
        }

        // Every time[datetime] renders a real Mountain-Time UTC offset (-06:00 MDT or -07:00 MST)
        // — never a bare Z or a host-zone offset.
        const datetimes = [...html.matchAll(/<time datetime="([^"]+)"/g)].map((m) => m[1]);
        assert.ok(datetimes.length > 0, 'expected at least one <time datetime> element');
        for (const dt of datetimes) {
          assert.match(dt, /-0[67]:00$/, `datetime "${dt}" should end in -06:00 or -07:00`);
        }
      });
    }
  }
);

// ---------------------------------------------------------------------------
// 06-09 Task 2: disclosure parity across BOTH languages and BOTH tiers (static + archived).
// English pages are enumerated from dist/client directly (above); Spanish pages — and any
// archived page of either language — are read through tests/helpers/built-page.mjs, which
// checks dist/client first and falls back to dist/archive via dist/archive-plan.json. Sampled
// (not exhaustive — ~81k built article pages exist) the same way the suite above samples English
// pages, for the same runtime reason.
// ---------------------------------------------------------------------------

const ES_SAMPLE_SIZE = 20;

test(
  'article-markup: disclosure parity — sampled /es article pages (static or archived) carry exactly one Spanish [data-ai-disclosure], naming the outlet and linking the original URL',
  { skip: !DIST_BUILT && SKIP_REASON },
  async (t) => {
    const facts = readTierFacts();
    const sortedEs = [...facts.articlesEs].sort((a, b) => a.uuid.localeCompare(b.uuid));
    const sample = sampleEvenly(sortedEs, ES_SAMPLE_SIZE);
    assert.ok(sample.length > 0, 'expected at least one /es tier fact');

    const articleByUuid = new Map(facts.articles.map((f) => [f.uuid, f]));

    for (const esFact of sample) {
      await t.test(esFact.path, () => {
        const html = readBuiltPage(esFact.path);
        assert.ok(html, `expected a built page at ${esFact.path} (static or archived)`);

        const articleHtml = extractArticleRegion(html);
        const disclosureMatches = articleHtml.match(/<p data-ai-disclosure>/g) ?? [];
        assert.equal(disclosureMatches.length, 1, 'expected exactly one AI disclosure inside the article');

        const jsonLdNodes = extractJsonLdNodes(html);
        const newsArticleNodes = jsonLdNodes.filter((n) => n['@type'] === 'NewsArticle');
        assert.equal(newsArticleNodes.length, 1, 'expected exactly one NewsArticle node');
        const sourceUrl = newsArticleNodes[0].isBasedOn.url;

        const disclosureHrefMatch = articleHtml.match(/<p data-ai-disclosure>[\s\S]*?<a href="([^"]+)"/);
        assert.ok(disclosureHrefMatch, 'expected an href on the disclosure link');
        assert.equal(disclosureHrefMatch[1], sourceUrl);

        // Spanish text present only when the page is actually translated; the D-05 fallback
        // still carries the SPANISH disclosure (I18N-09) even though its headline/body are
        // English — this phrase is rendered on every /es page, translated or not.
        assert.ok(
          articleHtml.includes('redactado por IA'),
          'expected the Spanish AI-disclosure phrase on every /es page'
        );

        const englishFact = articleByUuid.get(esFact.uuid);
        assert.ok(englishFact, `expected an English tier fact for ${esFact.uuid}`);
      });
    }
  }
);

// ---------------------------------------------------------------------------
// 06-09 Task 2 (D-07): "Originally reported in Spanish" — a structural consistency check
// across a sample of built English pages. Which specific production uuids carry
// sourceLanguage: 'es' is not knowable from this unit test (no D1 access here) — this proves
// internal consistency (the label and the lang/hreflang attributes always appear TOGETHER or
// NOT AT ALL), which is what the pure `enArticleLanguageModel` unit tests
// (tests/unit/article-page-model.test.mjs) already prove for the underlying decision logic.
// ---------------------------------------------------------------------------

test(
  'article-markup: D-07 — the "Originally reported in Spanish" label and the source link\'s lang/hreflang="es" always appear together, never independently',
  { skip: !DIST_BUILT && SKIP_REASON },
  async (t) => {
    const files = findArticleHtmlFiles(DIST_CLIENT).sort();
    const sample = sampleEvenly(files, SAMPLE_SIZE);

    for (const filePath of sample) {
      const relPath = path.relative(DIST_CLIENT, filePath);
      await t.test(relPath, () => {
        const html = readFileSync(filePath, 'utf8');
        const articleHtml = extractArticleRegion(html);

        const hasLabel = articleHtml.includes('data-source-language');
        const attributionMatch = articleHtml.match(/<p data-attribution>[\s\S]*?<\/p>/);
        assert.ok(attributionMatch, 'expected an attribution paragraph');
        const sourceLinkMatch = attributionMatch[0].match(/<a href="[^"]+"([^>]*)>/);
        assert.ok(sourceLinkMatch, 'expected a source link inside the attribution paragraph');
        const sourceLinkAttrs = sourceLinkMatch[1];
        const hasSourceLangAttrs =
          sourceLinkAttrs.includes('lang="es"') && sourceLinkAttrs.includes('hreflang="es"');

        assert.equal(
          hasLabel,
          hasSourceLangAttrs,
          `D-07 label presence (${hasLabel}) must match source-link lang/hreflang="es" presence (${hasSourceLangAttrs})`
        );

        if (hasLabel) {
          assert.ok(
            articleHtml.includes(t('originallySpanish', 'en')),
            'expected the exact dictionary string when the label is present'
          );
        }
      });
    }
  }
);

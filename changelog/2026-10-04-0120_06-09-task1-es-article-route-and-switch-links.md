# 2026-10-04 - Plan 06-09 Task 1: the /es article route, pure page model, and EN/ES switch links

**Keywords:** [FRONTEND] [I18N] [SEO] [TESTING]
**Session:** Late night / early morning, Duration (~2 hours including a full real build)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0120_06-09-task1-es-article-route-and-switch-links.md`

## What Changed

- File: `src/lib/i18n/article-page.ts` (new)
  - `esArticlePageModel(article, esEntry, rail)` — the pure render model for the `/es` article
    route: a clean (`available: true`) Spanish entry renders as Spanish, `translated: true`,
    `alternates: 'paired'`; a held/missing entry (or one whose text fails block validation)
    degrades to the article's own English content under a visible D-05 fallback note, `noindex:
    true`, `alternates: 'none'` — never a build crash.
  - `enArticleLanguageModel(article, esEntry)` — the English article page's small counterpart:
    `alternates: 'paired'` + `esPath` only when a clean translation exists; `'self'` otherwise
    (pairing hreflang with the English-fallback `/es` page would be an incorrect pair).
- File: `src/pages/es/[category]/[slug].astro` (new)
  - One `/es/<category>/<slug>-<uuid>` page per public English article (D-06). Spanish category
    label and byline, a "Read in English" link, the D-05 fallback note when untranslated, the
    Spanish AI disclosure/attribution, tags linking `/es/tag/<slug>` (untranslated, `lang="en"`),
    and rail neighbour cards via `localizedArticleView` (Spanish title when publishable, English
    marked `lang="en"` otherwise). Writes `.astro/tier-facts-articles-es.json` (feeds the existing
    archive-partition pipeline from 06-04) and logs one `[es-article] pages=... translated=...
    fallback=... invalidSpanish=...` line per build.
- File: `src/pages/[category]/[slug].astro` (modified)
  - Reads `articlesEs` alongside `articles` in `getStaticPaths()`, extends `cacheKey` with the
    article's own Spanish digest, and adds an unconditional "Leer en español" link (D-12 — every
    English article has an `/es` mirror, translated or an honest fallback) plus the `alternates`
    prop so a translated article's English page correctly declares the hreflang pair.
- File: `tests/unit/article-page-model.test.mjs` (new) — 7 pure-function tests covering every
  behavior branch (translated, held, no-entry, invalid-Spanish-degrades, and both
  `enArticleLanguageModel` branches).
- File: `tests/unit/es-article-pages.test.mjs` (new) — 3 tests against real built output: tier-fact
  parity (40,688 English articles = 40,688 `/es` facts, every path correctly prefixed), a real
  06-08 pilot "clean" uuid renders Spanish/paired/indexable, a real pilot "held" uuid renders the
  honest fallback (noindex, visible note, English content marked `lang="en"`).
- File: `tests/helpers/built-page.mjs` (new) — `readBuiltPage(canonicalPath)`, reading a page from
  either `dist/client` (hot) or `dist/archive` via `dist/archive-plan.json` (archive tier) — needed
  because several of the 06-08 pilot uuids turned out to be old enough to already be archive-tier.

## Why

Ships the core of I18N-02/03/04/05/09 for the article page: the page type readers actually arrive
on from search. Every public article now exists in Spanish — a real translation when one is clean,
or an honest, indexable-when-ready fallback when it isn't — built directly on 06-04's tier-facts
writer, 06-05's dictionary/hreflang/Base.astro plumbing, and 06-06's `articlesEs` collection, with
zero new D1 access from any page (`spanish-view.ts`/`article-page.ts` carry no `src/lib/server/`
imports).

## Issues Encountered

None. A real `pnpm run build` against production D1 confirmed the intended shape on the first
attempt: 40,688 articles, 40,688 matching `/es` tier facts, 13 translated (exactly the 06-08
pilot's 13 `clean` rows), 0 `invalidSpanish` degradations.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: all 10 new tests pass (7 pure-function, 3 against real built output using real
  06-08 pilot production data); the pre-existing `article-markup.test.mjs` (25 sampled English
  article pages) still passes unmodified, confirming the English page's new props/markup didn't
  regress its existing trust-surface contract.
- What wasn't tested: JSON-LD `inLanguage` and the Spanish breadcrumb (Task 2, separate commit);
  the D-07 "Originally reported in Spanish" label (Task 2); `pnpm run test:regression` byte-identity
  (runs as part of Task 2's verify, after the rail-heading dictionary work lands).
- Edge cases: an available Spanish entry whose summary fails block validation (constructed directly
  in the unit test, since the real zod-validated loader can never produce one) degrades to the
  fallback instead of crashing the build.

## Next Steps

- [ ] Task 2: `structured-data.ts` `inLanguage`, the D-07 label on the English page, Spanish rail
      headings via the dictionary, and the cross-page disclosure-parity test
- [ ] 06-10+ wires remaining page types (category/tag/source/static pages) into the same pattern

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** HIGH - every public article now has a live `/es` mirror; this is the core reader-facing
surface of the bilingual phase.

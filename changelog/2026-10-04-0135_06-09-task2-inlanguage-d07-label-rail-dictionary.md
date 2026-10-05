# 2026-10-04 - Plan 06-09 Task 2: JSON-LD inLanguage, the D-07 label, Spanish rail headings, and two pre-existing tests fixed for the new /es pages

**Keywords:** [FRONTEND] [I18N] [SEO] [TESTING] [BUG_FIX]
**Session:** Late night / early morning, Duration (~2 hours including two full real builds and a regression run)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0135_06-09-task2-inlanguage-d07-label-rail-dictionary.md`

## What Changed

- File: `src/lib/structured-data.ts`
  - `NewsArticleNode`/`NewsArticleNodeInput` gained `inLanguage?: 'en' | 'es'` (default `'en'`,
    byte-identical to before when omitted). `/es` pages now pass `model.contentLang` — `'es'` only
    when a clean translation is actually rendered, still `'en'` on a D-05 fallback page since the
    headline/description are the article's own English text there.
- File: `src/pages/es/[category]/[slug].astro`
  - Added `NewsArticleNode`/`BreadcrumbList` JSON-LD (both through `toSafeJsonLd`, no second
    escaper — T-06-33). The breadcrumb uses Spanish names (`t('home', 'es')`, `categoryLabel`) and
    `/es` paths throughout.
- File: `src/pages/[category]/[slug].astro`
  - D-07: when the article's Spanish entry reports `sourceLanguage: 'es'` (available OR held — the
    label is about the ORIGINAL source, not the translation), the attribution paragraph gains
    `· Originally reported in Spanish`, the source-name link carries `lang="es" hreflang="es"`, and
    the disclosure's read-the-original link carries `hreflang="es"`. `sourceLanguage` added to the
    page's `cacheKey`.
  - Rail headings ("More in {category}", "Earlier", the rail's aria-label) now read through
    `t('railMoreIn'/'railEarlier'/'railMoreStoriesLabel', 'en', ...)` instead of a hardcoded
    literal — same rendered text, but the `/es` page can now render its own language's heading
    through the identical call shape. Confirmed byte-identical via `pnpm run test:regression`.
- File: `src/lib/i18n/dictionary.ts` — added `home: { en: 'Home', es: 'Inicio' }` (the Spanish
  breadcrumb's first item).
- File: `src/lib/rail.ts` — doc-comment only: explains why `RailResult.secondHeading` stays an
  English literal (templates look up their own language's heading via the dictionary directly) —
  zero behavior change, confirmed against `tests/unit/rail.test.mjs` (unmodified, still 12/12).
- File: `tests/unit/structured-data.test.mjs` — 3 new tests for `inLanguage` (default, explicit
  `'es'`, and a Spanish headline containing `</script><script>` through `toSafeJsonLd`).
- File: `tests/unit/article-markup.test.mjs` — 2 new tests: disclosure parity across BOTH languages
  and BOTH tiers (static + archived, via the new `tests/helpers/built-page.mjs`), and a D-07
  structural-consistency check (the label and the source link's `lang`/`hreflang="es"` always
  appear together or not at all — ground truth isn't knowable from a unit test with no D1 access,
  so this proves internal consistency; `tests/unit/article-page-model.test.mjs` already proves the
  underlying decision logic for both branches).
- File: `tests/unit/es-article-pages.test.mjs` — 1 new test: sampled `/es` pages with a rail show
  Spanish headings ("Más en...", "Anteriores", "Más historias") with zero English rail text
  leaking through.
- File: `tests/unit/tier-facts.test.mjs` (Rule 1 fix) — `dist/archive-plan.json`'s article entries
  now include BOTH languages (06-04's `articleArchiveKey(uuid, 'es')` entries), so this file's
  English-scoped cross-checks (`archivedArticleUuids`, `archivedArticlePaths`, the archived-count
  tally) now explicitly exclude `/es/`-prefixed plan entries — they compare against the
  English-only `articles` tier facts and must stay English-only themselves.
- File: `tests/unit/news-sitemap.test.mjs` (Rule 1 fix) — `plan.counts` keeps English and Spanish
  archived counts in separate fields (`archivedArticles`/`archivedTags` vs.
  `archivedArticlesEs`/`archivedTagsEs`); the sitemap URL-count cross-check now sums all four,
  since the recursive `countHtmlFiles` helper it compares against already counts both languages'
  static files.

## Why

Completes 06-09's remaining must-haves: correct per-language JSON-LD, the D-07 honest-attribution
label for Spanish-origin sources, and Spanish rail headings — plus catches and fixes two real,
pre-existing tests whose own assumptions (built HTML/sitemap counts are English-only) broke the
moment a real `/es` article route started producing real build output at scale (40,688 new pages).

## Issues Encountered

**Two pre-existing tests failed against the first post-06-09 build** (`tests/unit/tier-facts.test.mjs`,
`tests/unit/news-sitemap.test.mjs`) — both compared an English-only count against a count that now
silently included Spanish entries from `dist/archive-plan.json` (which 06-04 already extended to
carry both languages). Root-caused and fixed in this commit (Rule 1 — directly caused by this
plan's own change, not pre-existing unrelated breakage): `tier-facts.test.mjs`'s archived-count
helpers now filter out `/es/`-prefixed plan entries explicitly; `news-sitemap.test.mjs`'s
archived-page tally now sums both language's dedicated `plan.counts` fields instead of only the
English ones.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run test:fast` (970/970 pass, full existing suite including both fixed
  tests), `pnpm run test:build-gate` (9/9), `pnpm run test:regression` (5/5, including the
  criterion-3 byte-identity check across two consecutive real builds — confirms the rail-heading
  dictionary refactor changed zero English output bytes), two real `pnpm run build` runs against
  production D1, and `pnpm run typecheck` (0 errors, 0 warnings — the 2 "hints" and the non-zero
  exit code are the same pre-existing `astro check`/`assert-no-d1.mjs` tooling characteristic
  06-05-SUMMARY.md already documented, unrelated to this plan's changes).
- What wasn't tested: the exact production uuids with `sourceLanguage: 'es'` (D-07) are not
  knowable from a unit test with no D1 access — covered by a structural consistency check plus
  the pure-function unit tests for the underlying decision logic.
- Edge cases: a Spanish headline containing a literal `</script><script>` serialises safely
  through `toSafeJsonLd` with no second escaper.

## Next Steps

- [ ] 06-10+ wires remaining page types (category/tag/source/static pages) into the same
      language-pair pattern this plan established for articles
- [ ] 06-13's go-live decision on the bulk Spanish backfill (pending, per 06-08-SUMMARY.md)

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** HIGH - completes the bilingual article page (both languages, correct structured data,
honest source attribution); the two test fixes prevent a silently-broken CI signal on every future
build once real `/es` content exists at scale.

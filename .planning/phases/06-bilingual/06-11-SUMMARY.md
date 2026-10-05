---
phase: 06-bilingual
plan: 11
subsystem: seo
tags: [astro, i18n, sitemap, rss, google-news, seo, hreflang]

# Dependency graph
requires:
  - phase: 06-bilingual (06-04)
    provides: "ARTICLE_FACTS_ES_PATH / tier-facts.ts (readTierFacts, translated flag)"
  - phase: 06-bilingual (06-05/06-06)
    provides: "t()/dictionary.ts, buildEsIndex/localizedArticleView/categoryLabel (spanish-view.ts), articlePath(..., 'es')"
  - phase: 06-bilingual (06-07/06-09/06-10)
    provides: "every /es page type (static, article, listing, 404) whose paths this plan's sitemap now lists or excludes"
provides:
  - "/es/rss.xml — Spanish RSS feed, only publishable Spanish translations (D-05)"
  - "/es/news-sitemap.xml — Spanish Google News sitemap (D-08 discretion), same 48h window as English"
  - "astro.config.mjs's sitemap() integration: per-language sitemap chunk files (sitemap-en-*.xml / sitemap-es-*.xml) via a new src/lib/i18n/sitemap.ts (spanishSitemapExclusions, sitemapChunks)"
  - "Untranslated /es fallback article pages excluded from every sitemap file (D-05/T-06-42) — a real, measured fix: ~40,691 pages dropped from the Spanish sitemap in this corpus"
  - "seo-feeds.ts's newsSitemapXml parameterised by language, English output byte-identical"
affects: [06-12-full-corpus-gate, 06-bilingual-go-live-decision]

# Actuals (#2632)
actuals:
  tokens: 14500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@astrojs/sitemap's chunks/i18n options (available since 3.7.0, previously unused) now drive per-language sitemap files and xhtml:link alternates, instead of a hand-rolled split"
    - "A sitemap exclusion set is read lazily, once per build, inside the sitemap integration's own filter() callback (astro:build:done) — always safe because getStaticPaths for every page (including the one that writes the facts this reads) resolves before that hook fires, never because of an explicit ordering dependency the config declares"
    - "newsSitemapXml takes an already-localised { path, title, publishedAt } shape rather than ArticleData[] directly, so the module itself never needs to import anything Spanish-specific — each caller (English or Spanish route) localises before calling in"

key-files:
  created:
    - src/lib/i18n/sitemap.ts
    - src/pages/es/rss.xml.ts
    - src/pages/es/news-sitemap.xml.ts
    - tests/unit/es-feeds.test.mjs
  modified:
    - astro.config.mjs
    - src/lib/seo-feeds.ts
    - src/pages/news-sitemap.xml.ts
    - public/robots.txt
    - tests/unit/astro-config.test.mjs
    - tests/unit/news-sitemap.test.mjs
    - tests/unit/seo-surfaces.test.mjs
    - tests/unit/no-auto-language.test.mjs

key-decisions:
  - "Assumption A2 resolved by direct observation on a real build: filter() alone (extended to drop spanishSitemapExclusions() paths) is sufficient to prevent any dangling xhtml:link alternate — @astrojs/sitemap computes i18n pairs from whichever URLs survive filter, so an excluded fallback page's English counterpart simply finds no Spanish URL to pair with. No serialize() step was added; a real build confirmed zero dangling hrefs across 80,861 sitemap URLs."
  - "The plan's own 'Flagged assumption' (sitemapChunks() yielding 'exactly two' chunk files) does not hold literally at this corpus's real scale: both languages' URL counts (~60k each) exceed @astrojs/sitemap's 45,000-per-file default, so English splits into two files (sitemap-en-0.xml, sitemap-en-1.xml) alongside one Spanish file (sitemap-es-0.xml) — three files total, not two. The actual requirement (every file is single-language, none empty, no cross-language leakage) is fully met; only the plan's anticipatory file-count prose was imprecise, as it itself flagged as unresolved."
  - "newsSitemapXml's entries are localised ArticleData-agnostic objects ({ path, title, publishedAt }), not ArticleData[] with a language flag — keeps the module itself free of any Spanish-specific import, matching this project's established 'language-aware callers, language-agnostic library' pattern (spanish-view.ts's own header comment)."
  - "I18N-06 is marked complete by this plan alone (not deferred to 06-12, unlike I18N-04/05's multi-plan precedent) — its full text ('separate sitemaps and RSS feeds exist per language') is now true and verified against the REAL full corpus build (121,554 pages), with no remaining page type or gate left to extend it."

patterns-established:
  - "A build-time-scratch-facts exclusion set, memoized per module-load inside the sitemap config's own filter callback, is the template for any future sitemap-time decision that depends on data only known after pages render."

requirements-completed: [I18N-06]

coverage:
  - id: D1
    description: "/es/rss.xml is valid RSS with <language>es-us</language>, Spanish channel title/description, only publishable-Spanish articles, newest first, at most RSS_ITEM_COUNT, each item's /es canonical uuid having translated:true in the Spanish tier facts; /rss.xml unchanged"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: dist/client/es/rss.xml parses, is Spanish, and every item links a publishable Spanish article — live build"
        status: pass
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: es/rss.xml channel title/description are the Spanish dictionary strings — live build"
        status: pass
      - kind: integration
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: rss.xml has at most 30 items... — live build, unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "sitemap-index.xml lists separate per-language sitemap files: every Spanish-named chunk contains only /es URLs, every English-named chunk contains none, and no listed file is empty"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: every sitemap child file is either all-/es or all-non-/es, and none is empty — live build (sitemap-en-0.xml, sitemap-en-1.xml, sitemap-es-0.xml)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Untranslated (D-05 fallback, noindex) /es article URLs appear in no sitemap; every xhtml:link alternate resolves to a real <loc> in the sitemap (no dangling alternate)"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: no URL whose Spanish tier fact is translated:false appears in any sitemap file — live build, 40,691 real exclusions"
        status: pass
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: every xhtml:link href in every sitemap file is itself a <loc> somewhere in the sitemap (Assumption A2) — live build, zero dangling across 80,861 URLs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The existing sitemap exclusions still hold: no 404, rss.xml, news-sitemap.xml, version.json or 404-index.json URL (either language) in any sitemap file"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: the excluded endpoints... appear in no sitemap file — live build"
        status: pass
    human_judgment: false
  - id: D5
    description: "/es/news-sitemap.xml lists translated articles from the 48h window with <news:language>es</news:language> and Spanish titles; /news-sitemap.xml keeps <news:language>en</news:language>, produced by the same parameterised function"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/es-feeds.test.mjs#es-feeds: dist/client/es/news-sitemap.xml lists only translated, in-window articles with /es URLs, Spanish titles and <news:language>es</news:language> — live build"
        status: pass
      - kind: unit
        ref: "tests/unit/news-sitemap.test.mjs#newsSitemapXml: defaults to <news:language>en</news:language> when no options are passed / { language: 'es' } emits es — 2/2 pass"
        status: pass
    human_judgment: false
  - id: D6
    description: "robots.txt advertises /es/news-sitemap.xml alongside the existing sitemap lines"
    requirement: "I18N-06"
    verification:
      - kind: integration
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: robots.txt names the v2 sitemap index, the English news sitemap and the Spanish news sitemap, and only those — live build"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 11: Per-Language Feeds and Sitemaps Summary

**Spanish readers and search engines now get their own RSS feed, their own sitemap files and their own Google News sitemap — and, as a direct consequence of the filter that makes that true, ~40,691 untranslated English-fallback pages that were previously (06-10) silently listed under `/es` in the sitemap are now correctly excluded.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-10-04
- **Tasks:** 2 of 2
- **Files modified:** 12 (4 new, 8 modified)

## Accomplishments

- `src/pages/es/rss.xml.ts` (new) ships the Spanish RSS feed: joins `articles` with `articlesEs`,
  keeps only articles with a publishable Spanish version (D-05, `translated: true`), newest first,
  capped at `RSS_ITEM_COUNT`, `<language>es-us</language>`, Spanish title/summary/category label,
  `/es` links. The English feed (`src/pages/rss.xml.ts`) is untouched.
- `src/lib/i18n/sitemap.ts` (new) provides `spanishSitemapExclusions()` (the set of untranslated
  `/es` article paths, read once per build from the Spanish tier facts) and `sitemapChunks()`
  (`@astrojs/sitemap`'s `chunks` option, partitioning every URL by `languageOfPath`).
  `astro.config.mjs`'s `sitemap()` call now excludes those paths via `filter` and emits separate
  per-language chunk files with `i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } }`
  turning on `xhtml:link` alternates.
- **Assumption A2 resolved by a real build, not assumed**: because `@astrojs/sitemap` computes
  `xhtml:link` pairs from whichever URLs survive `filter` (before the pairing step runs), excluding
  an untranslated fallback page automatically leaves its English counterpart unpaired too — no
  dangling alternate ever exists, confirmed by directly parsing all three real chunk files
  (`sitemap-en-0.xml`, `sitemap-en-1.xml`, `sitemap-es-0.xml`, 80,861 URLs, 40,170 `xhtml:link`
  hrefs, zero dangling). No `serialize()` step was needed.
- **A real, measured correctness fix, not just new surface**: this plan's exclusion logic dropped
  ~40,691 untranslated `/es` article pages from the sitemap that 06-10 had been listing (every
  `/es` article page, translated or not, was previously sitemap-indexable even though the
  untranslated ones are `noindex` at the page level — a real Search-Console-visible inconsistency
  this plan closes).
- `src/lib/seo-feeds.ts`'s `newsSitemapXml` is now parameterised: takes `{ path, title,
  publishedAt }` entries (not `ArticleData[]`) plus an optional `{ language: 'en' | 'es' }`
  (default `'en'`, validated via `assertLanguage`). `src/pages/news-sitemap.xml.ts` (English) was
  updated to the new signature with byte-identical output; `src/pages/es/news-sitemap.xml.ts`
  (new) is its Spanish mirror — same 48h window, only publishable translations, `/es` paths,
  Spanish titles, `<news:language>es</news:language>`.
- `public/robots.txt` now advertises `Sitemap: https://915tldr.com/es/news-sitemap.xml` alongside
  the existing two lines.
- `tests/unit/es-feeds.test.mjs` (new, 11 tests) proves every behavior bullet above against the
  real build plus direct unit coverage of `sitemapChunks()`.
- **Two pre-existing tests fixed (Rule 1 — see Deviations)**: `tests/unit/no-auto-language.test.mjs`'s
  blanket "no top-level i18n key" regex, which would have false-flagged this plan's own legitimate
  (and unrelated) `@astrojs/sitemap` `i18n` option; and `tests/unit/news-sitemap.test.mjs`'s
  sitemap/built-file-count cross-check, which needed to account for the newly-excluded untranslated
  pages.

## Task Commits

Each task was committed atomically via `/jja-commit`:

1. **Task 1: Tracer — a real build emits /es/rss.xml and a Spanish sitemap file that lists only genuinely Spanish /es pages** - `90fda90` (feat)
2. **Task 2: Spanish Google News sitemap via a parameterised news function, and robots.txt** - `6e08133` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Task 1 is `type="tracer"`. Jaime pre-approved auto-continuing tracer feedback gates whose
evidence is fully automated (2026-10-03). Task 1's own `<verify>` (a real build +
`node --test tests/unit/es-feeds.test.mjs tests/unit/news-sitemap.test.mjs
tests/unit/seo-surfaces.test.mjs tests/unit/astro-config.test.mjs`) passed fully before commit, so
the gate was re-run and logged "tracer gate auto-continued per Jaime's standing approval
(2026-10-03)" — no checkpoint was returned, execution proceeded directly to Task 2._

## Files Created/Modified

- `src/lib/i18n/sitemap.ts` - new, `spanishSitemapExclusions()`/`sitemapChunks()`
- `src/pages/es/rss.xml.ts` - new, Spanish RSS feed
- `src/pages/es/news-sitemap.xml.ts` - new, Spanish Google News sitemap
- `tests/unit/es-feeds.test.mjs` - new, 11 tests
- `astro.config.mjs` - sitemap() filter/chunks/i18n
- `src/lib/seo-feeds.ts` - `newsSitemapXml` parameterised by language
- `src/pages/news-sitemap.xml.ts` - updated to new signature, byte-identical output
- `public/robots.txt` - added `/es/news-sitemap.xml` line
- `tests/unit/astro-config.test.mjs` - sitemap() chunks/i18n/filter shape assertions
- `tests/unit/news-sitemap.test.mjs` - signature update + cross-check fix (Rule 1)
- `tests/unit/seo-surfaces.test.mjs` - robots.txt exact-lines update
- `tests/unit/no-auto-language.test.mjs` - i18n-regex scoping fix (Rule 1)

## Decisions Made

See `key-decisions` in the frontmatter. In brief: filter-based exclusion alone resolves Assumption
A2 (no `serialize()` needed, confirmed live); the real build yields three sitemap chunk files, not
the plan's anticipated two, because both languages' URL counts exceed the package's 45,000-per-file
default — the actual per-language-partition requirement is still fully met; `newsSitemapXml`
stays language-agnostic by taking pre-localised entries; and I18N-06 is marked complete by this
plan alone, since its full text is now true and verified against the real full corpus.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import path typo in `src/lib/seo-feeds.ts`**
- **Found during:** Task 1's first real build attempt (`[UNRESOLVED_IMPORT] Could not resolve
  '../article-url.ts'`).
- **Issue:** `seo-feeds.ts` and `article-url.ts` are siblings in `src/lib/`; the new import used
  `../article-url.ts` (one level up) instead of `./article-url.ts`.
- **Fix:** Corrected to `./article-url.ts`.
- **Files modified:** `src/lib/seo-feeds.ts`
- **Commit:** `90fda90` (Task 1 commit)

**2. [Rule 1 - Bug] `tests/unit/no-auto-language.test.mjs`'s blanket `i18n:` regex would have
false-flagged this plan's own legitimate change**
- **Found during:** Task 1, before the first full test run (traced through the test's own stated
  mechanism rather than discovered by a failure, since the fix was applied proactively once the
  conflict was recognized).
- **Issue:** The 06-05 test forbids a top-level Astro `i18n` routing key (D-13) via
  `assert.doesNotMatch(stripped, /\bi18n\s*:/)` over the WHOLE file — no way to distinguish that
  from `@astrojs/sitemap`'s own, unrelated `i18n` option this plan nests inside the `sitemap(...)`
  call.
- **Fix:** Added a depth-counted `findCallArgSpan` helper (matching `astro-config.test.mjs`'s own
  `extractCloudflareCallArgSource` technique) to excise the `sitemap(...)` call's argument span
  before running the check; added a sanity-check test proving the exclusion doesn't silently hide
  a real violation.
- **Files modified:** `tests/unit/no-auto-language.test.mjs` (not in this plan's declared file
  list — a pre-existing test this plan's own legitimate change would otherwise have broken)
- **Commit:** `90fda90` (Task 1 commit)

**3. [Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs`'s sitemap/built-file-count cross-check
didn't account for newly-excluded untranslated `/es` articles**
- **Found during:** Task 1's first full `node --test` run against the real build
  (`80861 !== 121552`-shaped failure before the fix).
- **Issue:** The cross-check assumed every built page (hot + archived, minus 404s) appears in the
  sitemap — true before this plan, false now that ~40,691 untranslated `/es` article pages are
  deliberately excluded.
- **Fix:** Subtract `readTierFacts().articlesEs.filter(e => !e.translated).length` from the
  expected total.
- **Files modified:** `tests/unit/news-sitemap.test.mjs`
- **Commit:** `90fda90` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (Rule 1).
**Impact on plan:** All three were necessary fixes directly caused by this plan's own legitimate
changes (a typo, and two pre-existing tests whose assumptions this plan's correct behavior
invalidated) — no scope creep, no plan logic changed.

## Issues Encountered

None beyond the three Rule 1 fixes documented above. The real build (121,554 pages, full
production corpus) succeeded on the second attempt (after the import-path fix) with the exact
expected shape: three sitemap chunk files, zero dangling `xhtml:link` alternates, exactly 13
genuinely-translated Spanish articles surfaced in both `/es/rss.xml` and `/es/news-sitemap.xml`.

## User Setup Required

None — no external service configuration required. No new dependency was added (`@astrojs/sitemap`
3.7.4 was already installed; its `chunks`/`i18n` options, available since 3.7.0, were simply not
yet in use).

## Next Phase Readiness

- I18N-06 ("Separate sitemaps and RSS feeds exist per language") is marked complete — its full
  text is true and verified against the real, full-corpus build, with no remaining page type or
  later gate needed to extend it (unlike I18N-04/05's multi-plan precedent).
- `06-12` (the full-corpus hreflang/lang/link invariants gate, per ROADMAP.md) is unaffected by
  this plan's scope (feeds/sitemaps, not page-level hreflang/lang/link markup) and can proceed
  independently.
- No blockers for subsequent plans.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/lib/i18n/sitemap.ts`,
`src/pages/es/rss.xml.ts`, `src/pages/es/news-sitemap.xml.ts`, `tests/unit/es-feeds.test.mjs`,
`astro.config.mjs`, `src/lib/seo-feeds.ts`, `src/pages/news-sitemap.xml.ts`, `public/robots.txt`,
`tests/unit/astro-config.test.mjs`, `tests/unit/news-sitemap.test.mjs`,
`tests/unit/seo-surfaces.test.mjs`, `tests/unit/no-auto-language.test.mjs`). Both task commits
(`90fda90`, `6e08133`) confirmed present in `git log --oneline --all`. Live build numbers (121,554
pages; 3 sitemap chunk files; 80,861 total sitemap URLs with zero dangling `xhtml:link`; 40,691
untranslated `/es` articles excluded; 13 genuinely-translated articles surfaced in both feeds)
independently re-derived from this session's own command output, not asserted from memory. Full
test suite re-run green: `test:fast` 1019/1019, `test:build-gate` 9/9, `test:regression` 5/5
(including the two-consecutive-builds byte-identity criterion), plus the plan's own 60/60 targeted
test files.

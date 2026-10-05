---
phase: 06-bilingual
plan: 09
subsystem: i18n
tags: [astro, i18n, seo, structured-data, article-page, hreflang, json-ld]

# Dependency graph
requires:
  - phase: 06-bilingual (06-02)
    provides: "Language-aware archive-tier routing (articleArchiveKey/tagArchiveKey language param, Worker /es serving)"
  - phase: 06-bilingual (06-04)
    provides: "writeArticleFactsEs / tier-facts-articles-es.json writer and tools/partition-archive.mjs's Spanish classification (already consumes the exact shape this plan writes)"
  - phase: 06-bilingual (06-05)
    provides: "src/lib/i18n/dictionary.ts (t), src/lib/i18n/hreflang.ts (alternateLinks/pairedPath), Base.astro's lang/alternates/switchPath props"
  - phase: 06-bilingual (06-06)
    provides: "articlesEs Content Layer collection, src/lib/i18n/spanish-view.ts (buildEsIndex/localizedArticleView/categoryLabel)"
provides:
  - "/es/<category>/<slug>-<uuid> route — a real Spanish translation when one is clean, or an honest English fallback (noindex, visible note, no hreflang pairing) when it isn't, for every public article"
  - "src/lib/i18n/article-page.ts: esArticlePageModel()/enArticleLanguageModel() — the pure page models both article templates render from"
  - "structured-data.ts: NewsArticleNode.inLanguage (en|es), threaded through both article templates"
  - "D-07 'Originally reported in Spanish' label + lang/hreflang=es markup on the English article page, driven by the Spanish entry's own sourceLanguage"
  - "Dictionary-driven rail headings (railMoreIn/railEarlier/railMoreStoriesLabel) on both language templates, and the home breadcrumb key"
  - "tests/helpers/built-page.mjs — reads a built page by canonical path, static (dist/client) or archived (dist/archive via dist/archive-plan.json)"
affects: [06-10-remaining-page-types, 06-11-sitemaps-feeds, 06-bilingual-go-live-decision]

# Actuals (#2632)
actuals:
  tokens: 15785
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure page-model module (article-page.ts) sits between the content-layer collections and the Astro template, mirroring spanish-view.ts's own zero-src/lib/server/-imports convention — fully unit-testable without a build (tests/unit/article-page-model.test.mjs, 7 tests, no dist/ needed)"
    - "tests/helpers/built-page.mjs: one read helper abstracting 'static or archived' for any canonical path, reused by es-article-pages.test.mjs and article-markup.test.mjs's disclosure-parity test rather than re-implemented per test file"
    - "Each article template looks up its own language's rail-heading text via t(key, lang) directly, rather than threading a language parameter through rail.ts itself — keeps the pure rail module single-language while both templates render correctly, confirmed byte-identical for English via pnpm run test:regression"

key-files:
  created:
    - src/lib/i18n/article-page.ts
    - src/pages/es/[category]/[slug].astro
    - tests/unit/article-page-model.test.mjs
    - tests/unit/es-article-pages.test.mjs
    - tests/helpers/built-page.mjs
  modified:
    - src/pages/[category]/[slug].astro
    - src/lib/structured-data.ts
    - src/lib/i18n/dictionary.ts
    - src/lib/rail.ts
    - tests/unit/structured-data.test.mjs
    - tests/unit/article-markup.test.mjs
    - tests/unit/news-sitemap.test.mjs
    - tests/unit/tier-facts.test.mjs

key-decisions:
  - "D-05 fallback pages are noindex and declare NO hreflang alternates at all (not even self) — pairing a /es URL that serves English content with hreflang='es' would be an incorrect pair; the page still exists, is linked via the switcher, and flips to indexable/paired automatically once its Spanish version publishes (Discretion, already recorded in 06-09-PLAN.md)."
  - "esArticlePageModel degrades to the English fallback (not a build crash) when an available Spanish entry's own text fails summaryBodyHtml's block validation, setting invalidSpanish: true for the build log to count — T-06-34's mitigation, verified at the pure-function level since the real zod-validated loader can never produce the invalid input itself."
  - "D-07's label is about the ORIGINAL article's source, not the translation — enArticleLanguageModel reads sourceLanguage off a HELD entry too (not just an available one), so the English page can correctly attribute Spanish-origin reporting even while that article's translation itself is still in the review queue."
  - "Rail heading text (railMoreIn/railEarlier/railMoreStoriesLabel) is resolved at the TEMPLATE level via t(key, lang) rather than by adding a language parameter to rail.ts itself — rail.ts stays a single-language pure module (zero changes to its own logic, confirmed via its unmodified 12-test suite), and the English page's literal text becomes dictionary-driven with byte-identical output."

patterns-established:
  - "A built-page read helper (tests/helpers/built-page.mjs) that checks dist/client first and falls back to dist/archive-plan.json — any future dist-output test that needs a SPECIFIC known canonical path (not a directory enumeration, which tests/helpers/archive-sample.mjs already covers) should use this rather than re-deriving the static-or-archived check."

requirements-completed: []  # I18N-02/03/04/05/09 remain Pending in REQUIREMENTS.md — this plan ships the full bilingual article page (the page type readers actually arrive on from search), but each requirement's full behavior spans every public page type (category/tag/source/static pages too), which 06-10+ ships. Matches this phase's own established precedent (06-02/06-05/06-06) of not marking a requirement complete until its full behavior is live everywhere a human would check it.

coverage:
  - id: D1
    description: "Every public English article has exactly one /es page; the Spanish tier-facts count equals the English tier-facts count after a build"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-article-pages.test.mjs#es-article-pages: every public English article has exactly one /es tier fact, path-prefixed correctly — live build: 40,688 articles, 40,688 /es facts"
        status: pass
    human_judgment: false
  - id: D2
    description: "With no (or an empty) Spanish index, the page model returns a D-05 fallback for every article and the build still emits one /es page per English article without throwing"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/article-page-model.test.mjs#esArticlePageModel: no entry at all (I18N-04 empty case) degrades the same way"
        status: pass
      - kind: integration
        ref: "live pnpm run build log: [es-article] pages=40688 translated=13 fallback=40675 invalidSpanish=0 — zero throws across the full corpus"
        status: pass
    human_judgment: false
  - id: D3
    description: "A translated /es article shows the Spanish title/standfirst/summary/key points under lang=\"es\", the Spanish AI disclosure naming the outlet and linking the original, and reciprocal hreflang en/es/x-default"
    requirement: "I18N-03"
    verification:
      - kind: integration
        ref: "tests/unit/es-article-pages.test.mjs#es-article-pages: a clean pilot translation renders as Spanish, paired, no fallback note — real 06-08 pilot uuid af043fec-... (and 12 others)"
        status: pass
      - kind: integration
        ref: "tests/unit/article-markup.test.mjs#article-markup: disclosure parity — sampled /es article pages... — 20/20 sampled pages pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "An untranslated or held /es article shows the English title/summary inside lang=\"en\", the visible fallback note, the Spanish AI disclosure, robots noindex, and no alternate links; its English page emits only hreflang en + x-default (self)"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-article-pages.test.mjs#es-article-pages: a held/missing pilot translation renders the honest D-05 fallback — real 06-08 pilot held uuid f5c80ed4-..."
        status: pass
      - kind: integration
        ref: "live check against the same uuid's English page: hreflang links are exactly [en, x-default], no es — see SUMMARY body"
        status: pass
    human_judgment: false
  - id: D5
    description: "An English article without a publishable Spanish version never declares an es alternate (I18N-05 empty case)"
    requirement: "I18N-05"
    verification:
      - kind: unit
        ref: "tests/unit/article-page-model.test.mjs#enArticleLanguageModel: a held entry does not pair / no entry at all does not pair"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each English article shows a plain 'Leer en español' link near the top and each /es article a 'Read in English' link to its pair (D-12)"
    verification:
      - kind: integration
        ref: "live build: [data-lang-link] present on both a translated and a fallback /es page, and on the English page of a held-translation article (see tests/unit/es-article-pages.test.mjs and the SUMMARY body's live check)"
        status: pass
    human_judgment: false
  - id: D7
    description: "When the Spanish entry's sourceLanguage is es, the English page shows 'Originally reported in Spanish' beside the source attribution, the source-name link carries lang=\"es\" hreflang=\"es\", and the disclosure's read-the-original link carries hreflang=\"es\""
    requirement: "I18N-02"
    verification:
      - kind: unit
        ref: "tests/unit/article-page-model.test.mjs#enArticleLanguageModel: a held entry does not pair — sourceLanguage threaded from a held entry"
        status: pass
      - kind: integration
        ref: "tests/unit/article-markup.test.mjs#article-markup: D-07 — the label and lang/hreflang=\"es\" always appear together, never independently (25/25 sampled English pages consistent)"
        status: pass
    human_judgment: true
    rationale: "Which of the 30 real 06-08 pilot article_translations rows (if any) carry sourceLanguage: 'es' is not identifiable from the available docs (the dry-run report flags only an aggregate count — '2 Spanish-source candidates included in the sample' — not per-uuid). This plan proves the decision logic (pure-function tests) and structural consistency on real build output (the label and its markup never appear independently), but has not observed a live example of the 'label present' branch rendering against real sourceLanguage: 'es' production data. Re-verify with a live example once 06-13+'s bulk backfill writes enough Spanish-origin rows."
  - id: D8
    description: "JSON-LD NewsArticle carries inLanguage (es for translated /es pages, en otherwise) and every Spanish node is serialised through toSafeJsonLd"
    requirement: "I18N-02"
    verification:
      - kind: unit
        ref: "tests/unit/structured-data.test.mjs#newsArticleNode: inLanguage defaults to \"en\"... / inLanguage \"es\" is carried through... / a Spanish headline containing </script><script>..."
        status: pass
    human_judgment: false
  - id: D9
    description: "An English article page re-renders when its Spanish entry appears or changes (cacheKey includes the Spanish digest + sourceLanguage), and an unchanged article is byte-identical across rebuilds"
    verification:
      - kind: integration
        ref: "pnpm run test:regression — criterion 3: two consecutive builds leave unchanged articles byte-identical, 5/5 pass"
        status: pass
    human_judgment: false

duration: ~3h20min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 09: The Bilingual Article Page Summary

**Every public English article now has a live `/es` mirror — a real, grounded Spanish translation when one is clean (pairs via reciprocal hreflang, carries `inLanguage: "es"` in its structured data), or an honest English fallback under a visible note when it isn't (noindex, no incorrect hreflang pair) — plus the article-level language switcher in both directions and the "Originally reported in Spanish" source-attribution label on the English page.**

## Performance

- **Duration:** ~3h20min (including three full real builds against production D1 and one two-build regression run)
- **Completed:** 2026-10-04
- **Tasks:** 2 of 2
- **Files modified:** 13 (5 new, 8 modified)

## Accomplishments

- `src/lib/i18n/article-page.ts` ships `esArticlePageModel()` (the Spanish template's full render
  model — translated/fallback, noindex, alternates, canonical/switch paths, the D-05 fallback note,
  and a defensive `invalidSpanish` degrade path) and `enArticleLanguageModel()` (the English page's
  hreflang-pairing + D-07 `sourceLanguage` model). Both are pure, zero `src/lib/server/` imports,
  fully unit-tested without a build (7 tests).
- `src/pages/es/[category]/[slug].astro` is the new `/es/<category>/<slug>-<uuid>` route — one page
  per public English article, Spanish category label/byline/AI-disclosure/attribution, a "Read in
  English" link, the D-05 fallback note when untranslated, tags linking `/es/tag/<slug>`
  (untranslated, `lang="en"`), Spanish rail headings and neighbour cards (via
  `localizedArticleView`), and (Task 2) `NewsArticle`/`BreadcrumbList` JSON-LD with `inLanguage`
  and Spanish breadcrumb names/paths.
- `src/pages/[category]/[slug].astro` gained the unconditional "Leer en español" link (D-12 — every
  English article has an `/es` mirror, translated or an honest fallback), the `alternates` prop
  wired from `enArticleLanguageModel`, and (Task 2) the D-07 "Originally reported in Spanish" label
  with correct `lang`/`hreflang` markup, driven by the Spanish entry's own `sourceLanguage` even
  while that entry is held.
- `structured-data.ts`'s `NewsArticleNode`/`NewsArticleNodeInput` gained `inLanguage` (default
  `'en'`, byte-identical when omitted) — the `/es` template passes the RENDERED content's language
  (`contentLang`), not the URL's language, so a D-05 fallback page correctly reports `en`.
- `src/lib/i18n/dictionary.ts` gained one new key (`home`, for the Spanish breadcrumb); every other
  string this plan's templates needed already existed from 06-05.
- Rail headings on BOTH article templates now render through `t('railMoreIn'/'railEarlier'/
  'railMoreStoriesLabel', lang, ...)` instead of a hardcoded English literal — `rail.ts` itself is
  unchanged (doc-comment only), and English output is confirmed byte-identical via
  `pnpm run test:regression`'s two-consecutive-builds criterion.
- `tests/helpers/built-page.mjs` is a new shared helper (`readBuiltPage(canonicalPath)`) that reads
  a page from `dist/client` or, failing that, `dist/archive` via `dist/archive-plan.json` — needed
  because several of the real 06-08 pilot article uuids turned out to already be archive-tier.
- **Live-proved against real production data, not fixtures**: a real `pnpm run build` logs
  `[es-article] pages=40688 translated=13 fallback=40675 invalidSpanish=0` — `translated=13` exactly
  matches 06-08's 13 real `clean` pilot rows, and `.astro/tier-facts-articles.json` /
  `tier-facts-articles-es.json` both carry 40,688 entries (parity confirmed independently of the
  log line).
- **Found and fixed two real, pre-existing tests broken by this plan's own change** (Rule 1 — see
  Deviations): `tests/unit/tier-facts.test.mjs` and `tests/unit/news-sitemap.test.mjs` both compared
  an English-only count against a figure that silently started including Spanish entries once
  `/es` article pages existed at scale.

## Task Commits

Each task was committed atomically via `/jja-commit`:

1. **Task 1: Tracer — a real build emits a translated /es article paired with its English page, and a fallback /es article that is noindex with the D-05 note** - `7999d50` (feat)
2. **Task 2: D-07 label, per-language JSON-LD, Spanish rail headings, disclosure parity and byte-identity** - `d87b980` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Jaime pre-approved auto-continuing a tracer feedback gate whose evidence is fully automated.
Task 1's own `<verify>` (pure-function tests + a real build + the es-article-pages/article-markup
dist tests) passed fully before commit, so the gate was re-run and logged
"tracer gate auto-continued per Jaime's standing approval (2026-10-03)" — no checkpoint was
returned._

## Files Created/Modified

- `src/lib/i18n/article-page.ts` - `esArticlePageModel()`, `enArticleLanguageModel()`
- `src/pages/es/[category]/[slug].astro` - the Spanish article route
- `src/pages/[category]/[slug].astro` - language-pair props, "Leer en español" link, D-07 label,
  dictionary-driven rail headings
- `src/lib/structured-data.ts` - `NewsArticleNode.inLanguage`
- `src/lib/i18n/dictionary.ts` - `home` key
- `src/lib/rail.ts` - doc comment only, no behavior change
- `tests/unit/article-page-model.test.mjs` - new, 7 tests
- `tests/unit/es-article-pages.test.mjs` - new, 7 tests (4 from Task 1, 3 added in Task 2)
- `tests/helpers/built-page.mjs` - new, `readBuiltPage()`
- `tests/unit/structured-data.test.mjs` - extended, `inLanguage` coverage
- `tests/unit/article-markup.test.mjs` - extended, disclosure-parity + D-07 consistency
- `tests/unit/news-sitemap.test.mjs` - fixed (Rule 1), Spanish archived-page counts included
- `tests/unit/tier-facts.test.mjs` - fixed (Rule 1), English-scoped checks exclude `/es/` entries

## Decisions Made

See `key-decisions` in the frontmatter. In brief: D-05 fallback pages declare zero hreflang
alternates (not even self); an available-but-invalid Spanish entry degrades to the fallback rather
than crashing the build; D-07's label reads `sourceLanguage` off a held entry too, not just an
available one; and rail heading text is resolved at the template level via the dictionary rather
than threading a language parameter through `rail.ts` itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/unit/tier-facts.test.mjs`'s English-scoped cross-checks silently
started counting Spanish archive entries**
- **Found during:** Task 2's `pnpm run test:fast` run after the second real build.
- **Issue:** `dist/archive-plan.json`'s article entries have included BOTH languages since 06-04
  (`articleArchiveKey(uuid, 'es')`), but this test's `archivedArticleUuids`/`archivedArticlePaths`
  helpers and its archived-count tally never filtered them out — comparing against the
  ENGLISH-only `articles` tier facts, the equation silently drifted the moment `/es` archive
  entries existed at scale (13,290 of them). `40688 !== 53978`.
- **Fix:** `archivedArticleUuids`/`archivedArticlePaths` and a new `archivedEnglishArticleCount`
  helper now explicitly exclude `/es/`-prefixed plan entries.
- **Files modified:** `tests/unit/tier-facts.test.mjs`
- **Commit:** `d87b980` (Task 2 commit)

**2. [Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs`'s archived-page tally omitted the Spanish
counts entirely**
- **Found during:** the same `pnpm run test:fast` run.
- **Issue:** `tools/partition-archive.mjs`'s `plan.counts` keeps English and Spanish archived
  counts in SEPARATE fields (`archivedArticles`/`archivedTags` vs. `archivedArticlesEs`/
  `archivedTagsEs`) — this test only summed the English ones, while the `countHtmlFiles` figure it
  compares against already recurses into every subdirectory and counts BOTH languages' static
  files. `101434 !== 88144`.
- **Fix:** sum all four `plan.counts` fields.
- **Files modified:** `tests/unit/news-sitemap.test.mjs`
- **Commit:** `d87b980` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1).
**Impact on plan:** Both fixes were necessary — without them, `pnpm run test:fast` would fail on
every future build now that `/es` article pages exist at scale, a false CI signal unrelated to any
real regression. No scope creep; both are directly caused by this plan's own change.

## Issues Encountered

None beyond the two Rule 1 fixes documented above. Both real builds against production D1
succeeded on the first attempt with the exact expected shape (40,688 articles, 40,688 `/es` facts,
13 translated matching 06-08's pilot exactly, 0 `invalidSpanish`).

## User Setup Required

None — no external service configuration required. Credentials
(`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) were already set per this plan's own
`<precondition>`, confirmed working across all three real builds run during this plan.

## Next Phase Readiness

- The article page (the page type readers actually arrive on from search) is fully bilingual. 06-10
  can build on the same `esArticlePageModel`/`enArticleLanguageModel`/dictionary pattern for the
  remaining page types (category/tag/source/static pages).
- `tests/helpers/built-page.mjs` is ready for any future dist-output test that needs a specific
  known canonical path, static or archived.
- **D-07's "label present" branch is proven by pure-function tests and a structural
  consistency check on real build output, but not by a live example against real
  `sourceLanguage: 'es'` production data** (flagged, coverage item D7) — re-verify once 06-13+'s
  bulk backfill writes enough Spanish-origin rows that a known uuid can be checked directly.
- I18N-02/03/04/05/09 remain `Pending` in REQUIREMENTS.md — this plan's full behavior is live for
  articles, but each requirement spans every public page type; 06-10+ is not blocked by anything
  in this plan.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/lib/i18n/article-page.ts`,
`src/pages/es/[category]/[slug].astro`, `src/pages/[category]/[slug].astro`,
`src/lib/structured-data.ts`, `src/lib/i18n/dictionary.ts`, `src/lib/rail.ts`,
`tests/unit/article-page-model.test.mjs`, `tests/unit/es-article-pages.test.mjs`,
`tests/helpers/built-page.mjs`, `tests/unit/structured-data.test.mjs`,
`tests/unit/article-markup.test.mjs`, `tests/unit/news-sitemap.test.mjs`,
`tests/unit/tier-facts.test.mjs`). Both task commits (`7999d50`, `d87b980`) confirmed present in
`git log --oneline --all`. Live build numbers (40,688 articles, 40,688 `/es` facts, 13 translated,
0 invalidSpanish) independently re-derived from `.astro/tier-facts-articles.json` /
`tier-facts-articles-es.json`, matching the build's own `[es-article]` log line exactly.

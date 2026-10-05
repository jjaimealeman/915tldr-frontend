---
phase: 06-bilingual
plan: 10
subsystem: frontend
tags: [astro, i18n, seo, hreflang, listing-pages, 404, archive-tier]

# Dependency graph
requires:
  - phase: 06-bilingual (06-05)
    provides: "src/lib/i18n/dictionary.ts (t), src/lib/i18n/category-labels.ts (categoryLabel), Base.astro's lang/alternates/switchPath props, the first live /es page"
  - phase: 06-bilingual (06-06)
    provides: "articlesEs Content Layer collection, src/lib/i18n/spanish-view.ts (buildEsIndex/localizedArticleView)"
  - phase: 06-bilingual (06-04)
    provides: "writeTagFactsEs/tier-facts-tags-es.json writer, tools/partition-archive.mjs's Spanish tag/article archiving (already consumed exactly the shape this plan writes)"
  - phase: 06-bilingual (06-09)
    provides: "src/pages/es/[category]/[slug].astro (the article route this plan's listings link to), esArticlePageModel pattern this plan's listing pages follow for card localization"
provides:
  - "/es/<category> (all 8, including empty categories) — same CATEGORY_PAGE_COUNT slice, same order, cards localized via localizedArticleView"
  - "/es/tag/<slug> — one per English tag page (static or archived), writeTagFactsEs recording the same full per-slug count as English by construction (same groupByTag result)"
  - "/es/tags, /es/source/<slug> — reciprocal hreflang, untranslated tag/source names marked lang=\"en\""
  - "/es/index.astro (06-05) upgraded from unconditional English-fallback cards to localizedArticleView (D-05) — real Spanish titles/summaries where a clean translation exists"
  - "/es/404 and /es/404-index.json — Spanish not-found page + its suggestion index, noindex, /es-prefixed paths"
  - "src/pages/404.astro parameterized: the suggestions script reads its index URL from data-index-url (via .dataset.indexUrl) instead of a hardcoded literal — the mechanism both languages' 404 pages now share"
affects: [06-11-feeds-sitemaps, 06-12-full-corpus-gate, 06-bilingual-go-live-decision]

# Actuals (#2632)
actuals:
  tokens: 13600
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every /es listing page's getStaticPaths fetches BOTH getCollection('articles') and getCollection('articlesEs'), builds an esIndex via buildEsIndex(), and renders each card through localizedArticleView() — the exact same per-card localization pattern 06-09's article page established, now applied to every listing type instead of being article-page-specific"
    - "A listing page's cacheKey now joins each listed article's ENGLISH digest with its Spanish digest (or 'none') — a listed article gaining/losing a Spanish translation re-renders the page even when the English digest and the listed set/order are unchanged (04-09's D-06 pattern, extended)"
    - "Reading a data-* attribute's value from an inline page script via the camelCase .dataset accessor, never a literal getAttribute('data-attr-name') string — the literal form would make the hyphenated attribute name appear twice in the built HTML (once as the real attribute, once inside the inlined/minified script body), which is exactly what this plan's own data-index-url acceptance check would catch"

key-files:
  created:
    - "src/pages/es/[category]/index.astro"
    - "src/pages/es/tag/[slug].astro"
    - src/pages/es/tags.astro
    - "src/pages/es/source/[slug].astro"
    - src/pages/es/404.astro
    - src/pages/es/404-index.json.ts
    - tests/unit/es-listing-pages.test.mjs
  modified:
    - src/pages/es/index.astro
    - src/pages/404.astro
    - tests/unit/not-found.test.mjs
    - tests/unit/news-sitemap.test.mjs

key-decisions:
  - "Spanish tag MEMBERSHIP and the full per-tag article count come from the SAME groupByTag(allArticles) call the English tag route uses — tags are never translated (D-02, identity like category/source slugs), so the set of /es/tag/<slug> pages and each one's full count is identical to the English route's by construction, never a separate Spanish derivation. This is what makes writeTagFactsEs's Spanish-count-equals-English-count must-have true automatically rather than needing a reconciliation step."
  - "The Spanish 404 page (src/pages/es/404.astro) passes no canonicalPath and no explicit switchPath/alternates props — Base.astro's own existing defaults (noindex -> alternates:'none'; no canonicalPath -> switch link to localizedPath('/', otherLang) = '/') already produce the exact required shape (no hreflang, switch link to the English home), so the plan's 'switch link to /' requirement needed zero new Base.astro logic."
  - "The 404 suggestions script's index URL is read via the camelCase .dataset.indexUrl accessor, never getAttribute('data-index-url') — the literal hyphenated string would appear a second time inside the script body (even after Astro's own production minification strips code comments, a real string literal survives), breaking the plan's own 'exactly one occurrence of data-index-url per built page' acceptance check. Both languages' 404 pages share this exact script body, differing only in the attribute's value."
  - "Number formatting on /es/<category> pages (storyCountText) uses Intl.NumberFormat('en-US') unconditionally, not a Spanish locale — same 'never let Intl locale-name output drive rendered text' discipline src/lib/format.ts's own Spanish date helpers already document, applied here to digit grouping so it stays deterministic across Node ICU versions regardless of page language; only the unit word ('historia'/'historias') is Spanish."

patterns-established:
  - "A listing-page cacheKey that folds in each listed article's own English-digest|Spanish-digest pair (joined by uuid position) is now the standard extension point for any future /es listing page — matches the per-article article-page cacheKey pattern 06-09 established, generalized to a list."

requirements-completed: []  # I18N-04/I18N-05 (this plan's frontmatter requirements) are intentionally left Pending in REQUIREMENTS.md, matching this phase's own established precedent (06-05/06-06/06-09): every reader-facing page type this plan covers (home, category, tag, tags index, source, 404) is now live under /es with correct hreflang, but 06-11 (feeds/sitemaps, I18N-06) and 06-12 (the explicit "full-corpus hreflang/lang/link invariants gate" per ROADMAP.md) remain — this project's convention is to mark a requirement complete only once its full behavior is verified everywhere a human/gate would check it, not plan-by-plan as mechanisms land.

coverage:
  - id: D1
    description: "/es home shows each card's real Spanish title/summary when a clean translation exists, English fallback marked lang=\"en\" otherwise, same uuid order as /"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: /es home lists the same uuids in the same order as /, lead summary follows the Spanish-or-English rule — live build"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 8 /es/<category> pages exist (including empty categories, D-04 Spanish empty state); card hrefs are the localized form of the English page's hrefs, in the same order"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: every category has an /es counterpart whose card hrefs are the localized form of the English page, in order — 8/8 categories, live build"
        status: pass
    human_judgment: false
  - id: D3
    description: "A card whose article has a clean Spanish translation shows the Spanish title with no English lang override; a card without one shows the English title marked lang=\"en\""
    requirement: "I18N-02"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: a card whose article has a clean Spanish row shows the Spanish title; a card without one shows the English title marked lang=\"en\" — live build, real 06-08 pilot rows"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every English tag page (static or archived) has an /es/tag/<slug> counterpart; Spanish tag-facts count equals the English tag-facts count for every slug"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: every English tag page (static or archived) has an /es/tag counterpart; Spanish tag-facts match English tag-facts exactly — live build"
        status: pass
    human_judgment: false
  - id: D5
    description: "/es/tags and one /es/source/<slug> per English source page exist with lang=\"es\" and reciprocal hreflang"
    requirement: "I18N-05"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: dist/client/es/tags.html exists with lang=\"es\" and reciprocal hreflang — live build"
        status: pass
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: one dist/client/es/source/<slug>.html per English source page, lang=\"es\", reciprocal hreflang — 3/3 sources, live build"
        status: pass
    human_judgment: false
  - id: D6
    description: "dist/client/es/404.html exists, noindex, Spanish copy, carries data-index-url=\"/es/404-index.json\" exactly once; dist/client/404.html carries data-index-url=\"/404-index.json\" exactly once"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: dist/client/es/404.html exists, noindex, Spanish copy, data-index-url=... — live build"
        status: pass
    human_judgment: false
  - id: D7
    description: "The 404 suggestions script (both languages) builds links with textContent/attribute assignment only — no innerHTML/outerHTML/insertAdjacentHTML of index data (T-06-37)"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: the 404 client script builds suggestion links with textContent/attribute assignment only — live build, both languages"
        status: pass
    human_judgment: false
  - id: D8
    description: "/es/404-index.json has the same entry count/order as /404-index.json, every path starts with /es/, titles are Spanish where publishable, stays under the 100KB ceiling"
    requirement: "I18N-04"
    verification:
      - kind: integration
        ref: "tests/unit/es-listing-pages.test.mjs#es-listing-pages: /es/404-index.json has the same entry count and order as /404-index.json... — live build"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 10: Spanish Listing Pages and the Spanish 404 Summary

**Every remaining `/es` listing page type — category, tag, tags index, source, and the not-found experience — now mirrors its English counterpart with real Spanish titles where a translation exists, honest English fallback where it doesn't, and reciprocal `hreflang`; the `/404` suggestions script is parameterized so both languages share one script body.**

## Performance

- **Duration:** ~40 min (including two real builds against production D1 and one two-build regression run)
- **Completed:** 2026-10-04
- **Tasks:** 2 of 2
- **Files modified:** 11 (7 new, 4 modified)

## Accomplishments

- `src/pages/es/[category]/index.astro` (new) mirrors `[category]/index.astro` exactly: all 8
  `CATEGORIES` slugs (including empty categories, D-04 Spanish empty state), the same
  `CATEGORY_PAGE_COUNT` slice of the same newest-first list, card hrefs that are the localized
  form of the English page's hrefs in the same order — proven against the real build for all 8
  categories.
- `src/pages/es/tag/[slug].astro` (new) mirrors `tag/[slug].astro`'s `TAG_SLUG_RE` validation and
  membership exactly (same `groupByTag(allArticles)` call — tags are never translated), and calls
  `writeTagFactsEs` with the full per-slug count. Because both routes group the SAME English
  article list the same way, the Spanish tag-facts count equals the English tag-facts count for
  every slug **by construction**, not by a reconciliation step — confirmed against the live build
  (13,290 Spanish tag archive entries, matching the English count exactly).
- `src/pages/es/index.astro` upgraded: cards now render through `localizedArticleView` (D-05)
  instead of 06-05's placeholder (unconditional English content marked `lang="en"`) — the home
  page now shows real Spanish titles/summaries wherever a clean translation exists.
- `src/pages/es/tags.astro` and `src/pages/es/source/[slug].astro` (new) mirror their English
  counterparts (same grouping, same `SOURCE_SLUG_RE` tampering guard), Spanish chrome, untranslated
  tag/source names marked `lang="en"`.
- `src/pages/es/404.astro` and `src/pages/es/404-index.json.ts` (new): the Spanish not-found
  experience. `/es/404` carries no `canonicalPath`, so `Base.astro`'s own existing defaults
  (`noindex` → `alternates: 'none'`; no `canonicalPath` → switch link to `/`) produce the correct
  shape with zero new props or Base.astro changes. `/es/404-index.json` mirrors
  `/404-index.json`'s exact count/order with `/es`-prefixed paths and Spanish titles where
  publishable.
- `src/pages/404.astro`'s suggestions script is parameterized: the index URL now comes from the
  suggestions section's own `data-index-url` attribute, read via `.dataset.indexUrl` — never a
  literal `getAttribute('data-index-url')` string, which would make that hyphenated substring
  appear twice in the built HTML (once as the real attribute, once inside the script body) and
  fail this plan's own "exactly one occurrence" acceptance check. `src/pages/es/404.astro` shares
  the identical script body with a different attribute value.
- `tests/unit/es-listing-pages.test.mjs` (new, 13 tests): proves every behavior bullet above
  against the real build — uuid-order parity, card-href localization, the Spanish-or-English title
  rule, tag-facts parity, reciprocal hreflang on `/es/tags` and every `/es/source/<slug>`, the
  Spanish 404's shape and `data-index-url`, script safety (no `innerHTML`/`outerHTML`/
  `insertAdjacentHTML`), and `/es/404-index.json` parity.
- **Found and fixed a real, pre-existing test bug this plan's own change exposed** (Rule 1 — see
  Deviations): `tests/unit/news-sitemap.test.mjs`'s sitemap/built-file count cross-check hardcoded
  a "minus 1" for exactly one 404 page; the moment a second (`es/404.html`) 404 page existed, the
  count silently drifted by one (`121506 !== 121507`).

## Task Commits

Each task was committed atomically via explicit-path `git add` + `git commit` (per this project's
"never `git add -A`" rule):

1. **Task 1: Tracer — /es home, category and tag listings with real Spanish titles where publishable** - `5a0eca0` (feat)
2. **Task 2: /es/tags, /es/source/<slug>, the Spanish 404 and its suggestion index** - `a203edc` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Jaime pre-approved auto-continuing a tracer feedback gate whose evidence is fully
automated. Task 1's own `<verify>` (a real build + `node --test tests/unit/es-listing-pages.test.mjs
tests/unit/listing-pages.test.mjs`) passed fully before commit, so the gate was re-run and logged
"tracer gate auto-continued per Jaime's standing approval (2026-10-03)" — no checkpoint was
returned._

## Files Created/Modified

- `src/pages/es/[category]/index.astro` - new, the Spanish category index route
- `src/pages/es/tag/[slug].astro` - new, the Spanish tag route + `writeTagFactsEs`
- `src/pages/es/tags.astro` - new, the Spanish tags index
- `src/pages/es/source/[slug].astro` - new, the Spanish source route
- `src/pages/es/404.astro` - new, the Spanish not-found page
- `src/pages/es/404-index.json.ts` - new, the Spanish 404 suggestion index
- `src/pages/es/index.astro` - upgraded to `localizedArticleView` cards
- `src/pages/404.astro` - `data-index-url` parameterization, `.dataset.indexUrl` script read
- `tests/unit/es-listing-pages.test.mjs` - new, 13 tests
- `tests/unit/not-found.test.mjs` - updated script-location string + `data-index-url` assertion
- `tests/unit/news-sitemap.test.mjs` - fixed (Rule 1), counts both languages' 404 pages

## Decisions Made

See `key-decisions` in the frontmatter. In brief: Spanish tag membership/counts come from the same
`groupByTag` call as English (never a separate Spanish derivation); the Spanish 404's correct
hreflang/switch-link shape falls out of `Base.astro`'s existing defaults with zero new props; the
404 script reads its index URL via `.dataset.indexUrl` (never a literal hyphenated
`getAttribute` string); and `/es/<category>` story counts use `Intl.NumberFormat('en-US')`
unconditionally for deterministic digit grouping, matching `format.ts`'s own "never let Intl
locale-name output drive rendered text" discipline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs`'s sitemap/built-file count cross-check
hardcoded "minus 1" for exactly one 404 page**
- **Found during:** Task 2's first `pnpm run test:fast` run after the real build.
- **Issue:** The test subtracted a hardcoded `1` from the total built-HTML-file count to exclude
  the single English `404.html` the sitemap correctly omits. Once `dist/client/es/404.html`
  existed as a second 404 page the sitemap also correctly omits, the hardcoded subtraction
  silently drifted by exactly one: `121506 !== 121507`.
- **Fix:** Replaced the hardcoded `1` with a count of whichever 404 pages this build actually
  produced (`['404.html', 'es/404.html'].filter(distFileExists).length`).
- **Files modified:** `tests/unit/news-sitemap.test.mjs`
- **Commit:** `a203edc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1).
**Impact on plan:** The fix was necessary — without it, `pnpm run test:fast` would fail on every
future build now that a second 404 page exists, a false CI signal unrelated to any real
regression. No scope creep.

## Issues Encountered

None beyond the Rule 1 fix documented above. Both real builds against production D1 succeeded on
the first attempt with the exact expected shape (8/8 category pages, tag-facts parity, reciprocal
hreflang on every new page type, correct `data-index-url` occurrence counts).

## User Setup Required

None — no external service configuration required. Credentials
(`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) were already set, confirmed working across both
real builds and the regression run in this plan.

## Next Phase Readiness

- Every reader-facing `/es` page type this phase's scope covers (home, category, tag, tags index,
  source, article [06-09], static pages [06-07], 404) is now live, built, and tested against real
  production data.
- `tools/partition-archive.mjs` already consumed the Spanish tag/article tiering shape this plan
  writes without any changes needed there — confirmed by a clean real build.
- `06-11` (per-language feeds/sitemaps, I18N-06) and `06-12` (the full-corpus hreflang/lang/link
  invariants gate) are the remaining plans before I18N-04/I18N-05 can be marked complete, per this
  phase's established precedent of reserving requirement completion for the gate that verifies the
  full corpus, not the plan that lands the mechanism.
- No blockers for subsequent plans.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/pages/es/[category]/index.astro`,
`src/pages/es/tag/[slug].astro`, `src/pages/es/tags.astro`, `src/pages/es/source/[slug].astro`,
`src/pages/es/404.astro`, `src/pages/es/404-index.json.ts`, `src/pages/es/index.astro`,
`src/pages/404.astro`, `tests/unit/es-listing-pages.test.mjs`, `tests/unit/not-found.test.mjs`,
`tests/unit/news-sitemap.test.mjs`). Both task commits (`5a0eca0`, `a203edc`) confirmed present in
`git log --oneline --all`. Live build numbers (8/8 category pages, 13,290 Spanish tag archive
entries matching English, 3/3 source pages, exactly one `data-index-url` occurrence per 404 page)
independently re-derived from the real build output this plan's own tests read.

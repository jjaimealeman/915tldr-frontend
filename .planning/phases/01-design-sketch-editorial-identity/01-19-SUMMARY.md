---
phase: 01-design-sketch-editorial-identity
plan: 19
subsystem: design-system
tags: [html, css, mockups, layout, grid, i18n, playwright, webkit]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-07: article.html's base structure, the D-01 article category block, the left-anchored --measure column, and 01-18's rendered [data-summary] HTML this plan's compact cards deliberately omit"
provides:
  - "design/mockups/article.html: main[data-layout=\"with-rail\"] with article[data-reading-column] and a new aside[data-rail] holding two real-content grids (\"More in Community\", moved not duplicated; \"Latest\", 5 fixture-derived rows) as compact cards"
  - "design/mockups/style.css: --rail-width token, a new 64em breakpoint, the with-rail grid, and full-width-below-64em reading column"
  - "design/tests/layout.spec.ts: page-layout geometry spec proving the rail at 320/768/1024/1280/1920px, light+dark, both engines"
  - "design/tests/content.spec.ts \"content: article rail\": content-integrity checks proving every rail card is real, non-duplicate, correctly ordered corpus content"
  - "design/fixtures/spanish-stress.json: new rail-heading Spanish-stress component"
affects: [01-20-changelog-layout]

actuals:
  tokens: 7065
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "[data-layout=\"with-rail\"] / [data-reading-column] / [data-rail] is now the shared two-column-with-real-content-sidebar primitive for any page that needs a desktop rail beside a capped reading column while staying full-width below 64em — 01-20 reuses it verbatim for the changelog page."
    - "A rail-scoped override ([data-rail] [data-grid], two attribute selectors) beats a bare [data-grid] rule inside a media query (one selector) by specificity alone, regardless of source order — no duplication of the override inside the 48em/80em blocks was needed."

key-files:
  created:
    - design/tests/layout.spec.ts
  modified:
    - design/mockups/article.html
    - design/mockups/style.css
    - design/tests/content.spec.ts
    - design/fixtures/spanish-stress.json

key-decisions:
  - "The rail's 'Latest' five rows and their exact order were computed directly from design/fixtures/stress-set.json's cases.feed array (already reverse-chronological) rather than trusted from the plan's own front-matter list — both agreed exactly (5deacd9f, 8b86f8d7, 93b39255, 746de4d5, 3b53a85d), and content.spec.ts's final rail test re-derives this set from the fixture at test time so a future corpus change is caught, not silently tolerated."
  - "The 'More in Community' three cards were moved (not duplicated) from their pre-existing below-article position into the new aside, converted to the compact card variant (frame and summary stripped) — no new corpus row was introduced."
  - "[data-rail] [data-grid]'s single-column override was written once, outside any media query, rather than duplicated inside the 48em/80em blocks the plan's action text allowed for — CSS specificity math (two selectors beats one) makes it win at every width regardless of source order, so duplication would have been dead weight."

patterns-established:
  - "Rail content-integrity tests re-derive their expected data (the 5 most recent cases.feed rows, after exclusions) from the fixture at test time, not from a hardcoded list — the same 'don't trust a snapshot, recompute it' standard 01-07's coverage rule and 01-18's markdown-round-trip checks already established for this project."

requirements-completed: [DSGN-01, DSGN-02, DSGN-06, I18N-07]

coverage:
  - id: D1
    description: "Right rail on the article page: main[data-layout=\"with-rail\"], article[data-reading-column], aside[data-rail] with 'More in Community' (moved) and 'Latest' (5 real feed rows) as compact cards, no ads"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=all design/tests/layout.spec.ts (24/24, both engines)"
        status: pass
      - kind: e2e
        ref: "MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts (20/20 x2, both engines)"
        status: pass
      - kind: unit
        ref: "inline node markup contract check: main[data-layout=\"with-rail\"], aside[data-rail], exactly 8 data-card-variant=\"compact\" cards"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reading column spans full page-column width below 1024px (article part of revision request 7); at >=1024px it is capped near --measure beside the rail"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "design/tests/layout.spec.ts — width-conditional stacked/beside-column assertions at 320/768 and 1024/1280/1920px"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every rail link is reachable by keyboard with a visible, unclipped focus ring in both themes and engines"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts (8/8 x2, both engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rail content integrity: every card real/non-duplicate/correctly-titled, More in Community all-community, Latest non-increasing and exclusion-correct, Latest order matches the fixture's five most recent feed rows exactly"
    requirement: "DSGN-06"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/content.spec.ts (25/25 x2, both engines, incl. 5 new 'content: article rail' tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rail 'Latest' heading carries a Spanish-stress component (rail-heading, widthRatio 1.29 >= 1.24 floor) that survives injection/overflow/320px/200%-reflow checks in both engines"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts (7/7 x2, both engines)"
        status: pass
      - kind: unit
        ref: "inline node fixture check: rail-heading present, page=\"article\", es_real exact match, calibration.widthRatio >= 1.24"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 19: Article Right Rail Summary

**Article page gains a real-content right rail (`[data-layout="with-rail"]`) at >=1024px — "More in Community" moved plus a fixture-derived "Latest" five — closing revision request 3's desktop whitespace complaint and the article half of request 7's 768px full-width request, with the reading column left-anchored and capped near `--measure` beside it.**

## Performance

- **Duration:** ~25min
- **Started:** 2026-09-17 (session continuation, Phase 1 execution)
- **Completed:** 2026-09-17T16:23:55-06:00 (Task 2 commit `07433a6`)
- **Tasks:** 2/2
- **Files modified:** 21 (5 source/test files + 16 regenerated evidence artifacts — keyboard contact sheets, tab-order JSON, full-page screenshots)

## Accomplishments

- `main[data-layout="with-rail"]` / `article[data-reading-column]` / `aside[data-rail]` — a new, reusable layout primitive (01-20 applies it to the changelog page next)
- The rail holds two pure-HTML `[data-grid]` sections: "More in Community" (the three existing community cards, moved rather than duplicated) and "Latest" (the five most recent real `cases.feed` rows, excluding the article itself and those three), rendered as compact cards (stripe, category name, headline link, byline — no frame, no summary, no ads)
- New `64em` breakpoint: below it the reading column spans the page column's full width (article part of revision request 7); at and above it, the column is capped at `--measure` and left-anchored beside a `20rem` rail, closing the large empty right side revision request 3 named
- `design/tests/layout.spec.ts` (new): geometry proof at 320/768/1024/1280/1920px, light + dark, both engines — no horizontal scroll anywhere, correct beside-vs-stacked geometry at every width
- `design/tests/content.spec.ts`'s new `"content: article rail"` block: every rail card proven real, non-duplicate, correctly titled, correctly categorised, and — for "Latest" — in the exact fixture-derived reverse-chronological order (re-derived from `cases.feed` at test time, not hardcoded)
- New Spanish-stress component `rail-heading` (`es_real` "Últimas noticias", `widthRatio` 1.29) survives injection, overflow, 320px and 200%-reflow checks for article in both engines

## Task Commits

1. **Task 1 (tracer): Right rail on the article page — markup → layout CSS → geometry in both engines at five widths** - `debe070` (feat)
2. **Task 2: Rail content integrity and the Spanish rail heading** - `07433a6` (test)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/mockups/article.html` - `main[data-layout="with-rail"]`, `article[data-reading-column]`, new `aside[data-rail]` with the two moved/new card grids
- `design/mockups/style.css` - `--rail-width` token, updated breakpoint comment, article base rule loses its `max-width` (moved into the new `>=64em` rail block), new rail CSS section
- `design/tests/layout.spec.ts` - New: article page-layout geometry spec, `@c1`
- `design/tests/content.spec.ts` - New `"content: article rail"` describe block (5 tests, `@c1`)
- `design/fixtures/spanish-stress.json` - New `rail-heading` component, calibrated
- 16 regenerated evidence artifacts (`design/evidence/keyboard/article-*`, `design/evidence/keyboard/tab-order-*.json`, `design/evidence/pages/article-*.jpg`) — a direct, expected side effect of re-running the keyboard-walk and structure evidence tests against the changed article page

## Decisions Made

See `key-decisions` in frontmatter: the fixture-derived (not front-matter-trusted) "Latest" order and its re-verification at test time, moving rather than duplicating the "More in Community" cards, and writing the rail's single-column grid override once (CSS specificity wins at every width without duplicating it inside the 48em/80em blocks).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' verification commands passed on the first attempt; no auto-fixes were needed.

## Issues Encountered

None.

## Known Stubs

None. Every rail card is a real, processed, non-duplicate fixture row; the "More in Community" three are moved (not duplicated) from their pre-existing position, and "Latest" is computed from the fixture's own `cases.feed` array.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Revision request 3 (article desktop whitespace) and the article half of revision request 7 (768px full width) are closed and proven at all five named widths, both themes, both engines.
- The `[data-layout="with-rail"]` / `[data-reading-column]` / `[data-rail]` primitive is ready for 01-20 to apply to the changelog page (revision request 4/the changelog half of request 7).
- No blockers.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All files listed above verified present on disk; both task commits (`debe070`, `07433a6`) verified present in git history.

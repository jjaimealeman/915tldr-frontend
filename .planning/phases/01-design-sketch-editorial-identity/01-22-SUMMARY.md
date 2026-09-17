---
phase: 01-design-sketch-editorial-identity
plan: 22
subsystem: testing
tags: [playwright, spanish-i18n, font-subsetting, load-more, accessibility, regression-coverage]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-21: design/scripts/build-feed.mjs, design/fixtures/home-feed.json, design/mockups/feed/page-<n>.json, the [data-load-more] button/status controls on index.html — the paginated feed this plan restores full-suite coverage against"
provides:
  - "design/tests/support/feed.ts: expandFeed(page) — a real-click loop any future test/script can reuse to drive the homepage's Load More button to exhaustion"
  - "content.spec.ts, structure.spec.ts, spanish-overflow.spec.ts, font-cls.spec.ts: every content/Spanish/glyph check that used to see the whole 33-card home feed by just opening the page now expands the feed first, so none of them silently check less than before 01-21"
  - "spanish-stress.json: load-more-button/load-more-status components, calibrated in the real production fonts"
  - "build-fonts.mjs: glyph crawl covers the 27 load-more cards, the feed JSON fixtures, and the load-more failure/exhaustion status strings"
affects: [01-23]

actuals:
  tokens: 8900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "expandFeed(page): a real-click (locator.click(), never synthetic) loop that reads the current card count, clicks, then waits (page.waitForFunction) for the count to increase, repeating while the button stays visible and throwing after 20 iterations — the standard way this project's test suite (and, mirrored narrowly, its build scripts) drive a load-more control to exhaustion before asserting anything about the fully-loaded page."
    - "Order-sensitive fixture checks: when a check must run both before AND after a page reaches a particular state (here, load-more-button's Spanish-overflow check must run before expandFeed, since the button legitimately disappears once the feed is exhausted), extract the shared per-item assertion body into a function and call it at each moment, rather than forcing one call site to serve both."

key-files:
  created:
    - design/tests/support/feed.ts
  modified:
    - design/tests/content.spec.ts
    - design/tests/structure.spec.ts
    - design/tests/spanish-overflow.spec.ts
    - design/tests/font-cls.spec.ts
    - design/scripts/build-fonts.mjs
    - design/mockups/index.html
    - design/fixtures/spanish-stress.json

key-decisions:
  - "expandFeed(page) is a real Playwright locator.click() loop, never a fetch shortcut or a forced DOM mutation — every test that now sees the full 33-card feed sees it exactly the way a real reader's clicks would produce it, matching load-more.spec.ts's own already-established real-click standard (01-21)."
  - "load-more-button is excluded from spanish-overflow.spec.ts's per-width injected-Spanish loop's shared call site and checked once, immediately after openPage, before expandFeed runs — because the button legitimately hides itself once the feed is fully expanded (01-21's own accessible \"nothing left to load\" behavior), so checking it against the fully-expanded page would always fail 'must render' for a reason that has nothing to do with Spanish overflow. Verified by first running the literal 'expandFeed before everything' reading of the plan and observing the exact failure, not assumed."
  - "build-fonts.mjs's feed-expansion is a narrow, self-contained expandFeedInPage function rather than an import of the test-only design/tests/support/feed.ts helper, so the build script (which this project's own imageService/font-pipeline decisions treat as production-adjacent tooling) carries no dependency on the test suite; the two implementations share the same algorithm but are independently owned, matching this task's own automated verify check, which greps build-fonts.mjs for a literal `data-load-more` reference."

requirements-completed: [DSGN-06, DSGN-04, I18N-07, PERF-07]

coverage:
  - id: D1
    description: "Content-integrity checks (fixture-uuid fidelity, category-name/--cat-none rules, image/link hygiene, markdown rendering, grid time-order, and a new full-feed stress-coverage test) run against the fully expanded 33-card homepage, not just the first 6 server-rendered cards"
    requirement: "DSGN-04"
    verification:
      - kind: automated_ui
        ref: "design/tests/content.spec.ts (26/26, both engines) — including 'index: fully loaded feed equals home-feed.json, with every stress case @c1'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pure-HTML grid guard (zero <script>, zero on* attributes) is re-asserted after the feed is fully expanded, proving the client-built load-more cards are exactly as pure as the server-rendered ones"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/structure.spec.ts (20/20, both engines) — '[data-grid] is populated pure HTML with no inline handlers @c5'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criterion 4 (D-07/D-15 Spanish overflow) runs against the fully expanded homepage — injected, drawn and synthetic Spanish, the no-summary card, and the 320px/200% reflow checks all pass in both engines; the Load More button and status controls have real Spanish translations, calibrated in the real production fonts"
    requirement: "I18N-07"
    verification:
      - kind: automated_ui
        ref: "design/tests/spanish-overflow.spec.ts (7/7, both engines); pnpm run verify:phase-1 --pages=index --criteria=4 (PASS, both engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The font glyph subset covers every character the load-more cards, the feed JSON fixtures, and the load-more status/failure strings can put on screen; the coverage test checks the fully loaded page"
    requirement: "PERF-07"
    verification:
      - kind: automated_ui
        ref: "design/tests/font-cls.spec.ts --grep 'every rendered character' (5/5, both engines); pnpm run verify:phase-1 --pages=index --criteria=5 (PASS, both engines + node checks)"
        status: pass
    human_judgment: false

duration: ~19min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 22: Feed-Expansion Gap Closure — Content, Spanish and Glyph Coverage of the Full 33-Card Homepage

**A reusable `expandFeed(page)` real-click helper closes the coverage gap 01-21 opened: every content, Spanish-overflow and glyph-subset check that used to see the whole 33-card home feed by just opening the page now drives the Load More button to exhaustion first, so none of them silently checks less than before.**

## What Changed

01-21 moved 27 of the home feed's 33 cards — including most D-06/D-07 stress cases (longest headline, no-summary, uncategorized, both Spanish cards, the D-07 worst case) — behind a Load More button to keep the initial page load from being overwhelming. That left `spanish-overflow.spec.ts` at 28/32 per engine on index, with 4 checks (`card-headline`, `card-summary`, `card-summary-thin`, the no-summary target) unable to find their target elements. This plan closes that gap without weakening a single threshold or reordering the feed away from D-12's true reverse-chronological order — it makes the existing gates reach the cards instead.

## Accomplishments

- **Task 1 (tracer):** `design/tests/support/feed.ts`'s `expandFeed(page)` — a real-click loop that clicks `[data-load-more]`, waits for the card count to increase, and repeats until the button hides or 20 clicks pass. `content.spec.ts` and `structure.spec.ts` call it on index before every check that inspects grid cards. A new test, `index: fully loaded feed equals home-feed.json, with every stress case`, asserts the card count (33), the exact `(uuid, stress)` sequence with no duplicate pair, all 12 D-06/D-07 stress markers present (the static lead counts for `no-image`), es-card headline/summary fidelity against `home-feed.json` after NFC normalisation and whitespace collapse, no empty `<h3>`/`[data-summary]`, and an exact (unescaped) headline `textContent` match. `structure.spec.ts`'s pure-HTML grid guard now also re-asserts zero `<script>`/`on*` attributes across all 33 cards once expanded.
- **Task 2:** `spanish-overflow.spec.ts` expands the feed on index before every check that reads grid cards. A real conflict surfaced and was fixed (see Deviations): `load-more-button`'s own Spanish-overflow check has to run *before* full expansion, since the button legitimately disappears once the feed is exhausted. `index.html`'s status paragraph gained `data-i18n="load-more-status"` (static markup, survives `feed:build` unchanged — confirmed via a fresh `feed-build.sha` and `sha256sum -c`). Two new fixture components (`load-more-button` "Load more stories"/"Cargar más noticias", `load-more-status` "6 more stories loaded."/"Se cargaron 6 noticias más.") were calibrated via `calibrate-spanish.mjs --only` in the real production fonts (widthRatio 1.33/1.32, hi 1.35/1.35).
- **Task 3:** `build-fonts.mjs`'s glyph crawl now expands index's feed before collecting page text, collects every string from `home-feed.json` and `feed/page-<n>.json`, and reads the load-more failure/exhaustion status literals straight out of the shared head script (since those only render conditionally). `font-cls.spec.ts`'s coverage test does the same. The subset manifest came out byte-identical — every mockup page had already been crawled with the full 33-card grid by an earlier plan before 01-21 trimmed it, so no new code point was introduced.

## Task Commits

1. **Task 1 (tracer): Feed-expansion helper wired through content integrity and structure** - `7765567` (feat)
2. **Task 2: Criterion 4 on the fully loaded homepage, Spanish for the Load More controls** - `c55f24a` (feat)
3. **Task 3: Glyph coverage for feed text and status messages** - `a011396` (feat)

## Files Created/Modified

- `design/tests/support/feed.ts` (new) — `expandFeed(page): Promise<number>`
- `design/tests/content.spec.ts` — `expandFeed` calls on index for existing per-card checks; new full-feed stress-coverage test
- `design/tests/structure.spec.ts` — pure-HTML grid guard re-asserted on the expanded feed
- `design/tests/spanish-overflow.spec.ts` — `expandFeed` on every index check that reads grid cards; `checkComponentSpanishOverflow` extraction for the `load-more-button` before/after-expansion split
- `design/tests/font-cls.spec.ts` — coverage test expands the feed and checks feed/home-feed JSON strings
- `design/scripts/build-fonts.mjs` — `expandFeedInPage`, feed/home-feed JSON string collection, `extractStatusLiterals`
- `design/mockups/index.html` — `data-i18n="load-more-status"` on the status paragraph
- `design/fixtures/spanish-stress.json` — `load-more-button`, `load-more-status` components

## Decisions Made

See `key-decisions` in the frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `load-more-button`'s Spanish-overflow check is unreachable after full expansion**
- **Found during:** Task 2, first run of `spanish-overflow.spec.ts` with `expandFeed` called unconditionally before the injected-Spanish loop
- **Issue:** Once the feed is fully expanded, `index.html`'s own head script hides `[data-load-more]` (01-21's "nothing left to load" behavior — the same mechanism `load-more.spec.ts`'s failure-path test already relies on). Checking the button's Spanish text against the fully-expanded page therefore always failed `must render`, for a reason unrelated to overflow.
- **Fix:** Extracted the injected-loop's shared per-component body into `checkComponentSpanishOverflow` (identical logic, no threshold or assertion changed) and called it for `load-more-button` once, immediately after `openPage` (guaranteed visible on a fresh load), then for every other component after `expandFeed`.
- **Files modified:** `design/tests/spanish-overflow.spec.ts`
- **Verification:** `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` — 7/7 both engines
- **Committed in:** `c55f24a` (Task 2 commit)

**2. [Rule 3 - Blocking] Task 3's own automated verify check required a literal `data-load-more` reference in build-fonts.mjs**
- **Found during:** Task 3, running the task's own `<verify>` node sanity check after wiring `expandFeed` (imported from the test-only `feed.ts`) into `crawlGlyphSet`
- **Issue:** `node -e "...if(!s.includes('data-load-more'))..."` failed — `build-fonts.mjs`'s source never contained that literal string, since the click-loop logic lived entirely inside the imported `expandFeed` helper.
- **Fix:** Replaced the import with a narrow, self-contained `expandFeedInPage` function directly referencing `[data-load-more]` and `[data-grid] [data-card]`, matching `expandFeed`'s algorithm without a cross-module test-suite dependency from a production-adjacent build script.
- **Files modified:** `design/scripts/build-fonts.mjs`
- **Verification:** the task's own verify one-liner passes; `pnpm run fonts:build` + coverage test + `verify:phase-1 --criteria=5` all still pass, both engines
- **Committed in:** `a011396` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test-authoring bug, 1 Rule 3 blocking fix to satisfy the plan's own verify check). Neither weakened a threshold, reordered the feed, or changed any assertion's pass/fail criteria.

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Regression Check

Beyond this plan's own scope, the full test suite was re-run in both engines to confirm nothing else broke from touching shared files (`content.spec.ts`, `structure.spec.ts`, `spanish-overflow.spec.ts`, `font-cls.spec.ts`, `build-fonts.mjs`, `index.html`, `spanish-stress.json`):

- `node design/scripts/pw.mjs --project=chromium design/tests` — 362/362 passed
- `node design/scripts/pw.mjs --project=webkit design/tests` — 362/362 passed
- `pnpm run check:contrast` — PASS (unchanged; the pre-existing sports-hue C-01 warning is untouched by this plan)

Left uncommitted, out of scope for this plan (pre-existing staleness, not caused by these changes): `design/evidence/pages/index-*.jpg` (regenerated smaller by running `structure.spec.ts`'s evidence-capture tests against 01-21's already-trimmed 6-card initial render — the images had simply never been refreshed since 01-21 shrank the grid) and `design/evidence/font-cls.md` (regenerated by re-running the criterion-5 swap matrix; only the non-deterministic positive-control timing numbers changed).

## Next Phase Readiness

- All three of this plan's own `<verification>` commands pass: `content.spec.ts` (26/26 both engines), `verify:phase-1 --pages=index --criteria=4` (PASS), `verify:phase-1 --pages=index --criteria=5` (PASS).
- 01-23 (approval-packet regeneration) can proceed — the scoped runs above are explicitly not valid for approval per `verify-phase-1.mjs`'s own output; an unscoped `pnpm run verify:phase-1` run is still needed there, as 01-21-SUMMARY.md's own Next Phase Readiness already noted.
- No new blockers introduced.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 9 files listed as created/modified confirmed present on disk; all 3 task commit hashes (`7765567`, `c55f24a`, `a011396`) confirmed in `git log`.

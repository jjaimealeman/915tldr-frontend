---
phase: 01-design-sketch-editorial-identity
plan: 08
subsystem: design-system
tags: [playwright, webkit, accessibility, keyboard, a11y, wcag, css-tokens, testing]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-07: the final five-page mockup set (index, category, article, changelog, contact), shared style.css token layer, and font subset — all five pages this plan drives keyboard/structure/content checks against"
provides:
  - "design/tests/support/focus.ts: enumerateFocusables/walkTabOrder/inspectFocus/buildContactSheet — geometry-based focus inspection (per-fragment clipping/obscuring/viewport checks, canvas-resolved ring/background colour, WCAG contrast) that never inspects CSS declarations alone"
  - "design/tests/keyboard-walk.spec.ts: scripted D-14 keyboard walk proving criterion 3 across all 5 pages x 2 themes x 2 widths in both Chromium and WebKit, plus skip-link/theme-toggle/contact-form operability tests"
  - "40 keyboard contact-sheet screenshots + 2 tab-order-<engine>.json evidence files covering all 5 pages"
  - "design/tests/structure.spec.ts extended: landmarks, DSGN-05 theme-difference proof, reduced-motion, line-height, head-script drift guard, font hygiene (document.fonts, request blocking, no @import), 30 full-page JPEG evidence screenshots"
  - "A real duplicate-banner-landmark accessibility bug found and fixed on category.html (D-01 masthead moved inside <main>, full-bleed visual preserved with a scoped negative margin)"
  - "design/tests/content.spec.ts: nav order, category-name/stripe rules, fixture-uuid fidelity, changelog dispatch fidelity (D-11), article standfirst/body summary reproduction (D-10), D-12 no-per-category-section check, contact form labelling"
affects: [01-09-font-swap-matrix, 01-10-approval-packet]

actuals:
  tokens: 36587
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Focus-ring correctness is measured per rendered line fragment (getClientRects()), not the element's single bounding-rect envelope — a wrapped multi-line link's envelope box includes the empty gap between its lines, which is not part of what a browser actually outlines or what WCAG 2.4.11 cares about."
    - "Any computed CSS colour (oklch()-authored or otherwise) is resolved to concrete sRGB by painting it onto a 1x1 canvas over white and black backdrops and reading the composited pixel back, never by string-parsing getComputedStyle()'s output — this Chromium build serialises an oklch()-authored colour back out as \"oklch(...)\", not \"rgb(...)\", so the plan's assumption that \"the browser's resolved sRGB is already given\" does not hold."
    - "A body-level `<header>` (sibling of `<main>`) always computes to the `banner` ARIA landmark; a `<header>` used as an in-page block (D-01's category masthead, article's category header) must be a descendant of main/article/section/etc. to avoid becoming a second, indistinguishable banner landmark — checked here by a real landmarks test, not assumed correct because it 'looked like' the article page's already-correct pattern."
    - "A hand-authored fixture file (stress-set.json) can have the same uuid appear under multiple shapes — a real article row with status/is_duplicate, and a bare image-candidate record without them. A uuid-keyed lookup must prefer the shape that actually carries the fields being asserted, not the first occurrence encountered by object-traversal order."

key-files:
  created:
    - design/tests/support/focus.ts
    - design/tests/keyboard-walk.spec.ts
    - design/tests/content.spec.ts
    - design/evidence/keyboard/ (40 PNGs + 2 JSON)
    - design/evidence/pages/ (30 JPEGs)
  modified:
    - design/tests/structure.spec.ts
    - design/mockups/style.css
    - design/mockups/category.html

key-decisions:
  - "WebKit's focus-triggered scrollIntoView stops as soon as any part of a newly-focused element clears the viewport edge, rather than ensuring the whole element is visible like Chromium does. Fixed with `scroll-padding-block-end: 12rem` on `html` (a global, standards-based CSS property), not by changing the test's pass/fail threshold — the underlying WCAG 2.4.11 concern (a real user's focus ring landing off-screen) is exactly what this would look like on a real device."
  - "category.html's D-01 masthead `<header data-block>` was a body-level sibling of `<main>`, computing to a second `banner` ARIA landmark alongside the site's own chrome header. Moved inside `<main>` (matching article.html's already-correct nesting) and restored its full-bleed visual with a scoped negative margin that cancels `main`'s own horizontal padding — verified pixel-exact (left:0, right:viewport-width) at all three test widths before and after."
  - "content.spec.ts's fixture-uuid lookup only accepts an object shape that actually has a `status` field, after a first-seen-wins version produced false failures on real published rows whose uuid also appears as a bare image-candidate record elsewhere in stress-set.json."

patterns-established:
  - "Contact-sheet evidence (buildContactSheet) renders one full-page PNG per page/theme/width/engine combination as a captioned grid of per-stop crops, giving the owner's own D-14 pass something reviewable without opening 20 separate browser sessions."
  - "Fixture files with multiple shapes for the same identifier are walked recursively and filtered by the shape's own required fields, not enumerated by hand or trusted to appear in the 'right' place first — same principle as check-contrast.mjs's union-find coverage rule (01-05/01-07)."

requirements-completed: [DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, DSGN-07]

coverage:
  - id: D1
    description: "Scripted keyboard walk (D-14) proves criterion 3 across all five pages, both themes, both widths, in both Chromium and WebKit — every focusable element reached, first stop is the skip link, every stop has a visible >=2px ring that is unclipped, inside the viewport, unobscured, and >=3:1 contrast against its background; plus skip-link/theme-toggle/contact-form operability"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=chromium design/tests/keyboard-walk.spec.ts (31/31 pass)"
        status: pass
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=webkit design/tests/keyboard-walk.spec.ts (31/31 pass, Docker Playwright 26.6)"
        status: pass
      - kind: other
        ref: "design/evidence/keyboard/ holds 40 contact-sheet PNGs (5 pages x 2 themes x 2 widths x 2 engines) and tab-order-{chromium,webkit}.json covering all 5 pages"
        status: pass
    human_judgment: false
  - id: D2
    description: "Real WCAG 2.4.11 bug found and fixed: WebKit's focus-triggered scrollIntoView left the contact page's message textarea mostly off-screen at 320px. Fixed with scroll-padding-block-end: 12rem on html."
    verification:
      - kind: e2e
        ref: "design/tests/keyboard-walk.spec.ts contact light @320px @c3 (webkit) — passes after the fix, previously failed with 'ring is obscured'"
        status: pass
    human_judgment: false
  - id: D3
    description: "structure.spec.ts extended: landmarks (one page-level header/nav/main/footer/h1, html[lang], es-variant lang), DSGN-05 (six neutrals + eight --cat-<slug> aliases differ between themes), reduced motion, line-height, head-script drift guard (5 pages, 1 identical script), font hygiene (document.fonts, request blocking, no @import), 30 full-page JPEG evidence screenshots"
    requirement: "DSGN-05"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=chromium|webkit design/tests/structure.spec.ts (96/96 pass, both engines)"
        status: pass
      - kind: other
        ref: "design/evidence/pages/ holds 30 JPEGs (5 pages x 2 themes x 3 widths)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real accessibility bug found and fixed: category.html's D-01 masthead header was a body-level sibling of main, computing to a duplicate `banner` ARIA landmark. Moved inside main (matching article.html's pattern); full-bleed visual restored with a scoped negative margin, verified pixel-exact at 320/768/1280px."
    verification:
      - kind: e2e
        ref: "structure.spec.ts 'landmarks: one page-level header...' (category, both engines) — passes after the fix, previously found 2 body>header elements"
        status: pass
      - kind: e2e
        ref: "re-ran keyboard-walk.spec.ts (Task 1) in both engines after the DOM change — 31/31 still pass, tab-order-*.json unchanged, confirming the move was structurally transparent"
        status: pass
    human_judgment: false
  - id: D5
    description: "content.spec.ts: nav order + stripe distinctness, category-name/--cat-none rules, [data-block] placement (D-01), fixture-uuid fidelity, link/img hygiene, grid chronological order (D-12), no per-category sections, changelog dispatch fidelity (D-11) including single-item and same-date-tie edges, article standfirst/body summary reproduction (D-10), AI-disclosure linking, tags removal, contact form labelling"
    requirement: "DSGN-07"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=chromium|webkit design/tests/content.spec.ts (37/37 pass, both engines)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run verify:phase-1 -- --criteria=1,3,5 across all five pages, both engines — criteria 1 and 3 (this plan's actual scope) pass cleanly with no exceptions; criterion 5 fails on two pre-existing, already-documented font-swap-CLS-timing findings (WINDOWS.md entries 4 and 6, owned by 01-09) with measured values byte-identical to what's already on record"
    requirement: "DSGN-05"
    verification:
      - kind: e2e
        ref: "npm run verify:phase-1 -- --criteria=1,3,5 (chromium/webkit/node-checks table: criterion 1 PASS/PASS/PASS, criterion 3 PASS/PASS/—, criterion 5 FAIL/FAIL/PASS)"
        status: fail
    human_judgment: true
    rationale: "Criteria 1 and 3 (the keyboard walk and the structural/content half of criterion 1 this plan owns) pass cleanly in both engines with no exceptions. Criterion 5's two failures are font-swap CLS timing measurements this plan's own scope note explicitly excludes ('font-swap CLS timing belongs to 01-09 — don't fix, don't weaken'): Chromium's changelog@320px native CLS (0.012502...) matches WINDOWS.md entry 6's recorded 0.0125 exactly, and WebKit's index@320px geometryScore (0.7587...) matches entry 4's 'up to 0.76' exactly — both are the same pinned-Docker-WebKit-missing-fonts and Chromium-native-CLS-attribution-quirk root causes already investigated and recorded in 01-07, not new regressions introduced by this plan. Recorded here for the owner's end-of-phase judgement per human_verify_mode:end-of-phase, consistent with 01-07's own precedent for the identical situation."

duration: ~55min (continuation session; a prior session's Task 1 work was cut short by an API rate limit before any commit and is included in this total)
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 8: Scripted Keyboard Walk, Structural Landmarks, and Content-Integrity Verification Summary

**Proved criterion 3 (keyboard, D-14) and the structural/content halves of criteria 1 and 5 across all five mockups in both Chromium and WebKit, catching and fixing two real accessibility bugs along the way: a WebKit-only focus-obscuring defect on the contact form, and a duplicate ARIA banner landmark on the category page.**

## Performance

- **Duration:** ~55min (this continuation session)
- **Started:** 2026-09-16 (continuation of a session interrupted mid-Task-1 by an API rate limit before any commit)
- **Completed:** 2026-09-16T23:46:25-06:00 (Task 3 commit `0c560a7`)
- **Tasks:** 3/3
- **Files modified:** 5 text files created/modified directly (`focus.ts`, `keyboard-walk.spec.ts`, `structure.spec.ts`, `content.spec.ts`, `category.html`, `style.css`), plus 70 evidence images (40 keyboard PNGs, 30 page JPEGs)

## Accomplishments

- **Task 1 (D-14 keyboard walk):** reviewed carried-over `focus.ts`/`keyboard-walk.spec.ts` against the plan's Task 1 spec (found correct — all acceptance greps pass, no changes needed to the logic), then re-ran the full 20-combination walk from scratch in both engines rather than trust a partial prior WebKit run. Found and fixed a real WCAG 2.4.11 defect: WebKit's focus-triggered `scrollIntoView` left the contact page's message textarea mostly off-screen at 320px. Fixed with `scroll-padding-block-end: 12rem` on `html`. 31/31 tests pass in both engines; 40 contact sheets + 2 tab-order JSONs recorded.
- **Task 2 (structure.spec.ts extended):** added landmarks, DSGN-05 theme-difference proof, reduced-motion, line-height, head-script drift guard, font hygiene, and 30 full-page JPEG evidence screenshots. Writing the landmarks test caught a real bug: category.html's D-01 masthead `<header>` was a body-level sibling of `<main>`, computing to a second `banner` ARIA landmark. Fixed by moving it inside `<main>` (article.html's own already-correct pattern) and restoring its full-bleed look with a scoped negative margin. 96/96 tests pass in both engines.
- **Task 3 (content.spec.ts):** new spec covering nav order, category-name/stripe rules, `[data-block]` placement, fixture-uuid fidelity, link/image hygiene, grid chronological order (D-12), changelog dispatch fidelity (D-11, including the single-item and same-date-tie edges), article standfirst/body summary reproduction (D-10), and contact form labelling. Caught and fixed a real bug in the test's own fixture-uuid lookup before commit (see Deviations). 37/37 tests pass in both engines.
- Re-ran Task 1's full keyboard-walk suite (both engines) after Task 2's category.html DOM change, confirming zero regression in tab order or accessible names.

## Task Commits

1. **Task 1: Scripted keyboard walk with clipping, obscuring and ring-contrast assertions, plus contact-sheet evidence (D-14, criterion 3)** - `65e232b` (feat)
2. **Task 2: Full structure spec — both themes, zero-JS grids, font families, semantics, reduced motion, request hygiene, page screenshots** - `97fa804` (feat)
3. **Task 3: Content-integrity spec — nav order, stripes, D-12 order, D-01 placement, changelog fidelity, D-10, public rows** - `0c560a7` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/tests/support/focus.ts` - Focus geometry/clipping/obscuring/contrast inspection helpers (carried over from the interrupted session, reviewed and confirmed correct)
- `design/tests/keyboard-walk.spec.ts` - D-14 scripted keyboard walk + operability tests (carried over, reviewed and confirmed correct)
- `design/tests/structure.spec.ts` - Extended with landmarks, DSGN-05, reduced-motion, line-height, head-script drift, font hygiene, page evidence
- `design/tests/content.spec.ts` - New: nav order, uuid fidelity, changelog/article/contact content checks
- `design/mockups/category.html` - D-01 masthead header moved inside `<main>` (duplicate-banner-landmark fix)
- `design/mockups/style.css` - `scroll-padding-block-end` (WebKit focus-obscuring fix) + category masthead full-bleed restoration
- `design/evidence/keyboard/` - 40 contact-sheet PNGs + 2 tab-order JSONs (all 5 pages, both themes/widths/engines)
- `design/evidence/pages/` - 30 full-page JPEGs (all 5 pages, both themes, three widths)

## Decisions Made

See `key-decisions` in frontmatter: the WebKit scroll-padding fix (global CSS property, not a test-threshold change), the category.html landmark-nesting fix with full-bleed preservation, and the fixture-uuid lookup's shape-preference fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WebKit focus-triggered scrollIntoView leaves a tall field mostly off-screen (WCAG 2.4.11)**
- **Found during:** Task 1, re-running the keyboard walk from scratch in WebKit
- **Issue:** WebKit's built-in scroll-into-view-on-focus stops scrolling as soon as any part of the newly-focused element clears the viewport edge, rather than ensuring the whole element is visible (Chromium's behaviour). The contact page's message textarea (~174px tall), scrolled up from below the fold, stopped with roughly 80% of its box — and its focus ring — still below the viewport at 320px width. Confirmed via direct measurement: WebKit stopped at `scrollY: 388` with 3198px of further scroll room available (`document.documentElement.scrollHeight` - `innerHeight`), so this was WebKit choosing to stop short, not a document-height ceiling.
- **Fix:** Added `scroll-padding-block-end: 12rem` to `html` in `design/mockups/style.css`, which reserves a bottom safe zone the browser must also clear before considering a scroll target sufficiently visible. Verified empirically (100px/160px insufficient or marginal; 250px fully resolved with 112px to spare; 12rem chosen for comfortable margin over the tightest case measured).
- **Files modified:** design/mockups/style.css
- **Verification:** Full 31-test keyboard-walk.spec.ts suite passes in both Chromium and WebKit in single full runs (no isolated reruns needed).
- **Committed in:** `65e232b`

**2. [Rule 1 - Bug] category.html's D-01 masthead computed to a duplicate `banner` ARIA landmark**
- **Found during:** Task 2, writing the new landmarks test
- **Issue:** `body > header` matched two elements on category.html — the site's own chrome header, and the D-01 masthead block (`<header data-block>`), which sat as a body-level sibling of `<main>`, before it. HTML-ARIA maps a `<header>` to the `banner` role unless it is a descendant of `article`/`aside`/`main`/`nav`/`section`; a body-level masthead therefore computed to a second, indistinguishable `banner` landmark alongside the real one. article.html's own block header was already correctly nested inside `main > article` — category.html was the outlier, not the pattern.
- **Fix:** Moved the masthead `<header data-block>` to be the first child inside `<main>` (matching article.html's structure). Document order was unchanged (it sat exactly where it now sits, one level up in the tree), so tab order and accessible names were unaffected — confirmed by re-running Task 1's full keyboard-walk suite in both engines afterward (31/31 pass, `tab-order-*.json` unchanged). `main`'s own horizontal padding would have inset the masthead and broken its intentional full-bleed look, so a scoped `body[data-page="category"] main > header[data-block] { margin: 0 calc(var(--space-4) * -1); }` cancels it out — verified pixel-exact (`left: 0, right: <viewport width>`) at 320/768/1280px, matching the pre-fix bleed exactly.
- **Files modified:** design/mockups/category.html, design/mockups/style.css
- **Verification:** `structure.spec.ts`'s landmarks test passes for category in both engines; full keyboard-walk and structure suites re-run clean in both engines after the change; `npm run check:contrast` and `npm run test:unit` unaffected.
- **Committed in:** `97fa804`

**3. [Rule 1 - Bug] content.spec.ts's own fixture-uuid lookup shadowed real rows with bare image-candidate records**
- **Found during:** Task 3, first run of the fixture-uuid fidelity test
- **Issue:** `design/fixtures/stress-set.json`'s `cases.usable-image.rejected` (and `category-lead.rejected`) arrays contain bare `{uuid, url, headStatus, reason}` image-candidate records that share a uuid with a real, fully-fielded article row filed elsewhere in the same fixture (e.g. under `cases.feed`). A first-seen-wins recursive walk picked up the candidate record first for several uuids (object key order put `usable-image` before `feed`), reporting `status: "undefined"` — a false failure on legitimately published, non-duplicate rows, not a real content defect.
- **Fix:** Both `readFixtureRowsByUuid()` and the article page's single-row lookup now only accept an object once it actually has a `status` field (the real-row shape), so an earlier-encountered candidate record can never shadow the real one.
- **Files modified:** design/tests/content.spec.ts
- **Verification:** Re-ran the fixture-uuid test; all previously-false failures (including uuid `aee43053-...`, the Fredd Young community card reused across four pages) now correctly resolve to their real `feed`/named-case row.
- **Committed in:** `0c560a7`

---

**Total deviations:** 3 (all Rule 1 - auto-fixed bugs; two are real accessibility defects in the shipped mockups, one is a bug in this plan's own new test).
**Impact on plan:** All three were necessary for correctness. The two accessibility fixes (WebKit scroll-padding, category.html landmark nesting) are genuine improvements caught by driving real browsers and writing real landmark checks — exactly the kind of finding D-14 and criterion 1 exist to catch. No scope creep: nothing outside this plan's own files was touched, and font-swap CLS timing (WINDOWS.md entries 4/5/6, owned by 01-09) was explicitly left alone per the plan's own scope boundary.

## Issues Encountered

- **`npm run verify:phase-1 -- --criteria=1,3,5` exits 1, not 0** — criteria 1 and 3 (this plan's actual scope) PASS cleanly in both engines with zero exceptions. Criterion 5 fails on two pre-existing, already-documented font-swap-CLS-timing findings: WebKit's index@320px (`geometryScore: 0.7587...`, matching WINDOWS.md entry 4's "up to 0.76" WebKit-Docker-missing-font root cause exactly) and Chromium's changelog@320px (native CLS `0.012502...`, matching entry 6's recorded `0.0125` exactly). Both were investigated and root-caused in 01-07 and are explicitly out of this plan's scope ("font-swap CLS timing belongs to 01-09 — don't fix, don't weaken"). Not re-investigated, not worked around, not weakened — recorded here per `human_verify_mode: end-of-phase`, matching 01-07's own precedent for the identical situation.
- **`font-cls.spec.ts`'s serial mode aborts the rest of an engine's run on the first failure** (same pattern 01-07-SUMMARY already documented) — confirmed each failure was the *only* new information in its run by checking the reported values match WINDOWS.md exactly; no isolated per-page reruns were needed since the values already matched known entries.

## Known Stubs

None new. All content shown (including the reused "Latest Stories" cards and the tracking-pixel `img` on category.html's grid, which is real corpus `image_url` data as-is, not a stub) is real corpus content per 01-06/01-07's precedent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three of this plan's tasks are complete: D-14 keyboard walk (criterion 3), the structural half of criteria 1 and 5 (landmarks, DSGN-05, reduced motion, fonts), and the content-integrity half of criteria 1 and 5 (nav order, D-01/D-10/D-11/D-12, fixture fidelity) are all proven in both Chromium and WebKit.
- Two real accessibility bugs were found and fixed before they could reach 01-09/01-10: the WebKit focus-obscuring defect on the contact form, and the duplicate banner landmark on category.html.
- Carry forward to `01-09` (font-swap matrix): WINDOWS.md entries 1, 4, 5 and 6 all still need the same real-Safari spot-check flagged since 01-02/01-07 — unchanged by this plan.
- Carry forward to `01-10` (approval packet): the owner's own D-14 keyboard-and-eyes pass (tab order and operability judgement) is still needed — this plan's scripted walk provides coverage and regression protection, not the owner's judgement call, per D-14's own design.
- No blockers for 01-09 or 01-10.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All files listed above verified present on disk; all three task commits
(`65e232b`, `97fa804`, `0c560a7`) verified present in git history.

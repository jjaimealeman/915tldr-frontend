---
phase: 01-design-sketch-editorial-identity
plan: 18
subsystem: ui
tags: [markdown, html-escaping, playwright, i18n, css, images]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-12: design/scripts/lib/summary-markdown.mjs (escapeHtml, parseSummary, renderSummaryHtml, summaryPlainText, validateBlocks), TDD-tested against every fixture summary"
  - phase: 01-design-sketch-editorial-identity
    provides: "01-17: chrome.spec.ts (header rule, toggle alignment, tab order) and the external-link new-tab contract this plan's markup changes must not break"
provides:
  - "design/scripts/render-summaries.mjs: idempotent static-page conversion of <p data-summary> to rendered <div data-summary>, applied to all five mockup pages"
  - "A closed [data-summary]/[data-key-details] CSS + markup contract (real <p>/<ul>/<li>, no raw markdown) any future phase (including the eventual Astro rebuild) can copy verbatim"
  - "The category lead's D-09 image/typographic contract enforced with CSS + a dedicated lead-fallback.spec.ts geometry suite (24 tests)"
affects: [01-19, 01-20, 01-21, 01-22, 01-23]

actuals:
  tokens: 43900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Idempotent markup-conversion scripts: render-summaries.mjs only ever matches its own not-yet-converted source tag (<p data-summary>), so a second run is provably a no-op and the script is safe to re-run against pages that already ran through it."
    - "Test-harness parity with production rendering: design/tests/support/i18n.ts's injectText() now routes any [data-summary] hook through the same parseSummary/renderSummaryHtml/summaryPlainText functions the real converter uses, instead of pasting raw text — the Spanish-injection test fixture exercises the same code path production content will."
    - "Defensive CSS net alongside a build-time contract: [data-lead-variant=\"image\"]:not(:has([data-frame] img)) degrades to the typographic lead even if the build-time image-selection contract is ever violated, rather than relying on that contract alone."

key-files:
  created:
    - design/scripts/render-summaries.mjs
    - design/tests/lead-fallback.spec.ts
  modified:
    - design/mockups/index.html
    - design/mockups/category.html
    - design/mockups/article.html
    - design/mockups/changelog.html
    - design/mockups/contact.html
    - design/mockups/style.css
    - design/tests/content.spec.ts
    - design/tests/support/i18n.ts

key-decisions:
  - "render-summaries.mjs only matches <p data-summary> (not the already-converted <div data-summary>), so re-running it against a partially- or fully-converted page is always safe and reports converted=0 removed=0 -- no separate 'has this already run' state needed."
  - "injectText()'s ambiguous-target fallback for a [data-summary] hook now renders through the real markdown converter (matching what the bilingual production pipeline will actually do) instead of overwriting textContent with raw fixture markdown -- fixes a real Spanish-overflow false-positive this plan's own CSS change (removing white-space:pre-line) introduced."
  - "The category-lead defensive CSS (:not(:has([data-frame] img))) is additive, not a replacement for the build-time image-selection contract -- it also catches an <img> being removed or failing after the page ships, which a build-time-only guarantee cannot."

requirements-completed: [DSGN-01, DSGN-06, I18N-07]

coverage:
  - id: D1
    description: "render-summaries.mjs converts every <p data-summary> element on all five mockup pages into <div data-summary> holding rendered markdown HTML (real <p>, <p><strong>Key Details:</strong></p>, ul[data-key-details]>li), and is idempotent (a second run reports converted=0 removed=0 on every page)"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "node design/scripts/render-summaries.mjs (run twice); design/tests/content.spec.ts#summaries render markdown as HTML: no bold marker in rendered text; Key Details are a strong label plus a list @c1 (all five pages, both engines)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No rendered text on any of the five pages contains the literal '**' markdown marker; every Key Details list's items match the fixture's own bullet lines in order (defect 9 closed)"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/content.spec.ts#summaries render markdown as HTML ... @c1 (index: 25 marker lines found and fixed; category: 11 marker lines found and fixed; article/changelog/contact: 0 found, unaffected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Spanish injection into a [data-summary] hook renders through the same markdown converter as production, so the overflow/clip/container-growth checks still pass on index in both engines (I18N-07)"
    requirement: "I18N-07"
    verification:
      - kind: automated_ui
        ref: "design/tests/spanish-overflow.spec.ts (32/32, all five pages, both engines, including the previously-failing lead-summary@768px/1280px cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The category lead is image-led only when it holds exactly one image matching the fixture's chosen usable-image record (src, headStatus 200, never in rejected[]); otherwise it is the typographic variant with no image frame at all"
    requirement: "DSGN-01"
    verification:
      - kind: automated_ui
        ref: "design/tests/content.spec.ts#lead contract: image-led only with the fixture's chosen usable image, otherwise typographic with no frame @c1 (index: type; category: image)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The category lead's layout never breaks: baseline image lead, a simulated no-image build, an image-led lead with the <img> removed, and a genuine same-origin 404 all produce a stable, non-overlapping, non-scrolling layout at 320/768/1280px x light/dark"
    requirement: "DSGN-01"
    verification:
      - kind: automated_ui
        ref: "design/tests/lead-fallback.spec.ts (24/24, both engines)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The changelog's D-11 no-list rule still holds after the markup conversion (changelog cards carry no Key Details); structure.spec.ts and spanish-overflow.spec.ts regression suites pass unchanged across all five pages"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/content.spec.ts#no ul/ol/li inside main...@c1; design/tests/structure.spec.ts (96/96, both engines)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The owner views category.html with real network access (unblocked images) at 1280px in light and dark, confirming the lead's loaded photo sits comfortably beside an uncramped text column"
    verification: []
    human_judgment: true
    rationale: "Tests block third-party requests by design (harness.ts's blockThirdParty), so no automated run in this environment ever paints the lead's real hotlinked KTSM photo -- only a human with real network access can see the loaded image, per this plan's own human-check step."

duration: 35min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 18: Summary Markdown to HTML + Category Lead Image Fallback Summary

**Converted every raw `**Key Details:**`/bullet-markdown summary on all five mockup pages into real HTML via the 01-12 converter, and made the category lead degrade to a typographic layout whenever no usable image exists — closing defect 9 and revision request 2 from `01-APPROVAL.md`.**

## Performance

- **Duration:** ~35 min (Tasks 1-3)
- **Started:** 2026-09-17
- **Completed:** 2026-09-17
- **Tasks:** 3 (all complete)
- **Files modified:** 10 (2 new, 8 modified)

## Accomplishments

- Reproduced the defect exactly as planning predicted: 25 raw `**`-marker lines on `index.html`, 11 on `category.html`, 0 on `article.html`/`changelog.html`/`contact.html`.
- Built `design/scripts/render-summaries.mjs` — an idempotent, `--pages=`-scoped converter that turns every `<p data-summary>` into `<div data-summary>` holding real `<p>`, `<p><strong>Key Details:</strong></p>`, `<ul data-key-details><li>...` markup via 01-12's `parseSummary`/`renderSummaryHtml`. A second run of the same command always reports `converted=0 removed=0`.
- Applied the converter to all five pages: 33 elements on index, 13 on category, 3 each on article/changelog/contact.
- Rewrote the `[data-summary]` CSS rules (removed `white-space: pre-line`, added real block/list spacing) with no colour literal.
- Found and fixed a real regression the CSS change caused in `design/tests/support/i18n.ts`: `injectText()`'s generic fallback used to paste the Spanish fixture's raw markdown as a flat text node, which — once `white-space: pre-line` was gone — collapsed the multi-paragraph/bullet structure and tripped the Spanish-overflow container-growth guard. Fixed by routing `[data-summary]` hooks through the real converter, matching what the production bilingual pipeline will actually do.
- Enforced D-09's existing "image-led only with a usable image" rule on the category page with two defensive `:not(:has([data-frame] img))` CSS rules, and proved it holds in every failure mode (no image, image removed, broken image) with a new 24-test `lead-fallback.spec.ts`.
- Added a "lead contract" test to `content.spec.ts` that checks the lead's image against the fixture's own `chosen`/`rejected` image records — not just "an image exists somewhere."

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Rendered Key Details on index** - `12be8ce` (feat)
2. **Task 2: Convert the remaining four pages** - `7c89813` (feat)
3. **Task 3: Category lead image-led only with a usable image** - `674cfab` (feat)

## Files Created/Modified

- `design/scripts/render-summaries.mjs` - idempotent `<p data-summary>` → `<div data-summary>` markdown-to-HTML converter, `--pages=` flag
- `design/mockups/index.html` - 33 summaries converted (25 with Key Details)
- `design/mockups/category.html` - 13 summaries converted (11 with Key Details)
- `design/mockups/article.html`, `changelog.html`, `contact.html` - 3 summaries each converted (no Key Details in any of them)
- `design/mockups/style.css` - `[data-summary]`/`[data-key-details]` block rules; two defensive `:not(:has([data-frame] img))` rules for the category lead
- `design/tests/content.spec.ts` - new "summaries render markdown as HTML" test (all five pages) and "lead contract" test (index, category)
- `design/tests/support/i18n.ts` - `injectText()` now renders `[data-summary]` hooks through the real markdown converter
- `design/tests/lead-fallback.spec.ts` - new: 24 geometry tests (baseline / no-image / image-removed / broken-image × 3 widths × 2 themes)

## Decisions Made

- render-summaries.mjs's idempotency comes from matching only the not-yet-converted `<p data-summary>` tag — no separate "already ran" marker is needed, and it's always safe to re-run against any mix of converted/unconverted pages.
- The `injectText()` fix routes `[data-summary]` hooks through the real converter rather than special-casing the test's expected text — this keeps the test fixture honest about what production will actually render, instead of loosening the container-growth assertion to tolerate a shape production will never produce.
- The category lead's CSS fix is additive to (not a substitute for) the build-time "only render `data-lead-variant=\"image\"` with a real usable image" contract — it also protects against an image later failing or being removed from an already-shipped page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a Spanish-injection regression caused by this plan's own CSS change**
- **Found during:** Task 1, running `spanish-overflow.spec.ts` for index per the task's own verify step
- **Issue:** Removing `white-space: pre-line` from `[data-summary]` (required by this task) broke `design/tests/support/i18n.ts`'s `injectText()`: its generic "ambiguous target → overwrite the whole element" fallback pasted the Spanish fixture's raw `**Puntos clave:**`/bullet markdown into `[data-summary]` as a flat text node. With `pre-line` gone, that collapsed to one run-on line, shrinking the container and failing the container-growth guard at 768px/1280px in both engines (`lead-summary`).
- **Fix:** `injectText()` now detects a `[data-i18n]` hook that resolves directly to a `[data-summary]` element and renders the injected text through the same `parseSummary`/`renderSummaryHtml`/`summaryPlainText` functions the static-page converter uses, computed in the Node/test-runner context and passed into `page.evaluate` as data (never eval'd in-page).
- **Files modified:** `design/tests/support/i18n.ts`
- **Verification:** `spanish-overflow.spec.ts` for index went from 2 failing / 12 passing to 14/14 passing in both engines; full five-page run: 32/32.
- **Committed in:** `12be8ce` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, directly caused by this plan's own CSS change)
**Impact on plan:** Necessary for correctness — without the fix, the plan's own must-have truth ("Spanish injection and overflow checks still pass") would have been false. No scope creep: the fix is scoped to the exact hook shape this plan's markup change affected.

## Issues Encountered

None beyond the deviation above.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Owner human-check outstanding (per this plan's own verify step, not a blocking checkpoint since this plan is `autonomous: true` with no `checkpoint:*` tasks): open `category.html` with real network access at 1280px in light and dark, confirm the lead's loaded KTSM photo sits comfortably beside the text column.
- `render-summaries.mjs` and the `[data-summary]`/`[data-key-details]` markup contract are ready for any future plan that touches summary rendering (including the eventual Astro rebuild, which can port the same converter).
- The category lead's image/typographic contract and its `lead-fallback.spec.ts` coverage are ready to be reused as a pattern for any other conditionally-imaged component.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

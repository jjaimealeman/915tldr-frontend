---
phase: 01-design-sketch-editorial-identity
plan: 17
subsystem: ui
tags: [css, accessibility, playwright, aria, i18n, tabnabbing]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-13's theme-toggle [hidden]/visibility:hidden CLS fix (must not be undone by the toggle's repositioning); the Spanish calibration pipeline (design/scripts/calibrate-spanish.mjs, design/tests/support/i18n.ts) built across 01-04/01-13/01-15"
provides:
  - "Header masthead rule removed; the eight-segment spectrum stripe closes the masthead on its own (revision request 1)"
  - "Theme toggle aligned to the header/nav content column at >=80em via a percentage-based margin-inline-start calc(), instead of sitting at the raw viewport edge (defect 10)"
  - "Every external anchor on article.html and contact.html opens target=_blank with rel=noopener, a decorative aria-hidden icon, and a visually-hidden accessible cue ending in '(opens in a new tab)' (revision request 6)"
  - "New-tab activation proven safe in both Chromium and WebKit for both Enter and a real click: window.opener is null, the original page URL is unchanged, and the popup never reaches a real external host"
  - "The new-tab cue is localised into Spanish (assistiveOnly fixture component), proven to land in the accessible name without moving the link's box"
affects: [any later phase touching header/nav chrome, external-link markup, or the Spanish calibration fixture]

actuals:
  tokens: 7450
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A body-level chrome element (the theme toggle) that isn't part of the max-width:80rem/margin:0-auto centred group aligns its own left edge independently via margin-inline-start: calc(max(0px, (100% - 80rem) / 2) + var(--space-4)) — a percentage resolves against the containing block's content width (no scrollbar-width fudge needed) and must be re-derived from the root element's actual computed font-size in a test, not assumed to be 16px/rem, when the root font-size is itself a fluid clamp() token"
    - "An accessible 'opens in a new tab' cue is a real visually-hidden text node inside the link (the sr-only clip-path pattern — position:absolute; width/height:1px; clip-path:inset(50%)), never a title attribute or an aria-label override, so it participates in the link's normal accessible-name computation and is provable with Playwright's toHaveAccessibleName rather than by reading markup"
    - "Playwright's page.route does not see a popup's first request; proving a target=_blank activation never reaches the real network requires a context.route stub, registered before the page navigates, that fulfils every non-local request so the popup's own document is verifiably the stub, not a real fetch"
    - "A SpanishComponent fixture entry whose injection hook is a visually-hidden element is marked assistiveOnly and excluded from the general overflow/clip layout loop (no meaningful rendered geometry to check there) but gets its own dedicated accessible-name + unchanged-bounding-box test instead"

key-files:
  created:
    - design/tests/chrome.spec.ts
  modified:
    - design/mockups/style.css
    - design/mockups/article.html
    - design/mockups/contact.html
    - design/tests/content.spec.ts
    - design/tests/keyboard-walk.spec.ts
    - design/tests/spanish-overflow.spec.ts
    - design/tests/support/i18n.ts
    - design/fixtures/spanish-stress.json

key-decisions:
  - "01-17 Task 1: the plan's own '(1920 - 1280) / 2' acceptance formula assumed 1rem = 16px; --step-0 (html's font-size) is a fluid clamp() token that resolves to 18px at 1920px viewport width, making 80rem actually 1440px there, not 1280px. Verified with a minimal standalone Playwright reproduction before changing the test (not the CSS, which was already correct) — chrome.spec.ts now reads the root's real computed font-size and derives the 80rem pixel value from it."
  - "01-17 Task 1: the plan's tab-order must-have truth ('skip link, eight sections, toggle') omits a real, pre-existing focus stop — category.html/article.html/changelog.html/contact.html's masthead is a real <a href=\"index.html\"> home link (index.html's own masthead is a plain non-link <h1>, since it's already the homepage). Verified by direct reproduction (a standalone tab-press script) before writing the test; chrome.spec.ts detects [data-wordmark] a's presence per page rather than asserting a sequence that contradicts four of the five pages' actual, working, unrelated-to-this-plan markup."
  - "01-17 Task 3: proved new-tab safety with a context.route stub that returns a distinguishable stub body ('stub'), not just an aborted/blocked request — asserting the popup's own rendered content is the stub is strictly stronger evidence that no real network fetch reached ktsm.com/jjaimealeman.com/915website.com than only checking 'no request left 127.0.0.1' would be."

requirements-completed: [DSGN-01, DSGN-02, DSGN-05, I18N-07]

coverage:
  - id: D1
    description: "Header has no bottom border in either theme at any width; the spectrum rule closes the masthead"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "design/tests/chrome.spec.ts — 'header has no bottom border; spectrum closes the masthead; toggle stays in the content column' (all 5 pages x 2 themes x 4 widths) @c1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Theme toggle's left edge lines up with the header's content edge at 320/768/1280/1920px, and no longer sits at the raw viewport edge at 1920px (defect 10)"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "design/tests/chrome.spec.ts — same test as D1, toggle-alignment assertions @c1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab order (skip link, wordmark link where real, 8 sections, toggle) is unchanged by the CSS-only header/toggle fix"
    requirement: "DSGN-05"
    verification:
      - kind: e2e
        ref: "design/tests/chrome.spec.ts — 'tab order: skip link, eight sections...' @c1; design/tests/keyboard-walk.spec.ts full run, both engines"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every external anchor (article.html, contact.html) has target=_blank, rel including noopener, a decorative icon, and an accessible cue ending '(opens in a new tab)'; internal links have neither"
    verification:
      - kind: e2e
        ref: "design/tests/content.spec.ts — external-link test, all 5 pages, both engines @c1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Activating an external link by Enter or a real click opens a new page with window.opener === null, the original page stays put, and the popup never reaches the real network"
    verification:
      - kind: e2e
        ref: "design/tests/keyboard-walk.spec.ts — 'external links open a new tab with no opener, by Enter and by click' (article, contact) @c1 @c3"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Spanish new-tab cue (real + synthetic +25%) lands at the end of the link's accessible name and never moves the link's box"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "design/tests/spanish-overflow.spec.ts — 'assistive-only Spanish cue lands in the accessible name without moving the link' (article) @c4"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 17: Header rule, toggle position, and accessible new-tab links Summary

**Header masthead rule removed in favour of the spectrum stripe, theme toggle re-aligned to the content column at wide viewports, and all four external links (article.html, contact.html) now open in a new tab with a proven-safe `window.opener === null` activation and a visually-hidden, Spanish-localised accessible cue.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-09-17T21:20:14Z (approx., immediately following 01-16's completion)
- **Completed:** 2026-09-17T21:52:22Z
- **Tasks:** 3 of 3
- **Files modified:** 9 source/test files (plus regenerated evidence screenshots/contact sheets)

## Accomplishments

- Closed revision request 1: `header:not([data-block])`'s `border-bottom` is gone; the eight-segment `[data-spectrum]` colour stripe is the masthead's only closing rule, in both themes, at every width.
- Closed defect 10: `[data-theme-toggle]` aligns its left edge with the header/nav content column at `>=80em` via a percentage-based `margin-inline-start` calc(), rather than sitting at the raw viewport edge at 1920px.
- Closed revision request 6: all four external anchors (2 on article.html to ktsm.com, 2 on contact.html to jjaimealeman.com/915website.com) now carry `target="_blank"`, `rel` including `noopener`, a decorative `aria-hidden` icon, and a visually-hidden `" (opens in a new tab)"` cue that's part of the link's real accessible name.
- Proved — not just asserted from markup — that activating an external link by Enter or a real click opens a new page with `window.opener === null` and never reaches the real external host, in both Chromium and WebKit.
- Localised the new-tab cue into Spanish (`es_real`/`es_synthetic`) and proved it lands in the accessible name and never shifts the link's rendered box.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Header rule removed and toggle held in the column** — `eccbbcf` (feat)
2. **Task 2: External links open in a new tab with a visible icon and an accessible cue** — `6bfab96` (feat)
3. **Task 3: Prove new-tab activation is safe in both engines, and localise the cue** — `7d8759b` (feat)

**Plan metadata:** `554f12f` (docs: complete plan)

## Files Created/Modified

- `design/tests/chrome.spec.ts` — new; header border-bottom, spectrum placement, toggle column alignment (5 pages x 2 themes x 4 widths), tab-order check per page
- `design/mockups/style.css` — masthead border removed; `[data-theme-toggle]` display:block/width:fit-content + 80em alignment calc; new `[data-visually-hidden]`/`[data-new-tab-icon]` utilities
- `design/mockups/article.html` — 2 external anchors gain `target="_blank"` + icon + cue (first carries `data-i18n="new-tab-cue"`)
- `design/mockups/contact.html` — 2 external anchors gain `target="_blank"` + icon + cue
- `design/tests/content.spec.ts` — external-link test rewritten to origin-resolve every `a[href]`, assert target/rel/scheme/icon/cue for external links and their absence for same-origin links, plus `toHaveAccessibleName`
- `design/tests/keyboard-walk.spec.ts` — new per-page (article, contact) new-tab activation test using a `context.route` stub
- `design/tests/support/i18n.ts` — `SpanishComponent.assistiveOnly?: boolean`
- `design/fixtures/spanish-stress.json` — new `new-tab-cue` component (`assistiveOnly: true`), calibrated via `calibrate-spanish.mjs --only=new-tab-cue`
- `design/tests/spanish-overflow.spec.ts` — `componentsForPage` excludes `assistiveOnly`; new dedicated accessible-name/bounding-box test for the cue

## Decisions Made

See `key-decisions` in the frontmatter above — both are premise corrections verified by direct reproduction before changing any test (the plan's `(1920-1280)/2` formula and its assumed 10-stop tab order), not CSS bugs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, in the plan's own acceptance check] 1920px toggle-alignment threshold assumed a fixed 16px/rem**
- **Found during:** Task 1, first `chrome.spec.ts` run
- **Issue:** The plan's Task 1 action text specifies "At 1920, its left edge is ≥ (1920 − 1280) / 2" — this assumes `1rem = 16px`. `html`'s font-size is `--step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem)`, a fluid token that resolves to 18px at 1920px viewport width (clamped to its ceiling), making the real 80rem breakpoint 1440px there, not 1280px. The CSS itself (`calc((100% - 80rem) / 2 + var(--space-4))`) was already correct; only the plan's illustrative numeric check was wrong.
- **Fix:** `chrome.spec.ts` now reads `getComputedStyle(document.documentElement).fontSize` and derives the expected 80rem pixel value from that measured number instead of a hard-coded 1280.
- **Files modified:** `design/tests/chrome.spec.ts`
- **Verification:** Reproduced first with a standalone diagnostic script (measuring the real computed values) before touching the test; `chrome.spec.ts` now passes 90/90 in both engines.
- **Committed in:** `eccbbcf`

**2. [Rule 1 - Bug, in the plan's own acceptance check] Tab-order truth omitted a real, pre-existing focus stop on 4 of 5 pages**
- **Found during:** Task 1, first `chrome.spec.ts` tab-order run
- **Issue:** The plan's must-have truth states the tab order is "skip link, the eight section links, the theme toggle" with nothing else. `category.html`/`article.html`/`changelog.html`/`contact.html`'s masthead is `<p data-wordmark><a href="index.html">915 TLDR</a></p>` — a real, keyboard-focusable home link between the skip link and the nav, unrelated to and untouched by this plan. Only `index.html` (already the homepage) uses a plain non-link `<h1>`.
- **Fix:** `chrome.spec.ts`'s tab-order test detects `[data-wordmark] a`'s presence per page and includes it in the expected sequence only where it's real, rather than asserting a 10-stop sequence that would fail against four of the five pages' actual, working markup.
- **Files modified:** `design/tests/chrome.spec.ts`
- **Verification:** Reproduced with a standalone diagnostic Playwright script (direct Tab presses, logging `document.activeElement`) before writing the fix; confirmed against `design/evidence/keyboard/tab-order-chromium.json`'s existing (pre-this-plan) content, which already showed the wordmark stop for these four pages.
- **Committed in:** `eccbbcf`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — real bugs in the plan's own illustrative acceptance numbers, verified by direct reproduction before changing anything, per the "verify the premise" standard). No CSS/markup change was needed for either; only the new test's own expectations were corrected. No threshold was weakened and no check was dropped.
**Impact on plan:** Both corrections were necessary for `chrome.spec.ts` to assert something true rather than something the plan assumed without checking against this project's own fluid-typography token and pre-existing masthead markup. No scope creep.

## Issues Encountered

None beyond the two premise corrections above — no misdiagnosis cycle, no architectural questions, no auth gates.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

01-17 is complete. Revision requests 1 and 6 and defect 10 are closed and verified in both Chromium and WebKit, at all four widths and both themes, with tab order provably unchanged. Remaining open items from `01-APPROVAL.md` (revision requests 2–5, 7–8; defect 9) are tracked for later gap-closure plans and are not touched here.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 9 key files and the SUMMARY itself confirmed present on disk; all 3 task commit hashes (`eccbbcf`, `6bfab96`, `7d8759b`) confirmed present in `git log`.

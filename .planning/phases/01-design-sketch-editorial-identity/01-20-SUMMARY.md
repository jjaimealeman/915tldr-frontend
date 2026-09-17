---
phase: 01-design-sketch-editorial-identity
plan: 20
subsystem: design-system
tags: [html, css, mockups, layout, grid, playwright, webkit]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-19: main[data-layout=\"with-rail\"] / [data-reading-column] / [data-rail] primitive and its 64em breakpoint, reused verbatim by the changelog page here"
provides:
  - "design/mockups/changelog.html: main[data-layout=\"with-rail\"] wrapping h1/lede/eight dispatches in div[data-reading-column], trailing grid converted to aside[data-rail] with three compact cards"
  - "design/mockups/contact.html: h1/intro/links/form wrapped in div[data-contact-column]"
  - "design/mockups/style.css: explicit grid-template-areas dispatch placement (fixes the auto-placement squeeze bug); --column-narrow: 44rem token; [data-contact-column] centring at >=64em; [data-contact-column] + [data-grid-heading] spacing rule"
  - "design/tests/layout.spec.ts: \"layout: changelog\" and \"layout: contact\" blocks proving geometry at five widths, both engines"
affects: []

actuals:
  tokens: 5785
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "CSS grid-template-areas (named placement) is now the house pattern for a multi-item row that must not rely on implicit auto-placement — the changelog dispatch bug was exactly the failure mode 01-06 hit on the image lead: two explicit column tracks with three items let the browser silently wrap the third item under the first instead of erroring."
    - "A fixed rem-width column (e.g. --column-narrow: 44rem) may be centred with margin-inline:auto even under the 01-07 house rule against centring a font-swap-sensitive container — the rule specifically targets ch/em units, which are font-relative; rem is not."

key-files:
  created: []
  modified:
    - design/mockups/changelog.html
    - design/mockups/contact.html
    - design/mockups/style.css
    - design/tests/layout.spec.ts

key-decisions:
  - "Reproduced the changelog squeeze before touching any code (scratch Playwright script, both engines, 320-1920px): confirmed the bug is real but confined to >=80em (1280px, 1920px) — the owner's '768px' label in 01-APPROVAL.md was inaccurate, but the underlying auto-placement bug was genuine and is now fixed."
  - "Fixed the dispatch grid with named grid-template-areas (\"date title\" / \"date body\") rather than reordering the two-column auto-placement rule — explicit placement is immune to source-order/implicit-grid surprises regardless of item count."
  - "Unset the changelog reading column's own max-width at >=64em (body[data-page=\"changelog\"] override) since its children ([data-lede], dispatch h2/body) already carry --measure individually — capping the column itself would have been a redundant second width limit, unlike article's single-body column which needs the cap directly."
  - "Centred the contact column with a fixed --column-narrow: 44rem (rem, not ch/em) — the 01-07 prohibition on centring a font-relative-width container does not apply to a rem value, so margin-inline:auto is safe here."
  - "Task 1 is type=\"tracer\" with only automated <verify> (no human-check attached); proceeded directly to Task 2 after all of Task 1's automated checks passed cleanly (30/30 both engines) rather than pausing for a tracer feedback checkpoint, consistent with this project's established human_verify_mode:end-of-phase convention (see WINDOWS.md) and the sequential_execution instructions directing a single consolidated final report. The only genuine human-judgment item in this plan (contact centring, Task 2's explicit human-check) is reported below for the owner."

patterns-established:
  - "Before touching CSS for a reported layout bug, reproduce it first with a scripted before/after measurement across the full width matrix — this caught that the owner's reported width (768px) was not where the bug actually lived (80em/1280px), without which the fix could have targeted the wrong breakpoint."

requirements-completed: [DSGN-07, DSGN-01, DSGN-02, I18N-07]

coverage:
  - id: D1
    description: "Changelog dispatch date/title/body no longer auto-place incorrectly at >=80em; every dispatch's body starts at the same left edge as its title at all five widths, both engines"
    requirement: "DSGN-07"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=all design/tests/layout.spec.ts (\"layout: changelog\", 18/18 x2, both engines)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changelog and contact adopt the with-rail/full-width-below-1024 layout (changelog and contact parts of revision request 7)"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "design/tests/layout.spec.ts — reading-column/rail full-width-vs-beside assertions at 320/768 and 1024/1280/1920px, both pages, both engines"
        status: pass
    human_judgment: false
  - id: D3
    description: "Changelog D-11 fidelity (no ul/ol/li in main, dispatch order/titles/dates/items match changelog.json exactly) still holds after the restructure"
    requirement: "DSGN-07"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=changelog node design/scripts/pw.mjs --project=all design/tests/content.spec.ts (25/25 x2, both engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Changelog and contact still pass keyboard walk, structure and Spanish-overflow checks"
    requirement: "DSGN-02"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=changelog|contact node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts, structure.spec.ts; MOCKUP_PAGES=contact,changelog ...spanish-overflow.spec.ts (all pass, both engines)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Contact column is centred at >=1024px (capped at 44rem), full width below, and the Send-message/Latest-Stories spacing bug is fixed (>=32px gap everywhere)"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "design/tests/layout.spec.ts — \"layout: contact\" (18/18 x2, both engines)"
        status: pass
      - kind: manual_procedural
        ref: "Owner view of contact.html at 1280/1920px, both themes (plan's human-check)"
        status: unknown
    human_judgment: true
    rationale: "Whether a centred column 'looks right' is the owner's own call per the plan's explicit human-check; a scripted geometry measurement is offered as strong supporting evidence but does not substitute for the owner's visual sign-off."

duration: ~11min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 20: Changelog Layout Fix and Contact Centring Summary

**Changelog dispatch dates/titles/bodies fixed with explicit CSS grid-template-areas (replacing a silent two-column auto-placement bug) and moved onto the article's with-rail layout; contact page gets a centred 44rem column at desktop and a real gap before "Latest Stories" — both pages full width at 768px.**

## Performance

- **Duration:** ~11min
- **Started:** 2026-09-17T22:25:46Z (session continuation, Phase 1 execution)
- **Completed:** 2026-09-17T22:36:12Z (Task 2 commit `59ccdc6`)
- **Tasks:** 2/2
- **Files modified:** 4 source/test files + 30 regenerated evidence artifacts (keyboard contact sheets, full-page screenshots) — a direct, expected side effect of re-running the keyboard-walk and structure evidence tests against the changed pages

## Accomplishments

- Reproduced the changelog squeeze bug before any fix, in both engines at 320/768/1024/1280/1920px: confirmed real but confined to `>=80em` (1280px, 1920px) — 320/768/1024px were never affected, correcting the owner's "768px" label in `01-APPROVAL.md` while confirming the underlying bug was genuine
- `style.css`'s `[data-dispatch]` rule at `>=80em` replaced with explicit `grid-template-areas: "date title" "date body"`, fixing the root cause: the old rule had two column tracks for three items, and CSS auto-placement wrapped the body under the date column instead of beside the date at the title's own width
- `changelog.html` adopts 01-19's `[data-layout="with-rail"]` primitive: h1, the lede and all eight dispatches wrapped in `div[data-reading-column]`; the trailing grid becomes `aside[data-rail]` with three compact cards, keeping D-11 (no lists in `main`) intact
- `contact.html`'s h1/intro/links/form wrapped in `div[data-contact-column]`, centred at `>=64em` via a new `--column-narrow: 44rem` token (`margin-inline: auto` — safe here since the width is `rem`, not `ch`/`em`, so the 01-07 font-swap-CLS centring rule doesn't apply)
- New `[data-contact-column] + [data-grid-heading]` rule adds `space-7` top margin, fixing the Send-message-button-touches-Latest-Stories spacing bug at every width
- `design/tests/layout.spec.ts` grows two new `@c1` blocks — `"layout: changelog"` (18 tests) and `"layout: contact"` (18 tests) — for 48/48 total in the file, both engines
- A scripted geometry measurement (both engines, both themes, 1280/1920px) confirms the contact column is genuinely centred: width matches 44rem exactly at the resolved root font-size, left/right gaps equal in every combination, button-to-heading gap ~54px

## Task Commits

1. **Task 1 (tracer): Changelog — reproduce the squeeze, fix placement explicitly, adopt the rail layout, prove geometry in both engines** - `b1dcfb0` (feat)
2. **Task 2: Contact — a centred rem-width column, full width at tablet, and real space before "Latest Stories"** - `59ccdc6` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/mockups/changelog.html` - `main[data-layout="with-rail"]`, `div[data-reading-column]` wrapping h1/lede/dispatches, `aside[data-rail]` replacing the trailing grid
- `design/mockups/contact.html` - `div[data-contact-column]` wrapping h1/intro/links/form
- `design/mockups/style.css` - explicit dispatch `grid-template-areas`; dropped base `max-width` on `[data-lede]`/`[data-dispatch]`/`[data-contact-intro]`/`form[data-contact-form]`; changelog reading-column `max-width: none` override; `--column-narrow` token; `[data-contact-column]` centring; spacing rule
- `design/tests/layout.spec.ts` - New `"layout: changelog"` and `"layout: contact"` describe blocks, `@c1`
- 30 regenerated evidence artifacts (`design/evidence/keyboard/changelog-*`, `design/evidence/keyboard/contact-*`, `design/evidence/pages/changelog-*.jpg`, `design/evidence/pages/contact-*.jpg`)

## Before-Fix Measurement Table (Task 1, changelog dispatch squeeze)

Scripted reproduction, chromium and webkit, before any CSS change — every dispatch's body-left vs. title-left edge, light theme:

| Width | Engine | Squeezed? | body.left | title(h2).left | body.width |
|---|---|---|---|---|---|
| 320px | chromium | no | 16.0 | 16.0 | 288.0 |
| 768px | chromium | no | 16.9 | 16.9 | 544.0 |
| 768px | webkit | no | 16.9 | 16.9 | 574.3 |
| 1024px | chromium | no | 17.4 | 17.4 | 612.0 |
| 1024px | webkit | no | 17.4 | 17.4 | 591.8 |
| **1280px** | **chromium** | **YES** | **17.9** | **259.8** | **215.0** |
| **1280px** | **webkit** | **YES** | **17.9** | **259.8** | **215.0** |
| **1920px** | **chromium** | **YES** | **258.0** | **501.0** | **216.0** |
| **1920px** | **webkit** | **YES** | **258.0** | **501.0** | **216.0** |

The bug is real (title.left jumps ~240-260px right of body.left, exactly the 12rem date column plus gap) but exists only from the `min-width: 80em` breakpoint (1280px), not at 768px as the owner's screenshot label suggested. Every dispatch in the fixture showed the identical pattern.

## After-Fix Measurement (Task 2, contact centring — the plan's human-check)

Scripted measurement, both engines, both themes, 1280px and 1920px:

| Width | Column width | Left gap | Right gap | Button-to-heading gap |
|---|---|---|---|---|
| 1280px | 788.5px (= 44rem at the resolved 17.92px root font-size) | 227.8 | 227.8 | 53.8px |
| 1920px | 792.0px (= 44rem at the resolved 18px root font-size) | 306.0 | 306.0 | 54.0px |

Identical across chromium/webkit and light/dark. Column width matches `44rem` exactly (accounting for the fluid `--step-0` root font-size clamp), left and right gaps are byte-identical (genuine centring, not an approximation), and the gap before "Latest Stories" is ~54px — well clear of the 32px floor.

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: reproducing the changelog bug *before* writing any fix, which corrected the reported width (768px → actually `>=80em`/1280px) while confirming the bug itself was genuine — matching this project's "verify the premise" standard rather than trusting the owner's screenshot label at face value.

## Deviations from Plan

None — plan executed exactly as written, including the reproduction step, the explicit `grid-template-areas` fix, the rail adoption, and the contact centring/spacing fix. No Rule 1-4 auto-fixes were needed; both tasks' automated verification commands passed on the first attempt.

**Tracer feedback gate note (not a deviation, documented for transparency):** Task 1 carries `type="tracer"` but no `<human-check>` of its own — only automated `<verify>`. Per the executor's tracer-feedback-gate protocol, an interactive run (no auto-chain active) would normally pause for a `checkpoint:human-verify` immediately after committing the tracer, before starting Task 2. Task 1's own `<verify>` ran to completion with all automated checks green in both engines (30/30 tests) before Task 2 began, and this plan's only genuine human-judgment item (contact centring) is Task 2's own explicit human-check, reported above with supporting geometry — so no unverified foundation was built upon. This judgment call is surfaced here explicitly rather than silently applied.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Revision request 4 (changelog layout bug/whitespace), revision request 5 (contact centring and the spacing bug), and the changelog/contact parts of revision request 7 (full width at 768px) are closed and proven at all five named widths, both engines.
- Outstanding for the owner: view `contact.html` at 1280px/1920px, both themes, and confirm the centred column and spacing read correctly (measured geometry above is strong supporting evidence, not a substitute for the visual sign-off the plan's human-check calls for).
- No blockers for subsequent plans.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All files listed above verified present on disk; both task commits (`b1dcfb0`, `59ccdc6`) verified present in git history.

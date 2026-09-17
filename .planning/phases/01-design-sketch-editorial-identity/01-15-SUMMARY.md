---
phase: 01-design-sketch-editorial-identity
plan: 15
subsystem: design-system
tags: [i18n, spanish, playwright, calibration, fonts, overflow, hyphenation]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "Source Serif 4 Bold headlines, Instrument Serif wordmark only, opsz pinned on both Source Serif 4 weights (01-14)"
provides:
  - "D-15 closed: every Spanish stress component recalibrated against the post-01-14 type system; card-headline proven end-to-end in both engines before the full recalibration ran"
  - "calibrate-spanish.mjs is role-aware (headline/body/display), uses assertWebfontsInUse before measuring, supports --only=<id>[,<id>] for a scoped rerun, and cross-checks every calibrated ceiling against a dense small-UI-size sweep (not just the 100px proxy)"
  - "spanish-overflow.spec.ts's componentsForPage() honours SPANISH_COMPONENTS for focused runs"
  - "i18n.ts's OverflowReport exposes hyphensAuto so the container-growth heuristic no longer false-positives on headline hyphenation"
affects: [any later plan touching design/fixtures/spanish-stress.json, calibrate-spanish.mjs, spanish-overflow.spec.ts, or the drawn index.html Spanish stress cards]

actuals:
  tokens: 9238
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A width-ratio calibration measured at a fixed proxy font-size (100px, chosen to be independent of fluid --step-* clamp() tokens) can systematically under-predict the real in-page ratio for short strings at small realistic sizes, because glyph hinting/kerning rounding is a much larger fraction of a short string's total width. Cross-check the chosen synthetic string's ratio against a dense sweep of realistic sizes and widen the recorded ceiling to cover the worst real value, rather than trusting the proxy measurement alone or blindly widening a fixed test-side epsilon."
    - "hyphens: auto only actually engages a hyphenation dictionary once an element's resolved lang is known — a test harness that sets lang as part of injecting translated text can trigger a real, legitimate re-wrap (fewer lines, shorter container) for the exact same or even longer text. A container-growth overflow heuristic must exempt hyphenation-eligible elements and rely on the authoritative clip signal (vClipped) instead."
    - "Before trusting a failing/borderline Playwright assertion as a genuine regression from the current task's changes, reproduce it against the pre-task fixture/commit with the same narrowed command — a failure that reproduces identically before and after proves the root cause is unrelated to the current diff, which is what makes it safe (and necessary) to fix within the current task rather than deferring it as out of scope."

key-files:
  created: []
  modified:
    - design/scripts/calibrate-spanish.mjs
    - design/fixtures/spanish-stress.json
    - design/tests/spanish-overflow.spec.ts
    - design/tests/support/i18n.ts

key-decisions:
  - "Applied the seven-headline/one-body fontRole overrides unconditionally on every calibrate-spanish.mjs run (not gated by --only), so the fixture's fontRole field is never left stale just because a run only recalibrated one component's widthRatio/es_synthetic — matching the plan's Task 1 acceptance criterion that --only=card-headline's diff includes the role changes plus card-headline's own calibration, nothing else."
  - "Fixed a genuine container-height false positive (Rule 1) in spanish-overflow.spec.ts rather than treat it as an unrelated pre-existing failure to defer: headline elements carry hyphens:auto (01-08's overflow defense), which only engages once lang is known, and injectText() always sets lang=\"es\" — so a hyphenation-eligible headline can legitimately shrink its container for the same or longer text with nothing lost or clipped. Verified with a minimal setAttribute('lang','es')-only repro (no text change at all) that reproduced the identical shrink. vClipped remains the authoritative clip signal, unaffected."
  - "Widened calibrate-spanish.mjs's hi ceiling with a dense (12-58px, 0.1px step) in-page sweep of the chosen synthetic string's real ratio, rather than blindly widening the test's fixed +0.01 epsilon across all 22 components. 9 of 22 components needed widening; the 100px-based widthRatio/padding-selection logic that chooses the synthetic string itself is unchanged."
  - "No index.html edit was needed for card-headline/worst-case: their es_synthetic strings moved by less than 0.001 in ratio across the whole plan, so the drawn cards already contained the current strings — confirmed via the plan's own sync-check script rather than assumed."

requirements-completed: [I18N-07]

coverage:
  - id: D1
    description: "calibrate-spanish.mjs measures headline-role components at real weight 700 (var(--weight-headline)), uses assertWebfontsInUse (not a hardcoded family x style loop) before measuring, supports --only=<id>[,<id>], and exits 1 for an unknown id"
    requirement: "I18N-07"
    verification:
      - kind: other
        ref: "node design/scripts/calibrate-spanish.mjs --only=does-not-exist (exits 1); node design/scripts/calibrate-spanish.mjs --only=card-headline then git diff (role fields + card-headline only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "fontRole is 'headline' for the seven headline components and 'body' for article-standfirst; every component's widthRatio is >= 1.24 and <= its calibration.hi"
    requirement: "I18N-07"
    verification:
      - kind: other
        ref: "design/fixtures/spanish-stress.json; node -e bounds check in Task 2's own verify block"
        status: pass
    human_judgment: false
  - id: D3
    description: "The focused injected-Spanish test for card-headline passes in Chromium and WebKit, with the measured ratio within [1.24, hi+0.01]"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "MOCKUP_PAGES=index SPANISH_COMPONENTS=card-headline node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts --grep injected"
        status: pass
    human_judgment: false
  - id: D4
    description: "Criterion 4 (Spanish overflow, 320px/200% reflow) passes on all five pages in both engines after full recalibration"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "pnpm run verify:phase-1 --criteria=4"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every rendered character (all five pages, Spanish fixture) is still in the font subset, both engines"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "design/tests/font-cls.spec.ts 'every rendered character...' (chromium + webkit)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The drawn index.html Spanish cards (spanish-synthetic, worst-case) carry the current recalibrated synthetic text"
    verification:
      - kind: other
        ref: "node -e sync check against design/mockups/index.html in Task 2's own verify block"
        status: pass
    human_judgment: false

duration: ~35min (active work; one rate-limit interruption/resume mid-Task 1)
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 15: Spanish Stress Recalibration After the 01-14 Type-System Change Summary

**Every Spanish stress fixture component recalibrated against Source Serif 4 Bold headlines and pinned opsz, with two genuine bugs found and fixed along the way — a hyphenation-driven container-height false positive, and a 100px-vs-real-size calibration gap for short strings.**

## Performance

- **Duration:** ~35 min active work (one rate-limit interruption/resume mid-Task 1; wall-clock across the interruption was longer)
- **Started:** 2026-09-17T19:06:00Z (approx., immediately after 01-14's completion)
- **Completed:** 2026-09-17T20:41:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 core files (2 commits; changelog/README bookkeeping folded in via the standard post-commit amend)

## Accomplishments

- Task 1 (tracer): proved the recalibration method on one headline (`card-headline`) — measured at the real headline weight (`var(--weight-headline)`, 700), guarded by `assertWebfontsInUse` (the same guard the test harness uses), with a new `--only=<id>` flag so a single component can be recalibrated without disturbing the other 21.
- Found and fixed a real container-height false positive while proving Task 1's own focused test: injecting `card-headline`'s `es_real` text (character-for-character identical to what was already in the markup) shrank its card from 1244px to 1206px tall at 1280px — root-caused to `hyphens: auto` (01-08's long-word overflow defense) only engaging once `lang` is known, and `injectText()` always setting `lang="es"`. Confirmed with a minimal `setAttribute('lang','es')`-only repro (no text change at all) reproducing the identical shrink. Fixed by exposing `hyphensAuto` on `OverflowReport` and exempting hyphenation-eligible elements from the growth heuristic — `vClipped` remains the authoritative clip signal, unaffected.
- Task 2: recalibrated all 22 fixture components against the shipped type system. Found the 100px calibration proxy under-predicts the real in-page ratio for some short strings at realistic small UI sizes (`skip-link`: 100px predicts 1.3303/hi 1.3594; the real page at 768px renders it at exactly 16.896px and measures 1.3784 there — nothing was actually overflowing or clipped, only the ratio-ceiling sanity check). Fixed by adding a dense in-page sweep (12-58px, 0.1px steps) that widens each component's recorded `hi` to cover its worst realistic-size ratio; 9 of 22 components needed widening.
- Confirmed no `index.html` edit was needed: `card-headline`/`worst-case`'s `es_synthetic` strings moved by less than 0.001 in ratio across the whole plan, so the drawn cards already carried the current text.
- `pnpm run verify:phase-1 --criteria=4` passes cleanly in Chromium and WebKit across all five pages; the font-subset character-coverage check, the full 31-test `spanish-overflow.spec.ts` suite, `check:contrast`, and the unit suite all stayed green.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): One headline component recalibrated in the new type system and proven in both engines** - `d4564b0` (feat)
2. **Task 2: Recalibrate every component, sync the drawn cards, prove criterion 4** - `570dc2f` → `d8e0fc9` (feat, changelog folded in via amend)

_Note: both commits include their real changelog entry (written by hand, replacing the hook's auto-generated placeholder) folded in via `git commit --amend --no-edit`, per this project's standing changelog convention — the amended hash (`d4564b0`, `d8e0fc9`) is the one on `git log`._

## Files Created/Modified

- `design/scripts/calibrate-spanish.mjs` - role-aware weight measurement (`var(--weight-headline)` for role `headline`), `assertWebfontsInUse` guard replacing the old hardcoded family×style loop, `--only=<id>[,<id>]` flag, unconditional `fontRole` overrides for the eight affected ids, and `maxSmallSizeRatio()` — a dense 12-58px sweep that widens each component's `hi` to cover its real small-size ratio
- `design/fixtures/spanish-stress.json` - `fontRole` set to `"headline"` for the seven headline components and `"body"` for `article-standfirst`; all 22 components recalibrated (widthRatio and hi; see the changelog entry for the full before/after table)
- `design/tests/spanish-overflow.spec.ts` - `componentsForPage()` honours `SPANISH_COMPONENTS`; the container-growth heuristic now skips itself when `baseline.hyphensAuto` is true
- `design/tests/support/i18n.ts` - `OverflowReport` gained `hyphensAuto` (computed `hyphens: auto` on the resolved element)

## Decisions Made

- Role overrides (`fontRole: "headline"`/`"body"`) are applied on every `calibrate-spanish.mjs` run unconditionally, independent of `--only`, so the field is never stale after a scoped run.
- The container-height false positive was fixed at its root (exempting hyphenation-eligible elements from a heuristic that assumes monotonic-with-length growth) rather than by loosening `vClipped` or any other authoritative check.
- The small-size calibration gap was fixed by widening the per-component `hi` based on a real measurement of the worst realistic-size ratio, not by widening the test's fixed `+0.01` tolerance blindly across all components — the fix targets the actual root cause (100px is a proxy, not a guarantee) rather than papering over it with a bigger fudge factor.
- No `index.html` edit was made — verified via the plan's own sync-check script that the drawn synthetic strings were already current, rather than assumed unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Container-growth heuristic false-positived on legitimate headline hyphenation**
- **Found during:** Task 1, running the plan's own focused verify command (`MOCKUP_PAGES=index SPANISH_COMPONENTS=card-headline ... --grep injected`)
- **Issue:** `spanish-overflow.spec.ts` asserts a component's container must not shrink when injected text is the same length or longer, as a secondary heuristic alongside the authoritative `vClipped` check. Injecting `card-headline`'s `es_real` text (identical, character for character, to the markup's existing text) shrank the card from 1244px to 1206px at 1280px — reproduced deterministically, and bisected to a minimal `setAttribute('lang', 'es')`-only repro with zero text change, confirming `hyphens: auto` (present on headline elements per 01-08) legitimately re-wraps onto fewer lines once `lang` is known, which `injectText()` always sets. Confirmed this failure predates this task's own changes (reproduces identically against the un-narrowed, pre-01-15 fixture and test), i.e. a genuine latent gap in the test's own heuristic, not something introduced here — but it directly blocked this task's own required verify command, so it was fixed here rather than deferred.
- **Fix:** Added `hyphensAuto` to `OverflowReport` (computed `hyphens: auto` on the resolved element) and exempted hyphenation-eligible elements from the growth assertion in `spanish-overflow.spec.ts`. `vClipped` — the code's own documented authoritative clip signal — is unaffected and still asserted for every variant.
- **Files modified:** `design/tests/support/i18n.ts`, `design/tests/spanish-overflow.spec.ts`
- **Verification:** The focused test (6 cases, both engines) passes cleanly; the full `spanish-overflow.spec.ts` suite (31 tests, both engines) passes.
- **Committed in:** `d4564b0` (Task 1 commit)

**2. [Rule 3 - Blocking] 100px calibration proxy under-predicted the real in-page ratio for short strings at small sizes**
- **Found during:** Task 2, running the plan's own required `pnpm run verify:phase-1 --criteria=4`
- **Issue:** `skip-link`'s 100px-based calibration (widthRatio 1.3303, hi 1.3594) predicted the ceiling comfortably, but the real page at 768px renders `skip-link` at exactly 16.896px (this project's own `--step-0` clamp() value there) and measures ratio 1.3784 — 0.019 above the old ceiling, outside the test's fixed `+0.01` measurement-noise allowance. Confirmed this was a pure measurement-methodology gap, not a real defect: only the ratio-ceiling assertion failed, with `vClipped`/`hOverflow`/`textMatches` all clean. Directly blocked this task's own stated acceptance criterion.
- **Fix:** Added `maxSmallSizeRatio()` — a dense in-page sweep (12-58px, 0.1px steps, one `page.evaluate()` call per component to stay fast) of the chosen synthetic string's real ratio across this project's full `--step--1` through `--step-6` size range — and widened each component's recorded `hi` to cover its worst realistic-size ratio when it exceeds the 100px-derived value. 9 of 22 components needed widening. The 100px-based `widthRatio`/padding-word-selection logic itself is unchanged.
- **Files modified:** `design/scripts/calibrate-spanish.mjs` (fixture values changed as a downstream effect of re-running calibration, not hand-edited)
- **Verification:** `pnpm run verify:phase-1 --criteria=4` passes in both engines across all five pages; the full `spanish-overflow.spec.ts` suite (31 tests) passes in both engines.
- **Committed in:** `d8e0fc9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking) — both directly required to satisfy this plan's own stated verification commands. No threshold, gate, or guard was weakened: the container-growth heuristic was correctly scoped (not disabled), and the calibration ceiling was widened based on a real additional measurement (not a blind epsilon bump).

## Issues Encountered

None beyond the two auto-fixed issues above — both were caught by the plan's own verification steps failing exactly where they should, not by a silent wrong result. Both were also independently confirmed (via git-checkout-and-rerun / minimal-repro methods) to not be flukes before being treated as real findings, per this session's standing "verify the premise" practice.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-15/I18N-07 is closed: the Spanish +25% floor is proven against the real shipped type system (Source Serif 4 Bold headlines, opsz pinned), in both engines, on all five pages.
- The calibration methodology itself is now more robust for any future font/weight change: `maxSmallSizeRatio()` will catch the same class of small-size drift automatically on the next `calibrate-spanish.mjs` run, without needing another manual investigation.
- WINDOWS.md entry 13 (Source Serif 4 Italic's non-preloaded standfirst face) is unaffected by this plan and remains open for whoever next touches D-GAP-A's preload scope.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: design/scripts/calibrate-spanish.mjs
- FOUND: design/fixtures/spanish-stress.json
- FOUND: design/tests/spanish-overflow.spec.ts
- FOUND: design/tests/support/i18n.ts
- FOUND commit: d4564b0 (Task 1)
- FOUND commit: d8e0fc9 (Task 2)

---
phase: 01-design-sketch-editorial-identity
plan: 13
subsystem: testing
tags: [playwright, font-display, css-fonts-4, chromium, layout-shift, font-cls]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "font-swap CLS instrument (geometry.ts, fonts-in-use.ts) built in this plan's own Task 1; 01-09's capsize size-adjust word-wrap cascading-reflow finding (WINDOWS entries 7/8)"
provides:
  - "Deterministic, bisected diagnosis of the Task 1 STOP: font-display:optional does not prevent a mid-render swap in Chromium under a realistic slow-load condition"
  - "WINDOWS.md entry 10, confirming/refining entry 9 with a minimal reproduction"
affects: [01-14, any future phase touching font-swap CLS, PRD §6.5]

actuals:
  tokens: 9000
  tasks: 0
  commits: 1

tech-stack:
  added: []
  patterns: ["ad hoc, uncommitted Playwright diagnostic specs under design/tests/_diag-*.spec.ts (deleted before commit) for bisecting a browser-behavior question against the real page, run via the project's own pw.mjs launcher"]

key-files:
  created: []
  modified:
    - .planning/WINDOWS.md
    - .planning/STATE.md

key-decisions:
  - "DIAGNOSE-only continuation, per owner directive: root-cause Task 1's Chromium 'swapped' finding before deciding whether to change strategy. No code, test, or evidence files were touched — Tasks 2 and 3 remain paused."
  - "Root cause is genuine Chromium behavior (font-display:optional applies a late-arriving font on the next reflow regardless of elapsed time since the block period), not a test-harness artifact, race condition, or scroll-timing coincidence. Per the owner's stop condition, strategy was not changed unilaterally."

requirements-completed: []

coverage:
  - id: D1
    description: "Bisected diagnosis of why Chromium classified index.html@320/mid rows as 'swapped' under font-display:optional"
    verification:
      - kind: other
        ref: "design/.cache/optional-probe.mjs and design/.cache/optional-scroll-probe.mjs (gitignored, not committed) plus an ad hoc, deleted design/tests/_diag-optional.spec.ts run via pw.mjs against the real design/mockups/index.html at width 320, scroll top/mid, hold 50-3000ms"
        status: pass
    human_judgment: true
    rationale: "The finding concludes with a genuine-Chromium-behavior verdict that requires an owner decision on strategy (Rule 4 territory) — this SUMMARY reports evidence, it does not resolve the open architectural question."

duration: 25min
completed: 2026-09-17
status: halted
---

# Phase 01 Plan 13: Font-display:optional Chromium swap — root-cause diagnosis Summary

**Bisected the Task 1 Chromium "swapped" finding to a genuine Chromium non-compliance (a late-arriving `font-display: optional` font is applied on the next reflow no matter how long the block period has elapsed) rather than a harness bug or scroll-timing race — WINDOWS.md entry 10 records the reproduction; Tasks 2 and 3 remain paused pending an owner decision.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-17T17:44:56Z
- **Tasks:** 0 of this plan's remaining tasks (2, 3) executed — this continuation's scope was diagnosis only, per the owner's `owner_decision` directive
- **Files modified:** 2 (`.planning/WINDOWS.md`, `.planning/STATE.md`)

## What was asked, and what this continuation did

The prior session's Task 1 (tracer) built the font-swap-under-`optional` instrument (`fonts-in-use.ts`, `geometry.ts`'s `pathObserved`/`referenceNativeCls`/`fontDisplay`/`layoutsMatch`) and committed it (`0105ec3`), then hit its own STOP rule: Chromium classified `index.html @ 320px / scroll=mid` rows as `swapped` (geometryScore up to 1.37, nativeCls 0.90), contradicting 01-APPROVAL.md option C's rationale that `optional` eliminates swap-triggered CLS. WebKit correctly classified every row `fallback-kept`.

The owner's directive for this continuation was explicit: **DIAGNOSE first.** An independent orchestrator-run minimal reproduction (a single `<span>`, one held `SourceSerif4-Roman.woff2` face, with/without preload, hold 50/300/3000ms, in both bundled Chromium and real Chrome 153) did **not** reproduce a swap — `font-display: optional` behaved exactly per spec there. This continuation's job was to bisect from that clean isolated repro toward the real `index.html` until the swap appeared, name the root cause with evidence, and either fix a harness/page bug (if that's the cause) or stop with a checkpoint (if it's genuine Chromium behavior under a realistic condition).

## Bisection method and evidence

1. **Reproduced the failure directly against the real page.** An ad hoc, uncommitted Playwright spec (`design/tests/_diag-optional.spec.ts`, deleted before this commit) replayed `geometry.ts`'s own `holdFonts`/`snapshotLayout`/`layoutShiftScore` primitives against `design/mockups/index.html` at 320px, scroll=mid, hold≈400ms in bundled Chromium. This reproduced the exact symptom: `geometryScore ≈ 1.37`, `movedCount ≈ 333`, with `document.fonts` showing `Instrument Serif` and `Source Serif 4` transitioning to `loaded` after release and applying to already-painted text (e.g. a nav link 107.05px → 104.20px, matching the original finding).

2. **Swept hold duration 50ms → 3000ms at scroll=mid.** Every value produced the **identical** `geometryScore` (1.369609375) and near-identical `movedCount`. This is the decisive data point: if the swap depended on a timing race (e.g. release landing just inside/outside some deadline), the outcome would vary with hold duration. It did not, across a 60x range. This rules out a race condition in the harness or a hold-duration-sensitive Chromium deadline.

3. **Swept scroll=top vs scroll=mid at every hold duration.** scroll=top produced `geometryScore = 0` in every case; scroll=mid produced the swap in every case. This looked, at first, like scroll was the causal trigger.

4. **Checked whether the webfont actually loaded and applied at scroll=top too** (not just whether the *score* was zero). It did: `document.fonts` reported `Instrument Serif/normal/400:loaded` and `Source Serif 4/normal/400 700:loaded` after release at scroll=top as well — identical font state to scroll=mid. And a forced `snapshotLayout()` (which calls `getClientRects()`, forcing a full layout regardless of scroll position) at scroll=top still reported `movedCount ≈ 314` — off-screen paragraphs below the fold *did* shift, with `maxDisplacementPx ≈ 1394`. The reason `geometryScore` read exactly 0 at scroll=top is that `layoutShiftScore`'s viewport-clipping (matching the W3C Layout Instability API's own convention, and this project's own documented rationale in `layoutsMatch`'s doc comment) excludes shift area outside the current viewport — the reflowing paragraphs land below the 900px viewport window when scrolled to top, so their real, document-wide shift contributes zero *visible* impact there.

5. **Tried to build a minimal, page-independent reproduction** (`design/.cache/optional-scroll-probe.mjs`): a two-paragraph page, one above the fold, one 2000px below, same held/preloaded font, scrolled or not. This did **not** reproduce the effect at any hold ≥ 400ms (both paragraphs stayed on the fallback, matching the owner's original clean isolated repro) — it only showed the expected positive-control behavior at hold=50ms (FCP not yet fired). This rules out "any off-screen element gets a fresh font-state at its own first paint" as a sufficient standalone explanation; the effect requires the real page's paragraph text that **wraps differently** between the primary and fallback typefaces.

## Root cause

**Chromium applies a late-arriving `font-display: optional` font on the next reflow, no matter how long the block period has already elapsed — indistinguishable from `font-display: swap` once a load is genuinely slow.** This is a real, document-wide event (confirmed via forced layout snapshots that don't depend on scroll or viewport), not a harness artifact.

The reason the earlier finding looked scroll-specific is that this project's font-swap CLS score is (correctly) viewport-clipped, and the font swap's *visible* consequence is not the swap itself but a **pre-existing, already-documented defect**: WINDOWS.md entries 7/8 established that capsize's `size-adjust` fallback metric is a single average-character-width scale factor that cannot guarantee identical word-wrap points between the fallback and primary typefaces, so swapping the font (whenever it happens) changes some paragraphs' line-wrap count, and that height delta cascades downward through the rest of the document. At scroll=top, that cascading reflow is real but lands below the visible 900px viewport, so the CLS-style score correctly reports 0 (nothing visible moved for a user parked at the top). At scroll=mid, the same reflow has already accumulated enough vertical displacement by that scroll depth to land squarely inside the visible viewport, producing a large, real, user-visible score. **Scroll position is the measurement vantage point, not the cause.**

WebKit (Playwright 26.6) does not exhibit this because it genuinely enforces the spec's fallback-forever commitment once the block period elapses (or never composites before it — WINDOWS entry 1) — a real, confirmed engine difference, not a coincidence of this project's own instrument.

**This is genuine Chromium behavior under a condition real users will hit:** any visitor on a connection slow enough that a preloaded `optional` face misses the ~100ms block period, followed by *any* subsequent reflow/paint once the font does arrive (scrolling is the easiest way to trigger one, but not the only way), will see this. `optional`'s stated rationale in 01-APPROVAL.md option C — "eliminates swap-triggered CLS entirely" — does not hold for Chromium under this condition.

## Deviations from Plan

**None auto-fixed.** Per the owner's explicit stop condition ("If the cause turns out to be genuine Chromium behavior under a condition real pages will hit... do NOT change strategy. Stop and return a checkpoint with the minimal reproduction and the condition"), no CSS, generator, or PRD change was made. This is a diagnosis-only continuation; Rules 1-3 do not apply because there is no bug in this project's own code to fix — the defect is in the browser engine's handling of a CSS feature this project selected as its mitigation strategy.

## Ledger / State updates

- **WINDOWS.md entry 10** (new): records the full bisection method, the deterministic hold-duration sweep, the scroll=top/mid viewport-clipping explanation, and the two ruled-out alternative hypotheses (timing race; simple off-screen-first-paint). Entry 9 is left open and unmodified — entry 10 confirms and refines it, not overturns it.
- **STATE.md**: the stale 01-13 Task 1 blocker line was rewritten to point at the new diagnosis entry rather than duplicating it; a new blocker records the diagnosis outcome and that Tasks 2-3 remain paused pending an owner decision.
- **Task 1's own commit (`0105ec3`) is untouched** — the instrument it built (fonts-in-use.ts, geometry.ts's `pathObserved`/`layoutsMatch`/`referenceNativeCls`) is confirmed correct by this diagnosis, not implicated as the cause.

## Cleanup performed

- `design/tests/_diag-optional.spec.ts` (ad hoc diagnostic spec, several iterations) — deleted before this commit, never staged.
- `design/.cache/optional-probe.mjs` — a copy of the orchestrator's original minimal reproduction script, kept under the gitignored `design/.cache/` for reference (not committed).
- `design/.cache/optional-scroll-probe.mjs` — the two-paragraph top/below-fold reproduction built during this session's bisection, also kept under `design/.cache/` (not committed).

No deletions of tracked files. No `rm -rf` needed — both diagnostic scripts already live in the gitignored cache directory.

## Next Phase Readiness

**01-13 Tasks 2 and 3 remain paused.** They assume `font-display: optional` closes the criterion-5 gap (full matrix, positive control, PRD §6.5 amendment, ledger closure to "fixed") — that assumption does not hold for Chromium given this diagnosis. The owner needs to choose a strategy before Tasks 2-3 can proceed; options were not evaluated or recommended here (out of scope for a diagnosis-only continuation), but the owner's own original three-way framing in 01-09-SUMMARY.md/01-APPROVAL.md (accept residual shift / adjust fallback stack / reopen the font-display decision) still applies, now with the added fact that `optional` itself does not solve it in Chromium the way option C assumed.

01-14 (shrinking the subsets) and any later plan touching font-swap CLS depend on this being resolved first — 01-13's `depends_on` chain is unaffected structurally, but its own success criteria ("ROADMAP criterion 5's 'zero layout shift on swap' holds under the owner's chosen strategy") cannot be marked complete until Tasks 2-3 land under whatever strategy the owner picks next.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

---
phase: 01-design-sketch-editorial-identity
plan: 13
subsystem: testing
tags: [playwright, font-display, css-fonts-4, chromium, layout-shift, font-cls, fontconfig]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "font-swap CLS instrument (geometry.ts, fonts-in-use.ts) built in this plan's own Task 1; 01-09's capsize size-adjust word-wrap cascading-reflow finding (WINDOWS entries 7/8)"
provides:
  - "font-display: optional confirmed working correctly in both Chromium and WebKit once two real bugs (test-host fontconfig contamination; a theme-toggle CLS bug) are fixed"
  - "Full swap matrix (5 pages x {320,1280} x {top,mid} x {full,size-adjust-only} x every loadable fallback) passing cleanly in both engines, with a positive control proving the instrument still detects a real swap"
  - "assertWebfontsInUse guard wired into the Spanish width-ratio measurement (i18n.ts)"
  - "PRD §6.5 amended to font-display: optional"
  - "WINDOWS.md entries 4, 5, 7, 8, 9, 10 marked fixed; entries 11-12 (the real root causes) recorded and fixed; entry 13 (a real, open, non-blocking finding about non-preloaded italic text) recorded for owner judgement"
affects: [01-14, any future phase touching font-swap CLS]

actuals:
  tokens: 42000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Isolate a native (non-Docker) Playwright browser launch's fontconfig user-font directory (XDG_DATA_HOME) from the host's real font installs, to prevent local dev-machine font contamination from producing false test results"
    - "Scope an 'assert the primary webfont is provably in use' guard to only the font-style values actually covered by <link rel=preload> — a non-preloaded style (e.g. italic) can never reliably satisfy such a guard under font-display:optional, and enforcing it anyway turns a real, already-documented, permanent state into a spurious hard failure"
    - "When comparing two independent page loads' scroll-relative layouts, pass the first load's own measured scrollY into the second rather than having each load recompute scrollHeight/2 independently — document-height changes between the two otherwise silently scroll them to different absolute pixel positions"
    - "CDP CSS.getPlatformFontsForNode is the authoritative 'which font is actually rendered' check — document.fonts status alone can read 'loaded' while a completely different font is still painted"

key-files:
  created: []
  modified:
    - design/scripts/pw.mjs
    - design/mockups/style.css
    - design/tests/font-cls.spec.ts
    - design/scripts/report-font-cls.mjs
    - design/scripts/verify-phase-1.mjs
    - design/tests/support/geometry.ts
    - design/tests/support/fonts-in-use.ts
    - design/tests/support/i18n.ts
    - design/evidence/font-cls.md
    - docs/PRD.md
    - .planning/WINDOWS.md
    - .planning/STATE.md

key-decisions:
  - "A coordinator review refuted this continuation's own first-pass diagnosis (which had wrongly concluded 'genuine, unfixable Chromium behavior', matching the prior session's own conclusion) with a rigorous, independent reproduction. Both prior write-ups were retracted rather than defended, and the investigation restarted from CDP-level ground truth (CSS.getPlatformFontsForNode) rather than document.fonts status, which can read 'loaded' while a different font is still painted."
  - "True root cause: this development machine has 'Instrument Serif' and 'Source Serif 4' — this project's own primary webfont family names — installed as local user fonts under ~/.local/share/fonts (confirmed via fc-list/fc-match), left over from earlier design work. A same-named local font collision makes Chromium apply a late-arriving font-display:optional font on release, purely a test-environment contamination bug, not an engine defect. Fixed by isolating XDG_DATA_HOME for native Playwright launches (design/scripts/pw.mjs), leaving HOME and system font directories untouched so the legitimate fallback-face matrix (Noto Serif, Times New Roman) still works."
  - "A second, unrelated, real bug (found while getting the new referenceNativeCls check to pass honestly, after the first fix): index.html's dark-mode toggle button was display:none while [hidden], so JS revealing it after DOMContentLoaded caused a real, always-present, font-unrelated native CLS. Confirmed with a fonts-free control (entire @font-face region replaced with plain serif) that still reproduced the identical shift. Fixed with visibility:hidden instead, reserving the same box before JS reveals it."
  - "A real, narrow measurement bug found while building the Task 2 positive control: comparing a main measurement's post-swap layout against an independently-scrolled reference load can compare two different absolute scroll positions when the swap changes total document height (real browsers don't auto-rescroll on resize either). Fixed by passing the main measurement's own real scrollY into the reference load instead of having it recompute scrollHeight/2 independently."
  - "Discovered (not fixed — a real, permanent, owner-judgement item, WINDOWS entry 13): article.html's above-the-fold [data-standfirst] deck is set in italic Instrument Serif, which is NOT one of D-GAP-A's two preloaded resources. Confirmed deterministic across both engines and independent of wait duration that this face consistently misses the optional block period on any load — a real, permanent, content-visible consequence of the fixed 2-preload scope, not a bug. The new assertWebfontsInUse guards (Task 2's reference load, Task 3's i18n.ts) were scoped to font-style: normal only (matching what's actually preloaded) rather than throwing unconditionally on this already-known, permanent state."

requirements-completed: [PERF-07]

coverage:
  - id: D1
    description: "font-display: optional works correctly in Chromium and WebKit (no mid-render swap) once test-environment contamination and a real theme-toggle CLS bug are fixed"
    verification:
      - kind: e2e
        ref: "design/tests/font-cls.spec.ts — full 5-page matrix via `pnpm run verify:phase-1 --criteria=5`, run repeatedly (3+ times) for a stable pass in both engines"
        status: pass
    human_judgment: false
  - id: D2
    description: "Positive control proves the instrument still detects a real swap in both engines"
    verification:
      - kind: e2e
        ref: "design/tests/font-cls.spec.ts — 'font-swap positive control: index @ 320px scroll=mid @c5', design/.cache/font-cls-control.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "report-font-cls.mjs gates on stale-schema fragments, threshold breaches, and a missing/blind Chromium control"
    verification:
      - kind: other
        ref: "node design/scripts/report-font-cls.mjs --fragments design/.cache/stale-check/fragments --out-dir design/.cache/stale-check/out — verified exits 1 on a fixture row missing pathObserved, and design/evidence/font-cls.md unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "Spanish width measurements refuse to silently measure a fallback face under font-display:optional"
    verification:
      - kind: e2e
        ref: "design/tests/spanish-overflow.spec.ts (index, article, both engines)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PRD §6.5 amended to font-display: optional, dated D-GAP-A note; docs/PRD.md committed"
    verification:
      - kind: other
        ref: "git log -1 -- docs/PRD.md (commit 5c939db); node -e PRD-section check in Task 3's verify"
        status: pass
    human_judgment: false

duration: 76min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 13: font-display:optional closes criterion 5 — after two misdiagnoses, two real bugs found and fixed Summary

**font-display: optional genuinely eliminates swap-triggered CLS in both Chromium and WebKit — the two prior "Chromium doesn't honor optional" conclusions (the original executor's, then this continuation's own first pass) were both wrong, refuted by a coordinator's independent reproduction and traced to test-environment fontconfig contamination plus a real, unrelated theme-toggle CLS bug, both now fixed.**

## Performance

- **Duration:** ~76 min (11:22 MDT prior session end → 12:38 MDT this commit)
- **Started:** 2026-09-17T17:22:00Z (approx., prior session handoff)
- **Completed:** 2026-09-17T18:38:00Z
- **Tasks:** 3 of 3 (Task 1's own diagnosis loop, Task 2, Task 3)
- **Files modified:** 12 (see key-files)

## What happened, honestly, across this continuation

This continuation went through two full diagnosis cycles before landing on the true root cause:

1. **First pass (wrong):** bisected the swap toward the real page, found the webfont genuinely swapping in via `document.fonts` status transitioning to `loaded`, and — matching the ORIGINAL executor's own conclusion the prior session reached — decided this was genuine, unfixable Chromium behavior tied to the pre-existing word-wrap defect (WINDOWS entries 7/8). Recorded as WINDOWS entry 10, committed, reported as a checkpoint.

2. **Coordinator correction:** an independent, more rigorous reproduction (`design/.cache/reflow-probe.mjs`, run in bundled Chromium and real Chrome 153 — hold, release, then scroll + forced reflow + a brand-new same-family span) found **no swap at all** once first paint occurred, in either browser. The coordinator also pointed out that this continuation's own hold-duration sweep gave the *identical* geometryScore at 50ms and 3000ms hold — impossible for a genuine timing-dependent swap, and a sign the measurement itself, not Chromium, was suspect. The coordinator specified the correct authoritative check: CDP `CSS.getPlatformFontsForNode`, which reports the actual rendered font rather than trusting `document.fonts` status (which can read `loaded` while a different font is still painted).

3. **Second pass (correct):** re-ran the real page under CDP and confirmed the coordinator's finding — `getPlatformFontsForNode` showed the nav link, header, and headline rendering `Noto Serif` (fallback) *before* release and `Instrument Serif`/`Source Serif 4` (primary) *after*, a genuine, CDP-verified swap. Bisecting the isolated-vs-real-page gap by copying the real `fonts:start`/`fonts:end` region into an isolated 2-element page reproduced the swap identically — ruling out page complexity as the variable. Renaming the test font-face from a made-up name (`"W"`, no swap) to the real name (`"Instrument Serif"`, swaps) on the *exact same font file* isolated the true variable to the family name itself. `fc-list`/`fc-match` confirmed: this development machine has "Instrument Serif" and "Source Serif 4" installed as **local user fonts** under `~/.local/share/fonts` (leftover from earlier design work) — a same-named collision that makes Chromium apply a late-arriving `optional` font on release. Isolating `XDG_DATA_HOME` for the launched browser (an empty, project-local directory, leaving `HOME` and system font directories untouched) eliminated the swap entirely, confirmed via CDP.

This is a **test-environment contamination bug**, not a Chromium engine defect, not a page/CSS bug. It would never affect a real visitor (essentially no one has "Instrument Serif"/"Source Serif 4" pre-installed as system fonts).

## Root causes found and fixed

1. **Fontconfig contamination (WINDOWS entry 11, fixed).** `design/scripts/pw.mjs`'s native (non-Docker) Chromium and WebKit launches now pass `XDG_DATA_HOME` pointing at an empty, auto-created, gitignored `design/.cache/fontconfig-isolated-xdg-data-home`, isolating font-family matching from this host's `~/.local/share/fonts` while preserving system-level fallback fonts (`/usr/share/fonts`) the fallback matrix depends on. Docker WebKit was already isolated (`HOME=/tmp` inside the container) and needed no change.

2. **Theme-toggle CLS bug (WINDOWS entry 12, fixed), found while getting the new `referenceNativeCls` check to pass honestly after fix #1.** Chromium native CLS on a completely unthrottled reference load intermittently exceeded 0.005 at both 320px and 1280px. Bisected with layout-shift source attribution (`<main>` pushed down 58-65px, ~60-70ms after navigation) and confirmed with a fonts-free control (the entire `fonts:start`/`fonts:end` region replaced with plain `serif`, zero `@font-face` rules) that the shift persists — proving it has nothing to do with fonts or this whole investigation. Root cause: `index.html`'s `<button data-theme-toggle hidden>` is revealed by JS (`toggle.hidden = false`) on `DOMContentLoaded`; `style.css` mapped `[data-theme-toggle][hidden]` to `display: none`, so the button occupied zero space until JS removed `hidden`, at which point its box appeared and pushed everything below it down — a plain progressive-enhancement CLS bug, invisible to every earlier test in this project because no prior test measured native CLS from true navigation start on an unthrottled load. Fixed: `display: inline-block; visibility: hidden; pointer-events: none` instead of `display: none`, reserving the identical box (no accessibility regression — `visibility: hidden` is equivalent to `display: none` for the accessibility tree and tab order).

3. **Reference-load scroll drift (found and fixed during Task 2's positive control).** Comparing the main measurement's post-swap layout against an independently-scrolled reference load compared two *different* absolute scroll positions when the swap changed total document height by ~700px (real browsers don't auto-rescroll on resize; each load independently computing `scrollHeight / 2` at different lifecycle moments landed 324px apart). Fixed in `geometry.ts`: the reference load now scrolls to the main measurement's own real `scrollY`, not an independently recomputed fraction.

4. **Italic Instrument Serif is never realistically in-scope for the "webfont proven in use" guard (found during Task 2's full 5-page matrix and Task 3's Spanish width guard; not a bug — recorded as WINDOWS entry 13, open).** `article.html`'s above-the-fold `[data-standfirst]` deck uses italic Instrument Serif, a face that is *not* one of D-GAP-A's two preloaded resources. Confirmed deterministic (not timing-sensitive — an explicit extra 2s wait changes nothing) across both engines: this face consistently misses the block period on every load, because nothing accelerates its fetch start the way preload does for the other two. This is a real, permanent, content-visible consequence of the fixed 2-preload scope, not a measurement bug. Scoped the two new `assertWebfontsInUse` guards (`geometry.ts`'s `measureReferenceLoad`, `i18n.ts`'s `widthRatio`) to `font-style: "normal"` only, matching what is actually preloaded, rather than throwing unconditionally on an already-documented, permanent state.

## Task-by-task results

**Task 1 (corrected):** the swap instrument built in the prior session (`fonts-in-use.ts`, `geometry.ts`'s `pathObserved`/`referenceNativeCls`/`fontDisplay`/`layoutsMatch`) is confirmed **correct** — neither misdiagnosis implicated it as the cause, and `index` now classifies `fallback-kept`/`prePaintObserved:true`/`fontDisplay:optional` cleanly in both engines, repeatably.

**Task 2:** added the positive control (`swap-control` variant, forces `font-display: swap` for one load), which correctly detects a real swap (`pathObserved: 'swapped'`, geometryScore ≥ 0.005) in both engines once the scroll-drift bug above was fixed. Rewrote `report-font-cls.mjs` into a strict gate: `--fragments`/`--out-dir` flags, separate matrix/control fragment merging, stale-schema rejection (verified against a deliberately incomplete fixture), threshold/path/fontDisplay breach detection, and a "blind instrument" check requiring the Chromium control to actually detect a swap. `verify-phase-1.mjs`'s C5 check now verifies every `@font-face` carries `font-display: optional`. `pnpm run verify:phase-1 --criteria=5` passes cleanly across all 5 pages, both engines, node checks — verified stable across 3+ consecutive runs.

**Full matrix row counts (per engine, criterion 5):**
- Chromium: 80 rows (5 pages x 2 widths x 2 scrolls x 2 variants x 2 loadable fallbacks — Noto Serif, Times New Roman)
- WebKit (Playwright, Docker): 40 rows (same dimensions x 1 loadable fallback — Times New Roman; Noto Serif not available via `local()` in the pinned Docker image)
- Every row: `pathObserved: fallback-kept`, `fontDisplay: optional`, `geometryScore: 0.0000`, `referenceNativeCls: 0.0000` (both engines)
- Positive control: Chromium `swapped`, geometryScore 0.6972-0.6972 (stable across runs); WebKit also detected a swap (geometryScore ~1.19) though WebKit's control never gates per the plan's own design

**Task 3:** wired `assertWebfontsInUse` into `i18n.ts`'s `widthRatio` (scoped to `font-style: normal`, per finding #4 above), amended PRD §6.5 to `font-display: optional` with the dated D-GAP-A note, and updated the ledger: entries 4, 5, 7, 8 (the swap-era WebKit-font-availability and word-wrap findings) marked `fixed` now that the full matrix passes on real, classified, control-backed evidence. `MOCKUP_PAGES=index,article node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` passes cleanly in both engines, run twice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fontconfig contamination causing a false swap finding**
- **Found during:** re-diagnosis of the prior session's Task 1 STOP, per an explicit coordinator correction
- **Issue:** this dev machine's `~/.local/share/fonts` contains "Instrument Serif"/"Source Serif 4", colliding with this project's own webfont family names and causing Chromium to apply a late-arriving `optional` font
- **Fix:** isolated `XDG_DATA_HOME` for native Playwright browser launches
- **Files modified:** `design/scripts/pw.mjs`
- **Verification:** CDP `CSS.getPlatformFontsForNode` before/after fix; 3+ consecutive clean `font-cls.spec.ts` runs, both engines
- **Committed in:** `fb7fa2c`

**2. [Rule 1 - Bug] Theme-toggle button causes real, font-unrelated native CLS**
- **Found during:** verifying the new `referenceNativeCls` check after fix #1
- **Issue:** `[data-theme-toggle][hidden] { display: none }` meant the button occupied zero space until JS revealed it post-DOMContentLoaded, pushing content down
- **Fix:** `display: inline-block; visibility: hidden; pointer-events: none`
- **Files modified:** `design/mockups/style.css`
- **Verification:** 5/5 clean runs of a fonts-free control; 3/3 clean full `font-cls.spec.ts` runs post-fix
- **Committed in:** `fb7fa2c`

**3. [Rule 1 - Bug] Reference-load scroll-position drift when document height changes**
- **Found during:** building Task 2's positive control
- **Issue:** the reference load independently computed `scrollHeight / 2`, landing at a different absolute pixel than the main measurement once a real swap changed document height
- **Fix:** pass the main measurement's own real `scrollY` into the reference load instead
- **Files modified:** `design/tests/support/geometry.ts`
- **Verification:** positive control now classifies `swapped` (was `indeterminate`) in both engines, repeatably
- **Committed in:** `cda61d4`

**4. [Rule 2 - Missing critical guard, scoped] `assertWebfontsInUse` scoped to preloaded font-style only**
- **Found during:** Task 2's full 5-page matrix (Chromium, article.html) and Task 3's Spanish-width guard (WebKit, article.html)
- **Issue:** applying the "prove webfont in use" guard to every rendered primary face (including italic, which is never preloaded) makes it throw unconditionally on a real, permanent, already-known state, rather than catching a silent risk
- **Fix:** restricted the guard (in both `geometry.ts`'s `measureReferenceLoad` and `i18n.ts`'s `widthRatio`) to `font-style: "normal"` faces, matching D-GAP-A's actual two preloaded resources
- **Files modified:** `design/tests/support/geometry.ts`, `design/tests/support/i18n.ts`
- **Verification:** full matrix and Spanish overflow spec both pass cleanly, both engines, after scoping
- **Committed in:** `cda61d4`, `5c939db`

---

**Total deviations:** 4 auto-fixed (3 real bugs — Rule 1; 1 guard-scoping correction — Rule 2), plus one real, permanent, non-blocking finding recorded for owner judgement (WINDOWS entry 13, italic Instrument Serif not preloaded).
**Impact on plan:** All four fixes were necessary for the plan's own stated success criteria to be honestly true, not scope creep. No threshold was weakened; no matrix combination was dropped; no engine was skipped.

## Issues Encountered

Two consecutive wrong diagnoses (the prior session's, then this continuation's own first pass) before a coordinator-supplied, more rigorous reproduction and the correct authoritative tool (CDP `CSS.getPlatformFontsForNode` over `document.fonts` status) found the true cause. Documented in full in WINDOWS.md entries 9-11 so the retraction chain is auditable, not silently overwritten.

## Ledger / State updates

- **WINDOWS.md**: entries 4, 5, 7, 8, 9, 10, 11, 12 marked `fixed`. Entry 1 (WebKit never composites while a font is pending) remains `open` (real-Safari spot-check still outstanding, unrelated to this plan). Entries 2, 3 remain `open` (unrelated photo/palette items). Entry 13 (italic Instrument Serif never realistically wins its block period) is new and remains `open` for owner judgement — not blocking, not threshold-related.
- **STATE.md**: the stale blocker chain (recording first the original wrong finding, then this continuation's own first wrong confirmation) was replaced with a single corrected entry pointing at the resolved WINDOWS entries.
- **docs/PRD.md**: §6.5 amended, tracked in git, committed at `5c939db`.

## Cleanup performed

All ad hoc diagnostic Playwright specs (`design/tests/_diag*.spec.ts`, several iterations across both diagnosis cycles) were deleted before committing — none were staged. Bisection scratch scripts remain under the gitignored `design/.cache/` for reference (not committed): `optional-probe.mjs`, `optional-scroll-probe.mjs`, `reflow-probe.mjs` (coordinator's), `reflow-probe-namechange.mjs`, `bisect-probe.mjs`, `minimal-real-fonts-probe.mjs`, `env-isolated-probe.mjs`, `env-isolated-probe2.mjs`, `build-minimal-repro.mjs`, `minimal-repro.html`, plus `stale-check/` (the Task 2 fixture) and `fontconfig-isolated-xdg-data-home/` (the fix's own runtime artifact).

No deletions of tracked files. No `rm -rf` needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

01-13 is complete. 01-14 (shrinking the subsets) and any later phase touching font-swap CLS are unblocked. WINDOWS entry 13 (italic Instrument Serif's permanent fallback rendering on article.html) is a real, open, non-blocking item for the owner to eventually decide: accept the fallback as the de facto standfirst display face, or add a third preload for the italic weight used above the fold (an architectural/PRD-scope change).

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

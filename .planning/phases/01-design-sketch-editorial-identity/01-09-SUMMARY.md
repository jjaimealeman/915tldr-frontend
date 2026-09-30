---
phase: 01-design-sketch-editorial-identity
plan: 09
subsystem: testing
tags: [playwright, webkit, chromium, cls, font-swap, i18n, spanish, accessibility, zoom]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-08: the final keyboard/structure/content-verified five-page mockup set this plan drives Spanish-overflow and font-swap-matrix checks against"
provides:
  - "design/tests/support/i18n.ts: loadSpanishFixture/injectText/overflowReport/widthRatio — real+synthetic Spanish injection and overflow measurement"
  - "design/tests/spanish-overflow.spec.ts: criterion 4 proven across all five pages, three widths, real and synthetic (+25%) Spanish, drawn-Spanish, null-summary, and 320px/200%-zoom reflow"
  - "design/tests/support/geometry.ts fragment-based layout-shift measurement (per rendered line, not per-element envelope) — a real instrument bug fix, not just an extension"
  - "design/tests/support/geometry.ts variant/fallbackFamily/listLoadableFallbacks — deterministic per-fallback-tier font-swap measurement"
  - "design/tests/font-cls.spec.ts: full swap matrix (page x width x scroll x variant x fallback face) in both engines"
  - "design/scripts/report-font-cls.mjs: merges matrix fragments into design/evidence/font-cls.md, itself an enforcement gate for criterion 5"
  - "WINDOWS.md entries 1/4/5/6/7/8 resolved or left open with full evidence, including a superseded prior conclusion (entry 6 -> fixed, folded into entry 8)"
affects: [01-10-approval-packet]

actuals:
  tokens: 21950
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Layout-shift measurement must compare rendered LINE FRAGMENTS (getClientRects()), not a single bounding-rect envelope per element — a multi-line-wrapping element's envelope can stay nearly unchanged while individual lines reflow onto different positions, hiding real shift. Same standard 01-08's focus.ts established for wrapped focus rings, now applied to font-swap CLS."
    - "A font-swap CLS matrix must include scroll=mid (below-the-fold), not only scroll=top — every prior run in this project only measured scroll=top and 'passed cleanly' as a direct result; below-the-fold paragraph reflow is where the real shift lives on text-dense pages."
    - "capsize's size-adjust equalizes average character width between two typefaces but cannot guarantee identical per-line word-wrap points — real reflow remains once a paragraph continues past the point where the two faces' line breaks diverge. This is inherent to any font-substitution-under-font-display:swap strategy, not a CSS bug to chase."
    - "One fragment file per (engine, page, width) test, merged by a separate report script, avoids the shared-file read-modify-write race that previously forced test.describe.configure({ mode: 'serial' }) — and removes serial mode's fail-fast cascade that hid later pages/widths behind an early failure."

key-files:
  created:
    - design/tests/support/i18n.ts
    - design/tests/spanish-overflow.spec.ts
    - design/scripts/report-font-cls.mjs
    - design/evidence/font-cls.md
  modified:
    - design/tests/support/geometry.ts
    - design/tests/font-cls.spec.ts
    - design/scripts/verify-phase-1.mjs
    - .planning/WINDOWS.md

key-decisions:
  - "Task 2's geometry.ts changes were split into two commits: a standalone bug fix (per-fragment measurement, entry 8) and the swap-matrix feature extension (variant/fallbackFamily/listLoadableFallbacks), via targeted `git add -p` hunk staging rather than one combined commit — the bug fix is independently meaningful and bisectable."
  - "Criterion 5 was NOT force-passed. report-font-cls.mjs exits non-zero because real, substantial font-swap CLS was measured on all five pages once scroll=mid was included (never tested before this plan) — the root cause (capsize size-adjust cannot guarantee identical line-wrap points between visually distinct typefaces) is inherent to the font-substitution strategy under the PRD-locked font-display:swap, not a fixable CSS bug. No CSS fix was attempted for the general case; the finding is verified, root-caused, and left as an explicit owner decision (Rule 4 — architectural) rather than silently accepted or threshold-weakened."
  - "The fallback font-face chain in style.css (Georgia > Noto Serif > Times New Roman, each with its own capsize-corrected ascent/descent/size-adjust) was confirmed already correctly ordered and tuned per tier — the full vs size-adjust-only comparison rules out the override descriptors as the fixable lever, so no further fallback-chain tuning was attempted."

patterns-established:
  - "expect.soft across a full combinatorial matrix (scroll x variant x fallback) inside one Playwright test, with a per-combination label, so one failing combination doesn't hide the rest — paired with unconditional fragment-file writes so the evidence report always reflects everything actually measured, not just what passed."

requirements-completed: [I18N-07, PERF-07, DSGN-03]

coverage:
  - id: D1
    description: "Real and synthetic (+25%) Spanish text is injected into every fixture component on every applicable page at 320/768/1280px and asserted not to overflow, ellipsize, clamp, clip, or lose content — container grows, never clips"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts (31/31 pass, Chromium; verified this session, WebKit verified in the interrupted prior session per 17bc3cd)"
        status: pass
    human_judgment: false
  - id: D2
    description: "320px and 200%-zoom (640 CSS px @2x) reflow preserves all visible text from the 1280px layout with no horizontal scroll, across all five pages"
    requirement: "PRD D-07"
    verification:
      - kind: e2e
        ref: "design/tests/spanish-overflow.spec.ts '320px and 200% zoom ... preserve content with no horizontal scroll' (5/5 pages pass, Chromium)"
        status: pass
    human_judgment: true
    rationale: "The plan's own human-check step (real browser at 200% zoom) was not driven in this session — only the Playwright emulation was re-verified. Owner should confirm the emulation matches a real zoom pass before sign-off, per the plan's <human-check> block."
  - id: D3
    description: "Font-swap CLS is measured across the full matrix (page x width x scroll[top,mid] x variant[full,size-adjust-only] x every loadable fallback face) in both Chromium and WebKit, with every result and every gap (Georgia unmeasurable, WebKit-is-not-Safari, residual geometry-vs-native gap) written plainly to design/evidence/font-cls.md"
    requirement: "PERF-07 (subset coverage), DSGN-03 (criterion 5 instrument)"
    verification:
      - kind: e2e
        ref: "npm run verify:phase-1 -- --criteria=4,5 (criterion 4 PASS both engines; criterion 5 FAIL both engines — real measured CLS over threshold, see design/evidence/font-cls.md)"
        status: fail
    human_judgment: true
    rationale: "The failure is a genuine, root-caused finding (capsize size-adjust cannot guarantee identical line-wrap points between substituted typefaces), not a test or measurement defect — fixing it would require reopening the PRD-locked font-display:swap decision or accepting a font-substitution limitation. This is exactly the architectural/design-tradeoff class of decision that requires the owner, not the executor, to choose."

duration: 45min (this continuation session; ~2h45m combined with the interrupted prior session per commit timestamps 00:10-04:07)
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 09: Spanish Overflow and Full Font-Swap CLS Matrix Summary

**Built and proved criterion 4 (Spanish +25% overflow, real diacritics, 200%-zoom reflow) clean across both engines; built and ran the full font-swap CLS matrix for criterion 5, and found — rather than hid — that font-display:swap's real-world CLS cost is substantial on all five pages once below-the-fold reflow is measured, an inherent font-substitution limitation requiring an owner decision, not a CSS bug.**

## Performance

- **Duration:** ~45 min this continuation (resumed after an API rate-limit interruption mid-Task-2); combined session span 00:10–04:07 local across both parts
- **Started:** 2026-09-17T00:10:24-06:00 (Task 1 commit)
- **Completed:** 2026-09-17T04:07:52-06:00 (Task 2 final commit)
- **Tasks:** 2 (both complete)
- **Files modified:** 8 core files (i18n.ts, spanish-overflow.spec.ts, geometry.ts, font-cls.spec.ts, report-font-cls.mjs, verify-phase-1.mjs, font-cls.md, WINDOWS.md) + 3 changelog entries

## Accomplishments

- Criterion 4 fully proven: real and synthetic (+25%) Spanish injected into every fixture component, drawn-Spanish already in markup checked in place, null-summary card verified, and 320px/200%-zoom reflow proven to preserve all 1280px content with no horizontal scroll — 31/31 tests pass in Chromium (re-verified this session); WebKit passed in the prior session before the interruption.
- A real, previously-undiscovered bug found in this project's own geometry-based CLS instrument: it measured each element's single bounding-rect envelope instead of its individual rendered line fragments, hiding real shift on any multi-line-wrapping text element. Fixed and verified (WINDOWS.md entry 8), resolving the earlier "Chromium native-CLS attribution quirk" dismissal (entry 6) as an actual bug, not a quirk.
- The full font-swap CLS matrix (page x width x scroll[top,mid] x variant[full,size-adjust-only] x every loadable fallback face) built and run in both Chromium and WebKit for the first time — every prior run in this project only measured scroll=top, which is why it previously "passed cleanly."
- The matrix found real, substantial CLS on all five pages, both engines, once scroll=mid is included — up to geometryScore 1.19 (WebKit) / 0.68 (Chromium) on index.html. Root-caused to a structural limitation of capsize's size-adjust (equalizes average character width, not per-line word-wrap points between two visually distinct typefaces), confirmed by comparing full vs size-adjust-only variants (near-identical magnitudes rule out the override descriptors as the cause).
- design/evidence/font-cls.md written with the full matrix table, engine-version/WebKit-is-not-Safari caveats, the Georgia "not exercised on this host" note, and per-engine max scores — an honest record, not a forced pass.
- WINDOWS.md entries 1, 4, 5, 6, 7, 8 all updated: entry 6 marked fixed (superseded by entry 8's root cause); entries 1/4/5 broadened with the full-matrix evidence; entries 7 and 8 added with complete root-cause writeups. Entries 2 and 3 (photo/hue subject-fidelity, unrelated to this plan) untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Spanish +25% overflow, drawn-Spanish, null-summary, 320px/200%-zoom reflow (D-07, D-15, criterion 4)** - `17bc3cd` (feat) — completed in the prior (interrupted) session
2. **Task 2a: Geometry instrument fragment-based measurement fix** - `171e325` (fix) — the entry-8 bug fix, split out as its own commit
3. **Task 2b: Full font-swap CLS matrix and evidence report (D-08, criterion 5)** - `71a93a3` (feat) — the swap-matrix extension, spec rewrite, report script, and evidence

_Note: Task 2 was split across two commits (a standalone instrument bug fix, then the feature extension it enabled) per the resume instructions, using targeted `git add -p` hunk staging since both changes lived in the same file (geometry.ts)._

## Files Created/Modified

- `design/tests/support/i18n.ts` - loadSpanishFixture/injectText/overflowReport/widthRatio for Spanish injection and overflow measurement
- `design/tests/spanish-overflow.spec.ts` - criterion 4 spec: injected Spanish, drawn Spanish, null-summary, 320px/200%-zoom reflow
- `design/tests/support/geometry.ts` - fragment-based layout-shift measurement (bug fix) + variant/fallbackFamily/listLoadableFallbacks (feature)
- `design/tests/font-cls.spec.ts` - rewritten to run the full swap matrix per page/width, with per-(engine,page,width) fragment files instead of a shared serial-mode cache
- `design/scripts/report-font-cls.mjs` - new: merges fragments, re-checks caniuse, writes design/evidence/font-cls.md, itself an enforcement gate for criterion 5
- `design/scripts/verify-phase-1.mjs` - wires report-font-cls.mjs into the criterion-5 gate
- `design/evidence/font-cls.md` - the full swap-matrix evidence table and caveats
- `.planning/WINDOWS.md` - entries 1/4/5/6/7/8 updated/added/resolved with evidence

## Decisions Made

- Split Task 2's geometry.ts work into two commits (bug fix, then feature) rather than one combined commit — the bug fix stands alone and is independently valuable to bisect.
- Did not attempt a CSS fix for the criterion-5 matrix failures beyond what the investigation already ruled out (override descriptors, fallback-chain ordering — both already correctly tuned). The root cause is structural to font-substitution under font-display:swap, a PRD-locked decision; reopening it is an architectural call for the owner (Rule 4), not something to auto-fix.
- Did not weaken the 0.005 threshold or the measurement to force a pass. report-font-cls.mjs is left correctly failing — an honest signal, not hidden.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Geometry instrument measured element envelopes instead of line fragments**
- **Found during:** Task 2, investigating WINDOWS.md entry 6's unexplained Chromium-native-vs-geometry disagreement
- **Issue:** `snapshotLayout`/`layoutShiftScore` compared each element's single `getBoundingClientRect()` envelope, hiding real per-line reflow on multi-line-wrapping elements (e.g. changelog.html's wrapped sentence spans)
- **Fix:** Changed to per-fragment (`getClientRects()`) comparison, matching 01-08's focus.ts standard for wrapped elements
- **Files modified:** design/tests/support/geometry.ts
- **Verification:** changelog.html@320px/top/full/Noto-Serif now measures geometryScore 0.0068 (was 0.0000) against native CLS 0.0125 — both agree it's a real violation
- **Committed in:** 171e325

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix to the primary D-08 instrument; it changed measured results for every subsequent run in this plan (for the more accurate). No scope creep — directly required by the plan's own instruction to investigate rather than trust the prior dismissal.

## Issues Encountered

- **Criterion 5 does not currently exit 0.** This is not a test-authoring problem: the matrix (never run in full before this plan) found real, substantial font-swap CLS on all five pages, both engines, once scroll=mid (below-the-fold) is measured. Investigation ruled out the ascent/descent/line-gap override descriptors (full vs size-adjust-only variants are near-identical) and confirmed the fallback-face chain in style.css is already correctly ordered and capsize-tuned per tier. The remaining cause — capsize's size-adjust cannot guarantee identical per-line word-wrap points between two visually distinct typefaces — is inherent to font-substitution under `font-display:swap`, a PRD §6.5-locked decision. No further CSS fix was attempted. **Owner decision required** (see Known Stubs / checkpoint below).
- **Georgia (the fallback face the majority of real readers — macOS/iOS/Windows — actually get) could not be measured directly.** Not installed on this Linux machine or the pinned Playwright Docker image; confirmed genuinely unavailable via `document.fonts.load()`. Covered only by capsize metric arithmetic. A real-Safari/Georgia spot-check on a macOS or iOS device remains an explicit open item (WINDOWS.md entries 1/4/5/7).
- A residual gap between the geometry instrument's score and native CLS remains on some rows even after the entry-8 fix (e.g. 0.0068 vs 0.0125 on the same changelog.html swap) — not chased further given time cost; both signals already agree on the qualitative conclusion (real violation).
- The plan's `<human-check>` step for Task 1 (driving a real browser at 200% zoom) was not re-performed in this session — only the Playwright emulation was re-verified. Flagged in coverage D2's rationale for owner follow-up.

## Known Stubs

None — no stub data or placeholder UI was introduced. The one open item is a genuine, root-caused measurement finding (criterion 5's real CLS), not a stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Criterion 4 is fully proven and ready for 01-10 (approval packet).
- **Criterion 5 requires an explicit owner decision before 01-10/01-APPROVAL.md sign-off.** See the checkpoint returned alongside this summary for the measured options (accept the residual shift with documentation, adjust the fallback font stack, or reopen the font-display:swap PRD decision).
- WINDOWS.md entries 1, 4, 5, 7 (WebKit-Docker prePaintObserved variance, the broadened multi-page/multi-engine CLS finding, and the Georgia/real-Safari gap) remain open, each with full evidence, awaiting the same owner review pass already anticipated by this project's `human_verify_mode:end-of-phase` convention.
- Entry 2 (politics photo subject-fidelity) and entry 3 (Sports/Business hue amber-olive risk) are unrelated to this plan and remain open from prior plans.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 9 created/modified files found on disk; all 3 commits (17bc3cd, 171e325, 71a93a3) found in git log.

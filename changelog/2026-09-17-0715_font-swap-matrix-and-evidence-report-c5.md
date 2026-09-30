# 2026-09-17 - Full Font-Swap CLS Matrix and Evidence Report (D-08, Criterion 5)

**Keywords:** [TESTING] [PERFORMANCE] [BUG_FIX] [ACCESSIBILITY]
**Session:** Early morning, Duration (~2.5 hours across an interrupted/resumed session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0715_font-swap-matrix-and-evidence-report-c5.md`

## What Changed

- File: `design/tests/support/geometry.ts`
  - `measureFontSwap` extended with `variant` (`'full' | 'size-adjust-only'`) and `fallbackFamily` options, both implemented through a `page.route('**/mockups/style.css')` handler (`installStyleOverride`) that rewrites only the fonts region of the served stylesheet
  - Added `listLoadableFallbacks(page)`: calls `document.fonts.load()` for every registered `"<Primary> Fallback: <label>"` face and returns the labels that actually reach `'loaded'` in that engine/host
- File: `design/tests/font-cls.spec.ts`
  - Rewritten to run the full swap matrix per page/width: scroll `['top', 'mid']` x variant `['full', 'size-adjust-only']` x every loadable fallback family, light theme, asserting `geometryScore < 0.005` (and the native-CLS cross-check where supported) for every combination via `expect.soft` so one failing combination doesn't hide the rest of the matrix
  - Switched from a shared, serially-written cache file to one fragment file per (engine, page, width) test under `design/.cache/font-cls-fragments/`, removing the earlier serial-mode fail-fast cascade that hid later pages on an early failure
  - Subset-coverage test extended to also require every Spanish fixture string (`en`/`es_real`/`es_synthetic`) to be covered by `subset-manifest.json`
- File: `design/scripts/report-font-cls.mjs` (new)
  - Merges the per-(engine,page,width) fragments into canonical `design/.cache/font-cls-<engine>.json` files
  - Re-checks caniuse.com for `ascent-override` Safari support at run time
  - Writes `design/evidence/font-cls.md`: engine versions, the "not Safari" caveat, the size-adjust-only proxy note, the full swap-matrix table, fallback faces exercised/not exercised (Georgia flagged as unmeasurable on this host), and a max-score summary per engine
  - Exits non-zero if any measured combination is at or above the 0.005 threshold — this script is itself an enforcement gate, not just a report generator
- File: `design/scripts/verify-phase-1.mjs`
  - Criterion 5 now calls `report-font-cls.mjs` after the Playwright runs; a non-zero exit fails C5
- File: `.planning/WINDOWS.md`
  - Entry 6 marked `fixed` (superseded — see entry 8)
  - Entries 1, 4, 5 updated with the broadened evidence from the full matrix
  - Entry 7 added: real, substantial font-swap CLS on all five pages, both engines, once `scroll=mid` is measured — root-caused to capsize's `size-adjust` being a single average-character-width scale factor that cannot guarantee identical per-line word-wrap points between visually distinct typefaces
  - Entry 8 added: the geometry-instrument fragment-measurement bug (see the preceding commit) and its before/after numbers

## Why

D-08 requires the font-swap-induced layout shift to be measured empirically across the real matrix — every page, both widths, both scroll positions, both descriptor variants, and every fallback face the engine can actually load — not assumed safe from a single top-of-viewport Chromium pass. Prior runs (01-02 through 01-08) only ever measured `scroll=top`, which is why they "passed cleanly."

Running the full matrix (this session) found real, substantial layout shift on every one of the five mockup pages, in both Chromium (native) and WebKit, once `scroll=mid` (below-the-fold) is included — up to geometryScore 1.19 in WebKit, 0.68 in Chromium (index.html). Comparing the `full` variant against `size-adjust-only` (overrides stripped) produced near-identical magnitudes, which rules out the ascent/descent/line-gap override descriptors as the primary driver. The root cause is structural: `size-adjust` can equalize a fallback face's *average* character width against the primary web font, but it cannot guarantee that both faces wrap text at the same point on every line — so once a paragraph reflows below the initial viewport, real shift remains, regardless of how well-tuned the size-adjust value is.

This is inherent to using `font-display: swap` with any font-substitution strategy on text-dense pages, not a CSS bug in this codebase. `font-display: swap` is a locked PRD §6.5 decision; changing the swap/rendering strategy to avoid it would be an architectural change requiring an explicit owner decision (Rule 4), so no fix was attempted here — the finding was verified, root-caused, and documented instead.

## Issues Encountered

- Georgia (the face macOS/iOS/Windows readers actually get) is not installed on this Linux machine or in the pinned Playwright Docker image, so it could not be measured directly — `document.fonts.load()` confirms it is genuinely unavailable via `local()`, contradicting `fc-match`'s own unrelated Gelasio substitution. Flagged plainly in the evidence report as an open item requiring a real macOS/iOS spot-check.
- A residual gap between the geometry instrument's score and native CLS remains on some rows even after the fragment-measurement fix (see the preceding commit's changelog entry) — not further chased given time cost.
- Criterion 5 does NOT currently exit 0 (`report-font-cls.mjs` exits non-zero because real measured combinations exceed the 0.005 threshold). This is the correct, honest behavior of the gate given the finding above — the threshold was not weakened to force a pass. Left as an explicit owner decision point (see the SUMMARY for this plan).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full swap matrix (5 pages x 2 widths x 2 scroll positions x 2 variants x every loadable fallback family) in both Chromium and WebKit (Playwright, Docker); results captured in `design/evidence/font-cls.md` and the per-engine cache JSON files.
- What wasn't tested: Georgia (unavailable on this host); real Safari on macOS/iOS (Playwright's WebKit tracks trunk, not shipped Safari).
- Edge cases: the subset-coverage test now also covers every Spanish fixture string, not just on-page text.

## Next Steps

- [ ] Owner decision: accept the documented residual font-swap shift, change the fallback font stack, or reconsider `font-display: swap` (architectural, would need to reopen the PRD §6.5 decision)
- [ ] Real-Safari / Georgia spot-check on a macOS or iOS device before 01-APPROVAL.md sign-off (also covers WINDOWS.md entries 1/4/5)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - documents that criterion 5 (zero layout shift on font swap) does not currently pass in its full, honest form; requires an owner decision before phase sign-off

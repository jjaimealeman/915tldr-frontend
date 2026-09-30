# 2026-09-17 - Geometry instrument now measures per-line fragments, not element envelopes

**Keywords:** [BUGFIX] [TESTING] [ACCESSIBILITY]
**Session:** Early morning, Duration (~0.5 hours, continuation of an interrupted session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0700_geometry-fragment-based-layout-shift-fix.md`

## What Changed

- File: `design/tests/support/geometry.ts`
  - `LayoutSnapshot.elements` changed from `Record<string, LayoutRect>` (one bounding-rect envelope per element) to `Record<string, LayoutRect[]>` (one entry per rendered line fragment, via `getClientRects()`)
  - `snapshotLayout` now records every line fragment for each candidate element instead of a single `getBoundingClientRect()` envelope
  - `layoutShiftScore` now diffs fragment-by-fragment (line-by-line) between before/after snapshots, and separately counts a fragment-count change (a line gained or lost) as real movement using that fragment's own height as the displacement proxy
  - Forward-declared the `FontSwapVariant` type and two new optional fields (`variant`, `fallbackFamily`) on `MeasureFontSwapOptions`, used by the swap-matrix extension landing in the next commit; inert until that code calls them

## Why

WINDOWS.md entry 6 recorded an unexplained disagreement: Chromium's native CLS reported 0.0125 on changelog.html's font swap (over the 0.005 threshold) while this project's own geometry instrument reported 0 — dismissed at the time as a "Chromium native-CLS attribution quirk on text-dense pages."

Investigating the instrument itself (rather than trusting that dismissal) found a real bug: `snapshotLayout` measured each candidate element's single bounding-rect *envelope*, not its individual rendered line fragments. A multi-line-wrapping inline element (changelog.html's `[data-item-sentence]` spans, several sentences long) can have individual LINES reflow onto different positions after a font swap while the element's overall envelope — top-left of the first line to bottom-right of the last — stays nearly unchanged. The envelope hid real, per-line shift entirely. This is the same failure mode 01-08's `focus.ts` already documented and corrected for wrapped focus rings, applied here to font-swap CLS measurement.

After the fix, changelog.html@320px/top/full/Noto-Serif measures geometryScore 0.0068 (previously 0.0000) against a native CLS of 0.0125 — both signals now agree this is a real threshold violation, not an attribution quirk. WINDOWS.md entry 6 is marked fixed/superseded; entry 8 records the full finding.

## Issues Encountered

A residual gap remains between the corrected geometry score (0.0068) and native CLS (0.0125) on the same swap — most likely finer-than-line-fragment paint-box granularity in the browser's own native measurement. Not chased further given time cost and that both signals already agree on the qualitative conclusion (real violation, not a quirk). Documented in WINDOWS.md entry 8 rather than silently left unexplained.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the fix was exercised as part of running the full font-swap matrix (design/tests/font-cls.spec.ts, landing in the next commit) across all 5 mockup pages, both engines; the changelog.html@320px/top/full/Noto-Serif combination specifically demonstrates the before/after geometry score change described above.
- What wasn't tested: the residual 0.0068 vs 0.0125 gap was not independently root-caused beyond "likely finer browser paint-box granularity" — flagged as an open question rather than resolved.
- Edge cases: fragment-count changes (a line gained or lost between snapshots) are now counted as movement using the extra fragment's own height, rather than being silently skipped as "no counterpart to diff against."

## Next Steps

- [ ] Land the swap-matrix extension (FontSwapVariant/fallbackFamily plumbing, font-cls.spec.ts rewrite, evidence report) in a following commit
- [ ] Owner review of the broader font-swap CLS finding this fix helped surface (WINDOWS.md entries 4/5/7/8)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - test-instrument correctness fix; changes measured CLS results for future runs, no production code touched

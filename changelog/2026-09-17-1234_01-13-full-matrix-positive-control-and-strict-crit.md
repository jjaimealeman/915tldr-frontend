# 2026-09-17 - Full Font-Swap Matrix Passes Cleanly, With a Built-In Check That the Test Itself Still Works

**Keywords:** [FEATURE] [TESTING] [PERFORMANCE] [BUG_FIX]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1234_01-13-full-matrix-positive-control-and-strict-crit.md`

## What Changed

- `design/tests/font-cls.spec.ts`: added a "positive control" test — it
  deliberately breaks the new font strategy for one measurement (forces the
  old swap-in-place behavior back on, on purpose) to prove the test suite
  would actually notice if the fix ever regressed, rather than trusting a
  clean result that might just mean the check went blind.
- `design/scripts/report-font-cls.mjs`: the evidence report generator is now
  a stricter gate — it refuses to certify a clean result unless that
  positive control genuinely caught a real swap in Chrome, and it refuses
  to trust any measurement using an old/incomplete data format rather than
  silently treating missing data as "fine."
- `design/scripts/verify-phase-1.mjs`: added a check that every font
  declaration in the stylesheet still carries the correct loading strategy.
- `design/tests/support/geometry.ts`: fixed a real bug in the reference
  measurement found while wiring up the positive control — when a page's
  content height changes, comparing two page loads scrolled to "the same
  fraction of the page" can actually mean two different pixel positions;
  now both are compared at the exact same pixel position instead. Also
  narrowed one check to the two font weights this project actually
  preloads, after finding that a secondary italic accent face (used above
  the fold on the article page) can never realistically win the very short
  loading window the new strategy relies on — a real, separately-flagged
  finding, not something this check needed to be strict about.
- `design/evidence/font-cls.md`: regenerated with the full matrix, the new
  positive-control results, and per-browser notes.

## Why

A test suite that reports "zero layout shift" is worthless if it would also
report "zero layout shift" on a version of the site that actually shifts.
The positive control exists specifically to rule that out — proving the
instrument used throughout this whole investigation can still see a real
problem when one is deliberately introduced, in both browsers.

## Issues Encountered

The positive control's own comparison logic tripped over the scroll-drift
bug above — worth calling out because it wasn't found by reasoning about the
code, it was found because the test using the instrument most aggressively
(the one designed to break things on purpose) hit an edge case nothing
before it had exercised.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run verify:phase-1 --criteria=5` across all five
  pages, both browsers — run twice in a row for a repeatable clean pass. The
  stale-data-format rejection was verified directly with a deliberately
  broken fixture file.
- What wasn't tested: nothing skipped; every planned page/width/scroll/
  variant/fallback combination ran in both browsers.

## Next Steps

- [ ] None — Task 2 complete, proceeding to Task 3

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - strengthens the font-swap CLS gate and fixes a real measurement bug found while doing so

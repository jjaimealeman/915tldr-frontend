# 2026-10-02 - CR-03 RED: load/baseline window alignment regression test

**Keywords:** [TESTING] [BUG_FIX] [CRITICAL]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2129_05-16-task1-cr03-red-window-alignment-test.md`

## What Changed

- File: `tests/unit/load-test-zero-reads.test.mjs`
  - Added test "CR-03 (05-16): load and baseline windows are aligned identically"
  - Uses a recording `fetchImpl` wrapper around the existing `fullPassFetchImpl` fixture to capture
    the `start`/`end` variables of every `fetchD1RowsRead` query and the `at` of every
    `checkD1AnalyticsCaughtUp` query during a full `runLoadTest` pass
  - Asserts the load-window rowsRead query and all 7 baseline-window queries share identical
    duration and identical minute-of-hour start/end boundaries, that the catch-up poll targets the
    aligned end, and that the result carries both an aligned `window` and a raw `requestWindow`
  - Confirmed RED against the unfixed `tools/load-test-zero-reads.mjs`: the load query started at
    the raw instant `2026-09-30T03:27:13.000Z` instead of the expected aligned
    `2026-09-30T03:25:00.000Z`

## Why

05-REVIEW.md's CR-03 finding: `comparableWindows()` aligns the 7 baseline windows outward to
5-minute boundaries (floor start, ceil end), but the load window was passed into the D1 analytics
query raw. Because the query filters on `datetimeFiveMinutes_geq`/`_lt` (a bucket-start dimension),
the bucket containing the load window's own raw start was always excluded — the load side of the
PASS/FAIL comparison systematically summed fewer 5-minute buckets than the baseline side, biasing
every gate run toward a false PASS. This test locks the fix in place as a permanent regression
guard, written and run RED before any fix code is touched (05-16 Task 1, TDD).

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the test itself — confirmed it fails against the pre-fix `runLoadTest` with the
  exact asymmetry CR-03 describes (raw start instead of the floored 5-minute boundary)
- What wasn't tested: this commit is test-only; the fix lands in the next commit (GREEN)
- Edge cases: minute-of-hour boundary equality is asserted on both start and end of every window,
  not just duration, to catch a fix that floors but doesn't also align baseline minute-of-hour

## Next Steps

- [ ] GREEN: implement `alignedLoad`/`requestWindow` in `runLoadTest` so this test passes

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - this is the correctness guard for ARCH-01's own measurement instrument

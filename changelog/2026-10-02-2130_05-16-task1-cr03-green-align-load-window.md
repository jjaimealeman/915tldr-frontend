# 2026-10-02 - CR-03 GREEN: one aligned window feeds both sides of the zero-reads comparison

**Keywords:** [BUG_FIX] [BACKEND] [TESTING] [CRITICAL]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2130_05-16-task1-cr03-green-align-load-window.md`

## What Changed

- File: `tools/load-test-zero-reads.mjs`
  - `runLoadTest`'s full-pass branch now builds `alignedLoad` (`floorToFiveMinutes(windowStart)` /
    `ceilToFiveMinutes(windowEnd)`) right after `windowEnd = now()`, and uses it for: the
    ingest-slot validity check (`windowTouchesIngestSlot`), the default `checkCaughtUp` poll
    (`checkD1AnalyticsCaughtUp(alignedLoad.end, ...)`), the load-window `fetchD1RowsRead` call, and
    `comparableWindows(alignedLoad, 7)` for the baseline derivation
  - `requestWindow` (the raw, as-sent `windowStart`/`windowEnd`) is kept separately, written into
    `load-window.json` evidence alongside `window: alignedLoad`, and returned on the result object
    — visible for transparency, never used to query D1
  - `comparableWindows` itself is unchanged (re-aligning an already-aligned window is a no-op)
- File: `tests/unit/load-test-zero-reads.test.mjs`
  - No change in this commit — the CR-03 test added in the prior (RED) commit now passes unmodified

## Why

GREEN half of the 05-16 TDD cycle fixing 05-REVIEW.md's CR-03: the load window and the 7 baseline
windows must cover the identical number of 5-minute D1-analytics buckets, or a PASS verdict is
measuring an artificially small slice of the load window's own traffic. One aligned window built
once and threaded through every D1-analytics call site removes the asymmetry structurally (the two
sides of the comparison can no longer drift apart by construction), rather than patching the
query call sites independently.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/load-test-zero-reads.test.mjs` -- 54/54 pass (the new
  CR-03 test plus all 53 pre-existing tests, confirming no regression); `pnpm run test:fast` --
  695/695 pass across the full project suite
- What wasn't tested: no live network call in this commit -- Task 2 performs the one live,
  read-only re-query against the real 2026-10-01 recorded window
- Edge cases: the pre-start ingest-slot refusal (evaluated before `windowEnd` exists) and
  `--baseline-only` mode were deliberately left untouched, since neither has the raw/aligned
  asymmetry this fix addresses

## Next Steps

- [ ] Task 2: re-check the recorded 2026-10-01 ZERO_READS_PROVEN verdict with a real read-only
      aligned re-query and record the correction in docs/phase-05/zero-reads-gate.md

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - fixes a structural bias toward PASS in ARCH-01's own measurement instrument

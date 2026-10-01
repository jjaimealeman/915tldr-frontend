# 2026-09-30 - Complete tiering/hot-window validation (GREEN)

**Keywords:** [BACKEND] [ARCHITECTURE] [PLANNING]
**Session:** Evening, Duration (~5 min, part of a longer session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2225_tiering-hot-window-validation-green.md`

## What Changed

- File: `src/lib/archive/tiering.ts`
  - `isHotTag`/`isHotArticle`/`hotCutoffEpoch` now throw a `tiering:`-prefixed error on
    invalid input (non-integer, non-positive, NaN) instead of silently computing a result
  - Added `projectStaticCount({ articleFacts, tagFacts, days, nowEpoch, otherFiles })` — the
    shared static-file projection 05-05's file-budget cap will use, computing `total` and the
    Phase 6 (Spanish-doubling) `phase6Total`
- File: `src/lib/archive/hot-window.ts`
  - `parseHotWindow` now validates the derived-window-only fields (`window.from`/`to`,
    `coverageTarget`/`achievedCoverage` in (0,1], `articleRequestsCounted`, `derivedAt`) and
    rejects a derived window flagged `provisional: true`

## Why

GREEN half of 05-01 Task 2: makes the two Task 2 boundary-test files pass, completing the
tiering/hot-window modules' validation discipline before any plan builds on top of them (05-05
derives the real traffic window and needs `parseHotWindow` to reject a malformed derivation
result, not silently accept one).

## Issues Encountered

No major issues encountered — both test files went from a confirmed RED (6 failures) to a clean
GREEN with the planned changes alone.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/tiering.test.mjs tests/unit/hot-window.test.mjs`
  (31/31 pass) and the full fast suite (`pnpm run test:fast`, 424/424 pass, 0 skipped).
- What wasn't tested: the derived-window path end to end against real traffic data — that is
  05-05's own work; this task only proves the parser itself handles a well-formed derived shape.
- Edge cases: every boundary named in the plan's `<behavior>` block (9/10/11, cutoffEpoch -1/+1,
  days 0/2.5, provisional true/false mismatches, out-of-range coverage fractions, negative
  counts, non-ISO dates) is covered by a named test.

## Next Steps

- [ ] Task 3: cross-check facts against the real build and log the hot window (with PROVISIONAL)
      during every build

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW — stricter validation on build-time-only modules, no runtime behavior change

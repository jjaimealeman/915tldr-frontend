# 2026-10-01 - Pin the achievedCoverage-after-cap defect with a failing test (RED)

**Keywords:** [TESTING] [BACKEND] [BUG_FIX]
**Session:** Early morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0023_achieved-coverage-capped-bug-test-red.md`

## What Changed

- File: `tests/unit/derive-hot-window.test.mjs`
  - Added `coverageAtDays` to the import list (not yet exported by
    `tools/derive-hot-window.mjs` — this commit is deliberately RED).
  - Added two `coverageAtDays` unit tests.
  - Added a `cappingFixtureDeps` helper that builds a deterministic
    `{0:50, 1:30, 2:10, 3:5, 10:5}` histogram via 5 synthetic articles injected on the window's
    first day, with a tiny fake `staticCap` that forces `applyStaticCap` to lower the cutoff from
    3 days to 1 day.
  - Added `deriveHotWindow: when the file-budget cap lowers the cutoff, achievedCoverage
    reflects the CAPPED days (< target), and uncappedCoverage keeps the pre-cap figure` and a
    paired regression test for the uncapped case.

## Why

A coordinator review of 05-05's output caught a real defect: `hot-window.json` reported
`achievedCoverage: 0.951` at `days: 202`, but 0.951 is the coverage at the UNCAPPED 234-day
cutoff (`coverageCurve`'s own 95%-target entry), not at the capped 202-day cutoff that
`applyStaticCap` actually chose. `src/lib/archive/hot-window.json`'s `days` field and its
`achievedCoverage` field described two different cutoffs under one record. This commit pins the
expected CORRECT behavior with a test before touching the implementation — confirmed genuinely
RED (`node --test tests/unit/derive-hot-window.test.mjs` fails with a `SyntaxError` on the
not-yet-exported `coverageAtDays`, and would fail on the coverage-value assertions even once that
export exists, against the unfixed `deriveHotWindow`).

## Issues Encountered

None — this is the RED half of a deliberate two-commit TDD pair; the implementation fix follows
in the next commit.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: confirmed this commit's test file, run alone against the as-yet-unmodified
  `tools/derive-hot-window.mjs`, fails (`1 fail`, `SyntaxError: ... does not provide an export
  named 'coverageAtDays'`).
- What wasn't tested: N/A — RED commit, no implementation change.
- Edge cases: the capping fixture also covers the inverse case (cap never binds —
  `achievedCoverage === uncappedCoverage`), so the fix can't satisfy the bug test by always
  reporting the uncapped figure under a different name.

## Next Steps

- [ ] GREEN: implement `coverageAtDays`, recompute `achievedCoverage` at the final (possibly
      capped) `days`, add `uncappedCoverage` to the returned record
- [ ] Regenerate `src/lib/archive/hot-window.json` with the corrected values
- [ ] Correct `docs/phase-05/hot-window-derivation.md` and `05-05-SUMMARY.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW (this commit) - test-only change, deliberately failing until the next commit.

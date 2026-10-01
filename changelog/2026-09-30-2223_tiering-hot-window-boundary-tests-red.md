# 2026-09-30 - Pin tiering/hot-window boundaries with tests (RED)

**Keywords:** [TESTING] [BACKEND] [PLANNING]
**Session:** Evening, Duration (~5 min, part of a longer session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2223_tiering-hot-window-boundary-tests-red.md`

## What Changed

- File: `tests/unit/tiering.test.mjs` (new)
  - Pins the D-08 tag threshold boundary (9 false, 10 true, 11 true) and the invalid-input throw
    discipline (0, -1, 1.5, NaN all throw `tiering:`)
  - Pins `hotCutoffEpoch`'s UTC-day-floor math and same-day stability
  - Pins `isHotArticle`'s inclusive cutoff boundary (cutoffEpoch -1/+1) and non-integer throw
  - Pins `classifyArticles`/`classifyTags` partitioning and `projectStaticCount`'s
    `total`/`phase6Total` formulas
- File: `tests/unit/hot-window.test.mjs` (new)
  - Pins `parseHotWindow` accepting a derived window and the bootstrap fallback
  - Pins rejection of an unknown status, `days: 0`, `days: 2.5`, a fallback with
    `provisional: false`, a derived window with `provisional: true`, a non-object, a derived
    window missing `window.from`/`window.to`, out-of-range `coverageTarget`/`achievedCoverage`,
    a non-ISO `derivedAt`, and a negative `articleRequestsCounted`
  - Pins `describeHotWindow`'s PROVISIONAL/derived-window output shape

## Why

RED half of plan 05-01 Task 2: `src/lib/archive/tiering.ts` (Task 1) has no input validation or
`projectStaticCount` yet, and `src/lib/archive/hot-window.ts` (Task 1) only validates the shared
fields, not the derived-window-specific ones — both intentionally incomplete until this task's
GREEN commit.

## Issues Encountered

No major issues encountered. Confirmed genuinely RED before writing any implementation:
`node --test tests/unit/tiering.test.mjs tests/unit/hot-window.test.mjs` reported 6 failures
(the whole `tiering.test.mjs` file, which imports the not-yet-exported `projectStaticCount`, plus
5 of the new derived-window rejection cases in `hot-window.test.mjs`).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the test files themselves are the artifact under test here.
- What wasn't tested: nothing yet; the GREEN commit proves both pass.
- Edge cases: the boundary values themselves are the point of this commit.

## Next Steps

- [ ] Add throwing validation to `isHotTag`/`isHotArticle`, add `projectStaticCount` to
      `tiering.ts`; add derived-window field validation to `parseHotWindow` (GREEN commit)

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW — test-only change, no runtime behavior yet

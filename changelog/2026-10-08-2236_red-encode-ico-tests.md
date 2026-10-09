# 2026-10-08 - RED: failing tests for the dependency-free ICO encoder

**Keywords:** [TESTING] [FRONTEND]
**Session:** Night, Duration (~3 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2236_red-encode-ico-tests.md`

## What Changed

- File: `tests/unit/share-card-assets.test.mjs`
  - New file with the `encodeIco` container tests: ICONDIR header, directory entry fields, imageOffset arithmetic, verbatim PNG bytes, size 256 encoded as 0
  - Rejection cases: empty list, size outside 1..256, missing PNG signature, duplicate size, unsorted entries
  - Imports `tools/og-card/ico.mjs`, which does not exist yet, so the file fails with ERR_MODULE_NOT_FOUND (the intended RED state)
- File: `changelog/README.md`
  - Index row for this entry

## Why

TDD RED gate for plan 07-02 Task 2: the favicon.ico (D-23, a 32x32 rasterisation of favicon.svg) is assembled by a small encoder with no new package, and its byte layout is pinned before the encoder is written.

## Issues Encountered

No major issues encountered. The suite is red between this commit and the GREEN commit by design.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: confirmed failing with ERR_MODULE_NOT_FOUND before committing
- What wasn't tested: the shipped assets (Task 3 of the plan)
- Edge cases: 256 encoded as 0, duplicate and unsorted sizes

## Next Steps

- [ ] GREEN: implement `tools/og-card/ico.mjs`

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - test only

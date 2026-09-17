# 2026-09-17 - RED: Failing Test for the Font Variation-Axis Reader

**Keywords:** [TESTING] [FEATURE]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1252_01-14-add-failing-test-for-the-fvar-axis-reader-ta.md`

## What Changed

- `design/tests/unit/font-axes.test.mjs`: new `node:test` suite for a
  not-yet-written `readVariationAxes(buffer)` library function. Covers:
  Source Serif 4 Roman and Italic each expose exactly the `opsz`/`wght`
  variation axes with `min <= default <= max`; a static font (Instrument
  Serif Regular) has no `fvar` table and returns `[]`; a truncated buffer
  throws an error mentioning "sfnt"; a buffer starting with `wOFF`/`wOF2`
  throws an error naming WOFF/WOFF2 as unsupported input. If a source font
  file is missing from `design/fonts-src/`, the test fails with an explicit
  instruction to run `pnpm run fonts:fetch` — it never silently skips.

## Why

This is the RED half of a TDD task: the library the next commit implements
(`design/scripts/lib/font-axes.mjs`) will let `build-fonts.mjs` pin Source
Serif 4's `opsz` axis to each source's own default value instead of a
guessed number, which is the main lever that shrinks the subset (Task 3).
Writing the test first, and confirming it fails for the right reason,
pins down the contract before any implementation exists.

## Issues Encountered

None.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test design/tests/unit/font-axes.test.mjs`
  confirmed RED — fails with `ERR_MODULE_NOT_FOUND` because
  `design/scripts/lib/font-axes.mjs` does not exist yet, not because of an
  assertion failure (the correct kind of failure for this stage).
- What wasn't tested: nothing implemented yet — that's the next commit.

## Next Steps

- [ ] Implement `design/scripts/lib/font-axes.mjs` and make this suite green
      (GREEN)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - test-only change, no production code yet

# 2026-10-08 - RED: failing tests for the full ordered og/twitter share tag set

**Keywords:** [TESTING] [FRONTEND]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2240_red-share-meta-full-set-tests.md`

## What Changed

- File: `tests/unit/share-meta.test.mjs`
  - New file with the pure unit tests of `shareMetaTags`, `shareImageUrl` and `fallbackPageUrl`
  - Pins the fixed 14-key order (og:title through twitter:image:alt), the literal EN and ES values, og:locale:alternate on every page (D-22), the banned X tags (D-17), verbatim hostile text, and the `share-meta:` validation errors
  - Fails against the tracer-only builder (it still emits only the og:image group)
- File: `changelog/README.md`
  - Index row for this entry

## Why

TDD RED gate for plan 07-03 Task 1: the full share tag set is pinned before the builder is extended.

## Issues Encountered

No major issues encountered. The suite is red between this commit and the GREEN commit by design.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: confirmed failing against the 07-01 builder before committing
- What wasn't tested: the rendered head (Task 2, head harness)
- Edge cases: paired, self and none alternates; empty and whitespace-only text; non-https URLs

## Next Steps

- [ ] GREEN: extend `shareMetaTags` in `src/lib/share-meta.ts`

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - test only

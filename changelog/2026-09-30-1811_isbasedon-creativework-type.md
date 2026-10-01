# 2026-09-30 - isBasedOn JSON-LD node changed from NewsArticle to CreativeWork

**Keywords:** [SEO] [TESTING] [BUG_FIX]
**Session:** Evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1811_isbasedon-creativework-type.md`

## What Changed

- File: `src/lib/structured-data.ts`
  - `newsArticleNode()`'s `isBasedOn` node's `@type` changed from `'NewsArticle'` to
    `'CreativeWork'` (both in the `NewsArticleNode` interface and the builder function). `url` and
    `publisher` fields are unchanged.
- File: `tests/unit/structured-data.test.mjs`
  - Updated the `isBasedOn` test's `@type` assertion to `'CreativeWork'`.

## Why

Owner ran Google's Rich Results Test against a live dev article (2026-09-30) and it reported the
`isBasedOn` node — typed `NewsArticle` — as a separate, incomplete "Unnamed item" NewsArticle with
3 non-critical issues (missing image/author/headline of its own). Those fields belong to the
original outlet's own page, not ours, and `isBasedOn` only needs to identify the source work and
its publisher — `CreativeWork` covers exactly that without implying a second, incomplete
NewsArticle entity. Missing top-level `image` on the main NewsArticle node is separately expected
and untouched — imagery is a later phase, not part of this fix.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the `newsArticleNode()` unit test asserting `isBasedOn['@type'] ===
  'CreativeWork'`, plus the full `pnpm run test:unit` suite (390/390 passing) and
  `pnpm run test:build-gate` (8/8), with all 04-followups changes applied together.
- What wasn't tested: a second live Google Rich Results Test re-run against the deployed fix (the
  owner's original test run is what identified the issue; a confirming re-run is optional
  follow-up, not required by this fix).
- Edge cases: confirmed no other code path references `isBasedOn` with a `'NewsArticle'` type
  assumption (grep across `src/`, `tests/`, `design/`, `tools/`).

## Next Steps

- [ ] None — this follow-up task is complete.

---

**Branch:** feature/fix/phase-04-followups
**Issue:** N/A
**Impact:** LOW - a single JSON-LD field type change, resolves a non-critical Rich Results Test warning.

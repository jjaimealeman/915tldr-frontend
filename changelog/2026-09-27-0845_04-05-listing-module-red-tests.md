# 2026-09-27 - Failing tests for the listing selection module (04-05 Task 1, RED)

**Keywords:** [TESTING] [FRONTEND] [FEATURE]
**Session:** Morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0845_04-05-listing-module-red-tests.md`

## What Changed

- File: `tests/unit/listing.test.mjs`
  - Added tests for `compareNewestFirst`/`sortNewestFirst` (newest-first ordering, uuid-ascending
    tiebreak, non-mutating sort)
  - Added tests for `groupByCategory` (all 8 `CATEGORIES` slugs present as keys, including
    categories with zero articles)
  - Added tests for `groupByTag` (keyed only by tags present on at least one article) and
    `groupBySource`
  - Added tests for `tagIndex` (sorted by count desc, then slug asc)
  - Added tests for `assertNoRouteCollisions` (throws naming the offending slug; the 8 real
    category slugs pass) and `RESERVED_TOP_LEVEL`'s full reserved-name list
  - Added tests for the page-count constants (`CATEGORY_PAGE_COUNT`/`TAG_PAGE_COUNT`/
    `SOURCE_PAGE_COUNT` = 30, `TAGS_INDEX_COUNT` = 100) and `HOME_FEED_COUNT` (7, counted from
    `design/mockups/index.html`'s no-JS feed state)

## Why

Phase 4 Plan 05, Task 1 (TDD RED step): every listing page (home, the 8 category indexes, tag
pages, `/tags`, source pages) needs to draw from one tested, deterministic selection module
(`src/lib/listing.ts`) rather than each page re-implementing its own sort/group/limit logic.
Writing the tests first and confirming they fail (module doesn't exist yet) before writing the
implementation.

## Issues Encountered

No major issues encountered. Confirmed the whole suite fails with `ERR_MODULE_NOT_FOUND`
(`src/lib/listing.ts` not yet created) before this commit, as required for a genuine RED step.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: nothing yet runs against real code — this commit is the RED half of the TDD
  pair; `node --test tests/unit/listing.test.mjs` fails as expected
- What wasn't tested: the implementation itself (next commit, GREEN)
- Edge cases: empty categories, tag slug collisions with reserved top-level routes, tie-break
  ordering on equal `publishedAt`/equal tag counts

## Next Steps

- [ ] Implement `src/lib/listing.ts` to make this suite pass (GREEN)
- [ ] Build the homepage and 8 category index pages on top of it (Task 2)
- [ ] Build tag pages, `/tags` and source pages on top of it (Task 3)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-only change, no source code yet

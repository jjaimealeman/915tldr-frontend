# 2026-09-27 - GREEN: implement the listing selection module (04-05 Task 1)

**Keywords:** [FEATURE] [FRONTEND] [BUG_FIX]
**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0900_04-05-listing-module-green.md`

## What Changed

- File: `src/lib/listing.ts`
  - Added `compareNewestFirst()`/`sortNewestFirst()` — newest-`publishedAt`-first ordering with a
    deterministic `uuid`-ascending tiebreak, non-mutating sort
  - Added `groupByCategory()` — pre-populates all 8 `CATEGORIES` slugs as keys (including empty
    arrays for categories with zero public articles), each value newest-first sorted
  - Added `groupByTag()`/`groupBySource()` — keyed only by tags/sources actually present on at
    least one article
  - Added `tagIndex()` — flat `{ slug, name, count }[]` sorted by count desc then slug asc (v1
    parity with `server/api/tags.get.ts`'s `ORDER BY usageCount DESC, name ASC`)
  - Added `assertNoRouteCollisions()` and `RESERVED_TOP_LEVEL` — throws naming the offending slug
    if a category slug collides with any of the 24 reserved top-level route names this project
    emits
  - Added the page-count constants (`CATEGORY_PAGE_COUNT`/`TAG_PAGE_COUNT`/`SOURCE_PAGE_COUNT` =
    30, `TAGS_INDEX_COUNT` = 100, v1 parity) and `HOME_FEED_COUNT` (7, counted from
    `design/mockups/index.html`'s no-JS feed state: 1 lead + 6 grid cards)

## Why

Makes the RED tests from the prior commit pass. Every listing page type in this plan (home, the 8
category indexes, tag pages, `/tags`, source pages) needs one shared, tested, deterministic
selection module rather than each page re-implementing its own sort/group/limit logic — this is
also what lets `assertNoRouteCollisions` catch a category-slug collision at build time instead of
silently clobbering a reserved route's output file.

## Issues Encountered

The plan's acceptance grep (`grep -c "lib/server" src/lib/listing.ts` must be 0) initially failed
against the module's own doc comment, which mentioned the literal substring while describing the
D1-access boundary this file deliberately stays outside of — the same false-positive class
documented in 04-02-SUMMARY.md's Deviation 3. Reworded the comment to describe the same constraint
without using the literal substring the grep checks for.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/listing.test.mjs` (15/15 passing), plus the full
  `design/tests/unit/**` + `tests/unit/**` suite (272/272 passing, no regressions)
- What wasn't tested: this module has no page consumer yet — Tasks 2 and 3 of this plan are its
  first real consumers
- Edge cases: empty categories (explicit empty array, not a missing key), tag slugs with zero
  articles get no key, tie-break ordering on equal `publishedAt` and equal tag counts, a category
  slug colliding with any of the 24 reserved top-level route names

## Next Steps

- [ ] Build the homepage and 8 category index pages on top of `groupByCategory`/`sortNewestFirst`
      (Task 2)
- [ ] Build tag pages, `/tags` and source pages on top of `groupByTag`/`groupBySource`/`tagIndex`
      (Task 3)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - new pure module, no page wiring yet

# 2026-09-26 - Phase 4 Plan 2, Task 1 RED: failing tests for format.ts and structured-data.ts

**Keywords:** [TESTING] [FRONTEND] [SEO]
**Session:** Evening, phase 04 plan 02 execution (Task 1, RED half of the TDD pair)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-2321_04-02-format-structured-data-red-tests.md`

## What Changed

- File: `tests/unit/format.test.mjs` (new)
  - Pins `formatBylineTime()`'s AP-style output (`"Sept. 16, 1:06 p.m."`, winter offset case,
    noon-hour case, the full 12-month abbreviation table, `withYear` appending the year),
    `formatDateline()`'s full weekday/month/day/year string, and `isoWithOffset()`'s local
    wall-time + real UTC-offset-at-that-instant format
  - Proves TZ-independence by spawning two real child `node` processes with `process.env.TZ` set
    to `UTC` and `Asia/Tokyo` and asserting identical output — a same-process check would say
    nothing about the host machine's zone
- File: `tests/unit/structured-data.test.mjs` (new)
  - Pins `toSafeJsonLd()`'s injection-safety (a headline containing a literal `</script><script>`
    cannot close the script element, and `JSON.parse` round-trips every escaped character back to
    the original), plus `organizationNode`/`websiteNode`'s stable `@id` values,
    `newsArticleNode`'s author/publisher-as-Organization-`@id` rule, `isBasedOn` shape, sorted
    `keywords`, and `@id` uniqueness across two same-headline articles, and `breadcrumbNode`'s
    1-indexed `ListItem` positions with absolute URLs

## Why

TDD RED half of Task 1 (`tdd="true"`): `src/lib/format.ts` and `src/lib/structured-data.ts` do not
exist yet in this commit. Confirmed both test files fail with `ERR_MODULE_NOT_FOUND` before
writing this changelog entry — a genuine red, not a placeholder. The GREEN commit (the two
modules plus `src/lib/categories.ts`) follows immediately after.

## Issues Encountered

None — this is the intentional RED half of the pair.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/format.test.mjs tests/unit/structured-data.test.mjs`
  — both files fail with `Cannot find module '.../src/lib/format.ts'` /
  `'.../src/lib/structured-data.ts'`, confirming genuine RED (the modules were moved out of
  `src/lib/` for this commit, not merely untested)
- What wasn't tested: nothing yet — no implementation exists to test
- Edge cases: N/A at this stage

## Next Steps

- [ ] GREEN commit: implement `src/lib/format.ts`, `src/lib/structured-data.ts`,
      `src/lib/categories.ts` and confirm both test files pass

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-only change, no application code yet

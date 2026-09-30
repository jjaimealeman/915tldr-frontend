# 2026-09-27 - Failing tests for standfirst split, summary body and rail selection (RED)

**Keywords:** [TEST] [ASTRO] [SEO]
**Session:** Late night, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0031_04-04-summary-rail-red-tests.md`

## What Changed

- File: `tests/unit/summary.test.mjs`
  - Added failing tests for `splitStandfirst()` (Phase 1 D-10 standfirst deck extraction, including
    the AP-abbreviation edge cases: "Dr.", "St.", "a.m."/"p.m.", "Sept.", "No.")
  - Added failing tests for `summaryBodyHtml()` covering an inline "Key Details:" block, a
    `keyPoints`-driven list, null `keyPoints`, and the no-duplicate-list case when both are present
- File: `tests/unit/rail.test.mjs`
  - Added failing tests for `computeRails()` (owner-selected option-a article-relative rail:
    "more" = same-category neighbours published before the article, "second" = site-wide
    neighbours published before the article, heading "Earlier", oldest article gets empty arrays)
  - Added failing tests for `railFingerprint()` (identical for identical inputs; changes when a
    neighbour's title/slug/category/uuid changes)

## Why

Phase 4 Plan 04, Task 2 (tdd="true"): standfirst split, safe summary body and rail selection must
be pure, tested modules before the article template (Task 3) consumes them. This is the RED half
of the RED/GREEN pair — `src/lib/summary.ts` and `src/lib/rail.ts` do not exist yet, so both test
files fail with `ERR_MODULE_NOT_FOUND` (confirmed via `node --test`).

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: nothing yet runs green — this commit is the RED confirmation only.
- What wasn't tested: the GREEN implementation (next commit).
- Edge cases: AP-style abbreviation non-breaking ("Dr.", "St.", "a.m."/"p.m.", "Sept.", "No."),
  one-sentence summaries, empty/whitespace input, tie-broken sort order (publishedAt desc, uuid
  asc), single-article categories, custom moreCount/secondCount.

## Next Steps

- [ ] Implement `src/lib/summary.ts` and `src/lib/rail.ts` to make these tests pass (GREEN)
- [ ] Port the full article template (Task 3) consuming both modules

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-only commit, no production code changed

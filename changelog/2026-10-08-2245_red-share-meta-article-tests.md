# 2026-10-08 - RED: failing tests for the article:* tag branch of shareMetaTags

**Keywords:** [TESTING] [FRONTEND]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2245_red-share-meta-article-tests.md`

## What Changed

- File: `tests/unit/share-meta.test.mjs`
  - Added seven tests for the article branch: key order (article:* between og:image:alt and twitter:card), literal values, Spanish author URL, section and tag omission, whitespace-tag skipping in input order, publishedIso validation, and the no-article case staying `website`
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-04 (SOC-03) adds the article-only Open Graph tags. The tests come first so the builder change is driven by pinned expectations: both times equal one value, the author is the site's own /about URL, and bad dates throw.

## Issues Encountered

No major issues encountered. Run against the 07-03 builder, 6 of 19 tests fail as intended.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `node --test tests/unit/share-meta.test.mjs` fails on the six new article tests
- What wasn't tested: rendering through Base.astro (next task)
- Edge cases: empty and whitespace section, empty tag list, offset-less and unparseable dates

## Next Steps

- [ ] GREEN: article branch in `src/lib/share-meta.ts`
- [ ] Base.astro `article` prop and the two article templates

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tests only

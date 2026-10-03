# 2026-10-02 - robots.txt tests follow the PerplexityBot policy change

**Keywords:** [TESTING] [SEO] [FIX]
**Session:** Evening, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2010_robots-tests-follow-perplexity-policy.md`

## What Changed

- File: `tests/fixtures/v1-robots.txt`
  - Same edit as `public/robots.txt` in the earlier commit: PerplexityBot moved from the
    AI-training block to the allowed AI-assistant section; Perplexity-User added
- File: `tests/unit/seo-surfaces.test.mjs`
  - Header comment records the 2026-10-02 owner decision as the one deliberate divergence
    from the v1 route's body
  - PerplexityBot dropped from the "must be disallowed" loop; new assertion that
    PerplexityBot and Perplexity-User are allowed
- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md`
  - Marked the robots.txt test-failure item resolved

## Why

The PerplexityBot commit changed `public/robots.txt` without updating the line-for-line
fixture or the per-bot assertion, breaking two `seo-surfaces` tests. 05-21's full-suite
re-run caught it and recorded it as out of scope; this closes it.

## Issues Encountered

The PerplexityBot commit was made without running the test suite; the dist-output tests
read `dist/client/robots.txt`, which was refreshed by copying `public/robots.txt` (what the
Astro build does for static files) rather than a full rebuild.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/seo-surfaces.test.mjs` 5/5; `pnpm run test:fast` 738/738
- What wasn't tested: no full `pnpm run build`
- Edge cases: n/a

## Next Steps

- [ ] None

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - test/fixture alignment with an owner-approved policy change

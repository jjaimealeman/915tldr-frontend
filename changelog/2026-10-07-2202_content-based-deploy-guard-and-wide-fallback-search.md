# 2026-10-07 - Content-based deploy guard and wide fallback-page search in live tests

**Keywords:** [TESTING] [SEO] [I18N]
**Session:** Evening, Duration (~25 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-07-2202_content-based-deploy-guard-and-wide-fallback-search.md`

## What Changed

- File: `tests/helpers/deploy-guard.mjs` (new)
  - T-04-48 guard as a pure function: `git diff` over the guarded paths instead of requiring ancestry
  - Missing deployed commit fails with a `git fetch` remedy; a non-hex ref such as "main" is reported as unknown (visible skip)
- File: `tests/helpers/live-samples.mjs` (new)
  - Deterministic stride sample and canonical-article extraction from a sitemap
- File: `tests/integration/url-shapes.test.mjs`
  - Guard test uses the helper; fallback search covers 5 RSS items plus 300 evenly spread sitemap paths and requires fallback note plus noindex
  - Search finding nothing fails with the candidate count; the dependent fallback test fails instead of skipping
  - Live tag-pair contract follows task A: `/es/tag/*` noindex with no alternates, English twin self alternates only
- File: `tests/unit/deploy-guard.test.mjs`, `tests/unit/live-samples.test.mjs` (new)
  - Throwaway temp git repo reproduces the no-ancestry merge shape
- File: `docs/phase-06/live-verification.md`
  - Task B note

## Why

Three live tests failed on 2026-10-07 for reasons that were not product defects: the deployed commit became a merge commit that is not an ancestor of the feature-branch HEAD, and the five newest RSS items are now all translated so no fallback page was found.

## Issues Encountered

- With task A committed, the guard correctly reports five guarded files that differ from the deploy, so it is red until the branch is deployed.
- The tag-pair live test is red until deploy for the same reason (old markup is live).

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1043 pass, 0 fail, 3 skipped (stale-dist gated); build-gate 9 of 9; live url-shapes against dev (GET only) 88 of 90, the 2 red are expected pre-deploy
- What wasn't tested: the "main" sub-case against a live cron-built version.json (covered by unit test only)

## Next Steps

- [ ] After deploy, re-run `node --test tests/integration/url-shapes.test.mjs` and expect 90 of 90

---

**Branch:** feature/phase-06-closeout
**Issue:** N/A
**Impact:** LOW

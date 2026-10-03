# 2026-10-02 - CR-01 fix: dry-run deploys can no longer reach archive-sync post

**Keywords:** [BUG_FIX] [BACKEND] [TESTING] [SECURITY] [DEPLOYMENT]
**Session:** Evening, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2044_05-13-task1-cr01-ci-build-dry-run-post-sync-fix.md`

## What Changed

- File: `tools/ci-build.mjs`
  - Moved `commitImpl(...)` and the entire `archive-sync post` spawn/parse/alert-queueing block inside a `!dryRun` branch in the deploy step
  - Added a dry-run branch that logs `[ci-build] dry run: skipping archive-sync post — it mutates the production bucket and this run deployed nothing` and falls through to the existing `pendingAlerts` loop (still runs for both branches)
  - Updated the deploy-step header comment to state commitLastGood AND post are both skipped entirely in a dry run (CR-01, 05-13)
- File: `tests/unit/ci-build.test.mjs`
  - Added a new section "CR-01 (05-13): a deploy that deployed nothing never reaches post-sync" with three tests: a dry run never spawns post/never calls commitImpl and logs the skip line; a dry run still delivers every pre-sync alert gathered; a failed wrangler deploy never spawns post

## Why

Code review finding CR-01 (05-REVIEW.md): a `CI_BUILD_DEPLOY_DRY_RUN=1` rehearsal deploys nothing via `wrangler deploy --dry-run`, but `tools/ci-build.mjs` was still spawning `tools/archive-sync.mjs post` unconditionally. Post-sync re-uploads "changed" archive pages from a build that was never deployed and deletes R2 copies of pages the undeployed build no longer indexes — both against the live production bucket — causing archived URLs to 404 until the next real deploy. `.wrangler/ci-dry-run/` already existed in this tree, confirming the path had been exercised. This is the ci-build half of the fix; 05-14 closes the archive-sync-side half (an independent refusal gated on the live deployment matching the build).

## Issues Encountered

No major issues encountered. The RED test ("CI_BUILD_DEPLOY_DRY_RUN=1 never spawns archive-sync post...") was run against the unfixed code first and failed exactly as expected: `AssertionError: a dry run must never spawn archive-sync post`. The other two new tests (dry-run alerts still delivered, failed-wrangler-deploy never spawns post) already passed pre-fix since those invariants were already upheld by existing code (the early `return deployResult.code` on wrangler failure, and the always-run `pendingAlerts` loop) — they're now pinned as explicit regression tests rather than only implied.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/ci-build.test.mjs` (51/51 pass, 3 new CR-01 tests), full `pnpm run test:fast` (679/679 pass)
- What wasn't tested: the real CLI path (credential-free dry run against the fixed code) — that's Task 2 of this plan
- Edge cases: dry run with pre-sync alerts present (alerts still delivered despite no post call); failed wrangler deploy (already covered by the early return, now pinned explicitly)

## Next Steps

- [ ] Task 2: exercise the real CLI once, credential-free, and document the dry-run contract in docs/phase-04/build-pipeline.md
- [ ] 05-14: add the independent archive-sync-side refusal (live-deployment match before any deletion)

---

**Branch:** feature/phase-05
**Issue:** CR-01 (05-REVIEW.md)
**Impact:** HIGH - closes a production-data-safety defect in the deploy pipeline (dry runs could delete/overwrite live R2 archive content)

# 2026-10-02 - Dry-run refusal, propagation polling, and a pre-delete liveness re-check

**Keywords:** [BUG_FIX] [SECURITY] [BACKEND] [TESTING] [DEPLOYMENT]
**Session:** Afternoon, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1510_05-14-task2-dry-run-refusal-polling-predelete-recheck.md`

## What Changed

- File: `tools/archive-sync.mjs`
  - `runPostSync` now refuses immediately when `isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN)` — checked before `checkDisabled` and before `checkLiveDeploymentFn` is ever invoked, so a direct `CI_BUILD_DEPLOY_DRY_RUN=1 node tools/archive-sync.mjs post` (bypassing 05-13's ci-build-side guard entirely) makes zero network calls and zero R2 calls.
  - `checkLiveDeployment` now polls: loops up to `attempts` times (default 6, 10s apart via an injectable `sleep`), re-fetching `/version.json` on each attempt and returning `live: true` on the first exact commit+builtAt match. `sleep(intervalMs)` is awaited between non-matching attempts only — never after the final attempt, never after a match. The returned `attempts` field reports how many fetches were actually made.
  - Before `store.deleteObjects(toDelete)` (only when there's something to delete), `runPostSync` calls `checkLiveDeploymentFn({ attempts: 1 })` one more time. If the live deployment changed during the upload phase, the delete is skipped entirely (not partial), every orphan's index entry is kept, and an alert names the skip — this run's uploads/index-adds from earlier in the same run still stand.
- File: `tests/unit/archive-sync.test.mjs`
  - New section "Task 2 (05-14)" with 5 tests: dry-run refusal before the liveness check is ever called; polling returns live:true on the first match with sleep called once per non-matching attempt; exhausting attempts never throws (rejecting fetch, non-https origin never fetched); the pre-delete re-check skips deletions but still uploads/indexes the changed key when liveness flips between the initial gate and the delete step; a non-live run at the initial gate leaves the force-full marker untouched and writes neither `archive-state.json` nor `daily-report.json`.

## Why

Closes the remaining two review findings from 05-REVIEW.md's CR-01/WR-01 root cause (05-14's Task 1 covered the initial liveness gate): (1) the initial gate alone doesn't stop a dry run that invokes `archive-sync post` directly, bypassing ci-build's own dry-run branch — the dry-run refusal is now independent of ci-build; (2) a single liveness check at the top of `runPostSync` leaves a window during the (potentially minutes-long) upload phase where a deploy could land and make the build non-live again before the destructive deletion step runs — the pre-delete re-check closes that window to one request.

## Issues Encountered

RED was captured genuinely: the 5 new tests were written against the Task-1-complete (committed) state of `tools/archive-sync.mjs`, and `node --test` failed exactly 4 of them as expected (dry-run refusal, polling, exhausted-attempts, pre-delete re-check — none of this logic existed yet). The 5th test (force-full marker preservation on a non-live run) passed immediately because Task 1's initial gate already made the store unreachable before any write — it's pinned here as an explicit regression test rather than an implied behavior. After implementing the GREEN changes, all 4 previously-failing tests pass and the 38/38 full file passes.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/archive-sync.test.mjs` (38/38 pass, 10 new tests total across both 05-14 tasks), full `pnpm run test:fast` (689/689 pass)
- What wasn't tested: the real network propagation-polling path against a live deploy in progress (would require an actual in-flight deployment to observe) — the polling loop's mechanics are proven against injected fakes
- Edge cases: a fetch that rejects mid-poll; a non-https `ARCHIVE_SYNC_LIVE_ORIGIN` (never fetched at all); liveness flipping between the initial gate and the pre-delete re-check within the same run

## Next Steps

- [ ] Task 3: document the new contract (dry-run refusal, polling, pre-delete re-check, `ARCHIVE_SYNC_LIVE_ORIGIN` and its Phase 12 cutover note) in `docs/phase-05/archive-architecture.md`
- [ ] 05-20: close CR-02 (the separate `pnpm run deploy` skipping pre-sync entirely)

---

**Branch:** feature/phase-05
**Issue:** CR-01 / WR-01 (05-REVIEW.md)
**Impact:** HIGH - closes the remaining production-data-safety window in the deploy pipeline (direct dry-run post invocation, and a deploy landing mid-upload before deletions run)

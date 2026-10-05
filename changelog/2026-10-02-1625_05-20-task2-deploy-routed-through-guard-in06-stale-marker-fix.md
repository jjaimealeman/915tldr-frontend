# 2026-10-02 - Plan 05-20 Task 2: deploy routed through the sync guard, IN-06's stale build-start marker fixed

**Keywords:** [SECURITY] [BUG_FIX] [BACKEND] [TESTING] [DEPLOYMENT] [CRITICAL]
**Session:** Afternoon, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1625_05-20-task2-deploy-routed-through-guard-in06-stale-marker-fix.md`

## What Changed

- File: `package.json`
  - `deploy` changed from `pnpm run guard:config && wrangler deploy --config wrangler.jsonc` to
    `pnpm run guard:config && node tools/ci-build.mjs deploy` — the documented manual deploy now
    runs the real archive sequence instead of skipping it entirely
  - New script `guard:archive-synced`: `node tools/assert-archive-synced.mjs`
- File: `tools/ci-build.mjs`
  - `CHECK_PATTERNS` gains `'assert-archive-synced'` so a guard refusal is correctly attributed in
    a failure notification
  - New spawn `node tools/assert-archive-synced.mjs` between the file-count gate and the
    `wranglerArgs`/wrangler spawn — a non-zero exit returns that code immediately (never reaches
    wrangler, commitImpl, or archive-sync post)
  - Deploy-step header comment updated to name the new guard step
- File: `tools/archive-sync.mjs`
  - Exported `BUILD_START_MARKER_MAX_AGE_SECONDS = 1800`
  - `getBuildStartEpochSeconds` now ignores a `.astro/ci-build-started-at` marker older than 1,800s
    or more than 60s in the future, logging one stderr line and falling back to this process's own
    start — fixes IN-06 (a standalone `ci-build deploy` previously inherited a stale marker from an
    earlier `pnpm run build`, making both deadlines look already past)
- File: `tests/unit/ci-build.test.mjs`
  - New package.json contract test (CR-02)
  - Updated the deploy-ordering test from 4 to 5 spawns (pre, assert-file-count,
    assert-archive-synced, wrangler, post)
  - New refusal test: assert-archive-synced exiting 1 aborts before wrangler/commitImpl/post,
    notifies once naming assert-archive-synced
- File: `tests/unit/archive-sync.test.mjs`
  - 3 new IN-06 tests: a 7,200s-old marker is ignored (3 entries upload instead of moving back), a
    future-dated marker is also ignored, and the existing 1,025s-old deadline tests' value is still
    honored (boundary check against the new 1,800s ceiling)

## Why

Closes the routing half of 05-REVIEW.md CR-02 (Task 1 built the marker/guard; this task makes it
load-bearing) and IN-06, which the new deploy route makes reachable for the first time — a
standalone `ci-build deploy` run locally could previously inherit a stale build-start marker left
by an earlier `pnpm run build`, making the archive-sync deadlines look already expired and causing
false moved-backs/deferrals.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: RED confirmed before GREEN (package.json contract test failed against the old
  bare-wrangler script; the ordering test failed with 4 !== 5; the refusal test failed with
  notifyCalls.length 0 !== non-zero). All 104 tests across `tests/unit/ci-build.test.mjs` and
  `tests/unit/archive-sync.test.mjs` pass after; full `pnpm run test:fast` (719/719) re-confirmed
  green.
- What wasn't tested: `pnpm run deploy` itself was never run — it now performs a real production
  deploy, forbidden in this session per the plan's own execution rules.
- Edge cases: a marker exactly at the 1,800s boundary and the existing 1,025s value (used by
  pre-existing deadline tests) are both still honored, not newly rejected.

## Next Steps

- [ ] Task 3: update `docs/phase-04/build-pipeline.md` and `docs/phase-05/archive-architecture.md`
      to describe the guarded deploy path and the 1,800s stale-marker rule

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - changes what the documented `pnpm run deploy` command actually does; a
partitioned build can no longer ship through that path without pre-sync confirmation

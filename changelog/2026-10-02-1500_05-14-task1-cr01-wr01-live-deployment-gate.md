# 2026-10-02 - archive-sync post refuses to touch R2 unless the live deployment is this build

**Keywords:** [BUG_FIX] [SECURITY] [BACKEND] [TESTING] [DEPLOYMENT]
**Session:** Afternoon, Duration (~45 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1500_05-14-task1-cr01-wr01-live-deployment-gate.md`

## What Changed

- File: `tools/archive-sync.mjs`
  - Added `export async function checkLiveDeployment({ root, env, fetchImpl, sleep, attempts, intervalMs })` — reads this build's own `dist/client/version.json`, fetches the live deployment's `/version.json` (cache-busting query string, no-cache header), and reports `live: true` only on an exact match of both `commit` AND `builtAt`. Never throws; any failure (missing/unparseable local file, unreachable origin, non-2xx, malformed body, non-https origin) folds into `live: false` with a `reason`. This task implements a single fetch attempt; polling is Task 2.
  - New exported constants: `LIVE_ORIGIN_DEFAULT` (`https://dev.915tldr.com`), `LIVE_CHECK_ATTEMPTS` (6), `LIVE_CHECK_INTERVAL_MS` (10000), `LOCAL_VERSION_PATH` (`dist/client/version.json`).
  - `runPostSync` now accepts `checkLiveDeploymentFn` and calls it after the existing `checkDisabled` early return and before `createStore(env)` — a non-live build returns immediately with zero R2 calls, `uploaded: 0`, `deleted: 0`, and one alert naming both the local and remote commit/builtAt pairs.
- File: `tests/unit/archive-sync.test.mjs`
  - New section "WR-01 / CR-01 (05-14): post refuses a build that is not live" with 5 tests: a non-live run never calls `createStore`; the WR-01 overlapping-build regression (key K — indexed, absent from this build's plan, present in this build's `dist/client` — survives a non-live run untouched in R2 and in the index, `deleteObjects` never called); a live run behaves exactly as before; `checkLiveDeployment` returns `live:true` on an exact match with the correct default URL; `checkLiveDeployment` returns `live:false` when `builtAt` differs.
  - Injected a shared `liveOk` stub (`async () => ({ live: true, ... })`) into all 13 pre-existing `runPostSync(` call sites so they keep exercising the live-build path without ever hitting the real network.

## Why

Code review findings CR-01 (second wall, after 05-13's ci-build-side fix) and WR-01 (05-REVIEW.md): post-sync decided what to delete and re-upload purely from its own local `dist/client`, never from what production actually serves. An overlapping or out-of-order build (build A's post running after build B went live) could delete a key B had legitimately archived, 404ing it until the next pre-sync re-uploaded it. The fix requires an explicit, exact match between this build's own `/version.json` and the live deployment's before any R2 mutation — commit alone isn't enough, since `builtAt` differs between a local build and the deployed build of the same commit.

## Issues Encountered

RED was captured genuinely, not simulated: after writing the new tests (which import `checkLiveDeployment`), `tools/archive-sync.mjs` was reverted to its pre-fix HEAD state with `git checkout --`, and `node --test tests/unit/archive-sync.test.mjs` failed at module load — `SyntaxError: The requested module '../../tools/archive-sync.mjs' does not provide an export named 'checkLiveDeployment'` — because the fix didn't exist yet. The GREEN implementation was then restored and all 33 tests pass (28 pre-existing + 5 new).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/archive-sync.test.mjs` (33/33 pass), full `pnpm run test:fast` (684/684 pass), and the real network path credential-free: `node --input-type=module -e "import('./tools/archive-sync.mjs').then(async (m) => console.log(JSON.stringify(await m.checkLiveDeployment({ attempts: 1 }))))"` returned `{"live":false,"local":{"commit":"c8b727b",...},"remote":{"commit":"main",...},"attempts":1,"reason":"commit/builtAt mismatch"}` — both `local` and `remote` populated, no R2 credentials loaded.
- What wasn't tested: dry-run refusal, propagation polling, and the pre-delete re-check — those are Task 2 of this plan.
- Edge cases: missing/unparseable local `version.json`; non-https `ARCHIVE_SYNC_LIVE_ORIGIN`; a fetch that throws; a response missing `commit`/`builtAt`.

## Next Steps

- [ ] Task 2: dry-run refusal before `checkDisabled`, propagation polling (up to 6 attempts, 10s apart) in `checkLiveDeployment`, and a pre-delete liveness re-check
- [ ] Task 3: document the new contract in `docs/phase-05/archive-architecture.md`
- [ ] 05-20: close CR-02 (the separate `pnpm run deploy` skipping pre-sync entirely)

---

**Branch:** feature/phase-05
**Issue:** CR-01 / WR-01 (05-REVIEW.md)
**Impact:** HIGH - closes a production-data-safety defect (overlapping/out-of-order builds could delete or overwrite live R2 archive content)

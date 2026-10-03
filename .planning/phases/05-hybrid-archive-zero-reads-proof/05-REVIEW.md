---
phase: 05-hybrid-archive-zero-reads-proof
reviewed: 2026-10-02T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - tools/archive-sync.mjs
  - tools/assert-archive-synced.mjs
  - tools/ci-build.mjs
  - tools/derive-hot-window.mjs
  - tools/load-test-zero-reads.mjs
  - tools/measure-worker-cpu-outliers.mjs
  - tools/r2-roundtrip.mjs
  - src/lib/server/r2-client.ts
  - package.json
  - tests/unit/archive-sync.test.mjs
  - tests/unit/assert-archive-synced.test.mjs
  - tests/unit/ci-build-spawn.test.mjs
  - tests/unit/ci-build.test.mjs
  - tests/unit/derive-hot-window.test.mjs
  - tests/unit/load-test-zero-reads.test.mjs
  - tests/unit/measure-worker-cpu-outliers.test.mjs
  - tests/unit/r2-client.test.mjs
  - tests/unit/seo-surfaces.test.mjs
  - tests/fixtures/v1-robots.txt
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 5: Code Review Report (Re-review after gap closure)

**Reviewed:** 2026-10-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This is a re-review of the gap-closure work (plans 05-13..05-20 plus quick task 261002-s2r) against the 3 blockers and 9 warnings recorded in the prior `05-REVIEW.md` (committed at `ce2129e`). I read every file in the diff `ce2129e..HEAD` for the listed scope, ran the full affected unit-test slice (272/272 pass, including `tests/unit/ci-build.test.mjs` in isolation at 69/69), and traced the new control flow (`checkLiveDeployment`, the dry-run early-return, `commitDailyReport`, the `assert-archive-synced` guard, the self-healing index) by hand against the specific failure modes named in the review brief: a non-deploying path mutating production R2, a silently swallowed failure, an NTFY_TOPIC/token leak into logs, and an unintended exit-code change.

**Result: all three prior blockers are fixed, correctly and with regression tests that fail against the pre-fix code.** CR-01 is now enforced at two independent layers (`ci-build.mjs` never spawns `post` after a dry run; `archive-sync.mjs post` also refuses for itself if invoked directly with `CI_BUILD_DEPLOY_DRY_RUN` set). CR-02 is closed by routing `pnpm run deploy` through `ci-build.mjs deploy` and adding `tools/assert-archive-synced.mjs` as a hard gate immediately before `wrangler deploy`. CR-03 is closed by aligning the load window to 5-minute boundaries with the same `floorToFiveMinutes`/`ceilToFiveMinutes` functions already used for baseline windows, so both sides of the statistical comparison now cover identical spans.

Of the 9 prior warnings, **WR-01, WR-02, and WR-08 are fixed** (overlapping-build deletion is now gated on a live `/version.json` match checked twice — once before any R2 call, once immediately before delete; every R2 write in `archive-sync.mjs` that could previously throw mid-run and corrupt the index is now wrapped and self-healing; `countOtherFiles` now counts both `dist/client` and `dist/archive`). **WR-03, WR-04, WR-05, WR-06, WR-07, and WR-09 remain unfixed** — this is a deliberate, recorded owner scope decision (`.planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md`), not an oversight, and none of them touch files in this diff's scope (they live in `src/worker.ts`, `src/lib/archive/*`, and `tiering.ts`, none of which changed since `ce2129e`).

I found **no new blockers**. I found one new warning (daily-report marker writes bypass the liveness gate that every other R2 write in this file passes through — currently harmless by construction, but it is an exception to an otherwise-consistent safety invariant) and two info-level nits (a `package.json` indentation slip, a minor percentile-index convention in the new CPU-outlier tool). Secret hygiene held up under direct adversarial testing: the new `ci-build.test.mjs` suite includes tests that assert no log line ever contains the raw topic or token across every delivery-outcome branch (2xx, non-2xx, rejected fetch), and I traced every new log/throw site by hand to confirm none of them embeds `NTFY_TOPIC`, `NTFY_TOKEN`, or the R2/Cloudflare credentials.

## Prior findings status

| ID | Status | Evidence |
|----|--------|----------|
| CR-01 (dry-run rehearsal still runs destructive post-sync) | **Fixed** | `ci-build.mjs:718-724`: `dryRun` branch logs and skips both `commitImpl` and the `archive-sync post` spawn entirely — `post` is only reached in the `else` branch. Independently, `archive-sync.mjs runPostSync:650-668` refuses before any credential/liveness check whenever `CI_BUILD_DEPLOY_DRY_RUN` is truthy, covering a direct manual invocation that bypasses the `ci-build.mjs`-side guard. Tests: `tests/unit/archive-sync.test.mjs:918` ("refuses before checkLiveDeploymentFn is ever called"), `tests/unit/ci-build.test.mjs` B6 ("CI_BUILD_DEPLOY_DRY_RUN=1 never spawns post or mark-daily-report"). |
| CR-02 (`pnpm run deploy` could ship an unsynced partitioned `dist/`) | **Fixed** | `package.json`: `"deploy": "pnpm run guard:config && node tools/ci-build.mjs deploy"` (previously a bare `wrangler deploy`). `ci-build.mjs:699-704` spawns `tools/assert-archive-synced.mjs` immediately before `wrangler deploy` and aborts the whole deploy on a non-zero exit. `tools/assert-archive-synced.mjs` refuses unless `dist/archive-synced.json`'s `planGeneratedAt` matches the current `archive-plan.json`'s `generatedAt`, written only by `runPreSync` after move-back completes. Tests: `tests/unit/assert-archive-synced.test.mjs` (new file, 5 documented cases). |
| CR-03 (zero-reads gate measured fewer buckets on the load side than the baseline side) | **Fixed** | `tools/load-test-zero-reads.mjs:856-884`: `alignedLoad` is computed once via `floorToFiveMinutes`/`ceilToFiveMinutes` and now feeds the ingest-slot check, the analytics catch-up poll, the `fetchD1RowsRead` call, and `comparableWindows()` — all four previously-divergent consumers now share one aligned window. Test: `tests/unit/load-test-zero-reads.test.mjs` "CR-03 (05-16): load and baseline windows are aligned identically" (passing). |
| WR-01 (post-sync deletion decided from local `dist/client`, not the live deployment) | **Fixed** | `checkLiveDeployment()` (`archive-sync.mjs:346-419`) compares this build's `dist/client/version.json` against the live origin's `/version.json` (commit AND builtAt), polling up to 6×10s. `runPostSync` refuses all R2 mutation unless `liveness.live` (line 692), and re-checks with a single attempt immediately before the delete call (line 796) to catch a deploy that landed mid-run. Tests: `tests/unit/archive-sync.test.mjs:801,847` (non-live skip), `:1029` (flaky-then-live mid-run re-check). |
| WR-02 (uncaught R2 failures could leave the index lying about what R2 holds) | **Fixed** | `mergeWriteIndex` calls in both `runPreSync` (570-578) and `runPostSync` (825-836) are now wrapped in try/catch with an alert, never an uncaught throw. `r2-client.ts deleteObjects` (243-272) no longer throws mid-batch — a rejecting batch reports every key in that batch as an `errors` entry and the loop continues; `deleted` only counts confirmed batches. Pre-sync adds an index self-heal pass (509-541) that lists real R2 keys and reclassifies any indexed-but-missing key as `new`. `main()` now has a top-level `.catch` (1066-1070). Tests: `tests/unit/r2-client.test.mjs` "a rejecting middle batch is reported as partial errors, not a throw"; multiple self-heal cases in `archive-sync.test.mjs`. |
| WR-03 (force-full re-upload restarts from zero every run) | **Not fixed — deferred** | `diffAgainstIndex` (`archive-sync.mjs:244-278`) still has no progress tracking against `forceFullMarker.requestedAt`; the `forceFull` branch is unchanged (`forceFull || existing.sha256 !== entry.sha256`). Confirmed in the owner-approved deferral todo. |
| WR-04 (no S3 client request timeout) | **Not fixed — deferred** | `r2-client.ts:167-174`'s `new S3Client({...})` still configures no `requestHandler` timeout. In scope deferral todo. |
| WR-05 (branch guard not enforced inside `createArchiveStore` itself) | **Not fixed — deferred** | `createArchiveStore` (`r2-client.ts:161-174`) still performs no branch-guard check; `wrapStoreForBranchGuard` remains purely a caller-side wrapper in `archive-sync.mjs`. `r2-roundtrip.mjs` still calls `createArchiveStore()` directly with no guard (confirmed unchanged in this diff). In scope deferral todo. |
| WR-06 (KV read failure on archived URL serves 404 instead of 503) | **Not fixed — deferred; out of this diff's file scope** | Lives in `src/worker.ts`, unchanged since `ce2129e` (`git diff --stat` confirms zero changes to `src/worker.ts`). |
| WR-07 (unguarded `cache.match()` on archive paths) | **Not fixed — deferred; out of this diff's file scope** | Same file, same confirmation as WR-06. |
| WR-08 (`derive-hot-window` cannot run against a partitioned build) | **Fixed** | `countOtherFiles(distDir, facts, archiveDir)` now sums `walkFileCount(dist/client) + walkFileCount(dist/archive)` and throws (rather than silently returning a wrong number) if the facts disagree with both trees combined (`derive-hot-window.mjs:673-706`). 5 new regression tests in `tests/unit/derive-hot-window.test.mjs` cover the partitioned, moved-back, unpartitioned, and negative-guard cases; all pass. |
| WR-09 (gate preflight/pass don't verify the archived URLs actually measured) | **Not fixed — deferred** | `decideZeroReadsVerdict` (`load-test-zero-reads.mjs:492-543`) still checks `hasD1Binding` after every validity rule (line 548, below `unconfirmedArchivedUrl` at 537), matching the original finding's described ordering exactly. In scope deferral todo. |

## New findings (this round)

### WR-10: `commitDailyReport` writes a production R2 key without passing through the liveness gate every other write in this file now requires

**File:** `tools/archive-sync.mjs:963-982`

**Issue:** Since CR-01/WR-01, every other R2-mutating path in this file (`runPostSync`'s uploads, deletions, state write, and the old inline daily-report write it replaced) is gated on `checkLiveDeployment()` confirming the live deployment matches this build. `commitDailyReport` — the new function that replaced `runPostSync`'s inline `DAILY_REPORT_KEY` write — checks only the dry-run flag and `checkDisabled` (branch guard + credentials); it never calls `checkLiveDeploymentFn`.

In the one caller that exists today (`ci-build.mjs`'s deploy-alert loop, which only reaches `mark-daily-report` synchronously after `wrangler deploy` just succeeded in this same process), this is safe by construction — there is no stale-build scenario to protect against, because the build that calls it IS the one that was just deployed. But the CLI entry point (`node tools/archive-sync.mjs mark-daily-report --date YYYY-MM-DD`) is a general-purpose, directly-invokable command with no such guarantee: run by hand (or by a stale/retried script) against an old `dist/`, it will happily mark today's daily report as sent even though no report was actually delivered for whatever build is currently live — silently suppressing the next real production deploy's daily report. This is a narrower, lower-stakes version of the exact class of bug WR-01/CR-01 exist to close (a write proceeding on the strength of "this build" when the live deployment may be a different one), left open in the one new write path this round's gap-closure work introduced.

**Fix:** Either (a) document the CLI entry point as deploy-pipeline-internal only (not a safe manual command) in the usage string and the function's own docstring, or (b) add the same liveness check used elsewhere:

```js
export async function commitDailyReport({
  date,
  env = process.env,
  createStore = defaultCreateStore,
  hasR2CredentialsFn = defaultHasR2Credentials,
  checkLiveDeploymentFn = (liveOpts) => checkLiveDeployment({ env, ...liveOpts }),
} = {}) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail('commitDailyReport requires a YYYY-MM-DD date');
  }
  if (isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN)) {
    fail('refusing daily-report marker write — CI_BUILD_DEPLOY_DRY_RUN is set (a dry run deployed nothing)');
  }
  const { disabled, reason } = await checkDisabled(env, hasR2CredentialsFn);
  if (disabled) fail(`refusing daily-report marker write — ${reason}`);
  const liveness = await checkLiveDeploymentFn({ attempts: 1 });
  if (!liveness.live) fail(`refusing daily-report marker write — live deployment is not this build (${liveness.reason})`);
  // ...
}
```

## Info

### IN-11: `package.json`'s new `guard:archive-synced` script is indented with 2 spaces inside a 4-space-indented block

**File:** `package.json:36`

**Issue:** `"guard:archive-synced": "node tools/assert-archive-synced.mjs",` is indented 2 spaces while every surrounding `scripts` entry (lines 34-53) uses 4. Valid JSON, cosmetic only, but it's the kind of diff-noise a later `git blame`/formatter pass trips over.

**Fix:** Re-indent to match (`    "guard:archive-synced": ...`).

### IN-12: `summarizeCpuOutliers`' `percentile()` uses a slightly non-standard p99 index for small samples

**File:** `tools/measure-worker-cpu-outliers.mjs:103-107`

**Issue:** `idx = Math.min(len-1, Math.ceil((p/100)*len) - 1)`. For `p=99` and `len=100`, this resolves to index 98 (the 99th-smallest of 100, i.e. the second-highest value), not index 99 (the max) — a one-off convention choice (nearest-rank vs. a max-inclusive variant) rather than a bug, but worth confirming it matches whatever definition `docs/phase-05/arch-08-cpu-outliers.md` and any human reading "p99Ms" alongside "maxMs" expect, since the two will usually differ by exactly one sample at these sizes.

**Fix:** No action required unless the written evidence doc asserts a specific percentile definition that disagrees with this one; if so, align the implementation or the doc's wording.

---

_Reviewed: 2026-10-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

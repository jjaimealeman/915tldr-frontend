# 2026-10-01 - Hot-Window Production Guard, Archive Alerts, File-Count Alarm, Daily Report

**Keywords:** [BACKEND] [DEPLOYMENT] [INFRA] [TESTING] [SECURITY] [BUG_FIX] [FEATURE]
**Session:** Early morning, Duration (~50 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0146_05-08-task2-hot-window-guard-alerts-daily-report.md`

## What Changed

- File: `tools/ci-build.mjs`
  - Production deploys (`WORKERS_CI_BRANCH === 'main'`, or any local run without `WORKERS_CI` —
    `isProductionDeploy`) now refuse to ship a `fallback-provisional` hot window (D-07b) without
    `ALLOW_FALLBACK_HOT_WINDOW=1` — checked before any spawn at all, via a new injectable
    `loadHotWindowImpl` seam (default: dynamic-imports `src/lib/archive/hot-window.ts`'s
    `loadHotWindow()`, never statically imported, matching this file's own `build-state.ts`
    convention). A non-production CI build (branch != `main`) skips the guard entirely.
  - Every archive outcome the owner must know about now reaches ntfy exactly once: `archive-sync
    pre`/`post`'s own `alerts` arrays are forwarded verbatim (failed-upload counts with "still
    serving", the disabled-tier notice, the 20h backlog alert, the deletion-cap alert);
    `assert-file-count`'s `warn` status sends a high-priority alarm naming the count against
    100,000; a `post` spawn that exits non-zero or produces no parseable result line sends one
    alert but never fails the deploy (D-10/D-12). Every alert is queued and sent AFTER the deploy
    succeeds, never gating it.
  - Added the once-a-day file-count report (REND-11): when `post`'s `dailyReport.due` is true,
    one low-priority (`bar_chart`) ntfy with `formatDailyReportBody()` — static file count vs. the
    100,000 ceiling/80,000 fail line, archived page count, hot-window status/days (spelling out
    `PROVISIONAL` when the window in force is `fallback-provisional`), and any backlog.
  - `defaultNotify`/`sendNotification` now accept optional `priority`/`tags` (defaults unchanged:
    `high`/`rotating_light`).
  - `CHECK_PATTERNS` extended with `archive-sync`, `partition-archive`, `assert-file-count`,
    `hot-window`, `tiering`, `tier-facts`, `r2-client`; `SECRET_ENV_KEYS` extended with
    `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — both now redacted/classified the same as every
    other chokepoint module.
- File: `tools/assert-file-count.mjs` **(Rule 1 bug fix, not in this plan's file list — found live)**
  - `assertFileCount()` assumed `static-budget.json` never exists yet, computing
    `count = preWriteCount + 1` unconditionally. 05-08's own Task 1 must-have ("the file-count
    gate runs again on the final `dist/client` immediately before `wrangler deploy`") runs this
    gate TWICE in the same build — the second run's `static-budget.json` already exists from the
    first, so overwriting it does not add a file, but the old code still added 1, then threw on
    its own post-write recount mismatch. Fixed: `count` is now `preWriteCount` (unchanged) when
    the budget file already existed, `preWriteCount + 1` (a new file) otherwise.
- File: `tests/unit/ci-build.test.mjs`
  - 14 new tests covering every Task 2 behavior bullet: the hot-window guard (blocked,
    `ALLOW_FALLBACK_HOT_WINDOW=1` + `PROVISIONAL` daily-report wording, skipped on non-production),
    pre/post failed-count alerts, the 20h backlog alert, the disabled-tier alert, the warn alarm,
    the fail-threshold abort, `dailyReport.due` true/false, a failed/resultless `post` spawn, the
    new `classifyFailure`/`redact` patterns.
- File: `tests/unit/file-count.test.mjs`
  - One new regression test pinning the exact live bug found above: calling `assertFileCount`
    twice against the same directory must not throw and must not change the count.

## Why

REND-11 ("reported daily and alarms before 100,000"), D-10/D-12's operational half, and D-07b's
"never ship a fallback silently" guarantee all needed to reach an actual ntfy push, not just exist
as log lines inside `archive-sync.mjs`/`assert-file-count.mjs`. The file-count gate bug would have
broken EVERY real production deploy from the moment Task 1 shipped — it was found by actually
running the full sequence live, not by code review.

## Issues Encountered

- Real bug in `tools/assert-file-count.mjs` (see above) — found on the first live end-to-end dry
  run (`CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` after a real
  `pnpm run build`), which threw `post-write recount (29937) does not equal the published
  staticFileCount (29938)`. Root-caused, pinned with a regression test (RED), fixed (GREEN),
  re-verified live: a second full dry-run deploy afterward completed cleanly end to end (exit 0),
  `wrangler deploy --dry-run` read 29,949 files and listed all three bindings
  (`RENDER_MANIFEST`/`ARCHIVE_BUCKET`/`ASSETS`) correctly.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `tests/unit/ci-build.test.mjs` (48/48), `tests/unit/file-count.test.mjs`
  (14/14), the full fast suite (668/668), `test:build-gate` (9/9). Live: two full end-to-end
  `CI_BUILD_DEPLOY_DRY_RUN=1` deploys against the real `915tldr-archive` R2 bucket — the first
  caught the file-count bug, the second (after the fix) completed cleanly in ~14s (pre found 0 new
  keys since the first run's own 30,378 uploads had already landed everything). The real archive
  index now holds exactly 30,478 entries (12,912 articles + 17,566 tags) — the full corpus,
  confirmed by reading `_meta/archive-index.json` directly off the bucket.
- Cost check (orchestrator-directed gate): the live pre-sync run performed ~30,378 R2 PUTs (Class
  A operations) plus a handful of bookkeeping writes — well inside R2's 1,000,000 free Class A
  ops/month and $0 actual cost; proceeded without pausing for owner approval per the stated
  "stays inside the free tier and under $1" threshold.
- What wasn't tested: a real (non-dry-run) `wrangler deploy` — still out of scope; 05-09 decides
  when the first real production deploy happens.

## Next Steps

- [ ] Task 3: bring `docs/phase-04/build-pipeline.md`, `docs/phase-04/workers-builds-setup.md`,
      and `docs/phase-03/render-step-location.md` in line with what actually ships.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - completes the owner-facing alerting/reporting half of the archive pipeline, and
fixes a bug that would have broken every real production deploy

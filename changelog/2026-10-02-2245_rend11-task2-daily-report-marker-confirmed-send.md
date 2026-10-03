# 2026-10-02 - daily-report marker written only after a confirmed send (REND-11 follow-up, Task 2)

**Keywords:** [TESTING] [MONITORING] [BUG_FIX] [BACKEND] [DATABASE]
**Session:** Evening, ~40 min
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2245_rend11-task2-daily-report-marker-confirmed-send.md`

## What Changed

- File: `tools/archive-sync.mjs`
  - `runPostSync`'s daily-report block no longer writes `_meta/daily-report.json` itself. A missing, unreadable, or stale marker now returns `dailyReport: { due: true, date: <America/Denver YYYY-MM-DD>, body: {...} }`; otherwise `{ due: false }`.
  - New exported `commitDailyReport({ date, env, createStore, hasR2CredentialsFn })` — the only remaining code path that writes `DAILY_REPORT_KEY`. Refuses, before any store is created, in four cases: `CI_BUILD_DEPLOY_DRY_RUN` set, a non-main `WORKERS_CI` branch, missing R2 credentials, or a malformed `date`. Writes go through the existing `wrapStoreForBranchGuard`.
  - New CLI subcommand `mark-daily-report --date YYYY-MM-DD` wired to `commitDailyReport`.
- File: `tools/ci-build.mjs`
  - The daily-report alert now carries `dailyReportDate` only when `post`'s reported date is a valid `YYYY-MM-DD` string; an invalid/missing date still sends the report but logs that no marker can be written.
  - The deploy alert loop now uses `sendNotification`'s `delivered` boolean (Task 1): a confirmed 2xx for the daily-report alert spawns `node tools/archive-sync.mjs mark-daily-report --date <date>` and logs the outcome (`marker set to <date>` on success, `marker not written (exit <code>) — ...` on a non-zero exit or thrown spawn); a not-delivered send logs `marker left unchanged` and never spawns the marker write.
- File: `tests/unit/archive-sync.test.mjs`
  - Replaced the old "exactly once per America/Denver calendar date" test with one asserting two consecutive `post` runs are BOTH `due:true` (no commit in between), then `commitDailyReport` makes a third run `due:false`.
  - Replaced the old "a putJson rejection ... is an alert" test with one asserting a `getJson` rejection is simply treated as "marker absent" (no alert — there's no longer a write to fail).
  - New tests for `commitDailyReport`'s happy path and all four before-createStore refusal cases.
- File: `tests/unit/ci-build.test.mjs`
  - `fakeDeploySpawnImpl` extended with an optional `markResult` and an `events` array for ordering assertions.
  - Six new tests (B1-B6): a confirmed send spawns `mark-daily-report` exactly once after the notify call; a thrown notify never spawns it; the REND-11 regression itself (no notifyImpl, a 429 fetch) never spawns it; a failing marker spawn logs the reason without changing `runCi`'s return code; a missing report date still sends the report but never spawns the marker write; a dry run never spawns `post` or the marker write even with a due:true-shaped fake.
- File: `docs/phase-05/archive-architecture.md`
  - Updated the `_meta/daily-report.json` comment to describe the new confirmed-send handoff.

## Why

Task 1 (same quick plan, 261002-s2r) made a rejected ntfy send observable. This task closes the other half of the REND-11 gap diagnosed in `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`: the marker was previously written BEFORE the send was attempted, so a lost send still silently consumed the day — the marker already read `2026-10-02` even though nothing arrived. Moving the write to after a confirmed 2xx means a lost send is retried on the next deploy instead of lost.

## Issues Encountered

No major issues encountered. The two archive-sync tests this task's behavior spec explicitly named for rewrite ("exactly once per calendar date" and "a putJson rejection is an alert") were replaced rather than deleted, preserving their original intent under the new mechanism.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full archive-sync/ci-build daily-report lifecycle via fakes — due:true/false transitions across repeated `post` runs, `commitDailyReport`'s four refusal cases (verified via a `createStore` call-counting spy to prove zero store creation), and all six ci-build-side delivery/marker-spawn scenarios (confirmed send, rejected notify, non-2xx fetch, failing marker spawn, missing date, dry run).
- What wasn't tested: a real production ntfy send or a real R2 write (explicitly out of scope — fakes only).
- Edge cases: malformed dates (`2026-10-2`, empty string, `undefined`, with a time component) are all refused before `createStore` is ever called, matching the plan's strict `^\d{4}-\d{2}-\d{2}$` validation.

## Next Steps

- [ ] Task 3: suppress the ~60k-line per-page build listing so the deploy step's output (including both tasks' new log lines) survives in the Workers Builds log

---

**Branch:** feature/phase-05
**Issue:** REND-11 follow-up (`.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`)
**Impact:** MEDIUM - closes the "lost send consumes the day" gap; no production behavior change until the next deploy's log is read

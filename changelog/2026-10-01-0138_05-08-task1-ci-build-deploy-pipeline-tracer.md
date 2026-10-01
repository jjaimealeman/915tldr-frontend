# 2026-10-01 - Archive Tier Wired Into the Real Deploy Pipeline (Tracer)

**Keywords:** [BACKEND] [DEPLOYMENT] [INFRA] [TESTING] [FEATURE]
**Session:** Early morning, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0138_05-08-task1-ci-build-deploy-pipeline-tracer.md`

## What Changed

- File: `tools/ci-build.mjs`
  - Build step now writes `.astro/ci-build-started-at` (epoch seconds, via an injectable
    `markBuildStart` seam) before spawning `pnpm run build` — both of `tools/archive-sync.mjs`'s
    deadlines (pre: 840s, post: 1020s) measure from this file's contents.
  - Deploy step's real sequence is now: `node tools/archive-sync.mjs pre` -> `node
    tools/assert-file-count.mjs` (re-run on the FINAL `dist/client`, after pre may have moved
    pages back into it) -> `wrangler deploy` (or, with `CI_BUILD_DEPLOY_DRY_RUN=1`, `wrangler
    deploy --dry-run --config wrangler.jsonc --outdir .wrangler/ci-dry-run`) -> `commitImpl`
    (skipped entirely in a dry run — no real deploy happened to commit against) -> `node
    tools/archive-sync.mjs post`.
  - Added `parseArchiveSyncResult(tail)` (exported) — parses the `ARCHIVE_SYNC_RESULT ` JSON
    line out of a spawned archive-sync run's output tail; returns `null` (never throws) on a
    missing or malformed line.
  - Added `parseLastJsonLine(tail)` (internal) — same idea for `assert-file-count.mjs --json`'s
    plain JSON output line, for the next task's warn-alarm wiring.
  - `archive-sync pre` or the file-count gate exiting non-zero aborts the whole deploy before
    `wrangler`/`commitImpl` ever runs, with one failure notification naming the failing phase
    (`archive-sync: ...` / `assert-file-count: ...`).
  - `archive-sync post` never fails the deploy, even on a non-zero exit or an unparseable result
    line — the real deploy has already succeeded by the time post runs (D-10/D-12); it logs
    instead of failing.
- File: `tests/unit/ci-build.test.mjs`
  - 10 new tests: `parseArchiveSyncResult`'s parse/null-on-missing/null-on-malformed/null-on-empty
    cases, the deploy step's real spawn order (archive-sync pre -> assert-file-count -> wrangler
    deploy -> commitImpl -> archive-sync post), the `CI_BUILD_DEPLOY_DRY_RUN=1` dry-run args and
    skipped commit, `archive-sync pre` exiting 1 aborting before wrangler/commit with exactly one
    notification naming archive-sync, and `markBuildStart` being called before the build spawn
    for both `step=build` and `step=all`.
  - All pre-existing tests (04-09/04-10's own suite) pass unmodified — a `loadHotWindowImpl`
    stub was added to the handful of deploy/all tests that don't care about the hot-window guard
    (Task 2's own work), so they stay hermetic ahead of that guard landing.

## Why

REND-11/D-10/D-12/REND-07/REND-12 need the archive tier actually wired into the deploy path that
ships the site, not just proven live in isolation (05-07 proved `archive-sync.mjs` against the
real R2 bucket, but nothing called it from `tools/ci-build.mjs` yet). This task is the tracer: the
real spawn sequence, proven end-to-end against a real build and a real (dry-run) deploy, before
the next task layers the hot-window production guard and the full ntfy alert/daily-report system
on top of this sequence.

## Issues Encountered

None — the sequence matched the plan's own spec exactly; no deviation needed.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full unit suite (34/34 in `ci-build.test.mjs`, 653/653 across
  `pnpm run test:fast`) plus a real end-to-end run: `pnpm run build` (60,397 pages; 12,912
  articles + 17,566 tags archived, 29,937 static files) followed by
  `CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` against the real `915tldr-archive` R2
  bucket and a real `wrangler deploy --dry-run`.
- What wasn't tested: a real (non-dry-run) `wrangler deploy` — out of scope for this plan (05-09
  decides how and when the first real production deploy happens).
- Edge cases: archive-sync pre's own non-zero exit path (plan missing/invalid) is covered by
  05-07's own suite; this task's new tests cover the WRAPPER's reaction to that exit code, not
  archive-sync's internal logic again.

## Next Steps

- [ ] Task 2: hot-window production guard, ntfy alerts for failed/backlog/disabled archive
      outcomes, the 70,000 file-count alarm, and the once-daily file-count report.
- [ ] Task 3: bring the Phase 3/4 pipeline docs in line with what actually ships.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - wires the archive tier into the real production deploy path for the first time

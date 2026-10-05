# 2026-10-02 - Plan 05-20 Task 1: archive-sync writes a sync marker, new guard refuses an unconfirmed partitioned build

**Keywords:** [SECURITY] [TESTING] [CRITICAL] [ENHANCEMENT]
**Session:** Afternoon, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1556_05-20-task1-cr02-sync-marker-and-guard.md`

## What Changed

- File: `tools/archive-sync.mjs`
  - Exported `ARCHIVE_SYNCED_MARKER_PATH = 'dist/archive-synced.json'`
  - Added `writeSyncedMarker(root, plan)`, writing `{ planGeneratedAt, syncedAt, phase: 'pre' }`
  - Called it immediately before every `exitCode: 0` return of `runPreSync` (success, disabled,
    index-unreadable) — never on the plan-missing `exitCode: 1` path
  - Updated `runPreSync`'s docstring to name the marker and what it vouches for
- File: `tools/assert-archive-synced.mjs` (new)
  - Exports `assertArchiveSynced({ root })` implementing 5 cases: no plan + no archive files -> ok;
    no plan + stray archive file(s) -> refuse, naming up to 5 of them; plan present + marker
    missing -> refuse ("archive-sync pre has not run for this build"); marker `planGeneratedAt`
    mismatch -> refuse ("stale"); matching marker -> ok
  - CLI prints `[assert-archive-synced] ok: <reason>` and exits 0, or prints the message (prefixed
    `assert-archive-synced:`) and exits 1
- File: `tests/unit/assert-archive-synced.test.mjs` (new)
  - 9 tests: the 5 cases above, plus an end-to-end pair against `runPreSync` (guard refuses before
    pre runs, passes immediately after; the plan-missing path never writes a marker)
- File: `tests/unit/archive-sync.test.mjs`
  - New "CR-02 (05-20)" section (5 tests): marker written and keyed to the real plan's
    `generatedAt` on the success/disabled/index-unreadable paths, never written on the
    plan-missing path, never written under `dist/client`

## Why

Closes 05-REVIEW.md CR-02's underlying gap: `pnpm run build` always partitions archive-tier pages
out of `dist/client`, but only `archive-sync pre` (inside `tools/ci-build.mjs`'s deploy step)
uploads them to R2 or moves them back. Until now, nothing stopped a partitioned `dist/` from being
deployed without pre ever having run — every page that crossed the hot cutoff since the last CI
sync would ship as neither static nor in R2, a 404. This task builds the proof mechanism (the
marker) and the guard that reads it; Task 2 wires the guard into the actual deploy path.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: RED confirmed before GREEN — both test files failed with module/export errors
  (`ARCHIVE_SYNCED_MARKER_PATH` not exported from `archive-sync.mjs`, `tools/assert-archive-
  synced.mjs` did not exist) before implementation; all 56 tests across both files pass after
  (`node --test tests/unit/assert-archive-synced.test.mjs tests/unit/archive-sync.test.mjs`)
- Proven on the real repo tree, which happened to already be in the exact CR-02 state (partitioned
  by an earlier `pnpm run build`, no marker because this task introduces the marker):
  `node tools/assert-archive-synced.mjs` exits 1 with `assert-archive-synced: dist/ was partitioned
  but archive-sync pre has not run for this build — deploy with \`pnpm run deploy\` (tools/ci-
  build.mjs deploy), never a bare wrangler deploy`
- What wasn't tested: the guard is not yet wired into `pnpm run deploy` or `tools/ci-build.mjs` —
  that's Task 2. This commit only builds and proves the marker/guard mechanism in isolation.
- Edge cases: unparseable plan/marker JSON treated as a refusal (never trusted as "synced"); stray
  archive files with no plan present also refused

## Next Steps

- [ ] Task 2: route `pnpm run deploy` through `tools/ci-build.mjs deploy`, spawn the guard between
      the file-count gate and `wrangler deploy`, fix IN-06's stale build-start marker
- [ ] Task 3: update `docs/phase-04/build-pipeline.md` and `docs/phase-05/archive-architecture.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new guard mechanism built and proven standalone; not yet load-bearing in the
deploy path (Task 2 wires it in)

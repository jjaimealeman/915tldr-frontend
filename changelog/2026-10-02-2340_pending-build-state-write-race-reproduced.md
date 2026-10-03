# 2026-10-02 - Pending Build-State Write Race Reproduced (RED)

**Keywords:** [TEST] [BUGFIX] [BUILD]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2340_pending-build-state-write-race-reproduced.md`

## What Changed

- File: `tests/unit/build-state.test.mjs`
  - Added T1-T8, a new section reproducing the 2026-10-02 pending build-state write race
    (`build-state: failed to read pending build state: Unexpected non-whitespace character
    after JSON at position 1867519`) against the real filesystem in the existing tmp-cwd
    harness.
  - T1 (lost update) and T2 (the exact observed corruption signature — a shorter concurrent
    write landing over a longer seeded state) both fail deterministically against the current
    unlocked read-merge-write `writePendingBuildState`.
  - T4 (read-your-writes) and T5 (atomic replace — inode changes, no stray temp file) also fail
    deterministically.
  - T6 (no torn reads during a ~3MB in-flight write) failed in this run too, consistent with
    the same underlying race.
  - T3 (FIFO order), T7 (queue recovers after a rejection) and T8 (a corrupt file is never
    treated as empty) already pass — they pin the contract that must continue to hold once the
    fix lands.

## Why

This is the RED half of a TDD cycle (quick task 261002-tl2) fixing the write race that crashed
`pnpm run test:regression` on 2026-10-02. Two loaders (articles-loader.ts, changelog-loader.ts)
both call `writePendingBuildState` concurrently in one `astro build` process, and the current
implementation does an unlocked read, merge, then in-place `writeFile` — no commit code changes
in this step; the tests exist first, named to fail for the right reason, before the fix.

## Issues Encountered

No major issues encountered — the tests reproduced the race on the first run, matching the real
incident's exact failure mode (JSON.parse failing partway through a longer stale copy's tail).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: concurrent writePendingBuildState calls under various seed/race shapes,
  read-your-writes ordering, atomic-replace (inode + no stray temp file), no-torn-read polling
  during a large in-flight write, queue recovery after a rejection, and corrupt-file handling.
- What wasn't tested: the build-start reset and the real-build proof — both are quick task
  261002-tl2's Task 2.
- Edge cases: a `.astro` path that is a regular file instead of a directory (ENOTDIR), and a
  pending file corrupted with trailing garbage bytes.

## Next Steps

- [ ] Implement the GREEN fix in `src/lib/server/build-state.ts` (per-process FIFO write queue,
      atomic temp+rename replace) so T1, T2, T4, T5, T6 pass.
- [ ] Task 2: build-start reset (`tools/reset-pending-build-state.mjs`) wired into
      `pnpm run build`, proven against the real corrupt pending file via `pnpm run test:regression`.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW (test-only commit, no production code changed)

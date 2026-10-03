# 2026-10-02 - Pending Build-State Writes Serialized and Atomic (GREEN)

**Keywords:** [BUGFIX] [BUILD] [SECURITY]
**Session:** Evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2345_pending-build-state-writes-serialized-atomic.md`

## What Changed

- File: `src/lib/server/build-state.ts`
  - Added a per-process FIFO write queue, keyed on `globalThis` under
    `Symbol.for('915tldr.build-state.pending-write-queue')` so two separate module instances of
    this file in one process (Astro's Vite module runner vs. Node's native loader) still share
    one lock.
  - Reworked `writePendingBuildState` to chain every call onto that queue's tail, so concurrent
    callers in the same build never race a read-merge-write against each other.
  - Added atomic replace: every write now goes to a temp file in the same directory
    (`build-state.pending.json.<pid>-<uuid>.tmp`), then `rename`s it onto the real path — a
    reader in any process now sees either the old file or the new one, never a partial one. A
    failed write/rename best-effort unlinks the temp file and throws
    `build-state: failed to write pending build state: ...`.
  - `readPendingBuildState` and `commitLastGood` now await the queue's current tail before
    reading, so a read in the same process always observes every write issued before it.
  - `readPendingFileRaw`'s existing `build-state: failed to read pending build state: ...` error
    prefix is unchanged (so existing error-matching code keeps working); it now carries an
    operator hint that a corrupt file mid-build means something outside this module wrote it.
    A corrupt file is still never treated as empty.
  - Exported `PENDING_TEMP_PREFIX` / `PENDING_TEMP_SUFFIX` constants so the upcoming
    build-start reset tool (quick 261002-tl2 Task 2) can clean up a stray temp file left by a
    crashed build using the exact same naming convention.

## Why

Fixes the pending build-state write race that crashed `pnpm run test:regression` on
2026-10-02 (`build-state: failed to read pending build state: Unexpected non-whitespace
character after JSON at position 1867519`). Two loaders (articles-loader.ts,
changelog-loader.ts) call `writePendingBuildState` concurrently in one `astro build` process;
the previous unlocked read-merge-write let a shorter write physically land over a longer one,
corrupting the file — and, in the silent failure mode, could let a stale section be recorded as
the D-14 never-shrink baseline in KV with nothing flagging it. GREEN half of a TDD cycle — all
8 tests (T1-T8) added in the prior RED commit now pass.

## Issues Encountered

No major issues encountered. All 23 tests in `tests/unit/build-state.test.mjs` pass, including
the two pre-existing `commitLastGood` tests, unchanged.

## Dependencies

No dependencies added (uses only `node:fs/promises` and `node:crypto`, already available).

## Testing Notes

- What was tested: `node --test tests/unit/build-state.test.mjs` — 23/23 pass, including T1-T8.
- What wasn't tested: the build-start reset and the real-build proof against the actual corrupt
  `.astro/build-state.pending.json` — both are this quick task's Task 2.
- Edge cases: already covered by T1-T8 (concurrent writes, read-your-writes, atomic replace,
  no torn reads, queue recovery after a rejection, corrupt-file handling).

## Next Steps

- [ ] Task 2: build-start reset (`tools/reset-pending-build-state.mjs`), wired as the first step
      of `pnpm run build`, proven against the real corrupt pending file via
      `pnpm run test:regression`.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH (fixes a real data-corruption race in the build pipeline's state file, which
feeds the D-14 never-shrink KV baseline)

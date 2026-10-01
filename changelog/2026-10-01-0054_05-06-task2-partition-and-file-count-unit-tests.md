# 2026-10-01 - Unit tests pinning the file-count gate boundaries and the partition's path safety

**Keywords:** [TESTING] [BACKEND] [SECURITY]
**Session:** Late night, Duration (~20m)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0054_05-06-task2-partition-and-file-count-unit-tests.md`

## What Changed

- File: `tests/unit/file-count.test.mjs` (new)
  - Pins `evaluateFileCount` at the literal boundary inputs 69999/70000/79999/80000/0, each with
    the expected `ok`/`warn`/`fail` status (the 0 case asserts the exact "zero files counted —
    broken check" reason)
  - `countStaticFiles` over a temp nested tree with dotfiles and empty directories
  - `assertFileCount` proves `staticFileCount` includes `static-budget.json` itself and matches
    the post-write recount, throws on a forced concurrent-write mismatch (new `afterWriteForTest`
    test seam added to `tools/assert-file-count.mjs`), and passes `archivedPages`/`hotWindow`
    through unchanged
- File: `tests/unit/partition-archive.test.mjs` (new)
  - `planPartition`: an article published exactly at the cutoff is hot, one second older is
    archive; a 9-article tag is archive, a 10-article tag is hot (D-08 inclusive at 10); the
    article/tag key/path/sourceRel shapes; throws on a malformed hot window
  - `applyPartition`: moves files byte-identically (sha256 before == after) against a real temp
    `dist/client`, writes a plan matching the moved files, leaves hot files untouched; throws
    `partition-archive:` on a missing planned source file and on a source or destination path
    that would resolve outside `dist/client`/`dist/archive` (T-05-22)
  - `cleanPartitionInputs`: removes stale facts/archive/plan, is a no-op when all are absent

`tools/assert-file-count.mjs`'s `afterWriteForTest` test-only seam (the hook the forced-mismatch
test above uses) was already added in the prior commit, alongside Task 1's own implementation —
not a change in this commit's diff.

## Why

Task 1's tracer proved the real build end to end; this task pins the gate's exact numeric
boundaries and the partition's path-safety discipline with temp-directory unit tests, so a future
change to either threshold or to the path-resolution logic fails a fast, deterministic test
instead of only being caught by a slow full build (or not at all).

## Issues Encountered

**Disclosed TDD-process deviation:** Task 1's tracer already required a working, live-proved
implementation of both tools before this task started (matching 05-02/05-04/05-05's own disclosed
precedent) — so this task's tests were written against an already-complete implementation rather
than genuinely driving a RED-then-GREEN cycle. All new tests in this commit passed on first run
with zero implementation changes.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/partition-archive.test.mjs tests/unit/file-count.test.mjs`
  — 23 tests, all passing; `pnpm run test:fast` (608/608) also passes with these two files included.
- What wasn't tested: real filesystem concurrency (two real processes writing to dist/client at
  once) — the forced-mismatch test uses the `afterWriteForTest` seam instead, which is
  deterministic but synthetic.

## Next Steps

- [ ] Task 3: update the existing dist-output tests to cover both tiers (static + archived)

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - test-only changes plus one test-seam addition to already-shipped tooling; no
production behavior change.

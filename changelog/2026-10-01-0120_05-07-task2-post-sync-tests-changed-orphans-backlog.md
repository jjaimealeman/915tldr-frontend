# 2026-10-01 - Post-sync behavior suite: changed pages, orphans, backlog, force-full, daily report

**Keywords:** [TESTING] [BACKEND] [SECURITY]
**Session:** Early morning, Duration (~45 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0120_05-07-task2-post-sync-tests-changed-orphans-backlog.md`

## What Changed

- File: `tests/unit/archive-sync.test.mjs` (new)
  - `diffAgainstIndex`: new/changed/unchanged plan-key classification, promoted-vs-vanished
    orphan classification, and the force-full promotion rule (every already-indexed plan key
    becomes "changed", even when its sha256 still matches)
  - `runPreSync`: a 2-of-10 partial upload failure (moves exactly those 2 back, records 8 in the
    index), missing credentials (disabled, moves everything back), an unreadable index (moves
    everything back, alert, exit 0), `--limit` (keys beyond the limit are moved back, never
    uploaded), and the exit-1-only-on-missing-plan contract
  - `runPostSync`: changed-key re-upload with a failed key never written to the index (the old
    sha256 is kept — the previous object is still what serves), promoted-orphan deletion
    (unconditional) vs. vanished-orphan deletion (capped at `max(50, 1% of the index)`, with an
    alert and zero deletions above the cap), a deadline-truncated run deferring every changed
    key and opening a fresh backlog, a second truncated run keeping the original `backlogSince`,
    a converging run clearing the backlog and setting `lastConvergedAt`, the 20-hour backlog
    alert, the force-full marker forcing a re-upload of unchanged shas and only clearing once the
    backlog is zero, and the daily report firing exactly once per America/Denver calendar date
  - `requestFullReupload`: writes the marker; refuses an empty or whitespace-only reason
  - The branch guard: `isR2WriteBlocked`'s truth table, `wrapStoreForBranchGuard` refusing every
    write method before the underlying store is ever called on a blocked branch (and passing
    writes through unchanged on `main` or in a local run), plus `runPreSync`-level proof that no
    R2 call happens at all when blocked, even with real credentials present (the leaked-secret
    scenario this guard exists for)
  - A result-shape round-trip test and a test asserting `r2-client.ts`'s `ARCHIVE_BUCKET_NAME`
    equals the `bucket_name` of the `ARCHIVE_BUCKET` binding in `wrangler.jsonc`

## Why

Task 2 of plan 05-07 pins every must-have behavior the post-deploy sync phase (already
implemented alongside the pre-phase in the previous commit) is required to satisfy: D-09/D-11
(touched pages update the same cycle), D-12 (partial failure keeps the old copy and alerts),
D-13-style deletion safety extended to orphan cleanup, and D-10/REND-12 (a deadline-truncated run
defers work and tracks a backlog rather than blocking the deploy or silently dropping work).

## Issues Encountered

**Real bug found by this test suite, fixed in `tools/archive-sync.mjs` before this commit** (the
fix itself landed in the prior commit, 705b049, written in the same session before that commit
was made — called out here because this test file is what caught it): the post phase removed an
index entry for every key it *attempted* to delete, regardless of whether R2's `deleteObjects`
call actually confirmed the deletion. A key that errored (object already gone, a transient R2
error, anything else) would still have its index entry dropped, meaning a real, still-existing
R2 object would silently stop being tracked and would never be retried or re-deleted. Fixed by
only dropping index entries for keys `deleteObjects` actually confirmed (excluding every key
present in the result's `errors` array) — caught before this code path was ever exercised
against the real bucket in Task 3's live run.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every must_haves/behavior bullet in 05-07-PLAN.md's Task 2, against a fake
  in-memory store (implementing the real `r2-client.ts` `ArchiveStore` surface) and real temp
  `dist/client`/`dist/archive`/`dist/archive-plan.json` fixtures — 20 new tests, all passing
- What wasn't tested here: the live post-phase run against the real R2 bucket (Task 3's job) and
  the architecture documentation (also Task 3)
- `node --test tests/unit/archive-sync.test.mjs`: 28/28 pass (including the 8 diff/branch-guard
  tests carried from Task 1's own scope). `pnpm run test:fast`: 644/644 pass.
  `pnpm run test:build-gate`: 9/9 pass (confirms `tools/archive-sync.mjs`'s dynamic import of
  `r2-client.ts` is covered by the existing D1/KV chokepoint guard with zero new guard code).

## Next Steps

- [ ] Task 3: run the live post-sync tracer against the real bucket (unchanged re-run, then a
      one-page content-change re-upload, then restore) and write
      `docs/phase-05/archive-architecture.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - test-only commit, but it found and drove the fix for a real index-safety
bug in production-bound R2 deletion logic before it ever ran live

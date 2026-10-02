# 2026-10-02 - WR-02 Task 2: deleteObjects reports partial results; every remaining post/pre R2 call made non-fatal

**Keywords:** [BUG_FIX] [BACKEND] [TESTING] [SECURITY] [CRITICAL]
**Session:** Night, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2315_05-18-task2-deleteobjects-partial-results-nonfatal-writes.md`

## What Changed

- File: `src/lib/server/r2-client.ts`
  - `deleteObjects`'s per-batch `catch` no longer throws `r2-client: deleteObjects batch failed:
    ...` — it now pushes `{ key, code: describeError(err) }` for every key in that batch and
    continues to the next batch, so a failing batch can never throw away the `deleted` count
    already confirmed by earlier batches
  - `DeleteObjectsResult` gained a doc comment stating the partial-result contract explicitly:
    never throws mid-loop past key validation; callers must only drop an index entry for a key
    absent from `errors`
- File: `tools/archive-sync.mjs`
  - `runPostSync`: `store.deleteObjects(toDelete)` is now wrapped in its own try/catch — an
    unexpected throw (defense-in-depth beyond r2-client's own fix) becomes an alert
    (`deleteObjects failed — ...; index entries kept`) instead of crashing the run
  - `runPostSync`: the `archive-state.json` `putJson` and the `daily-report.json` `putJson` are
    each wrapped in their own try/catch with a named alert; a failed daily-report write
    deliberately leaves `dailyReport.due: true` so a duplicate report later is preferred over a
    silently missed one
  - CLI: `main()`'s invocation gained a top-level `.catch` (`describeTopLevelError`, which avoids
    double-prefixing `archive-sync:` onto a message that already has it) — an unexpected throw now
    prints one clean line and sets `process.exitCode = 1` instead of an unhandled rejection
- File: `tools/r2-roundtrip.mjs`
  - After `deleteObjects([key])`, throws `r2-roundtrip: delete of <key> reported errors: ...` when
    `errors.length > 0` — this tool stays fail-loud on its own probe object even though the
    underlying client no longer throws on a failed delete
- File: `tests/unit/r2-client.test.mjs`
  - New test: a rejecting middle batch (2,500 keys, batch 2 of 3 rejects) is reported as 1,000
    partial errors with `deleted: 1500` from the two succeeding batches, never a throw; confirms
    `code` never leaks `err.message` text
- File: `tests/unit/archive-sync.test.mjs`
  - New "Task 2 (05-18)" section: a rejecting `deleteObjects` is an alert with no index entries
    removed; a rejecting `archive-state.json` write is an alert with the upload still succeeding;
    a rejecting `daily-report.json` write is an alert with `due` staying `true`; a failed
    `runPreSync` index write after 3 successful uploads is an alert naming the count with nothing
    moved back

## Why

Closes the remaining half of 05-REVIEW.md's WR-02: `deleteObjects` previously discarded the
deleted-count from any batch that completed before a later batch threw, and every other R2 write
in `runPostSync` (deletions, state, daily report) sat outside a try/catch, so any one of them
failing would crash the whole run with an unhandled rejection rather than degrade to a named
alert. Each failure mode now has a bounded, visible consequence instead of an uncaught exception.

## Issues Encountered

No major issues encountered. RED was captured for all four new archive-sync behaviors and the
r2-client partial-batch behavior by running the new tests against the pre-fix code; each failed
exactly as 05-REVIEW.md predicted (an uncaught throw propagating out of `runPostSync`/`deleteObjects`).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/r2-client.test.mjs tests/unit/archive-sync.test.mjs` —
  70/70 pass; `pnpm run test:build-gate` — 9/9 pass (r2-client stays unreachable from the Worker
  module graph); `pnpm run test:fast` — 701/701 pass across the full project suite
- What wasn't tested: no live R2 call in this commit — `tools/r2-roundtrip.mjs`'s own fail-loud
  change is exercised only by reading its logic, not by a live run against the production bucket
- Edge cases: the comment-filtered grep (`deleteObjects batch failed`) confirms the old mid-loop
  throw message is fully removed, not just unreachable

## Next Steps

- [ ] Task 3: record the four new failure-mode rows and the self-heal listing cost in
      `docs/phase-05/archive-architecture.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - closes 05-REVIEW.md's WR-02 (partial-delete + uncaught-R2-call risk)

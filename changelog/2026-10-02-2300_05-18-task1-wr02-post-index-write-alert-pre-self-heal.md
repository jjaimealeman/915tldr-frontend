# 2026-10-02 - WR-02 Task 1: post-sync index-write failures never crash the run; pre-sync self-heals

**Keywords:** [BUG_FIX] [BACKEND] [TESTING] [CRITICAL]
**Session:** Night, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2300_05-18-task1-wr02-post-index-write-alert-pre-self-heal.md`

## What Changed

- File: `tools/archive-sync.mjs`
  - `runPostSync`: the post-delete `mergeWriteIndex(store, { add, remove: actuallyDeleted })` call
    is now wrapped in try/catch. A failed write (e.g. transient R2 5xx) no longer rejects the whole
    run — it becomes a named alert (`archive-sync: index write failed after post-sync — <n>
    deletion(s) and <n> upload(s) may be missing from the index; the next pre-sync self-heals
    (<reason>)`) and the run still returns `exitCode: 0` with its state/daily-report bookkeeping
    intact.
  - `runPreSync`: once per run, right after reading the index and before `diffAgainstIndex`, lists
    R2 under `articles/` and `tags/` (`Promise.all([store.listKeys('articles/'),
    store.listKeys('tags/')])`) and builds a working copy of the index with any plan-entry key that
    the index lists but R2 does not hold removed — so `diffAgainstIndex` classifies it as `new`
    instead of `unchanged`/`changed`, and it uploads before the deploy relies on it. Pushes one
    alert naming the self-heal count. If the listing itself throws, falls back to the index-only
    diff (unchanged from before this fix) with its own alert.
  - `runPreSync`: the new-key index write (`mergeWriteIndex(store, { add, remove: [] })`) is also
    now wrapped — a failure here is an alert, not a thrown error, since those pages are already
    confirmed in R2 and safe to deploy; the next run just re-indexes them.
- File: `tests/unit/archive-sync.test.mjs`
  - `makeFakeStore` gained a `failDeleteObjects` option (used by Task 2, added here so both tasks'
    fixtures share one helper).
  - New section "WR-02 (05-18)": a single regression test spanning post-then-pre against the SAME
    fake store — key K is deleted by a post-sync run whose index write then fails (index still
    lists K), then a later pre-sync run (same store, index write now succeeding) re-uploads K as
    new via self-heal rather than trusting the stale index entry.

## Why

05-REVIEW.md's WR-02: an uncaught `mergeWriteIndex` throw in `runPostSync` could leave
`_meta/archive-index.json` claiming an object R2 no longer holds. If that key later re-entered the
archive tier, `diffAgainstIndex` would classify it as `unchanged`/`changed` (not `new`), pre-sync
would skip the upload, the deploy would remove it from static, and the Worker would 404 — a
permanent 404 if the content was unchanged. Making the post-sync write non-fatal and giving
pre-sync a self-heal pass closes the loop: even if post's bookkeeping write fails, the next deploy
cycle repairs the drift before it can become a 404.

## Issues Encountered

No major issues encountered. RED was captured by running the new test against the pre-fix code —
the uncaught `mergeWriteIndex` throw propagated out of `runPostSync` exactly as 05-REVIEW.md
described, confirmed via `node --test tests/unit/archive-sync.test.mjs`.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/archive-sync.test.mjs` — 39/39 pass, including the new
  WR-02 regression test
- What wasn't tested: the real R2 listing path (`store.listKeys`) is only exercised against the
  in-memory fake store here — Task 2's build-gate/fast-suite run and the project's existing
  `tools/r2-roundtrip.mjs` are the live-network coverage for `listKeys` itself
- Edge cases: none of the pre-existing `runPreSync` tests seed index entries without seeding the
  matching R2 object, so no existing fixtures needed adjustment for the self-heal change

## Next Steps

- [ ] Task 2: make `deleteObjects` report partial results instead of throwing mid-batch, and wrap
      every remaining post-sync R2 call (deleteObjects, archive-state write, daily-report write) as
      a non-fatal alert
- [ ] Task 3: record the four new failure modes and the self-heal listing cost in
      `docs/phase-05/archive-architecture.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - closes a permanent-404 path identified in 05-REVIEW.md (WR-02)

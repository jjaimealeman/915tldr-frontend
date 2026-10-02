# 2026-10-02 - WR-08 fix: hot-window re-derivation can count a partitioned build again

**Keywords:** [BUG_FIX] [BACKEND] [TESTING]
**Session:** Evening, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2200_05-15-task1-wr08-count-both-trees-negative-guard.md`

## What Changed

- File: `tools/derive-hot-window.mjs`
  - Imported `ARCHIVE_DIR` from `tools/partition-archive.mjs` and re-exported it as `DEFAULT_DIST_ARCHIVE`, so this tool never hardcodes a second copy of the archive-tier output path
  - `countOtherFiles(distDir, facts, archiveDir)` gained a third parameter (default `DEFAULT_DIST_ARCHIVE`): it now sums files under BOTH `dist/client` and `dist/archive` before subtracting article/tag fact counts, instead of walking `dist/client` alone
  - Added a negative-result guard: if the facts claim more pages than both trees together hold, `countOtherFiles` throws `derive-hot-window: countOtherFiles went negative (...)` naming the dist/client count, the dist/archive count, and both fact counts, instead of silently returning a negative number
  - `main()` now passes `DEFAULT_DIST_ARCHIVE` explicitly as the third argument to `countOtherFiles`
- File: `tests/unit/derive-hot-window.test.mjs`
  - Added a "countOtherFiles — WR-08 (05-15)" section: a partitioned-tree test (dist/client + dist/archive, returns 3), a moved-back-page test (one archived page moved back into dist/client, still returns 3), an unpartitioned-tree test (no dist/archive directory at all, still returns 3), a negative-guard test (bogus fact counts reject with all four numbers named), and a constant test for `DEFAULT_DIST_ARCHIVE`

## Why

Since 05-06, every `pnpm run build` + `tools/partition-archive.mjs` moves archive-tier pages OUT of `dist/client` into `dist/archive`. `countOtherFiles` kept walking `dist/client` alone, so on the current partitioned tree it computed `walk(dist/client) - all article facts - all tag facts`, undercounting by exactly the number of archived pages. Code review (05-REVIEW.md WR-08) reproduced this live as **-30,467**, and the phase verifier independently reproduced the same failure, blocking D-07b's re-derivation capability (REND-10) — any real (non-`--probe-day`) run of `derive-hot-window.mjs` threw before doing anything. Counting both trees means a page is counted exactly once no matter which tree currently holds it, including mid-move-back (archive-sync's own move-back path, or a half-finished partition).

## Issues Encountered

The RED step was an import error rather than a failing assertion: the test file imports `DEFAULT_DIST_ARCHIVE`, which does not exist at all pre-fix, so the whole suite failed to load (`SyntaxError: ... does not provide an export named 'DEFAULT_DIST_ARCHIVE'`) rather than running and failing one specific case. This is the correct RED signal for this change (the fix adds a new export the tests require) and is recorded as such rather than forcing an artificial intermediate state.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/derive-hot-window.test.mjs` (34/34 pass, 5 new WR-08 tests); full `pnpm run test:fast` (694/694 pass); the real (non-test) tree — `countOtherFiles()` against the live `dist/client` (29,867 files) + `dist/archive` (30,713 files) + tier facts (40,585 articles + 19,958 tags) now returns **37**, matching the 36-37 range measured during planning, instead of throwing a negative-integer error
- What wasn't tested: the full live re-derivation CLI path against real Cloudflare analytics — that's Task 2 of this plan
- Edge cases: an archive directory that doesn't exist at all (unpartitioned tree) still counts correctly via `walkFileCount`'s existing ENOENT-returns-0 behavior; a half-finished partition (one page moved back) is unaffected since the sum stays constant regardless of which tree holds a given page

## Next Steps

- [ ] Task 2: run the real, non-probe re-derivation end to end (preview only, no `--write`) against live Cloudflare analytics and record it in `docs/phase-05/hot-window-derivation.md`

---

**Branch:** feature/phase-05
**Issue:** WR-08 (05-REVIEW.md), REND-10 gap 3 (05-VERIFICATION.md)
**Impact:** HIGH - restores a currently-broken capability (REND-10's re-derivation path) that the phase verifier flagged as a blocking gap

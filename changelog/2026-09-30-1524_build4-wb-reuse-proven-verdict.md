# 2026-09-30 - Build 4 measured, WB_REUSE_PROVEN verdict recorded — 04-10 spike complete

**Keywords:** [DOCUMENTATION] [CI_CD] [PERFORMANCE] [DEPLOYMENT]
**Session:** Afternoon, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1524_build4-wb-reuse-proven-verdict.md`

## What Changed

- File: `docs/phase-04/build-measurements.md`
  - Recorded Build 4 (flag-on, no toggle, same tip `e95a734` as Build 3): dependencies + build
    output cache restored, D1 loader `mode=warm+sweep`, at least 34,871 of ~60,349 pages
    restored via `experimental.incrementalBuild` (confirmed in a truncated log — disclosed as a
    lower bound, not the final total), total wall time ~147s (vs. Build 3's 554s)
  - Recorded the verdict: **`WB_REUSE_PROVEN`**
  - Explained the likely reason this contradicts 04-09's local fresh-clone simulation (zero
    reuse): Workers Builds restores BOTH a dependencies cache (full `node_modules`) and a
    build-output cache (`node_modules/.astro`) from the same prior build, while 04-09's local
    simulation only copied the build-output half after running a fresh `pnpm install` — likely
    invalidating Astro's incrementalBuild cache-validity check even with the same physical
    `node_modules/.astro` contents present

## Why

This is the last measurement 04-10 Task 2 needed. Both required verdict tokens
(`WB_COLD_FITS` from Build 1, `WB_REUSE_PROVEN` from Build 4) are now on file, completing this
plan's spike. The reuse finding directly overturns the working assumption 04-09 left for 04-11
(`REUSE_WARM_ONLY`, "assume `NO_REUSE` in production until a real Workers Builds run proves
otherwise") — a real Workers Builds run has now proven otherwise, with a specific, evidence-based
explanation for why the local simulation understated it, not just a bare contradiction.

## Issues Encountered

Build 4's own build log was truncated a second time (same Workers Builds API limitation as
Build 2), cutting off before the final page-count/upload/completion lines. Total wall time was
derived from the Workers Versions API's `created_on` timestamp instead, and the 34,871
restored-page count is explicitly recorded as a lower bound, not a final total — disclosed
directly in the doc rather than presented as complete data it isn't.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: Every number traces to either a real Workers Builds log line (the restored/
  rendered page counts, cache-restore confirmations, D1 loader line) or the Workers Versions REST
  API (total wall time, cross-checked the same way as Build 2).
- What wasn't tested: A controlled, byte-level diff of the two `node_modules` trees (04-09's fresh
  install vs. Workers Builds' restored dependencies cache) that would independently confirm the
  explanation for the reuse discrepancy — recorded as the leading, evidence-grounded hypothesis,
  not an exhaustively proven root cause.
- Edge cases: Grepped the updated doc for the real Deploy Hook URL and confirmed it does not
  appear anywhere under `docs/`, `.planning/`, `src/`, `tools/`, or `changelog/`.

## Next Steps

- [ ] Revert the temporary `incrementalBuild=true` hardcode (`cc1b050`) back to the env-var seam
      (separate commit, immediately following this one)
- [ ] Write `04-10-SUMMARY.md` now that both verdict tokens are recorded
- [ ] 04-11 should treat `WB_REUSE_PROVEN` (not 04-09's local `REUSE_WARM_ONLY`) as the working
      assumption for its production decision

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - directly overturns the prior working assumption for 04-11's production
decision on `experimental.incrementalBuild`; completes this plan's core measurement objective

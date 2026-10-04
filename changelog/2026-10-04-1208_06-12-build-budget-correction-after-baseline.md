# 2026-10-04 - 06-12 Build Budget Corrected After a Same-Day Baseline

**Keywords:** [DOCUMENTATION] [PERFORMANCE] [PLANNING]

**Session:** Midday, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-1208_06-12-build-budget-correction-after-baseline.md`

## What Changed

- File: `docs/phase-06/build-budget.md`
  - Added a SUPERSEDED banner at the top and a new section 8, "Correction after same-day baseline
    (2026-10-04)". The original sections 1-7 and the original three verdict lines are kept as
    history.
  - The original `PHASE6_BUILD_DOES_NOT_FIT` / `DOES_NOT_CONVERGE_24H` verdicts rested on a stale
    Phase 4 figure: the "3.72x per-page cost increase" compared today's build against the early
    04-03 minimal template (0.71465 ms/page), and the 0.26133 local-to-Workers-Builds factor was
    built on the same wrong number. A same-machine, back-to-back baseline measured 1.18x (1.02x
    render-only), and a corrected factor of 0.74133.
  - Corrected verdicts (the last three verdict-token lines in the file):
    `PHASE6_BUILD_FITS` (projected renderEnd 643s, about 688s after the Spanish backfill, NOT yet
    measured on Workers Builds), `PHASE6_FILES_WITHIN_BUDGET` (unchanged, measured 59,572),
    `CONVERGES_24H` (DERIVED, not measured: about 19,447 objects/build, 2 builds, about 4h).
  - Recorded the only real Phase 6 render cost: 06-11's `@astrojs/sitemap` `i18n` + `chunks`
    options (commit 90fda90) make the `astro:build:done` hook super-linear (3.92s to 49.57s, 92s in
    06-12's own run, estimated about 93s after the backfill).
  - Recorded Task 3 as resolved by Jaime on 2026-10-04 with the corrected premise, and the
    follow-ups: watch real Workers Builds timings at 06-16 against 643s; fix the 06-11 sitemap
    cost later; check whether builds wrote to production KV.

## Why

The first verdict set would have blocked the Spanish backfill spend (06-13) and deploy (06-15) on a
number that turned out to be an artifact of comparing against the wrong baseline. Jaime asked for a
baseline first; this commit puts the corrected numbers next to the original ones so the history stays
readable.

## Issues Encountered

None. Docs only: no builds, no tests re-run, no source edits, no deploys. The plan's original
acceptance wording ("exactly one verdict line per family") no longer holds literally because the
superseded and current sets are both present; the file labels which set is current.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the plan's automated verdict grep still matches (6 lines: the 3 superseded, then
  the 3 current).
- What wasn't tested: HEAD has not been built on Workers Builds, the Workers Builds speed factor
  rests on one sample, and the post-backfill sitemap cost comes from a benchmark. Listed in the doc
  under section 8.4.
- Edge cases: none run; documentation only.

## Next Steps

- [ ] 06-16: compare the first real Workers Builds timings against the 643s projection.
- [ ] Follow-up (not done here): replace the `@astrojs/sitemap` i18n partner scan or precompute
  alternates.
- [ ] Jaime to check whether the 06-12 build or earlier executor builds wrote to the production
  render-manifest KV namespace.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - removes a false blocker from the Spanish backfill and deploy path and records
the real remaining risks.

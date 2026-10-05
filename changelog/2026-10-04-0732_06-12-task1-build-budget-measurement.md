# 2026-10-04 - Tracer: Measure the Full Bilingual Build Against Platform Ceilings

**Keywords:** [BACKEND] [PERFORMANCE] [DATABASE] [TESTING]

**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0732_06-12-task1-build-budget-measurement.md`

## What Changed

- File: `docs/phase-06/build-budget.md` (new)
  - Ran one real `ASTRO_INCREMENTAL_BUILD=0 pnpm run build` against the complete, current
    bilingual corpus (121,554 pages) with wall-clock stamps around every build step, captured to
    `.gsd/phase06-build.log` (untracked, never committed).
  - Computed the Workers Builds render-time projection from measured terms: Phase 4's own
    WB-measured dependencies (9s) and content-sync (206s) anchors, a newly-derived Spanish
    cold-sync estimate (~18s, from this build's own real ES loader pass scaled by REST page count,
    not row count), a newly-measured local→Workers-Builds page-generation projection (~1,235.73s),
    and this build's own measured partition step (5.14s).
  - **Finding: `PHASE6_BUILD_DOES_NOT_FIT`** — the projected render time alone (~1,474s) exceeds
    both this plan's own 1,080s DOES_NOT_FIT threshold and the platform's absolute 1,200s
    (20-minute) hard ceiling, before archive-sync re-upload or `wrangler deploy` even run. The
    driver is not just "twice as many pages" (Phase 5's own 05-10 already assumed that) — this
    build's own measurement shows each page now costs ~3.7x more local wall-clock time to render
    than Phase 4's single-language corpus did, on the exact same machine (0.71465ms/page then vs.
    2.6576ms/page now).
  - `PHASE6_FILES_WITHIN_BUDGET`: 59,572 static files measured, under the 60,000 post-Phase-6
    budget — but with much tighter headroom (428 files) than Phase 5 had projected (164).
  - `DOES_NOT_CONVERGE_24H`: a direct, mechanical consequence of the render-time failure — with
    zero seconds left in the 1,020s post-deadline window once render time is subtracted, the
    archive-sync re-upload phase (26,580 archived article pages needing re-upload once the
    Spanish backfill lands) never starts, in any number of cycles.

## Why

05-10 flagged this exact re-measurement as a precondition before Phase 6 ships ("needs a real
re-measurement before Phase 6 ships") — its own projection was a naive 2x linear scaling of Phase
4's cold-build figure, not a real measurement against today's actual bilingual code. This plan
(06-12) exists specifically to replace that projection with a real one before any backfill money
is spent (06-13) or anything is deployed (06-15).

## Issues Encountered

None — this task is read-only measurement (no code changes, no deviations). The finding itself
(DOES_NOT_FIT) is the expected kind of result this gate exists to catch, not a defect in this
task's own execution.

## Dependencies

None added.

## Testing Notes

- What was tested: a real, full production-data build (`ASTRO_INCREMENTAL_BUILD=0 pnpm run
  build`), not a synthetic or sampled estimate. The doc's own automated verify
  (`grep -E "^(PHASE6_BUILD_...|PHASE6_FILES_...|...24H)$" docs/phase-06/build-budget.md`) confirms
  all three verdict tokens are present, each on its own line.
- What wasn't tested: a second (baseline) local build of the pre-Phase-6 commit — not needed,
  since `docs/phase-04/build-measurements.md` already records the exact local-machine anchor this
  plan's formula calls for.
- Edge cases: the projection's sensitivity to its two estimated terms (`esColdSync`, `pageGenWB`)
  is explicitly checked in the doc — even a 3x error in the smaller term, or a 10% error in the
  larger one, doesn't change the verdict; `pageGenWB` alone already exceeds the hard ceiling.

## Next Steps

- [ ] Task 2 of this same plan (06-12): full-corpus hreflang/lang/link invariant tests — follow-up
  commit, not yet staged.
- [ ] Task 3 (checkpoint:decision): since not all three verdicts are green, execution stops here
  for Jaime to choose how to proceed (shorten the hot window, pause for a render-cost fix, or
  accept risk) before 06-13/06-15.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** HIGH - this is the measurement gate that decides whether Phase 6 can deploy at all on
the current render-cost profile; it blocks both the Spanish backfill spend (06-13) and the deploy
(06-15) until resolved.

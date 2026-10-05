# 2026-10-04 - Plan 06-12 Complete: Build Budget Measured and Corrected, Full-Corpus Invariants Pass

**Keywords:** [DOCUMENTATION] [PLANNING] [PERFORMANCE] [I18N] [TESTING]

**Session:** Midday, Duration (~5 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-1210_06-12-complete-build-budget-and-full-corpus-invariants.md`

## What Changed

- File: `.planning/phases/06-bilingual/06-12-SUMMARY.md` (new)
  - Plan 06-12 summary: a real 121,554-page bilingual build measured, the first
    `PHASE6_BUILD_DOES_NOT_FIT` verdict overturned by a same-day same-machine baseline (the "3.72x
    per-page cost" compared against the wrong 04-03 figure), current verdicts `PHASE6_BUILD_FITS`
    (projected 643s, not measured on Workers Builds), `PHASE6_FILES_WITHIN_BUDGET` (measured
    59,572) and `CONVERGES_24H` (derived, not measured).
  - Two full-corpus tests pass over every built page (hreflang reciprocity, lang/link containment).
  - Task 3 recorded as resolved by Jaime on 2026-10-04 with the corrected premise.
  - Follow-ups recorded: watch real Workers Builds timings at 06-16, the unfixed 06-11 sitemap
    super-linear cost, and a possible production KV write to check.

## Why

Closes plan 06-12 with an honest record, including that this plan's own first projection was wrong.

## Issues Encountered

No new issues. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited (orchestrator-owned).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: self-check only (files and commits exist; the verdict grep prints six lines).
- What wasn't tested: no builds or tests re-run in this docs-only close-out.
- Edge cases: none.

## Next Steps

- [ ] Orchestrator: update STATE.md, ROADMAP.md and requirements tracking for 06-12.
- [ ] 06-16: compare real Workers Builds timings against the 643s projection.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** LOW - documentation of a completed plan.

# 2026-09-30 - Plan 05-01 complete: tag tiering, hot window and tier facts

**Keywords:** [DOCUMENTATION] [PLANNING] [ARCHITECTURE]
**Session:** Night, Duration (~0.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2236_05-01-complete-tag-tiering-hot-window-and-tier-fac.md`

## What Changed

- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-01-SUMMARY.md`
  - Created: records the archive tier's decision layer — `tiering.ts` (D-08 tag threshold,
    hot-cutoff rules, static-count projection), `hot-window.ts`/`.json` (validated cutoff source,
    90-day bootstrap fallback until 05-05 derives it from traffic), `tier-facts.ts` (build-time
    facts emitted by the article/tag routes) and `tools/tier-report.mjs`
- File: `.planning/STATE.md`
  - Position moved to Phase 05, plan 2 of 12; stale `current_phase: 04` frontmatter corrected
- File: `.planning/ROADMAP.md`
  - Plan 05-01 progress recorded
- File: `.planning/REQUIREMENTS.md`
  - Requirement traceability updated for the plan

## Why

Closes out plan 05-01's documentation. Every later Phase 5 plan (R2 upload, Worker archive
serving, file-count budget) reads the hot/archive split this plan defines, so its decisions are
written down before they are built on.

## Issues Encountered

`gsd-tools state.advance-plan` mis-reported the phase as complete because STATE.md still said
`current_phase: 04`; corrected by hand and progress recomputed. This entry replaces a placeholder
the bash-commit changelog hook wrote when the executor committed without `/jja-commit`.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 38 unit tests across tiering, hot-window and tier-facts pass
- What wasn't tested: a full production-size build with the tier facts emitted
- Edge cases: UTC-day-floored cutoff, malformed/unflagged hot-window config rejected

## Next Steps

- [ ] 05-02: install `@aws-sdk/client-s3` (owner approval) and create the private R2 bucket
- [ ] Remove the unused `loadHotWindow`/`describeHotWindow` import in `src/pages/[category]/[slug].astro`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW

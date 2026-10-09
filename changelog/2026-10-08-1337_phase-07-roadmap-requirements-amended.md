# 2026-10-08 - Roadmap and requirements amended for the reduced Phase 7

**Keywords:** [DOCUMENTATION] [PLANNING] [SEO]
**Session:** Afternoon, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-1337_phase-07-roadmap-requirements-amended.md`

## What Changed

- File: `.planning/ROADMAP.md`
  - Phase 7 renamed "Share Cards & Head Metadata", with a new goal and four success criteria (head tags, the two static cards, icons, real-platform validation)
  - Requirements list cut to SOC-01..08; progress table and phase list renamed
- File: `.planning/REQUIREMENTS.md`
  - IMG-01..10, PERF-08..10 and A11Y-06 moved verbatim to a new "Deferred / v2.x" section with the reason; traceability rows marked Deferred
  - SOC-05, SOC-06 and SOC-08 reworded to one static card per language; Phase 7 total 22 to 8; coverage shows 124 mapped plus 14 deferred of 138

## Why

Implements D-02 and D-04 from 07-CONTEXT.md, so planning Phase 7 starts from the scope the owner chose and does not pull the cut imagery work back in.

## Issues Encountered

The "Phase totals" line in REQUIREMENTS.md sums to 123, one short of the 124 mapped, and was already one short before this change (137 against 138). Not fixed here; the cause was not traced.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: requirement counts re-checked (138 traceability rows before and after; 14 moved)
- What wasn't tested: PROJECT.md imagery Key Decisions (lines ~268-269) and STATE.md's phase name still use the old Phase 7 wording
- Edge cases: none

## Next Steps

- [ ] Annotate the superseded imagery rows in PROJECT.md and rename the phase in STATE.md
- [ ] `/gsd-plan-phase 7`

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - planning documents only

# 2026-10-02 - Plan 05-20 Task 3: pipeline and architecture docs describe the guarded deploy

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [DEPLOYMENT] [SECURITY]
**Session:** Afternoon, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1645_05-20-task3-docs-guarded-deploy-path.md`

## What Changed

- File: `docs/phase-04/build-pipeline.md`
  - Inserted the new sync guard (`node tools/assert-archive-synced.mjs`) into the DEPLOY step
    diagram, between the file-count re-run and `wrangler deploy`; renumbered the remaining steps
    (wrangler is now step 9, `commitLastGood` step 10, archive-sync post step 11)
  - Added a "Manual deploys" paragraph: `pnpm run deploy` now runs `guard:config` then
    `tools/ci-build.mjs deploy` — the same sequence as Workers Builds' own `deploy:ci`; a bare
    `wrangler deploy` remains forbidden; `pnpm run guard:archive-synced` runs the guard by hand
  - Deadlines paragraph gains the `BUILD_START_MARKER_MAX_AGE_SECONDS` (1,800s) stale-marker rule
- File: `docs/phase-05/archive-architecture.md`
  - Build sequence renumbered with the guard as step 8; new "The sync marker and guard (CR-02,
    05-20)" section describing the marker's shape, what it vouches for, and the guard's 5 cases
  - "The two invariants" section's step references updated to match the renumbering
  - Deadlines table gains `BUILD_START_MARKER_MAX_AGE_SECONDS`; new paragraph explaining the IN-06
    stale-marker rule in full
  - New failure-mode table row: "Partitioned dist/ deployed without pre-sync (CR-02, 05-20)" ->
    refused before wrangler, one failure notification, no wrangler/commitLastGood/post this run

## Why

Closes Task 3 of 05-20-PLAN.md — the last piece of 05-REVIEW.md CR-02's closure. Operators reading
either document now land on the guarded deploy path and understand both the marker/guard mechanism
and the stale build-start marker fix (IN-06), rather than a stale diagram describing the pre-fix
sequence.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `grep -c "assert-archive-synced" docs/phase-04/build-pipeline.md` (1),
  `grep -c "archive-synced.json" docs/phase-05/archive-architecture.md` (2),
  `grep -c "Manual deploys" docs/phase-04/build-pipeline.md` (1),
  `grep -c "1,800\|1800" docs/phase-05/archive-architecture.md` (5) — all meet the plan's
  acceptance thresholds. `pnpm run test:fast` re-run green (719/719).
- What wasn't tested: documentation-only change; no code paths affected.
- Edge cases: n/a

## Next Steps

- [ ] Write the plan-completion SUMMARY.md, update STATE.md/ROADMAP.md (05-20 complete)
- [ ] 05-21 remains open — owns final REQUIREMENTS.md closure for REND-07/REND-08

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - documentation only; the functional fix landed in Tasks 1-2

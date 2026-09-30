# 2026-09-30 - Revert TEMPORARY incrementalBuild=true hardcode back to env-var seam

**Keywords:** [CONFIG] [CI_CD]
**Session:** Afternoon, Duration (~2 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1527_revert-temp-incremental-build-hardcode.md`

## What Changed

- File: `astro.config.mjs`
  - `experimental.incrementalBuild` reverted from a hardcoded `true` (commit `cc1b050`) back to
    `process.env.ASTRO_INCREMENTAL_BUILD === '1'` — the original 04-09 seam, default off

## Why

`cc1b050`'s temporary hardcode existed only to let 04-10 Task 2's Workers Builds reuse spike run
two flag-on builds (Build 3, Build 4) against a real Workers Builds container. Both builds
completed and `WB_REUSE_PROVEN` is now recorded in `docs/phase-04/build-measurements.md`, so the
temporary change is no longer needed and is reverted per the commit's own stated plan.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node tools/check-config-guards.mjs` (no violations);
  `node --test tests/unit/astro-config.test.mjs` (18/18 pass).
- What wasn't tested: N/A — single-line revert to a previously-working state.
- Edge cases: N/A.

## Next Steps

- [ ] Owner pushes this commit (and `cc1b050`, and every other commit from this 04-10 session)
      to GitHub whenever convenient — not required for this plan to be complete, only for
      Workers Builds to reflect the reverted state on its next real build

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - reverts a single-line temporary spike change back to its prior default-off state

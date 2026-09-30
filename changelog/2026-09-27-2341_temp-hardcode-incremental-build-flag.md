# 2026-09-27 - TEMPORARY: hardcode incrementalBuild=true for the 04-10 Workers Builds reuse spike

**Keywords:** [CONFIG] [CI_CD] [DEPLOYMENT]
**Session:** Late evening, Duration (~5 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-2341_temp-hardcode-incremental-build-flag.md`

## What Changed

- File: `astro.config.mjs`
  - `experimental.incrementalBuild` temporarily hardcoded to `true`, replacing the
    `process.env.ASTRO_INCREMENTAL_BUILD === '1'` seam (04-09) for this spike only

## Why

04-10 Task 2's remaining must-have is measuring whether `experimental.incrementalBuild` reuses
pages on a REAL Workers Builds container (`WB_REUSE_PROVEN`/`WB_REUSE_ABSENT`), refuting or
confirming 04-09's local `REUSE_WARM_ONLY` finding. The intended mechanism was the
`ASTRO_INCREMENTAL_BUILD` Cloudflare dashboard build variable, scoped to `feature/phase-04` only
(per `docs/phase-04/workers-builds-setup.md`) — but setting up the real dashboard in 04-10 Task 1
found that this account's build variables are **not branch-scoped**: there is one variable list
for the whole Worker, applied to every branch. Setting `ASTRO_INCREMENTAL_BUILD=1` there would
also reach `main`, silently changing production build behavior ahead of 04-11's decision — exactly
what the setup doc's own scoping note was written to prevent.

This commit is the alternative the checkpoint context named: hardcode the flag directly in code,
on `feature/phase-04` only, for exactly as long as it takes to run the two spike builds this
measurement needs (a first, expected-cold toggle build, then an immediate no-toggle follow-up that
tests real page-reuse in a genuinely fresh Workers Builds container — mirroring 04-09's local
fresh-clone CI simulation, but on the real platform).

**This commit is temporary and must not be merged to `main` as-is.** A follow-up commit reverts
`astro.config.mjs` back to the env-var seam immediately after the two spike builds complete; see
`docs/phase-04/build-measurements.md`'s "Workers Builds spike" section for the measured result and
the revert commit's hash.

## Issues Encountered

No major issues encountered — this is a deliberate, disclosed, temporary deviation from the
setup doc's original plan (branch-scoped dashboard variable), necessitated by a real platform
constraint (build variables aren't branch-scoped on this account) discovered during Task 1.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node tools/check-config-guards.mjs` (no violations);
  `node --test tests/unit/astro-config.test.mjs` (18/18 pass — none of these tests assert a
  specific value for `incrementalBuild`, only its presence/shape, so this change doesn't break
  them).
- What wasn't tested: The actual reuse behavior this commit exists to measure — that happens once
  Workers Builds runs against this commit's pushed tip.
- Edge cases: N/A — this is a one-line experimental-flag toggle.

## Next Steps

- [ ] Owner pushes this commit's `feature/phase-04` tip (or the owner sets a scoped equivalent),
      then two Deploy Hook-triggered builds run against it
- [ ] A follow-up commit reverts this hardcode back to the `ASTRO_INCREMENTAL_BUILD` env-var seam
      immediately after
- [ ] Record `WB_REUSE_PROVEN`/`WB_REUSE_ABSENT` in `docs/phase-04/build-measurements.md`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - single experimental-flag toggle, clearly marked temporary, not deployed to
production (this branch never auto-deploys `main`), reverted immediately after use

# 2026-10-02 - REND-10's re-derivation capability proven live, preview only

**Keywords:** [DOCUMENTATION] [TESTING] [ARCHITECTURE]
**Session:** Evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2215_05-15-task2-live-rederivation-preview-proven.md`

## What Changed

- File: `docs/phase-05/hot-window-derivation.md`
  - Appended a "Re-derivation capability (05-15, 2026-10-02)" section: the WR-08 bug and its fix
    (Task 1), the measured `otherFiles` (37, up from the original derivation's 36), the exact
    command run, the full preview result (202 days, capped, 78.6% achieved coverage at 202 days
    vs. 95.2% at the uncapped 261-day cutoff), and the verbatim not-written statement
- File: `docs/phase-05/evidence/hot-window-rederive-20261002/` (new)
  - 30 `day-YYYY-MM-DD.json` files from the live preview run (2026-09-02 through 2026-10-01), one
    per UTC day queried

## Why

05-REVIEW's WR-08 and 05-VERIFICATION's gap 3 both flagged D-07b's re-derivation capability as
currently broken — Task 1 of this plan fixed the underlying bug (`countOtherFiles` undercounting
on a partitioned build); this task proves the fix end to end against live data, not just in unit
tests. The real, non-probe path (`node tools/derive-hot-window.mjs --json --evidence ...`, no
`--write`) now runs to completion, confirms the live Cloudflare GraphQL schema, counts
`otherFiles` via the Task 1 fix, fetches 30 full UTC days of real traffic paced at 1
request/second, and prints a preview record — exactly the capability the verifier found broken.

## Issues Encountered

No major issues encountered. `CLOUDFLARE_API_TOKEN` is present in this machine's shell profile
rather than in `.dev.vars` (the plan's stated precondition) — functionally equivalent since the
tool reads credentials from `process.env` regardless of how they got there; `.dev.vars` was still
sourced per the plan's documented command for fidelity, though it contributed no additional vars
this tool needs.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full live, non-probe derivation path against real Cloudflare Zone
  Analytics (zero cost, read-only GraphQL, paced). Exit code 0. Stdout's first line: `[derive-hot-window]
  preview (pass --write to commit): [archive] hot window: derived from 2026-09-02 to 2026-10-01,
  202 days, 79% coverage (D-07b)`. `src/lib/archive/hot-window.json` sha256 confirmed identical
  before and after (`47f20eb5...`); `git diff --exit-code src/lib/archive/hot-window.json` exits
  0. Evidence directory confirmed to hold exactly 30 `day-*.json` files with zero `Bearer` strings
  across all of them.
- What wasn't tested: a `--write` run (deliberately never attempted — this plan is preview-only by
  design; adopting a new window value is an explicit owner decision, not an executor action)
- Edge cases: the preview's `days` (202) came out identical to the in-force value despite the
  30-day sample window shifting forward a month and `otherFiles` changing by 1 (36 -> 37) — the
  file-budget cap, not the coverage target, remains the binding constraint at both measurements

## Next Steps

- [ ] None — REND-10's re-derivation gap (05-VERIFICATION.md gap 3) is closed by this plan;
      05-21 is the designated plan to update REQUIREMENTS.md once all remaining gap-closure plans
      (05-16..05-20) land

---

**Branch:** feature/phase-05
**Issue:** REND-10 gap 3 (05-VERIFICATION.md), WR-08 (05-REVIEW.md)
**Impact:** HIGH - restores and proves live a capability the phase verifier flagged as blocking, with zero risk to the owner-approved hot window (read-only, preview-only)

# 2026-09-22 - One command re-proves the edge noindex policy on every deploy

**Keywords:** [TESTING] [SECURITY] [DEPLOYMENT] [BUG_FIX] [DOCUMENTATION]
**Session:** Evening continuation, Task 3 of 03-05-PLAN.md — plan complete
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2241_03-05-verify-edge-command-completes-plan.md`

## What Changed

- File: `tools/verify-edge-headers.mjs` (new)
  - Four independently-reported live HTTP checks: a static-asset response on
    `dev.915tldr.com`, a genuinely Worker-generated 404 on `admin-dev.915tldr.com` (real Nuxt
    SSR, not the assets layer), a production negative control on `915tldr.com`, and an
    app-level-robots-meta-tag absence check on the dev host's real built article page
  - `--json` flag following `design/scripts/check-contrast.mjs`'s hand-rolled `parseArgs`
    convention; exits non-zero on any failure or network error
- File: `package.json`
  - Added `verify:edge` npm script
- File: `astro.config.mjs`
  - Fixed a self-inflicted regression: the prose explaining the `session: false` fix (this
    plan's Task 1) literally contained the four-character adapter-factory-name-plus-paren
    sequence inside a comment, which fooled `tests/unit/astro-config.test.mjs`'s
    non-comment-aware string search for the real adapter call, breaking the ARCH-06 test.
    Reworded to describe the sequence without forming it (Rule 1 — caused by this task's own
    earlier edit, found by running the full `pnpm test:unit` suite before considering the plan
    done)

## Why

OPS-02's Transform Rule (Task 2) lives entirely outside version control by D-08's accepted
tradeoff — an unrelated zone edit can remove or re-scope it with no diff and no reviewer. This
script is the standing, re-runnable proof that the rule is actually firing, not just that it
exists in the Rulesets API's response.

## Issues Encountered

**[Rule 1 - Bug] `pnpm test:unit` regressed after Task 1's astro.config.mjs edit**, caught while
running the full suite as a final check before considering this plan complete (not part of
Task 3's own action, but directly caused by this plan's own prior commit). The fix's own
explanatory comment defeated the very test it was explaining, by accident. Fixed by rewording;
`pnpm test:unit` is 87/87 again.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm verify:edge` (plain and `--json`) against the real live edge — all 4
  checks pass. The required one-time inversion (`--prod-host=dev.915tldr.com`) was run by hand:
  the production-control check correctly FAILS (observed `status 404, x-robots-tag: noindex`
  instead of the expected absent header), proving the control is causal, not always-green — then
  reverted (the script's default host values are unchanged; the inversion only exercised the
  `--prod-host` override flag, no code path was altered to "fix" this on purpose). A second
  manual run pointed both `--dev-host` and `--admin-host` at an unreachable hostname and
  confirmed a non-zero exit with `network error: fetch failed` reported per check — a network
  failure is never swallowed into a pass.
- What wasn't tested: CI execution of `verify:edge` — deliberately not wired into `test:unit`
  (see script's own header comment and "Next Steps" below).
- Measured runtime: ~1.2-2.0s per real run (4 live HTTPS requests plus one local
  `dist/client/` directory walk). Comfortably fast enough to run after every deploy by hand;
  not fast/hermetic enough for `test:unit`, which must stay network-independent.
- Edge case: the dev host currently has no server-rendered routes of its own (no `server:defer`
  islands exist yet), so check 2 deliberately targets `admin-dev.915tldr.com`'s real Nuxt SSR
  404 instead of a same-app static-asset-miss — documented at length in the script's own header
  comment so a future editor does not "fix" the expected 404 or move the check back onto
  `dev.915tldr.com` without re-deriving why that would test something weaker.

## Next Steps

- [ ] None outstanding for 03-05. This closes the plan.
- [ ] (Carried, not blocking) Revisit whether `verify:edge` should run in a scheduled/CI job
      once this repo has any CI runner with network egress to the live zone — deliberately not
      decided here, since none exists yet.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - new standing verification tool plus a same-session regression fix; no
production-facing behavior changed

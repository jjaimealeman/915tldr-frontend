# 2026-10-02 - Plan 05-21 Task 2: 05-VALIDATION.md brought up to date for gap closure

**Keywords:** [DOCUMENTATION] [TESTING] [PLANNING]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1958_05-21-task2-validation-map-updated-gap-closure-rerun.md`

## What Changed

- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-VALIDATION.md`
  - Appended 22 Per-Task Verification Map rows covering every task across 05-13 through 05-21
    (requirement, threat ref, secure behavior, test type, automated command, status — sourced
    from each plan's own SUMMARY.md, never assumed)
  - Added a "Gap-closure re-run (05-21, 2026-10-02)" subsection under Full Suite Result,
    recording the real command outputs: `test:unit` 745/747 pass (exit 1), `test:build-gate`
    9/9 pass, `test:regression` 5/5 pass, live `test:tracer` 5/5 pass against
    `dev.915tldr.com`
  - Replaced the ARCH-08 Manual-Only row with the full 05-19 decision/re-measurement outcome
    (mechanically MET the owner's pre-stated criterion, but on a zero-archive-traffic sample —
    stays an open gap); added the REND-11 daily-report-delivery row (OPEN, per the owner's
    direct 2026-10-02 reply) and the CR-01/CR-02 fix-vs-accept-risk row (owner chose FIX)
  - Set `nyquist_compliant: false` in frontmatter and explained why in the Sign-Off section:
    the chained full-suite command's literal exit code was 1
- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md` (new)
  - Recorded the two pre-existing, out-of-scope `tests/unit/seo-surfaces.test.mjs` robots.txt
    failures (caused by unrelated commit `143eede`, a Perplexity-bot policy change) that this
    plan's scope boundary does not permit auto-fixing

## Why

05-VERIFICATION.md's gap-closure cycle requires 05-VALIDATION.md to describe what is actually
proven after 05-13 through 05-20's fixes, not what the original 05-12 validation pass recorded
before those fixes existed. The gap-closure full-suite re-run is the mechanism that keeps
`nyquist_compliant` honest — it is set to `false` here specifically because the literal command
exited non-zero, even though the two failures are demonstrably unrelated to any of this phase's
own work, per the project's "evidence, not assertion" standard for status claims.

## Issues Encountered

`tests/unit/seo-surfaces.test.mjs` fails two assertions because of an unrelated commit
(`143eede`, "chore(seo): allow PerplexityBot and Perplexity-User in robots.txt") on this same
branch that changed `public/robots.txt`'s policy without updating the test fixture. Confirmed by
direct `git log` inspection that no 05-13..05-21 plan touches `public/robots.txt` or this test
file — recorded in `deferred-items.md`, not fixed here, per the execute-plan scope-boundary rule.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full gap-closure suite chain (`test:unit`, `test:build-gate`,
  `test:regression`, live `test:tracer` against `dev.915tldr.com`), plus `test:fast` as a
  cross-check (736/738, same two pre-existing failures)
- What wasn't tested: no code changed in this commit; this is a documentation-only update to the
  phase's validation record
- Edge cases: n/a

## Next Steps

- [ ] Task 3 sets every Phase 5 requirement status in REQUIREMENTS.md from this evidence
- [ ] Whoever owns the robots.txt/Perplexity policy change should update
      `tests/fixtures/v1-robots.txt` (or the test's bot-disallow list) so `test:unit` is clean
      again

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - planning/validation documentation only; no source code changed

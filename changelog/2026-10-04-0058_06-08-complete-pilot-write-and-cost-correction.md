# 2026-10-04 - Plan 06-08 complete: translation backfill pilot write, and a corrected cost explanation

**Keywords:** [DOCUMENTATION] [PLANNING] [I18N] [TESTING] [DATABASE]
**Session:** Late night / early morning, Duration (~30 min, resuming from the earlier halt)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0058_06-08-complete-pilot-write-and-cost-correction.md`

## What Changed

- File: `.planning/phases/06-bilingual/06-08-SUMMARY.md`
  - Updated from `status: halted` to `status: complete`. Records Task 2's real pilot
    write (sibling pipeline repo commit `e916e7f`): 30 Spanish translation rows now live
    in production `article_translations` (13 `clean`, 17 `held`, origin
    `backfill-pilot`), written with ZERO additional OpenAI spend (the pilot subcommand
    persists Task 1's already-computed sample rather than calling the API again).
  - Corrects this plan's own first-draft causal explanation for the 60%
    grounding-judge-escalation rate found in Task 1: re-reading the sample's own judge
    verdicts shows the judge HELD 17 of 18 escalated rows (agreeing with the
    deterministic flags) — the real driver is old/thin pre-D-06 sources being genuinely
    hard to ground a translation against, not Spanish-text-specific over-sensitivity in
    the deterministic checks, which was this plan's initial (incorrect) hypothesis.
  - Records three costed options for 06-13's go-live decision on the BULK backfill: full
    two-stage (~$41.94 mean), translation-only-no-judge (~$13.02 mean, bounded ~1/18
    tradeoff), or a recent-window backfill.

## Why

Closes out 06-08-PLAN.md's Task 2 after Jaime reviewed Task 1's halted dry-run report
and decided "write pilot, bulk -> 06-13": approve the small pilot write at the measured
cost level while routing the much larger bulk-backfill decision to 06-13's own go-live
gate. The sibling pipeline repo now carries the shared `scripts/lib/d1-remote.mjs`
escaping helper, the `pilot` subcommand, and the corrected report; this repo's summary
reflects the full, completed plan.

## Issues Encountered

None in this (documentation-only) commit. The underlying plan's Task 2 execution had no
issues either — the pilot write succeeded on the first attempt, with its real production
read-back (13 clean / 17 held) matching the sample's own pre-computed composition
exactly.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: self-check confirmed both claimed commit hashes (`9cb1f25`,
  `e916e7f`) are present in the sibling pipeline repo's `git log --oneline --all`, every
  file the summary names exists on disk there, and a live D1 read confirmed
  `article_translations` carries exactly 30 `backfill-pilot` rows (13 clean / 17 held),
  matching the report's own read-back.
- What wasn't tested: N/A (documentation-only commit in this repo; the real pilot write
  and its verification are recorded in the sibling pipeline repo's own commit and
  report).
- Edge cases: N/A.

## Next Steps

- [ ] 06-13's go-live decision chooses one of the three costed options for the bulk
      backfill
- [ ] 06-06 (or any later Spanish-page verification work) can render against the 30 real
      pilot article uuids now live in production
- [ ] Jaime reads the organisation's `gpt-5.6-luna` Batch queued-token limit from the
      OpenAI dashboard before 06-14/06-17's bulk submission

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - documentation/metadata commit in this repo; the real production
write (30 rows) landed in the sibling pipeline repo, `915tldr.com2` (commit `e916e7f`).

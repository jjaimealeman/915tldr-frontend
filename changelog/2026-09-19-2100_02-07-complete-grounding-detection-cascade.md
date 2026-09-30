# 2026-09-19 - Complete Plan 7: Grounding Detection Cascade

**Keywords:** [FEATURE] [SECURITY] [TESTING] [AI]
**Session:** Evening, Duration (~35 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-19-2100_02-07-complete-grounding-detection-cascade.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-07-SUMMARY.md`
  - Records completion of plan 02-07 (executed entirely in the sibling `915tldr.com2`
    repo, on the same `feature/phase-02` branch): the tracer's one-check grounding gate
    (02-04) is expanded into a five-layer free deterministic stage plus a claim-level
    judge whose cited evidence is re-verified in code, behind the same `checkGrounding`
    signature.
  - Task commits (in `915tldr.com2`): `28b96b6` (Task 1 — `text-metrics.ts`'s single
    declared length/word-count definition, plus the length/lexicon/number/proper-noun
    deterministic layers), `f3a0f69` (Task 2 — `verbatim-overlap.ts`'s rolling-row
    longest-common-substring and n-gram precision for CONT-07), `7d0c059` (Task 3 —
    `checkGrounding`'s required `mode: 'live' | 'backfill'` parameter implementing D-08,
    and span re-verification against the normalised source).
  - Records two auto-fixed Rule 1 deviations found across Tasks 1/2 (a "clean summary"
    test fixture that turned out to be a near-verbatim excerpt of its own source, and a
    follow-up possessive-apostrophe false flag introduced while fixing it) and one
    auto-fixed Rule 3 deviation in Task 3 (`ai-processor.ts`'s one production
    `checkGrounding` call site updated for the new required `mode` parameter).
  - Records full-suite results: 151/151 passing (up from 111 at the start of this plan),
    `pnpm typecheck` and `pnpm lint` clean, `npx drizzle-kit check` clean (no schema
    touched by this plan).

## Why

CONT-04 asks for *any* claim not traceable to its source — a phrase lexicon alone catches
the published fabrication's specific vocabulary but not the general case, which is exactly
why D-08 specified a hybrid: free deterministic checks first, then an LLM judge whose own
citations are never trusted at face value. This plan builds that full cascade behind the
tracer's already-proven `checkGrounding` seam rather than replacing it, so the tracer's
two real-article proofs (one published clean, one correctly held for two genuine
unsupported claims) remain valid evidence for the expanded gate.

## Issues Encountered

None in this repo beyond the commit-workflow correction below. See the 915tldr.com2-side
changelog entries (`2026-09-19-2100`, `2026-09-19-2130`, `2026-09-19-2200`) for
implementation-level notes and the full deviation writeups.

A follow-up commit in this repo replaces this changelog entry itself: the prior commit
was made with a raw `git commit` instead of authoring this entry first, which triggered
this repo's `gsd-changelog-hook` and produced a placeholder `[auto-generated]` entry with
a bare diffstat — exactly the failure mode `/jja-commit`'s workflow exists to prevent.
Corrected by removing the placeholder and writing this entry properly, per global CLAUDE.md.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: full `915tldr.com2` suite (151/151 passing, up from 111 before this
  plan), `pnpm typecheck` and `pnpm lint` clean, `pnpm vitest run tests/grounding/`
  (40/40 across all three new/updated grounding test files), `npx drizzle-kit check`
  clean.
- What wasn't tested: a real OpenAI call against `gpt-5.6-luna`'s judge prompt — every
  test in this plan uses a `vi.fn()` client stand-in, per the phase's budget constraints;
  the tracer (02-04) already proved the judge call works end-to-end against real
  articles, and this plan does not re-run that.
- Edge cases: NFC-normalisation equivalence and code-point vs. UTF-16-unit counting;
  format-variant numbers (comma grouping, spelled-out small integers); a proper noun
  correctly excluded when it's this project's own name or a source outlet's name;
  exact-threshold vs. one-over boundaries for both the length ceiling and verbatim-overlap
  scoring; a thin-source paraphrase vs. the same source quoted at length; every judge
  failure path (no response, unparseable JSON, missing claims array, thrown call)
  confirmed to flag rather than pass.

## Next Steps

- [ ] Plan 02-08: labelled fixture set to validate the cascade's actual false-positive/
      false-negative rates and tune the provisional thresholds this plan documents
      (`MAX_VERBATIM_RUN_LENGTH`, `MAX_NGRAM_PRECISION`, the word-number list, the
      proper-noun exclusion set)
- [ ] Plan 02-09/02-13/02-14/02-15's backfill dry-run script: the first real caller of
      `mode: 'backfill'`

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** MEDIUM - planning-artifact commit only; all code changes landed in
`915tldr.com2` (see that repo's own changelog entries for the code-level record).

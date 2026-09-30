# 2026-09-19 - Complete Plan 6: Faithfulness Prompt Rewrite, Thin-Source Attribution, Columnar Key Points

**Keywords:** [FEATURE] [AI] [TESTING] [DATABASE]
**Session:** Evening, Duration (~35 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-19-2030_02-06-complete-faithfulness-prompt-rewrite.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-06-SUMMARY.md`
  - Records completion of plan 02-06 (executed entirely in the sibling `915tldr.com2`
    repo, on the same `feature/phase-02` branch): the summarisation prompt no longer
    carries any numeric length target or advisory-soliciting instruction, thin-source
    attribution is decided in code from a measured word count, key points now write to
    their own D1 column, and re-processing can freeze title/slug while updating the rest.
  - Task commits (in `915tldr.com2`): `ee15931` (Task 1 — extract `buildSummaryPrompt`,
    remove the last numeric word target), `88e8401` (Task 2 — `selectPromptVariant`/D-07),
    `031af0a` (Task 3 — columnar key points/D-12 identity freeze).
  - Records a real, live before/after run against the exact 55-word KTSM crash-report
    item quoted in `02-CONTEXT.md`: the reconstructed pre-Phase-2 prompt (gpt-4o-mini)
    produced a 466-character summary — longer than its 299-character source, padded with
    invented editorial framing — while the new prompt (gpt-5.6-luna, thin variant)
    produced a 218-character, in-text-attributed, faithful summary.
  - Records one auto-fixed deviation (Rule 3): `server/utils/queue-processor.ts`, an
    unwired alternative pipeline with no live caller, broke `pnpm typecheck` when
    `processArticleWithAI` gained a required `sourceName` parameter; fixed by fetching
    the real source name rather than a placeholder.

## Why

Plan 02-06 closes the two mechanisms behind Phase 2's core content-quality defect: a
numeric word floor and an advisory-soliciting instruction that, together, produced a
published fabrication on a 55-word crash report. This summary documents that closure with
a real before/after rather than a code-reading claim, per the phase's stated verification
standard.

## Issues Encountered

None in this repo. See the 915tldr.com2-side changelog entries
(`2026-09-19-2018`, `2026-09-19-2028`, `2026-09-19-2033`) for implementation-level notes.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: full `915tldr.com2` suite (111/111 passing, up from 85/85 before this
  plan), `pnpm typecheck` and `pnpm lint` clean, both plan-level grep gates
  (`gpt-4o-mini` count and `N-M words` pattern) return 0, and a live two-call OpenAI
  before/after comparison (see SUMMARY for the actual output).
- What wasn't tested: the re-processing script that will drive `freezeIdentity: true` in
  production belongs to plan 02-10, not this one.
- Edge cases: 89/90/91/0-word variant-selection boundary; exact-cap and one-over-cap
  content truncation; prompt-injection-shaped text in the article body.

## Next Steps

- [ ] Plan 02-07: length checks, reusing this plan's word-count definition
- [ ] Plan 02-08: grounding-gate wiring against the new prompt
- [ ] Plan 02-10: wire `freezeIdentity: true` into the actual re-processing call site

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** MEDIUM - planning-artifact commit only; all code changes landed in
`915tldr.com2` (see that repo's own changelog entries for the code-level record).

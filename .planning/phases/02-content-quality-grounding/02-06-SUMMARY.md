---
phase: 02-content-quality-grounding
plan: 06
subsystem: ai
tags: [openai, gpt-5.6-luna, prompt-engineering, drizzle, d1, vitest]

requires:
  - phase: 02-content-quality-grounding
    provides: "02-04's tracer already proved gpt-5.6-luna, max_completion_tokens, no-temperature-override, and the D-04 11,000-char cap in a real Worker run; 02-04's migration 0007 provides the key_points/acquisition_status/grounding_status/grounding_report columns this plan writes to"
provides:
  - "buildSummaryPrompt({title, content, sourceName, variant}) — testable prompt builder with zero numeric length targets and a headed prohibition block"
  - "selectPromptVariant(sourceWordCount) — deterministic thin/standard branch at the 90-word boundary (D-07)"
  - "storeProcessingResults(db, articleId, result, grounding, {freezeIdentity}) — exported, with D-12's title/slug freeze on re-processing"
  - "18 prompt-shape tests + 8 storage tests, all string/DB assertions with no model call"
affects: [02-07, 02-08, 02-09, 02-10]

actuals:
  tokens: 8700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Prompt construction extracted into a pure, exported function (buildSummaryPrompt) so faithfulness properties are asserted by string tests instead of only observable through a paid model call"
    - "Deterministic-branch principle (D-07): thin/standard source classification computed in code from a word count, never asked of the model"

key-files:
  created:
    - 915tldr.com2/tests/prompt-shape.test.ts
    - 915tldr.com2/tests/ai-processor-store.test.ts
  modified:
    - 915tldr.com2/server/utils/openai.ts
    - 915tldr.com2/server/utils/ai-processor.ts
    - 915tldr.com2/server/utils/queue-processor.ts

key-decisions:
  - "Kept the tracer's already-correct removal of the temperature override (gpt-5.6-luna hard-rejects any non-default temperature) rather than 'lowering' it per the plan's literal acceptance criterion — the model API constraint, already proven live in 02-04, overrides a plan assumption written before that constraint was confirmed."
  - "Fixed a compile-breaking call site in server/utils/queue-processor.ts (an unwired, no-caller-anywhere alternative pipeline) that the processArticleWithAI signature change broke, by fetching the real source name rather than passing a placeholder — Rule 3, blocking issue."

requirements-completed: [CONT-02, CONT-03, CONT-07, CONT-08]

coverage:
  - id: D1
    description: "System prompt carries zero numeric word/length targets and a headed PROHIBITED block naming advisories, calls to action, impact analysis and editorial framing"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "tests/prompt-shape.test.ts#Test 1-4 (no numeric range, prohibition block, length ceiling, facts-only keyPoints)"
        status: pass
      - kind: other
        ref: "grep -cE '[0-9]+-[0-9]+ words' server/utils/openai.ts returns 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Prohibition block explicitly forbids advisories/CTAs/impact analysis/editorial framing not stated in the source, with a concrete illustration drawn from the published fabrication"
    requirement: "CONT-03"
    verification:
      - kind: unit
        ref: "tests/prompt-shape.test.ts#Test 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Thin-source attribution (sub-90-word sources) decided in code via selectPromptVariant, never by the model; thin variant names the outlet in-text and forbids padding/verbatim quotation, standard variant does not"
    requirement: "CONT-07"
    verification:
      - kind: unit
        ref: "tests/prompt-shape.test.ts#Test 1-9 (variant describe blocks: 89/90/91/0-word boundary, thin/standard framing, identical prohibition block)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Summarisation pinned to gpt-5.6-luna with no gpt-4o-mini reference remaining in openai.ts"
    requirement: "CONT-08"
    verification:
      - kind: other
        ref: "grep -c \"model: 'gpt-5.6-luna'\" server/utils/openai.ts returns 1; grep -c 'gpt-4o-mini' server/utils/openai.ts returns 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Key points land in the key_points column as JSON for new rows; re-processing (freezeIdentity=true) leaves title/slug byte-identical while updating summary/keyPoints/tags/categories/entities; legacy formatSummaryWithKeyPoints stays exported for un-migrated rows"
    verification:
      - kind: unit
        ref: "tests/ai-processor-store.test.ts#Test 1-8"
        status: pass
    human_judgment: false
  - id: D6
    description: "A real, live before/after run on actual (short, feed-truncated) article text shows the old prompt padding a summary past the source's own length with invented editorial framing, and the new prompt producing a shorter, attributed, faithful summary"
    verification:
      - kind: manual_procedural
        ref: "one-off scratchpad script (not committed): pre-Phase-2 prompt on gpt-4o-mini vs. buildSummaryPrompt (thin variant) on gpt-5.6-luna, same 299-char KTSM crash-report content quoted in 02-CONTEXT.md"
        status: pass
    human_judgment: true
    rationale: "Judging whether a live LLM-generated summary is genuinely faithful (not merely shorter) is a qualitative call about content, not something a boolean assertion can fully certify — recorded here for a human to confirm the reasoning, even though the objective proxies (length-vs-source, attribution presence, absence of invented advisory language) all passed."

duration: 35min
completed: 2026-09-19
status: complete
---

# Phase 02 Plan 06: Faithfulness Prompt Rewrite Summary

**Rewrote the summarisation prompt to remove every numeric length target and the
advisory-soliciting instruction that produced a published fabrication, added a
code-decided thin-source attribution variant, and moved key points into their own D1
column — proven live against a real 299-character KTSM feed item where the old prompt
padded a summary past the source's own length and the new prompt did not.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-19T20:14:00-06:00 (approx.)
- **Completed:** 2026-09-19T20:29:15-06:00
- **Tasks:** 3/3 completed
- **Files modified:** 5 (`server/utils/openai.ts`, `server/utils/ai-processor.ts`,
  `server/utils/queue-processor.ts`, `tests/prompt-shape.test.ts` (new),
  `tests/ai-processor-store.test.ts` (new))

## Accomplishments

- Extracted the faithfulness prompt into an exported, pure `buildSummaryPrompt` function
  and removed the last surviving numeric length target (the title's `"(8-15 words)"`) —
  the prompt now carries zero numeric length targets anywhere (CONT-02), closing the exact
  mechanism that produced the padding defect.
- Added `selectPromptVariant`/`THIN_SOURCE_WORD_THRESHOLD=90`: sub-90-word sources get an
  in-text-attributed, padding-forbidden, verbatim-forbidden prompt variant; the branch is
  computed from a word count in code, never left to the model to judge (D-07/CONT-07).
- Exported `storeProcessingResults` and gave it a `freezeIdentity` option: re-processing
  can now update `summary`/`key_points`/tags/categories/entities while leaving `title` and
  `slug` byte-identical, protecting nine months of indexed URLs against Phase 4's static
  pre-generation (D-12).
- Ran a real, live before/after comparison against the exact 55-word KTSM crash-report
  item quoted in `02-CONTEXT.md`: the reconstructed pre-Phase-2 prompt (gpt-4o-mini)
  produced a 466-character summary — **longer than its 299-character source**, padded with
  invented editorial framing ("highlights ongoing concerns regarding road safety... further
  details may emerge as the investigation continues"); the new prompt (gpt-5.6-luna, thin
  variant) produced a 218-character summary, attributed in-text ("According to KTSM, ..."),
  with no invented content and four traceable key points.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the faithfulness prompt and extract it behind a testable builder** -
   `ee15931` (feat)
2. **Task 2: Thin-source attribution decided in code, not by the model (D-07)** -
   `88e8401` (feat)
3. **Task 3: Columnar key points and the D-12 identity freeze on re-processing** -
   `031af0a` (feat)

_All three tasks followed RED → GREEN TDD: the test file was written and confirmed
failing (function not found) before each implementation step._

## Files Created/Modified

- `915tldr.com2/server/utils/openai.ts` - `buildSummaryPrompt`, `selectPromptVariant`,
  `THIN_SOURCE_WORD_THRESHOLD`, exported `CONTENT_INPUT_CHAR_CAP`; `processArticleWithAI`
  now requires `sourceName` and derives the variant itself
- `915tldr.com2/server/utils/ai-processor.ts` - `storeProcessingResults` exported with
  `freezeIdentity` option; pending-articles query joins `sources` for the outlet name;
  `formatSummaryWithKeyPoints` unchanged, comment strengthened to mark it retained for
  legacy rows
- `915tldr.com2/server/utils/queue-processor.ts` - unwired alternative pipeline's call to
  `processArticleWithAI` updated to fetch and pass a real source name (compile-fix, see
  Deviations)
- `915tldr.com2/tests/prompt-shape.test.ts` (new, 18 tests) - pure string-shape assertions
  for both Task 1 and Task 2 behaviours
- `915tldr.com2/tests/ai-processor-store.test.ts` (new, 8 tests) - in-memory-D1 assertions
  for the columnar key-points write and the D-12 identity freeze

## Decisions Made

- Kept the tracer's temperature-override removal as-is rather than "lowering" temperature
  per the plan's literal wording — `gpt-5.6-luna` hard-rejects any non-default temperature
  value (confirmed live during 02-04's tracer run, recorded in `tracer-evidence.md`), so
  no value below the previous 0.4 override is reachable. The existing comment already
  records the reason; no code change was possible or correct here.
- The title instruction's numeric word count was removed along with its "engaging"
  framing, since the acceptance grep `[0-9]+-[0-9]+ words` scans the whole file, not just
  the summary section — leaving it would have failed the plan's own gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking compile error] `processArticleWithAI`'s new `sourceName`
parameter broke an undeclared caller**
- **Found during:** Task 2
- **Issue:** `server/utils/queue-processor.ts` — an alternative, currently-unwired
  queue-consumer pipeline with no caller anywhere in the codebase (confirmed via
  `grep -rn "processArticleWithPipeline"`) — also calls `processArticleWithAI` and broke
  `pnpm typecheck` (`Expected 4 arguments, but got 3`) once the signature gained a
  required `sourceName` parameter. This file is not in the plan's declared
  `files_modified` list.
- **Fix:** Fetched the real source name via the function's already-available `db` and
  `articleId` (a two-line join query) rather than passing a placeholder string that would
  misattribute a thin summary to the wrong or no outlet.
- **Files modified:** `915tldr.com2/server/utils/queue-processor.ts`
- **Verification:** `pnpm typecheck` exits 0; the fetched-name pattern matches
  `ai-processor.ts`'s equivalent join.
- **Committed in:** `88e8401` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary for `pnpm typecheck` (this plan's own verification gate) to
pass. No scope creep beyond the minimal fix; no behavior change to any wired code path.

## Issues Encountered

`node_modules/.bin/tsx` was present but its target package (`tsx@4.23.1`) was missing
from the pnpm store, breaking the intended route for the live before/after verification
script. Worked around by running the `.mts` script directly with `node` (Node 24's
built-in TypeScript type-stripping handles the plain type annotations used here) —
no project files or dependencies were changed to work around this; it's noted here as an
environment observation, not fixed, since it's outside this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-07 (length checks) can reuse the exact word-count definition documented next to
  `THIN_SOURCE_WORD_THRESHOLD` (whitespace-run split after trim) — the comment explicitly
  flags that the two must not disagree.
- Plan 02-10 (re-processing) has `storeProcessingResults(..., { freezeIdentity: true })`
  ready to call; this plan did not wire a re-processing call site, only proved the
  function honours the option.
- `CONTENT_INPUT_CHAR_CAP`, `selectPromptVariant`, and `buildSummaryPrompt` are all
  exported and stable for any downstream plan that needs to construct or reason about the
  prompt.
- No blockers. Full suite green (111/111, up from 85/85 before this plan — 26 new tests),
  typecheck and lint clean, both plan-level grep gates (`gpt-4o-mini` count and
  `N-M words` pattern) return 0.

---

_Phase: 02-content-quality-grounding_
_Completed: 2026-09-19_

## Self-Check: PASSED

All 5 files created/modified in `915tldr.com2` confirmed present on disk; all 3 task
commit hashes (`ee15931`, `88e8401`, `031af0a`) confirmed present in `git log --oneline
--all` for that repo. This SUMMARY.md confirmed written to disk in the planning repo.

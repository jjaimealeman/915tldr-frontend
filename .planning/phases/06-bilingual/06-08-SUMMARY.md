---
phase: 06-bilingual
plan: 08
subsystem: ai

tags: [openai, d1, cost-estimation, grounding, i18n, gpt-5.6-luna]

# Dependency graph
requires:
  - phase: 06-bilingual (plan 01)
    provides: "bilingual.ts (validateSpanishFields, normalizeSourceLanguage), grounding-check.ts's checkGrounding/runDeterministicChecks with language:'es', cost-estimate.ts's Batch/standard rate constants and rounding contract"
  - phase: 06-bilingual (plan 03)
    provides: "article_translations live in production D1, and Jaime's consent record pre-approving a <=30-row pilot write"
provides:
  - "server/utils/translation-prompt.ts: a translation-only prompt (distinct from openai.ts's bilingual-summarisation prompt) for translating an already-summarised English row, plus its batch-line/custom-id helpers"
  - "scripts/backfill-translations.mjs dry-run + pilot: a real, measured 30-row stratified production sample projecting the full ~40,541-row backfill's two-stage (translation + judge) Batch cost, and the pilot write itself"
  - "scripts/lib/d1-remote.mjs: the shared sqlString/runRemoteWrite/buildTranslationUpsertSql module, moved out of september-backfill-execute.mjs so both backfill scripts share one escaping path"
  - "30 real Spanish article_translations rows live in production (origin 'backfill-pilot', 13 clean / 17 held)"
  - "docs/phase-06/translation-backfill-dry-run.md: the measured report plus the population-mix finding and three costed options, for 06-13's go-live decision"
affects: [06-13-go-live-decision, 06-14-backfill-execute, 06-17-backfill-run]

# Actuals (#2632)
actuals:
  tokens: 22991
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Instrumented OpenAI client wrapper (monkey-patches client.chat.completions.create to log usage to a side-channel, drained per logical call) — the only way to get MEASURED token usage out of grounding-check.ts's checkGrounding(), whose internal judge call does not expose response.usage in its public return shape"
    - "Wilson score 95% upper bound (not a naive p +/- 1.96*sqrt(p(1-p)/n) interval) for bounding a rare-event rate (grounding-judge escalation) measured from a small (n=30) sample — correctly handles the p=0 edge case, which still has a nonzero real upper bound"
    - "A pilot/execute subcommand that persists an already-computed, already-paid-for result (the dry run's sample) rather than re-calling the paid API a second time — the pilot write constructs no OpenAI client at all, making its $0-additional-spend property structural, not just observed"

key-files:
  created:
    - ../915tldr.com2/server/utils/translation-prompt.ts
    - ../915tldr.com2/scripts/backfill-translations.mjs
    - ../915tldr.com2/scripts/lib/d1-remote.mjs
    - ../915tldr.com2/tests/translation/translation-prompt.test.ts
    - ../915tldr.com2/tests/translation/backfill-sql.test.ts
    - ../915tldr.com2/docs/phase-06/translation-backfill-dry-run.md
  modified:
    - ../915tldr.com2/.gitignore
    - ../915tldr.com2/scripts/september-backfill-execute.mjs

key-decisions:
  - "Task 1 (the dry run) initially HALTED at the orchestrator's own tracer-feedback gate: the measured mean-case backfill cost ($41.94) exceeded the $5 auto-continue ceiling, so Task 2 was not auto-approved. Jaime reviewed the numbers and decided 'write pilot, bulk -> 06-13' — approve the <=30-row pilot write at this cost level and route the BULK backfill's cost decision to 06-13's own go-live gate rather than deciding it here."
  - "Judge-stage usage is captured by wrapping the real OpenAI client (instrumentClient) rather than modifying grounding-check.ts's checkGrounding, which does not expose judge-call usage in its return shape — this keeps the dry run honest (it calls the EXACT same production checkGrounding('backfill') path a real backfill would) while still getting a real measured number instead of an estimate."
  - "The pilot write makes ZERO new OpenAI calls — it reads the sample dry-run already computed and paid for ($0.0621, already spent in Task 1) and only persists that already-decided result to D1. This was a hard requirement from the resuming instruction (NO new API calls; STOP if pilot would need one) and is true by construction: runPilot() never constructs an OpenAI client."
  - "Corrected, evidence-based causal claim for the 60% judge-escalation rate: of the 18 escalated rows, the judge itself HELD 17 (agreeing with the deterministic flags) and cleared only 1. This points at old/thin pre-D-06 sources being genuinely hard to ground a faithful translation against (too little source text for the judge to find a verbatim supporting span, in either language) — not at the deterministic checks being over-sensitive specifically to Spanish output, which was this plan's own first-draft (and incorrect) hypothesis."
  - "Read-only population-mix measurement (95.4% of the eligible set has no key_points/is a legacy pre-D-06 row) corroborates the orchestrator's own independent measurement and confirms the sample's 60% flag rate is representative of the true population, not a stratification artefact of the 30-row draw."

patterns-established:
  - "A dry-run cost report explicitly compares its MEASURED figure against the previously-assumed figure and states the difference and its likely cause in plain language, rather than only reporting the new number — carried forward from september-backfill-dry-run.mjs's own convention."
  - "When a surprising finding's first-draft causal explanation turns out to be wrong on closer reading of the data the report itself already contains (judge agreement, not Spanish-sensitivity), the report is CORRECTED in place with the evidence shown, not just restated more confidently — matching this project's own 'verify the premise' standard."

requirements-completed: []  # I18N-01/I18N-02 remain Pending — this plan writes 30 real PILOT rows (origin 'backfill-pilot'), proving the write path end-to-end, but the full requirement (the live-ingest/bulk-backfill Spanish coverage across the archive) is still gated behind 06-13's go-live decision on the bulk backfill. Matches this phase's own established precedent (06-01, 06-03) of not marking a requirement complete until its full behavior is live.

coverage:
  - id: D1
    description: "A translation-only prompt (distinct from the bilingual-summarisation prompt) correctly asks for exactly sourceLanguage/titleEs/summaryEs/keyPointsEs, preserves names/numbers/dates, writes neutral Latin American Spanish, and handles the legacy inline-Key-Details summary shape"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "tests/translation/translation-prompt.test.ts (15 tests: prompt contract, legacy-shape note, batch-line/custom-id round trip)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The backfill's projected cost is MEASURED from a real 30-row stratified production sample (translation + grounding calls against real content), not estimated from unrelated summarisation-stage constants — replacing PROJECT.md's unvalidated ~$1.49 figure"
    requirement: "I18N-01"
    verification:
      - kind: integration
        ref: "docs/phase-06/translation-backfill-dry-run.md — 30/30 real translation calls, 18/30 real judge calls, before/after article_translations count unchanged (0/0) at dry-run time, total real spend $0.0621 recorded"
        status: pass
    human_judgment: false
  - id: D3
    description: "The shared SQL escaping/upsert helper (buildTranslationUpsertSql) validates every field and escapes every text value through one function, matching T-06-29's threat mitigation"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "tests/translation/backfill-sql.test.ts (9 tests: hostile-string escaping, INSERT/ON CONFLICT shape, every validation failure path) + tests/batch/execute-write.test.ts (23 tests, unchanged after the sqlString/runRemoteWrite move)"
        status: pass
    human_judgment: false
  - id: D4
    description: "30 real Spanish translation rows (origin 'backfill-pilot') are live in production article_translations, written in one batch with zero additional OpenAI spend, with the read-back status counts and uuids recorded"
    requirement: "I18N-01"
    verification:
      - kind: integration
        ref: "docs/phase-06/translation-backfill-dry-run.md 'Pilot' section — live read-back: 13 clean / 17 held, 30 uuids listed; article_translations row count confirmed 0 before pilot, 30 after"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whether to proceed to the FULL BULK backfill (not just the pilot) at the measured $41.94 mean-case / $99.26 ceiling-case cost, and which of the three costed options (full two-stage, translation-only-no-judge, or recent-window) to choose"
    verification: []
    human_judgment: true
    rationale: "Jaime already made the pilot-level decision in this session ('write pilot, bulk -> 06-13'), explicitly routing the BULK cost/option decision to 06-13's own go-live gate rather than deciding it here — this remains an open human decision by design, not an oversight in this plan."

duration: ~90min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 8: Translation Backfill Dry Run, Measured Cost, and the First Real Pilot Write Summary

**A real 30-row production sample measures the Spanish-backfill cost at $41.94 mean-case (vs. PROJECT.md's unvalidated $1.49), corrects its own first-draft causal explanation (old/thin sources, not Spanish-sensitive checks), and — per Jaime's decision — writes 30 real Spanish translations to production (13 clean, 17 held) at zero additional spend.**

## Performance

- **Duration:** ~90 min (Task 1 ~45 min, paused for review, Task 2 ~30 min)
- **Started:** 2026-10-03
- **Completed:** 2026-10-04
- **Tasks:** 2 of 2
- **Files modified:** 7 (pipeline repo) + this SUMMARY (frontend repo)

## Accomplishments

- Built `server/utils/translation-prompt.ts` — a translation-only prompt distinct from
  `openai.ts`'s same-call bilingual-summarisation prompt (06-01), since this backfill
  translates ALREADY-SUMMARISED English rows rather than producing a first summary. Asks
  for exactly `sourceLanguage`/`titleEs`/`summaryEs`/`keyPointsEs`, preserves names,
  places, organizations, outlets, numbers, dates and amounts as written, writes neutral
  Latin American Spanish, and handles the legacy "inline `**Key Details:**` block"
  summary shape by splitting it into a prose `summaryEs` plus a real `keyPointsEs` array.
- Built `scripts/backfill-translations.mjs dry-run` — counted the live eligible set
  (40,529 public articles with stored content and no Spanish translation yet at the time
  of the dry run; 117 more with no stored content, excluded per D-05), drew a 30-row
  stratified sample, and ran the REAL translation call plus the REAL production
  `checkGrounding(..., 'backfill')` grounding check against each sampled row's actual
  stored content — all 30 translations passed validation, 18 of 30 escalated to a real
  judge call. Measured the full-backfill two-stage Batch cost from that real usage:
  **mean case $41.94, ceiling case $99.26** — replacing PROJECT.md's unvalidated ~$1.49
  estimate (RESEARCH.md Assumption A1).
- **Corrected the report's own first-draft causal explanation after closer review.** The
  initial read (this session's own Task 1 pass) attributed the 60% judge-escalation rate
  to the deterministic checks being "over-sensitive to Spanish text." Re-reading the
  sample's own judge verdicts refutes that: **the judge itself HELD 17 of the 18 escalated
  rows**, agreeing with the deterministic flags, and cleared only 1 (article 34812). A
  read-only population-mix measurement (95.4% of the ~40.5k eligible rows have no
  `key_points` column — i.e. are legacy, pre-D-06 rows, 38.0% of the TOTAL set additionally
  thin, <550 stored characters) corroborates the orchestrator's own independent
  measurement (23,365 not-thin + 15,453 thin vs. 1,824 modern) and shows the sample's 60%
  flag rate is representative of the true population, not a sampling artefact. The real
  explanation: **old/thin sources are genuinely hard to ground a faithful translation
  against** — too little source text for the judge to find a verbatim supporting span, in
  either language — not a defect specific to the Spanish translation step.
- Per Jaime's explicit decision ("write pilot, bulk -> 06-13"): moved `sqlString`/
  `runRemoteWrite` into a new shared `scripts/lib/d1-remote.mjs`, added
  `buildTranslationUpsertSql` (validates `articleId`/`language`/`groundingStatus`/`origin`,
  escapes every text value), and added a `pilot` subcommand to
  `backfill-translations.mjs` that **persists the already-computed sample with zero new
  OpenAI calls** (no client is even constructed in that code path) — wrote **30 rows to
  production `article_translations`** (origin `backfill-pilot`): 13 `clean`, 17 `held`,
  matching the sample's own pre-computed composition exactly. Read back and recorded all
  30 uuids and statuses in the report.
- Added **three costed options for 06-13's go-live decision**: (A) full two-stage
  translation+judge, ~$41.94 mean — highest fidelity, matches live-ingest's D-04 bar; (B)
  translation-only with flagged rows held without a judge call, ~$13.02 mean — a known,
  bounded tradeoff (loses only the ~1/18 rows the judge would have cleared); (C) a
  recent-window backfill — smaller up-front spend, but skips the vast majority of the
  (95.4%-legacy) archive, the opposite of D-10's full-backfill intent.
- Fetched the OpenAI Batch API's documented limits directly (not from memory):
  50,000 requests/batch, 200 MB/file (`developers.openai.com/api/docs/guides/batch`,
  fetched 2026-10-03) — and flagged the organisation-specific "queued prompt tokens per
  model" limit as UNVERIFIED, since that figure lives on the OpenAI dashboard's own
  Limits page and could not be read by this script; Jaime needs to check it before 06-13.

## Task Commits

Pipeline repo (`/home/jaime/www/_github/915tldr.com2`, branch `feature/phase-06`):

1. **Task 1: Tracer — translation-only prompt, real 30-row sample, measured two-stage
   Batch projection** - `9cb1f25` (feat)
2. **Task 2: Shared d1-remote helper + translation backfill pilot write** - `e916e7f`
   (feat)

**This SUMMARY's commit:** recorded separately, frontend repo (`915tldr.com`), branch
`feature/phase-06`.

## Files Created/Modified

- `915tldr.com2/server/utils/translation-prompt.ts` (new) — translation-only prompt,
  `TRANSLATION_MODEL`, `TRANSLATION_MAX_COMPLETION_TOKENS`, `buildTranslationPrompt()`,
  `buildTranslationBatchLine()`, `customIdForTranslation()`,
  `articleIdFromTranslationCustomId()`, `countInlineKeyDetails()`.
- `915tldr.com2/scripts/backfill-translations.mjs` (new) — `dry-run` and `pilot`
  subcommands.
- `915tldr.com2/scripts/lib/d1-remote.mjs` (new) — `sqlString`, `runRemoteWrite`,
  `buildTranslationUpsertSql`, shared with `september-backfill-execute.mjs`.
- `915tldr.com2/scripts/september-backfill-execute.mjs` (modified) — imports
  `sqlString`/`runRemoteWrite` from the new shared module, re-exports `sqlString`.
- `915tldr.com2/tests/translation/translation-prompt.test.ts` (new) — 15 tests.
- `915tldr.com2/tests/translation/backfill-sql.test.ts` (new) — 9 tests.
- `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md` (new, generated/appended) —
  the measured report, population-mix finding, cost options, and Pilot section.
- `915tldr.com2/.gitignore` (modified) — added `.gsd/` (local-only script scratch data;
  the dry run's sample output lives there, gitignored, feeding the pilot write).

## Decisions Made

See `key-decisions` in the frontmatter. In brief: Task 1 initially halted at the
orchestrator's $5 tracer-feedback ceiling; Jaime reviewed the real numbers and decided to
approve the pilot write while routing the bulk-backfill decision to 06-13; judge-stage
usage was captured by instrumenting the real OpenAI client; the pilot write was designed
to make zero new API calls by construction; and the report's own first-draft causal
explanation for the 60% judge-escalation rate was corrected after re-reading the sample's
judge verdicts (old/thin sources, not Spanish-sensitive checks).

## Deviations from Plan

**1. [Disclosed, resolved — not a Rule 1-4 deviation] Task 1 initially halted at the
orchestrator's tracer-feedback gate; resumed and completed after Jaime's review.**

- **Found during:** Task 1's own `<verify>` (the real dry run).
- **What happened:** The measured mean-case backfill cost ($41.94) exceeded the
  orchestrator's $5 auto-continue ceiling for this plan, so Task 2 did not auto-start — a
  checkpoint was returned instead, per the orchestrator's own standing instructions for
  this plan. Jaime reviewed `docs/phase-06/translation-backfill-dry-run.md` and the
  orchestrator's own independent population-mix measurement, then decided: **"Write
  pilot, bulk -> 06-13"** — approve the pilot write at this cost level (the pilot itself
  is small/cheap regardless of the bulk projection) and hand the bulk-backfill cost
  decision to 06-13's own go-live gate. Task 2 then ran to completion as resumed.
- **Why this is the correct sequence, not a failure:** The halt surfaced a real,
  actionable finding (the population mix and the judge's own 17/18 agreement rate) before
  any production write happened, and the resulting pilot write happened with full
  knowledge of that finding rather than on the strength of an unreviewed 28x cost
  surprise.
- **No extra OpenAI spend occurred in Task 2.** The pilot write persists Task 1's already-
  paid-for sample; `runPilot()` never constructs an `OpenAI` client.

**Total deviations:** 1 (orchestrator-imposed tracer-gate halt, resolved by Jaime's
review and decision, not a Rule 1-4 auto-fix). No code-quality or security deviations
occurred.

## Issues Encountered

- **The measured grounding-judge escalation rate (60%, sample n=30) is much higher than
  the live-ingest baseline this grounding check was tuned against — now explained, not
  just flagged.** This session's own first pass attributed it to the deterministic checks
  being Spanish-text-sensitive. On review, that explanation does not hold up against the
  sample's own data: the judge HELD 17 of 18 escalated rows (agreeing with the
  deterministic flags), and a read-only population-mix measurement shows 95.4% of the
  eligible archive is legacy/pre-D-06 (and much of that additionally thin), closely
  matching the sample's own composition. The real driver is old/thin sources being
  genuinely hard to ground a faithful translation against, in either language — not a
  Spanish-specific defect. This is recorded in the report's "Population mix" and
  corrected "Corrected causal claim" subsections with the evidence shown, for 06-13 to
  rely on directly.
- No other issues. Both tasks' own acceptance criteria passed on the first run.

## User Setup Required

**06-13 still needs Jaime's input on the BULK backfill** (the pilot-level decision is
already made and executed). Specifically:

1. **Choose one of the three costed options** in
   `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md`'s "Cost options for
   06-13" section: (A) full two-stage (~$41.94 mean), (B) translation-only-no-judge
   (~$13.02 mean, known ~1/18 tradeoff), or (C) a recent-window backfill.
2. **Read the organisation's `gpt-5.6-luna` Batch "queued prompt tokens per model" limit**
   from the OpenAI dashboard's Limits page (UNVERIFIED in this report) before any bulk
   Batch submission is planned in 06-14/06-17.

No external service CONFIGURATION is required (no new env vars, no new credentials).

## Next Phase Readiness

- **30 real Spanish translation rows are live in production** (`origin =
  'backfill-pilot'`), ready for 06-06/the frontend's Spanish loader to render against for
  real-page verification, and ready as evidence for 06-13's go-live decision.
- **06-13 (go-live decision)** now has a real measured figure, a corrected causal
  explanation, and three costed options to choose from, alongside 06-01's live per-day
  cost delta and 06-12's build-budget verdicts, per that plan's own `must_haves`.
- **No blocker exists for 06-06 or any other concurrently-running plan** — this plan's
  work is scoped entirely to the pipeline repo (`915tldr.com2`) and a 30-row pilot write;
  nothing in 06-06's own file set was touched.
- **Blocker for 06-14/06-17 (the actual bulk backfill execution plans):** both depend on
  06-13's go-live decision on which of the three costed options to run at scale.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

- FOUND: `9cb1f25` in `915tldr.com2`'s git log
- FOUND: `e916e7f` in `915tldr.com2`'s git log
- FOUND: `915tldr.com2/server/utils/translation-prompt.ts`
- FOUND: `915tldr.com2/scripts/backfill-translations.mjs`
- FOUND: `915tldr.com2/scripts/lib/d1-remote.mjs`
- FOUND: `915tldr.com2/tests/translation/translation-prompt.test.ts`
- FOUND: `915tldr.com2/tests/translation/backfill-sql.test.ts`
- FOUND: `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md`
- CONFIRMED (live D1 read): `article_translations` row count before the pilot write: 0;
  after: 30 (13 `clean`, 17 `held`), matching the report's own read-back exactly.

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
  - "server/utils/translation-prompt.ts: a translation-only prompt (titled distinctly from openai.ts's bilingual-summarisation prompt) for translating an already-summarised English row, plus its batch-line/custom-id helpers"
  - "scripts/backfill-translations.mjs dry-run: a real, measured 30-row stratified production sample (not an estimate) projecting the full ~40,529-row backfill's two-stage (translation + judge) Batch cost"
  - "docs/phase-06/translation-backfill-dry-run.md: the measured report itself, for 06-13's go-live decision"
affects: [06-13-go-live-decision, 06-14-backfill-execute, 06-17-backfill-run]

# Actuals (#2632)
actuals:
  tokens: 15767
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Instrumented OpenAI client wrapper (monkey-patches client.chat.completions.create to log usage to a side-channel, drained per logical call) — the only way to get MEASURED token usage out of grounding-check.ts's checkGrounding(), whose internal judge call does not expose response.usage in its public return shape"
    - "Wilson score 95% upper bound (not a naive p +/- 1.96*sqrt(p(1-p)/n) interval) for bounding a rare-event rate (grounding-judge escalation) measured from a small (n=30) sample — correctly handles the p=0 edge case, which still has a nonzero real upper bound"

key-files:
  created:
    - ../915tldr.com2/server/utils/translation-prompt.ts
    - ../915tldr.com2/scripts/backfill-translations.mjs
    - ../915tldr.com2/tests/translation/translation-prompt.test.ts
    - ../915tldr.com2/docs/phase-06/translation-backfill-dry-run.md
  modified:
    - ../915tldr.com2/.gitignore

key-decisions:
  - "HALTED after Task 1 per the orchestrator's own tracer-feedback gate: the measured mean-case backfill cost ($41.94) exceeds the $5 auto-continue ceiling the orchestrator set for this plan, so Task 2 (shared SQL escaping helper + the <=30-row pilot write) was NOT started — see must_haves below and the Deviations section for the full reasoning."
  - "backfill-translations.mjs ships in this commit with ONLY the dry-run subcommand — no D1-write code path exists in the committed file at all. The pilot subcommand (and scripts/lib/d1-remote.mjs's sqlString/runRemoteWrite move + buildTranslationUpsertSql) were drafted and unit-tested locally during this session but deliberately NOT committed, since Task 2 itself did not run — committing unexecuted Task-2 code under a Task-1 commit would misrepresent what this commit actually did."
  - "Judge-stage usage is captured by wrapping the real OpenAI client (instrumentClient) rather than modifying grounding-check.ts's checkGrounding, which does not expose judge-call usage in its return shape — this keeps the dry run honest (it calls the EXACT same production checkGrounding('backfill') path a real backfill would) while still getting a real measured number instead of an estimate."

patterns-established:
  - "A dry-run cost report explicitly compares its MEASURED figure against the previously-assumed figure and states the difference and its likely cause in plain language, rather than only reporting the new number — carried forward from september-backfill-dry-run.mjs's own convention."

requirements-completed: []  # I18N-01/I18N-02 remain Pending — this plan builds and runs the COST-MEASUREMENT instrument (Task 1) on a real sample; it does not write any production translation data (Task 2's pilot write did not run). Matches this phase's own established precedent (06-01, 06-03) of not marking a requirement complete until its full behavior is live.

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
        ref: "docs/phase-06/translation-backfill-dry-run.md — 30/30 real translation calls, 18/30 real judge calls, before/after article_translations count unchanged (0/0), total real spend $0.0621 recorded"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whether to proceed to the backfill (or to Task 2's smaller pilot write) at the measured $41.94 mean-case / $99.26 ceiling-case cost — ~28x the previously assumed figure, driven by an unexpectedly high (60%) grounding-judge escalation rate on translated Spanish text"
    verification: []
    human_judgment: true
    rationale: "This is exactly the decision the orchestrator's tracer-feedback gate exists to route to a human rather than auto-approve: the measured cost crossed the $5 auto-continue ceiling, and the underlying cause (the grounding judge's deterministic layers triggering far more often on Spanish output than they do on the English text they were tuned against) is itself worth a second look before committing to either the pilot write or a bulk Batch spend."

duration: ~45min
completed: 2026-10-03
status: halted
---

# Phase 6 Plan 8: Translation Backfill Dry Run — Measured Cost Halts at Task 1 Summary

**A real 30-row production sample measures the Spanish-backfill cost at $41.94 mean-case (vs. PROJECT.md's unvalidated $1.49) — ~28x higher, driven by a 60% grounding-judge escalation rate on translated text — halting the plan before Task 2's pilot write per the orchestrator's own cost-surprise gate.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 1 of 2 (Task 2 NOT started — see Deviations)
- **Files modified:** 5 (pipeline repo) + this SUMMARY (frontend repo)
- **Commits:** 1 (pipeline repo)

## Accomplishments

- Built `server/utils/translation-prompt.ts` — a translation-only prompt distinct from
  `openai.ts`'s same-call bilingual-summarisation prompt (06-01), since this backfill
  translates ALREADY-SUMMARISED English rows rather than producing a first summary. Asks
  for exactly `sourceLanguage`/`titleEs`/`summaryEs`/`keyPointsEs`, preserves names,
  places, organizations, outlets, numbers, dates and amounts as written, writes neutral
  Latin American Spanish, and handles the legacy "inline `**Key Details:**` block"
  summary shape by splitting it into a prose `summaryEs` plus a real `keyPointsEs` array.
- Built `scripts/backfill-translations.mjs dry-run` — counted the live eligible set
  (40,529 public articles with stored content and no Spanish translation yet; 117 more
  with no stored content, excluded per D-05), drew a 30-row stratified sample (10 newest,
  10 oldest, a quota-enforced bucket guaranteeing legacy/thin/Spanish-source
  representation), and ran the REAL translation call plus the REAL production
  `checkGrounding(..., 'backfill')` grounding check against each sampled row's actual
  stored content — all 30 translations passed validation, 18 of 30 escalated to a real
  judge call.
- Measured the full-backfill two-stage Batch cost from that real usage: **mean case
  $41.94, ceiling case $99.26** — replacing PROJECT.md's unvalidated ~$1.49 estimate
  (RESEARCH.md Assumption A1) with a real number. The gap is explained, not just stated:
  60% of sample rows escalated to the grounding judge (Wilson 95% upper bound 75.4%),
  far higher than the September backfill's English-tuned baseline — the deterministic
  layers (proper-noun/number/lexicon) trigger more often against Spanish output than
  against the English text they were calibrated on.
- Captured REAL judge-call usage (not an estimate) by wrapping the OpenAI client to log
  `response.usage` from every `chat.completions.create` call, since
  `grounding-check.ts`'s `checkGrounding()` does not expose judge-call usage in its
  public return shape — this measures the judge stage honestly while still calling the
  exact production grounding path a real backfill would use.
- Fetched the OpenAI Batch API's documented limits directly (not from memory):
  50,000 requests/batch, 200 MB/file (`developers.openai.com/api/docs/guides/batch`,
  fetched 2026-10-03) — and flagged the organisation-specific "queued prompt tokens per
  model" limit as UNVERIFIED, since that figure lives on the OpenAI dashboard's own
  Limits page and could not be read by this script; Jaime needs to check it before 06-13.
- Confirmed via before/after `COUNT(*)` on `article_translations` (0 -> 0) that the dry
  run wrote nothing to production D1, as designed.

## Task Commits

Pipeline repo (`/home/jaime/www/_github/915tldr.com2`, branch `feature/phase-06`):

1. **Task 1: Tracer — translation-only prompt, real 30-row sample, measured two-stage
   Batch projection** - `9cb1f25` (feat)

**Task 2 was NOT executed** — see Deviations below. No commit exists for it.

**This SUMMARY's commit:** recorded separately, frontend repo (`915tldr.com`), branch
`feature/phase-06`.

## Files Created/Modified

- `915tldr.com2/server/utils/translation-prompt.ts` (new) — translation-only prompt,
  `TRANSLATION_MODEL`, `TRANSLATION_MAX_COMPLETION_TOKENS`, `buildTranslationPrompt()`,
  `buildTranslationBatchLine()`, `customIdForTranslation()`,
  `articleIdFromTranslationCustomId()`, `countInlineKeyDetails()`.
- `915tldr.com2/scripts/backfill-translations.mjs` (new) — `dry-run` subcommand only (no
  D1-write code path in this commit).
- `915tldr.com2/tests/translation/translation-prompt.test.ts` (new) — 15 tests.
- `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md` (new, generated) — the
  measured report.
- `915tldr.com2/.gitignore` (modified) — added `.gsd/` (local-only script scratch data;
  the dry run's own sample output lives there, gitignored, and was not committed).

## Decisions Made

See `key-decisions` in the frontmatter. In brief: this plan halted after Task 1 because
the measured cost crossed the orchestrator's own $5 auto-continue ceiling; judge-call
usage was captured by instrumenting the real OpenAI client rather than modifying
production grounding code; and Task 2's code (drafted and unit-tested locally during
this session) was deliberately left uncommitted since Task 2 itself did not execute.

## Deviations from Plan

**1. [Tracer-feedback gate, orchestrator-imposed — not a Rule 1-4 deviation] Halted
before Task 2 because the measured backfill cost exceeded the $5 auto-continue ceiling.**

- **Found during:** Task 1's own `<verify>` (the real dry run).
- **What happened:** The orchestrator's standing instructions for this plan said: "if
  spend stayed under the guard and all acceptance criteria pass, auto-continue to Task
  2... If anything is off (spend guard, validation failure rate surprising, projected
  full-backfill cost > $5), STOP and return a checkpoint instead." Task 1's own spend
  guard was respected ($0.0621 actual vs. a $0.25 ceiling) and validation was clean
  (30/30 valid), but the **projected full-backfill mean-case cost ($41.94) is far above
  the $5 threshold** — so per the orchestrator's explicit instruction, this plan stopped
  here rather than proceeding automatically to Task 2's shared-SQL-helper-plus-pilot-
  write task.
- **Why this is the correct call, not a failure:** The $41.94 figure is not a mechanical
  false-precision number pointing at nothing actionable — it is explained by a real,
  specific finding (60% judge-escalation rate on translated Spanish text, far above the
  English-tuned baseline) that is worth a human's attention before any further spend,
  pilot or bulk. Proceeding to write pilot rows or — worse — to plan a bulk Batch
  submission around an unreviewed 28x cost surprise would be exactly the kind of
  "complete work you have found to be pointless/premature just because it was on the
  list" this project's own verification standard warns against.
- **What was NOT done as a result:** Task 2's action items (move `sqlString`/
  `runRemoteWrite` into `scripts/lib/d1-remote.mjs`, add `buildTranslationUpsertSql`, add
  the `pilot` subcommand to `backfill-translations.mjs`, run it, read back the result)
  were drafted and passed their own unit tests locally during this session, but were
  **deliberately removed/reverted before committing** rather than landed under a Task-1
  commit — committing unexecuted Task-2 work (including a pilot write that never
  happened) under a commit that claims only Task 1 would misrepresent what actually
  shipped. `scripts/september-backfill-execute.mjs` is therefore UNCHANGED (its
  `sqlString`/`runRemoteWrite` were not moved) — that move is still a sound idea and
  remains available for whoever picks Task 2 back up.
- **No production write occurred.** `article_translations` is unchanged (still 0 rows
  from this plan; 06-03's migration left it empty, and nothing in this plan added rows).

**Total deviations:** 1 (orchestrator-imposed tracer-gate halt, not a Rule 1-4
auto-fix). No code-quality or security deviations occurred — Task 1 was executed exactly
as planned, and its own `<verify>`/acceptance criteria all passed.

## Issues Encountered

- **The measured grounding-judge escalation rate (60%, sample n=30) is much higher than
  the live-ingest baseline this grounding check was tuned against.** This is a real
  finding, not a bug: the deterministic checks (proper-noun-absent, number-absent,
  lexicon, verbatim-overlap) were calibrated against English faithfulness fixtures
  (Phase 2), and several of those layers are structurally more likely to fire on
  Spanish-translated text — e.g. a translated proper-noun phrase written with Spanish
  capitalisation/word order, or a Spanish-translated number format, can diverge from a
  literal-substring match against the English source even when the translation itself
  is perfectly faithful. 10 of the 18 judge calls in this sample's output table resolved
  to `held` even after the judge ran, meaning the judge agreed something was genuinely
  unsupported in a meaningful fraction of cases — this is not purely a false-positive
  artifact of the deterministic layer, though the overall rate is still a real
  surprise worth investigating before bulk spend. Flagged for 06-13's review, not
  investigated further in this plan (out of this plan's own scope — Task 1 was the
  measurement, not a grounding-check redesign).
- No other issues. Task 1's own acceptance criteria all passed on the first run: the
  test file passed, the dry-run script exited 0, the report contains every required
  section, total sample spend was recorded and was under both the plan's $0.50 ceiling
  and the orchestrator's stricter $0.25 ceiling, and the `article_translations` row
  count was confirmed unchanged before/after.

## User Setup Required

**Jaime's input is required before this plan can continue.** Specifically:

1. **Review the measured cost** in
   `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md` — mean-case $41.94,
   ceiling-case $99.26, against the previously assumed ~$1.49.
2. **Decide** whether to: (a) proceed to Task 2's <=30-row pilot write at this cost
   level (the pilot write itself is small/cheap regardless — it is the FULL BULK
   backfill implied by this projection that costs $41.94-$99.26, not the pilot), (b)
   investigate the grounding judge's Spanish-text sensitivity first (possibly reducing
   the escalation rate and therefore the cost), or (c) some other path.
3. **Read the organisation's `gpt-5.6-luna` Batch "queued prompt tokens per model" limit**
   from the OpenAI dashboard's Limits page (UNVERIFIED in this report) before any bulk
   Batch submission is planned in 06-14/06-17.

No external service CONFIGURATION is required (no new env vars, no new credentials) —
this is a decision gate, not a setup gap.

## Next Phase Readiness

- **06-13 (go-live decision)** now has a real measured figure to show Jaime alongside
  06-01's live per-day cost delta and 06-12's build-budget verdicts, per that plan's own
  `must_haves`. The $41.94/$99.26 figures and the 60% judge-escalation finding are ready
  to cite directly.
- **Task 2 of THIS plan (06-08) is not done** and should be picked back up — either by a
  continuation of this plan after Jaime's review, or folded into 06-13's own decision
  flow — once a path forward on the cost/escalation-rate question is chosen. The
  `scripts/lib/d1-remote.mjs` move and `buildTranslationUpsertSql` helper described in
  the plan are straightforward and were already drafted/tested once in this session;
  redoing them is low-risk, low-effort work, not a blocker.
- **No blocker exists for 06-06 or any other concurrently-running plan** — this halt is
  scoped entirely to 06-08's own Task 2, in a separate repo (`915tldr.com2`), and touched
  no file 06-06 (frontend repo) depends on.
- **Blocker for 06-14/06-17 (the actual backfill execution plans):** both depend on
  06-13's go-live decision, which in turn needs the human review described above —
  this is the real critical path item this halt surfaces.

---
*Phase: 06-bilingual*
*Completed: 2026-10-03*

## Self-Check: PASSED

- FOUND: `9cb1f25` in `915tldr.com2`'s git log
- FOUND: `915tldr.com2/server/utils/translation-prompt.ts`
- FOUND: `915tldr.com2/scripts/backfill-translations.mjs`
- FOUND: `915tldr.com2/tests/translation/translation-prompt.test.ts`
- FOUND: `915tldr.com2/docs/phase-06/translation-backfill-dry-run.md`
- CONFIRMED: `915tldr.com2/scripts/lib/d1-remote.mjs` does NOT exist (Task 2 not
  committed, as stated above) — `915tldr.com2/scripts/september-backfill-execute.mjs`
  is unchanged from its pre-plan state.
- CONFIRMED (live D1 read, recorded in the report itself): `article_translations` row
  count before and after this plan's dry run: 0 and 0.

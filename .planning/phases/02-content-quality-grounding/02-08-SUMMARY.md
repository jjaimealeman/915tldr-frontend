---
phase: 02-content-quality-grounding
plan: 08
subsystem: ai
tags: [grounding, calibration, gpt-5.6-luna, vitest, d1, checkpoint]

requires:
  - phase: 02-content-quality-grounding
    provides: "02-07's grounding-check.ts cascade (deterministic stage + claim-level judge, mode split) is what this plan calibrates. The known production fabrication CONTEXT.md quotes and the corpus's three sources (El Paso Matters, KTSM, KVIA) are what the fixture set is drawn from."
provides:
  - "tests/fixtures/grounding/labelled-set.json — 28 real corpus rows (7 bad, 21 good, ~21% held out) keyed by UUID, human-labelled, drawn from production D1"
  - "tests/fixtures/grounding/judge-responses.json — recorded real gpt-5.6-luna judge verdicts for all 28 fixtures, letting the calibration test run offline"
  - "scripts/build-grounding-fixtures.mjs and scripts/capture-judge-responses.mjs — the two committed, re-runnable legs of D-10's calibration pipeline"
  - "tests/grounding/fixture-set.test.ts — 7 tests measuring recall/false-positive rate at every cut (all/tuned/held-out/thin-source)"
  - "checkGrounding's decoupled layer architecture (GroundingResult.deterministicReasons) — a clean judge verdict can now clear a deterministic-only flag"
  - "docs/phase-02/grounding-calibration.md — the full measured accounting, with a prominent pre-fix-corpus caveat"
affects: [02-09, 02-10, 02-13, 02-14, 02-15]

actuals:
  tokens: 73300
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Recorded-response calibration: a real judge call is captured once per labelled fixture and committed as data, so the accuracy test that scores against it runs offline, deterministically and free in CI — no live API call in the test path"
    - "Decoupled-escalation gating: a cheap deterministic stage can trigger escalation to a paid judge, but only the judge's own verdict (when it successfully returns one) is authoritative for the final decision — a deterministic false positive can no longer unilaterally hold an article the judge would clear. The judge-unavailable path remains fail-closed, unchanged."
    - "Regression-lock ceilings alongside an aspirational target ceiling: when the measured baseline is far from the number you actually want, assert against the honest baseline (so a further regression is caught) rather than asserting against the target (which would either fail the suite or require quietly inflating the target to match reality)"

key-files:
  created:
    - 915tldr.com2/scripts/build-grounding-fixtures.mjs
    - 915tldr.com2/tests/fixtures/grounding/labelled-set.json
    - 915tldr.com2/tests/fixtures/grounding/judge-responses.json
    - 915tldr.com2/scripts/capture-judge-responses.mjs
    - 915tldr.com2/tests/grounding/fixture-set.test.ts
    - 915tldr.com2/docs/phase-02/grounding-calibration.md
  modified:
    - 915tldr.com2/server/utils/grounding-check.ts
    - 915tldr.com2/tests/grounding-check.test.ts
    - 915tldr.com2/tests/grounding/length-check.test.ts
    - 915tldr.com2/tests/ai-processor-store.test.ts

key-decisions:
  - "OWNER DECISION, 2026-09-19 (Option C + Option D, NOT Option B): after this plan's checkpoint (full-cascade false-positive rate measured at ~88-90% against genuinely faithful known-good fixtures), the owner decided to (C) decouple checkGrounding's deterministic and judge layers so a clean judge verdict can clear a deterministic-only flag — matching D-08's framing of the judge as 'what closes the general case' — and (D) defer Task 3 (D-09 live gating: retry-once-then-hold, review queue) to a later plan rather than wire it into live ingest against a detector measuring this aggressive. The owner explicitly declined Option B (loosening the judge's 'supported' bar) because every fixture is pre-fix legacy content, and loosening the definition of 'faithful' against that data risks calibrating the gate to accept the exact editorial padding D-05 exists to forbid. That decision is deferred until post-fix sample data exists. Recorded as WINDOWS.md entry 20, naming what would unblock Task 3: a small batch of articles processed under the 02-06 prompt, measured against this same cascade, at or near the 15% target ceiling."
  - "Fixed a real bug found during calibration (Rule 1, not part of the owner decision): the deterministic proper-noun check was matching the entire AI-generated headline as a candidate 'proper noun phrase,' because a Title-Case headline is definitionally a run of consecutive capitalised words. This flagged 100% of the 21 known-good fixtures before the fix, purely from title text, contributing zero true positives — closed by scoping the check to summary text only. None of the 45 pre-existing unit tests caught this because their test fixtures use sentence-case titles, not realistic Title-Case AI-generated headlines; two regression tests close that permanently."
  - "Two-ceiling test design: TARGET_FALSE_POSITIVE_CEILING (15%, D-09-cost-justified) is recorded and reported against, but NOT asserted as a passing gate given current measured reality. Separate DETERMINISTIC_FP_REGRESSION_CEILING (35%) and FULL_CASCADE_FP_REGRESSION_CEILING (95%) constants lock in the actual measured baseline so a future change that makes accuracy worse is caught by the test suite, without the suite pretending the 15% target is currently met."
  - "Labelling-method transparency: the calibration doc explicitly notes that the human spot-check technique used while labelling 'good' fixtures (grep-style substring checks for specific numbers/names against source text) is conceptually similar to — though not the same code as — the deterministic stage's own checks, making the deterministic-stage numbers slightly less 'blind' than a fully independent measurement. The judge-stage numbers don't share this concern since no LLM was used for labelling."

requirements-completed: [CONT-04, CONT-05]

coverage:
  - id: D1
    description: "A labelled fixture set of 28 real corpus rows (7 bad including the CONTEXT.md-quoted production fabrication, 21 good spanning all 3 sources and thin/full content, ~21% held out) keyed by article UUID, with a human-written labelReason per row"
    requirement: "CONT-05"
    verification:
      - kind: unit
        ref: "node -e \"...fixture roster shape check...\" (plan's own Task 1 verification command) — bad>=1, good>=20, unique uuids, all required fields present"
        status: pass
    human_judgment: false
  - id: D2
    description: "The known production fabrication (CONTEXT.md's exact quote) is caught by an automated assertion that names its uuid on failure, at both the deterministic and full-cascade level"
    requirement: "CONT-05"
    verification:
      - kind: unit
        ref: "tests/grounding/fixture-set.test.ts#Test 1 (deterministic recall) and #Test 3 (full-cascade recall) — 100% recall (7/7) at every cut, per-fixture assertion naming the missed uuid on failure"
        status: pass
    human_judgment: false
  - id: D3
    description: "The false-positive rate is measured as a real number with sample size, at every meaningful cut (all/tuned/held-out/thin-source), for both the deterministic stage alone and the full cascade, with a named ceiling constant and the re-run command recorded"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "tests/grounding/fixture-set.test.ts#Test 2, #Test 4, #Test 5, #Test 7 — all pass, all log the measured percentage and sample size"
        status: pass
      - kind: other
        ref: "docs/phase-02/grounding-calibration.md — records every number, the ceiling and why, threshold values in force, and the re-run command"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether the current false-positive rate is fit for wiring into live ingest (D-09/Task 3) is a decision the owner needed to make, not something this plan could resolve by tuning the ceiling to match reality"
    verification: []
    human_judgment: true
    rationale: "Genuinely a product/policy decision — the measured ~88-90% full-cascade false-positive rate could mean either 'the judge is too strict' or 'the legacy corpus genuinely violates the new standard,' and only the owner can decide whether to loosen the judge (Option B, declined for now) or defer live gating (Option D, chosen). Already resolved via the checkpoint in this session — recorded here for traceability, not as an open UAT item."

# Metrics
duration: 3h05min
completed: 2026-09-20
status: complete
---

# Phase 2 Plan 8: Grounding Calibration Summary

**Built a 28-row labelled fixture set from real production data, measured the grounding cascade's recall (100%) and false-positive rate (29-33% deterministic-only, 88-90% full cascade) with sample sizes at every cut, fixed a real bug that was flagging 100% of good fixtures, and — after a checkpoint the owner resolved as Option C + D — decoupled the deterministic/judge layers while explicitly deferring live gating (Task 3 / D-09) to a later plan.**

## Performance

- **Duration:** ~3h 5min
- **Started:** 2026-09-19 (session continuation from Wave 5)
- **Completed:** 2026-09-20
- **Tasks:** 2 of 3 planned tasks completed (Task 3 explicitly deferred — see below)
- **Files modified:** 10 (6 created, 4 modified) in `915tldr.com2`

## Accomplishments

- Built `scripts/build-grounding-fixtures.mjs`, a read-only production-D1 script that
  pulled and human-labelled 28 real article rows: 7 known-bad (including the exact
  production fabrication CONTEXT.md quotes, verified by direct D1 search, plus 6 more
  spanning thin/truncated and full-length non-thin sources) and 21 known-good (8 from El
  Paso Matters, 4 from KVIA full/medium content, 9 from thin content across KVIA and
  KTSM), with every label backed by a human-written `labelReason` and, for the good
  fixtures, individually spot-checked numeric/named claims against source text.
- Found and fixed a real bug (not a threshold tune) while running the deterministic stage
  against the fixture set for the first time: the proper-noun-presence check was matching
  the entire AI-generated headline as a candidate name, because a Title-Case headline is
  definitionally a run of capitalised words. This produced a 100%-of-known-good
  false-positive rate before the fix, contributing zero true positives — closed by
  scoping the check to `summary` text only, with two new regression tests using a
  realistic Title-Case headline (the gap none of the 45 pre-existing tests caught, since
  they all used sentence-case test titles).
- Captured real `gpt-5.6-luna` judge responses for all 28 fixtures (one live call each,
  cost estimated at $0.14 worst-case before running, per OPS-11), committed alongside the
  fixtures so the calibration test runs offline with no live API call in CI.
- Measured the full picture: deterministic-only recall 100% (7/7), false-positive rate
  29.4% tuned (5/17); full-cascade recall 100% (7/7), false-positive rate 88.2% tuned
  (15/17) — far outside any defensible D-09 cost ceiling.
- **Hit a checkpoint** (per the plan's own explicit guidance for exactly this situation)
  rather than tuning the ceiling to make the number look acceptable. Presented the owner
  with the measured numbers, a structural finding (a deterministic false positive could
  never be cleared by a clean judge verdict — confirmed independently by the orchestrator
  against `grounding-check.ts:480`), and four options.
- **Owner decided Option C + D, explicitly declining Option B.** Implemented C:
  decoupled the layers so a clean judge verdict can clear a deterministic-only flag
  (`GroundingResult` gained `deterministicReasons` so the finding is never discarded, just
  no longer unilaterally determinative). Re-measured using the already-recorded judge
  responses (no new API calls, per the owner's explicit instruction) — decoupling
  corrected the structural bug but made no measurable difference to the tuned full-cascade
  rate (still 88.2%), confirming the judge's own strictness against legacy content, not
  the OR-logic bug, is the dominant contributor.
- Wrote `tests/grounding/fixture-set.test.ts` (7 tests: per-fixture recall assertions
  naming the missed uuid, deterministic and full-cascade false-positive rates against two
  ceiling tiers — an honest 15% target and looser regression-lock ceilings — thin-source
  sub-rate, held-out sub-report, and an exercised empty/missing-file guard) and
  `docs/phase-02/grounding-calibration.md` (every number, every threshold value in force,
  the labelling method with a transparency caveat about method overlap, and a prominent
  caveat that every fixture is pre-fix legacy content).
- **Did NOT implement Task 3** (D-09 live gating: retry-once-then-hold,
  `grounding_status='held'`, the review-queue admin route). Explicitly deferred per the
  owner's Option D decision, recorded as an open item in `.planning/WINDOWS.md` (entry
  20), naming what evidence would unblock it.

## Task Commits

Each unit of work was committed atomically, in `915tldr.com2`:

1. **Task 1: Build the labelled fixture set from the real corpus (D-10)** - `358fb55` (feat)
2. **Prettier formatting fix on Task 1's script** - `6dade02` (fix)
3. **Fix title-derived proper-noun false positive + record judge responses** - `03a5844` (fix)
4. **Task 2: Calibrate — decouple layers, defer live gating (owner decision C+D)** - `873d08d` (feat)

**Plan metadata:** pending (this SUMMARY's own commit, in the planning repo)

## Files Created/Modified

- `915tldr.com2/scripts/build-grounding-fixtures.mjs` - New. Read-only D1 fixture builder,
  28-row human-labelled roster, undersized/missing-row guards.
- `915tldr.com2/tests/fixtures/grounding/labelled-set.json` - New. The 28 fixtures.
- `915tldr.com2/tests/fixtures/grounding/judge-responses.json` - New. Recorded real judge
  verdicts, one per fixture.
- `915tldr.com2/scripts/capture-judge-responses.mjs` - New. Committed, re-runnable judge
  capture script (D-10's second re-run leg).
- `915tldr.com2/server/utils/grounding-check.ts` - Modified: proper-noun check scoped to
  summary only; `checkGrounding` decoupled (judge verdict authoritative when it runs;
  fail-closed unchanged when the judge is unavailable); `GroundingResult` gained
  `deterministicReasons`.
- `915tldr.com2/tests/grounding-check.test.ts` - Modified: the CONT-06-length test now
  asserts the decoupled behavior; added a fail-closed companion test.
- `915tldr.com2/tests/grounding/length-check.test.ts` - Modified: two new Title-Case
  headline regression tests.
- `915tldr.com2/tests/ai-processor-store.test.ts` - Modified: `CLEAN_GROUNDING` fixture
  updated for the new `GroundingResult` field.
- `915tldr.com2/tests/grounding/fixture-set.test.ts` - New. 7 calibration tests.
- `915tldr.com2/docs/phase-02/grounding-calibration.md` - New. Full calibration report.

## Decisions Made

See `key-decisions` in frontmatter for the full text. Summary:

- **Owner decision (checkpoint resolution), 2026-09-19: Option C + D, not B.** Decouple
  the layers (implemented); defer live gating to a later plan (implemented); do not loosen
  the judge's strictness yet (explicitly not done, deferred pending post-fix data).
- **Rule 1 bug fix:** proper-noun check scoped to summary only, closing a 100%-of-good
  false-positive path that contributed zero true positives.
- **Two-ceiling test design:** an honest 15% target ceiling (not currently met, reported
  as such) plus separate regression-lock ceilings that keep the suite green while
  catching future regressions, rather than inflating the target to match reality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier/lint formatting errors in Task 1's committed script**
- **Found during:** running the full success-criteria checklist ahead of Task 2 (the
  plan's Task 1 verification command doesn't run lint, so this was missed at commit time)
- **Issue:** 13 Prettier errors (quote style, string wrapping) in
  `scripts/build-grounding-fixtures.mjs`
- **Fix:** `pnpm lint:fix`; confirmed byte-identical script output before/after (no
  behavior change)
- **Files modified:** `915tldr.com2/scripts/build-grounding-fixtures.mjs`
- **Verification:** `pnpm lint` exits 0
- **Committed in:** `6dade02`

**2. [Rule 1 - Bug] Deterministic proper-noun check flagging 100% of known-good fixtures**
- **Found during:** Task 2, first run of the deterministic stage against the real fixture
  set
- **Issue:** `CAPITALIZED_PHRASE_PATTERN` matched entire Title-Case AI-generated
  headlines as candidate "proper noun phrases," since every major headline word is
  capitalised by convention regardless of whether it names anything. Every one of 21
  known-good fixtures flagged, entirely title-derived, contributing zero true positives —
  the check could never pass a headline, faithful or not.
- **Fix:** Scoped the proper-noun candidate extraction to `summary` text only. Titles
  remain checked for faithfulness via the judge's dedicated `titleSupported` field (D-11).
- **Files modified:** `915tldr.com2/server/utils/grounding-check.ts`,
  `915tldr.com2/tests/grounding/length-check.test.ts` (2 new regression tests)
- **Verification:** all 45 pre-existing grounding tests still pass unmodified; deterministic
  false-positive rate dropped from 100% to 33.3% (all)/29.4% (tuned)
- **Committed in:** `03a5844`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — a formatting miss and a real detector
bug found by calibrating against real data, exactly what D-10 exists to catch).
**Impact on plan:** Both were necessary corrections. No scope creep beyond what the
checkpoint/owner-decision process explicitly authorized (Option C's architecture change).

## Checkpoint and Owner Decision (full record)

This plan hit a `checkpoint:decision` (`gate="blocking-human"`) mid-Task-2, after
measuring a full-cascade false-positive rate of ~88-90% against genuinely faithful
known-good fixtures — far outside any defensible ceiling, and exactly the situation the
plan's own checkpoint guidance calls out ("calibration shows the gate's accuracy is
materially worse than the phase assumed"). Four options were presented (A: accept and
document baseline; B: loosen the judge's strictness; C: decouple the deterministic/judge
layers; D: hold Task 3's live wiring). The orchestrator independently verified the
structural claim behind Option C against the actual source line numbers before deciding.

**Owner decision: C + D, explicitly not B.** Full reasoning is recorded in this SUMMARY's
`key-decisions` frontmatter and in `docs/phase-02/grounding-calibration.md`'s "Owner
decision" section — both intended to make the deferral **auditable**, not an unexplained
gap. In short: Option C is architecturally correct regardless of the specific numbers (a
clean judge verdict should be able to override a stale/imprecise pre-filter), so it was
implemented outright. Option B was explicitly declined because every fixture is pre-fix
legacy content, and loosening "supported" against that data risks calibrating the gate to
accept exactly the editorial padding D-05 was written to eliminate — that decision is
deferred until real post-fix data exists. Option D followed necessarily: wiring D-09's
live gating against a detector currently holding ~88-90% of genuinely faithful articles
would make the site appear to stop publishing.

## Issues Encountered

None beyond the checkpoint documented above, which was resolved within this session.

## User Setup Required

None - no external service configuration required beyond the existing `OPENAI_API_KEY`
already present in `.dev.vars` (used for the one-time, cost-bounded judge-response
capture; ~$0.14 worst-case, well under the $1 OPS-11 gate, stated before running).

## Next Phase Readiness

- **CONT-04 and CONT-05 are satisfied** by this plan: the known fabrication is caught by
  an automated per-fixture assertion naming its uuid, and both stages' recall/false-positive
  rates are measured, reported with sample sizes, and re-runnable by one command.
- **D-09 (Task 3) is NOT implemented** and is explicitly out of this plan's completed
  scope by owner decision — `articles.status` does not yet enumerate `held`,
  `processPendingArticles` does not yet retry or hold, and no review-queue admin route
  exists. Tracked in `.planning/WINDOWS.md` entry 20. Whichever plan picks this up next
  needs: (1) a small batch of articles processed under the 02-06 prompt to build a
  post-fix fixture set, (2) a re-measurement against that set, and (3) if the rate is
  still far from the 15% target, a fresh decision on Option B with real data behind it.
- Full test suite: 161/161 (up from 151 at the start of this plan). `pnpm typecheck`,
  `pnpm lint`, and `npx drizzle-kit check` all clean.
- No production D1 write occurred in this plan — every query in
  `build-grounding-fixtures.mjs` and every production-data read remained read-only, per
  the plan's key constraints.

---

*Phase: 02-content-quality-grounding*
*Completed: 2026-09-20*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk in `915tldr.com2`; all 4 commits
(`358fb55`, `6dade02`, `03a5844`, `873d08d`) confirmed in `git log --all` for
`915tldr.com2`. `.planning/WINDOWS.md` entry 20 confirmed recorded in the planning repo.
This SUMMARY.md confirmed written to
`.planning/phases/02-content-quality-grounding/02-08-SUMMARY.md` in the planning repo.

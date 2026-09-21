---
phase: 02-content-quality-grounding
plan: 07
subsystem: ai
tags: [openai, gpt-5.6-luna, grounding, vitest, unicode, verbatim-overlap]

requires:
  - phase: 02-content-quality-grounding
    provides: "02-04's tracer already proved the minimum-viable checkGrounding shape (one deterministic length check + one judge call), the gpt-5.6-luna model pin, max_completion_tokens/no-temperature-override, and migration 0007's grounding_status/grounding_report columns; 02-06's THIN_SOURCE_WORD_THRESHOLD/selectPromptVariant is the word-count consumer text-metrics.ts now backs"
provides:
  - "text-metrics.ts — normalizeForLength/normalizedLength/wordCount: the single declared definition of length and word count, now shared by openai.ts's thin-source branch and every grounding check"
  - "runDeterministicChecks({sourceContent, title, summary, keyPoints, sourceName?}) — five free layers (length ceiling, advisory lexicon, number presence, proper-noun presence, verbatim overlap) run before any paid judge call"
  - "verbatim-overlap.ts — longestCommonSubstring (rolling-row), ngramPrecision, verbatimOverlapScore, with two provisional CONT-07 thresholds"
  - "checkGrounding(input, client, mode: 'live' | 'backfill') — D-08's live/backfill judge-cost split; claim-level judge with span re-verification against the normalised source; every failure path (no response, unparseable JSON, missing claims array, throw) flags rather than passes; per-claim reasons name the claim and failure mode"
affects: [02-08, 02-09, 02-10, 02-13, 02-14, 02-15]

actuals:
  tokens: 13600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One declared definition per cross-cutting property (text-metrics.ts) so independent call sites cannot silently disagree about what 'longer' or 'a word' means — CONT-02's encoding edge closed structurally, not by convention"
    - "Cascading free-then-paid detection: deterministic checks run first and always; the LLM judge is gated by mode (live: always; backfill: only when the free stage already flagged something) rather than being the default path"
    - "Claim-extraction-then-verify: the judge's own cited evidence (sourceSpan) is never trusted — re-verified by containment against the normalised source in code, so a judge that hallucinates a claim cannot also hallucinate an unchecked citation for it"
    - "Every failure path of a paid-model check throws through one catch that flags conservatively — no failure mode (no response, unparseable JSON, missing expected field, network throw) has a path to a silent pass"

key-files:
  created:
    - 915tldr.com2/server/utils/text-metrics.ts
    - 915tldr.com2/server/utils/verbatim-overlap.ts
    - 915tldr.com2/tests/grounding/length-check.test.ts
    - 915tldr.com2/tests/grounding/verbatim-overlap.test.ts
    - 915tldr.com2/tests/grounding/judge.test.ts
  modified:
    - 915tldr.com2/server/utils/grounding-check.ts
    - 915tldr.com2/server/utils/openai.ts
    - 915tldr.com2/server/utils/ai-processor.ts
    - 915tldr.com2/tests/grounding-check.test.ts

key-decisions:
  - "checkGrounding's new mode parameter is required, not defaulted — D-08's live/backfill cost split is a policy decision each call site must make explicitly; a default could silently pick the wrong posture for a future call site."
  - "Word-number matching in the deterministic number check includes 'zero' through 'twenty' but deliberately excludes 'one' — 'one' doubles as an ordinary determiner/pronoun far more often than a number claim, and including it would make the free layer noisy enough to be switched off. Documented as PROVISIONAL pending plan 02-08's fixture set."
  - "Judge failure handling unified: a response missing its claims array entirely now throws (previously defaulted silently to an empty array, i.e. zero problems) so it funnels through the same conservative-flag catch as every other judge failure mode — closing a real silent-pass path, not a hypothetical one."
  - "Span re-verification now compares against the NFC-normalised source (via text-metrics.ts) instead of the raw string, so a whitespace difference between what the judge quotes and the source text cannot falsely reject a real, present citation."

requirements-completed: [CONT-04, CONT-06, CONT-07, CONT-02]

coverage:
  - id: D1
    description: "One declared length/word-count unit (text-metrics.ts) shared by the CONT-06 length check, the D-07 thin-source branch, and verbatim-overlap scoring"
    requirement: "CONT-02"
    verification:
      - kind: unit
        ref: "tests/grounding/length-check.test.ts#normalizeForLength / normalizedLength, #wordCount (6 tests, including a direct cross-check against openai.ts's THIN_SOURCE_WORD_THRESHOLD)"
        status: pass
      - kind: other
        ref: "grep -c 'text-metrics' server/utils/openai.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONT-06 length ceiling enforced on the normalised value with a tested equal/one-over boundary"
    requirement: "CONT-06"
    verification:
      - kind: unit
        ref: "tests/grounding/length-check.test.ts#runDeterministicChecks — length ceiling (CONT-06) (4 tests: exactly-equal not flagged, one-over flagged, one-under not flagged, raw-equal/normalised-different case)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Advisory-phrase lexicon and number/proper-noun presence checks — free layers catching the known fabrication shape and unsupported specifics, with format-variance (comma grouping, spelled-out small integers) explicitly not flagged"
    verification:
      - kind: unit
        ref: "tests/grounding/length-check.test.ts#advisory lexicon (2 tests), #number and proper-noun presence (6 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "CONT-07 verbatim-overlap scoring (longest-common-substring + n-gram precision) with a tested threshold boundary that does not punish reproducing names/addresses exactly"
    requirement: "CONT-07"
    verification:
      - kind: unit
        ref: "tests/grounding/verbatim-overlap.test.ts (12 tests: exact-threshold/one-over boundary, thin-source paraphrase vs. verbatim quote, proper-noun-heavy summary not flagged, rolling-row performance under 1s)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Claim-level judge with span re-verification against the normalised source, covering the AI-generated title as a claim (D-11), and a live/backfill mode split (D-08) so the backfill only pays for the judge when the free stage already flagged something"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "tests/grounding/judge.test.ts (11 tests: clean pass, hallucinated-span rejection, unsupported-claim flag, title-unsupported flag, non-JSON response, thrown judge call, missing claims array, backfill-skips-judge, live-always-runs-judge, whitespace-tolerant span match, per-claim named reason)"
        status: pass
      - kind: unit
        ref: "tests/grounding-check.test.ts (5 pre-existing tracer tests, updated for the new required mode parameter, all still pass unmodified in behavior)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 7: Grounding Detection Cascade Summary

**Expanded the tracer's one-check grounding gate into a five-layer free deterministic stage plus a claim-level judge whose cited evidence is re-verified in code, with a required live/backfill cost-split mode and one declared length unit shared across the whole pipeline.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-19 (session continuation from Wave 4)
- **Completed:** 2026-09-19 20:52:59 -0600
- **Tasks:** 3/3 completed
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- Built `text-metrics.ts` as the single declared definition of "how long is this text" —
  NFC-normalised, whitespace-collapsed code-point length and word count — and made both
  `openai.ts`'s D-07 thin-source branch and every grounding check import from it, closing
  CONT-02's encoding edge structurally rather than by convention.
- Expanded `grounding-check.ts`'s deterministic stage from one check (length only) to
  five free layers: length ceiling (now normalised), an advisory-phrase lexicon seeded
  from the published fabrication, number presence (with format-variance tolerance for
  comma-grouped and spelled-out numbers), proper-noun presence (excluding this project's
  own name and its source outlets), and verbatim-overlap scoring.
- Built `verbatim-overlap.ts`'s `longestCommonSubstring` with a rolling-row
  implementation (not a full n-by-m matrix) so a 35,000-character source cannot exhaust a
  Worker's CPU budget — proven with a performance assertion (~400-900ms for a
  3,000-vs-34,500-character comparison, comfortably under the 1-second bar).
- Gave `checkGrounding` a required `mode: 'live' | 'backfill'` parameter implementing
  D-08's cost split, and hardened every judge failure path — no response, unparseable
  JSON, a response missing its `claims` array entirely — to throw through one catch that
  always flags conservatively. The missing-claims-array case previously defaulted
  silently to zero claims (a real, closed silent-pass path).
- Made the judge's span re-verification whitespace-tolerant (compares against the
  normalised source) and per-claim reasons specific (names the claim and *why*:
  unsupported, no-span-cited, or span-not-found) instead of a bare unsupported-claim
  count.
- Found and fixed the one production call site (`ai-processor.ts`'s
  `processPendingArticles`, the live cron-ingest path) broken by the new required `mode`
  parameter, setting it to `'live'` per D-08.

## Task Commits

Each task was committed atomically:

1. **Task 1: One declared length unit, and the deterministic check stage** - `28b96b6` (feat)
2. **Task 2: Verbatim-overlap scoring for CONT-07** - `f3a0f69` (feat)
3. **Task 3: The claim-level judge — span re-verification and title coverage** - `7d0c059` (feat)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified

- `915tldr.com2/server/utils/text-metrics.ts` - New. `normalizeForLength`,
  `normalizedLength`, `wordCount` — the single shared length/word-count definition.
- `915tldr.com2/server/utils/verbatim-overlap.ts` - New. `longestCommonSubstring`
  (rolling-row), `ngramPrecision`, `verbatimOverlapScore`, with two named, commented,
  provisional thresholds.
- `915tldr.com2/server/utils/grounding-check.ts` - Expanded: `runDeterministicChecks`
  export (five layers), `checkGrounding`'s new `mode` parameter, span re-verification
  against the normalised source, per-claim failure reasons, every judge failure path
  unified through one conservative-flagging catch.
- `915tldr.com2/server/utils/openai.ts` - Imports `wordCount` from `text-metrics.ts`
  instead of computing its own.
- `915tldr.com2/server/utils/ai-processor.ts` - Updated `processPendingArticles`'s
  `checkGrounding` call site to pass `mode: 'live'`.
- `915tldr.com2/tests/grounding/length-check.test.ts` - New, 17 tests.
- `915tldr.com2/tests/grounding/verbatim-overlap.test.ts` - New, 12 tests.
- `915tldr.com2/tests/grounding/judge.test.ts` - New, 11 tests (218 lines).
- `915tldr.com2/tests/grounding-check.test.ts` - Updated all 5 pre-existing tracer tests
  for the new required `mode` parameter; no behavioral changes needed.

## Decisions Made

- **`mode` is required, not defaulted.** D-08's live/backfill split is a policy choice
  every call site must make explicitly — a default risks a future call site silently
  inheriting the wrong cost posture.
- **`'one'` excluded from the word-number map** (`zero` through `twenty` otherwise
  included). `'one'` is far more often an ordinary determiner/pronoun ("one of them")
  than a number claim; including it would make the free number-presence layer noisy
  enough to be switched off. Documented as PROVISIONAL — plan 02-08's labelled fixture
  set owns tuning this.
- **A missing `claims` array now throws** rather than defaulting to an empty array. The
  previous behavior ("zero claims found" ≈ "zero problems found") was a genuine,
  closed silent-pass path — not just a theoretical one — since a malformed judge
  response would otherwise have looked identical to a clean, verified article.
- **Span containment now checked against the NFC-normalised source**, not the raw
  string, on both the judge's cited span and the source text — a whitespace
  transcription difference in the judge's citation can no longer falsely reject a real,
  present quote (the opposite failure from what the re-verification exists to catch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1's "clean summary" test fixture was actually a near-verbatim excerpt of its own source**
- **Found during:** Task 2, after wiring `verbatimOverlapScore` into `runDeterministicChecks`
- **Issue:** The fixture written in Task 1 to prove "a clean summary produces zero deterministic flags" was, on inspection, a literal prefix of its source string — not a paraphrase. Once the verbatim-overlap layer existed, it correctly flagged the fixture, which is the check working as designed against a summary that was never actually clean by CONT-07's own standard.
- **Fix:** Rewrote the fixture as a genuine paraphrase (restructured wording, same facts) so the "zero flags" assertion is a real claim about a real paraphrase.
- **Files modified:** `915tldr.com2/tests/grounding/length-check.test.ts`
- **Verification:** `pnpm vitest run tests/grounding/` (all 40 tests green after the fix)
- **Committed in:** `f3a0f69` (part of Task 2's commit)

**2. [Rule 1 - Bug] The rewritten paraphrase introduced an accidental possessive that broke proper-noun matching**
- **Found during:** Task 2, immediately after fix #1 above
- **Issue:** The rewrite's first attempt used "El Paso Independent School District's" (possessive), which the proper-noun extractor correctly captured as a distinct string from the source's "El Paso Independent School District" (no possessive) — a second, unrelated false flag from the same fixture edit.
- **Fix:** Restructured the sentence to avoid the possessive form entirely ("The board of the El Paso Independent School District...").
- **Files modified:** `915tldr.com2/tests/grounding/length-check.test.ts`
- **Verification:** `pnpm vitest run tests/grounding/length-check.test.ts` (17/17 green)
- **Committed in:** `f3a0f69` (part of Task 2's commit)

**3. [Rule 3 - Blocking issue] `ai-processor.ts`'s call site broke at typecheck when `mode` became required**
- **Found during:** Task 3, running `pnpm typecheck` after adding the required third parameter
- **Issue:** `processPendingArticles`'s `checkGrounding(...)` call — the only production call site in the codebase — was written against the old two-argument signature and failed to compile once `mode` became required.
- **Fix:** Added `mode: 'live'` to the call site, since `processPendingArticles` runs off the live cron-ingest path, which is exactly D-08's `'live'` case.
- **Files modified:** `915tldr.com2/server/utils/ai-processor.ts`
- **Verification:** `pnpm typecheck` (exits 0)
- **Committed in:** `7d0c059` (part of Task 3's commit)

---

**Total deviations:** 3 auto-fixed (2 × Rule 1 — test-fixture bugs found in earlier-task work by later-task checks doing exactly what they were built to do; 1 × Rule 3 — a real compile-breaking call site)
**Impact on plan:** All three were necessary corrections surfaced by the cascade's own layers working correctly. No scope creep — no production behavior changed beyond the plan's stated scope.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. No real OpenAI calls were made
anywhere in this plan's tests (all judge tests use a `vi.fn()` client stand-in, per the
phase's budget constraints and the plan's explicit no-real-network-calls requirement).

## Next Phase Readiness

- The full cascade (deterministic stage + claim-level judge, both `mode`s) is built,
  tested, and wired into the one live call site. `mode: 'backfill'` exists and is tested
  but has no real caller yet — plan 02-09/02-13/02-14/02-15's dry-run script is the first
  intended consumer.
- **Provisional thresholds requiring plan 02-08's labelled fixture set before they can be
  trusted at scale:** `MAX_VERBATIM_RUN_LENGTH` (100 chars), `MAX_NGRAM_PRECISION` (0.5 at
  5-gram), the `WORD_NUMBERS` word-list (excludes "one"), and the `EXCLUDED_PROPER_NOUNS`
  list (this project's own name plus its three source outlets, hardcoded rather than
  looked up per-article — `runDeterministicChecks` does accept an optional `sourceName`
  for future per-article exclusion, but no call site passes it yet).
- No schema change in this plan — migration 0007 (from 02-04) remains the only production
  D1 write for this phase.
- Full suite 151/151 (up from 111 before this plan), `pnpm typecheck` exits 0, `pnpm
  lint` exits 0 (pre-existing, unrelated warnings only), `npx drizzle-kit check` reports
  clean.

---

*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commits (`28b96b6`,
`f3a0f69`, `7d0c059`) confirmed in `git log --all` for `915tldr.com2`. This SUMMARY.md
confirmed written to `.planning/phases/02-content-quality-grounding/02-07-SUMMARY.md` in
the planning repo.

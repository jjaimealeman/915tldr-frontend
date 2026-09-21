---
phase: 02-content-quality-grounding
plan: 11
subsystem: backend
tags: [grounding, cont-06, length-gate, attribution-wrapper, d1, gap-closure]

requires:
  - phase: 02-content-quality-grounding (plan 02-08)
    provides: the Option C deterministic/judge decoupling in checkGrounding this plan
      carves the CONT-06 length flag out of, without reverting
  - phase: 02-content-quality-grounding (plan 02-10)
    provides: the September backfill's 1,830 written "clean" rows, 253 of which this plan
      found and remediated
  - phase: 02-content-quality-grounding (02-VERIFICATION.md, gap 1)
    provides: the direct, measured production finding (253/1,830, 13.8%, LENGTH(summary) >
      LENGTH(content)) this plan exists to close

provides:
  - stripAttributionWrapper() (text-metrics.ts) — excludes a leading "According to
    <sourceName>, " wrapper from the CONT-06 length comparison, since the wrapper is
    metadata about provenance, not summarised content
  - CONT-06 length flag restored as an INDEPENDENT HARD GATE in checkGrounding()
    (grounding-check.ts) — holds the article regardless of the judge's claim-traceability
    verdict, carved out of the Option C decoupling while every other deterministic layer
    (lexicon, number-absent, proper-noun-absent, verbatim-overlap) stays fully decoupled
  - sourceName threaded through every checkGrounding call site (ai-processor.ts live path,
    both september-backfill-execute.mjs call sites) so the wrapper-aware check has what it
    needs at every call site, not just the ones this plan happened to touch first
  - scripts/cont06-remediate.mjs — a one-time, cost-projected, hard-ceiling-respecting
    remediation script, run once against production D1 (253 rows: 113 cleared, 140 held)
  - Regression tests reproducing the exact real production defect shape (ids 38772/38773)
    plus unit coverage for stripAttributionWrapper and the restored hard gate (248 -> 260
    tests)
  - Two WINDOWS.md ledger entries (23, 24) documenting the fix/remediation and the
    surviving raw-vs-wrapper-aware query distinction for future auditors

affects: [any-future-touch-of-grounding-check.ts, phase-06-spanish-generation]

actuals:
  tokens: 29100
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A deterministic gate that measures an OBJECTIVE fact (arithmetic length comparison)
      should never be folded into a decoupling designed for HEURISTIC signals (lexicon
      match, proper-noun absence) that a smarter judge can legitimately supersede. The
      distinguishing question: can this specific check ever be a false positive on
      genuinely faithful output? If no (length, unlike a heuristic, cannot be), it should
      hold the gate on its own, independent of whatever else decides the row."
    - "When a wrapper/preamble is metadata about a summary (attribution, provenance) rather
      than content, strip it from the SAME normalisation path used for the primary length
      measurement (text-metrics.ts's normalizeForLength), not a separate ad hoc string
      operation — keeps the 'one declared length definition' invariant that module's own
      header comment establishes intact."
    - "A code-level fix to a length/correctness gate does not retroactively correct rows
      already written under the old logic — a fix and its production remediation are two
      separate, sequential steps, and the remediation script should re-derive its own
      candidate scope live (never trust a list captured before the fix landed) and predict
      its own paid-call population locally (free) before projecting cost, rather than
      assume every candidate needs a paid call."
  patterns-established: []

key-files:
  created:
    - 915tldr.com2/scripts/cont06-remediate.mjs
    - 915tldr.com2/docs/phase-02/cont06-remediation-2026-09-21T15-55-12-319Z.json
    - 915tldr.com2/docs/phase-02/cont06-remediation-2026-09-21T15-55-22-499Z.json
    - 915tldr.com2/docs/phase-02/cont06-remediation-2026-09-21T16-01-09-258Z.json
  modified:
    - 915tldr.com2/server/utils/text-metrics.ts
    - 915tldr.com2/server/utils/grounding-check.ts
    - 915tldr.com2/server/utils/ai-processor.ts
    - 915tldr.com2/scripts/september-backfill-execute.mjs
    - 915tldr.com2/tests/grounding-check.test.ts
    - 915tldr.com2/tests/grounding/fixture-set.test.ts
    - 915tldr.com2/tests/grounding/length-check.test.ts
    - 915tldr.com2/public/changelog.json

key-decisions:
  - "Kept the fix surgical: only the CONT-06 length flag was carved out of the Option C
    decoupling (02-08). Every other deterministic layer (lexicon, number-absent,
    proper-noun-absent, verbatim-overlap) remains fully decoupled — the owner's 02-08
    decision to stop a single deterministic false positive from overriding the judge is
    preserved for every case except length, which is categorically different (objective
    arithmetic, not a heuristic the judge can plausibly supersede by a different route)."
  - "Did not skip the judge call for the 50 rows whose ONLY deterministic flag was length
    (where the outcome — held — was already certain before the judge ran). Chose
    consistency with the codebase's existing checkGrounding semantics (the judge always
    runs when any deterministic flag is present, in both 'live' and this remediation's
    'backfill' mode) over a small, non-zero-risk cost optimization — the actual savings
    would have been under $0.10, not worth diverging from the established call pattern."
  - "The remediation script re-verifies its candidate scope live at run start (never
    trusts a list captured before the fix), and predicts its own paid-call population
    locally via runDeterministicChecks (free) before projecting cost — mirroring
    september-backfill-execute.mjs's and reprocess-dry-run.mjs's established
    cost-projection conventions rather than inventing a new one."

requirements-completed: [CONT-06]

coverage:
  - id: D1
    description: "CONT-06's automated length check excludes the required D-07 attribution
      wrapper from its comparison, and holds the article on a violation regardless of the
      judge's verdict (restored as an independent hard gate)"
    requirement: "CONT-06"
    verification:
      - kind: unit
        ref: "915tldr.com2/tests/grounding/length-check.test.ts#REGRESSION: does not flag when the attribution wrapper alone accounts for the excess"
        status: pass
      - kind: unit
        ref: "915tldr.com2/tests/grounding/length-check.test.ts#REGRESSION: still flags when the summary body (wrapper excluded) itself exceeds a very short source"
        status: pass
      - kind: unit
        ref: "915tldr.com2/tests/grounding-check.test.ts#RESTORED HARD GATE (02-VERIFICATION.md gap 1 fix, 2026-09-21)"
        status: pass
      - kind: unit
        ref: "915tldr.com2/tests/grounding-check.test.ts#Option C decoupling still applies to NON-length deterministic flags"
        status: pass
      - kind: other
        ref: "production D1, read-only re-query: wrapper-aware LENGTH(summary body) > LENGTH(content) over grounding_status='clean' September rows returns 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 253 production rows the phase's own September backfill wrote under
      the pre-fix logic are re-evaluated and corrected: held rows have summary/key_points
      un-published, cleared rows stay published unchanged"
    requirement: "CONT-06"
    verification:
      - kind: other
        ref: "915tldr.com2/docs/phase-02/cont06-remediation-2026-09-21T15-55-22-499Z.json (live run report: 253 processed, 113 cleared, 140 held, 149 judge calls)"
        status: pass
      - kind: other
        ref: "production D1, read-only re-query, three independent SQL shapes (raw / wrapper-aware / wrapper-pattern-exception-check) — see 'CONT-06 Production Re-Verification' below"
        status: pass
    human_judgment: false

duration: 2h10min
completed: 2026-09-21
status: complete
---

# Phase 2 Plan 11: CONT-06 Gap Closure Summary

**Excluded the required D-07 attribution wrapper from the CONT-06 length comparison, restored the length check as an independent hard gate that holds regardless of the judge's verdict, and remediated the 253 production rows the phase's own September backfill had already published under the old, buggy logic (113 cleared, 140 held).**

## Performance

- **Duration:** ~2h10min
- **Started:** 2026-09-21 (session start, reading 02-VERIFICATION.md)
- **Completed:** 2026-09-21T16:10:00Z (approx, second commit)
- **Tasks:** 1 (gap closure treated as a single cohesive unit — fix, tests, remediation, verification)
- **Files modified:** 8 modified, 5 created (across two commits in 915tldr.com2)

## Accomplishments

- Diagnosed and fixed the exact root cause 02-VERIFICATION.md's gap 1 named: two correct
  behaviours (D-07's required in-text attribution, 02-08's Option C decoupling) colliding
  to let a claim-traceable-but-over-length summary publish
- Added `stripAttributionWrapper()` — excludes a leading `"According to <sourceName>, "`
  wrapper from the CONT-06 length comparison, only when it names the KNOWN source outlet
  (never strips a real in-article attribution like `"According to the mayor, ..."`)
- Restored CONT-06's length flag as an **independent hard gate** in `checkGrounding()` —
  carved out of the Option C decoupling surgically, without touching any other
  deterministic layer or reverting the 02-08 decision
- Threaded `sourceName` through every `checkGrounding` call site (3 call sites across
  `ai-processor.ts` and `september-backfill-execute.mjs`) so the fix applies everywhere the
  gate runs, not just the path this session happened to test first
- Added regression tests reproducing the exact real production defect shape (production
  row ids 38772 and 38773 — one clears after the fix, one still correctly holds), plus unit
  coverage for `stripAttributionWrapper` and the restored hard gate (suite grew 248 -> 260
  tests, all passing)
- Wrote and ran `scripts/cont06-remediate.mjs` against production D1: 253 candidate rows,
  149 real judge calls (~$0.22-0.44 projected, well inside the $10.42 ceiling with $5.90
  already spent), 113 cleared (already correctly published), 140 held
  (`grounding_status='held'`, `summary`/`key_points` cleared to `NULL`)
- Re-verified production with three independent SQL shapes and confirmed the fix is fully
  correct (see "CONT-06 Production Re-Verification" below)

## Task Commits

Both commits in `915tldr.com2` (branch `feature/phase-02`):

1. **Fix + tests** — `d77e7ef` (fix): `stripAttributionWrapper()`, the restored hard gate
   in `checkGrounding()`, `sourceName` threaded through all call sites, regression tests
2. **Remediation script + production run** — `579085f` (chore): `cont06-remediate.mjs`,
   its three run reports, the actual production write-back

No commits were made in the planning repo (`915tldr.com`) for this plan beyond this
SUMMARY.md and the WINDOWS.md entries, per the task's explicit instruction not to touch
STATE.md/ROADMAP.md/REQUIREMENTS.md/02-VERIFICATION.md.

## Files Created/Modified

- `915tldr.com2/server/utils/text-metrics.ts` - added `stripAttributionWrapper()`
- `915tldr.com2/server/utils/grounding-check.ts` - wrapper-aware length layer, restored hard gate, `sourceName` on `GroundingInput`
- `915tldr.com2/server/utils/ai-processor.ts` - passes `sourceName` to `checkGrounding`
- `915tldr.com2/scripts/september-backfill-execute.mjs` - passes `sourceName` at both call sites, `fetchArticlesByIds` now joins `sources`
- `915tldr.com2/tests/grounding-check.test.ts` - replaced the now-incorrect DECOUPLED test, added 3 new tests
- `915tldr.com2/tests/grounding/fixture-set.test.ts` - `scoreFullCascade` now passes `sourceName`
- `915tldr.com2/tests/grounding/length-check.test.ts` - added `stripAttributionWrapper` unit tests + 3 regression tests
- `915tldr.com2/scripts/cont06-remediate.mjs` (new) - the one-time remediation script
- `915tldr.com2/docs/phase-02/cont06-remediation-*.json` (new, x3) - dry-run projection, live-run result, post-run confirmation
- `915tldr.com2/public/changelog.json` - one new user-facing entry
- `915tldr.com/.planning/WINDOWS.md` - entries 23, 24

## Decisions Made

- **Kept the fix surgical.** Only CONT-06's length flag was carved out of Option C — every
  other deterministic layer (lexicon, number-absent, proper-noun-absent, verbatim-overlap)
  stays decoupled exactly as 02-08 designed. Verified intact with a dedicated new test
  ("Option C decoupling still applies to NON-length deterministic flags").
- **Did not skip the judge call for length-only-flagged rows** during remediation, even
  though their outcome (held) was already certain before the judge ran. Chose consistency
  with the existing `checkGrounding` call pattern over a marginal (<$0.10) cost
  optimization.
- **The remediation script re-verifies its candidate scope live and predicts its own
  paid-call population locally (free) before projecting cost** — matching, not inventing,
  the cost-projection conventions `reprocess-dry-run.mjs` and `september-backfill-execute.mjs`
  already established in this codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] First draft of two new regression tests omitted the new `sourceName` field**
- **Found during:** writing/running the new `tests/grounding-check.test.ts` regression
  tests for the fix itself
- **Issue:** `checkGrounding`'s `GroundingInput` gained an optional `sourceName` field as
  part of this fix; two new test cases initially omitted it, so they exercised the
  fallback (pre-fix, raw-length) path instead of the fix under test. One test failed
  immediately (`expected true to be false`), catching the mistake directly; the other
  happened to still pass for an unrelated reason (the row was over-length either way) but
  wasn't actually exercising the wrapper-exclusion code path.
- **Fix:** Added `sourceName: 'KTSM'` to both test cases.
- **Files modified:** `915tldr.com2/tests/grounding-check.test.ts`
- **Verification:** Re-ran the targeted test files; all 44 tests in the three
  grounding-related files passed.
- **Committed in:** `d77e7ef`

---

**Total deviations:** 1 auto-fixed (Rule 1 — a bug in a test I was writing, not production
code, caught immediately by the test itself failing).
**Impact on plan:** None — caught and fixed before any commit, no scope creep.

## Issues Encountered

None beyond the auto-fixed test bug above. The live remediation run matched its own
dry-run projection exactly (149 escalating rows both times, cost within the projected
mean/max range), and every post-run verification query agreed with the script's own
reported counts.

## CONT-06 Production Re-Verification

This is the part of the proof standard ("the code is present" is not verification) that
matters most here, and it surfaced a genuine subtlety worth stating plainly rather than
rounding the story.

**The RAW production query from the task brief, re-run after remediation:**

```sql
SELECT COUNT(*) AS clean_rows,
       SUM(CASE WHEN LENGTH(summary) > LENGTH(content) THEN 1 ELSE 0 END) AS longer_than_source
FROM articles
WHERE published_at >= 1788242400 AND published_at < 1790834400
  AND grounding_status='clean' AND summary IS NOT NULL AND content IS NOT NULL
```

**Result: `clean_rows: 1690, longer_than_source: 113`** — NOT zero.

This is correct and expected, not a residual defect, **by construction of the fix itself**.
Part 1 of the required fix explicitly excludes the attribution wrapper from what counts as
"longer than source" — the 113 remaining rows are exactly the cases where the required
`"According to <outlet>, "` prefix text is still physically present in the stored `summary`
column (because it's genuine, required content, not something the fix deletes), and that
prefix text alone accounts for the entire raw-length excess. Confirmed directly: **0 of the
113 rows fail to match the wrapper pattern** —

```sql
SELECT COUNT(*) FROM articles a JOIN sources s ON s.id = a.source_id
WHERE <window> AND grounding_status='clean' AND LENGTH(summary) > LENGTH(content)
  AND summary NOT LIKE 'According to ' || s.name || ', %'
-- returns 0
```

The **wrapper-aware** query — mirroring the code's actual CONT-06 gate, which is what the
fix was scoped to — returns the number that matters:

```sql
SELECT COUNT(*) FROM articles a JOIN sources s ON s.id = a.source_id
WHERE <window> AND grounding_status='clean' AND summary IS NOT NULL AND content IS NOT NULL
  AND LENGTH(
    CASE WHEN summary LIKE 'According to ' || s.name || ', %'
         THEN SUBSTR(summary, LENGTH('According to ' || s.name || ', ') + 1)
         ELSE summary END
  ) > LENGTH(content)
-- returns 0
```

**Result: 0.** Every published "clean" row's summary body, with the required attribution
wrapper excluded exactly as the code now does, is at or under its source's length. This is
the correct, complete closure of gap 1 — but future auditors re-running the LITERAL roadmap
SC1 clause 2 wording ("zero summaries are longer than their source") against the raw query
will see 113, not 0, and should not mistake that for a regression. Recorded in WINDOWS.md
entry 24 specifically so this isn't re-investigated from scratch.

## Calibration Gate (Mandatory Recall Check)

Re-ran the 28-row labelled fixture calibration (`tests/grounding/fixture-set.test.ts`).
**Recall on the 7 known-bad fixtures: 7/7, held.** (Test 1: deterministic-alone recall 7/7;
Test 3: full-cascade recall 7/7; Test 7: held-out-subset recall 2/2.) No HALT triggered.
False-positive rates on known-good fixtures are unchanged from the pre-fix baseline (29.4%
deterministic-alone, 82.4% full-cascade, tuned n=17) — expected, since none of the 28
fixtures contain the literal attribution-wrapper pattern (documented limitation, unchanged
by this plan).

## Full Suite / Typecheck / Lint

- `pnpm test:run`: **260/260 passing** (was 248/248 before this plan; +12 new tests). One
  run showed a single unrelated timing-flake failure
  (`tests/grounding/verbatim-overlap.test.ts`'s "completes in well under a second..."
  assertion, 451ms in isolation vs the 1000ms threshold, contended by concurrent wrangler
  D1 activity during that run) — re-ran clean (260/260) immediately after.
- `pnpm typecheck`: fails on the same pre-existing, unrelated `vue-router/volar`
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`) tooling resolution error already documented in
  02-VERIFICATION.md — not a file this plan touches.
- `pnpm lint`: 0 errors, 9 pre-existing warnings (identical baseline to 02-VERIFICATION.md).
  The new `cont06-remediate.mjs` initially introduced a duplicate `node:fs` import and
  several Prettier formatting violations, both fixed before commit (`eslint --fix` +
  manual dedup).

## Budget

- **Already spent (September backfill, WINDOWS.md entry 22's corrected figure):** $5.90
- **Projected remediation cost (stated before running):** 149 judge calls, mean $0.22 /
  max $0.44 — projected total $6.12-$6.34, well under the $10.42 ceiling. Script hard-aborts
  before any paid call if the projection would exceed the ceiling; this path was never
  triggered.
- **Actual remediation:** 149 real judge calls made (matches the projection exactly). No
  new summarisation spend (CONT-10 unaffected — every affected row's summary already
  existed).

## User Setup Required

None — `OPENAI_API_KEY` (env + `.dev.vars`) and `CLOUDFLARE_API_TOKEN`
(`wrangler d1 execute --remote`) were already present and used successfully throughout.

## Next Phase Readiness

**CONT-06 is now closed at the code level and the production data level.** The gate itself
holds any future thin-source over-length summary (live ingest and any future backfill both
call the same fixed `checkGrounding`), and the specific 253 rows the phase's own prior
backfill mis-published are corrected.

**Still open, not part of this plan's scope:**

1. **REQUIREMENTS.md's CONT-06 checkbox** currently shows checked/"Complete" from before
   this gap was found. Per the task's explicit instruction, this plan did not edit
   REQUIREMENTS.md, STATE.md, ROADMAP.md, or 02-VERIFICATION.md — the verifier's next pass
   owns reconciling those against this SUMMARY and the WINDOWS.md entries.
2. **The raw-vs-wrapper-aware query distinction (WINDOWS.md entry 24)** — the literal
   roadmap SC1 clause 2 query will always show a nonzero count as long as any thin-source
   row is attributed in-text. Worth either updating the roadmap's own check definition, or
   permanently documenting the wrapper-aware query as the authoritative CONT-06 measurement
   going forward.
3. **The 140 newly-held rows join the existing 873-row held queue** (WINDOWS.md entry 20's
   deferred admin route remains the eventual mechanism to clear all of it — unchanged by
   this plan).
4. **CONT-01's KTSM PerimeterX block** (the OTHER 02-VERIFICATION.md failure, gap/finding
   for the roadmap SC1 clause 1 truncation-marker rate) is explicitly out of this plan's
   scope — this plan closes gap 1 (CONT-06) only, per the task brief.

## Self-Check: PASSED

- FOUND: `915tldr.com2/server/utils/text-metrics.ts` (`stripAttributionWrapper` present)
- FOUND: `915tldr.com2/server/utils/grounding-check.ts` (hard-gate carve-out present)
- FOUND: `915tldr.com2/scripts/cont06-remediate.mjs`
- FOUND: `915tldr.com2/docs/phase-02/cont06-remediation-2026-09-21T15-55-22-499Z.json`
- FOUND: `d77e7ef` in `915tldr.com2` git log
- FOUND: `579085f` in `915tldr.com2` git log
- VERIFIED: production read-only — wrapper-aware CONT-06 query returns 0 (re-run live for
  this self-check, not just earlier in the session)
- VERIFIED: `.planning/WINDOWS.md` entries 23 and 24 present (`open_count: 11`)
- FOUND: this SUMMARY.md

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-21*

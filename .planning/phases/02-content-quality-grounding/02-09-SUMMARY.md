---
phase: 02-content-quality-grounding
plan: 09
subsystem: backend
tags: [openai, gpt-5.6-luna, js-tiktoken, cost-estimation, d1, wrangler, ops-11]

requires:
  - phase: 02-content-quality-grounding (plans 02-05, 02-07, 02-08)
    provides: content-length measurements (D-04 cap, per-source distribution), the
      grounding-check deterministic cascade (runDeterministicChecks), and the
      calibration fixture set/captured judge responses this plan reuses for token
      counting without any new paid API call

provides:
  - A validated token-counting and cost-projection module
    (server/utils/cost-estimate.ts) — o200k_base encoding, an explicit
    display-vs-threshold rounding contract, and correction constants measured
    against 10 real gpt-5.6-luna billed calls
  - The free half of the OPS-11 gate (scripts/reprocess-dry-run.mjs) — a whole-corpus
    sweep with zero paid calls, unioned with the CONT-12 outage window, producing a
    timestamped report + JSON the plan-02-10 execute run must be pointed at
  - A re-derived, real re-processing cost figure superseding PROJECT.md's stale
    ~$7.44 estimate — see the checkpoint below

affects: [02-10-batch-reprocessing-execute]

actuals:
  tokens: 38000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Measured-constant token estimation: rather than importing a forbidden module or
      hand-copying prompt text, derive fixed per-request token overheads empirically
      from real billed usage (subtract counted variable content from the real
      prompt_tokens total) and store the result as a dated, provenance-commented
      constant"
    - "Structural import-boundary enforcement: a script that must never reach a paid
      API proves it via its own import list (grep-assertable), not a runtime check or
      a comment"
    - "Self-contained module-resolution hook: when Node's plain ESM loader can't
      resolve a bundler-oriented codebase's extensionless relative imports, register a
      tiny resolve-hook retry confined to the one function that needs it, rather than
      hand-duplicating the imported module's logic a third time"

key-files:
  created:
    - server/utils/cost-estimate.ts
    - scripts/reprocess-dry-run.mjs
    - scripts/judge-prompt-mirror.mjs
    - tests/reprocess/cost-estimate.test.ts
    - tests/reprocess/dry-run.test.ts
    - docs/phase-02/tokenizer-validation.md
    - docs/phase-02/reprocess-dry-run-2026-09-20T05-17-50-566Z.md
    - docs/phase-02/reprocess-dry-run-2026-09-20T05-17-50-566Z.json
  modified:
    - scripts/capture-judge-responses.mjs
    - server/utils/grounding-check.ts
    - .planning/phases/02-content-quality-grounding/02-VALIDATION.md

key-decisions:
  - "Judge-stage cost projected at the STANDARD (synchronous) rate, not the Batch
    rate — no decision has been made yet that the judge call itself will run via
    Batch, and using the higher rate is the conservative choice for an OPS-11 figure"
  - "Per-source fabrication-only-vs-length-improved classification derived from a
    row's own content-presence plus a thin-source-id set computed from
    corpus-measurements.json's measured per-source p50 (not acquisitionStatus alone,
    since every existing row currently defaults to 'feed_fallback' from the
    migration 0007 column-add and doesn't yet distinguish anything for the archive)"
  - "Reprocess-dry-run.mjs carries no shebang, unlike sibling scripts — it contains a
    dynamic import() that collides with Vite's SSR HMR-injection when the file also
    starts with a shebang, breaking the Vitest import this plan's own tests depend on"

patterns-established:
  - "A cost projection states BOTH a mean case and a max case (from measured real
    output-token distributions), never a single figure — CONT-09's own 'explicit
    uncertainty, not false precision' requirement, generalizable to any future
    LLM-cost-projection work in this codebase"

requirements-completed: [CONT-09, CONT-12, OPS-11]

coverage:
  - id: D1
    description: "Token counting (o200k_base, never the model-name lookup) and a
      two-function rounding contract (half-up display vs ceiling-to-cent OPS-11
      threshold), validated to 0.67% mean divergence against 10 real gpt-5.6-luna
      billed calls"
    requirement: "CONT-09"
    verification:
      - kind: unit
        ref: "tests/reprocess/cost-estimate.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The free corpus sweep (scripts/reprocess-dry-run.mjs) — whole-corpus
      deterministic checks, CONT-12 outage-window union, judge-stage and batch-stage
      cost projection, structurally incapable of calling anything paid or re-fetching
      source pages"
    requirement: "CONT-12"
    verification:
      - kind: unit
        ref: "tests/reprocess/dry-run.test.ts (17 tests)"
        status: pass
      - kind: integration
        ref: "node scripts/reprocess-dry-run.mjs (full, unlimited run against production D1 — docs/phase-02/reprocess-dry-run-2026-09-20T05-17-50-566Z.md)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The re-derived re-processing cost figure ($80.01 combined mean case)
      that supersedes PROJECT.md's stale ~$7.44 estimate, and whether the underlying
      ~99% deterministic-flag rate represents genuine CONT-06/CONT-04 violations
      worth that spend versus detector noise on legacy pre-fix content"
    requirement: "OPS-11"
    verification: []
    human_judgment: true
    rationale: "This is exactly the owner-approval decision OPS-11's structural gate
      exists to require — a dollar figure this large, this far above the previously
      published estimate, cannot be auto-approved by design. Whether the flag rate
      itself is trustworthy also requires editorial judgment 02-08's own calibration
      work explicitly could not resolve from fixture data alone."

duration: 55min
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 9: Re-processing Dry Run — Cost Estimator and Corpus Sweep Summary

**Token-counting/cost-projection module validated to 0.67% divergence against real gpt-5.6-luna billing, plus a whole-corpus deterministic sweep that found the real re-processing cost is $80.01 (combined mean case) — roughly 10-11x PROJECT.md's stale $7.44 figure.**

## Performance

- **Duration:** ~55 min (includes a ~20-minute unattended full-corpus sweep)
- **Started:** 2026-09-19T22:36:00Z (approx.)
- **Completed:** 2026-09-19T23:25:00Z (approx.)
- **Tasks:** 3 of 3
- **Files modified:** 14 (8 created + 3 modified in `915tldr.com2`; 3 files across both repos for validation/tracking)

## CHECKPOINT — read before running plan 02-10

**The re-derived combined cost projection is $80.01 (mean case) to $144.13 (max case) — dramatically higher than PROJECT.md's stale ~$7.44 batched-backfill figure, and this was expected/flagged for re-derivation (D-CAUTION-1), but not at this magnitude.** This crosses the "reach the owner before 02-10 runs" threshold this plan's own checkpoint guidance names.

**What was measured, and how:**

- Judge-stage cost (D-08, judging the 37,447 deterministically-flagged rows before the
  confirmed set is known): **$58.85** mean case, $114.63 max case, at the standard
  (synchronous) `gpt-5.6-luna` rate.
- Batch-stage cost (D-13, re-summarising the full 39,376-row union at the Batch API's
  50%-discount rate, as an upper bound assuming every flagged candidate is confirmed):
  **$21.16** mean case, $29.50 max case.
- Combined: **$80.01** mean case, **$144.13** max case. Both figures reach the OPS-11 $1
  threshold by roughly two orders of magnitude.
- Estimator accuracy is NOT the source of this number's size: `server/utils/cost-estimate.ts`
  was validated against 10 real billed `gpt-5.6-luna` calls and diverges only 0.67% on the
  input-token side (see `docs/phase-02/tokenizer-validation.md`).

**Why the number is this large — the affected-row count, not the per-article cost:**

- The full unlimited sweep found **39,376 of 41,932 total corpus rows affected** (37,447
  deterministically flagged + 1,929 outage-window-only + 111 both). That is essentially
  the entire processed corpus (37,674 rows), not a targeted subset.
- The dominant driver is the free deterministic cascade's own flag rate against the
  REAL, un-sampled corpus: `runDeterministicChecks`'s five layers (length, advisory
  lexicon, number presence, proper-noun presence, verbatim overlap), OR'd together,
  flag essentially every row that has both a summary and content. `corpus-measurements.md`
  already recorded the length layer alone at 41.7% of summarized rows (15,705 of
  37,639) — the other four layers, run for the first time against the full corpus
  rather than a hand-picked fixture set, push the combined rate to ~99%.
- **This is consistent with, not contradictory to, plan 02-08's own explicit warning**:
  02-08's calibration (28 fixtures) measured the full-cascade false-positive rate on
  KNOWN-GOOD legacy summaries at 88–91%, and stated plainly that "every fixture in this
  calibration is a pre-fix, legacy production summary... The true false-positive rate
  against post-fix summaries is unmeasured." This plan's full-corpus sweep is the SAME
  finding, now visible at 37,674-row scale instead of a 21-row good-fixture sample —
  it is evidence 02-08's caveat was correct, not a new, separate defect.

**The decision this surfaces, which this plan does NOT make:**

Is the ~99% flag rate a genuine finding (the pre-fix legacy corpus really is this
padded/fabrication-prone, which is exactly the defect this whole phase exists to fix)
or is it substantially detector noise from the number-presence/proper-noun-presence
layers running unfiltered at scale for the first time? Both are plausible, and this
plan's job — build the free estimator and produce the real number — is done regardless
of which is true. Distinguishing them is an editorial/product judgment 02-08 already
declined to make from fixture data alone, and now has a real-money consequence attached.
**Recommend reviewing this finding, and possibly revisiting the deterministic cascade's
noisier layers against a small post-fix sample, before plan 02-10 is approved to spend
against it.**

## Accomplishments

- `server/utils/cost-estimate.ts`: `countTokens` (o200k_base via `getEncoding`, never
  the model-name lookup), `roundCentsHalfUp`/`ceilCents` as two distinct, explicitly
  documented functions (display vs. OPS-11 threshold), `projectRequestCost`/
  `projectBatchCost`, and eight measured correction constants (fixed request overhead,
  mean/max real output tokens, judge visible-to-total ratio, prompt-template token
  counts) — all sourced from a real 10-row validation run against production content,
  not assumed.
- `docs/phase-02/tokenizer-validation.md`: the validation methodology, results (0.67%
  mean input divergence; an 18.6% undercount from a naive visible-text-only output
  estimate, concretely demonstrating the reasoning-token caveat), `gpt-5.6-luna` pricing
  cited from two independent same-day sources, and the validation run's own real cost
  ($0.011242).
- `scripts/reprocess-dry-run.mjs`: the free half of the OPS-11 gate (D-15) — Stage A
  whole-corpus SQL predicates (zero data transfer), Stage B paginated local sweep
  running the real `runDeterministicChecks` cascade (37,576 rows, ~153MB transferred in
  the full run), unioned with the CONT-12 outage window (bounds read from
  `corpus-measurements.json`, never recomputed by hand), judge-stage and batch-stage
  cost projection, a corpus fingerprint the execute run must re-check, and a
  per-source fabrication-only-vs-length-improved breakdown. Structurally incapable of
  calling anything paid or reaching the local Miniflare replica — both enforced by the
  import list and the D1-read helper's hardcoded `--remote` flag, not a runtime check.
- `scripts/judge-prompt-mirror.mjs`: the judge prompt text extracted into a shared,
  zero-dependency module so both `capture-judge-responses.mjs` (real API calls) and
  `reprocess-dry-run.mjs` (must never import `openai`) count tokens against the exact
  same text without a third hand-copy.
- 32 new unit tests across `tests/reprocess/cost-estimate.test.ts` (15) and
  `tests/reprocess/dry-run.test.ts` (17), all pure/in-memory — no database, no network.
- The full, unlimited corpus sweep was executed (not just the required `--limit 200`
  smoke run) and its report/JSON committed, satisfying the plan's own verification
  block ahead of the checkpoint above.
- `.planning/phases/02-content-quality-grounding/02-VALIDATION.md` reconciled against
  reality for every task in plans 02-01 through 02-09.

## Task Commits

Each task was committed atomically, in `915tldr.com2` (`feature/phase-02`):

1. **Task 1: Token counting, Batch cost projection, rounding contract** - `ece4e5a` (feat)
2. **Task 2: Corpus sweep, outage-window union, OPS-11 cost report** - `704e5be` (feat)
3. **Task 3: Dry-run unit tests — set arithmetic, zero rows, OPS-11 boundary** - `12e13cf` (test)

**Validation-map reconciliation** (planning repo, `915tldr.com`, `feature/phase-02`): `7f5531d` (docs)

**Plan metadata:** this commit (docs: complete plan)

_Note: Task 1 and Task 2 each include a small number of supporting edits beyond their
named file — see Deviations below for exactly what and why._

## Files Created/Modified

- `915tldr.com2/server/utils/cost-estimate.ts` — token counting, cost projection, rounding contract, measured constants
- `915tldr.com2/scripts/reprocess-dry-run.mjs` — the free OPS-11 sweep/report script
- `915tldr.com2/scripts/judge-prompt-mirror.mjs` — shared judge-prompt text, zero dependencies
- `915tldr.com2/scripts/capture-judge-responses.mjs` — refactored to use the shared prompt mirror
- `915tldr.com2/server/utils/grounding-check.ts` — `ADVISORY_PHRASES` now exported
- `915tldr.com2/tests/reprocess/cost-estimate.test.ts` — 15 tests
- `915tldr.com2/tests/reprocess/dry-run.test.ts` — 17 tests
- `915tldr.com2/docs/phase-02/tokenizer-validation.md` — validation methodology and results
- `915tldr.com2/docs/phase-02/reprocess-dry-run-2026-09-20T05-17-50-566Z.md` / `.json` — the full-corpus report
- `.planning/phases/02-content-quality-grounding/02-VALIDATION.md` — reconciled
- `.planning/phases/02-content-quality-grounding/deferred-items.md` — new, out-of-scope items logged

## Decisions Made

- **Judge-stage cost uses the standard (synchronous) rate, not Batch** — no decision
  exists yet that the judge call will run via Batch API, so the higher, conservative
  rate is used for the OPS-11 figure rather than assuming a discount not yet designed in.
- **Thin-source classification derived from measured corpus data, not acquisitionStatus
  alone** — every existing row's `acquisitionStatus` currently defaults uniformly to
  `feed_fallback` (the column was only just added by migration 0007), so it cannot yet
  distinguish anything for the archive; the per-source rollup instead uses each row's
  actual content presence plus a thin-source-id set derived from
  `corpus-measurements.json`'s measured per-source p50 content length.
- **`reprocess-dry-run.mjs` carries no shebang** — it contains a dynamic `import()` (for
  the module-resolution workaround below), and Vite's SSR transform injects HMR-support
  boilerplate at byte offset 0 of any module with a dynamic import, colliding with a
  shebang there and breaking `tests/reprocess/dry-run.test.ts`'s import of this file.
  The script is always invoked as `node scripts/reprocess-dry-run.mjs`, never executed
  directly, so this costs nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `grounding-check.ts`'s internal extensionless imports break plain-Node resolution**
- **Found during:** Task 2 (writing `scripts/reprocess-dry-run.mjs`)
- **Issue:** The plan's own verify command requires `node scripts/reprocess-dry-run.mjs --limit 200` to run under PLAIN `node` — but `grounding-check.ts` imports `./text-metrics` and `./verbatim-overlap` without a file extension, which Nuxt/Vite's bundler resolves fine but Node's own ESM loader cannot resolve at all when the script is invoked directly.
- **Fix:** Registered a small, self-contained `node:module` resolve hook (confined entirely inside `loadGroundingCheck()`, called only from `main()` — never at module top-level) that retries a failed extensionless relative import with `.ts` appended. This lets the script import the REAL `runDeterministicChecks`/`ADVISORY_PHRASES` rather than a third hand-copy of that logic (the established alternative pattern already present in `capture-judge-responses.mjs`/`build-grounding-fixtures.mjs`).
- **Files modified:** `scripts/reprocess-dry-run.mjs`
- **Verification:** `node scripts/reprocess-dry-run.mjs --limit 200` runs to completion and produces a valid report.
- **Committed in:** `704e5be` (Task 2 commit)

**2. [Rule 1 - Bug] Dynamic import + shebang breaks the Vitest import this plan's own tests need**
- **Found during:** Task 3 (writing `tests/reprocess/dry-run.test.ts`)
- **Issue:** `RollupError: Parse failure: Expected ident` when Vitest tried to import `scripts/reprocess-dry-run.mjs`'s pure functions — Vite's SSR transform injects an HMR-support import at byte offset 0 of any module containing a dynamic `import()`, colliding with the file's `#!/usr/bin/env node` shebang there.
- **Fix:** Removed the shebang (the script is always invoked as `node scripts/reprocess-dry-run.mjs`, never executed directly, so this has zero functional cost) and moved all top-level `await import(...)` calls into `main()` so the module has no top-level await either, for defense in depth.
- **Files modified:** `scripts/reprocess-dry-run.mjs`
- **Verification:** `pnpm vitest run tests/reprocess/dry-run.test.ts` — 17/17 pass.
- **Committed in:** `704e5be` (the fix landed before Task 2's commit, discovered while building Task 3)

**3. [Rule 1 - Bug] "Applies to the FULL union" was factually wrong for a `--limit` partial run**
- **Found during:** Manual review of a `--limit 200` smoke-test report
- **Issue:** The batch-stage and judge-stage report sections stated the projection "applies to the FULL union (N rows)" / "the N deterministically-flagged rows" regardless of whether a `--limit`-truncated Stage B sweep actually computed tokens for all of them — for a partial run, the true covered-row count was far smaller, making the stated cost silently understate reality without saying so.
- **Fix:** Track and report the actual covered-row count (`judgeTallyMean.length` / `batchTallyMean.length`) alongside the target count, with an explicit "PARTIAL COVERAGE" callout when they differ, in both the Markdown report and the JSON (`judge.coveredRowCount`/`targetRowCount`, `batch.coveredRowCount`/`targetRowCount`).
- **Files modified:** `scripts/reprocess-dry-run.mjs`
- **Verification:** Re-ran `--limit 200`; report now correctly states "PARTIAL COVERAGE: token totals below cover only 198 of these 16377 rows."
- **Committed in:** `704e5be` (Task 2 commit)

**4. [Rule 1 - Bug] Estimator-divergence figure silently rendered "null%"**
- **Found during:** Manual review of a `--limit 200` smoke-test report
- **Issue:** The regex extracting `tokenizer-validation.md`'s "Mean absolute divergence: 0.67%" figure didn't match the doc's actual Markdown bold-wrapping (the whole phrase is bolded, not just the number), so the report silently showed "null%" instead of the real figure.
- **Fix:** Corrected the regex to match the actual format.
- **Files modified:** `scripts/reprocess-dry-run.mjs`
- **Verification:** Re-ran; report now correctly states "0.67%."
- **Committed in:** `704e5be` (Task 2 commit)

**5. [Rule 3 - Blocking] `ADVISORY_PHRASES` was module-private, needed by the dry-run script's Stage A SQL predicate**
- **Found during:** Task 2 (writing Stage A's advisory-lexicon SQL query)
- **Issue:** `grounding-check.ts`'s `ADVISORY_PHRASES` const was not exported; hand-duplicating the 17-phrase list in the dry-run script would have created a second, driftable copy.
- **Fix:** Added `export` to the existing declaration — a one-line, mechanical, backward-compatible change with zero behavior impact on existing importers.
- **Files modified:** `server/utils/grounding-check.ts`
- **Verification:** `pnpm vitest run tests/grounding-check.test.ts` — 6/6 pass (unaffected); full suite green.
- **Committed in:** `704e5be` (Task 2 commit)

**6. [Rule 1 - Bug] Judge prompt text duplicated inline in `capture-judge-responses.mjs`, blocking safe reuse**
- **Found during:** Task 2 (needing judge-prompt token counting without importing `openai`)
- **Issue:** `capture-judge-responses.mjs`'s `buildPrompts` function (the judge prompt mirror) was defined inline in a file that also does `import OpenAI from 'openai'` — importing it directly from `reprocess-dry-run.mjs` would have transitively pulled in the `openai` package, undermining the structural "never imports openai" guarantee even though no client method would ever be called.
- **Fix:** Extracted the function into a new, zero-dependency `scripts/judge-prompt-mirror.mjs`, imported by both scripts.
- **Files modified:** `scripts/capture-judge-responses.mjs` (refactored), `scripts/judge-prompt-mirror.mjs` (new)
- **Verification:** `node --check scripts/capture-judge-responses.mjs`; `node scripts/reprocess-dry-run.mjs --limit 200` succeeds using the shared module; full test suite green.
- **Committed in:** `704e5be` (Task 2 commit)

---

**Total deviations:** 6 auto-fixed (4 Rule 1 bug fixes, 2 Rule 3 blocking-issue fixes)
**Impact on plan:** All auto-fixes were necessary for the plan's own verification commands to pass or for report accuracy; none expanded scope beyond what Tasks 1-3 already required. No architectural changes (Rule 4) were needed.

## Issues Encountered

The full, unlimited corpus sweep took approximately 20 minutes (1,209.8s per the report's
own sweep stats) — driven by wrangler's per-query process-startup overhead across ~76
Stage B pages plus ~185 chunked lookups (acquisition-status resolution, outage-only
content fetch), not by any inefficiency in the query logic itself. Run in the background
while other plan work continued; no other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 02-09's own deliverables are complete and verified.** Plan 02-10 (the paid
execute half of the OPS-11 gate) should NOT proceed to spend against this report without
the owner reviewing the checkpoint above first — the combined $80.01 mean-case figure is
real, validated math over a real corpus state, but the underlying ~99% deterministic-flag
rate is a genuine open question this plan's own tools cannot resolve (editorial judgment
02-08 already declined to make from limited fixture data). The report file
(`docs/phase-02/reprocess-dry-run-2026-09-20T05-17-50-566Z.md`/`.json`) and its
`corpusFingerprint` are what 02-10 must be pointed at and must re-verify before spending
anything.

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk in `915tldr.com2` and this
planning repo. All 4 commits (`ece4e5a`, `704e5be`, `12e13cf` in `915tldr.com2`;
`7f5531d` in `915tldr.com`) confirmed present in their respective git logs.

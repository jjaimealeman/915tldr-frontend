---
phase: 05-hybrid-archive-zero-reads-proof
plan: 16
subsystem: testing
tags: [d1-analytics, cloudflare-graphql, tdd, zero-reads-gate, arch-01]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-04/05-12's zero-reads gate instrument (tools/load-test-zero-reads.mjs) and the 2026-10-01 recorded ZERO_READS_PROVEN run, plus 05-REVIEW.md's CR-03 finding"
provides:
  - "runLoadTest's load window and the 7 comparableWindows baseline windows are now structurally guaranteed to cover identical duration and identical 5-minute-bucket boundaries"
  - "A permanent regression test (CR-03 (05-16)) locking that guarantee in place"
  - "A corrected, measured (not estimated) re-check of the 2026-10-01 recorded verdict, recorded additively in docs/phase-05/zero-reads-gate.md"
affects: [05-21 (requirements closure), any future phase-05 gap-closure plan that re-runs the zero-reads gate]

# Actuals (#2632)
actuals:
  tokens: 3496
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One aligned window object built once and threaded through every D1-analytics call site (ingest-slot check, catch-up poll, rowsRead query, baseline derivation) instead of re-deriving alignment at each call site independently"

key-files:
  created:
    - docs/phase-05/evidence/gate-20261001T203348Z/load-window-aligned-recheck.json
  modified:
    - tools/load-test-zero-reads.mjs
    - tests/unit/load-test-zero-reads.test.mjs
    - docs/phase-05/zero-reads-gate.md

key-decisions:
  - "Fixed the asymmetry structurally: one `alignedLoad` window built once in `runLoadTest` feeds the ingest-slot check, the catch-up poll, the rowsRead query, and the baseline derivation, rather than patching each D1-analytics call site to align its own window independently."
  - "Kept the raw as-sent window as `requestWindow` (evidence/result field only, never used to query D1) rather than discarding it — the plan's must_haves required both to be visible to a reader."
  - "Re-checked the recorded 2026-10-01 verdict with a real read-only re-query of the aligned window rather than trusting 05-REVIEW.md's own ×10/9 estimate — the measured correction (2,183,097) differs from the estimate (~1.87M) by about 17%, confirming the estimate was in the right direction but not a substitute for a real measurement."
  - "Treated this plan's Task 1 (type=tracer, tdd=true) as satisfying the autonomous tracer-feedback gate: its automated <verify> (node --test + pnpm test:fast) was run and confirmed green before Task 2 began, per the plan's own `autonomous: true` frontmatter and the project's feature-branch autonomous-mode convention — no human-verify checkpoint was inserted between Task 1 and Task 2."

patterns-established:
  - "D1-analytics window alignment: any future tool that compares a 'now' window against historical comparable windows must build ONE aligned window object and pass that same object (or an unmodified derivative of it) to every comparison call site — never re-derive alignment per call site, which is exactly how CR-03 happened."

requirements-completed: []  # ARCH-01 is NOT marked complete here per the execution contract — REQUIREMENTS.md closure is owned by 05-21. This plan only fixes/re-verifies ARCH-01's own instrument.

coverage:
  - id: D1
    description: "The load window and the 7 baseline windows are aligned identically (equal duration, equal minute-of-hour boundaries) in every future gate run"
    requirement: "ARCH-01"
    verification:
      - kind: unit
        ref: "tests/unit/load-test-zero-reads.test.mjs#CR-03 (05-16): load and baseline windows are aligned identically"
        status: pass
      - kind: unit
        ref: "node --test tests/unit/load-test-zero-reads.test.mjs (54/54)"
        status: pass
      - kind: unit
        ref: "pnpm run test:fast (695/695)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 2026-10-01 recorded ZERO_READS_PROVEN verdict is re-checked against real, aligned D1 analytics data (not an estimate) and confirmed to remain within the 3-sigma threshold"
    requirement: "ARCH-01"
    verification:
      - kind: other
        ref: "docs/phase-05/evidence/gate-20261001T203348Z/load-window-aligned-recheck.json (live fetchD1RowsRead re-query, rowsRead=2183097)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 16: Zero-reads gate window-alignment fix (CR-03) Summary

**Fixed the zero-reads gate's measurement asymmetry structurally with one aligned window shared by every D1-analytics call site, locked it in with a regression test, and re-confirmed the 2026-10-01 ZERO_READS_PROVEN verdict against a real read-only re-query (2,183,097 rowsRead, z=-0.7585), not an estimate.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-10-02T21:25:00Z (approx)
- **Completed:** 2026-10-02T21:33:15Z
- **Tasks:** 2
- **Files modified:** 4 (2 source/test, 1 doc, 1 new evidence file)

## Accomplishments

- Fixed `runLoadTest`'s structural measurement bias: the load window now goes through the identical
  5-minute outward-alignment (`floorToFiveMinutes`/`ceilToFiveMinutes`) that `comparableWindows()`
  already applies to the 7 baseline windows, via one `alignedLoad` object threaded through the
  ingest-slot check, the analytics catch-up poll, the `rowsRead` query, and the baseline derivation.
- Added a permanent regression test (`CR-03 (05-16)`) that fails if this alignment ever drifts apart
  again — confirmed RED against the pre-fix code (load query started at the raw
  `03:27:13.000Z` instead of the aligned `03:25:00.000Z`), then GREEN after the fix.
- Re-checked the one recorded `ZERO_READS_PROVEN` verdict (2026-10-01) with a real, read-only D1
  analytics re-query of the correctly aligned window — not the review's own ×10/9 estimate. Measured
  `rowsRead` = 2,183,097, corrected z = −0.7585, well within the 3σ threshold (9,913,212.29) and
  below every one of the 7 recorded baseline windows. The verdict stands, confirmed on measured data.
- Recorded the correction additively in `docs/phase-05/zero-reads-gate.md` — `git diff` shows
  insertions only; the original verdict line and recorded numbers are untouched, per the plan's own
  transparency prohibition (T-05-54).

## Task Commits

Each task was committed atomically (Task 1 is a TDD cycle split into its own RED/GREEN commits):

1. **Task 1 (RED): CR-03 regression test** - `1354152` (test)
2. **Task 1 (GREEN): align the load window** - `f79816c` (fix)
3. **Task 2: live re-check + recorded correction** - `32ebf21` (docs)

_No separate plan-metadata commit beyond the state/roadmap update below — this plan's docs task IS
the final content commit; STATE.md/ROADMAP.md are committed in the standard final metadata commit._

## Files Created/Modified

- `tools/load-test-zero-reads.mjs` — `runLoadTest` builds `alignedLoad`/`requestWindow`; every
  D1-analytics call site (ingest-slot check, catch-up poll, `fetchD1RowsRead`, `comparableWindows`)
  now uses `alignedLoad`; result object gains `requestWindow`; `load-window.json` evidence gains
  `requestWindow`.
- `tests/unit/load-test-zero-reads.test.mjs` — new test "CR-03 (05-16): load and baseline windows
  are aligned identically" (recording-fetchImpl variant of the existing `fullPassFetchImpl` fixture).
- `docs/phase-05/zero-reads-gate.md` — new "CR-03 correction (05-16, 2026-10-02)" subsection under
  "Result (2026-10-01)", additive only.
- `docs/phase-05/evidence/gate-20261001T203348Z/load-window-aligned-recheck.json` — new evidence
  file: `{ window, rowsRead, queriedAt }` for the one live re-query.

## Decisions Made

- Built one `alignedLoad` object and threaded it through every D1-analytics call site rather than
  aligning each call independently — removes the asymmetry structurally so it cannot recur at a new
  call site added later without someone having to remember to align it by hand.
- Re-queried the real aligned window live instead of accepting 05-REVIEW.md's own ×10/9 arithmetic
  estimate, per the plan's must_haves — the measured value (2,183,097) differs from the estimate
  (~1.87M) by about 17%, which is exactly why a measurement was required instead of an estimate.
- Did not re-run the full 20,000-request load pass — Task 2's `<precondition>`/action explicitly
  scoped the re-check to ONE read-only GraphQL Analytics query against the already-recorded window,
  per owner directive (D-02 is about the verdict's data, not about re-running the pass).
- Did not mark ARCH-01 complete in REQUIREMENTS.md — left for 05-21 per the repo's execution rules
  for this plan; this plan only fixes and re-verifies ARCH-01's own measurement instrument.

## Deviations from Plan

None — plan executed exactly as written. Task 1's TDD cycle produced two commits (test, then fix)
instead of one, which matches the plan's own `tdd="true"` task-level annotation and the GSD TDD
execution convention (RED commit, then GREEN commit), not a deviation from the plan's intent.

## Issues Encountered

None. `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` were already present in the shell environment
(same as 05-12's own finding) — `.dev.vars` sourcing in the plan's documented command was a no-op,
not a blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The zero-reads gate instrument (`tools/load-test-zero-reads.mjs`) is now correct for every future
  run — no residual PASS bias from unequal bucket alignment.
- ARCH-01's recorded PASS verdict is confirmed on measured, aligned data; no further action needed
  on the 2026-10-01 run specifically.
- REQUIREMENTS.md's ARCH-01 checkbox remains unchecked by design — 05-21 owns requirements closure
  for phase 05 and should treat this plan's SUMMARY as one of the closing pieces of evidence.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

All 5 claimed files found on disk; all 3 claimed commits (`1354152`, `f79816c`, `32ebf21`) found in
`git log --oneline --all`.

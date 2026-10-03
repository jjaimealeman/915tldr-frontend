# 2026-10-01 - ARCH-01 verdict computed and recorded: ZERO_READS_PROVEN

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [PERFORMANCE] [CRITICAL]
**Session:** Afternoon, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1534_05-12-zero-reads-verdict-proven.md`

## What Changed

- File: `docs/phase-05/zero-reads-gate.md`
  - Appended the "Result (2026-10-01)" section: the two pre-existing tool bugs found and fixed
    this session, the window and 71-path request mix (with every archived article/tag URL named,
    confirming D-03), leg 1/1b results (repo guards pass, deployed bindings show no D1), the
    7-window baseline table, excess/z-score/detection-floor arithmetic, the verdict line
    `ZERO_READS_PROVEN`, the full ARCH-08 result table (invocations 8,464 / KV reads 202 / CPU
    p50 0.764ms / p99 2.846ms / **max 49.966ms, over the 20ms hard-fail ceiling**), an
    explanation of why invocations are far below 20,000 (hot/static paths never invoke the
    Worker) and why KV reads stay small (edge-cache TTL vs. request cadence), and a restated
    "Criterion 1 reinterpretation" paragraph tying this specific result back to the structural
    proof D1 analytics' missing per-Worker dimension requires.

## Why

ARCH-01's verdict — `ZERO_READS_PROVEN` — is the premise this entire rebuild was commissioned to
prove or disprove. The zero-reads load test's real output: load-window `rowsRead` = 1,684,090
against a 7-day comparable baseline of mean 3,743,139.29 / stdDev 2,056,691.00 (z = -1.0011, deep
inside normal variance, nowhere near the +3σ FAIL threshold), combined with leg 1b's confirmation
that the deployed Worker carries no D1 binding. Per D-01's own documented method, this is
"structure plus a load test" proof, not a literal per-Worker zero from D1 analytics (which has no
`scriptName` dimension at all) — the Result section restates exactly what was proven, by which
leg, and to what resolution (a detection floor of ~309 rows/request at this time of day, even at
the 20,000-request safety cap).

ARCH-08 (KV reads ≤ 1/request, CPU < 5ms) is recorded honestly as a genuine, disclosed partial
`FAIL`: KV reads are well within budget (202 against 8,464 invocations), and CPU p50/p99 are
excellent (0.764ms / 2.846ms), but a single real request in this window spiked to 49.966ms —
over the 20ms hard-fail ceiling. Per this plan's own Task 2 instruction, an ARCH-08 over-budget
finding (with the zero-reads gate itself passing) is recorded as a failed requirement for
`/gsd-verify-work` to track, not a project halt (D-02 applies only to the `ZERO_READS_*` verdict).

## Issues Encountered

None beyond the already-disclosed ARCH-08 CPU-max outlier (see above and the full write-up for
the "measure, don't hide" analysis — not investigated further, out of this plan's scope).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the arithmetic (baseline mean/stdDev/threshold, excess, z-score, detection
  floor) was independently recomputed against the raw evidence numbers before being written into
  the doc (caught and fixed one arithmetic transcription error — threshold off by exactly
  1,000,000 — before this commit).
- What wasn't tested: n/a.
- Edge cases: n/a.

## Next Steps

- [ ] Close the phase's validation map (`05-VALIDATION.md`) now that the gate has `PROVEN`
  (05-12 Task 3).
- [ ] `/gsd-verify-work` should track the ARCH-08 CPU-max finding as a failed requirement per
  this plan's own instruction.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - this is the project's core premise verdict; `ZERO_READS_PROVEN` unblocks
Phase 6 per D-02 (a FAIL would have halted the project here).

# 2026-09-23 - Render-Step Location Decided (D-01): Option A, Ruled In By Measured Ingest Volume

**Keywords:** [ARCHITECTURE] [DOCUMENTATION] [INFRA] [DEPLOYMENT]
**Session:** Afternoon, Duration (~30min active work, interrupted by an owner decision checkpoint)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1345_render-step-location-decided-option-a.md`

## What Changed

- File: `docs/phase-03/render-step-location.md` (new)
  - Records D-01's decision: the render step runs inside the existing 2-hour cron Worker (Option A), for both steady-state incremental renders and full-corpus rebuilds
  - Every figure cited by reference into `docs/phase-03/measurements.md`, not restated
  - Both rejected options (separate Worker via Queues, CI/Node build) recorded with their specific measured-non-necessity reasons
  - Two derived findings recorded as binding constraints on Phase 4: a daily-D1-budget risk in naive full-corpus staleness scanning, and a CPU-time-vs-wall-time precision note that does not change the underlying conclusion
  - Three items flagged for other phases' planners (ROADMAP Phase 4/5 consistency, KV bulk-write batching investigation)
  - A concrete numeric reopening threshold (sustained per-cycle volume approaching ~50% of measured capacity, or full rebuilds becoming routine)
- File: `.planning/STATE.md`
  - Scoped edit: the render-step blocker line replaced with a resolved line naming Option A and pointing at the decision document; explicitly restates that the 300-second CPU ceiling figure was WRONG (corrected to ~900s by 03-06, not reopened)
  - Two entries appended to the accumulated Decisions list (D-01 resolution; the daily-D1-budget constraint)
- File: `.planning/ROADMAP.md`
  - Plan-progress table updated for Phase 3 (7/7 plans, 7/7 summaries)
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-07-SUMMARY.md` (new)
  - Full plan summary: accomplishments, decisions, coverage, next-phase readiness

## Why

D-01 was deliberately deferred to measurement (03-CONTEXT.md), not chosen up front — Phase 2 had two confident estimates collapse under measurement, and this was the decision Phase 4's entire build pipeline is shaped by. 03-06 produced the three required measurements; this plan put them in front of the owner as a checkpoint rather than choosing on their behalf. The owner selected Option A, backed by a targeted follow-up measurement (real 7-day production ingest volume: 15 articles/cycle mean, 62 peak) that closed the one gap the checkpoint itself had flagged as unmeasured — giving ~20x headroom at the worst observed week, not a theoretical margin.

## Issues Encountered

A first draft of the STATE.md edit claimed the prior "CORRECTED — Phase 3, 03-06" blocker text was "preserved verbatim as history" below the new resolved line — inaccurate, since the edit replaces that text in place per the plan's own instruction. Caught and corrected before commit to instead point at where that correction's full text actually lives (`measurements.md` §3, `03-06-SUMMARY.md`).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (87/87 pass) and `pnpm test:build-gate` (4/4 pass) — confirmed unaffected, since this plan is documentation-only and touches no application code
- What wasn't tested: N/A — no code path changed
- Edge cases: N/A

## Next Steps

- [ ] Phase 4's loader design must treat the daily-D1-budget constraint (no full-corpus bulk-fetch scan every cron cycle) as load-bearing from its first pass
- [ ] Phase 4 should investigate KV bulk-write batching (10,000 pairs/request) to shrink the manifest-write-dominated per-page cost
- [ ] Phase 5's planner should confirm whether ROADMAP.md's "300s CPU ceiling" (criterion 5) is a legitimate distinct figure for that phase's archive re-render path

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - Documentation/architecture-decision only; no application code changed, but the decision shapes Phase 4's entire build/deploy pipeline design

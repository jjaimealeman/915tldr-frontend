---
phase: 03-foundation-read-budget-guardrails
plan: 07
subsystem: infra
tags: [cloudflare, workers, cron-triggers, architecture-decision, d1, kv, render-pipeline]

requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "03-06's three D-01 measurements and the bulk-fetch addendum (docs/phase-03/measurements.md)"
provides:
  - "docs/phase-03/render-step-location.md — the D-01 decision: render step runs inside the existing 2-hour cron Worker (Option A), figures by reference, rejected alternatives with measured reasons, and a numeric reopening threshold"
  - "STATE.md's D-01 blocker resolved, pointing at the decision document"
  - "A binding constraint on Phase 4's loader: staleness detection must not bulk-fetch the full corpus every cron cycle (daily D1 budget arithmetic)"
affects: [phase-04-static-generation-templates-seo, phase-05-hybrid-archive-zero-reads-proof]

actuals:
  tokens: 4959
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Owner checkpoint answered with a targeted follow-up measurement (real 7-day ingest volume via a single SQL query against production D1), rather than proceeding on the executor's own recommendation alone — closes the exact gap the checkpoint itself flagged as unmeasured."

key-files:
  created:
    - docs/phase-03/render-step-location.md
  modified:
    - .planning/STATE.md

key-decisions:
  - "D-01 resolved: render step runs inside the existing 2-hour cron Worker (Option A) for BOTH the steady-state incremental render and the full-corpus rebuild (chained across ~26-33 cron cycles with staleness forced), not a separate Queues Worker or CI. Ruled in by a measured real ingest volume of 15 articles/cycle (mean) / 62 (peak) against a ~1,223-1,574/cycle capacity — ~20x headroom at the worst observed week, not merely at a theoretical ceiling."
  - "A binding constraint recorded for Phase 4 (not previously in measurements.md): the bulk-fetch D1 shape that fits the single-pass 5,000,000-row hard-fail budget (957,008 rows) would consume 11,484,096 rows/day if re-run every 2-hour cron cycle (12x/day) — 5.7x PROJECT.md's daily soft budget and 2.3x its daily hard-fail. Staleness detection must use a cheap incremental signal, not a full bulk-fetch pass, every cycle."
  - "A methodological precision note recorded, not a correction: the measured per-page cost (573-736ms) is Node wall-clock time, dominated by D1/KV network I/O, which Cloudflare's CPU-time model excludes from billed CPU time. This does not change §4/§4b's conclusions because Cron Triggers carry an independent ~900s wall-time cap (confirmed against Cloudflare's Duration limits table) that binds an I/O-dominated workload regardless of CPU time consumed."
  - "ROADMAP.md Phase 4 criterion 3 and Phase 5 criterion 5 were read for consistency with this decision and flagged (not edited, out of this plan's file scope) — Phase 4's cron-cycle-trigger wording already matches Option A; Phase 5's '300s CPU ceiling' reference may be a legitimate, distinct HTTP-triggered-path figure and is flagged for that phase's own planner to confirm rather than assumed either way."

requirements-completed: [REND-06]

coverage:
  - id: D1
    description: "The render-step location is chosen by the owner from the three measured numbers (docs/phase-03/measurements.md), not from an estimate, via a checkpoint that presented all three figures plus a fourth (real ingest volume) measured specifically to close a gap the checkpoint itself flagged"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "checkpoint:decision task in 03-07-PLAN.md — owner selected Option A explicitly, 2026-09-23, with the follow-up ingest-volume measurement supplied as the deciding evidence"
        status: pass
    human_judgment: true
  - id: D2
    description: "The chosen location is written down under docs/ together with the figures it was chosen from (by reference), the rejected alternatives with their measured reasons, and a numeric reopening threshold"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "node -e verify script from 03-07-PLAN.md Task 2 — checks for 'measurements.md', 'reopen', 'Phase 4' references and all three options (cron/Queue/CI) present in docs/phase-03/render-step-location.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "STATE.md's carried-forward render-step blocker is resolved with the measured outcome, its 300-second CPU figure is confirmed or corrected explicitly, and the edit is scoped (not a whole-file rewrite)"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "git diff --stat .planning/STATE.md — 23 lines changed (1 line replaced with an expanded resolved blocker, 2 lines appended to the Decisions list); accumulated-decisions list and per-plan metrics table intact"
        status: pass
      - kind: other
        ref: "grep confirms STATE.md references docs/phase-03/render-step-location.md and states the 300-second figure was WRONG / corrected to ~900s"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing test suites unaffected by this documentation-only plan"
    verification:
      - kind: unit
        ref: "pnpm test:unit — 87/87 pass"
        status: pass
      - kind: unit
        ref: "pnpm test:build-gate — 4/4 pass"
        status: pass
    human_judgment: false

duration: ~30min (excludes the owner decision wait between the checkpoint and resume)
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 7: Render-Step Location Decided — Option A, Ruled In By Measured Ingest Volume, Not Assumption

**D-01 is closed: the render step runs inside the existing 2-hour cron Worker for both the steady-state incremental render and the rare full-corpus rebuild. The owner's checkpoint answer was backed by a targeted follow-up measurement — real 7-day production ingest volume (15 articles/cycle mean, 62 peak) against the ~1,223-1,574/cycle capacity 03-06 measured — giving ~20x headroom at the worst observed week, not a theoretical margin. A binding constraint on Phase 4 falls out of the arithmetic: staleness detection must not bulk-fetch the full corpus every cron cycle, or it blows PROJECT.md's daily D1 read budget by 2.3-5.7x even though a single pass fits comfortably.**

## Performance

- **Duration:** ~30min of active work (checkpoint preparation + resume), across a session interrupted by the owner's decision
- **Tasks:** 2 (checkpoint:decision, then record-and-resolve)
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments

- Presented `docs/phase-03/measurements.md`'s three D-01 measurements plus the bulk-fetch addendum to the owner as a structured checkpoint: the question in one sentence, each option quantified against measured numbers, a recommendation, and two flagged synthesis findings (daily D1 budget arithmetic on the bulk-fetch shape; a Node-wall-clock-vs-Worker-CPU-time precision note).
- The owner selected **Option A** (existing cron Worker), backed by a new measurement closing the one gap the checkpoint flagged as unmeasured: real production ingest volume over the trailing 7 days (15 articles/cycle mean, 62 peak, 77/84 cycles with data) against the measured ~1,223-1,574/cycle capacity — ~20x headroom at the observed weekly peak.
- Wrote `docs/phase-03/render-step-location.md`: the decision in its first sentence, every figure cited by reference into `measurements.md`, both rejected options (Queues, CI) with their specific measured-non-necessity reasons, the two derived findings recorded as binding constraints on Phase 4, three items flagged for other phases' planners (ROADMAP consistency, KV bulk-write investigation), and a numeric reopening threshold (sustained per-cycle volume approaching ~50% of the ~1,223 capacity, or full rebuilds becoming routine rather than rare).
- Made a scoped edit to `.planning/STATE.md`: replaced the render-step blocker line with a resolved line naming Option A and pointing at the decision document, explicitly restating that the 300-second CPU figure was WRONG (corrected to ~900s, unchanged from 03-06's correction — not reopened), and appended two new entries to the accumulated Decisions list. Confirmed via `git diff --stat` that the edit is scoped (23 lines) and the accumulated-decisions list / per-plan metrics table are intact.
- Confirmed `pnpm test:unit` (87/87) and `pnpm test:build-gate` (4/4) still pass — this plan touched no application code.

## Task Commits

1. **Task 1: checkpoint:decision — render-step location** — no commit (checkpoint, no file changes; owner decision relayed by the orchestrator)
2. **Task 2: Record the decision and resolve the blocker** — see commit hash below (this SUMMARY's own commit, per this project's single-commit-per-plan pattern for documentation-only work)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified

- `docs/phase-03/render-step-location.md` (new) - The D-01 decision: Option A, figures by reference, rejected alternatives, two derived findings recorded as binding Phase 4 constraints, three items flagged for other phases, and a numeric reopening threshold
- `.planning/STATE.md` (modified) - Scoped edit: render-step blocker line replaced with a resolved line; two entries appended to the accumulated Decisions list

## Decisions Made

- **D-01 closed as Option A** (existing 2-hour cron Worker), for both steady-state incremental renders and full-corpus rebuilds (the latter via ~26-33 chained cron cycles with staleness forced, not a separate mechanism) — ruled in by measured real ingest volume, not by the CPU-headroom figure alone.
- **New binding constraint on Phase 4**: staleness detection must not re-scan/bulk-fetch the full corpus every cron cycle — 957,008 rows/pass × 12 cycles/day = 11,484,096 rows/day, 5.7x PROJECT.md's 2,000,000-row daily soft budget and 2.3x its 5,000,000-row daily hard-fail, even though a single bulk-fetch pass fits comfortably inside the single-pass budget. Use an incremental signal (`updated_at` comparison, or a flag set by the ingest pipeline) instead; reserve the full bulk-fetch pass for forced full rebuilds only.
- **Precision note, not a correction**: the measured per-page cost is Node wall-clock time dominated by D1/KV network I/O, which Cloudflare's CPU-time billing model excludes. This does not change §4/§4b's conclusions — Cron Triggers carry an independent ~900s wall-time cap (confirmed against Cloudflare's Duration limits table) that binds an I/O-dominated workload regardless of CPU time consumed.
- **KV bulk-write batching** (10,000 pairs/request, <100MB body) flagged as a Phase 4 investigation regardless of this decision — the manifest write (p50 338ms) dominates every rebuild-duration projection in this document, and 03-04-SUMMARY's previously-unverified citation for this limit was independently confirmed against Cloudflare's own "Write key-value pairs" documentation during this decision (also confirmed: bulk writes require the REST API, not the KV binding).
- **ROADMAP.md consistency flagged, not edited** (out of this plan's file scope): Phase 4 criterion 3's cron-cycle-trigger wording already matches Option A (no change needed); Phase 5 criterion 5's "300s CPU ceiling" reference may be a legitimate, distinct HTTP-triggered-path figure rather than the same stale value STATE.md corrected — flagged for Phase 5's own planner to confirm.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written, with one clarification: the checkpoint's own text initially described the correction as "superseding" the prior STATE.md line "in substance, preserved... as history" in a first draft of the STATE.md edit; on review this was inaccurate (the edit replaces the line in place, per the plan's own instruction, rather than leaving it below), so the wording was corrected before commit to point at where the original correction's full text actually lives (`measurements.md` §3 and 03-06-SUMMARY.md) instead of falsely claiming in-file preservation. No Rule 1-4 classification needed — caught and fixed during this plan's own drafting, not a defect in prior work.

## Issues Encountered

None. This plan touched no application code and introduced no new infrastructure — its only outputs are a decision document and a scoped planning-state edit.

## User Setup Required

None.

## Next Phase Readiness

- Phase 3 is complete: all 6 success criteria (recorded across 03-01 through 03-06) plus D-01's decision (this plan) are closed.
- **Phase 4's loader must treat the daily D1 budget constraint above as load-bearing from its first design pass** — the natural-looking "use the cheap bulk-fetch shape every cycle" implementation would silently blow PROJECT.md's daily hard-fail by 2.3x despite passing every single-pass check.
- **Phase 4's render/deploy pipeline can assume Option A**: no Queues, no CI pipeline, incremental cron-triggered rendering inside the existing Worker, with a full-rebuild path that spans ~26-33 chained cron cycles when the manifest's staleness signal is forced for every row.
- **KV bulk-write batching** is an open, unscoped-but-flagged investigation for whoever plans Phase 4's manifest-write path — not required by this decision, but likely to materially shrink every rebuild-duration number if adopted.
- **Phase 5's planner** should confirm independently whether ROADMAP.md's "300s CPU ceiling" (criterion 5) is the correct figure for that phase's archive re-render path, rather than assuming it either matches or contradicts this phase's cron-ceiling correction.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-23*

## Self-Check: PASSED

Marker added by the execute-phase orchestrator, not the plan executor, which reported its
self-check in its return but omitted the template line. Independently verified before recording:
commit `7692ad2` present in `git log --oneline --all`; `docs/phase-03/render-step-location.md` and
`.planning/STATE.md` both present on disk; STATE.md's D-01 blocker line reads `RESOLVED — Phase 3,
03-07`. `pnpm test:unit` 87/87 and `pnpm test:build-gate` 4/4 confirmed green by the orchestrator.

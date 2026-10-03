---
phase: 05-hybrid-archive-zero-reads-proof
plan: 19
subsystem: observability
tags: [cloudflare, workers-observability, arch-08, owner-decision, cpu-measurement]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-17's per-request CPU-outlier tool (tools/measure-worker-cpu-outliers.mjs), its definitive 4-vs-1 outlier count, IN-01 correlation evidence, and the three undecided options recorded in docs/phase-05/arch-08-cpu-outliers.md"
provides:
  - "The owner's verbatim 05-19 decision on ARCH-08's CPU axis: option (c), re-measure, with the pass criterion fixed before measuring"
  - "A completed, disclosed re-measurement result (docs/phase-05/evidence/cpu-outliers-remeasure/): population p99 CPU 1.314ms, 0/3 invocations ≥20ms — mechanically MET the pre-stated criterion, but the 3-invocation sample contained zero archive-page traffic (all bot-scan/favicon 404 probes)"
  - "An additive correction note in docs/phase-05/zero-reads-gate.md pointing at the per-request correction and the 05-19 decision"
affects: ["05-21 (REQUIREMENTS.md ARCH-08 status update)"]

# Actuals (#2632)
actuals:
  tokens: 3550
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mechanical verdict computation against a criterion fixed BEFORE measuring (T-05-64 repudiation mitigation), with the result disclosed even when the sample composition undermines what the verdict can actually prove."

key-files:
  created:
    - docs/phase-05/evidence/cpu-outliers-remeasure/events.normalized.json
    - docs/phase-05/evidence/cpu-outliers-remeasure/summary.json
    - docs/phase-05/evidence/cpu-outliers-remeasure/correlation.json
    - docs/phase-05/evidence/cpu-outliers-remeasure/aggregate/workers-invocations.json
    - docs/phase-05/evidence/cpu-outliers-remeasure/aggregate/kv-operations.json
  modified:
    - docs/phase-05/arch-08-cpu-outliers.md
    - docs/phase-05/zero-reads-gate.md

key-decisions:
  - "Owner decision (verbatim, 2026-10-02 ~19:05 MDT): \"re-measure: 2026-10-02T00:00:00Z to 2026-10-03T00:00:00Z (the last full UTC day, natural traffic on dev.915tldr.com / worker 915tldr-v2) + PASS iff population p99 CPU < 5ms AND invocations with CPU >= 20ms are under 0.1% of total invocations in the window\" — option (c), pass criterion fixed before measuring per T-05-64."
  - "Re-measurement ran read-only, $0, via tools/measure-worker-kv-cpu.mjs (--assume-no-build, since the window is entirely in the past) and tools/measure-worker-cpu-outliers.mjs (--correlate). Mechanical verdict: MET (p99 1.314ms < 5ms; 0/3 ≥20ms = 0% < 0.1%)."
  - "Disclosed rather than hidden: all 3 invocations in the window were bot-scan/favicon 404 probes (/.git/HEAD, /favicon.ico x2) — zero archive-page requests occurred, so the MET verdict does not actually test the disputed archive-serving CPU-outlier code path."
  - "WINDOWS.md #26 left OPEN (not waived, not fixed) — per this plan's own design, only option (a) accept-cold-start waives #26; option (c) leaves it open regardless of the mechanical result."

patterns-established: []

requirements-completed: []  # ARCH-08's REQUIREMENTS.md status update belongs to 05-21 per this plan's own scope boundary; this plan only records the owner decision and result.

coverage:
  - id: D1
    description: "Owner's verbatim ARCH-08 CPU-axis decision (option c, re-measure, with pass criterion fixed before measuring) recorded in docs/phase-05/arch-08-cpu-outliers.md"
    requirement: "ARCH-08"
    verification:
      - kind: other
        ref: "grep -c '## Owner decision (05-19' docs/phase-05/arch-08-cpu-outliers.md => 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Re-measurement executed read-only against the pre-stated criterion; mechanical MET/NOT-MET verdict recorded with full numbers and evidence"
    requirement: "ARCH-08"
    verification:
      - kind: other
        ref: "docs/phase-05/evidence/cpu-outliers-remeasure/summary.json (overHardFail: 0, total: 3) and aggregate/workers-invocations.json (quantiles.cpuTimeP99: 1314)"
        status: pass
    human_judgment: false
  - id: D3
    description: "zero-reads-gate.md additive correction note under the ARCH-08 result, no existing text removed; WINDOWS.md #26 left open per plan design"
    requirement: "ARCH-08"
    verification:
      - kind: other
        ref: "git diff -- docs/phase-05/zero-reads-gate.md shows 0 removed lines (insertions-only); WINDOWS.md row 26 status unchanged (open)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether the zero-archive-traffic composition of the re-measurement sample is sufficient for the owner's purposes, or whether a future re-measurement attempt is warranted"
    verification: []
    human_judgment: true
    rationale: "This plan discloses the sample-composition caveat but does not decide whether it changes the owner's prior acceptance of option (c)'s own evidence-against note (that natural traffic may not produce a conclusive sample) — that judgment belongs to the owner or to 05-21 when ARCH-08's REQUIREMENTS.md status is finalized."

duration: 25min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 19: ARCH-08 CPU-Axis Owner Decision and Re-Measurement Result Summary

**Recorded the owner's verbatim ARCH-08 decision (option c, re-measure, criterion fixed before measuring) and the resulting $0 read-only measurement: mechanically MET the criterion, but on a 3-invocation sample that was 100% bot-scan 404 traffic with zero archive-page requests — so the MET verdict does not actually test the disputed cold-start/outlier code path, and ARCH-08's CPU axis remains an open gap.**

## Performance

- **Duration:** ~25 min (continuation from an already-resolved Task 1 checkpoint)
- **Started:** 2026-10-03T01:00:00Z (approx., continuation resume)
- **Completed:** 2026-10-03T01:25:11Z
- **Tasks:** 1 (Task 2 — Task 1 was the owner-decision checkpoint, resolved before this continuation began)
- **Files modified:** 2 modified, 5 created

## Accomplishments

- Recorded Jaime's verbatim Task 1 decision in `docs/phase-05/arch-08-cpu-outliers.md`'s new
  "Owner decision (05-19, 2026-10-02)" section: option (c) re-measure, with the exact window
  (`2026-10-02T00:00:00Z`..`2026-10-03T00:00:00Z`) and pass criterion (population p99 CPU < 5ms
  AND invocations ≥20ms CPU under 0.1% of total) as given, before any measurement ran.
- Ran the re-measurement read-only, $0: `tools/measure-worker-kv-cpu.mjs` (aggregate p50/p99,
  `--assume-no-build` since the window is entirely historical) and
  `tools/measure-worker-cpu-outliers.mjs --correlate` (per-request counts). Confirmed the window
  was a genuinely completed UTC day at measurement time (actual time `2026-10-03T01:22:17Z`).
- Computed the mechanical verdict against the pre-stated criterion: **MET** — population p99 CPU
  1.314ms (< 5ms) and 0 of 3 invocations ≥20ms (0% < 0.1%).
- Disclosed, not hidden: the 3-invocation sample for the entire 24-hour window was **100% bot-scan
  / favicon 404 probes** (`/.git/HEAD`, `/favicon.ico` ×2) — zero requests to an archived article
  or archived tag occurred. This is recorded explicitly as a finding that limits what the MET
  verdict can be taken as evidence of, per this plan's own instruction not to silently exclude
  anything or soften a result.
- Appended an additive-only correction note to `docs/phase-05/zero-reads-gate.md` under the
  existing ARCH-08 result, pointing to the per-request correction (4 ≥20ms, not 1) and the 05-19
  decision/result. `git diff` confirms zero removed lines.
- Left `WINDOWS.md` row 26 (`ARCH-08 CPU-max`) **open** — per this plan's own design, only option
  (a) accept-cold-start waives it; option (c) leaves it open regardless of the mechanical result.
  No change to `WINDOWS.md` was made in this plan.
- Confirmed no code or config changed: `git diff --quiet -- src tools wrangler.jsonc package.json`
  succeeds.

## Task Commits

1. **Task 1: Owner decides how ARCH-08's CPU axis is resolved** — resolved in a prior session
   (checkpoint:decision, no files modified; decision recorded verbatim at the top of this
   continuation's prompt)
2. **Task 2: Record the decision exactly as given, and act on it within this plan's limits** —
   `66759d0` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `docs/phase-05/arch-08-cpu-outliers.md` - new "Owner decision (05-19, 2026-10-02)" section:
  verbatim reply, commands run, results table, mechanical MET verdict, and the zero-archive-traffic
  disclosure
- `docs/phase-05/zero-reads-gate.md` - new "ARCH-08 per-request correction and decision (05-19)"
  note under the existing 2026-10-01 ARCH-08 result (additive only)
- `docs/phase-05/evidence/cpu-outliers-remeasure/events.normalized.json` - the 3 raw per-request
  events for the window
- `docs/phase-05/evidence/cpu-outliers-remeasure/summary.json` - per-request summary (total: 3,
  overBudget: 0, overHardFail: 0, p99Ms: 1, maxMs: 1)
- `docs/phase-05/evidence/cpu-outliers-remeasure/correlation.json` - empty outlier correlation
  (no outliers ≥5ms to correlate)
- `docs/phase-05/evidence/cpu-outliers-remeasure/aggregate/workers-invocations.json` - GraphQL
  aggregate (quantiles.cpuTimeP50: 1133µs, cpuTimeP99: 1314µs, max.cpuTime: 1314µs, sum.requests: 3)
- `docs/phase-05/evidence/cpu-outliers-remeasure/aggregate/kv-operations.json` - KV read count (24;
  out of scope for this plan's CPU-only decision)

## Decisions Made

- Owner decision recorded verbatim (see key-decisions in frontmatter and the full section in
  `docs/phase-05/arch-08-cpu-outliers.md`).
- Used `--assume-no-build` for `measure-worker-kv-cpu.mjs` against this entirely-historical window,
  consistent with 05-17's own precedent — a live before/after `/version.json` poll run now cannot
  confirm whether a build happened at any point during an already-elapsed window.
- Did not run `--min-cpu-ms` on the outlier tool: the aggregate query had already shown only 3
  total invocations for the window, far under the events-view's 2000-row cap, so the default
  (fetch everything, `minCpuMs=0`) was safe and gave a full, cap-unaffected per-request list —
  confirmed by `total` (events-view) matching `totalFromCountQuery` (cap-immune COUNT view)
  exactly (3 = 3).
- Reported the mechanical MET verdict exactly as the pre-stated formula computes it, and separately
  disclosed the zero-archive-traffic sample composition as a finding that limits what the verdict
  proves — neither softening the MET result nor silently treating it as resolving ARCH-08.

## Deviations from Plan

None - plan executed exactly as written. The plan's own literal commands (no explicit
`--min-cpu-ms` on the outlier tool) worked without modification here, unlike 05-17's gate-window
run, because this window's total invocation count (3) was known in advance to be far under the
events-view cap.

## Issues Encountered

- The 24-hour natural-traffic window on `dev.915tldr.com` produced only 3 total Worker invocations,
  and none were archive-page requests — all three were automated 404 probes. This was disclosed in
  full in both modified documents rather than treated as a clean pass. See "Known Stubs" /
  limitations note below.

## Known Limitations / Unresolved

**ARCH-08's CPU axis remains an open gap (WINDOWS.md #26, status: open).** This plan's
re-measurement mechanically MET the owner's pre-stated pass criterion, but the sample measured
(3 bot-scan/favicon 404 probes) never exercised the archive-serving code path the original CPU
outliers (49/40/37/26/7 ms in the 05-12 gate window) occurred on. A MET result on a sample with no
archive-page requests cannot confirm or deny whether that outlier pattern recurs under genuine
organic archive-reader traffic. 05-21 should treat ARCH-08's CPU axis as **still undecided in
substance** when setting REQUIREMENTS.md's status — this plan deliberately records the mechanical
result without declaring ARCH-08 resolved, per its own prohibition (T-05-64/T-05-65) against
softening a failed/ambiguous axis into a caveat without an explicit owner statement that says so.

## User Setup Required

None - no external service configuration required. Credentials
(`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) were already present in the shell environment per
this plan's execution rules.

## Next Phase Readiness

- 05-21 has a complete, evidence-backed record to translate into REQUIREMENTS.md's ARCH-08 status:
  the owner's verbatim decision, the mechanical MET verdict, and the explicit caveat that the
  sample contained no archive-page traffic. This plan does not touch REQUIREMENTS.md, per its own
  scope boundary.
- No blockers. If a stronger natural-traffic re-measurement is ever wanted, it needs a window that
  actually samples archive-article/archive-tag requests (not just whatever the Worker happens to
  receive on a low-traffic dev host) to be informative about the disputed code path.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

All 9 files confirmed present on disk (5 evidence files, 2 modified docs, 1 SUMMARY, 1 changelog
entry); task commit `66759d0` confirmed in `git log --oneline --all`.

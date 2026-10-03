---
phase: 05-hybrid-archive-zero-reads-proof
plan: 10
subsystem: infra
tags: [cloudflare-workers-builds, cloudflare-r2, archive-tier, performance, rend-12]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-09's persistently-serving production archive tier (option-a, merged to main)
      and tools/archive-sync.mjs's request-full mechanism (05-07/05-08) — this plan is the first
      real, non-dry-run use of request-full against the real production pipeline"
provides:
  - "A real, measured forced full re-upload of the entire archive-tier corpus (30,501 pages),
    observed on the governing platform (Workers Builds), not a local simulation: 558.2s at
    54.64 obj/s, 0 failures, 0 deferred, converged within the single observed build"
  - "The REND-12 verdict (ARCHIVE_RERENDER_CONVERGES), computed against a genuinely COLD render
    (Phase 4's 649s WB_COLD_FITS baseline) rather than this run's own warm-cache render (104s) —
    today's corpus needs 2 builds to converge in the worst case, 4h total against the 24h D-10
    promise"
  - "A disclosed, forward-looking Phase 6 projection: at ~2x today's archived-page count, the
    render phase alone may already exceed the 20-minute Workers Builds hard ceiling — flagged
    for owner review, not fixed in this plan"
  - "The Criterion 5 reinterpretation paragraph reconciling ROADMAP.md's '300s CPU ceiling'
    wording with the real governing ceiling (Workers Builds' 20-minute wall clock)"
affects: ["05-12 (the final zero-D1-reads gate — can now run knowing the archive tier's
  re-render mechanism is measured and converges)", "Phase 6 (the render-time-vs-ceiling concern
  flagged in the Phase 6 projection needs a real re-measurement before that phase ships)"]

# Actuals (#2632)
actuals:
  tokens: 6899
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Background polling (Bash run_in_background, not foreground sleep loops) to wait on a
      real production build and a real R2 convergence state across a ~60-minute window without
      blocking the session — one poller watched /version.json for a new workers-ci build, a
      second watched R2's _meta/force-full.json + _meta/archive-state.json for convergence."
    - "Stopping to request orchestrator-fetched build-log lines rather than substituting a
      cross-checked/estimated number for a real one, when this executor's own Cloudflare token
      is scoped out of the Workers Builds log API (same disclosed gap as 05-09) — matching this
      phase's established escalation pattern exactly."
    - "Computing the REND-12 worst case against a genuinely COLD render baseline (Phase 4's
      649s) rather than this particular build's own warm-cache render (104s) — the orchestrator
      explicitly flagged this premise check, and using the warm number would have been exactly
      the kind of 'confident but wrong' measurement CLAUDE.md warns against."

key-files:
  created:
    - docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log
  modified:
    - docs/phase-05/archive-architecture.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The worst-case REND-12 arithmetic uses Phase 4's 649s cold-render figure (which itself
    bundles an now-obsolete, inflated deploy sub-phase fixed in 04-11a) plus 05-09's separate
    ~21s deploy figure plus this plan's own measured re-upload throughput — a small
    double-count risk in the conservative (over-estimating) direction, used as the plan's own
    literal formula specifies and disclosed in the doc rather than silently adjusted."
  - "The Phase 6 projection scales the cold-render figure by the same ratio as the
    archived-page count (2x), per the must_haves' own instruction — explicitly labeled a rough,
    linearly-scaled proxy, not a verified re-measurement, since real cold-render time is
    dominated by D1 row count and total page count, which may not scale 1:1 with the
    archived-page ratio alone."
  - "REND-12 marked Complete in REQUIREMENTS.md — converges within the 24h D-10 promise with
    real margin (20h) at today's corpus size, computed against the cold worst case, not the
    warm case this build happened to exercise."

requirements-completed: ["REND-12"]

coverage:
  - id: D1
    description: "A full re-upload of every archived page is forced through the real pipeline
      (the _meta/force-full.json marker consumed by the next production build) and measured:
      pages re-uploaded, elapsed time, objects per second, deferred backlog, total build time
      and whether it finished in one build"
    requirement: "REND-12"
    verification:
      - kind: other
        ref: "Real Workers Builds production build 2a6f02f5-972e-4959-b2a4-e814090bb5a1 (orchestrator-fetched log,
          docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log):
          ARCHIVE_SYNC_RESULT(post) uploaded:30501, failed:0, deferred:0, backlog:{count:0}, in
          558.2s (54.64 obj/s); converged within the single observed build. Independently
          cross-checked live against the real R2 bucket (force-full marker cleared,
          archive-state.json backlogCount:0 at 18:18:09.487Z, within 1.2s of the build log's
          own result line)."
        status: pass
    human_judgment: false
  - id: D2
    description: "No Worker invocation takes part in the re-render: the work runs in the build
      container, and the deployed Worker's role is unchanged"
    verification:
      - kind: other
        ref: "tools/archive-sync.mjs is a Node CLI step inside tools/ci-build.mjs's deploy
          sequence (confirmed in the real build log: `$ node tools/ci-build.mjs deploy` ->
          ARCHIVE_SYNC_RESULT lines), never a Worker fetch handler; /tag/raf (an archived page)
          answered 200 mid-re-upload with no change in the Worker's own serving contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "REND-12 verdict is computed from measurements, not assumed: the worst case (a
      cold full render at the measured 649s plus the full re-upload at the measured throughput)
      either fits in one build, converges in N builds with every build under the ceiling and N
      x 2h <= 24h, or is escalated as ARCHIVE_RERENDER_EXCEEDS"
    requirement: "REND-12"
    verification:
      - kind: other
        ref: "docs/phase-05/archive-architecture.md 'Task 2' section: 649s cold render + 21.04s
          deploy (05-09) leaves 349.96s of the 1020s post deadline; 54.64 obj/s x 349.96s =
          ~19,121 objects/build; 30,501 > 19,121 so it does not fit in one build; 2 builds
          converge (Build 1 at 1020.0s, Build 2 at 878.3s, both under the 1200s hard ceiling); 2
          x 2h = 4h <= 24h. grep -Ec 'ARCHIVE_RERENDER_(FITS|CONVERGES|EXCEEDS)' -> 1 occurrence
          of the chosen verdict token."
        status: pass
    human_judgment: false
  - id: D4
    description: "ROADMAP criterion 5's '300s CPU ceiling' is reinterpreted explicitly and in
      writing as the HTTP Worker cpu_ms maximum, not the archive re-render's governing ceiling
      (the Workers Builds 20-minute wall clock); the chained-cron mechanism is not used"
    verification:
      - kind: other
        ref: "grep -c 'Criterion 5 reinterpretation' docs/phase-05/archive-architecture.md -> 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "The forced re-upload leaves every archived page byte-identical in content
      (sha256 unchanged) and still served with 200 from R2 afterwards; the force marker is
      cleared once the run finishes with zero backlog"
    verification:
      - kind: other
        ref: "3 sampled keys' sha256/size identical before (17:17Z) and after (18:18Z)
          convergence; _meta/force-full.json confirmed null post-convergence; 2 fresh archived
          tag pages (/tag/outlets, /tag/carrington-event) answered 200 via a genuine R2 read
          after convergence"
        status: pass
    human_judgment: false
  - id: D6
    description: "The projection for Phase 6 (about twice the archived pages) is recorded with
      the same throughput, so the next phase knows whether the deadline mechanism still
      converges inside 24 hours"
    verification:
      - kind: other
        ref: "docs/phase-05/archive-architecture.md 'Phase 6 projection' section: 61,002
          archived pages, cold render scaled to 1,298s, exceeds the 20-minute hard ceiling on
          render alone -- explicitly flagged for owner review before Phase 6 ships, not resolved
          by this plan"
        status: pass
    human_judgment: true
    rationale: "This deliverable is a disclosed forward-looking risk flag, not a pass/fail
      measurement — whether the projection's linear-scaling assumption is acceptable, or whether
      Phase 6 needs a real re-measurement before shipping, is an owner judgment call, not
      something a test can auto-verify."

duration: ~76min (includes a ~50min wait for the next 2-hourly production build; active work
  was roughly 25min)
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 10: Forced Full Re-upload (REND-12) Summary

**A real, non-dry-run forced full re-upload of all 30,501 archived pages, observed on the governing Workers Builds platform (558.2s at 54.64 obj/s, 0 failures), produced the REND-12 verdict `ARCHIVE_RERENDER_CONVERGES` — computed against a genuinely cold render baseline rather than this run's own warm-cache luck, converging in 2 builds (4h) against the 24h D-10 promise, with a disclosed Phase 6 risk flag that render time alone may approach the 20-minute hard ceiling once the corpus roughly doubles.**

## Performance

- **Duration:** ~76 min total (includes a ~50-min wait for the next 2-hourly ingest-triggered
  production build to pick up the force-full marker; active work was ~25 min)
- **Started:** 2026-10-01T17:16:00Z (approx. — context/plan read)
- **Completed:** 2026-10-01T18:32:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 3 (1 new evidence log, 2 modified docs)

## Accomplishments

- **Requested the forced full re-upload at 17:17:49 UTC** (`node tools/archive-sync.mjs
  request-full --reason "REND-12 measurement (05-10)"`), well inside the plan's 17:55 UTC
  deadline for the next production build to pick it up.
- **Confirmed the production build on the real platform**: Workers Builds build
  `2a6f02f5-972e-4959-b2a4-e814090bb5a1` (`hashSource: workers-ci`, trigger `deploy_hook`), built
  2026-10-01T18:06:11.972Z-18:18:19.949Z (727.98s total). Detected via a background poller
  watching `/version.json`, not manual repolling.
- **The real `ARCHIVE_SYNC_RESULT(post)` line, fetched by the orchestrator** since this
  executor's own Cloudflare token still returns `403`/`12004` against the Workers Builds log API
  (re-confirmed live this session): `uploaded:30501, failed:0, deferred:0, backlog:{count:0}` in
  **558.2s (54.64 obj/s)**. Converged within the single observed build.
- **Independently cross-checked the real log against live R2 state**: the force-full marker
  cleared and `_meta/archive-state.json` reported `backlogCount:0` at `18:18:09.487Z` — within
  1.2s of the build log's own result line, confirming the two sources agree exactly.
- **Byte-identity and no-404-window both held**: 3 sampled archived keys' sha256/size were
  identical before and after the forced re-upload; `/tag/raf` answered 200 mid-re-upload; two
  never-recently-requested archived pages answered 200 via a genuine R2 read after convergence.
- **Computed the REND-12 worst case against a genuinely COLD render** (Phase 4's 649s
  `WB_COLD_FITS`), not this build's own warm-cache render (104s, since the build-output cache
  restored) — the orchestrator explicitly flagged this premise check, since reusing the warm
  number as "proof" the cold case fits would have been exactly the kind of wrong-but-confident
  measurement this project's own CLAUDE.md warns against. Result: today's 30,501-page corpus
  does **not** fit in one build (30,501 > ~19,121 objects uploadable in the post-deadline budget
  remaining after a cold render + deploy) but converges in **2 builds** (1020.0s and 878.3s
  respectively, both under the 1,200s hard ceiling) — `2 x 2h = 4h` against the `24h` D-10
  promise, 20h of margin.
- **Verdict recorded: `ARCHIVE_RERENDER_CONVERGES`.** REND-12 marked Complete in
  `.planning/REQUIREMENTS.md`.
- **Flagged a genuine Phase 6 risk, not resolved here**: scaling the cold-render figure by the
  same ~2x ratio as the projected archived-page growth (`649s x 2 = 1,298s`) already exceeds the
  20-minute Workers Builds hard ceiling on render alone, before any upload work starts — a
  structurally different problem than today's (chaining the upload across builds doesn't help
  if the render itself can't finish in one build). Disclosed in the doc and here, matching this
  phase's established "measure, disclose, flag, don't fix" pattern (05-05's hot-window cap,
  05-11's LCP finding).
- **Added the "Criterion 5 reinterpretation" paragraph**: ROADMAP.md's "300s CPU ceiling" is the
  HTTP Worker's `limits.cpu_ms` maximum, not the archive re-render's governing ceiling (the
  Workers Builds 20-minute wall clock) — and the chained-cron mechanism Phase 3 measured and
  rejected is explicitly not what REND-12 relies on.

## Task Commits

1. **Task 1 (tracer — force the re-upload, observe it on the real platform):** `87d34f3` (docs)
   — `docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log`,
   `changelog/2026-10-01-1230_05-10-forced-full-reupload-build-log-evidence.md`,
   `changelog/README.md`
2. **Task 2 (auto — compute and record the REND-12 verdict):** `90a3198` (docs) —
   `docs/phase-05/archive-architecture.md`, `.planning/REQUIREMENTS.md`,
   `changelog/2026-10-01-1245_05-10-rend-12-verdict-archive-rerender-converges.md`,
   `changelog/README.md`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log` - the real
  Workers Builds production build log for the forced full re-upload, orchestrator-fetched since
  this executor's own token lacks Workers Builds log API access (created)
- `docs/phase-05/archive-architecture.md` - "Forced full re-upload (REND-12)" section filled:
  real phase timing breakdown, throughput, the cold-worst-case arithmetic, the Phase 6
  projection, and the "Criterion 5 reinterpretation" paragraph (modified)
- `.planning/REQUIREMENTS.md` - REND-12 marked Complete (checkbox + traceability table)
  (modified)

## Decisions Made

- Used Phase 4's 649s cold-render figure plus 05-09's separate ~21s deploy figure plus this
  plan's own measured throughput, exactly as the plan's own formula specifies, despite a small
  disclosed double-count risk (Phase 4's 649s itself historically bundled an inflated,
  now-fixed deploy sub-phase) — the conservative (over-estimating) direction, so used as given
  rather than silently adjusted.
- Scaled the Phase 6 projection's cold-render figure by the same ratio as the archived-page
  count (2x), per the must_haves' own instruction, explicitly labeled a rough linear proxy, not
  a verified re-measurement.
- **REND-12 marked Complete** in REQUIREMENTS.md — converges within the 24h D-10 promise with
  real margin (20h) at today's corpus size, computed against the cold worst case, not the warm
  case this particular build happened to exercise.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs found, no blocking issues required a fix. The one real complication (this
executor's own Cloudflare token returning `403`/`12004` against the Workers Builds log API) is a
pre-existing, disclosed condition from 05-09, re-confirmed live, not a new defect; it was handled
exactly as that plan's own precedent directs — stop, report the exact lines needed, resume once
the orchestrator supplies them — not worked around with a fabricated or estimated number.

---

**Total deviations:** 0 auto-fixed. One disclosed escalation (orchestrator-token-scope gap,
pre-existing, resolved via the established 05-09 pattern) and one disclosed arithmetic
simplification (the small deploy-time double-count risk in the worst-case formula, used as the
plan specifies).
**Impact on plan:** None negative — the escalation produced the real numbers the verdict needed
rather than a substitute; the disclosed simplification is conservative, not optimistic.

## Issues Encountered

None beyond the disclosed items above.

## User Setup Required

None blocking. **Informational only** (same as 05-09): this executor's own Cloudflare API token
still cannot reach the Workers Builds log API directly (`403`/`12004`, re-confirmed live this
session). Re-granting its Workers Builds read scope would let a future executor session fetch
build logs itself rather than asking the orchestrator — a convenience, not a requirement.

## Next Phase Readiness

- **REND-12 is Complete.** The archive tier's full-re-render mechanism is measured, not assumed,
  on the real governing platform, and converges well within the 24h D-10 promise at today's
  corpus scale.
- **Phase 6 planning should re-measure a real cold build against its actual corpus size before
  relying on the current 2-hourly chained-build convergence mechanism** — this plan's own
  linear-scaling projection shows render time alone may already exceed the 20-minute hard ceiling
  at ~2x today's archived-page count, a structurally different concern than REND-12's upload-side
  chaining, which this plan does not attempt to solve.
- **05-12 (the final zero-D1-reads gate) is the phase's one remaining open item.**

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

`docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log` confirmed present on
disk. `grep -Ec "ARCHIVE_RERENDER_(FITS|CONVERGES|EXCEEDS)" docs/phase-05/archive-architecture.md`
-> 1; `grep -c "Criterion 5 reinterpretation" docs/phase-05/archive-architecture.md` -> 1.
`grep -n "REND-12" .planning/REQUIREMENTS.md` confirms both the checkbox and traceability row now
read Complete. Commits `87d34f3` and `90a3198` both confirmed present in `git log --oneline -5`.

---
phase: 05-hybrid-archive-zero-reads-proof
plan: 17
subsystem: observability
tags: [cloudflare, workers-observability, telemetry-api, cpu-measurement, arch-08]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-12's zero-reads gate run and docs/phase-05/zero-reads-gate.md's ARCH-08 CPU measurement; 05-REVIEW.md's IN-01/IN-02 findings and the 1-vs-4 outlier dispute"
provides:
  - "tools/measure-worker-cpu-outliers.mjs — a repeatable, verified per-request CPU measurement tool against the Workers Observability telemetry API (dataset `cloudflare-workers`), distinct from measure-worker-kv-cpu.mjs's aggregate-only GraphQL reads"
  - "The definitive per-request answer to ARCH-08's CPU-outlier dispute: 4 invocations ≥20ms, 5 ≥5ms in the 05-12 gate window — settled from enumerated per-request data, not an aggregate max/quantile"
  - "docs/phase-05/arch-08-cpu-outliers.md — Method, Definitive counts, Reconciliation, IN-01 correlation evidence, and three undecided options for the owner's 05-19 checkpoint"
  - "A verified, documented finding: the Workers Observability telemetry events-view has a hard 2000-row cap with no cursor/offset — full per-request enumeration of a busy window is structurally impossible via this endpoint"
affects: ["05-19 (owner decision on ARCH-08)", "05-21 (REQUIREMENTS.md update once decided)"]

# Actuals (#2632)
actuals:
  tokens: 28020
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Firsthand live-API verification before building a measurement tool (Step 1 of a tracer task) — every endpoint, request body shape, field name, retention figure, and permission requirement was confirmed by an actual API call, not assumed from Context7/planning-stage docs, before any code was written against it."
    - "Allow-list normalization at the single read boundary: normalizeInvocationEvent is the ONLY function that reads a raw telemetry event; every other function in the tool operates on the normalized shape, so a client IP/UA/header value structurally cannot reach disk."
    - "Honest incompleteness: a measurement tool throws rather than silently reporting a partial/truncated result as complete, including when the underlying API has an undocumented hard cap (2000-row events-view limit, discovered live)."

key-files:
  created:
    - tools/measure-worker-cpu-outliers.mjs
    - tests/unit/measure-worker-cpu-outliers.test.mjs
    - tests/fixtures/observability-telemetry.sample.json
    - docs/phase-05/arch-08-cpu-outliers.md
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/events.normalized.json
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/summary.json
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/correlation.json
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/aggregate/workers-invocations.json
    - docs/phase-05/evidence/cpu-outliers-gate-20261001/aggregate/kv-operations.json
  modified: []

key-decisions:
  - "No ARCH-08 decision was made (by design) — docs/phase-05/arch-08-cpu-outliers.md ends with three labelled options (accept / fix / re-measure) and the evidence for each, left for the owner at 05-19."
  - "Used the telemetry API's own COUNT-view calculation (not the events-view) for the window TOTAL, since the events-view's verified 2000-row cap makes enumerating all ~8,477 invocations in this window structurally impossible — the count-view reads the same raw table and is not subject to that cap."
  - "Did not present summarizeCpuOutliers' p99Ms (computed from only the 5 fetched outlier events) as the window's true p99 in the doc — that figure is the p99 of the outlier subset, not the population; the aggregate tool's 2.846ms is cited instead, correctly labeled, to avoid repeating ARCH-08's original aggregate-as-count mistake in a new form."

patterns-established:
  - "Pattern: when an API endpoint's documented behavior is ambiguous (e.g. telemetry/query's queryId requirement), use the API's own Zod validation error messages as a reverse-engineering tool — deliberately send incomplete/wrong bodies to see exactly which fields are required and in what shape, rather than guessing or trusting an API reference page alone."

requirements-completed: []  # ARCH-08's decision belongs to 05-19; REQUIREMENTS.md updates in 05-21 per this plan's own frontmatter note.

coverage:
  - id: D1
    description: "tools/measure-worker-cpu-outliers.mjs queries the Workers Observability telemetry API (not the workersInvocationsAdaptive aggregate) and lists individual invocations with CPU time, with the endpoint/shape/retention/permission verified live and recorded in evidence"
    requirement: "ARCH-08"
    verification:
      - kind: unit
        ref: "tests/unit/measure-worker-cpu-outliers.test.mjs — normalizeInvocationEvent, fetchInvocationEvents, fetchPathEventHistory suites"
        status: pass
      - kind: other
        ref: "live run: node tools/measure-worker-cpu-outliers.mjs --from 2026-10-01T20:34:05.536Z --to 2026-10-01T21:16:29.049Z --min-cpu-ms 5 --correlate --json --evidence docs/phase-05/evidence/cpu-outliers-gate-20261001"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 05-12 gate window's definitive CPU-outlier counts (≥20ms and ≥5ms) are recorded with the full per-request list, settling the 1-vs-4 discrepancy"
    requirement: "ARCH-08"
    verification:
      - kind: unit
        ref: "tests/unit/measure-worker-cpu-outliers.test.mjs — summarizeCpuOutliers exact-count tests"
        status: pass
      - kind: other
        ref: "docs/phase-05/evidence/cpu-outliers-gate-20261001/summary.json (overHardFail: 4, overBudget: 5) and docs/phase-05/arch-08-cpu-outliers.md's Definitive counts table"
        status: pass
    human_judgment: false
  - id: D3
    description: "IN-01 correlation evidence (repeat-path rank, per-colo gap, cold-start key scan) gathered and reported without asserting a root cause; docs/phase-05/arch-08-cpu-outliers.md ends with three undecided options for the owner"
    verification: []
    human_judgment: true
    rationale: "Whether the IN-01 correlation evidence is sufficient to inform a decision, and which of the three documented options (accept/fix/re-measure) to choose, is the owner's 05-19 judgment call by explicit plan design — this plan's must_haves prohibit making that decision here."

duration: 27min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 17: ARCH-08 CPU-Outlier Tool and Decision Doc Summary

**Built a verified per-request CPU-measurement tool against Cloudflare's Workers Observability telemetry API and used it to settle ARCH-08's "1 outlier or 4?" dispute as definitively 4 (≥20ms) / 5 (≥5ms), with IN-01 correlation evidence pointing at the gate's own repeated-URL load pattern rather than organic traffic.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-02T16:40:00-06:00 (approx.)
- **Completed:** 2026-10-02T17:07:18-06:00
- **Tasks:** 2
- **Files modified:** 10 (all new)

## Accomplishments

- `tools/measure-worker-cpu-outliers.mjs` queries the Workers Observability telemetry API's
  `cloudflare-workers` dataset directly — a true per-request dataset, unlike
  `measure-worker-kv-cpu.mjs`'s aggregate-only GraphQL `workersInvocationsAdaptive` reads.
  Every detail (endpoint, request body shape, field names, dataset selection, retention,
  required token permission) was verified against the live API, not assumed, and is
  recorded in `docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json`.
- Ran the tool over the disputed 05-12 gate window (2026-10-01T20:34:05.536Z–21:16:29.049Z):
  **exactly 4 invocations ≥20ms CPU, 5 ≥5ms** — settling the "1 vs 4" dispute in favor of 4,
  matching the orchestrator's independent finding almost exactly. The gate doc's "single
  outlier" framing is explained in the Reconciliation section as an inference from an
  aggregate `max.cpuTime` field, which cannot count requests.
- IN-01 correlation (Task 2) found that 4 of the 5 outliers sit on exactly 3 paths each hit
  ~280 times across the 42-minute window (~once every 9 seconds) — consistent with the
  gate's own repeated-URL load generation rather than organic reader traffic. The sole
  outlier not on a heavily-repeated path is the smallest (7ms). Two of the four ≥20ms
  outliers show sub-20ms gaps since the previous invocation in the known population,
  mildly favoring a concurrency-pressure explanation over classic cold-isolate-after-idle
  for those two — explicitly not asserted as proven.
- `docs/phase-05/arch-08-cpu-outliers.md` written with the five required sections and three
  labelled, undecided options for the owner's 05-19 checkpoint.
- Discovered and documented a significant, previously-unknown API constraint: the
  `events`-view has a hard 2000-row cap with no cursor/offset — a busy window's full
  invocation list (this window has ~8,477) cannot be enumerated via this endpoint at all,
  only the outlier subset can. The tool throws rather than silently under-reporting when
  this boundary is hit.

## Task Commits

1. **Task 1: Tracer — verify the telemetry API firsthand, build the tool, list the gate window's outliers end to end** - `347b7ff` (feat)
2. **Task 2: IN-01 correlation and the reconciliation record** - `ccf917a` (feat)

**Plan metadata:** pending (this commit)

_Note: Task 1 was a `type="tracer"` task — executed and committed as a real, production-quality implementation with real `<verify>`, per the tracer convention. This plan ran in autonomous sequential-executor mode (isolation forced to none), so the tracer feedback gate was the re-run-and-check-`<verify>` path, not an interactive checkpoint._

## Files Created/Modified

- `tools/measure-worker-cpu-outliers.mjs` - the measurement tool (normalizeInvocationEvent, fetchInvocationEvents, fetchPathEventHistory, fetchTotalInvocationCount, summarizeCpuOutliers, correlateOutliers, findColdStartKeys, CLI)
- `tests/unit/measure-worker-cpu-outliers.test.mjs` - 19 unit tests, fixture-driven, no network access
- `tests/fixtures/observability-telemetry.sample.json` - synthetic fixture in the verified raw shape
- `docs/phase-05/arch-08-cpu-outliers.md` - the owner-facing decision document
- `docs/phase-05/evidence/cpu-outliers-gate-20261001/` - `api-shape.json`, `events.normalized.json`, `summary.json`, `correlation.json`, `aggregate/` (measure-worker-kv-cpu.mjs's output for the same window)

## Decisions Made

- No ARCH-08 decision made (by design — see key-decisions in frontmatter and the "Decision inputs" section of the doc).
- Used the telemetry API's COUNT-view (not events-view) for the window total, since events-view's 2000-row cap makes full enumeration of this window's ~8,477 invocations impossible.
- Did not present the outlier-only fetch's p99Ms as the window's true p99 — cited the aggregate tool's figure instead, correctly labeled, specifically to avoid repeating ARCH-08's original "aggregate figure presented as a count/distribution claim" mistake.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Blocking/Correctness] Step 4's literal CLI invocation (no `--min-cpu-ms`) fails against this window because of a newly-discovered 2000-row API cap**
- **Found during:** Task 1, Step 4 (the live end-to-end run)
- **Issue:** The plan's Step 4 example command runs the tool over the gate window with no `--min-cpu-ms` (implying the default `0`, i.e. fetch every invocation). Running it that way hit the API's own 2000-row `events`-view cap (discovered live, documented in `api-shape.json`; the window has ~8,477 total invocations) and the tool correctly threw rather than silently returning a truncated result.
- **Fix:** Re-ran with `--min-cpu-ms 5` (keeps the outlier fetch at 5 events, far under the cap) and used a separate COUNT-view query (`fetchTotalInvocationCount`, unaffected by the events-view cap) for the window total. This is the same data the plan's "Definitive counts" section needs; only the CLI invocation differed from the plan's literal example.
- **Files modified:** `tools/measure-worker-cpu-outliers.mjs` (added `fetchTotalInvocationCount`, built into `runMeasurement` from the start), `docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json` (documented the 2000-row cap as a verified finding)
- **Verification:** `node --test tests/unit/measure-worker-cpu-outliers.test.mjs` passes; live run produces `summary.json` with both the outlier list and the independently-sourced total (8,477)
- **Committed in:** `347b7ff` (Task 1 commit)

**2. [Rule 2 - Missing critical functionality] `correlateOutliers` fed only the 5-event outlier fetch would report misleading `samePathCount` values**
- **Found during:** Task 2, before writing `arch-08-cpu-outliers.md`
- **Issue:** The plan's Step 3 design implies `correlateOutliers(outliers, allEvents)` where `allEvents` is whatever the main fetch returned. Since Task 1's live fetch only returns the 5 outlier events (by design, to stay under the 2000-row cap), feeding that same 5-event array as `allEvents` would report `samePathCount: 2` for two outliers sharing a path — when the true figure, checked live, is 281 (that article was hit 281 times in the window, not twice). Presenting `samePathCount: 2` in the decision doc would have been a materially misleading correctness defect in the evidence the owner relies on at 05-19.
- **Fix:** Added `fetchPathEventHistory(path, {from, to}, deps)` to fetch the TRUE full-window occurrence list for each distinct outlier path (confirmed exact via a bogus-path control returning 0 matches), merged into the correlation universe before calling `correlateOutliers`. Documented the remaining limitation (colo-level fields are NOT similarly expanded to the full ~8,477-invocation population, which is infeasible under the same 2000-row cap) explicitly in `correlation.json`'s `coloPopulationCaveat` and in the doc.
- **Files modified:** `tools/measure-worker-cpu-outliers.mjs`, `tests/unit/measure-worker-cpu-outliers.test.mjs` (2 new tests), `docs/phase-05/arch-08-cpu-outliers.md`
- **Verification:** `node --test tests/unit/measure-worker-cpu-outliers.test.mjs` passes (19 tests); live-run `correlation.json` shows `samePathCount: 281`/`280` for the repeated paths, `1` for the one-off path
- **Committed in:** `ccf917a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/correctness, 1 missing-critical-functionality)
**Impact on plan:** Both auto-fixes were necessary for the evidence to be accurate and non-misleading; neither changed the plan's scope or deliverables — they corrected the plan's own literal examples against facts only discoverable by actually calling the live API, which is exactly what Step 1's "verify firsthand" instruction anticipated.

## Issues Encountered

- The `telemetry/query` endpoint's `queryId` requirement initially looked like it required a pre-saved query (`POST .../observability/queries`, which 403'd under this project's Read-only scope) — resolved by discovering, via the API's own Zod validation errors, that any syntactically-valid `queryId` string works as an ad-hoc query once `parameters.datasets` is supplied. No scope escalation was needed.
- `telemetry/keys` without an explicit `datasets` field silently returns a different, metadata-only dataset (no `$workers.*` fields at all) with no error — caught by comparing key-list lengths (22 vs 151) before writing any code against it, avoiding a tool that would have reported zero CPU data with no indication why.

## User Setup Required

None - no external service configuration required. (The required Workers Observability Read token permission was already granted by the owner before this plan ran, per the continuation note.)

## Next Phase Readiness

- Ready for 05-19: the owner has a complete, evidence-backed decision document (`docs/phase-05/arch-08-cpu-outliers.md`) with three labelled options and no recommendation baked in.
- 05-21 will update `REQUIREMENTS.md`'s ARCH-08 line once the owner decides; this plan deliberately left `requirements-completed` empty and did not touch `REQUIREMENTS.md` or `docs/phase-05/zero-reads-gate.md`, per its own scope boundary.
- No blockers. The tool (`tools/measure-worker-cpu-outliers.mjs`) is re-runnable against any future window (subject to the 7-day Workers Logs retention) if the owner chooses option (c), re-measure.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

All 10 created files confirmed present on disk; both task commits (`347b7ff`, `ccf917a`) confirmed in `git log --oneline --all`.

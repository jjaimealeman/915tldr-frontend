# 2026-10-02 - Plan 05-17 Task 1: per-request CPU-outlier tool, verified live, settles 4 vs 1

**Keywords:** [BACKEND] [TESTING] [SECURITY] [ARCHITECTURE] [CRITICAL]
**Session:** Afternoon, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1658_05-17-task1-cpu-outlier-tool-verified-live.md`

## What Changed

- File: `tools/measure-worker-cpu-outliers.mjs`
  - New tool querying Cloudflare's Workers Observability telemetry API directly (`POST
    /accounts/{account_id}/workers/observability/telemetry/query`, dataset
    `cloudflare-workers`) — a per-REQUEST dataset, unlike `measure-worker-kv-cpu.mjs`'s
    `workersInvocationsAdaptive` GraphQL dataset, which only returns aggregate
    quantiles/max and cannot list or count individual over-budget requests.
  - Exports `normalizeInvocationEvent` (allow-lists exactly `{timestamp, path, status,
    cpuTimeMs, wallTimeMs, scriptVersion, colo, outcome, requestId}`, dropping client IP,
    user agent, and every header), `summarizeCpuOutliers`, `fetchInvocationEvents`,
    `fetchTotalInvocationCount`, `correlateOutliers`, `findColdStartKeys`.
  - CLI: `--from`, `--to`, `--min-cpu-ms`, `--limit`, `--correlate`, `--json`, `--evidence`.
- File: `tests/unit/measure-worker-cpu-outliers.test.mjs` (new, 17 tests)
- File: `tests/fixtures/observability-telemetry.sample.json` (new) — synthetic fixture
  reproducing the verified raw shape, carrying a fake IP (192.0.2.10) and fake user agent
  specifically to prove `normalizeInvocationEvent` drops them.
- File: `docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json`
  - Full firsthand verification record: endpoints, working request bodies, response
    shapes, the real field names, retention, and the required token permission.
- File: `docs/phase-05/evidence/cpu-outliers-gate-20261001/events.normalized.json`,
  `summary.json`
  - The actual live run over the 05-12 gate window.

## Why

ARCH-08's CPU-outlier count was disputed: the project's own gate doc said "a single
request spiked to 49.966ms," while an independent orchestrator query claimed four
requests ≥20ms. `measure-worker-kv-cpu.mjs` cannot settle this — it only reads
`workersInvocationsAdaptive`'s aggregate `max.cpuTime`/quantiles, which cannot enumerate
individual requests. This plan builds the per-request tool the repo was missing and runs
it over the disputed window to get a definitive, re-runnable answer.

## Issues Encountered

Three live-API behaviors had to be discovered by trial, not assumed from the API
reference, and are now recorded so no future tool repeats the discovery cost:

1. **Wrong dataset by default.** `telemetry/keys` without an explicit `datasets` field
   silently returns a DIFFERENT, metadata-only dataset (22 keys, no `$workers.*` fields at
   all) with no error. The real per-invocation dataset (151 keys, including
   `$workers.cpuTimeMs`) only appears when `datasets: ["cloudflare-workers"]` is sent
   explicitly. A tool that omitted this would report zero CPU data and never know why.
2. **`queryId` looks like a saved-query reference but isn't required to be one.** `POST
   .../telemetry/query` with only `{queryId, timeframe, limit}` returns 400 "Query not
   found" — this reads like the ID must already exist via `POST
   .../observability/queries` (which this Read-scoped token can't do — confirmed 403).
   The real fix: adding `parameters.datasets` makes the SAME arbitrary `queryId` string
   (even an all-zero UUID) succeed as an ad-hoc query. No saved-query write capability is
   needed.
3. **Hard 2000-row cap, no cursor/offset, confirmed by a Zod `too_big` error at 2001.**
   The gate window has ~8,477 total invocations — more than the cap — so an unfiltered
   per-request listing of every invocation in a busy window is structurally impossible via
   this endpoint, not just slow. The tool's `fetchInvocationEvents` throws rather than
   silently returning a truncated "total" when a page comes back exactly at `limit`
   (unprovable completeness); the real window total instead comes from a separate
   COUNT-view query, which isn't subject to the 2000-row cap.

None of these were bugs in the tool as finally shipped — they were corrected before the
GREEN commit, during Step 1's live verification, which is the whole point of doing Step 1
first.

## Dependencies

No dependencies added — reuses `tools/lib/cf-graphql.mjs`'s `redact()` and
`tools/measure-worker-kv-cpu.mjs`'s `PUBLIC_WORKER_SCRIPT`/`CPU_BUDGET_MS`/`CPU_HARD_FAIL_MS`
constants.

## Testing Notes

- What was tested: `normalizeInvocationEvent` field allow-listing and null-safety,
  `summarizeCpuOutliers` exact counts against a 7-value fixture, `fetchInvocationEvents`'s
  completeness proof and incompleteness throw, redaction of a fake token on an API error,
  the server-side `$workers.cpuTimeMs` filter being sent correctly, `correlateOutliers`'
  colo/path-repeat logic (first-in-colo, same-path rank), and `findColdStartKeys`'
  empty-result and match cases.
- RED confirmed first: ran the test file against the not-yet-created tool and got
  `ERR_MODULE_NOT_FOUND`, then wrote the implementation.
- Live run: the actual gate window query (not just the fixture) — 5 invocations with CPU
  > 5ms (49, 40, 37, 26, 7 ms — 4 of them ≥ 20ms), 8,477 total invocations via the
  separate count query. Settles the dispute as 4, not 1.
- What wasn't tested: real pagination across multiple pages (the gate-window outlier set
  is only 5 events, so the 2000-row/no-cursor boundary was confirmed via a direct curl
  probe, not exercised end-to-end through the tool's own retry path — there is no retry
  path, by design, since completeness can't be proven past one page anyway).

## Next Steps

- [ ] Task 2: `correlateOutliers`/`findColdStartKeys` CLI wiring (`--correlate`), the
      side-by-side run against `measure-worker-kv-cpu.mjs`, and
      `docs/phase-05/arch-08-cpu-outliers.md` with the three undecided options for the
      owner (05-19).

---

**Branch:** feature/phase-05
**Issue:** ARCH-08 (05-VERIFICATION.md gap 1); GSD plan 05-17
**Impact:** HIGH - produces the definitive, re-runnable answer to a disputed production
CPU-budget measurement; no production code path changed.

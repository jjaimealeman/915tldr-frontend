# 2026-09-30 - ARCH-01 zero-reads gate instrument: D1 baseline, deployed-binding check, request mix + verdict

**Keywords:** [BACKEND] [TESTING] [SECURITY] [FEATURE]
**Session:** Evening, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2318_arch-01-zero-reads-gate-instrument.md`

## What Changed

- File: `tools/lib/cf-graphql.mjs` (new)
  - Shared Cloudflare GraphQL Analytics client (`queryCloudflareGraphql`, `introspectType`),
    reusing `tools/ci-build.mjs`'s own token-redaction convention so no credential can ever reach
    an error message, log line, or test assertion.
- File: `tools/load-test-zero-reads.mjs` (new)
  - ARCH-01's zero-reads gate instrument: leg 1b (`fetchDeployedBindings`/`parseDeployedBindings`
    — reads the LIVE deployed `915tldr-v2` Worker's settings and confirms no D1-typed binding
    exists) and leg 2 (`fetchD1RowsRead` — a databaseId-filtered D1 `rowsRead` delta against a
    7-day comparable baseline, since D1 analytics has no per-Worker attribution dimension at all).
  - `comparableWindows`, `summarizeBaseline`, `detectionFloor` — the baseline statistics and the
    detection-floor formula (`3 * sigma / requests`).
  - `buildRequestMix` — the gate's own 71-path request mix (homepage, 8 categories, 20 hot
    articles, 20 archived articles, 10 static tags, 10 archived tags, sitemap, RSS), deterministic
    seeded sampling so a re-run requests the same URLs.
  - `decideZeroReadsVerdict` — PASS only when the window is valid, the delta is within
    `mean + 3*sigma`, AND the deployed Worker has no D1 binding; every ARCH-01 concurrency rule
    (build overlap, the v1 ingest slot, lagging analytics, a thin or zero-total baseline, an
    incomplete pass, an unconfirmed archive path) produces its own named INCONCLUSIVE result —
    nothing in this function can turn an unreliable measurement into a PASS.
  - `runPreflight`, `runPass`, `runLoadTest` — the Server-Timing preflight check, the
    rate-limited/concurrency-bounded request pass with alternating navigation/plain headers, and
    the CLI orchestration (`--baseline-only`, `--requests`, `--at`, `--evidence`, `--json`,
    `--force-window`; exit 0/2/3 for PASS/FAIL/INCONCLUSIVE).
- File: `docs/phase-05/zero-reads-gate.md` (new)
  - The gate's method, the D1-attribution finding (live schema introspection confirms D1 analytics
    has no `scriptName`/`workerName` dimension), the full validity-rule table, the detection-floor
    derivation, and the live pre-archive baseline figures. Also records the ARCH-08 measurement
    method (05-04 Task 3).
- File: `docs/phase-05/evidence/baseline/d1-baseline-windows.json`, `deployed-bindings.json` (new)
  - Raw evidence from the live `--baseline-only` run this plan proves against.
- File: `tests/unit/load-test-zero-reads.test.mjs` (new)
  - 45 tests covering every behavior bullet: window math, baseline statistics, the detection-floor
    formula, GraphQL error redaction, introspection-first field confirmation (never a guessed
    field name), the production-vs-dev database id guard, deployed-bindings parsing, the 71-path
    request mix and its throw conditions, every INCONCLUSIVE validity rule, the preflight
    Server-Timing check, and the rate-limited alternating-headers request pass.
- File: `tests/fixtures/graphql/d1-baseline-windows.json`, `tests/fixtures/archive-plan.sample.json` (new)
  - Recorded GraphQL response shapes and the 05-06 archive-plan.json contract, used by the test
    suite so no test performs real network I/O.

## Why

The project's own "Core Value" is architecturally zero D1 reads on the public request path, and
the roadmap's own rule is that a failed gate halts the project for architecture review rather than
being logged as an in-phase defect — so the measuring instrument itself has to be built and proven
correct BEFORE the archive tier ships, not written hastily on gate day. Live schema introspection
against this account's own Cloudflare GraphQL API confirmed D1 analytics genuinely cannot
attribute a row read to a specific Worker, which settles the method: leg 2 has to be a
databaseId-filtered delta measurement against v1's own background, not an attribution query that
doesn't exist. The live baseline run also surfaced a real, disclosed limitation worth recording
before gate day: v1's own D1 background is so noisy (~784M rows/day) that even at the tool's own
20,000-request safety cap, the detection floor is ~40 rows/request, not 1 — this is now written
down in the doc rather than discovered for the first time during the real gate run.

## Issues Encountered

Tasks 1 and 2 share one module by design (Task 2 extends Task 1's own `load-test-zero-reads.mjs`
with the request-mix/verdict/pass-runner functions) and were implemented as a single coherent
pass rather than as two separately-committed RED-then-GREEN TDD cycles — the full test suite was
written and verified green together, not sequenced into a demonstrably-failing commit followed by
a passing one. This is a deliberate, disclosed deviation from this project's usual TDD commit
discipline (see 05-01/05-03's own genuine RED/GREEN cycles for the contrast), recorded in this
plan's own SUMMARY.md rather than hidden.

## Dependencies

No dependencies added — both files use only Node built-ins and the global `fetch`.

## Testing Notes

- What was tested: every exported pure function (`comparableWindows`, `summarizeBaseline`,
  `detectionFloor`, `buildRequestMix`, `windowTouchesIngestSlot`, `decideZeroReadsVerdict`) against
  hand-computed expected values and boundary cases; every network-facing function
  (`fetchD1RowsRead`, `fetchDeployedBindings`, `runPreflight`, `runPass`, `runLoadTest`) against an
  injected fake `fetchImpl`/`sleep`, using the recorded fixture response shapes.
- What wasn't tested: the full default (non-`--baseline-only`) request pass was never run live
  against `dev.915tldr.com` in this session — only `--baseline-only` (read-only GraphQL calls,
  zero cost) was proven live, per this plan's own explicit scope. The full pass is 05-12's own gate
  day run, after the archive tier is serving (D-03).
- Edge cases: a zero-total baseline/load window, a thin (<5-sample) baseline, a window touching
  the v1 ingest slot, a window overlapping a build, an incomplete pass (<95% completed), and an
  unconfirmed archive Server-Timing metric are each pinned by a dedicated test.

## Next Steps

- [ ] 05-04 Task 3 (ARCH-08 live KV/CPU measurement) is a separate commit immediately following
      this one.
- [ ] 05-12 (the real gate day) runs the full `load-test-zero-reads.mjs` pass (no
      `--baseline-only`) once the archive tier is serving, consuming `dist/archive-plan.json` from
      05-06/05-07 for the `--archive-plan` input.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new measurement tooling only; no production code path changed. Live-ran
read-only Cloudflare API calls ($0 cost) against production D1 and the deployed Worker's own
settings; no write, no deploy, no dev-server start.

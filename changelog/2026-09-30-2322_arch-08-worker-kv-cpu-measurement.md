# 2026-09-30 - ARCH-08 live measurement: KV reads and Worker CPU time off the deployed Worker

**Keywords:** [BACKEND] [TESTING] [PERFORMANCE]
**Session:** Evening, Duration (~30 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2322_arch-08-worker-kv-cpu-measurement.md`

## What Changed

- File: `tools/measure-worker-kv-cpu.mjs` (new)
  - ARCH-08's live measurement, reading KV reads and Worker CPU time off the deployed `915tldr-v2`
    Worker rather than estimating them. `summarizeWorkerWindow` converts the live
    `workersInvocationsAdaptive`/`kvOperationsAdaptiveGroups` CPU fields (confirmed MICROSECONDS
    via the live GraphQL schema's own field descriptions) into `{ invocations, kvReads, cpuP50Ms,
    cpuP99Ms, cpuMaxMs }`. `decideArch08Verdict` reports `KV_READS_WITHIN_BUDGET`/
    `KV_READS_OVER_BUDGET` and `CPU_WITHIN_BUDGET`/`CPU_OVER_BUDGET` independently, `INCONCLUSIVE`
    on both axes when the window overlaps a build or has zero invocations.
    `fetchWorkerInvocations`/`fetchKvReadOperations` confirm every dataset's field names by live
    introspection before querying. `detectBuildOverlap` reuses the same `/version.json`
    before/after rule as `load-test-zero-reads.mjs`, with a documented-weaker `--assume-no-build`
    fallback for historical windows. This tool is a measurement/reporting instrument, not a
    go/no-go gate — a successful run always exits 0; the verdict is in the output, not the exit
    code.
  - Live-ran `node tools/measure-worker-kv-cpu.mjs --from ... --to ... --assume-no-build --json
    --evidence docs/phase-05/evidence/worker-kv-cpu` against the real deployed `915tldr-v2`
    Worker's last 24h: 94 invocations, 102 KV reads, CPU p50=0.830ms, p99=1.883ms, max=1.883ms —
    CPU comfortably within the <5ms budget; KV reads (102) mildly exceed invocations (94), a real
    measured finding disclosed in `docs/phase-05/zero-reads-gate.md` rather than rounded away
    (every Worker invocation performs at most one KV read by construction per 05-03's own unit
    matrix — this is very likely dataset-bucketing skew between the two independently-aggregated
    GraphQL datasets, not a code defect, and is flagged for a wider-window re-check rather than
    chased further in this plan).
- File: `tests/fixtures/graphql/workers-invocations.json`, `kv-operations.json` (new)
  - Recorded GraphQL response shapes from the live run above, used by the unit test suite.
- File: `tests/unit/measure-worker-kv-cpu.test.mjs` (new)
  - 17 tests covering every behavior bullet: the microsecond-to-millisecond conversion, every
    `decideArch08Verdict` budget line (KV within/over, CPU within/over on either the p99 or max
    axis, build-overlap INCONCLUSIVE, zero-invocations INCONCLUSIVE), the live dataset field
    filters (`scriptName`, `namespaceId`, `actionType: "read"`), introspection-first field
    confirmation, and `detectBuildOverlap`'s both modes.
- File: `docs/phase-05/zero-reads-gate.md`
  - Already carries the "ARCH-08 method" section (written in the prior commit as one complete
    doc artifact covering the whole plan) — no further edit needed for this commit.

## Why

PROJECT.md's own Performance constraint caps Worker CPU at <5ms and KV reads at <=1 per request.
Measuring this on the real deployed Worker — rather than estimating it — follows the same
"measure the real platform" discipline Phase 3/4 already established for render cost and build
time, and gives whoever runs the 05-12 gate day a working, pre-proven tool rather than one built
under gate-day time pressure.

## Issues Encountered

The live run genuinely shows 102 KV reads against 94 invocations in a real 24h window — reported
exactly as measured. `decideArch08Verdict` correctly surfaces this as `KV_READS_OVER_BUDGET`
rather than rounding it into a clean PASS; investigated just far enough to rule out a code defect
(05-03's own KV-count matrix already structurally proves every request shape performs 0 or 1 KV
read) before flagging the likely explanation (dataset-bucketing skew) and moving on — re-chasing
it further is out of this plan's scope.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every exported function against the recorded live fixtures and hand-built
  edge cases (zero invocations, build overlap, each budget boundary).
- What wasn't tested: a real build-overlap window (no build ran during this session's
  measurement window) — `detectBuildOverlap`'s "build happened" branch is tested with an injected
  fake only, not a real overlapping build.
- Edge cases: p99 just under/at the 5ms budget, max just under/at the 20ms hard-fail line, and a
  window with zero invocations are each pinned by a dedicated test.

## Next Steps

- [ ] If a wider measurement window later confirms the KV-reads-vs-invocations skew is real and
      not a bucketing artifact, investigate further — not blocking for this plan.
- [ ] 05-04's plan-completion metadata commit (SUMMARY.md, STATE.md, ROADMAP.md,
      REQUIREMENTS.md) follows as a separate commit.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - new measurement tooling only; read-only Cloudflare API calls ($0 cost) against
the deployed Worker's own analytics. No production code path changed.

# 2026-10-02 - Plan 05-17 Task 2: IN-01 correlation evidence and the ARCH-08 decision doc

**Keywords:** [BACKEND] [TESTING] [SECURITY] [ARCHITECTURE] [DOCUMENTATION] [CRITICAL]
**Session:** Afternoon, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1707_05-17-task2-in01-correlation-and-decision-doc.md`

## What Changed

- File: `tools/measure-worker-cpu-outliers.mjs`
  - Added `fetchPathEventHistory(path, {from, to}, deps)` — fetches the TRUE full-window
    occurrence list for one exact path via `$workers.event.path eq` (confirmed exact
    against a bogus-path control returning 0 matches), reusing the same
    pagination-completeness guard as `fetchInvocationEvents`.
  - `runMeasurement`'s `--correlate` path now merges each outlier's full per-path history
    into the correlation universe before calling `correlateOutliers`, so
    `samePathCount`/`samePathRank` are exact full-window figures, not approximations from
    the 5-event outlier-only fetch. `correlation.json` now carries an explicit
    `coloPopulationCaveat` documenting that colo-level fields (`firstInColoInWindow`,
    `gapSincePrevSameColoMs`) are scoped to this known population, not the full ~8,477
    invocation window (blocked by the same 2000-row/no-cursor cap recorded in Task 1).
- File: `tests/unit/measure-worker-cpu-outliers.test.mjs` — 2 new tests for
  `fetchPathEventHistory` (filter shape, completeness-throw). 19 tests total now.
- File: `docs/phase-05/arch-08-cpu-outliers.md` (new) — Method, Definitive counts,
  Reconciliation, IN-01 correlation, Decision inputs (three options, no recommendation).
- File: `docs/phase-05/evidence/cpu-outliers-gate-20261001/correlation.json`,
  `aggregate/workers-invocations.json`, `aggregate/kv-operations.json`

## Why

Task 1 produced the definitive per-request outlier count (4 ≥20ms, 5 ≥5ms). Task 2 gathers
the IN-01 correlation evidence 05-REVIEW.md asked for (cold isolate vs request logic) and
writes the owner-facing decision document — without choosing an option, per ARCH-08's
"no decision in this plan" constraint (05-19 owns the decision).

## Issues Encountered

- The naive approach (running `correlateOutliers` against only the 5 fetched outlier
  events) would have reported `samePathCount: 2` for the two `wall-street-faces-decline`
  outliers, when the true figure (fetched via the new per-path query) is 281 — the article
  was hit 281 times across the 42-minute window, not twice. Caught before writing the doc
  by actually running the live per-path count query and comparing it against the naive
  in-memory count, rather than trusting the smaller dataset's arithmetic.
- That live check surfaced the plan's most useful finding: 4 of 5 outliers sit on exactly
  3 paths hit ~280 times each (roughly once every 9 seconds for the whole window) —
  consistent with the gate's own repeated-URL load generation, not organic traffic. The
  sole non-repeated path (hit once) is the smallest of the five outliers. Documented as a
  correlation, explicitly not asserted as a proven cause.
- `summarizeCpuOutliers`'s `p99Ms` field, when fed only the 5-event outlier-only fetch,
  computes the p99 *of those 5 outliers* (≈ their max) — not the window's true p99, which
  lives among the ~8,472 sub-5ms invocations this run could not enumerate (the same
  2000-row cap from Task 1). The doc explicitly does NOT present that field as "the
  window's p99" and cites the aggregate tool's 2.846ms instead, correctly labeled as the
  aggregate's own figure — avoiding exactly the kind of unsupported-figure mistake this
  plan exists to correct.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the new `fetchPathEventHistory` filter shape and its
  completeness-throw behavior (mirrors `fetchInvocationEvents`'s own tests).
- Live run: `--correlate` against the real gate window, plus
  `measure-worker-kv-cpu.mjs --assume-no-build` over the identical window for the
  side-by-side aggregate comparison recorded in the doc's Reconciliation section.
- What wasn't tested: IN-02 (`nodejs_compat` removal) — named as an untested hypothesis
  per the reviewer's own suggestion, explicitly out of scope for this read-only plan
  (removing a compat flag requires a deploy).

## Next Steps

- [ ] 05-19: owner decision on ARCH-08's three options (accept / fix / re-measure).
- [ ] 05-21: update REQUIREMENTS.md's ARCH-08 line once the owner decides.

---

**Branch:** feature/phase-05
**Issue:** ARCH-08 (05-VERIFICATION.md gap 1); GSD plan 05-17
**Impact:** HIGH - completes the evidence package for a disputed production CPU-budget
measurement; no production code path changed; no decision made.

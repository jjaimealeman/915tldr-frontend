# 2026-10-01 - Fix: zero-reads gate's analytics catch-up wait was dead code on the live CLI path

**Keywords:** [BUG_FIX] [TESTING] [PERFORMANCE] [CRITICAL]
**Session:** Afternoon, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1243_05-12-fix-dead-analytics-catchup-wait.md`

## What Changed

- File: `tools/load-test-zero-reads.mjs`
  - Added `checkD1AnalyticsCaughtUp(atIso, deps)` — a live, open-ended `datetimeFiveMinutes_geq`
    probe against the production D1 analytics dataset (mirrors the existing `fetchD1RowsRead`
    query shape), returning whether any data point exists at or after a given instant.
  - Changed `runLoadTest`'s default `checkCaughtUp` (used whenever a caller — i.e. the real CLI,
    since `main()` never passes `deps`— doesn't inject a test double) from an unconditional
    `async () => true` to a real call to `checkD1AnalyticsCaughtUp(windowEnd.toISOString(), ...)`.
    Corrected the stale comment above it that claimed "the live CLI path always polls."
- File: `tests/unit/load-test-zero-reads.test.mjs`
  - Added 2 unit tests for `checkD1AnalyticsCaughtUp` (true/false cases, confirms the query
    filters on `PRODUCTION_D1_DATABASE_ID`).
  - Added 2 full-pass `runLoadTest` integration tests: one proving the live default genuinely
    queries analytics (not an unconditional true) and reaches a judged PASS/FAIL verdict when
    caught up immediately; one proving it correctly reports the `analytics-not-caught-up`
    INCONCLUSIVE rule after the capped 15-minute wait when the live poll never succeeds.

## Why

Found while reading `tools/load-test-zero-reads.mjs` immediately before running it live for
05-12 — the gate this whole project was rebuilt to pass. The tool's own header comment, the
`ANALYTICS_CATCHUP_POLL_MS`/`ANALYTICS_CATCHUP_MAX_WAIT_MS` constants, and 05-12-PLAN.md's own
action text ("it performs preflight, leg 1b..., the paced pass, the analytics catch-up wait and
the verdict") all describe a live polling wait before trusting the load window's own `rowsRead`
reading. But `runLoadTest()`'s `checkCaughtUp` fallback was `async () => true` whenever
`deps.checkCaughtUp` wasn't supplied, and `main()` (the actual CLI entrypoint) never supplies
it — so every real invocation of this tool skipped the wait entirely and queried D1 analytics for
the load window immediately after the request pass ended, with zero confirmation the dataset had
actually ingested that window's data yet. On a dataset with any real ingestion lag, that risks an
undercounted (falsely low) `rowsRead` reading — which would silently manufacture a false PASS on
the single measurement 915 TLDR v2's "architecturally zero D1 reads on the public path" premise
rests on. Fixed before the real gate run so the live measurement about to be taken is trustworthy,
not just well-documented.

## Issues Encountered

None beyond the bug itself — no workaround needed, the fix wires an already-designed (constants
already existed) but never-connected code path.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `checkD1AnalyticsCaughtUp` directly (fixture-driven, no real network); the
  live-default wiring and the capped-wait give-up path, both via a full (non-baseline) `runLoadTest`
  pass with injected `fetchImpl`/`sleep`/`now`. All 49 tests in
  `tests/unit/load-test-zero-reads.test.mjs` pass (45 pre-existing + 4 new). Full
  `pnpm run test:fast` (672/672), `pnpm run guard:config`, and `pnpm run test:build-gate` (9/9)
  also re-verified clean.
- What wasn't tested: the real live GraphQL endpoint's actual ingestion lag for this account's D1
  analytics dataset — that's exactly what 05-12's own real gate run, immediately following this
  fix, measures for real.
- Edge cases: the "never catches up" path (15 one-minute-equivalent polls, each a no-op in the
  test's injected `sleep`) correctly falls through to `analyticsNotCaughtUp: true` and
  `loadRowsRead: null`, never fabricating a number.

## Next Steps

- [ ] Proceed with 05-12's real gate run now that this measurement tool is live-correct.
- [ ] No further action needed on this fix — it's self-contained and fully covered by the new
  tests.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - this measurement tool decides whether the project's core "zero D1 reads"
premise is proven or the project halts for architecture review (D-02); a false PASS here would
have gone undetected.

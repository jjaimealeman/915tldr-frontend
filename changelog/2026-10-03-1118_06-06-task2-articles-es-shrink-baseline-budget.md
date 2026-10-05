# 2026-10-03 - Plan 06-06 Task 2: Spanish Never-Shrink Baseline, Measured Budget, Loader Edge Cases

**Keywords:** [BACKEND] [DATABASE] [FEATURE] [I18N] [TESTING]
**Session:** Morning, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1118_06-06-task2-articles-es-shrink-baseline-budget.md`

## What Changed

- File: `src/lib/server/build-state.ts`
  - Added `LastGoodArticlesEsState` (alias of `LastGoodArticlesState`) and an optional
    `articlesEs?: LastGoodArticlesEsState` field on `LastGoodState` — optional only for backward
    compatibility with every pre-Phase-6 baseline already recorded in KV.
  - `PendingBuildState` now picks `'articlesEs'` alongside `'articles'`/`'changelog'`.
  - `validateLastGoodShape` validates an `articlesEs` section's shape (`count`/`ids`) when present,
    matching the existing `articles`/`changelog` validation discipline.
  - `commitLastGood`'s default `requiredSections` is now `['articles', 'changelog', 'articlesEs']`
    — the Spanish loader writes this section on every build (even when empty), so a build that
    skipped it must not be allowed to commit a baseline.
- File: `src/content/loaders/articles-es-loader.ts`
  - Replaced the Task 1 placeholder `ES_ROWS_READ_BUDGET` comment with a measured-and-projected
    figure: production holds 0 real Spanish rows right now, so the projection is built from the
    CROSS JOIN query's own confirmed per-unit cost (`EXPLAIN QUERY PLAN`: one range-scan read plus
    one point-lookup read per matched row, ~2 rows read per translation row) rather than an
    arbitrary round number. Projected at the full backfill scale (~41,000 rows): ~82,000 rows read
    for one cold pass; applying the 2x margin discipline: 164,000 -> next round number 200,000
    (value unchanged from the Task 1 placeholder, now grounded instead of arbitrary).
  - The loader's never-shrink check (added in the same pass as Task 1, see 06-06-SUMMARY.md's
    disclosed deviation) skips `evaluateShrink` entirely when no Spanish translation has ever
    existed (current rows 0 AND previous baseline null or count 0) — a legitimate steady state
    before the pilot/backfill lands, unlike the English loader's unconditional "zero rows is
    always a failure" rule. When a pre-Phase-6 last-good record exists with no `articlesEs`
    section at all, the loader treats it as an automatic bootstrap (first-ever Spanish baseline)
    even if `BUILD_STATE_REQUIRE_BASELINE=1` is set — that flag guards a missing baseline, not a
    section that didn't exist before this phase.
- File: `tests/unit/articles-es-loader.test.mjs` (new)
  - Pins every behavior bullet: null-baseline-zero-rows success, bootstrap-without-explicit-flag
    on a pre-Phase-6 record, never-shrink throw naming `articles-es`, allowance-based
    shrink/growth, budget-exceeded-throws-before-mutation, held-row-upsert-replaces-available-row,
    mode selection (empty store / fresh lastCold / `ARTICLES_FORCE_COLD=1`), malformed-row handling
    (bad JSON, invalid uuid), and the summary log line's exact shape.
- File: `tests/unit/build-state.test.mjs`
  - Extended `readLastGood` coverage for a valid/missing/malformed `articlesEs` section.
  - Extended `commitLastGood` coverage using the REAL default `requiredSections` (no explicit
    override) to prove `articlesEs` is now required by default, not just when the caller asks.

## Why

The Spanish collection needs the same fail-loud never-shrink guarantee as the English one (D-14's
discipline), but tuned for a collection that legitimately starts empty and fills gradually during
the backfill — a flat reuse of the English loader's "zero rows is always a failure" rule would
block every build until the first Spanish row exists.

## Issues Encountered

None new in this task — the CROSS JOIN query-plan fix (Task 1) already resolved the one real
issue found during this plan's live verification; this task's own work (shrink-check exception,
budget comment, test coverage) matched the plan's action text without further surprises.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every named behavior bullet in the plan, via a Map-backed fake `LoaderContext`
  and `deps` test seams (no real D1/KV network access), plus `build-state.ts`'s real
  `commitLastGood` default-requiredSections path.
- What wasn't tested: the real shrink-check behavior at full backfill scale (only synthetic rows
  used here) — will be exercised for real once 06-08's pilot write and the later full backfill land
  real rows in production.
- Edge cases: a held row upserted over a previously-available entry; a pre-Phase-6 last-good record
  with no `articlesEs` section at all; `ARTICLES_FORCE_COLD=1` overriding otherwise-warm conditions.

## Next Steps

- [ ] Re-measure `ES_ROWS_READ_BUDGET` directly once the backfill (06-08+) lands real Spanish rows.
- [ ] Build the `/es` route tree and templates (later plans in this phase) against `articlesEs`
      and `spanish-view.ts`.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - extends the existing build-state contract (new required section) and the new
Spanish loader; no existing collection/route behavior changed.

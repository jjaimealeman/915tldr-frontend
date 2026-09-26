# 2026-09-26 - Dry Run, Last-Good Build State, and Cold/Sweep D1 Fetchers

**Keywords:** [BACKEND] [DATABASE] [FEATURE] [TESTING]
**Session:** Evening, Duration (~40 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1749_04-03-dry-run-last-good-state-cold-fetchers.md`

## What Changed

- File: `tools/sync-dry-run.mjs`
  - New: read-only dry-run script (4 `SELECT COUNT(*)` statements) satisfying CLAUDE.md's
    "no bulk corpus operation without a dry run reporting row count and projected cost" rule
  - Prints public/total article counts, tag/category row counts, projected cold request count
    at 5,000 rows/page, projected cold rows read (scaled from Phase 3's measured 957,008-row
    ratio), projected KV writes, and projected cost against live-fetched Cloudflare D1/KV
    pricing pages (both source URLs printed in the output)
- File: `docs/phase-04/build-measurements.md`
  - New: records the dry run's real output — projected total cost $0.000000, well under the
    $1 approval threshold — before any cold-capable loader code was written
- File: `src/lib/server/build-state.ts`
  - New: `LAST_GOOD_KEY` (`build:last-good`), `readLastGood()`/`commitLastGood()` against the
    render-manifest KV namespace, `writePendingBuildState()`/`readPendingBuildState()` for the
    per-build `.astro/build-state.pending.json` scratch file, and `evaluateShrink()` — D-14's
    never-shrink check (explained vs. unexplained removals, an allowance, a
    `requireBaseline`/`bootstrap` pair for the first-ever baseline)
- File: `src/lib/server/d1-client.ts`
  - Extracted `stitchArticles()` from `fetchPublicArticlesWindow()` so every fetcher (window,
    cold, sweep) applies identical public/non-public classification rules
  - New: `fetchAllArticlesStitched()` — full-corpus keyset pagination at `LIMIT 5000` across
    `articles` (by `id`), primary `article_categories` (by `article_id`), and `article_tags`
    (by the composite `(article_id, tag_id)` tuple)
  - New: `fetchArticlesStitchedByIds()` — chunked `IN` lookups (≤100 params) across all three
    tables, for the sweep path's small re-fetch set
  - New: `fetchChangedSince()` — the daily sweep signal, one `updated_at > ? OR processed_at > ?`
    statement returning internal ids
- File: `tests/unit/build-state.test.mjs`
  - New: 15 tests pinning `evaluateShrink`'s full behavior matrix, `readLastGood`'s
    404/valid/malformed/missing-field outcomes, pending-state merge-across-calls, and
    `commitLastGood`'s required-section refusal
- File: `tests/unit/d1-client-cold.test.mjs`
  - New: 9 tests pinning `stitchArticles` reuse, `fetchAllArticlesStitched`'s pagination
    cursoring (article-id and composite tag cursor) and 100-param ceiling, chunked
    `fetchArticlesStitchedByIds`, and `fetchChangedSince`'s statement shape

## Why

REND-01/REND-02 need a cold path (full-corpus bulk fetch, self-healing on a purged cache) and a
cheap daily sweep signal, without ever re-scanning the whole corpus every 2-hour cron cycle
(Phase 3's binding constraint: 957,008 rows/pass × 12 cycles/day = 11.5M rows/day, 2.3x the daily
hard-fail budget). D-14 requires that "fewer rows than expected" be evaluated against a
persisted last-good baseline, not a raw count, and that check has to survive a Workers Builds
cache purge — hence storing it in KV rather than only in the per-build `.astro/` scratch file.

## Issues Encountered

No major issues encountered. This was a genuine TDD task (`tdd="true"`): both new test files
were written first and confirmed to fail with `ERR_MODULE_NOT_FOUND` / missing-export errors
(RED) before any implementation code existed, then made to pass (GREEN) without needing to
adjust the tests afterward. Refactoring `fetchPublicArticlesWindow()` to call the new shared
`stitchArticles()` kept the pre-existing `tests/unit/d1-client.test.mjs` (04-01) green
unmodified, and `pnpm run build` still produced all 328 pages with no regression.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `evaluateShrink`'s full decision matrix (growth, explained removal,
  unexplained removal at/over an allowance, empty-store failure, missing-baseline with
  `requireBaseline`/`bootstrap` in all four combinations), `readLastGood`'s four distinct KV
  outcomes, pending-file merge semantics on a real (tmp, isolated) filesystem, and the cold/sweep
  D1 fetchers' pagination and chunking behavior against a stubbed `fetchImpl` — no real network
  access in any new test.
- What wasn't tested: the loader's own mode-selection logic (cold vs. warm vs. warm+sweep) —
  that is Task 2 of this same plan (04-03), not yet executed.
- Edge cases: zero-row current set always fails regardless of allowance/bootstrap; a missing
  `articles.ids` field in a stored last-good value throws rather than being silently coerced.

## Next Steps

- [ ] Task 2: wire `build-state.ts` and the new `d1-client.ts` fetchers into
      `articles-loader.ts`'s mode selection (cold/warm/warm+sweep), budgets, and manifest deletes
- [ ] Task 3: run the first measured full-corpus build and set the provisional budgets from real
      numbers

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM — new backend modules and tests only; no page-rendering or user-facing change
in this task. Sets up the loader mechanics Task 2/3 depend on.

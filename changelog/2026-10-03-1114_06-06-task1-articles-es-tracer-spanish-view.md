# 2026-10-03 - Plan 06-06 Task 1: articlesEs Tracer — Spanish Translations Reach the Build

**Keywords:** [BACKEND] [FEATURE] [DATABASE] [I18N] [SECURITY] [TESTING] [BUG_FIX]
**Session:** Morning, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1114_06-06-task1-articles-es-tracer-spanish-view.md`

## What Changed

- File: `src/lib/server/d1-client.ts`
  - Added `TranslationRow`, `fetchTranslationsAll()` (keyset-paginated cold fetch, LIMIT 5000
    pages on `t.article_id`), `fetchTranslationsChangedSince()` (single bound-parameter warm
    catch-up fetch) — both scoped to `article_translations WHERE language = 'es'`, joined to
    `articles.id` only (no existing `articles` query/index touched).
  - Fixed a real, live-confirmed query-plan bug (see Issues Encountered): switched the join from a
    plain `JOIN` to SQLite's `CROSS JOIN` to pin the FROM-clause join order.
- File: `src/content/loaders/articles-es-loader.ts` (new)
  - `articlesEsLoader()` — a second, independent Content Layer loader (cold/warm sync modes),
    mirroring `articles-loader.ts`'s structure with its own constants:
    `ES_LOADER_STATE_VERSION`, `ES_COLD_RESYNC_INTERVAL_SECONDS`, `ES_SYNC_OVERLAP_SECONDS`,
    `ES_ROWS_READ_BUDGET`.
  - `articleEsSchema` (astro/zod) validates every row; a row that fails validation (bad
    `key_points` JSON, invalid uuid, out-of-enum `source_language`) is excluded and counted as
    `malformed`, never thrown — one bad translation can't crash the whole build.
  - Held (`grounding_status !== 'clean'`) rows are stored with `available: false` and null
    title/summary/keyPoints — held Spanish text never enters the content store.
- File: `src/content.config.ts`
  - Registered the new `articlesEs` collection alongside the existing `articles`/`changelog`
    collections — purely additive, every existing `getCollection('articles')` call site untouched.
- File: `src/lib/i18n/spanish-view.ts` (new)
  - `buildEsIndex()` / `localizedArticleView()` — the pure join between an English article and its
    (possibly missing or held) Spanish entry. Zero `src/lib/server/` imports, confirmed by the
    build's own D1-import assertion gate. Re-exports `categoryLabel` from `category-labels.ts`.
- File: `tests/unit/d1-client-translations.test.mjs` (new), `tests/unit/spanish-view.test.mjs` (new)
  - Pin keyset pagination, the single bound parameter on the changed-since query, and the pure
    join's four cases (available / held / missing / genuinely Spanish-origin).

## Why

I18N-01/I18N-04 need Spanish translations available to the build as their own Content Layer
collection, read through the one permitted D1 module, so every `/es` template (and the English
page's "Originally reported in Spanish" label) can join against it without ever touching D1
directly. A separate collection (not a doubled `articles` collection) keeps every existing render
path byte-identical.

## Issues Encountered

**Rule 1 bug, found live against production before it ever shipped:** a plain SQL `JOIN` between
`article_translations` (currently near-empty) and `articles` (44,217 rows) let D1/SQLite's query
planner drive the join from `articles` instead of the much smaller `article_translations` —
confirmed via a live `EXPLAIN QUERY PLAN` showing `SEARCH a USING INTEGER PRIMARY KEY (rowid>?)`
as the outer loop. A real query returning zero rows read 44,218 rows to get there — the same class
of bug as this project's own previously-documented "D1 index flip made related-articles 26x
costlier" incident. Fixed with SQLite's `CROSS JOIN` keyword, which pins the FROM-clause join
order without changing the join's semantics (both tables still carry a real `ON` condition, not an
actual cross product); a second live `EXPLAIN QUERY PLAN` confirmed the planner now drives from
`article_translations` (`SEARCH t USING INDEX ... article_id>?`) and does one point lookup into
`articles` per match, and the identical zero-row query now reads exactly 1 row.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `fetchTranslationsAll`'s keyset pagination (single short page, a full
  5000-row page followed by a short second page, zero rows) and bound-parameter shape;
  `fetchTranslationsChangedSince`'s single bound parameter; `buildEsIndex`/`localizedArticleView`'s
  four behavior cases. All stubbed `fetchImpl` — no real network calls in the test files.
- Live verification (not just unit tests): a real `pnpm run build` against production D1 exits 0
  and logs exactly one `[articles-es] mode=cold rows=0 available=0 held=0 malformed=0 rowsRead=1
  budget=200000` line — `rows=0` matches a live `SELECT COUNT(*) FROM article_translations WHERE
  language='es'` (also 0; production has not yet received any Spanish rows). The pre-existing
  English loader (`src/content/loaders/articles-loader.ts`) is confirmed byte-unchanged against
  base commit `6b38836`.
- What wasn't tested: behavior once real Spanish rows exist in production (available/held rows at
  non-zero scale) — covered by Task 2's own test suite using synthetic rows, and by a real
  re-measurement once the backfill (06-08+) lands.

## Next Steps

- [ ] Task 2: the Spanish never-shrink baseline (`build-state.ts`), the measured rows-read budget,
      and loader edge cases (held-row upsert, bootstrap-without-baseline).
- [ ] Re-measure `ES_ROWS_READ_BUDGET` directly once real Spanish rows exist in production.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - new Content Layer collection and D1 read path; no existing collection/route
behavior changed.

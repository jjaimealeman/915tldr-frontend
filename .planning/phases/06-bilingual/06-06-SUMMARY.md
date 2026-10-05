---
phase: 06-bilingual
plan: 06
subsystem: database

tags: [astro, content-layer, d1, cloudflare, sqlite, i18n]

# Dependency graph
requires:
  - phase: 06-bilingual (06-01)
    provides: "article_translations schema (local replica) — the 12-column shape this loader reads"
  - phase: 06-bilingual (06-03)
    provides: "article_translations LIVE in production D1 (915tldr-db), confirmed empty at this plan's build time"
  - phase: 06-bilingual (06-05)
    provides: "src/lib/i18n/category-labels.ts (categoryLabel, re-exported from spanish-view.ts)"
provides:
  - "articlesEs Content Layer collection (src/content.config.ts) — a SECOND, independent collection reading Spanish translations through the one permitted D1 module, never touching the English articles collection"
  - "src/lib/server/d1-client.ts: TranslationRow, fetchTranslationsAll(), fetchTranslationsChangedSince() — both scoped to language='es', using CROSS JOIN to pin the join order (Rule 1 fix, see Deviations)"
  - "src/content/loaders/articles-es-loader.ts: articlesEsLoader(), articleEsSchema, ES_LOADER_STATE_VERSION, ES_COLD_RESYNC_INTERVAL_SECONDS, ES_SYNC_OVERLAP_SECONDS, ES_ROWS_READ_BUDGET — cold/warm sync, fail-loud budget + never-shrink check tuned for a collection that legitimately starts empty"
  - "src/lib/i18n/spanish-view.ts: buildEsIndex()/localizedArticleView() — the pure join future /es templates and the English article page's D-07 label will read through, zero src/lib/server/ imports"
  - "src/lib/server/build-state.ts: articlesEs is now a required section of the last-good baseline by default"
affects: [06-bilingual-route-tree, 06-bilingual-static-pages, 06-bilingual-backfill, 06-bilingual-go-live-decision]

# Actuals (#2632)
actuals:
  tokens: 14500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate collection over doubled collection (06-RESEARCH.md Pattern 2): articlesEs is its own Content Layer collection, joined to articles only at template-render time via spanish-view.ts — every existing getCollection('articles') call site stays byte-identical"
    - "CROSS JOIN to pin D1/SQLite join order: a plain JOIN between a near-empty table and a large one lets the planner silently drive from the large table (same class of bug as this project's documented 'D1 index flip' incident) — CROSS JOIN with a real ON condition (not an actual cross product) forces the FROM-clause order without changing semantics"
    - "Spanish-specific never-shrink exception: the English loader's D-14 'zero rows is always a failure' rule does not apply to articlesEs — the check is skipped only when current rows are empty AND no non-empty baseline has ever existed, since a sparse, gradually-filling collection has a legitimately empty steady state the English loader never has"

key-files:
  created:
    - src/content/loaders/articles-es-loader.ts
    - src/lib/i18n/spanish-view.ts
    - tests/unit/d1-client-translations.test.mjs
    - tests/unit/spanish-view.test.mjs
    - tests/unit/articles-es-loader.test.mjs
  modified:
    - src/lib/server/d1-client.ts
    - src/content.config.ts
    - src/lib/server/build-state.ts
    - tests/unit/build-state.test.mjs

key-decisions:
  - "A plain SQL JOIN between article_translations (near-empty) and articles (44,217 rows) let D1's query planner drive from articles instead — confirmed live via EXPLAIN QUERY PLAN (rows_read 44,218 for a zero-row query). Fixed with SQLite's CROSS JOIN keyword, confirmed down to rows_read 1 for the identical query. Applied to both fetchTranslationsAll and fetchTranslationsChangedSince."
  - "ES_ROWS_READ_BUDGET kept at 200,000 (Task 1's placeholder value) but re-grounded in Task 2 from the CROSS JOIN query's own confirmed per-unit cost (~2 rows read per matched translation row) projected to D-10's ~41,000-row backfill scale, rather than left as an arbitrary round number — production holds 0 real Spanish rows at measurement time, so a direct full-scale cold-pass measurement isn't yet possible."
  - "The never-shrink check is skipped entirely (not passed a flag evaluateShrink doesn't support) when current rows are empty and no non-empty Spanish baseline has ever existed — a legitimate pre-backfill steady state, distinct from the English loader's unconditional zero-rows-is-failure rule."
  - "A pre-Phase-6 last-good record with no articlesEs section at all is treated as an automatic bootstrap (first-ever Spanish baseline), even when BUILD_STATE_REQUIRE_BASELINE=1 is set — that flag guards a missing/corrupted baseline, not a section that never existed before this phase; otherwise the first production build after this phase deploys would fail outright."

patterns-established:
  - "articles-es-loader.ts mirrors articles-loader.ts's header-comment/constants/ordering convention but with its OWN independent constants (ES_* prefix) and a simpler two-mode (cold/warm) sync, matching 06-PATTERNS.md's guidance not to import the English loader's constants."

requirements-completed: []  # I18N-01/I18N-04 remain Pending — this plan builds and live-proves the BUILD-SIDE READ instrument (a real pnpm build loads articlesEs from production D1 through the one permitted module, logs the correct row count, and the English collection stays byte-unchanged), not the full requirement (every public article's Spanish version rendered under /es). The /es route tree consuming this collection is later plans in this phase (06-07+), matching this project's own established precedent (05-02/05-04/06-01/06-05) of not marking a requirement complete until its full behavior is live.

coverage:
  - id: D1
    description: "A real pnpm run build loads the articlesEs collection from production article_translations (build-time D1 REST only, through d1-client.ts) and logs one '[articles-es] mode=... rows=...' line whose row count equals a live SELECT COUNT(*) FROM article_translations WHERE language='es'"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "tests/unit/d1-client-translations.test.mjs — fetchTranslationsAll keyset pagination, fetchTranslationsChangedSince bound-parameter shape"
        status: pass
      - kind: integration
        ref: "live pnpm run build against production D1: '[articles-es] mode=cold rows=0 available=0 held=0 malformed=0 rowsRead=1 budget=200000', matching a live SELECT COUNT(*) FROM article_translations WHERE language='es' (0) at measurement time"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every existing getCollection('articles') call site is untouched — the English collection, loader, budgets and manifest writes behave exactly as before"
    requirement: "I18N-01"
    verification:
      - kind: integration
        ref: "git diff --quiet 6b38836 -- src/content/loaders/articles-loader.ts (base commit before this plan) — empty diff, confirmed; live build's own '[d1-articles] mode=warm ...' line unchanged in shape"
        status: pass
    human_judgment: false
  - id: D3
    description: "An articlesEs entry is renderable (available) only when grounding_status is clean; a held row enters the store with available:false and no title/summary/keyPoints — held Spanish text can never reach a page"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "tests/unit/articles-es-loader.test.mjs — held-row upsert replaces a previously-available entry with available:false and null text; summary log line test asserts held=1 for a held row"
        status: pass
    human_judgment: false
  - id: D4
    description: "source_language is carried on every articlesEs entry, available or not, so the English page can show 'Originally reported in Spanish' even while the Spanish version is held"
    requirement: "I18N-02"
    verification:
      - kind: unit
        ref: "tests/unit/spanish-view.test.mjs — localizedArticleView: a held entry still reports sourceLanguage from the held entry; a genuinely Spanish-origin held article reports sourceLanguage 'es' while English renders"
        status: pass
    human_judgment: false
  - id: D5
    description: "The loader fails loud on a rows-read budget breach and on an unexplained drop versus the last-good Spanish baseline, treating zero rows as valid only while no non-empty baseline has ever existed"
    verification:
      - kind: unit
        ref: "tests/unit/articles-es-loader.test.mjs — budget-exceeded throws before any store mutation; previous-count-500-current-0 throws naming articles-es; previous [a,b,c]/current [a,b] with allowance 0 throws, [a,b,c,d] succeeds; previous-null-current-0 succeeds"
        status: pass
    human_judgment: false
  - id: D6
    description: "No module reachable from src/pages/** imports src/lib/server/**: spanish-view.ts is pure and the build-gate passes"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "node --test tests/ci-fixtures/assert-no-d1.test.mjs — 9/9 pass; spanish-view.ts carries zero src/lib/server/ imports by construction"
        status: pass
      - kind: integration
        ref: "pnpm run test:build-gate (runs inside pnpm run build) — exit 0"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 06: articlesEs Content Collection Summary

**A second, independent Content Layer collection (`articlesEs`) that reads Spanish translations from production D1 through the single permitted module, joined to the English collection by a pure helper — plus a live-found-and-fixed D1 query-plan bug that would have cost 44,000x more rows than necessary.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 of 2
- **Files modified:** 9 (5 new, 4 modified)

## Accomplishments

- `src/lib/server/d1-client.ts` gained `TranslationRow`, `fetchTranslationsAll()` (keyset-paginated
  cold fetch, LIMIT 5000 pages on `t.article_id`) and `fetchTranslationsChangedSince()` (single
  bound-parameter warm catch-up) — both scoped to `article_translations WHERE language = 'es'`,
  joined to `articles.id` only.
- `src/content/loaders/articles-es-loader.ts` is a new, independent Content Layer loader mirroring
  `articles-loader.ts`'s structure with its own constants (`ES_LOADER_STATE_VERSION`,
  `ES_COLD_RESYNC_INTERVAL_SECONDS`, `ES_SYNC_OVERLAP_SECONDS`, `ES_ROWS_READ_BUDGET`), two sync
  modes (cold/warm, simpler than the English loader's three), per-row validation that excludes and
  counts malformed rows rather than crashing the build, and a never-shrink check tuned for a
  collection that legitimately starts empty.
- `src/content.config.ts` registers `articlesEs` alongside `articles`/`changelog` — purely
  additive.
- `src/lib/i18n/spanish-view.ts` is the pure join (`buildEsIndex`/`localizedArticleView`) future
  `/es` templates and the English article page's "Originally reported in Spanish" label will read
  through — zero `src/lib/server/` imports, confirmed by the build's own D1-import assertion gate.
- `src/lib/server/build-state.ts` gained an optional `articlesEs` section on `LastGoodState`, and
  `commitLastGood`'s default `requiredSections` now includes it — a build that skips writing the
  Spanish section can no longer commit a last-good baseline.
- **Found and fixed a real, live D1 query-plan bug (Rule 1) before it ever shipped**: a plain SQL
  `JOIN` let D1/SQLite's planner drive the join from the 44,217-row `articles` table instead of
  the near-empty `article_translations` table, reading 44,218 rows for a query that returns zero
  rows. Confirmed via a live `EXPLAIN QUERY PLAN`, fixed with SQLite's `CROSS JOIN` keyword (which
  pins the FROM-clause order without changing the join's semantics), and confirmed again via a
  second live `EXPLAIN QUERY PLAN` that the cost dropped to 1 row read.
- Verified live, twice, against production: a real `pnpm run build` exits 0 and logs exactly one
  `[articles-es] mode=cold rows=0 available=0 held=0 malformed=0 rowsRead=1 budget=200000` line,
  where `rows=0` matches a live `SELECT COUNT(*) FROM article_translations WHERE language='es'`
  (also 0 at measurement time — 06-08's pilot write had not yet landed).

## Task Commits

1. **Task 1: Tracer — a real build reads production article_translations into the articlesEs
   collection** - `5c596f6` (feat)
2. **Task 2: Spanish never-shrink baseline, measured budget and loader edge cases** - `c08057e`
   (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

## Files Created/Modified

- `src/lib/server/d1-client.ts` - `TranslationRow`, `fetchTranslationsAll()`,
  `fetchTranslationsChangedSince()` (CROSS JOIN fix)
- `src/content/loaders/articles-es-loader.ts` - `articlesEsLoader()`, `articleEsSchema`, the four
  `ES_*` constants
- `src/content.config.ts` - registers `articlesEs`
- `src/lib/i18n/spanish-view.ts` - `buildEsIndex()`, `localizedArticleView()`
- `src/lib/server/build-state.ts` - `LastGoodState.articlesEs`, `commitLastGood` default
  `requiredSections`
- `tests/unit/d1-client-translations.test.mjs`, `tests/unit/spanish-view.test.mjs`,
  `tests/unit/articles-es-loader.test.mjs` - new
- `tests/unit/build-state.test.mjs` - extended for `articlesEs`

## Decisions Made

See `key-decisions` in the frontmatter. In brief: the CROSS JOIN fix for the D1 planner surprise;
keeping `ES_ROWS_READ_BUDGET` at 200,000 but re-grounding its comment in a measured per-unit cost
rather than an arbitrary number; and the Spanish-specific never-shrink exception (skip entirely
when no translation has ever existed, auto-bootstrap when a pre-Phase-6 baseline has no
`articlesEs` section at all).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A plain JOIN let D1's query planner drive from the wrong (44,217-row) table**
- **Found during:** Task 1's live verification (running the actual `pnpm run build` against
  production, per the task's own `<action>` step 5).
- **Issue:** `fetchTranslationsAll`'s SQL used a plain `JOIN article_translations t ... JOIN
  articles a ON a.id = t.article_id`. A live `EXPLAIN QUERY PLAN` showed D1/SQLite choosing to
  drive the nested loop from `articles` (`SEARCH a USING INTEGER PRIMARY KEY (rowid>?)`) instead
  of the near-empty `article_translations`, reading 44,218 rows for a query that returns zero
  rows — confirmed by a live `SELECT COUNT(*) FROM articles` reading the near-identical 44,217.
  Same class of bug as this project's own documented "D1 index flip made related-articles 26x
  costlier" incident (MEMORY.md).
- **Fix:** Switched both `fetchTranslationsAll` and `fetchTranslationsChangedSince` to SQLite's
  `CROSS JOIN` keyword (a real `ON` condition still applies — not an actual cross product), which
  pins the FROM-clause join order. Confirmed via a second live `EXPLAIN QUERY PLAN`
  (`SEARCH t USING INDEX ... (article_id>?)` driving, `SEARCH a USING INTEGER PRIMARY KEY
  (rowid=?)` probing) and a real query execution reading exactly 1 row for the identical
  zero-row query.
- **Files modified:** `src/lib/server/d1-client.ts`
- **Commit:** `5c596f6` (Task 1 commit — found and fixed before the task's own commit, not a
  separate follow-up)

**2. [Disclosed, matching established project precedent — not a Rule-4 deviation] The loader's
full mode-selection/budget/shrink-check logic was written in one pass, not strictly Task-1-tracer-
then-Task-2-edge-cases**
- **What happened:** `src/content/loaders/articles-es-loader.ts` was implemented completely (cold/
  warm modes, the budget check, the shrink-check exception, meta updates) in Task 1's commit,
  since the mode-selection and budget-check logic are structurally inseparable from the tracer's
  own `<action>` text (step 2 of Task 1 already specifies `ES_ROWS_READ_BUDGET`, cold/warm modes,
  and "never-shrink check against the articlesEs last-good baseline" in its own interface note).
  Task 2's commit carries `build-state.ts`'s schema changes, the measured-budget comment update,
  and Task 2's own test files.
- **Why:** This repo has an explicit, repeated precedent for exactly this (06-01-SUMMARY.md,
  05-02-SUMMARY.md, STATE.md's own accumulated decisions) — tightly-coupled loader logic that
  can't be meaningfully half-built without the other half existing. Disclosed rather than silently
  deviating from a literal Task-1-then-Task-2 commit split.
- **Files/commits:** both task commits above.

---

**Total deviations:** 1 auto-fixed (Rule 1), 1 disclosed-and-explained departure from a literal
plan reading (consistent with established project precedent).
**Impact on plan:** The Rule 1 fix was essential — an unfixed version would have silently cost
44,000x more D1 reads than necessary on every cold pass at scale. No scope creep.

## Issues Encountered

None beyond the Rule 1 fix documented above.

## User Setup Required

None — no external service configuration required. Credentials
(`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) were already set per this plan's own
`<precondition>`, confirmed working (same as every Phase 4/5/6 build).

## Next Phase Readiness

- The `articlesEs` collection, `spanish-view.ts`'s pure join, and the never-shrink baseline are all
  proven and ready for later plans in this phase to build the `/es` route tree and templates on top
  of, with zero additional D1-access plumbing (every new page reads through `getCollection('articlesEs')`
  and `spanish-view.ts` only).
- `ES_ROWS_READ_BUDGET` (200,000) is grounded in a measured per-unit query cost but NOT a direct
  full-scale measurement — production holds 0 real Spanish rows as of this plan's execution.
  **Flagged for re-measurement** once 06-08's pilot write and the later full backfill land real
  rows, per this plan's own acceptance criteria.
- No blockers identified for subsequent plans that depend on `articlesEs` existing.

---
*Phase: 06-bilingual*
*Completed: 2026-10-03*

## Self-Check: PASSED

All files referenced above were verified to exist on disk, and both task commits (`5c596f6`,
`c08057e`) were confirmed present in `git log --oneline --all` before this SUMMARY was written.

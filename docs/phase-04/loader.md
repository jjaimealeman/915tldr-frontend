# Phase 4 Plan 03 — The Articles Loader: Incremental-Signal Design

`src/content/loaders/articles-loader.ts` is the hand-written Astro Content Layer `Loader` that
syncs `articles` from D1 into the static build, without ever re-scanning the full ~43k-row corpus
every 2-hour cron cycle (Phase 3's binding constraint: a full bulk-fetch pass at 12 cycles/day is
5.7x PROJECT.md's daily soft budget and 2.3x its hard-fail budget — see
`docs/phase-03/render-step-location.md` §"Derived findings").

## Why not `updated_at` alone

D-06 originally proposed a single incremental signal: `WHERE updated_at > last_sync`. Checked
directly against the ingest pipeline in `915tldr.com2` (04-CONTEXT.md `<planner_findings>`):
`server/utils/ai-processor.ts` sets `processed_at` on a normal publish, **not** `updated_at`;
duplicate flagging (`server/utils/duplicate-detector.ts`) and tag linking set **neither** column.
`updated_at` is bumped only by an admin edit or an explicit reprocess. Two consequences:

1. **A brand-new article's normal publish never bumps `updated_at`.** A signal that only watches
   `updated_at` would never see most new content at all.
2. **`updated_at` has no index.** Any predicate on it scans all ~43k rows regardless of how few
   rows actually changed — the exact per-pass cost D-14/D-06 already rejected for a per-build
   `COUNT(*)`.

## The three modes

| Mode | Trigger | What it fetches | Cost driver |
|---|---|---|---|
| **cold** | store is empty, OR `meta.stateVersion !== LOADER_STATE_VERSION`, OR `meta.lastCold` is absent or older than `COLD_RESYNC_INTERVAL_SECONDS` (7 days), OR `ARTICLES_FORCE_COLD=1` | the full corpus, every status (so non-public rows are *observed*, not merely absent) | keyset-paginated `LIMIT 5000` across `articles`/`article_categories`/`article_tags`, `fetchAllArticlesStitched()` |
| **warm+sweep** | (not cold) AND `meta.lastSweep` is absent or older than `SWEEP_INTERVAL_SECONDS` (1 day) | the rolling `published_at` window, PLUS `fetchChangedSince(lastSweep − SWEEP_OVERLAP_SECONDS)`'s ids re-fetched via `fetchArticlesStitchedByIds()` | one extra unindexed `updated_at OR processed_at` scan (~43k rows) + a small chunked re-fetch |
| **warm** | neither of the above | only the rolling `published_at` window (`SYNC_WINDOW_SECONDS`, 3 days, indexed by `idx_articles_published_at`) | `fetchPublicArticlesWindow()` — cheap, ~15 articles/cycle at measured production ingest volume |

Every build runs `warm` at minimum. `warm+sweep` catches whatever the window missed once a day:
an admin edit or a very late `processed_at` outside the 3-day window. `cold` is the self-healing
fallback that catches everything else, including **hard deletes** — a row that simply no longer
exists in D1 is invisible to both the window and the sweep (neither query can observe the absence
of a row), so only a full corpus fetch can compare "what's actually there" against the last-good
baseline and flag a real deletion.

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `LOADER_STATE_VERSION` | `'1'` | Bumped when this loader's own sync semantics change in a way that invalidates an existing store — forces the next build cold. |
| `SYNC_WINDOW_SECONDS` | 259,200 (3 days) | The warm-mode `published_at` window. |
| `SWEEP_INTERVAL_SECONDS` | 86,400 (1 day) | How often the `fetchChangedSince` catch-up runs. |
| `SWEEP_OVERLAP_SECONDS` | 7,200 (2 hours = 1 cron cycle) | Subtracted from `lastSweep` before querying, so a row that changed in the seconds before the previous sweep is never missed by a boundary race. |
| `COLD_RESYNC_INTERVAL_SECONDS` | 604,800 (7 days) | Forces a self-healing full pass even if nothing else triggers cold. |

## Budgets (measured, `docs/phase-04/build-measurements.md`)

Each budget is the next round number at or above 2x the real measured `rowsRead` for that mode —
enough headroom that a normal week-to-week corpus growth doesn't trip it, but tight enough that a
genuine query-plan regression (the exact failure class the `d1-index-flip` incident produced in an
unrelated project — an index change silently multiplying a join's cost) fails the build instead of
running unnoticed 12 times a day forever.

| Mode | Measured `rowsRead` | Budget | Margin |
|---|---|---|---|
| `warm` | 5,928 | `WARM_ROWS_READ_BUDGET` = 25,000 | 4.2x |
| `warm+sweep` | 49,178 | `SWEEP_ROWS_READ_BUDGET` = 100,000 | 2.03x |
| `cold` | 506,806 | `COLD_ROWS_READ_BUDGET` = 1,500,000 | 2.96x |

Citations live next to each constant in `src/content/loaders/articles-loader.ts` itself, not only
here — a future editor changing the number sees the measurement it's supposed to respect.

**Projected daily D1 rows at 12 builds/day**, computed from these measured per-mode figures (not
the ~240k/day the planner's own pre-implementation estimate used, which was itself a conservative
upper bound before any real measurement existed):

- 11 plain `warm` cycles/day × 5,928 rows ≈ 65,208 rows/day
- 1 `warm+sweep` cycle/day × 49,178 rows ≈ 49,178 rows/day
- 1 `cold` cycle amortized over 7 days: 506,806 ÷ 7 ≈ 72,401 rows/day
- **Total ≈ 186,787 rows/day ≈ 9.3% of PROJECT.md's 2,000,000-row daily soft budget**, and 3.7% of
  the 5,000,000-row hard-fail — comfortably inside both, with the cold-resync case (the most
  expensive single event this loader ever triggers on its own schedule) already included.

## Staleness bound

Any change neither the window nor the sweep catches — for example, an admin re-linking a
duplicate on an article older than 3 days, which bumps no timestamp the sweep watches — reaches
the public site within **7 days** (the next scheduled cold resync), or immediately if
`ARTICLES_FORCE_COLD=1` is set on a manual build. This is a stated, bounded staleness window, not
an open-ended "eventually" — see `docs/phase-03/render-step-location.md` for the same discipline
applied to the render-step decision.

## Environment variables

- **`ARTICLES_FORCE_COLD=1`** — forces `cold` mode regardless of `meta.stateVersion`/`lastCold`.
  Use for a manual full resync (e.g. after discovering a data anomaly like the `missing-summary`
  bug this same plan found) without waiting for the 7-day schedule.
- **`ALLOWED_ARTICLE_SHRINK`** — an integer (default `0`). D-14's never-shrink check
  (`evaluateShrink`, `src/lib/server/build-state.ts`) fails the build on ANY unexplained article
  removal versus the last-good baseline. An "explained" removal (the article is still present in
  D1 but is now non-processed, a duplicate, uncategorized, or has a NULL summary) never counts
  against this allowance — it exists only for a genuine, intentional hard delete the operator
  already knows about (e.g. a legal takedown). Set it to the exact number of intentional
  deletions for one build, then let it fall back to `0`; the shrink-check log names every
  unexplained id (up to 20) so the number is never a guess.
- **`BUILD_STATE_REQUIRE_BASELINE=1`** — makes a missing last-good baseline (`build:last-good` in
  KV) itself a build failure, unless `BUILD_STATE_BOOTSTRAP=1` is also set. Every deploying build
  (04-09's `tools/ci-build.mjs`) sets this — a silently-missing baseline must never let the
  never-shrink check quietly skip itself in production. Plain local/worktree builds leave it unset
  and get a logged "no baseline" warning instead of a hard failure, so local iteration isn't
  blocked by a baseline that only exists in the real production KV namespace.
- **`BUILD_STATE_BOOTSTRAP=1`** — explicitly acknowledges "this build has no baseline to compare
  against yet" — the one legitimate way to satisfy `BUILD_STATE_REQUIRE_BASELINE` with no existing
  `build:last-good` entry (the very first baseline-establishing build, or a deliberate reset).
  Task 3 used this exactly once, for the first real cold build in this session; every build from
  here on finds a real baseline in KV and needs neither flag.

## What the log line means

Every build ends with one line naming everything a human needs to sanity-check a run at a glance:

```
[d1-articles] mode=<cold|warm|warm+sweep> public=<n> changed=<n> removed=<n> explained=<n> rowsRead=<n> budget=<n>
```

`changed`/`removed` count only entries this run actually touched (a warm build's `removed` never
includes an article outside its own window — those are untouched, not silently kept). `explained`
comes straight from `evaluateShrink`'s own accounting, so it always matches what the shrink check
itself decided, not a separately-computed estimate.

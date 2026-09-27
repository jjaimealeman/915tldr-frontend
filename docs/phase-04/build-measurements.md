# Phase 4 Plan 03 — Build Measurements

Measured, not projected, figures for the full loader (`src/content/loaders/articles-loader.ts`)
and the first full-corpus build. Every section below states what was run and when.

## Dry run

Generated 2026-09-26T23:43:49.955Z by `tools/sync-dry-run.mjs` (read-only — 4 SELECT COUNT(*) statements).

- Public article count (`status = 'processed' AND is_duplicate = 0`): **40183**
- Total articles: **43063**
- `article_tags` rows: **191514**
- Primary `article_categories` rows (`is_primary = 1`): **40274**
- Dry run's own rows read (sum of all 4 `meta.rows_read`): **315035**

- Projected cold request count at 5,000 rows/page: ceil(43063/5000) [articles] + ceil(191514/5000) [tags] + ceil(40274/5000) [categories] + 1 [sources] = **58 requests**
- Projected cold rows read: totalArticles (43063) × (Phase 3's measured 957,008 rows / 39,867 stitched articles ≈ 24.005 rows/article, docs/phase-03/d1-pagination-report.md) = **1,033,728 rows**
- Projected KV writes (= public article count, first v2 manifest rollout): **40,183**

### Projected cost (current Cloudflare list prices, fetched live 2026-09-26)

- D1 rows read: 25,000,000,000/month included (Workers Paid) then $0.001/million — 1,033,728 rows is entirely inside the included allotment ⇒ **$0.000000**. Source: https://developers.cloudflare.com/d1/platform/pricing/
- KV writes: 1,000,000/month included (Workers Paid) then $5/million — 40,183 writes is entirely inside the included allotment ⇒ **$0.000000**. Source: https://developers.cloudflare.com/kv/platform/pricing/
- **Projected total cost: $0.000000** — well under the $1 CLAUDE.md approval threshold.

**Budget gate cleared before any cold-capable code was written.** Recorded before Task 1 wrote a
single line of `build-state.ts` or the cold-fetch shapes in `d1-client.ts`, per CLAUDE.md's "no
bulk corpus operation runs without a dry run reporting row count and projected cost" — the
sequencing itself (dry run first, code second) is the point, not just the number.

## Task 3: re-run dry run (same-day cross-check baseline)

Generated 2026-09-27T00:11:34.750Z by `tools/sync-dry-run.mjs`, immediately before the cold build
below (step 1 of Task 3's action list) — the production corpus grows continuously (the ingest
cron runs every 2 hours), so this is re-run same-day rather than reusing Task 1's now-stale
numbers for the cross-check in the next section.

- Public article count (`status = 'processed' AND is_duplicate = 0`): **40193**
- Total articles: **43071**
- `article_tags` rows: **191563**
- Primary `article_categories` rows (`is_primary = 1`): **40284**
- Projected cold rows read: **1,033,920** (formula unchanged from Task 1)
- Projected total cost: **$0.000000**

## Cold build (`BUILD_STATE_BOOTSTRAP=1 ARTICLES_FORCE_COLD=1 pnpm run build`)

Run 2026-09-26 against real production D1/KV (`/usr/bin/time -v` is not installed on this
machine — verified via `pacman -Q time` / `which time`; peak RSS below was instead measured by
polling `/proc/<astro-pid>/status`'s `VmHWM` field, the kernel's own monotonic high-water-mark, at
1-second intervals for the whole run and taking the final/maximum sample, which is equivalent to
what `/usr/bin/time -v`'s "Maximum resident set size" reports).

**Loader log line:**
```
[d1-articles] mode=cold public=40049 changed=0 removed=0 explained=0 rowsRead=506806 budget=1500000
```

| Metric | Value |
|---|---|
| Wall time (outer measurement, includes `guard:config` + `astro build`) | 65.35s |
| Astro's own reported total | 40,049 page(s) built in 1m 3s |
| Content-sync phase (D1 cold fetch + manifest bulk write, from the "Syncing content" log to the loader's own line) | ~27s |
| Astro's page-generation phase ("Building static entrypoints...") | 28.62s for 40,049 pages ≈ 0.71ms/page |
| **Maximum resident set size** (peak RSS, `/proc/<pid>/status` `VmHWM`, polled every 1s) | **2,604,176 kB (≈ 2.54 GB)** |
| D1 rows read (loader-reported) | 506,806 — 0.34x `COLD_ROWS_READ_BUDGET` (1,500,000) |
| Total files under `dist/client` | 40,058 |
| Content-layer data store location | `node_modules/.astro/data-store.json` |
| Content-layer data store size | 63 MB (65,566,953 bytes) |

**Data-store location answers D-06 directly: YES, inside the Workers Builds auto-cached
directory.** D-06 asked research to confirm Astro's content-layer store lives inside the directory
Workers Builds build caching auto-detects and caches for Astro projects
(`developers.cloudflare.com/workers/ci-cd/builds/build-caching/` says it caches `node_modules/.astro`
plus the pnpm store) — confirmed directly by locating the real file on disk after a real build:
`node_modules/.astro/data-store.json`, not `.astro/` (that directory holds only build-scratch
files: `content.d.ts`, `content-modules.mjs`, `collections/`, and this plan's own
`build-state.pending.json`).

**Cross-check (Task 3 step 3): the loader's cold `public=` count is within 1% of the dry run's
independent public count.** Loader: **40,049**. Dry run: **40,193**. Difference: **144 (0.358%)**
— well under the 1% gate, and the difference is fully explained: the dry run's filter is only
`status = 'processed' AND is_duplicate = 0` (no category or summary check), while the loader's
public set additionally excludes articles with no resolved primary category and articles with a
NULL/empty `summary` (140 of those — see the Task 2 changelog entry's Rule 1/2 bug fix; ~4 more
account for `no-primary-category`). 40,193 − 144 ≈ 40,049. No investigation needed; proceeding to
step 5.

**Interesting non-finding worth recording:** unlike Phase 3's per-request measurement (where the
D1 read/KV write dominated wall time), this build's wall time is now dominated by Astro's own
static-entrypoint rendering/writing (28.62s for 40,049 pages) and Vite/content-sync overhead, not
the D1 read itself — the cold fetch's 506,806-row read completes in roughly the same ~27s window
that also includes the manifest bulk-write and Astro's own collection sync bookkeeping. The
loader's own D1 cost is comfortably inside budget regardless of which phase dominates wall time.

**A genuine measurement bug found and fixed during this task, not shipped:** the loader
originally also set `meta.lastSweep` on every cold build ("a cold pass subsumes what a sweep would
catch"), which is a real design choice but directly contradicts Task 3's own expected verification
sequence (cold → warm+sweep → warm) — the build immediately after cold would have shown `mode=warm`
instead of `mode=warm+sweep`, silently skipping the sweep-mode code path on every real deployment's
first post-cold build. Removed before this measurement was taken; see the 04-03 Task 2 changelog
entry / `src/content/loaders/articles-loader.ts`'s meta-update comment for the corrected behavior.
An earlier (now-superseded) run of this exact cold build had already exercised the old, buggy
lastSweep-on-cold behavior and left a stale `lastSweep` value in the local `node_modules/.astro`
content-layer cache from that run; that stale value was cleared programmatically (parsing and
rewriting `node_modules/.astro/data-store.json`'s `devalue`-serialized `meta:articles` collection
to delete the one stale key — no file was deleted, per this project's "never `rm`" rule) so the
warm-build sequence below genuinely exercises the corrected code, not leftover state from the bug.

## Warm builds (`pnpm run build`, no env overrides)

**First warm build after the cold build above — expected and observed `mode=warm+sweep`** (no
sweep had run yet):
```
[d1-articles] mode=warm+sweep public=40049 changed=0 removed=0 explained=0 rowsRead=49178 budget=100000
```
Wall time: 42.04s total (`time pnpm run build`). 49,178 rows is 0.49x `SWEEP_ROWS_READ_BUDGET`
(100,000).

**Second warm build, immediately after — expected and observed `mode=warm`** (the sweep that just
ran satisfies `SWEEP_INTERVAL_SECONDS` for the next 24h):
```
[d1-articles] mode=warm public=40049 changed=0 removed=0 explained=0 rowsRead=5928 budget=25000
```
Wall time: 42.54s total. 5,928 rows is 0.24x `WARM_ROWS_READ_BUDGET` (25,000) — consistent with
`docs/phase-04/spikes.md`'s earlier 04-01 measurement of 5,926 rows for a near-identical
3-day/324-article window.

`changed=0` on every one of the three builds above (cold, warm+sweep, warm) is the digest-based
skip working correctly at full-corpus scale — the content-layer store already held every synced
article at its current digest from the very first cold pass in this session, so zero manifest
writes were issued on any of the three follow-up builds. This is the steady-state behavior a real
deployment will see on every cron cycle where nothing actually changed.

## Baseline committed to KV

After the cross-check passed (step 3) and the three sync modes were proven (step 4), the articles
last-good baseline was committed for real:

```
node --input-type=module -e "
const m = await import('./src/lib/server/build-state.ts');
await m.commitLastGood({ buildHash: 'phase-04-baseline', requiredSections: ['articles'] });
"
```

Stored: `articles.count = 40049`, `buildHash = 'phase-04-baseline'`,
`recordedAt = 2026-09-27T00:18:19.382Z`, at KV key `build:last-good` in the real
`915tldr-render-manifest` namespace. **Verified per the acceptance criterion:**
`BUILD_STATE_REQUIRE_BASELINE=1 pnpm run build` (no `BUILD_STATE_BOOTSTRAP`) succeeded
immediately after, logging `mode=warm ... rowsRead=5911 budget=25000` with no shrink-check
failure — the baseline is real and load-bearing, not just written and never read.

## Budgets replaced with measured values

`WARM_ROWS_READ_BUDGET` (25,000), `SWEEP_ROWS_READ_BUDGET` (100,000) and `COLD_ROWS_READ_BUDGET`
(1,500,000) in `src/content/loaders/articles-loader.ts` were already, by coincidence, round
numbers at or above 2x every measured figure above (2x cold = 1,013,612 ≤ 1,500,000; 2x
warm+sweep = 98,356 ≤ 100,000; 2x warm = 11,856 ≤ 25,000) — no numeric change was needed, only
replacing the "provisional" comment with one citing this session's real measurements next to each
constant (see the source file).

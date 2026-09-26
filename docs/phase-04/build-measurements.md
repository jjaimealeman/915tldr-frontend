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

<!-- Task 3 appends the cold-build and warm-build measurement sections below this line. -->

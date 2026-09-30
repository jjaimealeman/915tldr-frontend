# Per-Page Render Cost Measurement

Generated 2026-09-23T05:06:16.309Z by `tools/measure-render-cost.mjs`.

## Sample selection

- 50 articles sampled at evenly-spaced ranks of a full corpus-wide `ORDER BY LENGTH(summary)` (39687 candidate rows, processed + category-resolved), NOT the newest N articles — spans the real summary-length distribution (915tldr.com2/docs/phase-02/corpus-measurements.md: summary p50=889, p95=1169, max=1498 chars, as of 2026-09-19) rather than clustering at one end of it.
- Sampled summary lengths in this run: min 51, max 2163 chars.

## Per-page cost — components (ms)

| Component | min | p50 | p95 | max | n |
|---|---|---|---|---|---|
| d1Read | 191.21 | 230.92 | 334.96 | 461.51 | 50 |
| render | 0.06 | 0.07 | 0.13 | 0.26 | 50 |
| manifestBuild | 0.12 | 0.14 | 0.27 | 0.36 | 50 |
| manifestWrite | 289.36 | 338.19 | 415.14 | 429.90 | 50 |
| manifestWriteCombined | 289.53 | 338.37 | 415.29 | 430.06 | 50 |
| **total (sum of components)** | 488.67 | 573.32 | 735.86 | 765.03 | 50 |

## What "render" excludes

- The `render` component times this page's own frontmatter script (date formatting), NOT Astro's own template-to-HTML string compilation, which runs after the frontmatter block and is not independently instrumentable from inside it. For this page's simple template (a handful of interpolations, no loops), that excluded cost is expected to be small, but it is NOT measured here and is not claimed to be.

## Fixed build-startup cost

- Total child `astro build` wall-clock: 31331ms for 50 pages.
- Sum of all measured per-page component time across all 50 pages: 29523.9ms.
- Fixed startup cost (build wall-clock minus that sum, floored at 0): **1807.1ms**. This isolates Vite/Astro initialisation, the module graph, and the assertion walk — cost that does not scale per page — so a corpus projection is `fixed + n × per-page`, not `n × blended`, which would overstate a full rebuild substantially at ~40,000 pages.

Reproduce: `node tools/measure-render-cost.mjs --count 50`

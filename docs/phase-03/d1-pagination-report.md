# D1 REST Pagination Measurement

Generated 2026-09-23T04:57:29.020Z by `tools/measure-d1-pagination.mjs`.

## Dry run (preceded the executed pass, same session)

- Live row count at dry-run time: **39827**
- Projected requests: 80
- Projected rows read (both passes): 79654

## Executed — offset pagination (`LIMIT ? OFFSET ?`, `ORDER BY a.id`)

- Page size: 500
- Request count: 80
- Rows read (D1-reported, sum of `meta.rows_read`): 49420384
- Sample count: 80
- min: 782.8ms
- p50: 916.1ms
- p95: 1327.3ms
- max: 1623.6ms
- Total wall-clock: 76.8s

## Executed — keyset pagination (`WHERE a.uuid > ?`, `ORDER BY a.uuid`)

- Page size: 500
- Request count: 80
- Rows read (D1-reported, sum of `meta.rows_read`): 11451051
- Sample count: 80
- min: 393.0ms
- p50: 489.0ms
- p95: 621.2ms
- max: 777.6ms
- Total wall-clock: 40.3s

## Actual rows-read budget check (measured, not projected)

- Offset pass rows read: **49,420,384** — EXCEEDS the 5,000,000 hard-fail budget on its own, for a SINGLE full-corpus pass reading 39,827 distinct rows once.
- Keyset pass rows read: **11,451,051** — EXCEEDS the 5,000,000 hard-fail budget on its own.
- The dry run's projection (39,827 rows for one pass, assuming rows-read ≈ row count) UNDERSTATED the real cost by 1240.9x (offset) and 287.5x (keyset) — the LEFT JOINs and the per-row tags subquery read far more than one row per result row, and OFFSET pagination compounds this further because each request re-scans and discards every row before its offset. This was NOT visible from the dry run alone; only the full --execute pass surfaces it.

## Comparison

- p95 relative difference: 53.2%
- Keyset and offset pagination DIFFER MATERIALLY at p95 (53.2% relative difference) — this belongs to Phase 4's loader design, which is the code that will actually pay this cost.
- Note: the keyset pass orders by `a.uuid` (lexicographic) rather than `a.id` (insertion order, the offset pass's ORDER BY) — chosen to keep the SELECT column list identical between passes rather than adding an internal-only integer cursor column. Any observed difference could be about the ORDER BY column rather than offset-vs-keyset pagination per se; not independently isolated in this run.

## Headline numbers (offset pass — the strategy Phase 4 is most likely to use)

- p50: 916.1ms
- p95: 1327.3ms
- Sample count: 80
- Page size: 500

Reproduce: `node tools/measure-d1-pagination.mjs --execute`

# D1 REST Pagination Measurement

Generated 2026-09-23T13:25:30.531Z by `tools/measure-d1-pagination.mjs`.

## Dry run (preceded the executed pass, same session)

- Live row count at dry-run time: **39867**
- Projected requests: 80
- Projected rows read (both passes): 79734

## Executed — offset pagination (`LIMIT ? OFFSET ?`, `ORDER BY a.id`)

- Page size: 500
- Request count: 80
- Rows read (D1-reported, sum of `meta.rows_read`): 49470624
- Sample count: 80
- min: 773.0ms
- p50: 955.2ms
- p95: 1142.4ms
- max: 1755.2ms
- Total wall-clock: 78.3s

## Executed — keyset pagination (`WHERE a.uuid > ?`, `ORDER BY a.uuid`)

- Page size: 500
- Request count: 80
- Rows read (D1-reported, sum of `meta.rows_read`): 11466920
- Sample count: 80
- min: 344.9ms
- p50: 587.3ms
- p95: 921.4ms
- max: 3161.7ms
- Total wall-clock: 53.0s

## Actual rows-read budget check (measured, not projected)

- Offset pass rows read: **49,470,624** — EXCEEDS the 5,000,000 hard-fail budget on its own, for a SINGLE full-corpus pass reading 39,867 distinct rows once.
- Keyset pass rows read: **11,466,920** — EXCEEDS the 5,000,000 hard-fail budget on its own.
- The dry run's projection (39,867 rows for one pass, assuming rows-read ≈ row count) UNDERSTATED the real cost by 1240.9x (offset) and 287.6x (keyset) — the LEFT JOINs and the per-row tags subquery read far more than one row per result row, and OFFSET pagination compounds this further because each request re-scans and discards every row before its offset. This was NOT visible from the dry run alone; only the full --execute pass surfaces it.

## Comparison

- p95 relative difference: 19.3%
- Keyset and offset pagination did NOT differ materially at p95 (19.3% relative difference) — matches 03-RESEARCH.md's prediction of no measurable difference at ~84 pages.
- Note: the keyset pass orders by `a.uuid` (lexicographic) rather than `a.id` (insertion order, the offset pass's ORDER BY) — chosen to keep the SELECT column list identical between passes rather than adding an internal-only integer cursor column. Any observed difference could be about the ORDER BY column rather than offset-vs-keyset pagination per se; not independently isolated in this run.

## Executed — bulk fetch + in-memory stitch (03-06-ADDENDUM hypothesis test)

Tests whether eliminating the per-row correlated tags subquery and per-row category LEFT JOIN (the load-bearing finding above, confirmed optimal-index by the query planner — the cost is query SHAPE, not indexing) fits the rows-read budget. Paginates `articles` alone (no JOIN, no subquery), bulk-fetches `article_tags`/`tags` and `article_categories`/`categories` (is_primary=1) separately, and stitches all three in memory in Node.

- Bulk page size: 5000
- Articles fetched (native columns, `status=processed` only, no category filter): **39,871** — 8 requests, 497,936 rows read
- `article_tags` JOIN `tags` rows fetched: **189,654** — 38 requests, 379,308 rows read
- `article_categories` (is_primary=1) JOIN `categories` rows fetched: **39,882** — 8 requests, 79,764 rows read
- Stitched output records (after dropping articles with no resolved category, mirroring `c.slug IS NOT NULL`): **39,867**
- Articles read but dropped at stitch (processed but no resolved primary category): 4
- **Total rows read (all 3 passes, D1-reported `meta.rows_read`): 957,008**
- Rows read per stitched article returned: 24.01
- Total round trips (all 3 passes): 54
- Total wall-clock (all 3 passes + in-memory stitch): 26.6s
- Peak Node heap during stitch: **128.4 MB** — EXCEEDS the 128MB Workers isolate memory limit (measured via `process.memoryUsage().heapUsed` sampled at each pipeline stage in THIS Node process — not measured inside an actual Worker isolate, which has different baseline overhead; stated as a Node-process proxy, not a Worker-verified figure).

- **Rows-read ratio vs. keyset baseline:** 957,008 vs. 11,466,920 — 0.083x (CHEAPER than keyset).
- **Against the hard-fail budget (5,000,000 rows):** WITHIN it — 0.19x the budget for one full pass.

### Output-equivalence check

Re-fetched 20 evenly-spaced sample records (of 39,867 stitched) via the ORIGINAL joined query by uuid (20 requests, 294 rows read — excluded from the bulk pass's own cost accounting above as verification overhead, not production cost). Tags compared as a sorted set, not an exact string (see method note in the harness source) — the two shapes have no guaranteed matching concatenation order.

**Result: EQUIVALENT.** All 20 sampled records matched field-for-field (title, summary, category, published_at, status, tags-as-set).

### Recomputed full-corpus render-time projection (composed, not re-measured end-to-end)

PROJECTION, not a measurement: composed from this session's measured bulk-fetch wall-clock (above) plus 03-06 §2's already-measured per-page render + manifest-write components, with the now-obsolete per-page D1-read component subtracted out (bulk-fetch amortizes D1 access to one upfront pass rather than one round trip per page). The tracer page itself was NOT rewired to consume a bulk-fetched in-memory dataset this session — that is out of scope for this addendum. Basis: 03-06-SUMMARY.md §2 (`docs/phase-03/measurements.md`), dated 2026-09-23.

| Metric | Old projection (03-06 §4, per-page D1 read included) | New projection (bulk-fetch shape) |
|---|---|---|
| Per-page cost used | p50=573.3ms / p95=735.9ms | p50=342.4ms / p95=400.9ms (D1-read component removed) |
| Projected full-corpus render time (39,867 articles) | p50 ≈ 6.34h / p95 ≈ 8.14h (03-06 §4, at 39,827 rows) | p50 ≈ 3.80h / p95 ≈ 4.45h |
| vs. 902,000ms cron CPU ceiling | 25.3x-32.5x OVER | 15.17x-17.75x OVER |

This projection changes the render-time story ONLY insofar as the per-page D1-read cost is amortized away — it does NOT by itself prove a full rebuild fits the 902,000ms cron CPU ceiling, and it does not change §1's rows-read finding above (the bulk-fetch pass's own rows-read total, reported above, is the number that matters for the D1 budget question).

## Headline numbers (offset pass — the strategy Phase 4 is most likely to use)

- p50: 955.2ms
- p95: 1142.4ms
- Sample count: 80
- Page size: 500

Reproduce: `node tools/measure-d1-pagination.mjs --execute`

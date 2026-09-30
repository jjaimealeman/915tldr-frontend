# 2026-09-23 - 03-06 Addendum: Bulk-Fetch Query Shape Solves the D1 Rows-Read Budget, Not the Cron CPU Ceiling

**Keywords:** [BACKEND] [DATABASE] [PERFORMANCE] [TESTING] [DOCUMENTATION]
**Session:** Morning, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-0730_03-06-addendum-bulk-fetch-solves-d1-budget-not-cpu-ceiling.md`

## What Changed

- File: `tools/measure-d1-pagination.mjs`
  - Added a third pagination variant, `measuredBulkPass()`: paginates `articles` alone via
    keyset (no LEFT JOIN, no correlated subquery — filters only on the native `a.status` column),
    then bulk-fetches `article_tags JOIN tags` and `article_categories JOIN categories
    (is_primary=1)` in their own keyset-paginated (on `rowid`) passes, and stitches all three into
    the same output record shape in memory in Node.
  - Added `verifyBulkEquivalence()`: re-fetches an evenly-spaced sample of the stitched output via
    the original joined query by uuid and compares field-by-field (tags compared as a sorted set,
    since the two shapes have no guaranteed matching concatenation order).
  - Added `projectBulkCorpusRenderTime()`: recomputes 03-06 §4's full-corpus render-time
    projection under this shape's assumption (D1 access amortized to one upfront pass instead of
    one round trip per rendered page), composed from this session's measured bulk-fetch wall-clock
    plus 03-06 §2's already-measured render/manifest-write components.
  - `--execute` now runs the bulk pass by default alongside the existing offset/keyset passes;
    `--skip-bulk` restores 03-06's original scope. New `--bulk-page-size` flag (default 5,000 —
    a one-time bulk fetch has no reason to keep round-trip count small the way a per-request
    paginated API does).
- File: `docs/phase-03/measurements.md`
  - New §1b: the bulk-fetch shape reads **957,008 total rows** for the full corpus (24.01
    rows/article) — 0.19x the 5,000,000-row hard-fail budget, vs. this session's re-measured
    offset (49,470,624, 9.9x over) and keyset (11,466,920, 2.3x over). Output verified equivalent
    to the original joined query on a 20-record sample (all matched field-for-field). Peak Node
    heap during the in-memory stitch measured 128.4 MB — marginally OVER the 128 MB Workers
    isolate memory limit (reported as a Node-process proxy, not a Worker-verified figure).
  - New §4b: recomputed full-rebuild render-time projection under this shape — 3.80h (p50) /
    4.45h (p95), down from 6.34h/8.14h, but still 15.2x-17.8x over the measured 902,000ms cron CPU
    ceiling. Does not change 03-06's conclusion that a full-corpus rebuild cannot run in a single
    cron invocation.
  - New closing note in "Cost of this measurement": this session's `--execute` run issued 234 D1
    REST API requests reading ~61.9M rows total, well within D1's 25-billion-rows/month free tier
    (Cloudflare's paid overage rate, confirmed via Perplexity against a live source rather than
    assumed: $0.001/million rows) — negligible cost.
- File: `docs/phase-03/d1-pagination-report.md`
  - Regenerated from this session's `--execute` run (includes the new bulk-fetch section; corpus
    grew from 39,827 to 39,867 rows since 03-06's original run, expected drift from live ingest).
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-06-SUMMARY.md`
  - Appended an "Addendum" section recording that this measurement ran, its method, and its
    result, without altering 03-06's own three measurements or its `status: complete`.

## Why

After 03-06 completed, the orchestrator checked the query planner directly against production D1
and found the existing plan already optimal (`SEARCH a USING INDEX articles_uuid_unique`, no
missing index) — the 49.4M/11.5M rows-read costs 03-06 measured are a query-SHAPE problem (a
per-row correlated tags subquery plus a per-row category LEFT JOIN), not an indexing problem. This
addendum tests the resulting hypothesis directly rather than assuming it: eliminate the per-row
mechanisms via a bulk-fetch-and-stitch shape, and measure whether that fits PROJECT.md's D1
rows-read budget. It does — by a wide margin (12x cheaper than keyset, 52x cheaper than offset) —
which is a materially different and more useful answer for Phase 4's loader design than "both
existing shapes exceed budget."

## Issues Encountered

None requiring a code fix. One real, marginal finding worth flagging rather than smoothing over:
peak Node heap during the in-memory stitch (128.4 MB) came in just over the 128 MB Workers
isolate memory limit. This is reported as a Node-process proxy (not measured inside an actual
Worker isolate, whose baseline overhead differs) and flagged plainly as "might not fit" rather
than implied to be a clean pass — a production implementation could plausibly reduce this (more
compact intermediate maps, releasing row arrays before building the final array, or running the
bulk fetch/stitch in the same Node build step 03-06 §2 and this project's image-service decision
already use) but that reduction was not attempted or measured here.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the bulk pass's own rows-read/wall-clock/round-trip accounting (measured live
  against production D1, same session as the offset/keyset re-run); output equivalence on a
  20-record evenly-spaced sample, compared field-by-field against the original joined query
  (title, summary, category, published_at, status, tags-as-sorted-set) — all 20 matched; `pnpm
  test:unit` (87/87) and `pnpm test:build-gate` (4/4) re-run after the change, both green,
  matching the pre-existing baseline.
- What wasn't tested: the tracer page (`src/pages/[category]/[slug].astro`) was NOT rewired to
  actually consume a bulk-fetched in-memory dataset — the recomputed render-time projection in
  §4b is a composed projection from two measured inputs, not an end-to-end re-measurement of the
  real render pipeline under this shape. The 128.4 MB heap figure was not verified inside an
  actual deployed Worker isolate.
- Edge cases: none newly exercised (this addendum extends the existing harness's already-tested
  failure paths — non-2xx/`success:false` responses — rather than adding new ones).

## Next Steps

- [ ] 03-07's render-step location checkpoint should treat the D1 rows-read constraint as
      resolved (via bulk-fetch query shape) and the cron-CPU-ceiling constraint as the remaining
      blocker for a full-corpus rebuild's execution strategy.
- [ ] If a bulk-fetch loader shape is adopted in Phase 4, measure its actual in-Worker (not
      Node-process-proxy) memory footprint before relying on the 128.4 MB figure either way.
- [ ] `tools/cpu-ceiling-probe/wrangler.limits-low.jsonc` remains ready to deploy if 03-07 needs
      the untested low-`limits.cpu_ms` data point (unrelated to this addendum).

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - measurement tooling extended with a real, budget-relevant finding (D1
rows-read constraint solvable by query shape alone); no production code path changed, no live
host touched.

# 2026-09-22 - D1 REST Pagination Measurement Harness

**Keywords:** [BACKEND] [DATABASE] [PERFORMANCE] [TESTING]
**Session:** Late evening, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2258_d1-pagination-measurement-harness.md`

## What Changed

- File: `tools/measure-d1-pagination.mjs`
  - New dry-run-by-default, `--execute`-gated CLI measuring D1 REST pagination latency and
    rows-read cost against the live production corpus, mirroring `src/lib/server/d1-client.ts`'s
    real joined query (`articles` LEFT JOIN `article_categories`/`categories`, correlated tags
    subquery) rather than a synthetic flat-column query.
  - Dry run issues exactly one `SELECT COUNT(*)` against the real predicate
    (`status = 'processed' AND c.slug IS NOT NULL`) and reports live row count, page size,
    projected request count, and a projected rows-read figure against PROJECT.md's budget —
    before any bulk read executes.
  - `--execute` runs both an offset (`LIMIT ? OFFSET ?`, `ORDER BY a.id`) and a keyset
    (`WHERE a.uuid > ?`, `ORDER BY a.uuid`) full pass, timing every request from just before
    `fetch()` to just after the body is parsed, and reports min/p50/p95/max/sample count via
    nearest-rank percentiles (no statistics dependency).
  - Fails loudly (non-zero exit, HTTP status printed) on any non-2xx or `success: false`
    response instead of silently dropping a page and reporting a rosier distribution.
- File: `tools/lib/percentile.mjs`
  - New shared `nearestRank()`/`distributionStats()` helper — the one definition
    `tools/measure-render-cost.mjs` (03-06 Task 2) will import too, rather than reimplementing.
- File: `package.json`
  - Added `measure:d1`, `measure:render`, `measure:cpu` scripts for this plan's three
    measurement harnesses.
- File: `docs/phase-03/d1-pagination-report.md`
  - Generated report from the real `--execute` run against live production D1, committed as
    the durable record of this measurement.

## Why

Phase 3's success criterion 5 requires D1 REST pagination p50/p95 at the full corpus to be a
*measured* number, not modeled — Phase 2 had two confident estimates collapse under
measurement, and this project's own budget rule requires a dry run before any bulk corpus
read. This harness produces that number and, along the way, surfaced a real finding: offset
pagination reads **49,420,384 rows** (keyset **11,451,051**) for a single 39,827-row pass —
both far exceeding PROJECT.md's 5,000,000-row hard-fail budget, and 1,240x/288x higher than
the dry run's own conservative projection. The LEFT JOINs and the per-row tags subquery read
far more than one row per result row, and OFFSET pagination compounds this by re-scanning and
discarding every preceding row on each request. This is exactly the kind of collapse-under-
measurement this phase exists to catch before Phase 4 builds a loader on the wrong assumption.

## Issues Encountered

None beyond the finding itself (documented above, not a code defect in this harness — the
harness worked as designed and revealed a real cost characteristic of the underlying query
shape). No auto-fixes were needed against this task's own file set.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: dry run against live production D1 (rowCount/projectedRequests/executed
  fields verified via the plan's own automated verify script); forced-failure test against a
  deliberately invalid database id (confirmed non-zero exit with the real HTTP status); full
  `--execute` run against live production D1, twice, with consistent rows-read totals across
  runs; `grep -c 'Bearer'` on the generated report confirmed 0; `pnpm test:unit` (87/87) run
  after this change to confirm no regression.
- What wasn't tested: behavior against a non-empty result set smaller than one page (this
  session's corpus comfortably exceeds one page at the default 500-row page size); the harness
  has no unit tests of its own (pure network-integration script, following
  `design/scripts/check-contrast.mjs`'s convention of not unit-testing report generation).
- Edge cases: empty corpus (not exercised — would require a `--db-id` pointed at an actually
  empty database, out of scope here).

## Next Steps

- [ ] 03-06 Task 2: per-page render cost measurement (`tools/measure-render-cost.mjs`), reusing
      this task's `tools/lib/percentile.mjs` helper.
- [ ] 03-06 Task 3: cron CPU ceiling probe, then `docs/phase-03/measurements.md` combining all
      three numbers plus this task's rows-read finding for 03-07's render-step decision.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - measurement tooling and a real budget-relevant finding; no production code
path changed.

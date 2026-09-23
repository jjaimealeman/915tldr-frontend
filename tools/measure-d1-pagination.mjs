#!/usr/bin/env node
// D-01 (measurement #3 of 3) / D-02: D1 REST API pagination latency at the full corpus,
// MEASURED — not the ROADMAP's 41,233 or 03-RESEARCH.md's 41,896, both already stale relative
// to each other, which is the point of this whole plan. This number, combined with per-page
// render cost (tools/measure-render-cost.mjs) and the cron CPU ceiling
// (tools/cpu-ceiling-probe/), is one of the three inputs 03-07's render-step decision rests on.
//
// Mirrors src/lib/server/d1-client.ts's real query shape (the joined ARTICLE_SELECT, the same
// `status = 'processed' AND c.slug IS NOT NULL` predicate fetchLatestArticle() uses) rather than
// a synthetic flat-column query — measuring a different request shape than the loader will
// actually issue would measure the wrong thing (03-06-PLAN.md Task 1 read_first).
//
// Budget rule (.claude/CLAUDE.md § Budget): "no bulk corpus operation runs without a dry run
// reporting row count and projected cost." --dry-run is the DEFAULT. --execute is required to
// run the real paginated pass. The dry run issues exactly one SELECT COUNT(*) — it does not
// read the corpus.
//
// Credential handling follows OPS-11 / the same convention as d1-client.ts: CLOUDFLARE_ACCOUNT_ID
// and CLOUDFLARE_API_TOKEN are read from process.env only, never logged, never written into the
// report file (grep -c 'Bearer' <report> must return 0).
//
// Usage:
//   node tools/measure-d1-pagination.mjs                       # dry run (default)
//   node tools/measure-d1-pagination.mjs --execute              # full paginated pass (offset + keyset + bulk)
//   node tools/measure-d1-pagination.mjs --execute --page-size 500 --out <path> --json
//   node tools/measure-d1-pagination.mjs --execute --skip-bulk   # 03-06's original scope only
//   node tools/measure-d1-pagination.mjs --execute --bulk-page-size 5000
//
// --- 03-06-ADDENDUM (2026-09-23): third variant, "bulk fetch + in-memory stitch" ---
// Added after the orchestrator checked the query planner directly (post-03-06) and found the
// plan is already optimal — `SEARCH a USING INDEX articles_uuid_unique (uuid>?)` plus a
// correlated scalar subquery for tags. The 49.4M/11.5M rows-read costs above are not an indexing
// problem; they are a QUERY-SHAPE problem: `SELECT_COLUMNS` below runs the tags subquery once per
// article row (39,827 times) plus a per-row category LEFT JOIN. `measuredBulkPass()` tests the
// hypothesis that eliminating both — paginate `articles` alone (no JOIN, no subquery), bulk-fetch
// `article_tags`/`tags` and `article_categories`/`categories` separately, and stitch in memory —
// fits the rows-read budget. This is a hypothesis test, not an assumed win: see
// docs/phase-03/measurements.md section 1b for whether it actually does.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { distributionStats } from './lib/percentile.mjs';

const REAL_DB_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77';
const DEFAULT_OUT = 'docs/phase-03/d1-pagination-report.md';
const DEFAULT_PAGE_SIZE = 500; // ~84 requests per pass at ~37.6k processed rows — well under
// the 1,200-requests-per-5-minutes Cloudflare API rate limit even running both passes back to back.
const DAILY_ROWS_READ_BUDGET = 2_000_000; // PROJECT.md
const HARD_FAIL_ROWS_READ_BUDGET = 5_000_000; // PROJECT.md
const MATERIAL_DIFFERENCE_THRESHOLD = 0.2; // 20% relative difference at p95 counts as "material"

// 03-06-ADDENDUM: bulk-pass constants. A larger page size than the 500 used for the offset/keyset
// passes above is deliberate, not an inconsistency — this is a one-time bulk fetch a build-time
// loader would issue once, not a per-request paginated API where round-trip count matters the
// same way. Verified empirically (2026-09-23) that a 5,000-row LIMIT against article_tags returns
// cleanly with no truncation or size-limit error before choosing this value.
const BULK_PAGE_SIZE = 5000;
// Workers isolate memory ceiling (developers.cloudflare.com/workers/platform/limits/) — the bound
// an in-memory stitch over the full corpus would need to fit under if this shape ever ran inside
// a Worker rather than a Node build script.
const WORKER_MEMORY_LIMIT_MB = 128;
// 03-06-SUMMARY.md §2 (docs/phase-03/measurements.md, "Per-page render cost") — measured, not
// re-measured here. Used only to recompute the full-rebuild projection under the bulk-fetch
// shape's hypothesis: per-page D1-read cost drops to ~0 (data already in memory), so the D1-read
// component is subtracted out of the existing per-page total rather than re-measured end-to-end.
const D2_PER_PAGE_MS = {
  d1ReadP50: 230.9,
  d1ReadP95: 335.0,
  totalP50: 573.3,
  totalP95: 735.9,
};
const D2_FIXED_STARTUP_MS = 1800; // 03-06-SUMMARY.md §2, "Fixed build-startup cost", ~1.8s
const CRON_CPU_CEILING_MS = 902_000; // 03-06-SUMMARY.md §3, measured Cron Trigger CPU ceiling

function parseArgs(argv) {
  const args = {
    pageSize: DEFAULT_PAGE_SIZE,
    bulkPageSize: BULK_PAGE_SIZE,
    execute: false,
    out: DEFAULT_OUT,
    json: false,
    dbId: REAL_DB_ID,
    skipBulk: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page-size') { args.pageSize = Number(argv[++i]); continue; }
    if (arg.startsWith('--page-size=')) { args.pageSize = Number(arg.slice('--page-size='.length)); continue; }
    if (arg === '--bulk-page-size') { args.bulkPageSize = Number(argv[++i]); continue; }
    if (arg.startsWith('--bulk-page-size=')) { args.bulkPageSize = Number(arg.slice('--bulk-page-size='.length)); continue; }
    if (arg === '--skip-bulk') { args.skipBulk = true; continue; } // exercise offset/keyset only — 03-06's original scope
    if (arg === '--execute') { args.execute = true; continue; }
    if (arg === '--dry-run') { args.execute = false; continue; } // explicit no-op; dry run is already the default
    if (arg === '--out') { args.out = argv[++i]; continue; }
    if (arg.startsWith('--out=')) { args.out = arg.slice('--out='.length); continue; }
    if (arg === '--json') { args.json = true; continue; }
    // --db-id exists ONLY so this harness's failure path can be exercised deliberately against a
    // bad database id (T-03-20's forced-failure acceptance check) — never used in normal runs.
    if (arg === '--db-id') { args.dbId = argv[++i]; continue; }
    if (arg.startsWith('--db-id=')) { args.dbId = arg.slice('--db-id='.length); continue; }
  }
  if (!Number.isFinite(args.pageSize) || args.pageSize < 1) {
    throw new Error(`measure-d1-pagination: --page-size must be a positive number, got ${args.pageSize}`);
  }
  if (!Number.isFinite(args.bulkPageSize) || args.bulkPageSize < 1) {
    throw new Error(`measure-d1-pagination: --bulk-page-size must be a positive number, got ${args.bulkPageSize}`);
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`measure-d1-pagination: ${name} is not set in the environment`);
  }
  return value;
}

// Same joined shape as d1-client.ts's ARTICLE_SELECT / fetchLatestArticle() predicate — the set
// of rows Phase 4's render step will actually page through (processed, category-resolved).
const BASE_FROM = `FROM articles a
  LEFT JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1
  LEFT JOIN categories c ON c.id = ac.category_id`;
const PREDICATE = `a.status = ? AND c.slug IS NOT NULL`;
// Exposes a.uuid AS id, exactly as d1-client.ts does — NOT a.id (the internal integer PK).
// The keyset pass below paginates on this same "id" (uuid) column rather than adding an
// internal-only integer cursor column, so the offset and keyset passes issue queries with the
// IDENTICAL select-column list; see the keyset note further down for what this trades away.
const SELECT_COLUMNS = `a.uuid AS id, a.title, a.summary, c.slug AS category, a.published_at,
  (SELECT GROUP_CONCAT(t.name, ',') FROM article_tags atg JOIN tags t ON t.id = atg.tag_id WHERE atg.article_id = a.id) AS tags,
  a.status`;

async function d1Query(dbId, sql, params, { accountId, token }) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`measure-d1-pagination: D1 REST API responded ${response.status} ${response.statusText}: ${text}`);
    err.status = response.status;
    throw err;
  }

  const body = await response.json();
  if (!body.success || !body.result?.[0]?.success) {
    const message = body.errors?.map((e) => e.message).join('; ') || 'unknown D1 error';
    const err = new Error(`measure-d1-pagination: D1 query failed: ${message}`);
    err.status = response.status;
    throw err;
  }

  return { rows: body.result[0].results ?? [], meta: body.result[0].meta ?? {} };
}

async function timedD1Query(dbId, sql, params, creds) {
  // Timed from just before fetch() to just after the response body is fully parsed — the real
  // loader pays for JSON parsing too, so timing only the network leg would understate the cost.
  const start = performance.now();
  const { rows, meta } = await d1Query(dbId, sql, params, creds);
  const elapsed = performance.now() - start;
  return { rows, meta, elapsed };
}

async function dryRun({ pageSize, dbId, creds }) {
  const { rows, elapsed } = await timedD1Query(
    dbId,
    `SELECT COUNT(*) AS n ${BASE_FROM} WHERE ${PREDICATE}`,
    ['processed'],
    creds
  );
  const rowCount = Number(rows[0]?.n ?? 0);
  const projectedRequests = Math.max(1, Math.ceil(rowCount / pageSize));

  // Estimate only — labelled as such. A full offset pass touches each row once; running BOTH
  // the offset pass and the keyset secondary check touches the corpus twice. The D1 REST API's
  // own `meta.rows_read` figure (which can exceed rowCount, because the LEFT JOINs scan rows in
  // article_categories/categories/article_tags/tags too) is only known once --execute actually
  // runs — that is why this is a projection, not a promise.
  const projectedRowsReadOnePass = rowCount;
  const projectedRowsReadBothPasses = rowCount * 2;

  // Wall-clock projection: extrapolated from this ONE real network round trip's latency (the
  // COUNT query itself), not modelled from an assumed constant. Explicitly a projection from a
  // sample of one, stated as such rather than dressed up as measured.
  const projectedWallClockMsOnePass = elapsed * projectedRequests;

  return {
    executed: false,
    requestsIssued: 1,
    rowCount,
    pageSize,
    projectedRequests,
    projectedRowsReadOnePass,
    projectedRowsReadBothPasses,
    dailyRowsReadBudget: DAILY_ROWS_READ_BUDGET,
    hardFailRowsReadBudget: HARD_FAIL_ROWS_READ_BUDGET,
    withinDailyBudget: projectedRowsReadBothPasses < DAILY_ROWS_READ_BUDGET,
    withinHardFailBudget: projectedRowsReadBothPasses < HARD_FAIL_ROWS_READ_BUDGET,
    sampleRequestLatencyMs: elapsed,
    projectedWallClockMsOnePass,
    projectedWallClockMsBothPasses: projectedWallClockMsOnePass * 2,
    method:
      'One SELECT COUNT(*) issued against the real predicate (status=processed AND category resolved). ' +
      'Request count is that COUNT(*) divided by page size, rounded up. Rows-read is a LOWER-BOUND ' +
      'estimate (rowCount x number of passes) — the real per-request rows_read figure the D1 REST API ' +
      'returns can be higher due to the LEFT JOINs, and is only known once --execute runs. Wall-clock is ' +
      'this single measured request\'s latency extrapolated across the projected request count — a ' +
      'projection from a sample of one, not a measured distribution.',
  };
}

async function measuredOffsetPass({ pageSize, dbId, creds }) {
  const latencies = [];
  let rowsReadTotal = 0;
  let requestCount = 0;
  const wallClockStart = Date.now();
  let offset = 0;
  while (true) {
    const { rows, meta, elapsed } = await timedD1Query(
      dbId,
      `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE ${PREDICATE} ORDER BY a.id LIMIT ? OFFSET ?`,
      ['processed', pageSize, offset],
      creds
    );
    latencies.push(elapsed);
    requestCount++;
    rowsReadTotal += meta.rows_read ?? rows.length;
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  const totalWallClockMs = Date.now() - wallClockStart;
  return { ...distributionStats(latencies), requestCount, rowsReadTotal, totalWallClockMs };
}

/**
 * Keyset pagination secondary check (03-RESEARCH.md's "keyset generally preferable to
 * LIMIT/OFFSET at depth, but predicted no measurable difference at ~84 pages" — tested, not
 * repeated). Paginates on `a.uuid` — the SAME column the offset pass already exposes as `id` —
 * rather than adding an internal-only integer cursor column, so both passes issue a query with
 * the identical SELECT column list. Trade-off, stated explicitly: this orders by the uuid
 * column (lexicographic) rather than by `a.id` (insertion order, the offset pass's ORDER BY),
 * so a difference in index usage between the two passes could show up as a latency difference
 * that is about the ORDER BY column, not about offset-vs-keyset pagination per se — see the
 * comparison note in the report.
 */
async function measuredKeysetPass({ pageSize, dbId, creds }) {
  const latencies = [];
  let rowsReadTotal = 0;
  let requestCount = 0;
  const wallClockStart = Date.now();
  let cursor = '';
  while (true) {
    const { rows, meta, elapsed } = await timedD1Query(
      dbId,
      `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE a.uuid > ? AND ${PREDICATE} ORDER BY a.uuid LIMIT ?`,
      [cursor, 'processed', pageSize],
      creds
    );
    latencies.push(elapsed);
    requestCount++;
    rowsReadTotal += meta.rows_read ?? rows.length;
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    if (rows.length < pageSize) break;
  }
  const totalWallClockMs = Date.now() - wallClockStart;
  return { ...distributionStats(latencies), requestCount, rowsReadTotal, totalWallClockMs };
}

// --- 03-06-ADDENDUM: bulk fetch + in-memory stitch ---

/**
 * Native `articles` columns only — no LEFT JOIN, no correlated subquery. Filters ONLY on
 * `a.status = ?` (a native column), NOT on a resolved category — that filter requires the join
 * this shape exists to eliminate, so it is applied AFTER the in-memory stitch instead (see
 * `measuredBulkPass`). This means this pass reads slightly MORE article rows than the offset/
 * keyset passes' predicate matches (39,871 processed vs. 39,827 category-resolved, per the
 * dry-run's own COUNT(*) — a real, small, reported cost of this shape).
 */
async function fetchAllArticlesNative({ dbId, creds, pageSize }) {
  const rows = [];
  const latencies = [];
  let rowsReadTotal = 0;
  let requestCount = 0;
  let cursor = '';
  while (true) {
    const { rows: page, meta, elapsed } = await timedD1Query(
      dbId,
      `SELECT a.id AS internal_id, a.uuid AS id, a.title, a.summary, a.published_at, a.status
       FROM articles a WHERE a.uuid > ? AND a.status = ? ORDER BY a.uuid LIMIT ?`,
      [cursor, 'processed', pageSize],
      creds
    );
    latencies.push(elapsed);
    requestCount++;
    rowsReadTotal += meta.rows_read ?? page.length;
    rows.push(...page);
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;
    if (page.length < pageSize) break;
  }
  return { rows, ...distributionStats(latencies), requestCount, rowsReadTotal };
}

/** Bulk `article_tags` JOIN `tags`, keyset-paginated on `article_tags.rowid` (no explicit PK on this table). */
async function fetchAllTagsJoined({ dbId, creds, pageSize }) {
  const rows = [];
  const latencies = [];
  let rowsReadTotal = 0;
  let requestCount = 0;
  let cursor = 0;
  while (true) {
    const { rows: page, meta, elapsed } = await timedD1Query(
      dbId,
      `SELECT atg.rowid AS rid, atg.article_id AS article_id, t.name AS name
       FROM article_tags atg JOIN tags t ON t.id = atg.tag_id
       WHERE atg.rowid > ? ORDER BY atg.rowid LIMIT ?`,
      [cursor, pageSize],
      creds
    );
    latencies.push(elapsed);
    requestCount++;
    rowsReadTotal += meta.rows_read ?? page.length;
    rows.push(...page);
    if (page.length === 0) break;
    cursor = page[page.length - 1].rid;
    if (page.length < pageSize) break;
  }
  return { rows, ...distributionStats(latencies), requestCount, rowsReadTotal };
}

/** Bulk `article_categories` (is_primary=1 only) JOIN `categories`, keyset-paginated on rowid. */
async function fetchAllPrimaryCategoriesJoined({ dbId, creds, pageSize }) {
  const rows = [];
  const latencies = [];
  let rowsReadTotal = 0;
  let requestCount = 0;
  let cursor = 0;
  while (true) {
    const { rows: page, meta, elapsed } = await timedD1Query(
      dbId,
      `SELECT ac.rowid AS rid, ac.article_id AS article_id, c.slug AS slug
       FROM article_categories ac JOIN categories c ON c.id = ac.category_id
       WHERE ac.is_primary = 1 AND ac.rowid > ? ORDER BY ac.rowid LIMIT ?`,
      [cursor, pageSize],
      creds
    );
    latencies.push(elapsed);
    requestCount++;
    rowsReadTotal += meta.rows_read ?? page.length;
    rows.push(...page);
    if (page.length === 0) break;
    cursor = page[page.length - 1].rid;
    if (page.length < pageSize) break;
  }
  return { rows, ...distributionStats(latencies), requestCount, rowsReadTotal };
}

function heapUsedMb() {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

/**
 * Runs the three bulk passes, stitches them in memory, and reports rows-read/wall-clock/
 * round-trips exactly as the offset/keyset passes do, plus peak Node heap for the stitch step.
 */
async function measuredBulkPass({ dbId, creds, bulkPageSize }) {
  const wallClockStart = Date.now();
  const heapSamplesMb = [heapUsedMb()];

  const articles = await fetchAllArticlesNative({ dbId, creds, pageSize: bulkPageSize });
  heapSamplesMb.push(heapUsedMb());
  const tags = await fetchAllTagsJoined({ dbId, creds, pageSize: bulkPageSize });
  heapSamplesMb.push(heapUsedMb());
  const categories = await fetchAllPrimaryCategoriesJoined({ dbId, creds, pageSize: bulkPageSize });
  heapSamplesMb.push(heapUsedMb());

  const categorySlugByArticleId = new Map();
  for (const row of categories.rows) categorySlugByArticleId.set(row.article_id, row.slug);
  const tagNamesByArticleId = new Map();
  for (const row of tags.rows) {
    const list = tagNamesByArticleId.get(row.article_id);
    if (list) list.push(row.name);
    else tagNamesByArticleId.set(row.article_id, [row.name]);
  }
  heapSamplesMb.push(heapUsedMb());

  const stitched = [];
  for (const a of articles.rows) {
    const category = categorySlugByArticleId.get(a.internal_id) ?? null;
    if (category === null) continue; // mirrors the offset/keyset passes' `c.slug IS NOT NULL`
    const tagList = tagNamesByArticleId.get(a.internal_id) ?? [];
    stitched.push({
      id: a.id,
      title: a.title,
      summary: a.summary,
      category,
      published_at: a.published_at,
      tags: tagList.join(','),
      status: a.status,
    });
  }
  heapSamplesMb.push(heapUsedMb());

  const totalWallClockMs = Date.now() - wallClockStart;
  const rowsReadTotal = articles.rowsReadTotal + tags.rowsReadTotal + categories.rowsReadTotal;
  const requestCount = articles.requestCount + tags.requestCount + categories.requestCount;
  const peakHeapUsedMb = Math.max(...heapSamplesMb);

  return {
    bulkPageSize,
    articlesFetched: articles.rows.length,
    articlesRowsRead: articles.rowsReadTotal,
    articlesRequestCount: articles.requestCount,
    tagsRowsFetched: tags.rows.length,
    tagsRowsRead: tags.rowsReadTotal,
    tagsRequestCount: tags.requestCount,
    categoriesRowsFetched: categories.rows.length,
    categoriesRowsRead: categories.rowsReadTotal,
    categoriesRequestCount: categories.requestCount,
    stitchedCount: stitched.length,
    rowsReadTotal,
    requestCount,
    totalWallClockMs,
    peakHeapUsedMb,
    fitsWorkerMemoryLimit: peakHeapUsedMb < WORKER_MEMORY_LIMIT_MB,
    stitched, // kept on the in-memory report object only; never serialized to the markdown/JSON report
  };
}

/**
 * Equivalence check (per <what_to_measure> #3): picks an evenly-spaced sample of the bulk-
 * stitched output and re-fetches each by uuid via the ORIGINAL joined ARTICLE_SELECT-equivalent
 * query, comparing field-by-field. Tags are compared as a SORTED SET, not an exact string — the
 * two shapes have no guaranteed matching concatenation order (GROUP_CONCAT's row order inside a
 * correlated subquery vs. this script's own rowid-ordered bulk fetch), and comparing order would
 * produce false mismatches for a difference that does not affect the actual output records Phase
 * 4 would consume. These requests are verification overhead, excluded from the bulk pass's own
 * rows-read/wall-clock accounting above — they are not part of what a real implementation of this
 * shape would cost in production.
 */
async function verifyBulkEquivalence({ dbId, creds, stitched, sampleSize }) {
  const n = Math.min(sampleSize, stitched.length);
  const sample = [];
  for (let i = 0; i < n; i++) {
    const idx = n === 1 ? 0 : Math.round((i * (stitched.length - 1)) / (n - 1));
    sample.push(stitched[idx]);
  }

  const mismatches = [];
  let requestCount = 0;
  let rowsReadTotal = 0;
  for (const rec of sample) {
    const { rows, meta } = await d1Query(
      dbId,
      `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE a.uuid = ? AND ${PREDICATE}`,
      [rec.id, 'processed'],
      creds
    );
    requestCount++;
    rowsReadTotal += meta.rows_read ?? rows.length;
    const original = rows[0];
    if (!original) {
      mismatches.push({ id: rec.id, reason: 'not found via original joined query' });
      continue;
    }
    for (const field of ['title', 'summary', 'category', 'published_at', 'status']) {
      if (original[field] !== rec[field]) {
        mismatches.push({ id: rec.id, field, original: original[field], bulk: rec[field] });
      }
    }
    const sortedTags = (v) => (v ?? '').split(',').filter(Boolean).sort();
    const originalTags = sortedTags(original.tags);
    const bulkTags = sortedTags(rec.tags);
    if (JSON.stringify(originalTags) !== JSON.stringify(bulkTags)) {
      mismatches.push({ id: rec.id, field: 'tags (as sorted set)', original: originalTags, bulk: bulkTags });
    }
  }

  return { sampleSize: sample.length, requestCount, rowsReadTotal, mismatches, equivalent: mismatches.length === 0 };
}

/**
 * Recomputes 03-06 §4's full-corpus render-time projection under the bulk-fetch shape's
 * hypothesis: per-page D1-read cost drops to (near) zero, because the corpus is already in
 * memory after the one-time bulk fetch measured above, rather than one network round trip per
 * page. This is a PROJECTION composed of two measured inputs — this session's bulk-fetch
 * wall-clock and 03-06's already-measured per-page render/manifest-write components (with the
 * now-obsolete per-page D1-read component subtracted out) — NOT a new end-to-end measurement.
 * The tracer page itself was not rewired to use a bulk-fetched in-memory dataset this session;
 * doing so is out of scope for this narrow addendum.
 */
function projectBulkCorpusRenderTime({ bulkTotalWallClockMs, rowCount }) {
  const perPageWithoutD1ReadP50 = D2_PER_PAGE_MS.totalP50 - D2_PER_PAGE_MS.d1ReadP50;
  const perPageWithoutD1ReadP95 = D2_PER_PAGE_MS.totalP95 - D2_PER_PAGE_MS.d1ReadP95;
  const projectedMsP50 = bulkTotalWallClockMs + D2_FIXED_STARTUP_MS + rowCount * perPageWithoutD1ReadP50;
  const projectedMsP95 = bulkTotalWallClockMs + D2_FIXED_STARTUP_MS + rowCount * perPageWithoutD1ReadP95;
  return {
    perPageWithoutD1ReadP50,
    perPageWithoutD1ReadP95,
    projectedMsP50,
    projectedMsP95,
    ceilingRatioP50: projectedMsP50 / CRON_CPU_CEILING_MS,
    ceilingRatioP95: projectedMsP95 / CRON_CPU_CEILING_MS,
  };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# D1 REST Pagination Measurement');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()} by \`tools/measure-d1-pagination.mjs\`.`);
  lines.push('');
  if (!report.executed) {
    lines.push('## Dry run (no corpus read)');
    lines.push('');
    lines.push(`- Live row count (processed, category-resolved): **${report.rowCount}**`);
    lines.push(`- Page size: ${report.pageSize}`);
    lines.push(`- Projected request count: ${report.projectedRequests}`);
    lines.push(`- Projected rows read (one pass): ${report.projectedRowsReadOnePass}`);
    lines.push(`- Projected rows read (offset + keyset, both passes): ${report.projectedRowsReadBothPasses}`);
    lines.push(`- Within daily budget (<${report.dailyRowsReadBudget.toLocaleString()}): ${report.withinDailyBudget}`);
    lines.push(`- Within hard-fail budget (<${report.hardFailRowsReadBudget.toLocaleString()}): ${report.withinHardFailBudget}`);
    lines.push(`- Sample request latency (the COUNT(*) call itself): ${report.sampleRequestLatencyMs.toFixed(1)}ms`);
    lines.push(`- Projected wall-clock (one pass): ${(report.projectedWallClockMsOnePass / 1000).toFixed(1)}s`);
    lines.push(`- Projected wall-clock (both passes): ${(report.projectedWallClockMsBothPasses / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push(`Method: ${report.method}`);
    lines.push('');
    lines.push('Run with `--execute` to perform the real paginated pass.');
    return lines.join('\n') + '\n';
  }

  lines.push('## Dry run (preceded the executed pass, same session)');
  lines.push('');
  lines.push(`- Live row count at dry-run time: **${report.dryRun.rowCount}**`);
  lines.push(`- Projected requests: ${report.dryRun.projectedRequests}`);
  lines.push(`- Projected rows read (both passes): ${report.dryRun.projectedRowsReadBothPasses}`);
  lines.push('');
  lines.push('## Executed — offset pagination (`LIMIT ? OFFSET ?`, `ORDER BY a.id`)');
  lines.push('');
  lines.push(`- Page size: ${report.pageSize}`);
  lines.push(`- Request count: ${report.offset.requestCount}`);
  lines.push(`- Rows read (D1-reported, sum of \`meta.rows_read\`): ${report.offset.rowsReadTotal}`);
  lines.push(`- Sample count: ${report.offset.sampleCount}`);
  lines.push(`- min: ${report.offset.min?.toFixed(1)}ms`);
  lines.push(`- p50: ${report.offset.p50?.toFixed(1)}ms`);
  lines.push(`- p95: ${report.offset.p95?.toFixed(1)}ms`);
  lines.push(`- max: ${report.offset.max?.toFixed(1)}ms`);
  lines.push(`- Total wall-clock: ${(report.offset.totalWallClockMs / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('## Executed — keyset pagination (`WHERE a.uuid > ?`, `ORDER BY a.uuid`)');
  lines.push('');
  lines.push(`- Page size: ${report.pageSize}`);
  lines.push(`- Request count: ${report.keyset.requestCount}`);
  lines.push(`- Rows read (D1-reported, sum of \`meta.rows_read\`): ${report.keyset.rowsReadTotal}`);
  lines.push(`- Sample count: ${report.keyset.sampleCount}`);
  lines.push(`- min: ${report.keyset.min?.toFixed(1)}ms`);
  lines.push(`- p50: ${report.keyset.p50?.toFixed(1)}ms`);
  lines.push(`- p95: ${report.keyset.p95?.toFixed(1)}ms`);
  lines.push(`- max: ${report.keyset.max?.toFixed(1)}ms`);
  lines.push(`- Total wall-clock: ${(report.keyset.totalWallClockMs / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('## Actual rows-read budget check (measured, not projected)');
  lines.push('');
  lines.push(
    `- Offset pass rows read: **${report.offset.rowsReadTotal.toLocaleString()}** — ` +
    `${report.offset.rowsReadTotal >= HARD_FAIL_ROWS_READ_BUDGET ? 'EXCEEDS' : 'within'} the ${HARD_FAIL_ROWS_READ_BUDGET.toLocaleString()} hard-fail budget on its own, for a SINGLE full-corpus pass reading ${report.dryRun.rowCount.toLocaleString()} distinct rows once.`
  );
  lines.push(
    `- Keyset pass rows read: **${report.keyset.rowsReadTotal.toLocaleString()}** — ` +
    `${report.keyset.rowsReadTotal >= HARD_FAIL_ROWS_READ_BUDGET ? 'EXCEEDS' : 'within'} the ${HARD_FAIL_ROWS_READ_BUDGET.toLocaleString()} hard-fail budget on its own.`
  );
  lines.push(
    `- The dry run's projection (${report.dryRun.projectedRowsReadOnePass.toLocaleString()} rows for one pass, ` +
    `assuming rows-read ≈ row count) UNDERSTATED the real cost by ` +
    `${(report.offset.rowsReadTotal / report.dryRun.projectedRowsReadOnePass).toFixed(1)}x (offset) and ` +
    `${(report.keyset.rowsReadTotal / report.dryRun.projectedRowsReadOnePass).toFixed(1)}x (keyset) — the LEFT JOINs ` +
    'and the per-row tags subquery read far more than one row per result row, and OFFSET pagination compounds ' +
    'this further because each request re-scans and discards every row before its offset. This was NOT visible ' +
    'from the dry run alone; only the full --execute pass surfaces it.'
  );
  lines.push('');
  lines.push('## Comparison');
  lines.push('');
  lines.push(
    report.p95RelativeDifference === null
      ? '- p95 relative difference: not computable (one or both passes returned no samples)'
      : `- p95 relative difference: ${(report.p95RelativeDifference * 100).toFixed(1)}%`
  );
  lines.push(`- ${report.comparisonStatement}`);
  lines.push(
    '- Note: the keyset pass orders by `a.uuid` (lexicographic) rather than `a.id` (insertion ' +
    'order, the offset pass\'s ORDER BY) — chosen to keep the SELECT column list identical between ' +
    'passes rather than adding an internal-only integer cursor column. Any observed difference could ' +
    'be about the ORDER BY column rather than offset-vs-keyset pagination per se; not independently ' +
    'isolated in this run.'
  );
  lines.push('');

  if (report.bulk) {
    const b = report.bulk;
    lines.push('## Executed — bulk fetch + in-memory stitch (03-06-ADDENDUM hypothesis test)');
    lines.push('');
    lines.push(
      'Tests whether eliminating the per-row correlated tags subquery and per-row category LEFT ' +
      'JOIN (the load-bearing finding above, confirmed optimal-index by the query planner — the ' +
      'cost is query SHAPE, not indexing) fits the rows-read budget. Paginates `articles` alone ' +
      '(no JOIN, no subquery), bulk-fetches `article_tags`/`tags` and `article_categories`/' +
      '`categories` (is_primary=1) separately, and stitches all three in memory in Node.'
    );
    lines.push('');
    lines.push(`- Bulk page size: ${b.bulkPageSize}`);
    lines.push(`- Articles fetched (native columns, \`status=processed\` only, no category filter): **${b.articlesFetched.toLocaleString()}** — ${b.articlesRequestCount} requests, ${b.articlesRowsRead.toLocaleString()} rows read`);
    lines.push(`- \`article_tags\` JOIN \`tags\` rows fetched: **${b.tagsRowsFetched.toLocaleString()}** — ${b.tagsRequestCount} requests, ${b.tagsRowsRead.toLocaleString()} rows read`);
    lines.push(`- \`article_categories\` (is_primary=1) JOIN \`categories\` rows fetched: **${b.categoriesRowsFetched.toLocaleString()}** — ${b.categoriesRequestCount} requests, ${b.categoriesRowsRead.toLocaleString()} rows read`);
    lines.push(`- Stitched output records (after dropping articles with no resolved category, mirroring \`c.slug IS NOT NULL\`): **${b.stitchedCount.toLocaleString()}**`);
    lines.push(`- Articles read but dropped at stitch (processed but no resolved primary category): ${(b.articlesFetched - b.stitchedCount).toLocaleString()}`);
    lines.push(`- **Total rows read (all 3 passes, D1-reported \`meta.rows_read\`): ${b.rowsReadTotal.toLocaleString()}**`);
    lines.push(`- Rows read per stitched article returned: ${(b.rowsReadTotal / b.stitchedCount).toFixed(2)}`);
    lines.push(`- Total round trips (all 3 passes): ${b.requestCount}`);
    lines.push(`- Total wall-clock (all 3 passes + in-memory stitch): ${(b.totalWallClockMs / 1000).toFixed(1)}s`);
    lines.push(`- Peak Node heap during stitch: **${b.peakHeapUsedMb.toFixed(1)} MB** — ${b.fitsWorkerMemoryLimit ? 'FITS' : 'EXCEEDS'} the ${WORKER_MEMORY_LIMIT_MB}MB Workers isolate memory limit (measured via \`process.memoryUsage().heapUsed\` sampled at each pipeline stage in THIS Node process — not measured inside an actual Worker isolate, which has different baseline overhead; stated as a Node-process proxy, not a Worker-verified figure).`);
    lines.push('');
    lines.push(
      `- **Rows-read ratio vs. keyset baseline:** ${b.rowsReadTotal.toLocaleString()} vs. ${report.keyset.rowsReadTotal.toLocaleString()} — ` +
      `${(b.rowsReadTotal / report.keyset.rowsReadTotal).toFixed(3)}x (${b.rowsReadTotal < report.keyset.rowsReadTotal ? 'CHEAPER' : 'MORE EXPENSIVE'} than keyset).`
    );
    lines.push(
      `- **Against the hard-fail budget (${HARD_FAIL_ROWS_READ_BUDGET.toLocaleString()} rows):** ` +
      `${b.rowsReadTotal >= HARD_FAIL_ROWS_READ_BUDGET ? 'STILL EXCEEDS it' : 'WITHIN it'} — ` +
      `${(b.rowsReadTotal / HARD_FAIL_ROWS_READ_BUDGET).toFixed(2)}x the budget for one full pass.`
    );
    lines.push('');
    lines.push('### Output-equivalence check');
    lines.push('');
    const eq = report.bulkEquivalence;
    lines.push(
      `Re-fetched ${eq.sampleSize} evenly-spaced sample records (of ${b.stitchedCount.toLocaleString()} stitched) via the ` +
      `ORIGINAL joined query by uuid (${eq.requestCount} requests, ${eq.rowsReadTotal.toLocaleString()} rows read — ` +
      'excluded from the bulk pass\'s own cost accounting above as verification overhead, not production cost). ' +
      'Tags compared as a sorted set, not an exact string (see method note in the harness source) — the two shapes ' +
      'have no guaranteed matching concatenation order.'
    );
    lines.push('');
    lines.push(
      eq.equivalent
        ? `**Result: EQUIVALENT.** All ${eq.sampleSize} sampled records matched field-for-field (title, summary, category, published_at, status, tags-as-set).`
        : `**Result: NOT EQUIVALENT — ${eq.mismatches.length} mismatch(es) found.** ${JSON.stringify(eq.mismatches).slice(0, 2000)}`
    );
    lines.push('');
    lines.push('### Recomputed full-corpus render-time projection (composed, not re-measured end-to-end)');
    lines.push('');
    const proj = report.bulkProjection;
    lines.push(
      'PROJECTION, not a measurement: composed from this session\'s measured bulk-fetch wall-clock ' +
      '(above) plus 03-06 §2\'s already-measured per-page render + manifest-write components, with ' +
      'the now-obsolete per-page D1-read component subtracted out (bulk-fetch amortizes D1 access ' +
      'to one upfront pass rather than one round trip per page). The tracer page itself was NOT ' +
      'rewired to consume a bulk-fetched in-memory dataset this session — that is out of scope for ' +
      'this addendum. Basis: 03-06-SUMMARY.md §2 (`docs/phase-03/measurements.md`), dated 2026-09-23.'
    );
    lines.push('');
    lines.push('| Metric | Old projection (03-06 §4, per-page D1 read included) | New projection (bulk-fetch shape) |');
    lines.push('|---|---|---|');
    lines.push(
      `| Per-page cost used | p50=${D2_PER_PAGE_MS.totalP50}ms / p95=${D2_PER_PAGE_MS.totalP95}ms | ` +
      `p50=${proj.perPageWithoutD1ReadP50.toFixed(1)}ms / p95=${proj.perPageWithoutD1ReadP95.toFixed(1)}ms (D1-read component removed)` +
      ' |'
    );
    lines.push(
      `| Projected full-corpus render time (${b.stitchedCount.toLocaleString()} articles) | ` +
      `p50 ≈ 6.34h / p95 ≈ 8.14h (03-06 §4, at 39,827 rows) | ` +
      `p50 ≈ ${(proj.projectedMsP50 / 3_600_000).toFixed(2)}h / p95 ≈ ${(proj.projectedMsP95 / 3_600_000).toFixed(2)}h |`
    );
    lines.push(
      `| vs. ${CRON_CPU_CEILING_MS.toLocaleString()}ms cron CPU ceiling | 25.3x-32.5x OVER | ` +
      `${proj.ceilingRatioP50.toFixed(2)}x-${proj.ceilingRatioP95.toFixed(2)}x ` +
      `${proj.ceilingRatioP95 > 1 ? 'OVER' : 'within'} |`
    );
    lines.push('');
    lines.push(
      'This projection changes the render-time story ONLY insofar as the per-page D1-read cost is ' +
      'amortized away — it does NOT by itself prove a full rebuild fits the 902,000ms cron CPU ' +
      'ceiling, and it does not change §1\'s rows-read finding above (the bulk-fetch pass\'s own ' +
      'rows-read total, reported above, is the number that matters for the D1 budget question).'
    );
    lines.push('');
  }

  lines.push('## Headline numbers (offset pass — the strategy Phase 4 is most likely to use)');
  lines.push('');
  lines.push(`- p50: ${report.p50?.toFixed(1)}ms`);
  lines.push(`- p95: ${report.p95?.toFixed(1)}ms`);
  lines.push(`- Sample count: ${report.sampleCount}`);
  lines.push(`- Page size: ${report.pageSize}`);
  lines.push('');
  lines.push('Reproduce: `node tools/measure-d1-pagination.mjs --execute`');
  return lines.join('\n') + '\n';
}

async function emit(report, args) {
  const markdown = toMarkdown(report);
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, markdown, 'utf8');

  if (args.json) {
    // Nothing else may reach stdout in --json mode — a downstream `JSON.parse` on the full
    // stdout stream (this script's own verification harness does exactly that) would break if
    // any human-readable text were interleaved with it.
    console.log(JSON.stringify(report));
  } else {
    console.log(markdown);
    console.error(`Report written to ${args.out}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const creds = {
    accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
    token: requireEnv('CLOUDFLARE_API_TOKEN'),
  };

  if (!args.execute) {
    const report = await dryRun({ pageSize: args.pageSize, dbId: args.dbId, creds });
    await emit(report, args);
    return;
  }

  const dry = await dryRun({ pageSize: args.pageSize, dbId: args.dbId, creds });
  const offset = await measuredOffsetPass({ pageSize: args.pageSize, dbId: args.dbId, creds });
  const keyset = await measuredKeysetPass({ pageSize: args.pageSize, dbId: args.dbId, creds });

  const p95RelativeDifference =
    offset.p95 && keyset.p95 ? Math.abs(offset.p95 - keyset.p95) / offset.p95 : null;
  const materialDifference =
    p95RelativeDifference !== null && p95RelativeDifference > MATERIAL_DIFFERENCE_THRESHOLD;

  const comparisonStatement = materialDifference
    ? `Keyset and offset pagination DIFFER MATERIALLY at p95 (${(p95RelativeDifference * 100).toFixed(1)}% relative difference) — this belongs to Phase 4's loader design, which is the code that will actually pay this cost.`
    : `Keyset and offset pagination did NOT differ materially at p95${p95RelativeDifference === null ? '' : ` (${(p95RelativeDifference * 100).toFixed(1)}% relative difference)`} — matches 03-RESEARCH.md's prediction of no measurable difference at ~84 pages.`;

  let bulk = null;
  let bulkEquivalence = null;
  let bulkProjection = null;
  if (!args.skipBulk) {
    bulk = await measuredBulkPass({ dbId: args.dbId, creds, bulkPageSize: args.bulkPageSize });
    bulkEquivalence = await verifyBulkEquivalence({
      dbId: args.dbId,
      creds,
      stitched: bulk.stitched,
      sampleSize: 20,
    });
    bulkProjection = projectBulkCorpusRenderTime({
      bulkTotalWallClockMs: bulk.totalWallClockMs,
      rowCount: bulk.stitchedCount,
    });
    // The full stitched array is only needed for the equivalence check above — never serialize
    // ~40k article records into the markdown/JSON report.
    delete bulk.stitched;
  }

  const report = {
    executed: true,
    pageSize: args.pageSize,
    dryRun: dry,
    offset,
    keyset,
    bulk,
    bulkEquivalence,
    bulkProjection,
    p95RelativeDifference,
    materialDifference,
    comparisonStatement,
    sampleCount: offset.sampleCount,
    min: offset.min,
    p50: offset.p50,
    p95: offset.p95,
    max: offset.max,
  };

  await emit(report, args);
}

main().catch((err) => {
  console.error(err.message);
  if (err.status) console.error(`HTTP status: ${err.status}`);
  process.exit(1);
});

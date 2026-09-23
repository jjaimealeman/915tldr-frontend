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
//   node tools/measure-d1-pagination.mjs --execute              # full paginated pass
//   node tools/measure-d1-pagination.mjs --execute --page-size 500 --out <path> --json

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

function parseArgs(argv) {
  const args = { pageSize: DEFAULT_PAGE_SIZE, execute: false, out: DEFAULT_OUT, json: false, dbId: REAL_DB_ID };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page-size') { args.pageSize = Number(argv[++i]); continue; }
    if (arg.startsWith('--page-size=')) { args.pageSize = Number(arg.slice('--page-size='.length)); continue; }
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

  const report = {
    executed: true,
    pageSize: args.pageSize,
    dryRun: dry,
    offset,
    keyset,
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

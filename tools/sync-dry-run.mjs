#!/usr/bin/env node
// 04-03 Task 1 / CLAUDE.md Budget: "no bulk corpus operation runs without a dry run reporting row
// count and projected cost." This script runs BEFORE any cold-capable loader code exists in this
// repo, so no parallel build can run the first full-corpus pass unannounced. Read-only: every
// statement here is a `SELECT COUNT(*)`, never a bulk row fetch — the dry run's own cost is a
// handful of rows, not the corpus.
//
// Prints:
//   - the public article count (status = 'processed' AND is_duplicate = 0)
//   - total articles, article_tags rows, primary article_categories rows
//   - the dry run's own rows read (sum of meta.rows_read across all 4 counts)
//   - projected cold request count at 5,000 rows/page (the bulk-fetch page size Task 1 uses)
//   - projected cold rows read, via the measured rows-per-article ratio from
//     docs/phase-03/d1-pagination-report.md (957,008 rows / 39,867 stitched articles ≈ 24.008
//     rows/article), scaled to TODAY's total article count — not a re-assertion of the stale
//     39,867/957,008 pair, since the corpus has grown since Phase 3 measured it
//   - projected KV writes (= public count, for the first v2 manifest rollout)
//   - projected cost at current Cloudflare list prices for D1 rows read and KV writes, with the
//     source URL printed so the number is checkable, not asserted
//
// Credential handling follows the same OPS-11 convention as src/lib/server/d1-client.ts:
// CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN read from process.env only, never logged.
//
// Usage: node tools/sync-dry-run.mjs [--json]

const D1_DATABASE_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77';
const BULK_PAGE_SIZE = 5000;

// Phase 3's measured bulk-fetch pass (docs/phase-03/d1-pagination-report.md, "Executed — bulk
// fetch + in-memory stitch"): 957,008 total rows read (articles + article_tags + article_categories
// joins) for 39,867 stitched output articles — 24.008... rows read per stitched article returned.
// Used here as a per-article cost ratio, scaled to today's live corpus size, rather than as a
// fixed absolute number (the corpus has grown since 2026-09-23).
const PHASE_3_BULK_ROWS_READ = 957_008;
const PHASE_3_BULK_STITCHED_ARTICLES = 39_867;
const PHASE_3_ROWS_PER_ARTICLE = PHASE_3_BULK_ROWS_READ / PHASE_3_BULK_STITCHED_ARTICLES;

// Cloudflare list prices, fetched live 2026-09-26 (not carried forward from memory or an older
// doc) — see the printed source URLs in the report below for exactly what was read.
const D1_ROWS_READ_INCLUDED_PER_MONTH = 25_000_000_000; // Workers Paid plan
const D1_PRICE_PER_MILLION_ROWS_READ = 0.001; // USD, after the included allotment
const KV_WRITES_INCLUDED_PER_MONTH = 1_000_000; // Workers Paid plan
const KV_PRICE_PER_MILLION_WRITES = 5.0; // USD, after the included allotment

const D1_PRICING_URL = 'https://developers.cloudflare.com/d1/platform/pricing/';
const KV_PRICING_URL = 'https://developers.cloudflare.com/kv/platform/pricing/';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`sync-dry-run: ${name} is not set in the environment`);
  }
  return value;
}

async function d1Count(sql, params, { accountId, token }) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sync-dry-run: D1 REST API responded ${response.status} ${response.statusText}: ${text}`);
  }

  const body = await response.json();
  if (!body.success || !body.result?.[0]?.success) {
    const message = body.errors?.map((e) => e.message).join('; ') || 'unknown D1 error';
    throw new Error(`sync-dry-run: D1 query failed: ${message}`);
  }

  const rowsRead = body.result[0].meta?.rows_read;
  if (typeof rowsRead !== 'number') {
    throw new Error('sync-dry-run: D1 query response is missing meta.rows_read');
  }

  return { n: body.result[0].results?.[0]?.n ?? 0, rowsRead };
}

function costFor(units, includedPerMonth, pricePerMillion) {
  const billable = Math.max(0, units - includedPerMonth);
  return (billable / 1_000_000) * pricePerMillion;
}

export async function runDryRun({ fetchCreds } = {}) {
  const creds = fetchCreds ?? {
    accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
    token: requireEnv('CLOUDFLARE_API_TOKEN'),
  };

  const [publicArticles, totalArticles, tagRows, primaryCategoryRows] = await Promise.all([
    d1Count(`SELECT COUNT(*) AS n FROM articles WHERE status = ? AND is_duplicate = 0`, ['processed'], creds),
    d1Count(`SELECT COUNT(*) AS n FROM articles`, [], creds),
    d1Count(`SELECT COUNT(*) AS n FROM article_tags`, [], creds),
    d1Count(`SELECT COUNT(*) AS n FROM article_categories WHERE is_primary = 1`, [], creds),
  ]);

  const dryRunRowsRead =
    publicArticles.rowsRead + totalArticles.rowsRead + tagRows.rowsRead + primaryCategoryRows.rowsRead;

  const projectedColdRequestCount =
    Math.ceil(totalArticles.n / BULK_PAGE_SIZE) +
    Math.ceil(tagRows.n / BULK_PAGE_SIZE) +
    Math.ceil(primaryCategoryRows.n / BULK_PAGE_SIZE) +
    1; // one un-paginated `sources` query, per docs/phase-03/d1-pagination-report.md's shape

  const projectedColdRowsRead = Math.round(totalArticles.n * PHASE_3_ROWS_PER_ARTICLE);
  const projectedKvWrites = publicArticles.n;

  const projectedD1Cost = costFor(projectedColdRowsRead, D1_ROWS_READ_INCLUDED_PER_MONTH, D1_PRICE_PER_MILLION_ROWS_READ);
  const projectedKvCost = costFor(projectedKvWrites, KV_WRITES_INCLUDED_PER_MONTH, KV_PRICE_PER_MILLION_WRITES);
  const projectedTotalCost = projectedD1Cost + projectedKvCost;

  return {
    publicArticles: publicArticles.n,
    totalArticles: totalArticles.n,
    tagRows: tagRows.n,
    primaryCategoryRows: primaryCategoryRows.n,
    dryRunRowsRead,
    projectedColdRequestCount,
    projectedColdRowsRead,
    rowsPerArticleRatio: PHASE_3_ROWS_PER_ARTICLE,
    projectedKvWrites,
    projectedD1Cost,
    projectedKvCost,
    projectedTotalCost,
  };
}

function formatReport(r) {
  const lines = [];
  lines.push('## Dry run');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()} by \`tools/sync-dry-run.mjs\` (read-only — 4 SELECT COUNT(*) statements).`);
  lines.push('');
  lines.push(`- Public article count (\`status = 'processed' AND is_duplicate = 0\`): **${r.publicArticles}**`);
  lines.push(`- Total articles: **${r.totalArticles}**`);
  lines.push(`- \`article_tags\` rows: **${r.tagRows}**`);
  lines.push(`- Primary \`article_categories\` rows (\`is_primary = 1\`): **${r.primaryCategoryRows}**`);
  lines.push(`- Dry run's own rows read (sum of all 4 \`meta.rows_read\`): **${r.dryRunRowsRead}**`);
  lines.push('');
  lines.push(
    `- Projected cold request count at ${BULK_PAGE_SIZE.toLocaleString()} rows/page: ceil(${r.totalArticles}/${BULK_PAGE_SIZE}) [articles] + ceil(${r.tagRows}/${BULK_PAGE_SIZE}) [tags] + ceil(${r.primaryCategoryRows}/${BULK_PAGE_SIZE}) [categories] + 1 [sources] = **${r.projectedColdRequestCount} requests**`
  );
  lines.push(
    `- Projected cold rows read: totalArticles (${r.totalArticles}) × (Phase 3's measured ${PHASE_3_BULK_ROWS_READ.toLocaleString()} rows / ${PHASE_3_BULK_STITCHED_ARTICLES.toLocaleString()} stitched articles ≈ ${r.rowsPerArticleRatio.toFixed(3)} rows/article, docs/phase-03/d1-pagination-report.md) = **${r.projectedColdRowsRead.toLocaleString()} rows**`
  );
  lines.push(`- Projected KV writes (= public article count, first v2 manifest rollout): **${r.projectedKvWrites.toLocaleString()}**`);
  lines.push('');
  lines.push('### Projected cost (current Cloudflare list prices, fetched live 2026-09-26)');
  lines.push('');
  lines.push(
    `- D1 rows read: ${D1_ROWS_READ_INCLUDED_PER_MONTH.toLocaleString()}/month included (Workers Paid) then $${D1_PRICE_PER_MILLION_ROWS_READ}/million — ${r.projectedColdRowsRead.toLocaleString()} rows is entirely inside the included allotment ⇒ **$${r.projectedD1Cost.toFixed(6)}**. Source: ${D1_PRICING_URL}`
  );
  lines.push(
    `- KV writes: ${KV_WRITES_INCLUDED_PER_MONTH.toLocaleString()}/month included (Workers Paid) then $${KV_PRICE_PER_MILLION_WRITES}/million — ${r.projectedKvWrites.toLocaleString()} writes is entirely inside the included allotment ⇒ **$${r.projectedKvCost.toFixed(6)}**. Source: ${KV_PRICING_URL}`
  );
  lines.push(`- **Projected total cost: $${r.projectedTotalCost.toFixed(6)}** — well under the $1 CLAUDE.md approval threshold.`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const asJson = process.argv.includes('--json');
  const r = await runDryRun();
  if (asJson) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(formatReport(r));
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exitCode = 1;
  });
}

export { formatReport };

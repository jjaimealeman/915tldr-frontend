#!/usr/bin/env node
// D-01 (measurement #1 of 3) / D-02: per-page render cost, measured against the REAL tracer
// slice — a real D1 read, a real render, a real KV manifest write — not a fixture-driven Astro
// benchmark. 03-CONTEXT.md's D-02 exists precisely because a synthetic benchmark measures a
// different code path than production (the 2026-08-27 incident this project's own
// verification standard cites).
//
// Extends `src/pages/[category]/[slug].astro`'s `getStaticPaths` via an environment variable
// this script sets on a CHILD `astro build` process only — normal builds (including
// `pnpm test:unit`'s own `pnpm run build` step) never see it and are unaffected.
//
// Samples across the real summary-length distribution (not the newest N articles): fetches a
// lightweight {uuid, LENGTH(summary)} list for every processed, category-resolved article in
// ONE request, sorts by length, and picks N evenly-spaced ranks. Summary length is used (not
// full `content` length, which 915tldr.com2/docs/phase-02/corpus-measurements.md also reports)
// because the tracer page renders `row.summary`, not `row.content` — sampling by what is
// actually rendered is what makes a 50-article sample representative of render cost, rather
// than by a column this page never touches.
//
// Reports min/p50/p95/max/sample count for D1 read, render, and manifest write SEPARATELY, plus
// a total, plus fixed Astro/Vite build-startup cost isolated out — so a corpus projection is
// `fixed + n × per-page`, not `n × blended`, which would overstate a full rebuild substantially
// at ~40,000 pages.
//
// Credential handling follows the same OPS-11 convention as d1-client.ts / measure-d1-pagination:
// CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN read from process.env only, never logged, never
// written into the report.
//
// Usage:
//   node tools/measure-render-cost.mjs --count 50 [--out <path>] [--json]

import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { distributionStats } from './lib/percentile.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_DB_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77';
const DEFAULT_COUNT = 50;
const DEFAULT_OUT = 'docs/phase-03/render-cost-report.md';

function parseArgs(argv) {
  const args = { count: DEFAULT_COUNT, out: DEFAULT_OUT, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--count') { args.count = Number(argv[++i]); continue; }
    if (arg.startsWith('--count=')) { args.count = Number(arg.slice('--count='.length)); continue; }
    if (arg === '--out') { args.out = argv[++i]; continue; }
    if (arg.startsWith('--out=')) { args.out = arg.slice('--out='.length); continue; }
    if (arg === '--json') { args.json = true; continue; }
  }
  if (!Number.isFinite(args.count) || args.count < 1) {
    throw new Error(`measure-render-cost: --count must be a positive number, got ${args.count}`);
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`measure-render-cost: ${name} is not set in the environment`);
  }
  return value;
}

async function d1Query(sql, params, { accountId, token }) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${REAL_DB_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`measure-render-cost: D1 REST API responded ${response.status} ${response.statusText}: ${text}`);
  }
  const body = await response.json();
  if (!body.success || !body.result?.[0]?.success) {
    const message = body.errors?.map((e) => e.message).join('; ') || 'unknown D1 error';
    throw new Error(`measure-render-cost: D1 query failed: ${message}`);
  }
  return { rows: body.result[0].results ?? [], meta: body.result[0].meta ?? {} };
}

/**
 * One request, no LIMIT/OFFSET, two lightweight columns — deliberately NOT the joined
 * ARTICLE_SELECT shape (that would multiply this single bulk query's cost the same way
 * measure-d1-pagination.mjs found offset pagination does). `EXISTS` is used instead of a JOIN
 * for the category-resolved predicate so matching rows are not fanned out.
 */
async function fetchSummaryLengthIndex(creds) {
  const sql = `
    SELECT a.uuid AS id, LENGTH(a.summary) AS len
    FROM articles a
    WHERE a.status = ?
      AND a.summary IS NOT NULL AND TRIM(a.summary) != ''
      AND EXISTS (
        SELECT 1 FROM article_categories ac
        JOIN categories c ON c.id = ac.category_id
        WHERE ac.article_id = a.id AND ac.is_primary = 1 AND c.slug IS NOT NULL
      )
  `;
  const { rows, meta } = await d1Query(sql, ['processed'], creds);
  return { rows, rowsRead: meta.rows_read ?? rows.length };
}

/**
 * Picks `count` evenly-spaced-by-rank ids from a length-sorted index — spans the real
 * distribution rather than clustering at one end, and rather than a random sample that could,
 * by chance, miss a tail this small a sample needs to represent.
 */
function pickStratifiedSample(sortedByLen, count) {
  if (sortedByLen.length === 0) {
    throw new Error('measure-render-cost: summary-length index returned zero rows — cannot sample');
  }
  const n = Math.min(count, sortedByLen.length);
  const picked = [];
  const seenIdx = new Set();
  for (let i = 0; i < n; i++) {
    const idx = n === 1 ? 0 : Math.round((i * (sortedByLen.length - 1)) / (n - 1));
    if (seenIdx.has(idx)) continue; // can collide only when count > distinct available ranks
    seenIdx.add(idx);
    picked.push(sortedByLen[idx]);
  }
  return picked;
}

function runChildBuild(env) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(path.join(REPO_ROOT, 'node_modules/.bin/astro'), ['build'], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      const wallClockMs = Date.now() - start;
      if (code !== 0) {
        reject(new Error(`measure-render-cost: astro build exited ${code}\n${stderr.slice(-4000)}`));
        return;
      }
      resolve({ wallClockMs, stdout, stderr });
    });
  });
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# Per-Page Render Cost Measurement');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()} by \`tools/measure-render-cost.mjs\`.`);
  lines.push('');
  lines.push('## Sample selection');
  lines.push('');
  lines.push(
    `- ${report.sampleCount} articles sampled at evenly-spaced ranks of a full corpus-wide ` +
    `\`ORDER BY LENGTH(summary)\` (${report.candidatePoolSize} candidate rows, processed + ` +
    'category-resolved), NOT the newest N articles — spans the real summary-length distribution ' +
    '(915tldr.com2/docs/phase-02/corpus-measurements.md: summary p50=889, p95=1169, max=1498 ' +
    'chars, as of 2026-09-19) rather than clustering at one end of it.'
  );
  lines.push(`- Sampled summary lengths in this run: min ${report.sampleLenMin}, max ${report.sampleLenMax} chars.`);
  lines.push('');
  lines.push('## Per-page cost — components (ms)');
  lines.push('');
  lines.push('| Component | min | p50 | p95 | max | n |');
  lines.push('|---|---|---|---|---|---|');
  for (const [name, stats] of Object.entries(report.components)) {
    lines.push(
      `| ${name} | ${stats.min?.toFixed(2)} | ${stats.p50?.toFixed(2)} | ${stats.p95?.toFixed(2)} | ${stats.max?.toFixed(2)} | ${stats.sampleCount} |`
    );
  }
  lines.push(`| **total (sum of components)** | ${report.min?.toFixed(2)} | ${report.p50?.toFixed(2)} | ${report.p95?.toFixed(2)} | ${report.max?.toFixed(2)} | ${report.sampleCount} |`);
  lines.push('');
  lines.push('## What "render" excludes');
  lines.push('');
  lines.push(
    '- The `render` component times this page\'s own frontmatter script (date formatting), NOT ' +
    'Astro\'s own template-to-HTML string compilation, which runs after the frontmatter block and ' +
    'is not independently instrumentable from inside it. For this page\'s simple template ' +
    '(a handful of interpolations, no loops), that excluded cost is expected to be small, but it ' +
    'is NOT measured here and is not claimed to be.'
  );
  lines.push('');
  lines.push('## Fixed build-startup cost');
  lines.push('');
  lines.push(
    `- Total child \`astro build\` wall-clock: ${report.totalBuildWallClockMs}ms for ${report.sampleCount} pages.`
  );
  lines.push(
    `- Sum of all measured per-page component time across all ${report.sampleCount} pages: ${report.sumAllComponentsMs.toFixed(1)}ms.`
  );
  lines.push(
    `- Fixed startup cost (build wall-clock minus that sum, floored at 0): **${report.fixedStartupMs.toFixed(1)}ms**. ` +
    'This isolates Vite/Astro initialisation, the module graph, and the assertion walk — cost ' +
    'that does not scale per page — so a corpus projection is `fixed + n × per-page`, not ' +
    '`n × blended`, which would overstate a full rebuild substantially at ~40,000 pages.'
  );
  lines.push('');
  lines.push(`Reproduce: \`node tools/measure-render-cost.mjs --count ${report.sampleCount}\``);
  return lines.join('\n') + '\n';
}

async function emit(report, args) {
  const markdown = toMarkdown(report);
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, markdown, 'utf8');

  if (args.json) {
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

  const { rows: lenIndex } = await fetchSummaryLengthIndex(creds);
  const sortedByLen = [...lenIndex].sort((a, b) => a.len - b.len);
  const sample = pickStratifiedSample(sortedByLen, args.count);
  const ids = sample.map((r) => r.id);

  const outFile = path.join(os.tmpdir(), `measure-render-cost-${process.pid}-${Date.now()}.json`);

  try {
    const { wallClockMs: totalBuildWallClockMs } = await runChildBuild({
      MEASURE_RENDER_COST: '1',
      MEASURE_RENDER_COST_IDS: JSON.stringify(ids),
      MEASURE_RENDER_COST_OUT: outFile,
    });

    let samples;
    try {
      samples = JSON.parse(await readFile(outFile, 'utf8'));
    } catch (err) {
      throw new Error(
        `measure-render-cost: could not read/parse the harness output file the build should have ` +
        `written (${outFile}) — ${err.message}`
      );
    }

    if (!Array.isArray(samples) || samples.length !== ids.length) {
      throw new Error(
        `measure-render-cost: expected ${ids.length} samples from the harness build, got ` +
        `${Array.isArray(samples) ? samples.length : typeof samples}`
      );
    }

    const missingRender = samples.filter((s) => s.renderMs === null || s.renderMs === undefined);
    if (missingRender.length > 0) {
      throw new Error(
        `measure-render-cost: ${missingRender.length} of ${samples.length} samples never had their ` +
        'render component recorded — the component body did not run for every generated path'
      );
    }

    const d1Read = distributionStats(samples.map((s) => s.d1ReadMs));
    const render = distributionStats(samples.map((s) => s.renderMs));
    const manifestBuild = distributionStats(samples.map((s) => s.manifestBuildMs));
    const manifestWrite = distributionStats(samples.map((s) => s.manifestWriteMs));
    const manifestWriteCombined = distributionStats(
      samples.map((s) => s.manifestBuildMs + s.manifestWriteMs)
    );
    const totals = distributionStats(
      samples.map((s) => s.d1ReadMs + s.renderMs + s.manifestBuildMs + s.manifestWriteMs)
    );
    const sumAllComponentsMs = samples.reduce(
      (acc, s) => acc + s.d1ReadMs + s.renderMs + s.manifestBuildMs + s.manifestWriteMs,
      0
    );
    const fixedStartupMs = Math.max(0, totalBuildWallClockMs - sumAllComponentsMs);

    const report = {
      sampleCount: samples.length,
      candidatePoolSize: lenIndex.length,
      sampleLenMin: sample[0]?.len,
      sampleLenMax: sample[sample.length - 1]?.len,
      components: {
        d1Read,
        render,
        manifestBuild,
        manifestWrite,
        manifestWriteCombined,
      },
      // Top-level fields mirror the "total per-page cost" distribution, in the shape the
      // verification script expects (min/p50/p95/max/sampleCount) plus fixedStartupMs.
      min: totals.min,
      p50: totals.p50,
      p95: totals.p95,
      max: totals.max,
      totalBuildWallClockMs,
      sumAllComponentsMs,
      fixedStartupMs,
    };

    await emit(report, args);
  } finally {
    await rm(outFile, { force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

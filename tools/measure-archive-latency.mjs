#!/usr/bin/env node
// 05-11 Task 3: ROADMAP criterion 2's latency evidence for the archive tier, measured on the real
// deployed Worker — Worker->R2 get() latency (p50/p95, from the Worker's own `Server-Timing`
// `r2;dur` metric), client TTFB for three request classes (archived cache-miss, archived
// edge-hit, hot static), and lab Largest Contentful Paint in real Chromium with mobile emulation
// for archived vs. hot article pages, judged against the project's 1.5s LCP budget.
//
// Three measurements, each independent and individually reported:
//
//   1. R2 latency (cold). At least `--r2-sample-size` (default 200) DISTINCT archived article
//      URLs, each requested exactly once (never repeated — a repeat would measure the 300s edge
//      cache, not R2/KV). Only responses whose `Server-Timing` names `archive;desc=r2` (a
//      genuine R2 serve, not an edge-cache hit) count toward the r2/kv duration stats — this
//      guards against a sample that happens to collide with a very recent request from an
//      earlier task in this same session.
//
//   2. TTFB comparison. `--edge-hit-sample-size` (default 50) of the SAME paths from step 1,
//      re-requested immediately after (well inside the 300s edge-cache TTL) — these should carry
//      `archive;desc=edge-cache`, never `r2`. Compared against `--hot-sample-size` (default 50)
//      hot (never-archived) article paths, served entirely by the static-asset layer (no Worker
//      invocation, no Server-Timing header at all).
//
//   3. Lab LCP. Real Chromium (`@playwright/test`'s own `chromium` launcher, same fontconfig
//      isolation `tests/integration/browser-journeys.test.mjs` already uses), a fresh browser
//      context per page (no shared cache/cookies between samples), Playwright's own `devices`
//      mobile descriptor (default `Pixel 7` — a real Chromium-on-Android profile, not WebKit),
//      no artificial network/CPU throttling. `--lcp-sample-size` (default 20) archived and 20 hot
//      article pages; LCP read via `performance.getEntriesByType('largest-contentful-paint')`
//      after a short settle delay.
//
// Verdict: `R2_LATENCY_FITS_LCP` when archived p95 LCP <= 1,500ms, else
// `R2_LATENCY_EXCEEDS_LCP` — reported either way, never hidden. This is a LAB proxy; field LCP at
// mobile p75 remains Phase 11's actual release gate (PROJECT.md's own LCP constraint).
//
// Requests are paced at <= 10/s throughout (this project's own rule for live measurement
// scripts) via a fixed delay between requests, not a burst.
import { chromium, devices } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadArchivePlan,
  pickArchivedArticles,
  pickHotArticles,
} from '../tests/helpers/archive-sample.mjs';
import { distributionStats } from './lib/percentile.mjs';

const DEFAULT_DEV_HOST = 'dev.915tldr.com';
const PACE_MS = 110; // < 10 req/s

function parseArgs(argv) {
  const args = {
    devHost: DEFAULT_DEV_HOST,
    json: false,
    evidenceDir: null,
    r2SampleSize: 200,
    edgeHitSampleSize: 50,
    hotSampleSize: 50,
    lcpSampleSize: 20,
    device: 'Pixel 7',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--dev-host') { args.devHost = next(); continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--evidence') { args.evidenceDir = next(); continue; }
    if (arg === '--r2-sample-size') { args.r2SampleSize = Number(next()); continue; }
    if (arg === '--edge-hit-sample-size') { args.edgeHitSampleSize = Number(next()); continue; }
    if (arg === '--hot-sample-size') { args.hotSampleSize = Number(next()); continue; }
    if (arg === '--lcp-sample-size') { args.lcpSampleSize = Number(next()); continue; }
    if (arg === '--device') { args.device = next(); continue; }
    if (arg.startsWith('--dev-host=')) { args.devHost = arg.slice('--dev-host='.length); continue; }
    if (arg.startsWith('--evidence=')) { args.evidenceDir = arg.slice('--evidence='.length); continue; }
  }
  return args;
}

function pace(ms = PACE_MS) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parses a `Server-Timing` header into `{ [metricName]: { desc, dur } }` — no regex over the
 * metric name (05-09's own disclosed bug: a `[a-z]+` name-capture class silently dropped `r2`,
 * which contains a digit), just a plain split on `,` then `;`. */
function parseServerTiming(header) {
  const metrics = {};
  if (!header) return metrics;
  for (const part of header.split(',')) {
    const segments = part.split(';').map((s) => s.trim());
    const name = segments[0];
    if (!name) continue;
    const entry = {};
    for (const seg of segments.slice(1)) {
      const eq = seg.indexOf('=');
      if (eq === -1) continue;
      const key = seg.slice(0, eq).trim();
      const value = seg.slice(eq + 1).trim().replace(/^"|"$/g, '');
      if (key === 'desc') entry.desc = value;
      if (key === 'dur') entry.dur = Number(value);
    }
    metrics[name] = entry;
  }
  return metrics;
}

async function timedFetch(url) {
  const start = performance.now();
  const res = await fetch(url);
  const ttfbMs = performance.now() - start;
  const metrics = parseServerTiming(res.headers.get('server-timing'));
  return { res, ttfbMs, metrics };
}

/** Step 1: cold R2/KV latency over `n` distinct, never-before-requested archived article paths.
 * `skip` lets the caller avoid paths an earlier task in this same session may have already
 * touched (Tasks 1/2 each requested a handful of the deterministic front of the sample). */
async function measureR2Latency({ devHost, plan, n, skip = 10 }) {
  const picked = pickArchivedArticles(plan, n + skip, { marginDays: 2 }).slice(skip);
  const samples = [];
  for (const article of picked) {
    const { res, ttfbMs, metrics } = await timedFetch(`https://${devHost}${article.path}`);
    // The Worker streams the R2 object body directly (src/worker.ts's serveArchived()) without
    // setting Content-Length — confirmed live (HTTP/2, no content-length/transfer-encoding
    // header at all) — so object size comes from the LOCAL BUILD's own `dist/archive-plan.json`
    // `bytes` field (the real uploaded object's byte count, computed from the same file R2
    // serves) rather than a response header that was never going to be present.
    // `Number(null)` is `0`, not `NaN` — `res.headers.get()` returns `null` (never `undefined`)
    // for an absent header, so the header's presence must be checked explicitly before coercing,
    // or an absent Content-Length silently becomes a false "0 bytes" reading instead of falling
    // back to the plan's own `bytes` field.
    const contentLengthHeader = res.headers.get('content-length');
    const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
    samples.push({
      path: article.path,
      status: res.status,
      ttfbMs,
      archiveDesc: metrics.archive?.desc ?? null,
      r2DurMs: metrics.r2?.dur ?? null,
      kvDurMs: metrics.kv?.dur ?? null,
      bytes: Number.isFinite(contentLength) ? contentLength : article.bytes,
      bytesSource: Number.isFinite(contentLength) ? 'content-length' : 'plan',
      cfCacheStatus: res.headers.get('cf-cache-status'),
    });
    await pace();
  }
  return samples;
}

/** Step 2a: re-requests the SAME paths `measureR2Latency` just touched — well inside the 300s
 * edge-cache TTL, so these should be edge-cache hits (`archive;desc=edge-cache`), proving the
 * comparison is apples-to-apples against the exact URLs just measured cold. */
async function measureArchivedEdgeHitTtfb({ devHost, coldSamples, n }) {
  const paths = coldSamples.slice(0, n).map((s) => s.path);
  const samples = [];
  for (const p of paths) {
    const { res, ttfbMs, metrics } = await timedFetch(`https://${devHost}${p}`);
    samples.push({
      path: p,
      status: res.status,
      ttfbMs,
      archiveDesc: metrics.archive?.desc ?? null,
      cfCacheStatus: res.headers.get('cf-cache-status'),
    });
    await pace();
  }
  return samples;
}

/** Step 2b: hot (never-archived) static article TTFB — the static-asset layer, no Worker
 * invocation, no Server-Timing header at all. */
async function measureHotTtfb({ devHost, plan, n }) {
  const picked = pickHotArticles(plan, n);
  const samples = [];
  for (const article of picked) {
    const { res, ttfbMs } = await timedFetch(`https://${devHost}${article.path}`);
    samples.push({ path: article.path, status: res.status, ttfbMs, cfCacheStatus: res.headers.get('cf-cache-status') });
    await pace();
  }
  return samples;
}

/** Step 3: lab LCP in real Chromium with mobile emulation — a fresh context per page (no shared
 * cache/cookies across samples), no artificial throttling. */
async function measureLcp({ browser, deviceDescriptor, devHost, paths }) {
  const samples = [];
  for (const p of paths) {
    const context = await browser.newContext({ ...deviceDescriptor });
    const page = await context.newPage();
    try {
      await page.goto(`https://${devHost}${p}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(800); // let LCP settle past initial paint
      // `largest-contentful-paint` is a BUFFERED-ONLY entry type (web.dev's own LCP guidance):
      // `performance.getEntriesByType('largest-contentful-paint')` always returns empty —
      // confirmed live against this exact host during this tool's own development — the entries
      // are only ever delivered through a `PerformanceObserver({ buffered: true })` callback,
      // never through the general Performance Timeline buffer.
      const lcpMs = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let value = null;
            try {
              const po = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                if (entries.length) value = entries[entries.length - 1].startTime;
              });
              po.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch {
              resolve(null);
              return;
            }
            // LCP finalizes on first user input or page-hide; this is a lab measurement with no
            // interaction, so poll briefly then resolve with whatever's been observed so far.
            setTimeout(() => resolve(value), 200);
          })
      );
      samples.push({ path: p, lcpMs });
    } catch (err) {
      samples.push({ path: p, lcpMs: null, error: err instanceof Error ? err.message : String(err) });
    } finally {
      await context.close();
    }
  }
  return samples;
}

function writeEvidence(evidenceDir, name, data) {
  if (!evidenceDir) return;
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(resolve(evidenceDir, name), JSON.stringify(data, null, 2));
}

export async function run(args) {
  const plan = loadArchivePlan();

  // --- Step 1: cold R2/KV latency ---
  const r2SamplesRaw = await measureR2Latency({ devHost: args.devHost, plan, n: args.r2SampleSize });
  const r2Cold = r2SamplesRaw.filter((s) => s.status === 200 && s.archiveDesc === 'r2');
  const r2Durs = r2Cold.map((s) => s.r2DurMs).filter((v) => typeof v === 'number');
  const kvDurs = r2Cold.filter((s) => typeof s.kvDurMs === 'number').map((s) => s.kvDurMs);
  const r2SizesBytes = r2Cold.map((s) => s.bytes).filter((v) => Number.isFinite(v));
  const r2ColdTtfb = r2Cold.map((s) => s.ttfbMs);

  // --- Step 2: TTFB comparison ---
  const archivedEdgeHitSamples = await measureArchivedEdgeHitTtfb({
    devHost: args.devHost,
    coldSamples: r2SamplesRaw,
    n: args.edgeHitSampleSize,
  });
  const archivedEdgeHit = archivedEdgeHitSamples.filter((s) => s.status === 200 && s.archiveDesc === 'edge-cache');
  const hotSamples = await measureHotTtfb({ devHost: args.devHost, plan, n: args.hotSampleSize });
  const hotOk = hotSamples.filter((s) => s.status === 200);

  // --- Step 3: lab LCP ---
  const lcpArchivedPaths = pickArchivedArticles(plan, args.lcpSampleSize + 220, { marginDays: 2 }).slice(220).map((a) => a.path);
  const lcpHotPaths = pickHotArticles(plan, args.lcpSampleSize + 50).slice(50).map((a) => a.path);
  const deviceDescriptor = devices[args.device];
  if (!deviceDescriptor) {
    throw new Error(`measure-archive-latency: unknown Playwright device "${args.device}"`);
  }
  const browser = await chromium.launch();
  let lcpArchivedSamples;
  let lcpHotSamples;
  try {
    lcpArchivedSamples = await measureLcp({ browser, deviceDescriptor, devHost: args.devHost, paths: lcpArchivedPaths });
    lcpHotSamples = await measureLcp({ browser, deviceDescriptor, devHost: args.devHost, paths: lcpHotPaths });
  } finally {
    await browser.close();
  }
  const lcpArchivedMs = lcpArchivedSamples.map((s) => s.lcpMs).filter((v) => typeof v === 'number');
  const lcpHotMs = lcpHotSamples.map((s) => s.lcpMs).filter((v) => typeof v === 'number');

  const r2Stats = distributionStats(r2Durs);
  const kvStats = distributionStats(kvDurs);
  const archivedMissTtfbStats = distributionStats(r2ColdTtfb);
  const archivedHitTtfbStats = distributionStats(archivedEdgeHit.map((s) => s.ttfbMs));
  const hotTtfbStats = distributionStats(hotOk.map((s) => s.ttfbMs));
  const lcpArchivedStats = {
    sampleCount: lcpArchivedMs.length,
    p75: nearestRankLocal(lcpArchivedMs, 75),
    p95: nearestRankLocal(lcpArchivedMs, 95),
  };
  const lcpHotStats = {
    sampleCount: lcpHotMs.length,
    p75: nearestRankLocal(lcpHotMs, 75),
    p95: nearestRankLocal(lcpHotMs, 95),
  };

  const verdict =
    lcpArchivedStats.p95 !== null && lcpArchivedStats.p95 <= 1500
      ? 'R2_LATENCY_FITS_LCP'
      : 'R2_LATENCY_EXCEEDS_LCP';

  const result = {
    devHost: args.devHost,
    device: args.device,
    measuredAt: new Date().toISOString(),
    r2: {
      sampleCount: r2SamplesRaw.length,
      coldSampleCount: r2Cold.length,
      stats: r2Stats,
      sizeBytes: { median: nearestRankLocal(r2SizesBytes.slice().sort((a, b) => a - b), 50), p95: nearestRankLocal(r2SizesBytes.slice().sort((a, b) => a - b), 95) },
    },
    kv: { sampleCount: kvDurs.length, stats: kvStats },
    ttfb: {
      archivedColdMiss: { sampleCount: r2ColdTtfb.length, stats: archivedMissTtfbStats },
      archivedEdgeHit: { sampleCount: archivedEdgeHit.length, stats: archivedHitTtfbStats },
      hotStatic: { sampleCount: hotOk.length, stats: hotTtfbStats },
    },
    lcp: {
      archived: lcpArchivedStats,
      hot: lcpHotStats,
    },
    verdict,
  };

  writeEvidence(args.evidenceDir, 'r2-cold-samples.json', r2SamplesRaw);
  writeEvidence(args.evidenceDir, 'archived-edge-hit-samples.json', archivedEdgeHitSamples);
  writeEvidence(args.evidenceDir, 'hot-ttfb-samples.json', hotSamples);
  writeEvidence(args.evidenceDir, 'lcp-archived-samples.json', lcpArchivedSamples);
  writeEvidence(args.evidenceDir, 'lcp-hot-samples.json', lcpHotSamples);
  writeEvidence(args.evidenceDir, 'result.json', result);

  return result;
}

// Local nearest-rank over an UNSORTED array (sorts a copy) — tools/lib/percentile.mjs's own
// `nearestRank` requires pre-sorted input; this file needs p75 too (not exposed by
// `distributionStats`), so this thin local wrapper covers both p75 and p95 without duplicating
// the ranking formula itself.
function nearestRankLocal(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[idx];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await run(args);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[measure-archive-latency] device=${result.device} host=${result.devHost}`);
    console.log(
      `  R2 get()    n=${result.r2.coldSampleCount}/${result.r2.sampleCount}  p50=${result.r2.stats.p50}ms  p95=${result.r2.stats.p95}ms  max=${result.r2.stats.max}ms`
    );
    console.log(`  KV read     n=${result.kv.sampleCount}  p50=${result.kv.stats.p50}ms  p95=${result.kv.stats.p95}ms`);
    console.log(
      `  TTFB archived cache-miss  n=${result.ttfb.archivedColdMiss.sampleCount}  p50=${result.ttfb.archivedColdMiss.stats.p50}ms  p95=${result.ttfb.archivedColdMiss.stats.p95}ms`
    );
    console.log(
      `  TTFB archived edge-hit    n=${result.ttfb.archivedEdgeHit.sampleCount}  p50=${result.ttfb.archivedEdgeHit.stats.p50}ms  p95=${result.ttfb.archivedEdgeHit.stats.p95}ms`
    );
    console.log(
      `  TTFB hot static           n=${result.ttfb.hotStatic.sampleCount}  p50=${result.ttfb.hotStatic.stats.p50}ms  p95=${result.ttfb.hotStatic.stats.p95}ms`
    );
    console.log(`  LCP archived  n=${result.lcp.archived.sampleCount}  p75=${result.lcp.archived.p75}ms  p95=${result.lcp.archived.p95}ms`);
    console.log(`  LCP hot       n=${result.lcp.hot.sampleCount}  p75=${result.lcp.hot.p75}ms  p95=${result.lcp.hot.p95}ms`);
    console.log(`  Verdict: ${result.verdict}`);
  }

  if (result.r2.coldSampleCount < 200) {
    console.error(
      `[measure-archive-latency] only ${result.r2.coldSampleCount} genuinely cold R2 samples (need >= 200) — exiting non-zero`
    );
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

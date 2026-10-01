#!/usr/bin/env node
// 05-06 Task 1: REND-11 / D-13 file-count gate. Counts every regular file under `dist/client`
// (a conservative superset of what Wrangler actually uploads — it never skips `.assetsignore`
// entries the way Wrangler does, so this gate can over-count by a handful of config files but
// must never under-count) and fails the build once the count reaches 80,000, with a warning
// starting at 70,000, against the platform's real 100,000-file ceiling
// (docs/changelog/2025-09-02-increased-static-asset-limits, PROJECT.md Constraints).
//
// Writes `dist/client/static-budget.json` — published on the deployed site at
// `/static-budget.json` — so the current count against the ceiling is visible without a build
// log, same "measure it or it drifts" discipline PROJECT.md's own Context section names as the
// root cause of the v1 D1-reads incident. Every thrown message is prefixed
// `assert-file-count:` (the tools/assert-no-d1.mjs / tools/ci-build.mjs convention).
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadHotWindow } from '../src/lib/archive/hot-window.ts';

export const FILE_COUNT_FAIL_THRESHOLD = 80_000; // D-13, roadmap criterion 4
export const FILE_COUNT_WARN_THRESHOLD = 70_000;
export const STATIC_ASSET_CEILING = 100_000;
export const STATIC_BUDGET_FILE = 'static-budget.json';
const DIST_CLIENT_DIR = 'dist/client';

function fail(message) {
  throw new Error(`assert-file-count: ${message}`);
}

/** Recursively counts every regular file under `dir` — directories themselves are never counted,
 * dotfiles ARE counted (a conservative superset, never a filter that could under-count). Missing
 * `dir` counts as zero (the caller's own zero-count check will then fail loud). */
export function countStaticFiles(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      count += countStaticFiles(full);
    } else if (info.isFile()) {
      count += 1;
    }
  }
  return count;
}

/** @typedef {'ok'|'warn'|'fail'} FileCountStatus */

/**
 * Pure threshold evaluation (no I/O): `count < 0` throws (programmer error, never a real build
 * input); `count === 0` is `fail` with the broken-check reason (a zero count must never pass —
 * same fail-loud discipline as tools/assert-no-d1.mjs's zero-candidate guard); `count` at or
 * above `FILE_COUNT_FAIL_THRESHOLD` is `fail`; at or above `FILE_COUNT_WARN_THRESHOLD` is `warn`;
 * otherwise `ok`.
 */
export function evaluateFileCount(count) {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    fail(`invalid count: ${JSON.stringify(count)}`);
  }
  if (count === 0) {
    return { status: 'fail', reason: 'zero files counted — broken check' };
  }
  if (count >= FILE_COUNT_FAIL_THRESHOLD) {
    return { status: 'fail', reason: `count ${count} >= fail threshold ${FILE_COUNT_FAIL_THRESHOLD}` };
  }
  if (count >= FILE_COUNT_WARN_THRESHOLD) {
    return { status: 'warn', reason: `count ${count} >= warn threshold ${FILE_COUNT_WARN_THRESHOLD}` };
  }
  return { status: 'ok', reason: null };
}

/**
 * Counts `dist/client`, writes `dist/client/static-budget.json`, recounts and throws if the
 * recount differs from the written count (a mismatch means something wrote to `dist/client`
 * between the count and the write — a broken build step, not a value to silently trust), and
 * returns `{ count, evaluation, budget }`. `archivedPages`/`hotWindowDescription` are passed
 * through from the caller (the partition plan / hot window this build already computed) so
 * `static-budget.json` records the hot window in force without re-deriving it.
 *
 * 05-08 fix: this gate now runs TWICE in a real production build — once as part of `pnpm run
 * build`, and again in `tools/ci-build.mjs`'s deploy step, on the FINAL `dist/client` (after
 * `archive-sync.mjs pre` may have moved pages back into it), immediately before `wrangler
 * deploy` (D-13/REND-11). On that second run, `static-budget.json` from the FIRST run is already
 * sitting in `dist/client` — writing the fresh copy OVERWRITES an existing file, so the total
 * file count does not change. Only the very first write in a build adds a brand-new file. Found
 * live (2026-10-01): a real second run against a real 60,397-page build threw
 * `post-write recount (29937) does not equal the published staticFileCount (29938)` every single
 * time, because the original code unconditionally assumed `static-budget.json` never exists yet.
 */
export function assertFileCount({
  root = process.cwd(),
  distClientDir = DIST_CLIENT_DIR,
  archivedPages = null,
  hotWindow = null,
  // Test-only seam: runs after the budget file is written but before the recount, so a test can
  // deterministically simulate a concurrent write to dist/client and prove the mismatch throws
  // (never used by the CLI/build path).
  afterWriteForTest = null,
} = {}) {
  const distAbs = resolve(root, distClientDir);
  const budgetAbs = resolve(distAbs, STATIC_BUDGET_FILE);
  const budgetAlreadyExisted = existsSync(budgetAbs);
  const preWriteCount = countStaticFiles(distAbs);
  // `staticFileCount` includes static-budget.json itself (the must-have's own wording). If the
  // file doesn't exist yet, this write adds a new file: `preWriteCount + 1`. If it already exists
  // (a second run in the same build), this write overwrites it in place: the true count is just
  // `preWriteCount` (already counted it once).
  const count = budgetAlreadyExisted ? preWriteCount : preWriteCount + 1;
  const evaluation = evaluateFileCount(count);

  const budget = {
    staticFileCount: count,
    ceiling: STATIC_ASSET_CEILING,
    failAt: FILE_COUNT_FAIL_THRESHOLD,
    warnAt: FILE_COUNT_WARN_THRESHOLD,
    status: evaluation.status,
    archivedPages,
    hotWindow,
  };

  writeFileSync(budgetAbs, JSON.stringify(budget));

  if (typeof afterWriteForTest === 'function') afterWriteForTest(distAbs);

  // Recount AFTER writing and assert it equals the published `staticFileCount` exactly — proving
  // nothing else wrote to or removed from dist/client between the count and the write, and that
  // the published figure matches `find dist/client -type f | wc -l` to the file.
  const recount = countStaticFiles(distAbs);
  if (recount !== count) {
    fail(
      `post-write recount (${recount}) does not equal the published staticFileCount (${count}) — ` +
        'dist/client changed during the file-count gate'
    );
  }

  return { count, evaluation, budget };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  let archivedPages = null;
  const planPath = resolve(process.cwd(), 'dist/archive-plan.json');
  if (existsSync(planPath)) {
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8'));
      archivedPages = {
        articles: plan.counts?.archivedArticles ?? 0,
        tags: plan.counts?.archivedTags ?? 0,
      };
    } catch {
      // A malformed plan here is not this gate's concern — it just means no archive-count detail
      // is published; the count itself is still measured from dist/client directly.
      archivedPages = null;
    }
  }

  let hotWindow = null;
  try {
    hotWindow = loadHotWindow();
  } catch {
    hotWindow = null;
  }

  const { count, evaluation } = assertFileCount({ archivedPages, hotWindow });

  if (jsonMode) {
    console.log(JSON.stringify({ count, ceiling: STATIC_ASSET_CEILING, failAt: FILE_COUNT_FAIL_THRESHOLD, status: evaluation.status }));
  }

  console.log(`[archive] static files: ${count} / ${STATIC_ASSET_CEILING} (fail at ${FILE_COUNT_FAIL_THRESHOLD})`);

  if (evaluation.status === 'warn') {
    console.warn(`[archive] WARN: ${evaluation.reason}`);
  }
  if (evaluation.status === 'fail') {
    console.error(`[assert-file-count] FAIL: ${evaluation.reason}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

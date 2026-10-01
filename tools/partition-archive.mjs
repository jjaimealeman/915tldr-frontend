#!/usr/bin/env node
// 05-06 Task 1: post-build partition of archive-tier pages out of the static output (REND-07's
// render-once half, REND-09's tag-tier precision). `astro build` renders every public article and
// tag page the same way (hot or archive — the templates don't know the difference); this script
// moves the archive-tier subset of THAT SAME OUTPUT from `dist/client` into `dist/archive`, byte
// for byte, so the deployed static-asset set only ever holds hot pages. `dist/archive-plan.json`
// is the contract 05-07 (R2 upload) reads to know what moved and where it came from.
//
// Classification reuses 05-01's `classifyArticles`/`classifyTags` (src/lib/archive/tiering.ts)
// against the SAME build-time tier facts (src/lib/archive/tier-facts.ts) the routes already wrote
// — no second D1 read, no re-derivation of the hot window's own cutoff math. Every thrown message
// is prefixed `partition-archive:` (the convention tools/assert-no-d1.mjs/tools/ci-build.mjs's
// classifyFailure anchors on).
//
// Path safety (T-05-22): every source and destination path is resolved with `path.resolve` and
// asserted to stay under `dist/client` or `dist/archive` before any filesystem mutation — a
// malformed or tampered fact (a path escaping its directory) must throw, never silently move a
// file outside the two directories this script owns.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import {
  readTierFacts,
  ARTICLE_FACTS_PATH,
  TAG_FACTS_PATH,
} from '../src/lib/archive/tier-facts.ts';
import { loadHotWindow, describeHotWindow } from '../src/lib/archive/hot-window.ts';
import { hotCutoffEpoch, classifyArticles, classifyTags } from '../src/lib/archive/tiering.ts';

export const ARCHIVE_DIR = 'dist/archive';
export const PARTITION_PLAN_PATH = 'dist/archive-plan.json';
const DIST_CLIENT_DIR = 'dist/client';

function fail(message) {
  throw new Error(`partition-archive: ${message}`);
}

/** Resolves `relPath` under `root` and asserts the result stays inside `boundaryDir` (also
 * resolved under `root`) — rejects any path that traverses outside its owning directory
 * (T-05-22), whether via a malicious `..` segment or a malformed fact. */
function resolveWithinBoundary(root, relPath, boundaryDir, label) {
  const boundaryAbs = resolve(root, boundaryDir);
  const resolved = resolve(root, relPath);
  if (resolved !== boundaryAbs && !resolved.startsWith(`${boundaryAbs}/`)) {
    fail(`${label} path escapes ${boundaryDir}: ${relPath}`);
  }
  return resolved;
}

/** Deletes the two tier-facts files, `dist/archive` and the plan — missing is fine (no-op). Run
 * before `astro build` so a stale prior build's facts/archive can never leak into this build's
 * partition decision (the "stale inputs cannot drive a partition" must-have). */
export function cleanPartitionInputs(root = process.cwd()) {
  for (const relPath of [ARTICLE_FACTS_PATH, TAG_FACTS_PATH, PARTITION_PLAN_PATH]) {
    const abs = resolve(root, relPath);
    if (existsSync(abs)) rmSync(abs, { force: true });
  }
  const archiveAbs = resolve(root, ARCHIVE_DIR);
  if (existsSync(archiveAbs)) rmSync(archiveAbs, { recursive: true, force: true });
}

/**
 * @typedef {{ kind: 'article'|'tag', key: string, path: string, sourceRel: string }} PlanEntry
 */

/** Builds the partition plan from already-read facts and the hot window — pure, no filesystem
 * I/O beyond what the caller already did. `nowEpoch` is epoch seconds (matches
 * `hotCutoffEpoch`'s own contract); defaults to the real clock. */
export function planPartition({ articleFacts, tagFacts, hotWindow, nowEpoch = Math.floor(Date.now() / 1000) }) {
  if (!Array.isArray(articleFacts)) fail('articleFacts must be an array');
  if (!Array.isArray(tagFacts)) fail('tagFacts must be an array');
  if (!hotWindow || typeof hotWindow.days !== 'number') fail('hotWindow with a numeric days field is required');

  const cutoffEpoch = hotCutoffEpoch(nowEpoch, hotWindow.days);
  const articleSplit = classifyArticles(articleFacts, cutoffEpoch);
  const tagSplit = classifyTags(tagFacts);

  /** @type {PlanEntry[]} */
  const entries = [];
  for (const fact of articleSplit.archive) {
    entries.push({
      kind: 'article',
      key: `articles/${fact.uuid}.html`,
      path: fact.path,
      sourceRel: `${DIST_CLIENT_DIR}${fact.path}.html`,
    });
  }
  for (const fact of tagSplit.archive) {
    entries.push({
      kind: 'tag',
      key: `tags/${fact.slug}.html`,
      path: `/tag/${fact.slug}`,
      sourceRel: `${DIST_CLIENT_DIR}/tag/${fact.slug}.html`,
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    hotWindow,
    cutoffEpoch,
    counts: {
      hotArticles: articleSplit.hot.length,
      archivedArticles: articleSplit.archive.length,
      hotTags: tagSplit.hot.length,
      archivedTags: tagSplit.archive.length,
    },
    entries,
  };
}

/** Moves every archive entry's source file into `dist/archive/<key>`, computing sha256/bytes from
 * the actual moved file, then writes the plan JSON (with sha256/bytes added to each entry) to
 * `dist/archive-plan.json`. Throws `partition-archive:` when a planned source file is missing or
 * when any resolved path escapes `dist/client`/`dist/archive` (T-05-22). */
export function applyPartition(plan, { root = process.cwd() } = {}) {
  if (!plan || !Array.isArray(plan.entries)) fail('plan.entries must be an array');

  const finalizedEntries = plan.entries.map((entry) => {
    const sourceAbs = resolveWithinBoundary(root, entry.sourceRel, DIST_CLIENT_DIR, 'source');
    const destRel = join(ARCHIVE_DIR, entry.key);
    const destAbs = resolveWithinBoundary(root, destRel, ARCHIVE_DIR, 'destination');

    if (!existsSync(sourceAbs) || !statSync(sourceAbs).isFile()) {
      fail(`planned source file is missing: ${entry.sourceRel} (kind=${entry.kind}, key=${entry.key})`);
    }

    mkdirSync(dirname(destAbs), { recursive: true });
    renameSync(sourceAbs, destAbs);

    const bytes = readFileSync(destAbs);
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    return { ...entry, sha256, bytes: bytes.length };
  });

  const finalizedPlan = { ...plan, entries: finalizedEntries };
  const planAbs = resolve(root, PARTITION_PLAN_PATH);
  writeFileSync(planAbs, JSON.stringify(finalizedPlan));
  return finalizedPlan;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--clean')) {
    cleanPartitionInputs();
    console.log('[archive] partition: clean — removed stale tier facts, dist/archive and the plan');
    return;
  }

  let articleFacts;
  let tagFacts;
  try {
    const facts = readTierFacts();
    articleFacts = facts.articles;
    tagFacts = facts.tags;
  } catch (err) {
    fail(`could not read tier facts — ${err instanceof Error ? err.message : String(err)}`);
  }

  const hotWindow = loadHotWindow();
  const plan = planPartition({ articleFacts, tagFacts, hotWindow });
  const finalizedPlan = applyPartition(plan);

  console.log(
    `[archive] partition: ${finalizedPlan.counts.archivedArticles} articles and ` +
      `${finalizedPlan.counts.archivedTags} tags archived; ${finalizedPlan.counts.hotArticles} ` +
      `articles and ${finalizedPlan.counts.hotTags} tags static`
  );
  console.log(describeHotWindow(hotWindow));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

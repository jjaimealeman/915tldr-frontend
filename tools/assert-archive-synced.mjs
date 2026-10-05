#!/usr/bin/env node
// CR-02 (05-20): the deploy-time guard that makes a partitioned `dist/` undeployable unless
// `archive-sync pre` has confirmed THIS exact build. `pnpm run build` always partitions
// archive-tier pages out of `dist/client` (`tools/partition-archive.mjs`); only pre (inside
// `tools/ci-build.mjs`'s deploy step) uploads them to R2 or moves them back. Without this guard,
// the documented `pnpm run deploy` (previously a bare `wrangler deploy`) could ship a partitioned
// `dist/` that pre never touched — every newly archived page then serves neither static nor R2, a
// 404 (05-REVIEW.md CR-02).
//
// The marker is keyed to the plan's own `generatedAt` (`tools/partition-archive.mjs`'s
// `planPartition`) rather than a boolean — a marker written for an OLDER partition must never
// vouch for a NEWER one (T-05-67, spoofing/staleness). Every thrown message is prefixed
// `assert-archive-synced:` (this project's own `<module>: <message>` convention,
// `tools/assert-file-count.mjs`'s own pattern).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { ARCHIVE_DIR, PARTITION_PLAN_PATH } from './partition-archive.mjs';
import { ARCHIVE_SYNCED_MARKER_PATH } from './archive-sync.mjs';

function fail(message) {
  throw new Error(`assert-archive-synced: ${message}`);
}

/** Recursively lists every regular file under `dir`, relative to `baseDir` — mirrors
 * `tools/assert-file-count.mjs`'s own `countStaticFiles`, duplicated at this small scope (this
 * module has no other dependency on that file) rather than imported. Missing `dir` is `[]`. */
function listFilesUnder(dir, baseDir = dir) {
  if (!existsSync(dir)) return [];
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      files = files.concat(listFilesUnder(full, baseDir));
    } else if (info.isFile()) {
      files.push(relative(baseDir, full));
    }
  }
  return files;
}

/** Reads and parses JSON at `abs` defensively: `{ present: false }` if the file doesn't exist,
 * `{ present: true, value: undefined }` if it exists but doesn't parse (treated as a refusal by
 * every caller below — an unparseable plan/marker must never be trusted as "synced"), otherwise
 * `{ present: true, value: <parsed> }`. */
function readJsonDefensively(abs) {
  if (!existsSync(abs)) return { present: false, value: null };
  try {
    return { present: true, value: JSON.parse(readFileSync(abs, 'utf8')) };
  } catch {
    return { present: true, value: undefined };
  }
}

/**
 * Five cases (05-20-PLAN.md Task 1's own must-have):
 *  1. No plan, `dist/archive` empty or absent -> `{ ok: true }` (nothing was partitioned this
 *     build at all).
 *  2. No plan but a file exists under `dist/archive` -> refuse, naming the stray file(s) — the
 *     one state where the ABSENCE of a plan is itself suspicious (a plan was deleted/never
 *     written, but partitioned output is still sitting there).
 *  3. Plan present, marker missing -> refuse ("archive-sync pre has not run").
 *  4. Marker's `planGeneratedAt` doesn't match the plan's `generatedAt` -> refuse ("stale").
 *  5. Matching marker -> `{ ok: true }`.
 */
export function assertArchiveSynced({ root = process.cwd() } = {}) {
  const planAbs = resolve(root, PARTITION_PLAN_PATH);
  const archiveAbs = resolve(root, ARCHIVE_DIR);
  const markerAbs = resolve(root, ARCHIVE_SYNCED_MARKER_PATH);

  const { present: planPresent, value: planValueRaw } = readJsonDefensively(planAbs);

  if (!planPresent) {
    const strayFiles = listFilesUnder(archiveAbs);
    if (strayFiles.length > 0) {
      const sample = strayFiles.slice(0, 5).join(', ');
      fail(
        `${PARTITION_PLAN_PATH} is missing but ${strayFiles.length} file(s) exist under ${ARCHIVE_DIR} ` +
          `(e.g. ${sample}) — dist/ looks partitioned with no plan to explain it; run \`pnpm run build\` again`
      );
    }
    return { ok: true, reason: 'no plan and no archive files — nothing was partitioned this build' };
  }

  if (planValueRaw === undefined) {
    fail(`${PARTITION_PLAN_PATH} is not valid JSON — cannot confirm this build was synced`);
  }

  const generatedAt = planValueRaw?.generatedAt ?? null;

  const { present: markerPresent, value: markerValueRaw } = readJsonDefensively(markerAbs);
  if (!markerPresent) {
    fail(
      'dist/ was partitioned but archive-sync pre has not run for this build — deploy with ' +
        '`pnpm run deploy` (tools/ci-build.mjs deploy), never a bare wrangler deploy'
    );
  }
  if (markerValueRaw === undefined) {
    fail(`${ARCHIVE_SYNCED_MARKER_PATH} is not valid JSON — treating this build as unsynced (stale)`);
  }

  const markerGeneratedAt = markerValueRaw?.planGeneratedAt ?? null;
  if (markerGeneratedAt !== generatedAt) {
    fail(
      `${ARCHIVE_SYNCED_MARKER_PATH} is stale — it vouches for plan generatedAt ${JSON.stringify(markerGeneratedAt)}, ` +
        `this build's plan is ${JSON.stringify(generatedAt)}; deploy with \`pnpm run deploy\` again after a fresh build`
    );
  }

  return { ok: true, reason: `archive-sync pre confirmed this build (generatedAt ${JSON.stringify(generatedAt)})` };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  try {
    const { reason } = assertArchiveSynced({});
    console.log(`[assert-archive-synced] ok: ${reason}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

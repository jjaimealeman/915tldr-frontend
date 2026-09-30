#!/usr/bin/env node
// 04-09 Task 3 (D-06 / RESEARCH Open Question 2): snapshot + diff `dist/client` file hashes
// between two builds. This is the tool the local incremental-build spike uses to measure two
// claims, not assume them: (1) with `experimental.incrementalBuild` OFF, an article the loader
// did not report as `changed=` (or a rail neighbour of one) is byte-identical build over build —
// extending 04-04's whole-corpus proof to THIS build's own delta, not re-measuring the full
// corpus every time; (2) with the flag ON, output is identical to the flag OFF — the flag must
// only skip re-rendering, never change WHAT gets rendered.
//
// `snapshot <name>` writes `{ <relative-path>: sha256 }` for every file under `dist/client` to
// `.astro/snapshots/<name>.json` (gitignored build-scratch, like this project's other
// `.astro/*.json` build-time artifacts). `diff <a> <b>` compares two named snapshots.

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isKnownCategory } from '../src/lib/categories.ts';

const DEFAULT_DIST_CLIENT = 'dist/client';
const DEFAULT_SNAPSHOT_DIR = '.astro/snapshots';
const MAX_LISTED_CHANGED_ARTICLES = 20;

async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

async function hashFile(filePath) {
  const buf = await readFile(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Writes `.astro/snapshots/<name>.json`: `{ <relative path under dist/client>: sha256 }` for
 * every file in the build output. Returns `{ path, count }` for the caller to log.
 */
export async function snapshot(name, distDir = DEFAULT_DIST_CLIENT, snapshotDir = DEFAULT_SNAPSHOT_DIR) {
  const files = await walk(distDir);
  const map = {};
  for (const relPath of files.sort()) {
    // eslint-disable-next-line no-await-in-loop
    map[relPath] = await hashFile(path.join(distDir, relPath));
  }
  await mkdir(snapshotDir, { recursive: true });
  const outPath = path.join(snapshotDir, `${name}.json`);
  await writeFile(outPath, JSON.stringify(map, null, 2));
  return { path: outPath, count: files.length };
}

/**
 * An "article file" for this diff's purposes: `dist/client/<known-category-slug>/<file>.html` —
 * one path segment under a REAL category directory (not `tag/*.html`, `source/*.html`, or a
 * top-level category LISTING page like `crime.html`, which lives at depth 0, not depth 1).
 */
function isArticleFile(relPath) {
  const parts = relPath.split(path.sep);
  return parts.length === 2 && isKnownCategory(parts[0]) && parts[1].endsWith('.html');
}

/**
 * Compares two named snapshots. Returns overall identical/changed/added/removed counts, the
 * same breakdown restricted to article files, and up to `MAX_LISTED_CHANGED_ARTICLES` changed
 * article paths for a human (or this task's own build-measurements.md) to inspect.
 */
export async function diff(nameA, nameB, snapshotDir = DEFAULT_SNAPSHOT_DIR) {
  const a = JSON.parse(await readFile(path.join(snapshotDir, `${nameA}.json`), 'utf8'));
  const b = JSON.parse(await readFile(path.join(snapshotDir, `${nameB}.json`), 'utf8'));

  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));

  let identical = 0;
  let changed = 0;
  let articleIdentical = 0;
  let articleChanged = 0;
  const changedArticlePaths = [];

  for (const key of aKeys) {
    if (!bKeys.has(key)) continue; // counted under `removed` below
    const isArticle = isArticleFile(key);
    if (a[key] === b[key]) {
      identical += 1;
      if (isArticle) articleIdentical += 1;
    } else {
      changed += 1;
      if (isArticle) {
        articleChanged += 1;
        changedArticlePaths.push(key);
      }
    }
  }

  const added = [...bKeys].filter((k) => !aKeys.has(k));
  const removed = [...aKeys].filter((k) => !bKeys.has(k));

  return {
    identical,
    changed,
    added: added.length,
    removed: removed.length,
    addedPaths: added,
    removedPaths: removed,
    article: {
      identical: articleIdentical,
      changed: articleChanged,
      changedPaths: changedArticlePaths.slice(0, MAX_LISTED_CHANGED_ARTICLES),
      changedPathsTruncated: changedArticlePaths.length > MAX_LISTED_CHANGED_ARTICLES,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const [, , cmd, ...args] = process.argv;

  if (cmd === 'snapshot') {
    const [name] = args;
    if (!name) {
      console.error('Usage: node tools/compare-builds.mjs snapshot <name>');
      process.exitCode = 1;
      return;
    }
    const result = await snapshot(name);
    console.log(`snapshot ${name}: ${result.count} files -> ${result.path}`);
    return;
  }

  if (cmd === 'diff') {
    const [a, b] = args;
    if (!a || !b) {
      console.error('Usage: node tools/compare-builds.mjs diff <a> <b>');
      process.exitCode = 1;
      return;
    }
    const result = await diff(a, b);
    console.log(`diff ${a} ${b}:`);
    console.log(
      `  overall: identical=${result.identical} changed=${result.changed} added=${result.added} removed=${result.removed}`
    );
    console.log(`  articles: identical=${result.article.identical} changed=${result.article.changed}`);
    if (result.article.changedPaths.length > 0) {
      console.log('  changed article paths' + (result.article.changedPathsTruncated ? ' (first 20)' : '') + ':');
      for (const p of result.article.changedPaths) console.log(`    ${p}`);
    }
    return;
  }

  console.error('Usage: node tools/compare-builds.mjs <snapshot|diff> ...');
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

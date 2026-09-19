#!/usr/bin/env node
// PERF-07 provenance: downloads the six upstream font/licence files this
// phase subsets, from pinned google/fonts commits, and verifies each one's
// git blob SHA-1 before it is ever handed to a font parser. Output lands in
// the gitignored design/fonts-src/ (raw upstream files never ship).

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAW_BASE = 'https://raw.githubusercontent.com/google/fonts';
const OUT_DIR = path.resolve('design/fonts-src');

// Each entry: upstream commit, repo-relative path, output filename (brackets
// and the comma percent-encoded so the file is a normal filename on disk),
// expected git blob SHA-1, expected byte length (omitted for the two OFL
// licence texts, which this list still verifies by hash alone).
export const FILES = [
  {
    commit: '0b58fb370093f9a9f4ff785d94405710b79de67c',
    repoPath: 'ofl/instrumentserif/InstrumentSerif-Regular.ttf',
    outName: 'InstrumentSerif-Regular.ttf',
    sha1: '36fac00ef9b7d523236df6536cb09c712bb2c7e4',
    bytes: 70012,
  },
  {
    commit: '0b58fb370093f9a9f4ff785d94405710b79de67c',
    repoPath: 'ofl/instrumentserif/InstrumentSerif-Italic.ttf',
    outName: 'InstrumentSerif-Italic.ttf',
    sha1: '192c3eda9864241ad280e9bcc84e258c80a4a588',
    bytes: 71592,
  },
  {
    commit: '0b58fb370093f9a9f4ff785d94405710b79de67c',
    repoPath: 'ofl/instrumentserif/OFL.txt',
    outName: 'OFL-InstrumentSerif.txt',
    sha1: '669ce7917bec662fcf7244d37f49c4277f6fbd73',
    bytes: null,
  },
  {
    commit: '08dc85da6bca7ae308a6f1d38d0b137465646071',
    repoPath: 'ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf',
    outName: 'SourceSerif4%5Bopsz%2Cwght%5D.ttf',
    sha1: '40bbb58cb58e893ad0470f0bb291e096c73d3554',
    bytes: 1209508,
  },
  {
    commit: '08dc85da6bca7ae308a6f1d38d0b137465646071',
    repoPath: 'ofl/sourceserif4/SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf',
    outName: 'SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf',
    sha1: 'ccb969aa6847e1169ff9c8c8bdc28daff6966861',
    bytes: 855432,
  },
  {
    commit: '08dc85da6bca7ae308a6f1d38d0b137465646071',
    repoPath: 'ofl/sourceserif4/OFL.txt',
    outName: 'OFL-SourceSerif4.txt',
    sha1: '318074ec9d43c936a56ee1dae92999f4df073ce8',
    bytes: null,
  },
];

function gitBlobSha1(bytes) {
  const hash = createHash('sha1');
  hash.update(`blob ${bytes.length}\0`);
  hash.update(bytes);
  return hash.digest('hex');
}

async function fetchFile(entry) {
  const url = `${RAW_BASE}/${entry.commit}/${entry.repoPath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch-fonts: ${url} returned HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  if (entry.bytes !== null && bytes.length !== entry.bytes) {
    throw new Error(
      `fetch-fonts: ${entry.outName} is ${bytes.length} bytes, expected ${entry.bytes}`
    );
  }

  const actualSha1 = gitBlobSha1(bytes);
  if (actualSha1 !== entry.sha1) {
    throw new Error(
      `fetch-fonts: ${entry.outName} git blob SHA-1 mismatch — expected ${entry.sha1}, got ${actualSha1}`
    );
  }

  return bytes;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const entry of FILES) {
    const bytes = await fetchFile(entry);
    writeFileSync(path.join(OUT_DIR, entry.outName), bytes);
    console.log(`fetch-fonts: verified and wrote ${entry.outName} (${bytes.length} bytes)`);
  }

  console.log(`fetch-fonts: all ${FILES.length} files verified against pinned commits.`);
}

// Guarded so build-fonts.mjs can `import { FILES } from './fetch-fonts.mjs'`
// (to reuse the same commit/sha1 constants in subset-manifest.json) without
// triggering a network fetch as an import side effect.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}

#!/usr/bin/env node
// Probes whether Playwright's WebKit build can launch natively on this
// machine. If native launch fails, falls back to the pinned Playwright
// Docker image (mcr.microsoft.com/playwright:v1.63.0-noble) and records
// which mode succeeded in design/.webkit-mode.json.
//
// Usage:
//   node design/scripts/probe-webkit.mjs                 # probe + fallback
//   node design/scripts/probe-webkit.mjs --inside-docker  # probe only, JSON to stdout

import { webkit } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const INSIDE_DOCKER = process.argv.includes('--inside-docker');
const DOCKER_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';

async function tryNativeLaunch() {
  let browser;
  try {
    browser = await webkit.launch();
    const version = browser.version();
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.close();
    return { ok: true, version, error: null };
  } catch (err) {
    return { ok: false, version: null, error: String(err?.message ?? err).split('\n')[0] };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

if (INSIDE_DOCKER) {
  const result = await tryNativeLaunch();
  process.stdout.write(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

const nativeResult = await tryNativeLaunch();

if (nativeResult.ok) {
  const record = {
    mode: 'native',
    image: null,
    imageDigest: null,
    webkitVersion: nativeResult.version,
    nativeError: null,
    probedAt: new Date().toISOString(),
  };
  await writeFile(
    path.resolve('design/.webkit-mode.json'),
    JSON.stringify(record, null, 2) + '\n',
    'utf8'
  );
  console.log(`WebKit launched natively: ${nativeResult.version}`);
  process.exit(0);
}

console.log(`Native WebKit launch failed: ${nativeResult.error}`);
console.log('Falling back to Docker...');

const repoRootResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
});
const repoRoot = repoRootResult.stdout.trim();
const uid = process.getuid();
const gid = process.getgid();

const dockerRun = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    '--network',
    'none',
    '--user',
    `${uid}:${gid}`,
    '-e',
    'HOME=/tmp',
    '-v',
    `${repoRoot}:/work`,
    '-w',
    '/work',
    DOCKER_IMAGE,
    'node',
    'design/scripts/probe-webkit.mjs',
    '--inside-docker',
  ],
  { encoding: 'utf8' }
);

if (dockerRun.error) {
  console.error(`Docker invocation failed: ${dockerRun.error.message}`);
  process.exit(1);
}

let dockerResult;
try {
  // stdout may contain npm/docker noise ahead of the JSON line; find the
  // last line that parses as JSON.
  const lines = dockerRun.stdout.trim().split('\n');
  let parsed = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      parsed = JSON.parse(lines[i]);
      break;
    } catch {
      continue;
    }
  }
  if (!parsed) throw new Error('no JSON line found in docker stdout');
  dockerResult = parsed;
} catch (err) {
  console.error(`Could not parse docker probe output: ${err.message}`);
  console.error('--- docker stdout ---');
  console.error(dockerRun.stdout);
  console.error('--- docker stderr ---');
  console.error(dockerRun.stderr);
  process.exit(1);
}

if (!dockerResult.ok) {
  console.error(`WebKit failed to launch in Docker too: ${dockerResult.error}`);
  process.exit(1);
}

const inspectResult = spawnSync(
  'docker',
  ['image', 'inspect', '--format', '{{index .RepoDigests 0}}', DOCKER_IMAGE],
  { encoding: 'utf8' }
);
const imageDigest = inspectResult.status === 0 ? inspectResult.stdout.trim() : null;

const record = {
  mode: 'docker',
  image: DOCKER_IMAGE,
  imageDigest,
  webkitVersion: dockerResult.version,
  nativeError: nativeResult.error,
  probedAt: new Date().toISOString(),
};
await writeFile(
  path.resolve('design/.webkit-mode.json'),
  JSON.stringify(record, null, 2) + '\n',
  'utf8'
);
console.log(`WebKit launched in Docker: ${dockerResult.version}`);
process.exit(0);

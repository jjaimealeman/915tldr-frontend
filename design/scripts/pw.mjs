#!/usr/bin/env node
// Engine-aware Playwright test launcher.
//
// Usage:
//   node design/scripts/pw.mjs --project=chromium [...extra playwright test args]
//   node design/scripts/pw.mjs --project=webkit   [...extra playwright test args]
//   node design/scripts/pw.mjs --project=all       [...extra playwright test args]
//
// chromium always runs natively. webkit reads design/.webkit-mode.json
// (written by `pnpm run probe:webkit`) to decide whether to run natively or
// inside the pinned Playwright Docker image.
//
// Every launch below (host Chromium, host WebKit, and Docker WebKit) calls
// `node` directly on the locally installed node_modules/@playwright/test/cli.js
// rather than going through a package runner (npx/pnpm exec/etc). A package
// runner can silently download a package from the registry when the local
// binary is missing; `node <path>` on a local file cannot reach the network
// at all — it either finds the file or fails loudly. That is the point of
// this indirection (T-01-35).

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DOCKER_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';
const WEBKIT_MODE_FILE = path.resolve('design/.webkit-mode.json');
const PLAYWRIGHT_CLI = 'node_modules/@playwright/test/cli.js';
const PLAYWRIGHT_CLI_ABS = path.resolve(PLAYWRIGHT_CLI);

function requirePlaywrightCli() {
  if (!existsSync(PLAYWRIGHT_CLI_ABS)) {
    console.error(
      `Playwright CLI not found at ${PLAYWRIGHT_CLI} — run pnpm install (owner)`
    );
    process.exit(2);
  }
}

function parseProjectArg(argv) {
  const projectArgIndex = argv.findIndex((a) => a.startsWith('--project='));
  if (projectArgIndex === -1) {
    console.error('Usage: node design/scripts/pw.mjs --project=chromium|webkit|all [...args]');
    process.exit(2);
  }
  const project = argv[projectArgIndex].split('=')[1];
  const rest = [...argv.slice(0, projectArgIndex), ...argv.slice(projectArgIndex + 1)];
  return { project, rest };
}

function runChromium(extraArgs) {
  requirePlaywrightCli();
  const jsonOut = process.env.PW_JSON_OUT ?? 'design/.cache/pw-report-chromium.json';
  const result = spawnSync(
    'node',
    [PLAYWRIGHT_CLI_ABS, 'test', '--project=chromium', ...extraArgs],
    { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut } }
  );
  return result.status ?? 1;
}

function runWebkit(extraArgs) {
  if (!existsSync(WEBKIT_MODE_FILE)) {
    console.error('design/.webkit-mode.json not found — run pnpm run probe:webkit first');
    process.exit(2);
  }

  const mode = JSON.parse(readFileSync(WEBKIT_MODE_FILE, 'utf8'));
  const jsonOut = process.env.PW_JSON_OUT ?? 'design/.cache/pw-report-webkit.json';

  if (mode.mode === 'native') {
    requirePlaywrightCli();
    const result = spawnSync(
      'node',
      [PLAYWRIGHT_CLI_ABS, 'test', '--project=webkit', ...extraArgs],
      { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut } }
    );
    return result.status ?? 1;
  }

  if (mode.mode === 'docker') {
    requirePlaywrightCli();
    const repoRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).stdout.trim();
    const uid = process.getuid();
    const gid = process.getgid();

    // Path is relative to the /work mount inside the container. pnpm's
    // symlinks under node_modules/.pnpm are relative, so they resolve
    // correctly inside the mounted repo.
    const dockerArgs = [
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
      '-e',
      'MOCKUP_PAGES',
      '-e',
      `PW_JSON_OUT=${jsonOut}`,
      '-v',
      `${repoRoot}:/work`,
      '-w',
      '/work',
      DOCKER_IMAGE,
      'node',
      PLAYWRIGHT_CLI,
      'test',
      '--project=webkit',
      ...extraArgs,
    ];

    const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
    return result.status ?? 1;
  }

  console.error(`Unknown webkit mode in design/.webkit-mode.json: ${mode.mode}`);
  return 1;
}

const { project, rest } = parseProjectArg(process.argv.slice(2));

let exitCode;
if (project === 'chromium') {
  exitCode = runChromium(rest);
} else if (project === 'webkit') {
  exitCode = runWebkit(rest);
} else if (project === 'all') {
  const chromiumCode = runChromium(rest);
  const webkitCode = runWebkit(rest);
  exitCode = Math.max(chromiumCode, webkitCode);
} else {
  console.error(`Unknown --project value: ${project} (expected chromium, webkit, or all)`);
  exitCode = 2;
}

process.exit(exitCode);

#!/usr/bin/env node
// Engine-aware Playwright test launcher.
//
// Usage:
//   node design/scripts/pw.mjs --project=chromium [...extra playwright test args]
//   node design/scripts/pw.mjs --project=webkit   [...extra playwright test args]
//   node design/scripts/pw.mjs --project=all       [...extra playwright test args]
//
// chromium always runs natively. webkit reads design/.webkit-mode.json
// (written by `npm run probe:webkit`) to decide whether to run natively or
// inside the pinned Playwright Docker image.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DOCKER_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';
const WEBKIT_MODE_FILE = path.resolve('design/.webkit-mode.json');

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
  const jsonOut = process.env.PW_JSON_OUT ?? 'design/.cache/pw-report-chromium.json';
  const result = spawnSync(
    'npx',
    ['playwright', 'test', '--project=chromium', ...extraArgs],
    { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut } }
  );
  return result.status ?? 1;
}

function runWebkit(extraArgs) {
  if (!existsSync(WEBKIT_MODE_FILE)) {
    console.error('design/.webkit-mode.json not found — run npm run probe:webkit first');
    process.exit(2);
  }

  const mode = JSON.parse(readFileSync(WEBKIT_MODE_FILE, 'utf8'));
  const jsonOut = process.env.PW_JSON_OUT ?? 'design/.cache/pw-report-webkit.json';

  if (mode.mode === 'native') {
    const result = spawnSync(
      'npx',
      ['playwright', 'test', '--project=webkit', ...extraArgs],
      { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut } }
    );
    return result.status ?? 1;
  }

  if (mode.mode === 'docker') {
    const repoRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).stdout.trim();
    const uid = process.getuid();
    const gid = process.getgid();

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
      'npx',
      'playwright',
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

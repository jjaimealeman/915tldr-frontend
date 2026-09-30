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
//
// FONTCONFIG ISOLATION (01-13 continuation, WINDOWS entry 10/11): a native
// (non-Docker) browser launch inherits this host's real $HOME, and therefore
// fontconfig's default user font directory ($XDG_DATA_HOME/fonts, which
// defaults to ~/.local/share/fonts when XDG_DATA_HOME is unset). This
// specific dev machine has "Instrument Serif" and "Source Serif 4" —
// this project's own primary webfont family names — installed there
// (confirmed via `fc-list`/`fc-match`), left over from earlier design work.
// A same-named locally-installed font causes Chromium's font-display:
// optional implementation to behave like `swap` (verified via CDP
// CSS.getPlatformFontsForNode: the rendered font changes after a held
// font resource is released, on this host only). Docker WebKit already
// avoids this by setting HOME=/tmp inside the container; native launches
// (host Chromium always, host WebKit when design/.webkit-mode.json selects
// native mode) need the same isolation, applied narrowly to XDG_DATA_HOME
// only — NOT HOME itself — so the browser still finds this host's
// legitimate SYSTEM fallback fonts (Noto Serif, Times New Roman/Liberation
// Serif, Georgia when present) under /usr/share/fonts, which the fallback
// matrix depends on, while never seeing this user's ~/.local/share/fonts.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DOCKER_IMAGE = 'mcr.microsoft.com/playwright:v1.63.0-noble';
const WEBKIT_MODE_FILE = path.resolve('design/.webkit-mode.json');
const PLAYWRIGHT_CLI = 'node_modules/@playwright/test/cli.js';
const PLAYWRIGHT_CLI_ABS = path.resolve(PLAYWRIGHT_CLI);
const ISOLATED_XDG_DATA_HOME = path.resolve('design/.cache/fontconfig-isolated-xdg-data-home');

function isolatedFontEnv() {
  // An empty, project-local directory with no "fonts" subdirectory at all —
  // fontconfig treats a missing user font dir as "no user fonts", falling
  // through to system directories only, never erroring.
  mkdirSync(ISOLATED_XDG_DATA_HOME, { recursive: true });
  return { XDG_DATA_HOME: ISOLATED_XDG_DATA_HOME };
}

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
    { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut, ...isolatedFontEnv() } }
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
      { stdio: 'inherit', env: { ...process.env, PW_JSON_OUT: jsonOut, ...isolatedFontEnv() } }
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

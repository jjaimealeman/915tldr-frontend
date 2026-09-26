#!/usr/bin/env node
// 03-06 Task 3: deploy convenience wrapper for the CPU-ceiling probe.
//
// This does NOT attempt to fully automate the measurement end-to-end — it genuinely cannot.
// A Cron Trigger only fires on its own real schedule (this session confirmed the documented
// `/cdn-cgi/local/scheduled` synthetic-trigger route 404s under `wrangler dev --remote`, so it
// does not exercise real edge CPU enforcement), and this session ALSO discovered that
// Cloudflare's own observability (both `wrangler tail` and the GraphQL Analytics API) can lag
// the real firing by tens of minutes. A single npm script cannot synchronously wait through
// that; see docs/phase-03/measurements.md § "An unplanned methodology finding" for the full
// story of what did and didn't work this session.
//
// What this script DOES automate: deploying the probe (default config, or --config <path> for
// one of the limits-* variants), printing the registered schedule so you can compute the next
// real firing time, and — once you have observed a result — deleting the probe. It replaces
// hand-typed `wrangler deploy`/`wrangler delete` invocations with one entry point; it does not
// replace the wait.
//
// Usage:
//   node tools/cpu-ceiling-probe/run.mjs deploy [--config <path>]
//   node tools/cpu-ceiling-probe/run.mjs status
//   node tools/cpu-ceiling-probe/run.mjs delete

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROBE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(PROBE_DIR, '../..');
const DEFAULT_CONFIG = path.relative(REPO_ROOT, path.join(PROBE_DIR, 'wrangler.jsonc'));

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, config: DEFAULT_CONFIG };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--config') args.config = rest[++i];
    else if (rest[i].startsWith('--config=')) args.config = rest[i].slice('--config='.length);
  }
  return args;
}

function runWrangler(subArgs) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', ...subArgs], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'deploy') {
    console.error(`Deploying with ${args.config} ...`);
    runWrangler(['deploy', '--config', args.config]);
    console.error(
      '\nDeployed. This does NOT trigger the schedule — wait for its real firing, then check:\n' +
      '  wrangler tail --config ' + args.config + ' --format json\n' +
      '(leave it running well past the target time — delivery can lag by tens of minutes) or:\n' +
      '  node tools/cpu-ceiling-probe/run.mjs status'
    );
    return;
  }

  if (args.command === 'status') {
    runWrangler(['deployments', 'list', '--config', args.config]);
    return;
  }

  if (args.command === 'delete') {
    console.error('Deleting the probe Worker — this is mandatory after every measurement (T-03-16).');
    runWrangler(['delete', '--config', args.config, '--force']);
    return;
  }

  console.error('Usage: node tools/cpu-ceiling-probe/run.mjs <deploy|status|delete> [--config <path>]');
  process.exit(1);
}

main();

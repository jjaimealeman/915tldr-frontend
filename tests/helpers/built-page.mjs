// 06-09: reads one built page's HTML by its canonical path, regardless of whether
// `tools/partition-archive.mjs` left it under `dist/client` (hot) or moved it into `dist/archive`
// (archive-tier, per `dist/archive-plan.json`). Every dist-output test that needs to sample a
// SPECIFIC known path (rather than enumerate a directory, like `tests/helpers/archive-sample.mjs`
// already does) reads through this one function, so "static or archived" is never reimplemented
// ad hoc per test file.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_DIST_CLIENT = 'dist/client';
const DEFAULT_ARCHIVE_DIR = 'dist/archive';
const DEFAULT_ARCHIVE_PLAN_PATH = 'dist/archive-plan.json';

function fail(message) {
  throw new Error(`built-page: ${message}`);
}

let cachedPlan;
function loadPlan(archivePlanPath) {
  if (cachedPlan && cachedPlan.path === archivePlanPath) return cachedPlan.plan;
  const abs = resolve(process.cwd(), archivePlanPath);
  if (!existsSync(abs)) {
    cachedPlan = { path: archivePlanPath, plan: null };
    return null;
  }
  const plan = JSON.parse(readFileSync(abs, 'utf8'));
  cachedPlan = { path: archivePlanPath, plan };
  return plan;
}

/**
 * Returns the built HTML for `canonicalPath` (e.g. `/es/weather/...-<uuid>`), reading
 * `dist/client/<path>.html` when it exists (hot tier) or, failing that, looking up the matching
 * entry in `dist/archive-plan.json` and reading `dist/archive/<key>` (archive tier). Returns
 * `null` when neither exists — callers decide whether that's a failure.
 */
export function readBuiltPage(
  canonicalPath,
  {
    distClient = DEFAULT_DIST_CLIENT,
    archiveDir = DEFAULT_ARCHIVE_DIR,
    archivePlanPath = DEFAULT_ARCHIVE_PLAN_PATH,
  } = {}
) {
  if (typeof canonicalPath !== 'string' || !canonicalPath.startsWith('/')) {
    fail(`canonicalPath must be an absolute-from-origin path, got ${JSON.stringify(canonicalPath)}`);
  }

  const staticAbs = resolve(process.cwd(), distClient, `.${canonicalPath}.html`);
  if (existsSync(staticAbs)) {
    return readFileSync(staticAbs, 'utf8');
  }

  const plan = loadPlan(archivePlanPath);
  if (!plan || !Array.isArray(plan.entries)) return null;
  const entry = plan.entries.find((e) => e.path === canonicalPath);
  if (!entry) return null;

  const archiveAbs = resolve(process.cwd(), archiveDir, entry.key);
  if (!existsSync(archiveAbs)) return null;
  return readFileSync(archiveAbs, 'utf8');
}

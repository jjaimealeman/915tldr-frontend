// Post-phase-06 closeout: a freshness gate for dist-output tests that describe behaviour the
// local `dist/` can only have if it was built AFTER the sources that produce it were last edited.
//
// Why this exists: `pnpm run build` writes to PRODUCTION KV by design, so the closeout work (noindex
// `/es/tag/*`, the `/opt-out` pages) was written without a local full build. The full-corpus tests
// that assert on rendered HTML would otherwise either (a) pass vacuously against a stale `dist/`,
// or (b) fail for the wrong reason (the stale dist predates the change). Instead they report a
// VISIBLE skip reason naming the source that is newer than the build — never a silent pass. After
// any real `pnpm run build` the dist is newer than the sources and these tests run in full.
//
// Stale = BOTH conditions hold: (1) the built output does not yet show the behaviour under test
// (`hasFeature()` is false) AND (2) a named source file is newer than the build. Requiring both
// matters: a `git checkout`/merge bumps source mtimes without changing content, so mtime alone would
// skip tests on a dist that already has the feature; and "feature absent" alone would let a fresh
// build that FAILED to apply the change skip instead of fail. After a real rebuild the dist is newer
// than every source, so the tests always run in full and fail loudly if the feature is missing.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');

/**
 * Returns a human-readable skip reason when the dist is absent, or when `hasFeature()` is false and
 * `dist/client/sitemap-index.xml` (written at the end of `astro build`) is OLDER than any of
 * `sourceFiles` (repo-relative); otherwise `null` (run the test).
 */
export function staleDistReason(sourceFiles, hasFeature) {
  const marker = path.join(DIST_CLIENT, 'sitemap-index.xml');
  if (!existsSync(marker)) {
    return 'dist/client/sitemap-index.xml not found — run `pnpm build` first';
  }
  if (hasFeature()) return null;
  const builtAt = statSync(marker).mtimeMs;
  for (const rel of sourceFiles) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    if (statSync(abs).mtimeMs > builtAt) {
      return `dist does not yet show this behaviour and predates ${rel} — rebuild with \`pnpm build\` to exercise this check`;
    }
  }
  return null;
}

/** True when the first built `/es/tag/*.html` page in `dist/client` carries `noindex`. */
export function builtEsTagPagesAreNoindex() {
  const dir = path.join(DIST_CLIENT, 'es', 'tag');
  if (!existsSync(dir)) return false;
  const file = readdirSync(dir).find((f) => f.endsWith('.html'));
  if (!file) return false;
  return /<meta name="robots" content="noindex"\s*\/?>/.test(readFileSync(path.join(dir, file), 'utf8'));
}

/** True when both opt-out utility pages exist in `dist/client`. */
export function builtOptOutPagesExist() {
  return existsSync(path.join(DIST_CLIENT, 'opt-out.html')) && existsSync(path.join(DIST_CLIENT, 'es', 'opt-out.html'));
}

/** True when the first built `/es/source/*.html` page in `dist/client` carries `noindex`. */
export function builtEsSourcePagesAreNoindex() {
  const dir = path.join(DIST_CLIENT, 'es', 'source');
  if (!existsSync(dir)) return false;
  const file = readdirSync(dir).find((f) => f.endsWith('.html'));
  if (!file) return false;
  return /<meta name="robots" content="noindex"\s*\/?>/.test(readFileSync(path.join(dir, file), 'utf8'));
}

// OPS-05 / OPS-06 / T-03-07: proves `/version.json` and the public footer report the same build
// identity, and that the git-fallback resolution order refuses to fire inside CI. Follows the
// `node:test` + `assert/strict` structure this repo uses (design/tests/unit/check-contrast.test.mjs,
// tests/ci-fixtures/assert-no-d1.test.mjs) — no Jest, no Vitest.
//
// Two shapes of case here:
//   1. `resolveBuildHash(env)` unit cases — call the exported pure function directly with a
//      synthetic env object. No build required.
//   2. Cross-surface cases — read the REAL `dist/client/version.json` and a REAL built article
//      `index.html`, not the source module twice. A test that re-read `src/lib/build-info.ts`
//      for "both" surfaces would pass even if the footer rendered nothing at all; reading the
//      two *emitted artifacts* is the only way to prove they actually agree (T-03-09's mitigation).
//      These cases skip with an explicit, named reason if `dist/` has not been built — never a
//      silent pass. `pnpm test:unit` runs `pnpm build` first (package.json) so this skip path is
//      not the normal one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveBuildHash, BUILD_TIMESTAMP } from '../../src/lib/build-info.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const VERSION_JSON = path.join(DIST_CLIENT, 'version.json');
const DIST_BUILT = existsSync(VERSION_JSON);
const SKIP_REASON = 'dist/client/version.json not found — run `pnpm build` first (pnpm test:unit does this automatically)';

/** Recursively finds every built page's `index.html` under `dist/client`, excluding the site
 * root's own `index.html` — same walk `tests/tracer/tracer.test.mjs` uses. */
function findArticleHtmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      found.push(...findArticleHtmlFiles(full));
    } else if (entry === 'index.html' && full !== path.join(DIST_CLIENT, 'index.html')) {
      found.push(full);
    }
  }
  return found;
}

// --- resolveBuildHash(env) unit cases — pure function, no build required ------------------

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA present resolves to workers-ci with a 7-char hash', () => {
  const result = resolveBuildHash({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567890' });
  assert.equal(result.source, 'workers-ci');
  assert.equal(result.hash, 'abcdef1');
});

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA absent, CI present resolves to unknown — the shallow-checkout git fallback is refused', () => {
  const result = resolveBuildHash({ CI: 'true' });
  assert.equal(result.source, 'unknown');
  assert.equal(result.hash, 'unknown');
});

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA absent, WORKERS_CI present (no CI var) also refuses the git fallback', () => {
  const result = resolveBuildHash({ WORKERS_CI: '1' });
  assert.equal(result.source, 'unknown');
  assert.equal(result.hash, 'unknown');
});

test('resolveBuildHash: no CI markers, no WORKERS_CI_COMMIT_SHA resolves to local-git with a valid 7-char hex hash', () => {
  const result = resolveBuildHash({});
  assert.equal(result.source, 'local-git');
  assert.match(result.hash, /^[0-9a-f]{7}$/i);
});

test('BUILD_TIMESTAMP is a valid, round-trippable ISO 8601 timestamp', () => {
  assert.match(BUILD_TIMESTAMP, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(BUILD_TIMESTAMP).toISOString(), BUILD_TIMESTAMP);
});

// --- Cross-surface cases — real emitted artifacts, not the source module twice ------------

test(
  'cross-surface: dist/client/version.json and the built article HTML report the exact same commit hash',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const version = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
    assert.ok(version.commit, 'version.json must have a commit field');
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    assert.ok(
      articleFiles.length > 0,
      'expected at least one built article HTML file under dist/client'
    );
    const html = readFileSync(articleFiles[0], 'utf8');
    assert.ok(
      html.includes(version.commit),
      `built HTML at ${articleFiles[0]} should contain the exact commit string "${version.commit}" that dist/client/version.json reports`
    );
  }
);

test(
  'cross-surface: the footer date matches the same build timestamp dist/client/version.json reports',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const version = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
    assert.match(version.builtAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const expectedDate = version.builtAt.slice(0, 10);
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    const html = readFileSync(articleFiles[0], 'utf8');
    assert.ok(
      html.includes(`· ${expectedDate}`),
      `footer should render the date "${expectedDate}" sliced from version.json's builtAt — a footer computing its own clock read would drift`
    );
  }
);

test(
  'cross-surface: exactly one data-build element exists in the built article page',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    const html = readFileSync(articleFiles[0], 'utf8');
    const matches = html.match(/data-build/g) ?? [];
    assert.equal(
      matches.length,
      1,
      'expected exactly one data-build occurrence — a duplicated footer would let the two instances diverge independently'
    );
  }
);

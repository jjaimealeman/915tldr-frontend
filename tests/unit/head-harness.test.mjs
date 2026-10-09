// 07-01 (SOC-02 / SOC-05): proves the share-card head tags by building tests/fixtures/head-harness,
// a standalone Astro root that renders the real src/layouts/Base.astro with NO content loaders, so
// the build performs zero D1 reads and zero KV writes. A full `pnpm build` runs the D1 loaders and
// bulk-writes production KV (06-15 SUMMARY, deviation 2), which is why head metadata is proven here.
// This test never substitutes for the live validator checks (07-08): it reads built HTML only.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { VARIANTS } from '../fixtures/head-harness/src/variants.ts';
import { SHARE_IMAGE_PATH } from '../../src/lib/share-meta.ts';
import { headOf, parseMetaTags, metaContent, metaContents } from '../helpers/head-meta.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const HARNESS = path.join(REPO_ROOT, 'tests/fixtures/head-harness');
const HARNESS_REL = 'tests/fixtures/head-harness';
const REPO_CACHE = path.join(REPO_ROOT, 'node_modules/.astro/incremental-build.json');

const mtimeOrNull = (p) => (existsSync(p) ? statSync(p).mtimeMs : null);
let cacheBefore = null;
let cacheAfter = null;
let buildMs = 0;

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function gitCheckIgnored(file) {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

before(() => {
  cacheBefore = mtimeOrNull(REPO_CACHE);
  const started = Date.now();
  execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'node_modules/astro/bin/astro.mjs'), 'build', '--root', HARNESS],
    { cwd: REPO_ROOT, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, timeout: 120000, stdio: 'pipe' }
  );
  buildMs = Date.now() - started;
  cacheAfter = mtimeOrNull(REPO_CACHE);
  console.log(`# head-harness build: ${buildMs}ms`);
});

function builtMeta(variantName) {
  const html = readFileSync(path.join(HARNESS, 'dist', `${variantName}.html`), 'utf8');
  return parseMetaTags(headOf(html));
}

test('head-harness: every variant carries its literal expected meta tags', () => {
  for (const v of VARIANTS) {
    const tags = builtMeta(v.name);
    for (const [key, expected] of Object.entries(v.expectMeta)) {
      if (Array.isArray(expected)) {
        assert.deepEqual(metaContents(tags, key), expected, `${v.name}: ${key}`);
      } else {
        assert.equal(metaContent(tags, key), expected, `${v.name}: ${key}`);
      }
    }
    for (const key of v.expectAbsent ?? []) {
      assert.equal(metaContent(tags, key), undefined, `${v.name}: ${key} must be absent`);
    }
  }
});

test('head-harness: og:image is an absolute https URL whose path is SHARE_IMAGE_PATH[lang]', () => {
  for (const v of VARIANTS) {
    const url = new URL(metaContent(builtMeta(v.name), 'og:image'));
    assert.equal(url.protocol, 'https:', v.name);
    assert.equal(url.pathname, SHARE_IMAGE_PATH[v.props.lang], v.name);
  }
});

test('head-harness: harness site literal equals the root astro.config.mjs site literal', () => {
  const siteOf = (file) => readFileSync(file, 'utf8').match(/^\s*site:\s*['"]([^'"]+)['"]/m)?.[1];
  const root = siteOf(path.join(REPO_ROOT, 'astro.config.mjs'));
  const harness = siteOf(path.join(HARNESS, 'astro.config.mjs'));
  assert.ok(root, 'root astro.config.mjs has a site literal');
  assert.equal(harness, root);
});

test('head-harness: the build did not touch the repo-root incremental cache', () => {
  assert.equal(cacheAfter, cacheBefore);
});

test('head-harness: every build output is git-ignored and none shows in git status', () => {
  const outputs = [...walk(path.join(HARNESS, 'dist')), ...walk(path.join(HARNESS, '.astro'))];
  assert.ok(outputs.length > 0, 'harness build produced output');
  for (const file of outputs) {
    const rel = path.relative(REPO_ROOT, file);
    assert.ok(gitCheckIgnored(rel), `${rel} must be git-ignored`);
  }
  assert.ok(!existsSync(path.join(HARNESS, 'node_modules')) || gitCheckIgnored(`${HARNESS_REL}/node_modules`));
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', HARNESS_REL], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  for (const line of status.split('\n').filter(Boolean)) {
    const p = line.slice(3);
    assert.ok(
      !/\/(dist|\.astro|node_modules)\//.test(p),
      `build output shows in git status: ${line}`
    );
  }
});

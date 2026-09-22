// D-06 / ARCH-04 / ARCH-05 / ARCH-06 config-shape assertions.
//
// The removed-API checks (ARCH-04, ARCH-05) and the wrangler.jsonc binding check (T-03-01) are
// driven through the real `tools/check-config-guards.mjs` CLI, spawned against temporary
// fixture directories/files (`design/tests/unit/check-contrast.test.mjs`'s own established
// pattern) — so these tests exercise the actual guard, not an internal re-implementation of it.
//
// ARCH-06 (imageService) cannot be read off `astro.config.mjs`'s resolved default export the way
// 03-02-PLAN.md's action text originally assumed: `@astrojs/cloudflare` v14.3.2's
// `cloudflare(options)` closes over `imageService` internally (see
// `node_modules/@astrojs/cloudflare/dist/index.js`'s `createIntegration({ imageService, ... })`)
// and never re-exposes it on the integration object (`{ name, hooks }`) it returns — there is no
// `config.adapter.imageService` to inspect. `extractImageService` instead evaluates (via `vm`,
// not string matching) the literal object argument passed to the `cloudflare(...)` call in a
// config source string, which reads the real resolved *value* rather than grepping text, while
// staying independent of the adapter package's own internals. This is 03-02's own finding,
// recorded as a deviation in 03-02-SUMMARY.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const GUARD_SCRIPT = path.join(REPO_ROOT, 'tools/check-config-guards.mjs');
const REAL_CONFIG_PATH = path.join(REPO_ROOT, 'astro.config.mjs');

function tempDirWithFile(filename, content) {
  const dir = mkdtempSync(path.join(tmpdir(), 'config-guard-'));
  const filePath = path.join(dir, filename);
  writeFileSync(filePath, content, 'utf8');
  return { dir, filePath };
}

/** Spawns the real CLI. Any arg omitted falls back to a path that does not exist, so only the
 * dimension under test (src / config / wrangler) is exercised in a given case. */
function runGuard({ srcDir, configFile, wranglerFile }) {
  const nonExistent = path.join(mkdtempSync(path.join(tmpdir(), 'config-guard-absent-')), 'none');
  const result = spawnSync(
    process.execPath,
    [
      GUARD_SCRIPT,
      '--json',
      '--src',
      srcDir ?? nonExistent,
      '--config',
      configFile ?? `${nonExistent}.mjs`,
      '--wrangler',
      wranglerFile ?? `${nonExistent}.jsonc`,
    ],
    { encoding: 'utf8' }
  );
  const parsed = result.stdout ? JSON.parse(result.stdout) : { ok: result.status === 0, violations: [] };
  return { status: result.status, ...parsed };
}

function extractCloudflareCallArgSource(sourceText) {
  const marker = 'cloudflare(';
  const start = sourceText.indexOf(marker);
  if (start === -1) return null;
  let depth = 0;
  let argStart = -1;
  for (let i = start + marker.length - 1; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (ch === '(') {
      if (depth === 0) argStart = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) return sourceText.slice(argStart, i);
    }
  }
  return null;
}

function extractImageService(sourceText) {
  const argSource = extractCloudflareCallArgSource(sourceText);
  if (argSource === null) return { present: false, value: undefined };
  let obj;
  try {
    obj = vm.runInNewContext(`(${argSource})`, {}, { timeout: 1000 });
  } catch {
    return { present: false, value: undefined };
  }
  return { present: Object.prototype.hasOwnProperty.call(obj, 'imageService'), value: obj.imageService };
}

/** ARCH-06: valid only as the explicit two-key object form — a string shorthand or a one-key
 * object are look-alikes, not the required setting, and must not pass. */
function imageServiceIsValid(sourceText) {
  const { present, value } = extractImageService(sourceText);
  if (!present || value === undefined) return false;
  if (typeof value !== 'object' || value === null) return false;
  return value.build === 'compile' && value.runtime === 'passthrough';
}

// --- ARCH-04 / ARCH-05 / T-03-01, driven through the real CLI ---

test('the real repository state passes the guard (ARCH-04, ARCH-05, T-03-01)', () => {
  const result = runGuard({ srcDir: path.join(REPO_ROOT, 'src'), configFile: REAL_CONFIG_PATH, wranglerFile: path.join(REPO_ROOT, 'wrangler.jsonc') });
  assert.equal(result.status, 0, JSON.stringify(result.violations));
  assert.equal(result.ok, true);
});

test('the removed output keyword "hybrid" fails the guard (ARCH-05)', () => {
  const { dir } = tempDirWithFile('bad.mjs', "export default {\n  output: 'hybrid',\n};\n");
  const result = runGuard({ srcDir: dir });
  assert.equal(result.status, 1);
  assert.ok(result.violations.some((v) => v.rule === 'ARCH-05'), JSON.stringify(result.violations));
});

test('the removed Astro.locals.runtime.env accessor fails the guard (ARCH-04)', () => {
  const { dir } = tempDirWithFile(
    'bad.ts',
    'export function bad() {\n  return Astro.locals.runtime.env.SOMETHING;\n}\n'
  );
  const result = runGuard({ srcDir: dir });
  assert.equal(result.status, 1);
  assert.ok(result.violations.some((v) => v.rule === 'ARCH-04'), JSON.stringify(result.violations));
});

test('a comment-only occurrence of the removed env accessor passes (T-03-05)', () => {
  const { dir } = tempDirWithFile(
    'ok.ts',
    '// Astro.locals.runtime.env is removed; use `cloudflare:workers` env instead.\n' +
      '/* Astro.locals.runtime.env — also mentioned here, inside a block comment. */\n' +
      'export const ok = true;\n'
  );
  const result = runGuard({ srcDir: dir });
  assert.equal(result.status, 0, JSON.stringify(result.violations));
});

test('a comment-only occurrence of the removed output keyword passes (T-03-05)', () => {
  const { dir } = tempDirWithFile(
    'ok.mjs',
    "// output: 'hybrid' is a removed keyword as of Astro v5.\nexport default { output: 'static' };\n"
  );
  const result = runGuard({ srcDir: dir });
  assert.equal(result.status, 0, JSON.stringify(result.violations));
});

test('a Worker database binding in wrangler.jsonc fails the guard, live', () => {
  const { filePath } = tempDirWithFile('wrangler.jsonc', '{\n  "d1_databases": [{ "binding": "DB" }]\n}\n');
  const result = runGuard({ wranglerFile: filePath });
  assert.equal(result.status, 1);
  assert.ok(result.violations.some((v) => v.rule === 'T-03-01'), JSON.stringify(result.violations));
});

test('a Worker database binding in wrangler.jsonc fails the guard even when commented out (T-03-01)', () => {
  const { filePath } = tempDirWithFile(
    'wrangler.jsonc',
    '{\n  // "d1_databases": [ { "binding": "DB" } ]\n}\n'
  );
  const result = runGuard({ wranglerFile: filePath });
  assert.equal(result.status, 1);
  assert.ok(result.violations.some((v) => v.rule === 'T-03-01'), JSON.stringify(result.violations));
});

// --- ARCH-06 (imageService), driven by evaluating the real cloudflare(...) call argument ---

test('ARCH-06: the real astro.config.mjs sets imageService as the explicit two-key object', () => {
  const source = readFileSync(REAL_CONFIG_PATH, 'utf8');
  assert.equal(imageServiceIsValid(source), true);
});

test('ARCH-06: imageService as the string shorthand fails, even though it touches the required value', () => {
  const source = "cloudflare({ imageService: 'compile', session: false })";
  assert.equal(imageServiceIsValid(source), false);
});

test('ARCH-06: imageService as a one-key object missing "runtime" fails', () => {
  const source = "cloudflare({ imageService: { build: 'compile' } })";
  assert.equal(imageServiceIsValid(source), false);
});

test('ARCH-06: imageService as a one-key object missing "build" fails', () => {
  const source = "cloudflare({ imageService: { runtime: 'passthrough' } })";
  assert.equal(imageServiceIsValid(source), false);
});

test('ARCH-06: imageService absent entirely fails (the adapter default would silently apply otherwise)', () => {
  const source = "cloudflare({ session: false, prerenderEnvironment: 'node' })";
  assert.equal(imageServiceIsValid(source), false);
});

test('ARCH-06 backstop: key order inside the adapter options object does not change the result', () => {
  const orderA = "cloudflare({ imageService: { build: 'compile', runtime: 'passthrough' }, session: false })";
  const orderB = "cloudflare({ session: false, imageService: { runtime: 'passthrough', build: 'compile' } })";
  assert.equal(imageServiceIsValid(orderA), true);
  assert.equal(imageServiceIsValid(orderB), true);
});

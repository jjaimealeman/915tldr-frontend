// 07-01 (SOC-05, D-21): tests for tools/assert-share-origin.mjs, the build guard that ties the
// committed og:image origin constant (SHARE_IMAGE_ORIGIN in src/lib/share-meta.ts) to the Worker's
// single primary custom_domain route in wrangler.jsonc. Pure-function cases run against the real
// wrangler.jsonc text and inline fixtures; CLI cases spawn the real script against temp files,
// the same pattern tests/unit/astro-config.test.mjs uses for check-config-guards.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { customDomainHosts, checkShareOrigin } from '../../tools/assert-share-origin.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const GUARD_SCRIPT = path.join(REPO_ROOT, 'tools/assert-share-origin.mjs');
const REAL_WRANGLER = readFileSync(path.join(REPO_ROOT, 'wrangler.jsonc'), 'utf8');

const wranglerWith = (routes) => `{\n  "name": "x",\n  "routes": [\n${routes}\n  ],\n}\n`;
const ONLY_DEV = wranglerWith('    { "pattern": "dev.915tldr.com", "custom_domain": true },');
const TWO_DOMAINS = wranglerWith(
  '    { "pattern": "dev.915tldr.com", "custom_domain": true },\n    { "custom_domain": true, "pattern": "915tldr.com" },'
);
const NO_DOMAIN = wranglerWith('    { "pattern": "915tldr.com/*", "zone_name": "915tldr.com" },');

test('customDomainHosts: real wrangler.jsonc yields the dev host', () => {
  assert.deepEqual(customDomainHosts(REAL_WRANGLER), ['dev.915tldr.com']);
});

test('customDomainHosts: keys in either order are read', () => {
  const text = wranglerWith('    { "custom_domain": true, "pattern": "915tldr.com" },');
  assert.deepEqual(customDomainHosts(text), ['915tldr.com']);
});

test('customDomainHosts: a route without custom_domain true is ignored', () => {
  assert.deepEqual(customDomainHosts(NO_DOMAIN), []);
  const falseFlag = wranglerWith('    { "pattern": "915tldr.com", "custom_domain": false },');
  assert.deepEqual(customDomainHosts(falseFlag), []);
});

test('customDomainHosts: a commented-out route is ignored', () => {
  const text = wranglerWith(
    '    { "pattern": "dev.915tldr.com", "custom_domain": true },\n    // { "pattern": "915tldr.com", "custom_domain": true },\n    /* { "pattern": "www.915tldr.com", "custom_domain": true }, */'
  );
  assert.deepEqual(customDomainHosts(text), ['dev.915tldr.com']);
});

test('checkShareOrigin: the committed origin against the real wrangler.jsonc is clean', () => {
  assert.deepEqual(checkShareOrigin({ shareOrigin: 'https://dev.915tldr.com', wranglerText: REAL_WRANGLER }), []);
});

for (const [label, shareOrigin, wranglerText] of [
  ['http scheme', 'http://dev.915tldr.com', ONLY_DEV],
  ['path', 'https://dev.915tldr.com/og', ONLY_DEV],
  ['port', 'https://dev.915tldr.com:8443', ONLY_DEV],
  ['credentials', 'https://user:pw@dev.915tldr.com', ONLY_DEV],
  ['query', 'https://dev.915tldr.com?x=1', ONLY_DEV],
  ['trailing slash', 'https://dev.915tldr.com/', ONLY_DEV],
  ['host mismatch', 'https://915tldr.com', ONLY_DEV],
  ['not a url', 'not a url', ONLY_DEV],
  ['no custom_domain route', 'https://dev.915tldr.com', NO_DOMAIN],
  ['two custom_domain routes even when one matches', 'https://dev.915tldr.com', TWO_DOMAINS],
]) {
  test(`checkShareOrigin: ${label} yields one SOC-05-ORIGIN violation`, () => {
    const violations = checkShareOrigin({ shareOrigin, wranglerText });
    assert.equal(violations.length, 1, JSON.stringify(violations));
    assert.equal(violations[0].rule, 'SOC-05-ORIGIN');
    assert.equal(violations[0].file, 'wrangler.jsonc');
    assert.equal(violations[0].line, 1);
    assert.ok(violations[0].message.length > 0);
  });
}

function runCli(args) {
  return spawnSync(process.execPath, [GUARD_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

test('CLI: exits 0 and prints the ok line on the real repo', () => {
  const result = runCli([]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    result.stdout,
    /^\[assert-share-origin\] ok: og:image origin https:\/\/dev\.915tldr\.com matches custom domain dev\.915tldr\.com/m
  );
});

test('CLI: exits 1 and prints the violation for a wrangler file whose custom domain is 915tldr.com', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'share-origin-'));
  const file = path.join(dir, 'wrangler.jsonc');
  writeFileSync(file, wranglerWith('    { "pattern": "915tldr.com", "custom_domain": true },'), 'utf8');
  const result = runCli(['--wrangler', file]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const output = result.stdout + result.stderr;
  assert.match(output, /\[assert-share-origin\]/);
  assert.match(output, /\[SOC-05-ORIGIN\]/);
});

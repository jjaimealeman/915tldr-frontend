// D-13 hardened gate — node:test suite. Every behavior bullet in
// 01-05-PLAN.md's <context> gets its own test. `run()` spawns the real CLI
// against a fixture and returns { status, stdout, stderr } so these tests
// exercise the actual script, not an internal function.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { wcagContrast, parse, converter } from 'culori';
import { toSrgb } from '../../scripts/lib/css-tokens.mjs';

const SCRIPT = 'design/scripts/check-contrast.mjs';
const FIXTURES = 'design/tests/unit/fixtures';

function run(fixture, extraArgs = []) {
  const outFile = path.join(mkdtempSync(path.join(tmpdir(), 'contrast-')), 'out.md');
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--css', path.join(FIXTURES, fixture), '--out', outFile, ...extraArgs],
    { encoding: 'utf8' }
  );
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', outFile };
}

function runCss(cssText, extraArgs = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'contrast-variant-'));
  const cssFile = path.join(dir, 'variant.css');
  writeFileSync(cssFile, cssText, 'utf8');
  const outFile = path.join(dir, 'out.md');
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--css', cssFile, '--out', outFile, ...extraArgs],
    { encoding: 'utf8' }
  );
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', outFile };
}

test('valid.css exits 0 with three ramp rows and worst-hue values', () => {
  const { status, outFile } = run('valid.css');
  assert.equal(status, 0);
  const md = readFileSync(outFile, 'utf8');
  const rampRows = md.split('\n').filter((l) => l.startsWith('| vivid-light') || l.startsWith('| block') || l.startsWith('| vivid-dark'));
  assert.equal(rampRows.length, 3, `expected exactly 3 ramp rows, got:\n${md}`);
  for (const row of rampRows) {
    assert.match(row, /\|\s*[\w-]+\s*\|/, 'row should name a worst hue');
  }
});

test('valid.css --json output has ok: true', () => {
  const { status, stdout } = run('valid.css', ['--json']);
  assert.equal(status, 0);
  const json = JSON.parse(stdout);
  assert.equal(json.ok, true);
});

test('missing-token.css exits 1 and names --cat-weather-block', () => {
  const { status, stderr } = run('missing-token.css');
  assert.equal(status, 1);
  assert.match(stderr, /--cat-weather-block/);
});

test('unresolved-var.css exits 1 and names --nope', () => {
  const { status, stderr } = run('unresolved-var.css');
  assert.equal(status, 1);
  assert.match(stderr, /--nope/);
});

test('out-of-gamut.css exits 1, names the token and says gamut', () => {
  const { status, stderr } = run('out-of-gamut.css');
  assert.equal(status, 1);
  assert.match(stderr, /--cat-weather-vivid-light/);
  assert.match(stderr, /gamut/i);
});

test('uncovered-colour.css exits 1, names --accent and says not covered', () => {
  const { status, stderr } = run('uncovered-colour.css');
  assert.equal(status, 1);
  assert.match(stderr, /--accent/);
  assert.match(stderr, /not covered/i);
});

test('collide.css exits 1 and names both colliding slugs and the distance', () => {
  const { status, stderr } = run('collide.css');
  assert.equal(status, 1);
  assert.match(stderr, /politics/);
  assert.match(stderr, /education/);
  assert.match(stderr, /0\.\d+/, 'should show a numeric OKLab distance');
});

test('nine-categories.css exits 1', () => {
  const { status } = run('nine-categories.css');
  assert.equal(status, 1);
});

test('wrong-order.css exits 1', () => {
  const { status } = run('wrong-order.css');
  assert.equal(status, 1);
});

test('stop-mismatch.css exits 1 and names the mismatched token', () => {
  const { status, stderr } = run('stop-mismatch.css');
  assert.equal(status, 1);
  assert.match(stderr, /--cat-business-block/);
});

test('warm-bone.css exits 1 and says C-01', () => {
  const { status, stderr } = run('warm-bone.css');
  assert.equal(status, 1);
  assert.match(stderr, /C-01/);
});

test('low-contrast.css exits 1 and shows the ratio below 4.5', () => {
  const { status, stderr } = run('low-contrast.css');
  assert.equal(status, 1);
  const match = stderr.match(/(\d+\.\d+)/);
  assert.ok(match, `expected a numeric ratio in stderr, got: ${stderr}`);
  assert.ok(Number(match[1]) < 4.5, `expected ratio < 4.5, got ${match[1]}`);
});

test('dark-inherit.css exits 1 because the inherited value fails against the dark paper', () => {
  const { status, stderr } = run('dark-inherit.css');
  assert.equal(status, 1);
  assert.match(stderr, /--ink-muted/);
});

test('literal-outside.css exits 1 and says colour literal outside tokens', () => {
  const { status, stderr } = run('literal-outside.css');
  assert.equal(status, 1);
  assert.match(stderr, /colour literal outside tokens/i);
});

test('a business hue of 85 prints a C-01 review warning and still exits 0', () => {
  const base = readFileSync(path.join(FIXTURES, 'valid.css'), 'utf8');
  function withBusinessHue(css, hue) {
    return css
      .replace(/--hue-business:\s*[\d.]+;/, `--hue-business: ${hue};`)
      .replace(
        /--cat-business-vivid-light:\s*oklch\(([\d.]+)\s+([\d.]+)\s+[\d.]+\)/,
        `--cat-business-vivid-light: oklch($1 $2 ${hue})`
      )
      .replace(
        /--cat-business-block:\s*oklch\(([\d.]+)\s+([\d.]+)\s+[\d.]+\)/,
        `--cat-business-block: oklch($1 $2 ${hue})`
      )
      .replace(
        /--cat-business-vivid-dark:\s*oklch\(([\d.]+)\s+([\d.]+)\s+[\d.]+\)/,
        `--cat-business-vivid-dark: oklch($1 $2 ${hue})`
      );
  }
  const variant = withBusinessHue(base, 85);
  assert.notEqual(variant, base, 'sanity: the replace actually changed something');
  const { status, stderr, outFile } = runCss(variant);
  assert.equal(status, 0, `expected exit 0, stderr:\n${stderr}`);
  const md = readFileSync(outFile, 'utf8');
  assert.match(stderr + md, /C-01 review/i);
  assert.match(stderr + md, /business/i);
});

test('lib: toSrgb ratio for #767676 on #FFFFFF passes 4.5, #777777 fails', () => {
  const passRatio = wcagContrast(toSrgb('#767676'), toSrgb('#FFFFFF'));
  const failRatio = wcagContrast(toSrgb('#777777'), toSrgb('#FFFFFF'));
  assert.ok(passRatio >= 4.5, `expected #767676 to pass 4.5, got ${passRatio}`);
  assert.ok(failRatio < 4.5, `expected #777777 to fail 4.5, got ${failRatio}`);
});

test('lib: toSrgb for an oklch() token matches culori wcagContrast to within 1e-9', () => {
  const value = 'oklch(0.600 0.120 28.0)';
  const bg = '#FAFAF8';
  const scriptRatio = wcagContrast(toSrgb(value), toSrgb(bg));
  const toRgb = converter('rgb');
  const directRatio = wcagContrast(toRgb(parse(value)), toRgb(parse(bg)));
  assert.ok(Math.abs(scriptRatio - directRatio) < 1e-9, `${scriptRatio} vs ${directRatio}`);
});

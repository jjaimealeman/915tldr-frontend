// D-GAP-A shrink (01-14 Task 2) — node:test suite for the fvar axis reader.
// Every behavior bullet in 01-14-PLAN.md's Task 2 <behavior> block gets its
// own test. Reads the real Source Serif 4 / Instrument Serif source fonts
// from design/fonts-src/ (gitignored, fetched by `pnpm run fonts:fetch`) —
// when a source file is missing the test fails loudly with the fetch
// instruction, it never skips (a skip would silently hide a real coverage
// gap the next time this suite runs in CI).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readVariationAxes } from '../../scripts/lib/font-axes.mjs';

const FONTS_SRC_DIR = path.resolve('design/fonts-src');

const SOURCE_SERIF_ROMAN = 'SourceSerif4%5Bopsz%2Cwght%5D.ttf';
const SOURCE_SERIF_ITALIC = 'SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf';
const INSTRUMENT_REGULAR = 'InstrumentSerif-Regular.ttf';

function loadSource(fileName) {
  const filePath = path.join(FONTS_SRC_DIR, fileName);
  if (!existsSync(filePath)) {
    assert.fail(
      `font-axes.test.mjs: missing ${filePath} — run \`pnpm run fonts:fetch\` before running this suite (never skipped).`
    );
  }
  return readFileSync(filePath);
}

test('readVariationAxes on the Source Serif 4 Roman variable source returns exactly [opsz, wght], each finite with min <= default <= max', () => {
  const buffer = loadSource(SOURCE_SERIF_ROMAN);
  const axes = readVariationAxes(buffer);

  assert.deepEqual(
    axes.map((a) => a.tag).sort(),
    ['opsz', 'wght'].sort()
  );

  for (const axis of axes) {
    assert.equal(typeof axis.min, 'number');
    assert.equal(typeof axis.default, 'number');
    assert.equal(typeof axis.max, 'number');
    assert.ok(Number.isFinite(axis.min), `${axis.tag}.min is not finite`);
    assert.ok(Number.isFinite(axis.default), `${axis.tag}.default is not finite`);
    assert.ok(Number.isFinite(axis.max), `${axis.tag}.max is not finite`);
    assert.ok(axis.min <= axis.default, `${axis.tag}: min (${axis.min}) > default (${axis.default})`);
    assert.ok(axis.default <= axis.max, `${axis.tag}: default (${axis.default}) > max (${axis.max})`);
  }
});

test('readVariationAxes on the Source Serif 4 Italic variable source returns the same two tags, with min <= default <= max', () => {
  const buffer = loadSource(SOURCE_SERIF_ITALIC);
  const axes = readVariationAxes(buffer);

  assert.deepEqual(
    axes.map((a) => a.tag).sort(),
    ['opsz', 'wght'].sort()
  );

  for (const axis of axes) {
    assert.ok(Number.isFinite(axis.min));
    assert.ok(Number.isFinite(axis.default));
    assert.ok(Number.isFinite(axis.max));
    assert.ok(axis.min <= axis.default, `${axis.tag}: min (${axis.min}) > default (${axis.default})`);
    assert.ok(axis.default <= axis.max, `${axis.tag}: default (${axis.default}) > max (${axis.max})`);
  }
});

test('readVariationAxes on a static font (Instrument Serif Regular) returns [] — no fvar table', () => {
  const buffer = loadSource(INSTRUMENT_REGULAR);
  const axes = readVariationAxes(buffer);
  assert.deepEqual(axes, []);
});

test('a buffer truncated to 8 bytes throws an Error mentioning "sfnt"', () => {
  const truncated = Buffer.alloc(8);
  // A plausible-looking sfnt version, and a numTables that claims one table
  // record follows — but the buffer ends before that record's bytes exist
  // (a real table directory needs 12 header bytes + 16 per record; this
  // buffer has only 8 total), so reading the first record's tag overruns.
  truncated.writeUInt32BE(0x00010000, 0);
  truncated.writeUInt16BE(1, 4);
  assert.throws(() => readVariationAxes(truncated), /sfnt/i);
});

test('a buffer whose first 4 bytes are "wOF2" throws an Error naming WOFF/WOFF2 as unsupported', () => {
  const woff2Buffer = Buffer.concat([Buffer.from('wOF2', 'ascii'), Buffer.alloc(16)]);
  assert.throws(() => readVariationAxes(woff2Buffer), /woff2?/i);
});

test('a buffer whose first 4 bytes are "wOFF" throws an Error naming WOFF/WOFF2 as unsupported', () => {
  const woffBuffer = Buffer.concat([Buffer.from('wOFF', 'ascii'), Buffer.alloc(16)]);
  assert.throws(() => readVariationAxes(woffBuffer), /woff2?/i);
});

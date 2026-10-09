// 07-02, SOC-05 / SOC-06, D-07 / D-08 / D-13 / D-23: pins the share cards and the icon set.
// This file starts with the encodeIco container tests (tools/og-card/ico.mjs); the shipped-asset
// checks (formats, sizes, token parity, copy, hygiene, redirect shadowing) are added in the
// next task of the same plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeIco } from '../../tools/og-card/ico.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A fake but signature-correct PNG payload of a given total length (encodeIco only copies bytes).
function fakePng(length, fill = 0xab) {
  return Buffer.concat([PNG_SIGNATURE, Buffer.alloc(length - PNG_SIGNATURE.length, fill)]);
}

test('encodeIco: single 32 entry has the ICONDIR header (reserved 0, type 1, count 1)', () => {
  const ico = encodeIco([{ size: 32, png: fakePng(100) }]);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
});

test('encodeIco: two entries report count 2', () => {
  const ico = encodeIco([
    { size: 16, png: fakePng(60) },
    { size: 32, png: fakePng(100) },
  ]);
  assert.equal(ico.readUInt16LE(4), 2);
});

test('encodeIco: directory entry fields and offsets are correct', () => {
  const a = fakePng(60, 0x11);
  const b = fakePng(100, 0x22);
  const ico = encodeIco([
    { size: 16, png: a },
    { size: 32, png: b },
  ]);
  const entry = (i) => 6 + 16 * i;
  const e0 = entry(0);
  assert.equal(ico[e0], 16, 'width');
  assert.equal(ico[e0 + 1], 16, 'height');
  assert.equal(ico[e0 + 2], 0, 'colour count');
  assert.equal(ico[e0 + 3], 0, 'reserved');
  assert.equal(ico.readUInt16LE(e0 + 4), 1, 'planes');
  assert.equal(ico.readUInt16LE(e0 + 6), 32, 'bit count');
  assert.equal(ico.readUInt32LE(e0 + 8), a.length, 'bytesInRes');
  assert.equal(ico.readUInt32LE(e0 + 12), 6 + 16 * 2, 'imageOffset of first entry');
  const e1 = entry(1);
  assert.equal(ico[e1], 32);
  assert.equal(ico[e1 + 1], 32);
  assert.equal(ico.readUInt32LE(e1 + 8), b.length);
  assert.equal(ico.readUInt32LE(e1 + 12), 6 + 16 * 2 + a.length, 'imageOffset of second entry');
});

test('encodeIco: PNG bytes appear verbatim at each imageOffset', () => {
  const a = fakePng(60, 0x11);
  const b = fakePng(100, 0x22);
  const ico = encodeIco([
    { size: 16, png: a },
    { size: 32, png: b },
  ]);
  const off0 = ico.readUInt32LE(6 + 12);
  const off1 = ico.readUInt32LE(6 + 16 + 12);
  assert.ok(ico.subarray(off0, off0 + a.length).equals(a));
  assert.ok(ico.subarray(off1, off1 + b.length).equals(b));
  assert.equal(ico.length, 6 + 32 + a.length + b.length);
});

test('encodeIco: size 256 is encoded as 0 in the width and height bytes', () => {
  const ico = encodeIco([{ size: 256, png: fakePng(80) }]);
  assert.equal(ico[6], 0);
  assert.equal(ico[7], 0);
});

test('encodeIco: rejects an empty list', () => {
  assert.throws(() => encodeIco([]), /empty|at least one/i);
});

test('encodeIco: rejects a size outside 1..256', () => {
  assert.throws(() => encodeIco([{ size: 0, png: fakePng(60) }]), /size/i);
  assert.throws(() => encodeIco([{ size: 257, png: fakePng(60) }]), /size/i);
});

test('encodeIco: rejects a buffer without the PNG signature', () => {
  assert.throws(() => encodeIco([{ size: 32, png: Buffer.alloc(60) }]), /PNG/i);
});

test('encodeIco: rejects a duplicate size', () => {
  assert.throws(
    () => encodeIco([
      { size: 32, png: fakePng(60) },
      { size: 32, png: fakePng(60) },
    ]),
    /duplicate|ascending/i,
  );
});

test('encodeIco: rejects entries not sorted ascending by size', () => {
  assert.throws(
    () => encodeIco([
      { size: 32, png: fakePng(60) },
      { size: 16, png: fakePng(60) },
    ]),
    /ascending|sorted/i,
  );
});

// 07-02, SOC-05 / SOC-06, D-07 / D-08 / D-13 / D-23: pins the share cards and the icon set.
// Two halves: the encodeIco container tests (tools/og-card/ico.mjs), then checks on the shipped
// assets (formats, sizes, token parity with global.css, exact copy, source hygiene and redirect
// shadowing). Regex-only parsing, no image or CSS dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { encodeIco } from '../../tools/og-card/ico.mjs';
import { CATEGORIES } from '../../src/lib/categories.ts';
import { SHARE_IMAGE_ALT } from '../../src/lib/share-meta.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const read = (rel) => readFileSync(path.join(REPO_ROOT, rel));
const readText = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

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

// ---------------------------------------------------------------------------------------------
// Shipped assets
// ---------------------------------------------------------------------------------------------

// Reads the PNG signature and IHDR: width, height, bit depth, colour type.
function pngInfo(buffer) {
  assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), 'PNG signature');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

for (const file of ['public/og-image.png', 'public/og-image-es.png']) {
  test(`${file}: 1200x630, 8-bit RGB with no alpha, under 5 MB (D-07, D-08, SOC-05)`, () => {
    const buf = read(file);
    const info = pngInfo(buf);
    assert.equal(info.width, 1200);
    assert.equal(info.height, 630);
    assert.equal(info.bitDepth, 8);
    assert.equal(info.colorType, 2, 'colour type 2 is RGB without alpha');
    assert.ok(buf.length < 5_000_000, `${file} is ${buf.length} bytes`);
  });
}

test('public/apple-touch-icon.png: 180x180, 8-bit opaque RGB (D-13)', () => {
  const info = pngInfo(read('public/apple-touch-icon.png'));
  assert.equal(info.width, 180);
  assert.equal(info.height, 180);
  assert.equal(info.bitDepth, 8);
  assert.equal(info.colorType, 2);
});

test('public/favicon.ico: one 32x32 PNG entry (D-23)', () => {
  const ico = read('public/favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0, 'reserved');
  assert.equal(ico.readUInt16LE(2), 1, 'type 1 is icon');
  assert.equal(ico.readUInt16LE(4), 1, 'exactly one image');
  assert.equal(ico[6], 32, 'directory width');
  assert.equal(ico[7], 32, 'directory height');
  const length = ico.readUInt32LE(6 + 8);
  const offset = ico.readUInt32LE(6 + 12);
  const png = ico.subarray(offset, offset + length);
  const info = pngInfo(png);
  assert.equal(info.width, 32);
  assert.equal(info.height, 32);
  assert.equal(offset + length, ico.length, 'no trailing bytes');
});

test('public/favicon.svg: 32x32 viewBox with the 915 text (D-13)', () => {
  const svg = readText('public/favicon.svg');
  assert.ok(svg.includes('viewBox="0 0 32 32"'));
  assert.ok(svg.includes('915'));
});

// Token parity (SOC-06): the card source carries the same values global.css defines.
const CARD = readText('tools/og-card/card.html');
const CSS = readText('src/styles/global.css');

function cssToken(name) {
  // First (light-theme) definition of the token.
  const match = CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `global.css defines --${name}`);
  return match[1].trim();
}

for (const [token, hex] of [['paper', '#FAFAF8'], ['ink', '#14161A'], ['ink-muted', '#6D6F71'], ['rule', '#DDDEE0']]) {
  test(`token parity: --${token} is ${hex} in global.css and appears in card.html`, () => {
    assert.equal(cssToken(token).toUpperCase(), hex);
    assert.ok(CARD.toUpperCase().includes(hex), `card.html contains ${hex}`);
  });
}

test('token parity: the 8 stripe oklch values equal --cat-<slug>-vivid-light, in CATEGORIES order', () => {
  const stripe = CARD.slice(CARD.indexOf('class="stripe"'));
  const fromCard = [...stripe.matchAll(/background:\s*(oklch\([^)]*\))/g)].map((m) => m[1]);
  const fromCss = CATEGORIES.map((c) => cssToken(`cat-${c.slug}-vivid-light`));
  assert.equal(fromCard.length, 8);
  assert.deepEqual(fromCard, fromCss);
});

test('card copy: the four exact strings from the UI-SPEC Copywriting Contract (D-06)', () => {
  for (const text of [
    'El Paso news, in brief.',
    'Summaries of reporting by KTSM, KVIA and other El Paso outlets — always credited, always linked.',
    'Noticias de El Paso, en breve.',
    'Resúmenes de reportajes de KTSM, KVIA y otros medios de El Paso: siempre con crédito, siempre con enlace.',
  ]) {
    assert.ok(CARD.includes(text), `card.html contains: ${text}`);
  }
});

test('hygiene: render source has no file scheme and no absolute /home/ path (T-07-06)', () => {
  for (const file of ['tools/og-card/card.html', 'tools/og-card/render.mjs', 'tools/og-card/ico.mjs']) {
    const text = readText(file);
    assert.ok(!/file:/.test(text), `${file} has no "file:"`);
    assert.ok(!text.includes('/home/'), `${file} has no "/home/"`);
  }
});

test('redirect shadowing: no _redirects rule matches the five asset paths (T-07-08)', () => {
  const assets = ['/og-image.png', '/og-image-es.png', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png'];
  const sources = readText('public/_redirects')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/)[0]);
  assert.ok(sources.length > 0, 'parsed at least one redirect rule');
  for (const source of sources) {
    for (const asset of assets) {
      // A source shadows an asset when it equals it, is a path prefix of it, or is a splat/placeholder
      // pattern that could match it.
      const prefix = source.replace(/\*$/, '');
      const shadows = source === asset || asset.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || /[*:]/.test(source) && asset.startsWith(prefix);
      assert.ok(!shadows, `redirect "${source}" must not shadow ${asset}`);
    }
  }
});

// 07-06, D-10: the og:image:alt text describes the card, so it must be the site name plus the exact
// tagline printed on that language's card. Regex-only parse of the COPY object in card.html.
function cardTagline(lang) {
  const block = CARD.match(new RegExp(`\\b${lang}:\\s*\\{[^}]*?tagline:\\s*'([^']+)'`));
  assert.ok(block, `card.html COPY.${lang}.tagline found`);
  return block[1];
}

for (const lang of ['en', 'es']) {
  test(`alt parity: SHARE_IMAGE_ALT.${lang} is "915 TLDR — " + the ${lang} card tagline (D-10)`, () => {
    assert.equal(SHARE_IMAGE_ALT[lang], `915 TLDR \u2014 ${cardTagline(lang)}`);
  });
}

#!/usr/bin/env node
// 07-02 (SOC-05, SOC-06): renders the share cards (and, in the icons step, the favicon.ico and
// apple-touch-icon) from committed, hand-composed source. Run it with:
//
//   node tools/og-card/render.mjs
//
// It reads only files inside this repo (tools/og-card/, public/fonts/, public/favicon.svg) and
// writes public/og-image.png, public/og-image-es.png, public/favicon.ico and
// public/apple-touch-icon.png.
//
// Why an `.invalid` origin: card.html uses root-relative URLs, so the page must be served from
// an origin. Every request to http://og-card.invalid is fulfilled from an allow-list of local
// paths by page.route(); anything else is aborted and recorded, and any recorded abort fails
// the run. That proves no network request, remote font or AI service is involved (T-07-05).
// `.invalid` is a reserved TLD that can never resolve, so even a routing slip cannot reach out.
//
// Why unique font family names ("OG Card Display" / "OG Card Serif"): this machine has
// "Instrument Serif" and "Source Serif 4" installed as local fonts, and a same-named local font
// can win over a webfont (STATE.md, Phase 1 entry 11). Unique names mean only the woff2 files
// in public/fonts can match.
//
// Every self-check fails loudly with the measured value; no threshold is loosened to pass.

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { encodeIco } from './ico.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CARD_DIR = path.join(REPO_ROOT, 'tools/og-card');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const ORIGIN = 'http://og-card.invalid';

const FONT_FILES = new Set([
  'InstrumentSerif-Regular.woff2',
  'SourceSerif4-Roman.woff2',
  'SourceSerif4-Italic.woff2',
]);

const PAPER = [0xfa, 0xfa, 0xf8];
const CARD_OUT = { en: 'og-image.png', es: 'og-image-es.png' };

// UI-SPEC "Color": the sRGB the 8 stripe oklch values resolve to in Chromium.
const STRIPE_HEX = ['#CA5551', '#5D78D9', '#C55F19', '#199951', '#896ACF', '#C5547D', '#6C8E01', '#0388CE'];

// UI-SPEC "Card geometry": pixel bands (y ranges) whose leftmost ink must sit within 84..88.
const INK_BANDS = [
  ['logo', 77, 154],
  ['wordmark', 209, 350],
  ['tagline', 401, 447],
  ['credit', 520, 548],
];

const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${message}`);
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Serves the allow-listed local files under ORIGIN; aborts and records everything else.
async function installRoutes(context, aborted, extra = {}) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN) {
      if (url.pathname === '/card.html') {
        return route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(CARD_DIR, 'card.html')) });
      }
      if (url.pathname === '/logo-light.png') {
        return route.fulfill({ contentType: 'image/png', body: readFileSync(path.join(CARD_DIR, 'logo-light.png')) });
      }
      const fontName = url.pathname.startsWith('/fonts/') ? url.pathname.slice('/fonts/'.length) : null;
      if (fontName && FONT_FILES.has(fontName)) {
        return route.fulfill({ contentType: 'font/woff2', body: readFileSync(path.join(PUBLIC_DIR, 'fonts', fontName)) });
      }
      if (extra[url.pathname]) {
        return route.fulfill(extra[url.pathname]());
      }
    }
    aborted.push(url.href);
    return route.abort();
  });
}

// Runs inside the browser: decode a PNG (as a data URL) onto a canvas and return pixel access
// helpers' results. `job` is a serialisable description of what to measure.
async function analysePng(page, pngBuffer, job) {
  const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  return page.evaluate(async ({ dataUrl, job }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const px = (x, y) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const out = { width, height };
    if (job.bands) {
      out.leftmost = {};
      for (const [name, y0, y1] of job.bands) {
        let found = -1;
        for (let x = 0; x < width && found < 0; x++) {
          for (let y = y0; y <= y1; y++) {
            const p = px(x, y);
            if (Math.max(Math.abs(p[0] - job.bg[0]), Math.abs(p[1] - job.bg[1]), Math.abs(p[2] - job.bg[2])) >= 16) {
              found = x;
              break;
            }
          }
        }
        out.leftmost[name] = found;
      }
    }
    if (job.samples) out.samples = job.samples.map(([x, y]) => px(x, y));
    if (job.inkBox) {
      // Bounding box of pixels that differ from the background by 16 or more in any channel.
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = px(x, y);
          if (Math.max(Math.abs(p[0] - job.bg[0]), Math.abs(p[1] - job.bg[1]), Math.abs(p[2] - job.bg[2])) >= 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      out.inkBox = { minX, minY, maxX, maxY };
    }
    return out;
  }, { dataUrl, job });
}

async function renderCard(context, aborted, lang) {
  console.log(`card ${lang}`);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`${ORIGIN}/card.html?lang=${lang}`);
  await page.evaluate(() => document.fonts.ready);

  const fonts = await page.evaluate(() => ({
    faces: [...document.fonts].map((f) => `${f.family} ${f.style} ${f.status}`),
    allLoaded: [...document.fonts].length === 3 && [...document.fonts].every((f) => f.status === 'loaded'),
    display: document.fonts.check('188px "OG Card Display"'),
  }));
  check(fonts.allLoaded, `all 3 FontFace entries loaded (${fonts.faces.join('; ')})`);
  check(fonts.display, 'document.fonts.check("188px OG Card Display") is true');

  const geo = await page.evaluate(() => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    const textRange = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range;
    };
    const h1 = document.querySelector('h1');
    const tag = document.getElementById('tag');
    const credit = document.getElementById('credit');
    const creditRange = textRange(credit);
    return {
      creditScrollWidth: credit.scrollWidth,
      creditRects: creditRange.getClientRects().length,
      creditBox: rect(credit),
      wordmarkRight: textRange(h1).getBoundingClientRect().right,
      taglineRight: textRange(tag).getBoundingClientRect().right,
      taglineBox: rect(tag),
    };
  });
  console.log(`  measured: credit scrollWidth=${geo.creditScrollWidth} left=${geo.creditBox.left} right=${geo.creditBox.right.toFixed(1)}; tagline right=${geo.taglineRight.toFixed(1)}; wordmark right=${geo.wordmarkRight.toFixed(1)}`);
  check(geo.creditScrollWidth <= 1028, `credit line scrollWidth ${geo.creditScrollWidth} <= 1028`);
  check(geo.creditRects === 1, `credit line is exactly one line (${geo.creditRects} client rect)`);
  check(geo.taglineRight < geo.wordmarkRight, `tagline right ${geo.taglineRight.toFixed(1)} < wordmark right ${geo.wordmarkRight.toFixed(1)}`);

  const outPath = path.join(PUBLIC_DIR, CARD_OUT[lang]);
  const png = await page.screenshot({ type: 'png', omitBackground: false });
  writeFileSync(outPath, png);
  await page.close();
  console.log(`  wrote ${path.relative(REPO_ROOT, outPath)} (${statSync(outPath).size} bytes)`);

  const probe = await context.newPage();
  const pixels = await analysePng(probe, png, {
    bg: PAPER,
    bands: INK_BANDS,
    samples: STRIPE_HEX.map((_, i) => [75 + 150 * i, 620]),
  });
  await probe.close();
  check(pixels.width === 1200 && pixels.height === 630, `decoded size ${pixels.width}x${pixels.height} is 1200x630`);
  for (const [name] of INK_BANDS) {
    const x = pixels.leftmost[name];
    check(x >= 84 && x <= 88, `leftmost ink of ${name} is x=${x} (want 84..88)`);
  }
  STRIPE_HEX.forEach((hex, i) => {
    const want = hexToRgb(hex);
    const got = pixels.samples[i];
    const ok = got.every((c, k) => Math.abs(c - want[k]) <= 3);
    check(ok, `stripe segment ${i} at y=620 is rgb(${got.join(',')}) (want ${hex} within 3)`);
  });
}

// Page served at /icon-favicon.html: the favicon.svg on a transparent body at its native 32x32.
const FAVICON_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; background: transparent; }
img { display: block; width: 32px; height: 32px; }
</style></head><body><img id="icon" src="/favicon.svg" width="32" height="32" alt=""></body></html>`;

// Page served at /icon-touch.html: crops the bubble mark to its alpha bounding box, scales it to
// 148px wide and centres it on a 180x180 opaque #FAFAF8 canvas shown full-bleed.
const TOUCH_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; background: #FAFAF8; }
canvas { display: block; }
</style></head><body><canvas id="c" width="180" height="180"></canvas><script>
window.touchReady = (async () => {
  const img = new Image();
  img.src = '/logo-light.png';
  await img.decode();
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const { data } = sctx.getImageData(0, 0, src.width, src.height);
  let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (data[(y * src.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const targetW = 148;
  const targetH = bh * (targetW / bw);
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(0, 0, 180, 180);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, minX, minY, bw, bh, (180 - targetW) / 2, (180 - targetH) / 2, targetW, targetH);
  return { bw, bh, targetH };
})();
</script></body></html>`;

async function renderIcons(context) {
  console.log('icons');
  console.log(`  fc-match Arial -> ${execFileSync('fc-match', ['Arial']).toString().trim()}`);

  // D-23: favicon.ico is a single 32x32 rasterisation of favicon.svg (transparent corners).
  const fav = await context.newPage();
  await fav.setViewportSize({ width: 32, height: 32 });
  await fav.goto(`${ORIGIN}/icon-favicon.html`);
  await fav.evaluate(() => document.getElementById('icon').decode());
  const favPng = await fav.screenshot({ type: 'png', omitBackground: true });
  await fav.close();
  const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  writeFileSync(icoPath, encodeIco([{ size: 32, png: favPng }]));
  console.log(`  wrote ${path.relative(REPO_ROOT, icoPath)} (${statSync(icoPath).size} bytes, 1 entry 32x32)`);

  // apple-touch-icon: opaque 180x180, bubble mark at 148px ink width, centred.
  const touch = await context.newPage();
  await touch.setViewportSize({ width: 180, height: 180 });
  await touch.goto(`${ORIGIN}/icon-touch.html`);
  const crop = await touch.evaluate(() => window.touchReady);
  console.log(`  logo alpha ink box ${crop.bw}x${crop.bh} -> 148x${crop.targetH.toFixed(1)}`);
  const touchPng = await touch.screenshot({ type: 'png', omitBackground: false });
  await touch.close();
  const touchPath = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  writeFileSync(touchPath, touchPng);
  console.log(`  wrote ${path.relative(REPO_ROOT, touchPath)} (${statSync(touchPath).size} bytes)`);

  const probe = await context.newPage();
  const pixels = await analysePng(probe, touchPng, { bg: PAPER, inkBox: true });
  await probe.close();
  const { minX, minY, maxX, maxY } = pixels.inkBox;
  const inkW = maxX - minX + 1;
  const marginL = minX;
  const marginR = pixels.width - 1 - maxX;
  const marginT = minY;
  const marginB = pixels.height - 1 - maxY;
  console.log(`  apple-touch-icon ink box x ${minX}..${maxX} (width ${inkW}), y ${minY}..${maxY}; margins L${marginL} R${marginR} T${marginT} B${marginB}`);
  check(pixels.width === 180 && pixels.height === 180, `apple-touch-icon decoded size ${pixels.width}x${pixels.height} is 180x180`);
  check(inkW >= 147 && inkW <= 149, `apple-touch-icon ink width ${inkW} is 148 +/- 1`);
  check(Math.abs(marginL - marginR) <= 1, `apple-touch-icon horizontally centred (L${marginL} R${marginR})`);
  check(Math.abs(marginT - marginB) <= 1, `apple-touch-icon vertically centred (T${marginT} B${marginB})`);
  check(Math.min(marginL, marginR, marginT, marginB) >= 16, `apple-touch-icon clear margin is at least 16px (min ${Math.min(marginL, marginR, marginT, marginB)})`);
}

const aborted = [];
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await installRoutes(context, aborted, {
    '/favicon.svg': () => ({ contentType: 'image/svg+xml', body: readFileSync(path.join(PUBLIC_DIR, 'favicon.svg')) }),
    '/icon-favicon.html': () => ({ contentType: 'text/html', body: FAVICON_PAGE }),
    '/icon-touch.html': () => ({ contentType: 'text/html', body: TOUCH_PAGE }),
  });
  for (const lang of ['en', 'es']) {
    await renderCard(context, aborted, lang);
  }
  await renderIcons(context);
  check(aborted.length === 0, `aborted (non-allow-listed) requests: ${aborted.length}${aborted.length ? ' -> ' + aborted.join(', ') : ''}`);
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\nrender FAILED: ${failures.length} check(s) failed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nrender ok');

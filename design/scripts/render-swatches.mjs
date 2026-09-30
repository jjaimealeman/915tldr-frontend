#!/usr/bin/env node
// D-01/D-02/D-03/C-01: renders swatch evidence for the owner's palette
// judgement, using the real production stylesheet and fonts rather than a
// hand-built colour chip page. Every stop's rendered hex is read back from
// the page's own computed styles (never recomputed in Node), so the PNGs
// show exactly what a browser paints from style.css today.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { startServer } from './serve-mockups.mjs';

const PALETTE_PATH = 'design/palette/palette.json';
const OUT_LIGHT = 'design/evidence/palette-swatches-light.png';
const OUT_DARK = 'design/evidence/palette-swatches-dark.png';
const VIEWPORT_WIDTH = 1200;

const STOPS = [
  { key: 'vivid-light', label: 'vivid-light' },
  { key: 'block', label: 'block' },
  { key: 'vivid-dark', label: 'vivid-dark' },
];

function buildSwatchHtml(categories) {
  const rows = categories
    .map((category) => {
      const { slug, name } = category;
      return `
    <section data-swatch-row data-category="${slug}">
      <h2 data-swatch-name>${name}</h2>
      <div data-swatch-grid>
        <span data-stripe></span>
        <h3 data-swatch-headline>The ${name} beat, in two lines of Instrument Serif to preview wrap</h3>
      </div>
      <div data-swatch-block style="background: var(--cat-${slug}-block)">
        <p data-swatch-masthead>${name}</p>
        <p data-swatch-dateline>Sept. 16, 2026</p>
      </div>
      <ul data-swatch-hex data-slug="${slug}">
        ${STOPS.map((stop) => `<li data-stop="${stop.key}" data-probe style="color: var(--cat-${slug}-${stop.key})"></li>`).join('\n        ')}
      </ul>
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Palette swatches — evidence build</title>
<link rel="stylesheet" href="style.css">
<style>
  body { margin: 0; padding: 2rem; font-family: var(--font-body); background: var(--paper); color: var(--ink); }
  [data-swatch-row] { margin-bottom: var(--space-8); }
  [data-swatch-name] { font-family: var(--font-body); font-size: var(--step-1); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 var(--space-3); }
  [data-swatch-grid] { background: var(--paper); border: var(--rule-thin) solid var(--rule); padding: var(--space-5); margin-bottom: var(--space-4); }
  [data-swatch-grid] [data-stripe] { display: inline-block; width: var(--space-6); height: var(--rule-thick); background: var(--cat, var(--cat-none)); margin-bottom: var(--space-3); border-radius: 1px; }
  [data-swatch-headline] { font-family: var(--font-display); font-size: var(--step-3); line-height: var(--leading-display); color: var(--ink); margin: 0; max-width: 40ch; }
  [data-swatch-block] { padding: var(--space-5); }
  [data-swatch-masthead] { font-family: var(--font-display); font-size: var(--step-6); line-height: var(--leading-display); color: var(--block-ink); margin: 0 0 var(--space-2); }
  [data-swatch-dateline] { font-family: var(--font-body); font-size: var(--step-0); color: var(--block-ink); margin: 0; }
  [data-swatch-hex] { display: flex; gap: var(--space-5); list-style: none; margin: var(--space-3) 0 0; padding: 0; font-family: monospace; font-size: var(--step--1); }
  [data-swatch-hex] li[data-probe]::before { content: attr(data-stop) ": " attr(data-hex); }
</style>
</head>
<body>
<main>${rows}
</main>
</body>
</html>`;
}

/** Reads each probe element's resolved `color` (set from a --cat-*-<stop>
 * custom property) and converts it to a hex string entirely inside the
 * page — never re-derived in Node. Chromium's `getComputedStyle` echoes an
 * `oklch()`-authored value back as the literal string "oklch(...)" rather
 * than converting it to rgb(), so the conversion goes through a 1x1 canvas
 * instead: the canvas 2D context's colour parser resolves any valid CSS
 * colour (including oklch()) to the actual rasterised device RGB. */
async function readHexesAndAnnotate(page) {
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    function cssColorToHex(cssColor) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    for (const probe of document.querySelectorAll('[data-probe]')) {
      const computed = getComputedStyle(probe).color;
      probe.setAttribute('data-hex', cssColorToHex(computed));
    }
  });
}

/** Waits for document.fonts.ready and asserts the two primary families
 * actually reached 'loaded' (not just 'unloaded'/'loading') for the
 * variants this page uses — see 01-02's geometry.ts for why FontFace
 * status, not a timeout, is the correct check here. */
async function assertFontsLoaded(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const result = await page.evaluate(() => {
    const families = ['Instrument Serif', 'Source Serif 4'];
    const statusByFamily = {};
    for (const family of families) {
      const faces = [...document.fonts].filter((f) => f.family === family);
      statusByFamily[family] = faces.map((f) => f.status);
    }
    return statusByFamily;
  });

  for (const [family, statuses] of Object.entries(result)) {
    const anyLoaded = statuses.some((status) => status === 'loaded');
    if (!anyLoaded) {
      throw new Error(
        `assertFontsLoaded: no "${family}" FontFace reached status "loaded" (saw: ${JSON.stringify(statuses)})`
      );
    }
  }
  console.log('render-swatches: fonts loaded ->', JSON.stringify(result));
}

async function main() {
  const paletteRaw = await import('node:fs/promises').then((fs) =>
    fs.readFile(PALETTE_PATH, 'utf8')
  );
  const palette = JSON.parse(paletteRaw);
  const categories = [...palette.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const { url, close } = await startServer({ port: 0 });
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: VIEWPORT_WIDTH, height: 900 } });
    await page.goto(`${url}/mockups/`);
    await page.setContent(buildSwatchHtml(categories));

    await assertFontsLoaded(page);
    await readHexesAndAnnotate(page);

    await mkdir(path.dirname(path.resolve(OUT_LIGHT)), { recursive: true });

    await page.screenshot({ path: OUT_LIGHT, fullPage: true });
    console.log(`render-swatches: wrote ${OUT_LIGHT}`);

    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    // Re-read hexes: the block/dark-theme --cat-*-block literal is
    // theme-invariant, but re-annotating keeps the on-page text honest for
    // anyone inspecting the dark screenshot directly (--block-ink text
    // colour and --cat alias both do change per theme).
    await readHexesAndAnnotate(page);
    await page.screenshot({ path: OUT_DARK, fullPage: true });
    console.log(`render-swatches: wrote ${OUT_DARK}`);
  } finally {
    await browser.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pagesUnderTest } from './support/harness.ts';
import { measureFontSwap } from './support/geometry.ts';
import { collectPageText } from '../scripts/lib/glyphs.mjs';

// Serial: measureFontSwap results are appended (read-modify-write) to a
// shared design/.cache/font-cls-<engine>.json per engine; fullyParallel
// (playwright.config.ts) would race that write across workers otherwise.
test.describe.configure({ mode: 'serial' });

const CACHE_DIR = path.resolve('design/.cache');
const MANIFEST_PATH = path.resolve('design/mockups/fonts/subset-manifest.json');

function appendFontClsResult(engine: string, result: unknown) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `font-cls-${engine}.json`);
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  existing.push(result);
  writeFileSync(file, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

for (const name of pagesUnderTest()) {
  for (const width of [320, 1280]) {
    test(`font swap is CLS-safe: ${name} @ ${width}px @c5`, async ({ page }) => {
      const result = await measureFontSwap(page, name as any, {
        width,
        theme: 'light',
        scroll: 'top',
      });

      expect(
        result.fallbackFacesLoaded.length,
        'no metric-compatible fallback face available — measurement meaningless'
      ).toBeGreaterThan(0);

      expect(result.geometryScore).toBeLessThan(0.005);

      if (result.nativeSupported) {
        expect(result.nativeCls).not.toBeNull();
        expect(result.nativeCls as number).toBeLessThan(0.005);
        // The geometry instrument must not be blind relative to Chromium's
        // own native CLS — it may report *more* shift than native (it
        // measures a coarser, rasterised approximation) but not meaningfully
        // less.
        expect(result.geometryScore).toBeGreaterThanOrEqual((result.nativeCls as number) - 0.001);
      } else {
        expect(result.nativeCls).toBeNull();
      }

      appendFontClsResult(result.engine, result);
    });
  }

  test(`every rendered character on ${name} is in the font subset @c5`, async ({ page }) => {
    const response = await page.goto(`/mockups/${name}.html`);
    expect(response?.status()).toBe(200);

    const text: string = await page.evaluate(collectPageText);
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const codepoints: string[] = manifest.codepoints;
    const codepointSet = new Set(codepoints);

    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      // Control characters (line breaks from innerText, etc.) are layout
      // artifacts, not rendered glyphs — build-fonts.mjs excludes them from
      // the subset for the same reason (see its crawlGlyphSet filter).
      if (cp < 0x20 || cp === 0x7f) continue;
      const hex = cp.toString(16).toUpperCase();
      if (!codepointSet.has(hex)) missing.add(`${JSON.stringify(ch)} (U+${hex})`);
    }

    expect([...missing], 'characters rendered on the page but absent from the font subset').toEqual([]);
  });
}

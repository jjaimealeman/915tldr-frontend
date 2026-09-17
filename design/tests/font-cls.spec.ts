import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pagesUnderTest } from './support/harness.ts';
import { measureFontSwap, listLoadableFallbacks, type FontSwapVariant } from './support/geometry.ts';
import { loadSpanishFixture } from './support/i18n.ts';
import { collectPageText } from '../scripts/lib/glyphs.mjs';

/**
 * No describe.configure({ mode: 'serial' }) here (unlike 01-02's original
 * version of this file): each (page, width) test now writes its own
 * uniquely-named fragment file under design/.cache/font-cls-fragments/,
 * never a shared read-modify-write target — so tests can run fully in
 * parallel with no race, AND a failure in one test's matrix no longer
 * cascade-skips every later page/width the way serial mode's own
 * fail-fast semantics did (the exact "serial mode hides later pages"
 * problem 01-06/01-07-SUMMARY.md already documented and worked around by
 * hand for the old, single-variant version of this file). report-font-cls.mjs
 * merges every fragment for an engine into the canonical
 * design/.cache/font-cls-<engine>.json.
 */
const FRAGMENTS_DIR = path.resolve('design/.cache/font-cls-fragments');
const MANIFEST_PATH = path.resolve('design/mockups/fonts/subset-manifest.json');
const VARIANTS: FontSwapVariant[] = ['full', 'size-adjust-only'];
const SCROLLS = ['top', 'mid'] as const;

function writeFragment(engine: string, name: string, width: number, results: unknown[]) {
  mkdirSync(FRAGMENTS_DIR, { recursive: true });
  const file = path.join(FRAGMENTS_DIR, `${engine}__${name}__${width}.json`);
  writeFileSync(file, JSON.stringify(results, null, 2) + '\n', 'utf8');
}

for (const name of pagesUnderTest()) {
  for (const width of [320, 1280] as const) {
    test(`font swap is CLS-safe across the swap matrix: ${name} @ ${width}px @c5`, async ({ page, browser }) => {
      const engine = browser.browserType().name();

      // document.fonts is only populated once a page carrying the fonts
      // region's @font-face rules has actually loaded — the default `page`
      // fixture starts blank. document.fonts.ready is awaited too: WebKit
      // (via the pinned Docker image) needs a moment after navigation
      // settles before its local()-list font matching against installed
      // system fonts stabilises, and calling listLoadableFallbacks before
      // that produced flaky, environment-timing-dependent empty results.
      await page.goto(`/mockups/${name}.html`);
      await page.evaluate(() => document.fonts.ready);
      const loadableFallbacks = await listLoadableFallbacks(page);
      expect(
        loadableFallbacks.length,
        'no metric-compatible fallback face available — measurement meaningless'
      ).toBeGreaterThan(0);

      const results: unknown[] = [];

      for (const scroll of SCROLLS) {
        for (const variant of VARIANTS) {
          for (const fallbackFamily of loadableFallbacks) {
            const label = `${name}@${width}px scroll=${scroll} variant=${variant} fallback=${fallbackFamily} (${engine})`;

            // A fresh context/page per combination: measureFontSwap
            // registers page.route() handlers (holdFonts, the style.css
            // override) without ever unrouting them, so reusing one page
            // across many combinations would stack stale handlers — a
            // fresh page per combination matches "each combination is a
            // real, independent page load" and keeps every route override
            // scoped to exactly the combination it belongs to.
            const context = await browser.newContext();
            const combinationPage = await context.newPage();
            try {
              const result = await measureFontSwap(combinationPage, name as any, {
                width,
                theme: 'light',
                scroll,
                variant,
                fallbackFamily,
              });
              results.push(result);

              // expect.soft: every combination in the matrix must actually
              // run and be recorded (and every fragment file written),
              // even when an earlier combination in this same test fails.
              expect
                .soft(result.fallbackFacesLoaded.length, `${label}: fallback face must actually load`)
                .toBeGreaterThan(0);
              expect.soft(result.geometryScore, `${label}: geometryScore`).toBeLessThan(0.005);

              if (result.nativeSupported) {
                expect.soft(result.nativeCls, `${label}: nativeCls must be reported when supported`).not.toBeNull();
                expect.soft(result.nativeCls as number, `${label}: nativeCls`).toBeLessThan(0.005);
                // The geometry instrument must not be blind relative to
                // native CLS — it may report *more* shift than native (a
                // coarser, rasterised approximation) but not meaningfully
                // less.
                expect
                  .soft(result.geometryScore, `${label}: geometryScore vs nativeCls`)
                  .toBeGreaterThanOrEqual((result.nativeCls as number) - 0.001);
              } else {
                expect.soft(result.nativeCls, `${label}: nativeCls must be null when unsupported`).toBeNull();
              }
            } finally {
              await context.close();
            }
          }
        }
      }

      // Written unconditionally (even if some combinations above failed
      // their soft assertions) so the evidence report always reflects the
      // full matrix this run actually measured.
      writeFragment(engine, name, width, results);
    });
  }

  test(`every rendered character on ${name}, including every Spanish fixture string, is in the font subset @c5`, async ({
    page,
  }) => {
    const response = await page.goto(`/mockups/${name}.html`);
    expect(response?.status()).toBe(200);

    const pageText: string = await page.evaluate(collectPageText);
    const fixture = loadSpanishFixture();
    const fixtureText = fixture.components.map((c) => `${c.en}${c.es_real}${c.es_synthetic}`).join('');
    const text = pageText + fixtureText;

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

    expect(
      [...missing],
      'characters rendered on the page, or in a Spanish fixture string, but absent from the font subset'
    ).toEqual([]);
  });
}

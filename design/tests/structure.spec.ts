import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { formatHex } from 'culori';
import { openPage, pagesUnderTest, THEME_STORAGE_KEY } from './support/harness.ts';
import { extractRegion, parseTokenRules, resolveTheme, toSrgb } from '../scripts/lib/css-tokens.mjs';

const STYLE_CSS_PATH = path.resolve('design/mockups/style.css');

function readTokens() {
  const css = readFileSync(STYLE_CSS_PATH, 'utf8');
  const rules = parseTokenRules(extractRegion(css, 'tokens'));
  return {
    light: resolveTheme(rules, 'light'),
    dark: resolveTheme(rules, 'dark'),
  };
}

for (const name of pagesUnderTest()) {
  test.describe(`structure: ${name}`, () => {
    test(`loads 200 with exactly one h1 @c1`, async ({ page }) => {
      const { response } = await openPage(page, name as any);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
    });

    test(`theme attribute and --paper track the light/dark tokens @c1`, async ({ page }) => {
      const tokens = readTokens();

      await openPage(page, name as any, { theme: 'light' });
      const lightAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(lightAttr).toBeNull();
      const lightPaperRaw = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
      );
      expect(formatHex(toSrgb(lightPaperRaw))).toBe(formatHex(toSrgb(tokens.light.get('--paper')!)));

      await openPage(page, name as any, { theme: 'dark' });
      const darkAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(darkAttr).toBe('dark');
      const darkPaperRaw = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
      );
      expect(formatHex(toSrgb(darkPaperRaw))).toBe(formatHex(toSrgb(tokens.dark.get('--paper')!)));
    });

    test(`theme toggle is keyboard-operable and persists across reload @c1`, async ({ page, baseURL }) => {
      await openPage(page, name as any);
      const toggle = page.locator('[data-theme-toggle]');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await toggle.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // Verify persistence with a *new* page in the same context rather than
      // page.reload(): openPage's addInitScript is bound to `page` for its
      // whole lifetime and re-seeds localStorage on every navigation
      // (including reload) from the theme it was called with, which would
      // silently overwrite the toggle's own write. A fresh page shares
      // localStorage (same origin, same context) without carrying that
      // init script, so it exercises exactly what production does: the
      // page's own inline script reading localStorage on load.
      const pagePath = name === 'harness' ? '/tests/fixtures/harness.html' : `/mockups/${name}.html`;
      const freshPage = await page.context().newPage();
      await freshPage.goto(`${baseURL}${pagePath}`);
      await expect(freshPage.locator('html')).toHaveAttribute('data-theme', 'dark');
      const stored = await freshPage.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY);
      expect(stored).toBe('dark');
      await freshPage.close();
    });

    test(`[data-grid] is populated pure HTML with no inline handlers @c5`, async ({ page }) => {
      await openPage(page, name as any);
      const grids = page.locator('[data-grid]');
      const gridCount = await grids.count();
      expect(gridCount).toBeGreaterThan(0);

      for (let i = 0; i < gridCount; i++) {
        const grid = grids.nth(i);
        await expect(grid.locator('[data-card]')).not.toHaveCount(0);
        expect(await grid.locator('script').count()).toBe(0);

        const hasOnAttr = await grid.evaluate((el) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
          let node: Element | null = el as Element;
          do {
            for (const attr of Array.from(node.attributes)) {
              if (attr.name.toLowerCase().startsWith('on')) return true;
            }
          } while ((node = walker.nextNode() as Element | null));
          return false;
        });
        expect(hasOnAttr).toBe(false);
      }
    });

    test(`grid renders identically with JavaScript disabled, toggle stays hidden @c5`, async ({ browser, baseURL }) => {
      const contextWithJs = await browser.newContext();
      const pageWithJs = await contextWithJs.newPage();
      await openPage(pageWithJs, name as any);
      const cardCountWithJs = await pageWithJs.locator('[data-card]').count();
      const gridTextWithJs = await pageWithJs.locator('[data-grid]').first().innerText();
      await contextWithJs.close();

      const contextNoJs = await browser.newContext({ javaScriptEnabled: false });
      const pageNoJs = await contextNoJs.newPage();
      const pagePath = name === 'harness' ? '/tests/fixtures/harness.html' : `/mockups/${name}.html`;
      await pageNoJs.goto(`${baseURL}${pagePath}`);
      const cardCountNoJs = await pageNoJs.locator('[data-card]').count();
      const gridTextNoJs = await pageNoJs.locator('[data-grid]').first().innerText();
      const toggleVisibleNoJs = await pageNoJs.locator('[data-theme-toggle]').isVisible();
      await contextNoJs.close();

      expect(cardCountNoJs).toBe(cardCountWithJs);
      expect(gridTextNoJs).toBe(gridTextWithJs);
      expect(toggleVisibleNoJs).toBe(false);
    });

    test(`body is set in Source Serif 4; headlines are set in Instrument Serif @c5`, async ({ page }) => {
      await openPage(page, name as any);

      const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(bodyFont.startsWith('"Source Serif 4"')).toBe(true);

      const hasLead = (await page.locator('[data-lead]').count()) > 0;

      const headlineFonts = await page.evaluate((hasLead) => {
        const els = hasLead
          ? [
              ...Array.from(document.querySelectorAll('[data-card] h3')),
              ...Array.from(document.querySelectorAll('[data-lead] h2')),
            ]
          : [document.querySelector('h1')].filter(Boolean);
        return els.map((el) => getComputedStyle(el as Element).fontFamily);
      }, hasLead);

      expect(headlineFonts.length).toBeGreaterThan(0);
      for (const font of headlineFonts) {
        expect(font.startsWith('"Instrument Serif"')).toBe(true);
      }
    });
  });
}

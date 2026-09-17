import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { formatHex } from 'culori';
import { openPage, pagesUnderTest, WIDTHS, THEMES, THEME_STORAGE_KEY } from './support/harness.ts';
import { CANONICAL_SLUGS, extractRegion, parseTokenRules, resolveTheme, toSrgb } from '../scripts/lib/css-tokens.mjs';

const STYLE_CSS_PATH = path.resolve('design/mockups/style.css');
const EVIDENCE_PAGES_DIR = path.resolve('design/evidence/pages');

function readTokens() {
  const css = readFileSync(STYLE_CSS_PATH, 'utf8');
  const rules = parseTokenRules(extractRegion(css, 'tokens'));
  return {
    light: resolveTheme(rules, 'light'),
    dark: resolveTheme(rules, 'dark'),
  };
}

function pagePath(name: string): string {
  return name === 'harness' ? '/tests/fixtures/harness.html' : `/mockups/${name}.html`;
}

function firstFamily(fontFamilyValue: string): string {
  // getComputedStyle().fontFamily's *first* family name is what matters here;
  // whether that name is serialised quoted ("Instrument Serif") or as an
  // unquoted multi-ident sequence (Instrument Serif) is an engine choice —
  // Chromium always preserves the authored quoting, WebKit re-serialises to
  // the minimal form that doesn't need quotes (only names containing a
  // character invalid in a bare ident, e.g. the digit in "Source Serif 4" or
  // the colon in a capsize fallback name, force it to stay quoted). Strip
  // optional surrounding quotes before comparing so the assertion holds in
  // both engines.
  const first = fontFamilyValue.split(',')[0].trim();
  const match = first.match(/^"(.*)"$/);
  return match ? match[1] : first;
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
      const freshPage = await page.context().newPage();
      await freshPage.goto(`${baseURL}${pagePath(name)}`);
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
      await pageNoJs.goto(`${baseURL}${pagePath(name)}`);
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
      expect(firstFamily(bodyFont)).toBe('Source Serif 4');

      const hasLead = (await page.locator('[data-lead]').count()) > 0;

      const headlineFonts = await page.evaluate((hasLead) => {
        const els = hasLead
          ? [
              ...Array.from(document.querySelectorAll('[data-card] h3')),
              ...Array.from(document.querySelectorAll('[data-lead] h2')),
              ...Array.from(document.querySelectorAll('[data-dispatch] h2')),
            ]
          : [document.querySelector('h1')].filter(Boolean);
        return els.map((el) => getComputedStyle(el as Element).fontFamily);
      }, hasLead);

      expect(headlineFonts.length).toBeGreaterThan(0);
      for (const font of headlineFonts) {
        expect(firstFamily(font)).toBe('Instrument Serif');
      }
    });

    test(`document.fonts contains only the two families or their named fallbacks @c5`, async ({ page }) => {
      await openPage(page, name as any);
      await page.evaluate(() => document.fonts.ready);

      const families = await page.evaluate(() => {
        const set = new Set<string>();
        document.fonts.forEach((face) => set.add(face.family.replace(/^"(.*)"$/, '$1')));
        return Array.from(set);
      });

      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        const allowed =
          family === 'Instrument Serif' ||
          family === 'Source Serif 4' ||
          family.startsWith('Instrument Serif Fallback') ||
          family.startsWith('Source Serif 4 Fallback');
        expect(allowed, `unexpected font family in document.fonts: ${family}`).toBe(true);
      }
    });

    test(`no font or stylesheet request leaves 127.0.0.1 @c5`, async ({ page }) => {
      const { blocked } = await openPage(page, name as any);
      await page.waitForLoadState('networkidle');

      const disallowed = blocked.filter((url) => {
        const lower = url.toLowerCase();
        if (/\.(woff2?|ttf|otf|css)(\?|$)/.test(lower)) return true;
        if (lower.includes('fonts.googleapis.com') || lower.includes('fonts.gstatic.com')) return true;
        return false;
      });
      expect(disallowed, `font/stylesheet request left 127.0.0.1: ${disallowed.join(', ')}`).toEqual([]);
    });

    test(`style.css has no @import @c5`, async ({ request, baseURL }) => {
      const res = await request.get(`${baseURL}/mockups/style.css`);
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body).not.toMatch(/@import/);
    });
  });
}

for (const name of pagesUnderTest()) {
  test.describe(`structure: ${name} (extended)`, () => {
    test(`landmarks: one page-level header, nav[aria-label="Sections"], main#main, footer; html[lang="en"]; es-variant lang @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);

      await expect(page.locator('body > header')).toHaveCount(1);
      await expect(page.locator('nav[aria-label="Sections"]')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      const mismatches = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[data-variant^="es"]'));
        return els.filter((el) => el.getAttribute('lang') !== 'es').map((el) => el.outerHTML.slice(0, 120));
      });
      expect(mismatches, `[data-variant^="es"] element(s) missing lang="es": ${mismatches.join(', ')}`).toEqual([]);
    });

    test(`DSGN-05: every neutral and every --cat-<slug> alias differs between light and dark @c1`, async () => {
      const tokens = readTokens();
      const checkedTokens = ['--paper', '--ink', '--ink-muted', '--rule-strong', '--block-ink', ...CANONICAL_SLUGS.map((slug) => `--cat-${slug}`)];

      for (const token of checkedTokens) {
        const lightRaw = tokens.light.get(token);
        const darkRaw = tokens.dark.get(token);
        expect(lightRaw, `${token} missing in light theme`).toBeTruthy();
        expect(darkRaw, `${token} missing in dark theme`).toBeTruthy();
        const lightHex = formatHex(toSrgb(lightRaw!));
        const darkHex = formatHex(toSrgb(darkRaw!));
        expect(lightHex, `${token} computes to the same value (${lightHex}) in both themes`).not.toBe(darkHex);
      }
    });

    test(`reduced motion: every transition-duration and animation-duration computes to 0s @c1`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      await openPage(page, name as any);

      const offenders = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const style = getComputedStyle(el);
          const durations = [...style.transitionDuration.split(','), ...style.animationDuration.split(',')].map((d) =>
            d.trim()
          );
          if (durations.some((d) => d !== '0s' && d !== '')) {
            bad.push(`${el.tagName}.${(el as HTMLElement).className || '(no class)'}: transition=${style.transitionDuration} animation=${style.animationDuration}`);
          }
        }
        return bad;
      });

      expect(offenders, `element(s) with non-zero duration under reduced motion: ${offenders.join(' | ')}`).toEqual([]);
      await context.close();
    });

    test(`every element with a direct text node has a computed line-height that is not 'normal' @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);

      const offenders = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const hasDirectText = Array.from(el.childNodes).some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0
          );
          if (!hasDirectText) continue;
          const lineHeight = getComputedStyle(el).lineHeight;
          if (lineHeight === 'normal') {
            bad.push(`${el.tagName}: "${(el.textContent || '').trim().slice(0, 40)}"`);
          }
        }
        return bad;
      });

      expect(offenders, `element(s) with line-height: normal: ${offenders.join(' | ')}`).toEqual([]);
    });

    for (const theme of THEMES) {
      for (const width of [WIDTHS.narrow, WIDTHS.medium, WIDTHS.wide]) {
        test(`evidence: full-page screenshot ${theme} @${width}px @c1 @c5`, async ({ page }, testInfo) => {
          // Evidence is captured once, from Chromium only — guarded inside
          // the test body with a plain if, never a runner-level skip
          // directive (the plan forbids that; it would report as a false
          // pass in the other engine instead of just doing nothing).
          if (testInfo.project.name === 'chromium') {
            await openPage(page, name as any, { theme, width });
            mkdirSync(EVIDENCE_PAGES_DIR, { recursive: true });
            const outPath = path.join(EVIDENCE_PAGES_DIR, `${name}-${theme}-${width}.jpg`);
            await page.screenshot({ path: outPath, fullPage: true, type: 'jpeg', quality: 70 });
            expect(existsSync(outPath)).toBe(true);
          }
        });
      }
    }
  });
}

test.describe('structure: head script drift guard', () => {
  test(`all five pages carry exactly one, identical, head script @c1`, async ({ request, baseURL }) => {
    const scripts: Record<string, string> = {};

    for (const name of pagesUnderTest()) {
      if (name === 'harness') continue;
      const res = await request.get(`${baseURL}${pagePath(name)}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const matches = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)];
      expect(matches.length, `${name}.html does not have exactly one <script>`).toBe(1);
      scripts[name] = matches[0][0];
    }

    const values = Object.values(scripts);
    const first = values[0];
    for (const [name, script] of Object.entries(scripts)) {
      expect(script, `${name}.html's head script differs from the others`).toBe(first);
    }
  });
});

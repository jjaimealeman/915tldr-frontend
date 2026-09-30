import { test, expect, type Page } from '@playwright/test';
import { openPage, pagesUnderTest, THEMES } from './support/harness.ts';

/**
 * 01-17 Task 1 — closes revision request 1 (header rule) and defect 10
 * (toggle position). Every test in this file carries @c1 so
 * verify-phase-1.mjs's criterion-1 run exercises it.
 *
 * The page-level `<header>` and the `[data-spectrum]` colour stripe are
 * body-level siblings, in that order, on all five pages; `[data-theme-toggle]`
 * is a body-level sibling between `nav` and `main`. See 01-17-PLAN.md's own
 * context for the exact markup order this file assumes.
 */

const CHROME_WIDTHS = [320, 768, 1280, 1920] as const;

function heightFor(width: number): number {
  return width === 1920 ? 1080 : 800;
}

// nav[aria-label="Sections"] a has text-transform: uppercase, and innerText
// (which both tabNames() here and design/tests/support/focus.ts's
// computeName use) reflects rendered CSS text-transform, not the source
// markup's casing — so the accessible name recorded here is the rendered
// uppercase form, matching design/evidence/keyboard/tab-order-*.json.
const CANONICAL_NAV_LABELS = ['CRIME', 'POLITICS', 'SPORTS', 'BUSINESS', 'EDUCATION', 'COMMUNITY', 'HEALTH', 'WEATHER'];

/**
 * In-page: the same aria-label-else-innerText-else-title accessible-name
 * rule design/tests/support/focus.ts's enumerateFocusables/walkTabOrder use,
 * inlined here (rather than imported) because this file only needs a plain
 * "press Tab N times, record names" walk with no dedupe/cycle-detection —
 * the exact focusable count on every page here is already known (10) and
 * fixed by the tab-order contract this test defends.
 */
async function tabNames(page: Page, presses: number): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const names: string[] = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '';
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (text) return text;
      return (el.getAttribute('title') || '').trim();
    });
    names.push(name);
  }
  return names;
}

for (const name of pagesUnderTest()) {
  test.describe(`chrome: ${name}`, () => {
    for (const theme of THEMES) {
      for (const width of CHROME_WIDTHS) {
        test(`header has no bottom border; spectrum closes the masthead; toggle stays in the content column: ${theme} @${width}px @c1`, async ({
          page,
        }) => {
          await openPage(page, name as any, { theme, width, height: heightFor(width) });

          const result = await page.evaluate(() => {
            const header = document.querySelector('body > header')!;
            const spectrum = document.querySelector('[data-spectrum]')!;
            const toggle = document.querySelector('[data-theme-toggle]')!;
            const nav = document.querySelector('nav[aria-label="Sections"]')!;

            const headerRect = header.getBoundingClientRect();
            const headerStyle = getComputedStyle(header);
            const headerBorderBottomWidth = headerStyle.borderBottomWidth;
            const headerPaddingLeft = parseFloat(headerStyle.paddingLeft) || 0;
            const headerContentLeft = headerRect.left + headerPaddingLeft;

            const spectrumRect = spectrum.getBoundingClientRect();
            const spectrumSpanHeights = Array.from(spectrum.children).map(
              (el) => el.getBoundingClientRect().height
            );

            const toggleRect = toggle.getBoundingClientRect();

            const navRect = nav.getBoundingClientRect();
            const navStyle = getComputedStyle(nav);
            const navPaddingRight = parseFloat(navStyle.paddingRight) || 0;
            const navContentRight = navRect.right - navPaddingRight;

            // The 80rem breakpoint's pixel value is NOT a fixed 1280px:
            // html's font-size is the fluid clamp() token --step-0
            // (clamp(1rem, 0.96rem + 0.2vw, 1.125rem)), so 1rem itself grows
            // with viewport width up to 18px. Reading the root's own
            // computed font-size, rather than assuming the CSS-default
            // 16px, is what makes this an honest check of "left of the
            // centred column" at every width this fluid token can produce.
            const rootFontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

            return {
              headerBorderBottomWidth,
              headerBottom: headerRect.bottom,
              headerContentLeft,
              spectrumTop: spectrumRect.top,
              spectrumSpanHeights,
              toggleLeft: toggleRect.left,
              toggleRight: toggleRect.right,
              navContentRight,
              rootFontSizePx,
            };
          });

          expect(result.headerBorderBottomWidth, `${name} (${theme}) @${width}px: header border-bottom-width`).toBe(
            '0px'
          );

          expect(
            Math.abs(result.spectrumTop - result.headerBottom),
            `${name} (${theme}) @${width}px: spectrum top (${result.spectrumTop}) vs header bottom (${result.headerBottom})`
          ).toBeLessThanOrEqual(1);
          expect(result.spectrumSpanHeights.length, `${name} (${theme}) @${width}px: spectrum span count`).toBe(8);
          for (const h of result.spectrumSpanHeights) {
            expect(h, `${name} (${theme}) @${width}px: a spectrum span has zero height`).toBeGreaterThan(0);
          }

          await expect(page.locator('[data-theme-toggle]')).toBeVisible();
          expect(
            Math.abs(result.toggleLeft - result.headerContentLeft),
            `${name} (${theme}) @${width}px: toggle left (${result.toggleLeft}) vs header content-box left (${result.headerContentLeft})`
          ).toBeLessThanOrEqual(1);
          expect(
            result.toggleRight,
            `${name} (${theme}) @${width}px: toggle right (${result.toggleRight}) exceeds nav content-box right (${result.navContentRight})`
          ).toBeLessThanOrEqual(result.navContentRight + 1);

          if (width === 1920) {
            // 80rem in real pixels, using the root's own measured
            // font-size (see the rootFontSizePx comment above) rather than
            // an assumed 16px/rem — at 1920px viewport width, --step-0's
            // fluid clamp() actually resolves to 18px/rem, so 80rem is
            // 1440px here, not 1280px.
            const expectedMinLeft = (1920 - 80 * result.rootFontSizePx) / 2;
            expect(
              result.toggleLeft,
              `${name} (${theme}) @1920px: toggle left (${result.toggleLeft}) sits left of the centred 80rem column (expected >= ${expectedMinLeft}, 80rem = ${80 * result.rootFontSizePx}px at rootFontSize ${result.rootFontSizePx}px)`
            ).toBeGreaterThanOrEqual(expectedMinLeft);
          }
        });
      }
    }

    test(`tab order: skip link, eight sections in canonical order, then the toggle @1280px light @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any, { theme: 'light', width: 1280 });
      const skipLinkText = (await page.locator('[data-skip-link]').innerText()).trim();

      // index.html's masthead is a plain <h1>915 TLDR</h1> (not a link, since
      // it's already the homepage); category/article/changelog/contact use
      // <p data-wordmark><a href="index.html">915 TLDR</a></p>, a real,
      // pre-existing focus stop between the skip link and the nav on those
      // four pages — unrelated to and untouched by this plan's header/toggle
      // CSS changes. Detected here (rather than hard-coded per page) so the
      // expected sequence reflects each page's own real, current markup, per
      // this task's "tab order is unchanged" contract — not a sequence this
      // plan invented.
      const wordmarkLinkCount = await page.locator('[data-wordmark] a').count();
      const wordmarkName =
        wordmarkLinkCount > 0 ? (await page.locator('[data-wordmark] a').first().innerText()).trim() : null;

      const expected = [
        skipLinkText,
        ...(wordmarkName ? [wordmarkName] : []),
        ...CANONICAL_NAV_LABELS,
        'Dark theme',
      ];
      const names = await tabNames(page, expected.length);

      expect(names, `${name}: tab order (first ${expected.length} stops)`).toEqual(expected);
    });
  });
}

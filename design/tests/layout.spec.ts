import { test, expect, type Page } from '@playwright/test';
import { openPage } from './support/harness.ts';

/**
 * Page-layout geometry (revision request 3 — article whitespace at desktop;
 * the article part of revision request 7 — full width at 768px). Proves the
 * `[data-layout="with-rail"]` / `[data-reading-column]` / `[data-rail]`
 * primitive (01-19) at the five widths the revision requests named, in both
 * themes and both engines.
 */

const WIDTHS = [320, 768, 1024, 1280, 1920];
const HEIGHT = 1000;

interface MainGeometry {
  mainContentLeft: number;
  mainContentRight: number;
  colRect: { left: number; right: number; top: number; bottom: number } | null;
  railRect: { left: number; right: number; top: number; bottom: number } | null;
  measurePx: number;
  bodyPWidth: number | null;
}

/** main's rect minus its own computed horizontal padding — the "page column" edges. */
async function readLayout(page: Page): Promise<MainGeometry> {
  return page.evaluate(() => {
    const main = document.querySelector('main')!;
    const mainRect = main.getBoundingClientRect();
    const cs = getComputedStyle(main);
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const mainContentLeft = mainRect.left + paddingLeft;
    const mainContentRight = mainRect.right - paddingRight;

    const col = document.querySelector('[data-reading-column]');
    const rail = document.querySelector('[data-rail]');

    function rect(el: Element | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }

    const measurePx = col ? parseFloat(getComputedStyle(col).maxWidth) || 0 : 0;
    const bodyP = document.querySelector('[data-article-body] p');
    const bodyPWidth = bodyP ? bodyP.getBoundingClientRect().width : null;

    return {
      mainContentLeft,
      mainContentRight,
      colRect: rect(col),
      railRect: rect(rail),
      measurePx,
      bodyPWidth,
    };
  });
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
}

interface Combo {
  width: number;
  theme: 'light' | 'dark';
}

const COMBOS: Combo[] = [
  ...WIDTHS.map((width) => ({ width, theme: 'light' as const })),
  { width: 1280, theme: 'dark' as const },
];

test.describe('layout: article', () => {
  for (const { width, theme } of COMBOS) {
    test(`no horizontal page scroll @${width}px ${theme} @c1`, async ({ page }) => {
      await openPage(page, 'article', { theme, width, height: HEIGHT });
      expect(
        await hasHorizontalScroll(page),
        `article @${width}px ${theme}: unexpected horizontal page scroll`
      ).toBe(false);
    });

    if (width >= 1024) {
      test(`rail sits beside the reading column and ends at the page column's right edge @${width}px ${theme} @c1`, async ({
        page,
      }) => {
        await openPage(page, 'article', { theme, width, height: HEIGHT });
        const layout = await readLayout(page);
        expect(layout.colRect, `article @${width}px ${theme}: [data-reading-column] not found`).not.toBeNull();
        expect(layout.railRect, `article @${width}px ${theme}: [data-rail] not found`).not.toBeNull();
        const col = layout.colRect!;
        const rail = layout.railRect!;

        expect(
          rail.left,
          `article @${width}px ${theme}: rail left ${rail.left} should be >= reading column right ${col.right} + 24`
        ).toBeGreaterThanOrEqual(col.right + 24 - 0.5);

        expect(
          Math.abs(rail.right - layout.mainContentRight),
          `article @${width}px ${theme}: rail right ${rail.right} not within 1px of main content-box right ${layout.mainContentRight}`
        ).toBeLessThanOrEqual(1);

        expect(
          Math.abs(rail.top - col.top),
          `article @${width}px ${theme}: rail top ${rail.top} not within 2px of reading column top ${col.top}`
        ).toBeLessThanOrEqual(2);

        expect(
          layout.bodyPWidth,
          `article @${width}px ${theme}: no [data-article-body] p found`
        ).not.toBeNull();
        expect(
          layout.bodyPWidth!,
          `article @${width}px ${theme}: article body paragraph width ${layout.bodyPWidth} exceeds --measure (${layout.measurePx}) + 1`
        ).toBeLessThanOrEqual(layout.measurePx + 1);
      });
    }

    if (width === 320 || width === 768) {
      test(`reading column spans the page column's full width and the rail stacks below it @${width}px ${theme} @c1`, async ({
        page,
      }) => {
        await openPage(page, 'article', { theme, width, height: HEIGHT });
        const layout = await readLayout(page);
        expect(layout.colRect, `article @${width}px ${theme}: [data-reading-column] not found`).not.toBeNull();
        expect(layout.railRect, `article @${width}px ${theme}: [data-rail] not found`).not.toBeNull();
        const col = layout.colRect!;
        const rail = layout.railRect!;

        expect(
          Math.abs(col.left - layout.mainContentLeft),
          `article @${width}px ${theme}: reading column left ${col.left} not within 1px of main content-box left ${layout.mainContentLeft}`
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(col.right - layout.mainContentRight),
          `article @${width}px ${theme}: reading column right ${col.right} not within 1px of main content-box right ${layout.mainContentRight}`
        ).toBeLessThanOrEqual(1);

        expect(
          rail.top,
          `article @${width}px ${theme}: rail top ${rail.top} should be >= reading column bottom ${col.bottom}`
        ).toBeGreaterThanOrEqual(col.bottom - 0.5);

        expect(
          Math.abs(rail.left - layout.mainContentLeft),
          `article @${width}px ${theme}: rail left ${rail.left} not within 1px of main content-box left ${layout.mainContentLeft}`
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(rail.right - layout.mainContentRight),
          `article @${width}px ${theme}: rail right ${rail.right} not within 1px of main content-box right ${layout.mainContentRight}`
        ).toBeLessThanOrEqual(1);
      });
    }
  }
});

/**
 * Changelog layout (revision request 4 — dispatch squeeze bug and
 * whitespace; the changelog part of revision request 7 — full width at
 * 768px). Reuses the same [data-layout="with-rail"] / [data-reading-column]
 * / [data-rail] primitive as article (01-19), applied to eight
 * [data-dispatch] entries instead of a single article body.
 */

const DISPATCH_BREAKPOINT = 1280; // 80em at the default 16px root the media query resolves against

interface DispatchRect {
  date: { left: number; right: number; top: number; bottom: number };
  h2: { left: number; right: number; top: number; bottom: number };
  body: { left: number; right: number; top: number; bottom: number };
}

interface ChangelogGeometry extends MainGeometry {
  dispatches: DispatchRect[];
}

async function readChangelogLayout(page: Page): Promise<ChangelogGeometry> {
  const base = await readLayout(page);
  const dispatches = await page.evaluate(() => {
    function rect(el: Element) {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }
    return Array.from(document.querySelectorAll('[data-dispatch]')).map((d) => ({
      date: rect(d.querySelector('[data-dispatch-date]')!),
      h2: rect(d.querySelector('h2')!),
      body: rect(d.querySelector('[data-dispatch-body]')!),
    }));
  });
  return { ...base, dispatches };
}

test.describe('layout: changelog', () => {
  for (const { width, theme } of COMBOS) {
    test(`no horizontal page scroll @${width}px ${theme} @c1`, async ({ page }) => {
      await openPage(page, 'changelog', { theme, width, height: HEIGHT });
      expect(
        await hasHorizontalScroll(page),
        `changelog @${width}px ${theme}: unexpected horizontal page scroll`
      ).toBe(false);
    });

    test(`every dispatch places date, title and body correctly @${width}px ${theme} @c1`, async ({ page }) => {
      await openPage(page, 'changelog', { theme, width, height: HEIGHT });
      const layout = await readChangelogLayout(page);
      expect(layout.dispatches.length, `changelog @${width}px ${theme}: no dispatches found`).toBeGreaterThan(0);

      let prevBottom: number | null = null;
      for (const [i, d] of layout.dispatches.entries()) {
        expect(
          Math.abs(d.body.left - d.h2.left),
          `changelog @${width}px ${theme} dispatch ${i}: body left ${d.body.left} not within 1px of title left ${d.h2.left}`
        ).toBeLessThanOrEqual(1);

        if (width >= DISPATCH_BREAKPOINT) {
          expect(
            d.body.right,
            `changelog @${width}px ${theme} dispatch ${i}: body right ${d.body.right} should exceed date right ${d.date.right} + 100`
          ).toBeGreaterThan(d.date.right + 100);

          expect(
            d.date.right,
            `changelog @${width}px ${theme} dispatch ${i}: date right ${d.date.right} should be left of title left ${d.h2.left}`
          ).toBeLessThan(d.h2.left);

          expect(
            Math.abs(d.date.top - d.h2.top),
            `changelog @${width}px ${theme} dispatch ${i}: date top ${d.date.top} not within 2px of title top ${d.h2.top}`
          ).toBeLessThanOrEqual(2);
        } else {
          expect(
            d.date.bottom,
            `changelog @${width}px ${theme} dispatch ${i}: date bottom ${d.date.bottom} should be at or above title top ${d.h2.top}`
          ).toBeLessThanOrEqual(d.h2.top + 1);

          expect(
            Math.abs(d.date.left - d.h2.left),
            `changelog @${width}px ${theme} dispatch ${i}: date left ${d.date.left} not within 1px of title left ${d.h2.left}`
          ).toBeLessThanOrEqual(1);
        }

        if (prevBottom !== null) {
          expect(
            d.date.top,
            `changelog @${width}px ${theme} dispatch ${i}: top ${d.date.top} should be at or below previous dispatch's bottom ${prevBottom}`
          ).toBeGreaterThanOrEqual(prevBottom - 1);
        }
        prevBottom = Math.max(d.date.bottom, d.h2.bottom, d.body.bottom);
      }
    });

    if (width === 320 || width === 768) {
      test(`reading column spans the page column's full width @${width}px ${theme} @c1`, async ({ page }) => {
        await openPage(page, 'changelog', { theme, width, height: HEIGHT });
        const layout = await readLayout(page);
        expect(layout.colRect, `changelog @${width}px ${theme}: [data-reading-column] not found`).not.toBeNull();
        const col = layout.colRect!;

        expect(
          Math.abs(col.left - layout.mainContentLeft),
          `changelog @${width}px ${theme}: reading column left ${col.left} not within 1px of main content-box left ${layout.mainContentLeft}`
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(col.right - layout.mainContentRight),
          `changelog @${width}px ${theme}: reading column right ${col.right} not within 1px of main content-box right ${layout.mainContentRight}`
        ).toBeLessThanOrEqual(1);
      });
    }

    if (width >= 1024) {
      test(`rail sits beside the reading column and ends at the page column's right edge @${width}px ${theme} @c1`, async ({
        page,
      }) => {
        await openPage(page, 'changelog', { theme, width, height: HEIGHT });
        const layout = await readLayout(page);
        expect(layout.colRect, `changelog @${width}px ${theme}: [data-reading-column] not found`).not.toBeNull();
        expect(layout.railRect, `changelog @${width}px ${theme}: [data-rail] not found`).not.toBeNull();
        const col = layout.colRect!;
        const rail = layout.railRect!;

        expect(
          rail.left,
          `changelog @${width}px ${theme}: rail left ${rail.left} should be >= reading column right ${col.right} + 24`
        ).toBeGreaterThanOrEqual(col.right + 24 - 0.5);

        expect(
          Math.abs(rail.right - layout.mainContentRight),
          `changelog @${width}px ${theme}: rail right ${rail.right} not within 1px of main content-box right ${layout.mainContentRight}`
        ).toBeLessThanOrEqual(1);
      });
    }
  }
});

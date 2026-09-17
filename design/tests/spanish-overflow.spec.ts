import { test, expect } from '@playwright/test';
import { openPage, pagesUnderTest, ZOOM_200 } from './support/harness.ts';
import { loadSpanishFixture, injectText, overflowReport, widthRatio, type SpanishComponent } from './support/i18n.ts';

/**
 * D-07/D-15, criterion 4: the +25% Spanish case is actually exercised (real
 * translation AND a synthetic +25% floor), 320px/200%-zoom reflow is proven
 * by driving a real browser, and no card ever reserves blank space for a
 * missing summary. Every test in this file carries @c4.
 */

const CONTAINER_SELECTOR = '[data-card], [data-lead], [data-block], [data-dispatch], form, nav, header, main';
const WIDTHS = [320, 768, 1280] as const;

const fixture = loadSpanishFixture();

/**
 * "worst-case" (D-07) is deliberately drawn statically into index.html's
 * markup with real, already-Spanish text baked in (01-06) rather than given
 * its own [data-i18n] injection hook — it is exercised by the "drawn
 * Spanish" check below (its <article> already carries lang="es"), not by
 * injection.
 */
const DRAWN_ONLY_COMPONENT_IDS = new Set(['worst-case']);

/**
 * SPANISH_COMPONENTS narrows a run to a comma-separated id list, in the same
 * spirit as MOCKUP_PAGES narrowing pages — unset (the default), every
 * component for the page runs, as before.
 */
function componentsForPage(pageName: string): SpanishComponent[] {
  const envValue = process.env.SPANISH_COMPONENTS;
  const idFilter =
    envValue && envValue.trim().length > 0
      ? new Set(envValue.split(',').map((s) => s.trim()).filter(Boolean))
      : null;
  return fixture.components.filter(
    (c) =>
      (c.page === 'all' || c.page === pageName) &&
      !DRAWN_ONLY_COMPONENT_IDS.has(c.id) &&
      // 01-17 Task 3: an assistiveOnly component's hook is visually hidden
      // by design ([data-visually-hidden]) — the layout loop's
      // overflow/clip/container-growth checks assume a visible box, so an
      // assistiveOnly component is exercised by its own dedicated
      // accessible-name test below instead of this loop.
      !c.assistiveOnly &&
      (idFilter === null || idFilter.has(c.id))
  );
}

/**
 * In-page: the visible-text set used by the reflow checks below — one entry
 * per (nearest landmark, normalised text) pair for every direct text node
 * that is actually rendered. Landmark-qualified so the same sentence
 * appearing in two different landmarks (e.g. a repeated card headline in a
 * "Latest Stories" grid vs. the main feed) is not conflated into one entry.
 */
async function collectVisibleTextByLandmark(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const LANDMARK_SELECTOR = 'header, nav, main, footer, form, [role]';

    function landmarkPath(el: Element): string {
      const parts: string[] = [];
      let node: Element | null = el;
      while (node) {
        if (node.matches(LANDMARK_SELECTOR)) {
          const role = node.getAttribute('role') || node.tagName.toLowerCase();
          const parent = node.parentElement;
          let index = 1;
          if (parent) {
            for (const sibling of Array.from(parent.children)) {
              if (sibling === node) break;
              if (sibling.tagName === node.tagName) index++;
            }
          }
          parts.unshift(`${role}:${index}`);
        }
        node = node.parentElement;
      }
      return parts.join('>') || 'document';
    }

    function isRendered(el: Element): boolean {
      const htmlEl = el as HTMLElement;
      return htmlEl.offsetWidth > 0 || htmlEl.offsetHeight > 0 || el.getClientRects().length > 0;
    }

    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (!isRendered(el)) continue;
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
          const normalised = node.textContent.replace(/\s+/g, ' ').trim();
          out.push(`${landmarkPath(el)}::${normalised}`);
        }
      }
    }
    return out;
  });
}

/** In-page: no text-bearing element's right edge exceeds innerWidth, and the document itself does not scroll horizontally. */
async function collectHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 0.5;
    let pastViewport = false;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
          if (el.getBoundingClientRect().right > window.innerWidth + 0.5) {
            pastViewport = true;
          }
          break;
        }
      }
      if (pastViewport) break;
    }
    return { docOverflow, pastViewport };
  });
}

for (const pageName of pagesUnderTest()) {
  const components = componentsForPage(pageName);

  test.describe(`Spanish overflow: ${pageName}`, () => {
    for (const width of WIDTHS) {
      test(`injected real+synthetic Spanish causes no overflow/clip/loss at ${width}px @c4`, async ({ page }) => {
        await openPage(page, pageName as any, { width, height: 1400 });

        for (const component of components) {
          const baseline = await overflowReport(page, component.id, CONTAINER_SELECTOR);

          for (const variant of ['es_real', 'es_synthetic'] as const) {
            const text = component[variant];
            await injectText(page, component.id, text);
            const report = await overflowReport(page, component.id, CONTAINER_SELECTOR);
            const label = `${pageName}@${width}px ${component.id} (${variant})`;

            expect(report.visible, `${label}: must render`).toBe(true);
            expect(report.textMatches, `${label}: rendered text must match injected text`).toBe(true);
            expect(report.hOverflow, `${label}: must not overflow horizontally`).toBe(false);
            expect(report.ellipsis, `${label}: must not be truncated with an ellipsis`).toBe(false);
            expect(report.clamp, `${label}: must not be line-clamped`).toBe(false);
            expect(report.vClipped, `${label}: must not be vertically clipped`).toBe(false);
            expect(report.pastViewport, `${label}: must not extend past the viewport`).toBe(false);
            expect(report.docOverflow, `${label}: must not cause page-level horizontal scroll`).toBe(false);
            // The container-growth check is only meaningful (a) against a
            // tight, content-scoped wrapper — not a broad landmark
            // (nav/header/main) whose height reflects the whole
            // page/section and fluctuates for reasons unrelated to this
            // element — (b) when the injected text is not itself
            // shorter than what was already rendered there: some stress
            // hooks carry real corpus/placeholder text longer than a given
            // fixture component's own text, and a shorter replacement
            // legitimately produces a shorter (not clipped) box — and (c)
            // when the element is not hyphenation-eligible: headline
            // elements carry `hyphens: auto` (01-08/D-01's long-word
            // overflow defense), which only actually engages a hyphenation
            // dictionary once `lang` is known, and injectText() always sets
            // `lang="es"` as part of injection. A hyphenation-eligible
            // headline can legitimately re-wrap onto FEWER lines than its
            // un-hyphenated baseline for the exact same (or longer) text,
            // shrinking its container with nothing lost or clipped — 01-15
            // confirmed this with a minimal setAttribute('lang','es')-only
            // repro that reproduces the identical shrink with no text
            // change at all. vClipped, asserted above, is the authoritative
            // "did it actually clip" signal in every case, unaffected by
            // this exemption.
            if (report.containerTight && text.length >= baseline.textLength && !baseline.hyphensAuto) {
              expect(
                report.containerHeight,
                `${label}: container must grow to fit longer text, never clip`
              ).toBeGreaterThanOrEqual(baseline.containerHeight - 0.5);
            }

            if (variant === 'es_synthetic') {
              const ratio = await widthRatio(page, component.id, component.en, component.es_synthetic);
              expect(ratio, `${label}: measured width ratio must be at least +24%`).toBeGreaterThanOrEqual(1.24);
              expect(
                ratio,
                `${label}: measured width ratio must not exceed the calibrated ceiling`
              ).toBeLessThanOrEqual(component.calibration.hi + 0.01);
              test.info().annotations.push({
                type: `width-ratio:${component.id}`,
                description: JSON.stringify({
                  widthRatio: ratio,
                  utf8ByteRatio: component.calibration.utf8ByteRatio,
                }),
              });
            }
          }
        }
      });
    }

    test(`drawn Spanish (already in the markup) causes no overflow/clip/loss @c4`, async ({ page }) => {
      for (const width of WIDTHS) {
        await openPage(page, pageName as any, { width, height: 1400 });

        const drawnKeys: string[] = await page.evaluate(() => {
          function stableKey(el: Element): string {
            const parts: string[] = [];
            let node: Element | null = el;
            while (node) {
              const tag = node.tagName.toLowerCase();
              const parent: Element | null = node.parentElement;
              let index = 1;
              if (parent) {
                for (const sibling of Array.from(parent.children)) {
                  if (sibling === node) break;
                  if (sibling.tagName === node.tagName) index++;
                }
              }
              parts.unshift(`${tag}:nth-of-type(${index})`);
              node = parent;
            }
            return parts.join('>');
          }
          return Array.from(document.querySelectorAll('[lang="es"]')).map(stableKey);
        });

        for (const key of drawnKeys) {
          const report = await overflowReport(page, key, CONTAINER_SELECTOR);
          const label = `${pageName}@${width}px drawn ${key}`;
          expect(report.visible, `${label}: must render`).toBe(true);
          expect(report.hOverflow, `${label}: must not overflow horizontally`).toBe(false);
          expect(report.ellipsis, `${label}: must not be truncated with an ellipsis`).toBe(false);
          expect(report.clamp, `${label}: must not be line-clamped`).toBe(false);
          expect(report.vClipped, `${label}: must not be vertically clipped`).toBe(false);
          expect(report.pastViewport, `${label}: must not extend past the viewport`).toBe(false);
          expect(report.docOverflow, `${label}: must not cause page-level horizontal scroll`).toBe(false);
        }
      }
    });

    test(`every [data-summary] has non-empty text @c4`, async ({ page }) => {
      await openPage(page, pageName as any, { width: 1280, height: 1400 });
      const empties: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-summary]'))
          .filter((el) => (el.textContent || '').trim().length === 0)
          .map((el) => el.outerHTML.slice(0, 80))
      );
      expect(empties, 'no [data-summary] element may be present with empty text').toEqual([]);
    });

    if (pageName === 'index') {
      test(`no-summary card has no [data-summary] and reserves no blank space @c4`, async ({ page }) => {
        await openPage(page, 'index' as any, { width: 1280, height: 1400 });
        const result = await page.evaluate(() => {
          const card = document.querySelector('[data-stress="no-summary"]');
          if (!card) return null;
          const hasSummary = !!card.querySelector('[data-summary]');
          const cardTop = card.getBoundingClientRect().top;
          const cardHeight = card.getBoundingClientRect().height;
          const grid = card.closest('[data-grid]');
          const siblings = grid ? Array.from(grid.querySelectorAll('[data-card]')) : [];
          // "Same grid row band": other cards whose top is within a small
          // tolerance of this card's own top (same CSS grid row).
          const rowBand = siblings.filter(
            (c) => c !== card && Math.abs(c.getBoundingClientRect().top - cardTop) < 2
          );
          const heights = rowBand.map((c) => c.getBoundingClientRect().height).sort((a, b) => a - b);
          const median = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : null;
          return { hasSummary, cardHeight, median };
        });
        expect(result, 'index.html must have a [data-stress="no-summary"] card').not.toBeNull();
        expect(result!.hasSummary, 'no-summary card must have no [data-summary] element').toBe(false);
        if (result!.median !== null) {
          expect(
            result!.cardHeight,
            'no-summary card must be shorter than its row-band median (no reserved blank space)'
          ).toBeLessThan(result!.median);
        }
      });
    }

    if (pageName === 'article') {
      test(`assistive-only Spanish cue lands in the accessible name without moving the link @c4`, async ({ page }) => {
        const component = fixture.components.find((c) => c.id === 'new-tab-cue');
        expect(component, 'fixture must contain the new-tab-cue component').toBeTruthy();
        expect(component!.assistiveOnly, 'new-tab-cue must be assistiveOnly').toBe(true);

        await openPage(page, 'article' as any, { width: 1280, height: 1400 });

        const normalise = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

        for (const variant of ['es_real', 'es_synthetic'] as const) {
          const text = component![variant];

          const anchor = page.locator('a:has([data-i18n="new-tab-cue"])').first();
          await expect(anchor, `${variant}: anchor holding [data-i18n="new-tab-cue"] must exist`).toHaveCount(1);
          const boxBefore = await anchor.boundingBox();
          expect(boxBefore, `${variant}: anchor must have a bounding box before injection`).not.toBeNull();

          await injectText(page, 'new-tab-cue', text);

          await expect(
            anchor,
            `${variant}: anchor's accessible name must end with the injected cue text`
          ).toHaveAccessibleName(new RegExp(`${normalise(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

          const boxAfter = await anchor.boundingBox();
          expect(boxAfter, `${variant}: anchor must still have a bounding box after injection`).not.toBeNull();
          expect(
            Math.abs(boxAfter!.x - boxBefore!.x),
            `${variant}: anchor x moved`
          ).toBeLessThanOrEqual(0.5);
          expect(
            Math.abs(boxAfter!.y - boxBefore!.y),
            `${variant}: anchor y moved`
          ).toBeLessThanOrEqual(0.5);
          expect(
            Math.abs(boxAfter!.width - boxBefore!.width),
            `${variant}: anchor width changed`
          ).toBeLessThanOrEqual(0.5);
          expect(
            Math.abs(boxAfter!.height - boxBefore!.height),
            `${variant}: anchor height changed`
          ).toBeLessThanOrEqual(0.5);
        }
      });
    }

    test(`320px and 200% zoom (emulated: 640 CSS px @2x) preserve content with no horizontal scroll @c4`, async ({
      page,
      browser,
    }) => {
      await openPage(page, pageName as any, { width: 1280, height: 800 });
      const baseline = new Set(await collectVisibleTextByLandmark(page));

      await page.setViewportSize({ width: 320, height: 640 });
      await page.waitForTimeout(50);
      const narrowOverflow = await collectHorizontalOverflow(page);
      expect(narrowOverflow.docOverflow, `${pageName}@320px: no page-level horizontal scroll`).toBe(false);
      expect(narrowOverflow.pastViewport, `${pageName}@320px: no text-bearing element past the viewport`).toBe(false);
      const narrowText = new Set(await collectVisibleTextByLandmark(page));
      expect([...narrowText].sort(), `${pageName}@320px: same visible text as 1280px`).toEqual([...baseline].sort());

      const zoomContext = await browser.newContext({
        viewport: { width: ZOOM_200.width, height: ZOOM_200.height },
        deviceScaleFactor: ZOOM_200.deviceScaleFactor,
      });
      try {
        const zoomPage = await zoomContext.newPage();
        await openPage(zoomPage, pageName as any, { width: ZOOM_200.width, height: ZOOM_200.height });
        const zoomOverflow = await collectHorizontalOverflow(zoomPage);
        expect(zoomOverflow.docOverflow, `${pageName}@200% zoom: no page-level horizontal scroll`).toBe(false);
        expect(zoomOverflow.pastViewport, `${pageName}@200% zoom: no text-bearing element past the viewport`).toBe(
          false
        );
        const zoomText = new Set(await collectVisibleTextByLandmark(zoomPage));
        expect([...zoomText].sort(), `${pageName}@200% zoom: same visible text as 1280px`).toEqual(
          [...baseline].sort()
        );
      } finally {
        await zoomContext.close();
      }
    });
  });
}

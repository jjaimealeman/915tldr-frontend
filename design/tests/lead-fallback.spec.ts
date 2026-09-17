import { test, expect } from '@playwright/test';
import { openPage, WIDTHS, THEMES } from './support/harness.ts';

/**
 * D-09 / revision request 2 ("the category lead needs an image, always, or
 * a layout that survives without one"): category.html's lead cannot break —
 * it shows an image only when a usable one exists, and degrades to the
 * designed typographic lead in every other case. Proven at 320/768/1280px,
 * light/dark, in both engines. Every title carries @c1.
 *
 * Tests block third-party requests (design/tests/support/harness.ts's
 * blockThirdParty), so the lead's real (hotlinked) image never actually
 * paints in any of these runs — every scenario here, including the
 * "baseline", already shows the frame's neutral --rule background rather
 * than a loaded photo. That's fine: (a)-(c) test structural geometry, not
 * pixel content, and (d) proves that resolving a definite same-origin 404
 * (a real completed "no image" state, not a forever-pending blocked
 * request) causes no further reflow versus a baseline captured on the same
 * already-blocked page.
 */

const WIDTH_ENTRIES = Object.entries(WIDTHS) as Array<[string, number]>;

for (const [widthName, width] of WIDTH_ENTRIES) {
  for (const theme of THEMES) {
    const at = `${widthName}=${width}px, ${theme}`;

    test(`(a) baseline image lead: frame and lead-body do not overlap, body stays within the lead's right edge, no horizontal scroll (${at}) @c1`, async ({
      page,
    }) => {
      await openPage(page, 'category', { theme, width });

      const result = await page.evaluate(() => {
        function rectOf(el: Element) {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }
        const lead = document.querySelector('[data-lead]')!;
        const frame = lead.querySelector('[data-frame]')!;
        const body = lead.querySelector('[data-lead-body]')!;
        return {
          lead: rectOf(lead),
          frame: rectOf(frame),
          body: rectOf(body),
          docOverflow: document.documentElement.scrollWidth > window.innerWidth + 0.5,
        };
      });

      const overlapH = result.frame.left < result.body.right && result.body.left < result.frame.right;
      const overlapV = result.frame.top < result.body.bottom && result.body.top < result.frame.bottom;
      expect(overlapH && overlapV, 'frame and lead-body boxes must not overlap').toBe(false);
      expect(
        result.body.right,
        "lead-body's right edge must not exceed the lead's right edge"
      ).toBeLessThanOrEqual(result.lead.right + 0.5);
      expect(result.docOverflow, 'document must not scroll horizontally').toBe(false);
    });

    test(`(b) simulated build output for a row with no usable image (frame removed, variant=type): headline sits flush left, no phantom 3:2 image box, no horizontal scroll (${at}) @c1`, async ({
      page,
    }) => {
      await openPage(page, 'category', { theme, width });

      const result = await page.evaluate(() => {
        const lead = document.querySelector('[data-lead]')!;
        const frame = lead.querySelector('[data-frame]');
        if (frame) frame.remove();
        lead.setAttribute('data-lead-variant', 'type');

        function rectOf(el: Element) {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        }

        const h2 = lead.querySelector('h2')!;
        const leadRect = rectOf(lead);
        const h2Rect = rectOf(h2);

        // No remaining descendant may keep a near-3:2-ratio box with no
        // rendered text — the signature shape of a reserved-but-empty
        // image slot.
        let phantomImageBox = false;
        for (const el of Array.from(lead.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const ratio = r.width / r.height;
          const hasText = (el.textContent || '').trim().length > 0;
          if (!hasText && Math.abs(ratio - 1.5) < 0.05) {
            phantomImageBox = true;
          }
        }

        return {
          leadRect,
          h2Rect,
          phantomImageBox,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth + 0.5,
        };
      });

      expect(
        Math.abs(result.h2Rect.left - result.leadRect.left),
        "h2's left edge must be within 1px of the lead's content-box left"
      ).toBeLessThanOrEqual(1);
      expect(
        result.h2Rect.left + result.h2Rect.width,
        "h2's right edge must not exceed the lead's right edge"
      ).toBeLessThanOrEqual(result.leadRect.left + result.leadRect.width + 0.5);
      expect(result.phantomImageBox, 'no descendant may keep an empty 3:2-ratio box').toBe(false);
      expect(result.docOverflow, 'document must not scroll horizontally').toBe(false);
    });

    test(`(c) image-led lead with the <img> removed (frame kept): the frame computes display:none, headline sits flush left (${at}) @c1`, async ({
      page,
    }) => {
      await openPage(page, 'category', { theme, width });

      const result = await page.evaluate(() => {
        const lead = document.querySelector('[data-lead]')!;
        const frame = lead.querySelector('[data-frame]')!;
        const img = frame.querySelector('img');
        if (img) img.remove();

        function rectOf(el: Element) {
          const r = el.getBoundingClientRect();
          return { left: r.left, width: r.width };
        }

        const h2 = lead.querySelector('h2')!;
        return {
          frameDisplay: getComputedStyle(frame).display,
          leadRect: rectOf(lead),
          h2Rect: rectOf(h2),
        };
      });

      expect(result.frameDisplay, 'the frame must compute display: none once its <img> is removed').toBe('none');
      expect(
        Math.abs(result.h2Rect.left - result.leadRect.left),
        "h2's left edge must be within 1px of the lead's content-box left"
      ).toBeLessThanOrEqual(1);
    });

    test(`(d) broken image (same-origin 404): frame box and body left edge match the pre-mutation baseline within 0.5px — nothing reflows (${at}) @c1`, async ({
      page,
    }) => {
      await openPage(page, 'category', { theme, width });

      function captureRects() {
        return page.evaluate(() => {
          function rectOf(el: Element) {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          }
          const lead = document.querySelector('[data-lead]')!;
          const frame = lead.querySelector('[data-frame]')!;
          const body = lead.querySelector('[data-lead-body]')!;
          return { frame: rectOf(frame), bodyLeft: rectOf(body).left };
        });
      }

      const baseline = await captureRects();

      await page.evaluate(() => {
        const img = document.querySelector('[data-lead] [data-frame] img') as HTMLImageElement;
        img.src = '/mockups/lead-fallback-broken-404.jpg';
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const img = document.querySelector('[data-lead] [data-frame] img') as HTMLImageElement;
            if (img.complete && img.naturalWidth === 0) {
              resolve();
              return;
            }
            img.addEventListener('error', () => resolve(), { once: true });
          })
      );
      // Settle two animation frames so any error-triggered reflow has
      // actually happened before the second measurement.
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      );

      const after = await captureRects();

      expect(Math.abs(after.frame.left - baseline.frame.left), 'frame left edge moved').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.frame.top - baseline.frame.top), 'frame top edge moved').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.frame.width - baseline.frame.width), 'frame width changed').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.frame.height - baseline.frame.height), 'frame height changed').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.bodyLeft - baseline.bodyLeft), "lead-body's left edge moved").toBeLessThanOrEqual(0.5);
    });
  }
}

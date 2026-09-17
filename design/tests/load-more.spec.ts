import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openPage } from './support/harness.ts';
import { renderCardHtml } from '../scripts/build-feed.mjs';

/**
 * Revision request 8 (01-21): the homepage first load shows the lead plus 6
 * cards, then a Load more button walks a chain of pre-built static
 * feed/page-<n>.json files. Every test here carries @c1 @c3 — this is both
 * a structural/content check on the initial and loaded state (c1) and a
 * keyboard-operability/focus check (c3).
 */

const PAGE2_PATH = path.resolve('design/mockups/feed/page-2.json');

test.describe('load more: index', () => {
  test('initial load: exactly 6 cards, 2 rows @1280px, 3 rows @768px, 6 stacked @320px, button visible @c1', async ({
    page,
  }) => {
    await openPage(page, 'index', { width: 1280 });
    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(6);
    const button = page.locator('[data-load-more]');
    await expect(button).toBeVisible();

    const tops1280 = await page.locator('[data-grid] [data-card]').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    const distinctRows1280 = new Set(tops1280).size;
    expect(distinctRows1280, `expected 2 rows @1280px, got tops ${tops1280.join(',')}`).toBe(2);

    await page.setViewportSize({ width: 768, height: 1200 });
    const tops768 = await page.locator('[data-grid] [data-card]').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    const distinctRows768 = new Set(tops768).size;
    expect(distinctRows768, `expected 3 rows @768px, got tops ${tops768.join(',')}`).toBe(3);

    await page.setViewportSize({ width: 320, height: 2400 });
    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(6);
    const tops320 = await page.locator('[data-grid] [data-card]').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    expect(new Set(tops320).size, `expected 6 stacked rows @320px, got tops ${tops320.join(',')}`).toBe(6);
  });

  test('parity: a loaded card matches renderCardHtml exactly @c1', async ({ page }) => {
    const page2 = JSON.parse(readFileSync(PAGE2_PATH, 'utf8'));
    const expectedCard = page2.cards[0];
    const expectedHtml = renderCardHtml(expectedCard);

    await openPage(page, 'index', { width: 1280 });
    await page.locator('[data-load-more]').click();
    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(12);

    const comparison = await page.evaluate((renderedHtml) => {
      const cards = document.querySelectorAll('[data-grid] [data-card]');
      const live = cards[6] ? cards[6].outerHTML : null;
      const template = document.createElement('template');
      template.innerHTML = renderedHtml;
      const rendered = template.content.firstElementChild ? template.content.firstElementChild.outerHTML : null;
      return { live, rendered };
    }, expectedHtml);

    // The client renderer (buildCardEl, createElement/appendChild) inserts
    // no whitespace text nodes between elements; renderCardHtml's own
    // multi-line indented string does, purely for source formatting. Strip
    // inter-tag whitespace on both sides before comparing so this checks
    // structural/content equivalence, not literal formatting.
    const normalize = (s: string | null) =>
      (s || '')
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normalize(comparison.live)).toBe(normalize(comparison.rendered));
  });

  test('keyboard: Enter on the button loads 6 more, focuses the 7th card link, status announces the count @c1 @c3', async ({
    page,
  }) => {
    await openPage(page, 'index', { width: 1280 });
    const button = page.locator('[data-load-more]');
    await button.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(12);

    const activeInfo = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const cards = Array.from(document.querySelectorAll('[data-grid] [data-card]'));
      const seventh = cards[6];
      const link = seventh ? seventh.querySelector('h3 a') : null;
      return { isSeventhLink: !!link && el === link };
    });
    expect(activeInfo.isSeventhLink, 'focus must land on the 7th card\'s h3 a').toBe(true);

    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth) };
    });
    expect(ring.outlineStyle !== 'none' && ring.outlineWidth >= 2, 'focused link must show a visible >=2px ring').toBe(
      true
    );

    await expect(page.locator('[data-load-more-status]')).toHaveText('6 more stories loaded.');
  });

  test('network: only same-origin GET(s) to /mockups/feed/page-2.json are made after activation @c1', async ({
    page,
    baseURL,
  }) => {
    await openPage(page, 'index', { width: 1280 });

    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        requests.push(`${req.method()} ${req.url()}`);
      }
    });

    await page.locator('[data-load-more]').click();
    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(12);

    expect(requests.length, `expected at least one fetch/xhr request, got: ${requests.join(', ')}`).toBeGreaterThan(0);
    for (const r of requests) {
      expect(r, `unexpected non-page-2 fetch/xhr request: ${r}`).toBe(`GET ${baseURL}/mockups/feed/page-2.json`);
    }
  });

  test('failure path: a 500 response leaves the grid unchanged, keeps focus on the button, shows the error status @c1 @c3', async ({
    page,
  }) => {
    await openPage(page, 'index', { width: 1280 });
    await page.route('**/feed/page-2.json', (route) => route.fulfill({ status: 500, body: 'error' }));

    const button = page.locator('[data-load-more]');
    await button.focus();
    await page.keyboard.press('Enter');

    // Give the failed fetch a moment to settle.
    await page.waitForTimeout(200);

    await expect(page.locator('[data-grid] [data-card]')).toHaveCount(6);
    const isFocused = await button.evaluate((el) => el === document.activeElement);
    expect(isFocused, 'focus must remain on the button after a failed load').toBe(true);
    await expect(page.locator('[data-load-more-status]')).toHaveText("Couldn't load more stories. Try again.");
    await expect(button).not.toHaveAttribute('aria-disabled', 'true');
  });
});

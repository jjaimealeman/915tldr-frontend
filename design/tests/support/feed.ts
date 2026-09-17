import type { Page } from '@playwright/test';

/**
 * Gap-closure (01-22): after 01-21 moved 27 of the home feed's 33 cards
 * behind a Load more button, every check that used to see the whole feed by
 * simply opening the page now needs to drive the same real click a reader
 * would, repeatedly, until there is nothing left to load. expandFeed does
 * exactly that — real Playwright clicks (locator.click(), the real input
 * pipeline, not a synthetic .click() call), never a fetch shortcut.
 *
 * While [data-load-more] is visible: read the current [data-grid] [data-card]
 * count, click the button, then wait until the count increases (the button's
 * own click handler is async — it fetches a same-origin feed/page-<n>.json
 * before appending cards). Stops after 20 iterations and throws with a clear
 * message rather than looping forever if a load never lands. A page with no
 * [data-load-more] button (or one that starts and stays hidden) is a no-op:
 * the loop's `isVisible()` check is false immediately, so the page's
 * unchanged card count is returned untouched.
 */
export async function expandFeed(page: Page): Promise<number> {
  const button = page.locator('[data-load-more]');
  const cards = page.locator('[data-grid] [data-card]');

  const MAX_ITERATIONS = 20;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!(await button.isVisible())) {
      return cards.count();
    }
    const before = await cards.count();
    await button.click();
    await page.waitForFunction(
      (expectedMin) => document.querySelectorAll('[data-grid] [data-card]').length > expectedMin,
      before,
      { timeout: 5000 }
    );
  }

  if (await button.isVisible()) {
    throw new Error(`expandFeed: [data-load-more] still visible after ${MAX_ITERATIONS} clicks — possible infinite loop`);
  }

  return cards.count();
}

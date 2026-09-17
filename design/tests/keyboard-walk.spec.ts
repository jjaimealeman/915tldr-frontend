import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openPage, pagesUnderTest, THEMES, WIDTHS } from './support/harness.ts';
import { buildContactSheet, enumerateFocusables, inspectFocus, walkTabOrder } from './support/focus.ts';
import type { ContactSheetShot } from './support/focus.ts';

/**
 * Browsers scroll a newly-focused off-screen element into view, but the
 * scroll is not always synchronous with the keypress that caused it — this
 * pinned Playwright-WebKit build (26.6, Docker) measurably animates the
 * scroll over ~150-250ms rather than jumping instantly, confirmed by
 * polling window.scrollY immediately after a Tab press vs. after a short
 * wait. Reading ring geometry before the scroll settles produces a false
 * "obscured"/"outside viewport" reading for elements below the fold, not a
 * real defect — so every per-stop inspection waits for two consecutive
 * scroll-position reads to agree first.
 */
async function waitForScrollToSettle(page: Page): Promise<void> {
  let last = await page.evaluate(() => `${window.scrollX}:${window.scrollY}`);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(30);
    const current = await page.evaluate(() => `${window.scrollX}:${window.scrollY}`);
    if (current === last) return;
    last = current;
  }
}

// Serial: each combo appends to a shared per-engine tab-order-<engine>.json
// (read-modify-write); fullyParallel (playwright.config.ts) would race that
// write across workers otherwise — same reasoning as font-cls.spec.ts.
test.describe.configure({ mode: 'serial' });

const EVIDENCE_DIR = path.resolve('design/evidence/keyboard');

function tabOrderPath(engine: string): string {
  return path.join(EVIDENCE_DIR, `tab-order-${engine}.json`);
}

function loadTabOrder(engine: string): Record<string, unknown> {
  const file = tabOrderPath(engine);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8'));
}

function saveTabOrder(engine: string, data: Record<string, unknown>): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(tabOrderPath(engine), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

for (const name of pagesUnderTest()) {
  for (const theme of THEMES) {
    for (const width of [WIDTHS.narrow, WIDTHS.wide]) {
      test(`keyboard walk reaches every focusable with a visible, unclipped, contrasting ring: ${name} ${theme} @${width}px @c3`, async ({
        page,
      }, testInfo) => {
        const engine = testInfo.project.name;

        // 1-2: enumerate, then walk with Tab.
        await openPage(page, name as any, { theme, width });
        const focusables = await enumerateFocusables(page);
        expect(focusables.length, `no focusable elements found on ${name}`).toBeGreaterThan(0);
        const enumeratedPaths = focusables.map((f) => f.path);

        const coverage = (stops: { path: string }[]) => {
          const visited = new Set(stops.map((s) => s.path));
          return enumeratedPaths.filter((p) => visited.has(p)).length;
        };

        let tabStops = await walkTabOrder(page, 'Tab');
        let tabKey: 'Tab' | 'Alt+Tab' = 'Tab';

        // 3: if Tab didn't reach every enumerated element, try Alt+Tab and
        // use it if it covers more. WebKit's tab-to-all-controls setting
        // varies by build; this must be detected, not assumed either way.
        if (coverage(tabStops) < enumeratedPaths.length) {
          await openPage(page, name as any, { theme, width });
          const altStops = await walkTabOrder(page, 'Alt+Tab');
          if (coverage(altStops) > coverage(tabStops)) {
            tabStops = altStops;
            tabKey = 'Alt+Tab';
          }
        }

        // 4: every enumerated element was visited; the first stop is the
        // skip link.
        const finalVisited = new Set(tabStops.map((s) => s.path));
        for (const p of enumeratedPaths) {
          expect(finalVisited.has(p), `focusable element not reached by ${tabKey} on ${name}: ${p}`).toBe(true);
        }

        const skipLinkText = (await page.locator('[data-skip-link]').innerText()).trim();
        expect(tabStops[0]?.name, `first focus stop on ${name} was not the skip link`).toBe(skipLinkText);

        // 5-6: a second, annotated walk (fresh page, same tabKey) — inspect
        // and screenshot every stop, then build the contact sheet and merge
        // the tab-order evidence. The stop count is already proven correct
        // by the walk above, so this walk presses tabKey exactly that many
        // times against the same static markup.
        await openPage(page, name as any, { theme, width });
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

        const viewport = page.viewportSize();
        if (!viewport) throw new Error('keyboard-walk: no viewport size');

        const shots: ContactSheetShot[] = [];
        const stopNames: string[] = [];

        for (let i = 0; i < tabStops.length; i++) {
          await page.keyboard.press(tabKey);
          await waitForScrollToSettle(page);
          const stopName = tabStops[i].name;
          const inspection = await inspectFocus(page);

          expect(inspection.focusVisible, `${name} stop ${i} (${stopName}) is not :focus-visible`).toBe(true);
          expect(
            (inspection.outlineStyle !== 'none' && inspection.outlineWidth >= 2) || inspection.boxShadowSet,
            `${name} stop ${i} (${stopName}) has no visible >=2px focus ring`
          ).toBe(true);
          expect(
            inspection.clippedBy,
            `${name} stop ${i} (${stopName}) ring is clipped by ${inspection.clippedBy}`
          ).toBeNull();
          expect(
            inspection.outsideViewport,
            `${name} stop ${i} (${stopName}) ring extends outside the viewport`
          ).toBe(false);
          expect(inspection.obscured, `${name} stop ${i} (${stopName}) ring is obscured`).toBe(false);
          expect(
            inspection.ringContrast,
            `${name} stop ${i} (${stopName}) ring contrast ${inspection.ringContrast} < 3`
          ).toBeGreaterThanOrEqual(3);

          const margin = 8;
          const x = Math.max(0, inspection.ringBox.left - margin);
          const y = Math.max(0, inspection.ringBox.top - margin);
          const right = Math.min(viewport.width, inspection.ringBox.right + margin);
          const bottom = Math.min(viewport.height, inspection.ringBox.bottom + margin);
          const buffer = await page.screenshot({
            clip: { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) },
          });

          shots.push({ buffer, index: i, name: stopName });
          stopNames.push(stopName);
        }

        const outPath = path.join(EVIDENCE_DIR, `${name}-${theme}-${width}-${engine}.png`);
        const caption = `${name} — ${theme} — ${width}px — ${engine} — tabKey=${tabKey}`;
        await buildContactSheet(page, shots, caption, outPath);

        const data = loadTabOrder(engine);
        const pageData = (data[name] ??= {}) as Record<string, unknown>;
        const themeData = (pageData[theme] ??= {}) as Record<string, unknown>;
        (themeData as Record<string, unknown>)[String(width)] = { tabKey, stops: stopNames };
        saveTabOrder(engine, data);
      });
    }
  }
}

// ---- Operability tests (D-14) ----

for (const name of pagesUnderTest()) {
  test(`skip link is the first focus stop and Enter moves focus into main: ${name} @c3`, async ({ page }) => {
    await openPage(page, name as any, { theme: 'light' });
    await page.locator('[data-skip-link]').focus();
    await page.keyboard.press('Enter');

    const inMain = await page.evaluate(() => {
      const main = document.querySelector('main#main');
      return !!main && (document.activeElement === main || main.contains(document.activeElement));
    });
    expect(inMain, `Enter on the skip link did not move focus into main on ${name}`).toBe(true);
  });

  test(`theme toggle flips data-theme and aria-pressed on both Enter and Space: ${name} @c3`, async ({ page }) => {
    await openPage(page, name as any, { theme: 'light' });
    const toggle = page.locator('[data-theme-toggle]');
    await toggle.focus();

    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Enter');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
}

// ---- New-tab activation safety (revision request 6, T-01-50/T-01-52) ----

const PAGES_WITH_EXTERNAL_LINKS = ['article', 'contact'] as const;

for (const name of pagesUnderTest()) {
  if (!(PAGES_WITH_EXTERNAL_LINKS as readonly string[]).includes(name)) continue;

  test(`external links open a new tab with no opener, by Enter and by click: ${name} @c1 @c3`, async ({
    page,
    context,
  }) => {
    // page.route does not intercept a popup's first request — a
    // context-level route is required so the popup's navigation to the
    // real external host is fulfilled with a stub instead of reaching the
    // network (T-01-52). Registered before openPage() so it's already
    // active for the main page's own load too.
    const nonLocalUrls: string[] = [];
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      const hostname = new URL(url).hostname;
      if (hostname !== '127.0.0.1') {
        nonLocalUrls.push(url);
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>stub</title><body>stub</body>',
        });
        return;
      }
      await route.fallback();
    });

    await openPage(page, name as any, { theme: 'light' });
    const originalUrl = page.url();

    const externalLinks = page.locator('a[target="_blank"]');
    const externalCount = await externalLinks.count();
    expect(externalCount, `${name}: must have at least one external link to exercise this test`).toBeGreaterThan(0);
    const firstLink = externalLinks.first();

    // Enter activation.
    await firstLink.focus();
    const [newPageViaEnter] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
    await newPageViaEnter.waitForLoadState('domcontentloaded');
    const openerViaEnter = await newPageViaEnter.evaluate(() => window.opener);
    expect(openerViaEnter, `${name}: new page opened via Enter must have window.opener === null`).toBeNull();
    await expect(
      newPageViaEnter.locator('body'),
      `${name}: the popup opened via Enter must be the stub response, not a real network fetch`
    ).toHaveText('stub');
    expect(page.url(), `${name}: original page URL must be unchanged after Enter activation`).toBe(originalUrl);
    await newPageViaEnter.close();

    // Click activation (a real mouse click, not a synthetic .click() call
    // on a detached element — locator.click() drives Playwright's real
    // input pipeline).
    const [newPageViaClick] = await Promise.all([context.waitForEvent('page'), firstLink.click()]);
    await newPageViaClick.waitForLoadState('domcontentloaded');
    const openerViaClick = await newPageViaClick.evaluate(() => window.opener);
    expect(openerViaClick, `${name}: new page opened via click must have window.opener === null`).toBeNull();
    await expect(
      newPageViaClick.locator('body'),
      `${name}: the popup opened via click must be the stub response, not a real network fetch`
    ).toHaveText('stub');
    expect(page.url(), `${name}: original page URL must be unchanged after click activation`).toBe(originalUrl);
    await newPageViaClick.close();

    expect(nonLocalUrls.length, `${name}: at least one non-127.0.0.1 request (the popup navigations) must have been observed and stubbed`).toBeGreaterThan(0);
  });
}

test('contact form: typing sets values; an empty required-field submit via Enter does not navigate and reaches no host but 127.0.0.1 @c3', async ({
  page,
}) => {
  const { blocked } = await openPage(page, 'contact', { theme: 'light' });

  await page.locator('#contact-name').fill('Ada Lovelace');
  await expect(page.locator('#contact-name')).toHaveValue('Ada Lovelace');
  await page.locator('#contact-email').fill('ada@example.com');
  await expect(page.locator('#contact-email')).toHaveValue('ada@example.com');
  await page.locator('#contact-message').fill('Hello from the keyboard walk.');
  await expect(page.locator('#contact-message')).toHaveValue('Hello from the keyboard walk.');

  await page.locator('#contact-name').fill('');
  await page.locator('#contact-email').fill('');
  await page.locator('#contact-message').fill('');

  // blockThirdParty also (correctly) blocks the page's own remote card
  // images loaded on navigation — that's unrelated to the submit action
  // under test, so only requests attempted *after* the submit attempt count
  // toward "no request to a host other than 127.0.0.1 was made".
  const blockedBeforeSubmit = blocked.length;

  const urlBefore = page.url();
  await page.locator('button[type="submit"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(page.url(), 'submitting the empty required contact form navigated').toBe(urlBefore);

  const blockedBySubmit = blocked.slice(blockedBeforeSubmit);
  expect(blockedBySubmit, `submit attempted a request to a non-127.0.0.1 host: ${blockedBySubmit.join(', ')}`).toEqual(
    []
  );
});

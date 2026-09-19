import type { Page } from '@playwright/test';

/**
 * The full set of mockup pages this phase produces. Later plans (01-06, 01-07)
 * add the actual mockup HTML files under design/mockups/<name>.html.
 */
export const PAGES = ['index', 'category', 'article', 'changelog', 'contact'] as const;

export type PageName = (typeof PAGES)[number] | 'harness';

/**
 * Returns the pages under test for this run. Set MOCKUP_PAGES to a
 * comma-separated subset (e.g. "index,article") to narrow a run; otherwise
 * every page in PAGES is returned.
 */
export function pagesUnderTest(): readonly string[] {
  const envValue = process.env.MOCKUP_PAGES;
  if (envValue && envValue.trim().length > 0) {
    return envValue.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return PAGES;
}

export const THEMES = ['light', 'dark'] as const;

export const WIDTHS = {
  narrow: 320,
  medium: 768,
  wide: 1280,
} as const;

/**
 * Emulates 200% browser zoom of a 1280x800 window. Browser zoom scales the
 * CSS-pixel viewport down while rendering at a higher device pixel ratio, so
 * a 1280x800 window at 200% zoom lays out content as if the viewport were
 * 640x400 CSS pixels, at devicePixelRatio 2.
 */
export const ZOOM_200 = {
  width: 640,
  height: 400,
  deviceScaleFactor: 2,
} as const;

export const THEME_STORAGE_KEY = '915tldr:theme';

/**
 * Registers a route handler on `page` that aborts any request whose host is
 * not 127.0.0.1, and calls route.fallback() (never route.continue()) for
 * local requests so that handlers registered earlier by callers (e.g. a font
 * hold or stylesheet rewrite added in later plans) still get a chance to run.
 * Playwright invokes route handlers in reverse registration order, so
 * registering this first in openPage() means later handlers registered by
 * the caller run before this one — but this handler must still fall through
 * for local URLs rather than swallow them.
 *
 * Returns the array that blocked URLs are appended to.
 */
export function blockThirdParty(page: Page): string[] {
  const blocked: string[] = [];
  page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      blocked.push(route.request().url());
      await route.abort();
      return;
    }
    await route.fallback();
  });
  return blocked;
}

export interface OpenPageOptions {
  theme?: (typeof THEMES)[number];
  width?: number;
  height?: number;
}

export interface OpenPageResult {
  response: Awaited<ReturnType<Page['goto']>>;
  blocked: string[];
}

/**
 * Opens a page under test with third-party requests blocked and the theme
 * pre-seeded into localStorage before any page script runs.
 */
export async function openPage(
  page: Page,
  name: PageName,
  { theme = 'light', width = 1280, height = 800 }: OpenPageOptions = {}
): Promise<OpenPageResult> {
  const blocked = blockThirdParty(page);
  await page.setViewportSize({ width, height });
  await page.addInitScript(
    ({ key, theme: themeValue }) => {
      if (themeValue === 'dark') {
        window.localStorage.setItem(key, themeValue);
      } else {
        window.localStorage.removeItem(key);
      }
    },
    { key: THEME_STORAGE_KEY, theme }
  );
  const path = name === 'harness' ? '/tests/fixtures/harness.html' : `/mockups/${name}.html`;
  const response = await page.goto(path);
  if (!response || response.status() !== 200) {
    throw new Error(`openPage(${name}): expected status 200, got ${response?.status()}`);
  }
  return { response, blocked };
}

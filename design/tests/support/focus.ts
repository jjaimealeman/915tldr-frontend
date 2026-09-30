import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * D-14: keyboard-walk support. Everything here exists because of a real
 * prior failure (01-CONTEXT.md) — a focus ring clipped on two sides,
 * "verified" by grepping HTML. `inspectFocus` therefore measures ring
 * geometry against every clipping ancestor (`overflow-x`/`overflow-y`
 * checked separately per 01-RESEARCH.md's own correction — the shorthand
 * reports mixed values as two words — plus `contain` and `clip-path`, and
 * the viewport edge), whether the ring is obscured by another element, and
 * whether it contrasts with what is actually behind it, never by inspecting
 * CSS declarations alone.
 */

export interface FocusableInfo {
  /** A stable path (tag plus nth-of-type chain) identifying the element. */
  path: string;
  /** Accessible name: aria-label, else normalised innerText, else title. */
  name: string;
}

export interface TabStop {
  path: string;
  name: string;
}

export interface RingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FocusInspection {
  focusVisible: boolean;
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  boxShadowSet: boolean;
  ringBox: RingBox;
  clippedBy: string | null;
  outsideViewport: boolean;
  obscured: boolean;
  ringColor: string;
  effectiveBackground: string;
  ringContrast: number;
}

export interface ContactSheetShot {
  buffer: Buffer;
  index: number;
  name: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * In-page: enumerates every focusable element on the current page, keeping
 * only elements that have client rects, are not inside a `hidden` ancestor,
 * and whose computed `visibility` is not `hidden`. Returns each element's
 * stable path and accessible name, in document order.
 */
export async function enumerateFocusables(page: Page): Promise<FocusableInfo[]> {
  return page.evaluate((selector) => {
    function computePath(el: Element): string {
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && node !== document.documentElement) {
        const parent: Element | null = node.parentElement;
        let index = 1;
        if (parent) {
          const sameTag = Array.from(parent.children).filter((c) => c.tagName === (node as Element).tagName);
          index = sameTag.indexOf(node) + 1;
        }
        parts.unshift(`${node.tagName}:nth-of-type(${index})`);
        node = parent;
      }
      return parts.join('>');
    }

    function computeName(el: Element): string {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const text = ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ');
      if (text) return text;
      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();
      return '';
    }

    const candidates = Array.from(document.querySelectorAll(selector));
    const results: { path: string; name: string }[] = [];

    for (const el of candidates) {
      if (el.getClientRects().length === 0) continue;

      let hiddenAncestor = false;
      let ancestor: Element | null = el;
      while (ancestor) {
        if ((ancestor as HTMLElement).hidden) {
          hiddenAncestor = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (hiddenAncestor) continue;

      if (getComputedStyle(el).visibility === 'hidden') continue;

      results.push({ path: computePath(el), name: computeName(el) });
    }

    return results;
  }, FOCUSABLE_SELECTOR);
}

/**
 * Blurs the active element, then presses `key` repeatedly (up to the
 * focusable count plus 5), recording the active element's path and name
 * after each press. Stops when focus returns to a path already recorded
 * (the tab order has cycled) or when focus leaves the document (falls back
 * to `document.body`).
 */
export async function walkTabOrder(page: Page, key: string): Promise<TabStop[]> {
  const focusables = await enumerateFocusables(page);
  const maxPresses = focusables.length + 5;

  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
  });

  const stops: TabStop[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press(key);

    const stop = await page.evaluate(() => {
      function computePath(el: Element): string {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
          const parent: Element | null = node.parentElement;
          let index = 1;
          if (parent) {
            const sameTag = Array.from(parent.children).filter((c) => c.tagName === (node as Element).tagName);
            index = sameTag.indexOf(node) + 1;
          }
          parts.unshift(`${node.tagName}:nth-of-type(${index})`);
          node = parent;
        }
        return parts.join('>');
      }

      function computeName(el: Element): string {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim();
        const text = ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ');
        if (text) return text;
        const title = el.getAttribute('title');
        if (title && title.trim()) return title.trim();
        return '';
      }

      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return { path: computePath(el), name: computeName(el) };
    });

    if (!stop) break;
    if (seen.has(stop.path)) break;
    seen.add(stop.path);
    stops.push(stop);
  }

  return stops;
}

/**
 * In-page: inspects `document.activeElement`'s focus state — visibility,
 * ring geometry, clipping, viewport containment, obscuring, and contrast of
 * the ring colour against the first non-transparent ancestor background
 * (falling back to the computed `--paper`).
 */
export async function inspectFocus(page: Page): Promise<FocusInspection> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      throw new Error('inspectFocus: no active element');
    }

    const style = getComputedStyle(el);
    const focusVisible = el.matches(':focus-visible');
    const outlineStyle = style.outlineStyle;
    const outlineWidth = parseFloat(style.outlineWidth) || 0;
    const outlineOffset = parseFloat(style.outlineOffset) || 0;
    const boxShadowSet = style.boxShadow !== 'none';

    const rect = el.getBoundingClientRect();
    const pad = outlineWidth + Math.max(outlineOffset, 0);
    // The envelope ring box — spans every line fragment of a wrapped inline
    // element (e.g. a multi-line link). Returned as the single `ringBox`
    // field (useful for evidence screenshot cropping), but NOT used for the
    // obscured/clipped/viewport checks below: a wrapped inline element's
    // bounding-rect envelope includes the empty gap between its line
    // fragments (e.g. between a short first line and a shorter second
    // line), which is not actually part of the rendered ring. A real
    // browser draws (and WCAG 2.4.11 cares about) an outline around each
    // line fragment individually, so per-fragment rects — via
    // getClientRects(), which return one rect per fragment and equal
    // getBoundingClientRect() for a single-line element — are what the
    // correctness checks use.
    const ringBox = {
      left: rect.left - pad,
      top: rect.top - pad,
      right: rect.right + pad,
      bottom: rect.bottom + pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };

    const fragmentRects = Array.from(el.getClientRects());
    const fragments = (fragmentRects.length > 0 ? fragmentRects : [rect]).map((r) => ({
      left: r.left - pad,
      top: r.top - pad,
      right: r.right + pad,
      bottom: r.bottom + pad,
      centerX: r.left + r.width / 2,
      centerY: r.top + r.height / 2,
    }));

    function describeAncestor(a: Element): string {
      const idPart = a.id ? `#${a.id}` : '';
      return `${a.tagName}${idPart}`;
    }

    let clippedBy: string | null = null;
    {
      let ancestor: Element | null = el.parentElement;
      while (ancestor) {
        const aStyle = getComputedStyle(ancestor);
        const overflowClips =
          ['hidden', 'clip', 'auto', 'scroll'].includes(aStyle.overflowX) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(aStyle.overflowY);
        const containClips = ['paint', 'content', 'strict'].some((v) => aStyle.contain.includes(v));
        const clipPathClips = aStyle.clipPath !== 'none';

        if (overflowClips || containClips || clipPathClips) {
          const aRect = ancestor.getBoundingClientRect();
          const aEl = ancestor as HTMLElement;
          const padBoxLeft = aRect.left + aEl.clientLeft;
          const padBoxTop = aRect.top + aEl.clientTop;
          const padBoxRight = padBoxLeft + aEl.clientWidth;
          const padBoxBottom = padBoxTop + aEl.clientHeight;

          const anyFragmentClipped = fragments.some(
            (f) => !(f.left >= padBoxLeft && f.top >= padBoxTop && f.right <= padBoxRight && f.bottom <= padBoxBottom)
          );

          if (anyFragmentClipped) {
            clippedBy = describeAncestor(ancestor);
            break;
          }
        }

        if (ancestor === document.documentElement) break;
        ancestor = ancestor.parentElement;
      }
    }

    const outsideViewport = fragments.some((f) => f.left < 0 || f.right > window.innerWidth);

    const obscured = fragments.some((f) => {
      const atPoint = document.elementFromPoint(f.centerX, f.centerY);
      return !(atPoint && (atPoint === el || el.contains(atPoint)));
    });

    /**
     * Resolves ANY computed CSS colour string to concrete sRGB, regardless
     * of which serialisation the engine chose (this specific Chromium build
     * serialises a `background-color`/`outline-color` authored via oklch()
     * back out as "oklch(...)", not "rgb(...)" — the plan's assumption that
     * "the browser's resolved sRGB is already given" does not hold here).
     * Painting the colour onto a 1x1 canvas over both a white and a black
     * backdrop and reading the resulting pixel is engine-agnostic: canvas
     * compositing always resolves to concrete sRGB device pixels. If the
     * colour has no visible effect over either backdrop (white stays white,
     * black stays black), it is fully transparent (alpha 0); the two
     * project's tokens use no partial alpha, so any other outcome is
     * treated as opaque, using the sample painted over black.
     */
    function resolveOpaqueRgb(value: string): { rgb: [number, number, number]; isTransparent: boolean } {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillRect(1, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 2, 1).data;
      const onWhite: [number, number, number] = [data[0], data[1], data[2]];
      const onBlack: [number, number, number] = [data[4], data[5], data[6]];
      const isTransparent =
        onWhite[0] === 255 &&
        onWhite[1] === 255 &&
        onWhite[2] === 255 &&
        onBlack[0] === 0 &&
        onBlack[1] === 0 &&
        onBlack[2] === 0;
      return { rgb: onBlack, isTransparent };
    }

    function relLuminance([r, g, b]: [number, number, number]): number {
      const toLin = (c: number) => {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    }

    const ringColor = style.outlineColor;

    let effectiveBackground = '';
    let effectiveRgb: [number, number, number] = [255, 255, 255];
    {
      let node: Element | null = el.parentElement;
      let found = false;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        const { rgb, isTransparent } = resolveOpaqueRgb(bg);
        if (!isTransparent) {
          effectiveBackground = bg;
          effectiveRgb = rgb;
          found = true;
          break;
        }
        node = node.parentElement;
      }
      if (!found) {
        const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
        effectiveBackground = paper;
        effectiveRgb = resolveOpaqueRgb(paper).rgb;
      }
    }

    const ringRgb = resolveOpaqueRgb(ringColor).rgb;

    const l1 = relLuminance(ringRgb);
    const l2 = relLuminance(effectiveRgb);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ringContrast = (lighter + 0.05) / (darker + 0.05);

    return {
      focusVisible,
      outlineStyle,
      outlineWidth,
      outlineOffset,
      boxShadowSet,
      ringBox,
      clippedBy,
      outsideViewport,
      obscured,
      ringColor,
      effectiveBackground,
      ringContrast,
    };
  });
}

/**
 * Opens a fresh page in the same browser context, lays the given shots out
 * as a captioned grid (index, accessible name), and screenshots the full
 * page to `outPath`. `caption` carries page-level context (page/theme/
 * width/engine and the tab key used).
 */
export async function buildContactSheet(
  page: Page,
  shots: ContactSheetShot[],
  caption: string,
  outPath: string
): Promise<void> {
  const sheetPage = await page.context().newPage();

  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const figures = shots
    .map((shot) => {
      const dataUrl = `data:image/png;base64,${shot.buffer.toString('base64')}`;
      return `<figure><img src="${dataUrl}" alt=""><figcaption>#${shot.index} — ${escape(shot.name || '(no name)')}</figcaption></figure>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: sans-serif; background: #fff; margin: 0; padding: 16px; }
  h1 { font-size: 14px; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  figure { margin: 0; border: 1px solid #ccc; padding: 4px; background: #fafafa; }
  figcaption { font-size: 11px; word-break: break-word; margin-top: 4px; }
  img { max-width: 100%; display: block; background: #eee; }
</style>
</head>
<body>
  <h1>${escape(caption)}</h1>
  <div class="grid">${figures}</div>
</body>
</html>`;

  await sheetPage.setContent(html);
  mkdirSync(path.dirname(outPath), { recursive: true });
  await sheetPage.screenshot({ path: outPath, fullPage: true });
  await sheetPage.close();
}

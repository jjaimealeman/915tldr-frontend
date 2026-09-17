import type { Page } from '@playwright/test';

/**
 * D-GAP-A support: under `font-display: optional`, a webfont that misses the
 * short block period is never used for that document view -- the page
 * silently keeps its fallback for the rest of that load. Any width or layout
 * measurement of a "primary family" element is only meaningful when the
 * primary webfont actually won that race. These two helpers make that
 * assumption checkable instead of assumed:
 *
 * - `renderedPrimaryFaces` finds which (family, style, weight) triples this
 *   page actually renders text in, restricted to the project's two primary
 *   families.
 * - `assertWebfontsInUse` proves, for each such triple, that the primary
 *   webfont — not its metric-compatible fallback — is the face actually
 *   painted, by comparing a probe span's rendered width in the page's real
 *   font stack against the same stack with the primary family stripped out.
 */

const PRIMARY_FAMILIES = ['Instrument Serif', 'Source Serif 4'];
const PROBE_TEXT = 'Hamburgefonstiv ÁÉÍÓÚñü 0123456789';

export interface RenderedFace {
  family: string;
  style: string;
  weight: string;
}

/**
 * Strips a leading/trailing quote pair the same way structure.spec's
 * firstFamily helper does, so a computed font-family's first entry (which
 * the browser always quotes when the family name contains a space) compares
 * cleanly against the bare PRIMARY_FAMILIES strings.
 */
function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * In-page: walks every element that has a direct non-empty text node and is
 * actually rendered (a non-zero client rect), and returns the distinct
 * (family, style, weight) triples whose computed first font-family is one of
 * this project's two primary families.
 */
export async function renderedPrimaryFaces(page: Page): Promise<RenderedFace[]> {
  return page.evaluate(
    ({ primaryFamilies }) => {
      function hasDirectNonWhitespaceText(el: Element): boolean {
        for (const node of Array.from(el.childNodes)) {
          if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent &&
            node.textContent.trim().length > 0
          ) {
            return true;
          }
        }
        return false;
      }

      function firstFamily(fontFamily: string): string {
        const first = fontFamily.split(',')[0]?.trim() ?? '';
        return first.replace(/^["']|["']$/g, '');
      }

      const seen = new Map<string, { family: string; style: string; weight: string }>();
      for (const el of Array.from(document.querySelectorAll('*'))) {
        if (!hasDirectNonWhitespaceText(el)) continue;
        if (el.getClientRects().length === 0) continue;

        const style = getComputedStyle(el);
        const family = firstFamily(style.fontFamily);
        if (!primaryFamilies.includes(family)) continue;

        const key = `${family}|${style.fontStyle}|${style.fontWeight}`;
        if (!seen.has(key)) {
          seen.set(key, { family, style: style.fontStyle, weight: style.fontWeight });
        }
      }

      return [...seen.values()];
    },
    { primaryFamilies: PRIMARY_FAMILIES }
  );
}

/**
 * In-page probe: for `family`/`style`/`weight`, measures a hidden nowrap span
 * at 100px in (a) the page's own custom-property stack for that family's role
 * (--font-display for Instrument Serif, --font-body for Source Serif 4), and
 * (b) the same stack with the primary family name removed (fallback-only).
 * Returns both widths so the caller can decide whether they differ enough to
 * prove the primary webfont actually painted.
 */
async function probeWidths(
  page: Page,
  face: RenderedFace
): Promise<{ withPrimary: number; fallbackOnly: number }> {
  return page.evaluate(
    ({ face, probeText }) => {
      const varName = face.family === 'Instrument Serif' ? '--font-display' : '--font-body';
      const stackValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

      // The stack's first entry is always the primary family (quoted, since
      // it contains a space) -- strip exactly that first entry to get the
      // fallback-only stack, rather than string-replacing the family name
      // (which could coincidentally match inside a later fallback label like
      // "... Fallback: Georgia").
      const parts = stackValue.split(',').map((p) => p.trim());
      const fallbackOnlyStack = parts.slice(1).join(', ');

      function measure(fontFamilyStack: string): number {
        const span = document.createElement('span');
        span.style.position = 'absolute';
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'nowrap';
        span.style.left = '-99999px';
        span.style.top = '0';
        span.style.fontFamily = fontFamilyStack;
        span.style.fontStyle = face.style;
        span.style.fontWeight = face.weight;
        span.style.fontSize = '100px';
        span.textContent = probeText;
        document.body.appendChild(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return width;
      }

      return {
        withPrimary: measure(stackValue),
        fallbackOnly: measure(fallbackOnlyStack),
      };
    },
    { face, probeText: PROBE_TEXT }
  );
}

/**
 * For each face in `faces`, proves the primary webfont is the one actually
 * rendering (not a same-named-variable fallback under `font-display:
 * optional`'s short block period). Awaits document.fonts.load() for that
 * exact style/weight/family at 100px, waits two animation frames for style
 * to settle, then probes rendered width with vs without the primary family
 * in the stack. A difference below 0.5px means the two stacks rendered
 * identically -- i.e. the fallback face was used for the "with primary"
 * measurement too, so the webfont is not actually in use. Throws in that
 * case, naming the face, so a silent fallback measurement is never mistaken
 * for a webfont measurement.
 */
export async function assertWebfontsInUse(page: Page, faces: RenderedFace[]): Promise<void> {
  for (const face of faces) {
    await page.evaluate(
      async ({ face }) => {
        try {
          await document.fonts.load(`${face.weight} ${face.style} 100px "${face.family}"`);
        } catch {
          // status checked via the probe-width comparison below either way
        }
      },
      { face }
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    );

    const { withPrimary, fallbackOnly } = await probeWidths(page, face);
    const delta = Math.abs(withPrimary - fallbackOnly);
    if (delta < 0.5) {
      throw new Error(
        `assertWebfontsInUse: "${face.family}" (${face.style} ${face.weight}) is not rendering -- ` +
          `the font-display: optional block period elapsed and this view is showing the fallback face. ` +
          `Any width/layout measurement of this face would silently measure the fallback, not the webfont.`
      );
    }
  }
}

export { stripQuotes };

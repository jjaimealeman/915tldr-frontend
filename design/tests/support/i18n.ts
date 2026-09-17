import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertWebfontsInUse, PRIMARY_FAMILIES } from './fonts-in-use.ts';

/**
 * D-15/criterion-4 support: loads the real+synthetic Spanish fixture (01-04),
 * injects a component's Spanish text into its markup hook, and measures
 * overflow/clipping/width against the same real production CSS the mockups
 * ship — never a synthetic stand-in DOM.
 */

export interface SpanishCalibration {
  widthRatio: number;
  hi: number;
  graphemeRatio: number;
  utf8ByteRatio: number;
}

export interface SpanishComponent {
  id: string;
  component: string;
  page: string;
  fontRole: string;
  fontStyle: string;
  en: string;
  enSource: string;
  es_real: string;
  esRealSource: string;
  es_synthetic: string;
  calibration: SpanishCalibration;
  /**
   * 01-17 (Task 3): true for a component whose injection hook is a
   * visually-hidden element (e.g. the new-tab cue span) — spanish-overflow's
   * layout loop cannot meaningfully check overflow/clip/container-growth
   * against something that never occupies visible space by design, so
   * componentsForPage excludes assistiveOnly components from that loop.
   * Such a component gets its own dedicated accessible-name test instead.
   */
  assistiveOnly?: boolean;
}

export interface SpanishFixture {
  corpusSpanish: unknown;
  components: SpanishComponent[];
}

const FIXTURE_PATH = path.resolve('design/fixtures/spanish-stress.json');

export function loadSpanishFixture(): SpanishFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

/**
 * In-page: finds the target element (resolved the same way overflowReport
 * resolves it — see that function's doc comment), writes `text` into the
 * deepest descendant that holds the element's only non-whitespace text node
 * (or the element itself when it has no element children), marks the
 * element lang="es", records the injected text (for overflowReport's
 * textMatches check), waits two animation frames, and returns a stable path
 * identifying the element. The element-resolution and stable-key logic is
 * inlined rather than shared with overflowReport/geometry.ts's own copies,
 * since none of Playwright's page.evaluate boundaries let a Node-side
 * function be composed from smaller in-page helpers without eval — and
 * eval'ing a dynamically assembled string inside the page context is a
 * needless code-injection surface for a same-file, ~15-line function this
 * project does not need.
 */
export async function injectText(page: Page, id: string, text: string): Promise<string> {
  return page.evaluate(
    ({ id, text }) => {
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

      const el = document.querySelector(`[data-i18n="${id}"]`) ?? document.querySelector(id);
      if (!el) throw new Error(`injectText: no element found for "${id}"`);

      /**
       * Finds the element to overwrite: when `el` has no element children,
       * `el` itself holds its own sole text directly. Otherwise, finds the
       * deepest descendant that holds the element's only non-whitespace
       * text node. When that search is ambiguous (more than one
       * text-bearing descendant — e.g. a byline's source span, separator
       * text and <time> each carrying their own text), the whole subtree is
       * a single composed unit with no unambiguous single hook to target,
       * so `el` itself is overwritten wholesale — consistent with treating
       * the fixture component's text as the entire rendered content of its
       * hook, not a sub-fragment of it.
       */
      function deepestSoleTextDescendant(node: Element): Element {
        if (node.children.length === 0) return node;
        const holders = new Set<Element>();
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        // eslint-disable-next-line no-cond-assign
        while ((textNode = walker.nextNode())) {
          if (textNode.textContent && textNode.textContent.trim().length > 0 && textNode.parentElement) {
            holders.add(textNode.parentElement);
          }
        }
        return holders.size === 1 ? [...holders][0] : node;
      }

      const target = deepestSoleTextDescendant(el);
      target.textContent = text;
      el.setAttribute('lang', 'es');

      // Marked on the actual overwritten element (which may be a
      // descendant of `el`, e.g. card-headline's inner <a>) so
      // overflowReport's textMatches check compares only the text actually
      // written, never an untouched sibling element's own unrelated text.
      target.setAttribute('data-i18n-injected', '');
      (target as HTMLElement).dataset.i18nInjectedText = text;

      return stableKey(el);
    },
    { id, text }
  ).then(async (resultKey) => {
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    );
    return resultKey;
  });
}

export interface OverflowReport {
  visible: boolean;
  textMatches: boolean;
  hOverflow: boolean;
  ellipsis: boolean;
  clamp: boolean;
  vClipped: boolean;
  pastViewport: boolean;
  docOverflow: boolean;
  containerHeight: number;
  /**
   * The element's own rendered text length at report time — used by
   * spanish-overflow.spec.ts to decide whether a shorter container after
   * injection is expected (the injected variant is itself shorter than what
   * was there) rather than a clip, since D-15's stress components are not
   * guaranteed longer than whatever placeholder/corpus text a given hook
   * happened to carry beforehand.
   */
  textLength: number;
  /**
   * True when the nearest matching container is a tight, content-scoped
   * wrapper (a card/lead/block/dispatch/form) rather than a broad structural
   * landmark (nav/header/main) whose height reflects the whole page/section,
   * not this element's own box — container-height comparisons are only
   * meaningful in the tight case.
   */
  containerTight: boolean;
  /**
   * True when the resolved element's computed `hyphens` is `auto` (headline
   * elements — 01-08/D-01's long-word overflow defense). `hyphens: auto`
   * only actually engages a hyphenation dictionary once an element's
   * resolved `lang` is known — injectText() sets `lang="es"` as part of
   * every injection — so a same-length or even longer string can
   * legitimately wrap onto FEWER lines than the un-hyphenated baseline once
   * injected, shrinking its container with no text lost or clipped. This is
   * a real, desired effect of the CSS (confirmed 01-15 via a minimal
   * setAttribute('lang','es')-only repro reproducing the exact same
   * shrink with no text change at all), not a regression — the
   * container-growth heuristic below is not meaningful for an element where
   * this is true, so spanish-overflow.spec.ts skips it in that case and
   * relies solely on vClipped (the authoritative clip signal, unaffected by
   * this field).
   */
  hyphensAuto: boolean;
}

const TIGHT_CONTAINER_SELECTORS = '[data-card], [data-lead], [data-block], [data-dispatch], form';

/**
 * In-page: for the element resolved from `id` (see injectText's doc comment
 * on resolution order), reports every D-15/D-07 overflow signal — never just
 * a single scrollWidth>clientWidth check — up the ancestor chain to the
 * nearest element matching `containerSelector`.
 */
export async function overflowReport(page: Page, id: string, containerSelector: string): Promise<OverflowReport> {
  return page.evaluate(
    ({ id, containerSelector, tightSelector }) => {
      const el = document.querySelector(`[data-i18n="${id}"]`) ?? document.querySelector(id);
      if (!el) throw new Error(`overflowReport: no element found for "${id}"`);

      const visible = el.getClientRects().length > 0 && ((el as HTMLElement).offsetWidth > 0 || (el as HTMLElement).offsetHeight > 0);

      const injectedHolder = el.hasAttribute('data-i18n-injected') ? el : el.querySelector('[data-i18n-injected]');
      const injected = injectedHolder ? (injectedHolder as HTMLElement).dataset.i18nInjectedText : undefined;
      // Case-folded: innerText reflects rendering (e.g. text-transform:
      // uppercase on nav labels), which is a legitimate presentation
      // behaviour, not content loss — textMatches exists to catch
      // truncation/substitution, not letter-case fidelity.
      const normalise = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const textMatches =
        injected === undefined || !injectedHolder
          ? true
          : normalise((injectedHolder as HTMLElement).innerText || '') === normalise(injected);

      const containerSelectors = containerSelector
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tightSelectors = tightSelector
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const matchesContainer = (node: Element) => containerSelectors.some((sel) => node.matches(sel));
      const matchesTight = (node: Element) => tightSelectors.some((sel) => node.matches(sel));

      // The element itself is always checked for horizontal overflow,
      // regardless of its own overflow-x (per D-15's "and for the element
      // itself in any case").
      let hOverflow = el.scrollWidth > el.clientWidth + 1;
      let ellipsis = false;
      let clamp = false;
      let vClipped = false;
      let containerHeight: number | null = null;
      let containerTight = false;

      let ancestor: Element | null = el;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (ancestor !== el && style.overflowX !== 'visible' && ancestor.scrollWidth > ancestor.clientWidth + 1) {
          hOverflow = true;
        }
        if (style.textOverflow === 'ellipsis') ellipsis = true;
        const lineClamp = style.getPropertyValue('-webkit-line-clamp') || style.getPropertyValue('line-clamp');
        if (lineClamp && lineClamp !== 'none') clamp = true;
        if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && ancestor.scrollHeight > ancestor.clientHeight + 1) {
          vClipped = true;
        }
        if (matchesContainer(ancestor)) {
          containerHeight = ancestor.getBoundingClientRect().height;
          containerTight = matchesTight(ancestor);
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (containerHeight === null) {
        containerHeight = el.getBoundingClientRect().height;
        containerTight = true; // el itself is the tightest possible wrapper
      }

      const rect = el.getBoundingClientRect();
      const pastViewport = rect.right > window.innerWidth + 0.5;
      const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
      const textLength = ((el as HTMLElement).innerText || '').trim().length;
      const hyphensAuto = getComputedStyle(el).hyphens === 'auto';

      return {
        visible,
        textMatches,
        hOverflow,
        ellipsis,
        clamp,
        vClipped,
        pastViewport,
        docOverflow,
        containerHeight,
        containerTight,
        textLength,
        hyphensAuto,
      };
    },
    { id, containerSelector, tightSelector: TIGHT_CONTAINER_SELECTORS }
  );
}

/**
 * In-page: renders `a` and `b` in offscreen white-space:nowrap spans using
 * the resolved element's own computed font-family/style/weight/size, and
 * returns widthB / widthA — the real rendered width ratio in the production
 * fonts, never a byte or code-point proxy.
 *
 * D-GAP-A (01-13 continuation, Task 3): before measuring, resolves the
 * element's own computed first font-family/style/weight and, only when that
 * family is one of this project's two primary families AND its style is
 * "normal", calls assertWebfontsInUse for exactly that face. Under
 * font-display: optional a primary webfont that missed its block period is
 * never used for that document view — without this guard, a width
 * measurement here would silently measure the metric-compatible fallback
 * face and report it as if it were the real webfont, exactly the failure
 * mode this plan's Task 1 instrument exists to catch elsewhere.
 *
 * The style==="normal" restriction mirrors geometry.ts's measureReferenceLoad
 * (Task 2): D-GAP-A preloads exactly two resources, both font-style: normal
 * (InstrumentSerif-Regular.woff2, SourceSerif4-Roman.woff2 — the latter's
 * single @font-face covers the 400-700 weight range, so bold text shares
 * that same preloaded resource and stays in scope). Italic primary text
 * (e.g. article's [data-standfirst] deck) uses a separate, deliberately
 * non-preloaded @font-face; confirmed on both engines (article.html, index
 * and 768px widths) that it deterministically — not a timing flake, per
 * Task 2's own investigation — misses the optional block period on every
 * normal (unthrottled) load, because nothing accelerates its fetch start
 * the way preload does for the other two. Enforcing "prove in use" against
 * italic here would make every Spanish width measurement of italic content
 * throw unconditionally, which is not this guard's purpose (catching a
 * SILENT wrong measurement) — a deterministic, already-documented,
 * permanent state is not silent.
 */
export async function widthRatio(page: Page, id: string, a: string, b: string): Promise<number> {
  const resolvedFace = await page.evaluate(({ id }) => {
    const el = document.querySelector(`[data-i18n="${id}"]`) ?? document.querySelector(id);
    if (!el) throw new Error(`widthRatio: no element found for "${id}"`);
    const style = getComputedStyle(el);
    const firstFamily = (style.fontFamily.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');
    return { family: firstFamily, style: style.fontStyle, weight: style.fontWeight };
  }, { id });

  if (PRIMARY_FAMILIES.includes(resolvedFace.family) && resolvedFace.style === 'normal') {
    await assertWebfontsInUse(page, [resolvedFace]);
  }

  return page.evaluate(
    ({ id, a, b }) => {
      const el = document.querySelector(`[data-i18n="${id}"]`) ?? document.querySelector(id);
      if (!el) throw new Error(`widthRatio: no element found for "${id}"`);
      const style = getComputedStyle(el);

      function measure(text: string): number {
        const span = document.createElement('span');
        span.style.position = 'absolute';
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'nowrap';
        span.style.left = '-99999px';
        span.style.fontFamily = style.fontFamily;
        span.style.fontStyle = style.fontStyle;
        span.style.fontWeight = style.fontWeight;
        span.style.fontSize = style.fontSize;
        span.textContent = text;
        document.body.appendChild(span);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return width;
      }

      const widthA = measure(a);
      const widthB = measure(b);
      return widthB / widthA;
    },
    { id, a, b }
  );
}

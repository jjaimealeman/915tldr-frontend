import type { Browser, Page } from '@playwright/test';
import { blockThirdParty, THEME_STORAGE_KEY, type PageName } from './harness.ts';
import { assertWebfontsInUse, renderedPrimaryFaces } from './fonts-in-use.ts';

/**
 * D-08: font-swap CLS measurement instrument. Everything here is written to
 * survive an engine (WebKit) that never implements the `layout-shift`
 * PerformanceObserver entry type (caniuse `mdn-api_layoutshift`, unsupported
 * through Safari 27.1/iOS 27.1 per 01-RESEARCH.md and 01-02-PLAN.md's
 * research correction 2): `nativeCls` is reported as `null`, never as 0, in
 * that case, and `geometryScore` (a from-scratch, engine-independent
 * geometry diff) is the metric asserted on everywhere.
 */

export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutSnapshot {
  /**
   * Per-element array of rendered LINE FRAGMENTS (getClientRects()), not a
   * single bounding-rect envelope — see snapshotLayout's own doc comment for
   * why an envelope-only comparison under-counts real shift for any
   * multi-line-wrapping text element.
   */
  elements: Record<string, LayoutRect[]>;
  innerWidth: number;
  innerHeight: number;
  scrollHeight: number;
}

/**
 * Registers an addInitScript that records, before any page script runs,
 * whether the `layout-shift` PerformanceObserver entry type is supported
 * (window.__clsSupported), and — when it is — observes it with
 * `buffered: true`, pushing every entry's { value, startTime, hadRecentInput }
 * into window.__cls.
 */
export async function installClsObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
    (window as any).__clsSupported = supported;
    (window as any).__cls = [];
    if (!supported) return;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        (window as any).__cls.push({
          value: entry.value,
          startTime: entry.startTime,
          hadRecentInput: entry.hadRecentInput,
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

export interface FontHold {
  /** Continues every currently-pending (and any future) held font request. */
  release: () => void;
  /**
   * URLs currently held pending (requested, not yet continued). Used as an
   * engine-agnostic "is the hold actually intercepting a request right now"
   * check — see the doc comment on measureFontSwap's pre-release assertion
   * for why this, rather than document.fonts FontFace status, is what's
   * asserted on before release().
   */
  pendingUrls: () => string[];
}

/**
 * Routes every fonts/*.woff2 request and keeps each one pending until
 * release() is called — a deterministic stand-in for network throttling.
 * Must be registered *before* openPage()/blockThirdParty(): Playwright
 * invokes route handlers in reverse registration order, so registering this
 * handler first means blockThirdParty (registered second, inside openPage)
 * runs first for every request and falls through via route.fallback() for
 * local traffic, letting this earlier-registered handler still process
 * matching font requests (see harness.ts's blockThirdParty doc comment).
 */
export function holdFonts(page: Page): FontHold {
  let released = false;
  const releasers: Array<() => void> = [];
  const pending = new Set<string>();

  page.route('**/fonts/*.woff2', async (route) => {
    const url = route.request().url();
    if (released) {
      await route.continue();
      return;
    }
    pending.add(url);
    await new Promise<void>((resolve) => {
      releasers.push(() => {
        pending.delete(url);
        route.continue();
        resolve();
      });
    });
  });

  return {
    release: () => {
      released = true;
      const toRun = releasers.splice(0, releasers.length);
      for (const fn of toRun) fn();
    },
    pendingUrls: () => [...pending],
  };
}

/**
 * In-page snapshot of every element that has a direct non-whitespace text
 * node child, or is an img/[data-card]/[data-lead]/[data-block], keyed by a
 * stable tag+nth-of-type path so before/after snapshots can be diffed by key
 * rather than by element identity (elements aren't reused across snapshots).
 *
 * Each element is recorded as its array of rendered LINE FRAGMENTS
 * (el.getClientRects()), not a single getBoundingClientRect() envelope.
 * 01-09's own investigation of WINDOWS.md entry 6 (a Chromium native-CLS
 * reading that this instrument's earlier envelope-only version reported as
 * zero shift) found the root cause here: an inline text element that wraps
 * across multiple lines (e.g. changelog.html's `[data-item-sentence]`
 * spans, several sentences long) can have individual LINES reflow onto
 * different characters/positions after a font swap while its overall
 * bounding-rect *envelope* (top-left of the first line to bottom-right of
 * the last) stays nearly unchanged — the same "envelope hides real
 * per-fragment movement" failure mode 01-08's focus.ts already documented
 * for focus rings on wrapped links. Native layout-shift tracks the
 * browser's own render-tree fragment/paint boxes, which this project's own
 * "01-08 standard" (focus.ts) already established is the correct
 * granularity for exactly this reason.
 */
export async function snapshotLayout(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
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

    const candidates = new Set<Element>();
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (hasDirectNonWhitespaceText(el)) candidates.add(el);
    }
    for (const el of Array.from(document.querySelectorAll('img, [data-card], [data-lead], [data-block]'))) {
      candidates.add(el);
    }

    const elements: Record<string, { left: number; top: number; width: number; height: number }[]> = {};
    for (const el of candidates) {
      elements[stableKey(el)] = Array.from(el.getClientRects()).map((rect) => ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }));
    }

    return {
      elements,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

export interface ShiftScoreResult {
  score: number;
  maxDisplacementPx: number;
  movedCount: number;
}

/**
 * From-scratch implementation of the W3C Layout Instability formula (impact
 * fraction x distance fraction), operating on two snapshotLayout() results
 * rather than the browser's own layout-shift entries — this is what lets
 * WebKit (which never fires layout-shift) still get a real score. An
 * element is "unstable" when its left or top moved by >= 1 CSS px between
 * snapshots; the impact region is the union of the viewport-clipped
 * before/after rects of every unstable element, rasterised on a 2px grid to
 * approximate exact area without a full polygon-union implementation.
 */
export function layoutShiftScore(before: LayoutSnapshot, after: LayoutSnapshot): ShiftScoreResult {
  const viewportWidth = Math.max(before.innerWidth, after.innerWidth);
  const viewportHeight = Math.max(before.innerHeight, after.innerHeight);
  const viewportArea = viewportWidth * viewportHeight;
  const cellSize = 2;

  let maxDisplacementPx = 0;
  let movedCount = 0;
  const impactedCells = new Set<string>();

  function clipToViewport(rect: LayoutRect) {
    return {
      left: Math.max(0, rect.left),
      top: Math.max(0, rect.top),
      right: Math.min(viewportWidth, rect.left + rect.width),
      bottom: Math.min(viewportHeight, rect.top + rect.height),
    };
  }

  function markCells(rect: { left: number; top: number; right: number; bottom: number }) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) return;
    const startCol = Math.floor(rect.left / cellSize);
    const endCol = Math.floor((rect.right - 0.0001) / cellSize);
    const startRow = Math.floor(rect.top / cellSize);
    const endRow = Math.floor((rect.bottom - 0.0001) / cellSize);
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        impactedCells.add(`${row}:${col}`);
      }
    }
  }

  const keys = new Set([...Object.keys(before.elements), ...Object.keys(after.elements)]);
  for (const key of keys) {
    const bFragments = before.elements[key];
    const aFragments = after.elements[key];
    if (!bFragments || !aFragments) continue; // only elements present in both snapshots can be compared

    const pairedCount = Math.min(bFragments.length, aFragments.length);

    // Fragment-by-fragment (line-by-line), not envelope-to-envelope: a
    // multi-line element whose overall bounding box barely changes can
    // still have individual lines reflow onto different positions — see
    // snapshotLayout's doc comment.
    for (let i = 0; i < pairedCount; i++) {
      const b = bFragments[i];
      const a = aFragments[i];
      const dLeft = Math.abs(a.left - b.left);
      const dTop = Math.abs(a.top - b.top);
      if (dLeft < 1 && dTop < 1) continue; // stable

      movedCount++;
      const displacement = Math.max(dLeft, dTop);
      if (displacement > maxDisplacementPx) maxDisplacementPx = displacement;

      markCells(clipToViewport(b));
      markCells(clipToViewport(a));
    }

    // A fragment COUNT change (a line gained or lost — exactly the "same
    // envelope, different line count" case this fragment-level rewrite
    // exists to catch) is itself real, visible movement: every fragment
    // beyond the shorter array's length has no counterpart to diff
    // against, so it's counted directly, with its own height standing in
    // for "how far" (a gained/lost line displaces roughly one line-height
    // of content, a reasonable local proxy without needing to trace every
    // downstream element's own cascading position change, which those
    // elements' own keys already capture independently).
    const longer = bFragments.length >= aFragments.length ? bFragments : aFragments;
    for (let i = pairedCount; i < longer.length; i++) {
      const rect = longer[i];
      movedCount++;
      if (rect.height > maxDisplacementPx) maxDisplacementPx = rect.height;
      markCells(clipToViewport(rect));
    }
  }

  const impactFraction = viewportArea > 0 ? (impactedCells.size * cellSize * cellSize) / viewportArea : 0;
  const largestDimension = Math.max(viewportWidth, viewportHeight);
  const distanceFraction = largestDimension > 0 ? maxDisplacementPx / largestDimension : 0;

  return {
    score: impactFraction * distanceFraction,
    maxDisplacementPx,
    movedCount,
  };
}

export type FontSwapVariant = 'full' | 'size-adjust-only' | 'swap-control';

/**
 * True when `rect` (from `snapshot`) intersects that snapshot's own viewport
 * ([0, innerWidth] x [0, innerHeight]) -- i.e. it is actually visible to a
 * user at the moment the snapshot was taken, not merely present somewhere on
 * a much taller scrollable page.
 */
function intersectsViewport(rect: LayoutRect, snapshot: LayoutSnapshot): boolean {
  return (
    rect.top < snapshot.innerHeight &&
    rect.top + rect.height > 0 &&
    rect.left < snapshot.innerWidth &&
    rect.left + rect.width > 0
  );
}

/**
 * Per-element fragments filtered to only those visible in `snapshot`'s own
 * viewport, dropping any element left with zero visible fragments entirely.
 */
function visibleElements(snapshot: LayoutSnapshot): Record<string, LayoutRect[]> {
  const result: Record<string, LayoutRect[]> = {};
  for (const [key, fragments] of Object.entries(snapshot.elements)) {
    const visible = fragments.filter((r) => intersectsViewport(r, snapshot));
    if (visible.length > 0) result[key] = visible;
  }
  return result;
}

/**
 * Compares two layout snapshots for approximate equality, RESTRICTED to each
 * snapshot's own viewport-visible fragments: same visible element keys, same
 * visible fragment count per element, and every visible fragment's
 * left/top/width/height within 0.5px. Used to classify which of the two
 * user-visible paths under `font-display: optional` a load actually took
 * (see measureFontSwap's pathObserved classification): a load whose "after"
 * state matches a reference load that is proven to have the webfonts in use
 * took the webfont-first path; a load whose "after" state matches its own
 * "before" state (and not the reference) kept the fallback throughout.
 *
 * The viewport restriction is deliberate, not an approximation of
 * convenience: comparing two INDEPENDENT page loads (this function's actual
 * caller, measureFontSwap's before/after/reference triad) across an entire
 * multi-thousand-pixel-tall document accumulates inherent, real, but
 * font-swap-UNRELATED sub-pixel rendering jitter (measured directly while
 * building this instrument: two separate loads of the identical HTML/CSS/
 * webfont, one held-and-released and one never held, disagreed by up to
 * ~1.3px per text line purely from independent-renderer sub-pixel text
 * shaping -- no different font, no different content). That jitter is
 * additive down a long page of headlines and produced spurious ~139px
 * "mismatches" on elements far below the fold that were never on screen at
 * all for the scroll position being measured. CLS itself is defined the same
 * way: only the viewport-clipped impact region counts (layoutShiftScore's
 * own clipToViewport already does this for the SAME reason). A within-page
 * before/after comparison (no independent-renderer jitter, since it's the
 * same render) is unaffected by this restriction -- it only ever prunes
 * fragments a user could not have seen anyway.
 */
export function layoutsMatch(a: LayoutSnapshot, b: LayoutSnapshot): boolean {
  const aVisible = visibleElements(a);
  const bVisible = visibleElements(b);

  const aKeys = Object.keys(aVisible);
  const bKeys = Object.keys(bVisible);
  if (aKeys.length !== bKeys.length) return false;

  const bSet = new Set(bKeys);
  for (const key of aKeys) {
    if (!bSet.has(key)) return false;
    const aFragments = aVisible[key];
    const bFragments = bVisible[key];
    if (aFragments.length !== bFragments.length) return false;
    for (let i = 0; i < aFragments.length; i++) {
      const af = aFragments[i];
      const bf = bFragments[i];
      if (
        Math.abs(af.left - bf.left) >= 0.5 ||
        Math.abs(af.top - bf.top) >= 0.5 ||
        Math.abs(af.width - bf.width) >= 0.5 ||
        Math.abs(af.height - bf.height) >= 0.5
      ) {
        return false;
      }
    }
  }
  return true;
}

export interface MeasureFontSwapOptions {
  width: number;
  theme?: 'light' | 'dark';
  scroll?: 'top' | 'mid';
  /**
   * 'full' (default) leaves style.css's fonts region untouched.
   * 'size-adjust-only' strips every ascent-override/descent-override/
   * line-gap-override declaration from the fonts region before the page
   * loads — the proxy for shipped Safari, which does not implement the
   * -override trio (01-RESEARCH.md Pitfall 1; WebKit bug 219735 is
   * RESOLVED FIXED on trunk but not shipped in any released Safari).
   */
  variant?: FontSwapVariant;
  /**
   * When set, forces --font-display/--font-body to
   * `"<primary>", "<primary> Fallback: <fallbackFamily>", serif` — bypassing
   * the natural fallback-priority chain (which face wins depends on which
   * system fonts happen to be installed) so a specific capsize-corrected
   * fallback tier can be measured deterministically in both engines,
   * corrections intact. Combine with `variant` to additionally test that
   * tier with the -override descriptors stripped.
   */
  fallbackFamily?: string | null;
}

export interface FontSwapResult {
  page: string;
  engine: string;
  engineVersion: string;
  width: number;
  theme: string;
  scroll: string;
  variant: FontSwapVariant;
  fallbackFamily: string | null;
  nativeSupported: boolean;
  nativeCls: number | null;
  geometryScore: number;
  maxDisplacementPx: number;
  movedCount: number;
  fallbackFacesLoaded: string[];
  fallbackFacesMissing: string[];
  /**
   * Whether the engine ever produced a real frame (composited paint) while
   * the primary font request was held pending. When false (this specific
   * WebKit build, always — see nextTwoFrames's doc comment), there is no
   * pre-swap state a user was ever shown to diff against: geometryScore is
   * reported as 0 rather than from a forced-layout read of a state that was
   * never painted, which would otherwise measure a rendering artifact, not
   * real CLS.
   */
  prePaintObserved: boolean;
  /**
   * Which of the user-visible paths this load actually took, classified by
   * comparing before/after/reference snapshots (see the classification logic
   * inside measureFontSwap). 'swapped' should never occur under
   * font-display: optional in an engine that honours the spec -- it is the
   * value the swap-control variant's positive control is expected to
   * produce, proving the instrument can still see a real swap when one
   * happens. 'indeterminate' means the three snapshots did not fit either
   * recognised pattern and is itself gate-worthy (see report-font-cls.mjs).
   */
  pathObserved: 'fallback-kept' | 'webfont-at-first-paint' | 'swapped' | 'indeterminate';
  /**
   * Native layout-shift CLS (sum of entries with hadRecentInput:false, from
   * navigation start) measured on the REFERENCE load -- a fresh page load of
   * the same page/width/theme/scroll/variant/fallbackFamily with no font
   * hold, whose webfonts are proven in use by assertWebfontsInUse before this
   * value is trusted. null when the engine does not support the layout-shift
   * PerformanceObserver entry type (matches nativeCls's own null convention).
   */
  referenceNativeCls: number | null;
  /**
   * The font-display descriptor value of the first primary @font-face rule,
   * read from document.styleSheets in the page actually under measurement
   * (not the reference) -- proves the served CSS matches what this row's
   * variant is supposed to carry (e.g. 'swap' for the swap-control variant,
   * 'optional' everywhere else).
   */
  fontDisplay: string;
}

const FONTS_REGION_RE = /\/\* fonts:start \*\/[\s\S]*?\/\* fonts:end \*\//;

/**
 * Routes style.css requests and rewrites only the fonts region — never the
 * rest of the stylesheet — to test one variant/fallbackFamily combination
 * without touching the file on disk. Registered (when needed) before
 * openPageForMeasurement's call to blockThirdParty, for the same
 * reverse-registration-order reason documented on holdFonts above: the
 * later-registered blockThirdParty handler runs first and falls through
 * for local requests, letting this earlier-registered handler still
 * process the matching style.css request.
 */
async function installStyleOverride(
  page: Page,
  variant: FontSwapVariant,
  fallbackFamily: string | null
): Promise<void> {
  if (variant === 'full' && !fallbackFamily) return;

  await page.route('**/mockups/style.css', async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const regionMatch = original.match(FONTS_REGION_RE);

    if (!regionMatch || regionMatch.index === undefined) {
      await route.fulfill({ response, body: original });
      return;
    }

    let region = regionMatch[0];

    if (variant === 'size-adjust-only') {
      region = region.replace(/[ \t]*(ascent-override|descent-override|line-gap-override):[^;]+;\n?/g, '');
    }

    if (variant === 'swap-control') {
      // The positive control (font-cls.spec.ts's swap-control test): rewrite
      // every font-display descriptor to swap for this load only, so a real
      // mid-render swap can be measured, proving measureFontSwap's
      // instrument still detects a swap when one actually happens. Other
      // variants never touch this descriptor.
      region = region.replace(/font-display:\s*[^;]+;/g, 'font-display: swap;');
    }

    if (fallbackFamily) {
      region = region.replace(
        /--font-display:\s*[^;]+;/,
        `--font-display: "Instrument Serif", "Instrument Serif Fallback: ${fallbackFamily}", serif;`
      );
      region = region.replace(
        /--font-body:\s*[^;]+;/,
        `--font-body: "Source Serif 4", "Source Serif 4 Fallback: ${fallbackFamily}", serif;`
      );
    }

    const rewritten = original.slice(0, regionMatch.index) + region + original.slice(regionMatch.index + regionMatch[0].length);
    await route.fulfill({ response, body: rewritten, headers: { ...response.headers(), 'content-type': 'text/css' } });
  });
}

/**
 * After the page has loaded (with style.css served exactly as it will be
 * for the measurement about to run), calls document.fonts.load() for every
 * registered "<Primary> Fallback: <label>" face and returns the distinct
 * bare labels (e.g. "Georgia", "Noto Serif", "Times New Roman") for which
 * at least one such face reaches 'loaded' — i.e. the fallback tiers this
 * engine/host combination can actually exercise. An empty result means no
 * metric-compatible fallback face is available at all; callers should treat
 * that the same way font-cls.spec.ts's existing
 * "no metric-compatible fallback face available — measurement meaningless"
 * check does.
 */
export async function listLoadableFallbacks(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const fallbacks = [...document.fonts].filter((f) => f.family.includes('Fallback:'));
    const labels = new Set<string>();
    for (const face of fallbacks) {
      // FontFace.family is unquoted in Chromium but arrives already
      // double-quoted in this Playwright-WebKit build for any family name
      // containing a character (here, ':') that requires quoting in the
      // original @font-face rule. Re-wrapping an already-quoted string in
      // another pair of quotes produces a malformed font shorthand
      // (`1em ""Instrument Serif Fallback: Georgia""`), which
      // document.fonts.load() rejects with a SyntaxError in WebKit —
      // discovered empirically as the actual cause of what first looked
      // like WebKit-Docker font-matching flakiness (different pages
      // failing on different runs), not a real availability difference.
      // Stripping any pre-existing quotes before re-wrapping is correct in
      // both engines.
      const bareFamily = face.family.replace(/^["']|["']$/g, '');
      try {
        await document.fonts.load(`1em "${bareFamily}"`);
      } catch {
        // status check below reports the outcome either way
      }
      if (face.status === 'loaded') {
        const match = bareFamily.match(/Fallback:\s*(.+)$/);
        if (match) labels.add(match[1].trim());
      }
    }
    return [...labels];
  });
}

/**
 * Waits for two animation frames and reports whether they actually fired —
 * a real cross-engine difference discovered empirically while building this
 * instrument (01-02 Task 2): this specific Playwright-WebKit build (26.6,
 * via the pinned Docker image) defers compositing — and therefore every
 * requestAnimationFrame callback — for as long as ANY @font-face resource
 * on the page is still pending, regardless of `font-display: swap` and
 * regardless of how long the delay is (verified up to 20s; a pending
 * `<img>` request to the same URL does not reproduce it, so this is
 * font-specific, not a general "any pending subresource" block). Chromium
 * composites and fires rAF regardless of a pending font fetch. Racing
 * against a fixed wait keeps this from hanging for the full test timeout in
 * WebKit; the boolean return tells the caller whether a real frame was ever
 * produced, which measureFontSwap needs to decide whether its "before"
 * snapshot corresponds to anything a user was ever shown (see its own doc
 * comment).
 */
async function nextTwoFrames(page: Page): Promise<boolean> {
  const result = await Promise.race([
    page
      .evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      )
      .then(() => 'frame' as const),
    page.waitForTimeout(200).then(() => 'timeout' as const),
  ]);
  return result === 'frame';
}

/**
 * Navigates to the mockup under measurement with waitUntil: 'domcontentloaded'
 * rather than through openPage() (harness.ts), whose default page.goto()
 * wait ('load') hangs indefinitely here: index.html's <link rel="preload"
 * as="font"> tags (added by build-fonts.mjs) *do* block the load event on a
 * pending fetch — unlike an ordinary @font-face-triggered font request,
 * which never blocks load — so with holdFonts() deliberately holding those
 * two requests open, 'load' would never fire. Reuses openPage's own
 * blockThirdParty()/theme-seeding behaviour directly, since harness.ts's
 * exported openPage() signature is frozen by 01-01 and does not expose
 * waitUntil.
 */
async function openPageForMeasurement(
  page: Page,
  name: PageName,
  theme: 'light' | 'dark',
  width: number,
  height: number
): Promise<void> {
  blockThirdParty(page);
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
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() !== 200) {
    throw new Error(`measureFontSwap(${name}): expected status 200, got ${response?.status()}`);
  }
}

/**
 * Opens a REFERENCE load in a fresh browser context: same width/theme/scroll/
 * variant/fallbackFamily as the measurement under test, but no font hold at
 * all -- a plain, unthrottled load. Its webfonts are proven in use (via
 * assertWebfontsInUse) before its layout snapshot and native CLS are
 * trusted, since a reference load whose own webfont silently missed the
 * optional block period would prove nothing. Used as the "what does a
 * webfont-first render of this exact combination look like" baseline that
 * measureFontSwap's pathObserved classification diffs against.
 */
async function measureReferenceLoad(
  browser: Browser,
  name: PageName,
  width: number,
  theme: 'light' | 'dark',
  scroll: 'top' | 'mid',
  variant: FontSwapVariant,
  fallbackFamily: string | null
): Promise<{ snapshot: LayoutSnapshot; referenceNativeCls: number | null }> {
  const context = await browser.newContext();
  const refPage = await context.newPage();
  try {
    await installClsObserver(refPage);
    // Registered before openPageForMeasurement()'s call to blockThirdParty(),
    // for the same reverse-registration-order reason documented on
    // installStyleOverride itself.
    await installStyleOverride(refPage, variant, fallbackFamily);
    await openPageForMeasurement(refPage, name, theme, width, 900);

    if (scroll === 'mid') {
      await refPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    }

    await refPage.evaluate(() => document.fonts.ready);
    await nextTwoFrames(refPage);

    const faces = await renderedPrimaryFaces(refPage);
    await assertWebfontsInUse(refPage, faces);

    const snapshot = await snapshotLayout(refPage);

    const nativeResult = await refPage.evaluate(() => {
      const supported = (window as any).__clsSupported === true;
      if (!supported) return { supported: false, value: null as number | null };
      const entries = ((window as any).__cls ?? []) as Array<{
        value: number;
        startTime: number;
        hadRecentInput: boolean;
      }>;
      const sum = entries.filter((e) => !e.hadRecentInput).reduce((acc, e) => acc + e.value, 0);
      return { supported: true, value: sum };
    });

    return {
      snapshot,
      referenceNativeCls: nativeResult.supported ? nativeResult.value : null,
    };
  } finally {
    await context.close();
  }
}

/**
 * Reads the font-display descriptor of the first @font-face rule found
 * across the page's stylesheets -- the value actually served for this row
 * (e.g. rewritten to 'swap' for the swap-control variant, 'optional'
 * everywhere else), not what build-fonts.mjs generated on disk.
 */
async function readFontDisplay(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet; none exist on this project's pages
      }
      for (const rule of Array.from(rules)) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const value = (rule as CSSFontFaceRule).style.getPropertyValue('font-display').trim();
          if (value) return value;
        }
      }
    }
    return 'auto';
  });
}

/**
 * Measures the font-swap layout shift for one page/width/theme/scroll
 * combination, in whichever engine `page` belongs to. See the 01-02-PLAN.md
 * Task 2 action block ("Measurement (D-08)") for the exact step sequence;
 * this implementation follows it in order.
 */
export async function measureFontSwap(
  page: Page,
  name: PageName,
  {
    width,
    theme = 'light',
    scroll = 'top',
    variant = 'full',
    fallbackFamily = null,
  }: MeasureFontSwapOptions
): Promise<FontSwapResult> {
  await installClsObserver(page);
  const hold = holdFonts(page);

  // Registered before openPageForMeasurement()'s call to blockThirdParty(),
  // for the same reverse-registration-order reason as holdFonts above —
  // see installStyleOverride's own doc comment.
  await installStyleOverride(page, variant, fallbackFamily);

  // openPageForMeasurement() registers blockThirdParty() as its first
  // action; per the holdFonts doc comment above, holdFonts must be
  // registered (done just above) before that call for the route
  // fall-through order to work.
  await openPageForMeasurement(page, name, theme, width, 900);

  if (scroll === 'mid') {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  }

  await page.waitForTimeout(150);
  const prePaintObserved = await nextTwoFrames(page);

  // Checked at the network level (hold.pendingUrls()), not via document.fonts
  // FontFace status: discovered empirically while building this instrument
  // that WebKit defers compositing — and, with it, ever flipping a FontFace
  // to 'loading' — entirely while a pending font resource is still in
  // flight (Chromium composites, and updates FontFace status, regardless).
  // Network-level interception is what every engine agrees on, so it is
  // what "the hold is actually in effect" is asserted against.
  if (hold.pendingUrls().length === 0) {
    throw new Error(
      `measureFontSwap(${name}): no font request was intercepted by the network hold — either no primary ` +
        'face was requested yet, or the hold failed to intercept it'
    );
  }

  // Only take a real "before" snapshot when a frame was actually produced
  // pre-release: if it wasn't (this WebKit build, always, per nextTwoFrames's
  // doc comment), a snapshotLayout() read here would force a synchronous
  // layout the engine never composited into a visible frame — numbers with
  // no corresponding user-visible state, not a real "before" to diff
  // against. In that case there is no observed intermediate state to shift
  // from, so the shift is (truthfully) reported as zero rather than
  // measured from a state nobody was ever shown.
  const before = prePaintObserved ? await snapshotLayout(page) : null;
  const releaseTime = await page.evaluate(() => performance.now());

  hold.release();
  await page.evaluate(() => document.fonts.ready);

  if (hold.pendingUrls().length > 0) {
    throw new Error(`measureFontSwap(${name}): a font request is still held pending after release()`);
  }

  await nextTwoFrames(page);
  await page.waitForTimeout(100);

  const after = await snapshotLayout(page);

  const nativeResult = await page.evaluate((releaseTimeArg) => {
    const supported = (window as any).__clsSupported === true;
    if (!supported) return { supported: false, value: null as number | null };
    const entries = ((window as any).__cls ?? []) as Array<{
      value: number;
      startTime: number;
      hadRecentInput: boolean;
    }>;
    const sum = entries
      .filter((e) => e.startTime >= releaseTimeArg && !e.hadRecentInput)
      .reduce((acc, e) => acc + e.value, 0);
    return { supported: true, value: sum };
  }, releaseTime);

  const fallbackResult = await page.evaluate(async () => {
    const fallbacks = [...document.fonts].filter((f) => f.family.includes('Fallback:'));
    for (const face of fallbacks) {
      try {
        await document.fonts.load(`1em ${face.family}`);
      } catch {
        // status check below reports the outcome either way
      }
    }
    return {
      loaded: fallbacks.filter((f) => f.status === 'loaded').map((f) => f.family),
      missing: fallbacks.filter((f) => f.status !== 'loaded').map((f) => f.family),
    };
  });

  const shift = before ? layoutShiftScore(before, after) : { score: 0, maxDisplacementPx: 0, movedCount: 0 };

  const browser = page.context().browser();
  const engine = browser?.browserType().name() ?? 'unknown';
  const engineVersion = browser?.version() ?? 'unknown';

  const fontDisplay = await readFontDisplay(page);

  // Independent context/page, no font hold: the "what does a webfont-first
  // render of this exact combination look like" baseline. Run after the main
  // measurement's own network hold has been released so the two loads never
  // contend over the same route/context state.
  let referenceNativeCls: number | null = null;
  let pathObserved: FontSwapResult['pathObserved'] = 'indeterminate';
  if (browser) {
    const reference = await measureReferenceLoad(browser, name, width, theme, scroll, variant, fallbackFamily);
    referenceNativeCls = reference.referenceNativeCls;

    const beforeMatchesAfter = before ? layoutsMatch(before, after) : true; // no pre-swap state observed
    const afterMatchesReference = layoutsMatch(after, reference.snapshot);

    if (prePaintObserved) {
      if (beforeMatchesAfter && !afterMatchesReference) {
        pathObserved = 'fallback-kept';
      } else if (!beforeMatchesAfter && afterMatchesReference) {
        pathObserved = 'swapped';
      } else {
        pathObserved = 'indeterminate';
      }
    } else {
      pathObserved = afterMatchesReference ? 'webfont-at-first-paint' : 'fallback-kept';
    }
  }

  return {
    page: name,
    engine,
    engineVersion,
    width,
    theme,
    scroll,
    variant,
    fallbackFamily,
    nativeSupported: nativeResult.supported,
    nativeCls: nativeResult.supported ? nativeResult.value : null,
    geometryScore: shift.score,
    maxDisplacementPx: shift.maxDisplacementPx,
    movedCount: shift.movedCount,
    fallbackFacesLoaded: fallbackResult.loaded,
    fallbackFacesMissing: fallbackResult.missing,
    prePaintObserved,
    pathObserved,
    referenceNativeCls,
    fontDisplay,
  };
}

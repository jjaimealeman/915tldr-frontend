// Post-phase-06 closeout, task B: deterministic wide sampling for live tests that must FIND a page
// of a given kind (a fallback `/es` article) rather than assume the newest few have it. No network
// here — callers fetch; this module only selects, so the selection is unit-testable.
import { ARTICLE_SLUG_RE } from '../../src/lib/article-url.ts';

const TRAILING_UUID_RE = /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/** Same canonical-article-path test `url-shapes.test.mjs` applies to RSS links: exactly two
 * segments, the second ending in a uuid, the remainder a valid slug. */
function isCanonicalArticlePath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  const uuidMatch = segments[1].match(TRAILING_UUID_RE);
  if (!uuidMatch) return false;
  return ARTICLE_SLUG_RE.test(segments[1].slice(0, segments[1].length - uuidMatch[1].length - 1));
}

/** Every `<loc>` in a sitemap file that is an English canonical article path, in file order. */
export function canonicalArticlePathsFromSitemap(xml) {
  const out = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    let pathname;
    try {
      pathname = new URL(m[1]).pathname;
    } catch {
      continue;
    }
    if (isCanonicalArticlePath(pathname)) out.push(pathname);
  }
  return out;
}

/** `n` items evenly spread across `items` (indexes 0, step, 2*step, ...), original order, no
 * randomness — the same input always yields the same sample, so a failure is reproducible. */
export function strideSample(items, n) {
  if (n <= 0) return [];
  if (items.length <= n) return [...items];
  const step = Math.floor(items.length / n);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(items[i * step]);
  return out;
}

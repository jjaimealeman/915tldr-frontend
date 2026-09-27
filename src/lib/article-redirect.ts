// D-08 / T-04-22 / T-04-23: pure uuid extraction + redirect-decision logic for the 04-06 Worker.
// No imports from the D1/KV chokepoint directory (`tools/assert-no-d1.mjs`'s FORBIDDEN_TARGET_DIR)
// here — this module (and `article-url.ts`, its only import) is bundled directly into the
// deployed Worker (`src/worker.ts`), and must never pull in build-time-only, credential-holding
// code.
//
// Both functions here are pure and side-effect-free by design: the Worker (`src/worker.ts`)
// performs the one KV read and builds the actual `Response`; everything that can be unit-tested
// without a network call lives here instead.
import { articlePath, ARTICLE_SLUG_RE, CATEGORY_SLUG_RE, UUID_RE } from './article-url.ts';

/**
 * Matches a 36-character 8-4-4-4-12 hex uuid (case-insensitive) ending the last path segment,
 * optionally followed by a `.html` suffix and/or one trailing slash, and preceded by `/` or `-`
 * (v1's `[category]/[slug].vue` `extractUUID` shape, `/${category}/${slug}-${uuid}` or
 * `/article/${uuid}`). Anchored at both ends of the (already-decoded) pathname so a uuid
 * appearing anywhere else in the path never matches (D-09: an 8-character short id never matches
 * this pattern at all — it is a different length pattern, not merely a shorter valid one).
 */
const TRAILING_UUID_RE =
  /(?:^|[/-])([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\.html)?\/?$/;

/**
 * Extracts a lowercased article uuid from a request pathname, or returns `null` if none is
 * present. `decodeURIComponent` runs inside a try/catch (T-04-23): a malformed percent-encoding
 * (e.g. `/%E0%A4%A`) throws a `URIError`, and this function treats that identically to "no uuid
 * found" — the caller falls through to the static 404 page, never a 500.
 */
export function extractArticleUuid(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const match = TRAILING_UUID_RE.exec(decoded);
  if (!match) return null;

  return match[1].toLowerCase();
}

export type RedirectDecision = { type: 'redirect'; location: string } | { type: 'not-found' };

/** The subset of the render-manifest entry shape (see the kv-manifest module in the D1/KV
 * chokepoint directory) this module reads. Declared locally, not imported from that module, since
 * importing it would pull the type only — but more importantly, this keeps `article-redirect.ts`'s
 * own import graph limited to `article-url.ts`, matching the module boundary this file's own
 * class comment states. */
interface RedirectManifestEntry {
  schemaVersion?: unknown;
  articleId?: unknown;
  category?: unknown;
  slug?: unknown;
}

/**
 * Decides whether `pathname` should redirect to the canonical path built from `entry`.
 *
 * Validates `entry` defensively before trusting any of its fields (T-04-23: a manifest entry is
 * build-time-written data, but the Worker never assumes its own read of it is well-formed) —
 * schema version must be `'2'` (the slug field only exists from that version on), `articleId`
 * must match `UUID_RE`, `category` must match `CATEGORY_SLUG_RE`, and `slug` must match
 * `ARTICLE_SLUG_RE` (which also excludes `/`, so a slug carrying a path separator is rejected by
 * the same check, not a separate one). Any failure returns `not-found` — the Worker falls
 * through to the static 404 page rather than guessing.
 *
 * T-04-22 (open-redirect mitigation): the returned `location` is built ONLY by `articlePath`
 * from the validated manifest fields — never from `pathname` or any other request-derived text.
 * `articlePath` always returns a same-origin path starting with `/<category-slug>/`; it can never
 * begin with `//` or carry a host, so this decision can never redirect off-origin.
 *
 * Loop guard: if `pathname` already equals the canonical path, returns `not-found` — the file at
 * that path is simply missing (the canonical page itself was never built, or was removed), and
 * redirecting a path to itself would be an infinite-redirect bug, not a fix.
 */
export function resolveRedirect(pathname: string, entry: unknown): RedirectDecision {
  if (!entry || typeof entry !== 'object') return { type: 'not-found' };

  const candidate = entry as RedirectManifestEntry;

  if (candidate.schemaVersion !== '2') return { type: 'not-found' };
  if (typeof candidate.articleId !== 'string' || !UUID_RE.test(candidate.articleId)) {
    return { type: 'not-found' };
  }
  if (typeof candidate.category !== 'string' || !CATEGORY_SLUG_RE.test(candidate.category)) {
    return { type: 'not-found' };
  }
  if (typeof candidate.slug !== 'string' || !ARTICLE_SLUG_RE.test(candidate.slug)) {
    return { type: 'not-found' };
  }

  let canonical: string;
  try {
    canonical = articlePath(candidate.category, candidate.slug, candidate.articleId);
  } catch {
    // articlePath re-validates and throws on a malformed value — already checked above, but a
    // throw here is treated the same as any other invalid-entry case: fall through to 404.
    return { type: 'not-found' };
  }

  if (pathname === canonical) return { type: 'not-found' };

  return { type: 'redirect', location: canonical };
}

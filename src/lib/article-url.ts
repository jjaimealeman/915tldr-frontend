// D-07: the single canonical-path builder shared by pages, the render manifest and (04-06) the
// Worker's non-canonical-URL redirect. No imports from `src/lib/server/` here — the 04-06 Worker
// bundles this module directly and must never pull in the D1/KV chokepoint directory.
//
// Canonical shape (v1's `app/components/ArticleCard.vue:94`, preserved per `.claude/CLAUDE.md`'s
// nine-months-indexed-URLs constraint): `/${category.slug}/${article.slug}-${uuid}`. The slug
// segment is always the STORED `articles.slug` column — never re-derived from the title (D-07).
//
// 06-02 (D-06/D-13): adds a validated `en | es` language dimension to every canonical-path
// builder. The language comes ONLY from a fixed-prefix test on the request path or an explicit
// caller-supplied enum literal — never from a header, cookie or geography (D-13). `/es` is the
// only recognized prefix; everything else (including `/escuela/...`, `/es-mx/...`, `/ES/...`) is
// `'en'` by the same case-sensitive, exact-first-segment test `languageOfPath` implements below.

/** 8-4-4-4-12 lowercase-or-uppercase hex, anchored — matches `articles.uuid`. */
export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Stored article slugs: measured live against all 43,063 production rows (2026-09-26) — 0
 * violations, max length 100. A violation here is new data, and must fail loud, not be coerced. */
export const ARTICLE_SLUG_RE = /^[a-z0-9-]{1,100}$/;

/** Category slugs — no length ceiling; the category set is small and fixed (8 categories). */
export const CATEGORY_SLUG_RE = /^[a-z0-9-]+$/;

/** Tag slugs (D1's `tags.slug` column, unique) — a tag slug becomes a `dist/client/tag/*.html`
 * file name (04-05, T-04-18), so it needs the same tampering guard as `ARTICLE_SLUG_RE`/
 * `CATEGORY_SLUG_RE`. Exported from this shared module rather than declared inline in
 * `tag/[slug].astro`'s frontmatter — a top-level `const`/`function` referenced only from
 * `getStaticPaths()` can be silently dropped by Astro 7.3.3's bundler (see 03-01-SUMMARY.md's
 * `slugify()` deviation and this project's own `src/lib/slug.ts` fix for the same class of bug). */
export const TAG_SLUG_RE = /^[a-z0-9-]+$/;

/** Source slugs (D1's `sources.slug` column) — a source slug becomes a `dist/client/source/*.html`
 * file name (04-followups, WR-01: `.planning/phases/04-static-generation-templates-seo/
 * 04-REVIEW.md`), the same tampering surface `TAG_SLUG_RE` already guards for tag slugs. Exported
 * from this shared module rather than declared inline in `source/[slug].astro`'s frontmatter for
 * the same bundler-safety reason documented on `TAG_SLUG_RE` above. */
export const SOURCE_SLUG_RE = /^[a-z0-9-]+$/;

function assertMatches(value: string, re: RegExp, label: string): void {
  if (typeof value !== 'string' || !re.test(value)) {
    throw new Error(`article-url: invalid ${label}: ${JSON.stringify(value)}`);
  }
}

/** The closed set of supported languages (06-02, D-06). Never extend this by coercion — a third
 * language is a deliberate, reviewed addition, not a value that silently starts working. */
export const LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

/** The single `/es` prefix every Spanish path carries (D-06: Spanish URLs are `/es` + the
 * identical English path). Exported so callers never hand-roll the literal string. */
export const SPANISH_PREFIX = '/es';

/** Narrows `value` to `Language` without throwing — used where a non-match should fall back to
 * `'en'` (see `languageOfPath`), not abort. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Throws, naming the offending value, if `value` is not exactly `'en'` or `'es'` — same
 * never-coerce discipline as `assertMatches` (no trimming, no case-folding: `'es '` and `'ES'`
 * are both invalid, deliberately, since D-13 treats the language dimension as closed and exact). */
export function assertLanguage(value: unknown): Language {
  if (!isLanguage(value)) {
    throw new Error(`article-url: invalid language: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Derives the language from `pathname` alone, by a fixed, case-sensitive prefix test — never
 * from a header, cookie or `request.cf` (D-13). Returns `'es'` only when `pathname` is exactly
 * `/es` or starts with `/es/`; every other path (including `/escuela/...`, `/es-mx/...`,
 * `/ES/...`, which share a prefix string but not the full first path segment) is `'en'`.
 */
export function languageOfPath(pathname: string): Language {
  if (typeof pathname !== 'string') return 'en';
  if (pathname === SPANISH_PREFIX || pathname.startsWith(`${SPANISH_PREFIX}/`)) return 'es';
  return 'en';
}

/**
 * Prefixes an already-English `path` (one for which `languageOfPath(path) === 'en'`) with `/es`
 * for `language === 'es'`, or returns it unchanged for `language === 'en'`. `path` must start
 * with `/`. Throws on an invalid `language` (closed enum) or a `path` that is not a bare English
 * path (e.g. already `/es`-prefixed, or not absolute) — this function only ever ADDS or omits the
 * prefix, it never strips one a caller already applied.
 */
export function localizedPath(path: string, language: Language): string {
  assertLanguage(language);
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error(`article-url: invalid path: ${JSON.stringify(path)}`);
  }
  if (languageOfPath(path) !== 'en') {
    throw new Error(`article-url: path is not an English path: ${JSON.stringify(path)}`);
  }
  if (language === 'en') return path;
  if (path === '/') return SPANISH_PREFIX;
  return `${SPANISH_PREFIX}${path}`;
}

/**
 * Builds the canonical article URL path, e.g. `/crime/man-arrested-in-arson-case-201187fa-...`,
 * or its `/es`-prefixed counterpart when `language === 'es'` (D-06). Throws, naming the offending
 * value, if any part fails its regex — a malformed slug reaching this function is a data problem
 * to surface immediately, not silently coerce (D-07's one-way-reversible rating: a wrong slug in
 * a published canonical must be redirected forever).
 */
export function articlePath(
  categorySlug: string,
  slug: string,
  uuid: string,
  language: Language = 'en'
): string {
  assertMatches(categorySlug, CATEGORY_SLUG_RE, 'categorySlug');
  assertMatches(slug, ARTICLE_SLUG_RE, 'slug');
  assertMatches(uuid, UUID_RE, 'uuid');
  assertLanguage(language);
  const english = `/${categorySlug}/${slug}-${uuid}`;
  return localizedPath(english, language);
}

/**
 * Same validation as `articlePath`, shaped for Astro's `getStaticPaths()` `params` object:
 * `{ category, slug }` where `slug` already carries the trailing `-${uuid}` (the `[category]/
 * [slug].astro` route param, not a separate uuid segment).
 */
export function articleParams(
  categorySlug: string,
  slug: string,
  uuid: string
): { category: string; slug: string } {
  assertMatches(categorySlug, CATEGORY_SLUG_RE, 'categorySlug');
  assertMatches(slug, ARTICLE_SLUG_RE, 'slug');
  assertMatches(uuid, UUID_RE, 'uuid');
  return { category: categorySlug, slug: `${slug}-${uuid}` };
}

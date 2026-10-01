// D-07: the single canonical-path builder shared by pages, the render manifest and (04-06) the
// Worker's non-canonical-URL redirect. No imports from `src/lib/server/` here — the 04-06 Worker
// bundles this module directly and must never pull in the D1/KV chokepoint directory.
//
// Canonical shape (v1's `app/components/ArticleCard.vue:94`, preserved per `.claude/CLAUDE.md`'s
// nine-months-indexed-URLs constraint): `/${category.slug}/${article.slug}-${uuid}`. The slug
// segment is always the STORED `articles.slug` column — never re-derived from the title (D-07).

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

/**
 * Builds the canonical article URL path, e.g. `/crime/man-arrested-in-arson-case-201187fa-...`.
 * Throws, naming the offending value, if any part fails its regex — a malformed slug reaching
 * this function is a data problem to surface immediately, not silently coerce (D-07's
 * one-way-reversible rating: a wrong slug in a published canonical must be redirected forever).
 */
export function articlePath(categorySlug: string, slug: string, uuid: string): string {
  assertMatches(categorySlug, CATEGORY_SLUG_RE, 'categorySlug');
  assertMatches(slug, ARTICLE_SLUG_RE, 'slug');
  assertMatches(uuid, UUID_RE, 'uuid');
  return `/${categorySlug}/${slug}-${uuid}`;
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

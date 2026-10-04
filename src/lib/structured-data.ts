// 04-02 / SEO-01 / SEO-02 / T-04-05: schema.org node builders and injection-safe serialisation.
// AI-generated titles/summaries from RSS content are untrusted text crossing into a
// `<script type="application/ld+json">` context (Pitfall 5, 04-RESEARCH.md) — `JSON.stringify`
// alone does not escape `<`, so a value containing a literal `</script>` could prematurely close
// the script element. `toSafeJsonLd` is the one function that renders a node safe to embed. This
// is a pure module with no dependency on the D1-access boundary the rest of this project
// enforces.
//
// 06-09 (I18N-02): `NewsArticleNode.inLanguage` carries the real language of `headline`/
// `description` (type-only import — `article-url.ts` is itself bundled directly into the Worker
// and must never pull in the D1/KV chokepoint directory; this module stays on that same side of
// the boundary).
import type { Language } from './article-url.ts';

export const SITE_NAME = '915 TLDR';

/** Default origin for helpers that don't take one explicitly (e.g. a bare `breadcrumbNode` call
 * with no per-request origin available). Callers with a real `Astro.site` should still pass it
 * explicitly — this default only covers the common case where the production origin is correct. */
export const SITE_ORIGIN = 'https://915tldr.com';

// The line-separator and paragraph-separator code points are built here via
// `String.fromCharCode` rather than typed directly as a literal escape sequence in this file's
// source text: a typed backslash-u escape sequence for one of these code points can be silently
// normalised into the real (invisible) character by an editor or tool pass, which then breaks a
// regex or string literal built around it. Building the character at runtime from its numeric
// code point sidesteps that failure mode entirely.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serialises `data` as JSON and escapes every character that could let untrusted text break out
 * of a `<script>` element or corrupt a JS string literal it might later be assigned to: `<`, `>`,
 * `&` (the three HTML-significant characters), and the line/paragraph separator code points
 * (valid inside a JSON string but illegal inside an unescaped JS string literal in some
 * contexts). `JSON.parse` round-trips every replacement below back to the original character —
 * each one is a standard JSON escape.
 */
export function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .split('<')
    .join('\\u003c')
    .split('>')
    .join('\\u003e')
    .split('&')
    .join('\\u0026')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');
}

export interface OrganizationNode {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  '@id': string;
  name: string;
  url: string;
}

/** Site-wide Organization node, rendered on every page (SEO-02). */
export function organizationNode(origin: string = SITE_ORIGIN): OrganizationNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SITE_NAME,
    url: origin,
  };
}

export interface WebsiteNode {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  '@id': string;
  name: string;
  url: string;
  publisher: { '@id': string };
  inLanguage: 'en';
}

/** Site-wide WebSite node, rendered on every page (SEO-02). `publisher` references the
 * Organization node by `@id` rather than duplicating it — both nodes are emitted as separate
 * `<script>` blocks, and schema.org readers resolve `@id` references across documents that share
 * an origin. */
export function websiteNode(origin: string = SITE_ORIGIN): WebsiteNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: SITE_NAME,
    url: origin,
    publisher: { '@id': `${origin}/#organization` },
    inLanguage: 'en',
  };
}

export interface NewsArticleNodeInput {
  origin: string;
  /** Absolute-from-origin path, e.g. `/community/usps-launches-...-a90c2be1-...` */
  canonicalPath: string;
  headline: string;
  description?: string;
  /** ISO 8601 with offset — see `isoWithOffset`. No separate modification timestamp exists in the
   * data, so `datePublished` and `dateModified` are both set to this value. */
  datePublishedIso: string;
  section: string;
  tags?: string[];
  sourceName: string;
  sourceUrl: string;
  /** 06-09 (I18N-02): the language of `headline`/`description` themselves — `'es'` only on a
   * translated `/es` page (`esArticlePageModel`'s `contentLang`); every other page (the English
   * article, and a `/es` page serving the D-05 English fallback, which is still English TEXT
   * even though its URL is `/es`) is `'en'`. Defaults to `'en'` — every pre-06-09 call site
   * renders byte-identically to before. */
  inLanguage?: Language;
}

export interface NewsArticleNode {
  '@context': 'https://schema.org';
  '@type': 'NewsArticle';
  '@id': string;
  mainEntityOfPage: string;
  headline: string;
  description?: string;
  datePublished: string;
  dateModified: string;
  author: { '@id': string };
  publisher: { '@id': string };
  isBasedOn: {
    '@type': 'CreativeWork';
    url: string;
    publisher: { '@type': 'Organization'; name: string };
  };
  articleSection: string;
  keywords?: string;
  inLanguage: Language;
}

/**
 * NewsArticle node (SEO-01). `author`/`publisher` are always the site Organization's `@id` —
 * never a Person, since every article is an AI-generated summary attributed to the site, with the
 * original outlet named separately via `isBasedOn`. No `image` property here: imagery is Phase 7.
 */
export function newsArticleNode(input: NewsArticleNodeInput): NewsArticleNode {
  const {
    origin,
    canonicalPath,
    headline,
    description,
    datePublishedIso,
    section,
    tags = [],
    sourceName,
    sourceUrl,
    inLanguage = 'en',
  } = input;

  const canonicalUrl = `${origin}${canonicalPath}`;
  const sortedTags = [...tags].sort();

  const node: NewsArticleNode = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${canonicalUrl}#article`,
    mainEntityOfPage: canonicalUrl,
    headline,
    datePublished: datePublishedIso,
    dateModified: datePublishedIso,
    author: { '@id': `${origin}/#organization` },
    publisher: { '@id': `${origin}/#organization` },
    isBasedOn: {
      // 04-followups (task 2): Google's Rich Results Test flagged the original `'NewsArticle'`
      // type here as a separate, incomplete NewsArticle ("Unnamed item" — no image/author/
      // headline of its own; that data belongs to the outlet's own page, not ours). `isBasedOn`
      // only needs to identify the source work and its publisher, which `CreativeWork` covers
      // without implying we're asserting NewsArticle-specific fields about someone else's page.
      '@type': 'CreativeWork',
      url: sourceUrl,
      publisher: { '@type': 'Organization', name: sourceName },
    },
    articleSection: section,
    inLanguage,
  };

  if (description) {
    node.description = description;
  }
  if (sortedTags.length > 0) {
    node.keywords = sortedTags.join(', ');
  }

  return node;
}

export interface BreadcrumbItem {
  name: string;
  /** Absolute-from-origin path, e.g. `/` or `/crime`. */
  path: string;
}

export interface BreadcrumbNode {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

/** BreadcrumbList node (SEO-01), positions starting at 1. */
export function breadcrumbNode(items: BreadcrumbItem[], origin: string = SITE_ORIGIN): BreadcrumbNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

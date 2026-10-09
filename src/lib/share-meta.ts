// 07-01 (SOC-02 / SOC-05; D-07, D-09, D-10, D-11, D-21): the share-card head-tag builder every page's
// `<head>` draws from via `Base.astro`. Pure module: no imports from `src/lib/server/` (the D1/KV
// chokepoint) and no build-provenance module (`build-info`), so a plain `node` process can import
// it and no per-build value (hash, timestamp) can leak into a tag (04-11a: unchanged pages must
// stay byte-identical across rebuilds).
//
// og:image origin (D-21): `SHARE_IMAGE_ORIGIN` is a COMMITTED CONSTANT, deliberately superseding
// D-07's "built from Astro.site" wording so the new cards can be validated on the dev host
// (D-19). It switches to `https://915tldr.com` at cutover, and `tools/assert-share-origin.mjs`
// (wired into `guard:config`, so into every `pnpm build`) refuses a value that is not the Worker's
// single primary custom domain. Why a module constant and not an environment variable: Astro's
// incremental build skips re-rendering a page when its `cacheKey` and its module dependency hash
// are unchanged (`node_modules/astro/dist/core/build/generate.js`, the `cache?.canSkip(
// route.component, pathname, dependencyHash, cacheKey, ...)` call; the hash covers module source,
// see `plugins/plugin-incremental.js` `hashModules`). An environment-variable change alters
// neither, so reused pages would keep the old origin: mixed origins across the site, and at
// cutover prod pages would keep pointing at the dev host. A constant in module code changes the
// dependency hash of every page, so changing it re-renders everything.
//
// 07-01 emitted only the og:image group; 07-03 extends `shareMetaTags()` to the full og/twitter set
// in the fixed order recorded in 07-UI-SPEC "Head Metadata Contract"; 07-04 adds the article:* tags.
import { assertLanguage, localizedPath, type Language } from './article-url.ts';
import type { AlternateMode } from './i18n/hreflang.ts';
import { SITE_NAME } from './structured-data.ts';

/** D-21: where every platform fetches the card from. Switches to `https://915tldr.com` at cutover. */
export const SHARE_IMAGE_ORIGIN = 'https://dev.915tldr.com';

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;
export const SHARE_IMAGE_TYPE = 'image/png';

/** D-07: fixed, unversioned paths at the web root; the file is replaced in place if the design changes. */
export const SHARE_IMAGE_PATH: Readonly<Record<Language, string>> = Object.freeze({
  en: '/og-image.png',
  es: '/og-image-es.png',
});

/** D-10: the alt describes the card, never the page. Em dash is U+2014 in both. */
export const SHARE_IMAGE_ALT: Readonly<Record<Language, string>> = Object.freeze({
  en: '915 TLDR — El Paso news, in brief.',
  es: '915 TLDR — Noticias de El Paso, en breve.',
});

/** D-22: og:locale:alternate is emitted on every page, so there is no toggle constant for it. */
export const OG_LOCALE: Readonly<Record<Language, string>> = Object.freeze({
  en: 'en_US',
  es: 'es_US',
});

export interface IconLink {
  rel: 'icon' | 'apple-touch-icon';
  href: string;
  type?: string;
  sizes?: string;
}

/** Consumed by 07-03. The `sizes` on the .ico keeps Chromium preferring the SVG. */
export const ICON_LINKS: readonly IconLink[] = Object.freeze([
  Object.freeze({ rel: 'icon', href: '/favicon.ico', sizes: '32x32' } as const),
  Object.freeze({ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' } as const),
  Object.freeze({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } as const),
]);

export interface MetaTag {
  attr: 'property' | 'name';
  key: string;
  content: string;
}

export interface ShareArticleInput {
  publishedIso: string;
  section?: string;
  tags: readonly string[];
}

export interface ShareMetaInput {
  lang: Language;
  title: string;
  description: string;
  pageUrl: string;
  alternates: AlternateMode;
  siteOrigin: string;
  imageOrigin?: string;
  article?: ShareArticleInput;
}

/** Absolute HTTPS URL of the card for `lang`. Throws on a `lang` outside the closed set. */
export function shareImageUrl(lang: Language, imageOrigin: string = SHARE_IMAGE_ORIGIN): string {
  assertLanguage(lang);
  return new URL(SHARE_IMAGE_PATH[lang], imageOrigin).href;
}

/**
 * Absolute URL of `pathname` against `siteOrigin`, trailing slash removed unless the path is
 * exactly `/` (the project's `trailingSlash: 'never'` contract). Used when a page has no
 * `canonicalPath` of its own (the 404 pages).
 *
 * Under `build.format: 'file'` Astro reports a static page's `Astro.url.pathname` WITH the file
 * extension (measured in the head harness: `/no-canonical.html`), so a trailing `.html` is removed
 * and `/index.html` collapses to its directory, giving the extensionless public URL form.
 */
export function fallbackPageUrl(pathname: string, siteOrigin: string): string {
  let path = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (path !== '/' && path.endsWith('/')) path = path.replace(/\/+$/, '');
  return new URL(path === '' ? '/' : path, siteOrigin).href;
}

/** An ISO-8601 instant with an explicit `Z` or ±HH:MM offset (a naive local time is ambiguous in a tag). */
function requireIsoWithOffset(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(
      `share-meta: article.publishedIso must be an ISO-8601 date with a Z or ±HH:MM offset, got ${JSON.stringify(value)}`
    );
  }
  return value;
}

const ALTERNATE_MODES: readonly AlternateMode[] = ['paired', 'self', 'none'];

function requireText(field: 'title' | 'description', value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`share-meta: ${field} must be a non-empty string`);
  }
  return value;
}

function requireHttpsUrl(field: 'pageUrl' | 'siteOrigin', value: unknown): string {
  let parsed: URL | undefined;
  try {
    parsed = typeof value === 'string' ? new URL(value) : undefined;
  } catch {
    parsed = undefined;
  }
  if (!parsed || parsed.protocol !== 'https:') {
    throw new Error(`share-meta: ${field} must be an absolute https URL, got ${JSON.stringify(value)}`);
  }
  return value as string;
}

/**
 * The ordered share tag list for one page, in the fixed order of 07-UI-SPEC "Head Metadata
 * Contract": og:title, og:description, og:url, og:site_name, og:type, og:locale,
 * og:locale:alternate, the og:image group, then twitter:card and twitter:image:alt. Values are plain
 * strings; escaping is the renderer's job (`Base.astro` renders them through Astro attribute
 * expressions only, never `set:html`).
 *
 * D-22: og:locale:alternate is emitted on every page whatever `alternates` says (the literal SOC-01
 * reading); `alternates` is still validated. D-17: no X site-handle tag exists, and no X
 * title/description/image tag, because X falls back to the og:* tags. With `input.article` (07-04) og:type is
 * `article` and the article:* group (published_time, modified_time, section, one tag per tag, author)
 * is inserted between og:image:alt and twitter:card.
 */
export function shareMetaTags(input: ShareMetaInput): MetaTag[] {
  const { lang } = input;
  assertLanguage(lang);
  if (!ALTERNATE_MODES.includes(input.alternates)) {
    throw new Error(`share-meta: alternates must be one of ${ALTERNATE_MODES.join(', ')}, got ${JSON.stringify(input.alternates)}`);
  }
  const title = requireText('title', input.title);
  const description = requireText('description', input.description);
  const pageUrl = requireHttpsUrl('pageUrl', input.pageUrl);
  requireHttpsUrl('siteOrigin', input.siteOrigin);
  const otherLang: Language = lang === 'en' ? 'es' : 'en';
  const article = input.article;
  const publishedIso = article ? requireIsoWithOffset(article.publishedIso) : undefined;

  const tags: MetaTag[] = [];
  const og = (key: string, content: string): void => {
    tags.push({ attr: 'property', key, content });
  };
  const twitter = (key: string, content: string): void => {
    tags.push({ attr: 'name', key, content });
  };

  og('og:title', title);
  og('og:description', description);
  og('og:url', pageUrl);
  og('og:site_name', SITE_NAME);
  og('og:type', article ? 'article' : 'website');
  og('og:locale', OG_LOCALE[lang]);
  og('og:locale:alternate', OG_LOCALE[otherLang]);
  og('og:image', shareImageUrl(lang, input.imageOrigin));
  og('og:image:width', String(SHARE_IMAGE_WIDTH));
  og('og:image:height', String(SHARE_IMAGE_HEIGHT));
  og('og:image:type', SHARE_IMAGE_TYPE);
  og('og:image:alt', SHARE_IMAGE_ALT[lang]);
  if (article && publishedIso) {
    // D-15/D-18: both times are the one `bylineDatetime` value (the pipeline records a single instant,
    // like the NewsArticle JSON-LD's dateModified = datePublished). D-16: the author is the site's
    // own /about page in the page's language, never a person or an outlet.
    og('article:published_time', publishedIso);
    og('article:modified_time', publishedIso);
    const section = typeof article.section === 'string' ? article.section.trim() : '';
    if (section !== '') og('article:section', section);
    for (const tag of article.tags) {
      const name = typeof tag === 'string' ? tag.trim() : '';
      if (name !== '') og('article:tag', name);
    }
    og('article:author', new URL(localizedPath('/about', lang), input.siteOrigin).href);
  }
  twitter('twitter:card', 'summary_large_image');
  twitter('twitter:image:alt', SHARE_IMAGE_ALT[lang]);

  return tags;
}

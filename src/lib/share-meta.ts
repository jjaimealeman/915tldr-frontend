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
// 07-01 emits only the og:image group; 07-03 and 07-04 extend `shareMetaTags()` to the full
// og/twitter/article set in the fixed order recorded in 07-UI-SPEC "Head Metadata Contract".
import { assertLanguage, type Language } from './article-url.ts';
import type { AlternateMode } from './i18n/hreflang.ts';

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
 * `canonicalPath` of its own.
 */
export function fallbackPageUrl(pathname: string, siteOrigin: string): string {
  const trimmed = pathname !== '/' && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return new URL(trimmed === '' ? '/' : trimmed, siteOrigin).href;
}

/**
 * The ordered share tag list for one page. A single ordered list builder: later plans append the
 * rest of the set in the fixed order of 07-UI-SPEC "Head Metadata Contract". Values are plain
 * strings; escaping is the renderer's job (`Base.astro` renders them through Astro attribute
 * expressions only, never `set:html`).
 */
export function shareMetaTags(input: ShareMetaInput): MetaTag[] {
  const { lang } = input;
  assertLanguage(lang);

  const tags: MetaTag[] = [];
  const og = (key: string, content: string): void => {
    tags.push({ attr: 'property', key, content });
  };

  og('og:image', shareImageUrl(lang, input.imageOrigin));
  og('og:image:width', String(SHARE_IMAGE_WIDTH));
  og('og:image:height', String(SHARE_IMAGE_HEIGHT));
  og('og:image:type', SHARE_IMAGE_TYPE);
  og('og:image:alt', SHARE_IMAGE_ALT[lang]);

  return tags;
}

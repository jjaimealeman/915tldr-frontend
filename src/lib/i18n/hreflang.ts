// 06-05: the alternate-link builder every page's `<head>` draws from. No imports from
// `src/lib/server/` here — `article-url.ts`, which this module extends, is itself bundled
// directly into the Worker and must never pull in the D1/KV chokepoint directory; this module
// preserves that isolation since Base.astro (a build-time-only consumer) is its only caller today.
import {
  assertLanguage,
  languageOfPath,
  localizedPath,
  SPANISH_PREFIX,
  type Language,
} from '../article-url.ts';

/** `paired` — both language hrefs plus `x-default` (= English), in that fixed order (D-08).
 * `self` — the page has no counterpart yet (06-09's English-article-with-no-Spanish case): `en`
 * (self) + `x-default` (self) only, no `es` entry. `none` — noindex pages emit no alternate
 * links at all. */
export type AlternateMode = 'paired' | 'self' | 'none';

export interface AlternateLink {
  hreflang: 'en' | 'es' | 'x-default';
  href: string;
}

export interface AlternateLinksOptions {
  /** Absolute-from-origin path of the CURRENT page (`canonicalPath`, matching `Base.astro`'s own
   * prop of the same name) — not necessarily the English one. */
  canonicalPath: string;
  lang: Language;
  mode: AlternateMode;
  origin: string;
}

/**
 * Returns the OTHER language's path for `canonicalPath` — the Spanish path for an English input,
 * the English path for a Spanish input (D-06: Spanish URLs are `/es` + the identical English
 * path, so pairing is purely prefix add/remove). Throws on a `canonicalPath` that is neither a
 * bare English path nor an `/es`-prefixed one (the same never-coerce discipline every
 * `article-url.ts` function already applies).
 */
export function pairedPath(canonicalPath: string): string {
  const lang = languageOfPath(canonicalPath);
  if (lang === 'en') {
    return localizedPath(canonicalPath, 'es');
  }
  // lang === 'es': strip the single leading /es prefix back to the bare English path.
  if (canonicalPath === SPANISH_PREFIX) return '/';
  return canonicalPath.slice(SPANISH_PREFIX.length);
}

const VALID_MODES: readonly AlternateMode[] = ['paired', 'self', 'none'];

/**
 * Builds the `<link rel="alternate" hreflang="...">` set for a page, in the fixed order every
 * page and every rebuild must share (I18N-05: byte-identical output for unchanged pages). Throws
 * on an invalid `lang` or `mode` — never silently falls back to an empty or partial set.
 */
export function alternateLinks(opts: AlternateLinksOptions): AlternateLink[] {
  const { canonicalPath, lang, mode, origin } = opts;
  assertLanguage(lang);
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`hreflang: invalid mode: ${JSON.stringify(mode)}`);
  }

  if (mode === 'none') return [];

  const toHref = (path: string): string => new URL(path, origin).href;

  if (mode === 'self') {
    const selfHref = toHref(canonicalPath);
    return [
      { hreflang: 'en', href: selfHref },
      { hreflang: 'x-default', href: selfHref },
    ];
  }

  // mode === 'paired'
  const englishPath = lang === 'en' ? canonicalPath : pairedPath(canonicalPath);
  const spanishPath = lang === 'es' ? canonicalPath : pairedPath(canonicalPath);
  const englishHref = toHref(englishPath);
  const spanishHref = toHref(spanishPath);

  return [
    { hreflang: 'en', href: englishHref },
    { hreflang: 'es', href: spanishHref },
    { hreflang: 'x-default', href: englishHref },
  ];
}

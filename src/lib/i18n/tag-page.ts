// Post-phase-06 closeout (owner decision 2026-10-07): the robots/hreflang decision for tag pages,
// in one place so the English and Spanish templates cannot drift apart.
//
// `/es/tag/*` (20,105 URLs) lists cards whose titles/summaries are mostly the English fallback
// (only ~9% of articles have a clean Spanish row), so those pages are `noindex` and dropped from
// the Spanish sitemap (`isSitemapExcludedPath`). A noindex page must never be advertised as a
// language alternate, so the English twin declares `'self'` alternates (en + x-default, no `es`) —
// the same held-article precedent `enArticleLanguageModel` applies to an article with no clean
// translation. When Spanish coverage grows enough to index these pages again, flip this one
// function (and the sitemap predicate) back to `{ noindex: false, alternates: 'paired' }`.
//
// Polish task B (owner decision 2026-10-08, "agreed, yes"): `/es/source/*` (one page per RSS source)
// takes the identical decision for the identical reason — its cards are mostly English fallback — so
// `sourcePageSeo` is the same policy under its own name. Two exports, one shared body: the source
// templates and the tag templates can be flipped independently later by changing one function each.
//
// Zero `src/lib/server/` imports — reachable from `src/pages/**` like `article-page.ts`.
import { assertLanguage, type Language } from '../article-url.ts';
import type { AlternateMode } from './hreflang.ts';

export interface TagPageSeo {
  noindex: boolean;
  alternates: AlternateMode;
}

/** Shared body: Spanish listing page -> noindex, no alternates; English twin -> indexable, `self`. */
function spanishFallbackListingSeo(lang: Language | unknown): TagPageSeo {
  const validLang = assertLanguage(lang);
  return validLang === 'es'
    ? { noindex: true, alternates: 'none' }
    : { noindex: false, alternates: 'self' };
}

export function tagPageSeo(lang: Language | unknown): TagPageSeo {
  return spanishFallbackListingSeo(lang);
}

/** Source pages (`/source/<slug>`, `/es/source/<slug>`): same decision as tag pages. */
export function sourcePageSeo(lang: Language | unknown): TagPageSeo {
  return spanishFallbackListingSeo(lang);
}

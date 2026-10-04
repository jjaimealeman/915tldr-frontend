// 06-09 (I18N-02/03/04/05/09): the pure page model shared by the `/es` article route and the
// English article page's language-pair props. `esArticlePageModel` decides everything the
// Spanish template needs to render — a real translation when one is clean (D-01/D-05), or an
// honest English fallback (noindex, visible note, `lang="en"` on the content) when it isn't.
// `enArticleLanguageModel` is the much smaller mirror the ENGLISH page needs: whether it pairs
// with a real `/es` counterpart or stands alone. Zero `src/lib/server/` imports — reachable from
// `src/pages/**` (WR-03), same isolation `spanish-view.ts`/`rail.ts` already document.
import { articlePath, type Language } from '../article-url.ts';
import { splitStandfirst, summaryBodyHtml } from '../summary.ts';
import { t } from './dictionary.ts';
import type { EsEntryData } from './spanish-view.ts';
import type { RailResult } from '../rail.ts';
// Type-only import, same convention `rail.ts` already documents: this module shares nothing at
// runtime with the loader, only the `ArticleData` shape (erased before `assert-no-d1.mjs`'s
// Rollup-graph BFS ever runs).
import type { ArticleData } from '../../content/loaders/articles-loader.ts';

/** The content this function needs from an article to render its ENGLISH fallback — the same
 * minimal shape `spanish-view.ts`'s `localizedArticleView` already takes. */
type ArticleContent = Pick<ArticleData, 'title' | 'summary' | 'keyPoints'>;
type ArticleIdentity = Pick<ArticleData, 'uuid' | 'slug' | 'category'>;

export interface EsArticlePageModel {
  /** `true` only when a clean Spanish translation's own text is rendered. */
  translated: boolean;
  /** Which language the rendered `title`/`standfirst`/`bodyHtml` are actually written in. */
  contentLang: Language;
  noindex: boolean;
  /** D-05/D-14 discretion: a fallback page pairs with nothing (it would be an incorrect hreflang
   * pair pointing at English content), so this is `'paired'` only when translated. */
  alternates: 'paired' | 'none';
  title: string;
  standfirst: string;
  bodyHtml: string;
  /** `/es/<category>/<slug>-<uuid>` — this page's own canonical path. */
  canonicalPath: string;
  /** The English canonical path — both the hreflang pair target (when paired) and the
   * article-level "Read in English" switch link target (always rendered, D-12). */
  switchPath: string;
  /** D-05: only set (and only ever the Spanish fallback string) when `translated` is `false`. */
  fallbackNote?: string;
  /** `true` only when an `available` Spanish entry's own text failed block validation
   * (`summaryBodyHtml` threw) and this model degraded to the English fallback instead of
   * crashing the build (T-06-34: a validation failure never reaches `set:html` as raw text). */
  invalidSpanish?: boolean;
  /** D-03/D-07: the ORIGINAL article's detected source language, present even on a fallback
   * page — carried through so a future consumer never needs a second join for it. */
  sourceLanguage: Language | 'und';
}

function fallbackModel(
  article: ArticleIdentity & ArticleContent,
  canonicalPath: string,
  switchPath: string,
  sourceLanguage: Language | 'und',
  invalidSpanish: boolean
): EsArticlePageModel {
  const { standfirst } = splitStandfirst(article.summary);
  const bodyHtml = summaryBodyHtml(article.summary, article.keyPoints);
  const model: EsArticlePageModel = {
    translated: false,
    contentLang: 'en',
    noindex: true,
    alternates: 'none',
    title: article.title,
    standfirst,
    bodyHtml,
    canonicalPath,
    switchPath,
    fallbackNote: t('fallbackNote', 'es'),
    sourceLanguage,
  };
  if (invalidSpanish) model.invalidSpanish = true;
  return model;
}

/**
 * Builds the full render model for one article's `/es` page. `rail` is accepted for interface
 * stability with the route's own `getStaticPaths()` call shape (06-09-PLAN.md `<interfaces>`) —
 * today's rail cards are rendered directly from `localizedArticleView` at the template level, so
 * this function does not read it, but the signature keeps the route's call site symmetric with
 * `enArticleLanguageModel`'s and leaves room for a future rail-derived field without a breaking
 * change.
 *
 * D-05: an `available` Spanish entry's own title/summary/keyPoints render as Spanish
 * (`translated: true`, `alternates: 'paired'`). Every other case — no entry, a held entry, or an
 * available entry whose text fails `summaryBodyHtml`'s block validation — degrades to the
 * article's own English content under a visible fallback note, `noindex: true`, no alternates
 * (pairing a `/es` URL with English content would be an incorrect hreflang pair).
 */
export function esArticlePageModel(
  article: ArticleData,
  esEntry: EsEntryData | undefined,
  // Accepted, not read — see the doc comment above this function.
  rail: RailResult
): EsArticlePageModel {
  const canonicalPath = articlePath(article.category.slug, article.slug, article.uuid, 'es');
  const switchPath = articlePath(article.category.slug, article.slug, article.uuid, 'en');
  const sourceLanguage: Language | 'und' = esEntry?.sourceLanguage ?? 'und';

  if (esEntry?.available) {
    try {
      const summary = esEntry.summary as string;
      const { standfirst } = splitStandfirst(summary);
      const bodyHtml = summaryBodyHtml(summary, esEntry.keyPoints);
      return {
        translated: true,
        contentLang: 'es',
        noindex: false,
        alternates: 'paired',
        title: esEntry.title as string,
        standfirst,
        bodyHtml,
        canonicalPath,
        switchPath,
        sourceLanguage,
      };
    } catch {
      // T-06-34: a Spanish entry that fails block validation degrades to the fallback — never a
      // build crash, never raw unvalidated HTML reaching set:html.
      return fallbackModel(article, canonicalPath, switchPath, sourceLanguage, true);
    }
  }

  return fallbackModel(article, canonicalPath, switchPath, sourceLanguage, false);
}

export interface EnArticleLanguageModel {
  /** `'paired'` only when a clean Spanish translation exists for this article; `'self'`
   * otherwise (no entry, or a held one) — pairing with the D-05 English-fallback `/es` page
   * would be an incorrect hreflang pair. */
  alternates: 'paired' | 'self';
  /** The `/es` canonical path — only present when `alternates` is `'paired'`. */
  esPath?: string;
  /** D-03/D-07: the original article's detected source language, present even when the
   * translation itself is held or missing. */
  sourceLanguage: Language | 'und';
}

/**
 * Builds the English article page's own small language-pair model: whether it reciprocally
 * pairs with a real `/es` counterpart, and the original article's source language (D-07's
 * "Originally reported in Spanish" label reads this even while the translation is held).
 */
export function enArticleLanguageModel(
  article: ArticleIdentity,
  esEntry: EsEntryData | undefined
): EnArticleLanguageModel {
  const sourceLanguage: Language | 'und' = esEntry?.sourceLanguage ?? 'und';

  if (esEntry?.available) {
    return {
      alternates: 'paired',
      esPath: articlePath(article.category.slug, article.slug, article.uuid, 'es'),
      sourceLanguage,
    };
  }

  return { alternates: 'self', sourceLanguage };
}

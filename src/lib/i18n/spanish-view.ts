// 06-06 (I18N-01/I18N-04): the pure join between an English article and its (possibly missing or
// held) Spanish `articlesEs` entry. Templates under `/es/...` and the English article page's
// "Originally reported in Spanish" label (D-07) both read through this module — never through
// `src/lib/server/d1-client.ts`/`build-state.ts` directly (Core Value: zero D1 reads on the
// public request path). This file carries NO imports from `src/lib/server/` — the same isolation
// `article-url.ts`'s own header comment documents, confirmed by the build's `assert-no-d1.mjs`
// gate on every build.
import type { Language } from '../article-url.ts';

export { categoryLabel } from './category-labels.ts';

/** The shape of one `articlesEs` collection entry's `data` (mirrors `articleEsSchema` in
 * `src/content/loaders/articles-es-loader.ts` — duplicated here rather than imported so this
 * module stays free of any import chain that could reach `src/lib/server/`). */
export interface EsEntryData {
  uuid: string;
  sourceLanguage: Language | 'und';
  available: boolean;
  title: string | null;
  summary: string | null;
  keyPoints: string[] | null;
  updatedAt: number;
}

/** The minimal shape of an English `articles` collection entry this module needs — the fallback
 * content D-05 serves when no clean Spanish translation exists. */
export interface EnglishArticleContent {
  title: string;
  summary: string;
  keyPoints: string[] | null;
}

export interface LocalizedArticleView {
  /** Which language the returned `title`/`summary`/`keyPoints` are actually written in — `'es'`
   * only when a clean translation was used; `'en'` for every fallback case (D-05). */
  lang: Language;
  title: string;
  summary: string;
  keyPoints: string[] | null;
  /** `true` only when a clean Spanish translation's own text is returned. */
  translated: boolean;
  /** The ORIGINAL article's detected source language (D-03/D-07) — present even when the
   * translation itself is held or missing, so the English page can still show "Originally
   * reported in Spanish". `'und'` when no `articlesEs` entry exists for this article at all. */
  sourceLanguage: Language | 'und';
}

/** Indexes a list of `articlesEs` entries by `uuid` — the join key shared with the English
 * collection's own `uuid` (D-01: `translationGroupId` in the render manifest is this same uuid). */
export function buildEsIndex(entries: EsEntryData[]): Map<string, EsEntryData> {
  const index = new Map<string, EsEntryData>();
  for (const entry of entries) {
    index.set(entry.uuid, entry);
  }
  return index;
}

/**
 * Joins one English article to its (possibly undefined, possibly held) Spanish entry. D-05: a
 * clean (`available: true`) entry's own title/summary/keyPoints are returned, `lang: 'es'`,
 * `translated: true`. Every other case — no entry at all, or a held (`available: false`) entry —
 * falls back to the English article's own content, `lang: 'en'`, `translated: false`; the only
 * difference between those two fallback cases is `sourceLanguage`, which is read off the held
 * entry when one exists (so the "Originally reported in Spanish" label (D-07) still works even
 * while the translation itself is withheld) and is `'und'` only when no entry exists at all.
 */
export function localizedArticleView(
  article: EnglishArticleContent,
  esEntry: EsEntryData | undefined
): LocalizedArticleView {
  if (esEntry?.available) {
    return {
      lang: 'es',
      title: esEntry.title as string,
      summary: esEntry.summary as string,
      keyPoints: esEntry.keyPoints,
      translated: true,
      sourceLanguage: esEntry.sourceLanguage,
    };
  }

  return {
    lang: 'en',
    title: article.title,
    summary: article.summary,
    keyPoints: article.keyPoints,
    translated: false,
    sourceLanguage: esEntry?.sourceLanguage ?? 'und',
  };
}

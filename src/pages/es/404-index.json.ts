// 06-10 (Task 2, I18N-04): the Spanish counterpart of `../404-index.json.ts` — same
// `NOT_FOUND_INDEX_COUNT` entries, same deterministic newest-first/uuid-ascending-tiebreak order
// (so the two indexes list the SAME articles in the SAME order, only paths/titles differ), but
// every path is `/es`-prefixed and every title is the article's REAL Spanish title when a clean
// translation exists, honest English title otherwise (`localizedArticleView`, D-05).
//
// Same "no `export const prerender = false`" note as the English route: `output: 'static'`
// prerenders this by the project default, so it lands as a real file at
// `dist/client/es/404-index.json` — zero D1 reads, zero Worker invocations to fetch.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { articlePath } from '../../lib/article-url.ts';
import { buildEsIndex, localizedArticleView } from '../../lib/i18n/spanish-view.ts';
import { NOT_FOUND_INDEX_COUNT } from '../404-index.json.ts';

export const GET: APIRoute = async () => {
  const entries = await getCollection('articles');
  const esEntries = await getCollection('articlesEs');
  const esIndex = buildEsIndex(esEntries.map((entry) => entry.data));
  const articles = entries.map((entry) => entry.data);

  // Same deterministic sort as ../404-index.json.ts — reimplemented inline (not imported from
  // src/lib/listing.ts) for the same reason that file documents.
  const sorted = [...articles].sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
  });

  const index = sorted.slice(0, NOT_FOUND_INDEX_COUNT).map((article) => {
    const view = localizedArticleView(article, esIndex.get(article.uuid));
    return {
      t: view.title,
      p: articlePath(article.category.slug, article.slug, article.uuid, 'es'),
    };
  });

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};

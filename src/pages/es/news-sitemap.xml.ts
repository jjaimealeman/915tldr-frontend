// 06-11 (I18N-06, D-08 discretion): the Spanish Google News sitemap — mirrors
// `src/pages/news-sitemap.xml.ts` exactly (same 48-hour window, same build-moment anchor), but
// only over articles with a publishable Spanish version (D-05), with `/es` paths, Spanish
// titles, and `<news:language>es</news:language>`. A quiet 48-hour window for Spanish content
// (translation backfill is still in progress, per 06-08) renders a valid, empty `<urlset>` —
// never a build failure.
//
// No `export const prerender = false` here, deliberately, matching every other static endpoint
// in this app (including the English news-sitemap route): `output: 'static'` prerenders this
// route by the project default, so it costs zero D1 reads and zero Worker invocations to serve.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { articlePath } from '../../lib/article-url';
import { selectNewsWindow, newsSitemapXml } from '../../lib/seo-feeds';
import { buildEsIndex, localizedArticleView } from '../../lib/i18n/spanish-view';

export const GET: APIRoute = async () => {
  const entries = await getCollection('articles');
  const esEntries = await getCollection('articlesEs');
  const esIndex = buildEsIndex(esEntries.map((entry) => entry.data));

  // D-05: only articles whose Spanish version is a clean, publishable translation — the exact
  // same `translated` test the home/listing pages and the RSS feed (`es/rss.xml.ts`) use via
  // `localizedArticleView`, never a separate Spanish derivation.
  const translatable = entries
    .map((entry) => entry.data)
    .filter((article) => localizedArticleView(article, esIndex.get(article.uuid)).translated);

  const windowed = selectNewsWindow(translatable, Math.floor(Date.now() / 1000));
  const localized = windowed.map((article) => {
    const view = localizedArticleView(article, esIndex.get(article.uuid));
    return {
      path: articlePath(article.category.slug, article.slug, article.uuid, 'es'),
      title: view.title,
      publishedAt: article.publishedAt,
    };
  });
  const xml = newsSitemapXml(localized, 'https://915tldr.com', { language: 'es' });

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

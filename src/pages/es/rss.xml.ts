// 06-11 (I18N-06): the Spanish RSS feed — mirrors `src/pages/rss.xml.ts` exactly (same
// `@astrojs/rss` call shape, same `RSS_ITEM_COUNT` cap, same `trailingSlash: false` requirement —
// see that file's own header comment for why), but only over articles with a publishable
// Spanish version (D-05), with `/es` links, Spanish titles/summaries/category labels, and
// `<language>es-us</language>`. `src/pages/rss.xml.ts` itself is untouched by this plan — the
// English feed's own `<verify>`/tests already prove it unchanged.
//
// No `export const prerender = false` here, deliberately, matching the English feed and every
// other static endpoint in this app: `output: 'static'` prerenders this route by the project
// default, so it costs zero D1 reads and zero Worker invocations to serve.
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { articlePath } from '../../lib/article-url';
import { compareNewestFirst } from '../../lib/listing';
import { RSS_ITEM_COUNT } from '../../lib/seo-feeds';
import { t } from '../../lib/i18n/dictionary';
import { buildEsIndex, localizedArticleView, categoryLabel } from '../../lib/i18n/spanish-view';

export const GET: APIRoute = async (context) => {
  const entries = await getCollection('articles');
  const esEntries = await getCollection('articlesEs');
  const esIndex = buildEsIndex(esEntries.map((entry) => entry.data));

  // D-05: pair every article with its Spanish view, keep only the ones with a clean, publishable
  // translation (`translated: true`) — the same join/filter rule the Spanish home page, category
  // pages and article rails already use via `localizedArticleView`.
  const translated = entries
    .map((entry) => entry.data)
    .map((article) => ({ article, view: localizedArticleView(article, esIndex.get(article.uuid)) }))
    .filter(({ view }) => view.translated)
    .sort((a, b) => compareNewestFirst(a.article, b.article))
    .slice(0, RSS_ITEM_COUNT);

  return rss({
    title: t('homeTitle', 'es'),
    description: t('homeDescription', 'es'),
    site: context.site!,
    trailingSlash: false,
    customData: '<language>es-us</language>',
    items: translated.map(({ article, view }) => ({
      title: view.title,
      link: articlePath(article.category.slug, article.slug, article.uuid, 'es'),
      pubDate: new Date(article.publishedAt * 1000),
      description: view.summary,
      categories: [categoryLabel(article.category.slug, 'es') ?? article.category.name],
      source: {
        url: context.site!.href,
        title: article.source.name,
      },
    })),
  });
};

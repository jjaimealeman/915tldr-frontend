// SEO-06: v1 parity RSS 2.0 feed (`server/routes/rss.xml.ts`), rebuilt as a static Content Layer
// read instead of a per-request D1 query. `trailingSlash: false` is REQUIRED here — the
// project-level `trailingSlash: 'never'` key in astro.config.mjs does not propagate into
// `@astrojs/rss`'s own item-link canonicalisation (its own docs recipe calls this out
// explicitly); without it every `<link>`/`<guid>` would carry a trailing slash that 404s against
// this project's `path.html` (no trailing slash) route shape.
//
// `@astrojs/rss` derives `<guid isPermaLink="true">` from each item's own `link` automatically
// (`node_modules/@astrojs/rss/dist/index.js`, `item.guid = { "#text": itemLink, "@_isPermaLink":
// "true" }`) — this is already byte-for-byte the same shape v1 hand-wrote
// (`<guid isPermaLink="true">${articleUrl}</guid>`), so no `customData` override is needed to
// match v1's guid format.
//
// No `export const prerender = false` here, deliberately, matching every other static endpoint in
// this app (version.json.ts, 404-index.json.ts): `output: 'static'` prerenders this route by the
// project default, so it costs zero D1 reads and zero Worker invocations to serve.
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { articlePath } from '../lib/article-url';
import { sortNewestFirst } from '../lib/listing';
import { RSS_ITEM_COUNT } from '../lib/seo-feeds';

export const GET: APIRoute = async (context) => {
  const entries = await getCollection('articles');
  const articles = sortNewestFirst(entries.map((entry) => entry.data)).slice(0, RSS_ITEM_COUNT);

  return rss({
    title: '915 TLDR - El Paso News, Simplified',
    description:
      'AI-powered local news for El Paso. Get the TLDR on what matters in the Sun City.',
    site: context.site!,
    trailingSlash: false,
    customData: '<language>en-us</language>',
    items: articles.map((article) => ({
      title: article.title,
      link: articlePath(article.category.slug, article.slug, article.uuid),
      pubDate: new Date(article.publishedAt * 1000),
      description: article.summary,
      categories: [article.category.name],
      source: {
        url: context.site!.href,
        title: article.source.name,
      },
    })),
  });
};

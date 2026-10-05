// SEO-03: Google News sitemap, limited to public stories published within the last 48 hours.
// Hand-written (no package covers the `news:` namespace the way `@astrojs/sitemap` covers the
// base sitemap protocol) — `src/lib/seo-feeds.ts` holds the pure, tested selection/render logic;
// this route is a thin wrapper anchoring the 48-hour window at the build moment, which is correct
// for a feed rebuilt every cron cycle (04-07-PLAN.md Task 3 action).
//
// No `export const prerender = false` here, deliberately, matching every other static endpoint
// in this app: `output: 'static'` prerenders this route by the project default, so it costs zero
// D1 reads and zero Worker invocations to serve.
//
// 06-11 (I18N-06): `newsSitemapXml` now takes already-localised entries (`path`/`title`), not
// `ArticleData[]` directly — this route builds `path` itself via `articlePath` (default `'en'`)
// so its own output stays byte-identical to what it rendered before this change; `language`
// defaults to `'en'` too, so the omitted third argument below is deliberate, not an oversight.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { articlePath } from '../lib/article-url';
import { selectNewsWindow, newsSitemapXml } from '../lib/seo-feeds';

export const GET: APIRoute = async () => {
  const entries = await getCollection('articles');
  const allPublic = entries.map((entry) => entry.data);
  const windowed = selectNewsWindow(allPublic, Math.floor(Date.now() / 1000));
  const localized = windowed.map((article) => ({
    path: articlePath(article.category.slug, article.slug, article.uuid),
    title: article.title,
    publishedAt: article.publishedAt,
  }));
  const xml = newsSitemapXml(localized, 'https://915tldr.com');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

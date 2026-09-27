// SEO-03: Google News sitemap, limited to public stories published within the last 48 hours.
// Hand-written (no package covers the `news:` namespace the way `@astrojs/sitemap` covers the
// base sitemap protocol) — `src/lib/seo-feeds.ts` holds the pure, tested selection/render logic;
// this route is a thin wrapper anchoring the 48-hour window at the build moment, which is correct
// for a feed rebuilt every cron cycle (04-07-PLAN.md Task 3 action).
//
// No `export const prerender = false` here, deliberately, matching every other static endpoint
// in this app: `output: 'static'` prerenders this route by the project default, so it costs zero
// D1 reads and zero Worker invocations to serve.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { selectNewsWindow, newsSitemapXml } from '../lib/seo-feeds';

export const GET: APIRoute = async () => {
  const entries = await getCollection('articles');
  const allPublic = entries.map((entry) => entry.data);
  const windowed = selectNewsWindow(allPublic, Math.floor(Date.now() / 1000));
  const xml = newsSitemapXml(windowed, 'https://915tldr.com');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

// D-10a: the build-time suggestion index 404.astro's plain page script fetches client-side.
// Compact keys (`t`/`p`) keep the file small at NOT_FOUND_INDEX_COUNT entries — D-10a's own
// "sized to stay small" discretion. No D1 or KV read here: this route reads the same in-memory
// Content Layer collection every other page in this build already reads (getCollection), so the
// suggestion index can never point at a page THIS build didn't also produce (tests/unit/
// not-found.test.mjs's same-build-consistency check).
//
// No `export const prerender = false` here, deliberately, matching version.json.ts's own note:
// `output: 'static'` prerenders this route by the project default, so it lands as a real file at
// `dist/client/404-index.json` and costs zero D1 reads and zero Worker invocations to fetch.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { articlePath } from '../lib/article-url';

/** D-10a: sized to stay small. 500 newest public articles is enough for the client-side matcher
 * (top-5 by token overlap) to usually find something relevant, while keeping the JSON file well
 * under 100KB (tests/unit/not-found.test.mjs asserts the ceiling directly). */
export const NOT_FOUND_INDEX_COUNT = 500;

export const GET: APIRoute = async () => {
  const entries = await getCollection('articles');
  const articles = entries.map((entry) => entry.data);

  // Newest-first, uuid-ascending tiebreak — same deterministic ordering rule src/lib/listing.ts's
  // compareNewestFirst uses, reimplemented inline per this plan's own instruction (this route
  // must not import src/lib/listing.ts, which is 04-05's module, to keep this task's diff
  // independent of that plan's own parallel work).
  const sorted = [...articles].sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
  });

  const index = sorted.slice(0, NOT_FOUND_INDEX_COUNT).map((article) => ({
    t: article.title,
    p: articlePath(article.category.slug, article.slug, article.uuid),
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};

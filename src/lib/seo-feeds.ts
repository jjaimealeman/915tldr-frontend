// 04-07: pure selectors and XML escaping shared by /rss.xml (src/pages/rss.xml.ts) and
// /news-sitemap.xml (src/pages/news-sitemap.xml.ts). No `astro:content` or `src/lib/server/`
// import here — both pages read the Content Layer collection themselves and pass plain
// `ArticleData[]` in, which is what keeps this module unit-testable under plain `node --test`
// (matching src/lib/listing.ts's own established pattern).
//
// 06-11 (I18N-06): `newsSitemapXml` now takes already-localised `NewsSitemapEntry[]` (a `path`
// string, not `category.slug`/`slug`/`uuid` fields) instead of `ArticleData[]` directly — the
// English route builds that path with `articlePath(..., 'en')` (default), the Spanish route with
// `articlePath(..., 'es')`, so this module itself never needs to know about `/es` or import
// anything Spanish-specific. `selectNewsWindow` is unchanged (it only reads `publishedAt`, which
// both languages share from the one English `articles` collection).
import type { ArticleData } from '../content/loaders/articles-loader.ts';
import { assertLanguage, type Language } from './article-url.ts';

/** v1 parity — `server/routes/rss.xml.ts`'s `.limit(30)`. */
export const RSS_ITEM_COUNT = 30;

/** Google News' own requirement: only articles published within the last 48 hours belong in the
 * news sitemap (SEO-03). 48 * 60 * 60. */
export const NEWS_WINDOW_SECONDS = 172_800;

/** Google News' documented ceiling: at most 1,000 URLs per news sitemap. */
export const NEWS_MAX_URLS = 1000;

/** Escapes the five XML predefined entities. Used for the hand-written news sitemap; `@astrojs/rss`
 * escapes its own item fields internally, so this is not re-applied to rss.xml.ts's inputs. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Selects the articles published within `NEWS_WINDOW_SECONDS` of `nowEpoch` (inclusive of the
 * window's lower bound; a future-dated `publishedAt` is included too — the window has no upper
 * bound other than "now," and a same-day source occasionally posts a story stamped a few minutes
 * ahead of build time), newest-first, capped at `NEWS_MAX_URLS`. Deterministic tie-break on `uuid`
 * ascending for two articles sharing a `publishedAt`, matching `src/lib/listing.ts`'s own ordering
 * rule (REND-04). A quiet news day (zero in-window articles) returns an empty array — never a
 * thrown error; the caller (`newsSitemapXml`) renders a valid empty `<urlset>` for that case.
 */
export function selectNewsWindow(articles: ArticleData[], nowEpoch: number): ArticleData[] {
  const cutoff = nowEpoch - NEWS_WINDOW_SECONDS;
  const inWindow = articles.filter((article) => article.publishedAt >= cutoff);
  inWindow.sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
  });
  return inWindow.slice(0, NEWS_MAX_URLS);
}

/** `publishedAt` (epoch seconds) as an ISO-8601 string with an explicit UTC offset
 * (`YYYY-MM-DDTHH:mm:ss+00:00`) — Google's documented `news:publication_date` format requires a
 * W3C Datetime with a timezone designator; `Date#toISOString()` alone emits a bare `Z` suffix,
 * which is also valid W3C Datetime, so it is used directly rather than hand-building a `+00:00`
 * offset string. */
function isoWithOffset(publishedAtEpochSeconds: number): string {
  return new Date(publishedAtEpochSeconds * 1000).toISOString();
}

/** Google's news sitemap requires the `news:publication_date` article title be an accurate,
 * escaped rendering — no truncation, no stripped punctuation. */
export const NEWS_PUBLICATION_NAME = '915 TLDR';

/** `newsSitemapXml`'s input shape — already localised by the caller: `path` is the FULL
 * canonical path (e.g. `/crime/foo-uuid` or its `/es/crime/foo-uuid` counterpart, built via
 * `articlePath`), `title` is already the language the caller wants rendered (English text, or
 * `localizedArticleView`'s Spanish title). This module stays language-agnostic — it only ever
 * reads `options.language` to decide what `<news:language>` says. */
export interface NewsSitemapEntry {
  path: string;
  title: string;
  publishedAt: number;
}

export interface NewsSitemapOptions {
  /** Defaults to `'en'` — the only call site this module shipped with before 06-11. */
  language?: Language;
}

/**
 * Builds a Google News sitemap (`http://www.google.com/schemas/sitemap-news/0.9` namespace,
 * alongside the base sitemaps 0.9 namespace) from an already-windowed, already-sorted, already-
 * localised entry list. Renders a valid, empty `<urlset>` for a zero-length `entries` array — a
 * quiet news day is not a loader failure (this plan's own behavior spec). `options.language`
 * (06-11, I18N-06) sets `<news:language>`; an invalid value throws via the same
 * `assertLanguage` every other closed-enum language value in this project goes through — never
 * silently coerced.
 */
export function newsSitemapXml(
  entries: NewsSitemapEntry[],
  origin: string,
  options: NewsSitemapOptions = {}
): string {
  const language = assertLanguage(options.language ?? 'en');
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(`${origin}${entry.path}`);
      const title = escapeXml(entry.title);
      const pubDate = isoWithOffset(entry.publishedAt);
      return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>${NEWS_PUBLICATION_NAME}</news:name>
        <news:language>${language}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;
}

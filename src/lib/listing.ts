// 04-05 (Task 1): the single tested, deterministic selection module every listing page (home, the
// 8 category indexes, tag pages, /tags, source pages) draws from. Pure functions over
// `ArticleData[]` (type-only import from the loader module — this file never reaches across the
// D1-access boundary every other pure lib module in this project respects).
import type { ArticleData } from '../content/loaders/articles-loader.ts';
import { CATEGORIES } from './categories.ts';

/**
 * Newest-`publishedAt`-first comparator with a deterministic tie-break on `uuid` ascending, so
 * two articles sharing a `publishedAt` value always sort the same way on every build (REND-04
 * ordering must-have).
 */
export function compareNewestFirst(a: ArticleData, b: ArticleData): number {
  if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
  return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
}

/** Returns a new, newest-first-sorted array — never mutates `articles`. */
export function sortNewestFirst(articles: ArticleData[]): ArticleData[] {
  return [...articles].sort(compareNewestFirst);
}

/**
 * Groups articles by category slug. Every one of the 8 `CATEGORIES` slugs is present as a key,
 * including categories with zero public articles (an explicit empty array, never a missing key) —
 * this is what lets a category page render its empty state instead of 404ing or being skipped by
 * `getStaticPaths`. Each value is newest-first sorted.
 */
export function groupByCategory(articles: ArticleData[]): Map<string, ArticleData[]> {
  const grouped = new Map<string, ArticleData[]>();
  for (const category of CATEGORIES) {
    grouped.set(category.slug, []);
  }
  for (const article of articles) {
    const list = grouped.get(article.category.slug);
    if (list) {
      list.push(article);
    } else {
      // A category slug not in the fixed CATEGORIES list should never reach this module — the
      // loader's own category check (articles-loader.ts step 4) already rejects it before the
      // content collection is ever populated. Included defensively rather than silently dropping
      // the article.
      grouped.set(article.category.slug, [article]);
    }
  }
  for (const list of grouped.values()) {
    list.sort(compareNewestFirst);
  }
  return grouped;
}

export interface TagGroupEntry {
  name: string;
  articles: ArticleData[];
}

/**
 * Groups articles by tag slug. Only tags present on at least one article become a key (unlike
 * `groupByCategory`, there is no fixed universe of tags to pre-populate) — a tag with zero public
 * articles gets no page, per this plan's must-haves. Each value's `articles` is newest-first
 * sorted; `name` is taken from the first article encountered carrying that tag (tag names are
 * consistent per slug in the D1 schema — `tags.slug` is unique).
 */
export function groupByTag(articles: ArticleData[]): Map<string, TagGroupEntry> {
  const grouped = new Map<string, TagGroupEntry>();
  for (const article of articles) {
    for (const tag of article.tags) {
      let entry = grouped.get(tag.slug);
      if (!entry) {
        entry = { name: tag.name, articles: [] };
        grouped.set(tag.slug, entry);
      }
      entry.articles.push(article);
    }
  }
  for (const entry of grouped.values()) {
    entry.articles.sort(compareNewestFirst);
  }
  return grouped;
}

export interface SourceGroupEntry {
  source: ArticleData['source'];
  articles: ArticleData[];
}

/** Groups articles by source slug. Each value's `articles` is newest-first sorted. */
export function groupBySource(articles: ArticleData[]): Map<string, SourceGroupEntry> {
  const grouped = new Map<string, SourceGroupEntry>();
  for (const article of articles) {
    let entry = grouped.get(article.source.slug);
    if (!entry) {
      entry = { source: article.source, articles: [] };
      grouped.set(article.source.slug, entry);
    }
    entry.articles.push(article);
  }
  for (const entry of grouped.values()) {
    entry.articles.sort(compareNewestFirst);
  }
  return grouped;
}

export interface TagIndexEntry {
  slug: string;
  name: string;
  count: number;
}

/**
 * Flat, count-sorted view of every tag present on at least one article — `/tags` uses this
 * (limited to `TAGS_INDEX_COUNT`) to show the most-used tags, v1 parity (`server/api/tags.get.ts`'s
 * `ORDER BY usageCount DESC, t.name ASC`, adapted here to slug since that's this schema's stable
 * unique key).
 */
export function tagIndex(articles: ArticleData[]): TagIndexEntry[] {
  const grouped = groupByTag(articles);
  const entries: TagIndexEntry[] = [];
  for (const [slug, entry] of grouped) {
    entries.push({ slug, name: entry.name, count: entry.articles.length });
  }
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
  return entries;
}

/**
 * Every top-level output path this project emits or redirects to, outside the 8 category slugs
 * themselves. A category slug matching one of these would silently overwrite (or be overwritten
 * by) that route in `dist/client` — `assertNoRouteCollisions` below turns that into a build-time
 * failure instead of a silent file clobber.
 */
export const RESERVED_TOP_LEVEL: readonly string[] = [
  'changelog',
  'contact',
  'about',
  'privacy',
  'terms',
  'tags',
  'tag',
  'source',
  '404',
  'rss.xml',
  'news-sitemap.xml',
  'sitemap-index.xml',
  'sitemap.xml',
  'version.json',
  '404-index.json',
  'latest.json',
  'categories',
  'sources',
  'new',
  'search',
  'stats',
  'article',
  'fonts',
  '_astro',
];

/**
 * Throws, naming the first offending slug, if any category slug collides with a reserved
 * top-level route name. Called from `[category]/index.astro`'s `getStaticPaths` before any page
 * is emitted (REND-04 adjacency must-have: no two routes emit the same output path).
 */
export function assertNoRouteCollisions(categorySlugs: string[]): void {
  const reserved = new Set(RESERVED_TOP_LEVEL);
  for (const slug of categorySlugs) {
    if (reserved.has(slug)) {
      throw new Error(`listing: category slug "${slug}" collides with a reserved top-level route`);
    }
  }
}

// Card counts, v1 parity (RESEARCH planner_findings: v1's category/tag/source pages each cap at
// 30; /tags shows the top 100 tags — `app/pages/[category]/index.vue`, `app/pages/tag/[slug].vue`,
// `app/pages/source/[slug].vue`, `server/api/tags.get.ts`'s default limit).
export const CATEGORY_PAGE_COUNT = 30;
export const TAG_PAGE_COUNT = 30;
export const SOURCE_PAGE_COUNT = 30;
export const TAGS_INDEX_COUNT = 100;

/** design/mockups/index.html's no-JS feed state: 1 lead article + 6 cards inside
 * `<section data-grid>` between the `feed:start`/`feed:end` markers = 7 rendered cards total.
 * The loader has no separate "lead" concept — the homepage draws its whole rendered set
 * (`sortNewestFirst(...).slice(0, HOME_FEED_COUNT)`) from one flat newest-first list. */
export const HOME_FEED_COUNT = 7;

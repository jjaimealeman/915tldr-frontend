// 04-04 (Task 2): article rail neighbour selection. Owner decision 2026-09-26 (checkpoint Task 1,
// option-a — "Article-relative rail"): "More in <Category>" holds the same-category stories
// published immediately before this one; the second group ("Earlier") holds the site-wide stories
// published immediately before this one. Both groups are computed from the article's own position
// in the collection, not from "now" or a build clock — an unchanged article's rail neighbours
// never change unless a neighbour itself changes, satisfying criterion 3 (byte-identical unchanged
// articles). Pure module, no I/O — the type-only import below is the only thing this module shares
// with the loader.
import type { ArticleData } from '../content/loaders/articles-loader.ts';

export interface RailResult {
  /** Up to `moreCount` same-category stories published before this article, newest first. */
  more: ArticleData[];
  /** Up to `secondCount` site-wide stories published before this article, newest first. */
  second: ArticleData[];
  /** Heading for the second group — always "Earlier" for the owner-selected option-a rail. */
  secondHeading: string;
}

export interface ComputeRailsOptions {
  moreCount?: number;
  secondCount?: number;
}

/**
 * Computes every article's rail in one pass over the collection (no per-article full scan):
 * articles are sorted once (`publishedAt` desc, `uuid` asc as a deterministic tie-break), then
 * grouped by category preserving that order so each article's "more" neighbours are a cheap
 * bounded slice of its own category's list, and its "second" neighbours are a bounded slice of the
 * global sorted list. The oldest article in the whole collection (last in sort order) has no
 * articles published after it in this ordering, so both of its groups are empty arrays.
 */
export function computeRails(
  articles: ArticleData[],
  opts: ComputeRailsOptions = {}
): Map<string, RailResult> {
  const { moreCount = 3, secondCount = 5 } = opts;

  const sorted = [...articles].sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt - a.publishedAt;
    return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
  });

  const byCategory = new Map<string, ArticleData[]>();
  for (const article of sorted) {
    const slug = article.category.slug;
    const list = byCategory.get(slug);
    if (list) {
      list.push(article);
    } else {
      byCategory.set(slug, [article]);
    }
  }

  const categoryPosition = new Map<string, number>();
  for (const list of byCategory.values()) {
    list.forEach((article, index) => categoryPosition.set(article.uuid, index));
  }

  const rails = new Map<string, RailResult>();
  sorted.forEach((article, index) => {
    const categoryList = byCategory.get(article.category.slug) ?? [];
    const posInCategory = categoryPosition.get(article.uuid) ?? 0;
    const more = categoryList.slice(posInCategory + 1, posInCategory + 1 + moreCount);
    const second = sorted.slice(index + 1, index + 1 + secondCount);
    rails.set(article.uuid, { more, second, secondHeading: 'Earlier' });
  });

  return rails;
}

/** Stable join of each rail neighbour's render inputs — changes when a neighbour's title, slug,
 * category or uuid changes (or the set/order of neighbours itself changes), identical for
 * identical inputs. Used to detect when an article's own rendered HTML would change even though
 * its own data digest did not (a neighbour's title changed, not the article's). */
export function railFingerprint(rail: RailResult): string {
  const parts: string[] = [];
  for (const neighbor of [...rail.more, ...rail.second]) {
    parts.push(
      `${neighbor.uuid}|${neighbor.slug}|${neighbor.category.slug}|${neighbor.title}|${neighbor.source.name}|${neighbor.publishedAt}`
    );
  }
  return parts.join(';');
}

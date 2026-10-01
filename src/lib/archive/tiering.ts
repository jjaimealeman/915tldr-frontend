// 05-01 Task 1 (tracer, minimal — completed in Task 2): pure tiering rules for the archive tier.
// D-08: a tag stays static only if it has HOT_TAG_MIN_ARTICLES (10) or more public articles — all
// other tags render to R2. REND-10's age-based fallback cutoff (D-07) floors "now" to a UTC day
// boundary so every route in one build agrees on the same cutoff epoch.
//
// Imports only node built-ins (none needed) — never the D1/KV chokepoint directory
// (`tools/assert-no-d1.mjs`'s FORBIDDEN_TARGET_DIR, `src/lib/server/`). This module is pure and
// side-effect-free, same module-boundary discipline as `src/lib/article-redirect.ts`.

export const HOT_TAG_MIN_ARTICLES = 10; // D-08
export const SECONDS_PER_DAY = 86_400;

/** D-08: a tag is static (hot) only once it reaches HOT_TAG_MIN_ARTICLES. Inclusive at the
 * threshold — exactly 10 is hot. */
export function isHotTag(count: number): boolean {
  return count >= HOT_TAG_MIN_ARTICLES;
}

/** Floors `nowEpoch` to a UTC day boundary before subtracting `days` days, so every route in one
 * build agrees on the same cutoff regardless of the exact second each one calls this. */
export function hotCutoffEpoch(nowEpoch: number, days: number): number {
  const dayFloor = Math.floor(nowEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return dayFloor - days * SECONDS_PER_DAY;
}

/** Inclusive at the cutoff — an article published exactly at `cutoffEpoch` is hot. */
export function isHotArticle(publishedAt: number, cutoffEpoch: number): boolean {
  return publishedAt >= cutoffEpoch;
}

export interface ArticleTierInput {
  publishedAt: number;
}

export interface TagTierInput {
  count: number;
}

export interface TierSplit<T> {
  hot: T[];
  archive: T[];
}

/** Partitions article tier facts into hot/archive by `isHotArticle`. Every input lands in exactly
 * one list. */
export function classifyArticles<T extends ArticleTierInput>(
  facts: T[],
  cutoffEpoch: number
): TierSplit<T> {
  const hot: T[] = [];
  const archive: T[] = [];
  for (const fact of facts) {
    (isHotArticle(fact.publishedAt, cutoffEpoch) ? hot : archive).push(fact);
  }
  return { hot, archive };
}

/** Partitions tag tier facts into hot/archive by `isHotTag`. Every input lands in exactly one
 * list. */
export function classifyTags<T extends TagTierInput>(facts: T[]): TierSplit<T> {
  const hot: T[] = [];
  const archive: T[] = [];
  for (const fact of facts) {
    (isHotTag(fact.count) ? hot : archive).push(fact);
  }
  return { hot, archive };
}

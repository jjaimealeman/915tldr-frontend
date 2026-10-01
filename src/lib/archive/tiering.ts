// 05-01: pure tiering rules for the archive tier.
// D-08: a tag stays static only if it has HOT_TAG_MIN_ARTICLES (10) or more public articles — all
// other tags render to R2. REND-10's age-based fallback cutoff (D-07) floors "now" to a UTC day
// boundary so every route in one build agrees on the same cutoff epoch.
//
// No imports from the D1/KV chokepoint directory (`tools/assert-no-d1.mjs`'s
// FORBIDDEN_TARGET_DIR, `src/lib/server/`) — this module is pure and side-effect-free, same
// module-boundary discipline as `src/lib/article-redirect.ts`. Every thrown message is prefixed
// `tiering:` (the convention `tools/ci-build.mjs`'s `classifyFailure` anchors on) — the
// convention `tools/tier-report.mjs` and every caller rely on to fail loud, never silently
// coerce a malformed count/date into a default classification.

export const HOT_TAG_MIN_ARTICLES = 10; // D-08
export const SECONDS_PER_DAY = 86_400;

function fail(message: string): never {
  throw new Error(`tiering: ${message}`);
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value;
}

/** D-08: a tag is static (hot) only once it reaches HOT_TAG_MIN_ARTICLES. Inclusive at the
 * threshold — exactly 10 is hot. `count` must be a positive integer (a tag with zero public
 * articles never gets a page per `src/lib/listing.ts`'s `groupByTag`, so 0 here is invalid
 * input, not a valid archive-tier count) — anything else throws. */
export function isHotTag(count: number): boolean {
  assertPositiveInteger(count, 'tag article count');
  return count >= HOT_TAG_MIN_ARTICLES;
}

/** Floors `nowEpoch` to a UTC day boundary before subtracting `days` days, so every route in one
 * build agrees on the same cutoff regardless of the exact second each one calls this. */
export function hotCutoffEpoch(nowEpoch: number, days: number): number {
  if (typeof nowEpoch !== 'number' || !Number.isFinite(nowEpoch)) {
    fail(`invalid nowEpoch: ${JSON.stringify(nowEpoch)}`);
  }
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    fail(`invalid days: ${JSON.stringify(days)}`);
  }
  const dayFloor = Math.floor(nowEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  return dayFloor - days * SECONDS_PER_DAY;
}

/** Inclusive at the cutoff — an article published exactly at `cutoffEpoch` is hot.
 * `publishedAt` must be an integer (epoch seconds, per the loader's `articleSchema`) — anything
 * else throws. */
export function isHotArticle(publishedAt: number, cutoffEpoch: number): boolean {
  if (typeof publishedAt !== 'number' || !Number.isInteger(publishedAt)) {
    fail(`invalid publishedAt: ${JSON.stringify(publishedAt)}`);
  }
  if (typeof cutoffEpoch !== 'number' || !Number.isFinite(cutoffEpoch)) {
    fail(`invalid cutoffEpoch: ${JSON.stringify(cutoffEpoch)}`);
  }
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
  facts: readonly T[],
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
export function classifyTags<T extends TagTierInput>(facts: readonly T[]): TierSplit<T> {
  const hot: T[] = [];
  const archive: T[] = [];
  for (const fact of facts) {
    (isHotTag(fact.count) ? hot : archive).push(fact);
  }
  return { hot, archive };
}

export interface ProjectStaticCountInput {
  articleFacts: readonly ArticleTierInput[];
  tagFacts: readonly TagTierInput[];
  days: number;
  nowEpoch: number;
  otherFiles: number;
}

export interface ProjectStaticCountResult {
  hotArticles: number;
  staticTags: number;
  otherFiles: number;
  /** hotArticles + staticTags + otherFiles — today's projected static-file count under this
   * candidate window. */
  total: number;
  /** 2*(hotArticles+staticTags) + otherFiles — the Phase 6 (Spanish) projection: articles and
   * tags double (English + Spanish counterparts), other files are unaffected. The shared
   * projection 05-05 uses for its file-budget cap. */
  phase6Total: number;
}

/** Projects the static-file count under a candidate hot window — the shared projection 05-05's
 * file-budget cap uses. */
export function projectStaticCount(input: ProjectStaticCountInput): ProjectStaticCountResult {
  const { articleFacts, tagFacts, days, nowEpoch, otherFiles } = input;
  if (typeof otherFiles !== 'number' || !Number.isInteger(otherFiles) || otherFiles < 0) {
    fail(`invalid otherFiles: ${JSON.stringify(otherFiles)}`);
  }
  const cutoffEpoch = hotCutoffEpoch(nowEpoch, days);
  const hotArticles = classifyArticles(articleFacts, cutoffEpoch).hot.length;
  const staticTags = classifyTags(tagFacts).hot.length;
  const total = hotArticles + staticTags + otherFiles;
  const phase6Total = 2 * (hotArticles + staticTags) + otherFiles;
  return { hotArticles, staticTags, otherFiles, total, phase6Total };
}

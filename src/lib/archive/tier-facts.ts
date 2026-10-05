// 05-01 Task 1: build-time "tier facts" — one entry per public article and one per tag page,
// written by `src/pages/[category]/[slug].astro` and `src/pages/tag/[slug].astro`'s own
// `getStaticPaths()` on every build, and read back by `tools/tier-report.mjs` (and later plans)
// so tiering decisions never need a second D1 read. `.astro/` is gitignored — these are
// build-time scratch artifacts, never committed, same pattern as `.astro/tag-build-log.json`.
//
// Every entry is re-validated on read (T-05-01): a malformed uuid/slug/path can never pass
// through `readTierFacts` into a downstream tiering decision.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TAG_SLUG_RE, UUID_RE } from '../article-url.ts';

export const ARTICLE_FACTS_PATH = '.astro/tier-facts-articles.json';
export const TAG_FACTS_PATH = '.astro/tier-facts-tags.json';
// 06-04: Spanish counterparts, written by the (later, 06-09) /es routes' own getStaticPaths().
// Absent entirely until those routes exist — readTierFacts() below treats a missing Spanish
// facts file as an empty list, not an error, so this module and partition-archive.mjs keep
// working in every build between this plan and 06-09/06-10.
export const ARTICLE_FACTS_ES_PATH = '.astro/tier-facts-articles-es.json';
export const TAG_FACTS_ES_PATH = '.astro/tier-facts-tags-es.json';

export interface ArticleTierFact {
  uuid: string;
  path: string;
  publishedAt: number;
}

/** The Spanish counterpart of `ArticleTierFact` — same shape plus `translated`: whether this
 * `/es` page is a real Spanish translation or an untranslated English-fallback page served under
 * `/es` (06-09 writes this flag; 06-11's Spanish sitemap excludes untranslated fallback pages
 * using it). `path` must be a `/es/`-prefixed path ending in its own `uuid` — validated the same
 * way as `ArticleTierFact.path`, plus the `/es/` prefix check. */
export interface ArticleTierFactEs extends ArticleTierFact {
  translated: boolean;
}

export interface TagTierFact {
  slug: string;
  count: number;
}

/** Same shape as `TagTierFact` — a Spanish tag fact carries no extra field (unlike
 * `ArticleTierFactEs`'s `translated`), since a tag page has no single "is this translated"
 * question the way one article does. */
export type TagTierFactEs = TagTierFact;

export interface TierFacts {
  articles: ArticleTierFact[];
  tags: TagTierFact[];
  /** `[]` when `ARTICLE_FACTS_ES_PATH` does not exist (no `/es` routes built yet this phase) —
   * never an error, unlike the English facts files which are required. */
  articlesEs: ArticleTierFactEs[];
  /** `[]` when `TAG_FACTS_ES_PATH` does not exist — see `articlesEs`. */
  tagsEs: TagTierFactEs[];
}

function fail(message: string): never {
  throw new Error(`tier-facts: ${message}`);
}

function writeFacts(path: string, entries: readonly unknown[]): void {
  mkdirSync('.astro', { recursive: true });
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), entries }));
}

/** Writes `.astro/tier-facts-articles.json` — one entry per public article, `{ uuid, path,
 * publishedAt }`. Called once per build from `[category]/[slug].astro`'s `getStaticPaths()`. */
export function writeArticleFacts(entries: readonly ArticleTierFact[]): void {
  writeFacts(ARTICLE_FACTS_PATH, entries);
}

/** Writes `.astro/tier-facts-tags.json` — one entry per tag page, `{ slug, count }`, `count`
 * being the FULL uncapped article count (D-08 precision), never the page's capped card count.
 * Called once per build from `tag/[slug].astro`'s `getStaticPaths()`. */
export function writeTagFacts(entries: readonly TagTierFact[]): void {
  writeFacts(TAG_FACTS_PATH, entries);
}

/** Writes `.astro/tier-facts-articles-es.json` — the Spanish counterpart of
 * `writeArticleFacts`, same file shape, called once per build from the (06-09) `/es` article
 * route's `getStaticPaths()`. */
export function writeArticleFactsEs(entries: readonly ArticleTierFactEs[]): void {
  writeFacts(ARTICLE_FACTS_ES_PATH, entries);
}

/** Writes `.astro/tier-facts-tags-es.json` — the Spanish counterpart of `writeTagFacts`. */
export function writeTagFactsEs(entries: readonly TagTierFactEs[]): void {
  writeFacts(TAG_FACTS_ES_PATH, entries);
}

function parseFactsFileContents(path: string, raw: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as Record<string, unknown>).entries)
  ) {
    fail(`${path} must be an object with an "entries" array`);
  }
  return (parsed as Record<string, unknown>).entries as unknown[];
}

function readFactsFile(path: string): unknown[] {
  const absPath = resolve(process.cwd(), path);
  if (!existsSync(absPath)) {
    fail(`missing facts file: ${path} — run \`pnpm run build\` first`);
  }
  return parseFactsFileContents(path, readFileSync(absPath, 'utf8'));
}

/** Same as `readFactsFile`, but a missing file is a valid "no Spanish facts yet" state — returns
 * `[]` rather than failing. A present-but-malformed file still fails loud exactly like the
 * English facts files do. */
function readFactsFileOptional(path: string): unknown[] {
  const absPath = resolve(process.cwd(), path);
  if (!existsSync(absPath)) return [];
  return parseFactsFileContents(path, readFileSync(absPath, 'utf8'));
}

function validateArticleFact(raw: unknown, index: number): ArticleTierFact {
  if (!raw || typeof raw !== 'object') fail(`article fact at index ${index} is not an object`);
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.uuid !== 'string' || !UUID_RE.test(candidate.uuid)) {
    fail(`article fact at index ${index} has an invalid uuid: ${JSON.stringify(candidate.uuid)}`);
  }
  if (
    typeof candidate.path !== 'string' ||
    !candidate.path.startsWith('/') ||
    !candidate.path.endsWith(candidate.uuid)
  ) {
    fail(`article fact at index ${index} has an invalid path: ${JSON.stringify(candidate.path)}`);
  }
  if (
    typeof candidate.publishedAt !== 'number' ||
    !Number.isInteger(candidate.publishedAt) ||
    candidate.publishedAt <= 0
  ) {
    fail(
      `article fact at index ${index} has an invalid publishedAt: ${JSON.stringify(candidate.publishedAt)}`
    );
  }
  return { uuid: candidate.uuid, path: candidate.path, publishedAt: candidate.publishedAt };
}

/** Spanish validation = English validation (`validateArticleFact`) plus `path.startsWith('/es/')`
 * and a required boolean `translated` — a Spanish fact that isn't actually `/es`-prefixed, or
 * omits/misshapes `translated`, is new data and must fail loud, never be coerced. */
function validateArticleFactEs(raw: unknown, index: number): ArticleTierFactEs {
  if (!raw || typeof raw !== 'object') fail(`Spanish article fact at index ${index} is not an object`);
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.uuid !== 'string' || !UUID_RE.test(candidate.uuid)) {
    fail(`Spanish article fact at index ${index} has an invalid uuid: ${JSON.stringify(candidate.uuid)}`);
  }
  if (
    typeof candidate.path !== 'string' ||
    !candidate.path.startsWith('/es/') ||
    !candidate.path.endsWith(candidate.uuid)
  ) {
    fail(
      `Spanish article fact at index ${index} has an invalid path: ${JSON.stringify(candidate.path)}`
    );
  }
  if (
    typeof candidate.publishedAt !== 'number' ||
    !Number.isInteger(candidate.publishedAt) ||
    candidate.publishedAt <= 0
  ) {
    fail(
      `Spanish article fact at index ${index} has an invalid publishedAt: ${JSON.stringify(candidate.publishedAt)}`
    );
  }
  if (typeof candidate.translated !== 'boolean') {
    fail(
      `Spanish article fact at index ${index} has an invalid translated: ${JSON.stringify(candidate.translated)}`
    );
  }
  return {
    uuid: candidate.uuid,
    path: candidate.path,
    publishedAt: candidate.publishedAt,
    translated: candidate.translated,
  };
}

function validateTagFact(raw: unknown, index: number): TagTierFact {
  if (!raw || typeof raw !== 'object') fail(`tag fact at index ${index} is not an object`);
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.slug !== 'string' || !TAG_SLUG_RE.test(candidate.slug)) {
    fail(`tag fact at index ${index} has an invalid slug: ${JSON.stringify(candidate.slug)}`);
  }
  if (typeof candidate.count !== 'number' || !Number.isInteger(candidate.count) || candidate.count <= 0) {
    fail(`tag fact at index ${index} has an invalid count: ${JSON.stringify(candidate.count)}`);
  }
  return { slug: candidate.slug, count: candidate.count };
}

/** Reads and re-validates both English facts files (required — missing/malformed throws) and
 * both Spanish facts files (optional — missing is `[]`, present-but-malformed still throws).
 * Throws `tier-facts: ...` on any validation failure — never returns a partial or coerced
 * result. */
export function readTierFacts(): TierFacts {
  const articleRaw = readFactsFile(ARTICLE_FACTS_PATH);
  const tagRaw = readFactsFile(TAG_FACTS_PATH);
  const articleEsRaw = readFactsFileOptional(ARTICLE_FACTS_ES_PATH);
  const tagEsRaw = readFactsFileOptional(TAG_FACTS_ES_PATH);
  return {
    articles: articleRaw.map((entry, index) => validateArticleFact(entry, index)),
    tags: tagRaw.map((entry, index) => validateTagFact(entry, index)),
    articlesEs: articleEsRaw.map((entry, index) => validateArticleFactEs(entry, index)),
    tagsEs: tagEsRaw.map((entry, index) => validateTagFact(entry, index)),
  };
}

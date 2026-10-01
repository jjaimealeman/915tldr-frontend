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

export interface ArticleTierFact {
  uuid: string;
  path: string;
  publishedAt: number;
}

export interface TagTierFact {
  slug: string;
  count: number;
}

export interface TierFacts {
  articles: ArticleTierFact[];
  tags: TagTierFact[];
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

function readFactsFile(path: string): unknown[] {
  const absPath = resolve(process.cwd(), path);
  if (!existsSync(absPath)) {
    fail(`missing facts file: ${path} — run \`pnpm run build\` first`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absPath, 'utf8'));
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

/** Reads and re-validates both facts files. Throws `tier-facts: ...` if either file is missing,
 * malformed, or any entry fails validation — never returns a partial or coerced result. */
export function readTierFacts(): TierFacts {
  const articleRaw = readFactsFile(ARTICLE_FACTS_PATH);
  const tagRaw = readFactsFile(TAG_FACTS_PATH);
  return {
    articles: articleRaw.map((entry, index) => validateArticleFact(entry, index)),
    tags: tagRaw.map((entry, index) => validateTagFact(entry, index)),
  };
}

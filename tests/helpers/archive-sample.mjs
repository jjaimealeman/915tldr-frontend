// 05-11 Task 1: samples real archived articles/tags from the LOCAL build's own
// `dist/archive-plan.json` (tools/partition-archive.mjs's output) for the live URL-contract and
// browser-journey suites to exercise against the deployed site. Discovery, not fixtures — every
// path returned here is a real canonical path the deployed Worker should be able to serve from
// R2, sampled with a safety margin from the tier boundaries so build-to-build drift between this
// local build and the live one (ingest runs every ~2h) can never put a sampled URL on the wrong
// side of the hot/archive cutoff.
//
// `dist/archive-plan.json` only carries the archived subset's {kind, key, path, sourceRel,
// sha256, bytes} — no publishedAt/count. Age and tag-article-count come from the two
// `.astro/tier-facts-*.json` files `tools/partition-archive.mjs` itself reads from
// (src/lib/archive/tier-facts.ts) — read independently here (not re-exported by the plan file)
// because the plan intentionally strips them once partitioning decides.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEFAULT_ARCHIVE_PLAN_PATH = 'dist/archive-plan.json';
const DEFAULT_ARTICLE_FACTS_PATH = '.astro/tier-facts-articles.json';
const DEFAULT_TAG_FACTS_PATH = '.astro/tier-facts-tags.json';

const SECONDS_PER_DAY = 86400;

/** Matches the `articles/<uuid>.html` key shape `tools/partition-archive.mjs` writes. */
const ARTICLE_KEY_UUID_RE =
  /^articles\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

function fail(message) {
  throw new Error(`archive-sample: ${message}`);
}

function readJsonFile(relPath) {
  const abs = resolve(process.cwd(), relPath);
  if (!existsSync(abs)) {
    fail(`missing ${relPath} — run \`pnpm run build\` (of the deployed commit) first`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    fail(`${relPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parsed;
}

/**
 * Loads and minimally validates `dist/archive-plan.json`. Throws a clear, actionable message
 * (never a bare `ENOENT`) when the file is missing — this is the file `tools/
 * partition-archive.mjs` writes at the end of `pnpm run build`, and its absence always means
 * "no local build has run yet", not a transient fluke worth retrying.
 */
export function loadArchivePlan(path = DEFAULT_ARCHIVE_PLAN_PATH) {
  const plan = readJsonFile(path);
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.entries)) {
    fail(`${path} must be an object with an "entries" array`);
  }
  if (typeof plan.cutoffEpoch !== 'number') {
    fail(`${path} must carry a numeric cutoffEpoch (tools/partition-archive.mjs always writes one)`);
  }
  return plan;
}

/**
 * Picks up to `n` archived articles whose `publishedAt` sits at least `marginDays` on the
 * archive side of the plan's own `cutoffEpoch` — a safety margin against an article that drifted
 * across the hot/archive boundary between this local build and whatever the live site is
 * currently serving. Deterministic order (ascending by uuid, matching `dist/archive-plan.json`'s
 * own entry order). Each returned item carries `{ uuid, path, key, sha256, bytes, publishedAt }`.
 */
export function pickArchivedArticles(
  plan,
  n,
  { marginDays = 2, articleFactsPath = DEFAULT_ARTICLE_FACTS_PATH } = {}
) {
  if (!plan || !Array.isArray(plan.entries)) fail('pickArchivedArticles requires a loaded plan');
  if (typeof n !== 'number' || n < 0) fail(`pickArchivedArticles: n must be a non-negative number, got ${n}`);

  const factsRaw = readJsonFile(articleFactsPath);
  if (!factsRaw || !Array.isArray(factsRaw.entries)) {
    fail(`${articleFactsPath} must be an object with an "entries" array`);
  }
  const publishedByUuid = new Map(factsRaw.entries.map((entry) => [entry.uuid, entry.publishedAt]));

  const marginSeconds = marginDays * SECONDS_PER_DAY;
  const archiveSideBeforeEpoch = plan.cutoffEpoch - marginSeconds;

  const candidates = [];
  for (const entry of plan.entries) {
    if (entry.kind !== 'article') continue;
    const match = ARTICLE_KEY_UUID_RE.exec(entry.key);
    if (!match) continue;
    const uuid = match[1];
    const publishedAt = publishedByUuid.get(uuid);
    if (typeof publishedAt !== 'number') continue;
    if (publishedAt > archiveSideBeforeEpoch) continue; // too close to the boundary — skip
    candidates.push({
      uuid,
      path: entry.path,
      key: entry.key,
      sha256: entry.sha256,
      bytes: entry.bytes,
      publishedAt,
    });
  }

  if (candidates.length < n) {
    fail(
      `requested ${n} archived articles at least ${marginDays}d past the cutoff, but only found ${candidates.length} — is the local build stale or the hot window unusually wide?`
    );
  }

  return candidates.slice(0, n);
}

/**
 * Picks up to `n` archived tags whose FULL uncapped article count (from `.astro/
 * tier-facts-tags.json`, not the plan file) is at most `maxCount` — a small tag is the safety
 * margin here: a tag sitting right at the archive-tag boundary could gain one more article
 * between this local build and the live deploy and flip to hot. Deterministic order (ascending
 * by slug). Each returned item carries `{ slug, path, key, count }`.
 */
export function pickArchivedTags(plan, n, { maxCount = 5, tagFactsPath = DEFAULT_TAG_FACTS_PATH } = {}) {
  if (!plan || !Array.isArray(plan.entries)) fail('pickArchivedTags requires a loaded plan');
  if (typeof n !== 'number' || n < 0) fail(`pickArchivedTags: n must be a non-negative number, got ${n}`);

  const factsRaw = readJsonFile(tagFactsPath);
  if (!factsRaw || !Array.isArray(factsRaw.entries)) {
    fail(`${tagFactsPath} must be an object with an "entries" array`);
  }
  const countBySlug = new Map(factsRaw.entries.map((entry) => [entry.slug, entry.count]));

  const candidates = [];
  for (const entry of plan.entries) {
    if (entry.kind !== 'tag') continue;
    const slug = entry.path.replace(/^\/tag\//, '');
    const count = countBySlug.get(slug);
    if (typeof count !== 'number') continue;
    if (count > maxCount) continue;
    candidates.push({ slug, path: entry.path, key: entry.key, count });
  }

  candidates.sort((a, b) => a.slug.localeCompare(b.slug));

  if (candidates.length < n) {
    fail(
      `requested ${n} archived tags with count <= ${maxCount}, but only found ${candidates.length}`
    );
  }

  return candidates.slice(0, n);
}

/**
 * Returns a `Set` of every archived article's uuid (all of `plan.entries` where `kind ===
 * 'article'`). `tests/integration/browser-journeys.test.mjs` uses this to confirm a tag page's
 * listed article card actually lands on archived content before clicking it — a small/old tag
 * does not guarantee every article carrying it is itself archived (tag archival is driven by the
 * tag's total lifetime article count, article archival by the article's own publish date).
 */
export function archivedArticleUuids(plan) {
  if (!plan || !Array.isArray(plan.entries)) fail('archivedArticleUuids requires a loaded plan');
  const uuids = new Set();
  for (const entry of plan.entries) {
    if (entry.kind !== 'article') continue;
    const match = ARTICLE_KEY_UUID_RE.exec(entry.key);
    if (match) uuids.add(match[1]);
  }
  return uuids;
}

/**
 * Returns a `Set` of every archived tag's slug (all of `plan.entries` where `kind === 'tag'` —
 * the plan file only ever lists the archived subset, by construction). `tests/integration/
 * browser-journeys.test.mjs` uses this to find a HOT article that happens to carry at least one
 * archived tag, by intersecting this set against a real article page's own rendered tag links —
 * cheap and reusable since it's a pure read of data this module already validated.
 */
export function archivedTagSlugs(plan) {
  if (!plan || !Array.isArray(plan.entries)) fail('archivedTagSlugs requires a loaded plan');
  return new Set(
    plan.entries.filter((entry) => entry.kind === 'tag').map((entry) => entry.path.replace(/^\/tag\//, ''))
  );
}

/**
 * Picks up to `n` HOT (static, never archived) articles — the most-recently-published ones
 * (descending `publishedAt`), for comparing against archived pages (TTFB, LCP). Reads `.astro/
 * tier-facts-articles.json` directly (every public article, not just the archived subset) and
 * excludes anything `archivedArticleUuids(plan)` already claims. Each returned item carries
 * `{ uuid, path, publishedAt }`.
 */
export function pickHotArticles(plan, n, { articleFactsPath = DEFAULT_ARTICLE_FACTS_PATH } = {}) {
  if (!plan || !Array.isArray(plan.entries)) fail('pickHotArticles requires a loaded plan');
  if (typeof n !== 'number' || n < 0) fail(`pickHotArticles: n must be a non-negative number, got ${n}`);

  const factsRaw = readJsonFile(articleFactsPath);
  if (!factsRaw || !Array.isArray(factsRaw.entries)) {
    fail(`${articleFactsPath} must be an object with an "entries" array`);
  }

  const archivedUuids = archivedArticleUuids(plan);
  const candidates = factsRaw.entries
    .filter((entry) => !archivedUuids.has(entry.uuid))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map((entry) => ({ uuid: entry.uuid, path: entry.path, publishedAt: entry.publishedAt }));

  if (candidates.length < n) {
    fail(`requested ${n} hot articles, but only found ${candidates.length}`);
  }

  return candidates.slice(0, n);
}

/**
 * Picks one STATIC (hot, never archived) tag with at least `minCount` articles — the counterpart
 * `url-shapes.test.mjs` needs to compare an archived tag's `/`-suffix and `.html`-suffix redirect
 * shape against a known-static tag's own. A tag qualifies when it has a real article count (from
 * `.astro/tier-facts-tags.json`) but is NOT present in the plan's own archived-tag entries.
 * Deterministic (first match, ascending by slug).
 */
export function pickStaticTag(plan, { minCount = 25, tagFactsPath = DEFAULT_TAG_FACTS_PATH } = {}) {
  if (!plan || !Array.isArray(plan.entries)) fail('pickStaticTag requires a loaded plan');

  const factsRaw = readJsonFile(tagFactsPath);
  if (!factsRaw || !Array.isArray(factsRaw.entries)) {
    fail(`${tagFactsPath} must be an object with an "entries" array`);
  }

  const archivedSlugs = new Set(
    plan.entries.filter((entry) => entry.kind === 'tag').map((entry) => entry.path.replace(/^\/tag\//, ''))
  );

  const candidates = factsRaw.entries
    .filter((entry) => entry.count >= minCount && !archivedSlugs.has(entry.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (candidates.length === 0) {
    fail(`no static (non-archived) tag found with count >= ${minCount}`);
  }

  const chosen = candidates[0];
  return { slug: chosen.slug, path: `/tag/${chosen.slug}`, count: chosen.count };
}

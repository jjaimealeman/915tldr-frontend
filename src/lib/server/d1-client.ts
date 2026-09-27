// ARCH-02 / D-05: the single module in this repository permitted to read Cloudflare D1.
// Everything downstream (pages, the render manifest) consumes what this module returns — never
// the D1 REST API directly — so `tools/assert-no-d1.mjs`'s module-graph walk only has to answer
// one question: does any public entrypoint's graph reach this file (Pattern 2, 03-RESEARCH.md).
//
// Build-time only. Runs in Node during `astro build`, never inside the deployed Worker — this
// app's `wrangler.jsonc` declares no `d1_databases` binding at all, so `env.DB` is structurally
// undefined at runtime even if this module were somehow reached.
//
// Credential handling follows OPS-11 (Phase 2 precedent, 915tldr.com2/docs/phase-02/d1-access.md):
// both env vars are read from `process.env` only, never logged, never written to a file, and
// never included in an error message.

const D1_DATABASE_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77';

/**
 * `id` here is `articles.uuid` (TEXT), not the internal `articles.id` (INTEGER PK) — the uuid is
 * what `.claude/CLAUDE.md`'s preserved URL scheme (`/[category]/[slug]-[uuid]`) and the D-03 KV
 * manifest key (`manifest:<uuid>`) both need. `category`/`tags` do not exist as columns on
 * `articles` — this is a real schema finding from this task's own tracer run against production
 * D1, not in 03-RESEARCH.md/03-CONTEXT.md, which assumed flat columns. Production stores them in
 * join tables (`article_categories`→`categories`, `article_tags`→`tags`); see the query below.
 * `published_at` is epoch seconds (INTEGER), not an ISO string.
 */
export interface ArticleRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  published_at: number;
  tags: string;
  status: string;
}

interface D1QueryResponse<T> {
  result?: Array<{ success: boolean; results: T[]; meta?: { rows_read?: number } }>;
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`d1-client: ${name} is not set in the environment`);
  }
  return value;
}

export interface D1QueryWithMetaResult<T> {
  results: T[];
  rowsRead: number;
}

/**
 * Runs one parameterised SQL statement against production D1 over the Cloudflare REST API and
 * returns the D1-reported `meta.rows_read` alongside the results — the budget signal PROJECT.md's
 * daily read-budget lines depend on. Throws on a non-2xx response, a `success: false` body, or a
 * response missing `meta.rows_read` (a read this module cannot account for is treated the same as
 * a failed read) rather than returning an empty array — a silent empty/unaccounted read here is
 * precisely the `/changelog` empty-state defect (REND-02/03) and must not be born again in this
 * module. `opts.fetchImpl` exists only so tests can inject a stubbed transport.
 */
export async function queryD1WithMeta<T = unknown>(
  sql: string,
  params: unknown[] = [],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<D1QueryWithMetaResult<T>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requireEnv('CLOUDFLARE_API_TOKEN');

  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`d1-client: D1 REST API responded ${response.status} ${response.statusText}: ${text}`);
  }

  const body = (await response.json()) as D1QueryResponse<T>;

  if (!body.success || !body.result?.[0]?.success) {
    const message = body.errors?.map((e) => e.message).join('; ') || 'unknown D1 error';
    throw new Error(`d1-client: D1 query failed: ${message}`);
  }

  const rowsRead = body.result[0].meta?.rows_read;
  if (typeof rowsRead !== 'number') {
    throw new Error(
      'd1-client: D1 query response is missing meta.rows_read — cannot account for the read budget'
    );
  }

  return { results: body.result[0].results ?? [], rowsRead };
}

/**
 * Delegates to `queryD1WithMeta`, discarding `rowsRead` — kept for call sites that only need the
 * rows themselves. Identical throw behaviour (non-2xx, `success: false`, or missing
 * `meta.rows_read` all throw; never a silent empty array).
 */
export async function queryD1<T = unknown>(
  sql: string,
  params: unknown[] = [],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<T[]> {
  const { results } = await queryD1WithMeta<T>(sql, params, opts);
  return results;
}

/** D1's documented maximum bound parameters per statement — verified empirically 2026-09-15
 * (100 succeeds, 101 fails with `SQLITE_ERROR`; `.claude/CLAUDE.md`). Every IN-list statement in
 * this module binds at most this many parameters per request. */
export const D1_MAX_BOUND_PARAMS = 100;

/** Splits `ids` into chunks of at most `size` (default `D1_MAX_BOUND_PARAMS`) items each, for
 * building `IN (...)` statements that never exceed D1's bound-parameter ceiling. */
export function chunkIds<T>(ids: T[], size: number = D1_MAX_BOUND_PARAMS): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

// `a.id` (INTEGER) drives the joins; `a.uuid` is exposed as `id` in the result set (see
// ArticleRow's doc comment). Primary category only (`ac.is_primary = 1`) — an article can carry
// more than one category row, and D-04's denormalised `category` field is singular. Tags are
// aggregated into one comma-joined string via a correlated subquery rather than a second
// top-level join, so the LEFT JOIN cardinality on `article_categories`/`categories` stays 1:1
// per article and `LIMIT 1` keeps meaning "one article row", not "one article-category pair".
const ARTICLE_SELECT = `
  SELECT
    a.uuid AS id,
    a.title,
    a.summary,
    c.slug AS category,
    a.published_at,
    (
      SELECT GROUP_CONCAT(t.name, ',')
      FROM article_tags atg
      JOIN tags t ON t.id = atg.tag_id
      WHERE atg.article_id = a.id
    ) AS tags,
    a.status
  FROM articles a
  LEFT JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1
  LEFT JOIN categories c ON c.id = ac.category_id
`;

/**
 * The most recently published, fully processed, categorised article. Powers the tracer slice
 * (D-02). Requires a resolved primary category (`c.slug IS NOT NULL`) — D-04's manifest schema
 * denormalises `category`, so a tracer row without one would ship a manifest entry violating its
 * own schema.
 */
export async function fetchLatestArticle(): Promise<ArticleRow | null> {
  const rows = await queryD1<ArticleRow>(
    `${ARTICLE_SELECT} WHERE a.status = ? AND c.slug IS NOT NULL ORDER BY a.published_at DESC LIMIT 1`,
    ['processed']
  );
  return rows[0] ?? null;
}

/** Fetch one article by its uuid — same column set as `fetchLatestArticle`. */
export async function fetchArticleById(uuid: string): Promise<ArticleRow | null> {
  const rows = await queryD1<ArticleRow>(`${ARTICLE_SELECT} WHERE a.uuid = ? LIMIT 1`, [uuid]);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// REND-01: the Content Layer loader's window fetch. Planner findings (04-01-PLAN.md
// <planner_findings>): the ARTICLE_SELECT shape above measured 11,466,920 rows read for one
// full-corpus pass (keyset) — 2.3x the daily hard-fail — because of its correlated tags subquery
// and per-row category LEFT JOIN. The bulk-fetch + in-memory-stitch shape below measured 957,008
// rows for the whole corpus (docs/phase-03/d1-pagination-report.md); this function is that same
// shape, scoped to a `published_at` window instead of the whole corpus. `article_categories` and
// `article_tags` have composite primary keys led by `article_id`, so the IN-list lookups below
// are indexed.
// ---------------------------------------------------------------------------

interface WindowArticleRow {
  id: number;
  uuid: string;
  title: string;
  slug: string;
  summary: string;
  key_points: string | null;
  url: string;
  published_at: number;
  source_id: number;
  status: string;
  is_duplicate: number;
}

interface CategoryJoinRow {
  article_id: number;
  slug: string;
  name: string;
}

interface TagJoinRow {
  article_id: number;
  slug: string;
  name: string;
}

interface SourceRow {
  id: number;
  slug: string;
  name: string;
  website_url: string;
}

export interface PublicArticle {
  uuid: string;
  title: string;
  slug: string;
  summary: string;
  keyPoints: string[] | null;
  url: string;
  publishedAt: number;
  category: { slug: string; name: string };
  tags: Array<{ slug: string; name: string }>;
  source: { slug: string; name: string; websiteUrl: string };
}

export type NonPublicReason = 'not-processed' | 'duplicate' | 'no-primary-category' | 'missing-summary';

export interface NonPublicArticle {
  uuid: string;
  reason: NonPublicReason;
}

export interface FetchPublicArticlesWindowResult {
  publicArticles: PublicArticle[];
  nonPublic: NonPublicArticle[];
  rowsRead: number;
}

/**
 * The stitching rules shared by every bulk-fetch/keyset/chunked-IN fetcher below: given raw
 * article rows plus their primary-category rows, tag rows and the (small, unpaginated) sources
 * table, classifies each article row as public or non-public and builds the denormalised
 * `PublicArticle` shape. Extracted from `fetchPublicArticlesWindow` (04-01) so the cold-path
 * fetchers (`fetchAllArticlesStitched`, `fetchArticlesStitchedByIds`) apply the EXACT same rules
 * as the steady-state window fetch — a fetcher-specific reimplementation here is exactly the kind
 * of drift that would let a cold build and a warm build silently disagree about what counts as
 * public. `tagRows` accepts any row shape carrying at least `article_id`/`slug`/`name` — the
 * cold-path tags query additionally selects `tag_id` (for keyset pagination) but that extra field
 * is irrelevant to stitching.
 */
export function stitchArticles(
  articleRows: WindowArticleRow[],
  categoryRows: CategoryJoinRow[],
  tagRows: Array<{ article_id: number; slug: string; name: string }>,
  sourceRows: SourceRow[]
): { publicArticles: PublicArticle[]; nonPublic: NonPublicArticle[] } {
  const categoryByArticleId = new Map<number, { slug: string; name: string }>();
  for (const row of categoryRows) {
    categoryByArticleId.set(row.article_id, { slug: row.slug, name: row.name });
  }

  const tagsByArticleId = new Map<number, Array<{ slug: string; name: string }>>();
  for (const row of tagRows) {
    const list = tagsByArticleId.get(row.article_id) ?? [];
    list.push({ slug: row.slug, name: row.name });
    tagsByArticleId.set(row.article_id, list);
  }

  const sourceById = new Map<number, { slug: string; name: string; websiteUrl: string }>();
  for (const row of sourceRows) {
    sourceById.set(row.id, { slug: row.slug, name: row.name, websiteUrl: row.website_url });
  }

  const publicArticles: PublicArticle[] = [];
  const nonPublic: NonPublicArticle[] = [];

  for (const row of articleRows) {
    if (row.status !== 'processed') {
      nonPublic.push({ uuid: row.uuid, reason: 'not-processed' });
      continue;
    }
    if (row.is_duplicate) {
      nonPublic.push({ uuid: row.uuid, reason: 'duplicate' });
      continue;
    }
    const category = categoryByArticleId.get(row.id);
    if (!category) {
      nonPublic.push({ uuid: row.uuid, reason: 'no-primary-category' });
      continue;
    }

    // Rule 1/2 fix (04-03 Task 2): discovered via a real cold-path build against the full
    // production corpus — 140 of ~40,183 public-status rows have a NULL or empty `summary`
    // (legacy content-pipeline gap, not something this loader can fix). The 04-01/04-02
    // window-scoped fetch never reached these older rows, so this was invisible until the
    // full-corpus fetcher (fetchAllArticlesStitched, this same stitchArticles function) did.
    // Treated exactly like `no-primary-category` — an explained non-public exclusion, not a
    // build-crashing schema violation, so 140 known-bad legacy rows don't block the entire
    // corpus from building.
    if (!row.summary || row.summary.trim().length === 0) {
      nonPublic.push({ uuid: row.uuid, reason: 'missing-summary' });
      continue;
    }

    let keyPoints: string[] | null = null;
    if (row.key_points !== null && row.key_points !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.key_points);
      } catch {
        throw new Error(
          `d1-client: article ${row.uuid} has key_points that is not valid JSON: ${JSON.stringify(row.key_points)}`
        );
      }
      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
        throw new Error(`d1-client: article ${row.uuid} has key_points that is not a JSON array of strings`);
      }
      keyPoints = parsed;
    }

    const source = sourceById.get(row.source_id);
    if (!source) {
      throw new Error(
        `d1-client: article ${row.uuid} references source_id ${row.source_id} with no matching sources row`
      );
    }

    const tags = (tagsByArticleId.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.slug.localeCompare(b.slug));

    publicArticles.push({
      uuid: row.uuid,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      keyPoints,
      url: row.url,
      publishedAt: row.published_at,
      category,
      tags,
      source,
    });
  }

  return { publicArticles, nonPublic };
}

/**
 * v1's public listing filter (`915tldr.com2/server/api/articles/index.get.ts`):
 * `status = 'processed' AND is_duplicate = 0`, plus a resolved primary category (this loader's
 * own requirement — a public article with no category cannot build a canonical URL). Fetches all
 * article-shaped columns for rows published since `sinceEpoch` (epoch seconds), then bulk-fetches
 * primary categories and tags for those rows' internal ids (chunked at `D1_MAX_BOUND_PARAMS`) and
 * all sources, stitching everything in memory via `stitchArticles` — the same shape
 * docs/phase-03/d1-pagination-report.md measured at 957,008 rows for a full-corpus pass, here
 * scoped to a window. `opts.fetchImpl` is threaded through every call for test injection.
 */
export async function fetchPublicArticlesWindow(
  sinceEpoch: number,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<FetchPublicArticlesWindowResult> {
  let rowsRead = 0;

  const { results: articleRows, rowsRead: articlesRowsRead } = await queryD1WithMeta<WindowArticleRow>(
    `SELECT id, uuid, title, slug, summary, key_points, url, published_at, source_id, status, is_duplicate
     FROM articles
     WHERE published_at >= ?`,
    [sinceEpoch],
    opts
  );
  rowsRead += articlesRowsRead;

  const internalIds = articleRows.map((row) => row.id);

  const categoryRows: CategoryJoinRow[] = [];
  for (const idChunk of chunkIds(internalIds)) {
    if (idChunk.length === 0) continue;
    const placeholders = idChunk.map(() => '?').join(',');
    const { results, rowsRead: chunkRowsRead } = await queryD1WithMeta<CategoryJoinRow>(
      `SELECT ac.article_id AS article_id, c.slug AS slug, c.name AS name
       FROM article_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE ac.is_primary = 1 AND ac.article_id IN (${placeholders})`,
      idChunk,
      opts
    );
    rowsRead += chunkRowsRead;
    categoryRows.push(...results);
  }

  const tagRows: TagJoinRow[] = [];
  for (const idChunk of chunkIds(internalIds)) {
    if (idChunk.length === 0) continue;
    const placeholders = idChunk.map(() => '?').join(',');
    const { results, rowsRead: chunkRowsRead } = await queryD1WithMeta<TagJoinRow>(
      `SELECT atg.article_id AS article_id, t.slug AS slug, t.name AS name
       FROM article_tags atg
       JOIN tags t ON t.id = atg.tag_id
       WHERE atg.article_id IN (${placeholders})`,
      idChunk,
      opts
    );
    rowsRead += chunkRowsRead;
    tagRows.push(...results);
  }

  const { results: sourceRows, rowsRead: sourcesRowsRead } = await queryD1WithMeta<SourceRow>(
    `SELECT id, slug, name, website_url FROM sources`,
    [],
    opts
  );
  rowsRead += sourcesRowsRead;

  const { publicArticles, nonPublic } = stitchArticles(articleRows, categoryRows, tagRows, sourceRows);
  return { publicArticles, nonPublic, rowsRead };
}

// ---------------------------------------------------------------------------
// REND-01/02 (04-03): the cold-path fetchers. `fetchAllArticlesStitched` is the full-corpus bulk
// pass used on an empty store, a state-version bump, the 7-day cold resync, or ARTICLES_FORCE_COLD
// — it deliberately fetches EVERY article regardless of status (not just the window's
// `published_at`-filtered set), because a cold pass is also this loader's self-healing mechanism:
// a non-public row is only observed as an "explained removal" (D-14) if the cold pass actually
// reads it, classifies it non-public, and reports why. `fetchArticlesStitchedByIds` is the sweep
// path's re-fetch for a small, explicit id list (`fetchChangedSince`'s output). Both reuse
// `stitchArticles` — see its own doc comment for why that matters.
// ---------------------------------------------------------------------------

export interface FetchAllArticlesStitchedResult extends FetchPublicArticlesWindowResult {
  requestCount: number;
}

/**
 * Full-corpus bulk fetch, keyset-paginated at LIMIT 5000 per page (Phase 3's measured bulk-fetch
 * page size, docs/phase-03/d1-pagination-report.md) across all three tables independently:
 * `articles` keyed by `id`, primary `article_categories` keyed by `article_id`, and `article_tags`
 * keyed by the composite `(article_id, tag_id)` (a single integer cursor would skip or repeat rows
 * once an article has more than one tag). Every page request binds only its own cursor value(s) —
 * at most 2 params — never anywhere near `D1_MAX_BOUND_PARAMS`. `sources` is fetched once,
 * unpaginated (a handful of rows). `opts.fetchImpl` is threaded through every call for test
 * injection.
 */
export async function fetchAllArticlesStitched(
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<FetchAllArticlesStitchedResult> {
  let rowsRead = 0;
  let requestCount = 0;

  const articleRows: WindowArticleRow[] = [];
  let articleCursor = 0;
  for (;;) {
    const { results, rowsRead: pageRowsRead } = await queryD1WithMeta<WindowArticleRow>(
      `SELECT id, uuid, title, slug, summary, key_points, url, published_at, source_id, status, is_duplicate
       FROM articles
       WHERE id > ?
       ORDER BY id
       LIMIT 5000`,
      [articleCursor],
      opts
    );
    rowsRead += pageRowsRead;
    requestCount += 1;
    articleRows.push(...results);
    if (results.length === 0) break;
    articleCursor = results[results.length - 1].id;
    if (results.length < 5000) break;
  }

  const categoryRows: CategoryJoinRow[] = [];
  let categoryCursor = 0;
  for (;;) {
    const { results, rowsRead: pageRowsRead } = await queryD1WithMeta<CategoryJoinRow>(
      `SELECT ac.article_id AS article_id, c.slug AS slug, c.name AS name
       FROM article_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE ac.is_primary = 1 AND ac.article_id > ?
       ORDER BY ac.article_id
       LIMIT 5000`,
      [categoryCursor],
      opts
    );
    rowsRead += pageRowsRead;
    requestCount += 1;
    categoryRows.push(...results);
    if (results.length === 0) break;
    categoryCursor = results[results.length - 1].article_id;
    if (results.length < 5000) break;
  }

  const tagRows: Array<TagJoinRow & { tag_id: number }> = [];
  let tagArticleCursor = 0;
  let tagIdCursor = 0;
  for (;;) {
    const { results, rowsRead: pageRowsRead } = await queryD1WithMeta<TagJoinRow & { tag_id: number }>(
      `SELECT atg.article_id AS article_id, atg.tag_id AS tag_id, t.slug AS slug, t.name AS name
       FROM article_tags atg
       JOIN tags t ON t.id = atg.tag_id
       WHERE (atg.article_id, atg.tag_id) > (?, ?)
       ORDER BY atg.article_id, atg.tag_id
       LIMIT 5000`,
      [tagArticleCursor, tagIdCursor],
      opts
    );
    rowsRead += pageRowsRead;
    requestCount += 1;
    tagRows.push(...results);
    if (results.length === 0) break;
    const last = results[results.length - 1];
    tagArticleCursor = last.article_id;
    tagIdCursor = last.tag_id;
    if (results.length < 5000) break;
  }

  const { results: sourceRows, rowsRead: sourcesRowsRead } = await queryD1WithMeta<SourceRow>(
    `SELECT id, slug, name, website_url FROM sources`,
    [],
    opts
  );
  rowsRead += sourcesRowsRead;
  requestCount += 1;

  const { publicArticles, nonPublic } = stitchArticles(articleRows, categoryRows, tagRows, sourceRows);
  return { publicArticles, nonPublic, rowsRead, requestCount };
}

export interface FetchArticlesStitchedByIdsResult extends FetchPublicArticlesWindowResult {
  requestCount: number;
}

/**
 * Re-fetches a small, explicit set of internal article ids (the sweep path's
 * `fetchChangedSince` output) across all three tables, each chunked at `D1_MAX_BOUND_PARAMS` — the
 * same chunking discipline `fetchPublicArticlesWindow` already uses for categories/tags, extended
 * here to the `articles` table itself since this fetcher's input is an id list rather than a
 * `published_at` range. `sources` is fetched once, unpaginated, exactly as the other two fetchers
 * do — the table is small and reading it once per call is cheap relative to the per-mode budgets.
 */
export async function fetchArticlesStitchedByIds(
  internalIds: number[],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<FetchArticlesStitchedByIdsResult> {
  let rowsRead = 0;
  let requestCount = 0;

  const articleRows: WindowArticleRow[] = [];
  for (const idChunk of chunkIds(internalIds)) {
    if (idChunk.length === 0) continue;
    const placeholders = idChunk.map(() => '?').join(',');
    const { results, rowsRead: chunkRowsRead } = await queryD1WithMeta<WindowArticleRow>(
      `SELECT id, uuid, title, slug, summary, key_points, url, published_at, source_id, status, is_duplicate
       FROM articles
       WHERE id IN (${placeholders})`,
      idChunk,
      opts
    );
    rowsRead += chunkRowsRead;
    requestCount += 1;
    articleRows.push(...results);
  }

  const categoryRows: CategoryJoinRow[] = [];
  for (const idChunk of chunkIds(internalIds)) {
    if (idChunk.length === 0) continue;
    const placeholders = idChunk.map(() => '?').join(',');
    const { results, rowsRead: chunkRowsRead } = await queryD1WithMeta<CategoryJoinRow>(
      `SELECT ac.article_id AS article_id, c.slug AS slug, c.name AS name
       FROM article_categories ac
       JOIN categories c ON c.id = ac.category_id
       WHERE ac.is_primary = 1 AND ac.article_id IN (${placeholders})`,
      idChunk,
      opts
    );
    rowsRead += chunkRowsRead;
    requestCount += 1;
    categoryRows.push(...results);
  }

  const tagRows: TagJoinRow[] = [];
  for (const idChunk of chunkIds(internalIds)) {
    if (idChunk.length === 0) continue;
    const placeholders = idChunk.map(() => '?').join(',');
    const { results, rowsRead: chunkRowsRead } = await queryD1WithMeta<TagJoinRow>(
      `SELECT atg.article_id AS article_id, t.slug AS slug, t.name AS name
       FROM article_tags atg
       JOIN tags t ON t.id = atg.tag_id
       WHERE atg.article_id IN (${placeholders})`,
      idChunk,
      opts
    );
    rowsRead += chunkRowsRead;
    requestCount += 1;
    tagRows.push(...results);
  }

  const { results: sourceRows, rowsRead: sourcesRowsRead } = await queryD1WithMeta<SourceRow>(
    `SELECT id, slug, name, website_url FROM sources`,
    [],
    opts
  );
  rowsRead += sourcesRowsRead;
  requestCount += 1;

  const { publicArticles, nonPublic } = stitchArticles(articleRows, categoryRows, tagRows, sourceRows);
  return { publicArticles, nonPublic, rowsRead, requestCount };
}

export interface FetchChangedSinceResult {
  /** Internal `articles.id` values (not uuids) — the shape `fetchArticlesStitchedByIds` expects. */
  ids: number[];
  rowsRead: number;
}

/**
 * The daily sweep signal (planner_findings §2): one statement, `updated_at > ? OR processed_at >
 * ?` — an unindexed full-table scan (~43k rows), acceptable once a day but not once per cron cycle
 * (D-06 binding constraint). Returns internal ids only; the caller re-fetches full rows via
 * `fetchArticlesStitchedByIds`.
 */
export async function fetchChangedSince(
  sinceEpoch: number,
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<FetchChangedSinceResult> {
  const { results, rowsRead } = await queryD1WithMeta<{ id: number }>(
    `SELECT id FROM articles WHERE updated_at > ? OR processed_at > ?`,
    [sinceEpoch, sinceEpoch],
    opts
  );
  return { ids: results.map((row) => row.id), rowsRead };
}

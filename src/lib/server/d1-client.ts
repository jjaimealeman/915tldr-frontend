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
  result?: Array<{ success: boolean; results: T[] }>;
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

/**
 * Runs one parameterised SQL statement against production D1 over the Cloudflare REST API.
 * Throws on a non-2xx response or a `success: false` body rather than returning an empty
 * array — a silent empty read here is precisely the `/changelog` empty-state defect (REND-02/03)
 * and must not be born again in this module.
 */
export async function queryD1<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requireEnv('CLOUDFLARE_API_TOKEN');

  const response = await fetch(
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

  return body.result[0].results ?? [];
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

// REND-06 / D-03 / D-04: render-manifest entry construction, validation, and build-time KV
// read/single-write/bulk-write. One KV key per article (`manifest:<uuid>`) — never a single
// blob, never sharded — so reads and writes are O(1) and independent, with no read-modify-write
// race between concurrent renders (D-03). Build/render-time access only; the deployed Worker
// never writes this namespace on the public request path.
//
// Credential handling follows the same OPS-11 convention as `src/lib/server/d1-client.ts`:
// `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` read from `process.env` only, never logged.
//
// `RENDER_MANIFEST_KV_NAMESPACE_ID` names the dedicated `915tldr-render-manifest` namespace
// (03-RESEARCH.md Open Question 2 — a namespace scoped to this app, not the Nuxt app's existing
// `KV`/`CACHE` namespaces).
//
// 03-04 hardening (this file's second pass, see 03-04-SUMMARY.md):
//   - `spanishCounterpartId: string | null` is GONE. Replaced by `translationGroupId` +
//     `language` (Option C, human-decided at 03-04's Task 1 checkpoint) — see
//     `docs/phase-03/render-manifest.md` § "Translation identity" for the full reasoning.
//   - Every write is validated before it reaches the network — an incomplete or malformed entry
//     stored in KV makes the whole manifest untrustworthy, and Phase 4 acts on it (T-03-10).
//   - `MANIFEST_SCHEMA_VERSION` replaces the literal `'0'` the 03-01 tracer wrote by hand; every
//     entry now records it automatically rather than trusting each call site to pass it.
//   - `putManifestEntriesBulk` batches at the KV bulk-write REST endpoint's documented ceiling
//     (10,000 pairs / call) instead of one HTTP round trip per article (T-03-11).

/** Bumped when the shape of `ManifestEntry` or what a renderer does with it changes. Entries at
 * an older version can be identified and re-rendered selectively instead of invalidating the
 * whole corpus — that selectivity is the entire reason this is a version field and not a boolean.
 * See docs/phase-03/render-manifest.md § "Versioning". */
export const MANIFEST_SCHEMA_VERSION = '1';

/** Cloudflare KV bulk-write REST endpoint ceiling: up to 10,000 key/value pairs per call, under
 * 100MB per request. [CITED in 03-RESEARCH.md § "Don't Hand-Roll" and § "KV Bulk Write for
 * Manifest Population": developers.cloudflare.com/kv/api/write-key-value-pairs/, fetched
 * directly during Phase 3 research — "Write more than one key-value pair at a time with Wrangler
 * or via the REST API. The bulk API can accept up to 10,000 KV pairs at once."] Not re-fetched
 * live in this task — the cloudflare-docs MCP tool was not available in this execution's tool
 * surface, so this constant carries forward the research doc's already-cited, directly-fetched
 * source rather than a fresh lookup or an assumption carried over from D1's unrelated
 * 100-bound-parameter limit. */
export const KV_BULK_WRITE_MAX_PAIRS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`kv-manifest: ${name} is not set in the environment`);
  }
  return value;
}

/**
 * All D-04 field categories, plus the translation identity (D-04 mandatory, populated per Option
 * C — see the class comment above). A missing key and a null value are different failures; this
 * schema makes every field required and non-null, so "missing" is the only failure a reader
 * needs to check for.
 */
export interface ManifestEntry {
  articleId: string;
  /** Equal to the article's own `articleId` for every entry written today (English-only corpus).
   * Phase 6's Spanish entries will carry the SAME `translationGroupId` as their English
   * counterpart — pairing is "same translationGroupId", never "follow a pointer to a specific
   * record". Never null: see docs/phase-03/render-manifest.md § "Translation identity" for why
   * this shape was chosen over a derived id (Option A) or a nullable backfill field (Option B). */
  translationGroupId: string;
  /** Always `'en'` today — no Spanish content is ingested yet. Phase 6 writes `'es'` entries
   * carrying the same `translationGroupId`. */
  language: 'en' | 'es';
  contentHash: string;
  schemaVersion: string;
  renderedAt: string;
  buildHash: string;
  category: string;
  publishedAt: number;
}

export interface SourceArticleRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  published_at: number; // epoch seconds — matches ArticleRow in d1-client.ts
  /** GROUP_CONCAT over a correlated subquery returns SQL NULL, not `''`, when an article has no
   * tags — `d1-client.ts`'s `ArticleRow.tags` is typed `string` but the real runtime value can be
   * `null`. `computeContentHash` below treats `null` and `''` identically (both normalize to an
   * empty tag list) rather than letting a hash change purely because a row acquired its first
   * tag from having none, versus having one empty-string tag — a distinction the source schema
   * does not draw. */
  tags: string | null;
}

/** Splits `title`/`summary`/`tags` out of a row so the hash function's input contract is explicit
 * and independently testable from the full `SourceArticleRow` shape. */
type HashableFields = Pick<SourceArticleRow, 'title' | 'summary' | 'tags'>;

/** Comma-joined tags, order-independent and null-safe: sorted so `"b,a"` and `"a,b"` hash
 * identically, and `null`/`''`/`'  '` all normalize to `[]` so a hash never flips purely because
 * GROUP_CONCAT's null-vs-empty-string behavior differs from what a caller happens to pass. */
function normalizeTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .sort();
}

/**
 * SHA-256 hex digest over a stable, order-independent serialisation of exactly `title`,
 * `summary` and `tags` — the staleness signal a future incremental render step depends on.
 * Deliberately excludes `status` and every other row column: a hash that changes when an
 * unrelated field changes would report every article stale on every build and quietly defeat
 * incremental rendering (03-04-PLAN.md Task 2 behavior block).
 */
export async function computeContentHash(row: HashableFields): Promise<string> {
  const { createHash } = await import('node:crypto');
  const stable = JSON.stringify({
    title: row.title ?? '',
    summary: row.summary ?? '',
    tags: normalizeTags(row.tags),
  });
  return createHash('sha256').update(stable).digest('hex');
}

/**
 * Builds a manifest entry from a D1 article row. `translationGroupId` is set to the row's own
 * `id` (its uuid) and `language` defaults to `'en'` — see the `ManifestEntry.translationGroupId`
 * doc comment for the pairing rule this implements. `schemaVersion` is always
 * `MANIFEST_SCHEMA_VERSION`; callers no longer pass a render-version literal, which is what let
 * the 03-01 tracer's `renderVersion: '0'` drift from an exported source of truth in the first
 * place.
 */
export async function buildManifestEntry(
  row: SourceArticleRow,
  opts: { buildHash: string; language?: 'en' | 'es' }
): Promise<ManifestEntry> {
  const contentHash = await computeContentHash(row);

  return {
    articleId: row.id,
    translationGroupId: row.id,
    language: opts.language ?? 'en',
    contentHash,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    renderedAt: new Date().toISOString(),
    buildHash: opts.buildHash,
    category: row.category,
    publishedAt: row.published_at,
  };
}

function manifestKey(articleId: string): string {
  return `manifest:${articleId}`;
}

const CONTENT_HASH_RE = /^[0-9a-f]{64}$/;

/**
 * Rejects an incomplete or malformed entry before it reaches the network, naming the offending
 * field (T-03-10). Storing a bad entry and discovering it later is the failure mode that makes a
 * manifest untrustworthy — and an untrustworthy manifest is worse than none, because Phase 4
 * acts on it.
 */
export function validateManifestEntry(entry: ManifestEntry): void {
  const requiredNonEmptyStrings: (keyof ManifestEntry)[] = [
    'articleId',
    'translationGroupId',
    'contentHash',
    'schemaVersion',
    'renderedAt',
    'buildHash',
    'category',
  ];

  for (const field of requiredNonEmptyStrings) {
    const value = entry?.[field];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`kv-manifest: manifest entry missing or empty required field "${field}"`);
    }
  }

  if (entry.language !== 'en' && entry.language !== 'es') {
    throw new Error(
      `kv-manifest: manifest entry field "language" must be "en" or "es", got ${JSON.stringify(entry.language)}`
    );
  }

  if (!CONTENT_HASH_RE.test(entry.contentHash)) {
    throw new Error(
      `kv-manifest: manifest entry field "contentHash" must be 64 hex characters, got ${JSON.stringify(entry.contentHash)}`
    );
  }

  if (typeof entry.publishedAt !== 'number' || !Number.isFinite(entry.publishedAt)) {
    throw new Error(
      `kv-manifest: manifest entry field "publishedAt" must be a number, got ${typeof entry.publishedAt}`
    );
  }
}

function kvValueUrl(key: string): string {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const namespaceId = requireEnv('RENDER_MANIFEST_KV_NAMESPACE_ID');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
}

function kvBulkUrl(): string {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const namespaceId = requireEnv('RENDER_MANIFEST_KV_NAMESPACE_ID');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;
}

function kvKeysUrl(): string {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const namespaceId = requireEnv('RENDER_MANIFEST_KV_NAMESPACE_ID');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;
}

interface KvListKeysResponse {
  result?: Array<{ name: string }>;
  result_info?: { cursor?: string };
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

type FetchImpl = typeof fetch;

/**
 * Writes one manifest entry, keyed `manifest:<articleId>`. Validated before any network call. No
 * expiration/TTL is set on the write — a manifest entry that expires silently erases render state
 * (D-04). `opts.fetchImpl` exists only so tests can inject a stubbed transport; production
 * callers never need it.
 */
export async function putManifestEntry(
  entry: ManifestEntry,
  opts: { fetchImpl?: FetchImpl } = {}
): Promise<void> {
  validateManifestEntry(entry);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const key = manifestKey(entry.articleId);

  const response = await fetchImpl(kvValueUrl(key), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`kv-manifest: KV write for "${key}" failed: ${response.status} ${text}`);
  }
}

/**
 * Writes many manifest entries via the KV bulk-write REST endpoint, batching at
 * `KV_BULK_WRITE_MAX_PAIRS` pairs per request (25,000 entries → exactly 3 requests, not 25,000).
 * Every entry is validated before ANY request is issued — a bad entry at position 20,001 must
 * not let the first two valid batches land in KV while the third is silently dropped. Empty
 * input issues zero requests and does not throw (the normal steady state once a build finds
 * nothing changed). No expiration/TTL is set on any batch element, for the same reason as
 * `putManifestEntry`.
 */
export async function putManifestEntriesBulk(
  entries: ManifestEntry[],
  opts: { fetchImpl?: FetchImpl } = {}
): Promise<void> {
  if (entries.length === 0) return;

  for (const entry of entries) {
    validateManifestEntry(entry);
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const url = kvBulkUrl();

  for (const batch of chunk(entries, KV_BULK_WRITE_MAX_PAIRS)) {
    const body = batch.map((entry) => ({
      key: manifestKey(entry.articleId),
      value: JSON.stringify(entry),
      // No `expiration`/`expiration_ttl` here — see the class comment above.
    }));

    const response = await fetchImpl(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`kv-manifest: KV bulk write failed: ${response.status} ${text}`);
    }
  }
}

/**
 * Lists every written manifest article id (the `manifest:` key prefix stripped), paginating the
 * KV List Keys REST endpoint via its `cursor` field until exhausted. Added for
 * `tools/verify-edge-headers.mjs`'s live-discovery path (OPS-02 hardening, 03-UAT.md item 2):
 * that tool needs to find which article the CURRENTLY DEPLOYED build rendered, and this manifest
 * — keyed by article id, not by build — is the only build-time-written record of "which article
 * did this deployed commit render". Never called from a public request path; this and every
 * other function in this module run at build time or from standalone tooling only.
 *
 * Scales by listing + reading every key, which is appropriate while this Phase 3 manifest holds
 * a handful of tracer-run entries. It will NOT scale once Phase 4 populates the full ~41,000
 * article corpus — a future caller at that scale should look up by KV list `metadata` (settable
 * per key, not currently written by `putManifestEntry`/`putManifestEntriesBulk`) instead of
 * reading every value. Documented here rather than solved here: solving it now would mean
 * redesigning the write path for a caller (a Phase-3 dev tool) that does not need it yet.
 */
export async function listManifestArticleIds(opts: { fetchImpl?: FetchImpl } = {}): Promise<string[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const prefix = 'manifest:';
  const ids: string[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(kvKeysUrl());
    url.searchParams.set('prefix', prefix);
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`kv-manifest: KV list-keys failed: ${response.status} ${text}`);
    }

    const body = (await response.json()) as KvListKeysResponse;
    for (const key of body.result ?? []) {
      ids.push(key.name.slice(prefix.length));
    }
    cursor = body.result_info?.cursor || undefined;
  } while (cursor);

  return ids;
}

/**
 * Reads back one manifest entry. Returns `null` if the key does not exist (404). Throws if the
 * stored value is not valid JSON — a malformed stored value and an absent key are different
 * failures, and this function must not conflate them into the same `null` return.
 */
export async function getManifestEntry(
  articleId: string,
  opts: { fetchImpl?: FetchImpl } = {}
): Promise<ManifestEntry | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const key = manifestKey(articleId);

  const response = await fetchImpl(kvValueUrl(key), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`kv-manifest: KV read for "${key}" failed: ${response.status} ${text}`);
  }

  return (await response.json()) as ManifestEntry;
}

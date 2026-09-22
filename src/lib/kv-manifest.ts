// REND-06 / D-03 / D-04: render-manifest entry construction and build-time KV read/write.
// One KV key per article (`manifest:<uuid>`) — never a single blob, never sharded — so reads
// and writes are O(1) and independent, with no read-modify-write race between concurrent
// renders (D-03). Build/render-time access only; the deployed Worker never writes this
// namespace on the public request path.
//
// Credential handling follows the same OPS-11 convention as `src/lib/server/d1-client.ts`:
// `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` read from `process.env` only, never logged.
//
// `RENDER_MANIFEST_KV_NAMESPACE_ID` names the dedicated `915tldr-render-manifest` namespace
// (03-RESEARCH.md Open Question 2 — a namespace scoped to this app, not the Nuxt app's existing
// `KV`/`CACHE` namespaces). Read from the environment rather than hardcoded, unlike
// `D1_DATABASE_ID` in `d1-client.ts`, because as of this task's execution the namespace could
// not yet be created — see 03-01-SUMMARY.md "Blocked" section. Once created, either hardcode the
// id here to match `d1-client.ts`'s convention, or keep it as an env var; either is fine, but the
// namespace must exist before this module can do anything.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`kv-manifest: ${name} is not set in the environment`);
  }
  return value;
}

/** All eight D-04 fields. A missing key and a null value are different failures — see tracer test. */
export interface ManifestEntry {
  articleId: string;
  spanishCounterpartId: string | null;
  contentHash: string;
  renderVersion: string;
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
  tags: string;
}

/**
 * Builds a manifest entry from a D1 article row. `contentHash` is a SHA-256 hex digest of
 * `summary + title + tags` — the staleness signal that lets a future render step skip unchanged
 * articles. `spanishCounterpartId` is `null` here; its population strategy is a one-way decision
 * gated in 03-04 and must not be invented in this tracer.
 */
export async function buildManifestEntry(
  row: SourceArticleRow,
  opts: { renderVersion: string; buildHash: string }
): Promise<ManifestEntry> {
  const { createHash } = await import('node:crypto');
  const contentHash = createHash('sha256')
    .update(row.summary + row.title + row.tags)
    .digest('hex');

  return {
    articleId: row.id,
    spanishCounterpartId: null,
    contentHash,
    renderVersion: opts.renderVersion,
    renderedAt: new Date().toISOString(),
    buildHash: opts.buildHash,
    category: row.category,
    publishedAt: row.published_at,
  };
}

function manifestKey(articleId: string): string {
  return `manifest:${articleId}`;
}

function kvValueUrl(key: string): string {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const namespaceId = requireEnv('RENDER_MANIFEST_KV_NAMESPACE_ID');
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
}

/**
 * Writes one manifest entry, keyed `manifest:<articleId>`. No expiration/TTL is set on the
 * write — a manifest entry that expires silently erases render state (D-04).
 */
export async function putManifestEntry(entry: ManifestEntry): Promise<void> {
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const key = manifestKey(entry.articleId);

  const response = await fetch(kvValueUrl(key), {
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

/** Reads back one manifest entry. Returns `null` if the key does not exist (404). */
export async function getManifestEntry(articleId: string): Promise<ManifestEntry | null> {
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const key = manifestKey(articleId);

  const response = await fetch(kvValueUrl(key), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`kv-manifest: KV read for "${key}" failed: ${response.status} ${text}`);
  }

  return (await response.json()) as ManifestEntry;
}

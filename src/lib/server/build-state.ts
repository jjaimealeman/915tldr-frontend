// D-14 / REND-02/03: last-good build state (persisted in KV, survives a build-cache purge), the
// per-build pending-state file (`.astro/build-state.pending.json`, gitignored, not deployed), and
// the never-shrink evaluation the loader runs before it ever mutates the content store.
//
// Lives under src/lib/server (not src/lib/) — like d1-client.ts and kv-manifest.ts, it holds
// credentials (reads KV over the Cloudflare REST API) and must stay inside the D1-import
// assertion's covered directory (tools/assert-no-d1.mjs walks this whole directory, not just
// d1-client.ts by name).
//
// Credential handling follows the same OPS-11 convention as d1-client.ts / kv-manifest.ts:
// CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN read from process.env only, never logged, never
// included in an error message.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RENDER_MANIFEST_NAMESPACE_ID } from './kv-manifest.ts';

/** The KV key the last-good build state is persisted under. Named directly in every shrink-check
 * failure message that requires a baseline, so an operator reading the error knows exactly which
 * KV entry to inspect or bootstrap. */
export const LAST_GOOD_KEY = 'build:last-good';

/** `.astro/` is Astro's own build-scratch directory (already covered by Workers Builds' build
 * caching per D-06, and already gitignored) — this file is per-build-run state, never committed,
 * never deployed, and never read by the deployed Worker. Resolved against `process.cwd()` at call
 * time (not a module-load-time constant) so tests can `chdir` into an isolated tmp directory. */
export function pendingStatePath(): string {
  return path.join(process.cwd(), '.astro', 'build-state.pending.json');
}

/** Back-compat/read convenience: the path as it would resolve right now. Prefer
 * `pendingStatePath()` in new code — this export exists because the plan's own artifact list
 * names `PENDING_STATE_PATH` as a value, not a function. */
export const PENDING_STATE_PATH = pendingStatePath();

export interface LastGoodArticlesState {
  count: number;
  ids: string[];
}

export interface LastGoodChangelogState {
  count: number;
}

export interface LastGoodState {
  schemaVersion: '1';
  buildHash: string;
  recordedAt: string;
  articles: LastGoodArticlesState;
  changelog?: LastGoodChangelogState;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`build-state: ${name} is not set in the environment`);
  }
  return value;
}

function renderManifestNamespaceId(): string {
  return process.env.RENDER_MANIFEST_KV_NAMESPACE_ID ?? RENDER_MANIFEST_NAMESPACE_ID;
}

function kvValueUrl(key: string): string {
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const namespaceId = renderManifestNamespaceId();
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
}

type FetchImpl = typeof fetch;

function validateLastGoodShape(value: unknown): asserts value is LastGoodState {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is not an object`);
  }
  const v = value as Record<string, unknown>;
  if (typeof v.schemaVersion !== 'string') {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is missing "schemaVersion"`);
  }
  if (typeof v.buildHash !== 'string') {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is missing "buildHash"`);
  }
  if (typeof v.recordedAt !== 'string') {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is missing "recordedAt"`);
  }
  const articles = v.articles as Record<string, unknown> | undefined;
  if (typeof articles !== 'object' || articles === null || typeof articles.count !== 'number') {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is missing "articles.count"`);
  }
  if (!Array.isArray(articles.ids) || !articles.ids.every((id) => typeof id === 'string')) {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is missing or has malformed "articles.ids"`);
  }
  if (v.changelog !== undefined) {
    const changelog = v.changelog as Record<string, unknown>;
    if (typeof changelog !== 'object' || changelog === null || typeof changelog.count !== 'number') {
      throw new Error(`build-state: "${LAST_GOOD_KEY}" value has a malformed "changelog"`);
    }
  }
}

/**
 * Reads `build:last-good` from the render-manifest KV namespace. Returns `null` on a 404 (no
 * baseline recorded yet — legitimate on a brand-new project or the very first cold build). Throws
 * on any other non-2xx response, on a body that is not valid JSON, or on a body missing a
 * required field — a malformed baseline must not be silently treated as "no baseline", because
 * that would let `evaluateShrink` skip the very check it exists to run.
 */
export async function readLastGood(opts: { fetchImpl?: FetchImpl } = {}): Promise<LastGoodState | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');

  const response = await fetchImpl(kvValueUrl(LAST_GOOD_KEY), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`build-state: KV read for "${LAST_GOOD_KEY}" failed: ${response.status} ${text}`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (err) {
    throw new Error(`build-state: "${LAST_GOOD_KEY}" value is not valid JSON: ${(err as Error).message}`);
  }

  validateLastGoodShape(parsed);
  return parsed;
}

/** Shape of the per-build pending-state file. Every field is optional — the file accumulates
 * sections across a build as different parts of the loader/changelog pipeline call
 * `writePendingBuildState`, and `commitLastGood` only requires the sections it's told to require. */
export type PendingBuildState = Partial<Pick<LastGoodState, 'articles' | 'changelog'>>;

async function readPendingFileRaw(): Promise<PendingBuildState> {
  try {
    const raw = await readFile(pendingStatePath(), 'utf8');
    return JSON.parse(raw) as PendingBuildState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`build-state: failed to read pending build state: ${(err as Error).message}`);
  }
}

/** Reads the current pending-build-state file. Returns `{}` if the file does not exist yet — the
 * normal state at the very start of a build, before any section has been written. */
export async function readPendingBuildState(): Promise<PendingBuildState> {
  return readPendingFileRaw();
}

/**
 * Read-merge-write: merges `patch`'s top-level sections (`articles`, `changelog`) into whatever is
 * already on disk, then writes the result back. Two calls in the same build — one after the
 * articles loader finishes, one after the changelog fetch finishes — both land in the same file
 * without clobbering each other. `mkdir -p`s the containing `.astro/` directory first, since a
 * completely cold build (no prior `astro build` in this checkout) may not have created it yet.
 */
export async function writePendingBuildState(patch: PendingBuildState): Promise<void> {
  const existing = await readPendingFileRaw();
  const merged: PendingBuildState = { ...existing, ...patch };
  const filePath = pendingStatePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8');
}

/**
 * Validates the pending build state carries every section in `requiredSections`, then PUTs a new
 * `LastGoodState` to `build:last-good` — no TTL, since a last-good baseline that silently expires
 * would defeat the shrink check the next build depends on. Issues no network request at all if any
 * required section is missing (a partial or aborted build must never overwrite a good baseline
 * with an incomplete one).
 */
export async function commitLastGood(opts: {
  buildHash: string;
  requiredSections?: Array<keyof PendingBuildState>;
  fetchImpl?: FetchImpl;
}): Promise<void> {
  const requiredSections = opts.requiredSections ?? ['articles', 'changelog'];
  const pending = await readPendingFileRaw();

  for (const section of requiredSections) {
    if (pending[section] === undefined) {
      throw new Error(
        `build-state: commitLastGood refused — pending build state is missing required section "${String(section)}"`
      );
    }
  }

  const state: LastGoodState = {
    schemaVersion: '1',
    buildHash: opts.buildHash,
    recordedAt: new Date().toISOString(),
    articles: pending.articles as LastGoodArticlesState,
    ...(pending.changelog !== undefined ? { changelog: pending.changelog as LastGoodChangelogState } : {}),
  };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');

  const response = await fetchImpl(kvValueUrl(LAST_GOOD_KEY), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`build-state: KV write for "${LAST_GOOD_KEY}" failed: ${response.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// evaluateShrink — D-14's never-shrink check
// ---------------------------------------------------------------------------

export interface EvaluateShrinkOptions {
  /** Prefixes every message this function produces — e.g. `'d1-articles-loader'`. */
  label: string;
  /** The last-good build's recorded state for this collection, or `null` if none exists yet. */
  previous: LastGoodArticlesState | null;
  /** The current build's full id set, after fetch/sync but before any store mutation. */
  currentIds: string[];
  /** Ids present in `previous` but absent from `currentIds` for an OBSERVED reason (e.g. now
   * non-processed or a duplicate in D1) — these never count against the allowance. */
  explained?: Iterable<string>;
  /** How many UNEXPLAINED removals are tolerated before this throws. Defaults to 0 — any
   * unexplained loss is a failure unless the caller names an allowance explicitly
   * (`ALLOWED_ARTICLE_SHRINK`). */
  allowance?: number;
  /** When `true`, a missing baseline (`previous === null`) is itself a failure unless `bootstrap`
   * is also `true`. Deploying builds set this so a purged/missing baseline can never silently
   * skip the check it exists to run. */
  requireBaseline?: boolean;
  /** Explicitly acknowledges "this build has no baseline to compare against" (first run, or a
   * deliberate reset) — the one legitimate way to satisfy `requireBaseline` with no `previous`. */
  bootstrap?: boolean;
}

export interface ShrinkResult {
  ok: true;
  note: string;
  missingCount: number;
  explainedCount: number;
  unexplainedCount: number;
  allowanceUsed: number;
}

/** D-14: "fewer rows than expected" is never-shrink-versus-last-good, not a raw count comparison —
 * an id present in the last good build and absent now, with no observed reason, is a failure
 * regardless of whether the total count happened to grow (see 04-03-PLAN.md's "Edge coverage"
 * flagged assumption). Zero rows in `currentIds` is ALWAYS a failure, unconditionally — no
 * allowance, `requireBaseline` value, or `bootstrap` flag can waive it, because a zero-row build is
 * the `/changelog` empty-state defect reborn one layer deeper (REND-02/03).
 */
export function evaluateShrink(opts: EvaluateShrinkOptions): ShrinkResult {
  const { label, previous, currentIds, allowance = 0 } = opts;
  const explainedSet = new Set(opts.explained ?? []);

  if (currentIds.length === 0) {
    throw new Error(
      `${label}: never-shrink check failed — current id set is empty (zero rows is always a failure, D-14)`
    );
  }

  if (previous === null) {
    if (opts.requireBaseline && !opts.bootstrap) {
      throw new Error(
        `${label}: never-shrink check failed — no baseline found at KV key "${LAST_GOOD_KEY}" and BUILD_STATE_REQUIRE_BASELINE is set; set BUILD_STATE_BOOTSTRAP=1 to record the first baseline explicitly`
      );
    }
    if (opts.bootstrap) {
      return {
        ok: true,
        note: `${label}: bootstrap — no baseline existed, recording ${currentIds.length} ids as the first baseline`,
        missingCount: 0,
        explainedCount: 0,
        unexplainedCount: 0,
        allowanceUsed: 0,
      };
    }
    return {
      ok: true,
      note: `${label}: no baseline warning — no previous state at "${LAST_GOOD_KEY}" and requireBaseline is not set; proceeding without a shrink check this run`,
      missingCount: 0,
      explainedCount: 0,
      unexplainedCount: 0,
      allowanceUsed: 0,
    };
  }

  const currentIdSet = new Set(currentIds);
  const missing = previous.ids.filter((id) => !currentIdSet.has(id));
  const explainedMissing = missing.filter((id) => explainedSet.has(id));
  const unexplainedMissing = missing.filter((id) => !explainedSet.has(id));

  if (unexplainedMissing.length > allowance) {
    const named = unexplainedMissing.slice(0, 20).join(', ');
    throw new Error(
      `${label}: never-shrink check failed — ${unexplainedMissing.length} unexplained removal(s) (allowance ${allowance}): ${named}`
    );
  }

  if (unexplainedMissing.length > 0) {
    return {
      ok: true,
      note: `${label}: allowance used — ${unexplainedMissing.length} unexplained removal(s) within allowance ${allowance}: ${unexplainedMissing.join(', ')}`,
      missingCount: missing.length,
      explainedCount: explainedMissing.length,
      unexplainedCount: unexplainedMissing.length,
      allowanceUsed: unexplainedMissing.length,
    };
  }

  if (explainedMissing.length > 0) {
    return {
      ok: true,
      note: `${label}: ${explainedMissing.length} explained removal(s): ${explainedMissing.join(', ')}`,
      missingCount: missing.length,
      explainedCount: explainedMissing.length,
      unexplainedCount: 0,
      allowanceUsed: 0,
    };
  }

  return {
    ok: true,
    note: `${label}: no shrink`,
    missingCount: 0,
    explainedCount: 0,
    unexplainedCount: 0,
    allowanceUsed: 0,
  };
}

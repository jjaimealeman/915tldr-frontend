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
//
// Pending-state writes are serialized (a per-process FIFO queue) and atomic (temp file + rename)
// — see the comment block above `PENDING_WRITE_QUEUE_KEY` below for why, and quick task
// 261002-tl2 for the 2026-10-02 incident this fixes.
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
    throw new Error(
      `build-state: failed to read pending build state: ${(err as Error).message} (a stale file ` +
        `from an earlier run is cleared at the start of every \`pnpm run build\` — see ` +
        `resetPendingBuildState — so a corrupt file found mid-build means something outside this ` +
        `module wrote it)`
    );
  }
}

// ---------------------------------------------------------------------------
// Serialized, atomic pending writes (quick 261002-tl2)
//
// 2026-10-02 incident: `build-state: failed to read pending build state: Unexpected
// non-whitespace character after JSON at position 1867519`. Two loaders (articles-loader.ts,
// changelog-loader.ts) both call `writePendingBuildState` in one `astro build` process. The
// original implementation did an unlocked read, merge, then in-place `writeFile` — two
// concurrent callers could both read the same starting state, then race to write, with
// whichever write finished last (or interleaved with the other, mid-write) winning. The
// production signature was a SHORTER write physically landing over a LONGER one, leaving valid
// JSON for the first ~1.8MB followed by ~226 trailing bytes of the longer copy's tail.
//
// The fix has two parts:
//   1. A per-process FIFO write queue, so writes never race each other inside one process.
//   2. An atomic temp-file-then-rename replace, so no reader (in any process) can ever observe a
//      partially-written file, even mid-write.
//
// The queue tail lives on `globalThis` under a well-known `Symbol.for(...)` key, NOT a
// module-local variable. Astro may load `content.config.ts` (and this module, transitively)
// through Vite's module runner in one part of the build while other code reaches it through
// Node's native loader — that can produce two separate module instances of this file in the
// SAME process. A module-local lock would give each instance its own queue, and the race would
// come back exactly as before. `globalThis` is the one thing both instances share.
// ---------------------------------------------------------------------------

const PENDING_WRITE_QUEUE_KEY = Symbol.for('915tldr.build-state.pending-write-queue');

/** The queue tail is typed via a cast to a symbol-keyed record rather than `any`/`@ts-ignore` —
 * `globalThis`'s own type has no index signature for an arbitrary symbol key. */
type PendingWriteQueueGlobal = Record<symbol, Promise<void> | undefined>;

function queueGlobal(): PendingWriteQueueGlobal {
  return globalThis as unknown as PendingWriteQueueGlobal;
}

function getQueueTail(): Promise<void> {
  const existing = queueGlobal()[PENDING_WRITE_QUEUE_KEY];
  if (existing !== undefined) return existing;
  const initial = Promise.resolve();
  queueGlobal()[PENDING_WRITE_QUEUE_KEY] = initial;
  return initial;
}

function setQueueTail(next: Promise<void>): void {
  queueGlobal()[PENDING_WRITE_QUEUE_KEY] = next;
}

function noop(): void {
  // intentionally empty — used to turn a possibly-rejecting promise into one that never rejects,
  // so one failed write can never wedge the queue for every write issued after it.
}

/** Temp-file naming for the atomic replace, exported as constants (not inlined) because
 * `tools/reset-pending-build-state.mjs` (quick 261002-tl2 Task 2) matches on exactly this prefix
 * and suffix to clean up a stray temp file left behind by a crashed build. */
export const PENDING_TEMP_PREFIX = 'build-state.pending.json.';
export const PENDING_TEMP_SUFFIX = '.tmp';

/** The actual read-merge-write-replace, run strictly one at a time per process via the queue in
 * `writePendingBuildState`. Never call this directly — it does not itself serialize against
 * concurrent callers. */
async function readMergeReplace(patch: PendingBuildState): Promise<void> {
  const existing = await readPendingFileRaw();
  const merged: PendingBuildState = { ...existing, ...patch };
  const filePath = pendingStatePath();
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tempPath = path.join(dir, `${PENDING_TEMP_PREFIX}${process.pid}-${randomUUID()}${PENDING_TEMP_SUFFIX}`);
  try {
    await writeFile(tempPath, JSON.stringify(merged, null, 2), 'utf8');
    // Rename is atomic on one filesystem — a reader in any process sees either the old file or
    // the new one, never a partial one, regardless of how large the write was.
    await rename(tempPath, filePath);
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // Best-effort cleanup only — the write/rename error below is the one that matters.
    }
    throw new Error(`build-state: failed to write pending build state: ${(err as Error).message}`);
  }
}

/** Reads the current pending-build-state file. Returns `{}` if the file does not exist yet — the
 * normal state at the very start of a build, before any section has been written. Waits for every
 * write issued before it (via the same per-process queue `writePendingBuildState` uses) so a read
 * in the same process always sees its own prior writes. */
export async function readPendingBuildState(): Promise<PendingBuildState> {
  await getQueueTail();
  return readPendingFileRaw();
}

/**
 * Read-merge-write: merges `patch`'s top-level sections (`articles`, `changelog`) into whatever is
 * already on disk, then writes the result back atomically. Two calls in the same build — one
 * after the articles loader finishes, one after the changelog fetch finishes — both land in the
 * same file without clobbering each other, because every call is chained onto a per-process FIFO
 * queue (see the comment above `PENDING_WRITE_QUEUE_KEY`) rather than running concurrently.
 *
 * A rejection from one call (e.g. a transient fs error) never wedges the queue for calls issued
 * after it — the queue's own tail is `run.then(noop, noop)`, a promise that never rejects, while
 * this function still returns `run` itself so the ORIGINAL caller still observes its own failure.
 */
export function writePendingBuildState(patch: PendingBuildState): Promise<void> {
  const tail = getQueueTail();
  const run = tail.then(() => readMergeReplace(patch));
  setQueueTail(run.then(noop, noop));
  return run;
}

export interface ResetPendingBuildStateResult {
  removed: boolean;
  bytes: number;
  strayTempFiles: number;
}

/**
 * Clears a stale or corrupt pending-state file (and any stray write-temp file) left behind by an
 * earlier run — Workers Builds caches `.astro/` between builds (D-06), so without this, a
 * corrupt or stale file can carry over into a new build and either crash it (the 2026-10-02
 * incident) or, worse, let a leftover section silently satisfy `commitLastGood`'s D-14
 * required-section check with state the CURRENT build never wrote.
 *
 * **Contract: call this only at the very start of a build, before any loader runs.**
 * `tools/reset-pending-build-state.mjs` is its only intended caller. Never call this from a
 * loader or anywhere mid-build — doing so would discard the current build's own in-progress
 * state, exactly the silent-discard failure mode this plan exists to prevent.
 *
 * Touches only the pending-state file itself and entries matching the write-temp naming
 * convention (`PENDING_TEMP_PREFIX`/`PENDING_TEMP_SUFFIX`) — never any other file in `.astro/`,
 * which also holds Astro's own content-layer data store and `ci-build-started-at`, both required
 * by the incremental build.
 */
export async function resetPendingBuildState(): Promise<ResetPendingBuildStateResult> {
  const filePath = pendingStatePath();
  let removed = false;
  let bytes = 0;
  try {
    const stats = await stat(filePath);
    bytes = stats.size;
    await unlink(filePath);
    removed = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`build-state: failed to reset pending build state: ${(err as Error).message}`);
    }
  }

  const dir = path.dirname(filePath);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { removed, bytes, strayTempFiles: 0 };
    }
    throw new Error(`build-state: failed to reset pending build state: ${(err as Error).message}`);
  }

  let strayTempFiles = 0;
  for (const entry of entries) {
    if (!entry.startsWith(PENDING_TEMP_PREFIX) || !entry.endsWith(PENDING_TEMP_SUFFIX)) continue;
    try {
      await unlink(path.join(dir, entry));
      strayTempFiles += 1;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`build-state: failed to reset pending build state: ${(err as Error).message}`);
      }
    }
  }

  return { removed, bytes, strayTempFiles };
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
  await getQueueTail();
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

// D-08: this project's first Worker. Runs ONLY when the static asset layer misses a request —
// Workers Static Assets serves an asset hit directly without ever invoking this handler
// (`run_worker_first` stays unset in wrangler.jsonc).
//
// Branch order (05-03 Task 2): method check -> tag-path match (suffix -> 307 redirect built only
// from the validated slug + url.search; bare canonical -> archive-serve from R2, zero KV reads)
// -> uuid extraction -> the one KV read -> decision (redirect 301 | canonical -> archive-serve |
// not-found -> ASSETS). The tag branch runs BEFORE uuid extraction so a tag-shaped path never
// reaches the KV read, and a canonical article path tries R2 (REND-08) using the articleId the
// KV read already produced — still exactly one KV read per request (ARCH-08).
//
// Kept deliberately tiny: this is the request path PROJECT.md caps at 5ms Worker CPU. All
// decision logic (uuid extraction, redirect validation, the open-redirect mitigation) lives in
// `./lib/article-redirect.ts`; R2 key derivation and tag-path matching live in
// `./lib/archive/archive-route.ts` — both independently unit-tested; this file only wires the
// one KV read, the R2 read, and builds the actual `Response`.
//
// Imports only `./lib/article-redirect.ts` (which imports only `./lib/article-url.ts`) and
// `./lib/archive/archive-route.ts` (same import boundary) — this file is in
// `tools/assert-no-d1.mjs`'s `ENTRYPOINT_EXACT_FILES`, so a transitive reach into the D1/KV
// chokepoint directory (`src/lib/server/`) that guard forbids would fail the build.
import { extractArticleUuid, resolveRedirect } from './lib/article-redirect.ts';
import {
  ARCHIVE_EDGE_CACHE_TTL_SECONDS,
  articleArchiveKey,
  formatServerTiming,
  matchTagPath,
  tagArchiveKey,
  type ServerTimingMetric,
} from './lib/archive/archive-route.ts';

/** Minimal local shape for the Workers `ExecutionContext` passed as `fetch`'s third argument —
 * same "no @cloudflare/workers-types dependency" reasoning as `Env` above. */
export interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

/** Minimal local shape for the Workers Cache API (`caches.default`) — read via
 * `getDefaultCache()` so this file degrades to direct R2 serving (no cache) on any runtime where
 * the global is absent, per 05-03 Task 3's own requirement. No `@cloudflare/workers-types`
 * dependency; `globalThis.caches` is read through an `unknown` cast since this project declares
 * no ambient `caches` global. */
interface WorkerCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function getDefaultCache(): WorkerCache | undefined {
  const caches = (globalThis as unknown as { caches?: { default: WorkerCache } }).caches;
  return caches?.default;
}

/**
 * Minimal local binding shapes — this project has no `@cloudflare/workers-types` dependency
 * (confirmed: not present in `node_modules`), and the plan's own instruction is to add a local
 * interface rather than a new package for this alone. `ASSETS`/`RENDER_MANIFEST`/`ARCHIVE_BUCKET`
 * mirror exactly the three bindings `wrangler.jsonc` declares — no more, no less. `ARCHIVE_BUCKET`
 * only needs `get`/`head` shapes: this Worker never writes or deletes through this binding
 * (05-03's wrangler.jsonc comment).
 */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RENDER_MANIFEST: { get(key: string, type: 'json'): Promise<unknown> };
  ARCHIVE_BUCKET: {
    get(key: string): Promise<{ body: ReadableStream; httpEtag?: string } | null>;
    head(key: string): Promise<{ httpEtag?: string } | null>;
  };
}

// Measured live against dev.915tldr.com (2026-09-30, 05-03 Task 2 read_first step) so an archived
// page is indistinguishable from a static one at the HTTP-header level. Both values intentionally
// have NO extra parameters beyond what the live static layer actually sends — e.g. no explicit
// `; charset=utf-8` on Content-Type, because the live page does not carry one either.
const LIVE_HTML_CONTENT_TYPE = 'text/html';
const LIVE_HTML_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

// Measured live against dev.915tldr.com/tag/<slug>/ and /tag/<slug>.html (05-03 Task 2): both
// suffixes redirect with status 307 to the bare canonical tag path.
const TAG_SUFFIX_REDIRECT_STATUS = 307;

/** Builds the edge-cache key: origin + pathname, method GET — the request's query string and
 * headers are deliberately excluded (05-03 Task 3's own requirement), so every query-string
 * variant of one archived path shares one cache entry. */
function buildCacheKey(url: URL): Request {
  return new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
}

/**
 * Serves an archived GET/HEAD from R2 at `key`, or falls through to `env.ASSETS.fetch` when the
 * object is missing. `kind` distinguishes the two call sites only for logging: a missing
 * canonical ARTICLE object is a sync-bug signal (the manifest says it exists; R2 disagrees) and
 * is logged; a missing TAG object is the normal "this tag isn't archived" case and is silent.
 * `priorTimings` carries any Server-Timing metrics already measured before this call (the KV
 * read, for the article path) so the response's `Server-Timing` header covers the whole request.
 *
 * Caching (05-03 Task 3): the caller has already checked the edge cache and found a miss before
 * calling this function — this function only ever WRITES to the cache, on a GET that gets a real
 * 200 from R2. HEAD never touches the cache (`cache`/`cacheKey` are `undefined` for HEAD calls by
 * construction — see `fetch()` below). The stored copy's `Cache-Control` is rewritten to the
 * archive TTL; the response returned to THIS caller keeps the static-parity `Cache-Control` —
 * cloning before mutating headers keeps the two independent.
 */
async function serveArchived(
  request: Request,
  env: Env,
  ctx: Ctx | undefined,
  key: string,
  kind: 'article' | 'tag',
  identifier: string,
  priorTimings: ServerTimingMetric[],
  cache: WorkerCache | undefined,
  cacheKey: Request | undefined
): Promise<Response> {
  const isHead = request.method === 'HEAD';
  const r2Start = Date.now();
  let object: { body?: ReadableStream; httpEtag?: string } | null;
  try {
    object = isHead ? await env.ARCHIVE_BUCKET.head(key) : await env.ARCHIVE_BUCKET.get(key);
  } catch (err) {
    // T-05-10: an R2 outage on an archived page answers 503 + Retry-After + no-store so crawlers
    // never drop the page as a 404. Log only the key and the error's own message — never the
    // request's headers.
    console.error(
      `[worker] archive R2 ${isHead ? 'head' : 'get'} failed for key ${key}: ${err instanceof Error ? err.message : String(err)}`
    );
    return new Response(null, {
      status: 503,
      headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' },
    });
  }
  const r2Dur = Date.now() - r2Start;

  if (!object) {
    if (kind === 'article') {
      // The manifest said this articleId exists and resolved to this canonical path, but R2 has
      // no object for it — a sync-bug signal worth logging, not a normal "not archived" case.
      console.error(`[worker] archived article missing from R2: uuid ${identifier}, key ${key}`);
    }
    return env.ASSETS.fetch(request);
  }

  const timings: ServerTimingMetric[] = [
    { name: 'archive', desc: 'r2' },
    ...priorTimings,
    { name: 'r2', dur: r2Dur },
  ];
  const headers = new Headers({
    'Content-Type': LIVE_HTML_CONTENT_TYPE,
    'Cache-Control': LIVE_HTML_CACHE_CONTROL,
    'Server-Timing': formatServerTiming(timings),
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  const clientResponse = new Response(isHead ? null : (object.body ?? null), {
    status: 200,
    headers,
  });

  if (!isHead && cache && cacheKey) {
    // Only R2-sourced 200s for canonical archived paths are ever stored (never 301/404/503) —
    // clone before the client ever reads the body, so cache.put() gets its own untouched stream.
    const storedResponse = clientResponse.clone();
    storedResponse.headers.set('Cache-Control', `public, max-age=${ARCHIVE_EDGE_CACHE_TTL_SECONDS}`);
    ctx?.waitUntil(cache.put(cacheKey, storedResponse));
  }

  return clientResponse;
}

/** Rebuilds a cache-hit `Response` for the client: rewrites `Cache-Control` back to the
 * static-parity value (the stored copy carries the archive-TTL value instead) and overwrites
 * `Server-Timing` to report `archive;desc=edge-cache` — a hit never did a fresh KV or R2 read, so
 * the per-read `kv;dur`/`r2;dur` metrics from the original write no longer apply. */
function fromCacheHit(cached: Response): Response {
  const headers = new Headers(cached.headers);
  headers.set('Cache-Control', LIVE_HTML_CACHE_CONTROL);
  headers.set('Server-Timing', formatServerTiming([{ name: 'archive', desc: 'edge-cache' }]));
  return new Response(cached.body, { status: cached.status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx?: Ctx): Promise<Response> {
    // Only GET/HEAD navigations can ever carry a redirectable article URL or a tag path; every
    // other method (POST, etc.) falls straight through with zero KV calls.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const isGet = request.method === 'GET';
    // `undefined` on any runtime without the Cache API (or for a HEAD request, which never
    // touches the cache) — every cache-aware call below degrades to direct R2 serving.
    const cache = isGet ? getDefaultCache() : undefined;
    const cacheKey = cache ? buildCacheKey(url) : undefined;

    // Tag branch runs BEFORE uuid extraction (05-03 Task 2): a tag-shaped path never reaches the
    // KV read at all, archived or not.
    const tagMatch = matchTagPath(url.pathname);
    if (tagMatch) {
      if (tagMatch.suffix !== '') {
        return new Response(null, {
          status: TAG_SUFFIX_REDIRECT_STATUS,
          headers: { Location: `/tag/${tagMatch.slug}${url.search}` },
        });
      }
      // 05-03 Task 3: a GET checks the edge cache before the R2 read — only R2-sourced 200s for
      // this exact canonical tag path are ever stored, so a hit implies it was verified archived.
      if (cache && cacheKey) {
        const cached = await cache.match(cacheKey);
        if (cached) return fromCacheHit(cached);
      }
      return serveArchived(request, env, ctx, tagArchiveKey(tagMatch.slug), 'tag', tagMatch.slug, [], cache, cacheKey);
    }

    const uuid = extractArticleUuid(url.pathname);
    if (!uuid) {
      return env.ASSETS.fetch(request);
    }

    // 05-03 Task 3: a GET checks the edge cache before the KV read. A cache hit can only exist
    // for a path previously stored as a canonical, archived article — a non-canonical path never
    // populates this key, so a miss here falls straight through to the normal KV flow below.
    if (cache && cacheKey) {
      const cached = await cache.match(cacheKey);
      if (cached) return fromCacheHit(cached);
    }

    let entry: unknown;
    const kvStart = Date.now();
    try {
      // The one KV read this Worker ever performs, per request — PROJECT.md's "KV reads <= 1
      // per request" ceiling, and zero D1 reads (this file's whole import graph never reaches
      // the D1/KV chokepoint directory).
      entry = await env.RENDER_MANIFEST.get(`manifest:${uuid}`, 'json');
    } catch (err) {
      // T-04-27: log without request headers or cookies — just enough to diagnose a KV outage.
      console.error(
        `[worker] render-manifest KV read failed for uuid ${uuid}: ${err instanceof Error ? err.message : String(err)}`
      );
      return env.ASSETS.fetch(request);
    }
    const kvDur = Date.now() - kvStart;

    const decision = resolveRedirect(url.pathname, entry);
    if (decision.type === 'not-found') {
      return env.ASSETS.fetch(request);
    }

    if (decision.type === 'canonical') {
      // REND-08: a canonical-path static-asset miss with a valid manifest entry means "possibly
      // archived" — try R2 before falling through to the 404 page. No second KV read: the
      // articleId came from the one RENDER_MANIFEST read above.
      return serveArchived(
        request,
        env,
        ctx,
        articleArchiveKey(decision.articleId),
        'article',
        decision.articleId,
        [{ name: 'kv', dur: kvDur }],
        cache,
        cacheKey
      );
    }

    return new Response(null, {
      status: 301,
      headers: {
        Location: decision.location + url.search,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};

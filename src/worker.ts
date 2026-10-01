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
  articleArchiveKey,
  formatServerTiming,
  matchTagPath,
  tagArchiveKey,
  type ServerTimingMetric,
} from './lib/archive/archive-route.ts';

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

/**
 * Serves an archived GET/HEAD from R2 at `key`, or falls through to `env.ASSETS.fetch` when the
 * object is missing. `kind` distinguishes the two call sites only for logging: a missing
 * canonical ARTICLE object is a sync-bug signal (the manifest says it exists; R2 disagrees) and
 * is logged; a missing TAG object is the normal "this tag isn't archived" case and is silent.
 * `priorTimings` carries any Server-Timing metrics already measured before this call (the KV
 * read, for the article path) so the response's `Server-Timing` header covers the whole request.
 */
async function serveArchived(
  request: Request,
  env: Env,
  key: string,
  kind: 'article' | 'tag',
  identifier: string,
  priorTimings: ServerTimingMetric[]
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

  return new Response(isHead ? null : (object.body ?? null), { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only GET/HEAD navigations can ever carry a redirectable article URL or a tag path; every
    // other method (POST, etc.) falls straight through with zero KV calls.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);

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
      return serveArchived(request, env, tagArchiveKey(tagMatch.slug), 'tag', tagMatch.slug, []);
    }

    const uuid = extractArticleUuid(url.pathname);
    if (!uuid) {
      return env.ASSETS.fetch(request);
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
        articleArchiveKey(decision.articleId),
        'article',
        decision.articleId,
        [{ name: 'kv', dur: kvDur }]
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

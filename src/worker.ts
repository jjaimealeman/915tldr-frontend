// D-08: this project's first Worker. Runs ONLY when the static asset layer misses a request —
// Workers Static Assets serves an asset hit directly without ever invoking this handler
// (`run_worker_first` stays unset in wrangler.jsonc). Turns any URL carrying a known article uuid
// into one 301 to the canonical path (one KV read, zero D1 reads); anything else falls through to
// `env.ASSETS.fetch`, which — with `not_found_handling: "404-page"` set — serves the styled,
// build-time 404 page (404.astro) with status 404.
//
// Kept deliberately tiny: this is the request path PROJECT.md caps at 5ms Worker CPU. All
// decision logic (uuid extraction, redirect validation, the open-redirect mitigation) lives in
// `./lib/article-redirect.ts`, independently unit-tested — this file only wires the one KV read
// and builds the actual `Response`.
//
// Imports only `./lib/article-redirect.ts` (which imports only `./lib/article-url.ts`) — this
// file is in `tools/assert-no-d1.mjs`'s `ENTRYPOINT_EXACT_FILES` (Task 2), so a transitive reach
// into the D1/KV chokepoint directory that guard forbids would fail the build.
import { extractArticleUuid, resolveRedirect } from './lib/article-redirect.ts';

/**
 * Minimal local binding shapes — this project has no `@cloudflare/workers-types` dependency
 * (confirmed: not present in `node_modules`), and the plan's own instruction is to add a local
 * interface rather than a new package for this alone. `ASSETS`/`RENDER_MANIFEST` mirror exactly
 * the two bindings `wrangler.jsonc` declares (Task 2) — no more, no less.
 */
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RENDER_MANIFEST: { get(key: string, type: 'json'): Promise<unknown> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only GET/HEAD navigations can ever carry a redirectable article URL; every other method
    // (POST, etc.) falls straight through with zero KV calls.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const uuid = extractArticleUuid(url.pathname);
    if (!uuid) {
      return env.ASSETS.fetch(request);
    }

    let entry: unknown;
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

    const decision = resolveRedirect(url.pathname, entry);
    if (decision.type === 'not-found') {
      return env.ASSETS.fetch(request);
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

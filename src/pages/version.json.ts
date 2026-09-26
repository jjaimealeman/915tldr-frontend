// OPS-06: static /version.json endpoint for scripted checks. Reads the same three constants the
// footer reads (src/lib/build-info.ts) — this file computes nothing of its own, so the two
// surfaces cannot disagree (tests/unit/build-stamp.test.mjs proves it by comparing the two
// emitted artifacts, not by re-reading the shared module twice).
//
// No `export const prerender = false` here, deliberately: `output: 'static'` prerenders this
// route by the project default, so it lands as a real file at `dist/client/version.json` and
// costs zero D1 reads and zero Worker invocations to fetch — the same architecture every other
// public path in this app uses.
import type { APIRoute } from 'astro';
import { BUILD_HASH, BUILD_TIMESTAMP, BUILD_HASH_SOURCE } from '../lib/build-info';

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      commit: BUILD_HASH,
      builtAt: BUILD_TIMESTAMP,
      hashSource: BUILD_HASH_SOURCE,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

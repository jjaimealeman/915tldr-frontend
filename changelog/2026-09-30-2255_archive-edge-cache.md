# 2026-09-30 - Edge cache for archived GETs, proven through the real wrangler bundle

**Keywords:** [BACKEND] [ARCHITECTURE] [PERFORMANCE] [TESTING]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2255_archive-edge-cache.md`

## What Changed

- File: `src/worker.ts`
  - Added `getDefaultCache()` (reads `globalThis.caches?.default` via a cast — no
    `@cloudflare/workers-types` dependency), `buildCacheKey(url)` (origin + pathname, method GET,
    query string and request headers excluded) and `fromCacheHit(cached)` (rewrites a cache hit's
    `Cache-Control` back to the static-parity value and its `Server-Timing` to
    `archive;desc=edge-cache`).
  - `fetch()` now accepts an optional third `ctx: Ctx` argument (`waitUntil`). A GET checks the
    edge cache before the KV read (article paths) or before the R2 read (bare canonical tag
    paths); a hit returns immediately with zero KV/R2 calls. HEAD never touches the cache.
  - `serveArchived()` clones a fresh 200-from-R2 response before returning it: the clone's
    `Cache-Control` is rewritten to `public, max-age=300` (`ARCHIVE_EDGE_CACHE_TTL_SECONDS`) and
    stored via `ctx?.waitUntil(cache.put(...))`; the response actually returned to the client
    keeps the static-parity `Cache-Control`. Only R2-sourced 200s for canonical archived paths
    are ever stored — 301/404/503 responses are never cached.
  - On any runtime without the Cache API (`globalThis.caches` undefined), `getDefaultCache()`
    returns `undefined` and every cache-aware branch degrades to direct R2 serving — no throw.
- File: `tests/unit/worker.test.mjs`
  - Added the full Task 3 behavior suite: first-GET-miss-then-cache-put, second-GET-hit (zero
    KV/R2, different query string, Server-Timing `edge-cache`), the same for a tag path, HEAD
    never touching the cache, 301/404/503 never cached, and `globalThis.caches` undefined still
    serving correctly.
- File: `tests/unit/worker-bundle.test.mjs`
  - Added a miss-then-hit test against the real wrangler dry-run bundle for an archived tag path.
  - Fixed the Task 1 article-serving assertion's expected `Content-Type` to `text/html` (no
    charset) — this file's own expectation was stale after Task 2's header-parity fix.

## Why

Phase 5 plan 03, Task 3: R2 `get()` latency is not a known-fast number (05-RESEARCH.md Pitfall 3)
and archived content changes at most once per 2-hour build cycle, so caching R2-served responses
at the edge for 5 minutes means only the first request per cache window pays R2's latency — cheap
insurance regardless of what later live latency measurement shows, and the standard mitigation per
research, not a nice-to-have.

## Issues Encountered

- None for this task. `pnpm run typecheck` (`astro check`) fails independently of this change —
  confirmed by `git stash`-ing this task's diff and re-running: `astro check` trips
  `assert-no-d1`'s zero-candidate guard on its own content-sync pass, which only ever walks a
  real Rollup `buildEnd` graph during `astro build`, not `astro check`. Pre-existing, out of this
  task's scope (not part of this plan's verify commands), left alone.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every Task 3 behavior bullet as a named test, both against the TypeScript
  source directly and (the miss-then-hit case) against the real wrangler-bundled Worker.
- What wasn't tested: real Cloudflare edge cache behavior (cross-location propagation, actual
  TTL expiry) — only the Cache API's documented `match`/`put` contract via a fake.
- Edge cases: a cache hit for a tag path with a different query string than the one that
  populated the cache still hits (cache key excludes query string by design).

## Next Steps

- [ ] 05-04+ : further phase-5 plans (R2 client write-side, tiering wiring, live latency
      measurement, load test) continue to build on this Worker.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - completes 05-03's Worker-side archive-serving branch (REND-08, ARCH-08);
still no production behavior change (no archived content exists in R2 yet — that ships in later
plans in this phase).

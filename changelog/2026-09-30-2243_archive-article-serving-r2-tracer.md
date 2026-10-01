# 2026-09-30 - Archived articles now served from R2 on a canonical-path miss (tracer)

**Keywords:** [BACKEND] [ARCHITECTURE] [TESTING] [CONFIG]
**Session:** Evening, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2243_archive-article-serving-r2-tracer.md`

## What Changed

- File: `wrangler.jsonc`
  - Added an `r2_buckets` binding: `ARCHIVE_BUCKET` -> bucket `915tldr-archive`, with an inline
    comment recording that the Worker only ever reads this bucket (build-time writes go through
    a separate S3-compatible credential, not this binding).
- File: `src/lib/archive/archive-route.ts` (new)
  - `ARCHIVE_ARTICLE_PREFIX`, `ARCHIVE_TAG_PREFIX`, `ARCHIVE_EDGE_CACHE_TTL_SECONDS` (300)
    constants.
  - `articleArchiveKey(articleId)` — derives the R2 key `articles/<lowercased uuid>.html` from a
    validated articleId, throwing on anything that doesn't match `UUID_RE`.
- File: `src/lib/article-redirect.ts`
  - `RedirectDecision` gained a `{ type: 'canonical'; articleId: string }` variant. A
    canonical-path static-asset miss now means "possibly archived," not "loop" or "page never
    built" — the Worker uses the returned (lowercased) `articleId` to try R2 before falling
    through to the 404 page.
- File: `src/worker.ts`
  - `Env` gained `ARCHIVE_BUCKET` (minimal local `get`/`head` interface, no
    `@cloudflare/workers-types` dependency).
  - On a `canonical` decision, the Worker reads `env.ARCHIVE_BUCKET.get(articleArchiveKey(...))`
    and serves the object body as a 200 `text/html; charset=utf-8` response, or falls through to
    `env.ASSETS.fetch` when the object is missing.
- File: `tests/unit/worker-bundle.test.mjs` (new)
  - Drives the real `wrangler deploy --dry-run` bundle (not the TypeScript source) against fake
    KV/R2/ASSETS bindings: an archived article's canonical path returns 200 with the stored
    bytes, exactly one KV get, exactly one R2 get, zero ASSETS calls; a canonical path with a
    missing R2 object falls through to ASSETS. Skips cleanly (never fails) if the dry-run output
    is absent.
- File: `tests/unit/article-redirect.test.mjs`
  - Updated the canonical-path test for the new `canonical` decision shape; added a case proving
    the returned `articleId` is lowercased.

## Why

Phase 5 plan 03, Task 1 (tracer): REND-08 requires an archived article's canonical URL to fall
through the static-asset layer to the Worker and be served from R2, using the same single KV read
the Worker already performs (ARCH-08's <=1 KV read budget) — no second lookup, no stored `r2Key`
in the manifest. The R2 key is derived fresh from the validated articleId on every request
instead, which stays race-free across both hot->archive and archive->hot transitions (recorded as
a deliberate decision in 05-03-PLAN.md's objective, overriding 05-RESEARCH.md's manifest-v3
proposal).

## Issues Encountered

- `archive-route.ts` initially imported `UUID_RE` from `./article-url.ts` (same directory) —
  the real module lives one directory up at `src/lib/article-url.ts`. Caught immediately by
  `wrangler deploy --dry-run`'s bundler failing to resolve the specifier; fixed before any test
  ran. Same class of bug as 05-01's `tier-facts.ts` import-path deviation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the real wrangler-bundled Worker (via a dry-run build), proving the archive
  branch exists in what actually gets deployed, not just the TypeScript source; the updated
  `resolveRedirect` canonical-decision shape, including case-lowercasing.
- What wasn't tested: tag-path archive serving, HEAD requests, R2 error handling (503), the edge
  cache, and live R2 latency — all deferred to Task 2/3 of this same plan.
- Edge cases: a canonical article path whose R2 object is missing (falls through to the static
  404 page, not a 500).

## Next Steps

- [ ] Task 2: tag archive path, suffix parity, HEAD, 503 on R2 error, Server-Timing, per-shape KV
      matrix (05-03-PLAN.md).
- [ ] Task 3: edge cache for archived GETs via `caches.default`.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - adds the first read path from a new storage tier (R2) to the public Worker;
no production behavior changes yet (no archived content exists in R2 until 05-02/05-07 ship).

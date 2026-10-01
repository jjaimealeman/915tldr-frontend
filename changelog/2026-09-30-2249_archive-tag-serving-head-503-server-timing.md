# 2026-09-30 - Archived tags, HEAD, 503 handling and Server-Timing for the archive branch

**Keywords:** [BACKEND] [ARCHITECTURE] [TESTING] [SECURITY]
**Session:** Evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2249_archive-tag-serving-head-503-server-timing.md`

## What Changed

- File: `src/lib/archive/archive-route.ts`
  - Added `matchTagPath(pathname)` — matches `/tag/<slug>` with an optional `/` or `.html`
    suffix, decoding and validating the slug against `TAG_SLUG_RE` before accepting it.
  - Added `tagArchiveKey(slug)` — derives the R2 key `tags/<slug>.html`, throwing on an invalid
    slug.
  - Added `formatServerTiming(metrics)` — formats a list of `{ name, desc?, dur? }` into the
    `Server-Timing` header's wire format.
- File: `src/worker.ts`
  - Branch order reorganized: method check -> tag-path match (suffix -> 307 redirect from the
    validated slug + `url.search`; bare canonical -> archive-serve, zero KV reads) -> uuid
    extraction -> the one KV read -> decision.
  - New `serveArchived()` helper owns GET vs HEAD (uses `ARCHIVE_BUCKET.head` for HEAD, never
    `get`), the 200/404-fallthrough/503 statuses, and headers (`Content-Type`, `Cache-Control`,
    `ETag`, `Server-Timing`) for both the article and tag archive paths.
  - An R2 read that throws now answers 503 with `Retry-After: 60` and `Cache-Control: no-store`
    instead of propagating the error — archived pages never look like a 404 to a crawler during
    a brief R2 outage.
  - **Fixed Task 1's `Content-Type` to match the live static layer exactly**: measured
    `dev.915tldr.com` directly (`curl -sD -`) and found the live header is `text/html` with no
    `; charset=utf-8` parameter — Task 1's placeholder value was overwritten here (see Issues
    Encountered).
- File: `tests/unit/worker.test.mjs`
  - Extended with the tag branch, HEAD, 503, Server-Timing and live-measured-header tests, plus
    the full ARCH-08 per-request-shape KV-count matrix (12 shapes, each asserted at exactly 0 or
    1 KV call).
- File: `tests/unit/archive-route.test.mjs` (new)
  - Unit coverage for `matchTagPath`, `tagArchiveKey`, `formatServerTiming`.

## Why

Phase 5 plan 03, Task 2: archived tag pages must be served from R2 with zero KV reads (a new
keyspace is not needed — the R2 key is derived straight from the validated slug), archived
responses must be indistinguishable from static ones at the header level (Content-Type,
Cache-Control, ETag), and an R2 outage must never read as "page gone" to a crawler. The KV-count
matrix is the structural proof for ARCH-08 (<=1 KV read per request) across every request shape
this Worker can see.

## Issues Encountered

- Task 1 shipped `Content-Type: text/html; charset=utf-8` for archived responses without having
  measured the live static layer's own value. This task's `<read_first>` step required measuring
  `dev.915tldr.com` live first — it turned out the real value is `text/html`, no charset
  parameter. Fixed here (Rule 1: the must_haves truth requires header parity, so the Task 1
  placeholder was a real correctness gap, not a style choice) — not a new deviation commit, folded
  into this task's own GREEN implementation since Task 1's narrower behavior tests didn't pin the
  exact Content-Type string.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in 05-03-PLAN.md's Task 2 as a named test — tag serving,
  tag-suffix redirects (307, measured live), HEAD using `.head()` not `.get()`, 503 on R2 error
  with no leaked request-header values, Content-Type/Cache-Control/ETag parity, Server-Timing
  contents, and the full KV-count matrix.
- What wasn't tested: the edge cache (Task 3), live R2 latency, and a real deployed Worker
  (deferred to later plans in this phase).
- Edge cases: `/tag/foo-<uuid>` (a tag slug that happens to contain uuid-shaped characters) is
  matched as a tag, not an article, with zero KV calls — the tag branch runs first.

## Next Steps

- [ ] Task 3: edge cache for archived GETs via `caches.default`, re-proven through the wrangler
      dry-run bundle.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - extends the archive-serving Worker branch; still no production behavior
change (no archived content exists in R2 yet).

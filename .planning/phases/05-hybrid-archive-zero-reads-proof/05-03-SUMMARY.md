---
phase: 05-hybrid-archive-zero-reads-proof
plan: 03
subsystem: infra
tags: [cloudflare-workers, r2, kv, caches-api, worker, archive-tier, node-test]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "src/worker.ts's existing Phase 4 redirect branch (extractArticleUuid/resolveRedirect,
      one RENDER_MANIFEST KV read per request) this plan extends rather than replaces"
provides:
  - "src/lib/archive/archive-route.ts: articleArchiveKey, matchTagPath, tagArchiveKey,
    formatServerTiming, ARCHIVE_ARTICLE_PREFIX/ARCHIVE_TAG_PREFIX/ARCHIVE_EDGE_CACHE_TTL_SECONDS —
    pure R2-key derivation and tag-path matching the Worker bundles directly"
  - "src/lib/article-redirect.ts: RedirectDecision's new 'canonical' variant — a canonical-path
    static-asset miss now means 'possibly archived', not 'loop' or 'page never built'"
  - "src/worker.ts: the archive-serving branch (REND-08) — archived articles and tags served from
    R2 with static-parity headers, HEAD via ARCHIVE_BUCKET.head, 503+Retry-After on R2 outage,
    Server-Timing (kv;dur/r2;dur/archive;desc), and an edge-cache layer via caches.default
    (ARCH-08: still exactly one KV read per request, never more)"
  - "wrangler.jsonc: r2_buckets binding ARCHIVE_BUCKET -> 915tldr-archive (read-only from the
    Worker's own binding; build-time writes go through 05-02's separate S3-compatible credential)"
affects: [05-04, 05-05, 05-07, 05-11, 05-12]

# Actuals (#2632)
actuals:
  tokens: 15045
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "R2 keys derived fresh from a validated identifier on every request (articleArchiveKey/
      tagArchiveKey), never stored in the render manifest — race-free across both hot->archive
      and archive->hot transitions, and avoids a schema bump mid-build (05-03-PLAN.md's own
      recorded design decision, overriding 05-RESEARCH.md's manifest-v3 proposal)."
    - "Live-measurement-before-code: before writing any header-matching assertion, curl the real
      dev.915tldr.com page/tag/redirect and record the exact byte values (Content-Type has no
      charset param; Cache-Control is 'public, max-age=0, must-revalidate'; tag-suffix redirects
      are 307) rather than assuming a conventional value."
    - "Cache-aware serving: check globalThis.caches?.default before the KV/R2 read; store only
      verified 200s via ctx.waitUntil(cache.put(...)) with a cloned, TTL-rewritten response, while
      the client response keeps the live-parity headers — same clone-before-mutate discipline as
      the rest of this Worker's header handling."

key-files:
  created:
    - src/lib/archive/archive-route.ts
    - tests/unit/worker-bundle.test.mjs
    - tests/unit/archive-route.test.mjs
  modified:
    - wrangler.jsonc
    - src/lib/article-redirect.ts
    - src/worker.ts
    - tests/unit/article-redirect.test.mjs
    - tests/unit/worker.test.mjs

key-decisions:
  - "R2 keys for archived pages are derived fresh from the validated articleId/slug on every
    request, not stored in a v3 render-manifest field (05-03-PLAN.md's own objective, overriding
    05-RESEARCH.md Pattern 1's manifest-v3 proposal) — the Worker already holds a validated
    articleId after its one KV read, so a stored key adds nothing, and this stays race-free in
    both transition directions."
  - "Measured dev.915tldr.com live before writing Task 2's header-parity tests: static HTML
    Content-Type is exactly 'text/html' (no charset param), Cache-Control is
    'public, max-age=0, must-revalidate', and tag-suffix redirects are 307 — all three now pinned
    by tests and matched exactly by the archive-serving branch."
  - "Task 1's placeholder Content-Type ('text/html; charset=utf-8') was corrected in Task 2 once
    the live value was measured — documented as a deviation below, not silently changed."

requirements-completed: [REND-08, ARCH-08]

coverage:
  - id: D1
    description: "An archived article's canonical URL, on a static-asset miss, is served from
      R2 by the real wrangler-bundled Worker using the same one KV read the Phase 4 redirect
      branch already performs"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/worker-bundle.test.mjs#worker-bundle: a GET for an archived article canonical path is served from R2 with one KV get, one R2 get, zero ASSETS calls"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: a canonical article path with an archived R2 object is served 200 from R2 with one KV get, one R2 get, zero ASSETS calls"
        status: pass
    human_judgment: false
  - id: D2
    description: "An archived tag page is served from R2 with zero KV reads; a missing archived
      tag object falls through to the styled 404 page"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: GET /tag/<slug> with an archived R2 object is served 200 with zero KV calls, one R2 get, Server-Timing naming r2"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: GET /tag/<slug> with no R2 object falls through to env.ASSETS.fetch with no console.error"
        status: pass
    human_judgment: false
  - id: D3
    description: "ARCH-08 concurrency: every request shape performs at most one KV get, proven
      by an explicit per-shape matrix (article canonical/non-canonical/unknown, tag bare/suffix,
      no-uuid, POST, HEAD, KV throw, R2 throw, R2 miss)"
    requirement: "ARCH-08"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: KV get count matrix — every request shape performs 0 or 1 KV get, never more"
        status: pass
    human_judgment: false
  - id: D4
    description: "An R2 read failure answers 503 with Retry-After and Cache-Control no-store
      (never a 404), and never leaks request header values into the log line"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: an R2 get that throws answers 503 with Retry-After and Cache-Control no-store, and never logs the request header value"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: an R2 head that throws (HEAD request) answers 503 with Retry-After and Cache-Control no-store"
        status: pass
    human_judgment: false
  - id: D5
    description: "Archived 200 responses carry the live-measured Content-Type/Cache-Control and
      an ETag from R2; a repeat GET is served from the edge cache with zero KV/R2 reads and the
      static-parity Cache-Control restored on the client response"
    verification:
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: archived 200 responses carry the live-measured Content-Type, Cache-Control and an ETag from the R2 object"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: a second GET for the same archived article path (different query string) is served from the cache with zero KV and zero R2 calls, Server-Timing names edge-cache, Cache-Control rewritten to static-parity"
        status: pass
      - kind: unit
        ref: "tests/unit/worker-bundle.test.mjs#worker-bundle: an archived tag path — first GET misses the edge cache (R2 serves it, gets cached); second GET is served from the cache with zero R2 calls (05-03 Task 3)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-30
status: complete
---

# Phase 5 Plan 3: Archive-Serving Worker (R2) Summary

**The Worker now serves archived articles and tags from R2 on a static-asset miss — same single
KV read, HEAD/503/Server-Timing/edge-cache all added, headers matched byte-for-byte against a
live measurement of dev.915tldr.com, proven against the real wrangler-bundled Worker.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-30T22:39:00-06:00 (approx. — context/plan read began immediately before)
- **Completed:** 2026-09-30T22:57:16-06:00
- **Tasks:** 3 (Task 1 tracer + TDD, Task 2 auto + TDD, Task 3 auto + TDD)
- **Files modified:** 8 (3 new, 5 modified)

## Accomplishments

- `src/worker.ts`'s archive-serving branch: a canonical-path static-asset miss with a valid
  manifest entry tries R2 before falling through to the 404 page (REND-08), and a bare
  `/tag/<slug>` path is tried from R2 with **zero** KV reads — the tag branch runs before uuid
  extraction so a tag-shaped path never reaches the KV read at all.
- `tests/unit/worker.test.mjs`'s KV-count matrix structurally proves ARCH-08 across 12 distinct
  request shapes (article canonical/non-canonical/unknown-uuid, tag bare/trailing-slash/`.html`,
  no-uuid, POST, HEAD, KV-throws, R2-throws, R2-miss) — every shape performs exactly 0 or 1 KV
  `get()`, never more.
- Archived 200 responses are indistinguishable from a live static page at the header level:
  `Content-Type: text/html` (measured live, no charset param), `Cache-Control: public,
  max-age=0, must-revalidate` (measured live), and an `ETag` sourced from the R2 object.
- An R2 outage answers `503` with `Retry-After: 60` and `Cache-Control: no-store` — never a
  `404` that would tell a crawler the page is gone — and never logs a request header value.
- Repeat GETs for the same archived path are served from `caches.default` with zero KV and zero
  R2 reads; only R2-sourced 200s for canonical archived paths are ever cached (never 301/404/503),
  and the client always sees the static-parity `Cache-Control` even though the stored copy
  carries `public, max-age=300`.
- `tests/unit/worker-bundle.test.mjs` drives the real `wrangler deploy --dry-run` bundle (not
  just the TypeScript source) for both the article-serving tracer and the Task 3 cache
  miss-then-hit sequence — the dry-run binding listing shows exactly `ARCHIVE_BUCKET` (R2),
  `RENDER_MANIFEST` (KV), `ASSETS`, nothing else.

## Task Commits

Each task ran its own genuine TDD RED/GREEN cycle (confirmed RED before writing GREEN code in
Tasks 2 and 3; Task 1 is the tracer):

1. **Task 1 (tracer + TDD):** `8e5a613` (feat) — `wrangler.jsonc` r2_buckets binding,
   `src/lib/archive/archive-route.ts` (`articleArchiveKey`), `src/lib/article-redirect.ts`'s new
   `canonical` decision, `src/worker.ts`'s R2-serve branch, `tests/unit/worker-bundle.test.mjs`
   driving the real dry-run bundle.
2. **Task 2 (auto + TDD):** `e4c6165` (feat) — `matchTagPath`/`tagArchiveKey`/`formatServerTiming`,
   the tag archive branch, HEAD support, 503 on R2 error, Server-Timing, and the full ARCH-08
   KV-count matrix (12 shapes).
3. **Task 3 (auto + TDD):** `470a55d` (feat) — edge cache via `caches.default`, `ctx.waitUntil`
   writes, cache-hit header rewriting, re-proven through the bundle.

**Plan metadata:** pending (this SUMMARY's own commit).

## Files Created/Modified

- `wrangler.jsonc` - adds the `r2_buckets` binding (`ARCHIVE_BUCKET` -> `915tldr-archive`)
- `src/lib/archive/archive-route.ts` - pure R2-key derivation, tag-path matching, Server-Timing
  formatting
- `src/lib/article-redirect.ts` - `RedirectDecision` gains a `canonical` variant
- `src/worker.ts` - the archive-serving branch: tag routing, `serveArchived()`, edge cache
- `tests/unit/worker-bundle.test.mjs` - drives the real wrangler dry-run bundle (new)
- `tests/unit/archive-route.test.mjs` - unit coverage for the new pure functions (new)
- `tests/unit/article-redirect.test.mjs` - updated for the `canonical` decision shape
- `tests/unit/worker.test.mjs` - extended with the full archive-branch behavior suite + matrix

## Decisions Made

- R2 keys are derived fresh from the validated articleId/slug on every request rather than
  stored in a v3 render-manifest field — this plan's own objective overrides
  05-RESEARCH.md Pattern 1's manifest-v3 proposal for the reasons recorded in 05-03-PLAN.md.
- Measured `dev.915tldr.com` live (via `curl -sD -`) before writing Task 2's header-parity tests,
  rather than assuming a conventional `Content-Type`/`Cache-Control`/redirect-status value — the
  real values (`text/html` with no charset, `public, max-age=0, must-revalidate`, 307) are now
  pinned by tests and matched exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a wrong relative import path in archive-route.ts**
- **Found during:** Task 1, first `wrangler deploy --dry-run` attempt
- **Issue:** `archive-route.ts` (at `src/lib/archive/archive-route.ts`) imported `./article-url.ts`,
  which resolves to the non-existent `src/lib/archive/article-url.ts` — the real module is one
  directory up at `src/lib/article-url.ts`. Wrangler's bundler failed immediately with a clear
  `Could not resolve` error. Same class of bug as 05-01's `tier-facts.ts` deviation.
- **Fix:** Changed the import to `../article-url.ts`.
- **Files modified:** `src/lib/archive/archive-route.ts`
- **Verification:** The dry-run build completed cleanly on the next attempt, binding listing
  showed all three expected bindings.
- **Committed in:** `8e5a613` (Task 1 commit — caught before that commit was made, so no
  separate fix commit was needed).

**2. [Rule 1 - Bug] Corrected the archived-response Content-Type to match the live static layer exactly**
- **Found during:** Task 2's `<read_first>` live-measurement step
- **Issue:** Task 1 shipped `Content-Type: text/html; charset=utf-8` for archived responses
  without first measuring the live static layer's own value. Measuring `dev.915tldr.com` live
  showed the real value is `text/html` with no charset parameter — a real header-parity gap
  against this plan's own must_haves truth ("Archived responses carry the same Content-Type ...
  as a live static HTML page").
- **Fix:** Changed the archived-response `Content-Type` to `text/html`, matching the measured
  live value exactly; updated `tests/unit/worker-bundle.test.mjs`'s Task 1 assertion to match.
- **Files modified:** `src/worker.ts`, `tests/unit/worker-bundle.test.mjs`
- **Verification:** `tests/unit/worker.test.mjs`'s new header-parity test pins the exact string;
  full suite re-run green.
- **Committed in:** `e4c6165` (Task 2 commit — folded into Task 2's own GREEN implementation
  since Task 1's narrower behavior tests never pinned the exact Content-Type string).

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both caught before any production impact —
no archived content exists in R2 yet, so no live request was ever served the wrong header).
**Impact on plan:** No scope creep. Both fixes are corrections to this same plan's own earlier
tasks, applied before the affected task's commit (import path) or in the very next task once the
gap was measured (Content-Type).

## Issues Encountered

- `pnpm run typecheck` (`astro check`) fails independently of every change in this plan —
  confirmed via `git stash` that the same failure occurs on the pre-existing codebase. `astro
  check` runs a content-sync pass that never produces a real Rollup `buildEnd` graph, so the
  `assert-no-d1` guard's "zero candidates matched" fail-loud path trips every time `astro check`
  runs, independent of this plan's code. Not in this plan's verify commands; left alone per the
  scope boundary (out-of-scope pre-existing condition).

## User Setup Required

None - no external service configuration required. (05-02's R2 write credential and bucket
creation remain a separate, still-blocked owner checkpoint — this plan only adds the Worker's
*read-only* R2 binding, which needs no credential of its own.)

## Next Phase Readiness

- `src/worker.ts` now has the full archive-serving read path (REND-08, ARCH-08) ready for later
  plans in this phase to exercise against real archived content once 05-02 (R2 write credential)
  and 05-07 (archive sync) ship.
- `wrangler.jsonc`'s `ARCHIVE_BUCKET` binding points at `915tldr-archive`, which does not yet
  exist as a real bucket (05-02 is still blocked on an owner checkpoint) — the binding itself is
  config-only and does not require the bucket to exist for `wrangler deploy --dry-run` or any of
  this plan's tests, all of which use fakes. A real `wrangler deploy` (not dry-run) against this
  Worker before 05-02 completes would need the bucket to exist in the account first; that
  ordering is for a later plan/deploy step to handle, not a blocker here.
- `pnpm run test:fast` (468/468), `pnpm run test:build-gate` (8/8) and `pnpm run guard:config`
  all pass clean after this plan's changes. No blockers.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 8 key files confirmed present on disk; all 3 cited task commit hashes (`8e5a613`,
`e4c6165`, `470a55d`) confirmed present in `git log --oneline --all`.

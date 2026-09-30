---
phase: 04-static-generation-templates-seo
plan: 01
subsystem: content-pipeline
tags: [astro, content-layer, d1, cloudflare-kv, zod, wrangler, tdd]

# Dependency graph
requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "src/lib/server/d1-client.ts and kv-manifest.ts chokepoint modules, the 915tldr-render-manifest KV namespace, the D1-import assertion (tools/assert-no-d1.mjs), the bulk-fetch+stitch query shape measured in docs/phase-03/d1-pagination-report.md"
provides:
  - "A hand-written Astro Content Layer Loader (articlesLoader) syncing a 3-day D1 window with digest-based incremental change detection and a D-14 empty-store fail-loud guarantee"
  - "Canonical article URL builder (articlePath/articleParams, src/lib/article-url.ts) using the stored articles.slug column (D-07), never re-derived from the title"
  - "fetchPublicArticlesWindow() — the bulk-fetch + in-memory-stitch D1 query shape scoped to a window, applying v1's public filter (processed, non-duplicate, categorized)"
  - "Render manifest schema v2 (slug field, D-08) — one KV read away from a zero-D1-read non-canonical-URL redirect for a future Worker (plan 04-06)"
  - "astro.config.mjs: trailingSlash: 'never' + build.format: 'file', site pointed at the production origin"
  - "Measured answer to RESEARCH Open Question 1 (a Loader throw does fail astro build) and the trailing-slash 307-vs-301 finding, recorded in docs/phase-04/spikes.md"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 20444
  tasks: 3
  commits: 5

tech-stack:
  added: ["Astro Content Layer Loader API (astro/loaders)", "astro/zod (Zod 4 top-level validators)"]
  patterns:
    - "Content Layer custom Loader with meta (cross-build watermark) and generateDigest (per-entry change fingerprint), test-seamed via a deps parameter (now/fetchWindow/writeManifest)"
    - "Bulk-fetch + in-memory-stitch D1 query shape scoped to a published_at window, chunked at D1_MAX_BOUND_PARAMS for IN-list joins"
    - "Manifest schema version bump discipline: MANIFEST_SCHEMA_VERSION exported constant, validateManifestEntry() extended with the new field's format check, drift-guarded against wrangler.jsonc's committed namespace id"

key-files:
  created:
    - src/lib/article-url.ts
    - src/content/loaders/articles-loader.ts
    - src/content.config.ts
    - tests/helpers/html-text.mjs
    - tests/unit/html-text.test.mjs
    - tests/unit/d1-client.test.mjs
    - tests/unit/articles-loader-window.test.mjs
    - docs/phase-04/spikes.md
  modified:
    - astro.config.mjs
    - src/lib/server/d1-client.ts
    - src/lib/server/kv-manifest.ts
    - src/pages/[category]/[slug].astro
    - tests/tracer/tracer.test.mjs
    - tests/unit/manifest-schema.test.mjs
    - tests/unit/build-stamp.test.mjs
    - docs/phase-03/render-manifest.md
    - package.json

key-decisions:
  - "Bulk-fetch + in-memory-stitch D1 query shape scoped to a 3-day window (not the corpus-wide ARTICLE_SELECT correlated-subquery shape) — measured 957,008 rows/full-pass in Phase 3 vs. 11,466,920 for the old shape; this plan's real 324-article window measured 5,926 rows"
  - "store.set()'s own boolean return value is the digest-changed signal — confirmed by reading Astro's own mutable-data-store.js source rather than assumed, per the plan's own instruction to verify before relying on it"
  - "RENDER_MANIFEST_KV_NAMESPACE_ID falls back in code to the already-committed namespace id (RENDER_MANIFEST_NAMESPACE_ID) when the env var is unset — isolated git worktrees and Workers Builds containers don't have the gitignored .dev.vars"
  - "Trailing-slash redirect measured at 307, not 301 — Cloudflare's native html_handling never emits 301 in any mode; recorded as a named deviation from CONTEXT.md's literal wording in docs/phase-04/spikes.md, not silently accepted or worked around with a Worker-mediated redirect"
  - "A Content Layer Loader throw DOES fail astro build with a non-zero exit, identically to a getStaticPaths() throw (RESEARCH Open Question 1 / Assumption A1) — proven by a real invalid-token build spike, not assumed"

patterns-established:
  - "Loader test seams: articlesLoader(deps?) accepts now/fetchWindow/writeManifest overrides for hermetic testing against a Map-backed fake LoaderContext — production code never passes them"
  - "D1 window-fetch shape: fetchPublicArticlesWindow(sinceEpoch, opts?) — one un-joined articles query, chunked category/tag IN-list lookups, one sources query, stitched in memory, returning typed publicArticles/nonPublic arrays with a reason"

requirements-completed: [REND-01, REND-02, SEO-04]

coverage:
  - id: D1
    description: "A real article published in D1 within the last 3 days is served at its canonical stored-slug URL with HTTP 200 and no Location header"
    requirement: "SEO-04"
    verification:
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#live: canonical path returns 200 with no Location header; trailing-slash variant redirects to it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every article URL's slug segment equals the stored articles.slug column byte-for-byte; no page derives a slug from a title"
    requirement: "REND-01"
    verification:
      - kind: unit
        ref: "tests/tracer/tracer.test.mjs#every emitted article filename slug segment matches ARTICLE_SLUG_RE"
        status: pass
      - kind: other
        ref: "grep -rlE \"from ['\\\"][./]*lib/slug\" src/pages | wc -l  ->  0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every article the loader synced has a KV entry manifest:{uuid} with schemaVersion '2' and a slug field equal to the page's slug segment"
    requirement: "REND-01"
    verification:
      - kind: unit
        ref: "tests/tracer/tracer.test.mjs#sampled files: manifest entry is v2 with slug equal to the filename slug, and the <h1> title round-trips decoded"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#MANIFEST_SCHEMA_VERSION is \"2\" (D-08: slug bump)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A build whose loader cannot read D1 (invalid API token) exits non-zero and its output names the d1-client failure"
    requirement: "REND-02"
    verification:
      - kind: other
        ref: "docs/phase-04/spikes.md#Spike 1 — CLOUDFLARE_API_TOKEN=invalid-token-for-spike pnpm run build, exit code 1, d1-client 401 line quoted"
        status: pass
    human_judgment: false
  - id: D5
    description: "A build whose loader ends with an empty store exits non-zero (D-14: zero rows is always a failure)"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/articles-loader-window.test.mjs#an empty store after sync throws with \"store is empty\""
        status: pass
    human_judgment: false
  - id: D6
    description: "The tracer test passes for titles containing an apostrophe or an ampersand (folded todo 2026-09-26-tracer-test-html-entity-title)"
    verification:
      - kind: unit
        ref: "tests/unit/html-text.test.mjs#decodeEntities decodes a named apostrophe and ampersand entity"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 01: Content Layer Loader, Canonical URLs & Manifest v2 Summary

**A hand-written Astro Content Layer Loader now syncs a 3-day D1 window into 328 real article pages built at their stored-slug canonical URLs, live on dev.915tldr.com with schema-v2 KV manifest entries and a measured (not assumed) proof that a loader failure fails the build.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-26T22:52:51Z (STATE.md, Phase 4 execution start)
- **Completed:** 2026-09-26T23:15:00Z
- **Tasks:** 3
- **Files modified:** 17 (9 created, 8 modified in application/test code; plus docs and package.json)

## Accomplishments

- Proved the whole Phase 4 architecture end-to-end on one thin slice: a real Content Layer
  `Loader` (not `getStaticPaths()` calling `d1-client.ts` directly) reads D1, renders 328 real
  article pages at their stored-slug canonical URLs, and writes schema-v2 KV manifest entries —
  live and verified on `dev.915tldr.com`.
- Answered RESEARCH Open Question 1 by measurement: a throw inside `Loader.load()` fails
  `astro build` with exit code 1, naming the `d1-client` failure directly — REND-02/REND-03's
  fail-loud guarantee can rest on this mechanism.
- Locked the slice down with 33 new/updated unit tests plus a rewritten, corpus-sampling tracer
  test — folding in the pending apostrophe/ampersand tracer-title bug fix along the way.
- Measured the warm-window D1 cost (5,926 rows for a 324-article, 3-day window) — 0.036x
  PROJECT.md's daily soft budget even at 12 cycles/day, confirming the incremental-window
  approach the Phase 3 binding constraint required.

## Task Commits

Each task was committed atomically (Task 2, tdd="true", produced RED/GREEN pairs plus one
characterization-test commit):

1. **Task 1: End-to-end tracer** (tracer type) - `9ee58d8` (feat)
2. **Task 2: Lock the slice with tests** (tdd="true") - `7597efe` (test, RED) → `29e59dc` (feat,
   GREEN) → `92d7037` (test, remaining characterization coverage — see "TDD Gate Compliance" below)
3. **Task 3: Spike 1 + docs** - `823e02b` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified

- `src/lib/article-url.ts` - `articlePath()`/`articleParams()`/`UUID_RE`/`ARTICLE_SLUG_RE`/`CATEGORY_SLUG_RE`, no imports from `src/lib/server/`
- `src/lib/server/d1-client.ts` - `queryD1WithMeta()`, `D1_MAX_BOUND_PARAMS`/`chunkIds()`, `fetchPublicArticlesWindow()`
- `src/lib/server/kv-manifest.ts` - `MANIFEST_SCHEMA_VERSION` bumped to `'2'`, `slug` field, `RENDER_MANIFEST_NAMESPACE_ID` env fallback
- `src/content/loaders/articles-loader.ts` - `articlesLoader(deps?)`, `articleSchema`, `SYNC_WINDOW_SECONDS`
- `src/content.config.ts` - `defineCollection({ loader: articlesLoader() })`
- `src/pages/[category]/[slug].astro` - rewritten to `getCollection('articles')`, harness branch removed
- `astro.config.mjs` - `trailingSlash: 'never'`, `build.format: 'file'`, `site` -> production origin
- `tests/helpers/html-text.mjs` - `decodeEntities()`/`textOf()`
- `tests/unit/html-text.test.mjs`, `tests/unit/d1-client.test.mjs`, `tests/unit/articles-loader-window.test.mjs` - new unit coverage
- `tests/unit/manifest-schema.test.mjs` - fixtures updated for schema v2, slug/drift-guard tests added
- `tests/unit/build-stamp.test.mjs` - `findArticleHtmlFiles()` fixed for `build.format: 'file'` output shape (Rule 1)
- `tests/tracer/tracer.test.mjs` - rewritten for corpus sampling and entity-safe title comparison
- `docs/phase-04/spikes.md` - Spike 1, warm-window cost, trailing-slash findings
- `docs/phase-03/render-manifest.md` - "v2 (Phase 4, D-08)" section added
- `package.json` - `test:fast` script added

## Decisions Made

- Bulk-fetch + in-memory-stitch D1 query shape scoped to a 3-day window, per planner_findings —
  avoids the 11.5M-rows/day-over-budget correlated-subquery shape.
- `store.set()`'s own boolean return value confirmed (by reading Astro's own source) as the
  digest-changed signal — no separate `store.get()` comparison needed.
- `RENDER_MANIFEST_KV_NAMESPACE_ID` falls back to the already-committed namespace id in code,
  since isolated worktrees and Workers Builds won't have `.dev.vars`.
- Trailing-slash redirect is 307, not 301 — recorded as a named deviation from CONTEXT.md's
  wording, not silently accepted or worked around.
- A Content Layer Loader throw does fail `astro build` — confirmed by a real spike, not assumed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/unit/build-stamp.test.mjs` broke against `build.format: 'file'`**
- **Found during:** Task 3 (running `pnpm run test:fast` for the first time)
- **Issue:** `findArticleHtmlFiles()` looked for `index.html` under `dist/client` — the
  `build.format: 'directory'` shape from before Task 1 set `build.format: 'file'`. All 3
  cross-surface tests in this file were failing with `ERR_INVALID_ARG_TYPE` (reading an
  out-of-bounds array element).
- **Fix:** Rewrote the file-discovery helper to match the `<slug>-<uuid>.html` shape, mirroring
  the same regex `tests/tracer/tracer.test.mjs` uses.
- **Files modified:** `tests/unit/build-stamp.test.mjs`
- **Verification:** `node --test tests/unit/build-stamp.test.mjs` — 8/8 passing.
- **Committed in:** `823e02b` (Task 3 commit)

**2. [Rule 1 - Bug] `tests/unit/manifest-schema.test.mjs` fixtures predated the schema-v2 bump**
- **Found during:** Task 2, before writing any new tests (ran the existing suite first to
  establish a true baseline)
- **Issue:** `makeRow()` didn't carry `slug`, so 3 of 25 existing tests failed against Task 1's
  `MANIFEST_SCHEMA_VERSION` bump (which requires `slug`).
- **Fix:** Added `slug` to the fixture; added new slug-validation and drift-guard tests in the
  same edit.
- **Files modified:** `tests/unit/manifest-schema.test.mjs`
- **Verification:** `node --test tests/unit/manifest-schema.test.mjs` — 28/28 passing.
- **Committed in:** `92d7037` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs directly caused by this plan's own earlier
changes: `build.format: 'file'` and the manifest schema-v2 bump).
**Impact on plan:** Both fixes necessary to keep the pre-existing test suite green after this
plan's own changes. No scope creep — neither fix touched application behavior, only test
file-discovery logic.

## TDD Gate Compliance

Task 2 (`tdd="true"`) produced a genuine RED/GREEN pair for the one piece of net-new behavior it
introduced (`tests/helpers/html-text.mjs`'s `decodeEntities`/`textOf`): `7597efe` (test, RED —
confirmed failing with `ERR_MODULE_NOT_FOUND` before the GREEN commit) → `29e59dc` (feat, GREEN).
The remainder of Task 2's scope (`d1-client.test.mjs`, `articles-loader-window.test.mjs`, the
`manifest-schema.test.mjs` update, and the tracer rewrite) is characterization testing against
Task 1's already-implemented and already-committed code, following the plan's own instruction
("write the tests first (RED), then fix any Task 1 code they expose (GREEN)") — these tests were
run against the unmodified suite first to confirm a genuine baseline (3 pre-existing failures in
`manifest-schema.test.mjs`, fixed as Deviation 2 above), then committed together as `92d7037`
once verified green, since no Task 1 production-code defect was exposed by the new coverage. This
single combined commit does not carry a separate `test(...)` → `feat(...)` pair of its own; it is
recorded here per the executor's TDD-gate-compliance instruction rather than silently omitted.

## Issues Encountered

None beyond the two Rule 1 fixes documented above. `store.set()`'s change-detection semantics and
Zod 4's `z.url({ protocol })` option were both confirmed by reading `node_modules` source directly
before relying on them, per the plan's own explicit instruction — no surprises there.

## Known Stubs

None. The rewritten `[category]/[slug].astro` renders real D1-backed data end-to-end with no
placeholder values; it intentionally omits the rail/tags/disclosure/attribution markup the plan
scopes to 04-04 (not a stub — an explicitly deferred expansion, stated in the page's own header
comment).

## Cleanup needed (run these yourself)

Per this plan's owner instruction, the following pre-existing deletions were left unstaged and
this task did not touch them further (they are now fully unreferenced by application code, but
still imported by `tools/verify-edge-headers.mjs`, owned by plan 04-12):

```
rm /home/jaime/www/_github/915tldr.com/src/lib/slug.ts
rm /home/jaime/www/_github/915tldr.com/src/lib/render-cost-harness.ts
rm /home/jaime/www/_github/915tldr.com/tools/measure-render-cost.mjs
```

Also remove the now-dead `measure:render` script from `package.json` (references the
`tools/measure-render-cost.mjs` file above) when those files are deleted:
```json
"measure:render": "node tools/measure-render-cost.mjs",
```

`tools/verify-edge-headers.mjs` still imports `../src/lib/slug.ts` (line 121) — it will throw a
module-not-found error the moment that file is actually deleted from disk. Plan 04-12 owns this
fix (per this plan's project rules); not addressed here since this plan's own verification never
needed `pnpm run verify:edge` to run (Task 1 verified deployment via a direct `curl`, not that
script).

A genuinely cold-cache build measurement (`rm -rf node_modules/.astro` then `pnpm run build`) to
confirm the cold-vs-warm `rowsRead` delta was not performed in this session — `rm -rf` is
sandbox-blocked in this execution environment (see `docs/phase-04/spikes.md`'s "Warm window cost"
section). Recommended as a quick owner-run follow-up, not blocking.

## User Setup Required

None - no external service configuration required (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`
were already present in the shell environment from Phase 3).

## Next Phase Readiness

- The Content Layer collection, canonical-URL builder, and manifest-v2 shape are proven live and
  ready for every subsequent Phase 4 plan (04-02 through 04-12) to build on directly — no
  redesign expected.
- 04-06 (the Worker's non-canonical-URL 301) can now rely on every manifest entry carrying `slug`
  from a single KV read.
- The trailing-slash 307-vs-301 gap (docs/phase-04/spikes.md) is flagged for the end-of-phase
  owner review, not silently resolved — it does not block any downstream plan.
- The three-file cleanup above is cosmetic (dead code already fully unreferenced by the build)
  and does not block any downstream plan either.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-26*

## Self-Check: PASSED

All claimed created files verified present on disk (`src/lib/article-url.ts`,
`src/content/loaders/articles-loader.ts`, `src/content.config.ts`, `tests/helpers/html-text.mjs`,
`tests/unit/html-text.test.mjs`, `tests/unit/d1-client.test.mjs`,
`tests/unit/articles-loader-window.test.mjs`, `docs/phase-04/spikes.md`, this SUMMARY). All
claimed commit hashes verified present in `git log` (`9ee58d8`, `7597efe`, `29e59dc`, `92d7037`,
`823e02b`).

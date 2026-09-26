# 2026-09-26 - Content Layer loader, stored-slug canonical URLs, manifest v2

**Keywords:** [BACKEND] [DATABASE] [FRONTEND] [ROUTING] [FEATURE]
**Session:** Afternoon, phase 04 plan 01 execution
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1702_04-01-content-layer-loader-canonical-urls-manifest-v2.md`

## What Changed

- File: `src/lib/article-url.ts` (new)
  - `articlePath()` / `articleParams()` build the canonical `/${category}/${slug}-${uuid}` URL
    from the STORED `articles.slug` column (D-07) — never re-derived from the title
  - `UUID_RE`, `ARTICLE_SLUG_RE`, `CATEGORY_SLUG_RE` — both builder functions throw, naming the
    offending value, on any regex mismatch
  - No import from `src/lib/server/` — the 04-06 Worker will bundle this module directly for its
    non-canonical-URL redirect without pulling in the D1/KV chokepoint directory
- File: `src/lib/server/d1-client.ts`
  - Added `queryD1WithMeta()` — returns `{ results, rowsRead }`, throwing if D1's response is
    missing `meta.rows_read` (the read-budget signal PROJECT.md's daily limits depend on);
    `queryD1()` now delegates to it
  - Added `D1_MAX_BOUND_PARAMS` (100, per `.claude/CLAUDE.md`'s empirically verified ceiling) and
    `chunkIds()`
  - Added `fetchPublicArticlesWindow(sinceEpoch)` — the bulk-fetch + in-memory-stitch shape
    (measured 957,008 rows/full-pass in `docs/phase-03/d1-pagination-report.md`, vs. 11,466,920
    for the old correlated-subquery `ARTICLE_SELECT` shape), scoped to a `published_at` window.
    Applies v1's public filter (`status = 'processed' AND is_duplicate = 0`, plus a resolved
    primary category) and returns typed `publicArticles`/`nonPublic` (with reason) arrays
  - `ARTICLE_SELECT`, `fetchLatestArticle`, `fetchArticleById` left unchanged — still used by
    `tools/verify-edge-headers.mjs`'s live-discovery path
- File: `src/content/loaders/articles-loader.ts` (new)
  - The REND-01 hand-written `astro/loaders` Loader: `articleSchema` (Zod 4 top-level validators
    from `astro/zod`, including `z.url({ protocol: /^https?$/ })` on the original-article link),
    `SYNC_WINDOW_SECONDS` (3 days), `articlesLoader(deps?)` with `now`/`fetchWindow`/
    `writeManifest` test seams
  - `load()` fetches the window, writes each public article to the store with a content digest
    (relies on `store.set()`'s own return value — confirmed against
    `astro/dist/content/mutable-data-store.js` to report `false` when an existing entry's digest
    already matches), deletes any now-non-public article still present from a prior sync, and
    throws if the store ends up empty (D-14: zero rows is always a failure — the `/changelog`
    empty-state bug reborn one layer deeper is exactly what this guards against)
  - Writes v2 manifest entries only for changed articles via `putManifestEntriesBulk`
- File: `src/content.config.ts` (new)
  - `defineCollection({ loader: articlesLoader() })` — MUST live here, not
    `src/content/config.ts` (Astro 6+ raises `LegacyContentConfigError` at the old location)
- File: `src/lib/server/kv-manifest.ts`
  - `MANIFEST_SCHEMA_VERSION` bumped `'1'` -> `'2'` — every entry now carries `slug` (D-08),
    validated against `ARTICLE_SLUG_RE`, so the 04-06 Worker's non-canonical-URL 301 can rebuild
    the full canonical path from one KV read and zero D1 reads
  - Exported `RENDER_MANIFEST_NAMESPACE_ID` (the already-committed namespace id from
    `wrangler.jsonc`) as a fallback when `RENDER_MANIFEST_KV_NAMESPACE_ID` isn't set — isolated
    git worktrees and Workers Builds containers don't have the gitignored `.dev.vars`
- File: `src/pages/[category]/[slug].astro`
  - Rewritten to `getStaticPaths()` = `getCollection('articles')` mapped through
    `articleParams()`, reading `Astro.props.article` — no more direct `fetchLatestArticle()`/
    `fetchArticleById()` calls, no more manifest build/write in the page (moved into the loader)
  - Removed the harness-mode branch and its imports (`slugify`, `render-cost-harness`,
    `buildManifestEntry`/`putManifestEntry`) entirely
- File: `astro.config.mjs`
  - Added `trailingSlash: 'never'` + `build: { format: 'file' }` (owner decision 2026-09-26,
    ROADMAP Phase 4)
  - Changed `site` from `https://dev.915tldr.com` to `https://915tldr.com` — canonicals/RSS/
    sitemaps name the production origin; `dev.915tldr.com` stays noindexed via the existing edge
    Transform Rule regardless of what `site` says

## Why

Proves the whole Phase 4 architecture end-to-end on one thin slice before any expansion plan
builds on it: a real D1 article now flows through a real Content Layer Loader (not
`getStaticPaths()` calling `d1-client.ts` directly, Phase 3's tracer shape), renders at its
canonical stored-slug URL, and gets a schema-v2 manifest entry — all three of REND-01, D-07 and
D-08 in one path. If the Content Layer, the bulk-fetch query shape, or `build.format: 'file'`
didn't compose, better to find out after one commit than after ten.

## Issues Encountered

None requiring a workaround. `store.set()`'s change-detection return value and `z.url()`'s
`protocol` option were both confirmed by reading `node_modules` source directly (Astro's
`mutable-data-store.js`, Zod's `schemas.d.ts`) rather than assumed from the plan's own citation of
Context7 — both matched exactly what the plan specified.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (produced 328 article pages from the live 3-day D1 window,
  confirmed via `[d1-articles] mode=window synced=328 ...` in the build log), `pnpm run
  test:build-gate` (D1-import assertion, 6/6 passing, unaffected), `pnpm run deploy` to
  `dev.915tldr.com`, a live `curl` against the deployed canonical path (200, no `Location`
  header) and its trailing-slash variant (307 to the no-slash path — Cloudflare's native
  `html_handling` never emits 301, a named deviation from CONTEXT.md's literal "301" wording, not
  a silent one), and a live KV read (`getManifestEntry`) confirming `schemaVersion: "2"` and
  `slug` equal to the deployed page's own URL slug segment
- What wasn't tested: the unit test suite (`tests/unit/manifest-schema.test.mjs`'s fixtures don't
  yet carry `slug` — that's Task 2 of this same plan, not yet executed at this commit); the
  `pnpm run test:fast` script and `docs/phase-04/spikes.md` (Task 3, not yet executed)
- Edge cases: verified a second consecutive `pnpm run build` reports `changed=0` (unchanged
  digests correctly skip a manifest rewrite) rather than re-writing every entry every build

## Next Steps

- [ ] Task 2: hermetic unit tests for the loader/d1-client/manifest-v2 behavior, plus an
      entity-safe rewrite of `tests/tracer/tracer.test.mjs` (folds the pending apostrophe/HTML-entity
      tracer-title todo)
- [ ] Task 3: the Loader-throw-fails-build spike (RESEARCH.md Open Question 1), warm-window cost
      and trailing-slash findings recorded in `docs/phase-04/spikes.md`
- [ ] Owner cleanup (not staged by this commit): remove `src/lib/slug.ts`,
      `src/lib/render-cost-harness.ts`, `tools/measure-render-cost.mjs` and the `measure:render`
      package.json script — all now fully unreferenced by application code, still imported only by
      `tools/verify-edge-headers.mjs` (owned by plan 04-12)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - core Phase 4 architecture (Content Layer loader, canonical URL scheme, manifest schema) now proven live, everything else in the phase builds on this

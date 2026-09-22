# 2026-09-22 - Phase 3 Plan 1: One Real Article, End to End

**Keywords:** [FEATURE] [BACKEND] [API] [CONFIG] [DEPENDENCIES] [TESTING] [INFRA]
**Session:** Afternoon, Duration (~2 hours, continuation of an earlier blocked run)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1329_phase-03-01-tracer-one-real-article.md`

## What Changed

- File: `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`
  - Installed `astro@7.3.3`, `@astrojs/cloudflare@14.3.2`, `@astrojs/vue@7.0.3`, `vue@3.5.43` (deps) and `wrangler@4.136.3` (devDep, human-approved deviation from the plan's pinned 4.136.1 — build-time-only CLI, current latest chosen instead)
  - Added `build`, `dev`, `preview`, `deploy`, `test:tracer` scripts; widened `test:unit`'s glob to cover both `design/tests/unit/**` and `tests/unit/**`
- File: `.gitignore`
  - Added `dist/`, `.astro/`, `.wrangler/`, `.dev.vars`, `.env`
- File: `astro.config.mjs` (new)
  - `output: 'static'`, Cloudflare adapter with explicit two-key `imageService` (`build: 'compile'`, `runtime: 'passthrough'`), `prerenderEnvironment: 'node'`, `session: false`, `@astrojs/vue` registered, `assertNoD1Plugin()` wired into `vite.plugins`
- File: `wrangler.jsonc` (new)
  - `name: 915tldr-v2`, no `main` field, no D1 binding, one KV binding (`RENDER_MANIFEST`) pointed at the newly-created `915tldr-render-manifest` namespace (id `3c92531f94294fcc94006455f433885f`), `assets.directory: "dist/client"`
- File: `tools/assert-no-d1.mjs` (new)
  - `assertNoD1Plugin()` — Rollup/Vite `buildEnd` plugin that walks the resolved module graph from every public entrypoint (`src/pages/**`, `src/islands/**`, `src/middleware.ts`) and fails the build if any transitively reaches `src/lib/server/d1-client.ts`. Exempts prerendered pages (build-time-only D1 access is legitimate there). Accumulates candidate counts across all of `astro build`'s internal bundler passes via a `process.on('exit')` guard so a broken matcher can't silently pass by matching zero in any single pass.
- File: `src/lib/server/d1-client.ts` (new)
  - `queryD1()`, `fetchLatestArticle()`, `fetchArticleById()` — the one module permitted to reach production D1, over the REST API, build-time only
- File: `src/lib/kv-manifest.ts` (new)
  - `ManifestEntry` interface (8 fields), `buildManifestEntry()`, `putManifestEntry()`, `getManifestEntry()` against the dedicated KV namespace
- File: `src/lib/slug.ts` (new)
  - Extracted `slugify()` here after it was silently dropped by Astro's bundler when declared as a frontmatter-local function (see Issues Encountered)
- File: `src/layouts/Base.astro`, `src/pages/[category]/[slug].astro` (new)
  - Page chrome and the one tracer route on the preserved `/[category]/[slug]-[uuid]` URL shape; writes its manifest entry inside the same build
- File: `src/styles/global.css`, `public/fonts/*.woff2` (new)
  - Byte-for-byte port of the Phase 1 approved stylesheet and fonts (`cmp -s` verified)
- File: `tests/tracer/tracer.test.mjs` (new)
  - End-to-end `node:test` proof against the real build output and real KV namespace
- File: `.dev.vars` (new, gitignored, not committed)
  - `RENDER_MANIFEST_KV_NAMESPACE_ID` for local builds

## Why

D-02 requires the phase's core claim — architecturally zero D1 reads on the public request path — be proven against a real tracer slice before any of the surrounding architecture (CI guards, render manifest expansion, edge config) gets built on top of it. This plan is the thinnest path that could have been wrong, and it wasn't: one production article now goes from a live D1 row, through Node at build time, to a prerendered page and a KV manifest entry, with the D1-import guardrail already live inside the build.

## Issues Encountered

Nine deviations from the plan's assumptions, all found against a real build (not in 03-RESEARCH.md) and fixed in place (Rule 1/3 auto-fixes, in scope):

1. `prerenderEnvironment` defaults to `'workerd'` (Miniflare), not Node, in `@astrojs/cloudflare` >=13.1.0 even under `output: 'static'` — set explicitly to `'node'`, or `process.env` reads inside `getStaticPaths()` throw even though the host shell has the vars.
2. Astro 7.3.3 bundles via `rolldown`, not classic Rollup, but the Rollup-compatible plugin interface (`buildEnd`, `getModuleIds`, `getModuleInfo`, `this.error()`) works unchanged.
3. The D1-import assertion's originally-planned blanket "every page under `src/pages/**` is forbidden" rule was wrong — a prerendered page's frontmatter legitimately imports `d1-client.ts`, since that code runs once at build time and never ships to the Worker. The plugin now exempts pages lacking `export const prerender = false`.
4. `astro build` runs multiple bundler passes with different module universes (an initial empty pass, the static-entrypoints pass, a Cloudflare-adapter worker-entry pass) — a per-pass "zero entrypoints found = fail" check would false-fail. Replaced with a cumulative whole-build guard via `process.on('exit')`.
5. Production D1 schema doesn't match the plan's assumed shape: no `category`/`tags` columns on `articles` — they live in join tables (`article_categories`→`categories` where `is_primary=1`; `article_tags`→`tags`, `GROUP_CONCAT`'d). The manifest key is `articles.uuid` (TEXT), not `articles.id` (INTEGER PK). `published_at` is epoch **seconds** (INTEGER), not an ISO string or epoch milliseconds.
6. `wrangler.jsonc`'s `main: "dist/_worker.js/index.js"` is the pre-Astro-6 convention and points at a file this build never produces — removed the `main` field entirely, matching Astro's own "static site" wrangler config example (no `server:defer` islands exist yet in this tracer).
7. `@astrojs/cloudflare` auto-provisions an unwanted `SESSION` KV binding and worker bundle the moment *any* KV namespace is bound, unless `session: false` is set explicitly — this project uses no Astro Sessions API.
8. The real build output lands in `dist/client/` and `dist/server/` (the adapter's `preserveBuildClientDir`/`preserveBuildServerDir` features), not directly in `dist/` — `wrangler.jsonc`'s `assets.directory` corrected from `"dist"` to `"dist/client"`. Confirmed against the adapter's own auto-generated `dist/client/wrangler.json`.
9. A real bug: a plain top-level `function slugify()` declared inside `[slug].astro`'s frontmatter, referenced only from `getStaticPaths()`, was silently dropped by Astro 7.3.3's rolldown bundler — the compiled chunk kept the call site but omitted the function body, throwing `slugify is not defined` at build time. Fixed by extracting it to its own module (`src/lib/slug.ts`), a normal ES import instead of a frontmatter-local declaration.

## Dependencies

Added: `astro@7.3.3`, `@astrojs/cloudflare@14.3.2`, `@astrojs/vue@7.0.3`, `vue@3.5.43` (dependencies)
Added: `wrangler@4.136.3` (devDependency — deliberately not the plan's pinned 4.136.1; build-time-only CLI, user chose current latest, floor is >=4.34.0)

## Testing Notes

- What was tested: `pnpm build` (exits 0, emits exactly one article `index.html`); `pnpm test:tracer` (4/4 — one HTML file emitted, built HTML carries the live D1 headline, KV manifest entry round-trips with all 8 `ManifestEntry` keys and a valid 64-char `contentHash`); `pnpm test:unit` (43/43 — Phase 1's existing suite unbroken by the glob change); all plan acceptance-criteria shell checks (config assertions, byte-identical `cmp` on `global.css`, no `d1_databases` block in `wrangler.jsonc` after comment-stripping, no literal token value anywhere in `src/`/`tools/`/`tests/`, `dist`/`.astro`/`.wrangler` untracked)
- What wasn't tested: deployment (`wrangler deploy`) — this plan proves the build, not the live edge; that's 03-05
- Edge cases: the tracer intentionally covers exactly one article and one path; no listing pages, no batching, no second D1 call site

## Next Steps

- [ ] 03-02: promote the D1-import assertion to a permanent CI guard with negative fixtures (`tools/check-config-guards.mjs`)
- [ ] 03-03: replace the `build 0000000 · 2026-09-16` footer placeholder with the real build-stamp module; revisit `site: 'https://dev.915tldr.com'` at deploy
- [ ] 03-04: replace `renderVersion: '0'` with the exported schema-version constant; decide `spanishCounterpartId`'s population strategy
- [ ] 03-05: wire `wrangler.jsonc` for actual deploy (confirm `assets.directory: "dist/client"` holds under `wrangler deploy`, not just `astro build`)

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** HIGH - proves the phase's core architectural claim end-to-end on real production data; every later Phase 3 plan builds on this tracer's KV key shape (D-03) and D1 chokepoint module (D-05)

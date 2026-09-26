# Phase 4: Static Generation, Templates & SEO - Research

**Researched:** 2026-09-26
**Domain:** Astro 7 Content Layer API (custom build-time Loader), Cloudflare Workers Builds/Static Assets, structured data & News sitemap SEO
**Confidence:** MEDIUM — core Astro/Cloudflare mechanics are Context7-sourced (official docs mirror); one load-bearing mechanism (`experimental.incrementalBuild`) is LOW confidence and carries an open, unresolved upstream bug directly threatening this phase's build-time budget.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Build & deploy pipeline (REND-04, OPS-10)**
- D-01: The 2-hourly static build runs on Cloudflare Workers Builds (hosted CI), not the owner's machine, not inside a Worker.
- D-02: Each build is triggered by the existing ingest cron in `915tldr.com2` POSTing a Workers Builds Deploy Hook after ingest finishes, only when rows changed.
- D-03: Public GitHub remote named `915tldr-frontend`. Owner creates/pushes via lazygit; Claude never pushes, creates branches, or merges.
- D-04: The Deploy Hook builds `main` as production.
- D-05 (amends Phase 3 D-01): the cron Worker *triggers*; Workers Builds *builds and deploys*. Phase 3's chained-cron-cycle full-rebuild strategy was written for rendering inside the cron Worker, not for a Workers Builds CI job — the planner must reconcile this (see Common Pitfalls, "The full-rebuild mechanism Phase 3 designed does not survive D-05").
- D-06: Incremental loading must use Workers Builds build caching (auto-caches `node_modules/.astro` + pnpm store, 7-day retention, 10GB/project) so the loader fetches only changed rows. Steady-state must use an incremental signal (e.g. `updated_at > last_sync`), never a full-corpus bulk fetch every cycle (11.5M rows/day at 12 cycles/day, 2.3x the daily hard-fail).

**URL compatibility & 404 (SEO-04, SEO-08, FIX-04)**
- D-07: Article URLs built from the stored `articles.slug` column, never re-derived from the title. Canonical shape: `/${category.slug}/${article.slug}-${uuid}`.
- D-08: Non-canonical article URLs 301 to canonical via the Worker (1 KV read, 0 D1 reads) — parses UUID from path, reads manifest entry (must carry `slug` + category slug — new manifest field, schema version bump), 301s; no UUID/no entry → static 404.
- D-09: 8-character short IDs dropped (v1 link generation never emits them).
- D-10a: 404 suggestions = static, build-time index (title/slug/category/uuid), no AI, no D1. Plain page script, not an island (ISL-08 budget).

**v1 routes not in the Phase 4 page list**
- D-10: `/about`, `/privacy`, `/terms` ported as static pages in approved chrome now (Phase 10 rewrites About).
- D-11: Build `/tags` (index) + `/source/[slug]` (3 sources) as static pages. `/categories` and `/sources` 301 to nearest equivalent.
- D-12: `/new` 301 → `/`; `/search` not built until Phase 9; `/stats` dropped.

**Fail-loud loader & changelog (REND-02, REND-03, FIX-05)**
- D-13: `/changelog` "full preserved history" = `915tldr.com2/public/changelog.json` (12 entries) merged with the 6 rows in D1 `public_changelogs` (all public, Dec 2025). Fail-loud applies to both sources.
- D-14: "Fewer rows than expected" = never shrink vs. the last good build's persisted counts, minus an explicit named allowance for intentional deletions. Zero extra D1 reads — no per-build `COUNT(*)`.
- D-15: A failed build deploys nothing (previous version keeps serving) and pushes an ntfy notification naming the failed check.

**Carried forward (not re-discussed)**
- `trailingSlash: 'never'` + `build.format: 'file'`; pass `trailingSlash: false` to `rss()`.
- Staleness detection is incremental (Phase 3 binding constraint).
- AI disclosure + outlet attribution markup already exists in `design/mockups/article.html` (`data-ai-disclosure`, `data-attribution`) — templates reproduce it, no new design.
- One KV manifest key per article, `output: 'static'`, bindings via `cloudflare:workers`, `imageService` explicit, `style.css` ported wholesale, D1-import graph-walk assertion.

### Claude's Discretion
- Where last-good-build counts persist (D-14) — CONTEXT.md recommends KV.
- Trailing-slash variant handling at the edge, provided `/path` → 200 and `/path/` → a single redirect to `/path`. **Research finding: Cloudflare's native mechanism only emits 307, never 301 — see Common Pitfalls.**
- Structured data shape (SEO-01/02) and Google News sitemap mechanics (SEO-03), within "validated in the Rich Results Test, not merely emitted."
- Byte-identical output for unchanged articles: deterministic rendering (no build timestamps inside article bodies).
- Which article set the 404 index covers (D-10a), sized to stay small.

### Deferred Ideas (OUT OF SCOPE)
- A statically built `/stats` page — candidate for a later phase or backlog.
- Repo split into a plain parent directory — stays at Phase 12.
- R2 archive tier, tag tiering, zero-reads proof — Phase 5.
- Spanish routing — Phase 6. Share cards/imagery — Phase 7. Islands — Phase 8. Search — Phase 9. About-page rewrite — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REND-01 | Hand-written `astro/loaders` Loader reads articles from D1 REST API at build time | Content Layer custom Loader pattern (Architecture Patterns §1); reuses existing `src/lib/server/d1-client.ts` as the fetch layer inside `load()` |
| REND-02 | Loader throws and fails the build on zero/fewer rows than expected | Loader error-propagation caveat flagged as unverified for Content Layer specifically (Open Questions #1) — Phase 3's `getStaticPaths` throw pattern is proven, the Loader-level throw is not yet proven the same way |
| REND-03 | Regression test reproduces the `/changelog` empty-state failure | Validation Architecture — Wave 0 gap: `tests/regression/changelog-empty-state.test.mjs` |
| REND-04 | Homepage/category/tag/static pages regenerate each cron cycle via new Worker deployment | Workers Builds Deploy Hook mechanics (Standard Stack, Don't Hand-Roll) |
| REND-05 | Only new/changed articles re-render | `meta` MetaStore watermark + `experimental.incrementalBuild` + `cacheKey` (Architecture Patterns §2) — **HIGH RISK, see Common Pitfalls #1** |
| SEO-01/02 | NewsArticle/BreadcrumbList/Organization/WebSite JSON-LD, validated | Code Examples §4; Security Domain (JSON-LD injection escaping) |
| SEO-03 | Google News sitemap, last 48h only | Code Examples §5; Don't Hand-Roll (no package covers `news:` namespace) |
| SEO-04 | Canonical URLs; old `/[category]/[slug]-[uuid]` URLs resolve | D-07/D-08 (locked); trailing-slash mechanism (Common Pitfalls #2) |
| SEO-05 | Per-bot `robots.txt` (AI-crawler, `Content-signal`) preserved | Recommend static `public/robots.txt` — content has no D1 dependency (Architecture Patterns) |
| SEO-06 | `/rss.xml` preserved | `@astrojs/rss` + `trailingSlash: false` (Standard Stack, Code Examples §3) |
| SEO-07 | Canonical outlet link prominent on every article | Already in approved mockup markup (`data-attribution`) — port verbatim |
| SEO-08 | 404 suggestion endpoint carries over | D-10a static index (locked); `not_found_handling: "404-page"` wrangler.jsonc gap (Common Pitfalls #3) |
| IDNT-03/04 | AI disclosure + outlet attribution on every article | Approved mockup markup, `design/mockups/article.html:291-293` — port verbatim |
| OPS-10 | Cron run triggers the public site's incremental build | D-02 Deploy Hook (locked, already verified in CONTEXT.md) |
| FIX-04 | `/crime` and `/crime/**` both resolve | `build.format: 'file'` collapses `index.astro` to `crime.html`, no collision with `crime/2.html` (Architecture Patterns) |
| FIX-05 | `/changelog` renders reliably | Same fail-loud loader + D-13 dual-source merge |
</phase_requirements>

## Summary

Phase 4 has one architecturally sound path and one serious unresolved risk sitting directly on its critical path. The sound path: adopt Astro's real Content Layer API (`defineCollection` + a custom `astro/loaders` Loader), not the plain `getStaticPaths()` + direct `d1-client` calls Phase 3's tracer used. The Loader's `load()` method gets a `meta` MetaStore that persists across builds inside `node_modules/.astro/` — exactly the directory Workers Builds' build caching already covers — so a `last_sync` watermark can drive the cheap incremental D1 query (`updated_at > last_sync`) the Phase 3 binding constraint requires, and a `digest` per entry (via `generateDigest()`) gives every entry a change-fingerprint for free, cleanly overlapping with the existing KV manifest's `contentHash` design.

The risk: making the *build itself* fast enough to fit inside a single Workers Builds run (hard 20-minute timeout, not extendable) requires Astro's `experimental.incrementalBuild` flag to actually skip re-rendering the ~40,000 unchanged pages every 2-hour cycle. That flag is genuinely experimental — five open upstream GitHub issues as of this research, including one (`withastro/astro#18055`) reporting it **never reuses pages on a fresh CI machine even with the cache restored**, which is exactly what a Workers Builds container is. If that bug applies here, every 2-hourly build re-renders the full corpus at the previously measured ~3.8–8.1 hour cost, which cannot possibly fit a 20-minute CI timeout — the whole Phase 4 delivery mechanism would silently fail every build. This must be spiked and proven, not assumed, before the plan commits to it (see Open Questions #1, Common Pitfalls #1).

A second load-bearing finding: the full-corpus rebuild strategy Phase 3 designed ("chained across ~26–33 cron cycles," each fitting inside the cron Worker's ~900s ceiling) was written for rendering *inside the cron Worker*. D-05 moves the actual `astro build` execution to Workers Builds, which has its own, unrelated 20-minute-per-build ceiling and no mechanism for "picking up where the last cron cycle left off" the way a long-running Worker invocation could. Phase 3's full-rebuild plan does not carry over to the new build host; Phase 4's planner must design a distinct chunking mechanism (or, more simply, keep the *initial* and any *forced* full rebuild as a manual, local `wrangler deploy` operation — the exact pattern Phase 3's own tracer already proved — and reserve Workers Builds for the small, steady-state incremental case it is actually sized for).

Everything else researched is comfortably confirmed via Astro's own docs (Context7 `/withastro/docs`) and Cloudflare's own docs: `build.format: 'file'` cleanly resolves FIX-04's `/crime` + `/crime/**` collision concern, `wrangler.jsonc` needs an explicit `not_found_handling: "404-page"` it currently lacks (a real gap, not present in Phase 3's config), and Cloudflare's native trailing-slash handling already gives the exact `/path`→200 / `/path/`→redirect shape CONTEXT.md's discretion item asked for — except the redirect is 307, never 301, on every native Cloudflare mode.

**Primary recommendation:** Build the loader as a real Content Layer `Loader` (not plain `getStaticPaths` + direct D1 calls) so `meta`/`digest` are available, but treat `experimental.incrementalBuild` as unproven — spike it against Workers Builds specifically (a throwaway repo or a scoped branch push) in Wave 0, before the plan's task list assumes it works. If it doesn't reuse pages reliably in that environment, fall back to keeping the *render step* (not just the trigger) inside the existing 2-hour cron Worker for the steady-state case (reverting part of D-05), and use Workers Builds only for deploying whatever the cron Worker already rendered — a smaller, safer scope for the new infrastructure this phase introduces.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Article/category/tag page rendering | Build-time (Node, Workers Builds CI) | — | `astro build` runs once per trigger, in Node, never in the deployed Worker — this is what keeps D1 reads at zero on the public path |
| D1 data fetch (via `d1-client.ts`) | Build-time (Node) | — | Existing chokepoint module, protected by `assert-no-d1.mjs`'s directory-wide guard; a Content Layer Loader calling it is still build-time-only |
| Render manifest (KV) read/write | Build-time (Node) | — | Same build/render-time-only boundary as D1; never touched by the deployed Worker on the public path |
| Static asset serving (`/`, `/[category]/[slug]-[uuid]`, `/rss.xml`, `/robots.txt`, sitemaps) | CDN / Static (Workers Static Assets) | — | Zero Worker invocation for a matched asset (`run_worker_first: false`, the default) — this is the entire point of the static-generation architecture |
| Non-canonical URL 301 + 404 fallback | API / Backend (the deployed Worker, on asset miss only) | KV (1 read) | D-08 requires a Worker to exist for the first time in this project (Phase 3 shipped no `main` field at all) — invoked only when the static asset layer misses |
| Structured data / JSON-LD | Build-time (Node), emitted into static HTML | — | No runtime computation; baked into the page at render time |
| Google News sitemap / general sitemap | Build-time (Node), emitted as static XML | — | Filtered to a 48h window at build time from already-fetched article data, not a live query |
| Cron trigger → Deploy Hook POST | API / Backend (existing `915tldr.com2` cron Worker) | — | Trivial HTTP POST, no rendering; D-05's whole point is separating "trigger" from "build" |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `astro` | 7.3.3 (already installed) [VERIFIED: package.json] | Static site generator, Content Layer API | Already pinned in this repo; Content Layer's `Loader` API (`astro/loaders`) is the officially documented mechanism for build-time custom data sources [CITED: github.com/withastro/docs content-loader-reference.mdx] |
| `@astrojs/cloudflare` | 14.3.2 (already installed) [VERIFIED: package.json] | Cloudflare adapter | Unchanged from Phase 3 |
| `@astrojs/rss` | latest `4.0.19` [VERIFIED: npm registry, `npm view @astrojs/rss version`] — not yet installed | `/rss.xml` generation | Official Astro package for RSS 2.0 feeds; supports the `trailingSlash: false` override this project's trailing-slash decision requires [CITED: github.com/withastro/docs recipes/rss.mdx] |
| `@astrojs/sitemap` | latest `3.7.4` [VERIFIED: npm registry, `npm view @astrojs/sitemap version`] — not yet installed | General XML sitemap (SEO-04's crawl surface, not the News sitemap) | Crawls Astro's own statically-generated route manifest at build time, including dynamic `getStaticPaths`/Content-Layer routes [CITED: github.com/withastro/docs guides/integrations-guide/sitemap.mdx]. **Flagged SUS by the package-legitimacy gate — see Package Legitimacy Audit; the flag is a false positive (see disposition) but requires the standard checkpoint before install.** |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none new | — | Google News sitemap | Hand-write a plain `.xml.ts` endpoint — no package implements the `news:` namespace (Don't Hand-Roll below explains why this is the one correct exception) |
| none new | — | JSON-LD structured data | Hand-write plain objects serialized via `JSON.stringify` inside a `<script type="application/ld+json">` tag — no package needed, but see Security Domain for the escaping requirement |
| none new | — | 404 suggestion index | Plain JSON built at compile time from the same Content Layer collection already in memory; matched client-side with plain page script (ISL-08 forbids a new island here) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Content Layer custom `Loader` (`astro/loaders`) | Plain `getStaticPaths()` calling `d1-client.ts` directly (Phase 3's proven tracer pattern) | Simpler, already proven live — but REND-01 explicitly requires "a hand-written `astro/loaders` Loader," and only the Content Layer gives you `meta` (cross-build watermark) and `digest` (per-entry change fingerprint) for free. Plain `getStaticPaths` would require hand-rolling both, in KV, duplicating what the render manifest already half-does. |
| `experimental.incrementalBuild` + `cacheKey` | Full re-render every build, rely only on the D1-query-level incremental signal to keep D1 reads down (not build time) | Full re-render is the safe fallback if the experimental flag proves unreliable on Workers Builds (see Common Pitfalls #1) — but at ~40k pages and a measured ~342-573ms/page cost, this alone still overruns the 20-minute Workers Builds ceiling on every single build, steady-state or not. This is why the render-step-inside-cron-Worker fallback (Primary recommendation) exists as the real safety net, not merely disabling the flag. |
| Hand-rolled Google News sitemap endpoint | `@astrojs/sitemap`'s `serialize()` hook to inject `news:` tags into the main sitemap | `@astrojs/sitemap` has no first-class support for the `news:` namespace or its schema; forcing custom XML through `serialize()`'s per-item mutation is more fragile than a 40-line hand-written endpoint that fully controls its own XML. |

**Installation:**
```bash
pnpm add @astrojs/rss @astrojs/sitemap
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `@astrojs/rss` | npm | published 2026-06-30 [VERIFIED: package-legitimacy gate] | 809,215/wk | github.com/withastro/astro | OK | Approved |
| `@astrojs/sitemap` | npm | published 2026-08-31 (latest version) [VERIFIED: package-legitimacy gate] | 3,442,010/wk | github.com/withastro/astro | SUS (`too-new`) | **Approved with checkpoint** — see note below |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** `@astrojs/sitemap` — flagged solely because its most recent published version is ~4 weeks old at research time. This reads as a false positive: it ships from the same official `withastro/astro` monorepo as `@astrojs/rss` and `astro` itself (already trusted, already installed), and carries 3.4M weekly downloads — an order of magnitude more than `@astrojs/rss`. The "too-new" signal is almost certainly measuring the latest patch release date, not the package's actual age or trustworthiness. **The planner must still add a `checkpoint:human-verify` task before this install**, per the Package Legitimacy Gate protocol — the disposition here is a documented judgment call, not a waiver of the gate.

## Architecture Patterns

### System Architecture Diagram

```
915tldr.com2 (ingest cron, existing)
   │  ingest runs, rows changed
   ▼
POST Deploy Hook URL  ──────────────────────────────► Cloudflare Workers Builds (new, D-01/D-03)
                                                          │  git checkout main
                                                          │  pnpm install (cached: pnpm store)
                                                          │  astro build
                                                          │    ├─ Content Layer sync phase:
                                                          │    │    custom Loader.load()
                                                          │    │    ├─ meta.get('lastSync') ──► D1 REST API (d1-client.ts)
                                                          │    │    │      WHERE updated_at > lastSync   (cheap, incremental)
                                                          │    │    ├─ generateDigest() per row
                                                          │    │    └─ store.set({id, data, digest})  ──► node_modules/.astro/data-store.json
                                                          │    │                                           (persisted via Workers Builds build cache)
                                                          │    ├─ getStaticPaths() per page type
                                                          │    │    reads getCollection('articles')
                                                          │    │    cacheKey: entry.digest  ──► experimental.incrementalBuild
                                                          │    │    (skip render if digest+module-graph unchanged — UNPROVEN on CI, see Pitfall #1)
                                                          │    ├─ render manifest write (KV, buildManifestEntry/putManifestEntriesBulk)
                                                          │    ├─ fail-loud check: rows < last-good count ⇒ throw ⇒ non-zero exit
                                                          │    └─ static XML endpoints: rss.xml, sitemap.xml, news-sitemap.xml
                                                          │  wrangler deploy
                                                          ▼
                                                   dist/client/*.html + wrangler.jsonc assets
                                                          │
                                                          ▼
                                          Cloudflare Workers Static Assets (CDN tier)
                                             │  html_handling: auto-trailing-slash (default; matches build.format:'file')
                                             │  not_found_handling: 404-page  (MUST be added — currently absent)
                                             ▼
                        ┌────────────────────┴─────────────────────┐
                        │ asset matched → 200, no Worker invoked    │ asset miss → Worker invoked (new: no `main` existed before)
                        ▼                                            ▼
                 Reader's browser                          parse UUID from path
                                                             │
                                                    ┌────────┴────────┐
                                                    │ valid UUID?      │
                                              yes ──┤                  ├── no
                                                    ▼                  ▼
                                        KV read: manifest:<uuid>   static 404.html served
                                          (1 KV read, 0 D1 reads)  (with build-time 404 index,
                                                    │                D-10a client-side match)
                                          found → 301 to canonical
                                          not found → static 404.html
```

### Recommended Project Structure
```
src/
├── content/
│   ├── config.ts              # defineCollection({ loader: articlesLoader(), schema })
│   └── loaders/
│       └── articles-loader.ts # the REND-01 hand-written astro/loaders Loader
├── pages/
│   ├── index.astro
│   ├── [category]/
│   │   ├── index.astro        # -> {category}.html  (build.format:'file' collapse — FIX-04)
│   │   ├── [page].astro       # -> {category}/2.html, /3.html, ...
│   │   └── [slug].astro       # article page (existing, extend with rail/tags/disclosure/attribution)
│   ├── tag/[slug].astro
│   ├── tags.astro
│   ├── source/[slug].astro
│   ├── changelog.astro        # D-13 dual-source merge
│   ├── contact.astro          # static port of design/mockups/contact.html — no live form wiring (Phase 10)
│   ├── about.astro / privacy.astro / terms.astro   # D-10 content ports
│   ├── 404.astro              # D-10a static index, plain page script
│   ├── rss.xml.ts             # @astrojs/rss, trailingSlash:false
│   ├── news-sitemap.xml.ts    # hand-written, 48h window, news: namespace
│   └── categories.ts / sources.ts  # 301 endpoints (D-11)
├── lib/
│   └── server/                # unchanged chokepoint — d1-client.ts, kv-manifest.ts (extend with slug field, D-08)
└── layouts/
    └── Base.astro             # unchanged
```

### Pattern 1: Custom Content Layer Loader reading D1 incrementally

**What:** A `Loader` object (`{ name, load, schema }`) registered via `defineCollection({ loader: ... })` in `src/content/config.ts`. Its `load()` uses the collection-scoped `meta` MetaStore to persist a `lastSync` watermark across builds, and only fetches rows changed since then.

**When to use:** This is the only shape that satisfies REND-01 literally ("a hand-written `astro/loaders` Loader") while also giving REND-05 ("only new and changed articles re-render") a real mechanism — `meta` and `digest` do not exist on plain `getStaticPaths()`.

**Example:**
```ts
// Source pattern: github.com/withastro/docs content-loader-reference.mdx
// (adapted to this project's existing d1-client.ts and manifest fail-loud rule)
import type { Loader } from 'astro/loaders';
import { queryD1 } from '../../lib/server/d1-client';

export function articlesLoader(): Loader {
  return {
    name: 'd1-articles-loader',
    load: async ({ store, meta, generateDigest, logger }) => {
      const lastSync = meta.get('lastSync') ?? '0'; // epoch seconds, string
      const rows = await queryD1(
        `${ARTICLE_SELECT} WHERE a.status = ? AND c.slug IS NOT NULL AND a.updated_at > ?`,
        ['processed', lastSync]
      );

      // REND-02/D-14: never shrink vs. last-good count. lastGoodCount persisted
      // separately (KV, per CONTEXT.md's discretion recommendation) — NOT here,
      // since meta is scoped to this collection's own sync bookkeeping, and the
      // "last good count" comparison is a whole-corpus invariant, not a per-row one.
      if (rows.length === 0 && lastSync === '0') {
        // Cold cache / first sync: zero rows is ALWAYS a failure (D-14), never
        // ambiguous with "nothing changed since last sync."
        throw new Error('d1-articles-loader: cold sync returned zero rows — refusing to build');
      }

      for (const row of rows) {
        const digest = generateDigest({ title: row.title, summary: row.summary, tags: row.tags });
        store.set({ id: row.id, data: row, digest });
      }

      meta.set('lastSync', String(Math.floor(Date.now() / 1000)));
      logger.info(`d1-articles-loader: synced ${rows.length} changed rows`);
    },
  };
}
```
**Open question this example does NOT resolve:** whether a `throw` here actually fails `astro build` with a non-zero exit the same way Phase 3's `getStaticPaths` throw does — see Open Questions #1. Treat this as unverified until a Wave 0 spike proves it.

### Pattern 2: Skip re-rendering unchanged pages via `cacheKey`

**What:** `experimental.incrementalBuild: true` in `astro.config.mjs`, plus a `cacheKey` per path returned from `getStaticPaths()`, set to the Content Layer entry's own `digest`.

**When to use:** Only after Wave 0 proves it actually skips work in the Workers Builds CI environment (Common Pitfalls #1) — this is the single riskiest recommendation in this document.

**Example:**
```astro
---
// Source: github.com/withastro/docs experimental-flags/incremental-build.mdx
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const entries = await getCollection("articles");
  return entries.map((entry) => ({
    params: { category: entry.data.category, slug: `${entry.data.slug}-${entry.id}` },
    props: { entry },
    cacheKey: String(entry.digest),
  }));
}
---
```

### Pattern 3: Static 404 index without a new island

**What:** A JSON blob (title/slug/category/uuid, small, sized per D-10a's discretion) written to `public/` (or emitted as a build artifact) at build time from the same collection data already in memory — no separate D1 or KV read. `404.astro` includes a plain `<script>` (not a hydrated island — ISL-08 forbids a new one here) that fetches this JSON and matches path tokens client-side.

**When to use:** Exactly D-10a's shape. Use `textContent`/`createElement` when rendering suggestions, matching the existing precedent in `design/mockups/*.html`'s load-more script (`createElement`/`setAttribute`/`textContent` only, never `innerHTML`) [VERIFIED: design/mockups/index.html — the load-more script comment block cites "T-01-58" for this exact constraint].

### Anti-Patterns to Avoid
- **Re-deriving the article slug from the title at render time:** D-07 is explicit and locked — use the stored `articles.slug` column. `src/lib/slug.ts`'s `slugify()` (Phase 3 tracer) diverges from v1's `generateSlug()` [VERIFIED: `915tldr.com2/server/utils/rss.ts:215-224`, `generateSlug(title)` strips non-`[a-z0-9\s-]` and caps at 100 chars] and must be retired for URL generation, not extended.
- **Trusting `wrangler.jsonc`'s current defaults for 404 and trailing-slash handling:** both need explicit keys added — see Common Pitfalls #2/#3.
- **Building the Google News sitemap by mutating `@astrojs/sitemap`'s general sitemap output:** the package has no `news:` namespace support; hand-write a separate endpoint instead (Don't Hand-Roll).
- **Interpolating article title/summary directly into a JSON-LD `<script>` tag via template-string concatenation:** must go through `JSON.stringify` with `</script>`-sequence escaping — see Security Domain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| RSS 2.0 feed generation | Manual XML string templates (v1's own `server/routes/rss.xml.ts` does this) | `@astrojs/rss` | Handles XML escaping, `<atom:link>` self-reference, and the documented `trailingSlash` override this project's trailing-slash decision needs — v1's hand-rolled version already needed a manual `escapeXml()` helper, exactly the kind of edge case a maintained package absorbs |
| General crawl sitemap (SEO-04's non-News surface) | A hand-rolled endpoint re-walking every route (v1's `sitemap.xml.ts` does this, and had to work around D1's 100-bound-parameter ceiling via a subquery rewrite to avoid a 500 — [VERIFIED: `915tldr.com2/server/routes/sitemap.xml.ts:34-45`, comment: `"D1 rejects a statement carrying more than 100 bound parameters (\"too many SQL variables\")"`]) | `@astrojs/sitemap` | Astro's own route manifest is already the source of truth for what pages exist post-build; re-querying D1 a second time at request time (as v1 did) is exactly the anti-pattern this whole rebuild exists to eliminate |
| Google News sitemap | — (no viable package) | Hand-written `.xml.ts` endpoint | This is the one correct exception: no maintained package implements the `news:` namespace faithfully; the format is small enough (publication name/language/date/title, ≤1000 entries/file, 48h filter) that a ~40-line hand-written endpoint is lower-risk than forcing a general-purpose sitemap package to do something it wasn't built for |
| Cross-build change tracking for D1 rows | A second, parallel KV-based "what did I already see" ledger, hand-rolled inside the loader | `LoaderContext.meta` (built-in MetaStore, persisted in the same `node_modules/.astro/data-store.json` Workers Builds already caches) | Astro already solved "persist a sync token across builds" for exactly this use case; a second hand-rolled mechanism would duplicate it and risk drifting out of sync with the Content Layer's own restore/skip logic |

**Key insight:** every hand-rolled piece of v1's SEO surface (RSS, sitemap, 404-suggestions) exists in this codebase already and each one accumulated its own workaround for a limit it hit in production (D1's 100-parameter ceiling, XML escaping bugs). Phase 4's job is largely to replace those hand-rolled surfaces with maintained equivalents where one exists, and to hand-roll only the one genuine gap (Google News's `news:` namespace).

## Common Pitfalls

### Pitfall 1: `experimental.incrementalBuild` may not skip re-rendering on Workers Builds at all
**What goes wrong:** Every 2-hourly build re-renders all ~40,000 pages regardless of how few actually changed, because the flag's page-skip mechanism (module dependency graph hash + `cacheKey`) never matches between builds.
**Why it happens:** `withastro/astro#18055` [LOW confidence, WebSearch/WebFetch only] reports incremental builds never reusing pages on fresh CI machines even with the cache restored intact (~4.3GB, zero file changes) — root-caused to non-deterministic module-discovery ordering (`createTransitiveGraphCache` groups modules by `graph.getModuleIds()` order, which "parallel install + cache restore scramble... on CI"). Workers Builds is precisely this kind of fresh-container CI system. Two more open issues (`#17652`, `#17642`) show the same failure mode specifically for the `astro:assets` fonts API, and `#17974` shows a related failure for Sass partials — the pattern is "any non-deterministic or indirectly-hashed input defeats the cache," not one isolated bug.
**How to avoid:** Do not assume this flag works in Wave 0 planning. Add an explicit spike task: push a scoped branch, trigger two consecutive Workers Builds runs with zero content changes between them, and confirm from the build logs that the second run actually skips page rendering (Astro logs a skip reason per page when the flag is enabled). If it does not skip reliably, fall back to keeping the actual render step inside the existing 2-hour cron Worker (Phase 3's original D-01, before D-05 amended it) and use Workers Builds only to deploy pre-rendered output — a narrower scope than D-05 currently describes, and worth flagging back to the owner as a possible reopening of D-05's "no chained-cron-cycle full-rebuild inside Workers Builds" boundary.
**Warning signs:** Build duration in Workers Builds does not shrink between a build with 15 changed articles and a build with 0; build logs show "N pages generated" where N is close to the full corpus size on every run.

### Pitfall 2: Cloudflare's native trailing-slash redirect is 307, never 301
**What goes wrong:** CONTEXT.md's discretion item asks for "`/path/` → a single 301 to `/path`," but every native `html_handling` mode (`auto-trailing-slash`, `drop-trailing-slash`, `force-trailing-slash`) [CITED: developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling] documents its redirects as 307, not 301.
**Why it happens:** This is a platform-level default with no override — there is no `html_handling` variant that emits 301, and getting a real 301 would require routing every trailing-slash-mismatched request through the Worker (`run_worker_first`), which the project has otherwise deliberately avoided for cost/architecture reasons.
**How to avoid:** With `build.format: 'file'` (no `index.html` files at all), the default `auto-trailing-slash` mode already gives exactly the desired shape — `/path` → 200 (serves `path.html`), `/path/` → 307 to `/path` — with zero extra config. Set `html_handling: "auto-trailing-slash"` explicitly in `wrangler.jsonc` anyway (matching this project's established "assert everything explicitly, never rely on defaults" pattern — the `imageService` lesson from `astro.config.mjs`), and treat the 307-vs-301 gap as an explicit, named decision for the owner rather than a silent deviation: 307 is not an SEO problem in practice (Google consolidates signals through redirect chains regardless of code), but it is not what CONTEXT.md asked for word-for-word.
**Warning signs:** An SEO audit or the owner specifically checks redirect status codes and expects 301.

### Pitfall 3: The custom 404 page will not actually serve as a 404 without an explicit `wrangler.jsonc` key
**What goes wrong:** `404.astro` builds to `404.html` [CITED: github.com/withastro/docs basics/astro-pages.mdx] but Cloudflare's asset layer does not know to serve it on an unmatched path unless told to.
**Why it happens:** `assets.not_found_handling` defaults to `"none"` [CITED: developers.cloudflare.com/workers/wrangler/configuration] — this project's current `wrangler.jsonc` has no `not_found_handling` key at all [VERIFIED: `wrangler.jsonc` — the `assets` block reads only `{ "directory": "dist/client", "binding": "ASSETS" }`, no `not_found_handling` key present]. Without it, an unmatched request's behavior is undefined/generic rather than serving the project's own 404 page with its build-time suggestion index (D-10a, SEO-08).
**How to avoid:** Add `"not_found_handling": "404-page"` to the `assets` block in `wrangler.jsonc`.
**Warning signs:** SEO-08's regression test (or manual check) finds `/some-garbage-path` returns a blank or platform-default response instead of the styled 404 page with suggestions.

### Pitfall 4: The full-rebuild mechanism Phase 3 designed does not survive D-05
**What goes wrong:** A forced full rebuild (initial backfill, schema migration, template change) is assumed to be handled the same way Phase 3's `render-step-location.md` designed — chained across ~26-33 cron cycles, each fitting inside the cron Worker's ~900s ceiling. That mechanism lived entirely inside the cron Worker's own execution. D-05 moves the actual `astro build` (which is what a full rebuild actually re-runs) to Workers Builds, which is a single CI job with a **hard, non-extendable 20-minute timeout** [CITED: developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing] — there is no way to "resume a build across cron cycles" inside one `astro build` invocation the way a Worker's own execution could be chained.
**Why it happens:** D-05 (this phase's own CONTEXT.md) explicitly supersedes part of Phase 3's D-01 without re-deriving Phase 3's full-rebuild math for the new build host. This is a genuine premise conflict between two already-locked decisions, not a hypothetical.
**How to avoid:** Do not let the plan silently assume "the existing full-rebuild design still works." Either (a) design a genuinely new chunking mechanism — bound each Workers Builds invocation's `load()` to a fixed row budget via `meta`, and have the build's own final step re-POST the Deploy Hook if more stale/unsynced rows remain (chaining across *builds*, not cron cycles) — or (b) explicitly scope any forced full rebuild as a manual, human-triggered, budget-reviewed local `wrangler deploy`, matching the pattern Phase 3's own tracer already used successfully [VERIFIED: `.planning/STATE.md` line 171: "Deploy path resolved as local wrangler deploy (not git-connected Workers Builds CI), verified via Workers Builds API against this account's existing Workers (zero build history)."]. Option (b) is simpler and lower-risk; flag it back to the owner if it narrows D-01/D-05's stated scope.
**Warning signs:** A schema-version bump or template change triggers a Deploy Hook that never completes (times out at 20 minutes, deploys nothing, D-15's alert fires) with no designed recovery path.

### Pitfall 5: JSON-LD script-tag injection from AI-generated titles/summaries
**What goes wrong:** An article title or summary containing the literal substring `</script>` (or similar) can prematurely close the `<script type="application/ld+json">` block, breaking the page's HTML structure or, in a worse case, enabling script injection if a downstream sanitizer assumes JSON-LD blocks are inert.
**Why it happens:** `JSON.stringify()` alone does not escape `<` — a title like `Man says "</script><script>alert(1)</script>"` (contrived, but titles are AI-generated from scraped RSS content the project does not control) serializes with the literal closing tag intact.
**How to avoid:** Escape the serialized JSON before embedding: replace `<` with `<` (or use a small helper) before interpolating into the `<script>` tag. This is a standard, well-known JSON-LD hardening step, not exotic.
**Warning signs:** A Rich Results Test failure with a parse error on a specific article, traceable to an unusual character in its title.

## Code Examples

### `@astrojs/rss` endpoint with the trailing-slash override
```js
// Source: github.com/withastro/docs recipes/rss.mdx
import rss from '@astrojs/rss';

export function GET(context) {
  return rss({
    title: '915 TLDR — El Paso News, Simplified',
    description: 'AI-powered local news for El Paso.',
    site: context.site,
    trailingSlash: false, // REQUIRED alongside astro.config's trailingSlash:'never' — rss()
                           // otherwise emits trailing-slash item links regardless of project config
    items: articles.map((a) => ({
      link: `/${a.category}/${a.slug}-${a.id}`,
      title: a.title,
      description: a.summary,
      pubDate: new Date(a.published_at * 1000),
    })),
  });
}
```

### `wrangler.jsonc` additions this phase needs
```jsonc
// Both keys are currently ABSENT from wrangler.jsonc [VERIFIED: wrangler.jsonc assets block].
"assets": {
  "directory": "dist/client",
  "binding": "ASSETS",
  "not_found_handling": "404-page",       // Pitfall 3 — without this, 404.html is never served
  "html_handling": "auto-trailing-slash"  // explicit, matches the default, but stated per this
                                            // project's "never rely on defaults" convention
}
```

### Escaping JSON-LD before embedding
```ts
// Pitfall 5 mitigation — standard hardening, no package needed
function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
```
```astro
<script type="application/ld+json" set:html={toSafeJsonLd(newsArticleSchema)} />
```

### Google News sitemap endpoint (hand-written — Don't Hand-Roll)
```ts
// src/pages/news-sitemap.xml.ts — no package covers the `news:` namespace.
// Format per developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
export async function GET() {
  const recent = articles.filter((a) => Date.now() / 1000 - a.published_at < 48 * 3600);
  const urls = recent.slice(0, 1000).map((a) => `
    <url>
      <loc>https://915tldr.com/${a.category}/${a.slug}-${a.id}</loc>
      <news:news>
        <news:publication>
          <news:name>915 TLDR</news:name>
          <news:language>en</news:language>
        </news:publication>
        <news:publication_date>${new Date(a.published_at * 1000).toISOString()}</news:publication_date>
        <news:title>${escapeXml(a.title)}</news:title>
      </news:news>
    </url>`).join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| v1: per-request D1 query in a Nuxt server route for RSS/sitemap/404-suggestions | Build-time generation from an already-fetched, incrementally-synced dataset | This rebuild (Phase 3/4) | Removes the per-request D1 dependency entirely — the whole point of the zero-D1-reads core value |
| Astro: plain `getStaticPaths()` + hand-rolled staleness tracking | Content Layer API (`defineCollection` + custom `Loader`, `meta`/`digest`) | Astro 5.0+ (Content Layer stable since then; `meta`/`digest` are part of the stable Loader API) [CITED: github.com/withastro/docs content-loader-reference.mdx `DataEntry.digest` "Since v5.0.0"] | Gives incremental builds a first-class, persisted-across-builds mechanism instead of a hand-rolled one |
| `output: 'hybrid'` | `output: 'static'` (hybrid merged into static in Astro v5) | Already correctly applied in this repo (Phase 3) | No action needed — noted only for completeness, this project already got it right |

**Deprecated/outdated:**
- `experimental.incrementalBuild` is new enough (Astro 7.1+, per its own docs page) that "current" and "stable" are not the same claim here — it is presently the *only* built-in mechanism for skipping page re-render, but its production-readiness for a CI environment like Workers Builds is exactly what this phase's Wave 0 must prove, not assume.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A `throw` inside a Content Layer `Loader.load()` fails `astro build` with a non-zero exit, the same way a `throw` inside `getStaticPaths()` does (proven in Phase 3) | Pattern 1, Open Questions #1 | If the Loader's error is instead caught/wrapped and the build continues with a partial or stale store, REND-02/REND-03's entire fail-loud guarantee is silently defeated — the exact `/changelog` empty-state bug this phase exists to prevent, reborn one layer deeper |
| A2 | `experimental.incrementalBuild`'s page-skip mechanism will behave identically on Workers Builds' container as it does in the open GitHub issues' reporters' CI environments (i.e., it will also fail to skip reliably here) | Common Pitfalls #1, Summary | If wrong (the flag works fine on Workers Builds specifically), this phase can skip the Wave 0 spike and proceed directly — but the cost of assuming it works and being wrong (every build silently re-renders the full corpus and times out) is much higher than the cost of spiking it first |
| A3 | 307 (not 301) from Cloudflare's native `html_handling` is acceptable for this project's SEO goals, given CONTEXT.md asked for "a single 301" | Common Pitfalls #2 | If the owner specifically needs 301 (e.g., for a redirect-signal-sensitive migration), the project would need a Worker-mediated redirect instead of the free native mechanism, adding Worker invocations to a path this project otherwise keeps asset-only |
| A4 | The 8 categories referenced throughout (DSGN-04, `[category]` routing) are a fixed, already-seeded set that does not require a fresh D1 query to enumerate at plan time | Recommended Project Structure | Low risk — this is carried-forward project knowledge (PROJECT.md DSGN-04), not verified fresh this session via a D1 read |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does a thrown error inside a Content Layer `Loader.load()` actually fail `astro build`?**
   - What we know: Phase 3 proved this pattern works for a plain `getStaticPaths()` throw. Astro's own docs show `Loader.load()` as an async function inside the content-sync phase of the build, and show error *wrapping* behavior for *live* loaders (`LiveCollectionError`) but did not surface an equivalent example for a regular build-time Loader's `load()` throwing.
   - What's unclear: whether an uncaught exception in `load()` propagates to a non-zero `astro build` exit code identically to a `getStaticPaths()` throw, or whether Astro's content-sync orchestration catches and logs it differently (e.g., only failing at the point a page tries to read a collection that failed to sync, which could be a different, later failure mode than "the build fails immediately").
   - Recommendation: Wave 0 task — write the minimal reproduction (a Loader that unconditionally throws) and run `astro build`, confirm the exit code and where in the pipeline the failure surfaces, before REND-02/REND-03's tests are written against an assumed behavior.

2. **Will `experimental.incrementalBuild` actually skip re-rendering on Workers Builds?**
   - What we know: it is documented, stable-shaped API surface (not a flag likely to be removed), but has five open upstream bug reports as of this research, one of which describes the exact "fresh CI container" failure mode Workers Builds represents.
   - What's unclear: whether Workers Builds' specific caching/restore mechanics (which the open issue's reporter describes as differing from their own CI) avoid or reproduce the non-deterministic module-hash-ordering root cause.
   - Recommendation: spike first (see Common Pitfalls #1); have a fallback design (render step stays in the cron Worker) ready before committing task structure to the flag.

3. **How should a forced full rebuild actually execute, now that D-05 moved `astro build` to Workers Builds?**
   - What we know: Workers Builds has a hard 20-minute timeout; Phase 3's chained-cron-cycle design assumed rendering happened inside the cron Worker.
   - What's unclear: whether the owner wants an automated chunked-build-chain (more engineering, fully automated) or a manual local-`wrangler-deploy` full rebuild (simpler, matches Phase 3's proven pattern, requires a human to run it).
   - Recommendation: surface this explicitly to the owner during planning rather than the plan silently picking one — it changes what "a full rebuild" means operationally for the rest of this project's life.

4. **Does v1's sitemap.xml's `/tags`/`/sources`/etc. actually receive meaningful traffic, informing D-11's 301 targets?**
   - What we know: CONTEXT.md flags this as a cheap research check the planner should do; this research pass did not pull live traffic data (out of scope for a code-and-docs research pass, and not free to query without a specific analytics source named).
   - What's unclear: whether `/categories` or `/sources` have external backlinks worth preserving with a more specific redirect than "→ homepage."
   - Recommendation: a quick grep of `915tldr.com2` for any external mentions, or a Cloudflare Analytics check, before finalizing D-11's redirect targets — cheap, and named explicitly in CONTEXT.md as unresolved.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cloudflare Workers Builds (GitHub integration) | D-01/D-02/OPS-10 | ✗ (no git remote connected yet — D-03 not yet executed) | — | None — this is a hard planning dependency; the plan's Wave 0 must include connecting the GitHub repo before any Deploy-Hook-triggered build can be tested |
| `wrangler` | build/deploy | ✓ | 4.136.3 [VERIFIED: package.json] | — |
| Node.js | build | ✓ | engines requires `>=24` [VERIFIED: package.json `"engines": {"node": ">=24"}`] | — |
| `@astrojs/rss` | SEO-06 | ✗ (not installed) | latest 4.0.19 | Hand-roll (not recommended — see Don't Hand-Roll) |
| `@astrojs/sitemap` | SEO-04 | ✗ (not installed) | latest 3.7.4, SUS-flagged | Hand-roll the general sitemap too, but this loses `serialize()`'s convenience for no real safety gain — the SUS flag is judged a false positive above |

**Missing dependencies with no fallback:**
- Cloudflare Workers Builds GitHub connection (D-03) must exist before REND-04/OPS-10/D-02 can be tested end-to-end — this is a sequencing dependency for the plan's wave structure, not a missing tool.

**Missing dependencies with fallback:**
- `@astrojs/rss`, `@astrojs/sitemap` — both trivially installable; fallback (hand-rolling) is available but not recommended per Don't Hand-Roll.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (unit/integration) + Playwright (`@playwright/test` 1.63.0) for browser-driven checks [VERIFIED: package.json scripts `test:unit`, `test:build-gate`, `test:tracer`, `test:e2e`] |
| Config file | none dedicated — invoked via `package.json` scripts; Playwright config lives in `design/scripts/pw.mjs` |
| Quick run command | `pnpm run test:unit` (runs `pnpm run build && node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"`) |
| Full suite command | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:tracer && pnpm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| REND-02/REND-03/FIX-05 | Loader throws on zero rows / fewer than last-good count; `/changelog` empty-state regression | unit | `node --test tests/regression/changelog-empty-state.test.mjs` | ❌ Wave 0 |
| REND-01 | Loader reads D1 incrementally via `meta` watermark | unit (with a stubbed `fetchImpl`, following `kv-manifest.ts`'s existing `opts.fetchImpl` test-injection pattern) | `node --test tests/unit/articles-loader.test.mjs` | ❌ Wave 0 |
| REND-05 | Unchanged articles are not re-rendered (once experimental.incrementalBuild is proven, per Open Question #2) | integration (two consecutive builds, assert render-skip log lines) | manual/scripted spike, not yet a fixed test | ❌ Wave 0 spike first |
| SEO-04/FIX-04 | `/crime` and `/crime/**` both resolve; old UUID URLs redirect | integration (build then fetch against `dist/client` or a local `wrangler dev`) | `node --test tests/integration/url-shapes.test.mjs` | ❌ Wave 0 |
| SEO-05/SEO-06 | `robots.txt`/`rss.xml` content matches preserved policy | unit (string/XML assertions against rendered output) | `node --test tests/unit/seo-surfaces.test.mjs` | ❌ Wave 0 |
| SEO-01/SEO-02 | JSON-LD present and schema-shaped | unit (structural assertion: required keys present, `@type` correct) | `node --test tests/unit/structured-data.test.mjs` | ❌ Wave 0 |
| SEO-01/SEO-02 (validation, not just emission) | Rich Results Test passes on a real built article | manual-only | Google's Rich Results Test tool has no CI-friendly API for this project's budget; run manually against a preview deploy | N/A — manual by nature |
| SEO-03 | Google News sitemap contains only last-48h articles, ≤1000 entries | unit | `node --test tests/unit/news-sitemap.test.mjs` | ❌ Wave 0 |
| SOC/IDNT-03/04 | AI disclosure + attribution markup present on every article | unit (DOM assertion against rendered HTML, e.g. via `linkedom` — already proven usable in this project per Phase 2's Workers-runtime tracer) | `node --test tests/unit/article-markup.test.mjs` | ❌ Wave 0 |
| ARCH-02/03 (guard, not new) | D1-import assertion still passes with new pages/loader added | existing | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` | ✓ exists |

### Sampling Rate
- **Per task commit:** `pnpm run test:unit` (fast, no live infra)
- **Per wave merge:** full suite including `test:build-gate` and `test:tracer` (the latter hits real D1/KV — budget-aware, already an established pattern)
- **Phase gate:** full suite green, plus the Open Question #1/#2 spikes explicitly resolved (not just "tests pass") before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/regression/changelog-empty-state.test.mjs` — covers REND-02/REND-03/FIX-05
- [ ] `tests/unit/articles-loader.test.mjs` — covers REND-01
- [ ] `tests/integration/url-shapes.test.mjs` — covers SEO-04/FIX-04
- [ ] `tests/unit/seo-surfaces.test.mjs` — covers SEO-05/SEO-06
- [ ] `tests/unit/structured-data.test.mjs` — covers SEO-01/SEO-02
- [ ] `tests/unit/news-sitemap.test.mjs` — covers SEO-03
- [ ] `tests/unit/article-markup.test.mjs` — covers IDNT-03/IDNT-04/SEO-07
- [ ] Spike: two-consecutive-Workers-Builds-runs proof for `experimental.incrementalBuild` (Open Question #2) — not a unit test, a recorded experiment result
- [ ] Spike: minimal Loader-throw reproduction against real `astro build` (Open Question #1)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface in this phase (Better Auth removal is Phase 12; contact form is non-functional mockup port, Phase 10 wires real submission) |
| V3 Session Management | No | No sessions; `session: false` already set (Phase 3) |
| V4 Access Control | No | No access-controlled routes in this phase's page list |
| V5 Input Validation | Partial | The contact form ported this phase is explicitly non-functional (`design/mockups/contact.html:283` [VERIFIED: `design/mockups/contact.html:283`, `"This is a design mockup. The form below does not send anything."`]) — no server-side input processing exists yet, so V5 is not yet live, but the 404 suggestion index's client-side path-token matching (D-10a) does consume untrusted input (the requested URL path) and must render suggestions via `textContent`, never `innerHTML` |
| V6 Cryptography | No | No new cryptographic surface this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| JSON-LD script-tag breakout via AI-generated title/summary content | Tampering | Escape `<` to `<` before embedding JSON-LD (Code Examples, Common Pitfalls #5) |
| Open-redirect via the Worker's UUID-parsing 301 path (D-08) | Tampering / Spoofing | Validate the extracted path segment strictly against the UUID regex before using it to build the KV lookup key or the redirect `Location` header; on any non-match, fall through to the static 404 rather than reflecting the raw path segment |
| XSS via the 404 suggestion index's client-side rendering of matched titles | Tampering | Render suggestion titles with `textContent`/`createElement`, never `innerHTML` — matches the existing, already-audited pattern in `design/mockups/index.html`'s load-more script |
| Category/tag/source slug used to construct a file path or KV key without validation | Tampering | These are enumerated at build time from a fixed, already-seeded set (categories) or from D1-derived slugs (tags/sources) — not user-supplied at request time in this phase's page list, so path-traversal risk is structurally absent as long as no phase-4 route accepts a raw user-supplied slug for a build-time file lookup |

## Sources

### Primary (HIGH confidence)
None — no claim in this document was independently cross-checked across two authoritative sources to qualify for HIGH per this project's `classify-confidence` seam (`context7` alone tops out at MEDIUM, `--verified` still returns MEDIUM per this project's seam configuration).

### Secondary (MEDIUM confidence)
- Context7 `/withastro/docs` — Content Layer/`Loader` API (`load()`, `store.set()`, `generateDigest()`, `meta` MetaStore, `DataEntry.digest`), `@astrojs/rss` trailing-slash option, `build.format`/`trailingSlash` interaction, `experimental.incrementalBuild` mechanics and `cacheDir` location, `@astrojs/sitemap` capabilities/limitations, custom 404 page build output.
- Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt` — `wrangler.jsonc` `assets.not_found_handling`/`html_handling` full option set and redirect-code tables, Workers Builds Deploy Hooks (rate limits, idempotent-retrigger response shape), Workers Builds Limits & Pricing table (build minutes, 20-minute timeout, concurrency).
- `npm view @astrojs/rss version`, `npm view @astrojs/sitemap version` — direct registry queries, current versions.
- Package-legitimacy gate (`gsd-tools query package-legitimacy check`) — `@astrojs/rss`/`@astrojs/sitemap` verdicts, download counts, publish dates.

### Tertiary (LOW confidence)
- WebSearch: `experimental.incrementalBuild` open GitHub issues (`withastro/astro#18055`, `#17652`, `#17642`, `#17974`, `#17615`) — real, named, checkable issue numbers, but not independently reproduced in this project's own environment; treat as a strong reason to spike, not as proof the bug definitely applies here.
- WebFetch (`github.com/withastro/astro/issues/18055`): root-cause detail on the fresh-CI-machine cache-miss bug.
- WebSearch/WebFetch: Google News sitemap format (`developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap`) and NewsArticle/Rich-Results eligibility criteria — general web search results, not a single authoritative fetch per claim; cross-check against the live Rich Results Test tool during implementation regardless, per SEO-01/02's own "validated, not merely emitted" requirement.

## Metadata

**Confidence breakdown:**
- Standard stack (Astro/Cloudflare config mechanics): MEDIUM — Context7-sourced from official docs mirrors, not independently cross-verified against a second source per claim
- Architecture (Content Layer Loader + incremental build design): MEDIUM design, LOW on the one load-bearing experimental-flag assumption — explicitly flagged for a Wave 0 spike rather than presented as settled
- Pitfalls: MEDIUM-HIGH on the wrangler.jsonc config gaps (directly verified against the current file plus official docs); LOW on the incremental-build risk (real but unverified-in-this-project's-environment upstream bug reports)
- SEO/structured data: LOW-MEDIUM — general web search, not independently cross-checked per claim; the phase's own success criteria already require Rich Results Test validation as a separate, later verification step

**Research date:** 2026-09-26
**Valid until:** 7 days for the `experimental.incrementalBuild` risk assessment specifically (fast-moving, actively-patched Astro feature — re-check issue status before the plan locks in a design around it); 30 days for the Cloudflare Workers Static Assets/Builds config facts (stable platform documentation, changed only twice in the last year per this project's own prior research citations).

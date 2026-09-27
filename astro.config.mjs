// ARCH-04 / ARCH-05 / ARCH-06: this config is the one place those three requirements are
// asserted in code. `output: 'static'` (not the removed v5 keyword `'hybrid'`); the Cloudflare
// adapter's `imageService` set EXPLICITLY as the two-key object form — `@astrojs/cloudflare`
// v14.2.0+ silently defaults `imageService` to `'cloudflare-binding'`, which would introduce a
// live Cloudflare-account dependency into the build unless overridden here; and the D1-import
// assertion (ARCH-02/ARCH-03) registered as a Vite plugin so it runs inside `astro build`'s own
// Rollup pipeline, not as a separate, skippable step.
//
// `prerenderEnvironment: 'node'` — a finding from this task's own tracer run, not in
// 03-RESEARCH.md: `@astrojs/cloudflare` defaults prerendering to a simulated `workerd` sandbox
// (Miniflare) since v13.1.0, NOT plain Node, so `process.env` inside `getStaticPaths()` is not
// automatically populated from the host shell the way Pattern 2 (03-RESEARCH.md) assumes ("the
// Content Loader ... runs once, in Node, during `astro build`"). Setting this explicitly to
// `'node'` is the documented lever (Astro adapter-reference) for making that assumption true —
// without it, `src/lib/server/d1-client.ts`'s `process.env.CLOUDFLARE_ACCOUNT_ID` read throws
// inside the workerd sandbox even though the host process has the variable set.
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import { assertNoD1Plugin } from './tools/assert-no-d1.mjs';

export default defineConfig({
  output: 'static',
  // Canonicals, RSS and sitemaps must name the PRODUCTION origin, not this build's own deploy
  // target — dev.915tldr.com stays noindexed by the edge Transform Rule (docs/phase-03/
  // edge-config.md) regardless of what `site` says here, so a staging build canonicalising to
  // production is correct, not a bug (owner decision 2026-09-26, ROADMAP Phase 4).
  site: 'https://915tldr.com',
  // Owner decision 2026-09-26 (ROADMAP Phase 4): drop the trailing slash. v1 answers `/path`
  // directly with 200; nine months of indexed URLs are in the no-slash form. The `build.format`
  // key just below (routes emit `path.html`, not `path/index.html`) is required alongside this
  // key for Cloudflare's native `auto-trailing-slash` asset handling to produce exactly
  // `/path` -> 200, `/path/` -> a redirect to `/path`, with zero Worker invocation.
  // `@astrojs/rss`'s `rss()` helper needs its OWN no-trailing-slash option passed at the call
  // site — this project-level key does not propagate into that package's item links.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // This tracer uses no `server:defer` islands and no Astro Sessions API. `session` is
  // Astro's OWN top-level config key (astro/dist/types/public/config.d.ts), not an adapter
  // option — 03-01 originally set this inside the Cloudflare adapter factory call below, where
  // the adapter's `...cloudflareOptions` spread silently absorbs and ignores it (the adapter
  // reads `config.session`, i.e. this top-level key, never anything passed to its own factory).
  // That placement was a no-op: the adapter still auto-provisioned an unrequested `SESSION` KV
  // binding on every build, confirmed live by this plan's first real `wrangler deploy` (03-05
  // Task 1) showing `env.SESSION` bound with no id. Fixed by moving the key to where Astro
  // itself actually reads it (deviation Rule 1 — 03-01's original fix never worked).
  //
  // NOTE for future editors: never write the adapter factory name immediately followed by an
  // open parenthesis, with no space between them, inside a comment above the real adapter call.
  // tests/unit/astro-config.test.mjs's ARCH-06 check locates the adapter's call arguments with
  // a naive, non-comment-aware string search for that exact four-character-plus-paren sequence,
  // and will match a comment mentioning it before the real call below — exactly what this
  // comment block originally did (caught by that test's own regression during this task).
  session: false,
  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'passthrough' },
    prerenderEnvironment: 'node',
  }),
  integrations: [
    vue(),
    // SEO-04: the general crawl-surface sitemap, generated from the build's own route list
    // (astro:build:done's `pages`), not a hand-maintained URL list. That `pages` list includes
    // every route under src/pages/ this build produced, including this plan's own non-HTML
    // endpoints (rss.xml, news-sitemap.xml, version.json, 404-index.json) — a sitemap is a
    // crawl surface for HTML pages, so those are filtered out below, confirmed against the real
    // built sitemap output (04-07-PLAN.md Task 3), not assumed. `/404` is also excluded by the
    // integration's own internal STATUS_CODE_PAGES set; named here too for clarity since this
    // filter already has to reason about every other non-page route.
    sitemap({
      filter: (page) => {
        if (/\/404$/.test(page)) return false;
        const { pathname } = new URL(page);
        // Every real HTML route in this project (home, category, article, tag, source, tags)
        // is extensionless under trailingSlash:'never' + build.format:'file'; a dotted final
        // path segment is this project's own reliable "not an HTML page" signal.
        return !/\.[a-z0-9]+$/i.test(pathname);
      },
    }),
  ],
  vite: {
    plugins: [assertNoD1Plugin()],
  },
});

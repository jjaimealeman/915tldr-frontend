// 06-11 (I18N-06/D-08): pure helpers `astro.config.mjs`'s `sitemap()` integration call draws
// from — kept here, not inlined in the config, so they are unit-testable under plain
// `node --test` (matching `seo-feeds.ts`'s own "pure selectors live in a lib module, the route/
// config stays a thin wrapper" convention). No `src/lib/server/` import — `spanishSitemapExclusions`
// reads `src/lib/archive/tier-facts.ts` only, the same build-time-scratch-artifact module the
// `/es` article route itself writes to.
import type { SitemapItem } from '@astrojs/sitemap';
import { readTierFacts } from '../archive/tier-facts.ts';
import { languageOfPath } from '../article-url.ts';
import { OPT_OUT_PATHS } from '../opt-out.ts';

// `@astrojs/sitemap`'s own `filter` callback runs once per candidate URL, all inside the
// `astro:build:done` hook — well after EVERY page (including the `/es` article route's own
// `getStaticPaths`, which writes `ARTICLE_FACTS_ES_PATH`) has already rendered. Memoized so the
// facts files are parsed/validated once per build, not once per candidate URL (tens of thousands
// of `filter()` calls in this corpus).
let cachedExclusions: Set<string> | undefined;

/**
 * The set of `/es` article paths whose Spanish tier fact is `translated: false` — an
 * English-fallback page served under `/es` (D-05: no clean translation exists, or one exists but
 * failed block validation). Every such path must never appear in any sitemap file, and must
 * never be offered as an `xhtml:link` alternate from its English counterpart (T-06-42) — this is
 * the SAME `translated` flag `tools/partition-archive.mjs` and the `/es` article route's own
 * `noindex` decision already key off, so a page can never be "sitemap-indexable" and
 * "D-05-fallback-noindexed" at the same time by construction.
 */
export function spanishSitemapExclusions(): Set<string> {
  if (!cachedExclusions) {
    const { articlesEs } = readTierFacts();
    cachedExclusions = new Set(
      articlesEs.filter((entry) => !entry.translated).map((entry) => entry.path)
    );
  }
  return cachedExclusions;
}

/**
 * Post-phase-06 closeout (owner decision 2026-10-07): paths that are `noindex` by POLICY rather
 * than by per-article fact, so they must not appear in any sitemap file (and therefore never as an
 * `xhtml:link` alternate of their English twin either — `@astrojs/sitemap` pairs only the URLs that
 * survive `filter`). Today that is every `/es/tag/<slug>`: the cards are mostly English fallback.
 * Also the two Umami opt-out utility pages (`OPT_OUT_PATHS`, noindex, owner-only bookmarks).
 * Deliberately NOT excluded: `/es/tags` (the index) and `/es/source/*`. Segment-exact on purpose.
 * Keep in step with `tagPageSeo('es')` in `./tag-page.ts`.
 */
const SPANISH_TAG_PAGE_RE = /^\/es\/tag\/[^/]+$/;

export function isSitemapExcludedPath(pathname: string): boolean {
  return SPANISH_TAG_PAGE_RE.test(pathname) || (OPT_OUT_PATHS as readonly string[]).includes(pathname);
}

/** Test-only: forces the next `spanishSitemapExclusions()` call to re-read the facts files
 * instead of returning a cached `Set` from an earlier call in the same process. */
export function resetSpanishSitemapExclusionsCache(): void {
  cachedExclusions = undefined;
}

/**
 * `@astrojs/sitemap`'s `chunks` option (3.7.0+, confirmed against the installed package's own
 * `dist/index.js`): one callback per output file name — returning the item unchanged keeps it in
 * that chunk, returning `undefined` drops it. Partitioned purely on `languageOfPath`, the SAME
 * exact-first-segment test every other `/es` routing decision in this project uses
 * (`article-url.ts`) — a chunk's membership can never drift from what `localizedPath`/
 * `languageOfPath` themselves consider Spanish. `@astrojs/sitemap` writes one or more numbered
 * files per chunk key (`sitemap-en-0.xml`, `sitemap-es-0.xml`, and a `-1`, `-2`, ... suffix for
 * every additional `entryLimit`-sized slice) — this project's real corpus exceeds the 45,000
 * default `entryLimit` per language, so each language gets more than one file; both key names
 * stay fixed regardless of how many numbered files a given build produces.
 */
export function sitemapChunks(): Record<string, (item: SitemapItem) => SitemapItem | undefined> {
  return {
    en: (item) => (languageOfPath(new URL(item.url).pathname) === 'en' ? item : undefined),
    es: (item) => (languageOfPath(new URL(item.url).pathname) === 'es' ? item : undefined),
  };
}

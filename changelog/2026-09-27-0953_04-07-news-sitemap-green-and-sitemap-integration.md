# 2026-09-27 - GREEN: Google News sitemap implemented; @astrojs/sitemap integration added (04-07 Task 3, plan complete)

**Keywords:** [FEATURE] [SEO] [BACKEND] [CONFIG] [TESTING]
**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0953_04-07-news-sitemap-green-and-sitemap-integration.md`

## What Changed

- File: `src/pages/news-sitemap.xml.ts` (new)
  - Prerendered `GET` reading the same in-memory Content Layer collection every other page reads
    (no D1/KV), anchoring `selectNewsWindow`'s 48-hour window at the build moment (`Date.now()`) —
    correct for a feed rebuilt every cron cycle. Renders via `newsSitemapXml` (both implemented in
    the prior Task 2 commit's `src/lib/seo-feeds.ts`).
- File: `astro.config.mjs`
  - Added `sitemap` from `@astrojs/sitemap` to `integrations`, with a `filter` that drops `/404`
    (belt-and-suspenders — the integration's own internal `STATUS_CODE_PAGES` set already excludes
    it) and any URL whose final path segment carries a dotted extension. Confirmed by reading the
    installed package's own source (`node_modules/@astrojs/sitemap/dist/index.js`) that its
    `pages` list from `astro:build:done` includes every route under `src/pages/`, including this
    plan's own JSON/XML endpoints (`rss.xml`, `news-sitemap.xml`, `version.json`,
    `404-index.json`) — none of those belong in a sitemap of public HTML pages, and this project's
    extensionless (`trailingSlash: 'never'` + `build.format: 'file'`) URL scheme makes "a dot in
    the last path segment" a reliable, general signal rather than a hand-maintained exclusion
    list.

## Why

SEO-03 (Google News sitemap, 48h window, hand-written since no package covers the `news:`
namespace) and SEO-04 (general crawl-surface sitemap, generated from the build's own route list
rather than a hand-maintained URL list).

## Issues Encountered

No bugs. One finding worth recording: without the filter, `@astrojs/sitemap` would have silently
included `rss.xml`, `news-sitemap.xml`, `version.json` and `404-index.json` as sitemap "pages" —
confirmed by reading the package's build hook, not assumed from its docs (its docs describe the
`filter` option's existence but not this project's specific non-HTML-endpoint collision).

## Dependencies

No dependencies added (both packages installed in the prior Task 2 commit).

## Testing Notes

- What was tested: full real `pnpm run build` (59,889 pages, production D1 read-only +
  render-manifest KV) produced `dist/client/news-sitemap.xml`, `sitemap-index.xml`, `sitemap-0.xml`
  (45,000 URLs) and `sitemap-1.xml` (14,888 URLs) — 59,888 total, exactly equal to the built HTML
  file count (59,889) minus `404.html`, confirmed via direct `grep -o "<loc>"` counts against the
  real files, not assumed. `grep`-verified zero `.xml`/`.json`/`/404` URLs leaked into either
  sitemap file. `news-sitemap.xml` had 210 entries this run (a real production news-volume
  measurement, not a fixture), all within 48h of `/version.json`'s `builtAt`, with `&`/`<` in a
  real article title (`Cuban Man's Year in ICE Detention...`) correctly escaped as `&#39;`.
  `node --test tests/unit/news-sitemap.test.mjs` (13/13 passing); full `design/tests/unit/**` +
  `tests/unit/**` regression suite (330/330 passing, no regressions); `pnpm run test:build-gate`
  and `pnpm run guard:config` both pass.
- What wasn't tested: a real Google Search Console sitemap-submission round trip (out of scope for
  a build-time task; that's an operational step after deploy).
- Edge cases: the zero-entries-in-window case (a quiet news day) is covered by a direct unit test
  of `newsSitemapXml([], origin)`, not observed live (this build's real corpus had 210 in-window
  articles).

## Next Steps

- [ ] 04-07-PLAN.md is now complete — SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md follow in
      a separate metadata commit
- [ ] 04-12's live verification should include: robots.txt served to a real Googlebot-declared
      user agent, an actual RSS-reader subscription check, and confirming Cloudflare/Google
      Search Console picks up the new `sitemap-index.xml`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - completes 04-07: SEO-03/SEO-04/SEO-05/SEO-06 all shipped as static,
zero-D1-read build artifacts; production robots.txt behavior changes on next deploy (04-07 Task 2)

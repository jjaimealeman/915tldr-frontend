# 2026-09-26 - Base.astro's full chrome + head-metadata contract, ArticleCard, committedAt

**Keywords:** [FEATURE] [FRONTEND] [SEO] [BACKEND]
**Session:** Evening, phase 04 plan 02 execution (Task 2)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-2355_04-02-base-chrome-articlecard-commit-date-stamp.md`

## What Changed

- File: `src/layouts/Base.astro` (extended)
  - New props: `description`, `canonicalPath`, `noindex`, `jsonLd`, `activeCategory`,
    `datelineEpoch`, `stamp` (`'build' | 'commit'`, default `'build'`), `layout` — the frozen
    interface `04-02-PLAN.md` records for every downstream Phase 4 template to build on
  - `<head>`: meta description, one `<link rel="canonical">` built from `Astro.site` + the given
    path (throws at build time if a non-root path carries a trailing slash), `<meta
    name="robots" content="noindex">` when requested, the `/rss.xml` alternate link, and the
    site-wide Organization + WebSite JSON-LD nodes plus any page-supplied `jsonLd` nodes, each
    rendered via `toSafeJsonLd()` in its own `<script type="application/ld+json">`
  - `<body>`: full approved chrome ported from the mockups — dateline, category spectrum, the
    8-category nav (`aria-current` on the active category), the unhydrated theme-toggle button
    (markup only; the island ships in Phase 8), `data-layout` on `<main>`. Home page (`page ===
    'home'`) renders the wordmark as a plain `<h1>` matching `design/mockups/index.html` exactly;
    every other page gets `<p data-wordmark><a href="/">915 TLDR</a></p>`
  - Footer: Changelog/Contact links extended with About/Privacy/Terms (D-10's static pages — a
    named addition beyond the approved mockup footer); the build-stamp paragraph now carries
    `data-stamp={stamp}` and reads from `BUILD_COMMIT_DATE` when `stamp="commit"`
- File: `src/components/ArticleCard.astro` (new)
  - Three variants matching the approved mockups exactly: `default` (`data-card`, plain grid
    card), `lead` (`data-lead data-lead-variant="type"`, `<h2>` by default), `compact`
    (`data-card data-card-variant="compact"`, no summary — matches the article-page rail cards).
    No image frame (imagery is Phase 7)
- File: `src/lib/build-info.ts` (extended)
  - `resolveCommitDate(env, run)` — the deployed commit's own committer date via `git show -s
    --format=%cs`, following the exact same CI-marker refusal discipline as `resolveBuildHash`
    (a shallow CI checkout's git output is refused rather than trusted); validates a
    `WORKERS_CI_COMMIT_SHA` against a hex-shape regex before it is ever interpolated into a shell
    command. `BUILD_COMMIT_DATE` exported at module evaluation, same "captured once, read twice"
    discipline as `BUILD_HASH`/`BUILD_TIMESTAMP`
- File: `src/pages/version.json.ts`
  - New `committedAt` field (`BUILD_COMMIT_DATE`)
- File: `tests/unit/build-stamp.test.mjs` (extended)
  - 7 new `resolveCommitDate` unit cases (sha path, CI-without-sha refusal, HEAD path, garbage
    output, hex-shape validation) plus a cross-surface case asserting `dist/client/version.json`
    carries a `committedAt` shaped `YYYY-MM-DD` or the honest `"unknown"` fallback
- File: `tests/unit/chrome.test.mjs` (new)
  - Against a real built article page under `dist/client`: all 8 nav links present in
    `CATEGORIES` order with absolute no-trailing-slash hrefs, exactly one Organization and one
    WebSite JSON-LD block, the RSS alternate link, the five footer links, `[data-dateline]`, and
    `[data-build][data-stamp]`

## Why

Every article, listing, 404 and static-page plan in Phase 4's later waves renders through this
layout — doing the chrome/head-metadata contract once here keeps every page's `<head>` consistent
and keeps build-machine clock/timezone drift out of the HTML (criterion 3's byte-identical
unchanged articles).

## Issues Encountered

None new beyond Task 1's escape-sequence write-corruption finding (already fixed and documented in
the prior commit). Verified `ArticleCard.astro`'s three variants against a throwaway smoke page
(`src/pages/smoke-articlecard-test.astro`, built once with `pnpm build`, output inspected, then
deleted — never committed, and the build was re-run afterward to confirm the page count returned
to 328) since nothing in the Phase 4 route set imports the component yet.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (328 pages, no errors) then `node --test
  tests/unit/build-stamp.test.mjs tests/unit/chrome.test.mjs` — 22/22 passing; `pnpm run
  test:build-gate` — 6/6 passing (D1-import assertion unaffected by the new modules); the full
  fast unit suite (`design/tests/unit/**/*.test.mjs tests/unit/**/*.test.mjs`) — 157/157 passing;
  acceptance greps: `toSafeJsonLd` count >=1 in `Base.astro`, `data-theme-toggle` count exactly 1,
  `<script` count 3 (all `application/ld+json`, no inline JS), `committedAt` count exactly 1 in
  `version.json.ts`
- What wasn't tested: a real browser render (no page yet consumes `ArticleCard.astro` in the
  committed route set — 04-03 wires it into the index/category listings); Lighthouse/WCAG (Phase
  4's later plans and the end-of-phase gate)
- Edge cases: `canonicalPath` trailing-slash assertion (throws for any non-`/` path ending in
  `/`), `layout` attribute omission when not passed, `aria-current` omission when
  `activeCategory` doesn't match, the home-page-only `<h1>` wordmark variant

## Next Steps

- [ ] 04-03: home page and category listings — first real consumers of `ArticleCard.astro` and
      `Base.astro`'s `activeCategory`/`layout` props

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - extends the shared layout every subsequent Phase 4 page depends on; no
user-visible route changes yet (only the existing article page's rendered chrome changed, gaining
the footer's three new links, the RSS alternate link and the site-wide JSON-LD)

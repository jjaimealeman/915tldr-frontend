# 2026-09-27 - Full article template: disclosure, attribution, tags, rail, canonical & structured data

**Keywords:** [FEATURE] [FRONTEND] [SEO] [SECURITY] [TESTING] [BUG_FIX]
**Session:** Late night, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0043_04-04-full-article-template.md`

## What Changed

- File: `src/pages/[category]/[slug].astro`
  - Rewrote the article page onto the full approved template (design/mockups/article.html):
    byline, `<h1>`, standfirst (`splitStandfirst`), summary body (`summaryBodyHtml`), the AI
    disclosure paragraph, the outlet attribution paragraph, a tags section, and the
    article-relative rail (owner decision 2026-09-26, checkpoint Task 1, option-a) as a sibling of
    `<article>` inside `<main>`, matching the mockup's structure exactly
  - Wired `newsArticleNode`/`breadcrumbNode` (04-02) into `Base`'s `jsonLd` prop, `canonicalPath`
    via `articlePath()`, and `stamp="commit"`/`layout="with-rail"`
  - `getStaticPaths` now computes `computeRails()` once over the whole collection, not per page
- File: `tests/unit/article-markup.test.mjs` (new)
  - 25 evenly-sampled built article pages assert: exactly one disclosure/attribution within the
    article; disclosure href === attribution href === `NewsArticle.isBasedOn.url`; outlet-name
    agreement across disclosure/attribution/byline; document order (body < disclosure <
    attribution < tags < rail); canonical href; no `Person` JSON-LD node; headline round-trip;
    `keywords` absence when untagged; every `time[datetime]` ends in `-06:00`/`-07:00`
- File: `tests/unit/build-stamp.test.mjs`
  - Updated the footer-date cross-surface test: article pages now assert `data-stamp="commit"`
    and a footer date equal to `/version.json`'s `committedAt`, not `builtAt`
- File: `tests/unit/chrome.test.mjs`
  - Fixed a real bug (Rule 1): the Organization/WebSite JSON-LD count test did a raw substring
    match, which also matched `NewsArticle.isBasedOn.publisher`'s nested `"@type":"Organization"`
    — now parses each script and checks its own top-level `@type`

## Why

Phase 4 Plan 04, Task 3: ports the approved trust surface (IDNT-03/04, SEO-07) onto real D1-backed
article data, and validates the SEO-01/02/04 structured-data/canonical mechanism against a real
consumer for the first time (04-02 built it with no page wiring it in yet). The rail implements the
owner's checkpoint decision (option-a) rather than the mockup's site-wide "Latest" list, so
unchanged articles stay byte-identical across the 2-hourly rebuild (criterion 3) instead of
re-uploading all ~40,000 pages every cycle.

## Issues Encountered

`tests/unit/chrome.test.mjs`'s Organization/WebSite JSON-LD count assertion broke the moment a real
`NewsArticle` node existed to test against — its substring-based filter matched the nested
`isBasedOn.publisher` object (also typed Organization, naming the original outlet) as a second
site-wide Organization block. Fixed by parsing each script and checking its own top-level `@type`
instead of a raw string search. This is a direct, in-scope consequence of this task's own new
`NewsArticle` markup (Rule 1), not an unrelated pre-existing failure.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a real `pnpm run build` (40,049 pages against production D1), then
  `tests/unit/article-markup.test.mjs` (25 sampled pages), `tests/unit/build-stamp.test.mjs`,
  `tests/unit/chrome.test.mjs` (48 tests total, all green), the full `pnpm run test:fast` suite
  (257 tests), `pnpm run test:build-gate` (D1-import assertion, 6 tests), and
  `pnpm run test:tracer` (5 tests, 1 intentionally skipped — `TRACER_LIVE_ORIGIN` not set). Also
  manually inspected two real built pages' `<article>` and `<aside data-rail>` HTML directly.
- What wasn't tested: a live-deployed article page (no deploy step in this plan); Rich Results
  Test validation of the emitted NewsArticle/BreadcrumbList (04-12 owns that); a real second-model
  visual check of the rendered chrome (no dev server was started this session, per project rule).
- Edge cases: an article with no tags (tags section and `keywords` both correctly omitted, covered
  by the sampled test), the oldest article's empty rail (unit-tested in `rail.test.mjs`, 04-04
  Task 2), an article whose `<article-body>` renders only a Key Details list (real corpus sample
  inspected manually).

## Next Steps

- [ ] 04-05+: remaining page types (home, category, tag, source, changelog, static pages)
- [ ] 04-12: Rich Results Test validation of the emitted structured data

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - every one of ~40,000 article pages now renders the full approved trust surface
and structured data

# 2026-10-04 - Spanish Google News Sitemap via a Parameterised News Function

**Keywords:** [FRONTEND] [FEATURE] [I18N] [SEO] [TESTING]

**Session:** Early morning, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0709_06-11-task2-es-news-sitemap-and-robots.md`

## What Changed

- File: `src/lib/seo-feeds.ts`
  - `newsSitemapXml` now takes an already-localised `NewsSitemapEntry[]` (`{ path, title,
    publishedAt }`) instead of `ArticleData[]`, plus an optional `{ language: 'en' | 'es' }`
    (default `'en'`) that sets `<news:language>`, validated through `assertLanguage` — an invalid
    value throws rather than silently coercing. `selectNewsWindow` is unchanged (it only reads
    `publishedAt`).
- File: `src/pages/news-sitemap.xml.ts`
  - Updated to the new signature: builds each entry's `path` itself via `articlePath` (default
    `'en'`), keeping English output byte-identical to before this change.
- File: `src/pages/es/news-sitemap.xml.ts` (new)
  - Spanish Google News sitemap: same 48-hour window and build-moment origin as the English
    route, filtered to only publishable Spanish translations (D-05), `/es` paths, Spanish titles,
    `{ language: 'es' }`. A quiet 48h window for Spanish content renders a valid, empty `urlset`.
- File: `public/robots.txt`
  - Added `Sitemap: https://915tldr.com/es/news-sitemap.xml` after the existing English
    news-sitemap line.
- File: `tests/unit/news-sitemap.test.mjs`
  - Updated the pure-function `newsSitemapXml` tests to the new entry shape via a `newsEntry()`
    fixture helper; added coverage for the default/explicit `language` option, the
    invalid-language throw, and that `loc` is built from `entry.path` rather than
    category/slug/uuid fields.
- File: `tests/unit/es-feeds.test.mjs`
  - Extended with Task 2 coverage: `/es/news-sitemap.xml` lists only translated, in-window
    articles with `/es` URLs, Spanish titles and `<news:language>es</news:language>`; a
    non-exhaustive Spanish-diacritic sanity check on the rendered titles.
- File: `tests/unit/seo-surfaces.test.mjs`
  - Updated the robots.txt exact-Sitemap-lines assertion to expect the new third line.

## Why

Completes I18N-06/D-08's Spanish Google News sitemap — one small route reusing
`newsSitemapXml`'s now-parameterised logic — and makes it discoverable via `robots.txt`.

## Issues Encountered

None — this task built cleanly on Task 1's already-proven exclusion/join patterns
(`localizedArticleView`, `articlePath(..., 'es')`), reusing the exact same "only publishable
Spanish versions" rule `/es/rss.xml` already established.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (same real build Task 1's commit already validated against;
  no further rebuild needed since all of this plan's code was written before the one build run)
  plus `node --test tests/unit/news-sitemap.test.mjs tests/unit/es-feeds.test.mjs` and
  `pnpm run test:regression` (per this task's own `<verify>`), the full `pnpm run test:fast`
  suite (1019/1019) and `pnpm run test:build-gate` (9/9) — all green.
- What wasn't tested: a real browser/visual check — not required by this task's acceptance
  criteria (dist-output assertions only).
- Edge cases: confirmed `grep -c "<news:language>en</news:language>" dist/client/news-sitemap.xml`
  equals its `<url>` count, and the Spanish file uses `es` exclusively, per this task's own
  acceptance criterion.

## Next Steps

- [ ] None for this plan — 06-11 is complete (both tasks). Phase 06's remaining plans continue
  per ROADMAP.md.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** LOW - adds one small, low-traffic route (a Google News sitemap for `/es`) and a
`robots.txt` line; no change to any existing English surface.

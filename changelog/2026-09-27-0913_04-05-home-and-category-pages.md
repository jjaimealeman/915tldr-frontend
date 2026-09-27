# 2026-09-27 - Homepage and the 8 category indexes, coexisting with /crime/** (04-05 Task 2)

**Keywords:** [FEATURE] [FRONTEND] [SEO] [ROUTING] [TESTING]
**Session:** Morning, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0913_04-05-home-and-category-pages.md`

## What Changed

- File: `src/pages/index.astro` (new)
  - `getCollection('articles')` + `sortNewestFirst(...).slice(0, HOME_FEED_COUNT)` drives the
    whole rendered feed (7 cards: 1 lead + 6 grid) from one flat newest-first list — the loader has
    no separate "lead" concept
    - v1's homepage title (`915 TLDR - El Paso News, Simplified`) and description, ported verbatim
    - `showYear` on each card is true only when the article's own year (America/Denver) differs
      from the build's year
    - Omits the load-more button and its status element (Phase 8 island, ISL-08) — renders the
      approved mockup's plain no-JS state
- File: `src/pages/[category]/index.astro` (new, FIX-04)
  - With `build.format: 'file'`, emits `dist/client/<category>.html` beside the
    `dist/client/<category>/` article directory `[category]/[slug].astro` already fills — `/crime`
    now coexists with `/crime/**`
  - `getStaticPaths` calls `assertNoRouteCollisions` before generating any page, then returns all
    8 `CATEGORIES` regardless of article count — a category with zero public articles still gets a
    real page with a `data-empty-state` message, never a 404 or a skipped route
    - v1's category title shape (`${name} News - El Paso`) and description
    - `BreadcrumbList` JSON-LD (`[Home, <category name>]`)
    - Masthead ported from `design/mockups/category.html`: `h1`, `data-story-count`
      (`Intl.NumberFormat`-formatted, singular/plural aware), `data-back-link` to `/`. The
      mockup's `data-category-description` decorative subtitle was intentionally omitted — no
      category-description field exists anywhere in the data model (`src/lib/categories.ts` is
      slug+name only), and no plan artifact asked for one; fabricating copy not backed by any real
      source would be worse than leaving it out
- File: `tests/unit/listing-pages.test.mjs` (new)
  - Proves `index.html` (card count, newest-first ordering via `time[datetime]`, canonical) and
    all 8 category pages (`aria-current="page"` on the page's own nav link, ≤30 cards,
    newest-first ordering, canonical, and that the sibling article directory still holds files)
    against a real `pnpm run build`

## Why

Phase 4 Plan 05, Task 2: success criterion 2 needs the home and category pages rendering real D1
content in the approved chrome, all regenerated every build (REND-04), with `/crime` answering
alongside `/crime/**` (FIX-04) rather than one clobbering the other.

## Issues Encountered

No major issues encountered. The build ran clean on the first attempt against real production D1
data (40,117 pages, ~1m 49s): `crime.html` and the `crime/` article directory both exist, and all
11 new/extended `listing-pages.test.mjs` assertions passed immediately.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a real `pnpm run build` against production D1 (40,117 pages), then
  `node --test tests/unit/listing-pages.test.mjs` (11/11 passing) plus the full
  `design/tests/unit/**` + `tests/unit/**` suite (283/283 passing) and the 6-test D1-import
  build-gate — all green, no regressions
- What wasn't tested: tag pages, `/tags`, source pages (Task 3, next)
- Edge cases: a category with articles vs. (in principle) zero — the empty-state branch renders
  correctly in the template but the current production corpus has articles in all 8 categories, so
  the true-empty branch is exercised by `groupByCategory`'s own unit tests (Task 1), not by this
  build-time test

## Next Steps

- [ ] Build tag pages, `/tags` and per-source pages on top of `groupByTag`/`groupBySource`/
      `tagIndex` (Task 3)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - two new real page routes, no regressions in existing routes

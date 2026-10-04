# 2026-10-04 - Tracer: /es Home, Category and Tag Listings With Real Spanish Titles

**Keywords:** [FRONTEND] [FEATURE] [I18N] [SEO] [TESTING]
**Session:** Late night, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0227_06-10-task1-tracer-es-home-category-tag-listings.md`

## What Changed

- File: `src/pages/es/index.astro`
  - Cards now switch to `localizedArticleView` for title/summary (D-05) instead of the
    unconditional English-marked-`lang="en"` placeholder 06-05 shipped — shows each article's real
    Spanish title/summary when a clean translation exists, same order/count as the English home.
- File: `src/pages/es/[category]/index.astro` (new)
  - The Spanish mirror of `src/pages/[category]/index.astro` — one `/es/<category>` page per
    `CATEGORIES` slug (8, including empty categories, D-04 empty state in Spanish), same
    `CATEGORY_PAGE_COUNT` slice of the same newest-first list. Card hrefs are the localized form
    of the English page's hrefs, in the same order.
- File: `src/pages/es/tag/[slug].astro` (new)
  - The Spanish mirror of `src/pages/tag/[slug].astro` — same `groupByTag` membership as the
    English route (tags are never translated), same `TAG_SLUG_RE` tampering guard, writes Spanish
    tag tier facts (`writeTagFactsEs`) with the full per-slug count, identical to the English
    tier-facts count by construction. Tag name stays untranslated, marked `lang="en"`.
- File: `tests/unit/es-listing-pages.test.mjs` (new)
  - Proves (against a real `pnpm run build`, not fixtures): `/es` home lists the same uuids in the
    same order as `/`; every category has an `/es` counterpart whose card hrefs are the localized
    form of the English page's hrefs; a translated article's card shows no English override while
    a fallback article's card is marked `lang="en"`; every English tag page (static or archived)
    has an `/es/tag` counterpart and the Spanish tag-facts count matches the English one exactly.

## Why

I18N-04 requires every public page type mirrored under `/es`. This tracer ships the first three
listing types (home, category, tag) end-to-end against real production data before expanding to
the remaining types (tags index, source pages, 404) in Task 2.

## Issues Encountered

None — the first real build against production D1 passed every new test on the first attempt.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build && node --test tests/unit/es-listing-pages.test.mjs
  tests/unit/listing-pages.test.mjs` — 13 new + 21 existing tests, all pass.
- What wasn't tested: Task 2's remaining page types (`/es/tags`, `/es/source/<slug>`, the Spanish
  404) — next in this same plan.
- Edge cases: an empty category (zero articles) renders the Spanish empty-state message, matching
  the English route's D-04 behavior.

## Next Steps

- [ ] Task 2: `/es/tags`, `/es/source/<slug>`, the Spanish 404 page and its suggestion index

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - ships three of the seven remaining `/es` listing page types with real
production-verified Spanish/English card localization.

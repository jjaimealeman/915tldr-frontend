# 2026-10-04 - /es/tags, /es/source/<slug>, the Spanish 404 and Its Suggestion Index

**Keywords:** [FRONTEND] [FEATURE] [I18N] [SEO] [SECURITY] [TESTING] [BUG_FIX]

**Session:** Late night, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0231_06-10-task2-es-tags-source-404-and-suggestion-index.md`

## What Changed

- File: `src/pages/es/tags.astro` (new)
  - Spanish mirror of `/tags` — same top `TAGS_INDEX_COUNT` tags, grouped the same way, `/es/tag`
    hrefs; each tag name stays untranslated, marked `lang="en"`.
- File: `src/pages/es/source/[slug].astro` (new)
  - Spanish mirror of `/source/<slug>` — same `SOURCE_SLUG_RE` tampering guard, same grouping;
    source name/website untranslated, marked `lang="en"`; cards localized via
    `localizedArticleView`.
- File: `src/pages/es/404.astro` (new)
  - Spanish mirror of `/404` — `noindex`, `lang="es"`, Spanish copy from the fixed dictionary,
    "Recent stories" cards localized. No `canonicalPath`, so `Base.astro`'s own default resolves
    the language switch link to `/` and `alternates` to `'none'` with zero extra props.
- File: `src/pages/es/404-index.json.ts` (new)
  - Spanish mirror of `/404-index.json` — same count/order, `/es`-prefixed paths, Spanish titles
    where publishable (`localizedArticleView`).
- File: `src/pages/404.astro`
  - The suggestions section's index URL is now parameterized via its own `data-index-url`
    attribute, read through `.dataset.indexUrl` — never a literal `getAttribute('data-index-url')`
    string, which would make that substring appear twice in the built HTML (once as the real
    attribute, once inside the inlined script) and break the "exactly one occurrence" acceptance
    check. `src/pages/es/404.astro` shares the exact same script body with a different attribute
    value.
- File: `tests/unit/es-listing-pages.test.mjs`
  - Extended with Task 2 coverage: `/es/tags` and `/es/source/<slug>` exist with reciprocal
    hreflang; the Spanish 404 exists, is noindex, carries the right `data-index-url`, and the
    occurrence count is exactly 1 in both languages; the 404 script uses only
    `textContent`/attribute assignment, never an HTML-string sink; `/es/404-index.json` matches
    `/404-index.json`'s count/order with `/es`-prefixed paths.
- File: `tests/unit/not-found.test.mjs`
  - Updated to locate the (now-parameterized) script via the unchanged `[data-404-suggestions]`
    selector string rather than the removed literal `'404-index.json'`; added a
    `data-index-url` occurrence-count assertion for the English page.
- File: `tests/unit/news-sitemap.test.mjs` (Rule 1 — see Deviations)
  - Fixed the sitemap/built-file count cross-check, which hardcoded "minus 1" for a single 404
    page; now subtracts however many 404 pages this build actually produced (now two).

## Why

Completes I18N-04's "every public page type" and I18N-05's hreflang pairing for the remaining
listing types (tags index, source pages) and the not-found experience, finishing plan 06-10.

## Issues Encountered

**[Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs` hardcoded a "minus 1" 404-page subtraction**
that silently drifted off-by-one the moment a second (`es/404.html`) 404 page existed —
`121506 !== 121507` on the first full build with this plan's changes. Fixed by counting whichever
404 pages the build actually produced (`['404.html', 'es/404.html'].filter(distFileExists)`)
rather than a hardcoded constant.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build && node --test tests/unit/es-listing-pages.test.mjs
  tests/unit/not-found.test.mjs && pnpm run test:regression` plus the full `pnpm run test:fast`
  suite (1000/1000) and `pnpm run test:build-gate` — all pass, including the two-consecutive-
  builds byte-identity criterion.
- What wasn't tested: a real browser/visual check of the new Spanish pages — not required by this
  plan's acceptance criteria (all dist-output assertions), and Jaime pre-approved auto-continuing
  the tracer feedback gate for fully-automated evidence.
- Edge cases: the Spanish 404 has no `canonicalPath` — confirmed `Base.astro`'s own default
  (`noindex` -> `alternates: 'none'`, no `canonicalPath` -> switch link to `/`) produces the
  correct shape with zero extra props, rather than passing `switchPath`/`alternates` explicitly.

## Next Steps

- [ ] None for this plan — 06-10 is complete. Later phases continue with sitemaps/feeds (06-11+).

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - completes `/es`'s listing-page coverage and the Spanish not-found experience,
closing out I18N-04/I18N-05 for every public page type this phase covers.

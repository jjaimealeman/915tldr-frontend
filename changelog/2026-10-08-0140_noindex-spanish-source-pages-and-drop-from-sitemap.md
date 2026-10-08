# 2026-10-08 - Noindex the Spanish source pages and drop them from the Spanish sitemap

**Keywords:** [SEO] [I18N] [TESTING] [FRONTEND]
**Session:** Night, Duration (~40 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-0140_noindex-spanish-source-pages-and-drop-from-sitemap.md`

## What Changed

- File: `src/lib/i18n/tag-page.ts`
  - New `sourcePageSeo(lang)`; it and `tagPageSeo` share one private body, so tag behaviour is unchanged
- File: `src/pages/es/source/[slug].astro`, `src/pages/source/[slug].astro`
  - Spread `sourcePageSeo('es' | 'en')` onto `<Base>`: Spanish noindex with no alternates, English en + x-default only
- File: `src/lib/i18n/sitemap.ts`
  - `isSitemapExcludedPath` also drops `/es/source/<slug>` (segment-exact; `/es/tags` stays)
- File: `tests/unit/source-noindex.test.mjs` (new)
  - Pure decision, sitemap predicate, template wiring, and dist-gated rendered/sitemap checks
- File: `tests/unit/news-sitemap.test.mjs`, `tests/unit/es-listing-pages.test.mjs`, `tests/unit/tag-noindex.test.mjs`, `tests/helpers/dist-fresh.mjs`
  - Sitemap count also subtracts the built `/es/source` pages; the old reciprocal-hreflang assertion for source pages replaced; `/es/source/ktsm` now excluded; new `builtEsSourcePagesAreNoindex` helper
- File: `tests/integration/url-shapes.test.mjs`
  - New strict live test for the three source pairs and the sitemap files; `/es/source/kvia` removed from the old reciprocal list
- File: `docs/phase-06/live-verification.md`
  - Task E note with the recorded pre-deploy live run

## Why

Owner decision 2026-10-07/08 ("agreed, yes"): same reasoning as the Spanish tag pages, the cards on `/es/source/*` are mostly English fallback. A noindex page must not be advertised as an alternate, so the English twin stops pairing with it.

## Issues Encountered

- The brief expected archived objects to need re-uploading; source pages are never archived (3 static pages per language, no `source` kind in the archive plan), so the live check is strict and there is no re-upload window.
- No local full build is allowed, so the rendered output is covered only by dist-gated tests that skip visibly against the stale local dist.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1082 tests, 1073 pass, 0 fail, 9 skipped (all dist-fresh gated); build-gate 9 of 9; `astro check` 0 errors. Live url-shapes once pre-deploy: 89 of 91 pass, the new source test fails as expected (old markup live), 1 deploy-guard skip
- What wasn't tested: real built HTML and sitemap files, sitemap count cross-check
- Edge cases: `/es/source`, `/es/sources`, `/es/source/<slug>/extra` are not excluded

## Next Steps

- [ ] After deploy, rerun `node --test tests/integration/url-shapes.test.mjs`; the source test should go green
- [ ] After the first real build, rerun `pnpm run test:fast` so the dist-gated checks run in full

---

**Branch:** feature/phase-06-polish
**Issue:** N/A
**Impact:** LOW

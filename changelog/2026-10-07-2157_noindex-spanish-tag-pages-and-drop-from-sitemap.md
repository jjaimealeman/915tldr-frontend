# 2026-10-07 - Noindex the Spanish tag pages and drop them from the Spanish sitemap

**Keywords:** [SEO] [I18N] [TESTING]
**Session:** Evening, Duration (~30 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-07-2157_noindex-spanish-tag-pages-and-drop-from-sitemap.md`

## What Changed

- File: `src/lib/i18n/tag-page.ts` (new)
  - `tagPageSeo(lang)`: Spanish tag pages are noindex with no alternates; English tag pages are indexable with `self` alternates
- File: `src/pages/es/tag/[slug].astro`, `src/pages/tag/[slug].astro`
  - Spread `tagPageSeo()` onto `<Base>` (the same noindex/alternates props the fallback `/es` article pages use)
- File: `src/lib/i18n/sitemap.ts`, `astro.config.mjs`
  - `isSitemapExcludedPath()` drops `/es/tag/<slug>` in the sitemap filter; `/es/tags` and `/es/source/*` stay
- File: `tests/unit/tag-noindex.test.mjs` (new), `tests/helpers/dist-fresh.mjs` (new)
  - Pure decision, sitemap predicate, source wiring, then full-corpus rendered output (static and archived) and the sitemap files
  - Rendered-output checks are gated on a fresh build and report a visible skip against the stale local dist
- File: `tests/unit/astro-config.test.mjs`, `tests/unit/news-sitemap.test.mjs`
  - Config assertion for the new filter call; sitemap URL-count cross-check now subtracts the `/es/tag/*` pages
- File: `docs/phase-06/live-verification.md`
  - New "Post-phase closeout" section, task A note

## Why

Owner decision 2026-10-07: 20,105 `/es/tag/*` URLs were indexable and in the Spanish sitemap while most of their cards are English fallback. A noindex page must not be advertised as a language alternate, so the English twins emit `self` alternates (held-article precedent).

## Issues Encountered

- No local full build is allowed (it writes to production KV), so rendered HTML is unverified until deploy; the dist-based checks skip visibly instead of passing vacuously.
- mtime alone would skip tests after a checkout, so the gate requires both "feature absent from dist" and "source newer than dist".

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1033 pass, 0 fail, 3 skipped (stale-dist gated); `test:build-gate` 9 of 9; `astro check` 0 errors
- What wasn't tested: rendered tag-page HTML, real sitemap files
- Edge cases: `/es/tags`, `/es/source/*`, `/es/tagline`, `/es/tag` not excluded

## Next Steps

- [ ] Rebuild and deploy, then run the three gated tests (they run in full after `pnpm build`)
- [ ] Expect the archived `es/tags/*` and English tag objects to re-upload over about 2 builds

---

**Branch:** feature/phase-06-closeout
**Issue:** N/A
**Impact:** MEDIUM

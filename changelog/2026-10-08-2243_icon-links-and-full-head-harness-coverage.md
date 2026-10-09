# 2026-10-08 - Icon links in every head, full share set proven on 8 harness variants

**Keywords:** [FEATURE] [FRONTEND] [TESTING] [SECURITY]
**Session:** Night, Duration (~10 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2243_icon-links-and-full-head-harness-coverage.md`

## What Changed

- File: `src/layouts/Base.astro`
  - Head only: renders `ICON_LINKS` (favicon.ico, favicon.svg, apple-touch-icon) after the robots meta and before the share tags; body region unchanged
- File: `src/lib/share-meta.ts`
  - `fallbackPageUrl` now strips a trailing `.html` and collapses `/index.html`, because under `build.format: 'file'` Astro reports `Astro.url.pathname` as `/404.html` (measured in the harness as `/no-canonical.html`); the 404 pages have no `canonicalPath`, so without this their og:url would have ended in `.html`
- File: `tests/fixtures/head-harness/src/variants.ts`
  - Eight variants: en-listing, es-listing, en-home, en-self, es-noindex, en-no-description, no-canonical, injection, each with a literal full expected set and the four X tags that must never appear
- File: `tests/unit/head-harness.test.mjs`
  - Order, property/name attribute, non-empty content, og:title equals `<title>`, og:url equals canonical, icon links, quote-aware element-sequence check for the injection variant, double-build head determinism, asset existence under `public/`
- File: `tests/unit/share-meta.test.mjs`
  - Added `fallbackPageUrl` cases for `.html` pathnames
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-03 Task 2 (SOC-01, SOC-02, SOC-04; D-13, D-14, D-17, D-22; T-07-01, T-07-09, T-07-10): every kind of page the site renders must carry the full escaped, deterministic share set plus the icon links, proven without a production build.

## Issues Encountered

- `Astro.url.pathname` carries `.html` under `build.format: 'file'`, so the plan's no-canonical expectation failed on first run; fixed in `fallbackPageUrl` (see above).
- The plan's "count of `<script` openings" check also counts the inert literal `<script>` Astro leaves inside a quoted `content` value; replaced with a quote-aware element-sequence comparison, which is stricter.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: head harness + share-meta unit tests 30 pass; strict tsc on share-meta.ts exits 0; `pnpm run guard:config` exits 0; `pnpm run test:fast` 1159 tests, 1150 pass, 0 fail, 9 skipped; Base.astro body diff against ef4318a exits 0
- What wasn't tested: a real `pnpm build` (forbidden: writes production KV), the real 404 pages' rendered og:url, any live scraper
- Edge cases: self, noindex, no-description, no-canonical and hostile-text variants

## Next Steps

- [ ] 07-04 article:* tags and og:type article

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - every page head gains icon links and the full share set on the next build

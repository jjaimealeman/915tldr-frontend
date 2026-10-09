# 2026-10-08 - Share-card tracer: Base.astro emits the og:image group, proven by a zero-D1 head harness

**Keywords:** [FEATURE] [FRONTEND] [TESTING] [SECURITY]
**Session:** Night, Duration (~25 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2230_share-meta-og-image-tracer.md`

## What Changed

- File: `src/lib/share-meta.ts`
  - New pure module: share-card constants (`SHARE_IMAGE_ORIGIN` committed constant per D-21, width/height/type, per-language path, alt and og:locale tables, `ICON_LINKS`), the `MetaTag`/`ShareMetaInput` types, and `shareImageUrl()`, `fallbackPageUrl()`, `shareMetaTags()`
  - `shareMetaTags()` emits only the og:image group (image, width, height, type, alt); later plans extend the same ordered list
- File: `src/layouts/Base.astro`
  - Head only: computes `shareTags` and renders them after the robots meta, before the RSS link, through Astro attribute expressions
  - Body and `src/styles/global.css` untouched
- File: `tests/fixtures/head-harness/astro.config.mjs`, `tests/fixtures/head-harness/src/variants.ts`, `tests/fixtures/head-harness/src/pages/[variant].astro`
  - Standalone Astro root that renders the real `Base.astro` with no content loaders, so zero D1 reads and zero KV writes; cache and output dirs pinned inside the harness
- File: `tests/helpers/head-meta.mjs`
  - Quote-aware regex parser for built head meta and link tags
- File: `tests/unit/head-harness.test.mjs`
  - Builds the harness and asserts the literal og:image group for English and Spanish, absolute https URL, `site` parity with the root config, repo incremental cache untouched, and every build output git-ignored

## Why

Tracer slice for Phase 7: prove the share-card metadata architecture (pure builder module, one shared layout, a build-free-of-D1 test harness) end to end after one commit, before the full og/twitter/article set is added. A full `pnpm build` runs the D1 loaders and writes production KV, so head metadata is proven by the harness instead.

## Issues Encountered

No major issues encountered. `localizedPath` and `SITE_NAME` were left out of the imports for now because nothing uses them yet; 07-03 adds them with og:site_name and article:author.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: harness build (about 1 second) and 5 new unit tests pass; `src/lib/share-meta.ts` type-checks under strict tsc; Base.astro body region identical to ef4318a; global.css unchanged; `pnpm run test:fast` 1089 to 1094 tests, 0 failures
- What wasn't tested: a full site build (forbidden, writes production KV); live scraper fetch of the card (the PNG files arrive in 07-02)
- Edge cases: values containing `>` in attributes are handled by the quote-aware parser; injection variants arrive in 07-03

## Next Steps

- [ ] 07-01 Task 2: build guard tying the og:image origin to the single custom_domain route
- [ ] 07-02: the card PNG files at `/og-image.png` and `/og-image-es.png`
- [ ] 07-03: extend `shareMetaTags()` to the full og/twitter set with an injection variant

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - every page's head gains five meta tags; no visible change

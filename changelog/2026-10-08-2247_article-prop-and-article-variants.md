# 2026-10-08 - Article pages pass article tags into the layout, proven on 3 new harness variants

**Keywords:** [FEATURE] [FRONTEND] [TESTING]
**Session:** Night, Duration (~10 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2247_article-prop-and-article-variants.md`

## What Changed

- File: `src/layouts/Base.astro`
  - New optional `article?: ShareArticleInput` prop (JSDoc in the file's style), passed into `shareMetaTags`; head-only, the body region is untouched
- File: `src/pages/[category]/[slug].astro`
  - `<Base>` gains `article={{ publishedIso: bylineDatetime, section: article.category.name, tags: ...names }}`; no existing line changed
- File: `src/pages/es/[category]/[slug].astro`
  - Same, with `section: categoryEs` so it matches the JSON-LD articleSection
- File: `tests/fixtures/head-harness/src/variants.ts`
  - New variants `en-article`, `es-article`, `en-article-no-tags` with literal expected article:* values
- File: `tests/fixtures/head-harness/src/pages/[variant].astro`
  - Article variants render a `<time datetime>` byline in the body, like the real templates
- File: `tests/unit/head-harness.test.mjs`
  - Ordered-key assertion includes the article block; published_time equals the body time; non-article variants carry no `article:` key; 11 variants
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-04 (SOC-03). Reusing `bylineDatetime`, the category name and the tag names the templates already compute means the meta tags, the visible byline and the NewsArticle JSON-LD cannot disagree.

## Issues Encountered

No major issues encountered. The real article templates cannot be rendered locally without the D1 loaders, so their wiring is proven through the harness rendering Base.astro with the same props shape.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: head-harness + share-meta unit tests, 39 pass, 0 fail; `pnpm run test:fast` 1168 tests, 1159 pass, 0 fail, 9 skipped
- What wasn't tested: the two real article templates rendered in a real build
- Edge cases: Spanish author URL, zero tags, section omitted

## Next Steps

- [ ] Freshness-gated real-build test for built article pages

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - every article page head changes on the next real build

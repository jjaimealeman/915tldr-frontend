# 2026-10-08 - GREEN: shareMetaTags emits og:type article and the article:* set

**Keywords:** [FEATURE] [FRONTEND] [TESTING]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2245_green-share-meta-article-branch.md`

## What Changed

- File: `src/lib/share-meta.ts`
  - New `requireIsoWithOffset` validator: `publishedIso` must parse and end in `Z` or a ±HH:MM offset, otherwise a `share-meta:` error is thrown
  - When `input.article` is present: og:type becomes `article`, and article:published_time, article:modified_time (both the one `publishedIso`), article:section (trimmed, only if non-empty), one article:tag per non-empty tag in input order, and article:author (the site's /about URL in the page language) are inserted between og:image:alt and twitter:card
  - Imports `localizedPath` from `article-url.ts`
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-04 (SOC-03, D-15/D-16/D-18). Feeding both times from one variable keeps the meta tags, the visible byline and the JSON-LD from ever disagreeing, and naming only the /about page keeps any person or outlet out of article:author.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `node --test tests/unit/share-meta.test.mjs tests/unit/head-harness.test.mjs` 37 pass, 0 fail; strict tsc on share-meta.ts exits 0
- What wasn't tested: rendering through the real article templates (needs the D1 loaders, not run locally)
- Edge cases: empty section, no tags, whitespace tags, naive and unparseable dates

## Next Steps

- [ ] Base.astro `article` prop, both article templates, harness article variants
- [ ] Freshness-gated real-build test

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - pure builder, not yet wired into any page

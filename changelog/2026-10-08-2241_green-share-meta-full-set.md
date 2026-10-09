# 2026-10-08 - GREEN: shareMetaTags builds the full ordered og/twitter set with validation

**Keywords:** [FEATURE] [FRONTEND] [TESTING]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2241_green-share-meta-full-set.md`

## What Changed

- File: `src/lib/share-meta.ts`
  - `shareMetaTags` now returns og:title, og:description, og:url, og:site_name, og:type, og:locale, og:locale:alternate, the og:image group, twitter:card and twitter:image:alt, in that fixed order
  - og:locale:alternate is always the other language's locale, whatever `alternates` is (D-22); `alternates` is still validated
  - No X site-handle, title, description or image tag (D-17)
  - Input validation: lang, alternates, non-empty title and description, absolute https `pageUrl` and `siteOrigin`; errors start `share-meta:` and name the field
  - `SITE_NAME` imported from `structured-data.ts` (type-only imports there, so the module stays pure)
- File: `changelog/README.md`
  - Index row for this entry

## Why

TDD GREEN gate for plan 07-03 Task 1 (SOC-01, SOC-02, SOC-04): one pure builder for every page's share tags, so the layout, the tests and the later article plan draw from the same list.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `node --test tests/unit/share-meta.test.mjs` 11 pass; strict tsc on the module exits 0; head harness 5 pass; `pnpm run test:fast` 1145 tests, 1136 pass, 0 fail, 9 skipped
- What wasn't tested: rendered output in Base.astro for the new tags (Task 2)
- Edge cases: hostile text returned verbatim (escaping stays the renderer's job)

## Next Steps

- [ ] Task 2: icon links in Base.astro and full-set harness coverage

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - extends the head of every page once Base.astro renders it (already wired since 07-01)

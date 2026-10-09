# 2026-10-08 - Asset tests pin the share cards and icons (formats, sizes, tokens, copy, redirects)

**Keywords:** [TESTING] [DESIGN] [SECURITY]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2238_share-card-asset-tests.md`

## What Changed

- File: `tests/unit/share-card-assets.test.mjs`
  - Both cards: 1200x630, 8-bit, colour type 2 (RGB, no alpha), under 5,000,000 bytes
  - apple-touch-icon: 180x180, 8-bit RGB; favicon.ico: one 32x32 PNG entry, no trailing bytes; favicon.svg: 32x32 viewBox and the text 915
  - Token parity: paper, ink, ink-muted and rule equal the global.css values and appear in card.html; the 8 stripe oklch values equal `--cat-<slug>-vivid-light` in CATEGORIES order
  - The four exact card copy strings (EN and ES tagline and credit line)
  - Hygiene: no `file:` scheme and no `/home/` path in card.html, render.mjs, ico.mjs
  - Redirect shadowing: no `public/_redirects` rule matches the five asset paths
- File: `changelog/README.md`
  - Index row

## Why

SOC-05 and SOC-06: every shipped asset's format, size, copy and token provenance is pinned by a fast test, so a bad re-render or a token drift fails in `pnpm run test:fast`.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 23 tests pass in the file; `pnpm run test:fast` 1134 tests, 1125 pass, 0 fail, 9 skipped (baseline 1111); the stripe check was shown to fail on a scratch mutation of the colour values (not committed)
- What wasn't tested: scraper fetches of the live URLs (07-09)
- Edge cases: redirect rules with splats or placeholders are treated as possible shadows

## Next Steps

- [ ] Plan summary, state and roadmap update
- [ ] Owner sign-off of the rendered cards and favicon identity at 07-06

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - test only

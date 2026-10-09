# 2026-10-08 - Owner review packet: renderer --review mode, review renders, alt-to-tagline parity test

**Keywords:** [FEATURE] [TOOLING] [TESTING] [DOCUMENTATION]
**Session:** Night, Duration (~25 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2300_review-packet-and-alt-parity-test.md`

## What Changed

- File: `tools/og-card/render.mjs`
  - Added `--review <dir>` mode. It reads the committed `public/` cards, favicon.svg and apple-touch-icon through the same allow-listed route table and writes only into `<dir>`: both cards at 600, 300 and 150px wide, the 630x630 centre crop of each, favicon at 16 and 32px, apple-touch-icon at 60px
  - The default run (no flag) is unchanged
- File: `tests/unit/share-card-assets.test.mjs`
  - Added the D-10 parity test: `SHARE_IMAGE_ALT[lang]` equals "915 TLDR — " plus the tagline parsed out of card.html's COPY, for en and es
- File: `docs/phase-07/evidence/review/`
  - README.md (image index, copy as rendered, head-tag samples, the five open items with defaults) and the 11 review PNGs
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-06 Task 1 (SOC-05, SOC-06). Jaime has to judge the cards, the credit-line size, twitter:image:alt, the local-build question and the favicon identity against real renders before 07-07 applies his answers. The parity test keeps the alt text honest if a tagline ever changes.

## Issues Encountered

No major issues encountered

## Dependencies

No dependencies added

## Testing Notes

- What was tested: share-card-assets tests 25/25 pass; head-harness tests 20/20 pass; `verify-share-meta --kind article` exits 0 for en and es; `pnpm run test:fast` 1207 tests, 1193 pass, 0 fail, 14 skipped; `guard:config` clean; `git status --porcelain public/` empty after the review run
- What wasn't tested: how the cards look on a real platform preview (07-09); no full build
- Edge cases: review mode exits 2 with a usage line when no directory is given

## Next Steps

- [ ] Jaime answers the five owner items; 07-07 applies them

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tooling, test and evidence files only

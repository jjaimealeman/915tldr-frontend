# 2026-10-08 - GREEN: icon set (favicon.svg, 32x32 favicon.ico, apple-touch-icon) and the ICO encoder

**Keywords:** [FEATURE] [DESIGN] [FRONTEND] [TESTING]
**Session:** Night, Duration (~10 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2237_green-icon-set-ico-encoder.md`

## What Changed

- File: `tools/og-card/ico.mjs`
  - `encodeIco(entries)`: ICONDIR plus 16-byte directory entries plus verbatim PNG images; validates size, PNG signature, duplicates and ascending order
- File: `tools/og-card/render.mjs`
  - New icons step after the cards, so one command produces everything
  - favicon.ico: 32x32 screenshot of favicon.svg with transparent corners, wrapped by `encodeIco` (D-23); logs `fc-match Arial`
  - apple-touch-icon: bubble mark cropped to its alpha box (797x457), scaled to 148px wide, centred on opaque #FAFAF8; self-checks ink width, centring and 16px margins
- File: `public/favicon.svg`
  - Byte copy of the v1 favicon (D-13)
- File: `public/favicon.ico`
  - 922 bytes, one 32x32 PNG entry rasterised from favicon.svg (v1's Nuxt-logo .ico is not ported)
- File: `public/apple-touch-icon.png`
  - 180x180 8-bit RGB, ink x 16..163, y 48..131
- File: `changelog/README.md`
  - Index row

## Why

D-13 as amended by D-23: the site needs a favicon.svg, a favicon.ico that matches it and an iOS home-screen icon. They are generated from committed source by the same offline command as the cards.

## Issues Encountered

No major issues encountered. The "915" in favicon.svg uses Arial, which this machine maps to Arimo; the .ico bakes that rendering in. A 16px preview shows the "915" small but legible.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: the 10 encodeIco tests pass (GREEN after the RED commit); `node tools/og-card/render.mjs` exits 0 with the icon self-checks and zero aborted requests; `file` reports the expected formats
- What wasn't tested: iOS rendering of the touch icon on a device; the shipped-asset test file checks arrive in the next task
- Edge cases: 256 encoded as 0; duplicate and unsorted sizes rejected

## Next Steps

- [ ] Asset test for formats, tokens, copy, hygiene and redirect shadowing
- [ ] Owner confirms the blue tile favicon or switches to the bubble mark at the 07-06 checkpoint

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - new public icon files and render tooling

# 2026-09-16 - Render Swatch Evidence for Both Themes (D-01, C-01)

**Keywords:** [FEATURE] [STYLING] [TESTING] [DESIGN]
**Session:** Afternoon, Duration (~40 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1548_render-palette-swatches.md`

## What Changed

- File: `design/scripts/render-swatches.mjs` (NEW)
  - Starts the static server, launches Chromium at a 1200px-wide viewport, navigates to
    `/mockups/` first (so relative font/stylesheet URLs resolve) and then `page.setContent`s a
    document that links the real `style.css`
  - Renders all 8 categories in canonical order, each with: the category name in the body
    face; the grid tier (a paper card with a `data-stripe` in `var(--cat)` plus a two-line
    Instrument Serif headline); the block tier (`background: var(--cat-<slug>-block)` holding
    the category name at `--step-6` in `--block-ink`, plus a body-size dateline); and the hex
    of all three stops
  - Every hex is read back **from the rendered page itself**, not recomputed in Node: a probe
    element's `color` is set from the `--cat-<slug>-<stop>` custom property, then converted to
    a device-RGB hex via a 1x1 `<canvas>` fill (`getComputedStyle` echoes an `oklch()`-authored
    value back as the literal string `"oklch(...)"` rather than converting it — see Issues
    Encountered)
  - Waits for `document.fonts.ready` and asserts at least one Instrument Serif and one Source
    Serif 4 `FontFace` reached `status === 'loaded'`, per family, before either screenshot is
    taken
  - Takes a full-page screenshot to `design/evidence/palette-swatches-light.png`, sets
    `data-theme="dark"` on `<html>`, re-reads the hexes, and takes a second screenshot to
    `palette-swatches-dark.png`
- File: `package.json`
  - Added `"palette:swatches": "node design/scripts/render-swatches.mjs"`

## Why

The palette's contrast math (Task 2) and its C-01 register are two different questions —
D-13's gate proves the numbers; only a rendered image lets the owner judge whether a hue
*reads* as vivid indigo or as sun-bleached tan. This task produces that image using the
production stylesheet and real subset fonts rather than a synthetic colour-chip page, so what
the owner approves is what the site will actually paint.

## Issues Encountered

- **`getComputedStyle(...).color` does not convert `oklch()` to `rgb()` in this Chromium
  build.** The first implementation read the computed `color` string and parsed out three
  numbers with a regex, which happily "succeeded" against the literal string
  `"oklch(0.6 0.15 24.7)"` — extracting `0.6`, `0.15` and `24.7` as if they were 0-255 RGB
  channels and producing a wildly wrong near-black hex (`#010019` instead of the correct
  `#CA5551`) for every single swatch. The bug was silent: the script ran, produced
  correctly-sized PNGs, and only visual inspection of the rendered hex labels against the
  actual painted colour caught it. Fixed by routing the conversion through a 1x1 `<canvas>`
  fill instead — the canvas 2D context's colour parser always resolves to rasterised device
  RGB regardless of the CSS colour space the value was authored in, which is what
  `getImageData` then reads back correctly.

## Dependencies

No dependencies added. Uses `@playwright/test` (already installed).

## Testing Notes

- What was tested: `npm run palette:swatches` produces both PNGs, each larger than 10KB and
  exactly 1200px wide (read from the PNG IHDR chunk directly, per the plan's acceptance
  check); the on-page hex labels in both screenshots match `design/evidence/palette.md`'s
  "Written C"/hex values exactly, category by category; the font-loaded assertion passed for
  both families; `npm run palette:build && npm run check:contrast && npm run verify:phase-1
  -- --pages=index --criteria=1,2,5` still passes end-to-end after this task (swatches
  rendering doesn't touch `style.css`).
- What wasn't tested: the owner's own C-01 judgement on the rendered swatches has not
  happened yet — this is explicitly a human-check item, not something this script decides.
  Visual review during this session (by the executing agent, not the owner) found: all 8
  categories read as clearly distinct in both themes; grid stripes read vivid; block panels
  read as confident colour with legible masthead text. The two rows `palette.md`'s C-01
  review table already flagged — Sports (block `#8C3E01`, a burnt rust/orange) and Business
  (block `#695701`, a dark olive/khaki) — do visually sit close to the amber/olive-reading-as-
  brown risk the plan's own research anticipated for the 40-100° hue band. This is flagged
  for the owner's judgement, not resolved here, per the plan's explicit instruction not to
  quietly work around it.
- Edge cases: dark-theme block panels intentionally use the *same* `--cat-<slug>-block` value
  as light theme (D-03: "colour blocks use the same text-safe stop in both themes") — verified
  by comparing the two screenshots' block hex labels directly; only the grid stripe and the
  surrounding paper/ink swap between themes.

## Next Steps

- [ ] Phase-level: carry all three flagged items (Task 1's Santa Fe/politics substitution and
      measured-blue/weather finding; Task 3's Sports/Business amber-olive block risk) into the
      phase's eventual `01-APPROVAL.md` for one combined owner sign-off, rather than resolving
      any of them unilaterally now
- [ ] Later plans (01-06 category masthead, 01-07 article category header) are where the
      `[data-block]` site CSS rule actually needs to resolve to the per-category `-block`
      stop for real pages — this task's swatch markup set that background inline for
      demonstration purposes only and does not change `style.css`'s component rules

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - evidence/documentation artifact for the owner's approval packet; no production/public-site code affected

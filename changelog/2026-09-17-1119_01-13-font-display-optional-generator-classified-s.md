# 2026-09-17 - Switched Fonts to `font-display: optional`, Built a Swap-Path Instrument, Found It Doesn't Fully Work in Chrome

**Keywords:** [FEATURE] [TESTING] [PERFORMANCE] [BUG_FIX]
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1119_01-13-font-display-optional-generator-classified-s.md`

## What Changed

- `design/scripts/build-fonts.mjs` now generates every font-loading rule with
  `font-display: optional` instead of `swap`. The idea: a visitor either gets
  our real headline/body fonts from the first pixel painted, or sees the
  backup system font for that whole page view — never a mid-read swap where
  text suddenly reflows under your eyes.
- New measurement code (`design/tests/support/fonts-in-use.ts`,
  `design/tests/support/geometry.ts`) that can tell, for a real page load,
  which of those two things actually happened, and can prove a real font
  swap when one occurs (so the measurement can't quietly go blind).

## Why

The previous approach (`font-display: swap`) was measured last week to
cause real, visible layout shift once a reader scrolls past the first
screen — confirmed on all five page types, in both browser engines tested.
The site's own performance budget requires that shift to be effectively
zero. Switching to `optional` is supposed to fix this by definition: once
the "is this font ready yet" grace period ends, the browser is supposed to
commit to the backup font for good, for that page view.

## Issues Encountered

Built the instrument, then used it to actually check the fix — and the fix
does not fully work. In Chrome, on a slow connection, the browser applies
the real font to text that has *already been shown on screen* once the font
file eventually finishes downloading, even though `optional` is not
supposed to do a late swap at all. Reproduced this on a clean, single page
load with no test-only shortcuts, with and without font preloading, so it's
not an artifact of the test setup. Safari's engine, tested the same way,
behaved correctly — no late swap. This means the fix approved for this
issue does not close it in Chrome as-is, and needs an owner decision on how
to proceed before more of the measurement work continues.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the font generator's output is byte-for-byte identical
  across two runs (no accidental drift), preload tags are unchanged, and the
  new measurement code correctly reports "no shift" for Safari's engine
  across the full test grid (geometry score 0.0000 throughout).
- What wasn't tested yet: the full five-page test grid and the "can this
  instrument actually catch a real swap" control test — paused pending the
  owner decision above, since building those out further assumes the fix
  works, which this session found is not yet true for Chrome.

## Next Steps

- [ ] Owner decision: how to handle Chrome's late-swap behavior under
      `font-display: optional` (see the checkpoint from this session)
- [ ] Resume 01-13 Tasks 2-3 once that's settled

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - fixes the swap-triggered layout shift as designed in Safari; does not yet fix it in Chrome, which is most of this site's traffic

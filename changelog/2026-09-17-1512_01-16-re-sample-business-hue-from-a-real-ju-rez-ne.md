# 2026-09-17 - Business's Palette Hue Re-Sampled From a Real Juárez Neon Sign

**Keywords:** [FEATURE] [BUG_FIX]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1512_01-16-re-sample-business-hue-from-a-real-ju-rez-ne.md`

## What Changed

- `design/palette/photo-sources.json`: replaced Business's marigold record
  (rejected by the owner in round-1 review, D-GAP-C, 2026-09-17: "business
  and sports both read as brown. sports is more redish, thats ok") with a
  new photo-first source — the green-cyan neon tube border of the real
  "Kentucky Club & Grill" bar sign (operating since 1920) in downtown
  Ciudad Juárez, Mexico. CC BY-SA 4.0, photographed by Wotancito
  (Wikimedia Commons), daylight shot (no artificial-light colour-cast
  risk). All seven other category entries are byte-identical.
- `design/palette/hue-sources.json`: re-ran `pnpm run palette:sample`.
  Business's new sampled hue is 152.1deg (keptPixels 538, circularStdDev
  17.2deg — both comfortably inside the sampler's own gates of >=500 and
  <=25). This lands outside the 40-100deg amber/olive band that turns
  brown at the block stop's lightness, which is the whole point: the
  marigold's failure was never about which yellow-orange photo supplied
  the hue, it was that any hue in that band reads as brown once forced
  through the shared block lightness (L 0.46).
- `design/palette/palette.json`: Business's `hueOffset` set to `0` — the
  photo-sampled hue alone clears the 0.05 minimum pairwise OKLab distance
  floor with no hand-picked nudge needed. Health's `hueOffset` stays `+4`
  (unchanged, so the owner-reviewed Health colour does not move), but its
  `hueOffsetReason` text is rewritten: it no longer references a paired
  adjustment against Business's old marigold hue, since nothing pairs
  with it anymore.
- `design/mockups/style.css`: only the four Business tokens changed
  (`--hue-business`, `--cat-business-vivid-light`, `--cat-business-block`,
  `--cat-business-vivid-dark`, now all resolving from 152.1deg). Every
  other category's `--hue-*` and `--cat-*` value is byte-identical, and
  `pnpm run palette:build` run twice in a row produces byte-identical
  output both times.
- `design/evidence/palette.md` / `contrast.md`: regenerated. The C-01
  review table's Business row is gone (only Sports remains, already
  accepted by the owner). Minimum pairwise OKLab distance stays >=0.05
  at all three stops — Business/Health is the new closest pair at the
  block stop (0.0559), with Business-vs-Sports and Business-vs-Education
  both well clear (0.19-0.29) at every stop.
- `design/evidence/pages/category-*.jpg`: regenerated via
  `pnpm run verify:phase-1 --pages=category --criteria=1,2` so the
  category masthead evidence reflects the new Business colour.

## Why

Round-1 owner review flagged both Sports and Business as reading brown;
the owner accepted Sports as-is ("sports is more redish, thats ok") but
sent Business back for a new photo and re-sample (D-GAP-C). The root
cause, established in 01-03's evidence, is that any final hue roughly
40-100deg drops to dark amber/olive at this palette's shared block
lightness — so a different yellow-orange photo would have failed the
same way. The fix had to change register entirely, landing outside that
band while staying on-subject (a real, licence-recorded, saturated
storefront/neon-sign photo from El Paso or Ciudad Juárez, matching C-01's
own named register already used for Sports, Weather and Community).

## Issues Encountered

Sourcing took several rejected candidates before landing on the Kentucky
Club neon sign: night-lit mural photographs (from the same photo set
already used for Sports/Weather) measured too low in chroma once
downscaled — the visually "blue" paint under artificial worksite lighting
fell under the sampler's 0.08 chroma floor and returned zero kept pixels.
A daylight mural's shaded agave plant had the same problem. A wider crop
of the neon sign itself pulled in window-glass reflections and pushed
circularStdDev over 60deg. The final region is a tight, single vertical
run of clean neon tube glass, chosen only after confirming it clears both
sampler gates with real margin.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run palette:sample` (Business's diff isolated to
  its own record; all seven other hue-sources entries byte-identical);
  `pnpm run palette:build` run twice (byte-identical style.css and
  palette.md both times); `pnpm run check:contrast` (Overall PASS, all
  three stops >=0.05 minimum pairwise distance); `pnpm run verify:phase-1
  --pages=category --criteria=1,2` (PASS, Chromium and WebKit).
- What wasn't tested: the human C-01 aesthetic judgement on whether the
  new Business colour reads correctly — that is Task 2's swatch-evidence
  step and the phase's end-of-phase human check.

## Next Steps

- [ ] Task 2: swatch evidence regeneration, content.spec.ts nav-stripe
      check, and the WINDOWS.md ledger update (entry 3 → fixed)
- [ ] Plan-level metadata commit (SUMMARY, STATE, ROADMAP)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - changes one category's colour tokens and regenerates
the palette/contrast evidence; no other category, threshold, or gate
moved.

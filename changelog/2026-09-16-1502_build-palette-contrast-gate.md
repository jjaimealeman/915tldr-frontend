# 2026-09-16 - Generate the Photo-Sampled Palette and Pass the Contrast Gate (D-01, D-02, D-03, D-04, D-13)

**Keywords:** [FEATURE] [STYLING] [ACCESSIBILITY] [DESIGN]
**Session:** Afternoon, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1502_build-palette-contrast-gate.md`

## What Changed

- File: `design/palette/palette.json` (NEW)
  - Shared OKLCH stops: `vividLight` (L 0.600, C 0.150), `block` (L 0.460, C 0.150 — raised
    from the 01-02 tracer's placeholder 0.100), `vividDark` (L 0.780, C 0.150 — raised from
    0.110)
  - Eight categories in canonical sort order, each pointing at its Task 1 `hueSource`; three
    pairs (crime/sports, business/health, politics/weather) carry a documented `hueOffset`
    (±4° to ±6°, all within the ±8° limit) with a `hueOffsetReason` explaining which sampled
    hues were too close together and why
- File: `design/scripts/build-palette.mjs` (NEW)
  - Reads `palette.json` + `hue-sources.json`, validates every `hueOffset` (≤8°, non-zero
    requires a reason), builds `{mode:'oklch', l, c, h}` per category/stop and gamut-clamps
    with culori `clampChroma`, then rewrites `style.css`'s `palette:start/end` and
    `palette-dark:start/end` sub-regions
  - The six `--stop-*` custom properties moved *inside* the `palette:start/end` region (they
    previously sat as static text just above it) so the whole ramp, stops included, is now
    one generated block
  - Chroma is floor-truncated to 3 decimals before being written *or* used in any downstream
    calculation (evidence, distance checks) — a plain round-to-nearest can round a
    gamut-boundary chroma up past the boundary, producing an oklch() literal culori's own
    `displayable()` then rejects (the same class of bug 01-02 already found once, on the ramp
    rather than the stops)
  - Writes `design/evidence/palette.md`: per-category/per-stop requested-vs-written chroma
    and hex, a ⚠ flag for any chroma written below 60% of what was requested, the minimum
    pairwise OKLab distance (culori `differenceEuclidean('oklab')`) and closest pair per
    stop, and a "C-01 review" table naming every block stop whose hue falls in the
    40-100° amber/olive band
  - `npm run palette:build` run twice in a row leaves `style.css` byte-identical (verified)
- File: `design/mockups/style.css`
  - `palette:start/end` and `palette-dark:start/end` regenerated from real photo-sampled
    hues instead of the 01-02 tracer's typed-in placeholders; `--paper`/`--ink` neutrals (D-04)
    untouched
- File: `design/evidence/contrast.md` (regenerated)
  - All 3 category-ramp rows and all 10 neutral-pair rows pass, each with well over the
    required 0.2 margin (worst cases: vivid-light 3.63:1 vs 3:1, block 5.73:1 vs 4.5:1)
- File: `package.json`
  - Added `"palette:build": "node design/scripts/build-palette.mjs"`

## Why

D-02 requires hue from the photo and lightness from the scale; D-13 requires the contrast
table to be generated from the live tokens, not hand-written. This task is the point where
those two requirements meet the same eight real-photo hues from Task 1 and have to survive
contact with each other: three pairs of real, honestly-sampled hues turned out close enough
together (12.7°-22.2° apart) that at the placeholder stop chromas they produced a minimum
pairwise OKLab distance as low as 0.022 — well under the 0.05 floor the plan sets for
category identity to read as genuinely distinct rather than "the same color measured twice."
Raising the block/vivid-dark stop chromas to match vivid-light's 0.150 (the maximum the plan
allows without failing contrast) bought most of the needed separation; the remaining gap was
closed with small, paired, documented hue offsets — never by picking new hues out of thin air.

## Issues Encountered

- **Naive round-to-nearest chroma formatting produced an out-of-gamut oklch() literal.**
  `clampChroma` finds the true sRGB-boundary chroma via numeric search (e.g. `0.1439998...`);
  formatting that with `toFixed(3)` rounded it up to `0.144`, and `check-contrast.mjs`'s own
  `displayable()` gate then correctly rejected `oklch(0.600 0.144 242.5)` as outside sRGB.
  Fixed by floor-truncating chroma to 3 decimals *before* it is used anywhere (not just at
  CSS-write time), so the evidence report's "written C" column and the actual `style.css`
  value are always the same number, and that number is always safely inside the boundary
  clampChroma found. This is the same class of bug 01-02 already hit once on the font-fallback
  ramp; recorded here because it recurred on an unrelated part of the pipeline (chroma
  instead of ascent/descent metrics) — worth a general rule: any numeric value derived from a
  gamut/metric search needs floor-, not round-, formatting.
- **Three pairs of real photo-sampled hues were too close together for category identity.**
  crime (30.7°) vs sports (43.4°): both genuinely orange-red real photographs, 12.7° apart.
  business (98.5°) vs health (120.7°): both genuinely yellow-green, 22.2° apart, and
  business's block-stop chroma is gamut-limited to ~0.094 regardless of how much is
  requested, which compounds the closeness. politics (265.5°) vs weather (246.5°): both
  genuinely blue, 19° apart. All three resolved with a symmetric, documented ±4°-±6° push
  per pair (found via a brute-force search over the ±8° allowance jointly across all three
  stops) — each pair's `hueOffsetReason` in `palette.json` names the conflict and the
  resulting distance before the fix.

## Dependencies

No dependencies added. Uses `culori` (already installed).

## Testing Notes

- What was tested: `npm run palette:build && npm run check:contrast` passes; the plan's
  literal acceptance-criteria greps (24 `--cat-*-{vivid-light,block,vivid-dark}` lines, 8 dark
  aliases, exactly one `--paper: #FAFAF8;` and one `--paper: #121417;`) all pass; the gamut
  safety Node check (`displayable()` over every `oklch()` literal in `style.css`) passes;
  `design/evidence/palette.md` contains the required "C-01 review" heading and a
  minimum-distance line ≥0.05 for each of the three stops (0.0554-0.0642); a second
  `palette:build` run left `style.css` byte-identical; `npm run verify:phase-1 --
  --pages=index --criteria=1,2,5` passes 9/9 in both Chromium and WebKit against the real
  palette (the tracer page still renders correctly with the new colors).
- What wasn't tested: the owner's own C-01 visual judgement on the two block stops flagged in
  the "C-01 review" table (Sports at 49.4°, Business at 94.5° — both amber/olive at block
  lightness, which can read as brown); that judgement is explicitly deferred to Task 3's
  swatch evidence and the phase's eventual approval step, not decided here.
- Edge cases: the three conflicting hue pairs were found by brute-force search, not guessed;
  the search also confirmed that raising chroma alone cannot fix the business/health pair,
  since business's block-stop chroma is gamut-clamped to ~0.094 regardless of how high a
  value is requested — only a hue offset closes that gap.

## Next Steps

- [ ] Task 3: render swatch evidence (grid + block tiers, both themes, real stylesheet and
      fonts) for the owner's C-01 judgement, with particular attention to the two flagged
      "C-01 review" block stops
- [ ] Owner review: confirm the three documented hue-offset pairs and the two amber/olive
      block stops are acceptable, alongside the two Task 1 subject-fidelity notes
      (politics/Santa Fe substitution, weather's measured-blue-not-turquoise finding)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - regenerates the palette layer every later phase-1 mockup renders against; no production/public-site code affected

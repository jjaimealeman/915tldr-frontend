---
phase: 01-design-sketch-editorial-identity
plan: 03
subsystem: design-system
tags: [palette, oklch, culori, playwright, wikimedia, contrast, wcag, color]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-02: production token layer (style.css fonts/tokens/palette regions), D-13 contrast gate, D-16 runner, self-hosted subset fonts"
provides:
  - "design/palette/photo-sources.json + hue-sources.json: 8 licence-recorded Wikimedia Commons photographs, one per category, each with a script-sampled hue (chroma-weighted circular mean + circular std dev via culori)"
  - "design/scripts/sample-hues.mjs: re-runnable hue-sampling pipeline (HTTPS + host allowlist + redirect cap + content-type/size checks + retry-with-backoff; decodes via real Chromium canvas, never a hand-rolled Node image decoder)"
  - "design/palette/palette.json + design/scripts/build-palette.mjs: shared OKLCH stops (vivid-light/block/vivid-dark, all C=0.150), 3 documented hueOffset pairs, idempotent style.css palette/palette-dark region generation"
  - "design/evidence/palette.md: per-category/per-stop requested-vs-written chroma+hex, minimum pairwise OKLab distance per stop, C-01 review table for the 40-100deg amber/olive band"
  - "design/scripts/render-swatches.mjs + palette-swatches-{light,dark}.png: swatch evidence rendered with the real stylesheet and subset fonts, in-page hex verification via canvas"
affects: [01-05-contrast-gate, 01-06-home-category, 01-07-article-changelog-contact, 01-10-approval-packet]

actuals:
  tokens: 23300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Hue sampling never guesses a region from a downscaled visual impression alone — sample-hues.mjs's own 500-pixel/25-degree thresholds caught an ocotillo-spike-against-sky region that looked solid-color at screen resolution but let sky bleed through gaps after the required 800px canvas downscale (circularStdDev ~65-70). The fix was a different photographic composition (a single open flower against a neutral backdrop), not a relaxed threshold."
    - "Any numeric value derived from a gamut or metric search (clampChroma's boundary chroma here; capsize's font metrics in 01-02) must be floor-truncated, never round-to-nearest, before it is written or used downstream — rounding up can cross the boundary the search found and produce a value the same pipeline's own gamut check then rejects."
    - "Chromium's getComputedStyle echoes an oklch()-authored CSS custom property back as the literal string \"oklch(...)\", not a converted rgb(). Any script that needs a browser-resolved hex from a CSS custom property must route through a 1x1 canvas fill + getImageData, not a regex over the computed-style string."

key-files:
  created:
    - design/palette/photo-sources.json
    - design/scripts/sample-hues.mjs
    - design/palette/hue-sources.json
    - design/palette/palette.json
    - design/scripts/build-palette.mjs
    - design/evidence/palette.md
    - design/scripts/render-swatches.mjs
    - design/evidence/palette-swatches-light.png
    - design/evidence/palette-swatches-dark.png
  modified:
    - design/mockups/style.css
    - design/evidence/contrast.md
    - package.json

key-decisions:
  - "Three pairs of real photo-sampled hues (crime/sports, business/health, politics/weather) were too close together for the 0.05 minimum OKLab distance at the tracer's placeholder stop chromas. Resolved by raising block/vivid-dark chroma to match vivid-light (0.150, the ceiling the contrast gate still allows with margin) plus small, symmetric, documented hueOffsets (+-4 to +-6 degrees, all within the plan's +-8 degree limit) — found via brute-force search over the offset space, not by guessing."
  - "politics's photo is a Santa Fe, NM high-desert dusk sky, not literally the Franklin Mountains or El Paso skyline the subject calls for. Genuine full-darkness night photographs of El Paso measured near-zero chroma (true darkness has no hue to sample); the one low-enough-resolution dusk skyline shot found fell short of the 500-kept-pixel floor. Flagged in photo-sources.json and here for explicit owner review rather than silently substituted."
  - "weather's sampled hue (~246 degrees) reads as azure/sky blue, not the colloquially 'turquoise' the subject wording anticipated. Kept as sampled per D-02's photo-first methodology (hue comes from the photo, not from what the brief expected to see) rather than nudged toward cyan by eye."

patterns-established:
  - "build-palette.mjs's region-rewrite now includes the six --stop-* custom properties inside palette:start/end (they previously sat as static text above the region in the 01-02 tracer) — any later plan regenerating the palette region should not reintroduce a static stops block outside the markers."
  - "Evidence-generating scripts that need a rendered colour's actual hex must read it back from the page (canvas fill, not getComputedStyle string parsing) — see render-swatches.mjs's cssColorToHex; this generalises beyond palette work to any future script asserting on a browser-computed CSS colour."

requirements-completed: [DSGN-04, DSGN-05, A11Y-01]

coverage:
  - id: D1
    description: "8 licence-recorded real photographs sampled to one hue per category via a re-runnable, threshold-enforced script (sample-hues.mjs)"
    requirement: "DSGN-04"
    verification:
      - kind: integration
        ref: "npm run palette:sample -> design/palette/hue-sources.json; all 8 categories pass keptPixels>=500 and circularStdDev<=25 (script's own non-zero-exit gate)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shared-stop OKLCH palette generated from sampled hues, gamut-clamped, idempotent, passing the D-13 contrast gate with >0.2 margin on every row"
    requirement: "DSGN-04"
    verification:
      - kind: integration
        ref: "npm run palette:build && npm run check:contrast -> Overall: PASS; second palette:build run byte-identical (cmp)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Minimum pairwise OKLab distance >=0.05 at all three stops (vivid-light 0.0642, block 0.0581, vivid-dark 0.0554), documented hueOffsets for the 3 conflicting pairs"
    requirement: "DSGN-04"
    verification:
      - kind: unit
        ref: "design/evidence/palette.md 'Minimum pairwise distance' table, all 3 stops PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Swatch evidence (grid + block tiers, both themes, real stylesheet and subset fonts) for the owner's C-01 judgement"
    requirement: "DSGN-05"
    verification:
      - kind: e2e
        ref: "npm run palette:swatches -> palette-swatches-{light,dark}.png, both >10KB and 1200px wide; on-page hex labels verified to match palette.md exactly"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner's C-01 aesthetic judgement on whether the flagged amber/olive block stops (Sports, Business) and the two subject-fidelity substitutions (politics, weather) are acceptable"
    verification: []
    human_judgment: true
    rationale: "Whether a rendered colour reads as 'confident amber' or 'brown' (C-01) and whether a substituted photograph's place/subject is acceptable are aesthetic and provenance judgements this phase's own plan explicitly reserves for the owner — not decidable by a script. Visual review during execution flagged both risks transparently rather than silently resolving them; see Known Stubs / Deviations below."

duration: 71min
completed: 2026-09-16
status: complete
---

# Phase 1 Plan 3: Photo-Sampled Palette — Sourcing, Generation, Swatch Evidence Summary

**Eight category hues sampled from real, licence-recorded El Paso/Juárez/Chihuahuan-desert photography (ocotillo, marigold, creosote, a Ciudad Juárez storefront, an El Paso mural, and two desert-sky substitutions), forced onto shared OKLCH stops that pass the D-13 contrast gate with margin and a 0.05 minimum-pairwise-distance floor via three documented hue offsets, with swatch evidence rendered in both themes for the owner's C-01 sign-off.**

## Performance

- **Duration:** 71 min (13:33–14:44 across 3 task commits)
- **Started:** 2026-09-16T19:33:14Z (approx., immediately following 01-02's completion commit)
- **Completed:** 2026-09-16T20:44:26Z (Task 3 commit `8fb46d8`)
- **Tasks:** 3/3
- **Files modified:** 16 (across 3 commits; see Files Created/Modified)

## Accomplishments

- Sourced 8 real, licence-recorded photographs from Wikimedia Commons (ocotillo in bloom,
  a high-desert dusk sky, an El Paso street-mural orange block, cempasúchil marigold, a
  Saguaro National Park violet sunset, a Ciudad Juárez pink storefront, creosote bush, and a
  real El Paso midday sky) and reduced each to a chroma-weighted circular-mean hue with a
  re-runnable, threshold-enforced Playwright+culori script
- Built the shared-stop OKLCH palette from those hues: raised block/vivid-dark chroma to
  0.150 and applied three small, documented, brute-force-searched hue offsets to separate
  three pairs of genuinely close real-photo hues, all while keeping every WCAG contrast row
  passing with more than 0.2 margin and every category gamut-safe
- Generated `design/evidence/palette.md` (per-stop requested/written chroma, hex, minimum
  pairwise distance, and a C-01 review table) and rendered swatch evidence in both themes
  using the real production stylesheet and subset fonts, with every displayed hex verified
  against the live page rather than recomputed in Node
- `npm run palette:build && npm run check:contrast && npm run verify:phase-1 -- --pages=index
  --criteria=1,2,5` passes end-to-end (9/9 Playwright tests, both Chromium and WebKit) against
  the real, photo-sampled palette

## Task Commits

1. **Task 1: Source real photos and sample one hue per category (D-02, C-01)** - `7c6c4b7` (feat)
2. **Task 2: Generate the shared-stop palette and pass the contrast gate (D-01/D-02/D-03/D-04/D-13)** - `8ce5588` (feat)
3. **Task 3: Render swatch evidence for both themes (D-01, C-01)** - `8fb46d8` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/palette/photo-sources.json` - 8 photo entries (pageUrl/imageUrl/license/author/region/note), including two explicitly flagged subject-fidelity notes
- `design/scripts/sample-hues.mjs` - Downloads into gitignored `design/palette/reference/` with an HTTPS + two-host allowlist + redirect cap + content-type/size checks + retry-with-backoff; decodes via real Chromium canvas; reduces to chroma-weighted circular-mean hue + circular std dev
- `design/palette/hue-sources.json` - Generated: all 8 categories' sampled hue/circularStdDev/keptPixels/medianL/medianC
- `design/palette/palette.json` - Shared stops (vivid-light/block/vivid-dark, all C=0.150) and 8 categories with 3 documented hueOffsets
- `design/scripts/build-palette.mjs` - Validates offsets, builds gamut-clamped `oklch()` per category/stop, rewrites `style.css`'s palette regions, writes `design/evidence/palette.md`; floor-truncates chroma before any use
- `design/evidence/palette.md` - Generated: per-category/stop table, minimum pairwise distance table (all PASS), C-01 review table (Sports, Business flagged)
- `design/mockups/style.css` - `palette:start/end` (now includes the six `--stop-*` lines) and `palette-dark:start/end` regenerated from real hues; D-04 neutrals unchanged
- `design/evidence/contrast.md` - Regenerated: all rows PASS with margin
- `design/scripts/render-swatches.mjs` - Renders 8-category swatch evidence (grid + block tiers) in both themes using the real stylesheet/fonts; in-page hex verification via 1x1 canvas fill
- `design/evidence/palette-swatches-{light,dark}.png` - Swatch evidence, 1200px wide, both themes
- `package.json` - Added `palette:sample`, `palette:build`, `palette:swatches` scripts

## Decisions Made

- Raised block/vivid-dark stop chroma from the 01-02 tracer's placeholder (0.100/0.110) to 0.150 (matching vivid-light) — the maximum the contrast gate still passes with margin — because business's block-stop chroma is gamut-clamped to ~0.094 regardless of how much is requested, and only a higher shared ceiling plus a hue offset could close the resulting pairwise-distance gap.
- Applied three symmetric, documented hue offsets (crime -6°/sports +6°; business -4°/health +4°; politics +4°/weather -4°) found via brute-force search over the plan's ±8° allowance, rather than guessing or re-sampling different photos for any of the three pairs.
- Kept two subject-fidelity deviations from Task 1 visible rather than hidden: politics substitutes a Santa Fe, NM dusk sky for the literal Franklin Mountains/El Paso skyline (genuine El Paso night photographs measured near-zero chroma), and weather's sampled hue reads as azure blue rather than "turquoise." Both are recorded in `photo-sources.json` and surfaced again here for the owner's judgement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wikimedia rate-limited (HTTP 429, `retry-after: 600`) requests for original-resolution images**
- **Found during:** Task 1, first `npm run palette:sample` run
- **Issue:** Several original-file URLs (hit repeatedly during manual research) returned 429 with a 10-minute retry-after; one original file was also 39.8MB, over the script's own 15MB cap.
- **Fix:** Switched every `imageUrl` in `photo-sources.json` to a 1280px `thumb/` rendition (still above the script's own 800px processing target, so no accuracy lost — thumbnail renditions are served from a separate, less-restricted cache tier than originals) and added retry-with-backoff plus a small inter-request delay to `sample-hues.mjs` for future runs.
- **Files modified:** design/palette/photo-sources.json, design/scripts/sample-hues.mjs
- **Verification:** `npm run palette:sample` completed cleanly end-to-end after the fix.
- **Committed in:** `7c6c4b7`

**2. [Rule 1 - Bug] Ocotillo-against-sky region produced a huge circular standard deviation (~65-70°)**
- **Found during:** Task 1, evaluating candidate regions for crime's hue
- **Issue:** Individual ocotillo flowers are tube-shaped with real gaps between them; even a visually "solid-looking" crop let sky-blue bleed through those gaps after the script's required 800px-long-edge canvas downscale, pulling the chroma-weighted circular mean toward blue and producing circularStdDev far above the 25° threshold.
- **Fix:** Switched to a different, fully-open single ocotillo flower photographed against a neutral rock backdrop instead of a flower spike against open sky.
- **Files modified:** design/palette/photo-sources.json (region/imageUrl for crime)
- **Verification:** Final crime sample: circularStdDev 6.7°, keptPixels 19,750.
- **Committed in:** `7c6c4b7`

**3. [Rule 1 - Bug] Round-to-nearest chroma formatting produced an out-of-gamut `oklch()` literal**
- **Found during:** Task 2, first `npm run check:contrast` run after `palette:build`
- **Issue:** `clampChroma` finds the true sRGB-boundary chroma via numeric search (e.g. `0.1439998...`); formatting with `toFixed(3)` rounded it up to `0.144`, and `check-contrast.mjs`'s own `displayable()` gate correctly rejected the resulting `oklch(0.600 0.144 242.5)` as outside sRGB.
- **Fix:** Floor-truncate chroma to 3 decimals before it is used anywhere (not just at CSS-write time), so the evidence report and the actual `style.css` value are always the same, always-safely-inside-gamut number.
- **Files modified:** design/scripts/build-palette.mjs
- **Verification:** `npm run check:contrast` passes; gamut-safety Node check confirms all 24 `oklch()` literals are `displayable()`.
- **Committed in:** `8ce5588`

**4. [Rule 1 - Bug] Three pairs of real photo-sampled hues fell below the 0.05 minimum pairwise OKLab distance**
- **Found during:** Task 2, computing the evidence report's distance table against the placeholder stop chromas
- **Issue:** crime/sports (12.7° apart), business/health (22.2° apart) and politics/weather (19° apart) are each genuinely close real-photo hue pairs; at the tracer's original stop chromas (0.100–0.150) this produced minimum pairwise OKLab distances as low as 0.022, well under the 0.05 floor.
- **Fix:** Raised block/vivid-dark chroma to 0.150 and applied documented ±4°–±6° hue offsets to each pair (see palette.json's `hueOffsetReason` fields), found via brute-force search rather than trial and error.
- **Files modified:** design/palette/palette.json
- **Verification:** All three stops now report minimum pairwise distance ≥0.0554 in `design/evidence/palette.md`.
- **Committed in:** `8ce5588`

**5. [Rule 1 - Bug] `getComputedStyle(...).color` does not convert `oklch()` to `rgb()` in this Chromium build**
- **Found during:** Task 3, first swatch render
- **Issue:** The first implementation parsed three numbers out of the computed `color` string with a regex, which "succeeded" against the literal string `"oklch(0.6 0.15 24.7)"` and produced a wildly wrong near-black hex (`#010019`) for every swatch — a silent bug (correct-looking PNGs, wrong colours) caught only by comparing the on-page hex labels against the actually-painted colour.
- **Fix:** Routed the conversion through a 1x1 `<canvas>` fill + `getImageData`, which resolves any valid CSS colour (including `oklch()`) to rasterised device RGB regardless of the CSS colour space it was authored in.
- **Files modified:** design/scripts/render-swatches.mjs
- **Verification:** On-page hex labels in both screenshots now match `design/evidence/palette.md`'s hex values exactly, category by category.
- **Committed in:** `8fb46d8`

---

**Total deviations:** 5 auto-fixed (4 bugs, 1 blocking-issue fix). No scope creep — all fixes stayed inside the palette pipeline this plan builds; none touched unrelated site CSS or components.
**Impact on plan:** All fixes were necessary for correctness (a silently wrong colour, an out-of-gamut value, indistinguishable category hues) or to unblock execution (rate limiting). Two additional items — the politics photo substitution and weather's measured-vs-expected hue — are not deviations from *correctness* but explicit, flagged departures from the plan's literal subject wording, carried forward for owner review rather than silently resolved.

## Issues Encountered

- Wikimedia's edge rate-limited several repeated requests during manual photo research (separate from the `sample-hues.mjs` 429s covered above) — worked around with short delays between `curl` calls during sourcing; no code impact.

## Known Stubs

None that block this plan's own goal — all three tasks' acceptance criteria pass. Two items are flagged for the owner's judgement rather than treated as stubs or silently resolved:

- **politics's photo substitution** (Santa Fe, NM dusk sky, not the Franklin Mountains/El Paso skyline the subject names) — a real, verified finding (genuine full-darkness night photographs of El Paso have near-zero chroma) rather than a research shortfall. See `design/palette/photo-sources.json`'s `politics` entry and `design/evidence/palette.md`.
- **Sports and Business block-stop hues** (49.4° and 94.5°, both in the 40-100° amber/olive band `design/evidence/palette.md`'s own C-01 review table flags) visually read close to the "may read as brown" risk the plan's research anticipated. Visible in `design/evidence/palette-swatches-{light,dark}.png`.

## User Setup Required

None - no external service configuration required beyond what 01-01/01-02 already established.

## Next Phase Readiness

- The palette pipeline (photo-sources → hue-sources → palette.json → build-palette.mjs → style.css) is fully re-runnable: a hue tuned later, a photo re-sampled, or a stop adjusted just needs `palette:build` re-run, and `check:contrast` will catch any regression.
- `design/scripts/render-swatches.mjs` is ready for reuse at the phase's final `01-APPROVAL.md` step without modification.
- Three items should be carried into that final approval packet for one combined owner sign-off rather than resolved piecemeal: the politics photo substitution, weather's measured-blue-not-turquoise finding, and the Sports/Business amber-olive block risk.
- No blockers for 01-04 (D1 stress set + Spanish copy) or 01-05 (test-first contrast gate extension) — both consume the same `style.css` token layer this plan regenerated in place.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-16*

## Self-Check: PASSED

All files listed above verified present on disk; all three task commits (`7c6c4b7`, `8ce5588`, `8fb46d8`) verified present in git history (see below).

---
phase: 01-design-sketch-editorial-identity
plan: 16
subsystem: design-system
tags: [palette, oklch, culori, playwright, wikimedia, contrast, wcag, color, gap-closure]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-03: photo-first hue-sampling pipeline (sample-hues.mjs, build-palette.mjs), shared OKLCH stops, 0.05 minimum pairwise distance gate, D-13 contrast gate"
provides:
  - "design/palette/photo-sources.json: Business's photo record replaced (marigold -> Ciudad Juárez neon-sign storefront), all seven other entries byte-identical"
  - "design/palette/hue-sources.json: Business re-sampled to 152.1deg (keptPixels 538, circularStdDev 17.2), outside the 40-100deg amber/olive band"
  - "design/palette/palette.json: Business hueOffset 0 (no hand-picked nudge needed); Health's retained +4 offset reason rewritten to stand alone"
  - "design/mockups/style.css: only the four --cat-business-* / --hue-business tokens changed; idempotent regeneration confirmed (byte-identical on 2nd palette:build run)"
  - "design/evidence/palette.md, contrast.md, palette-swatches-{light,dark}.png: regenerated; C-01 review table no longer lists Business"
  - ".planning/WINDOWS.md: entry 3 closed (Sports accepted by owner, Business re-sampled outside the band); entry 2 left open, untouched"
affects: [01-23-final-approval-re-review]

actuals:
  tokens: 9900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "When a photo-sampled hue genuinely reads as brown/olive at the shared block lightness, the fix is a different colour REGISTER entirely (this plan moved from yellow-orange ~95deg to green-cyan ~152deg), not a different photo in the same failing register -- the amber/olive band (40-100deg) drops to brown at any hue inside it, regardless of source photo."
    - "Night-lit or artificial-worksite-lit photographs are unreliable sources for photo-sampled hue even when a colour looks saturated on screen -- two candidates from a night-lit mural photo set measured chroma below the sampler's own 0.08 floor once downscaled to 800px, returning zero kept pixels. Daylight or self-illuminated (neon tube) light sources avoid this."
    - "A throwaway Playwright-based hue probe script (mirroring sample-hues.mjs's exact reduction logic and 800px downscale) is a fast, disposable way to test multiple candidate photos/regions before committing one to photo-sources.json and re-running the full pipeline -- built and torn down entirely within design/.cache/ (gitignored), never committed."

key-files:
  created: []
  modified:
    - design/palette/photo-sources.json
    - design/palette/hue-sources.json
    - design/palette/palette.json
    - design/mockups/style.css
    - design/evidence/palette.md
    - design/evidence/contrast.md
    - design/evidence/palette-swatches-light.png
    - design/evidence/palette-swatches-dark.png
    - design/evidence/pages/category-dark-1280.jpg
    - design/evidence/pages/category-dark-320.jpg
    - design/evidence/pages/category-dark-768.jpg
    - design/evidence/pages/category-light-1280.jpg
    - design/evidence/pages/category-light-320.jpg
    - design/evidence/pages/category-light-768.jpg
    - .planning/WINDOWS.md

key-decisions:
  - "New Business subject: the green-cyan neon tube border of the real 'Kentucky Club & Grill' bar sign (operating since 1920) in downtown Ciudad Juárez, Mexico -- a genuine, licence-recorded (CC BY-SA 4.0, photographer Wotancito) saturated storefront/neon-sign photo, matching C-01's own named register already used for Sports, Weather and Community. Chosen over several rejected candidates: night-lit mural photographs (from the same photo set as Sports/Weather) measured chroma too low once downscaled (0 kept pixels); a daylight mural's shaded agave plant had the same problem; a wider crop of the same neon sign pulled in window-glass reflections that pushed circularStdDev over 60deg."
  - "Business's hueOffset set to 0 -- the photo-sampled hue (152.1deg) alone clears the 0.05 minimum pairwise OKLab distance floor with no hand-picked nudge, unlike the three offset pairs 01-03 needed. Business/Health is the new closest pair at the block stop (0.0559, just above the 0.05 floor), while Business-vs-Sports and Business-vs-Education both clear 0.05 with wide margin (0.19-0.29) at every stop."
  - "Health's hueOffset kept at +4 (unchanged, so the owner-reviewed Health colour does not move) but its hueOffsetReason text rewritten -- it no longer references a paired adjustment against Business's former marigold hue, since nothing pairs with Business's new hue anymore."

patterns-established: []

requirements-completed: [DSGN-04, DSGN-05, A11Y-01]

coverage:
  - id: D1
    description: "Business's colour re-sampled from a new, licence-recorded photograph of a saturated El Paso/Juárez storefront subject, landing outside the 40-100deg amber/olive band that reads as brown at block lightness"
    requirement: "DSGN-04"
    verification:
      - kind: integration
        ref: "pnpm run palette:sample -> design/palette/hue-sources.json; business hue=152.1, keptPixels=538 (>=500), circularStdDev=17.2 (<=25)"
        status: pass
      - kind: unit
        ref: "node -e check in 01-16-PLAN.md Task 1 <verify>: business final hue 152.1 confirmed outside [40,100]"
        status: pass
    human_judgment: false
  - id: D2
    description: "No other category's final hue changed; Sports stays at 49.4deg (owner-accepted), Health stays at 124.7deg with its offset reason updated"
    requirement: "DSGN-04"
    verification:
      - kind: integration
        ref: "git diff design/palette/hue-sources.json touches only the business record; git diff design/mockups/style.css touches only the four --cat-business-*/--hue-business tokens"
        status: pass
    human_judgment: false
  - id: D3
    description: "Minimum pairwise OKLab distance stays >=0.05 at all three stops, including Business against Sports and Education"
    requirement: "DSGN-04"
    verification:
      - kind: unit
        ref: "design/evidence/palette.md 'Minimum pairwise distance' table: vivid-light 0.0642, block 0.0559, vivid-dark 0.0554, all PASS; business-vs-sports/education computed directly at 0.19-0.29 per stop"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-13 contrast gate passes for both themes with the new Business block and stripes"
    requirement: "A11Y-01"
    verification:
      - kind: integration
        ref: "pnpm run check:contrast -> Overall: PASS"
        status: pass
    human_judgment: false
  - id: D5
    description: "palette.md's C-01 review no longer lists Business; swatch evidence regenerated for both themes"
    requirement: "DSGN-05"
    verification:
      - kind: e2e
        ref: "design/evidence/palette.md C-01 review table (Sports only); pnpm run palette:swatches -> palette-swatches-{light,dark}.png regenerated, both pass the script's own size/width/hex-match checks"
        status: pass
    human_judgment: false
  - id: D6
    description: "Owner's C-01 aesthetic judgement on whether the new Business colour reads correctly (not brown/tan/olive) in both themes"
    verification: []
    human_judgment: true
    rationale: "Whether a rendered colour reads as a clean green vs. still reads as brown/olive is the owner's aesthetic call per C-01, not decidable by a script. Visual inspection during execution found the new Business colour reads as a clear forest green in both themes with no amber/olive cast, but this is not a substitute for the phase's own end-of-phase human check (collected at 01-23)."

duration: 35min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 16: Business Hue Re-Sample (D-GAP-C) Summary

**Business's palette colour re-sampled from a real Ciudad Juárez neon-sign photograph (152.1deg, forest green) — closing D-GAP-C by moving out of the amber/olive register entirely rather than trying another yellow-orange photo, with every other category and gate byte-identical.**

## Performance

- **Duration:** 35 min (approx., from 01-15's completion through this plan's final task commit)
- **Started:** 2026-09-17T20:43:01Z (approx., immediately following 01-15's completion)
- **Completed:** 2026-09-17T21:18:16Z
- **Tasks:** 2/2
- **Files modified:** 15 (across 2 commits)

## Accomplishments

- Sourced a new, licence-recorded (CC BY-SA 4.0) photograph for Business: the
  green-cyan neon tube border of the real "Kentucky Club & Grill" bar sign
  (operating since 1920) in downtown Ciudad Juárez — a genuine saturated
  storefront/neon-sign subject, the same C-01-named register already used for
  Sports, Weather and Community
- Re-sampled Business's hue to 152.1deg (keptPixels 538, circularStdDev 17.2,
  both comfortably inside the sampler's own gates), landing outside the
  40-100deg amber/olive band that reads as brown at block lightness — the
  actual physics-based root cause the owner's "reads as brown" feedback
  pointed at, not a defect specific to the marigold photo
- Regenerated the palette region, evidence, and swatch PNGs with zero changes
  to any other category's hue, offset, or token, and the contrast gate and
  minimum-pairwise-distance gate both pass with real margin
- Closed WINDOWS.md ledger entry 3, recording what the owner actually decided
  (Sports accepted as-is; Business sent back and now genuinely resolved) —
  left entry 2 (politics photo) untouched and open per the plan's instruction

## Task Commits

1. **Task 1 (tracer): New Business photo → sampled hue → palette regions → contrast gate → category masthead** - `514bbb8` (feat)
2. **Task 2: Swatch evidence, content checks and ledger** - `ddc41e7` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/palette/photo-sources.json` - Business's marigold record replaced with the Ciudad Juárez neon-sign source (subject, pageUrl, imageUrl, licence, author, region, note); all seven other entries byte-identical
- `design/palette/hue-sources.json` - Regenerated: Business's sampled hue/circularStdDev/keptPixels/medianL/medianC updated; all other seven entries byte-identical
- `design/palette/palette.json` - Business `hueOffset` set to 0 (`hueOffsetReason` null); Health's `hueOffsetReason` text rewritten to stand alone
- `design/mockups/style.css` - Only `--hue-business`, `--cat-business-vivid-light`, `--cat-business-block`, `--cat-business-vivid-dark` changed; `palette:build` run twice produces byte-identical output
- `design/evidence/palette.md` - Regenerated: Business's C-01 review row removed (Sports remains, already accepted); minimum-pairwise-distance table all PASS
- `design/evidence/contrast.md` - Regenerated: Overall PASS
- `design/evidence/palette-swatches-{light,dark}.png` - Regenerated with the new Business colour; both pass size/width/hex-match checks
- `design/evidence/pages/category-{light,dark}-{320,768,1280}.jpg` - Regenerated via `verify:phase-1` as part of Task 1's own verification (Business masthead now shows the new colour)
- `.planning/WINDOWS.md` - Entry 3 marked fixed with an updated description; entry 2 untouched

## Decisions Made

- New Business subject and region chosen after probing several rejected candidates (night-lit mural photos measuring 0 kept pixels due to low chroma under artificial worksite lighting; a daylight mural's shaded agave plant with the same problem; a wider neon-sign crop contaminated by window-glass reflections) — see key-decisions in frontmatter for full detail.
- Business's `hueOffset` left at 0; the photo-sampled hue alone clears the 0.05 distance floor.
- Health's `hueOffset` (+4) retained unchanged so the owner-reviewed Health colour does not move, with its reason text updated to reflect it no longer pairs with anything.

## Deviations from Plan

None — plan executed exactly as written. The photo-sourcing search took more iterations than a single lookup (several rejected candidates before the neon-sign photo passed both sampler gates cleanly), but this is exactly the "if it falls inside [the band] or fails the gates, pick a different photo or region and repeat" instruction the plan itself specifies, not a deviation from it.

## Issues Encountered

- Several candidate photos/regions were tried and rejected before finding one that cleared both the sampler's keptPixels>=500 and circularStdDev<=25 gates cleanly: night-lit mural photographs (visually "blue" paint under artificial worksite lighting measured chroma below the sampler's 0.08 floor once downscaled to 800px, returning 0 kept pixels); a daylight mural's shaded agave plant had the same low-chroma problem; a wider crop of the eventual neon-sign photo pulled in window-glass reflections that pushed circularStdDev to 60+. The final region is a tight, single vertical run of clean neon tube glass on the "Kentucky Club & Grill" sign, verified via a throwaway Playwright probe script (mirroring sample-hues.mjs's exact logic) before committing it to photo-sources.json.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- D-GAP-C is closed: Business no longer reads as brown by construction (its final hue is outside the 40-100deg band), and every other palette value the owner already reviewed is unchanged.
- WINDOWS.md entry 3 is fixed; entry 2 (politics photo substitution) remains open, correctly deferred to the phase's 01-23 final re-review rather than resolved here.
- The end-of-phase human check for this plan (owner looking at the Business masthead on category.html in both themes, and both swatch PNGs) is non-blocking and collected at 01-23, per `human_verify_mode:end-of-phase`.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All files listed above verified present on disk; both task commits (`514bbb8`, `ddc41e7`) verified present in git history (see below).

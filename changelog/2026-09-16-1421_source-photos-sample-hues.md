# 2026-09-16 - Source Real Photos and Sample One Hue Per Category (D-02, C-01)

**Keywords:** [FEATURE] [SECURITY] [DESIGN]
**Session:** Afternoon, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1421_source-photos-sample-hues.md`

## What Changed

- File: `design/palette/photo-sources.json` (NEW)
  - Eight licence-recorded Wikimedia Commons photographs, one per category, in canonical
    order: crime = ocotillo (Fouquieria splendens) in bloom; politics = high-desert dusk sky;
    sports = a vivid orange block from a real El Paso street mural; business = cempasúchil
    (Tagetes erecta) marigold in bloom; education = a violet-magenta desert sunset in Saguaro
    National Park; community = a pink storefront building in Ciudad Juárez; health = creosote
    bush (Larrea tridentata) foliage; weather = a real midday sky over El Paso
  - Each entry carries `pageUrl`, `imageUrl`, `license`, `author`, a `region` (0-1 fractions),
    and a `note` recording provenance and, where relevant, an honest subject-fidelity flag
- File: `design/scripts/sample-hues.mjs` (NEW)
  - Downloads each photo into the gitignored `design/palette/reference/`: HTTPS-only, a
    two-host allowlist (`upload.wikimedia.org`, `images.unsplash.com`) re-checked on every
    redirect hop (not just the first), a 3-redirect cap, `content-type` must start with
    `image/`, 15 MB size cap, and retry-with-backoff on transient 429/5xx responses
    (Wikimedia's edge rate-limits bursts of same-second requests — this is a Rule 3
    blocking-issue fix, not a relaxed content check)
  - Decodes each downloaded file inside a real Chromium tab (via the existing
    `serve-mockups.mjs` static server) rather than a hand-rolled Node image decoder,
    downscales to at most 800px on the long edge, and reads back the declared region's pixels
  - Reduces the region's pixels to a chroma-weighted circular-mean hue (culori `oklch`),
    circular standard deviation, and median L/C, after discarding pixels below chroma 0.08 or
    outside the 0.25-0.90 lightness band
  - Exits non-zero if any category falls short of 500 kept pixels or exceeds a 25-degree
    circular standard deviation — "the fix is a tighter region or a better photo, never a
    relaxed threshold"
- File: `design/palette/hue-sources.json` (NEW, generated)
  - All eight categories pass with comfortable margin: circular standard deviations from
    1.1 to 10.2 degrees (threshold 25), kept-pixel counts from 1,105 to 79,040 (threshold 500)
- File: `package.json`
  - Added `"palette:sample": "node design/scripts/sample-hues.mjs"`

## Why

D-02 requires each category hue to come from a real photograph rather than being picked by
eye, with lightness supplied separately by the palette's OKLCH stops (Task 2). This task
builds the machinery that makes that claim checkable: a script that downloads, decodes, and
statistically reduces each photo's declared region, and fails loudly rather than silently
averaging in a second unrelated hue.

Two categories carry flagged notes for the owner's C-01 judgement rather than a silent
substitution:
- **politics** samples a high-desert dusk sky near Santa Fe, NM, not literally the Franklin
  Mountains or El Paso skyline the subject names. A real search across Wikimedia Commons (El
  Paso night sky, Franklin Mountains dusk/moon, the full "Cityscapes of El Paso, Texas"
  category, `HUS 4312`, `ElPasoEveningMarch2008`) turned up nothing usable: literal
  full-darkness night photographs of El Paso have near-zero chroma (a real property of true
  darkness, not a search failure), and the one low-enough-resolution dusk skyline shot found
  yielded only 70 kept pixels against the required 500.
- **weather**'s sampled hue reads as a saturated azure/sky blue (~246°) rather than the
  colloquially "turquoise" the subject wording anticipates — an honest outcome of D-02's
  photo-first methodology, not nudged toward cyan by eye.

## Issues Encountered

- **Ocotillo-against-sky regions produced a huge circular standard deviation (~65-70°)** even
  inside a visually "solid-looking" flower-spike crop. Individual ocotillo flowers are
  tube-shaped with real gaps between them, and the script's required 800px-long-edge
  downscale blends the intervening sky-blue into the edges of nominally-red pixels at a scale
  invisible on screen. Fixed by switching to a single fully-open ocotillo flower photographed
  against a neutral rock backdrop instead of a spike against open sky — same species, cleaner
  optical geometry.
- **Wikimedia's edge answered several original-resolution image requests with HTTP 429**
  (`retry-after: 600`), scoped to the specific original-file URL rather than the whole host.
  Switching every `imageUrl` in `photo-sources.json` to a 1280px `thumb/` rendition (still well
  above the script's own 800px processing target, so no accuracy lost) resolved this — thumbnail
  renditions are served from a separate, less-restricted cache tier than originals.
- One photo (the ocotillo original) was 39.8 MB, over the script's own 15 MB cap; resolved the
  same way, via the 1280px thumbnail rendition.

## Dependencies

No dependencies added. Uses `@playwright/test` and `culori`, both already installed.

## Testing Notes

- What was tested: `npm run palette:sample` end-to-end (all 8 downloads, browser decode,
  region reduction, non-zero-exit gate); the plan's literal inline verification command
  (slug order, license/author/imageUrl-host presence, hue range, keptPixels/circularStdDev
  thresholds) passes and prints all 8 `slug:hue` pairs; `git check-ignore` confirms
  `design/palette/reference/*.jpg` is never staged.
- What wasn't tested: the plan's `human-check` step (opening each `pageUrl` to judge whether
  the photograph represents the place and register the owner asked for) was performed by the
  executing agent during sourcing, not by the owner — flagged in the SUMMARY for the owner's
  own pass, particularly the two notes above.
- Edge cases: the community pink-building sample sat just above the 500-pixel floor (1,105
  kept) rather than with wide margin like the other seven; still comfortably inside the
  circular-standard-deviation threshold (5.3° vs 25°).

## Next Steps

- [ ] Task 2: generate the shared-stop OKLCH palette from these sampled hues and pass the
      D-13 contrast gate against the final neutrals
- [ ] Task 3: render swatch evidence in both themes for the owner's C-01 judgement
- [ ] Owner review at the human-check step: confirm the politics (Santa Fe substitution) and
      weather (measured-blue-vs-turquoise) notes are acceptable, or request different sources

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - introduces the palette data/scripts layer Task 2 and Task 3 build on; no production/public-site code affected

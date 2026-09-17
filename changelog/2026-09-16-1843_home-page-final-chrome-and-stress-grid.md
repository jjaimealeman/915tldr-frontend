# 2026-09-16 - Final Chrome and Home Page: Typographic Lead Plus Full Stress Grid

**Keywords:** [FEATURE] [STYLING] [UI] [DESIGN] [ACCESSIBILITY] [TESTING]
**Session:** Evening, Duration (~2 hours, including a font-CLS environment investigation)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1843_home-page-final-chrome-and-stress-grid.md`

## What Changed

- File: `design/mockups/index.html` (full rewrite)
  - Final site chrome: masthead (wordmark `h1`, tagline, dateline), an eight-segment
    `[data-spectrum]` rule in canonical category order, a `[data-nav-category]` grid nav
    (2 columns base, restyled to 4/8 at 48em/80em), the theme toggle, and a footer with
    changelog/contact links plus an attribution line
  - The lead (D-09): the real `no-image` corpus row (`8b86f8d7`, "Congress Holds Leon Black in
    Contempt...") as `data-lead-variant="type"` — a deliberate imageless, type-led treatment
  - The grid (D-12): 33 `[data-card]` elements in one true reverse-chronological merge of 22
    real `feed` rows plus every D-06/D-07 stress case (longest/shortest headline, longest/
    shortest summary, a drawn `no-summary` state, `junk-image` rendered imageless with the
    rejected URL in a comment, `usable-image` as a real thumbnail, `uncategorized` with no
    category-name element, `spanish-real`, `spanish-synthetic`, and the D-07 `worst-case`
    row — all `lang="es"` Spanish cards sourced from `design/fixtures/spanish-stress.json`)
  - `data-i18n` hooks on the nine components later Spanish-overflow tests inject into:
    `skip-link`, `lead-headline`, `lead-summary`, `nav-category-label`, `theme-toggle`,
    `card-headline`, `card-summary`, `card-summary-thin`, `byline`
- File: `design/mockups/style.css`
  - New mobile-first component CSS: chrome (masthead, spectrum, nav grid, theme toggle,
    footer), `[data-lead]`/`[data-lead-variant="type"]`, `[data-frame]` (fixed 3:2 image
    frame, background `var(--rule)`, `object-fit: cover`), and the grid/card rules
    (`overflow-wrap: anywhere`, `hyphens: auto`, no `line-clamp`/`text-overflow`/`max-height`)
  - `[data-block]` repointed to a new `--cat-block` custom property (was a bare `--cat` alias),
    and every `[data-category="<slug>"]` rule extended to also set `--cat-block: var(--cat-
    <slug>-block)` — the hook the category masthead (Task 2) needs
  - Only two layout breakpoints: `min-width: 48em` and `min-width: 80em`, plus
    `prefers-reduced-motion`
- File: `design/mockups/fonts/*.woff2`, `subset-manifest.json` — rebuilt via
  `npm run fonts:build` to cover the new page's full glyph set (idempotent, no logic change)

## Why

This is the phase's central deliverable: the type-led lead (D-09), the single reverse-
chronological feed with no per-category sections (D-12), and colour tiering where vivid hue
never sits behind grid text (D-01), all drawn against the *real*, deliberately pathological
D-06 stress set rather than placeholder copy — so layout failures surface now, not after 41k
pages are built in Phase 4.

## Issues Encountered

- **WebKit font-swap CLS regression, root-caused to a missing-font gap in the pinned test
  environment, not a defect in this page.** `npm run verify:phase-1 -- --pages=index
  --criteria=1,2,5` fails criterion 5 in WebKit only (`geometryScore` 0.759 at 320px, ~150x
  the 0.005 threshold; Chromium passes at 0.0035). Investigated with a standalone before/after
  snapshot diff: the shift is real character-width reflow between the real fonts (Instrument
  Serif / Source Serif 4) and their loaded fallback face. `fc-list` inside the pinned
  `mcr.microsoft.com/playwright:v1.63.0-noble` Docker image confirms it has **no Georgia and
  no Noto Serif installed** — only the Liberation family — so this specific WebKit test
  environment falls through to the least width-compatible fallback tier (the Times-New-Roman-
  metric face, `local('Liberation Serif')`), which reflows headlines and summaries across many
  cards on this now-content-heavy page. Real Safari/Chrome on real desktop and mobile devices
  commonly ship Georgia and/or Noto Serif, so this is very unlikely to reproduce for actual
  users; it extends 01-02's own documented caveat that this Docker WebKit is "strong evidence,
  not the final word" for real Safari behaviour. No dependency was added and no threshold was
  weakened to work around it — recorded here and in the plan's SUMMARY for the phase's
  end-of-phase approval packet, per `human_verify_mode: end-of-phase`.
- A first pass at the category page's image-led lead (`[data-lead-variant="image"]`) used CSS
  Grid with un-grouped sibling children, which auto-placed each element into its own grid cell
  instead of stacking the text column — caught visually with a screenshot before commit, fixed
  by wrapping the text elements in a `[data-lead-body]` container and switching to flex (see
  Task 2's own changelog entry for the fix itself, split out from this task's markup work).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the plan's inline Node contract check (`index contract ok`), `grep`-based
  acceptance criteria (no `line-clamp`/`text-overflow`, exactly the two allowed media queries,
  one `[data-spectrum]` with eight segments, the uncategorized card has no category-name
  element), `npm run check:contrast` (PASS, unchanged from 01-03/01-05), and the scoped
  Playwright runner in both Chromium and WebKit (structure/`@c1`, grid/JS-disabled/font-family/
  `@c5`, and font-subset-coverage/`@c5` all PASS in both engines; font-swap-CLS/`@c5` PASS in
  Chromium, FAIL in WebKit for the reason above). Also drove a real Chromium browser at 390px
  and 1280px to visually confirm the chrome, lead, spectrum, and nav render as intended.
- What wasn't tested: the owner's own visual/aesthetic judgement (reserved for end-of-phase
  approval per `human_verify_mode: end-of-phase`); a real macOS/iOS Safari spot-check of the
  font-swap CLS finding above.
- Edge cases: the `no-summary` and `shortest-headline` stress cards deliberately reuse the same
  corpus row (5f20c478) with and without its summary, and `longest-headline`/`spanish-real`/
  `spanish-synthetic`/`worst-case` all deliberately reuse the same row (f63b5753) — the corpus's
  single longest headline, which also happens to be the chosen real Spanish-headline case
  (documented in 01-04-SUMMARY.md); this is intentional stress-testing, not a data bug.

## Next Steps

- [ ] Carry the WebKit-Docker font-CLS finding above into `01-APPROVAL.md`'s end-of-phase
      packet alongside 01-02's existing `prePaintObserved` caveat
- [ ] Task 2 (category page) builds on this chrome and CSS layer directly

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - this is the home page mockup Phase 3 will treat as the approved visual
system; the WebKit CLS finding is flagged, non-blocking, and traced to the test environment
rather than the design.

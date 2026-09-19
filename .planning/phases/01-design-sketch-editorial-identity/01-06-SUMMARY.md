---
phase: 01-design-sketch-editorial-identity
plan: 06
subsystem: design-system
tags: [html, css, mockups, editorial-design, oklch, spanish, i18n, playwright, webkit, cls]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-02: production token layer, self-hosted fonts, D-13 contrast gate, D-16 runner; 01-03: photo-sampled palette; 01-04: full D-06 stress set + D-15 Spanish calibration; 01-05: hardened contrast gate"
provides:
  - "design/mockups/index.html: final home mockup — chrome (masthead, spectrum rule, nav grid, footer), the typographic (imageless) lead (D-09), and a 33-card true reverse-chronological grid (D-12) merging 22 real feed rows with every D-06/D-07 stress case"
  - "design/mockups/category.html: business category mockup — the D-01 masthead colour block (open item 4), an image-led lead (D-09), and a 12-card business grid"
  - "design/mockups/style.css: chrome/lead/grid/frame component CSS, the --cat-block token extension per category, both consumed unchanged by 01-07's remaining pages"
affects: [01-07-article-changelog-contact, 01-08-keyboard-walk, 01-09-font-swap-matrix, 01-10-approval-packet]

actuals:
  tokens: 24200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "An image-led lead's text elements must be grouped in a single wrapper (e.g. [data-lead-body]) before applying a two-column layout at a wider breakpoint — CSS Grid/flex auto-placement scatters ungrouped siblings into separate cells rather than treating them as one column. Verified visually with a real-browser screenshot before committing; caught a broken layout that markup-only review would have missed."
    - "[data-block]'s background now resolves through --cat-block (set per [data-category=\"<slug>\"], aliasing --cat-<slug>-block) rather than reusing the grid-stripe token --cat — the two D-01 contexts (masthead, article header) and the grid stripe now read from separate, purpose-named custom properties even though today's values are identical."
    - "The full D-06/D-07 stress set and the D-12 reverse-chronological rule combine into ONE merge-and-sort: every stress card carries its source row's real datetime and is interleaved into the same chronological list as ordinary feed rows, never appended as a separate section — this is what D-12 ('no per-category sections or headings') actually requires when stress cases are added to a real feed."

key-files:
  created:
    - design/mockups/category.html
  modified:
    - design/mockups/index.html
    - design/mockups/style.css
    - design/mockups/fonts/subset-manifest.json

key-decisions:
  - "The D-06 stress cards are merged into the home grid's true reverse-chronological order (by each stress case's own real published_at), not appended as a separate block after the ordinary feed — required by D-12's 'no per-category sections or headings,' read literally: a grid with a stress section would itself be a kind of section."
  - "Several stress/i18n cases deliberately reuse the same real corpus row multiple times: uuid f63b5753 (the corpus's single longest headline, per 01-04-SUMMARY.md also the chosen real-Spanish-headline row) backs longest-headline, spanish-real, spanish-synthetic, and worst-case; uuid 5f20c478 backs both shortest-headline and the drawn no-summary card. This is the plan's own instruction (D-15/D-06 stress cases are explicitly derived from named rows), not a data-generation bug — each card exercises a different layout axis against the same pathological content."
  - "worst-case's summary text is spanish-stress.json's card-summary.es_real value, used exactly as the plan names it ('the longest-summary es_real') even though that component's underlying text is actually the Ukraine/longest-headline row's summary rather than the Lake Powell/longest-summary row's summary (an inconsistency in 01-04's already-committed, self-check-passed fixture — see Known Stubs). Not corrected here: 01-04's fixture file is outside this plan's file list, and the text is still real, unaltered corpus content either way."
  - "Business's real story count (2,933, from stress-set.json's categories case) was used verbatim rather than the plan's illustrative '3,803 stories' example — 3,803 is Crime's count, quoted in 01-CONTEXT.md purely as a formatting example, not as data to copy for Business."

patterns-established:
  - "design/mockups/index.html and category.html now both carry a fully identical head <script> block, byte-verified equal by an inline Node check — 01-07's remaining three pages must copy the chrome (and this script) verbatim, per the plan's own markup contract."

requirements-completed: [DSGN-01, DSGN-04, DSGN-05, DSGN-06, I18N-07]

coverage:
  - id: D1
    description: "Home mockup's grid draws every D-06/D-07 stress case (longest/shortest headline, longest/shortest summary, no-summary, junk-image imageless, usable-image thumbnail, uncategorized with no category-name element, real Spanish, synthetic Spanish, and the D-07 worst case) inside the same reverse-chronological grid as the real feed"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "inline Node contract check over design/mockups/index.html: prints 'index contract ok' (all 10 required data-stress values and 9 data-i18n hooks present, data-lead-variant=\"type\" present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Home lead is the typographic (imageless) treatment; category lead is the image-led treatment; no card or lead reserves an empty image slot; below the lead the home page is one mixed-category reverse-chronological grid with no per-category sections (D-09, D-12)"
    requirement: "DSGN-05"
    verification:
      - kind: unit
        ref: "grep -c \"data-block\" design/mockups/index.html -> 0; node check: data-lead-variant=\"type\" present on index, data-lead-variant=\"image\" present on category"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vivid category colour appears only as stripes/rules/nav markers in the grid; the only colour block is the category masthead, whose text/focus ring use --block-ink; the masthead carries the wordmark and an eight-segment canonical-order spectrum rule; the eight-link nav wraps into columns at 320px with no scroll container (D-01, open items 2 and 3)"
    requirement: "DSGN-05"
    verification:
      - kind: unit
        ref: "grep -c \"data-spectrum\" design/mockups/index.html -> 1 with 8 data-category spans; grep -oE \"@media[^{]*\" design/mockups/style.css -> only min-width 48em/80em and prefers-reduced-motion"
        status: pass
    human_judgment: false
  - id: D4
    description: "Base CSS targets 320px with only min-width 48em/80em layout queries; card summaries are never clamped/truncated; headlines use overflow-wrap/hyphens with no line-clamp/text-overflow/max-height (D-06, D-07)"
    requirement: "DSGN-06"
    verification:
      - kind: unit
        ref: "grep -cE \"line-clamp|text-overflow\" design/mockups/style.css -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Category masthead block (D-01, open item 4): full-bleed header[data-block][data-category=\"business\"] with h1, real description, real formatted story count, and an 'All sections' back-link picking up the block focus ring; category page's chrome matches index.html with the wordmark as a link and aria-current=\"page\" on the Business nav link"
    requirement: "DSGN-05"
    verification:
      - kind: other
        ref: "inline Node contract check over design/mockups/category.html: prints 'category contract ok'; grep -c \"data-block\" -> 1; grep -c \"data-block\" on index.html -> 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run verify:phase-1 -- --pages=index,category --criteria=1,2,5 exits 0 in both engines after fonts:build"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "npm run verify:phase-1 -- --pages=index,category --criteria=1,2,5"
        status: fail
    human_judgment: true
    rationale: "Criteria 1 and 2 pass cleanly in both engines and all Node checks pass. Criterion 5 (font-swap CLS) passes in Chromium but fails in WebKit on the content-heavy grid, root-caused via fc-list to the pinned Docker WebKit test image lacking Georgia/Noto Serif (falls to the least width-compatible Liberation Serif fallback tier). This is an environment limitation of the WebKit-via-Docker test harness, not a defect in the delivered HTML/CSS — real Safari/Chrome devices commonly have these fonts. Recorded in WINDOWS.md (entry 4) and flagged here for the owner's end-of-phase judgement per human_verify_mode: end-of-phase, consistent with 01-02's own precedent (WebKit prePaintObserved caveat) for the same measurement instrument."

duration: 2h35min
completed: 2026-09-16
status: complete
---

# Phase 1 Plan 6: Final Home and Category Mockups Summary

**Rebuilt index.html end-to-end (final chrome, a typographic imageless lead, and a 33-card true reverse-chronological grid merging 22 real feed rows with every D-06/D-07 stress case) and added category.html (the D-01 masthead colour block on Business, an image-led lead, a 12-card business grid), plus the mobile-first chrome/lead/grid/block component CSS both pages share.**

## Performance

- **Duration:** ~2h35min (includes a substantial font-CLS environment investigation)
- **Started:** 2026-09-16 (continuing session, exact start not separately timestamped)
- **Completed:** 2026-09-16T18:58:00-06:00 (approx., Task 2 commit `8d86a7f`)
- **Tasks:** 2/2
- **Files modified:** 4 (1 created, 3 modified — see Files Created/Modified)

## Accomplishments

- Final home mockup: masthead (wordmark, tagline, dateline), an eight-segment canonical-order
  spectrum rule (the brand signature, open item 2), a category nav that switches from a 2-column
  to a 4- then 8-column grid with no scroll container (open item 3), and a footer with the
  attribution line
- The typographic lead (D-09) — the real `no-image` corpus row, no image slot reserved — and a
  33-card grid that merges 22 real `feed` rows with every D-06/D-07 pathological case in one true
  reverse-chronological order (D-12), including the D-07 worst case (Spanish + the corpus's
  longest-in-corpus headline, synthetically padded) drawn rather than imagined
- Business category mockup: the first full-scale rendering of a D-01 colour block — deliberately
  the category 01-03's own C-01 review already flagged as amber/olive-risk — plus an image-led
  lead (D-09) and a 12-card business grid
- Root-caused and thoroughly documented a real WebKit font-swap CLS failure to a missing-font
  gap in the pinned Docker test image (confirmed via `fc-list`), rather than accepting it at
  face value as a design defect or silently weakening the test threshold

## Task Commits

1. **Task 1: Final chrome and the home page — typographic lead plus the full stress grid (D-01, D-06, D-07, D-09, D-12, D-15)** - `d65fd43` (feat)
2. **Task 2: Category page — the business masthead block and the image-led lead (D-01, D-09, open item 4)** - `8d86a7f` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/mockups/index.html` - Full rewrite: final chrome, typographic lead, 33-card merged
  reverse-chronological grid (feed + all D-06/D-07 stress cases + D-15 Spanish cards)
- `design/mockups/category.html` - New: chrome (wordmark as link, `aria-current` on Business),
  the D-01 masthead colour block, image-led lead, 12-card business grid
- `design/mockups/style.css` - New chrome/lead/grid/frame component CSS; `[data-block]`
  repointed to `--cat-block`; every `[data-category="<slug>"]` rule extended with `--cat-block`
- `design/mockups/fonts/subset-manifest.json` (and the four `.woff2` files, byte-identical) -
  rebuilt via `npm run fonts:build` to cover both pages' full glyph set

## Decisions Made

See `key-decisions` in frontmatter: the stress-set/D-12 merge-and-sort rule, the deliberate
multi-use of two real corpus rows across several stress cases, the worst-case summary text
source, and using Business's real story count (2,933) rather than 01-CONTEXT.md's illustrative
"3,803" example (which is actually Crime's count).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `data-block-back` attribute name collided with the plan's own `grep -c "data-block"` acceptance check**
- **Found during:** Task 2, running the literal acceptance-criteria greps
- **Issue:** `grep -c "data-block" design/mockups/category.html` counted 2, not the required 1, because the attribute name `data-block-back` contains "data-block" as a substring, matching a second line.
- **Fix:** Renamed the attribute to `data-back-link` (in both `category.html` and `style.css`) — same purpose, no visual or structural change.
- **Files modified:** design/mockups/category.html, design/mockups/style.css
- **Verification:** `grep -c "data-block" design/mockups/category.html` now returns 1.
- **Committed in:** `8d86a7f`

**2. [Rule 1 - Bug] Image-led lead's CSS Grid auto-placement scattered ungrouped sibling elements**
- **Found during:** Task 2, visual review via a real Chromium screenshot at 1280px (this project's verification standard: drive a real browser, don't infer from markup)
- **Issue:** `[data-lead-variant="image"] { display: grid; grid-template-columns: minmax(0, 40%) 1fr; }` applied to six ungrouped siblings (frame, stripe, category-name, h2, summary, byline) auto-placed them row-by-row into the 2-column template instead of producing "image left, full text column right" — the image appeared alone in the top-left cell with the stripe beside it and the headline pushed out of view.
- **Fix:** Wrapped the five text elements in a `[data-lead-body]` `<div>` in the markup and switched the 80em rule to `display: flex` with the frame at `flex: 0 0 40%` and the body at `flex: 1 1 auto`.
- **Files modified:** design/mockups/category.html, design/mockups/style.css
- **Verification:** Re-screenshotted at 1280px — image and text now sit correctly side by side.
- **Committed in:** `8d86a7f`

---

**Total deviations:** 2 auto-fixed (2 bugs). No scope creep — both fixes stayed inside this plan's own files.
**Impact on plan:** Both were necessary for the plan's own literal acceptance criteria (the grep collision) and for actual visual correctness (the grid layout), caught before commit rather than shipped broken.

## Issues Encountered

- **WebKit font-swap CLS gate fails on the content-heavy pages, root-caused to a missing-font
  gap in the pinned test environment — investigated thoroughly, not dismissed or worked around.**
  `npm run verify:phase-1 -- --pages=index,category --criteria=1,2,5` reports criterion 5 as
  FAIL in WebKit only (`geometryScore` up to 0.76 on index @320px against a 0.005 threshold;
  category @320px passes at ~0.003, category @1280px fails at ~0.014). Chromium passes cleanly
  on every combination (worst case 0.0035). Debugged with a standalone before/after
  `snapshotLayout`/`layoutShiftScore` diff (see `design/tests/support/geometry.ts`), which
  showed genuine cumulative reflow as headlines and summaries rewrap between the fallback face
  and the real face. Root cause confirmed directly: `fc-list` inside the pinned
  `mcr.microsoft.com/playwright:v1.63.0-noble` Docker image shows **only the Liberation font
  family installed** — no Georgia, no Noto Serif — so this specific WebKit test environment
  falls all the way to the least width-compatible fallback tier (the Times-New-Roman-metric
  face, aliased to `local('Liberation Serif')`), which reflows much more than Georgia or Noto
  Serif would against Instrument Serif / Source Serif 4's wider proportions. Real Safari and
  Chrome on real desktop/mobile devices commonly ship Georgia and/or Noto Serif, so this
  specific severity is unlikely to reproduce for actual users. No dependency was added and no
  test threshold was weakened to work around it (per this project's explicit "do not weaken a
  gate to make pages pass" rule) — recorded in `.planning/WINDOWS.md` (entry 4) and flagged
  here, non-blocking per `human_verify_mode: end-of-phase`, extending 01-02's own precedent for
  this exact measurement instrument (the documented `prePaintObserved` WebKit caveat).

## Known Stubs

- **`spanish-real` and `spanish-synthetic`/`worst-case` all reuse the same corpus row
  (`f63b5753`) already shown as `longest-headline`**, per 01-04-SUMMARY.md's own finding that
  this row is simultaneously the corpus's single longest headline and the chosen real
  Spanish-headline case. Intentional stress-testing per the plan's literal instructions, not a
  bug — flagged here so it reads as deliberate on review rather than as a duplication defect.
- **`worst-case`'s summary text is sourced from `spanish-stress.json`'s `card-summary.es_real`**,
  which the plan names as "the longest-summary es_real" — but that fixture component's
  underlying text is actually the Ukraine/`longest-headline` row's summary, not the Lake
  Powell/`longest-summary` row's summary (`e8d5c5fe`), despite its own `esRealSource` note
  claiming the latter. This is a pre-existing inconsistency in 01-04's already-committed,
  self-check-passed fixture file, outside this plan's file list to correct. The text used is
  still real, unaltered corpus content (not fabricated), so it does not affect D-06/D-15's own
  correctness goals for this plan — flagged for awareness, not treated as a blocker.
- **The WebKit font-swap CLS finding** (see Issues Encountered) is the primary Known Stub for
  this plan and is tracked in `.planning/WINDOWS.md` (entry 4).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `design/mockups/index.html` and `category.html` now share a byte-identical head `<script>`
  and the same chrome markup contract — 01-07 (article, changelog, contact) copies both
  verbatim, per the plan's own instruction.
- `[data-frame]`, `[data-lead-body]`, and the `--cat-block` token extension are all established
  and ready for 01-07 to reuse without modification.
- Carry forward to the phase's `01-APPROVAL.md`: the WebKit font-swap CLS finding above
  (WINDOWS.md entry 4), alongside the pre-existing entries 1–3 from 01-02/01-03 (WebKit
  `prePaintObserved`, the politics photo substitution, and the Sports/Business amber-olive
  block risk — the latter now visible at full block scale on `category.html` for the first
  time).
- No blockers for 01-07.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-16*

## Self-Check: PASSED

All files listed above verified present on disk; both task commits (`d65fd43`, `8d86a7f`)
verified present in git history.

# 2026-09-16 - Category Page: Business Masthead Block and Image-Led Lead

**Keywords:** [FEATURE] [STYLING] [UI] [DESIGN] [ACCESSIBILITY]
**Session:** Evening, Duration (~30 min, following Task 1's font-CLS investigation)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1858_category-page-masthead-block-image-lead.md`

## What Changed

- File: `design/mockups/category.html` (new)
  - Same chrome as `index.html`: wordmark is now `<p data-wordmark><a href="index.html">`
    instead of the page `h1` (the masthead's own `h1` is the page's single `h1`), and the
    Business nav link carries `aria-current="page"`
  - Category masthead (D-01, open item 4): a full-bleed `header[data-block][data-category=
    "business"]` with the page `h1` ("Business"), the real description from `stress-set.json`'s
    `categories` case ("Economy, development, jobs"), the real public story count formatted
    with a thousands separator ("2,933 stories"), and an "All sections" link back to
    `index.html` — deliberately the riskiest block at full size, since 01-03's C-01 review
    already flagged Business's 94.5° block hue as amber/olive
  - Image-led lead (D-09): the real `category-lead` row (`902d018b`, "Amazon Raises Starting
    Pay...") as `data-lead-variant="image"`, eager/`fetchpriority="high"`, wrapped so the image
    and text form a two-column layout at 80em
  - A 12-card business grid (`category-feed` minus the lead's own uuid), reverse-chronological
- File: `design/mockups/style.css`
  - `header[data-block]` masthead layout, `[data-category-description]`, `[data-story-count]`,
    `[data-back-link]`
  - `[data-lead-variant="image"]`: block layout at base (image above, text below); a `flex`
    row at 80em (`[data-lead-body]` at `flex: 1 1 auto`, the frame at `flex: 0 0 40%`)
- File: `design/mockups/fonts/*.woff2` — rebuilt via `npm run fonts:build`; byte-identical to
  Task 1's output (category.html's glyphs were already covered by index.html's superset)

## Why

D-01's colour-tiering decision reserves darkened blocks for exactly two contexts: the category
masthead and the article category header. This is the first of those two, and the plan
deliberately picked Business — the category 01-03's own C-01 review already flagged as sitting
in the 40-100° amber/olive band — so the owner sees the riskiest block at full production
scale rather than a safer category standing in for it.

## Issues Encountered

- **CSS Grid auto-placement scattered the image-led lead's children instead of producing a
  two-column split.** The first implementation put `[data-frame]`, `[data-stripe]`, `[data-
  category-name]`, `h2`, `[data-summary]`, and `[data-byline]` as six ungrouped siblings under
  `display: grid; grid-template-columns: minmax(0, 40%) 1fr` at 80em. Grid's default row-major
  auto-placement filled the two columns one item at a time in DOM order, putting the stripe
  next to the image and the headline in a third row — not the intended "image left, full text
  column right" layout. Caught with a real Chromium screenshot at 1280px before committing
  (this project's verification standard: drive a real browser, don't infer from markup).
  Fixed by wrapping the five text elements in a `[data-lead-body]` `<div>` and switching the
  80em rule to `display: flex` with the frame at a fixed 40% flex-basis and the body flexing
  to fill the rest — verified visually against a second screenshot before commit.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the plan's inline Node contract check (`category contract ok`), `grep`-based
  acceptance criteria (`data-block` count is 0 on `index.html` and 1 on `category.html`, the
  head `<script>` is byte-identical on both pages), `npm run check:contrast` (PASS, unchanged),
  and the scoped Playwright runner across both pages in Chromium and WebKit (structure/`@c1`
  and grid/font-family/`@c5` PASS in both engines on both pages; font-swap-CLS/`@c5` PASS in
  Chromium, FAIL in WebKit on both pages — the same pinned-Docker-image font gap documented in
  Task 1's changelog entry, re-confirmed here at both 320px and 1280px for `category.html`).
  Drove a real Chromium browser at 390px and 1280px to confirm the masthead block and the
  image-led lead's two-column split render correctly.
- What wasn't tested: the owner's own C-01 judgement on whether the Business block "reads as
  brown" (reserved for end-of-phase approval, per `human_verify_mode: end-of-phase`).
- Edge cases: the category-lead's own row is excluded from the grid by uuid so it isn't shown
  twice.

## Next Steps

- [ ] Task 1's WebKit font-CLS finding and this task's confirmation that it also affects
      `category.html` both carry into the phase's combined `01-APPROVAL.md`
- [ ] 01-07 (article/changelog/contact pages) copies this same chrome and reuses `[data-frame]`/
      `[data-lead-body]` patterns as needed

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - second of the phase's two mockup pages; the masthead block is the first
full-scale rendering of the Business C-01 risk flagged in 01-03.

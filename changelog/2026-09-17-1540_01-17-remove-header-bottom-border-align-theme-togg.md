# 2026-09-17 - Header rule removed, theme toggle aligned to the content column (revision request 1, defect 10)

**Keywords:** [FEATURE] [BUG_FIX] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1540_01-17-remove-header-bottom-border-align-theme-togg.md`

## What Changed

- File: `design/mockups/style.css`
  - `header:not([data-block])` no longer carries `border-bottom: var(--rule-thick) solid var(--ink)` — the eight-segment `[data-spectrum]` colour stripe now closes the masthead on its own (revision request 1: "i love the color stripe at the top ... maybe remove the black/white bottom border in header").
  - `[data-theme-toggle]` is now `display: block; width: fit-content`, and a new `>=80em` rule (`margin-inline-start: calc(max(0px, (100% - 80rem) / 2) + var(--space-4))`) aligns its left edge with the header/nav content column instead of the raw viewport edge (defect 10 — at 1920px the toggle previously sat at the far left of the window).
- File: `design/tests/chrome.spec.ts` (new)
  - `@c1`-tagged checks across all five pages, both themes, and 320/768/1280/1920px: header `border-bottom-width` computes to `0px`; `[data-spectrum]`'s top sits within 1px of the header's bottom edge with 8 non-zero-height segments; the toggle's left edge sits within 1px of the header's content-box left and its right edge stays within the nav's content-box right; at 1920px the toggle's left edge is checked against the *actual* computed 80rem pixel value (see Issues Encountered — the fluid `--step-0` root font-size means 80rem is not a fixed 1280px).
  - A per-page tab-order test: skip link, then (on category/article/changelog/contact only) the pre-existing `[data-wordmark] a` "915 TLDR" home link, then the eight nav sections in canonical order (uppercase, matching `text-transform: uppercase`), then the toggle.
- Regenerated evidence: `design/evidence/keyboard/*.png` (contact sheets) and `design/evidence/pages/*.jpg` (full-page screenshots), reflecting the header/toggle visual change. `design/evidence/keyboard/tab-order-{chromium,webkit}.json` content is unchanged from HEAD.

## Why

Closes two owner-facing items from `01-APPROVAL.md`: revision request 1 (remove the header's black/white bottom rule, keep the colour stripe) and defect 10 (the theme toggle sitting outside the page column at wide viewports). Both are pure CSS fixes with no markup or tab-order changes, verified in both Chromium and WebKit at four widths and two themes rather than by reading the stylesheet.

## Issues Encountered

- **Plan premise correction (verified before reporting):** the plan's own acceptance check for the 1920px case used a literal `(1920 - 1280) / 2` (assuming `1rem = 16px`). Root's font-size is the fluid token `--step-0: clamp(1rem, 0.96rem + 0.2vw, 1.125rem)`, which resolves to 18px at 1920px viewport width (clamped to its 1.125rem ceiling) — so 80rem is actually 1440px there, not 1280px. Reproduced directly (a standalone Playwright script measuring `getComputedStyle(document.documentElement).fontSize` and the header's real rendered width) before changing the test: `chrome.spec.ts` now reads the root's own computed font-size and derives the 80rem pixel value from it, rather than assuming 16px/rem. The underlying CSS (`calc((100% - 80rem) / 2 + var(--space-4))`) was already correct — only the test's hard-coded expectation was wrong.
- **Tab-order test premise correction (verified before reporting):** the plan's must-have truth states the tab order is "the skip link, the eight section links..., the theme toggle" with no other stop. Direct reproduction showed `index.html`'s masthead is a plain `<h1>915 TLDR</h1>` (no link, since it's already the homepage) but `category.html`/`article.html`/`changelog.html`/`contact.html` all use `<p data-wordmark><a href="index.html">915 TLDR</a></p>` — a real, pre-existing, keyboard-focusable link between the skip link and the nav, unrelated to and untouched by this plan's CSS changes. `chrome.spec.ts`'s tab-order test now detects `[data-wordmark] a`'s presence per page and includes it in the expected sequence only where it's real, rather than asserting a sequence that doesn't match four of the five pages' actual, working markup.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/chrome.spec.ts` (90/90 passing, both engines); `node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (both engines, full run); `node design/scripts/pw.mjs --project=chromium design/tests/structure.spec.ts` (96/96, sanity check for regressions); the node one-liner confirming the masthead rule has no `border-bottom` and the CSS carries the `(100% - 80rem) / 2` calc.
- What wasn't tested: Tasks 2 and 3 of this plan (external-link new-tab behaviour, Spanish cue) — not yet started.

## Next Steps

- [ ] Task 2: mark external links `target="_blank"` with an accessible "opens in a new tab" cue
- [ ] Task 3: prove new-tab activation is safe in both engines; localise the cue in Spanish

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — visual chrome fix + toggle position fix, verified in both engines at 4 widths x 2 themes

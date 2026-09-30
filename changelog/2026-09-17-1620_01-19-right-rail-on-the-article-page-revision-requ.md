# 2026-09-17 - Right rail on the article page (revision request 3, Task 1)

**Keywords:** [FEATURE] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1620_01-19-right-rail-on-the-article-page-revision-requ.md`

## What Changed

- File: `design/mockups/article.html`
  - `main` carries `data-layout="with-rail"`; the story `article` carries `data-reading-column`.
  - The below-article "More in Community" grid moved (not duplicated) into a new `aside[data-rail][aria-label="More stories"]`, alongside a new "Latest" grid holding the five most recent real `cases.feed` rows (excluding the article itself and the three community rows), in reverse-chronological order — the exact set and order computed during planning and re-verified against `design/mockups/index.html`'s own reverse-chronological grid.
  - Every rail item is a compact card (`data-card-variant="compact"`): stripe, category name, `h3 > a`, byline — no frame, no summary.
- File: `design/mockups/style.css`
  - New token `--rail-width: 20rem`.
  - The component-CSS header comment now names three layout breakpoints (48em, 64em, 80em).
  - `body[data-page="article"] main > article`'s base rule drops its `max-width: var(--measure)` — the reading column now spans the full page column below 64em (article part of revision request 7); the bottom margin is unchanged.
  - New `@media (min-width: 64em)` block: `main[data-layout="with-rail"]` becomes a two-column grid (`minmax(0, 1fr)` + `var(--rail-width)`, `column-gap: var(--space-7)`), the reading column is capped at `--measure` and left-anchored (no `margin: auto` — the same font-swap-CLS house rule 01-07 established for a `ch`-unit column), and the rail occupies the second column.
  - `[data-rail] [data-grid]` forces a single column at every width (two-selector specificity beats the 48em/80em `[data-grid]` column rules regardless of source order); `[data-rail] [data-grid-heading]` and `[data-card-variant="compact"] h3` size the rail's own headings and card titles down from the full grid scale.
- File: `design/tests/layout.spec.ts` (new, `@c1`)
  - Geometry proof at 320/768/1024/1280/1920px (plus 1280px dark), both engines: no horizontal page scroll at any width; at >=1024px the rail sits >=24px right of the reading column, ends within 1px of the main content-box's right edge, starts within 2px of the reading column's top, and the article body's first paragraph is no wider than the computed `--measure` value; at 320/768px the reading column and the rail (stacked below it) both span the main content box edge-to-edge within 1px.

## Why

Closes revision request 3 from `01-APPROVAL.md`: "article page. too much whitespace. how do other news websites handle this?!" — at 1280px the article was a single 68ch column beside a large empty right side. The direction agreed in session was a right rail at >=1024px ("Latest" / "More in {category}"), no ads, body measure kept near 70ch. Also closes the article half of revision request 7 ("article and changelog[...] needs to span the full width" at 768px). This plan introduces the reusable layout primitive (`[data-layout="with-rail"]`, `[data-reading-column]`, `[data-rail]`) that 01-20 applies to the changelog page.

## Issues Encountered

None — the rail sections are `[data-grid]` with `[data-card]` children, so the pre-existing zero-script/JS-disabled-parity structural checks already cover them with no new test needed for that part.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/layout.spec.ts` (24/24, both engines); `MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (20/20 x2, both engines); `MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (8/8 x2, both engines); the plan's node markup contract check (`main[data-layout="with-rail"]`, `aside[data-rail]`, exactly 8 `data-card-variant="compact"` cards) — all pass.
- What wasn't tested: Task 2 (content-integrity tests for the rail, the Spanish rail heading, and `spanish-overflow.spec.ts` coverage) — that is this plan's second task, not yet run.

## Next Steps

- [ ] Task 2: rail content integrity tests, Spanish rail heading, `spanish-overflow.spec.ts` for article
- [ ] Write 01-19-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — closes a desktop-whitespace revision request and introduces a shared layout primitive the next plan reuses, verified in both engines across five widths and two themes

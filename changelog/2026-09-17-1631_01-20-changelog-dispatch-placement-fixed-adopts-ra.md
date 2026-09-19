# 2026-09-17 - Changelog dispatch placement fixed, adopts rail layout (revision request 4, Task 1)

**Keywords:** [FEATURE] [BUG_FIX] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1631_01-20-changelog-dispatch-placement-fixed-adopts-ra.md`

## What Changed

- File: `design/mockups/style.css`
  - The `@media (min-width: 80em)` `[data-dispatch]` rule (`display:grid; grid-template-columns:12rem 1fr`) is replaced with explicit `grid-template-areas: "date title" "date body"`. The old rule had only two column tracks for three items (date, title, body); CSS auto-placement put the date in column 1/row 1, the title in column 2/row 1, then wrapped the body into column 1/row 2 — under the date, squeezed to a 12rem width instead of sitting beside the date at the title's own measure. Explicit named areas assign each item its own place regardless of source order.
  - `[data-lede]` and `[data-dispatch]` drop their base `max-width: var(--measure)` — full width below 64em (changelog part of revision request 7); `[data-dispatch] h2` and `[data-dispatch-body]` carry `--measure` individually inside the 80em block instead.
  - New rule inside the existing `@media (min-width: 64em)` rail block: `body[data-page="changelog"] [data-layout="with-rail"] > [data-reading-column] { max-width: none; }` — changelog's reading column holds h1, the lede and eight dispatches (not one article), so capping the column itself would be a redundant second width limit on top of each dispatch's own `--measure`.
- File: `design/mockups/changelog.html`
  - `main` carries `data-layout="with-rail"`; h1, the lede and all eight dispatches are wrapped in `div[data-reading-column]`, content and order byte-identical to before.
  - The trailing "Latest Stories" heading and grid become `aside[data-rail][aria-label="Latest stories"]` holding the same three cards, converted to the compact variant (01-19 format: stripe, category name, `h3 > a`, byline — no frame, no summary), so no list element enters `main` (D-11 still holds).
- File: `design/tests/layout.spec.ts` (new `describe('layout: changelog')`, `@c1`)
  - Per-dispatch geometry at 320/768/1024/1280/1920px (plus 1280px dark), both engines: body left edge within 1px of title left edge at every width; at >=80em (1280px) the date column ends left of the title and body extends >=100px past the date's right edge; below 80em the date stacks directly above the title; dispatches never overlap vertically; no horizontal page scroll.
  - Plus the same reading-column-full-width-at-320/768 and rail-beside-column-at->=1024 checks 01-19 established for article.

## Why

Closes revision request 4 from `01-APPROVAL.md`: the owner's screenshot showed each dispatch's body text squeezed into the narrow date column while the title sat alone on the right, labelled "768px". A scripted before-fix reproduction (both engines, 320/768/1024/1280/1920px) showed the squeeze is real but confined to >=80em (1280px, 1920px) — 320/768/1024px were never affected, since the offending rule only applies from `min-width: 80em`. The owner's width label was off; the underlying bug (silent CSS grid auto-placement) was real and is now fixed explicitly. Also closes the changelog half of revision request 7 (full width at 768px) by adopting 01-19's `[data-layout="with-rail"]` primitive.

## Issues Encountered

None — the reproduction confirmed the plan's own premise (auto-placement, not a font or measure bug) before any CSS was touched.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/layout.spec.ts` (30/30, both engines, article + changelog); `MOCKUP_PAGES=changelog node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (25/25 x2, both engines, including the D-11 no-list and dispatch-fidelity checks); `MOCKUP_PAGES=changelog node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (20/20 x2, both engines); `MOCKUP_PAGES=changelog node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (7/7 x2, both engines); the plan's own node check for the explicit `grid-template-areas` shape — all pass.
- What wasn't tested: Task 2 (contact page centring, spacing bug) — this plan's second task, not yet run.

## Next Steps

- [ ] Task 2: contact page centred column, spacing fix, layout tests
- [ ] Write 01-20-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — fixes a real layout bug the owner reported and closes the changelog half of the full-width-at-768px request, both proven in real browser geometry at five widths, two engines

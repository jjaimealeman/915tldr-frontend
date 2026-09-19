# 2026-09-17 - Contact page centred, full width at tablet, spacing bug fixed (revision request 5, Task 2)

**Keywords:** [FEATURE] [BUG_FIX] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1635_01-20-contact-page-centred-full-width-at-tablet-sp.md`

## What Changed

- File: `design/mockups/contact.html`
  - h1, the intro paragraph, the direct-links paragraph and the form are wrapped in a new `div[data-contact-column]`, content and order byte-identical to before; the "Latest Stories" heading and grid stay after the wrapper, unchanged.
- File: `design/mockups/style.css`
  - New token `--column-narrow: 44rem`.
  - `[data-contact-intro]` and `form[data-contact-form]` drop their base `max-width: var(--measure)` — full width below 64em (contact part of revision request 7).
  - New rule inside the existing `@media (min-width: 64em)` block: `[data-contact-column] { max-width: var(--column-narrow); margin-inline: auto; }`. The width is a fixed `rem` value on purpose — the 01-07 house rule against centring a `ch`/`em`-relative container with `margin: auto` (font-swap CLS risk) does not apply to a `rem` value, which has no font-relative component.
  - New rule, unscoped to any media query (applies at every width): `[data-contact-column] + [data-grid-heading] { margin-top: var(--space-7); }` — `[data-grid-heading]` previously had no top margin of its own, so the "Send message" button touched "Latest Stories" directly.
- File: `design/tests/layout.spec.ts` (new `describe('layout: contact')`, `@c1`)
  - At every width (320/768/1024/1280/1920px, plus 1280px dark), both engines: the gap between the Send-message button's bottom and the "Latest Stories" heading's top is `>= 32px`; no horizontal page scroll.
  - At `>=1024px`: the column is centred within 1px (`|leftGap - rightGap| <= 1`) and its width is at most `44rem` (in resolved pixels) `+ 1`.
  - At 320/768px: the column's left and right edges are within 1px of the main content box.

## Why

Closes revision request 5 from `01-APPROVAL.md`: "looks great, should be centerer?" plus the owner's screenshot showing the "Send message" button touching "Latest Stories" directly below it. Also closes the contact half of revision request 7 (full width at 768px).

## Issues Encountered

None.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/layout.spec.ts` (48/48, both engines, article + changelog + contact); `MOCKUP_PAGES=contact node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (8/8 x2, both engines, including the contact-form test); `MOCKUP_PAGES=contact node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (25/25 x2, both engines); `MOCKUP_PAGES=contact node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (20/20 x2, both engines); `MOCKUP_PAGES=contact,changelog node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` (12/12 x2, both engines) — all pass. A scripted measurement (both engines, both themes, 1280/1920px) confirmed real centring: column width matches 44rem exactly at the resolved root font-size (788.5px @1280px, 792.0px @1920px, both engines), left gap equals right gap exactly in every combination, and the button-to-heading gap measures ~54px (well above the 32px floor).
- What wasn't tested: a literal human eyeball of the rendered page — the owner's own visual sign-off on "does the centred column look right" is unautomatable by design (the plan's own human-check); the scripted measurement above is offered as the strongest available substitute evidence.

## Next Steps

- [ ] Owner: view contact.html at 1280 and 1920, both themes, and confirm the column reads as centred with comfortable space before "Latest Stories" (see measured geometry above)
- [ ] Write 01-20-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — closes the contact centring and spacing-bug revision requests, plus the contact half of the 768px full-width request, verified in real browser geometry at five widths, two engines

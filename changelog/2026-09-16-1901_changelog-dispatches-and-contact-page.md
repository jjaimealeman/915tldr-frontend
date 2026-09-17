# 2026-09-16 - Changelog as Dated Dispatches, and the Contact Page

**Keywords:** [FEATURE] [STYLING] [UI] [DESIGN] [ACCESSIBILITY]
**Session:** Evening, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1901_changelog-dispatches-and-contact-page.md`

## What Changed

- File: `design/mockups/changelog.html`
  - D-11: all 8 public changelog entries render as dated dispatches — date as
    editorial furniture, title in Instrument Serif, items as flowing prose in
    `data-item` spans, no `<ul>`/`<ol>`/`<li>` anywhere in `main`
    (verified: 8 dispatches, 27 items, both counts match `changelog.json`)
  - Items without their own closing punctuation get `data-item-sentence`,
    with the trailing full stop added by CSS (`[data-item-sentence]::after`)
    so the verbatim item text in the markup is never touched
  - Longest title (`We're Back — Full Restoration Underway`) carries
    `data-i18n="changelog-title"`; longest item (the Crime/Politics entry)
    carries `data-i18n="changelog-prose"`
- File: `design/mockups/contact.html`
  - First-person intro per PRD §11 (who built 915 TLDR and why), plus a
    non-form contact route to jjaimealeman.com and 915website.com
  - Fully keyboard-operable form: `method="post"`, no `action`, every
    control has a `label for`, all three required fields say "(required)"
    in their label text, each field has its own empty `data-field-error`
    referenced via `aria-describedby`, and a form-level note (also wired via
    `aria-describedby`) states the mockup does not send anything
- File: `design/mockups/style.css`
  - Dispatch layout (date column beside title/body from 80em, stacked at
    base) and the `[data-item-sentence]::after` punctuation rule
  - Form-control styling: full-width base, `--rule-strong` borders, 44px
    minimum target height, `[aria-invalid="true"]` and `data-field-error`
    error states from tokens only

## Why

Task 2 of `01-07-PLAN.md`. D-11 required verifying the real changelog data
before designing against DSGN-07's literal wording — the public `items[]`
are already complete sentences, so the actual work was presentation
(dispatches, not a bulleted list), not rewriting. The contact page completes
the five-page mockup set criterion 1 requires.

## Issues Encountered

Caught and fixed before commit, via real-browser screenshot review (not
markup inspection): an inline-link `margin-right` in the contact intro and a
`margin-left` between changelog item spans both produced visibly doubled
whitespace once combined with the literal space character already in the
markup. Removed both declarations rather than adjusting the source text —
the spacing bug was in the CSS, not the content.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `npm run check:contrast` (PASS); `npm run verify:phase-1 -- --pages=changelog,contact --criteria=1,2` (PASS, both engines); inline Node contract check (`changelog+contact contract ok` — dispatch count matches entries, item count matches total items, no list elements in main, form has no action); acceptance-criteria greps (`data-item-sentence` present, `autocomplete=` count 2, `(required)` count 3); real Chromium screenshots at 1280px in light and dark themes for both pages, plus a full-page changelog screenshot
- What wasn't tested: WebKit-specific visual check and the font-swap/CLS criterion (deferred to Task 3's full five-page pass); the owner's own keyboard-walk pass (criterion 3, end-of-phase)
- Edge cases: same-date entries (two 2026-07-20, three 2025-12-22) stay as separate `article` elements each with their own `time`; the single-item "Contact Form Fix" entry renders as one paragraph with one span

## Next Steps

- [ ] Task 3: rebuild the font subset against the final five-page copy and prove criteria 1, 2, 5 across all pages

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - two new pages completing the five-page design-sketch set, no production code

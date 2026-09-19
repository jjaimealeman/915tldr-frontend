# 2026-09-17 - External links open in a new tab with an accessible cue (revision request 6)

**Keywords:** [FEATURE] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1543_01-17-external-links-open-in-a-new-tab-with-an-acc.md`

## What Changed

- File: `design/mockups/article.html`
  - Both external anchors (the AI-disclosure link and the "Original reporting: KTSM" attribution link, both to ktsm.com) gain `target="_blank"`, an inline `aria-hidden="true" focusable="false"` `<svg data-new-tab-icon>` (box-with-outgoing-arrow, `stroke="currentColor"`, no colour literal), and a `<span data-new-tab-cue data-visually-hidden>` reading `" (opens in a new tab)"` so the link's accessible name ends with the cue. The first anchor's cue also carries `data-i18n="new-tab-cue"` — the injection hook Task 3's Spanish calibration uses.
- File: `design/mockups/contact.html`
  - Both external anchors (jjaimealeman.com, 915website.com) gain the same `target="_blank"` + icon + cue treatment.
- File: `design/mockups/style.css`
  - New `[data-visually-hidden]` utility (`position: absolute; width/height: 1px; clip-path: inset(50%); ...` — the standard sr-only pattern that keeps text in the accessible-name computation while painting nothing) and `[data-new-tab-icon]` (`display: inline-block; width/height: 0.75em`). Neither rule introduces a colour literal; `pnpm run check:contrast` still exits 0.
- File: `design/tests/content.spec.ts`
  - The external-link test now resolves every `a[href]` on the page against `window.location.origin` rather than pattern-matching `href^="http"`. External (different-origin) links must carry `target="_blank"`, `rel` including `noopener`, an `https:` scheme, exactly one `[data-new-tab-cue]` and one `[data-new-tab-icon][aria-hidden="true"]`, and (checked via Playwright's `toHaveAccessibleName`) an accessible name ending in `(opens in a new tab)`. Same-origin links must carry neither `target` nor a cue.
- Regenerated evidence for article/contact: keyboard contact sheets and full-page screenshots; `tab-order-{chromium,webkit}.json` diffs show only the expected accessible-name change (e.g. `"KTSM"` → `"KTSM (opens in a new tab)"`) with no new or reordered focus stops — the icon/cue add no separate tab stop.

## Why

Closes revision request 6 from `01-APPROVAL.md`: "all external links should be in a new tab. links to 915website.com jjaimealeman.com external news sources, etc. (Use `target="_blank" rel="noopener"` with an accessible 'opens in a new tab' cue.)" The cue is a real visually-hidden text node (not a title attribute or aria-label override), so it's announced by assistive tech and still contributes to the link's normal accessible-name computation, per the CLAUDE.md verification standard that a visual-only icon does not count as an accessible cue.

## Issues Encountered

None — CSS-only cue/icon plus markup attributes, no architectural changes.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run check:contrast` (PASS, no new colour literal); `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (74/74, both engines, all five pages); `MOCKUP_PAGES=article,contact node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (26/26, both engines — focus rings unclipped with the icon+hidden span inside the link); `MOCKUP_PAGES=article,contact node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (regression sanity check, 78/78); the plan's own node one-liner confirming target/rel/cue-count on every external anchor.
- What wasn't tested: activation behaviour (Enter/click actually opening a new tab with `window.opener === null`, and no request leaving 127.0.0.1) — that's Task 3.

## Next Steps

- [ ] Task 3: prove new-tab activation is safe in both engines (Enter and click, `window.opener` null, no real network egress); localise the cue in Spanish and prove it doesn't move the link's box

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — accessibility/UX fix on two pages, verified in both engines

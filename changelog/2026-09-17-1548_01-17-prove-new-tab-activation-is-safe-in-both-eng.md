# 2026-09-17 - New-tab activation proven safe in both engines; the cue is localised into Spanish

**Keywords:** [FEATURE] [TESTING] [SECURITY]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1548_01-17-prove-new-tab-activation-is-safe-in-both-eng.md`

## What Changed

- File: `design/tests/keyboard-walk.spec.ts`
  - New test per page with external links (article, contact): "external links open a new tab with no opener, by Enter and by click". A `context.route` stub — not `page.route`, which never sees a popup's first request — fulfils every non-127.0.0.1 request with a 200 `text/html` stub body, so a popup's navigation to the real external host (ktsm.com, jjaimealeman.com, 915website.com) never reaches the network. For the first external link, both an Enter keypress and a real `locator.click()` open a new page whose `window.opener` is `null` and whose body text is the stub (proving no real fetch happened, not just that a header was sent); the original page's URL is asserted unchanged after both activations.
- File: `design/tests/support/i18n.ts`
  - `SpanishComponent` gains an optional `assistiveOnly?: boolean`, documented as excluding a component from the layout-overflow loop when its injection hook is a visually-hidden element with no meaningful rendered geometry.
- File: `design/fixtures/spanish-stress.json`
  - New `new-tab-cue` component: `page: "article"`, `assistiveOnly: true`, `en: " (opens in a new tab)"`, `es_real: " (se abre en una pestaña nueva)"` (translated in-session, no paid API, per the A-05 precedent). Calibrated via `node design/scripts/calibrate-spanish.mjs --only=new-tab-cue`: `widthRatio` 1.2808, `hi` 1.3319 (both above the required 1.24 floor). `git diff` of the fixture adds only this one entry.
- File: `design/tests/spanish-overflow.spec.ts`
  - `componentsForPage` now excludes `assistiveOnly` components from the layout loop (mirrors the existing `DRAWN_ONLY_COMPONENT_IDS` exclusion pattern).
  - New test (article only): "assistive-only Spanish cue lands in the accessible name without moving the link". For both `es_real` and `es_synthetic`, records the external anchor's bounding box, injects the text via `injectText`, then asserts (a) the anchor's accessible name ends with the injected text (compared via a `toHaveAccessibleName` regex built from the NFC-normalised, whitespace-collapsed injected string) and (b) the anchor's bounding box (x/y/width/height) is unchanged within 0.5px.

## Why

Closes the remaining risk in revision request 6: a `target="_blank"` link without `rel="noopener"` lets the opened page script its opener (reverse tabnabbing, T-01-50 in this plan's threat register), and a test suite that only checks markup for `rel=noopener` (as Task 2's static check does) never actually proves activation is safe — the previous task's markup-only check is meaningfully different from confirming, in a real browser, that `window.opener` really is `null` after a real Enter press and a real click. The context-level route stub also closes T-01-52 (test egress): proving the popup shows stub content, not the real KTSM/jjaimealeman.com/915website.com page, is stronger evidence than merely asserting "no request left 127.0.0.1" would be on its own.

## Issues Encountered

None — both engines detected `window.opener === null` and rendered the stub body cleanly on the first attempt; no misdiagnosis or fix-then-refix cycle here.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `MOCKUP_PAGES=article,contact node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (30/30, both engines, full file — not just the new test — to check for regressions); `MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` (14/14, both engines); a full (all five pages) `spanish-overflow.spec.ts` run (64/64, both engines) confirming the `assistiveOnly` exclusion didn't disturb any other page/component; the plan's own node one-liner confirming the fixture's `assistiveOnly`, `es_real` diacritic content, and `calibration.widthRatio >= 1.24`.
- What wasn't tested: real Safari/Georgia (a pre-existing, separately tracked open item from Phase 1's own approval packet, unrelated to this plan).

## Next Steps

- [ ] Write 01-17-SUMMARY.md, update STATE.md/ROADMAP.md, close out the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — closes a real security-relevant gap (reverse tabnabbing), verified behaviourally in both engines

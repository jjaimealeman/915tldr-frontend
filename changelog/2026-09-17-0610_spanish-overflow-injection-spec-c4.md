# 2026-09-17 - feat(01-09): Spanish +25% overflow, drawn-Spanish, null-summary and 320px/200%-zoom reflow spec (D-07, D-15, criterion 4)

**Keywords:** [TESTING] [FEATURE] [BUG_FIX] [I18N]
**Session:** Late evening, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0610_spanish-overflow-injection-spec-c4.md`

## What Changed

- File: `design/tests/support/i18n.ts` (new)
  - `loadSpanishFixture()`, `injectText()`, `overflowReport()`, `widthRatio()` — real-browser DOM injection and overflow/clip measurement against the real production CSS, never a synthetic stand-in
  - `overflowReport` checks visibility, text fidelity, horizontal/vertical overflow, ellipsis, `-webkit-line-clamp`, past-viewport, document-level overflow, plus `textLength`/`containerTight` used to make the "container grows, never clips" check meaningful only where it actually is
- File: `design/tests/spanish-overflow.spec.ts` (new)
  - `@c4`-tagged: injected real+synthetic Spanish per fixture component per page per width (320/768/1280), drawn-Spanish (already-`lang="es"` markup) checks, null-summary reserved-space check, and 320px/200%-zoom (`ZOOM_200`, a fresh browser context at 640×400 @2x) content-preservation checks
  - `widthRatio` assertion against each component's calibrated `[1.24, hi+0.01]` band; `utf8ByteRatio` attached as a test annotation alongside the measured width ratio

## Why

D-15 requires the +25% Spanish case to be actually exercised in a real browser, not assumed; D-07 requires 200% zoom to be verified by driving a real browser rather than drawing a static file for it. This plan (01-09) owns criteria 4 and 5's full-scope verification.

## Issues Encountered

Three real bugs were found and fixed while building the instrument itself (not in the mockups — all 31 tests pass in both Chromium and WebKit with the shipped markup/CSS unchanged):
1. `textMatches` initially compared case-sensitively against `innerText`, which reflects `text-transform: uppercase` on nav labels (a legitimate presentation behaviour) — false-failed on every nav-category-label injection. Fixed with locale-aware case folding.
2. The injected-text marker was originally set on the whole `[data-i18n]` element, so `textMatches` false-failed on `ai-disclosure` (a paragraph with its own leading text plus a nested, untouched `<a>` link) once the injection algorithm correctly targeted only the ambiguous subtree's fallback-to-whole-element behavior was reasoned through — resolved by marking the actually-overwritten node and comparing only that node's own rendered text.
3. The literal "container height must be ≥ baseline" check produced false failures for hooks where the *pre-existing* on-page text is legitimately longer than a given fixture component's stress text (a known, already-documented 01-04 fixture/DOM content-topic mismatch on `card-summary`, out of this plan's file scope to correct), and for hooks whose only matching "container" in the selector list is a broad landmark (`main`) rather than a tight content wrapper, making a raw height comparison measure whole-page reflow noise rather than this element's own box. Both are investigation-confirmed non-bugs (`vClipped`/`hOverflow`/etc. all pass cleanly in every case); the check is now scoped to tight containers and only enforced when the injected text is not itself shorter than what it replaced.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=chromium|webkit design/tests/spanish-overflow.spec.ts` — 31/31 pass in both engines; `npm run verify:phase-1 -- --criteria=4` — PASS both engines; `npm run check:contrast` and `npm run test:unit` unaffected (still green).
- What wasn't tested: the plan's own `<human-check>` (owner driving a real browser at 1280px and pressing Ctrl+= to 200% zoom) — flagged for the end-of-phase approval packet per `human_verify_mode: end-of-phase`.
- Edge cases: real vs. synthetic Spanish per component, drawn-in-markup Spanish (the `spanish-real`/`spanish-synthetic`/`worst-case` cards), a card with no summary at all, and a nested-link paragraph (`ai-disclosure`) whose injection must not destroy the link.

## Next Steps

- [ ] Task 2 of this plan: full font-swap matrix (D-08, criterion 5) and the WINDOWS.md entries 1/4/5/6 investigation
- [ ] Owner's own 200% zoom browser pass (D-07 human-check) for the approval packet

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM

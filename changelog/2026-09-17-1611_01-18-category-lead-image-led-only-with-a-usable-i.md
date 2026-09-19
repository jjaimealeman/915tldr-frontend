# 2026-09-17 - Category lead is image-led only with a usable image (revision request 2, Task 3)

**Keywords:** [FEATURE] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1611_01-18-category-lead-image-led-only-with-a-usable-i.md`

## What Changed

- File: `design/mockups/style.css`
  - Two new defensive rules, both scoped to `[data-lead-variant="image"]:not(:has([data-frame] img))` — an image-led lead whose frame has ended up with no `<img>` inside it (no usable image found at build time for that row, or the `<img>` element failed/was removed): `[data-frame] { display: none; }` collapses the reserved image slot, and inside the `min-width: 80em` block, the lead itself gets `display: block` so the flex-row layout (image column + gap) reverts to the single-column typographic lead rather than leaving an empty 40% column. Both carry a comment citing D-09 and revision request 2. The existing `[data-lead-variant="type"]` rules are untouched — this is a defensive net on top of the build-time contract (only rows with a usable image should ever render `data-lead-variant="image"` with a real `<img>`), so it also holds if that contract is ever violated or a loaded image is later removed.
- File: `design/tests/content.spec.ts`
  - New "lead contract" test for index and category: every `[data-lead]` is either `data-lead-variant="image"` (exactly one `[data-frame] > img` with `width`/`height`/`alt` present, `src` equal to the matching fixture case's `chosen.image_url`, that case's `chosen.imageCheck.headStatus` equal to 200, and the `src` never appearing in any `rejected[].url`) or `data-lead-variant="type"` (no `[data-frame]` descendant at all). Passes on index (type — the no-image stress row) and category (image — the fixture's real KTSM-sourced chosen image).
- File: `design/tests/lead-fallback.spec.ts` (new, 24 tests, all tagged `@c1`)
  - Four geometry checks at 320/768/1280px × light/dark, both engines: (a) baseline image lead — frame and `[data-lead-body]` never overlap, the body's right edge stays inside the lead, no horizontal scroll; (b) a simulated build output for a row with no usable image (frame removed in-page, `data-lead-variant` set to `"type"`) — the headline sits flush against the lead's content-box left edge, no descendant keeps a phantom 3:2-ratio empty box, no horizontal scroll; (c) an image-led lead with the `<img>` removed but the frame kept — the frame computes `display: none` and the headline is flush left; (d) a genuinely broken image (`src` rewritten to a same-origin URL that 404s from the real local server, waited on the `error` event) — the frame's box and the body's left edge match a pre-mutation baseline within 0.5px, proving a resolved failure causes no further reflow.

## Why

Closes revision request 2 from `01-APPROVAL.md`: "Category lead needs an image, always, or a layout that survives without one... as long as it always has an image on the side, so the layout doesn't break." D-09 already states leads are "image-led when a usable image exists, falling back to a purely typographic treatment" — this task enforces that rule specifically on the category page (which has always rendered `data-lead-variant="image"` unconditionally since 01-06) and adds the regression coverage that was missing.

## Issues Encountered

None — the CSS-only defensive rule plus a new spec file, no architectural changes. Tests block third-party requests (the lead's real image is hotlinked to `ktsm.com`), so even the "baseline" scenario in `lead-fallback.spec.ts` never paints a real photo in this environment; the geometry checks are content-agnostic by design, and the human-check step (real network) is where the owner sees the actual loaded photo.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/lead-fallback.spec.ts` (24/24, both engines); `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (44/44, both engines, including the new lead-contract test); `pnpm run check:contrast` (PASS, no new colour literal); `node design/scripts/pw.mjs --project=all design/tests/chrome.spec.ts` and `keyboard-walk.spec.ts` as regression sanity checks (45/45 and 33/33, both engines, unaffected by this task's CSS).
- What wasn't tested (human-check, per the plan): opening category.html with real network access at 1280px in both themes, to confirm the lead shows the loaded KTSM photo on the side with a comfortable, uncramped text column.

## Next Steps

- [ ] Owner: view category.html (real network) at 1280px in light and dark, per this plan's human-check step
- [ ] Write 01-18-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — closes a layout-integrity revision request, verified in both engines across three widths and two themes

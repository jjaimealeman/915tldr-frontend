# 2026-09-17 - Criterion 4 on the Fully Loaded Homepage, Spanish for Load More Controls (Task 2)

**Keywords:** [FEATURE] [TESTING] [ACCESSIBILITY] [BUG_FIX]
**Session:** Evening
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1717_01-22-criterion-4-on-the-fully-loaded-homepage-spa.md`

## What Changed

- File: `design/tests/spanish-overflow.spec.ts`
  - `expandFeed(page)` added on `index` before every check that reads grid cards: the injected real+synthetic Spanish loop, the drawn-Spanish test (all three widths), `every [data-summary] has non-empty text`, `no-summary card has no [data-summary]…`, and all three contexts (1280px baseline, 320px resize, 200% zoom) of the reflow check.
  - The injected-loop's per-component body (inject → `overflowReport` → assert visible/no-overflow/no-clip/container-growth/width-ratio) was extracted into `checkComponentSpanishOverflow` — no threshold or assertion changed, only the call site — because `load-more-button` needs to be checked in a different moment than the rest: once the feed is fully expanded, the button legitimately hides itself (01-21's own "nothing left to load" behavior — the same mechanism `load-more.spec.ts`'s failure-path test already relies on), so a Spanish-overflow check against the fully-expanded page would always fail `must render` regardless of the injected text, for a reason that has nothing to do with overflow. `load-more-button` is now checked once immediately after `openPage` (guaranteed visible — index always has 27 more cards behind it on a fresh load), then every other component is checked after `expandFeed`.
- File: `design/mockups/index.html` — `p[data-load-more-status][role="status"]` gained `data-i18n="load-more-status"`. This is static markup outside the `<!-- feed:start -->`/`<!-- feed:end -->` markers `build-feed.mjs` rewrites, confirmed to survive a `pnpm run feed:build` rebuild byte-for-byte (`sha256sum -c` against a fresh `design/.cache/feed-build.sha` passes on the following run).
- File: `design/fixtures/spanish-stress.json` — two new components, both `page: "index"`, `fontRole: "body"`, `fontStyle: "normal"`:
  - `load-more-button`: en "Load more stories" / es_real "Cargar más noticias" (widthRatio 1.3313, hi 1.3510 after `calibrate-spanish.mjs`'s small-size widening).
  - `load-more-status`: en "6 more stories loaded." / es_real "Se cargaron 6 noticias más." (widthRatio 1.3232, hi 1.3496).
  - Calibrated via `node design/scripts/calibrate-spanish.mjs --only=load-more-button,load-more-status`; the diff touches only these two entries.

## Why

01-21's Load More controls (the button and its status line) were never added to the Spanish-stress fixture, so criterion 4 (D-07/D-15) never exercised them in Spanish. Separately, 01-21 moving 27 of 33 home cards behind the button meant 4 of `spanish-overflow.spec.ts`'s existing index checks stopped finding their target element on first load (`card-headline`, `card-summary`, `card-summary-thin`, and the `no-summary` stress card) — a documented, pre-announced gap this plan exists to close (see 01-21-SUMMARY.md's "Known Coverage Gap" section, reproduced there as exactly 4 failures/engine, 28/32 pass).

## Issues Encountered

- **[Rule 1 — test-authoring bug, found during implementation]** Calling `expandFeed` before the injected-Spanish loop (as a literal reading of the plan's action step would do) breaks `load-more-button`: once the feed is fully expanded the button is hidden by design, so `overflowReport(...).visible` is always `false` for it there, regardless of the injected text — a false failure with nothing to do with Spanish overflow. Root-caused by re-running the test with `MOCKUP_PAGES=index` before assuming it was a real defect. Fixed by extracting the shared per-component check into `checkComponentSpanishOverflow` and calling it for `load-more-button` before `expandFeed`, and for every other component after — no threshold, ratio ceiling, or assertion changed.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` (7/7, both engines); `pnpm run verify:phase-1 --pages=index --criteria=4` (PASS, both engines); the fixture-widthRatio/expandFeed node sanity check from this task's own `<verify>` block.
- What wasn't tested yet: the font glyph-coverage check (criterion 5) — Task 3 of this same plan.

## Next Steps

- [ ] Task 3: `build-fonts.mjs`'s glyph crawl expands the feed before collecting page text, so no load-more-revealed character (including the two new Spanish control strings) falls outside the font subset

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — restores criterion 4 (D-07/D-15) coverage of the homepage's Spanish/long-content stress cards and adds Spanish translations for the new Load More controls

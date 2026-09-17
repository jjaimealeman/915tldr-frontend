# 2026-09-17 - Glyph Coverage for Feed Text and Status Messages (Task 3)

**Keywords:** [FEATURE] [TESTING] [PERFORMANCE]
**Session:** Evening
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1721_01-22-glyph-coverage-for-feed-text-and-status-mess.md`

## What Changed

- File: `design/scripts/build-fonts.mjs`
  - `crawlGlyphSet` clicks `[data-load-more]` to exhaustion on `index.html` (`expandFeedInPage`, a narrow inline mirror of `design/tests/support/feed.ts`'s `expandFeed` — kept independent so the build script has no dependency on the test suite) before collecting page text, so the 27 load-more cards' rendered glyphs are crawled, not just the first 6.
  - Also collects every string value out of `design/fixtures/home-feed.json` and every `design/mockups/feed/page-<n>.json` — covers the load-more cards' headline/summary/byline text against what a future feed rebuild would regenerate, independent of what happened to render live during the crawl.
  - Also collects the load-more failure/exhaustion status literals ("Couldn't load more stories. Try again.", the two "N more stories loaded…" strings) read directly out of the shared head script (`extractStatusLiterals`) — these only render conditionally (one on a network failure a plain crawl never triggers; the exhaustion message only after every page has loaded), so reading them from source guarantees coverage regardless of which code paths actually fire during any given crawl.
- File: `design/tests/font-cls.spec.ts` — the per-page glyph-coverage test (`every rendered character on <page>… is in the font subset`) now expands the feed on `index` before `collectPageText`, and adds every string from `home-feed.json`/`feed/page-<n>.json` (via a new `collectFeedJsonText` helper) to the checked text alongside the live page text and the Spanish fixture strings.

## Why

Closes the last of the three gate types named in this plan's threat register (T-01-62): a font subset built by crawling only the initial 6-card render would never see the 27 load-more cards' or the status controls' characters, so a rare glyph appearing only behind the button could silently fall outside the subset and render as tofu/a fallback the moment a reader clicked Load More — a defect no gate would catch, since the coverage test itself only checked the same unexpanded page.

## Issues Encountered

None — the subset manifest was already complete. Every mockup page (including the pre-01-21 33-card index) had already been crawled by an earlier plan before the grid was trimmed to 6 cards behind a button, so no new code point was introduced by expanding the crawl scope back out; `pnpm run fonts:build` produced a byte-identical `subset-manifest.json` (verified via `git diff --stat`, zero changes) and unchanged `.woff2` files.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `pnpm run fonts:build` (subset-manifest.json unchanged); `node design/scripts/pw.mjs --project=all design/tests/font-cls.spec.ts --grep "every rendered character"` (5/5, both engines); `pnpm run verify:phase-1 --pages=index --criteria=5` (PASS, both engines + node checks); this task's own node sanity check confirming the crawl references both the feed directory and `data-load-more`.
- Per-file subset byte ceilings (01-14, D-GAP-A shrink) still hold: `SourceSerif4-Roman.woff2` 44,156B (ceiling 60,000B), `SourceSerif4-Italic.woff2` 20,216B (ceiling 30,000B) — both unchanged from before this task.

## Next Steps

None — this was the last task of 01-22, which closes revision request 8's gap-closure work. Next: SUMMARY.md, STATE.md, ROADMAP.md.

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW — no visible/behavioral change; closes a latent glyph-coverage gap that would only have surfaced if a future feed rebuild introduced a character not already in the pre-01-21 crawl

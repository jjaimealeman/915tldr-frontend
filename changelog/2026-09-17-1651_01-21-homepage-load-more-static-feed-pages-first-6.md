# 2026-09-17 - Homepage load more: static feed pages, first 6 cards on load (Task 1)

**Keywords:** [FEATURE] [TESTING] [SECURITY] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1651_01-21-homepage-load-more-static-feed-pages-first-6.md`

## What Changed

- File: `design/scripts/build-feed.mjs` (new)
  - `--extract` mode (one-time): loads index.html in a real Chromium page, reads every `[data-grid] > article[data-card]` in DOM order, self-verifies `renderCardHtml` against each live card's `outerHTML` (whitespace- and comment-normalised), then writes `design/fixtures/home-feed.json`.
  - Default (build) mode: validates the fixture, writes the first 6 cards between `<!-- feed:start -->`/`<!-- feed:end -->` markers in `index.html`, writes `design/mockups/feed/page-2..N.json` for the rest in chunks of 6, and keeps the load-more button's `data-next` in sync. Idempotent — a second run is byte-identical.
  - Exports `renderCardHtml`, `validateCard`, `validateFeedPage`, `INITIAL_CARDS = 6`, `PAGE_SIZE = 6`.
- File: `design/fixtures/home-feed.json` (new) — the ordered source of truth for the 33 home cards, extracted from the pre-migration grid.
- Files: `design/mockups/feed/page-2.json` … `page-6.json` (new) — `{ schema: 1, page, next, cards }`, chaining `page-2 → page-3 → … → page-6 → null`. 27 cards total (6+6+6+6+3).
- File: `design/mockups/index.html`
  - The `[data-grid]` section now holds only the first 6 cards (2 rows at 1280px, 3 rows at 768px, 6 stacked at 320px), inside `feed:start`/`feed:end` markers.
  - New `<div data-feed-controls>` after the grid: a `button[data-load-more][data-next="feed/page-2.json"][hidden]` and a `p[data-load-more-status][role="status"]`.
  - The shared head script gained a load-more routine (same IIFE, same `DOMContentLoaded` listener pattern as the theme toggle): unhides the button when present; on activation, resolves `data-next` against `location.href`, requires same-origin and a `/feed/page-<n>.json` path, fetches with `credentials: "same-origin"`, validates the response shape, and appends cards built with `createElement`/`setAttribute`/`textContent` only (`href` is always the literal `"article.html"`; an image `src` is only set after an `https://` prefix check). Focus moves to the first new card's `h3 a`; the status paragraph announces the count; a routed failure leaves the grid unchanged and returns focus to the button.
- File: `design/mockups/style.css`
  - Minimal `[data-load-more] { font: inherit; }` so the button inherits body line-height instead of the UA stylesheet's `normal` (structure.spec.ts's line-height guard) — full button/status styling is 01-21 Task 3.
- File: `design/tests/load-more.spec.ts` (new, `@c1 @c3`)
  - Initial-load row/column counts at 1280/768/320px, button visible.
  - Parity: `renderCardHtml` output for the first loaded card matches the live DOM element after clicking, byte-for-byte modulo inter-tag whitespace.
  - Keyboard: focus the button, press Enter, 12 cards render, focus lands on the 7th card's `h3 a` with a visible ring, status reads "6 more stories loaded.".
  - Network: every fetch/xhr request after activation is a same-origin GET to `feed/page-2.json`.
  - Failure path: a routed 500 leaves 6 cards, keeps focus on the button, shows the error status.

## Why

Closes the vertical slice of revision request 8 from `01-APPROVAL.md`: "i counted 10+ rows with 3 columns each. first load is overwhelming... maybe a (load more) button at the bottom? start with maybe 2-3 rows?!" — plus the article-page part of the 768px-full-width request was already closed in 01-19. The button, not auto-scroll, keeps the footer reachable by keyboard, and reading only pre-built static JSON keeps the project's core value (zero D1 reads on the public request path) intact for this one interactive island.

## Issues Encountered

- `--extract`'s self-verification initially flagged 3 mismatches (junk-image, no-summary, spanish-real stress cards) — all three carry hand-written HTML documentation comments in the original markup explaining the fixture row's provenance. Fixed by stripping HTML comments before the whitespace-normalised comparison; comments are not part of a card's data model and `renderCardHtml` never reproduces them.
- The parity test initially failed on inter-tag whitespace: the client-built DOM (`createElement`/`appendChild`, no whitespace text nodes) differs textually from `renderCardHtml`'s multi-line indented string (pure source formatting) even after both render the same structure. Fixed by also collapsing `>\s+<` to `><` before comparing.
- Adding the button surfaced a pre-existing structural guard (structure.spec.ts's "every element with a direct text node has a computed line-height that is not 'normal'") failing on the new `<button>`, since it has no CSS yet. Fixed with a one-line `font: inherit;` rule now; Task 3 replaces it with the full button/status design.
- Known, expected gap (not fixed in this plan — deferred to 01-22 per 01-21-PLAN.md's own objective): with only the first 6 cards server-rendered, 3 of `spanish-overflow.spec.ts`'s index components (`card-headline`, `card-summary`, `card-summary-thin` — Spanish/long-content stress cards that now sit behind the button) and its `no-summary` stress-card check no longer find their target element on initial load. Verified as a real, direct consequence of preserving true reverse-chronological order (not something this plan can avoid without violating that must-have) — see this plan's own SUMMARY for the exact list.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/load-more.spec.ts` (5/5, both engines); `node design/scripts/pw.mjs --project=chromium design/tests/structure.spec.ts` (95/95 excluding the expected cross-page head-script-drift failure, fixed in Task 2); `pnpm run check:contrast` (PASS); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=chromium design/tests/content.spec.ts` (25/25); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=chromium design/tests/lead-fallback.spec.ts design/tests/chrome.spec.ts` (33/33); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=chromium design/tests/font-cls.spec.ts` (4/4); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=chromium design/tests/keyboard-walk.spec.ts` (7/7, existing tests, before Task 3's own new load-more-specific keyboard tests).
- What wasn't tested: cross-page checks (structure.spec.ts's head-script drift guard, verify-phase-1's C1 feed checks) — deliberately deferred to Task 2, which copies the shared script to the other four pages and extends the runner.

## Next Steps

- [ ] Task 2: copy the updated head script to category/article/changelog/contact.html; extend verify-phase-1.mjs's C1 node check to validate the feed (schema, chain, parity, single fetch)
- [ ] Task 3: full `[data-load-more]`/`[data-load-more-status]` styling; keyboard-walk coverage of the load-more interaction itself; `feed:build` pnpm script; 01-CONTEXT.md D-05/D-12 amendments

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — delivers the core interactive slice of revision request 8 (static, zero-D1-read load more), proven in both engines with focus management and a real failure path

# 2026-09-17 - Feed-Expansion Helper, Content + Structure Coverage of the Full 33-Card Feed (Task 1)

**Keywords:** [FEATURE] [TESTING] [ACCESSIBILITY]
**Session:** Evening
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1712_01-22-feed-expansion-helper-content-structure-cove.md`

## What Changed

- File: `design/tests/support/feed.ts` (new)
  - `expandFeed(page): Promise<number>` — while `[data-load-more]` is visible, reads the current `[data-grid] [data-card]` count, clicks the button with a real `locator.click()` (never a synthetic click), then waits (`page.waitForFunction`) until the count increases before looping again. Throws after 20 iterations rather than spinning forever. A page with no button (or one that never appears) is a no-op: returns the unchanged count immediately.
- File: `design/tests/content.spec.ts`
  - `expandFeed(page)` called on `index` right after `openPage` in every existing test that inspects grid cards: category-name/`--cat-none` rules, uuid-fidelity against `stress-set.json`, external-link hygiene (including the `junk-image` stress card, now behind the button), markdown-rendering, and the `[data-grid] time[datetime]` non-increasing order check.
  - New test: `index: fully loaded feed equals home-feed.json, with every stress case` — after full expansion, asserts the card count equals `home-feed.json`'s 33, the rendered `(uuid, stress)` sequence equals the fixture's order with no duplicate pair, all 12 D-06/D-07 stress markers are present (the static lead counts for `no-image`), every `[lang="es"]` card's headline and summary text equal the fixture strings after NFC normalisation and whitespace collapse, no card has an empty `<h3>` or empty `[data-summary]`, and every loaded card's `<h3>` `textContent` equals the fixture headline exactly (no `&amp;` or other escaped text leaking through).
- File: `design/tests/structure.spec.ts`
  - The pure-HTML grid check (`[data-grid] is populated pure HTML with no inline handlers`) now also expands the feed on `index` and re-asserts zero `<script>` elements and zero `on*` attributes across every grid once all 33 cards (client-built via `createElement`/`setAttribute`/`textContent`, per T-01-58) are present — not just the first 6 server-rendered ones. The JS-disabled parity test is untouched (still asserts exactly 6 cards, button hidden, on the initial render).

## Why

01-21 moved 27 of the home feed's 33 cards — including most D-06/D-07 stress cases (longest headline, no-summary, uncategorized, both Spanish cards, the D-07 worst case) — behind a Load More button to keep the initial page load from being overwhelming (revision request 8). Left unfixed, every content-integrity check that used to see the whole feed by just opening the page would silently start checking a smaller slice of it and still report PASS — the same "a gate that stops seeing content still reports PASS" failure mode this plan's own threat register names (T-01-62). Task 1 closes that gap for the content- and structure-integrity checks by driving the same real click a reader would, then re-running (and, for the new stress-coverage test, extending) the existing checks against the fully loaded page.

## Issues Encountered

None — all tests passed on the first full run in both engines (26/26 `content.spec.ts`, 20/20 `structure.spec.ts`).

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (26/26, both engines, including the new stress-coverage test); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (20/20, both engines, including the expanded-grid re-assertion).
- What wasn't tested yet: `spanish-overflow.spec.ts` (criterion 4) and the font glyph-coverage check (criterion 5) — Tasks 2 and 3 of this same plan.

## Next Steps

- [ ] Task 2: `expandFeed` in `spanish-overflow.spec.ts` on every index check that reads grid cards; Spanish translations for the Load More button/status controls
- [ ] Task 3: `build-fonts.mjs`'s glyph crawl expands the feed before collecting page text, so no load-more-revealed character falls outside the font subset

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — restores content-integrity and pure-HTML-grid coverage of 27 of the homepage's 33 cards that would otherwise pass unchecked behind the Load More button

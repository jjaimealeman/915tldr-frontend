# 2026-09-17 - Load-more styling, keyboard coverage, feed:build script, D-05/D-12 amendments (Task 3)

**Keywords:** [FEATURE] [TESTING] [STYLING] [ACCESSIBILITY] [DOCUMENTATION]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1659_01-21-load-more-styling-keyboard-coverage-feed-bui.md`

## What Changed

- File: `design/mockups/style.css`
  - `[data-feed-controls] { margin-top: var(--space-6); }`.
  - `[data-load-more]` grows from Task 1's minimal `font: inherit;` to the full button treatment: 44px minimum target, `--ink`/transparent/`--rule-strong` border, matching the theme toggle's visual language. `[hidden]` hides it; `[aria-disabled="true"]` shows a progress cursor.
  - `[data-load-more-status] { margin: var(--space-3) 0 0; color: var(--ink-muted); font-size: var(--step--1); }`, with `:empty` collapsing its own top margin. No colour literal in either rule; `pnpm run check:contrast` still PASS.
- File: `design/tests/keyboard-walk.spec.ts`
  - New tests titled "load more is keyboard-operable and keeps the footer reachable: `<theme>` @`<width>`px @c3" for index × light/dark × 320/1280px, both engines: Tab from the 6th card's link reaches the button, Tab again reaches the footer's first link; Enter loads 6 more (12 total), focus lands on the 7th card's link with a clean `inspectFocus` ring (visible ≥2px, unclipped, in-viewport, unobscured, contrast ≥3); Shift+Tab returns to the 6th card's link; focusing the button directly and pressing Space loads 6 more again (18 total) with focus on the 13th card's link; repeated activation (with a `waitForFunction` settle between presses, so a second Enter is never ignored by the button's own `aria-disabled` guard while a fetch is in flight) empties the feed, hides the button, and leaves the status containing "That's everything for now."; Tab from the final card's link then reaches the footer's first link.
  - The existing full keyboard-walk (enumerate/Tab/inspect every focusable, including the now-present load-more button) is unchanged and still passes.
- File: `package.json` — `"feed:build": "node design/scripts/build-feed.mjs"`.
- File: `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` — records D-05 (mockups directory gains `feed/`), D-12 (home grid: lead + first 6 cards, then load-more pages of 6, same reverse-chronological order), and flags the DSGN-06/ROADMAP criterion-5 wording ("pure HTML with zero JavaScript") for rewording at the phase transition, since the server-rendered grid stays script-free but PRD §5.5's load-more island is a separate, named interaction.
- Files: `design/evidence/keyboard/index-*-{chromium,webkit}.png`, `tab-order-{chromium,webkit}.json` — regenerated for index (both engines): the load-more button now appears as a real tab stop between the 6th card and the footer.

## Why

Closes Task 3, the last piece of the revision-request-8 vertical slice: load-more now looks like part of the design system, is fully keyboard-operable with a proven, clean focus ring in both engines, and its design consequences (an eighth mockup directory entry, the amended homepage-grid rule, the DSGN-06 wording caveat) are written down for the phase transition rather than left implicit.

## Issues Encountered

- The new keyboard test's step (d) originally assumed a single `Tab` press reached the button — true only when the grid still held 6 cards. After step (b) loads 6 more (12 total), 6 more card links sit between the focused 6th-card link and the button. Fixed by focusing the button directly (`locator.focus()`) rather than hard-coding a Tab-press count; the main exhaustive-walk test already covers the literal Tab-by-Tab order, so this test verifies activation/focus/count outcomes, not every intermediate hop.
- The "repeat until hidden" loop initially fired a fresh Enter press on every iteration with no wait between them. A second Enter pressed while the previous page's `fetch` was still in flight was silently ignored by the click handler's own `aria-disabled` guard (by design — the double-activation denial-of-service mitigation, T-01-61), so the loop spun until the 30s test timeout with no further loads ever happening. Fixed by waiting (`page.waitForFunction`) for `aria-disabled` to clear (or the button to hide) after each press before the next iteration.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `pnpm run check:contrast` (PASS); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` (11/11 x2, both engines, including 4 new load-more tests x2 and the unchanged full walk); `pnpm run feed:build` followed by `sha256sum -c` against the pre-Task-3 hashes (unchanged — idempotent); the CONTEXT.md amendment-section grep check from this plan's own verify step (D-05, D-12, `feed/`, DSGN-06 all present) — exits 0.
- What wasn't tested: a human eyeball of the button/status styling in a real browser at real network speed — the scripted focus/contrast checks above are the strongest available automated substitute.

## Next Steps

- [ ] Write 01-21-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan
- [ ] 01-22 restores full content/Spanish/glyph suite coverage of the now-paginated 33-card feed (deferred by this plan's own objective)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — completes revision request 8's vertical slice: styling, full keyboard coverage in both engines, and the phase-transition paper trail

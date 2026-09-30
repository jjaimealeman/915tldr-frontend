# 2026-09-17 - Root-Caused the Chrome Font-Swap Finding: It's a Real Chrome Bug, Not Our Test

**Keywords:** [DOCUMENTATION] [TESTING] [PERFORMANCE] [BUG_FIX]
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1146_01-13-diagnose-chromium-font-display-optional-swap.md`

## What Changed

- `.planning/WINDOWS.md`: added entry 10, confirming and refining entry 9. Swept
  the font-hold delay from 50ms to 3000ms against the real home page in
  Chrome — the outcome never changed, which rules out a timing race in our
  test. Also proved the font *does* finish loading and get applied even when
  scrolled to the very top of the page, where our own layout-shift score
  correctly reads zero: the shift is real and happens everywhere, but only
  counts as visible when it lands inside what's actually on screen.
- `.planning/STATE.md`: replaced the stale blocker note with a pointer to the
  new finding and recorded that Plan 13's remaining two tasks stay paused.
- `.planning/phases/01-design-sketch-editorial-identity/01-13-SUMMARY.md`:
  written, documenting the diagnosis method and evidence for this
  continuation (no code changed — this was a diagnose-only pass per an
  explicit owner instruction).

## Why

The previous session switched fonts to `font-display: optional` specifically
to stop Chrome from popping a late-loading font into text a visitor is
already reading. Chrome's own test run said it still happened on the home
page, but only when scrolled partway down — which smelled like it could be a
quirk of how our own test measures things, not a real browser bug. Before
accepting or rejecting that finding, it needed to be proven one way or the
other with a repeatable, isolated reproduction.

## Issues Encountered

Grew a throwaway reproduction step by step from a single sentence (which
never showed the bug) up to the real home page (which does), instead of
guessing. The scroll position turned out to be a red herring: the font
really does swap in late everywhere on the page in Chrome, regardless of
where you're scrolled to or how long the font took to arrive — it's just
that our shift score, correctly, only counts what a visitor would actually
see move on their screen, and at the very top of the page nothing that
moves happens to be in view.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a purpose-built, uncommitted reproduction script run
  against the real `index.html`, sweeping the font-arrival delay from
  50ms-3000ms and scroll position (top vs. mid-page), in Chrome.
- What wasn't tested: Safari/WebKit was not re-tested here — the prior
  session already showed it does not have this problem, and this pass only
  needed to explain Chrome's behavior.

## Next Steps

- [ ] Owner decision on font-display strategy now that `optional` is
      confirmed not to fully solve this in Chrome, then resume Plan 13
      Tasks 2-3

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - planning/diagnosis record only, no code changed

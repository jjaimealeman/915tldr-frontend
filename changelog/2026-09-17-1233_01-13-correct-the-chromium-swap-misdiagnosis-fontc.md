# 2026-09-17 - Fixed the Real Bugs Behind the Chrome Font-Swap Scare, Reversing Yesterday's Diagnosis

**Keywords:** [BUG_FIX] [TESTING] [PERFORMANCE] [CONFIG]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1233_01-13-correct-the-chromium-swap-misdiagnosis-fontc.md`

## What Changed

- `design/scripts/pw.mjs`: Chrome (when run directly on this machine, not
  inside the WebKit Docker container) now launches with its font search
  pointed at an empty, project-only folder instead of this computer's real
  font folder.
- `design/mockups/style.css`: the dark-mode toggle button now reserves its
  own space on the page from the start, instead of taking up zero space
  until JavaScript reveals it.
- `.planning/WINDOWS.md`: entries 9 and 10 (my own prior write-up claiming
  this was unfixable Chrome behavior) marked fixed and corrected; two new
  entries record what was actually wrong and how it was fixed.

## Why

The last entry logged here said the new font-loading strategy didn't
actually work in Chrome — that late-arriving fonts kept popping in over
already-rendered text no matter what. Someone else ran an independent test
that contradicted that finding directly, so it needed re-checking with a
sharper tool (a direct "what font is actually drawn on screen right now"
check, not just a status flag) instead of trusting the earlier write-up.

That re-check found two real, ordinary bugs, neither of which is a Chrome
limitation:

1. This development machine happens to have this project's own font names
   ("Instrument Serif", "Source Serif 4") already installed as personal
   fonts, left over from earlier design work. Chrome getting confused by a
   same-named font sitting on the machine is not something a visitor's
   browser would ever hit — it was purely this computer's own clutter
   leaking into the test.
2. Separately, and with nothing to do with fonts at all: the dark-mode
   toggle button was invisible-and-zero-size until a script revealed it
   right after the page loaded, so the moment it appeared, everything below
   it on the page jumped down by the height of the button. A real, small,
   always-there layout shift that had simply never been measured this
   precisely before.

## Issues Encountered

Bisected the difference between "doesn't reproduce in a clean test" and
"reproduces on the real page" one variable at a time — page complexity,
font file identity, the specific font name, the browser's own font
matching — until the exact cause (the locally-installed collision) was
isolated to a two-line CSS change that reliably switched the bug on and
off.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `design/tests/font-cls.spec.ts` for `index.html`, run
  repeatedly (3+ consecutive full runs) against both Chrome and the WebKit
  Docker image, after each fix, confirming a clean, repeatable pass with no
  loosened thresholds.
- What wasn't tested: a real macOS/iOS Safari device remains an open item
  (unrelated, pre-existing — WINDOWS.md entry 1).

## Next Steps

- [ ] Resume 01-13 Tasks 2-3 now that the font-display strategy is confirmed
      working correctly in Chrome

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - fixes a real CLS bug and a test-environment contamination bug; corrects a prior incorrect finding in the project's own defect ledger

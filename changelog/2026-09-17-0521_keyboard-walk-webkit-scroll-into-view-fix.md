# 2026-09-17 - Scripted Keyboard Walk (D-14), and a Real WebKit Focus-Obscuring Bug It Caught

**Keywords:** [FEATURE] [TESTING] [ACCESSIBILITY] [BUG_FIX] [STYLING]
**Session:** Early morning, Duration (~35 min, continuation of an interrupted session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0521_keyboard-walk-webkit-scroll-into-view-fix.md`

## What Changed

- File: `design/tests/support/focus.ts` (new)
  - `enumerateFocusables(page)` — in-page enumeration of every reachable focusable element,
    filtering hidden ancestors and zero-rect elements, returning a stable tag+nth-of-type path
    and an accessible name (aria-label, else normalised innerText, else title)
  - `walkTabOrder(page, key)` — presses `key` up to focusable-count+5 times, recording the
    active element after each press, stopping on a repeated path or a fallback to `document.body`
  - `inspectFocus(page)` — per-fragment (not just bounding-rect) geometry via `getClientRects()`
    so a wrapped multi-line link is checked per rendered line, not against the empty gap in its
    envelope box; checks `overflow-x`/`overflow-y` separately (the shorthand reports mixed
    values as two words), `contain: paint/content/strict`, `clip-path`, the viewport edge,
    `elementFromPoint` obscuring, and ring-vs-background contrast
  - Ring/background colour resolution painted onto a 1x1 canvas over white and black backdrops
    rather than string-parsed, because this Chromium build serialises an `oklch()`-authored
    colour back out as `"oklch(...)"`, not `"rgb(...)"` — canvas compositing always resolves to
    concrete sRGB regardless of which serialisation the engine chose
  - `buildContactSheet(page, shots, caption, outPath)` — lays out per-stop crop screenshots as a
    captioned grid and saves one full-page PNG per page/theme/width/engine combination
- File: `design/tests/keyboard-walk.spec.ts` (new, tagged `@c3`)
  - For every page x theme x width: enumerates, walks with Tab, retries with Alt+Tab if Tab left
    any enumerated element unvisited (WebKit's tab-to-all-controls setting isn't assumed either
    way — detected), asserts full coverage and that the skip link is stop zero, then re-walks to
    inspect and screenshot every stop and merge the tab order into a per-engine JSON file
  - Operability tests: skip-link Enter moves focus into `main`; the theme toggle flips
    `data-theme`/`aria-pressed` on both Enter and Space; submitting the empty contact form via
    Enter does not navigate and reaches no host but 127.0.0.1
  - `waitForScrollToSettle` polls `window.scrollX`/`scrollY` until two consecutive reads agree,
    since this pinned WebKit build animates the browser's own scroll-into-view over ~150-250ms
    rather than jumping instantly
- File: `design/mockups/style.css`
  - Added `scroll-padding-block-end: 12rem` to `html`, with an inline comment recording why

## Why

D-14 exists because of a real prior failure: a focus ring clipped on two sides, "verified" by
grepping HTML and caught only by the owner's own pass. This plan proves criterion 3 by driving
real key presses in both engines and measuring ring geometry, clipping, obscuring and contrast
in the browser — never by inspecting CSS declarations alone.

This session picked up mid-Task-1 after a prior run was cut off by an API rate limit before any
commit. `focus.ts` and `keyboard-walk.spec.ts` existed on disk but were unreviewed and only
partially exercised (20 Chromium contact sheets plus 4 of 5 WebKit pages). Rather than trust the
partial WebKit output, both files were reviewed line-by-line against the plan's Task 1 spec
first (found correct — no changes needed), then the full 20-combination walk was re-run from
scratch in both engines so the evidence set would be complete and internally consistent, not a
patchwork of two different sessions.

## Issues Encountered

- **Real bug, caught by real key presses (WCAG 2.4.11 Focus Not Obscured):** the from-scratch
  WebKit run failed on `contact light @320px`, stop 15 — the message textarea (~174px tall) —
  with `ring is obscured`. Root cause, confirmed with a throwaway debug spec: WebKit's
  focus-triggered `scrollIntoView` treats a target as "sufficiently visible" as soon as any part
  of it clears the viewport edge, so a tall field scrolled up from below the fold can stop with
  most of its box — and its focus ring — still off-screen. Chromium scrolls until the whole
  target is contained; it does not have this behaviour. Confirmed by direct measurement: WebKit
  stopped at `scrollY: 388` with the element's bottom 138px past the viewport edge, even though
  `document.documentElement.scrollHeight` had 3198px of further scroll room available — this was
  WebKit choosing to stop short, not a document-height ceiling.
  - **Fix:** `scroll-padding-block-end: 12rem` on `html`, which reserves a bottom safe zone the
    browser must also clear before considering a scroll target visible. Verified empirically —
    100px and 160px were tested and found insufficient/marginal; 250px fully resolved it with
    112px to spare; 12rem (192px) was chosen as a value with comfortable margin over the tightest
    case measured, not the bare minimum.
  - **Not weakened:** the assertion itself (`obscured` must be `false`) was never relaxed; the
    fix is in the mockup CSS, per the plan's own rule for every failure.
- **Serial-mode cutoff on failure** (same pattern documented in 01-07-SUMMARY.md for
  `font-cls.spec.ts`): `test.describe.configure({ mode: 'serial' })` means the one WebKit
  failure aborted the remaining 14 tests in that run ("did not run"), not just the failing one.
  Confirmed clean by re-running the full 31-test file after the fix — all 31 passed in both
  engines in a single run each, so no isolated-rerun workaround was needed this time.

## Dependencies

No dependencies added. Uses `@playwright/test` and `node:fs`, both already installed.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=chromium design/tests/keyboard-walk.spec.ts`
  and the same with `--project=webkit` (Docker, Playwright 26.6) — both 31/31 green after the
  fix, in single full runs with no isolated reruns required. The plan's own evidence-completeness
  check (`design/evidence/keyboard/` holds 40 `.png` files, `tab-order-chromium.json` and
  `tab-order-webkit.json` each cover all 5 pages) passed. `npm run check:contrast` (PASS, same
  two pre-existing C-01 review warnings, unaffected) and `npm run test:unit` (17/17) both still
  green after the CSS change.
- What wasn't tested: the owner's own manual keyboard-and-eyes pass (D-14's second half, tab
  order and operability judgement) — explicitly deferred to 01-10 per `human_verify_mode:
  end-of-phase`. Real Safari (macOS/iOS) was not available on this Arch Linux machine; this
  finding and fix are Playwright-WebKit (Docker) evidence, consistent with the phase's existing
  WebKit-on-Linux-is-strong-but-not-final-word posture (see WINDOWS.md entries 1, 4, 5).

## Next Steps

- [ ] Real-Safari spot-check for this fix, bundled with the existing WINDOWS.md entries 1/4/5
      spot-check already queued for before 01-APPROVAL.md
- [ ] Continue with Task 2 (structure.spec.ts extension) and Task 3 (content.spec.ts) of this
      plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - proves criterion 3 (keyboard) end to end in both engines with per-stop
evidence, and fixes a genuine focus-obscuring defect on the contact form that a real keyboard
user on WebKit/Safari would have hit; no scope beyond the D-14 keyboard-walk task.

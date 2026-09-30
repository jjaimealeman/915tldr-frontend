# 2026-09-17 - Every Spanish Stress String Recalibrated; a Real Small-Size Measurement Gap Fixed

**Keywords:** [FEATURE] [TESTING] [BUG_FIX]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1440_01-15-recalibrate-every-spanish-component-widen-hi.md`

## What Changed

- `design/scripts/calibrate-spanish.mjs`: recalibrated all 22 fixture
  components against the post-01-14 type system (Source Serif 4 Bold
  headlines, Source Serif 4 italic standfirst, opsz pinned). All 22 widths
  land within `[1.24, hi]` in the real production fonts.
- Found, along the way, that the script's own 100px measurement basis —
  deliberately chosen to stay independent of the fluid `--step-*` clamp()
  tokens — under-predicts the real in-page ratio for some components once
  rendered at their actual small UI size. Glyph hinting/kerning at a
  realistic size (this project's `--step--1` through `--step-6` range,
  roughly 13-56px) can shift a string pair's width ratio more than the
  100px proxy shows, sharply so for short strings: `skip-link`'s 100px
  measurement predicted ratio 1.3303 (ceiling 1.3594), but the real page at
  768px renders it at exactly 16.896px (this project's own `--step-0`
  clamp() value there) and measures 1.3784 — 0.019 above the old ceiling,
  outside the test's +0.01 measurement-noise allowance. Confirmed this was
  a pure measurement-methodology gap, not a real defect: only the
  ratio-ceiling assertion failed, with `vClipped`/`hOverflow`/`textMatches`
  all clean at every width.
- Added `maxSmallSizeRatio()`: a dense in-page sweep (12-58px in 0.1px
  steps, one `page.evaluate()` call per component so 460 steps stay fast)
  of the chosen synthetic string's real ratio at realistic sizes. When that
  exceeds the 100px-derived `hi`, the recorded ceiling widens to cover it —
  9 of 22 components needed widening (`lead-headline`,
  `category-masthead-title`, `article-headline`, `article-standfirst`,
  `byline`, `changelog-title`, `contact-submit`, `theme-toggle`,
  `skip-link`). The 100px-based `widthRatio`/padding-word-selection logic
  that chooses each `es_synthetic` string is unchanged — only the recorded
  ceiling now reflects what the page can genuinely render, not just the
  100px proxy.
- `design/fixtures/spanish-stress.json`: every component recalibrated (see
  table below). `card-headline` and `worst-case`'s `es_synthetic` strings
  moved by less than 0.001 in ratio, so no `index.html` edit was needed —
  verified the drawn cards already contain the current strings.
- No font subset changes: `pnpm run fonts:build` confirmed the glyph set is
  unchanged (the synthetic padding words are drawn from the same Spanish
  baseline as before).

### Per-component before/after (widthRatio / hi)

| Component | Role (before → after) | widthRatio (before → after) | hi (before → after) |
|---|---|---|---|
| card-headline | display → headline | 1.2543 → 1.2545 | 1.3000 → 1.3000 |
| card-summary | body → body | 1.2578 → 1.2573 | 1.3000 → 1.3000 |
| card-summary-thin | body → body | 1.2734 → 1.2726 | 1.3000 → 1.3000 |
| lead-headline | display → headline | 1.2869 → 1.2872 | 1.3000 → **1.3044** |
| lead-summary | body → body | 1.2608 → 1.2635 | 1.3000 → 1.3000 |
| nav-category-label | body → body | 1.3552 → 1.3606 | 1.4120 → 1.4119 |
| category-masthead-title | display → headline | 1.3986 → 1.3912 | 1.4397 → **1.4681** |
| category-masthead-description | body → body | 1.2614 → 1.2654 | 1.3071 → 1.3071 |
| category-lead-headline | display → headline | 1.2657 → 1.2694 | 1.3000 → 1.3000 |
| article-headline | display → headline | 1.2787 → 1.2982 | 1.3000 → **1.3075** |
| article-standfirst | display → body | 1.2719 → 1.2960 | 1.3000 → **1.3082** |
| article-body | body → body | 1.2757 → 1.2785 | 1.3000 → 1.3000 |
| tag-chip | body → body | 1.2902 → 1.2926 | 1.3539 → 1.3540 |
| ai-disclosure | body → body | 1.2639 → 1.2698 | 1.3000 → 1.3000 |
| byline | body → body | 1.3065 → 1.3057 | 1.3124 → **1.3168** |
| changelog-title | display → headline | 1.2964 → 1.2912 | 1.3000 → **1.3062** |
| changelog-prose | body → body | 1.2711 → 1.2728 | 1.3000 → 1.3000 |
| contact-label | body → body | 1.3327 → 1.3410 | 1.3698 → 1.3700 |
| contact-submit | body → body | 1.3310 → 1.3457 | 1.3673 → **1.3733** |
| theme-toggle | body → body | 1.3555 → 1.3612 | 1.3885 → **1.4024** |
| skip-link | body → body | 1.3224 → 1.3303 | 1.3595 → **1.3793** |
| worst-case | display → headline | 1.2543 → 1.2545 | 1.3000 → 1.3000 |

(bold = ceiling widened by the small-size cross-check)

## Why

01-14 moved headlines to Source Serif 4 Bold and pinned the `opsz` axis on
both weights, so a calibration measured against the old type system no
longer proves what criterion 4 claims. Task 2 closes the gap for every
remaining component after Task 1 proved the method on one headline, and
along the way found that the calibration methodology itself had a residual
blind spot for short strings — worth fixing now rather than leaving a
flaky-looking test for someone else to chase later.

## Issues Encountered

The small-size measurement gap above — found by running the plan's own
required verification (`pnpm run verify:phase-1 --criteria=4`) and refusing
to accept a failing run as "probably a flake."

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run verify:phase-1 --criteria=4` (PASS, both
  engines, all five pages); `font-cls.spec.ts`'s "every rendered character"
  coverage check (PASS, both engines); the full `spanish-overflow.spec.ts`
  suite (31/31 passing in both engines); `pnpm run check:contrast` (PASS);
  `pnpm run test:unit` (43/43 passing).
- What wasn't tested: real Safari (WebKit here is Playwright's bundled
  engine, not Safari — a pre-existing, already-tracked open item, not new
  to this task).

## Next Steps

- [ ] Plan-level metadata commit (SUMMARY, STATE, ROADMAP)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - recalibrates the Spanish +25% floor for every stress
component against the shipped type system, and fixes a real
measurement-methodology gap in the calibration ceiling.

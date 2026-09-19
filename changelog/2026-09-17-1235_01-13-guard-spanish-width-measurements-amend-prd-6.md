# 2026-09-17 - Spanish Text-Width Checks Now Refuse to Measure the Wrong Font, and the PRD Catches Up

**Keywords:** [FEATURE] [TESTING] [DOCUMENTATION]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1235_01-13-guard-spanish-width-measurements-amend-prd-6.md`

## What Changed

- `design/tests/support/i18n.ts`: the Spanish text-width comparison now
  double-checks, before measuring, that the real webfont is actually the
  one being drawn — not silently the fallback — for the two font weights
  this project preloads. If it isn't, the check now fails loudly instead of
  quietly comparing the wrong typeface's measurements.
- `design/tests/support/fonts-in-use.ts`: exposed the project's two primary
  font-family names so the check above (and future checks) can reuse the
  same list rather than each maintaining their own copy.
- `docs/PRD.md`: §6.5's font strategy now reads `font-display: optional`
  instead of `swap`, with a dated note explaining the change and pointing
  at the design review where it was decided.

## Why

Every width comparison this project runs for Spanish text assumes it's
comparing widths in the REAL webfont, not a substitute. Under the new
loading strategy, that assumption can be silently wrong for a page view
whose font missed its very short loading window — so before trusting a
width number, the check now confirms which font is actually there.

The PRD update makes the documented plan match what the site actually does
— it was still describing the old strategy this whole investigation started
by revisiting.

## Issues Encountered

The new guard initially caught a real, already-known case (the article
page's italic accent text, which — as found and recorded separately this
session — can never realistically win its font's loading window under the
current setup) and correctly refused to measure it. Since that's an already
-documented, expected fact rather than a silent risk this guard exists to
catch, the check was scoped to the two font weights the site actually
preloads, matching the same scoping decision made minutes earlier for a
near-identical check elsewhere in this same investigation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the Spanish overflow test suite for the home and article
  pages, in both Chrome and the WebKit Docker image, run twice for a
  repeatable clean pass.
- What wasn't tested: nothing skipped — same combinations as before this
  change, just now with the extra safety check in front of each width
  measurement.

## Next Steps

- [ ] None — 01-13 complete (Tasks 1-3)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - a safety guard on an existing measurement, plus a documentation catch-up

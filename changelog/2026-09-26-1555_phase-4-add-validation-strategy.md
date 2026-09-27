# 2026-09-26 - Phase 4 validation strategy: how each requirement gets tested

**Keywords:** [PLANNING] [TESTING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1555_phase-4-add-validation-strategy.md`

## What Changed

- File: `.planning/phases/04-static-generation-templates-seo/04-VALIDATION.md`
  - Maps each Phase 4 requirement to a concrete test: loader fail-loud and the `/changelog` empty-state regression, incremental D1 reads, URL shapes (`/crime` and `/crime/**`, legacy UUID URLs), robots.txt and RSS parity, JSON-LD, the 48-hour Google News sitemap, and AI-disclosure and outlet-attribution markup.
  - Sets the sampling rate: `pnpm run test:unit` after every task, the full suite (including the live D1/KV tracer and the D1-import build gate) after every wave.
  - Makes the two research spikes a phase gate: "tests pass" isn't enough until the Loader-throw and incremental-build questions have a recorded result.

## Why

Written before planning so every plan task would have a known verification command, not a test invented after the fact. REND-05 (unchanged articles aren't re-rendered) is marked as needing a two-build experiment, not a unit test.

## Issues Encountered

None

## Dependencies

No dependencies added

## Testing Notes

- What was tested: nothing yet. This file defines the tests; plans 04-01 to 04-12 create them.
- What wasn't tested: build duration was left to be measured in Wave 0. 04-03 later measured a full build at about 65 seconds.

## Next Steps

- [x] `/gsd-plan-phase 4`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** Low. Planning only.
**Note:** Replaces an auto-generated placeholder (2026-09-27).

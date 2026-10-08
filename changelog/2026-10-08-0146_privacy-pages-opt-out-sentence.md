# 2026-10-08 - Opt-out sentence on both Privacy pages

**Keywords:** [FRONTEND] [I18N] [TESTING] [DOCUMENTATION]
**Session:** Night, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-0146_privacy-pages-opt-out-sentence.md`

## What Changed

- File: `src/pages/privacy.astro`
  - The Umami Analytics section ends with "Prefer not to be counted? You can turn analytics off for this browser." linking `/opt-out`, mirroring v1
- File: `src/pages/es/privacy.astro`
  - Spanish equivalent, linking `/es/opt-out`; Claude-drafted, not human-reviewed (the owner waived review of the opt-out copy)
- File: `tests/unit/privacy-no-analytics-host.test.mjs`
  - Sentence and exact hrefs in both languages, placement after the existing text, plain link (no target/rel), target route exists and stays noindex, dashboard host still absent, no cross-language opt-out link
- File: `tests/unit/opt-out.test.mjs`
  - The dist-gated "no static page links to them" check narrowed to "only the two Privacy pages link to them", and it now requires both Privacy pages to carry the link
- File: `docs/phase-06/live-verification.md`
  - Dated note under Post-phase closeout

## Why

Owner decision 2026-10-08 ("yes, add the opt-out sentence to v2"): v1's Privacy page offered visitors a way to stop being counted; v2 had the opt-out pages but no public path to them. A public link to a noindex page is fine, and the pages stay out of the sitemaps.

## Issues Encountered

- The existing rendered opt-out test asserted that no static page links to the opt-out pages; it would have failed after the first real build, so it was narrowed with the reason recorded in the test.
- The `/es` link-containment invariant is satisfied (`/es/opt-out` stays under `/es`).

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1089 tests, 1080 pass, 0 fail, 9 skipped (all dist-fresh gated); `pnpm run test:build-gate` 9 of 9. New tests seen red first.
- What wasn't tested: the rendered HTML of both Privacy pages, and the dist-gated opt-out and link-containment checks (no local full build is allowed)
- Edge cases: Spanish copy uses usted forms and has not been reviewed by a fluent human

## Next Steps

- [ ] After deploy, confirm `/privacy` and `/es/privacy` render the sentence and the link opens `/opt-out` and `/es/opt-out`
- [ ] After the first real build, rerun `pnpm run test:fast` so the dist-gated checks run in full

---

**Branch:** feature/phase-06-polish
**Issue:** N/A
**Impact:** LOW

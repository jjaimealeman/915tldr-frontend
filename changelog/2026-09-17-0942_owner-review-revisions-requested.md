# 2026-09-17 - Phase 1 Owner Review Recorded: Revisions Requested

**Keywords:** [DOCUMENTATION] [DESIGN] [ACCESSIBILITY] [PERFORMANCE]
**Session:** Morning, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0942_owner-review-revisions-requested.md`

## What Changed

- File: `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md`
  - Owner ticked the review checklist after a real-browser review of all five mockups
  - Filled the "Revision requests" section: outcome is revisions requested, not approved
  - Recorded four owner decisions: criterion 5 → option C (`font-display: optional`) plus shrinking the Source Serif 4 subsets; headlines move to Source Serif 4 bold with Instrument Serif kept for the wordmark only; Business hue re-sampled from a new photo; project package manager is pnpm
  - Recorded eight owner revision requests verbatim (header border, category-lead image fallback, article whitespace, changelog layout, contact centering and spacing, external links in a new tab, full width at 768px, homepage "Load more")
  - Recorded two defects spotted in the owner's screenshots (raw markdown in the article body; theme toggle outside the page column at 1920px)
- File: `changelog/README.md`
  - Added this entry to the index

## Why

Plan 01-10's Task 2 is the owner's own review of the mockups. The owner found real problems, so
the phase cannot be signed. Writing the notes and decisions into the approval packet gives the
gap-closure planning (`/gsd-plan-phase 1 --gaps`) a single, verbatim source to plan from.

## Issues Encountered

- Criterion 5 (font-swap CLS) fails by measurement; the owner chose to reopen PRD §6.5 rather than accept it.
- A `pnpm install` created `pnpm-lock.yaml` alongside `package-lock.json`; the owner chose pnpm, so `package-lock.json` is to be retired in the revision work.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: owner's manual review in a real browser — five pages, light/dark, 320/768/1280 px, 200% zoom, keyboard-only walk
- What wasn't tested: real Safari / Georgia (still outstanding)
- Edge cases: category lead without an image; homepage first-load density

## Next Steps

- [ ] `/gsd-plan-phase 1 --gaps` to turn the revision requests into gap-closure plans
- [ ] `/gsd-execute-phase 1 --gaps-only`
- [ ] Re-run the full verification and a second owner review, then sign
- [ ] Real-Safari / Georgia spot-check

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - reopens PRD §6.5 and D-09 typography; drives the Phase 1 gap-closure work

# 2026-09-16 - Rebuild Font Subset, Fix a Font-Swap CLS Regression, Verify All Five Pages

**Keywords:** [BUG_FIX] [TESTING] [STYLING] [ACCESSIBILITY] [PERFORMANCE]
**Session:** Evening, Duration (~50 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1920_rebuild-font-subset-fix-cls-regression-five-page-verify.md`

## What Changed

- File: `design/mockups/style.css`
  - Scoped four Task-1 article selectors (`article > header[data-block]` and
    its descendants, `main > article`, `main > article [data-frame]`) to
    `body[data-page="article"] main > article ...` — unscoped, they also
    matched index.html's and category.html's lead `<article>`, which is a
    direct child of `main` on those pages too
  - Fixed a genuine font-swap CLS bug found via this scoping audit:
    `main > article { margin: 0 auto; }` centered the article column using
    a `max-width` in `ch` units — a font-relative unit whose pixel value
    changes on font swap — which shifted the container's left edge (and
    everything inside it) sideways by ~34px on release. Changed to a
    left-anchored margin; only the wrap point moves now, not the left edge
- File: `design/mockups/changelog.html`, `design/mockups/contact.html`
  - Added a "Latest Stories" `[data-grid]`/`[data-card]` section to each —
    a pre-existing structural test (`structure.spec.ts`, criterion 5)
    asserts every page under test has a populated card grid, which neither
    page had; without it, `--criteria=1,2,5` across all five pages could
    never pass
- `.planning/WINDOWS.md`: two new entries (5, 6) — see Deviations below
- Font subset: `npm run fonts:build` re-run against the final five-page
  copy; output byte-identical to the prior four-page build (same 126
  codepoints — the three new pages introduce no character not already
  covered by the existing corpus/Spanish-stress crawl)

## Why

Task 3 of `01-07-PLAN.md`: rebuild the subset against the final copy and
prove criteria 1, 2, 5 across all five mockups. Running the real
`--criteria=1,2,5` sweep (rather than trusting the per-plan scoped criteria
1,2 runs from Tasks 1-2) surfaced both the CLS regression and the missing
structural grid — exactly what running the full gate before calling the
plan done is for.

## Issues Encountered

- **Real bug, fixed:** the `ch`-unit-plus-`margin:auto` centering described
  above. Found by bisecting style.css against the pre-Task-1 commit after
  confirming Chromium's index@1280px font-swap CLS had regressed from
  01-06's recorded baseline (0.0035) to 0.082 — this project's own
  "verify the premise" standard: don't accept a plan's assumption that new
  CSS is additive-only, check it against the actual prior baseline first.
- **Investigated, not fixed, documented instead (two cases):**
  1. WebKit fails font-swap CLS on article.html (geometryScore 0.143 at
     320px) — confirmed to be the same pinned-Docker-WebKit-missing-
     Georgia/Noto-Serif root cause already on record as WINDOWS.md entry 4
     (index.html/category.html), just newly exercised by a third
     content-heavy page. WINDOWS.md entry 5.
  2. Chromium reports native CLS 0.0125 on changelog.html at 320px, but
     this project's own geometry-based instrument (the primary,
     documented D-08 measurement) reports 0 for the identical swap, and a
     direct viewport-intersection check confirmed zero elements moved
     within the visible 320x900 viewport — all reflow is below the fold.
     WebKit passes cleanly on the same page. Traced with layout-shift
     source attribution; the reported sources showed identical before/after
     rects, consistent with a Chromium native-CLS attribution quirk on
     text-dense pages rather than a real user-visible shift. No CSS bug
     found (checked line-heights, margins, centering) and the threshold was
     not weakened. WINDOWS.md entry 6.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `npm run fonts:build` (idempotent, byte-identical
  output); `npm run check:contrast` (PASS); isolated per-page
  `verify:phase-1` runs for criteria 1, 2, 5 across all five pages in both
  engines (run per-page/per-engine to work around `font-cls.spec.ts`'s
  `describe.configure({mode:'serial'})`, which aborts the remaining tests
  in the file after the first failure — the combined all-pages run alone
  would have hidden results for later pages); the D-05 seven-entry
  `design/mockups` listing; the font byte-size gate (all four faces well
  under 150KB)
- Full per-page/per-engine criterion-5 result: index (Chromium PASS,
  WebKit FAIL — WINDOWS #4); category (Chromium PASS, WebKit FAIL —
  WINDOWS #4); article (Chromium PASS after the centering fix, WebKit FAIL
  — WINDOWS #5); changelog (Chromium FAIL — WINDOWS #6, WebKit PASS);
  contact (Chromium PASS, WebKit PASS). Criteria 1 and 2 pass on all five
  pages in both engines with no exceptions.
- What wasn't tested: a real Safari device (Playwright's WebKit-via-Docker
  is a stand-in, per 01-CONTEXT.md's own platform-constraint note); the
  owner's manual keyboard-walk pass (criterion 3, end-of-phase)

## Next Steps

- [ ] 01-08: keyboard walk across all five pages
- [ ] 01-09: font-swap matrix / real-Safari spot-check, which owns
      resolving WINDOWS.md entries 1, 4 and 5
- [ ] 01-10: approval packet — carries forward WINDOWS.md entries 2, 3, 6
      for owner judgement

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - fixes a real regression before it shipped, completes the five-page verification the phase's criterion 1 requires

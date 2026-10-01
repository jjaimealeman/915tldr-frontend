# 2026-09-30 - Footer credit link to 915website.com

**Keywords:** [FRONTEND] [SEO] [TESTING]
**Session:** Evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1810_footer-credit-link-915website.md`

## What Changed

- File: `src/layouts/Base.astro`
  - Added a `<p data-credit>` footer line, below the existing "Summaries of reporting by..."
    attribution and above the opt-in build-stamp line, reading "Site by 915website.com" with the
    link on "915website.com" pointing to `https://915website.com/`.
  - The link follows the project's existing external-link convention (01-17): `rel="noopener
    external"`, `target="_blank"`, the same inline new-tab SVG icon, and a visually-hidden
    "(opens in a new tab)" cue — copied verbatim from the article template's outlet-attribution
    link markup in `src/pages/[category]/[slug].astro`.
- File: `tests/unit/chrome.test.mjs`
  - Added two tests: one proving the `[data-credit]` footer element and its exact href/text exist
    on a real built article page, one proving the same on the homepage (`dist/client/index.html`).

## Why

Owner-requested credit link, per the Phase 4 follow-ups task list — every public page should
credit the site builder in the footer, using the same link styling and accessibility treatment
already established for outlet-attribution links elsewhere in the site.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: footer markup presence and exact href/link text on both an article page and
  the homepage, via `pnpm run test:unit` (full build + `node --test`, 390/390 passing with every
  04-followups change applied) and `pnpm run test:build-gate` (8/8 passing).
- What wasn't tested: visual rendering in a real browser (not required — this is a plain static
  link using markup/styling already proven elsewhere in the site).
- Edge cases: the credit line was checked for survival across the `buildStamp`-gated footer split
  (04-11a) — it renders unconditionally regardless of `buildStamp`, unlike the adjacent build-stamp
  line.

## Next Steps

- [ ] None — this follow-up task is complete.

---

**Branch:** feature/fix/phase-04-followups
**Issue:** N/A
**Impact:** LOW - a single, non-interactive footer link added to every page's static markup.

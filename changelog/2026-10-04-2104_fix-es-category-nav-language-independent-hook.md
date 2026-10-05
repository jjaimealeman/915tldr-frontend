# 2026-10-04 - Fix unstyled Spanish category nav with a language-independent hook

**Keywords:** [BUG_FIX] [FRONTEND] [I18N] [TESTING] [DOCUMENTATION]
**Session:** Evening, Duration (~0.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-2104_fix-es-category-nav-language-independent-hook.md`

## What Changed

- File: `src/layouts/Base.astro`
  - The header section nav now carries `data-site-nav="sections"`; the translated `aria-label` is kept for assistive technology
- File: `src/styles/global.css`
  - All 7 `nav[aria-label="Sections"]` selectors (base, ul, a, a[aria-current], 48em and 80em media rules, 80em width group) are now `nav[data-site-nav="sections"]`
- File: `tests/unit/css-no-translated-selectors.test.mjs`
  - New guard: fails if any CSS selector in `src/**/*.css` or a `<style>` block in `.astro`/`.vue` depends on an attribute value that is an English or Spanish dictionary string
  - Markup/styling contract: the nav carries the hook for both languages and `global.css` styles through it at every breakpoint
- File: `tests/integration/browser-journeys.test.mjs`
  - New live-origin Chromium journey on `/` and `/es`: one row of 8 at 1280px with `list-style-type: none`, exactly 2 columns at 390px; `SITE_NAV_SELECTOR` env override for pre-fix deploys
- File: `tests/unit/chrome.test.mjs`, `tests/unit/listing-pages.test.mjs`
  - Built-page nav regex no longer assumes `aria-label` is the only attribute on `<nav>`
- File: `docs/phase-06/live-verification.md`
  - New section 8 "Defect 2 fix" with red/green status and the pending deploy
- File: `changelog/README.md`
  - Index row for this entry

## Why

On every `/es` page the category nav rendered as a plain bulleted vertical list, because the CSS keyed on the English label `Sections` while the Spanish page's label is `Secciones`. Styling off a translated string can only ever match one language, so the fix uses a stable attribute and the guard test covers the whole class.

## Issues Encountered

- The new live test is red on dev until Jaime merges and the production build deploys; it is not skipped.
- `design/mockups/style.css` and `design/tests/*.spec.ts` still use `nav[aria-label="Sections"]`; they target the English-only Phase 1 mockup, so they were left alone.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: guard test failed before the fix (4 of 5) and passes after (5 of 5); `pnpm run test:fast` 1026/1026; `pnpm run test:build-gate` 9/9; live test run red on `/es` against dev before the fix; fix simulated in Chromium by serving live HTML with the hook and the fixed stylesheet (both languages, both widths)
- What wasn't tested: a rendered `/es` page from a real build (no local build was run, it writes to production KV); real deployed behaviour
- Edge cases: 48em (4 columns) breakpoint covered only by the selector pairing assertion, not a browser measurement

## Next Steps

- [ ] Merge and deploy, then run `node --test --test-name-pattern="06-16 gap" tests/integration/browser-journeys.test.mjs` and expect green
- [ ] Consider a Lighthouse pass on `/es` (not yet checked)

---

**Branch:** feature/phase-06-gaps
**Issue:** N/A
**Impact:** MEDIUM - header nav styling on every Spanish page

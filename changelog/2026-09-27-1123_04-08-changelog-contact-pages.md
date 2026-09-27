# 2026-09-27 - /changelog and /contact pages ported from the approved mockups

**Keywords:** [FEATURE] [FRONTEND] [SEO] [TESTING]
**Session:** Morning, Phase 4 Plan 8, Task 2 of 3
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1123_04-08-changelog-contact-pages.md`

## What Changed

- File: `src/pages/changelog.astro`
  - Renders every entry from the new `changelog` collection (defensively re-sorted with the same
    date-desc/source/original-index rule the loader itself uses), ported from
    `design/mockups/changelog.html`'s dispatch layout (`data-layout="with-rail"`), plus the
    mockup's Latest Stories rail (6 newest articles, compact `ArticleCard`)
- File: `src/pages/contact.astro`
  - Ported from `design/mockups/contact.html` verbatim, including its real bio copy (not v1's
    Nuxt contact.vue's generic template copy). Every form field lives inside a real
    `<fieldset disabled>`; the mockup's dev-only "does not send anything" notice is replaced with a
    permanent, honest statement that the form isn't accepting messages until Phase 10 wires
    submission. Includes the same Latest Stories grid.
- File: `tests/unit/static-pages.test.mjs`
  - New dist-output tests: both pages' canonical URLs, every changelog fixture entry (v1 JSON + D1)
    verified verbatim on the rendered page, the disabled-fieldset structure, and the "not accepting
    messages" copy

## Why

FIX-05: `/changelog` now renders the full preserved history (D-13's two sources) in the approved
design on every build. D-10: `/contact` exists in the approved chrome with an honest, non-deceptive
statement about the form's current (disabled) state, rather than either a broken form or no contact
page at all.

## Issues Encountered

v1's actual `/contact` page (`app/pages/contact.vue`) never publishes a contact address anywhere in
its rendered markup — its message recipient (`me@915website.com`) only exists inside the server-side
handler, confirmed by reading `server/api/contact.post.ts` directly. Since v1 doesn't publish an
address to carry over, none was added; the mockup's own links to jjaimealeman.com and
915website.com already give a reader a way to reach the owner while the form is disabled.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: both pages built and tested against real production D1 data (a real
  `pnpm run build`), not fixtures alone
- What wasn't tested: /about, /privacy, /terms (next commit)
- Edge cases: the changelog page's every fixture entry (9 v1-json + 6 D1) checked verbatim, not
  sampled

## Next Steps

- [ ] Build /about, /privacy, /terms (Task 3)
- [ ] Complete 04-08-SUMMARY.md

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - two new public routes, no submission wiring yet (Phase 10)

# 2026-10-04 - RED: Failing Coverage for /es/changelog and the Five-Page Hreflang/Link Contract

**Keywords:** [TESTING] [I18N] [SEO]
**Session:** Late night, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0153_06-07-task2-red-es-static-pages-test.md`

## What Changed

- File: `tests/unit/es-static-pages.test.mjs`
  - New dist-based test suite proving, for all five Spanish static page types (about, privacy,
    terms, contact, changelog): a self canonical, reciprocal en/es/x-default hreflang, and that
    every internal href stays inside `/es` except the deliberate language-switch link (D-12/D-14)
  - New `/es/changelog`-specific coverage (D-17): `<html lang="es">`, Spanish heading/intro, the
    one-line English-build-notes note, and the same dispatch-entry count as `/changelog` with
    each entry wrapped in `lang="en"`

## Why

TDD RED for Task 2 of 06-07-PLAN.md. `src/pages/es/changelog.astro` was temporarily moved aside
(`mv` to `/tmp`, not committed) so this run proves the test suite actually fails on the real gap
it's meant to catch, not just on a typo. Confirmed: exactly the 4 changelog-specific tests fail
(file not found / assertion on missing file); all 10 about/privacy/terms/contact tests pass
against Task 1's already-built pages.

## Issues Encountered

First draft of the internal-link test incorrectly exempted only `href === "/"` as the language
switch target — true on `/es` (home), but every other `/es` page's switch link correctly points
at ITS OWN English pair (`/terms`, `/contact`, etc.), not `/`. Fixed by extracting the actual
`[data-lang-switch]` anchor's href per page instead of hardcoding `/`.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/es-static-pages.test.mjs` against a real build with
  `src/pages/es/changelog.astro` absent — confirmed RED (4 failing, 10 passing).
- What wasn't tested: GREEN (the next commit restores the implementation and re-runs this suite).
- Edge cases: the language-switch exemption had to be href-specific per page, not a single
  hardcoded path — documented above.

## Next Steps

- [ ] GREEN: restore `src/pages/es/changelog.astro`, rebuild, re-run this suite plus
      `tests/unit/static-pages.test.mjs` and `pnpm run test:regression`

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** LOW - test-only commit, no production code changed.

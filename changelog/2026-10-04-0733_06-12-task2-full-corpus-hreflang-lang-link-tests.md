# 2026-10-04 - Full-Corpus Hreflang/Lang/Link Invariant Tests (I18N-04/05)

**Keywords:** [TESTING] [I18N] [SEO]

**Session:** Morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0733_06-12-task2-full-corpus-hreflang-lang-link-tests.md`

## What Changed

- File: `tests/unit/hreflang-pairs.test.mjs` (new)
  - Walks every built page — static (`dist/client`) AND archived (`dist/archive`, named by
    `dist/archive-plan.json`) — not a sample. For every page declaring alternates: `en`/`es`
    reciprocate (verified via the independent `pairedPath()` path-math helper, not by trusting
    either side's own self-reported href, since an `/es` page's own "es" alternate is a
    self-reference, not "the other page"), `x-default` equals the English URL, and every
    alternate target resolves to a page this build actually produced. Noindex pages are asserted
    to declare zero alternates.
  - Checked all 121,554 built pages in ~5.7s: 20,085 paired, 40,691 self (untranslated English
    fallback, matching 06-11's own measured figure exactly), 0 with no alternates at all.
- File: `tests/unit/es-lang-and-links.test.mjs` (new)
  - Same full-corpus walk: every `/es` page is `<html lang="es">` with every internal `<a href>`
    starting with `/es` (external, mailto and fragment hrefs excepted, plus the one deliberate
    language-switch link back to English — D-12, the established exception from
    `tests/unit/es-static-pages.test.mjs`); every other page is `<html lang="en">`.
  - Checked all 121,554 pages in ~4.3s: 60,777 `/es`, 60,777 other — zero violations.

## Why

I18N-04/05 and ROADMAP success criterion 2 ("verified per page pair") require the hreflang/lang/
link contract proven across the ENTIRE corpus, not the fixed two-page samples existing unit tests
(`tests/unit/hreflang.test.mjs`, `tests/unit/es-static-pages.test.mjs`) already cover.

## Issues Encountered

**[Test-logic bug, caught before commit]** The first draft of `hreflang-pairs.test.mjs`'s
reciprocity check parsed an `/es` page's own "es" alternate href to find "the other page to check
against" — but that href is a SELF-reference by design (every paired page emits its own canonical
under its own hreflang), so the check was comparing a page against itself and failing on literally
every paired `/es` page (20,085 false failures). Fixed by computing the expected counterpart path
independently via `pairedPath()` (imported from `src/lib/i18n/hreflang.ts`, the same helper
`tests/unit/hreflang.test.mjs` already uses) rather than deriving it from either side's own
self-reported markup. No production code was touched — this was purely a bug in the new test's own
logic, found and fixed before the first commit.

## Dependencies

None added.

## Testing Notes

- What was tested: both new tests, individually and together
  (`node --test tests/unit/hreflang-pairs.test.mjs tests/unit/es-lang-and-links.test.mjs`), against
  the real build from this plan's own Task 1 — 2/2 pass, combined run ~6s (well under the plan's
  60s ceiling).
- What wasn't tested: nothing deferred — both tests run against the full corpus, not a sample, per
  the plan's own must-have.
- Edge cases: `/es/404.html` (noindex, zero alternates — correctly exempted from the reciprocity
  check); static/category/tag pages (always paired, not gated by per-article translation
  availability — confirms the 20,085 "paired" count is dominated by tag/static pages, not just the
  13 currently-translated articles).

## Next Steps

- [ ] Task 3 of this same plan (06-12, checkpoint:decision): not all three build-budget verdicts
  are green, so execution stops for Jaime's decision before any further Phase 6 work.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - proves the bilingual hreflang/lang/link contract holds across the entire real
corpus, closing the "sampled, not exhaustive" gap the plan's success criterion 2 flagged.

# 2026-10-03 - 06-05 Task 2 (RED): failing coverage for Spanish dates, the Umami tag and the no-auto-language guard

**Keywords:** [TESTING] [I18N] [ACCESSIBILITY]
**Session:** Morning, Duration (~40 min, this commit)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1048_06-05-task2-red-spanish-dates-umami-noautolang-tests.md`

## What Changed

- File: `tests/unit/format.test.mjs`
  - Added 6 failing cases for `formatBylineTime(..., { language: 'es' })` and
    `formatDateline(epoch, 'es')` — the fixed Spanish AP-style byline shape, the full Spanish
    month-abbreviation table (every month gets a trailing period, including May/June/July, unlike
    English), and byte-identity assertions for the English path with the new parameter present
- File: `tests/unit/chrome.test.mjs`
  - Added 3 new cases: the Umami tag sampled across home/category/article/tag/`/es` (exactly once,
    with `defer`), the localized Spanish footer on `es.html` vs. the English footer on
    `index.html`, and the language-switch link's exact text/href on both
- File: `tests/unit/no-auto-language.test.mjs` (new)
  - Self-test proving the forbidden-surface pattern (`Accept-Language`, `navigator.language(s)`,
    the Cloudflare country header, `request.cf`/`.cf.country`, `document.cookie`) catches a real
    occurrence of each, ignores the same surfaces when only mentioned inside a comment, and does
    not mis-truncate a line at a URL's `//` protocol separator
  - Real-tree scan test (passes against the current `src/` tree — both existing mentions are
    inside doc comments) and an `astro.config.mjs` "no top-level `i18n` key" assertion

## Why

TDD RED for 06-05-PLAN.md Task 2: these tests pin the exact behavior Task 2's implementation
commit must satisfy (Spanish date formatting, the live Umami tag, the localized footer/switcher,
and the structural no-auto-language guard) before any of that code exists. Confirmed failing
against the pre-Task-2 `format.ts`/`Base.astro` (no `language`-aware formatting, no Umami tag
yet) prior to this commit.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: ran each new test file standalone and confirmed the Spanish-formatting and
  Umami/footer/switcher cases failed with the expected actual-vs-expected mismatch (RED); the
  no-auto-language self-test and real-tree-scan cases passed immediately since they test the
  scanner itself against an already-clean tree.
- What wasn't tested: the implementation that makes the RED cases pass — that is the immediately
  following GREEN commit.
- Edge cases: n/a (test-only commit).

## Next Steps

- [ ] GREEN commit: `format.ts` Spanish formatting, `ArticleCard.astro` language props,
      `listing.ts`'s reserved `'es'` route, `Base.astro`'s Umami tag and Spanish-aware dateline,
      `es/index.astro`'s per-card `lang`/`contentLang`

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** LOW - test-only commit, no production code changed yet.

# 2026-09-30 - Log the hot window during every build; prove facts match the built pages

**Keywords:** [BACKEND] [TESTING] [ARCHITECTURE]
**Session:** Evening, Duration (~5 min, part of a longer session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2229_hot-window-build-log-and-tier-facts-cross-checks.md`

## What Changed

- File: `src/pages/[category]/[slug].astro`
  - `getStaticPaths` now calls `console.log(describeHotWindow(loadHotWindow()))` once per build,
    with no `try/catch` — a load/parse error throws and fails the build rather than falling back
    to a silent default cutoff (D-07, T-05-02)
- File: `tests/unit/tier-facts.test.mjs`
  - Added cross-checks against the real build: every article fact path maps to an existing
    `dist/client<path>.html` file, the set of fact uuids equals the set of uuids parsed from
    built article file names, no duplicate uuid/slug in either facts file, and the sum of tag
    facts with `count >= 10` equals `tools/tier-report.mjs --json`'s `tags.hot`

## Why

Task 3 of plan 05-01: proves the tier facts a build writes are provably correct against that
same build's output (not just internally consistent), and makes every build — local and Workers
Builds — state the hot window in force, visibly flagged PROVISIONAL while D-07's age-based
fallback is in effect.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `bash -o pipefail -c 'pnpm run build 2>&1 | grep -c "PROVISIONAL"'` reports
  exactly 1 (one log line, once per build); `node --test tests/unit/tier-facts.test.mjs`
  (7/7 pass, 0 skipped); `pnpm run test:fast` (428/428 pass, 0 skipped).
- What wasn't tested: the derived (non-provisional) hot-window log line in a real build — no
  derived window exists yet (05-05's work).
- Edge cases: duplicate-uuid/duplicate-slug detection across the full ~40k-article, ~20k-tag
  corpus, not just a sample.

## Next Steps

- [ ] 05-05 derives the real traffic window and replaces the committed bootstrap
      `hot-window.json`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW — adds a build-time log line and test coverage, no runtime behavior change

# 2026-10-01 - Existing build-output tests and the byte-identity regression now cover both tiers

**Keywords:** [TESTING] [BUG_FIX] [BACKEND]
**Session:** Late night, Duration (~40m)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0055_05-06-task3-existing-tests-cover-both-tiers.md`

## What Changed

- File: `tests/unit/listing-pages.test.mjs`
  - The tag-count test now asserts `dist/client/tag` count + `dist/archive/tags` count equals
    `.astro/tag-build-log.json`'s authoritative `tagCount`, and that `dist/client/tag` holds
    EXACTLY the tags whose tier facts show a full count >= 10 (D-08 precision), cross-checked
    against `.astro/tier-facts-tags.json`
  - The sampled tag-link check now accepts a linked tag found in either `dist/client/tag` or
    `dist/archive/tags`
- File: `tests/unit/not-found.test.mjs`
  - The same-build-consistency check now accepts a 404-index path mapping to either an existing
    `dist/client<path>.html` file or an entry in `dist/archive-plan.json` (defensive — the
    404-index only ever lists the newest 500 articles, which are always hot by construction today)
- File: `tests/unit/tier-facts.test.mjs`
  - Every 05-01 cross-check now sums static (`dist/client`) and archived
    (`dist/archive-plan.json`) counts/uuid sets instead of assuming every fact's page is still
    under `dist/client`
- File: `tests/unit/seo-surfaces.test.mjs`
  - The rss.xml link check now accepts a static file OR an `dist/archive-plan.json` entry for the
    same reason as the 404-index check (defensive; rss only lists the newest 30 articles)
- File: `tests/unit/news-sitemap.test.mjs` (Rule 1 fix, not in this plan's original file list)
  - The full-sitemap URL-count test now expects static HTML count PLUS archived page count —
    the sitemap plugin runs during `astro build`, BEFORE partition moves archive-tier pages out
    of `dist/client`, so every sitemap URL still names a real page in one tier or the other
- File: `tools/compare-builds.mjs`
  - `snapshot()` now also walks `dist/archive`, keyed under an `archive/` prefix so it never
    collides with a same-shaped `dist/client` path
  - `isArticleFile()` now also counts `archive/articles/<uuid>.html` as an article file
- File: `tests/regression/byte-identity.test.mjs`
  - Header comment updated: the regression now covers both tiers (no behavior change needed —
    it consumes `tools/compare-builds.mjs`'s already-updated `snapshot()`/`diff()`)

## Why

Partitioning (this plan's Tasks 1-2) moves archive-tier pages physically out of `dist/client` —
every pre-existing test that assumed "every public page lives under dist/client" needed the same
"static or archived" correction, or it would start failing as a direct, correct consequence of
partitioning working. `news-sitemap.test.mjs` wasn't in this plan's original `<files>` list but
broke for the identical reason (the sitemap plugin runs before partition, so it still lists
archived URLs) — fixed under deviation Rule 1 (bug directly caused by this plan's own change,
in scope).

## Issues Encountered

**1. [Rule 1 - Bug] `news-sitemap.test.mjs`'s full-URL-count test broke immediately after
partitioning, outside this plan's listed files**
- **Found during:** the full `pnpm run test:fast` pass after Task 1/2's commits
- **Issue:** the test asserted sitemap URL count == `dist/client` HTML file count minus 404 —
  true before partitioning (sitemap and dist/client always agreed), false after (the sitemap
  plugin runs before the partition step, so it still lists every archive-tier URL that
  `dist/client` no longer physically contains)
- **Fix:** expected count is now static HTML count + archived page count (from
  `dist/archive-plan.json`), matching every other dist-output test's "static or archived" rule
- **Files modified:** `tests/unit/news-sitemap.test.mjs`
- **Verification:** `node --test tests/unit/news-sitemap.test.mjs` passes
- **Committed in:** this commit

No other deviations. `pnpm run test:unit` (608/608), `pnpm run test:build-gate` (9/9), and
`pnpm run test:regression` (two real consecutive builds, byte-identity holds across both tiers)
all pass clean.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full suite — `pnpm run test:unit` (608/608), `pnpm run test:build-gate`
  (9/9), `pnpm run test:regression` (one real two-build byte-identity pass, ~112s, both tiers
  covered via `tools/compare-builds.mjs`'s updated snapshot). A separate real two-consecutive-build
  run measured incremental-page-reuse: 60,378/60,397 pages restored (99.97%), well above the
  95% floor this task's own acceptance criterion requires — partitioning does not defeat
  Astro's incremental page reuse.
- What wasn't tested: a build where an article or tag genuinely crosses the hot/archive boundary
  between the two consecutive builds in the byte-identity regression (both builds in that test ran
  within the same UTC day, so the cutoff never moved mid-test).

## Next Steps

- [ ] 05-07 wires the R2 upload that reads `dist/archive-plan.json` and actually serves these
      archived pages from the Worker's archive branch
- [ ] Write 05-06-SUMMARY.md and the plan-completion metadata commit

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - test-only changes (plus the compare-builds.mjs tool), restoring full build
coverage after Tasks 1-2 physically moved archive-tier pages out of dist/client.

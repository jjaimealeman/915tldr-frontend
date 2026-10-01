# 2026-09-30 - Implement tier facts, hot window, and tiering rules end to end (GREEN)

**Keywords:** [BACKEND] [ARCHITECTURE] [PLANNING]
**Session:** Evening, Duration (~5 min, part of a longer session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2222_tier-facts-tracer-implementation-green.md`

## What Changed

- File: `src/lib/archive/tiering.ts` (new)
  - `HOT_TAG_MIN_ARTICLES = 10` (D-08), `SECONDS_PER_DAY`
  - `isHotTag(count)`, `hotCutoffEpoch(nowEpoch, days)` (floors to a UTC day boundary),
    `isHotArticle(publishedAt, cutoffEpoch)`, `classifyArticles`, `classifyTags`
  - Minimal for this tracer (Task 1) — input validation/throwing and `projectStaticCount` land
    in the next plan task
- File: `src/lib/archive/hot-window.json` (new)
  - The committed D-07 bootstrap: `fallback-provisional`, `provisional: true`, `days: 90`
- File: `src/lib/archive/hot-window.ts` (new)
  - `HOT_WINDOW_STATUSES`, `HOT_WINDOW_PATH`, `parseHotWindow`, `loadHotWindow`,
    `describeHotWindow` — every thrown error is prefixed `hot-window:`
- File: `src/lib/archive/tier-facts.ts` (new)
  - `ARTICLE_FACTS_PATH`, `TAG_FACTS_PATH`, `writeArticleFacts`, `writeTagFacts`,
    `readTierFacts` — re-validates every fact on read (uuid/path/publishedAt, slug/count)
- File: `src/pages/[category]/[slug].astro`
  - `getStaticPaths` now calls `writeArticleFacts` once per build
- File: `src/pages/tag/[slug].astro`
  - `getStaticPaths` now calls `writeTagFacts` with the full (uncapped) per-tag article count
- File: `tools/tier-report.mjs` (new)
  - CLI: reads facts + hot window, prints a human summary or `--json`; `--days`/`--now` project a
    candidate window

## Why

This is the GREEN half of 05-01 Task 1: a real `pnpm run build` now emits
`.astro/tier-facts-articles.json`/`.astro/tier-facts-tags.json`, and `tools/tier-report.mjs`
classifies them end to end under the provisional D-07 bootstrap window — the decision layer
REND-09/REND-10 build on.

## Issues Encountered

One real bug, fixed inline (Rule 1): `tier-facts.ts` initially imported `./article-url.ts`
(would resolve to a non-existent `src/lib/archive/article-url.ts`) instead of
`../article-url.ts` — caught immediately by the first `pnpm run build`, which failed with an
`UNRESOLVED_IMPORT` error. Fixed before any other work continued.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a full `pnpm run build` (60,395 pages), then
  `node --test tests/unit/tier-facts.test.mjs` (3/3 pass) and the full fast suite
  (`node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"`, 393/393 pass, 0
  skipped). `node tools/tier-report.mjs --json` reports `tags.hot: 2325` — exactly the D-08
  measured figure from 05-CONTEXT.md — and `hotWindow.provisional: true`.
- What wasn't tested: full input-validation/throwing behavior of `tiering.ts`/`hot-window.ts`
  (deliberately deferred to plan task 2, which adds the boundary-pinning test files).
- Edge cases: none yet — this task proves the end-to-end path works, not the edge cases.

## Next Steps

- [ ] Task 2: pin tag-threshold boundaries (9/10/11) and hot-window validation boundaries with
      dedicated test files, add throwing validation and `projectStaticCount`
- [ ] Task 3: cross-check facts against the real build and log the hot window (with PROVISIONAL)
      during every build

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM — new build-time decision layer, no runtime/public-facing behavior change yet

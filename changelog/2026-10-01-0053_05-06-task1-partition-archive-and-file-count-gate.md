# 2026-10-01 - Partition archive-tier pages out of the static build, gate the remaining file count

**Keywords:** [BACKEND] [PERFORMANCE] [CONFIG] [ARCHITECTURE]
**Session:** Late night, Duration (~35m)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0053_05-06-task1-partition-archive-and-file-count-gate.md`

## What Changed

- File: `tools/partition-archive.mjs` (new)
  - `cleanPartitionInputs()` removes stale tier facts, `dist/archive` and the plan before a build
  - `planPartition()` classifies the build's own tier facts (05-01's `classifyArticles`/
    `classifyTags`) against the committed hot window into hot/archive splits
  - `applyPartition()` moves every archive-tier article/tag page from `dist/client` into
    `dist/archive/<key>`, computing sha256/bytes from the moved file, with every source and
    destination path resolved and asserted to stay inside its owning directory (T-05-22)
  - Writes `dist/archive-plan.json` — the contract 05-07 (R2 upload) will read
- File: `tools/assert-file-count.mjs` (new)
  - `countStaticFiles()` recursively counts every regular file under `dist/client` (a conservative
    superset of what Wrangler uploads)
  - `evaluateFileCount()` — ok below 70,000, warn at 70,000-79,999, fail at 80,000+ or at 0
    (REND-11/D-13)
  - `assertFileCount()` writes `dist/client/static-budget.json` (published at
    `/static-budget.json`), recounts after writing and throws on any mismatch
- File: `package.json`
  - `build` script now runs `partition-archive.mjs --clean` before `astro build`, then
    `partition-archive.mjs` and `assert-file-count.mjs` after

## Why

Phase 5's archive tier (REND-07/REND-09) needs every archive-tier article and tag page physically
out of the static output before deploy, not just classified — Workers Static Assets is a
per-deployment artifact with a hard 100,000-file ceiling, and the corpus crosses it well before
Phase 6 doubles it with Spanish content. Partitioning the SAME build's own rendered output (rather
than re-rendering archived pages separately) keeps hot and archived pages byte-identical by
construction. The file-count gate (REND-11/D-13) turns "measure it or it drifts" — the root cause
PROJECT.md names for the v1 D1-reads incident — into a build-enforced number, not a hoped-for one.

A real build measured 29,937 static files after partitioning (12,912 articles + 17,566 tags
archived; 27,575 articles + 2,325 tags static) — comfortably under the 80,000 fail threshold.

## Issues Encountered

No major issues encountered. The implementation and the real build both passed on first run.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a real `pnpm run build` (60,397 pages built), confirming the partition log
  line, the static-file count line, `dist/archive-plan.json`'s entry count, and
  `dist/client/static-budget.json`'s `staticFileCount` matching `find dist/client -type f | wc -l`
  exactly.
- What wasn't tested yet: unit-level boundary/path-safety coverage — that's Task 2 of this same
  plan, next commit.

## Next Steps

- [ ] Task 2: pin the threshold boundaries and partition path-safety with unit tests (TDD)
- [ ] Task 3: update the existing dist-output tests to cover both tiers

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new build-time tooling and a build script change; no runtime/public surface
change yet (05-07 wires the R2 upload that actually serves these pages).

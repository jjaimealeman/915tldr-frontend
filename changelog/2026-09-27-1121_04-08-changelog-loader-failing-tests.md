# 2026-09-27 - Failing tests for the D-13 dual-source changelog loader and REND-03 replay

**Keywords:** [TESTING] [BACKEND] [DATABASE]
**Session:** Morning, Phase 4 Plan 8, Task 1 of 3 (RED half of a TDD pair)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1121_04-08-changelog-loader-failing-tests.md`

## What Changed

- File: `tests/unit/changelog-loader.test.mjs`
  - 19 tests pinning the not-yet-written `changelogLoader()` Content Layer loader: merging v1's
    `changelog.json` with D1's `public_changelogs`, exact-duplicate removal, sort order (date desc,
    then source, then original index), the never-shrink check against a last-good baseline, and a
    ratchet-up test proving the floor rises automatically once a higher baseline is recorded
- File: `tests/regression/changelog-empty-state.test.mjs`
  - REND-03 regression replay: unit-level fail-loud cases (zero JSON entries, zero D1 rows, a
    shrunken total) plus a real-build replay that spawns a genuine `pnpm run build` with
    `V1_CHANGELOG_URL` pointed at a `data:` URL serving `{"entries":[]}` and asserts a non-zero
    exit naming the failure
- File: `tests/fixtures/v1-changelog.json`
  - Live snapshot of `https://915tldr.com/changelog.json` captured this session (9 entries)
- File: `tests/fixtures/d1-public-changelogs.json`
  - Live snapshot of D1's `public_changelogs` table (6 rows, `is_public = 1`) captured this session

## Why

Phase 4 Plan 8 fixes the exact bug this project already shipped once in v1: `/changelog` could
render empty if its data source came back empty or failed. This project's fix is structural — a
build-time Content Layer loader that merges both v1 sources (its live JSON changelog and D1's own
`public_changelogs` table) and refuses to build rather than ship an empty or shrunken page. Tests
are written first (TDD RED) against a loader module that doesn't exist yet, confirmed genuinely
failing (`ERR_MODULE_NOT_FOUND`) before any implementation lands in the next commit.

## Issues Encountered

While capturing the two fixtures, found that v1's live `changelog.json` currently serves 9 entries
instead of the 12 recorded during this phase's planning research two days ago — not a stale CDN
cache (ruled out directly), but a real fact: v1's last production deployment predates a commit that
added 3 more entries, so those 3 are sitting in v1's repo, undeployed. This changed the never-shrink
floor this loader ships with (14th commit in this same plan lowers it from a planned 18 to today's
real 15, with the last-good baseline mechanism designed to ratchet it back up to 18 automatically
once v1 deploys) — full detail in this plan's own SUMMARY.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every fail-loud path (zero entries, zero D1 rows, fetch failure, invalid JSON,
  malformed row shapes, never-shrink violations) and the happy-path merge/dedupe/sort behavior, all
  via stubbed seams — no real network or D1 access in the unit tests
- What wasn't tested yet: the real implementation itself (next commit) and the two built pages that
  will consume this collection (`/changelog`, later in this same plan)
- Edge cases: an entry duplicated exactly across both sources (kept once, as the v1-json copy); two
  entries sharing a date+title but differing in items (both kept); a baseline count that exceeds
  `CHANGELOG_MIN_EXPECTED` (the ratchet-up case)

## Next Steps

- [ ] Implement `changelogLoader()` to turn these tests GREEN (next commit)
- [ ] Wire the collection into `src/content.config.ts`
- [ ] Build `/changelog` and `/contact` consuming the new collection (Task 2)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - test-only commit, no runtime behavior changes yet

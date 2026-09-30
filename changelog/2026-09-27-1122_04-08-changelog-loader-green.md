# 2026-09-27 - GREEN: implement the D-13 dual-source changelog loader

**Keywords:** [FEATURE] [BACKEND] [DATABASE] [BUG_FIX]
**Session:** Morning, Phase 4 Plan 8, Task 1 of 3 (GREEN half of a TDD pair)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1122_04-08-changelog-loader-green.md`

## What Changed

- File: `src/content/loaders/changelog-loader.ts`
  - New Content Layer loader (`changelogLoader()`): fetches v1's live `changelog.json`, queries D1's
    `public_changelogs` (public rows only), converts D1 epoch dates to `YYYY-MM-DD` in
    America/Denver, merges both sources with exact-duplicate removal (keeping the v1-json copy),
    sorts newest-first, and rebuilds the store from scratch every build (no incremental modes — the
    changelog is small enough that a full rebuild every time has no budget cost)
  - Fail-loud rules: zero JSON entries, zero D1 rows, a fetch failure, invalid JSON, a malformed row
    shape, or a total below the never-shrink floor all throw before any store mutation — this is the
    exact `/changelog` empty-state defect this project already shipped once in v1 (REND-02/03),
    fixed structurally rather than patched
  - Exports `DEFAULT_V1_CHANGELOG_URL`, `CHANGELOG_MIN_EXPECTED`, `changelogSchema`
- File: `src/content.config.ts`
  - Registered the new `changelog` collection alongside `articles`

## Why

Turns the RED tests from the previous commit GREEN with a real implementation. The loader is the
structural fix for FIX-05/REND-02/REND-03: `/changelog` can no longer ship empty or shrunken,
because the build itself refuses to proceed when either data source looks wrong.

## Issues Encountered

`CHANGELOG_MIN_EXPECTED` is set to 15, not the 18 this phase's planning research recorded two days
ago. Re-verified live during this session: v1's production `changelog.json` currently serves only 9
entries (not 12) because v1's last deploy predates a repo commit that added 3 more entries — those 3
exist in v1's repo but were never deployed. Confirmed directly (not assumed): `wrangler deployments
list` in the v1 repo shows the last deploy at 2026-09-19T17:13Z, and the missing entries were
committed 2026-09-21. Floor set to what's actually live today (9 JSON + 6 D1 = 15); the never-shrink
baseline this loader already writes to KV (`build:last-good`) will raise this floor to 18
automatically the first time a build sees that count, once v1 deploys — no code change needed then.
Full writeup in this plan's own SUMMARY.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: all 19 unit tests from the prior commit now pass against the real
  implementation; a real `pnpm run build` against production data succeeds and logs the merged
  total; a real build against an intentionally empty JSON source fails loud
- What wasn't tested: the built `/changelog` page itself (next task in this same plan wires this
  collection into a real page)
- Edge cases: covered in the prior RED commit's test file — exact-duplicate removal, differing
  entries sharing a date+title, the ratchet-up baseline behavior

## Next Steps

- [ ] Build `/changelog` and `/contact` consuming this collection (Task 2)
- [ ] Build `/about`, `/privacy`, `/terms` (Task 3)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - new build-time collection, no public route consumes it yet in this commit

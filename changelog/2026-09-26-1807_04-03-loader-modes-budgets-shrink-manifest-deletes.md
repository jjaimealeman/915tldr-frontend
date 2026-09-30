# 2026-09-26 - Loader Modes (Cold/Warm/Warm+Sweep), Budgets, Shrink Check, Manifest Deletes

**Keywords:** [BACKEND] [DATABASE] [FEATURE] [TESTING] [BUG_FIX]
**Session:** Evening, Duration (~55 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1807_04-03-loader-modes-budgets-shrink-manifest-deletes.md`

## What Changed

- File: `src/content/loaders/articles-loader.ts`
  - Rewritten from the 04-01 single-mode window loader into the full REND-01/REND-02 loader:
    picks `cold` / `warm` / `warm+sweep` based on store emptiness, `LOADER_STATE_VERSION`,
    `lastCold`/`COLD_RESYNC_INTERVAL_SECONDS`, `ARTICLES_FORCE_COLD`, and `lastSweep`/
    `SWEEP_INTERVAL_SECONDS`
  - Mandatory ordering enforced: fetch → prospective id set (in memory) → per-mode rows-read
    budget check → category validation (`isKnownCategory`) → `evaluateShrink` (D-14) — all before
    any store mutation, manifest write, or meta update
  - Cold mode snapshots pre-clear digests so an unchanged article isn't reported as changed after
    `store.clear()` + rebuild; warm/warm+sweep use the store's own digest-changed return value
  - Manifest: changed entries bulk-written as schema v2; removed uuids bulk-deleted; a
    `manifestSchemaVersion` mismatch rewrites every public entry once
  - New exports: `LOADER_STATE_VERSION`, `SWEEP_INTERVAL_SECONDS`, `SWEEP_OVERLAP_SECONDS`,
    `COLD_RESYNC_INTERVAL_SECONDS`, `WARM_ROWS_READ_BUDGET`, `SWEEP_ROWS_READ_BUDGET`,
    `COLD_ROWS_READ_BUDGET` (provisional — Task 3 measures and replaces the budget values)
- File: `src/lib/server/kv-manifest.ts`
  - New: `deleteManifestEntries()` — KV REST bulk-delete endpoint (confirmed live against
    Cloudflare's API reference), batched at `KV_BULK_WRITE_MAX_PAIRS`, empty input issues no
    request
- File: `src/lib/server/d1-client.ts`
  - **Rule 1/2 bug fix, found via a real cold-path build against production D1:** 140 of
    ~40,183 public-status articles have a NULL or empty `summary` — a legacy content-pipeline
    gap the 04-01/04-02 window-scoped fetch never reached. `stitchArticles()` now classifies
    these as non-public (`reason: 'missing-summary'`), the same pattern as `no-primary-category`,
    instead of crashing the whole build on a Zod schema violation
- File: `tests/unit/articles-loader.test.mjs`
  - New: 24 tests pinning the full mode-selection matrix, cold/warm/warm+sweep behavior, budget
    and shrink-check throw-before-mutation guarantees, category validation, manifest
    write/delete/rewrite-all, and the after-success meta/pending-state updates
- File: `tests/unit/articles-loader-window.test.mjs`
  - Updated (deps seams only, per plan) to seed a non-empty store and a recent
    `stateVersion`/`lastCold`/`lastSweep` so these 04-01 tests still exercise the `warm` window
    path under the new mode-selection logic, rather than silently falling through to `cold`
- File: `tests/unit/d1-client-cold.test.mjs`
  - New tests for the `missing-summary` classification (NULL and whitespace-only summary)

## Why

REND-01/REND-02 need the loader to pick the cheapest correct sync mode automatically, refuse to
silently lose articles (D-14), cap its own D1 cost per mode, and keep the KV render manifest in
step with the content store — including deleting stale entries, not just adding new ones. The
missing-summary bug had to be fixed in the same task because it makes the entire cold path
(and therefore Task 3's first full-corpus build) impossible to run at all against real production
data.

## Issues Encountered

**Real bug found via a real build, not a unit test:** all 59 relevant unit tests passed against
mocked D1 responses, but running `pnpm run build` against real production D1 immediately threw
`InvalidContentEntryDataError` on a genuine NULL `summary` column. Unit tests use hand-written
fixtures that never modeled this real data shape. Fixed in `stitchArticles()` (shared by every
fetcher) and re-verified end-to-end: a full cold build against real production D1/KV completed
successfully, 40,049 pages built in 2m 22s, with real manifest entries written to the live
`915tldr-render-manifest` KV namespace (well within Task 1's dry-run cost projection — see Testing
Notes). No threshold was weakened; the fix excludes exactly the malformed rows.

**Test-writing bug (mine, caught immediately, not shipped):** several new `warm`-mode tests
initially used a default empty store, which the mode-selection rule correctly forces into `cold`
mode regardless of `meta` — an empty store must always mean cold (bullet 1). Fixed by seeding
those tests with a non-empty store, not by changing the implementation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full mode-selection decision matrix, cold/warm/warm+sweep fetch and store
  mutation semantics, per-mode budget enforcement (with a proof the store/manifest/meta are
  byte-identical after a budget or shrink failure), category validation, manifest bulk
  write/delete/rewrite-all, and post-success meta/pending-state updates — all against a stubbed
  `fetchImpl`/deps, no real network access in the test suite itself.
- What wasn't tested by the unit suite (but was proven by a real build in this same session): the
  loader's real behavior against the full, actual production D1 corpus — this is what caught the
  missing-summary bug the mocked tests couldn't see.
- Edge cases: an already-current `manifestSchemaVersion` does NOT trigger a rewrite-all; a
  genuinely empty result set throws regardless of allowance/bootstrap/requireBaseline.

## Next Steps

- [ ] Task 3: run the FIRST DELIBERATE, fully-measured full-corpus build (wall time, peak RSS,
      rows read, file count) — this session's ad-hoc verification build already proved the cold
      path works end-to-end, but Task 3 needs a clean, captured measurement with the exact
      `BUILD_STATE_BOOTSTRAP=1 ARTICLES_FORCE_COLD=1` invocation the plan specifies
- [ ] Replace the provisional `*_ROWS_READ_BUDGET` constants with measured values

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH — this is the loader that will run in production on every cron-triggered build;
the missing-summary fix was required for the full corpus to build at all. No user-facing page
change (the article page template is unchanged); the manifest KV namespace now holds real entries
for the full corpus for the first time.

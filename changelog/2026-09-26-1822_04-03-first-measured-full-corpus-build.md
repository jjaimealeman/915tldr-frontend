# 2026-09-26 - First Measured Full-Corpus Build, Budgets Set From Real Numbers, Baseline Committed

**Keywords:** [BACKEND] [DATABASE] [PERFORMANCE] [TESTING] [DOCUMENTATION] [BUG_FIX]
**Session:** Evening, Duration (~50 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1822_04-03-first-measured-full-corpus-build.md`

## What Changed

- File: `docs/phase-04/build-measurements.md`
  - Appended the real, measured cold build (`BUILD_STATE_BOOTSTRAP=1 ARTICLES_FORCE_COLD=1`) and
    two warm builds against real production D1/KV: wall time, peak RSS, the loader's own log
    line, Astro's page-generation time, `dist/client` file count, and the content-layer data
    store's real location and size
  - Same-day dry-run re-run and cross-check: loader's cold `public=40049` vs. dry run's
    independent `40193` — 0.358% difference, fully explained (140 `missing-summary` + a handful
    of `no-primary-category` exclusions), well under the 1% gate
  - D-06 answered directly: the content-layer store lives at
    `node_modules/.astro/data-store.json` (63 MB) — confirmed inside the directory Workers
    Builds' build caching auto-detects and caches for Astro projects
- File: `docs/phase-04/loader.md` (new)
  - The full incremental-signal design writeup: why `updated_at` alone doesn't work, the three
    sync modes and their triggers, every constant and env var, the measured budgets with their
    margins, the 7-day staleness bound, and the projected daily D1 rows at 12 builds/day
    (≈186,787 rows/day ≈ 9.3% of the daily soft budget) computed from this session's real
    measurements rather than the planner's earlier conservative estimate
- File: `src/content/loaders/articles-loader.ts`
  - **Bug fix (found during this task's own measurement, before it could reach production):**
    the loader originally set `meta.lastSweep` on every cold build too ("a cold pass subsumes
    what a sweep would catch") — a design choice that silently contradicted the mode matrix: the
    very next build after any cold pass would show `mode=warm`, never `mode=warm+sweep`,
    permanently skipping the sweep-mode code path in real deployments. Removed; a cold pass no
    longer touches `lastSweep` at all
  - `WARM_ROWS_READ_BUDGET` / `SWEEP_ROWS_READ_BUDGET` / `COLD_ROWS_READ_BUDGET` comments replaced
    with citations to this session's real measurements (the numeric values already cleared the
    "≥2x measured" bar, so no value changed)
- KV: committed the real articles last-good baseline (`build:last-good`,
  `articles.count: 40049`, `buildHash: 'phase-04-baseline'`) to the live
  `915tldr-render-manifest` namespace

## Why

REND-01/REND-02's fail-loud/cost-budget guarantees are only real once they're checked against
real production data at real corpus scale — every number in `build-measurements.md` before this
task was either projected or measured against a mocked `fetchImpl`. This task closes that gap:
the loader now has a proven cold path, a proven sweep transition, a proven warm steady state, and
a real committed baseline the never-shrink check can compare every future build against.

## Issues Encountered

**The lastSweep-on-cold bug (see What Changed) was found by the measurement process itself
working as designed** — Task 3's own action list asked for the build immediately after cold to
show `mode=warm+sweep`, and it didn't, on the first attempt. Investigated rather than
force-fixed by document. Fixed in code, then the cold build was **genuinely re-run** (not
reused) so the recorded cold-build figures reflect the corrected code, not the buggy one — the
first cold-build measurement (before the fix) is not what's recorded in
`build-measurements.md`.

**A stale `lastSweep` value from the pre-fix cold-build run persisted in the local
`node_modules/.astro` content-layer cache** even after the code fix (meta values only change when
explicitly `set()` again; a build that doesn't touch a key leaves whatever was there). Cleared by
parsing and rewriting the `devalue`-serialized `meta:articles` collection to delete that one key —
**no file was deleted**, per this project's "never `rm`" rule; the fix is a targeted rewrite of a
gitignored, fully regenerable build-cache file's content, equivalent to what a fresh Workers
Builds container (which has never cached this directory before) would see.

**`/usr/bin/time -v` is not installed on this machine** (`pacman -Q time` confirms the package
exists in the `extra` repo but isn't installed; installing a new system package without asking
was judged out of scope for an unattended executor run). Peak RSS was instead measured by polling
`/proc/<pid>/status`'s `VmHWM` field — the kernel's own monotonic high-water-mark — at 1-second
intervals for the whole build and taking the final sample, which reports the identical figure
`/usr/bin/time -v`'s "Maximum resident set size" would.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a genuine cold build, two consecutive warm builds (first `warm+sweep`, then
  plain `warm`), and a `BUILD_STATE_REQUIRE_BASELINE=1` build after the baseline commit — all
  against real production D1 and the real `915tldr-render-manifest` KV namespace, not mocks.
  `pnpm run test:fast` (207 tests) and a final `pnpm run build` were both re-run clean after every
  code change in this task.
- What wasn't tested: an actual forced hard-delete scenario against production data (would require
  deleting a real article, out of scope) — `evaluateShrink`'s unit tests (04-03 Task 1) already
  cover this behavior against a fake baseline.
- Edge cases: `changed=0` on every one of the three real builds in this session (cold, warm+sweep,
  warm) — the digest-based skip works correctly at full-corpus scale, not just in a unit test's
  small fixture.

## Next Steps

- [ ] 04-04+ can now rely on a real, populated render manifest (40,049 entries) and a committed
      last-good baseline for every subsequent Phase 4 plan
- [ ] Monitor the real daily D1 rows-read total against the ≈186,787/day projection once the
      loader runs on the production 2-hour cron (04-09+)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH — this is the measured, production-verified baseline the rest of Phase 4 (and the
eventual cron-triggered deploy pipeline) depends on. No user-facing page change in this task
itself.

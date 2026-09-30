---
phase: 04-static-generation-templates-seo
plan: 03
subsystem: content-pipeline
tags: [astro, content-layer, d1, cloudflare-kv, tdd, budgets, build-measurement]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-01's window-only Content Layer loader (articlesLoader), src/lib/server/d1-client.ts and kv-manifest.ts as extended by 04-01, and the bulk-fetch+stitch query shape measured in docs/phase-03/d1-pagination-report.md"
provides:
  - "src/lib/server/build-state.ts — last-good state in KV (build:last-good), per-build pending state file, D-14's never-shrink check (evaluateShrink)"
  - "Cold/sweep D1 fetchers (fetchAllArticlesStitched, fetchArticlesStitchedByIds, fetchChangedSince) sharing one extracted stitchArticles() with the existing window fetch"
  - "The full REND-01/REND-02 loader: cold/warm/warm+sweep mode selection, per-mode measured rows-read budgets, manifest bulk-write/bulk-delete, D-14 shrink enforcement — all before any store mutation"
  - "tools/sync-dry-run.mjs — the CLAUDE.md-mandated dry run, run before any cold-capable code existed"
  - "docs/phase-04/build-measurements.md and docs/phase-04/loader.md — real measured cold/warm build figures against production D1/KV, and the full incremental-signal design writeup"
  - "A real, committed last-good baseline (articles.count: 40049) in the live 915tldr-render-manifest KV namespace"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 40836
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "stitchArticles() extracted as the single classification function every D1 fetcher (window/cold/sweep) shares — a fetcher-specific reimplementation would have let a cold build and a warm build silently disagree about what counts as public"
    - "Mandatory ordering inside Loader.load(): fetch -> prospective id set (in memory) -> budget check -> category check -> evaluateShrink -> only then mutate store/write manifest/update meta — every check that can throw runs before any side effect"
    - "Cold-mode digest snapshotting: previousDigests captured before store.clear() so an unchanged article isn't reported as changed after a full-corpus rebuild (store.set()'s own return value can't detect this once the store is empty)"
    - "Peak RSS measured via /proc/<pid>/status VmHWM polling (kernel monotonic high-water-mark) instead of /usr/bin/time -v, which isn't installed on this machine — equivalent figure, no new dependency"

key-files:
  created:
    - src/lib/server/build-state.ts
    - tools/sync-dry-run.mjs
    - docs/phase-04/build-measurements.md
    - docs/phase-04/loader.md
    - tests/unit/build-state.test.mjs
    - tests/unit/d1-client-cold.test.mjs
    - tests/unit/articles-loader.test.mjs
  modified:
    - src/content/loaders/articles-loader.ts
    - src/lib/server/d1-client.ts
    - src/lib/server/kv-manifest.ts
    - tests/unit/articles-loader-window.test.mjs

key-decisions:
  - "evaluateShrink's explained set is every observed nonPublic uuid from this build's own fetch, not filtered against previous.ids first — evaluateShrink itself intersects explained against missing, so passing the full set is safe and simpler than pre-filtering"
  - "Cold mode deliberately does NOT set meta.lastSweep — a real bug (see Deviations) where it originally did, which silently skipped warm+sweep mode on the build immediately following every cold pass in production"
  - "Rule 1/2 fix: articles with a NULL/empty summary (140 of ~40,183 public-status rows, real production data) are classified nonPublic with reason 'missing-summary', identical to the existing no-primary-category pattern, rather than crashing the whole build on a Zod schema violation"
  - "Provisional budgets (WARM/SWEEP/COLD_ROWS_READ_BUDGET) were already round numbers at or above 2x every measured figure — no numeric value changed in Task 3, only the citing comments"
  - "Peak RSS measured via /proc/<pid>/status VmHWM polling since /usr/bin/time -v is not installed on this machine (pacman -Q time confirms available-but-uninstalled) and installing a new system package unattended was judged out of scope"

patterns-established:
  - "A stale content-layer meta key from a since-fixed code path does not self-correct — meta.set() only overwrites keys a build actually touches. Cleared surgically by parsing/rewriting node_modules/.astro/data-store.json's devalue-serialized meta:articles collection (no file deleted, per project rule) rather than assuming a re-run resets state."

requirements-completed: [REND-01, REND-02, REND-05]

coverage:
  - id: D1
    description: "A dry run (read-only, 4 SELECT COUNT(*) statements) reports row counts, projected cold cost and cites live Cloudflare pricing, recorded before any cold-capable loader code exists — CLAUDE.md's budget gate satisfied by construction, not by convention"
    verification:
      - kind: other
        ref: "docs/phase-04/build-measurements.md#Dry run — projected total cost $0.000000, well under the $1 threshold"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-14's never-shrink check (evaluateShrink) correctly distinguishes explained vs. unexplained removals, honors an explicit allowance, and requires an explicit bootstrap acknowledgment when a baseline is mandatory but missing"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/build-state.test.mjs#evaluateShrink: (8 cases covering growth/explained/unexplained/allowance/empty/bootstrap/no-baseline)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cold and sweep D1 fetchers (fetchAllArticlesStitched keyset-paginated at LIMIT 5000, fetchArticlesStitchedByIds chunked at <=100 params, fetchChangedSince) share stitchArticles' exact classification rules with the existing window fetch"
    requirement: "REND-01"
    verification:
      - kind: unit
        ref: "tests/unit/d1-client-cold.test.mjs (11 tests: pagination cursoring, param-count ceiling, stitch-rule reuse, missing-summary classification)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The loader selects cold/warm/warm+sweep automatically, enforces its own per-mode rows-read budget and the D-14 shrink check before any store mutation, validates every article's category, and keeps the KV manifest in step (bulk write of changed entries, bulk delete of removed uuids, rewrite-all on a schema-version bump)"
    requirement: "REND-01"
    verification:
      - kind: unit
        ref: "tests/unit/articles-loader.test.mjs (24 tests: full mode-selection matrix, budget/shrink throw-before-mutation proofs, category validation, manifest write/delete/rewrite-all, post-success meta updates)"
        status: pass
      - kind: unit
        ref: "tests/unit/articles-loader-window.test.mjs (7 tests, 04-01 window-sync behavior re-verified under the new mode-selection logic)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A build whose D1 rows read exceed the active mode's budget, or whose shrink check fails, throws before any store mutation, manifest write, or meta update — proven by asserting the store is byte-identical (same entries, same digests) after each failure"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/articles-loader.test.mjs#warm rowsRead above WARM_ROWS_READ_BUDGET throws, and the store/manifest/meta are untouched"
        status: pass
      - kind: unit
        ref: "tests/unit/articles-loader.test.mjs#a failed shrink check throws, and the store/manifest/meta are untouched"
        status: pass
    human_judgment: false
  - id: D6
    description: "A real cold build (BUILD_STATE_BOOTSTRAP=1 ARTICLES_FORCE_COLD=1) against production D1/KV completes successfully, its public-article count is within 1% of an independent dry-run count, and the content-layer store is confirmed to live inside Workers Builds' auto-cached directory"
    requirement: "REND-01"
    verification:
      - kind: other
        ref: "docs/phase-04/build-measurements.md#Cold build — loader public=40049 vs. dry-run public=40193 (0.358% difference, fully explained); data store at node_modules/.astro/data-store.json (63MB), confirmed inside the Workers Builds auto-cached directory (D-06)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Per-mode rows-read budgets are measured (not guessed) from a real cold build and two real warm builds (warm+sweep then warm), each cited in a comment next to its constant; a real last-good baseline is committed to KV and a subsequent BUILD_STATE_REQUIRE_BASELINE=1 build succeeds against it with no bootstrap flag"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "docs/phase-04/build-measurements.md#Warm builds and #Baseline committed to KV — mode=warm+sweep (rowsRead=49178) then mode=warm (rowsRead=5928); BUILD_STATE_REQUIRE_BASELINE=1 build succeeded logging mode=warm rowsRead=5911 with no shrink failure"
        status: pass
    human_judgment: false

duration: ~43min
completed: 2026-09-26
status: complete
---

# Phase 4 Plan 03: D1 Loader — Cold/Warm/Sweep Sync, Budgets, Shrink Check & Manifest Deletes Summary

**The tracer's window-only loader is now the full REND-01/REND-02 loader — cold/warm/warm+sweep mode selection, measured per-mode D1 rows-read budgets, D-14's never-shrink check, and KV manifest bulk-delete — proven against real production D1/KV with a genuine cold build (40,049 pages, 506,806 rows read) and a committed last-good baseline.**

## Performance

- **Duration:** ~43 min
- **Started:** 2026-09-26T17:40:00-06:00
- **Completed:** 2026-09-26T18:23:07-06:00
- **Tasks:** 3
- **Files modified:** 15 (7 created, 4 source/test files modified, plus docs and changelog)

## Accomplishments

- Built `src/lib/server/build-state.ts`: KV-persisted last-good state (survives a Workers Builds
  cache purge), a per-build pending-state file, and `evaluateShrink()` implementing D-14's full
  never-shrink decision matrix (growth, explained removals, an explicit allowance, and a
  bootstrap/require-baseline pair for the very first baseline).
- Extracted `stitchArticles()` so the window fetch, the new full-corpus cold fetcher
  (`fetchAllArticlesStitched`, keyset-paginated at `LIMIT 5000`), and the sweep re-fetcher
  (`fetchArticlesStitchedByIds`, chunked at `D1_MAX_BOUND_PARAMS`) all apply identical
  public/non-public classification rules.
- Rewrote the loader into the full three-mode sync engine (cold/warm/warm+sweep) with mandatory
  check-before-mutate ordering, proven by tests that assert the store is byte-identical after a
  budget failure and after a shrink failure.
- **Found and fixed two real bugs no unit test could have caught:** (1) 140 of ~40,183
  production articles have a NULL/empty `summary`, crashing the cold path entirely until
  `stitchArticles` learned to classify them non-public; (2) the loader originally set
  `meta.lastSweep` on cold builds too, silently skipping `warm+sweep` mode on every real
  deployment's first post-cold build — found by Task 3's own measurement sequence not matching
  its expected `cold -> warm+sweep -> warm` output.
- Ran the first genuinely measured full-corpus build against real production D1/KV: cold build
  (40,049 pages, 506,806 rows read, 2.54 GB peak RSS, 65s), then `warm+sweep` (49,178 rows) then
  `warm` (5,928 rows) — confirmed the content-layer store lives inside Workers Builds' auto-cached
  directory (D-06) and committed a real last-good baseline to the live
  `915tldr-render-manifest` KV namespace.

## Task Commits

Each task was committed atomically (Tasks 1-2, `tdd="true"`, both confirmed genuine RED before
GREEN):

1. **Task 1: Dry run, last-good state, cold/sweep D1 fetchers** (tdd="true") - `e530441` (feat;
   RED confirmed via `ERR_MODULE_NOT_FOUND` before this commit, then made GREEN in the same
   commit per this plan's TDD convention of one combined RED-then-GREEN commit for genuinely new
   modules)
2. **Task 2: Loader modes, budgets, shrink check, manifest deletes** (tdd="true") - `bfb98af`
   (feat; RED confirmed via the same missing-export failure mode before implementation)
3. **Task 3: First measured full-corpus build** - `6d62b7b` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified

- `src/lib/server/build-state.ts` (new) - `LAST_GOOD_KEY`, `readLastGood()`,
  `writePendingBuildState()`, `readPendingBuildState()`, `commitLastGood()`, `evaluateShrink()`
- `src/lib/server/d1-client.ts` - `stitchArticles()` extracted; `fetchAllArticlesStitched()`,
  `fetchArticlesStitchedByIds()`, `fetchChangedSince()` added; `missing-summary` classification
- `src/lib/server/kv-manifest.ts` - `deleteManifestEntries()` (KV REST bulk-delete)
- `src/content/loaders/articles-loader.ts` - rewritten for cold/warm/warm+sweep mode selection,
  measured budgets, D-14 enforcement, manifest bulk write/delete/rewrite-all
- `tools/sync-dry-run.mjs` (new) - the CLAUDE.md-mandated dry run
- `docs/phase-04/build-measurements.md` - real dry-run, cold-build and warm-build figures
- `docs/phase-04/loader.md` (new) - the full incremental-signal design writeup
- `tests/unit/build-state.test.mjs`, `tests/unit/d1-client-cold.test.mjs`,
  `tests/unit/articles-loader.test.mjs` (new) - 50 new tests
- `tests/unit/articles-loader-window.test.mjs` - deps seams updated for the new mode-selection
  logic (per plan instruction), assertions unchanged

## Decisions Made

- `evaluateShrink`'s `explained` set is passed as every observed nonPublic uuid from the current
  fetch, not pre-filtered against `previous.ids` — the function's own intersection logic makes
  pre-filtering redundant.
- Cold mode does not set `meta.lastSweep` (a real bug found and fixed this session — see
  Deviations).
- A NULL/empty `summary` is classified `nonPublic` with reason `missing-summary`, matching the
  existing `no-primary-category` pattern.
- Provisional budgets needed no numeric change in Task 3 — all three already cleared "≥2x
  measured" with real numbers; only their comments were updated to cite the measurements.
- Peak RSS measured via `/proc/<pid>/status` `VmHWM` polling rather than installing
  `/usr/bin/time` (not present on this machine, and installing a new system package unattended was
  judged out of scope for this task).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NULL/empty `summary` crashes the entire cold build**
- **Found during:** Task 2, first real `pnpm run build` after wiring the cold path in
- **Issue:** 140 of ~40,183 public-status production articles have a NULL or empty `summary`
  column (a legacy content-pipeline gap the 04-01/04-02 window-scoped fetch never reached). The
  Zod schema's `summary: z.string().min(1)` threw `InvalidContentEntryDataError` and aborted the
  whole build.
- **Fix:** `stitchArticles()` now classifies a NULL/empty `summary` as `nonPublic` with reason
  `missing-summary`, before it ever reaches schema validation — identical treatment to the
  existing `no-primary-category` exclusion.
- **Files modified:** `src/lib/server/d1-client.ts`, `tests/unit/d1-client-cold.test.mjs`
- **Verification:** `node --test tests/unit/d1-client-cold.test.mjs` green; a real cold build
  against production D1 completed successfully afterward.
- **Committed in:** `bfb98af` (Task 2 commit)

**2. [Rule 1 - Bug] Cold mode silently skipped `warm+sweep` on the very next build**
- **Found during:** Task 3, running the plan's own verification sequence (cold build, then a
  warm build expected to log `mode=warm+sweep`)
- **Issue:** The loader's first draft (Task 2) also set `meta.lastSweep` on every cold build ("a
  cold pass subsumes what a sweep would catch"). This meant the build immediately following ANY
  cold pass would always resolve to plain `warm`, never `warm+sweep` — permanently skipping the
  sweep-mode code path in real deployments, since a cold resync happens at most once every 7
  days and every build after it would see a "recent" `lastSweep` it never actually earned.
- **Fix:** Removed `meta.set('lastSweep', ...)` from the cold branch entirely. Re-ran the cold
  build with the corrected code (the first, pre-fix cold-build measurement was discarded, not
  recorded) so `docs/phase-04/build-measurements.md` reflects the shipped behavior.
- **Files modified:** `src/content/loaders/articles-loader.ts`
- **Verification:** The corrected build sequence produced `mode=cold` -> `mode=warm+sweep` ->
  `mode=warm`, exactly as the plan's own action text expects; `tests/unit/articles-loader.test.mjs`
  remained green throughout (no test asserted the buggy behavior).
- **Committed in:** `6d62b7b` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — real bugs found by running actual code against
real production data and the plan's own verification sequence, not by unit tests against mocked
fixtures).
**Impact on plan:** Both fixes were necessary for the full corpus to build at all (fix 1) and for
the loader's own documented mode matrix to behave as designed in production (fix 2). No scope
creep — neither fix touched anything outside this plan's own files.

## Issues Encountered

**A stale `lastSweep` meta value from the pre-fix cold-build run persisted in the local
`node_modules/.astro` content-layer cache** even after the code fix landed — `meta.set()` only
overwrites a key a build actually touches, so a build that no longer calls `meta.set('lastSweep',
...)` on cold leaves whatever an EARLIER (buggy) build already wrote. Resolved by parsing and
rewriting `node_modules/.astro/data-store.json`'s `devalue`-serialized `meta:articles` collection
to delete that one stale key — no file was deleted, per this project's "never `rm`" rule; this is
a targeted content rewrite of a gitignored, fully regenerable build-cache file, equivalent to what
a fresh Workers Builds container (which has never cached this directory) would see on its own
first build.

**`/usr/bin/time -v` is not installed on this machine** (`pacman -Q time` shows the package exists
in the `extra` repo but is not installed). Rather than installing a new system package
unattended, peak RSS was measured by polling `/proc/<pid>/status`'s `VmHWM` field (the kernel's
own monotonic high-water-mark) at 1-second intervals for the whole build — reports the identical
figure `/usr/bin/time -v`'s "Maximum resident set size" would.

## Known Stubs

None. Every module built this plan (`build-state.ts`, the cold/sweep `d1-client.ts` fetchers, the
rewritten loader, `sync-dry-run.mjs`) is real, production-verified code — the cold build actually
ran against real production D1/KV and wrote real manifest entries and a real KV baseline, not a
mock or a placeholder.

## Cleanup needed (run these yourself)

None new from this plan. Carried forward from 04-01/04-02, unchanged and untouched (per this
plan's own project rules — do not restore or stage these):
```
rm /home/jaime/www/_github/915tldr.com/src/lib/slug.ts
rm /home/jaime/www/_github/915tldr.com/src/lib/render-cost-harness.ts
rm /home/jaime/www/_github/915tldr.com/tools/measure-render-cost.mjs
```

## User Setup Required

None - `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` were already present in the shell
environment (carried forward from Phase 3), and the `915tldr-render-manifest` KV namespace
already existed.

## Next Phase Readiness

- The loader, its budgets, and a real committed last-good baseline are ready for every subsequent
  Phase 4 plan (04-04 onward) to build on directly — no redesign expected.
- The real production render manifest now holds entries for the full corpus (40,049 articles),
  not just the earlier window-scoped subset — 04-06's non-canonical-URL Worker redirect (D-08)
  can rely on this being populated at real scale, not just for a 328-article tracer slice.
- Real daily D1 rows-read projection at 12 builds/day (~186,787 rows, 9.3% of the soft budget) is
  recorded in `docs/phase-04/loader.md` for the eventual cron-triggered deploy pipeline (04-09) to
  validate against once it's live.
- The `missing-summary` content-quality gap (140 rows) is now safely excluded from the public set
  rather than blocking builds, but it is NOT re-processed or fixed at the source — that remains
  PROJECT.md's Phase 2 content-quality scope (already validated/shipped), not this phase's.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-26*

## Self-Check: PASSED

All claimed created files verified present on disk (`src/lib/server/build-state.ts`,
`tools/sync-dry-run.mjs`, `docs/phase-04/build-measurements.md`, `docs/phase-04/loader.md`,
`tests/unit/build-state.test.mjs`, `tests/unit/d1-client-cold.test.mjs`,
`tests/unit/articles-loader.test.mjs`, this SUMMARY). All claimed commit hashes verified present
in `git log` (`e530441`, `bfb98af`, `6d62b7b`).

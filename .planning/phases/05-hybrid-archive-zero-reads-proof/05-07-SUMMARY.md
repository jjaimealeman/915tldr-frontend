---
phase: 05-hybrid-archive-zero-reads-proof
plan: 07
subsystem: infra
tags: [cloudflare-r2, archive-tier, build-time-write, task-pool, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-02's src/lib/server/r2-client.ts (createArchiveStore/hasR2Credentials, the R2
      write chokepoint), 05-03's Worker archive-serving branch and R2 key scheme
      (articleArchiveKey/tagArchiveKey), and 05-06's tools/partition-archive.mjs
      (dist/archive-plan.json, the contract this plan's sync tool reads)"
provides:
  - "tools/archive-sync.mjs: pre-deploy phase (upload new-to-archive pages, move-back on
    failure/deadline/--limit) and post-deploy phase (re-upload changed pages, delete orphans
    with a cap, backlog/force-full/daily-report bookkeeping) — CLI + importable module"
  - "tools/lib/run-pool.mjs: runPool — a bounded-concurrency, deadline-aware task pool with
    per-item error isolation, the primitive both sync phases share"
  - "A branch guard (isR2WriteBlocked/wrapStoreForBranchGuard) refusing every R2 write whenever
    WORKERS_CI is set and WORKERS_CI_BRANCH is not main — orchestrator-directed defense-in-depth
    against the Workers Builds dashboard writing R2 secrets to non-production triggers"
  - "docs/phase-05/archive-architecture.md: the design record 05-08/05-09/05-10 and later
    debugging will read"
affects: ["05-08 (wires archive-sync.mjs into tools/ci-build.mjs's real deploy step, adds ntfy
  alerts/the daily report delivery/the 70,000 alarm)", "05-09 (first production archive deploy,
  fills in this plan's doc's Measurements section)", "05-10 (forced full re-upload via
  request-full, also fills in the Measurements section)"]

# Actuals (#2632)
actuals:
  tokens: 23519
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A hand-rolled deadline-aware task pool (tools/lib/run-pool.mjs), not p-limit
      (05-RESEARCH.md's own supporting-library suggestion) — p-limit has no deadline concept at
      all, and both upload phases must stop launching NEW work at a fixed wall-clock deadline
      while letting in-flight work finish. Single-threaded-JS discipline (no await between
      claiming an index and incrementing the cursor) makes the pool's own concurrency bookkeeping
      lock-free."
    - "Merge-on-write for the R2 bookkeeping index: re-read immediately before writing, apply
      only this run's own additions/removals — a concurrent build's write in between is never
      clobbered, at worst causing a redundant re-upload later (accepted, documented)."
    - "A write-boundary guard, not just a top-level early return: wrapStoreForBranchGuard wraps
      putObject/putJson/deleteObjects so even a caller that reaches for the store directly (not
      through runPreSync/runPostSync's own disabled-check) still can't write on a non-main CI
      branch. Fail-closed-with-a-throw, matching this codebase's existing chokepoint-module
      convention (r2-client.ts's assertArchiveKey) rather than a silent no-op."
    - "Index-removal correctness: an orphan key is only dropped from the bookkeeping index once
      R2's deleteObjects call actually confirms it deleted — a key that errors keeps its index
      entry, so a real still-existing R2 object is never silently un-tracked."

key-files:
  created:
    - tools/archive-sync.mjs
    - tools/lib/run-pool.mjs
    - tests/unit/archive-sync.test.mjs
    - tests/unit/run-pool.test.mjs
    - docs/phase-05/archive-architecture.md
  modified: []

key-decisions:
  - "The branch guard (orchestrator-directed) is implemented as a store-wrapping function
    (wrapStoreForBranchGuard) applied at every call site that constructs a store — not merely an
    early-return in runPreSync/runPostSync — so the refusal holds even if a future caller
    bypasses the top-level disabled-check. Chosen to throw (fail closed) rather than silently
    no-op, matching r2-client.ts's own assertArchiveKey convention; justified in
    tools/archive-sync.mjs's own header comment."
  - "diffAgainstIndex's 'new' classification is never touched by the post phase — only pre
    uploads genuinely new keys, because a new key's source file lives in dist/archive only until
    partition's own output for THIS build; post's 'changed' set only ever concerns
    already-indexed keys whose source file is still physically present in dist/archive (never
    touched by pre's move-back, since move-back only applies to keys pre itself just tried and
    failed to upload)."
  - "ARCHIVE_CONTENT_TYPE is 'text/html' (no charset parameter) for every R2 PUT, matching
    05-03's own live-measured Worker-serving Content-Type exactly — an uploaded page and the
    Worker's own served response agree byte-for-byte on this header."

requirements-completed: []

coverage:
  - id: D1
    description: "A real build's new-to-archive pages reach R2 via the pre-deploy phase; any
      page that fails, times out, or is held back by --limit is moved back into dist/client
      before the deploy would run"
    requirement: "REND-07"
    verification:
      - kind: integration
        ref: "live run (2026-10-01): node tools/archive-sync.mjs pre --limit 50 --json against a
          real 60,397-page build — uploaded:50, movedBack:30428, a 50-entry R2 index written; 3
          spot-checked headObject calls matched the plan's sha256/bytes exactly"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPreSync — a store whose putObject fails for 2
          of 10 new keys moves exactly those 2 back and records 8 in the index"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second pre run after a fresh build does not re-upload already-indexed keys —
      the index diff correctly distinguishes new from already-archived"
    verification:
      - kind: integration
        ref: "live run (2026-10-01): a second pre --limit 50 after pnpm run build uploaded a
          DIFFERENT 50 pages (index grew from 50 to 100 entries) — 0 re-uploads of the first 50"
        status: pass
    human_judgment: false
  - id: D3
    description: "The post-deploy phase re-uploads only content that actually changed (sha256
      differs, or force-full is set); a failed re-upload keeps the previous object serving"
    requirement: "REND-07"
    verification:
      - kind: integration
        ref: "live run (2026-10-01): post on an unchanged build re-uploaded 0 pages; after a
          one-page content edit, exactly 1 key was re-uploaded and its R2 metadata sha256
          matched the edited bytes; a restore run re-uploaded the ORIGINAL bytes once more"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPostSync — uploads changed keys; a failed
          re-upload is not written to the index, counts in failed, and alerts naming the count"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-10/REND-12: both phases stop launching new uploads at a deadline measured
      from the build's own start; work left over becomes a tracked backlog, never a build
      failure; a backlog older than 20h raises an alert"
    requirement: "REND-12"
    verification:
      - kind: unit
        ref: "tests/unit/run-pool.test.mjs#run-pool — once now() >= deadlineAt, no new item
          starts; already-started items finish; untouched items land in notStarted"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPostSync — a deadline already passed defers
          every changed key and records a fresh backlog; a backlogSince older than 20h adds the
          D-10 alert; a later run that clears the backlog sets backlogCount 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-12: a partial upload failure never stops the other pages in the same run,
      and the result line names how many failed"
    verification:
      - kind: unit
        ref: "tests/unit/run-pool.test.mjs#run-pool — a worker that throws lands in failed with
          its error; the other items still complete"
        status: pass
    human_judgment: false
  - id: D6
    description: "Deletions of pages that vanished entirely are capped at max(50, 1% of the
      index) per run; above the cap nothing is deleted and an alert is raised; promoted orphans
      (pages that moved to static) delete freely"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPostSync — deletes promoted orphans freely;
          vanished orphans only when under the cap, else none deleted and an alert fires"
        status: pass
    human_judgment: false
  - id: D7
    description: "The orchestrator-directed branch guard refuses every R2 write when running on
      Workers CI on a non-main branch, even with valid credentials present (the leaked-secret
      scenario), and never touches the store at all in that case; main and local runs are
      unaffected"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#wrapStoreForBranchGuard/isR2WriteBlocked/
          runPreSync — refuses every write method before any request is built on a non-main CI
          branch (0 underlying store calls); writes pass through unchanged on main or locally"
        status: pass
    human_judgment: false
  - id: D8
    description: "If R2 credentials are missing or the archive index cannot be read, the
      pre-deploy phase moves every planned page back into dist/client (fully static, like Phase
      4) and reports an alert instead of failing the deploy"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPreSync — missing credentials moves all
          planned pages back and returns disabled with an alert; an index read that throws moves
          all planned pages back, returns an alert, exit code 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "The last stdout line of every run is ARCHIVE_SYNC_RESULT followed by a JSON
      result the downstream build wrapper (05-08) can parse; pre exits 1 only when the plan is
      missing/invalid; post never exits non-zero"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#runPreSync/runPostSync — pre exits 1 only when
          the plan is missing or invalid; post never exits non-zero, even when the plan is
          missing; the result object is JSON-serializable and carries every required field"
        status: pass
    human_judgment: false
  - id: D10
    description: "docs/phase-05/archive-architecture.md records the key scheme, routing, sync
      sequence, invariants, deadlines, failure modes, cost, and which ceiling governs REND-12"
    verification:
      - kind: other
        ref: "test -f docs/phase-05/archive-architecture.md && grep -c 'Which ceiling governs
          REND-12' docs/phase-05/archive-architecture.md -> 1"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 7: Archive Tier R2 Sync (Pre/Post Deploy) Summary

**`tools/archive-sync.mjs`'s pre-deploy (upload new, move-back on failure) and post-deploy
(re-upload changed, delete orphans, track backlog, report daily) phases, backed by a hand-rolled
deadline-aware task pool, proven live against the real `915tldr-archive` R2 bucket — including an
orchestrator-directed branch guard that refuses every R2 write outside Workers CI's `main` branch.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-10-01T00:45:00-06:00 (approx. — context/plan read began immediately after
  05-06 completed)
- **Completed:** 2026-10-01T01:23:00-06:00
- **Tasks:** 3 (Task 1 tracer + TDD, Task 2 auto + TDD, Task 3 auto)
- **Files modified:** 5 (all new)

## Accomplishments

- `tools/lib/run-pool.mjs`: `runPool(items, { concurrency, deadlineAt, now, worker })` — never
  exceeds `concurrency` in-flight workers, isolates a failing worker's error to its own item
  without stopping the pool, and stops launching new work once `now() >= deadlineAt` while
  letting already-started work finish. 8 unit tests, including a real-wall-clock deadline test
  that exercises the actual race between concurrent workers claiming work.
- `tools/archive-sync.mjs`'s **pre-deploy phase** (`runPreSync`): uploads pages new to the
  archive tier; moves anything that failed, missed the deadline, or sat beyond `--limit` back
  into `dist/client` before `wrangler deploy` would run — proven live: a `--limit 50` run against
  a real 60,397-page build uploaded exactly 50 pages, moved the other 30,428 back (`dist/client`'s
  file count rose from 29,937 to 60,365, matching exactly), wrote a 50-entry R2 index, and 3
  spot-checked `headObject` calls matched the plan's sha256/bytes exactly. A second `--limit 50`
  run after a fresh build uploaded a different 50 (index grew to 100 entries) — 0 re-uploads of
  the first 50.
- `tools/archive-sync.mjs`'s **post-deploy phase** (`runPostSync`): re-uploads changed pages
  (sha256 differs, or the force-full marker is set), deletes R2 copies of pages promoted to
  static (freely) or vanished entirely (capped at `max(50, 1% of the index)`), tracks a backlog
  with a 20-hour alert when the deadline cuts a run short, and fires a daily report once per
  America/Denver calendar date — proven live: an unchanged-build run re-uploaded 0 pages; a
  one-page content edit was re-uploaded exactly once with R2 metadata sha256 matching the edited
  bytes; a restore run re-uploaded the original bytes once more.
- **Orchestrator-directed branch guard** (`isR2WriteBlocked`/`wrapStoreForBranchGuard`): refuses
  `putObject`/`putJson`/`deleteObjects` — before any request is built — whenever `WORKERS_CI` is
  set and `WORKERS_CI_BRANCH` is not `main`. Defense-in-depth against the Workers Builds
  dashboard twice silently writing the R2 build secrets onto the non-production trigger
  (05-02-SUMMARY.md's own carried-forward flag). The guard lives at the store boundary itself
  (not just an early return), so a caller that reaches for the store directly still can't write.
- `docs/phase-05/archive-architecture.md`: the R2 key scheme (and why keys are derived fresh per
  request, never stored in the manifest), the Worker's routing diagram, the full build sequence
  and its two no-404-window invariants, the `_meta/*` object formats, deadlines and the backlog
  rule, a D-09..D-13 decision-to-mechanism table, a 7-row failure-mode table, cost, and the
  "Which ceiling governs REND-12" resolution.

## Task Commits

1. **Task 1 (tracer + TDD):** `705b049` (feat) — `tools/lib/run-pool.mjs`,
   `tests/unit/run-pool.test.mjs`, `tools/archive-sync.mjs`
2. **Task 2 (auto + TDD):** `3f89757` (test) — `tests/unit/archive-sync.test.mjs`
3. **Task 3 (auto):** `97b0fa1` (docs) — `docs/phase-05/archive-architecture.md`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `tools/lib/run-pool.mjs` - bounded-concurrency, deadline-aware task pool (new)
- `tools/archive-sync.mjs` - pre/post archive sync CLI + module, the branch guard (new)
- `tests/unit/run-pool.test.mjs` - 8 tests (new)
- `tests/unit/archive-sync.test.mjs` - 28 tests (new)
- `docs/phase-05/archive-architecture.md` - design record (new)

## Decisions Made

- The branch guard is implemented at the store-wrapping boundary (`wrapStoreForBranchGuard`), not
  only as an early return in `runPreSync`/`runPostSync` — so a future caller that reaches for
  `createArchiveStore()` directly still cannot write on a non-main CI branch. Chosen to throw
  (fail closed) rather than silently no-op, matching `r2-client.ts`'s own `assertArchiveKey`
  convention of loud rejection over silent coercion.
- `runPostSync`'s "changed" set deliberately never includes `diffAgainstIndex`'s "new" keys —
  only `pre` uploads genuinely new-to-archive pages, because a new key's source file in
  `dist/archive` only survives there until `pre`'s own move-back step for THAT build; post's
  "changed" set only concerns already-indexed keys, whose source files are never touched by
  `pre`'s move-back logic (which only acts on keys `pre` itself just tried and failed).
- `ARCHIVE_CONTENT_TYPE` is `'text/html'` (no charset parameter) for every R2 upload, matching
  05-03's own live-measured Worker Content-Type exactly — verified by this plan's own live
  `headObject` spot checks.
- **REND-07 and REND-12 are intentionally left Pending in REQUIREMENTS.md**, despite being listed
  in this plan's frontmatter `requirements` field — matching this phase's own established
  precedent (05-02/05-04/05-05/05-06 each left their own listed requirement Pending when only
  partially satisfied). REND-07 ("rendered once to R2 and served from there") now has BOTH halves
  proven live against the real bucket (serving since 05-03, upload since this plan) but only for
  ~100 of ~30,478 archive-tier pages — the full-corpus upload running inside the real production
  deploy pipeline is 05-08 (wiring)/05-09 (first production deploy)'s job, not this plan's.
  REND-12 ("a full archive re-render completes without exceeding Worker CPU limits") now has the
  governing-ceiling question resolved and deadline-bounded phases built and proven, but the full
  re-render has not yet run end-to-end at corpus scale inside a real Workers Builds build — that
  measurement is explicitly 05-10's job ("forced full re-upload"). Marking either requirement
  complete now would be premature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Index entries were dropped on an unconfirmed delete**
- **Found during:** Task 2, writing the orphan-deletion test suite
- **Issue:** `runPostSync` removed an index entry for every key it *attempted* to delete via
  `deleteObjects`, regardless of whether R2 actually confirmed that deletion. A key that errored
  (already gone, a transient R2 error, anything else) would still have its index entry dropped —
  a real, still-existing R2 object would silently stop being tracked and never get retried or
  re-deleted on a later run.
- **Fix:** Only drop an index entry for a key `deleteObjects`'s own result actually confirmed
  deleted (excluding every key present in the result's `errors` array).
- **Files modified:** `tools/archive-sync.mjs`
- **Verification:** `tests/unit/archive-sync.test.mjs`'s capped-deletion test (which seeds a
  vanished orphan with no real backing object, forcing a `NoSuchKey` error) now correctly asserts
  the index entry survives; full suite re-run green.
- **Committed in:** `705b049` (Task 1's own commit — the fix was made and verified before Task
  1's commit happened, since both the bug and the fix occurred in the same uncommitted working
  session; Task 2's commit, `3f89757`, is the test file that proves it).

**2. [Orchestrator addition — Rule 2, missing critical functionality] R2-write branch guard**
- **Found during:** Task 1, per this plan's own orchestrator-supplied directive (carried forward
  from 05-02-SUMMARY.md's disclosed flag: the Workers Builds dashboard silently re-wrote the R2
  build secrets onto the non-production trigger twice, 2026-09-30)
- **Issue:** Nothing in `archive-sync.mjs` would have refused an R2 write if a leaked/misplaced
  credential ever reached a non-production build.
- **Fix:** `isR2WriteBlocked(env)`/`wrapStoreForBranchGuard(store, env)` — refuses every write
  method before any request is built whenever `WORKERS_CI` is set and `WORKERS_CI_BRANCH` is not
  `main`; applied at the store-construction boundary in `runPreSync`, `runPostSync`, and
  `requestFullReupload`, not merely as a top-level early return.
- **Files modified:** `tools/archive-sync.mjs`
- **Verification:** `tests/unit/archive-sync.test.mjs`'s branch-guard suite (main allows writes,
  a non-main CI branch blocks with zero underlying store calls even when credentials ARE
  present, a local run is unaffected).
- **Committed in:** `705b049` (Task 1).

---

**Total deviations:** 2 (1 auto-fixed Rule 1 bug, caught by this plan's own test suite before any
live run touched orphan deletion; 1 orchestrator-directed Rule 2 addition, specified in this
plan's own prompt context). No scope creep beyond what the orchestrator explicitly asked for.

## Issues Encountered

None beyond the one disclosed bug above (found and fixed before it ever ran live).

## User Setup Required

None - the R2 bucket and credentials (05-02) already exist and are configured; this plan used
them as-is.

## Next Phase Readiness

- `tools/archive-sync.mjs` exports exactly the surface 05-08-PLAN.md's frontmatter expects
  (`ARCHIVE_INDEX_KEY`, `ARCHIVE_STATE_KEY`, `FORCE_FULL_KEY`, `DAILY_REPORT_KEY`,
  `RESULT_LINE_PREFIX`, `BUILD_STARTED_AT_PATH`, `PRE_DEADLINE_SECONDS`, `POST_DEADLINE_SECONDS`,
  `BACKLOG_ALERT_HOURS`, `diffAgainstIndex`, `runPreSync`, `runPostSync`, `requestFullReupload`)
  and prints the exact `ARCHIVE_SYNC_RESULT ` line 05-08's `tools/ci-build.mjs` is specified to
  parse.
- **Overlap flag for 05-08:** this plan's branch guard already lives at `archive-sync.mjs`'s own
  R2-write boundary, independent of whatever guard 05-08's `ci-build.mjs` wrapper may also add. If
  05-08's plan intends its own guard at the `ci-build.mjs` level, that is complementary
  defense-in-depth, not a conflict — `archive-sync.mjs` will refuse to write even if `ci-build.mjs`
  somehow failed to gate it first.
- `pnpm run test:fast` (644/644), `pnpm run test:build-gate` (9/9) both pass clean after this
  plan's changes. No blockers.
- The real `915tldr-archive` bucket currently holds 100 real archived pages (from this plan's own
  live tracer runs) plus the `_meta/archive-index.json`/`archive-state.json`/`daily-report.json`
  bookkeeping objects — a genuine head start on 05-08/05-09's full-corpus upload, not throwaway
  test data.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

All 5 key files confirmed present on disk; all 3 cited task commit hashes (`705b049`, `3f89757`,
`97b0fa1`) confirmed present in `git log --oneline --all`.

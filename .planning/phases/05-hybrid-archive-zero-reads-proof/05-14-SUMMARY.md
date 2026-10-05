---
phase: 05-hybrid-archive-zero-reads-proof
plan: 14
subsystem: infra
tags: [archive-sync, r2, wrangler, tdd, dry-run, live-deployment, production-safety]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "tools/archive-sync.mjs's runPostSync (05-07), 05-13's ci-build-side CR-01 fix, 05-REVIEW.md's CR-01/WR-01 findings"
provides:
  - "checkLiveDeployment({root,env,fetchImpl,sleep,attempts,intervalMs}) — polls the live deployment's /version.json against this build's own, never throws"
  - "runPostSync refuses every R2 mutation (uploads, deletions, state, daily report, force-full clearing) unless the live deployment is this build"
  - "An independent dry-run refusal inside archive-sync itself, not dependent on 05-13's ci-build-side guard"
  - "A pre-delete liveness re-check closing the TOCTOU window between the upload phase and the delete step"
  - "Architecture doc records the new contract, including the Phase 12 ARCHIVE_SYNC_LIVE_ORIGIN cutover obligation"
affects: ["05-20", "05-21"]

# Actuals (#2632)
actuals:
  tokens: 9070
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Liveness gate ordering: plan read → dry-run refusal → checkDisabled (branch guard + credentials, unchanged) → liveness gate → createStore. A disabled run makes zero network calls; a non-live run makes exactly one read-only GET and zero R2 calls."
    - "Pre-mutation re-check: for an operation spanning a non-trivial time window (the upload phase), re-verify the precondition (liveness) immediately before the irreversible step (deleteObjects) rather than trusting a check taken minutes earlier."
    - "Fail-closed network check: checkLiveDeployment never throws — every failure mode (missing local file, unreachable origin, non-2xx, malformed body, non-https origin) folds into live:false with a reason, because its caller must never fail a deploy."

key-files:
  created: []
  modified:
    - tools/archive-sync.mjs
    - tests/unit/archive-sync.test.mjs
    - docs/phase-05/archive-architecture.md

key-decisions:
  - "No override flag to force post against a non-live build. A manual `node tools/archive-sync.mjs post` run against a local build is refused by design — documented in the architecture record rather than worked around."
  - "A non-live run skips EVERYTHING (uploads, deletions, state, daily report, force-full clearing), not just deletions — re-uploading 'changed' pages from an undeployed build is also wrong per CR-01's own reasoning, and the live build's own post does that work."
  - "checkLiveDeployment compares BOTH commit AND builtAt, not commit alone — builtAt differs between a local build and the deployed build of the same commit, so commit alone would under-detect a non-live build."
  - "The pre-delete re-check is a single attempt (not another full poll) — it exists to catch a deploy landing during the upload phase, not to retry propagation delay a second time."

requirements-completed: []  # REND-07/REND-08 deliberately NOT marked complete — 05-20 (CR-02) and 05-21 remain open; see "Requirements status" below

coverage:
  - id: D1
    description: "runPostSync refuses all R2 mutation when the live deployment is not this build — zero createStore calls, zero uploads, zero deletions, one alert naming both commits"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync (05-14) — a non-live build refuses before createStore is ever called; zero uploads, zero deletions, one alert naming both versions"
        status: pass
    human_judgment: false
  - id: D2
    description: "WR-01 overlapping-build regression: key K (indexed, absent from this build's plan, present in this build's dist/client) survives a non-live run untouched in R2 and in the index"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync (05-14) — WR-01 overlapping-build regression: key K ... survives a non-live run untouched in R2 and in the index"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkLiveDeployment polls up to 6 attempts 10s apart, returns live:true only on an exact commit+builtAt match, never throws (rejecting fetch, non-https origin, missing local file all fold to live:false)"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: checkLiveDeployment — polls up to `attempts` times..."
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: checkLiveDeployment — never live after exhausting `attempts`; a rejecting fetch never throws; a non-https origin never calls fetch"
        status: pass
    human_judgment: false
  - id: D4
    description: "A direct CI_BUILD_DEPLOY_DRY_RUN=1 invocation of archive-sync post refuses before the liveness check is ever called — independent of 05-13's ci-build-side guard"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync — CI_BUILD_DEPLOY_DRY_RUN=1 refuses before checkLiveDeploymentFn is ever called..."
        status: pass
    human_judgment: false
  - id: D5
    description: "A deploy landing during the upload phase (liveness flips between the initial gate and the delete step) skips deletions only — the same run's uploads/index-adds still stand"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync — the live deployment changing during post-sync skips deletions, keeps the orphan indexed, but still uploads/indexes the changed key"
        status: pass
    human_judgment: false
  - id: D6
    description: "Proven on the real network path, credential-free: checkLiveDeployment({attempts:1}) against https://dev.915tldr.com returns live:false with both local and remote populated"
    requirement: "REND-07"
    verification:
      - kind: other
        ref: "node --input-type=module -e \"import('./tools/archive-sync.mjs').then(async (m) => console.log(JSON.stringify(await m.checkLiveDeployment({ attempts: 1 }))))\" — captured in this SUMMARY"
        status: pass
    human_judgment: false
  - id: D7
    description: "Architecture doc records the dry-run refusal, the live-match requirement, the pre-delete re-check, and the Phase 12 ARCHIVE_SYNC_LIVE_ORIGIN cutover obligation"
    requirement: "REND-08"
    verification:
      - kind: other
        ref: "docs/phase-05/archive-architecture.md — build sequence note, two failure-mode table rows, 'Live origin' section"
        status: pass
    human_judgment: false

duration: ~21min (commit timestamps; actual session time longer due to RED verification steps)
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 14: Gate archive-sync post on live-deployment match (CR-01/WR-01) Summary

**`runPostSync` now refuses every R2 mutation unless a polled, exact `/version.json` match proves the live deployment is this build — closing the archive-sync side of CR-01/WR-01, with a pre-delete re-check and a credential-free real-network proof.**

## Performance

- **Duration:** ~21 min (commit timestamps)
- **Started:** 2026-10-02T15:01:04-06:00
- **Completed:** 2026-10-02T15:05:44-06:00
- **Tasks:** 3
- **Files modified:** 3 (`tools/archive-sync.mjs`, `tests/unit/archive-sync.test.mjs`, `docs/phase-05/archive-architecture.md`)

## Accomplishments

- Added `checkLiveDeployment({root, env, fetchImpl, sleep, attempts, intervalMs})`, exported from `tools/archive-sync.mjs`: reads this build's own `dist/client/version.json`, polls the live deployment's `/version.json` up to 6 times (10s apart, cache-busting query, no-cache header), and reports `live: true` only on an exact `commit` AND `builtAt` match. Never throws — every failure mode (missing/unparseable local file, unreachable origin, non-2xx, malformed body, non-https origin) folds into `live: false` with a `reason`.
- Wired `checkLiveDeploymentFn` into `runPostSync` at two points: immediately after the existing `checkDisabled` guard and before `createStore` (the initial gate — a non-live build makes exactly one read-only GET and zero R2 calls), and again, a single attempt, immediately before `deleteObjects` (the pre-delete re-check — closes the window where a deploy lands during the upload phase).
- Added an independent dry-run refusal (`isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN)`) checked before `checkDisabled` and before any liveness check — a direct `CI_BUILD_DEPLOY_DRY_RUN=1 node tools/archive-sync.mjs post` invocation is refused regardless of 05-13's ci-build-side guard.
- Pinned WR-01's exact 4-step overlapping-build regression (key K: indexed, absent from this build's plan, present in this build's `dist/client`, archived by a different build that's now live) — K survives a non-live run untouched in both R2 and the index.
- Proved the fix on the real network path, credential-free: `checkLiveDeployment({attempts:1})` against `https://dev.915tldr.com` returned `{"live":false,"local":{"commit":"c8b727b","builtAt":"2026-10-02T20:46:16.377Z"},"remote":{"commit":"main","builtAt":"2026-10-02T20:06:00.073Z"},"attempts":1,"reason":"commit/builtAt mismatch"}` — both `local` and `remote` populated, no R2/ntfy credentials loaded.
- Updated `docs/phase-05/archive-architecture.md`: build-sequence note under step 10, two new failure-mode table rows (dry run reaches post; live deployment is not this build, flagged as an incident if persistent), a third row for the mid-run liveness change, and a new "Live origin" section documenting `ARCHIVE_SYNC_LIVE_ORIGIN`'s default and its Phase 12 production-cutover obligation.

## Task Commits

Each task was committed atomically (via `/jja-commit`):

1. **Task 1: Tracer — real liveness check wired in front of the store; the overlapping-build regression goes red then green** - `795b974` (feat)
2. **Task 2: Dry-run refusal, propagation polling, and the pre-delete re-check** - `5f3c2b7` (feat)
3. **Task 3: Record the new contract in the architecture document** - `a337fd3` (docs)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

## Files Created/Modified

- `tools/archive-sync.mjs` — `checkLiveDeployment` export; `LIVE_ORIGIN_DEFAULT`/`LIVE_CHECK_ATTEMPTS`/`LIVE_CHECK_INTERVAL_MS`/`LOCAL_VERSION_PATH` exported constants; `runPostSync`'s new `checkLiveDeploymentFn` option wired at the initial gate and the pre-delete re-check; dry-run refusal before `checkDisabled`
- `tests/unit/archive-sync.test.mjs` — two new sections ("WR-01 / CR-01 (05-14)" for Task 1, "Task 2 (05-14)" for the dry-run/polling/re-check behaviors), 10 new tests total; a shared `liveOk` stub injected into all 13 pre-existing `runPostSync(` call sites
- `docs/phase-05/archive-architecture.md` — build-sequence note, three failure-mode table rows, "Live origin" section

## Decisions Made

See `key-decisions` in frontmatter: no override flag for manual `post` against a local build (refused by design); a non-live run skips everything, not just deletions; `checkLiveDeployment` compares commit AND builtAt (not commit alone); the pre-delete re-check is a single attempt, not a second full poll.

## RED Failures (quoted)

**Task 1** — after adding the new tests (which import `checkLiveDeployment`) and reverting `tools/archive-sync.mjs` to its pre-fix HEAD state via `git checkout --`:

```
file:///home/jaime/www/_github/915tldr.com/tests/unit/archive-sync.test.mjs:24
  checkLiveDeployment,
  ^^^^^^^^^^^^^^^^^^^
SyntaxError: The requested module '../../tools/archive-sync.mjs' does not provide an export named 'checkLiveDeployment'
```

This is a genuine RED: the module fails to load at all, because the function didn't exist yet. The GREEN implementation was then restored and all 33 tests passed (28 pre-existing + 5 new).

**Task 2** — the 5 new tests were written against the Task-1-complete (already committed) state of `tools/archive-sync.mjs`. `node --test` failed exactly 4 of them:

```
✖ archive-sync: runPostSync — CI_BUILD_DEPLOY_DRY_RUN=1 refuses before checkLiveDeploymentFn is ever called...
  AssertionError: true !== false   (createStore WAS called — dry-run refusal didn't exist yet)

✖ archive-sync: checkLiveDeployment — polls up to `attempts` times...
  AssertionError: false !== true   (no polling loop — single-attempt implementation returned live:false immediately)

✖ archive-sync: checkLiveDeployment — never live after exhausting `attempts`...
  AssertionError: 1 !== 4   (fetch called once, not 4 times — no loop yet)

✖ archive-sync: runPostSync — the live deployment changing during post-sync skips deletions...
  AssertionError: 1 !== 0   (store.deleted was 1 — no pre-delete re-check yet, deletion proceeded)
```

The 5th test (force-full marker preservation on a non-live run) passed immediately, since Task 1's initial gate already made the store unreachable before any write — it's pinned as an explicit regression test. After implementing GREEN, all 38 tests in the file passed.

## Deviations from Plan

None — plan executed exactly as written. The plan's own design decisions (no override flag, skip-everything on non-live, commit+builtAt comparison, single-attempt pre-delete re-check) were implemented as specified.

## Issues Encountered

None. Both RED captures required reverting `tools/archive-sync.mjs` to its committed HEAD state (via `git checkout --`, never `git stash`, per the destructive-git-operations rule) with the new tests already in place, running the suite to observe genuine failures, then restoring the GREEN implementation — this was the only operational wrinkle, and it worked cleanly both times.

## Requirements status

REND-07 and REND-08 remain **Pending** in `.planning/REQUIREMENTS.md`, unchanged by this plan, per explicit instruction: this is gap-closure plan 2 of 9 (05-13 through 05-21), and 05-VERIFICATION.md's gap 2 ("Gate post-sync on a dry-run flag / live-deployment match") is now closed on the archive-sync side, but CR-02 (05-20, the separate `pnpm run deploy` skipping pre-sync entirely) is still open. Final requirement closure happens in 05-21.

## Next Phase Readiness

- The archive-sync-side half of CR-01/WR-01 is fully closed: both the ci-build path (05-13) and the direct-invocation path (this plan) now refuse to mutate R2 on a dry run or a non-live build.
- `ARCHIVE_SYNC_LIVE_ORIGIN` MUST be updated at the Phase 12 production cutover (documented) — a tracked obligation, not yet due.
- 05-20 (CR-02) and 05-21 (final requirement closure) remain open; this plan does not block either.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

- FOUND: tools/archive-sync.mjs
- FOUND: tests/unit/archive-sync.test.mjs
- FOUND: docs/phase-05/archive-architecture.md
- FOUND: .planning/phases/05-hybrid-archive-zero-reads-proof/05-14-SUMMARY.md
- FOUND: 795b974 (Task 1 commit)
- FOUND: 5f3c2b7 (Task 2 commit)
- FOUND: a337fd3 (Task 3 commit)

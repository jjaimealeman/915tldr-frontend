---
phase: 05-hybrid-archive-zero-reads-proof
plan: 18
subsystem: infra
tags: [archive-sync, r2, wr-02, tdd, index-self-heal, partial-results]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "tools/archive-sync.mjs's runPostSync/runPreSync (05-07), 05-14's checkLiveDeploymentFn and liveOk test stub, 05-REVIEW.md's WR-02 finding"
provides:
  - "runPostSync's post-delete index write is non-fatal — a failed mergeWriteIndex becomes an alert, never an uncaught throw"
  - "runPreSync's own index self-heal — lists R2 under articles/ and tags/ once per run and re-uploads any indexed-but-missing plan key as new"
  - "r2-client's deleteObjects partial-result contract — a failing 1,000-key batch reports its keys in errors instead of throwing away the deleted count of batches that already succeeded"
  - "Every remaining post-sync R2 write (deleteObjects, archive-state.json, daily-report.json) and pre-sync's new-key index write wrapped as a named alert instead of an uncaught throw"
  - "A CLI-level .catch on main() so an unexpected throw prints one clean archive-sync: line instead of an unhandled rejection"
  - "tools/r2-roundtrip.mjs stays fail-loud on its own probe object despite the underlying client no longer throwing on a failed delete"
affects: ["05-19", "05-20", "05-21"]

# Actuals (#2632)
actuals:
  tokens: 6945
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Index self-heal: once per pre-sync run, list what R2 actually holds (listKeys('articles/') + listKeys('tags/')) and treat any index entry the listing doesn't confirm as absent — removed from a working copy of the index before diffAgainstIndex runs, so a stale 'exists' claim can never suppress a re-upload."
    - "Partial-result over mid-loop throw: deleteObjects's batch loop never lets one failing batch erase the counts already confirmed by other batches — every failure mode in both archive-sync phases now degrades to a named alert with exitCode 0, never an uncaught rejection."

key-files:
  created: []
  modified:
    - tools/archive-sync.mjs
    - tests/unit/archive-sync.test.mjs
    - src/lib/server/r2-client.ts
    - tests/unit/r2-client.test.mjs
    - tools/r2-roundtrip.mjs
    - docs/phase-05/archive-architecture.md

key-decisions:
  - "Self-heal scope: only plan entries whose key is BOTH in the index AND missing from the R2 listing are healed — an index entry with no corresponding plan entry at all is untouched by this fix (it's still handled by the existing promoted/vanished-orphan logic)."
  - "A listKeys failure falls back to the pre-fix index-only diff (not a hard failure) — a transient R2 read error must never block a deploy, matching the project's existing 'disabled/unreadable index' failure-mode convention."
  - "deleteObjects's partial-result contract applies uniformly: a per-key R2-reported error and a whole-batch SDK-level throw are now indistinguishable to the caller (both land in `errors`) — archive-sync's existing 'only drop an index entry for a key confirmed deleted' logic needed no changes to pick this up correctly."
  - "A failed daily-report marker write deliberately leaves dailyReport.due: true rather than false — a duplicate report later is explicitly preferred over a silently missed one, per the plan's own stated behavior."
  - "archive-sync's own error-message convention (`err instanceof Error ? err.message : String(err)`) was kept for all new alerts, rather than introducing r2-client's describeError into archive-sync.mjs — archive-sync.mjs has no existing dependency on r2-client's internals and the new alerts don't touch raw SDK error objects (they wrap whatever the fake/real store itself throws)."

requirements-completed: []  # REND-07/REND-08 deliberately NOT marked complete here — 05-19/05-20/05-21 remain open; final requirement closure happens in 05-21, per this plan's repo_rules instruction.

coverage:
  - id: D1
    description: "A post-sync run whose deletion succeeds but whose index write then fails resolves (does not reject), exitCode 0, with one alert naming the failed write; a later pre-sync run against the same store re-uploads the now-missing key as new via self-heal, rather than trusting the stale index entry"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: WR-02 (05-18): a failed index write can never become a 404 — post survives, pre self-heals"
        status: pass
    human_judgment: false
  - id: D2
    description: "deleteObjects(2500 keys) with a rejecting middle batch resolves with deleted=1500 (batches 1 and 3) and errors naming exactly the 1,000 batch-2 keys, each code built by describeError, never err.message"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#deleteObjects(2500 keys) — a rejecting middle batch is reported as partial errors, not a throw; batches 1 and 3 still complete"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rejecting runPostSync deleteObjects call, archive-state.json write, and daily-report.json write are each a named alert with the run still resolving; a failed daily-report write leaves dailyReport.due true"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync — a deleteObjects rejection is an alert, not a thrown error; no index entries removed"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync — a putJson rejection for archive-state.json is an alert, run resolves"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPostSync — a putJson rejection for daily-report.json is an alert; dailyReport.due stays true"
        status: pass
    human_judgment: false
  - id: D4
    description: "A runPreSync index write failure after successful uploads is an alert naming the upload count, exit code 0, and nothing is moved back to static (the uploads are already confirmed in R2)"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync: runPreSync — an index write failure after 3 successful uploads is an alert naming the count; exit code 0, nothing moved back"
        status: pass
    human_judgment: false
  - id: D5
    description: "The build gate (r2-client stays unreachable from any Worker/page module graph) and the full fast suite stay green after every change in this plan"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "pnpm run test:build-gate (9/9)"
        status: pass
      - kind: unit
        ref: "pnpm run test:fast (701/701)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Architecture doc records the four new failure modes and the self-heal listing's negligible cost"
    requirement: "REND-08"
    verification:
      - kind: other
        ref: "docs/phase-05/archive-architecture.md — four new failure-mode table rows (all tagged WR-02, 05-18) and a new Cost section line"
        status: pass
    human_judgment: false

duration: ~4min (commit timestamps; actual session time longer due to RED verification steps and reading 05-REVIEW.md/05-14-SUMMARY.md context)
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 18: Close WR-02 — index self-heal and partial-result deletes Summary

**Post-sync's index write can no longer crash the run on an R2 failure, pre-sync now self-heals any index entry R2 doesn't actually hold, `deleteObjects` reports partial results instead of throwing away confirmed deletions, and every remaining R2 call in both phases degrades to a named alert instead of an uncaught exception.**

## Performance

- **Duration:** ~4 min (commit timestamps; actual session time longer — reading 05-REVIEW.md's WR-02 section, 05-14-SUMMARY.md's liveOk-stub requirement, and the existing test fixtures before writing RED)
- **Started:** 2026-10-02T15:40:00-06:00 (approx)
- **Completed:** 2026-10-02T15:48:02-06:00
- **Tasks:** 3
- **Files modified:** 6 (`tools/archive-sync.mjs`, `tests/unit/archive-sync.test.mjs`, `src/lib/server/r2-client.ts`, `tests/unit/r2-client.test.mjs`, `tools/r2-roundtrip.mjs`, `docs/phase-05/archive-architecture.md`)

## Accomplishments

- **Task 1 (tracer, TDD):** Wrapped `runPostSync`'s post-delete `mergeWriteIndex(store, { add, remove: actuallyDeleted })` call in try/catch — a failed write now pushes a named alert (`archive-sync: index write failed after post-sync — <n> deletion(s) and <n> upload(s) may be missing from the index; the next pre-sync self-heals (<reason>)`) and the run still resolves with `exitCode: 0`. Added pre-sync's own index self-heal: once per run, lists R2 under `articles/` and `tags/`, and treats any plan-entry key the index lists but R2 doesn't hold as `new` (not `unchanged`/`changed`) by removing it from a working copy of the index before `diffAgainstIndex` runs. A listing failure falls back to the pre-fix index-only diff with its own alert. Pinned both halves of the review's exact failure chain in one regression test spanning post-then-pre against the SAME fake store.
- **Task 2 (TDD):** Fixed `r2-client.ts`'s `deleteObjects` to never throw mid-batch — a rejecting 1,000-key batch now reports every one of its own keys in `errors` (code via `describeError`, never `err.message`) and the loop continues, so earlier/later batches' confirmed deletions are never discarded. Wrapped `runPostSync`'s `deleteObjects` call, the `archive-state.json` write, and the `daily-report.json` write each in their own try/catch with a named alert (a failed daily-report write deliberately keeps `dailyReport.due: true`). Wrapped `runPreSync`'s new-key index write the same way. Added a top-level `.catch` on the CLI's `main()` invocation (`describeTopLevelError`, which avoids double-prefixing a message that's already prefixed) so an unexpected throw prints one clean line instead of an unhandled rejection. Made `tools/r2-roundtrip.mjs` throw when its own probe-object delete reports errors, keeping that tool fail-loud even though the underlying client no longer throws on a failed delete.
- **Task 3:** Added four new failure-mode table rows to `docs/phase-05/archive-architecture.md` (index write fails after post-sync deletions/uploads; R2 listing fails at pre-sync; a DeleteObjects batch fails; index write fails after pre-sync uploads), and a new Cost line for the self-heal listing (~31 `ListObjectsV2` Class A requests per build at ~30.5k archived keys, ~372/day at 12 builds/day, ~$0.05/month, scaling linearly with the archived-key count — Phase 6 roughly doubles it).

## Task Commits

Each task was committed atomically (via `/jja-commit`):

1. **Task 1: Tracer — the review's failure chain, post then pre, goes red then green** — `6d5d853` (fix)
2. **Task 2: Partial-result deletes and every remaining R2 call made non-fatal** — `3539ec8` (fix)
3. **Task 3: Failure-mode table and cost note** — `065c564` (docs)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

## Files Created/Modified

- `tools/archive-sync.mjs` — post-sync index-write wrap; pre-sync index self-heal (`listKeys('articles/')`/`listKeys('tags/')`); pre-sync new-key index-write wrap; wrapped `deleteObjects`/archive-state/daily-report calls in `runPostSync`; CLI-level `.catch`
- `tests/unit/archive-sync.test.mjs` — `makeFakeStore` gained `failDeleteObjects`; new "WR-02 (05-18)" post-then-pre regression test; new "Task 2 (05-18)" section covering `deleteObjects`/archive-state/daily-report/pre-index-write failures
- `src/lib/server/r2-client.ts` — `deleteObjects`'s per-batch catch now pushes per-key errors instead of throwing; `DeleteObjectsResult` doc comment states the partial-result contract
- `tests/unit/r2-client.test.mjs` — new partial-batch regression test (2,500 keys, batch 2 of 3 rejects)
- `tools/r2-roundtrip.mjs` — throws on a non-empty `errors` array from its own `deleteObjects` call
- `docs/phase-05/archive-architecture.md` — four new failure-mode rows; new Cost section line

## Decisions Made

See `key-decisions` in frontmatter: self-heal scope limited to plan entries present in both the plan and the index; a `listKeys` failure falls back to the pre-fix index-only diff rather than hard-failing; the partial-result contract treats a per-key R2 error and a whole-batch SDK throw identically; a failed daily-report write deliberately keeps `due: true`; archive-sync.mjs kept its own existing error-message convention rather than importing `describeError`.

## RED Failures (quoted)

**Task 1** — the post-then-pre regression test, run against the pre-fix code:

```
✖ archive-sync: WR-02 (05-18): a failed index write can never become a 404 — post survives, pre self-heals
  Error: fake putJson failure for _meta/archive-index.json
      at Object.putJson (tests/unit/archive-sync.test.mjs:76:39)
      at mergeWriteIndex (tools/archive-sync.mjs:250:15)
      at async runPostSync (tools/archive-sync.mjs:730:5)
```

The uncaught `mergeWriteIndex` throw propagated out of `runPostSync` exactly as 05-REVIEW.md's WR-02 description predicted — the promise rejected before Step 2 (the pre-sync self-heal check) could even run. After the GREEN implementation, all 39 tests in the file passed.

**Task 2** — four new tests run against the pre-fix code, three in `archive-sync.test.mjs` and one in `r2-client.test.mjs`:

```
✖ deleteObjects(2500 keys) — a rejecting middle batch is reported as partial errors, not a throw...
  Error: r2-client: deleteObjects batch failed: ThrottlingException
      at Object.deleteObjects (src/lib/server/r2-client.ts:256:15)

✖ archive-sync: runPostSync — a deleteObjects rejection is an alert, not a thrown error...
  Error: fake deleteObjects failure
      at runPostSync (tools/archive-sync.mjs:753:37)

✖ archive-sync: runPostSync — a putJson rejection for archive-state.json is an alert...
  Error: fake putJson failure for _meta/archive-state.json
      at runPostSync (tools/archive-sync.mjs:801:15)

✖ archive-sync: runPostSync — a putJson rejection for daily-report.json is an alert...
  Error: fake putJson failure for _meta/daily-report.json
      at runPostSync (tools/archive-sync.mjs:835:17)
```

(The fifth new test, `runPreSync`'s index-write-failure alert, passed immediately against the pre-fix code's existing unwrapped `mergeWriteIndex(store, { add, remove: [] })` call inside Task 1's already-landed self-heal block — it's pinned as an explicit regression test rather than being a genuine RED for Task 2.) After implementing GREEN for all four, `node --test tests/unit/r2-client.test.mjs tests/unit/archive-sync.test.mjs` passed 70/70, `pnpm run test:build-gate` passed 9/9, and `pnpm run test:fast` passed 701/701.

## Deviations from Plan

None — plan executed as written. One clarification worth noting: the plan's Task 2 described five RED behaviors but one of them (the `runPreSync` index-write-failure alert) was already implemented as part of Task 1's self-heal block (both changes touch the same `runPreSync` code region), so it surfaced as an immediate pass rather than a genuine RED when Task 2's test was added — the test itself still exists as a named regression per the plan's acceptance criteria, and its behavior matches the plan's spec exactly.

## Issues Encountered

None of the pre-existing `runPreSync` tests seed an index with entries that lack a matching R2 object, so (per the plan's own instruction to check) no existing fixtures needed adjustment for the self-heal change — verified by inspecting every `runPreSync(` call site in the test file before writing the fix.

## Requirements status

REND-07 and REND-08 remain **Pending** in `.planning/REQUIREMENTS.md`, unchanged by this plan, per explicit instruction in this plan's repo_rules: this is gap-closure plan 18 of the 05-13 through 05-21 series, and 05-REVIEW.md's WR-02 finding is now fully closed (both the post-sync index-write-crash risk and the partial-delete/non-fatal-write risk), but final requirement closure happens in 05-21.

## Next Phase Readiness

- WR-02 is fully closed: a failed or partial R2 operation in either archive-sync phase can no longer leave the index lying about what exists in R2, and pre-sync's self-heal repairs any resulting drift before the next deploy relies on it.
- `tools/r2-roundtrip.mjs`'s own live proof stays fail-loud despite `deleteObjects`'s new non-throwing contract — no regression in that tool's own guarantee.
- 05-19/05-20/05-21 remain open; this plan does not block any of them.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

- FOUND: tools/archive-sync.mjs
- FOUND: tests/unit/archive-sync.test.mjs
- FOUND: src/lib/server/r2-client.ts
- FOUND: tests/unit/r2-client.test.mjs
- FOUND: tools/r2-roundtrip.mjs
- FOUND: docs/phase-05/archive-architecture.md
- FOUND: .planning/phases/05-hybrid-archive-zero-reads-proof/05-18-SUMMARY.md
- FOUND: 6d5d853 (Task 1 commit)
- FOUND: 3539ec8 (Task 2 commit)
- FOUND: 065c564 (Task 3 commit)

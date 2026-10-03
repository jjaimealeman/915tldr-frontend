---
phase: 05-hybrid-archive-zero-reads-proof
plan: 20
subsystem: infra
tags: [deploy-pipeline, archive-sync, r2, ci-build, wrangler, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-13/05-14 (CR-01's ci-build + archive-sync halves closed); 05-18 (WR-02 index self-heal, partial-result deletes) — tools/ci-build.mjs and tools/archive-sync.mjs as modified by those plans"
provides:
  - "ARCHIVE_SYNCED_MARKER_PATH ('dist/archive-synced.json') written by archive-sync.mjs's runPreSync on every exit-0 path, keyed to the plan's own generatedAt"
  - "tools/assert-archive-synced.mjs — new guard CLI/export (assertArchiveSynced) refusing a partitioned dist/ that pre has not confirmed for this build"
  - "pnpm run deploy routed through node tools/ci-build.mjs deploy (was a bare wrangler deploy); new pnpm run guard:archive-synced script"
  - "tools/ci-build.mjs spawns the guard between the file-count gate and wrangler; a refusal aborts before wrangler/commitLastGood/post"
  - "BUILD_START_MARKER_MAX_AGE_SECONDS (1800) — a stale .astro/ci-build-started-at marker is ignored, fixing IN-06"
  - "docs/phase-04/build-pipeline.md and docs/phase-05/archive-architecture.md describe the guarded deploy path end to end"
affects: [05-21, phase-06-planning, future-deploy-pipeline-changes]

# Actuals (#2632)
actuals:
  tokens: 13250
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy-time marker + guard pattern: a build-time artifact (archive-sync pre) writes a keyed proof file; a separate, spawned guard CLI reads it and refuses to let the deploy proceed without a match — same arm's-length spawn relationship ci-build.mjs already holds with archive-sync.mjs/assert-file-count.mjs, now extended to a third guard"
    - "Stale-marker ignore rule: a process-start marker older than a named ceiling (or more than a small amount in the future) is treated as absent rather than trusted, with one stderr line disclosing the decision — reused the exact fallback path the missing-marker case already had"

key-files:
  created:
    - tools/assert-archive-synced.mjs
    - tests/unit/assert-archive-synced.test.mjs
  modified:
    - tools/archive-sync.mjs
    - tools/ci-build.mjs
    - package.json
    - tests/unit/archive-sync.test.mjs
    - tests/unit/ci-build.test.mjs
    - docs/phase-04/build-pipeline.md
    - docs/phase-05/archive-architecture.md

key-decisions:
  - "Marker keyed to the plan's own generatedAt (not a boolean) — a marker written for an older partition can never vouch for a newer one (T-05-67, spoofing/staleness), matching the plan's own design decision"
  - "Guard spawned as a child process (node tools/assert-archive-synced.mjs), not imported — keeps ci-build.mjs's existing arm's-length convention and keeps every test's injected spawnImpl in control, per the plan's binding execution rules"
  - "deploy:ci and ci:local left untouched; only the documented pnpm run deploy script changed — Workers Builds' configured commands are unaffected"
  - "A bare wrangler deploy and the non-production Version command remain outside the guard's reach (T-05-69, accept) — out of scope per the plan's own threat register, not attempted here"

patterns-established:
  - "Deploy-time marker + guard: a sync phase writes a small proof-of-work file; a separate spawned guard CLI reads and compares it before the next irreversible step (wrangler deploy) is allowed to run"

requirements-completed: [REND-07, REND-08]

coverage:
  - id: D1
    description: "archive-sync pre writes dist/archive-synced.json (keyed to the plan's generatedAt) on every exit-0 path, never on the plan-missing exit-1 path"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync (CR-02): a successful run writes dist/archive-synced.json with planGeneratedAt equal to the plan's own generatedAt"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync (CR-02): the plan-missing (exitCode 1) path never writes the marker"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/assert-archive-synced.mjs implements the 5 refusal/ok cases and refuses the real repo tree's actual CR-02 state"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/assert-archive-synced.test.mjs (9 tests, all 5 cases + end-to-end pair)"
        status: pass
      - kind: other
        ref: "node tools/assert-archive-synced.mjs against the real partitioned repo tree — exit 1, message contains 'archive-sync pre has not run'"
        status: pass
    human_judgment: false
  - id: D3
    description: "pnpm run deploy routed through tools/ci-build.mjs deploy; wrangler gated on the guard; package.json contract pinned by a test"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#package.json (CR-02, 05-20): scripts.deploy routes through tools/ci-build.mjs deploy and never calls a bare wrangler deploy; guard:archive-synced is defined"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy (CR-02, 05-20): assert-archive-synced exiting 1 aborts before wrangler/commitImpl/post, notifies exactly once with a title naming assert-archive-synced"
        status: pass
    human_judgment: false
  - id: D4
    description: "IN-06: a stale .astro/ci-build-started-at marker (>1,800s old or >60s future) is ignored; existing 1,025s-old deadline behavior unchanged"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync (IN-06, 05-20): a build-start marker older than BUILD_START_MARKER_MAX_AGE_SECONDS is ignored"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#archive-sync (IN-06, 05-20): a build-start marker at exactly BUILD_START_MARKER_MAX_AGE_SECONDS old is still honored"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/phase-04/build-pipeline.md and docs/phase-05/archive-architecture.md describe the guarded deploy path, the marker, the IN-06 rule, and the new failure mode"
    verification:
      - kind: other
        ref: "grep -c checks for assert-archive-synced / archive-synced.json / Manual deploys / 1,800 against both docs, per 05-20-PLAN.md Task 3's own acceptance criteria"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-10-02
status: complete
---

# Phase 05 Plan 20: Guarded deploy closes CR-02 Summary

**`pnpm run deploy` now runs the real archive-sync sequence instead of a bare `wrangler deploy`, and a new guard refuses to let a partitioned `dist/` reach wrangler unless this exact build's pre-sync has confirmed it — closing 05-REVIEW.md CR-02 and, with it, the last blocker on REND-07/REND-08.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-10-02T22:05:39Z
- **Tasks:** 3
- **Files modified:** 9 (2 new: `tools/assert-archive-synced.mjs`, `tests/unit/assert-archive-synced.test.mjs`)

## Accomplishments

- `tools/archive-sync.mjs`'s `runPreSync` now writes `dist/archive-synced.json` (keyed to the
  plan's own `generatedAt`) on every exit-0 path — success, disabled, index-unreadable — never on
  the plan-missing exit-1 path.
- New `tools/assert-archive-synced.mjs` implements the guard: 5 cases (no plan/no archive files ->
  ok; no plan but stray archive files -> refuse naming them; plan present/marker missing -> refuse;
  marker stale -> refuse; matching marker -> ok). Proven live against the real repo tree, which was
  already sitting in the exact CR-02 state (partitioned by an earlier `pnpm run build`, no marker):
  `node tools/assert-archive-synced.mjs` exits 1 with `assert-archive-synced: dist/ was partitioned
  but archive-sync pre has not run for this build`.
- `package.json`'s `deploy` script now runs `pnpm run guard:config && node tools/ci-build.mjs
  deploy` (was a bare `wrangler deploy --config wrangler.jsonc`) — the same sequence Workers
  Builds' own `deploy:ci` already ran. New `guard:archive-synced` script runs the check by hand.
- `tools/ci-build.mjs` spawns the guard between the file-count gate and wrangler; a non-zero exit
  aborts the deploy immediately — wrangler, `commitLastGood`, and archive-sync post never run.
- IN-06 fixed: `BUILD_START_MARKER_MAX_AGE_SECONDS` (1,800s) makes a stale `.astro/ci-build-started
  -at` marker (left by an earlier `pnpm run build`) get ignored rather than making both archive-sync
  deadlines look already expired.
- `docs/phase-04/build-pipeline.md` and `docs/phase-05/archive-architecture.md` updated end to end:
  the new guard step in the DEPLOY diagram/build sequence, a "Manual deploys" paragraph, the marker
  shape and what it vouches for, the 1,800s rule, and a new failure-mode table row.

## Task Commits

1. **Task 1: Tracer — pre writes the sync marker, the guard reads it, and the real partitioned
   tree is refused** - `8091c9d` (feat)
2. **Task 2: Route the documented deploy through ci-build, gate wrangler on the guard, ignore
   stale build-start markers** - `b4b52ad` (fix)
3. **Task 3: Pipeline and architecture docs describe the guarded deploy** - `ef1a477` (docs)

_Both TDD tasks (1 and 2) followed RED-then-GREEN: tests were written and confirmed failing
(module/export errors not yet existing, package.json still the old bare-wrangler script, the
ordering test's 4-spawn assertion) before any implementation, then made to pass — committed
together per task (not as separate test/feat commits) since this plan's execution rules call for
one commit per task, matching this phase's established TDD-within-a-single-commit precedent
(05-02, 05-04, 05-05)._

## Files Created/Modified

- `tools/archive-sync.mjs` - exports `ARCHIVE_SYNCED_MARKER_PATH`/`BUILD_START_MARKER_MAX_AGE_SECONDS`; `writeSyncedMarker`; stale build-start marker ignored
- `tools/assert-archive-synced.mjs` (new) - the guard: `assertArchiveSynced({root})`, CLI exit 0/1
- `tools/ci-build.mjs` - `CHECK_PATTERNS` gains `assert-archive-synced`; new spawn between the file-count gate and wrangler
- `package.json` - `deploy` routed through `ci-build.mjs deploy`; new `guard:archive-synced` script
- `tests/unit/assert-archive-synced.test.mjs` (new) - 9 tests, all 5 guard cases + end-to-end pair
- `tests/unit/archive-sync.test.mjs` - CR-02 marker section (5 tests) + IN-06 section (3 tests)
- `tests/unit/ci-build.test.mjs` - package.json contract test; 4-to-5-spawn ordering update; new refusal test
- `docs/phase-04/build-pipeline.md` - guard step in the DEPLOY diagram; "Manual deploys" paragraph; 1,800s rule
- `docs/phase-05/archive-architecture.md` - renumbered build sequence; new marker/guard section; failure-mode row; deadlines table + IN-06 paragraph

## Decisions Made

- Marker keyed to the plan's own `generatedAt`, not a boolean — a marker from an older partition
  can never vouch for a newer one (matches the plan's own stated design decision, T-05-67).
- Guard spawned as a child process, not imported, to preserve `ci-build.mjs`'s existing
  arm's-length convention with `archive-sync.mjs`/`assert-file-count.mjs` and keep every existing
  test's injected `spawnImpl` in control.
- `deploy:ci` and `ci:local` left untouched — only the documented manual `pnpm run deploy` changed.
- A hand-typed bare `wrangler deploy` and the non-production "Version command" remain outside the
  guard's reach, per the plan's own threat register (T-05-69, accepted residual risk) — out of
  scope for this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## REND-07 / REND-08 status (repo_rules evidence block)

05-VERIFICATION.md recorded REND-07 and REND-08 as `Complete` but `BLOCKED on operational-safety
grounds` — the happy path was live-confirmed, but CR-01 and CR-02 (both confirmed by direct code
read) could each independently break the "rendered once, reliably served" invariant under real,
already-exercised paths (05-VERIFICATION.md lines 178-179, 203-204). CR-01 (dry-run rehearsal still
running destructive post-sync against production R2) was closed by 05-13 (ci-build half) and 05-14
(archive-sync half). **CR-02 (the documented `pnpm run deploy` skipping pre-sync entirely) is
closed by this plan** — `deploy` now runs the real sequence, and `tools/assert-archive-synced.mjs`
makes the specific failure mode (a partitioned `dist/` shipped with no R2 confirmation) structurally
unreachable through any documented deploy path, pinned by a package.json contract test and proven
against the real repo tree's own CR-02 state. Both critical issues that were blocking REND-07/
REND-08 are therefore now closed. Per this plan's repo_rules, `REQUIREMENTS.md` itself is NOT
updated here — that is explicitly 05-21's job — but the evidence for closing both requirements'
`BLOCKED` status is recorded here for 05-21 to act on:
- CR-01 evidence: `8091c9d`..(05-13/05-14 commits, prior plans) — see 05-13-SUMMARY.md/05-14-SUMMARY.md
- CR-02 evidence: this plan's three commits (`8091c9d`, `b4b52ad`, `ef1a477`), the 112 passing
  tests in `tests/unit/{assert-archive-synced,archive-sync,ci-build}.test.mjs`, and the real-tree
  proof (`node tools/assert-archive-synced.mjs` exits 1 against the actual unconfirmed partition
  sitting in this repo's `dist/` right now, and would exit 0 once a real `pnpm run deploy` run's
  pre-sync phase writes the marker)

## Next Phase Readiness

- 05-21 remains open — it owns the final `REQUIREMENTS.md` closure for REND-07/REND-08 (both
  blockers now resolved per the evidence above) and any remaining phase-05 wrap-up.
- `dist/` in this working tree is still in the pre-marker CR-02 state (no production deploy was run
  this session, per the plan's own prohibition) — this is expected and does not need cleanup; the
  next real `pnpm run deploy` or `ci-build.mjs deploy` run will write the marker normally.

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk; all 3 task commit hashes (`8091c9d`,
`b4b52ad`, `ef1a477`) confirmed in `git log --oneline --all`.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

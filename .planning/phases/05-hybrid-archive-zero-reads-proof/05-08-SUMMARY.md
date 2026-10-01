---
phase: 05-hybrid-archive-zero-reads-proof
plan: 08
subsystem: infra
tags: [cloudflare-workers-builds, cloudflare-r2, ntfy, archive-tier, ci-cd, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-07's tools/archive-sync.mjs (pre/post phases, the branch guard, the
      ARCHIVE_SYNC_RESULT line contract) and 05-06's tools/partition-archive.mjs /
      tools/assert-file-count.mjs (the file-count gate this plan re-runs a second time)"
provides:
  - "tools/ci-build.mjs's deploy step now runs the real archive sequence: hot-window guard ->
    archive-sync pre -> the file-count gate (re-run on the final dist/client) -> wrangler deploy
    (or a CI_BUILD_DEPLOY_DRY_RUN=1 dry run) -> commitLastGood -> archive-sync post -> ntfy
    alerts/the once-daily REND-11 report"
  - "parseArchiveSyncResult (exported) and an internal parseLastJsonLine — parse archive-sync's/
    assert-file-count's own CLI output lines out of a spawned process's tail"
  - "A fixed tools/assert-file-count.mjs — running the gate twice in one build (this plan's own
    requirement) no longer throws on its own post-write recount"
  - "docs/phase-04/build-pipeline.md, docs/phase-04/workers-builds-setup.md,
    docs/phase-03/render-step-location.md all amended to describe the archive tier's real place
    in the pipeline"
affects: ["05-09 (first production archive deploy — the real, non-dry-run wrangler deploy this
  plan deliberately did not run)", "05-10 (forced full re-upload at corpus scale)", "05-12 (the
  final zero-D1-reads gate run)"]

# Actuals (#2632)
actuals:
  tokens: 13613
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "isProductionDeploy(env) mirrors archive-sync.mjs's own isR2WriteBlocked predicate,
      inverted, kept in sync deliberately (orchestrator directive) so the deploy wrapper's
      hot-window guard and archive-sync's own write-boundary guard never disagree about what
      counts as production."
    - "Every archive-tier alert (failed uploads, disabled tier, backlog, the file-count warn
      alarm, the daily report) is QUEUED while the deploy sequence runs and sent only AFTER
      wrangler deploy succeeds — informational, never gating, and a notify failure here is caught
      and logged rather than changing the deploy step's own return value."
    - "loadHotWindowImpl/markBuildStart follow this file's own established dynamic-import-only
      convention for TypeScript modules the 'build' step must never load — same reasoning as the
      existing defaultCommitImpl's dynamic import of build-state.ts."

key-files:
  created: []
  modified:
    - tools/ci-build.mjs
    - tests/unit/ci-build.test.mjs
    - tools/assert-file-count.mjs
    - tests/unit/file-count.test.mjs
    - docs/phase-04/build-pipeline.md
    - docs/phase-04/workers-builds-setup.md
    - docs/phase-03/render-step-location.md

key-decisions:
  - "isProductionDeploy(env) = WORKERS_CI_BRANCH === 'main' || !isTruthyFlag(WORKERS_CI) —
    deliberately the exact inverse of archive-sync.mjs's own isR2WriteBlocked, so the two guards
    (this file's hot-window check, archive-sync's own R2-write refusal) can never disagree about
    what a 'production deploy' means."
  - "Every archive-tier module's own alerts array (pre's disabled/failed-upload notices, post's
    failed/backlog/deletion-cap notices) is forwarded to ntfy VERBATIM rather than
    re-synthesized — archive-sync.mjs already composes the exact wording D-10/D-12 require ('...
    previous copies still serving', 'backlog older than 20h'); re-deriving that text in ci-build.mjs
    would risk the two files' wording drifting apart."
  - "REND-07/REND-11/REND-12 are intentionally left Pending in REQUIREMENTS.md, extending this
    phase's own established precedent (05-02/04/05/06/07) — see 'Requirements' section below."

requirements-completed: []

coverage:
  - id: D1
    description: "The build step writes .astro/ci-build-started-at before spawning the build; the
      deploy step runs archive-sync pre -> the file-count gate (re-run on the final dist/client)
      -> wrangler deploy (or a CI_BUILD_DEPLOY_DRY_RUN=1 dry run with --outdir) -> commitLastGood
      (skipped in a dry run) -> archive-sync post, in that exact order"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: ... spawns archive-sync pre,
          assert-file-count, wrangler deploy, commitImpl, then archive-sync post, in that order"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: CI_BUILD_DEPLOY_DRY_RUN=1 runs
          wrangler deploy --dry-run with --outdir and never calls commitImpl"
        status: pass
      - kind: integration
        ref: "live run (2026-10-01): a real pnpm run build (60,397 pages) followed by
          CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy against the real
          915tldr-archive bucket — exit 0, two ARCHIVE_SYNC_RESULT lines, a real wrangler
          --dry-run run listing RENDER_MANIFEST/ARCHIVE_BUCKET/ASSETS bindings; the real archive
          index now holds exactly 30,478 entries (the full corpus: 12,912 articles + 17,566 tags)"
        status: pass
    human_judgment: false
  - id: D2
    description: "archive-sync pre exiting non-zero (or assert-file-count failing) aborts the
      whole deploy before wrangler/commitImpl ever run, with one failure notification naming the
      failing phase"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: archive-sync pre exiting 1 aborts
          before wrangler/commitImpl, notifies exactly once with a title naming archive-sync"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: assert-file-count exiting non-zero
          aborts the deploy with a failure notification (D-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "archive-sync post never fails the deploy, even on a non-zero exit or a missing/
      unparseable ARCHIVE_SYNC_RESULT line — the deploy already succeeded by the time post runs"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: a post spawn that exits non-zero /
          omits the ARCHIVE_SYNC_RESULT line sends one alert ntfy but the deploy step still
          returns 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "A production deploy (main branch, or any local run) refuses to ship a
      fallback-provisional hot window without ALLOW_FALLBACK_HOT_WINDOW=1, checked before any
      spawn at all; a non-production CI build skips the guard entirely; the daily report body
      spells out PROVISIONAL when the window in force is a fallback"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy (production, local run): a
          fallback-provisional hot window with no ALLOW_FALLBACK_HOT_WINDOW blocks before any
          spawn, notifies once with a check starting 'hot-window:'"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: ALLOW_FALLBACK_HOT_WINDOW=1 lets a
          fallback-provisional hot window proceed, and the daily report body says PROVISIONAL"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: a non-production CI build (WORKERS_CI=1,
          branch != main) skips the hot-window guard entirely"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-10/D-12: a pre/post result reporting failed uploads, a disabled archive tier,
      or a backlog older than 20h each reach ntfy exactly once, sent after a successful deploy,
      never blocking it; assert-file-count's warn status sends one high-priority alarm naming the
      count against 100,000"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: a pre/post result with failed pages
          sends exactly one ntfy naming the count and that previous copies are still serving"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: a post backlog alert older than 20h
          sends one ntfy (D-10)"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: a pre result with disabled:true lets
          the deploy proceed and sends one ntfy saying the archive tier is disabled"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: assert-file-count status \"warn\"
          sends one high-priority ntfy naming the count against 100,000, and the deploy proceeds"
        status: pass
    human_judgment: false
  - id: D6
    description: "The once-a-day file-count report (REND-11) fires exactly once per America/Denver
      calendar date via post's own dailyReport.due flag, with Priority low; due:false sends no
      report"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: dailyReport.due false sends no daily
          report notification"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every notification body/title passes through redact(), which now also strips
      R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY values; classifyFailure names archive-sync,
      partition-archive, assert-file-count, hot-window, tiering, tier-facts and r2-client failures
      from their <module>: lines"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#redact (05-08 Task 2): removes R2_ACCESS_KEY_ID and
          R2_SECRET_ACCESS_KEY values"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#classifyFailure (05-08 Task 2): picks the first line
          naming a known archive-tier check, for every new pattern"
        status: pass
      - kind: other
        ref: "grep -c R2_SECRET_ACCESS_KEY tools/ci-build.mjs -> 2"
        status: pass
    human_judgment: false
  - id: D8
    description: "A real bug in tools/assert-file-count.mjs (not in this plan's file list) — the
      gate's own '+1 for static-budget.json' assumption breaks the second time it runs in one
      build, which is this plan's own Task 1 requirement — found live, fixed, pinned with a
      regression test, re-verified live"
    verification:
      - kind: unit
        ref: "tests/unit/file-count.test.mjs#assertFileCount (05-08 regression): running it a
          second time against the SAME dist/client does not change the count and does not throw"
        status: pass
      - kind: integration
        ref: "live run (2026-10-01): the first end-to-end dry-run deploy threw
          'post-write recount (29937) does not equal the published staticFileCount (29938)'; a
          second run after the fix completed cleanly, exit 0, 14.18s total"
        status: pass
    human_judgment: false
  - id: D9
    description: "docs/phase-04/build-pipeline.md, docs/phase-04/workers-builds-setup.md, and
      docs/phase-03/render-step-location.md each carry a Phase 5 amendment/note describing the
      archive tier's real place in the pipeline, as insertions only (no rewritten decision text)"
    verification:
      - kind: other
        ref: "grep -c 'Phase 5 amendment' docs/phase-04/build-pipeline.md -> 1;
          grep -c R2_SECRET_ACCESS_KEY docs/phase-04/workers-builds-setup.md -> 1;
          grep -c 'Phase 5 note' docs/phase-03/render-step-location.md -> 1;
          git diff --stat (all three) -> insertions only, 0 deletions"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 8: Archive Tier Wired Into the Real Deploy Pipeline Summary

**`tools/ci-build.mjs`'s deploy step now runs the full archive sequence for real — hot-window
guard, `archive-sync` pre/post, the re-run file-count gate, ntfy alerts and the once-daily
REND-11 report — proven live against the real `915tldr-archive` R2 bucket at full corpus scale
(30,478 entries), after finding and fixing a real bug in `assert-file-count.mjs` that would have
broken every production deploy.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-10-01T07:32:00Z (approx. — immediately after context/plan read)
- **Completed:** 2026-10-01T08:27:00Z
- **Tasks:** 3 (Task 1 tracer + TDD, Task 2 auto + TDD, Task 3 auto/docs)
- **Files modified:** 7

## Accomplishments

- **The build step** now writes `.astro/ci-build-started-at` (via an injectable `markBuildStart`
  seam) before spawning `pnpm run build` — both of `archive-sync.mjs`'s own deadlines (840s/1020s)
  measure from this file's contents, so it must reflect the real start of THIS build.
- **The deploy step's real sequence**: a production hot-window guard (refuses a
  `fallback-provisional` window without `ALLOW_FALLBACK_HOT_WINDOW=1`, checked before any spawn)
  -> `node tools/archive-sync.mjs pre` -> the file-count gate re-run on the FINAL `dist/client`
  -> `wrangler deploy` (or, with `CI_BUILD_DEPLOY_DRY_RUN=1`, a dry run with
  `--outdir .wrangler/ci-dry-run`) -> `commitLastGood` (skipped entirely in a dry run) ->
  `node tools/archive-sync.mjs post`. `parseArchiveSyncResult` (exported) parses each run's
  `ARCHIVE_SYNC_RESULT` JSON line out of its spawned output tail.
- **Every archive outcome the owner must know about now reaches ntfy exactly once**: failed
  uploads (pre or post), a disabled archive tier, a backlog older than 20h, the file-count
  `warn` alarm (high priority, naming the count against 100,000), and — once per America/Denver
  calendar date — the REND-11 daily report (low priority), spelling out `PROVISIONAL` when the
  hot window in force is a fallback. Every alert is queued and sent AFTER the deploy succeeds,
  never gating it; a notify failure is caught and logged, never surfaced as the deploy's own
  return code.
- **`CHECK_PATTERNS`/`SECRET_ENV_KEYS` extended** for the archive tier's own fail-loud modules
  (`archive-sync`, `partition-archive`, `assert-file-count`, `hot-window`, `tiering`,
  `tier-facts`, `r2-client`) and credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
- **A real bug found and fixed live**: `tools/assert-file-count.mjs` assumed
  `static-budget.json` never exists yet when computing its own file count. This plan's own Task 1
  requirement — re-running the gate a SECOND time in the same build, on the final `dist/client`
  — triggers that false assumption on every single real deploy. Found on the first live
  end-to-end dry run, fixed, pinned with a regression test, re-verified live (a second full
  dry-run deploy completed cleanly in ~14s).
- **Live proof at full corpus scale**: the real `915tldr-archive` bucket's `_meta/archive-index.json`
  now holds exactly 30,478 entries (12,912 articles + 17,566 tags) — the complete archive-tier
  corpus — confirmed by reading the index directly off the bucket, not inferred from logs alone.
- **Pipeline docs brought in line**: `docs/phase-04/build-pipeline.md`'s "Phase 5 amendment",
  `docs/phase-04/workers-builds-setup.md`'s "Phase 5 build variables", and
  `docs/phase-03/render-step-location.md`'s "Phase 5 note" (resolving D-05's own open question —
  the archive render runs on Workers Builds, not the cron Worker) — all insertions only, no
  rewritten decision text.

## Task Commits

1. **Task 1 (tracer + TDD):** `8b58221` (feat) — `tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`
2. **Task 2 (auto + TDD):** `018d56e` (feat) — `tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`,
   `tools/assert-file-count.mjs` (Rule 1 bug fix), `tests/unit/file-count.test.mjs`
3. **Task 3 (auto):** `27ae29a` (docs) — `docs/phase-04/build-pipeline.md`,
   `docs/phase-04/workers-builds-setup.md`, `docs/phase-03/render-step-location.md`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `tools/ci-build.mjs` - build-start marker; the real deploy sequence (archive-sync pre -> count
  gate -> wrangler -> commit -> archive-sync post); hot-window production guard; ntfy
  alerts/daily report; `parseArchiveSyncResult` (exported), `parseLastJsonLine`,
  `isProductionDeploy`, `formatDailyReportBody` (internal) (modified)
- `tests/unit/ci-build.test.mjs` - 24 new tests covering the deploy sequence, the hot-window
  guard, every archive alert/alarm/daily-report case, and the extended `classifyFailure`/`redact`
  patterns (modified)
- `tools/assert-file-count.mjs` - fixed the second-run file-count bug (Rule 1) (modified)
- `tests/unit/file-count.test.mjs` - one new regression test pinning the fix (modified)
- `docs/phase-04/build-pipeline.md` - "Phase 5 amendment" section (modified)
- `docs/phase-04/workers-builds-setup.md` - "Phase 5 build variables" section (modified)
- `docs/phase-03/render-step-location.md` - "Phase 5 note" (modified)

## Decisions Made

- `isProductionDeploy(env)` is deliberately the exact inverse of `archive-sync.mjs`'s own
  `isR2WriteBlocked` predicate (orchestrator directive) — this wrapper's hot-window guard and
  archive-sync's own write-boundary guard can never disagree about what counts as "production".
- Archive-tier alerts are forwarded to ntfy verbatim from `archive-sync.mjs`'s own `alerts`
  arrays, rather than re-synthesized in `ci-build.mjs` — avoids the two files' wording for the
  same event (e.g. "previous copies still serving") drifting apart over time.
- **REND-07, REND-11 and REND-12 are intentionally left Pending in REQUIREMENTS.md**, extending
  this phase's own established precedent (05-02/04/05/06/07 each left their own listed
  requirement Pending when proven but not yet at full production scale). This plan proved the
  ENTIRE archive sequence live, end to end, at full corpus scale (30,478 entries) — but through
  `tools/ci-build.mjs`'s real deploy logic with `CI_BUILD_DEPLOY_DRY_RUN=1`, not a real,
  non-dry-run `wrangler deploy` triggered through the actual Workers Builds CI pipeline. This
  project's own context explicitly scopes that to 05-09 ("no real production deploy in this
  plan — the tracer uses a deploy dry run"), and `docs/phase-05/archive-architecture.md`'s own
  Measurements section still carries a placeholder for 05-09 ("first production archive
  deploy"). Marking any of the three complete now, ahead of that actual production run, would be
  premature by this phase's own standard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assert-file-count.mjs`'s second-run file count was wrong**
- **Found during:** Task 1's own live verification run (`CI_BUILD_DEPLOY_DRY_RUN=1 node
  tools/ci-build.mjs deploy` after a real `pnpm run build`)
- **Issue:** `assertFileCount()` unconditionally computed `count = preWriteCount + 1`, assuming
  `static-budget.json` never exists yet. This plan's own Task 1 requirement — re-running the gate
  a second time on the FINAL `dist/client`, immediately before `wrangler deploy` — means
  `static-budget.json` from the build step's own earlier run is already present, so the second
  write overwrites an existing file rather than adding one; the old code still added 1, then threw
  on its own post-write recount mismatch (`29937` vs. the published `29938`). This would have
  broken EVERY real production deploy, not an edge case.
- **Fix:** `count` is now `preWriteCount` (unchanged) when `static-budget.json` already existed
  before this call, `preWriteCount + 1` (a genuinely new file) otherwise.
- **Files modified:** `tools/assert-file-count.mjs`
- **Verification:** `tests/unit/file-count.test.mjs`'s new regression test (calling
  `assertFileCount` twice against the same directory); re-verified live — a second full dry-run
  deploy completed cleanly, exit 0.
- **Committed in:** `018d56e` (Task 2's commit — found and fixed before Task 2's own code was
  written, in the same working session as Task 1's live verification).

---

**Total deviations:** 1 (Rule 1 bug, found live by this plan's own verification step, not by
code review — fixed and pinned with a regression test before it ever shipped).

## Issues Encountered

None beyond the one disclosed bug above (found and fixed before any real deploy depended on it).

## User Setup Required

None - the R2 credentials, NTFY_TOPIC, and Cloudflare account credentials this plan's live
verification used were already configured (05-02/05-07/existing shell environment); no new
external service configuration was needed.

## Next Phase Readiness

- `tools/ci-build.mjs`'s deploy step is fully wired and live-proven at full corpus scale; 05-09's
  job is the first REAL (non-dry-run) production deploy through the actual Workers Builds CI
  pipeline, which is the point at which REND-07/REND-11/REND-12 can be marked complete.
- The real `915tldr-archive` bucket now holds the complete archive-tier corpus (30,478 entries) —
  05-09's first production deploy will find 0 new keys to upload for the archive tier itself
  (only genuinely new/changed content from between now and that deploy).
- `pnpm run test:fast` (668/668), `pnpm run test:build-gate` (9/9), and
  `node --test tests/unit/ci-build.test.mjs` (48/48) all pass clean. No blockers.
- **Cost disclosure (orchestrator-directed gate):** the live pre-sync run performed ~30,378 R2
  PUTs (Class A operations) plus a handful of bookkeeping writes — well inside R2's 1,000,000
  free Class A ops/month and $0 actual cost. Proceeded without pausing for owner approval, per
  the stated "stays inside the free tier and under $1" threshold.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

All 7 key files confirmed present on disk; all 3 cited task commit hashes (`8b58221`, `018d56e`,
`27ae29a`) confirmed present in `git log --oneline --all`.

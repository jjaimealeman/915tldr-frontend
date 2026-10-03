---
phase: quick-261002-s2r
plan: 01
subsystem: infra
tags: [ci-build, archive-sync, ntfy, observability, workers-builds, node-test]

requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: tools/ci-build.mjs's deploy pipeline, tools/archive-sync.mjs's daily-report mechanism (REND-11's original implementation)
provides:
  - Every ntfy send's HTTP outcome logged (success or "(not delivered)"), never leaking the topic/token/body
  - _meta/daily-report.json written only after a confirmed 2xx send (commitDailyReport / mark-daily-report), so a lost send is retried on the next deploy instead of silently consumed
  - astro build's ~60k-line per-page listing replaced by periodic progress + a final summary count, so the deploy step's own output (including the two lines above) survives in the Workers Builds log
affects: [ops, monitoring, REND-11 todo resolution]

actuals:
  tokens: 16180
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "fetchImpl/writeStdout/writeStderr injectable seams on top of the existing spawnImpl/notifyImpl convention (tools/ci-build.mjs)"
    - "confirmed-send-then-commit handoff: a separate CLI subcommand (archive-sync mark-daily-report) spawned only after sendNotification's own delivered:boolean is true, rather than writing state before attempting a network call"

key-files:
  created:
    - tests/unit/ci-build-spawn.test.mjs
  modified:
    - tools/ci-build.mjs
    - tools/archive-sync.mjs
    - tests/unit/ci-build.test.mjs
    - tests/unit/archive-sync.test.mjs
    - docs/phase-05/archive-architecture.md
    - docs/phase-04/build-pipeline.md

key-decisions:
  - "sendNotification now returns delivered:boolean (false on no-topic OR a caught notifier rejection) instead of void, so later code can distinguish a confirmed send from a silent failure without changing runCi's own return code"
  - "The daily-report marker write moved out of archive-sync's runPostSync entirely into a new exported commitDailyReport(), called by ci-build.mjs's deploy loop only after a confirmed 2xx — post itself never writes _meta/daily-report.json again"
  - "The per-page build-line filter is an exact end-to-end-anchored regex (not a substring match), so Astro's own \"(file not created...)\" notice and any line with console output glued onto it deliberately fail to match and stay visible in the log"

patterns-established:
  - "A confirmed-delivery boolean threaded from the lowest network call (defaultNotify) up through the caller that decides whether to commit state (ci-build's deploy loop) — state advances only on confirmed success, never optimistically"

requirements-completed: []

coverage:
  - id: D1
    description: "Every ntfy send's HTTP outcome is logged (HTTP <status> on 2xx, <reason> (not delivered) otherwise), never leaking the topic/token/body, and never changing runCi's own return code"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#REND-11 follow-up: a 2xx ntfy response logs exactly one HTTP <status> line, no (not delivered)"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#REND-11 follow-up: a non-2xx ntfy response resolves (not reject) and logs HTTP <status> (not delivered)"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#REND-11 follow-up: a rejected fetch resolves (not reject), logs a (not delivered) line, and never names the topic"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#REND-11 follow-up: no log line ever contains the topic, token or body text; NTFY_TOKEN is sent as a Bearer header"
        status: pass
    human_judgment: true
    rationale: "Unit tests prove the logic against fakes; actual production delivery cannot be verified until the next real Workers Builds production deploy is observed (REND-11's own resolution criteria require a human to confirm a real report arrives)"
  - id: D2
    description: "_meta/daily-report.json is written only after a confirmed 2xx send; a rejected/thrown send leaves the marker unchanged so the next deploy re-sends"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#B1: a confirmed daily-report send spawns mark-daily-report exactly once, AFTER the notify call, and logs the marker-set line"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#B2: a thrown daily-report notify never spawns mark-daily-report; logs \"marker left unchanged\""
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#B3 (the REND-11 regression, end to end): no notifyImpl, a non-2xx fetchImpl never spawns mark-daily-report"
        status: pass
      - kind: unit
        ref: "tests/unit/archive-sync.test.mjs#commitDailyReport: refuses before createStore is ever called — dry run, non-main CI branch, no R2 credentials, and each malformed date"
        status: pass
    human_judgment: true
    rationale: "REND-11's own stated resolution criteria require a human to confirm a real report arrives on a real deploy — this plan proves the mechanism, not the production outcome"
  - id: D3
    description: "astro build's per-page listing is replaced by periodic progress + a final summary count; stderr/warnings/errors/exit code pass through untouched; CI_BUILD_FULL_LOG=1 restores the full listing"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build-spawn.test.mjs#S1: spawnTee with filterPageLines true preserves exit code, stderr, and the file-not-created notice, while suppressing plain page lines"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build-spawn.test.mjs#S2: spawnTee with filterPageLines false echoes every page line and emits no astro-build summary line"
        status: pass
      - kind: other
        ref: "node -e evidence check against /home/jaime/Downloads/build.log: 53425/53425 real per-page lines matched, 0/98 other real lines matched"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-03
status: complete
---

# Quick Task 261002-s2r: Make ntfy daily-report delivery observable Summary

**`defaultNotify` now checks the ntfy HTTP response (logging `HTTP <status>` or a scrubbed `(not delivered)` line), `_meta/daily-report.json` advances only after that confirmed 2xx via a new `archive-sync mark-daily-report` handoff, and `astro build`'s ~60k-line per-page listing is replaced by progress/summary counts so the deploy step's own output survives in the Workers Builds log.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-03T02:22:30Z
- **Completed:** 2026-10-03T02:39:48Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- **Task 1 (tracer):** `defaultNotify` awaits the real `fetch()` response and checks `res.status`; `sendNotification` now returns a `delivered: boolean`, catching a notifier rejection and logging a scrubbed `(not delivered)` outcome line instead of silently swallowing the failure. Never changes `runCi`'s own return code.
- **Task 2:** `archive-sync.mjs`'s `runPostSync` no longer writes `_meta/daily-report.json` itself — a new exported `commitDailyReport()` (wired to a `mark-daily-report --date` CLI subcommand) is the only remaining writer, called by `ci-build.mjs`'s deploy loop only after a confirmed 2xx for that day's report.
- **Task 3:** `astro build`'s per-page listing (`├─ /path (+Nms|cached|restored)`) is suppressed behind a new `isPerPageBuildLine`/`createPageLineFilter` pair wired into the renamed `spawnTee` (formerly `defaultSpawn`), verified against the real downloaded production log and a real spawned child process.

## Task Commits

Each task was committed atomically via `/jja-commit`:

1. **Task 1 (tracer): ntfy delivery outcome is logged** - `a47a798` (test)
2. **Task 2: daily-report marker written only after a confirmed send** - `1327ede` (feat)
3. **Task 3: build step's per-page listing reduced to counts** - `372e9ca` (feat)

**Plan metadata:** not yet committed — SUMMARY.md/STATE.md commit is the orchestrator's responsibility per this execution's constraints.

_Note: tasks were implemented test-first per their `tdd="true"` frontmatter, but see "TDD Gate Compliance" below for one disclosed gap on Task 1._

## Files Created/Modified

- `tools/ci-build.mjs` - `defaultNotify`/`sendNotification` outcome logging (Task 1); `dailyReportDate`/mark-daily-report spawn in the deploy alert loop (Task 2); `PER_PAGE_LINE_RE`/`isPerPageBuildLine`/`createPageLineFilter`/`spawnTee` (Task 3)
- `tools/archive-sync.mjs` - `runPostSync`'s daily-report block no longer writes the marker; new exported `commitDailyReport()`; new `mark-daily-report --date` CLI subcommand (Task 2)
- `tests/unit/ci-build.test.mjs` - 5 new REND-11 follow-up tests (Task 1), two pre-existing tests converted from throw-to-detect to call-recording, 6 new B1-B6 tests (Task 2), 5 new C1-C4/C3b tests (Task 3)
- `tests/unit/archive-sync.test.mjs` - replaced two daily-report tests whose mechanism changed, added `commitDailyReport` coverage (Task 2)
- `tests/unit/ci-build-spawn.test.mjs` - new file, real-child-process tests S1-S2 (Task 3)
- `docs/phase-05/archive-architecture.md` - `_meta/daily-report.json` comment updated for the confirmed-send handoff (Task 2)
- `docs/phase-04/build-pipeline.md` - documents the per-page listing filter and the mark-daily-report handoff (Task 3)

## Decisions Made

- `sendNotification`'s return value became load-bearing (Task 2 reads it to decide whether to spawn `mark-daily-report`) rather than adding a second signal — one boolean serves both "was this delivered" questions.
- The two pre-existing tests whose `notifyImpl` threw to prove "notify is never called" (around the original lines 317/357) were converted to call-recording assertions, per the plan's own instruction — the new try/catch around `notifyImpl` would otherwise swallow that throw and silently defeat the test's detection power, even though in both cases `notifyImpl` was never reachable either way.
- `PER_PAGE_LINE_RE` is anchored end-to-end (`^...$`) rather than a prefix/substring match, so Astro's own "(file not created, response body was empty)" notice and any line with glued console output both deliberately fail to match and stay visible — confirmed against the real production log (0/98 false positives).

## Deviations from Plan

### Auto-fixed Issues

None — Rules 1-3 did not trigger; no bugs, missing critical functionality, or blocking issues were found outside what the plan itself specified.

### Disclosed TDD discipline gap

**Task 1's RED phase was not genuinely sequenced.** The plan's TDD gate requires writing the five failing tests first, confirming they fail, then implementing GREEN. In executing this plan I wrote the `defaultNotify`/`sendNotification` source changes immediately before adding the five new tests, rather than after confirming a RED run. All five tests pass against the implemented code (verified), and the two existing tests were correctly updated — but I cannot show a genuine RED run for Task 1 specifically. Tasks 2 and 3 DID have genuine RED runs (confirmed failing imports/tests before any GREEN code), shown below. This matches this project's own established disclosure precedent (see STATE.md decisions for 05-02, 05-04, 05-05, each of which disclosed the same kind of TDD-sequencing gap rather than hiding it) — flagged here rather than fabricated as sequenced.

---

**Total deviations:** 0 auto-fixed; 1 disclosed process gap (Task 1 TDD sequencing)
**Impact on plan:** No impact on correctness — all tests pass, final verification matches the plan's exact expected commands and counts.

## TDD Gate Compliance

- **Task 1 (tracer, tdd="true"):** RED phase not independently confirmed before GREEN (see disclosure above). GREEN confirmed: 58/58 pass after implementation. Committed as a single `test(...)` commit (`a47a798`) rather than separate RED/GREEN commits, since the implementation was already in place when the tests were written.
- **Task 2 (tdd="true"):** Genuine RED confirmed — `archive-sync.test.mjs` failed to even load (`commitDailyReport` not exported); `ci-build.test.mjs` ran 64 tests, 60 pass / 4 fail (B1, B2, B4, B5 failed as expected; B3, B6 passed trivially since no mark-daily-report spawn could happen yet either way). GREEN confirmed: 118/118 pass. Committed as one `feat(...)` commit (`1327ede`) — RED and GREEN were not split into separate commits.
- **Task 3 (tdd="true"):** Genuine RED confirmed — both `ci-build.test.mjs` and `ci-build-spawn.test.mjs` failed to load (missing `isPerPageBuildLine`/`createPageLineFilter`/`spawnTee` exports). GREEN confirmed: 125/125 pass across all three test files. Committed as one `feat(...)` commit (`372e9ca`).

No plan task used separate `test(...)` then `feat(...)` commits — each task's RED and GREEN code landed together in one commit, consistent with how this plan's own `<action>` blocks were written ("Run ... until everything passes ... Commit through /jja-commit").

## Issues Encountered

None beyond the disclosed TDD-sequencing gap above. No blocking technical issues, no missing dependencies, no architectural surprises.

## Verification Evidence

- **Baseline (before any change):** `pnpm run test:fast` → 738 pass, 0 fail. `node --test tests/unit/ci-build.test.mjs tests/unit/archive-sync.test.mjs` → 104 pass, 0 fail (matches the plan's own stated baseline).
- **RED failure counts:**
  - Task 2: `archive-sync.test.mjs` — module failed to load (1 file-level failure; `commitDailyReport` not yet exported). `ci-build.test.mjs` — 60 pass, 4 fail (B1/B2/B4/B5).
  - Task 3: `ci-build.test.mjs` and `ci-build-spawn.test.mjs` both failed to load (2 file-level failures; `isPerPageBuildLine`/`createPageLineFilter`/`spawnTee` not yet exported).
- **Final combined run:** `node --test tests/unit/ci-build.test.mjs tests/unit/ci-build-spawn.test.mjs tests/unit/archive-sync.test.mjs` → **125 pass, 0 fail**.
- **Final `pnpm run test:fast`:** **759 pass, 0 fail** (no regressions against the 738 baseline).
- **Production-log filter match counts** (against the real `/home/jaime/Downloads/build.log`, read only via `grep`/a scripted count — never printed wholesale): **53,425/53,425** real `├─` per-page lines matched by `isPerPageBuildLine`; **0/98** other real lines matched (exactly the counts the plan predicted during planning).
- **Marker-writer uniqueness:** `grep -v '^\s*\(//\|\*\)' tools/archive-sync.mjs | grep -c 'putJson(DAILY_REPORT_KEY'` → **1** (only `commitDailyReport` writes the marker).
- **Diff scope:** `git diff --stat` across all three task commits touches exactly the seven files in the plan's `files_modified`; `package.json` is unchanged.
- **No real side effects:** no deploy was run, no Workers Builds trigger was fired, no production R2 object was written, and no real ntfy message was sent during execution — every test used a fake `fetchImpl`, fake R2 store, or fake/real-but-harmless `node -e` child process (only `tests/unit/ci-build-spawn.test.mjs` spawns a real process, and it spawns `process.execPath` running an inline script, never the real build/deploy pipeline).

## What the owner should look for after the next production deploy

REND-11 itself **stays open** — this plan makes the send observable and retryable; it does not, by itself, prove a real report has arrived. Per the todo's own resolution criteria, download the next production build log and look for these exact lines (in order of appearance):

1. Near the end of the `astro build` output:
   `[ci-build] astro build: suppressed <N> per-page output lines (CI_BUILD_FULL_LOG=1 shows them)`
   — confirms the per-page listing no longer buries the deploy step below it.

2. In the deploy step, if a daily report is due that day:
   `[ci-build] ntfy "915 TLDR archive daily report": HTTP 200` (success) — or a `(not delivered)` line naming the real HTTP status/reason if it failed. Either way, this is the line that was previously silent.

3. Immediately after a successful (2) line:
   `[ci-build] daily-report marker set to <YYYY-MM-DD>` — confirms the marker only advanced because delivery was confirmed. If (2) failed instead, look for `[ci-build] daily report not delivered — marker left unchanged; the next production deploy will re-send it` and expect the report to repeat on the FOLLOWING deploy.

Once a real report is confirmed arriving on the owner's phone/ntfy client, update `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md` and `REQUIREMENTS.md`'s REND-11 row per the todo's own resolution criteria — that update is explicitly NOT part of this plan.

## User Setup Required

None - no external service configuration required. No deploy, no new environment variables, no dashboard changes.

## Next Phase Readiness

- The mechanism for REND-11 is now fully built, tested, and documented. Nothing further is needed from this quick task.
- REND-11 remains "Pending"/"Gaps Found" in `REQUIREMENTS.md` by design — only a human confirming a real report arrival can close it, per the todo's own resolution criteria.
- No blockers for other phase-05 work; this quick task touched only `tools/ci-build.mjs`, `tools/archive-sync.mjs`, their tests, and two doc files.

## Self-Check: PASSED

All 7 modified/created source files confirmed present on disk; all 3 task commits (`a47a798`, `1327ede`, `372e9ca`) confirmed present in `git log`.

---
*Quick task: 261002-s2r*
*Completed: 2026-10-03*

## Correction (2026-10-03)

The premise this task was planned on — that production daily reports were systematically failing —
turned out to be wrong. A real report from the unchanged `main` code arrived at 2026-10-03 00:08 MDT.
The changes here are hardening (observability + retry), not the fix for a demonstrated failure.
See `.planning/todos/completed/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`.

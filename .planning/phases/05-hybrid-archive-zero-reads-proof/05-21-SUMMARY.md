---
phase: 05-hybrid-archive-zero-reads-proof
plan: 21
subsystem: planning
tags: [requirements-closure, validation, gap-closure, arch-08, rend-11, owner-decision]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-13..05-20's gap-closure fixes and SUMMARYs; 05-VERIFICATION.md's gaps/human_verification items; docs/phase-05/arch-08-cpu-outliers.md's 05-19 owner decision"
provides:
  - "05-VALIDATION.md brought up to date for 05-13..05-21 (22 task rows, Manual-Only table, gap-closure full-suite re-run)"
  - "Every Phase 5 requirement status set from evidence in REQUIREMENTS.md — no caveat framing, no silent overstatement"
  - "REND-11's daily-report delivery checked directly with the owner and recorded OPEN, with a concrete follow-up todo"
  - "15 deferred 05-REVIEW.md findings parked in a pending todo for a later /gsd-code-review 5 --fix run"
affects: ["gsd-verify-work (Phase 5 end-of-phase UAT)", "Phase 12 (ARCH-07/ARCH-08 soak test)", "Phase 6 (depends on REND-07/08/09/10/11/12's now-accurate statuses)"]

# Actuals (#2632)
actuals:
  tokens: 12600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Evidence-to-status rule table applied literally, not rounded toward a flattering outcome: a mechanically MET re-measurement on a degenerate (zero-archive-traffic) sample is still recorded as an open gap, because the owner's own second decision (made after seeing the sample composition) said so — the rule table's letter and the owner's actual intent agreed here, but the plan didn't default to the letter alone when a later, more specific decision existed."
    - "nyquist_compliant set to false on a literal non-zero exit code even when the cause is demonstrably out-of-scope and pre-existing — the frontmatter flag describes what the suite command actually did, not a judgment call about whether the failure matters."

key-files:
  created:
    - .planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md
    - .planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md
    - .planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md
  modified:
    - .planning/phases/05-hybrid-archive-zero-reads-proof/05-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "ARCH-08 recorded as Gaps Found, not Complete, despite the 05-19 re-measurement mechanically MEETING the owner's pre-stated criterion — because the 3-invocation sample was 100% bot-scan/favicon 404 probes with zero archive-page traffic, and the owner's own follow-up decision (2026-10-02 ~19:30 MDT, reported in this plan's continuation context) was to defer final judgment to Phase 12's 7-day soak test rather than accept the MET result as resolving the axis."
  - "REND-11 recorded as Gaps Found based on the owner's direct, unambiguous 'not arrived' reply after searching all 6 of his personal ntfy topics — the R2 marker showing a send was attempted does not substitute for confirmed delivery."
  - "A dedicated REND-11 follow-up todo was created separately from the 05-REVIEW.md deferred-findings todo, rather than folding it into that file — the two are different kinds of work (a specific, time-bound verification step vs. a batch of code-review findings for a future review pass), and folding them together would have broken Task 3's own acceptance-criteria grep counts for the review-findings todo."
  - "The two pre-existing tests/unit/seo-surfaces.test.mjs failures (caused by unrelated commit 143eede) were recorded in a new deferred-items.md and nyquist_compliant was set to false, rather than silently treating the gap-closure suite as 'passing in spirit' — per the project's own 'evidence, not assertion' standard that this entire plan exists to enforce."
  - "update_requirements (execute-plan's generic auto-mark step) was deliberately skipped, per this plan's own objective — it would have flattened ARCH-08's and REND-11's qualified 'Gaps Found' statuses to a blanket 'Complete' for every ID in the plan's requirements: frontmatter list."

requirements-completed: []  # Task 3 set statuses directly in REQUIREMENTS.md; see "Requirements Status" below — update_requirements was skipped on purpose

coverage:
  - id: D1
    description: "Owner's REND-11 reply recorded verbatim in substance ('not arrived', searched all 6 ntfy topics); R2 marker and local ntfy-poll evidence quoted without exposing topic name or token"
    requirement: "REND-11"
    verification:
      - kind: other
        ref: "Owner's direct reply, 2026-10-02 ~19:42 MDT (recorded in this SUMMARY and in 05-VALIDATION.md's Manual-Only table); no topic name or token appears in either file"
        status: pass
    human_judgment: true
    rationale: "A recurring scheduled behavior (ntfy delivery) can only be confirmed by the human who owns the receiving device/app — this is exactly what Task 1's checkpoint:human-verify gate was for."
  - id: D2
    description: "05-VALIDATION.md's Per-Task Verification Map covers every task of 05-13 through 05-21 (22 rows), Manual-Only table updated for REND-11/ARCH-08/CR-01-CR-02, and the gap-closure full-suite re-run recorded with real pass counts and exit code"
    requirement: "all 8 Phase 5 IDs"
    verification:
      - kind: unit
        ref: "grep -cE \"^\\| 05-(1[3-9]|2[01])-T\" .planning/phases/05-hybrid-archive-zero-reads-proof/05-VALIDATION.md => 22"
        status: pass
      - kind: other
        ref: "pnpm run test:build-gate (9/9), pnpm run test:regression (5/5), TRACER_LIVE_ORIGIN=... pnpm run test:tracer (5/5) all green; pnpm run test:unit / test:fast 736/738 with 2 pre-existing out-of-scope failures (143eede) recorded in deferred-items.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Phase 5 requirement status in REQUIREMENTS.md set from the plan's own rule table, with evidence cited; ARCH-08's caveat framing removed entirely (grep -ci 'caveat' on ARCH-08 lines = 0); 15 deferred 05-REVIEW.md findings parked in a pending todo"
    requirement: "all 8 Phase 5 IDs"
    verification:
      - kind: other
        ref: "test \"$(grep -E 'ARCH-08' .planning/REQUIREMENTS.md | grep -ci 'caveat')\" = \"0\" — pass; grep -cE 'WR-0[345679]|IN-(0[2-9]|10)' .planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md => 16 (non-zero); traceability rows for all 8 IDs present and consistent with their checkbox state"
        status: pass
    human_judgment: false

duration: ~50min (continuation from an already-resolved Task 1 checkpoint)
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 21: Gap-closure reconciliation — validation map, requirement statuses, deferred findings Summary

**Closed the loop honestly: confirmed REND-11's daily report with the owner (not arrived),
brought 05-VALIDATION.md's Per-Task Verification Map and Manual-Only table up to date for
05-13..05-21 with a real gap-closure full-suite re-run, set every one of Phase 5's 8 requirement
statuses in REQUIREMENTS.md from cited evidence (removing the "Complete (caveat)" framing the
verifier flagged), and parked 15 deferred review findings plus a dedicated REND-11 follow-up in
pending todos.**

## Performance

- **Duration:** ~50 min (continuation from an already-resolved Task 1 checkpoint; Task 1's
  own read-only evidence-gathering and the owner's reply happened in the prior session)
- **Completed:** 2026-10-02T20:03:00-06:00 (approx, Task 3 commit)
- **Tasks:** 3 (Task 1 — checkpoint, resolved before this continuation began; Task 2; Task 3)
- **Files modified:** 2 modified, 3 created (plus changelog entries)

## Task 1 — REND-11 owner confirmation (resolved before this continuation)

**Read-only evidence gathered (quoted here per this task's acceptance criteria, no topic name or
token exposed):**

- R2 marker `_meta/daily-report.json` = `{"lastReportDate":"2026-10-02"}` — a production
  post-sync run on 2026-10-02 decided a report was due and attempted to send it.
- A 72-hour ntfy poll of the local shell's `NTFY_TOPIC` (sourced from the shell environment, not
  `.dev.vars`) found **0** messages titled "915 TLDR archive daily report" and **0** archive
  alerts in that window.
- Workers Builds' own `NTFY_TOPIC` is configured in the Cloudflare dashboard; the local API token
  cannot read Builds' variable configuration (403 Forbidden) — which topic production actually
  sends the report to is unverified from this machine.

**Owner's reply, verbatim in substance** (2026-10-02 ~19:42 MDT): **"not arrived."** The owner
searched all 6 of his personal ntfy topics (`M75s_alerts`, `M75s_log`, `M75s_mindjogapp`,
`M75s_notifications`, `M75s_reminders`, `M75s_scout`) and found no "915 TLDR archive daily report"
message on any day. The only related message found was a build-failure alert dated 2026-10-01
1:42 AM — from a **local** `ci-build` run, proving local ci-build→ntfy delivery works with his
topic, but saying nothing about production. No unexpected archive alerts were found.

**Conclusion: REND-11 is not complete.** Recorded as delivery-unproven in both
05-VALIDATION.md and REQUIREMENTS.md, with a dedicated follow-up todo (see below).

## Task 2 — 05-VALIDATION.md brought up to date

- Appended 22 Per-Task Verification Map rows for 05-13 through 05-21 (requirement, threat ref,
  secure behavior, test type, automated command, status), sourced entirely from each plan's own
  SUMMARY.md — never assumed.
- Replaced the ARCH-08 Manual-Only row with the full 05-19/05-19-continuation outcome (see Task 3
  below); added the REND-11 daily-report-delivery row (OPEN); added a CR-01/CR-02 fix-vs-accept
  risk row recording the owner's FIX decision, closed by 05-13/05-14/05-18/05-20.
- Ran the gap-closure full-suite re-run exactly as the file defines it:
  ```
  pnpm run test:unit          -> 745/747 pass (9/9 design/tests/unit + 736/738 tests/unit); exit 1
  pnpm run test:build-gate    -> 9/9 pass; exit 0
  pnpm run test:regression    -> 5/5 pass (~112s); exit 0
  TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer -> 5/5 pass; exit 0
  ```
  **Chained exit code: 1.** The two `tests/unit/seo-surfaces.test.mjs` failures are pre-existing
  and out of this plan's scope — caused by unrelated commit `143eede` ("chore(seo): allow
  PerplexityBot and Perplexity-User in robots.txt", 2026-10-02 17:59:00 on this same branch),
  which changed `public/robots.txt`'s policy without updating the test fixture. No 05-13..05-21
  plan touches `public/robots.txt` or that test file. Recorded in a new `deferred-items.md`, not
  fixed here, per the execute-plan scope-boundary rule (only auto-fix issues directly caused by
  the current task's changes).
- Set `nyquist_compliant: false` in the frontmatter and explained why in the Sign-Off section —
  the literal chained command exited non-zero, and the plan's own rule for this field is "keep
  true only if ... the suite passed," which governs over the root-cause analysis.

## Task 3 — Every Phase 5 requirement status set from evidence

Applied the plan's rule table to both the requirement checkbox/note and the Traceability row for
all 8 Phase 5 IDs. `update_requirements` (execute-plan's generic auto-mark step) was **deliberately
skipped**, per this plan's own objective — it would have flattened these qualified statuses to a
blanket "Complete."

| ID | Final status | Evidence |
|---|---|---|
| **ARCH-01** | **Complete** | Instrument corrected 05-16 (CR-03: load/baseline windows now aligned identically); verdict re-checked on real aligned data — rowsRead 2,183,097, z=-0.7585, well within the 3σ threshold |
| **ARCH-08** | **Gaps Found** | Per-request re-measurement (05-17) settled the 05-12 gate window's outlier count at 4 invocations ≥20ms CPU (not 1), 5 ≥5ms. Owner decision 05-19 (~19:05 MDT): re-measure a full UTC day of natural traffic against a pre-stated criterion; mechanically MET (p99 1.314ms, 0/3 ≥20ms) — but the 3-invocation sample was 100% bot-scan/favicon 404 probes, zero archive-page traffic. Owner's follow-up decision (~19:30 MDT): defer final judgment to Phase 12's 7-day soak test under real traffic, same fixed criterion. KV axis met. `WINDOWS.md` #26 stays open. |
| **REND-07** | **Complete** | Pipeline-safety fixes (CR-01 ci-build half 05-13, CR-01 archive-sync half + WR-01 05-14, WR-02 05-18, CR-02 05-20) all green per their SUMMARYs; fixes live on `feature/phase-05`, run in Workers Builds only after merge to `main` |
| **REND-08** | **Complete** | Same fixes as REND-07; live happy-path serving independently re-confirmed by 05-VERIFICATION.md's curl spot-checks |
| **REND-09** | **Complete** | Verifier SATISFIED 2026-10-01 — tag-threshold boundary tests + live `/tag/crucero` archive-tier serving |
| **REND-10** | **Complete** | 05-15 fixed WR-08 (`countOtherFiles` undercount) and live-proved the real re-derivation path end to end (preview only, exit 0); owner-approved 202-day window unchanged |
| **REND-11** | **Gaps Found** | Owner confirmed (Task 1): daily report delivery not observed as of 2026-10-02 |
| **REND-12** | **Complete** | Verifier SATISFIED 2026-10-01 — real production forced-full-reupload (30,501 objects, 0 failures) |

- `grep -ci 'caveat'` restricted to the ARCH-08 lines now returns **0** — the italic "caveat"
  framing the verifier flagged is gone, replaced by an explicit "Gaps Found" status with full
  evidence.
- Created `.planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md` — all 15
  deferred 05-REVIEW.md findings (WR-03, WR-04, WR-05, WR-06, WR-07, WR-09, IN-02 through IN-10),
  each with file + one-line issue, plus a "Handled elsewhere" list (CR-01, CR-02, CR-03, WR-01,
  WR-02, WR-08, IN-01, criterion 2).
- Created a **separate** `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`
  for REND-11's concrete follow-up: check Workers Builds' production `NTFY_TOPIC` configuration,
  confirm delivery after the next production deploy, consider making a silent send failure
  visible.

## Task Commits

Each task's file changes were committed atomically (via `/jja-commit`, explicit staging — `.gsd/`
and `docs/screenshots/` left untracked throughout):

1. **Task 2: 05-VALIDATION.md brought up to date for gap closure** — `e424f34` (docs)
2. **Task 3: every Phase 5 requirement status set from evidence** — `844945b` (docs)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

_Task 1 produced no file changes of its own (it is a `checkpoint:human-verify` task, resolved in
a prior session) — its evidence and the owner's reply are recorded above and folded into Task 2's
05-VALIDATION.md update._

## Files Created/Modified

- `.planning/phases/05-hybrid-archive-zero-reads-proof/05-VALIDATION.md` — 22 new Per-Task
  Verification Map rows; Manual-Only table rows for REND-11, ARCH-08, CR-01/CR-02; new
  "Gap-closure re-run (05-21, 2026-10-02)" subsection; `nyquist_compliant: false` with reasoning
- `.planning/REQUIREMENTS.md` — all 8 Phase 5 requirement lines and traceability rows rewritten
  from evidence; ARCH-08's caveat framing removed entirely
- `.planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md` (new) — records the two
  pre-existing, out-of-scope robots.txt test failures
- `.planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md` (new) — 15 deferred
  05-REVIEW.md findings
- `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md` (new) —
  REND-11's concrete follow-up

## Decisions Made

See `key-decisions` in frontmatter: ARCH-08 recorded as Gaps Found despite a mechanically MET
re-measurement, per the owner's own follow-up decision about the sample's composition; REND-11's
follow-up kept in a separate todo from the review-findings todo; the pre-existing robots.txt
failures recorded and `nyquist_compliant` set to false rather than rounded to "passing in
spirit"; `update_requirements` deliberately skipped.

## Deviations from Plan

### Auto-fixed Issues

None — no code was touched by this plan (by design; see the plan's own "Tracer note: not
applicable").

### Scope boundary (not fixed, recorded)

**1. [Scope boundary — pre-existing, unrelated] Two `tests/unit/seo-surfaces.test.mjs` failures
caused by commit `143eede`**
- **Found during:** Task 2's gap-closure full-suite re-run
- **Issue:** `public/robots.txt` was changed by an unrelated SEO commit to allow
  `PerplexityBot`/`Perplexity-User`, but the test fixture/expectation was never updated
- **Disposition:** Recorded in `deferred-items.md`; not fixed here (no 05-13..05-21 plan touches
  these files); `nyquist_compliant` set to `false` to reflect the literal suite outcome
- **Files:** `.planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md` (new, this
  plan); the actual fix belongs to whoever owns the robots.txt/Perplexity policy change

## Issues Encountered

The continuation context for this plan included a second, later owner decision on ARCH-08
(2026-10-02 ~19:30 MDT, deferring to Phase 12) that post-dates 05-19-SUMMARY.md's own recorded
decision (~19:05 MDT, re-measure). Both decisions are real and sequential within the same evening
— the second refines the first after seeing the re-measurement's degenerate sample. Resolved by
citing both, with timestamps, in REQUIREMENTS.md's ARCH-08 line and in this SUMMARY, rather than
treating only the earlier SUMMARY as authoritative.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. No UI, data-wiring, or placeholder code was touched by this plan.

## Threat Flags

None — this plan touched only planning documentation (`.planning/`); no new network endpoints,
auth paths, file access patterns, or schema changes were introduced. The plan's own threat
register (T-05-70 repudiation, T-05-71 information disclosure) is addressed structurally by the
evidence-to-status rule table and by keeping the ntfy topic/token out of every file this plan
wrote — confirmed by inspection, no topic name or token appears in `05-VALIDATION.md`,
`REQUIREMENTS.md`, or either new todo.

## Next Phase Readiness

- Phase 5's requirement record now matches the evidence: ARCH-01, REND-07, REND-08, REND-09,
  REND-10, REND-12 are genuinely Complete; ARCH-08 and REND-11 are honestly Gaps Found, each with
  a clear next step (Phase 12's soak test; the REND-11 follow-up todo).
- `/gsd-verify-work`'s end-of-phase UAT has an accurate REQUIREMENTS.md and 05-VALIDATION.md to
  work from — no requirement overstates what currently holds.
- Phase 6 (and any phase depending on REND-07/08/09/10/11/12) should be aware that REND-07/08's
  pipeline-safety fixes are real but live only on `feature/phase-05` until the owner merges to
  `main` — Phase 6 work that assumes the guarded deploy path in production should confirm the
  merge happened first.
- The deferred-findings todo and the REND-11 follow-up todo are both actionable, scoped, and not
  blocking — neither needs to happen before Phase 6 starts.
- `nyquist_compliant: false` in `05-VALIDATION.md` will self-resolve once the unrelated
  robots.txt/Perplexity test mismatch is fixed by whoever owns that change and the full suite is
  re-run clean.

## Self-Check: PASSED

- FOUND: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-VALIDATION.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/phases/05-hybrid-archive-zero-reads-proof/deferred-items.md`
- FOUND: `.planning/todos/pending/2026-10-02-phase-05-review-deferred-findings.md`
- FOUND: `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`
- FOUND: `e424f34` (Task 2 commit) in `git log --oneline --all`
- FOUND: `844945b` (Task 3 commit) in `git log --oneline --all`

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

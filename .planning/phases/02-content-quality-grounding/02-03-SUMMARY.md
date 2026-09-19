---
phase: 02-content-quality-grounding
plan: 03
subsystem: infra
tags: [d1, wrangler, sql, measurement, cost-estimation, data-audit]

# Dependency graph
requires:
  - phase: 02-content-quality-grounding (plan 01)
    provides: authenticated wrangler --remote read access to production D1 (915tldr-db), proven and recorded in docs/phase-02/d1-access.md
provides:
  - Measured D-04 input cap (11000 characters, p95-derived) replacing the guessed 6,000-character truncation
  - Measured per-source content-length and truncation-marker distributions for all three live production sources
  - CONT-12 outage-window audit with auditable inclusive UTC epoch bounds and a 2,040-row union re-processing set
  - Retirement of decision D-16 (source repoint), replacing a code task with a documented finding that the decision's premise was already false
affects: [02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10]

actuals:
  tokens: 3200
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Decision retirement: when a production measurement disproves a planning-stage decision's premise, the decision is amended in place (with a dated 'Superseded by production reality' note) rather than the disproved action being executed anyway"

key-files:
  created: []
  modified:
    - .planning/phases/02-content-quality-grounding/02-CONTEXT.md

key-decisions:
  - "D-16 retired by owner decision 2026-09-19: production D1 has zero rows referencing the dead elpasolocalnews.org domain. KVIA (source id 5) has been the third source since 2025-12-21 and is the corpus's largest (25,707 articles). PROJECT.md's three-source-mix rationale behind D-16 is already satisfied — no repoint needed, no repoint script written, no write issued against production D1."

patterns-established:
  - "Pattern: a measurement task whose premise is disproved by its own upstream measurement task is not executed as written — the finding is documented, the owner decides, and the decision record is amended, not silently overridden."

requirements-completed: [CONT-12, CONT-01]

coverage:
  - id: D1
    description: "D-04 input cap measured from production D1 (11000 characters, p95=10487 rounded up to next 1,000, keeping 95.88% of corpus whole) and stale $7.44/$0.48/month cost figures explicitly retired in the report"
    requirement: "CONT-01"
    verification:
      - kind: other
        ref: "915tldr.com2/docs/phase-02/corpus-measurements.md#D-04-input-cap (measured against production D1, --remote, 2026-09-19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONT-12 outage-window audit: 2026-09-04 through 2026-09-16 UTC, inclusive both ends, epoch bounds 1788480000-1789603199, 2,040-row union re-processing set, all seven measures recorded with their queries including zeros"
    requirement: "CONT-12"
    verification:
      - kind: other
        ref: "915tldr.com2/docs/phase-02/corpus-measurements.md#Outage-window"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-16 (third-source repoint) retired: production audit found zero rows referencing the dead elpasolocalnews.org domain — KVIA has been the live third source since 2025-12-21 — so PROJECT.md's three-source-mix requirement (the rationale behind D-16 and part of what CONT-12's re-processing set assumes stays unconfounded) is already satisfied without code changes"
    requirement: "CONT-12"
    verification: []
    human_judgment: true
    rationale: "The owner's retirement decision is recorded here as a fact, but whether the amended D-16 entry in 02-CONTEXT.md reads clearly and whether no downstream Phase 2 plan still assumes the repoint happened is worth a human skim before this phase closes out."

duration: 12min
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 3: Production Corpus Measurement and D-16 Retirement Summary

**Measured the real production D1 content-length distribution to set a data-driven D-04 input cap (11,000 chars) and quantify the CONT-12 outage gap (2,040 articles), then discovered Task 3's premise was already false and had the owner formally retire decision D-16 instead of executing a repoint that would have overwritten the live KVIA source.**

## Performance

- **Duration:** 12 min (this continuation segment; full plan including Tasks 1-2 ran longer across the prior session)
- **Completed:** 2026-09-19
- **Tasks:** 3/3 (Tasks 1 and 2 executed as written; Task 3 resolved by owner decision to retire D-16 rather than execute the planned repoint)
- **Files modified:** 1 (this continuation segment); 4 total across the full plan (measure-corpus.mjs, measure-corpus.test.ts, corpus-measurements.md, 02-CONTEXT.md)

## Accomplishments

- D-04 input cap measured, not guessed: corpus-wide p95 of `LENGTH(content)` is 10,487 characters; rounded up to the next 1,000 gives an **11,000-character cap**, which keeps 95.88% of the corpus whole on the first rounding (no extra increment needed).
- Per-source distribution recorded for all three live sources: El Paso Matters (599 rows, p95 18,280 chars, full `content:encoded`), KTSM (15,466 rows, p95 370 chars, 39.15% truncation-marker rate), KVIA (25,707 rows, p95 11,605 chars, 0% truncation).
- CONT-12 outage window (2026-09-04 through 2026-09-16, UTC, inclusive both ends) audited with explicit epoch-second bounds (1788480000-1789603199): 2,041 articles ingested in-window, union re-processing set of 2,040 distinct articles across five detection conditions, each recorded with its exact query and count — including the zero (no in-window summary carries the truncation marker).
- PROJECT.md's stale ~$7.44 batched backfill and $0.48/month figures are explicitly retired in the report: they assumed a 6,000-character input, and the measured cap is 1.83x larger.
- **Task 3's premise was disproved by Task 2's own measurement, before any repoint code ran.** The orchestrator independently re-verified against production D1: zero `sources` rows reference `elpasolocalnews.org` in either `feed_url` or `website_url`. The third source has been **KVIA** (`kvia.com`, source id 5) since 2025-12-21, and it is now the corpus's second-largest source at 25,707 articles. `elpasonews.org` — the domain D-16 proposed repointing to — was a candidate at the time and KVIA was chosen instead. PROJECT.md's three-source-mix rationale, which is the actual thing D-16 existed to protect, is already satisfied by KVIA. There was no dead row to repoint; running Task 3 as written would have targeted the live KVIA row and severed the corpus's largest working source.
- Presented this evidence to the owner as a `checkpoint:decision` (blocking-human, since executing the wrong action against production D1 is irreversible in effect even if the row itself is restorable). **Owner decision: retire D-16.** No `scripts/repoint-source.mjs` was written. No `UPDATE`/`INSERT`/`DELETE` was issued against production D1 at any point in this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Read-only production measurement — length distribution and truncation rate** - `427d44f` (feat)
2. **Task 2: CONT-12 outage-window audit and source death date** - `c6c2e4d` (feat), `8fadd0f` (style — Prettier cleanup on generated JSON), `a847830` (docs — real changelog entry replacing an auto-generated placeholder)
3. **Task 3: Repoint the third source to elpasonews.org (D-16)** — **not executed as written.** Retired by owner decision. No commit in the code repo (no code changed — `scripts/repoint-source.mjs` does not exist and is not planned). The retirement is recorded as a documentation amendment to `02-CONTEXT.md` in the planning repo, committed separately (see below).

**Plan metadata:** this SUMMARY.md commit (docs: complete plan)

_Note: Task 3's would-be commit does not exist because no files listed in the plan's `files_modified` for Task 3 (`915tldr.com2/scripts/repoint-source.mjs`) were created. This is intentional — see Deviations below._

## Files Created/Modified

- `915tldr.com2/scripts/measure-corpus.mjs` - read-only D1 measurement script (Tasks 1-2, prior commits)
- `915tldr.com2/tests/measure-corpus.test.ts` - percentile/epoch-bound unit tests (Tasks 1-2, prior commits)
- `915tldr.com2/docs/phase-02/corpus-measurements.md` - the measurement report; already contained the "Source death date" section recording the zero-row finding and the "D-16 repoint (Task 3) is BLOCKED pending owner decision" note from the prior session — verified present and clear, no changes needed in this continuation
- `.planning/phases/02-content-quality-grounding/02-CONTEXT.md` - D-16 entry amended with a dated "Superseded by production reality — amended 2026-09-19" paragraph (matching the file's existing D-17 amendment convention), stating the measured zero, KVIA's history as the actual third source since 2025-12-21, and the owner's retire decision

## Decisions Made

- **D-16 is retired**, not executed. The owner reviewed the measured evidence (zero rows referencing the dead domain; KVIA live as the third source since 2025-12-21 and the corpus's largest) and chose Option A: retire the decision rather than force a repoint against the live KVIA row. This is recorded both in `02-CONTEXT.md` (the amendment) and here.
- The original Task 3 acceptance criterion — "production contains exactly one row pointing at elpasonews.org" — is **void, not unmet**. It was built on D-16's premise that a dead `elpasolocalnews.org` row existed to repoint. That premise does not hold against measured production state, so the criterion was never a valid target to begin with. This is a result (a false premise caught before costly/irreversible action), not a failure to deliver.

## Deviations from Plan

### Task 3 not executed — premise invalidated by measurement (not an auto-fix, a Rule-4-class architectural/decision-scope issue escalated to the owner)

**1. [Escalated to owner — premise disproof, not a bug] D-16's source repoint target does not exist in production**

- **Found during:** Task 2's own outage/source-death-date audit, which queried `sources` for any row referencing `elpasolocalnews.org` as part of measuring D-CAUTION-3.
- **Issue:** The plan's Task 3 assumed a live `sources` row still pointed at the dead `elpasolocalnews.org` domain and needed repointing to `elpasonews.org`. Direct production D1 measurement (both by the prior executor and independently re-verified by the orchestrator before the owner decided) found **zero** such rows. The corpus's actual third source has been KVIA (`kvia.com`, source id 5) since 2025-12-21 — added as `elpasolocalnews.org`'s replacement in the same week that source returned HTTP 530 and was dropped. KVIA is now the corpus's largest source (25,707 articles, 0% truncation rate). Executing Task 3's write as specified would have had to target the live KVIA row (there being no other row to target), which would not have been the reversible, low-risk one-row change the plan described — it would have severed a working, actively-ingesting source and violated PROJECT.md's fixed three-source-mix constraint that D-16 existed to protect in the first place.
- **Resolution:** This was not auto-fixed under Rules 1-3 — a write against production D1 that contradicts the plan's own stated intent is exactly the kind of action deviation rules require escalating, not auto-correcting. Presented to the owner as a `checkpoint:decision` (`gate="blocking-human"`) with the measured evidence. Owner selected "retire D-16."
- **Files modified:** `.planning/phases/02-content-quality-grounding/02-CONTEXT.md` (D-16 amendment). No code files were created or modified for Task 3.
- **Verification:** Re-confirmed no `sources` row references `elpasolocalnews.org` (query recorded in `corpus-measurements.md#Source-death-date`); confirmed `915tldr.com2/scripts/repoint-source.mjs` does not exist on disk; confirmed no `UPDATE`/`INSERT`/`DELETE` statements were issued against production D1 during this plan (only `SELECT` queries appear in `measure-corpus.mjs`, grep-verified at 0 write-verb hits per Task 1's own acceptance criterion, which also covers the script Task 2 extended).
- **Committed in:** the `02-CONTEXT.md` amendment ships as part of this SUMMARY's own commit in the planning repo (see commit list below); no code-repo commit exists for Task 3 because no code-repo file changed.

---

**Total deviations:** 1 (escalated to owner, resolved as a decision retirement — not an auto-fix under Rules 1-3, and not new scope creep; it is *less* code than the plan specified)
**Impact on plan:** Net reduction in delivered code relative to the plan (`scripts/repoint-source.mjs` was never written), and that reduction is correct — writing it would have executed an action against production D1 that the plan's own author did not intend once the premise was known to be false. CONT-12's re-processing-set assumption (three unconfounded sources) is satisfied by the state already in production, not by new code.

## Issues Encountered

None beyond the premise disproof documented above. Tasks 1 and 2 executed and verified cleanly (`pnpm vitest run tests/measure-corpus.test.ts` passing, report sections all present, per prior session's task commits).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The D-04 input cap (11,000 characters) is ready for `02-04` and any plan touching `server/utils/openai.ts:106`.
- The CONT-12 union set (2,040 articles) is ready to fold into the CONT-09/CONT-10 re-processing dry run alongside the deterministic-sweep-plus-judge set from D-14.
- PROJECT.md's stale cost figures are flagged in the report for re-derivation before CONT-09's dry run is presented for approval — do not let a later plan quote the old $7.44/$0.48 figures.
- D-16 is closed as retired, not deferred — no later plan needs to revisit the source repoint. `02-CONTEXT.md` reflects this so future context assembly (`/gsd-plan-phase` scanning this phase's decisions) does not re-surface D-16 as still-open work.
- No blockers identified for `02-04` onward from this plan.

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

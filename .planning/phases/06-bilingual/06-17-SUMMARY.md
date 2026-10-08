---
phase: 06-bilingual
plan: 17
subsystem: i18n-backfill
tags: [openai-batch, d1, article_translations, shape-b, spanish-backfill, convergence]
status: complete

requires:
  - phase: 06-bilingual (06-14)
    provides: resumable shape-B backfill script, tracer chunk, guards
  - phase: 06-bilingual (06-16)
    provides: live /es URL contract and fallback pages
provides:
  - 10,000 production article_translations rows (origin backfill): 3,563 clean, 6,437 held
  - final backfill report (pipeline repo) with measured spend, coverage, held rate by month, held reasons
  - live convergence evidence on dev.915tldr.com (20/20 hot-tier, 40/40 wider sample, archive-tier pilot 2/2)
affects: [06-bilingual verification, any later backfill extension to the 13,243 archive-tier and 17,336 hot-tier deferred articles]

actuals:
  tokens: 10000
  tasks: 3
  commits: 4

key-files:
  created:
    - docs/phase-06/backfill-convergence.md
    - ../915tldr.com2/docs/phase-06/translation-backfill-report.md
  modified:
    - ../915tldr.com2/scripts/backfill-translations.mjs
    - ../915tldr.com2/tests/translation/backfill-run.test.ts
    - ../915tldr.com2/docs/phase-06/go-live-decision.md
    - ../915tldr.com2/docs/phase-06/translation-backfill-log.md

key-decisions:
  - "approvedChunkRowsWithoutKnownLimit (200) lifts the tracer-only hold for chunks of at most 200 rows while batchEnqueuedTokenLimit stays null; it records Jaime's assumption, not a verified limit"
  - "No judge pass: held rows keep their stored translation but are not shown; a judge pass is not built or approved"

duration: about 6 hours wall clock (00:08-06:20 MDT), most of it Batch waiting
completed: 2026-10-05
---

# Phase 6 Plan 17: Spanish Backfill Under the Approved Ceiling Summary

**The newest 10,000 eligible articles are translated and written for $3.41 (45% of the $7.50 ceiling), but only 3,601 of 40,900 public articles (8.8%) have a clean Spanish row, because 64% of the backfilled rows were held and 75% of public articles sit outside the approved window.**

## What was done

- **Guard fix (tests first).** 06-14's script held everything after the tracer while `batchEnqueuedTokenLimit` was null. I added an optional `approvedChunkRowsWithoutKnownLimit` decision field (200), recorded in `go-live-decision.md` with `decidedAt`, Jaime's quote "go with 200-article batches" and the plain note that the real Batch limit is unverified. Chunks above the cap are still refused; the ceiling (including its ceiling-case projection), `maxRows`, approval flag and spend guard are unchanged; if the field is absent the old hold applies. 15 new tests, 82 translation tests pass.
- **Backfill.** 49 further 200-row chunks (chunks 2-50) ran through the Batch API via a 2-minute `run` loop, in two sessions. No guard fired. Zero rows excluded, expired, carried over or resubmitted; all 10,000 English rows hash-checked unchanged.
- **Report** in the pipeline repo, with measured vs derived labels.
- **Convergence** on dev.915tldr.com, GET only.

## Measured results

| Quantity | Value |
|---|---|
| Actual spend | $3.4114 (8,078,058 in / 4,339,392 out tokens) vs ceiling $7.50, $6.00 guard, dry-run mean $3.21 (+6.3%) |
| Rows written | 3,563 clean, 6,437 held (64.4% held) |
| Held rate by publication month | Oct 40.7%, Sep 53.1%, Aug 70.9%, Jul (from 10 Jul) 71.1% |
| Top held flags | proper-noun-absent 4,215; length 3,341; number-absent 1,217; lexicon 277; verbatim-overlap 27 |
| source_language, all 10,068 es rows | en 8,066; es 2,002; und 0; null 0 |
| Clean / public | 3,601 / 40,900 = 8.8%; held 15.8%; no row 75.4% |
| Convergence | 15/20 before the next build, 20/20 at 54.9 minutes after the last write (one build, builtAt 2026-10-05T12:14:04Z); wider sample 40/40; held rows 10/10 show the fallback note |

## Deviations from Plan

**1. [Premise] The plan's archive-tier convergence set is empty.** The hot window is 202 days (cutoff 2026-03-16) and the backfilled window starts 2026-07-10, so 0 backfilled rows are archive-tier. I sampled hot-tier clean backfilled articles instead and separately checked the only 2 archive-tier clean rows (both pilot; both serve Spanish from `archive;desc=r2`). The REND-12 archive re-upload path was therefore not exercised by this backfill, and 06-12's CONVERGES_24H projection (a 26,580-object backlog) remains derived and untested at scale. Recorded in `backfill-convergence.md`.

**2. [Scope] The plan's 15-minute loop and "every eligible article" scope were adapted** to the orchestrator's 2-minute loop, shape B, 200-row chunks and the newest-10,000 window. The older eligible articles (30,579 with stored content, 2025-12-15 to 2026-07-10; 13,243 of them archive-tier) are deferred by Jaime's decision, not a gap.

**3. [Rule 1 - test fixture]** One new test used a `distinctSubmitted` value exactly on the guard's existing 2% maxRows tolerance; I corrected the fixture, not the guard.

## Authentication gates

None.

## Known Stubs

None.

## Issues Encountered

- `tests/grounding/verbatim-overlap.test.ts` (a "under 1000 ms" wall-clock assertion) failed once in the full suite under load (1,583 ms) and passes alone. Pre-existing and unrelated; not fixed.
- Batch chunk 38 took about 58 minutes (a slow tail) and completed normally.

## Not done / open for Jaime

- Whether the 6,437 held rows are real translation defects or the deterministic check being strict about thin or truncated stored sources has not been measured. The most common reason is a name absent from the stored source text (`El Paso` 821, `Estados Unidos` 285).
- A judge pass over held rows is not built or approved; the only measured rescue rate is 1 of 18 (06-08 sample, n=18), low yield.
- The real Batch enqueued-token limit is still unverified (`null`); OpenAI accepted all 50 chunks of 200 rows.
- The OpenAI balance was not read by me.
- Extending to the deferred 30,579 older articles needs a separate approval.

## Commits

Pipeline repo (`feature/phase-06-backfill`): `4f9843f` guard fix, `a331fdd` log chunks 2-31, `036f179` final log and report. Frontend repo: this summary and `backfill-convergence.md`.

## Self-Check: PASSED

Verified files exist and commits exist (see the check run before this commit).

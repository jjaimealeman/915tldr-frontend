---
phase: 06-bilingual
plan: 13
subsystem: ai
tags: [openai, go-live, grounding, i18n, backfill, deploy, cloudflare-workers]

requires:
  - phase: 06-bilingual (06-01)
    provides: "live bilingual ingest, Spanish grounding, measured live cost delta"
  - phase: 06-bilingual (06-08)
    provides: "measured backfill dry run, three costed options, 30-row pilot"
  - phase: 06-bilingual (06-12)
    provides: "build-budget verdicts (FITS / FILES_WITHIN_BUDGET / CONVERGES_24H)"
provides:
  - "SPANISH_LIVE_GROUNDING_MODE = 'live' in the pipeline's ai-processor.ts (judge on every live Spanish summary); bilingual ingest live in production"
  - "go-live-decision.md: machine-readable approval (shape B, newest 10,000 rows, 7.50 USD ceiling) that 06-14/06-17 read"
  - "Production deploy of the bilingual pipeline, version a8e4451e-33c7-4148-84d7-aa83a90a3832"
affects: [06-14-backfill-execute, 06-17-backfill-run, 06-15-deploy, 06-16-first-real-build]

actuals:
  tokens: 4500
  tasks: 3
  commits: 2

key-files:
  created:
    - ../915tldr.com2/docs/phase-06/go-live-decision.md
    - ../915tldr.com2/changelog/2026-10-04-1258_go-live-decision-spanish-live-judge-backfill-ceiling.md
  modified:
    - ../915tldr.com2/server/utils/ai-processor.ts
    - ../915tldr.com2/tests/ai-processor-store.test.ts

key-decisions:
  - "Jaime chose (2026-10-04 12:55 MDT, 'lets go with your recommend, i trust you bro'): judge EVERY live Spanish article, and a shape-B backfill (translation-only, deterministic-flagged rows held with no judge) of the NEWEST 10,000 rows at a 7.50 USD ceiling, resumable newest-first."
  - "The ceiling is sized to the account: balance 7.15 USD, auto-reload ON (5 to 10 USD, 20 USD/month reload cap), monthly usage limit 100 USD. A 0 balance also breaks live English ingest (429 credit_balance_exhausted)."
  - "Deploy ran from the pipeline repo's checked-out main (identical tree to develop), after Jaime merged feature/phase-06 into develop (4a17620) and develop into main (d5f0dc3)."

requirements-completed: []  # I18N-01/I18N-02 left to the orchestrator: ingest is live but the backfill (06-14/06-17) has not run.

coverage:
  - id: D1
    description: "SPANISH_LIVE_GROUNDING_MODE is 'live' and the Spanish checkGrounding call uses it; English call unchanged"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "tests/ai-processor-store.test.ts (17 tests, 4 new): constant, 'live' = 3 model calls, 'backfill' = 2, default = constant"
        status: pass
    human_judgment: false
  - id: D2
    description: "Decision recorded with a parseable approval block (approvedCeilingUsd and chunkRows numeric)"
    verification:
      - kind: integration
        ref: "node parse of the JSON block in ../915tldr.com2/docs/phase-06/go-live-decision.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pipeline is production-deployed, home page up, cron trigger intact"
    requirement: "I18N-01"
    verification:
      - kind: integration
        ref: "wrangler deployments list (a8e4451e, 2026-10-04T20:23:24Z); curl -sI https://915tldr.com/ returned HTTP/2 200; deploy output 'schedule: 0 */2 * * *'"
        status: pass
    human_judgment: false
  - id: D4
    description: "First bilingual cron ingest actually produced Spanish rows with the judge running on them"
    verification: []
    human_judgment: false
    rationale: "Not checked in this plan. The first bilingual ingest is the next 0 */2 * * * cron run after the deploy; nobody has looked at its output yet."

duration: ~2h (including the decision wait)
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 13: Go-Live Decision, Live Spanish Judge and Deploy Summary

**Jaime chose to judge every live Spanish summary and to backfill only the newest 10,000 rows translation-only under a 7.50 USD ceiling. The pipeline carrying that choice is deployed to production as version `a8e4451e-33c7-4148-84d7-aa83a90a3832`.**

## Accomplishments

- **Task 1 (decision).** I put measured figures in front of Jaime and made no choice for him.
  - Backfill, full two-stage: 41.94 USD mean and 99.26 USD ceiling, against CONTEXT's 1.49.
  - Backfill, translation-only (shape B): 13.02 mean and 29.88 ceiling.
  - Live judge on every article: about 0.0026 USD per article, 0.24 per day, 7.33 per 30 days. The 06-08 judge measurement suggests up to about 8.81.
  - Hold rate in the 30-row pilot: 17 of 30 (56.7%).
  - He accepted the recommendation (live judge on every article; shape B; newest 10,000 rows; about 7.50 ceiling).
- **Task 2.** `SPANISH_LIVE_GROUNDING_MODE = 'live'` is exported and drives the Spanish `checkGrounding` call. English is untouched. `processPendingArticles` takes an optional `{ spanishGroundingMode }` so both modes can be tested; production callers pass nothing. Four new tests were written first and failed, then passed. Full pipeline suite: 25 files, 341 tests passed. `pnpm build` exited 0. Commit `4d23161` in the pipeline repo.
- **Task 3 (deploy).** Jaime merged and pushed. I ran `pnpm deploy` from the pipeline repo.

## Decision values (from `go-live-decision.md`)

| Field | Value |
|---|---|
| `option` | `a-live-mode-with-backfill-shape-B` |
| `decidedAt` | `2026-10-04T12:55:00-06:00` |
| `liveSpanishGroundingMode` | `live` |
| `backfillShape` | `translation-only-newest` |
| `backfillApproved` | `true` |
| `approvedCeilingUsd` | `7.5` |
| `maxRows` | `10000` |
| `chunkRows` | `1000` (1,000 x 999 max input tokens, about 1.0M enqueued tokens) |
| `batchEnqueuedTokenLimit` | `null` (UNVERIFIED) |

Arithmetic for shape B: mean about 0.000321 USD per row (13.02 / 40,529), ceiling about 0.000737 per row (29.88 / 40,529). So 10,000 rows is about 3.21 USD mean and 7.37 USD ceiling, under the 7.50 approved ceiling.

## Deploy record

| Item | Value |
|---|---|
| Deployed from | pipeline repo `/home/jaime/www/_github/915tldr.com2`, `main` checked out (`d5f0dc3`) |
| Tree check before deploy | `git diff --quiet develop main` passed; tracked files clean; only untracked `docs/TODO-llms-txt.md` |
| **Previous version (rollback target)** | `01b4e9d4-c46c-46cb-aaa8-80396eb98bfb` (2026-10-01T02:14:32Z, "Secret Change"). The last code deploy before it was `4a4af16e-4b96-4ccc-8484-7ba736da4c46` (2026-10-01T02:12:15Z) |
| **New version** | `a8e4451e-33c7-4148-84d7-aa83a90a3832` |
| Deploy timestamp | 2026-10-04T20:23:24Z (about 14:23 MDT) |
| `https://915tldr.com/` | HTTP/2 200 at 2026-10-04T20:23:33Z |
| Cron trigger | `schedule: 0 */2 * * *` printed by the deploy, so still registered |
| **Rollback** | `pnpm exec wrangler rollback`, run in `/home/jaime/www/_github/915tldr.com2` |

The first bilingual ingest is the next cron run on the 2-hour schedule. I did not look at its output.

## Known mismatch for 06-14 (not fixed here)

06-14 is written as the two-stage loop (translate, then a Batch judge for flagged rows; `06-14-PLAN.md` lines 25-27 and 133). Shape B needs a translation-only mode: no stage-2 judge batch, and rows the deterministic checks flag are written as `held` directly. 06-14 must also read the decision file, stop at `maxRows` newest-first, be resumable when the ceiling is raised, abort above `approvedCeilingUsd`, and refuse to submit while `batchEnqueuedTokenLimit` is null. No 06-14 file was edited; the orchestrator handles this at dispatch.

## Unverified items

- **Batch enqueued-token limit for `gpt-5.6-luna`.** Jaime did not report it. It is on the OpenAI dashboard Limits page. 06-14 must read or verify it, or get a Jaime-approved stated assumption, before its first Batch submission. Whether only input tokens count against it is also unverified. `chunkRows` 1,000 is a derived choice, not a verified-safe one.
- **Account facts** (balance 7.15 USD, auto-reload 5 to 10 USD, 20 USD/month reload cap, 100 USD monthly limit) were stated by Jaime, not read by me.
- **Live judge cost** uses an estimated judge input (live judge usage was not logged), so 7.33 per 30 days could be low.

## Deviations from Plan

**1. [Disclosed, resolved] The plan's options did not include the backfill shape chosen.** The plan's option a approves the backfill "at the measured ceiling" (full two-stage). Jaime chose shape B for the newest 10,000 rows at 7.50 USD, a variant drawn from 06-08's report. The decision doc and this summary record it.

**2. [Rule 2 - testability] Added an optional 4th parameter to `processPendingArticles`.** A `const` cannot be exercised in both modes, and the plan's behavior tests need both. Default is the constant, so production behaviour is unchanged. Commit `4d23161`.

**3. [Process] `go-live-decision.md` still has `deployedVersionId` and `deployedAt` as null.** The pipeline repo's `develop` and `main` are protected, and Jaime had not said "commit" there, so I did not edit the file. The values are recorded in this summary instead. See follow-ups.

**4. [Process] Checked-out branch.** I was told the pipeline repo was left on `develop`; it was on `main`. The trees are identical (verified), so I deployed from the current checkout without switching branches.

**Total deviations:** 1 auto-added (Rule 2), 3 disclosed.

## Pending follow-ups

- **Update `deployedVersionId` (`a8e4451e-33c7-4148-84d7-aa83a90a3832`) and `deployedAt` (`2026-10-04T20:23:24Z`) in `915tldr.com2/docs/phase-06/go-live-decision.md` on the next pipeline feature branch.** Both are null in the merged doc.
- Read the first bilingual cron ingest's result (Spanish rows written, `heldEs` / `storedEs` counts) before relying on live ingest.
- 06-14: translation-only mode, decision-file read, token limit, ceiling abort (see above).
- The pipeline repo had no git remote when this plan started; Jaime has since pushed `main` to a private GitHub repo `915tldr-backend`. That is outside this plan's scope.

## Known Stubs

None.

## Threat Flags

None. The deploy changes an existing ingest path; no new endpoints or schema.

## Self-Check: PASSED

Verified: commit `4d23161` exists in the pipeline repo; `go-live-decision.md` exists; wrangler listed `a8e4451e-33c7-4148-84d7-aa83a90a3832` as the 100% version; `https://915tldr.com/` returned 200.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

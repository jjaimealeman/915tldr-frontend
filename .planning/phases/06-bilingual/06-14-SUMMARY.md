---
phase: 06-bilingual
plan: 14
subsystem: ai
tags: [openai-batch, i18n, backfill, translation, cloudflare-d1, state-machine, spend-guards]

requires:
  - phase: 06-bilingual (06-08)
    provides: "translation prompt, Batch line builder, shared D1 upsert, 30-row measured dry run"
  - phase: 06-bilingual (06-13)
    provides: "go-live-decision.md (shape B, 7.50 USD ceiling, 10,000 rows) and the production deploy"
provides:
  - "scripts/backfill-translations.mjs `run`/`status`: lock-protected, resumable, shape-B (translation-only) Batch backfill with pure tested guards"
  - "200 production article_translations rows, origin 'backfill' (121 clean, 79 held)"
  - "docs/phase-06/translation-backfill-log.md: live-ingest evidence, chunk 1 batch id, abort-check values, measured spend, projection"
affects: [06-17-backfill-run]

actuals:
  tokens: 24000   # approximate: chars/4 over the changed files (script, test, docs, changelogs), not a harness count
  tasks: 3
  commits: 4

key-files:
  created:
    - ../915tldr.com2/tests/translation/backfill-run.test.ts
    - ../915tldr.com2/docs/phase-06/translation-backfill-log.md
    - ../915tldr.com2/changelog/2026-10-04-2251_verify-live-bilingual-ingest-record-deploy-version.md
    - ../915tldr.com2/changelog/2026-10-04-2257_resumable-shape-b-translation-backfill-run-status.md
    - ../915tldr.com2/changelog/2026-10-04-2305_translation-backfill-tracer-200-rows-live.md
  modified:
    - ../915tldr.com2/scripts/backfill-translations.mjs
    - ../915tldr.com2/docs/phase-06/go-live-decision.md
    - ../915tldr.com2/changelog/README.md

key-decisions:
  - "Shape B state machine: no judge batch. Flagged rows are written `held` with the deterministic report; JUDGE_STAGE_ENABLED (false) marks the seam and throws if flipped."
  - "While batchEnqueuedTokenLimit is null the script refuses any chunk over 200 rows and submits nothing after the tracer (held, exit 0). Hard refusals exit 2 before any API client is built."
  - "Newest-first selection uses a keyset cursor (published_at DESC, id DESC) stored in state, so raising maxRows or the ceiling continues where it stopped."
  - "Before writing, an article that already has a Spanish row from another origin is skipped, because the shared upsert is ON CONFLICT DO UPDATE and must not replace a judged live `ingest` row."

requirements-completed: []  # I18N-01/I18N-02 left to the orchestrator: ingest verified live, tracer proven, bulk backfill (06-17) not run.

coverage:
  - id: D1
    description: "Live ingest wrote `ingest` rows after the deploy, every processed article has an es row"
    requirement: "I18N-01"
    verification:
      - kind: integration
        ref: "read-only D1: 25 ingest rows; 20 of 20 articles processed since deploy have an es row (missing 0); verify command printed 25; curl -sI https://915tldr.com/ HTTP/2 200"
        status: pass
    human_judgment: false
  - id: D2
    description: "run/status is a resumable, lock-protected state machine with the ceiling, maxRows, 200-row-cap and token-limit guards"
    requirement: "I18N-02"
    verification:
      - kind: unit
        ref: "tests/translation/backfill-run.test.ts (46 tests, fake I/O); full suite 26 files / 388 tests pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "200-row tracer ran the whole loop; read-back matches; English rows unchanged; spend under the guard"
    requirement: "I18N-02"
    verification:
      - kind: integration
        ref: "batch_6ac32e80a8f8819080e63961054c688a: 200/200 completed; script read-back 121/79 and an independent query agree; 200 of 200 ids covered; English sha256 changed 0; actual spend 0.0654 USD (guard 0.15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 1,000-row chunk fits Jaime's Batch enqueued-token limit"
    verification: []
    human_judgment: false
    rationale: "Not checked. batchEnqueuedTokenLimit is still null (unverified). The tracer's 148,858 enqueued input tokens were accepted, which only shows the limit is at least that large."

duration: ~1h15m
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 14: Resumable Shape-B Backfill, Live-Ingest Check and 200-Row Tracer Summary

**A lock-protected, resumable translation-only Batch backfill (`run`/`status`) with spend and token-limit guards, proven on a real 200-row tracer: 121 clean and 79 held rows written, $0.0654 spent, English rows unchanged.**

## Accomplishments

- **Task 1, live ingest.** One read-only check about 8h25m after the deploy: 25 `ingest` rows (14 clean, 11 held, held rate 44.0%). All 20 articles processed since deploy have an `es` row (missing 0). Five English-held pending articles also carry held Spanish rows. The 30 pilot rows are 13 clean and 17 held, as recorded in 06-08. Home page returned 200. Recorded in the log's "Live ingest" section, and the deploy version and time are now in `go-live-decision.md`.
- **Task 2, tracer.** Tests were written first, then the state machine; full suite 388 tests pass. The 200 newest eligible rows (article ids 44318 down to 43810) went through Batch translation, validation, deterministic Spanish checks and a production write. Batch `batch_6ac32e80a8f8819080e63961054c688a` completed 200 of 200 in under 5 minutes.
- **Task 3** was not needed: chunk 1 finished within the first two polls, so there was no 3-hour wait.

## Tracer numbers (MEASURED)

| Item | Value |
|---|---|
| Written (origin `backfill`) | 121 clean, 79 held (held rate 39.5%) |
| 06-08 pilot, for comparison | 13 clean, 17 held (56.7%, n=30, stratified) |
| Held reasons (rows can carry several) | proper-noun-absent 57, length 16, number-absent 11, verbatim-overlap 1 |
| Excluded / carried / skipped | 0 / 0 / 0 |
| Actual spend | $0.0654 (148,858 in / 84,208 out tokens, Batch rates) |
| Per row | 744.3 in / 421.0 out tokens, $0.000327 |
| Abort-check values at submission | spent $0, in flight $0, chunk ceiling-case $0.1474, cumulative $0.1474 vs $7.50; maxRows 10,000, 0 submitted before; token limit null, estimated 199,800 enqueued; 40,579 eligible rows |
| Cumulative spend vs ceiling | $0.0654 of $7.50 approved |
| English `articles` rows | sha256 of title, summary, key points unchanged for all 200 |

## Projection for the remaining 9,800 rows (DERIVED from the tracer, not measured on those rows)

- Cost, mean case: **$3.21**; cumulative with the tracer **$3.27** against the $7.50 ceiling.
- Cost, ceiling case (06-08 max-row tokens, $0.000737 per row): $7.22; cumulative $7.29, inside the ceiling by $0.21. The tracer cost 44% of the ceiling-case per-row figure.
- Held rate: 39.5% gives about 3,870 held and 5,930 clean, but treat that as a floor. The tracer holds the newest articles, where rows with real `key_points` are over-represented, while 95.4% of the archive is legacy and the pilot held 56.7%. A rise toward the pilot rate is likely and unmeasured. It changes the clean/held split, not the cost.
- Enqueued tokens: the tracer's 148,858 input tokens were accepted. A 1,000-row chunk would be about 744,000 (derived at the tracer mean), up to about 999,000 at the max-row figure. Still unverified against the real limit.

## Task Commits (pipeline repo `915tldr.com2`, branch `feature/phase-06-backfill`)

1. `d726580` docs(06-14): verify live bilingual ingest, record deploy version in decision doc
2. `ca46eb0` feat(06-14): resumable shape-B translation backfill run/status with spend guards (tests and implementation together)
3. `22399a6` docs(06-14): record 200-row tracer chunk result, spend and projection
4. `a4e3062` docs(06-14): correct tracer changelog filename timestamp to the date output

## Deviations from Plan

**1. [Approved adaptation] Shape B instead of the plan's two-stage loop.** No judge batch, no `judge-submitted`/`judge-collected` states. Flagged rows go straight to `held` with the deterministic report. Per Jaime's decision in `go-live-decision.md`.

**2. [Approved adaptation] Guards beyond the plan.** Added the 200-row cap and the tracer-only hold while `batchEnqueuedTokenLimit` is null, the $0.15 tracer spend guard, the decision-file reads for shape, `maxRows` and `chunkRows`, and a `maxRows` abort at 1.02 times the cap measured against cumulative submitted rows. The plan's "eligible count exceeds maxRows by more than 2%" check was not implemented as written: shape B caps rows submitted, and 40,579 eligible rows would always trip it.

**3. [Rule 2 - correctness] Skip articles another origin already translated.** The shared upsert is `ON CONFLICT DO UPDATE`, so a live `ingest` row written between selection and write could have been replaced by an unjudged backfill row. The write step now skips such articles and records them. It skipped 0 in the tracer.

**4. [Rule 3 - blocking] `expiredCustomIds` reimplemented locally as `splitExpired`.** `batch-jsonl.ts` imports `./openai` extensionlessly and plain Node cannot load it statically. Same contract, covered by tests. `parseBatchOutput` was likewise replaced by `parseTranslationOutput` so usage is kept for lines whose content is unusable (billed either way).

**5. [Process] Task 1 was one pass, not a 150-minute poll,** by the orchestrator's instruction, since ingest had already run for hours.

**6. [Process] TDD gate.** Tests were written first and run red before the implementation existed, but the test file and the implementation were committed together in `ca46eb0`, so git history has no separate `test(...)` commit.

**7. [Process] Changelog filename.** One changelog filename used 2306 where `date` printed 2305; fixed in `a4e3062`.

## Unverified / not done

- **Batch enqueued-token limit** for `gpt-5.6-luna` is still `null`. Chunk 2 is blocked by the script until Jaime reports or approves a figure; it was not submitted.
- `findBatchByKey` (crash recovery by batch metadata) is covered by a fake-I/O test only; it was not run against the real OpenAI API, since that would have been an unapproved call.
- The OpenAI balance and auto-reload figures are still Jaime's reported numbers; the dashboard was not read.
- Production build-log figures in the live-ingest section were supplied by the orchestrator, not read here.

## Known Stubs

None.

## Threat Flags

None. The only new remote surface is the existing Batch API and the existing D1 write path, both behind the guards. T-06-48 to T-06-51 are mitigated and tested: ceiling and tracer guards, single-escaping write path with a hostile-string fixture, lock plus persisted state plus idempotence tests, and held-not-clean for every flagged row.

## Self-Check: PASSED

Verified: pipeline commits `d726580`, `ca46eb0`, `22399a6`, `a4e3062` exist; `scripts/backfill-translations.mjs`, `tests/translation/backfill-run.test.ts` and `docs/phase-06/translation-backfill-log.md` exist; `status` shows chunk 1 `done` with 121 clean / 79 held matching the remote read-back; no chunk 2 in the state file.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

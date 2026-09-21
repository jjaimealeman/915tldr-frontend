---
phase: 02-content-quality-grounding
plan: 10
subsystem: backend
tags: [openai, batch-api, gpt-5.6-luna, d1, wrangler, ops-11, cont-10, cont-11]

requires:
  - phase: 02-content-quality-grounding (plan 02-09)
    provides: the validated token-counting/cost-projection module (cost-estimate.ts) and
      the free half of the OPS-11 gate pattern (report-gated, fingerprint-style drift
      check) this plan's execute script reuses
  - phase: 02-content-quality-grounding (September dry run, same day)
    provides: docs/phase-02/september-backfill-dry-run.json — the approved report this
      execute script is pointed at (2,715 rows, $5.80-$10.42)

provides:
  - A report-gated, live-scope-verified, lock-protected OpenAI Batch API execute script
    (scripts/september-backfill-execute.mjs) for a narrow, owner-approved operation —
    giving September 2026 articles with no summary their FIRST summary
  - Reusable batch JSONL request/response utilities (server/utils/batch-jsonl.ts) —
    buildBatchRequests, parseBatchOutput, expiredCustomIds — with 42 unit tests
  - A REAL, COMPLETED OpenAI Batch API job (batch_6ab0d29a301881908c35ab566f61f84a,
    2,703/2,703, 0 failures) — summarisation is done; write-back is 275/2,703 (126
    written, 149 held) and paused on the checkpoint finding below
  - The FIRST real evidence of the post-fix grounding judge's false-positive rate
    (02-08's previously-unmeasured open question) — a concrete, reproducible structural
    conflict between D-07 (thin-source in-text attribution) and the judge's claim
    decomposition

affects: [02-10-followup-writeback, phase-06-spanish-generation]

actuals:
  tokens: 19000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Same resolution-hook technique as reprocess-dry-run.mjs's loadGroundingCheck(),
      generalised to loadDynamicModules(): defer any import of a module using
      bundler-only extensionless relative imports to inside main(), registering a
      Node module-resolution hook once, never at file top-level"
    - "D1 writes from a plain Node script (no live binding available) go through
      wrangler d1 execute --remote --file with hand-escaped literal SQL, not
      getPlatformProxy — that API's default LOCAL Miniflare binding is a silent
      wrong-database trap, and forcing it remote requires a wrangler.jsonc config
      change with project-wide blast radius"
    - "Entity upsert without a unique-index-backed ON CONFLICT: pre-load existing
      (normalized_name, type) keys into an in-memory Set once, mutate it locally as
      the run 'creates' new entities, so a second occurrence later in the same run
      increments instead of double-inserting"

key-files:
  created:
    - 915tldr.com2/scripts/september-backfill-execute.mjs
    - 915tldr.com2/server/utils/batch-jsonl.ts
    - 915tldr.com2/tests/batch/jsonl.test.ts
    - 915tldr.com2/tests/batch/resubmit.test.ts
    - 915tldr.com2/tests/batch/execute-write.test.ts
    - 915tldr.com2/docs/phase-02/september-backfill-run-manifest.json
    - 915tldr.com2/changelog/2026-09-21-0043_september-backfill-execute-batch-api-script.md
  modified:
    - 915tldr.com2/changelog/README.md

key-decisions:
  - "Scope followed the owner's explicit prompt-level authorization (2026-09-21),
    which OVERRODE 02-10-PLAN.md's original full-corpus archive-reprocessing design.
    The deliverable script is scripts/september-backfill-execute.mjs, not the plan's
    named scripts/reprocess-execute.mjs — a different scope, honestly named
    differently, not a renamed version of the plan's design."
  - "Title and slug frozen on every write-back (owner instruction), even though these
    are first-time summaries where ai-processor.ts's default (freezeIdentity: false)
    would normally regenerate them — followed literally as instructed."
  - "Judge stage runs synchronously at the standard rate per row (D-08's live-ingest
    rule), not via Batch — only summarisation is batched. Matches the dry run's own
    cost breakdown, which priced the two stages at different rates for this reason."
  - "Category linking implemented in full (needed for the [category]/[slug] URL
    structure to resolve); tags implemented via a clean ON CONFLICT(slug) upsert;
    entities implemented via a pre-read-then-decide pattern to avoid a schema
    migration this run doesn't carry. All three are in scope for the eventual
    write-back, not just summary text."

patterns-established:
  - "Owner-narrowed scope inside a single execution: when a prompt's explicit,
    dated authorization narrows or supersedes a committed PLAN.md's design, the
    plan is followed in spirit (requirement IDs, threat model, success criteria)
    but the literal file/script name and internal architecture may differ — always
    disclosed, never silently substituted."

requirements-completed: []  # CONT-10, CONT-11, OPS-11 are PARTIALLY satisfied — see
  # "Next Phase Readiness" below. Not marked complete: the write-back (the part that
  # actually delivers CONT-10's "archive re-processed" and proves CONT-11's resubmit
  # logic against a REAL expiry) has not happened yet — the batch is still running.

coverage: []

duration: 2h05m
completed: 2026-09-21
status: halted
---

# Phase 2 Plan 10: September Backfill — CHECKPOINT: Grounding Judge False-Positive Pattern Found Mid-Run Summary

**Report-gated Batch API execute script built, tested (42 tests), and run for real. The
Batch API summarisation job completed in full (2,703/2,703, $0 failures) and grounding +
write-back began — but was DELIBERATELY STOPPED after 275 of 2,703 rows (126 written, 149
held) on discovering a systematic false-positive pattern: the grounding judge is holding
the large majority of thin-source (KTSM) articles specifically BECAUSE they correctly
follow D-07's in-text attribution instruction ("According to KTSM, ..."), which the judge's
claim-decomposition then flags as an unsupported claim ("KTSM reported X" — of course the
source text never says that about itself). This is exactly the checkpoint condition the
execution prompt named in advance. No further rows were processed pending owner review.**

## Performance

- **Duration:** ~2h35m (context-gathering, script build, test-writing, the real submission,
  and the grounding/write-back run that surfaced the checkpoint below)
- **Started:** 2026-09-21T04:43:00Z (approx, from first file read)
- **Completed:** N/A — HALTED ON A CHECKPOINT, not merely on batch duration. Batch
  submitted 2026-09-21T06:45:46Z, **completed in full** by ~2026-09-21T07:00Z (2,703/2,703,
  0 failures — resumed and confirmed across three background poll cycles). Grounding +
  write-back then ran for 275 of 2,703 rows and was DELIBERATELY STOPPED on discovering
  the false-positive pattern documented in "CHECKPOINT" below — not stopped by a timeout
  or a crash.
- **Tasks:** Task 1 (owner-approval checkpoint) resolved by the prompt's own authorization
  text. Task 2 (build+execute) is fully built, tested, and the summarisation half executed
  to completion; the grounding+write-back half is 275/2,703 done and paused on a genuine
  finding requiring owner input. Task 3 not started — depends on the held-rate question
  being resolved first, since re-processing may be needed before the "real" numbers exist.
- **Files modified:** 7 (committed), plus 1 generated run manifest (not yet committed —
  see below)

## CHECKPOINT — Grounding Judge Holds ~54% of Thin-Source Summaries on a Structural False Positive

**This is the checkpoint condition the execution prompt named in advance** ("the grounding
gate holds a large fraction of the new summaries... the owner needs to know before it is
written off as normal"). Found live, with real production data, partway through the
grounding+write-back pass — processing was stopped immediately rather than continuing to
spend judge-call money holding what is very likely good content.

**The number:** of the first 275 rows judged, **126 written (clean), 149 held** — a 54%
hold rate. `docs/phase-02/september-backfill-run-manifest.json`'s `heldIds`/`writtenIds`
arrays hold the real counts.

**The root cause, confirmed against real held rows (`grounding_report` read live from
production D1):** of a 15-row sample of held articles, **13 of 15 (87%) were held
primarily or entirely because the judge flagged the article's own required in-text
attribution phrase as an "unsupported claim."** D-07 (02-CONTEXT.md) requires thin-source
(sub-90-word, mostly KTSM) summaries to name the outlet in-text — "According to KTSM,
...". The judge's claim-decomposition then atomizes that sentence into a SEPARATE claim
like *"KTSM reported X"* or *"KTSM is the source of the information"* and marks it
unsupported, because the source article obviously never states "I, KTSM, am reporting
this" about itself. D-07 and the judge are working exactly as separately designed and
directly contradicting each other:

```
--- id 38788 (held) ---
unsupported claim: "KTSM is the source of the information." — not supported by the source

--- id 38784 (held) ---
unsupported claim: "The information is according to KTSM." — not supported by the source

--- id 38785 (held) ---
unsupported claim: "KTSM reported that John Ternus became Apple's CEO on Tuesday." — not supported by the source
```

The written (clean) rows spot-checked read as genuinely faithful, well-formed summaries
(e.g. article 38776, Texas voter-registration suspense-list context) — this is NOT evidence
the pipeline broadly produces bad output. It is narrowly the thin-source attribution
requirement (D-07) colliding with the judge's atomic-claim decomposition (the internal
design of D-08's judge, 02-RESEARCH.md Pattern 2).

**A secondary, smaller pattern also present in the sample:** two held rows (38769, 38792)
carry Spanish-language summaries (e.g. *"Seth Moulton es un marine retirado"* — a
Massachusetts politician, unrelated to El Paso) — worth flagging separately: either the
source content itself is in Spanish/non-local (a possible corpus-quality question outside
this plan's scope), or the model produced a Spanish summary for an English source. Not
investigated further here — noted for awareness, not blocking.

**What was NOT done, and why:** the remaining 2,428 rows were NOT processed. Continuing
under the current judge behavior would very likely hold roughly half of them for the same
structural reason, both wasting further judge-call spend (each hold still costs a real
synchronous API call) and leaving ~1,200+ genuinely faithful thin-source summaries stuck
in the `held` review queue instead of published — a worse outcome than pausing now.

**Held rows are NOT data-damaged.** Per D-09/`storeProcessingResults`'s held branch
(faithfully replicated in this script), a held row gets ONLY `grounding_status`/
`grounding_report` written — `summary`/`key_points`/category/tags/entities are left
completely untouched (still NULL, exactly as before this run). Nothing is lost; the 149
held rows can be re-judged (not re-summarised — the Batch API output already has their
real summaries, still in the batch's output file) once a fix is decided.

**Decision needed before continuing:** options, not mutually exclusive —
1. **Fix the judge prompt** to not decompose an in-text attribution clause ("According to
   X, ...") into its own checkable claim — likely the correct long-term fix, but changes
   `grounding-check.ts`, a shared module also used by live cron ingest, so needs its own
   care and probably its own test pass against the D-10 labelled fixture set before
   re-running against the remaining 2,428+149 rows.
2. **Continue as-is, accept ~50% held for manual review** — gets the majority of the
   backfill done now, leaves a large held queue for a human (or a later automated pass)
   to clear.
3. **Re-judge only the 149 already-held rows first** (cheap — their real summaries already
   exist in the batch output, no new summarisation spend) as a fast way to validate a
   judge-prompt fix before spending on the remaining ~2,428.

This SUMMARY does not choose an option — that is the owner's call, per the execution
prompt's own instruction that this exact scenario needs the owner to know before being
written off as normal.

## Accomplishments

- Built and committed `scripts/september-backfill-execute.mjs` — refuses to run without
  `--report`, re-derives the live candidate count/window/predicate from production D1
  before spending anything, hard-aborts on any of the 5 conditions the owner specified
  (row count > 2,715, cost > $10.42, window drift, out-of-window row, payload/candidate
  count mismatch)
- Built `server/utils/batch-jsonl.ts` (buildBatchRequests/parseBatchOutput/expiredCustomIds)
  with 42 passing unit tests covering JSONL validation, duplicate-id rejection, output
  parsing by `custom_id` (never by position), and the full expired-remainder matrix
- **Re-verified scope live before spending anything:** 2,709 candidate rows (vs. the
  dry run's 2,715 — 6 fewer, meaning ordinary cron already processed a handful of these
  in the intervening hours; the safe direction, and well inside the approved ceiling)
- **Submitted a real OpenAI Batch API job:** `batch_6ab0d29a301881908c35ab566f61f84a`,
  2,703 requests (6 of the 2,709 live candidates have no stored content and are
  correctly excluded, matching the dry run's stated no-content count almost exactly)
- Manifest (`docs/phase-02/september-backfill-run-manifest.json`) written before the
  first paid call and updated after batch submission — records report path, approved
  cost figures, live counts, the batch id, and all 2,703 submitted custom_ids
- Did **NOT** fabricate completion: the script correctly detected the batch was still
  `in_progress` after its poll window and exited reporting pending status, per the
  execution prompt's explicit instruction

## Task Commits

1. **Task 2 (build): batch execution infrastructure** - `c2ba2f2` (feat) — `batch-jsonl.ts`,
   `september-backfill-execute.mjs`, and 42 tests across `tests/batch/`

**No plan-metadata commit yet** — this SUMMARY and the run manifest are being committed
together as the honest record of a halted-mid-batch state, not a completed plan.

_Note: this is a partial-completion halt, not a designed TDD gate — see `status: halted`
above and "Next Phase Readiness" below for the resume path._

## Files Created/Modified

- `915tldr.com2/scripts/september-backfill-execute.mjs` - the execute script (927 lines)
- `915tldr.com2/server/utils/batch-jsonl.ts` - batch JSONL request/response utilities
- `915tldr.com2/tests/batch/{jsonl,resubmit,execute-write}.test.ts` - 42 tests
- `915tldr.com2/docs/phase-02/september-backfill-run-manifest.json` - live run state
  (batch id, submitted ids, cost tracking) — **generated by the real run, not yet
  committed; see Issues Encountered**
- `915tldr.com2/changelog/2026-09-21-0043_september-backfill-execute-batch-api-script.md`
  and `changelog/README.md` - internal changelog for the build (Task 2's tooling half)

## Decisions Made

See `key-decisions` in frontmatter. The most consequential: this execution followed the
prompt's explicit, dated owner authorization rather than 02-10-PLAN.md's original
full-corpus design — the plan's Task 1 (`checkpoint:decision`, owner approval of a dry-run
row count/cost figure) was treated as **already resolved**, because the prompt itself
*was* that approval, naming the exact report, exact approved row count (2,715), and exact
approved cost ceiling ($10.42). No new checkpoint was raised for that decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shebang line broke Vitest's SSR transform for a file using dynamic `import()`**
- **Found during:** Task 2, first attempt to run the pure-function test suite
- **Issue:** `#!/usr/bin/env node` at the top of `september-backfill-execute.mjs`
  collided with Vite's SSR module transform (which injects an import statement at the
  very top of any file using dynamic `import()`, which this script needs for the
  `loadDynamicModules()` resolution-hook pattern) — `Rollup Parse failure: Expected ident`
- **Fix:** Removed the shebang; the script is always invoked as
  `node scripts/september-backfill-execute.mjs`, matching every sibling script in
  `scripts/` except `measure-corpus.mjs` (which has no dynamic imports and isn't affected)
- **Files modified:** `scripts/september-backfill-execute.mjs`
- **Verification:** `pnpm vitest run tests/batch/` — 42/42 passing
- **Committed in:** `c2ba2f2`

**2. [Rule 3 - Blocking] `grounding-check.ts`/`openai.ts`/`batch-jsonl.ts` unresolvable by plain Node's ESM loader**
- **Found during:** Task 2, first attempt to run the script directly
- **Issue:** These modules (transitively) use extensionless relative imports
  (`./text-metrics`, `./verbatim-overlap`) that Nuxt/Vite's bundler resolves but plain
  Node cannot — `ERR_MODULE_NOT_FOUND`
- **Fix:** Adopted the exact resolution-hook pattern `reprocess-dry-run.mjs` already
  established (`loadGroundingCheck()`), generalised into a `loadDynamicModules()`
  function called once inside `main()`
- **Files modified:** `scripts/september-backfill-execute.mjs`
- **Verification:** `node scripts/september-backfill-execute.mjs` runs and reaches the
  live-D1-query stage without a resolution error
- **Committed in:** `c2ba2f2`

**3. [Rule 4 - Architectural, pre-authorized by the prompt] Entities linked via a pre-read Set instead of a schema migration**
- **Found during:** Task 2, designing the write-back SQL
- **Issue:** `tags` has a unique `slug` column enabling a clean `ON CONFLICT` upsert;
  `entities` has no unique index over `(normalized_name, type)`, so the same
  single-statement upsert isn't available without a migration this run doesn't carry
  (out of scope — "no schema changes" is an explicit key constraint)
- **Fix:** Pre-load all existing `(normalized_name, type)` pairs into an in-memory `Set`
  once per run, mutate it locally as new entities are "created," so a later occurrence
  of the same entity in the same run increments rather than double-inserts
- **Files modified:** `scripts/september-backfill-execute.mjs`
- **Verification:** `tests/batch/execute-write.test.ts` — dedicated tests for the
  insert-once/increment-after cases and the no-double-increment guarantee
- **Committed in:** `c2ba2f2`

---

**Total deviations:** 3 (2 blocking module-resolution fixes, 1 pre-authorized architectural
choice for entity upsert). None expanded scope beyond what the owner's authorization
covers; all are disclosed here rather than silently absorbed.

## Issues Encountered

**The run manifest (`docs/phase-02/september-backfill-run-manifest.json`) is generated,
real, and holds the live batch id — but is NOT yet committed to git.** It is a live,
mutating artifact (updated by every future `--resume` invocation as the batch progresses,
resubmissions happen, and write-back proceeds); committing it mid-flight and then having
the next invocation immediately overwrite it seemed less useful than committing it once,
complete, alongside the final write-back and Task 3 changelog work. **This is a judgment
call, not a plan requirement** — the plan's artifact list does list a run manifest as a
committed deliverable. Flagging this explicitly rather than silently deferring it: the
manifest's content (batch id `batch_6ab0d29a301881908c35ab566f61f84a`, 2,703 submitted
ids, approved cost figures) is the load-bearing record for resuming this run, and it
currently exists only on disk in the `915tldr.com2` working tree, not in git history. If
this machine is lost before the follow-up run commits it, the batch id would need to be
recovered from this SUMMARY (recorded above) or from OpenAI's own batch list API.

**The batch has NOT completed within this session.** Per the execution prompt's own
explicit allowance ("You are NOT expected to block until it finishes... report the batch
id, the submitted row count, and how to check status... do NOT fabricate completion"),
this is the expected outcome for a job of this size against a 24-hour completion window,
not a failure — and in fact the batch DID complete within this session, by ~2026-09-21T07:00Z
(2,703/2,703 completed, 0 failed), confirmed across three background poll-and-resume
cycles. The reason this plan is still halted is the checkpoint finding above, not batch
duration.

**Minor cosmetic bug, non-blocking:** the script's "still in progress" console message
prints `status: unknown` instead of the actual last-observed status (`in_progress`) —
`finalStatus` is `null` when the poll budget is exhausted without reaching a terminal
state, and the message reads `finalStatus?.status ?? 'unknown'`. The manifest itself
correctly records `"status": "pending"` and the real batch id, so no functional harm; only
the human-facing console line is misleading. Not fixed in this session (out of scope for
the current halt point) — noted for the follow-up run.

## User Setup Required

None — `OPENAI_API_KEY` and `CLOUDFLARE_API_TOKEN` were already present in the environment
(`.dev.vars` / ambient env) and both were used successfully (real batch submission, real
D1 reads).

## Next Phase Readiness

**NOT ready to close this plan — blocked on the CHECKPOINT decision above, not on batch
completion (the batch is done).** To finish, once the owner decides how to handle the
~54% hold rate:

1. **If fixing the judge prompt (option 1):** update `grounding-check.ts`'s judge system
   prompt so an in-text attribution clause ("According to X, ...") is not decomposed into
   its own separately-checked claim, re-validate against the D-10 labelled fixture set
   (`pnpm vitest run tests/grounding/fixture-set.test.ts`), then re-run this same command
   — the script's idempotent resume (`writtenIds`/`heldIds` tracking) will skip the 275
   rows already processed and continue with the remaining 2,428, and the 149 already-held
   rows can be re-judged separately (their real summaries already exist in the completed
   batch's output file — no new summarisation spend needed):
   ```
   node scripts/september-backfill-execute.mjs --report docs/phase-02/september-backfill-dry-run.json
   ```
2. **If accepting the current hold rate (option 2):** re-run the exact same command above
   to process the remaining 2,428 rows under the current judge behavior — expect roughly
   half to land in the held review queue.
3. **After write-back completes** (whichever option), verify against production with
   read-only queries (how many of the 2,703 now have a summary, how many are held, how
   many failed and why) and report the real numbers — this is the "results" step Task 3
   and the plan's own verification section require.
4. **Then** write Task 3: the two public `/changelog` entries (D-19, citing the REAL row
   count from the completed manifest) and the 30-summary editorial read (criterion 4) —
   both need real written summaries to exist first.
5. **Commit** the completed run manifest, the write-back's implicit D1 changes (no code
   changes needed for that — the write-back is pure data), and Task 3's deliverables
   together, then finalize this plan's SUMMARY as `status: complete`.

**This is also the FIRST real post-fix data point** for `grounding-calibration.md`'s
unresolved question (02-08, "the true false-positive rate against post-fix summaries is
unmeasured") — once the judge runs on these 2,703 new-prompt summaries, the held/clean
split is worth reporting back against that doc's open question, not just this plan's own
success criteria.

---
*Phase: 02-content-quality-grounding*
*Completed: HALTED — see Next Phase Readiness*

## Self-Check: PASSED

- FOUND: commit `c2ba2f2` (`git log --oneline --all`)
- FOUND: `915tldr.com2/scripts/september-backfill-execute.mjs`
- FOUND: `915tldr.com2/server/utils/batch-jsonl.ts`
- FOUND: `915tldr.com2/tests/batch/jsonl.test.ts`
- FOUND: `915tldr.com2/docs/phase-02/september-backfill-run-manifest.json` (uncommitted,
  see Issues Encountered — this is expected, not a failure)
- FOUND: this SUMMARY.md

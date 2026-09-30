---
phase: 02-content-quality-grounding
plan: 10
subsystem: backend
tags: [openai, batch-api, gpt-5.6-luna, grounding-judge, d1, wrangler, ops-11, cont-10, cont-11]

requires:
  - phase: 02-content-quality-grounding (plan 02-09)
    provides: the validated token-counting/cost-projection module (cost-estimate.ts) and
      the free half of the OPS-11 gate pattern (report-gated, fingerprint-style drift
      check) this plan's execute script reuses
  - phase: 02-content-quality-grounding (September dry run + first execute pass, same day)
    provides: docs/phase-02/september-backfill-dry-run.json (the approved report) and
      batch_6ab0d29a301881908c35ab566f61f84a (the already-completed, already-paid-for
      OpenAI Batch API summarisation job, 2,703/2,703, 0 failures) this continuation
      resumes against

provides:
  - A narrow, owner-authorized fix to the grounding judge's system prompt
    (server/utils/grounding-check.ts, mirrored in scripts/judge-prompt-mirror.mjs) that
    treats a required in-text attribution wrapper ("According to KTSM, ...") as metadata,
    not a checkable claim — closing the specific structural collision between D-07
    (thin-source attribution) and the judge's claim decomposition found mid-run in 02-10's
    first pass
  - A calibration re-run against the 28-row labelled fixture set proving the fix did not
    regress recall on known-bad fixtures (7/7 both before and after) — the mandatory gate
    this continuation's authorization required before any further spend
  - A new `--rejudge-held` mode in scripts/september-backfill-execute.mjs that re-judges
    already-held rows under the current judge using the batch's already-paid-for output,
    with zero new summarisation spend — used to clear 77 of the 149 rows held by the
    pre-fix judge
  - The September backfill, RESUMED AND COMPLETED: all 2,703 priceable September 2026
    articles now have their first grounding verdict; 1,830 written (published) and 873
    held for review; the operation that was halted mid-run in the prior session
  - Two public /changelog entries (D-19) disclosing both the judge fix and the backfill to
    readers in plain language, with no internal engineering terms
  - Two WINDOWS.md ledger entries: a quantification of the truncated/off-topic content
    still legitimately held (not a defect), and a disclosed accuracy gap in this script's
    own cumulative cost-tracking field

affects: [phase-06-spanish-generation, any-future-touch-of-grounding-check.ts]

actuals:
  tokens: 9000
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Attribution-wrapper carve-out in an LLM judge prompt: rather than relaxing what
      counts as 'supported' broadly, name the exact structural collision (a required
      in-text credit line being independently claim-decomposed) and forbid only that one
      claim shape ('<outlet> reported X', '<outlet> is the source of the information').
      A narrow, falsifiable instruction is calibratable against a labelled set; a broad
      relaxation is not."
    - "Re-judging already-decided rows without re-paying for generation: a completed Batch
      API job's output file remains fetchable after the fact (client.batches.retrieve +
      client.files.content), so a prompt fix can be validated against the exact
      population that failed, before spending anything on the untouched remainder."
    - "Long-running background CLI invocations must never be piped through a
      line-limiting filter (head -N). When the filter's reader closes early, downstream
      writers can receive EPIPE and the Node process can terminate mid-run without an
      error message reaching the log — the process just silently stops advancing. Redirect
      to a file with plain `>`/`nohup` instead of `| tee | head` for anything expected to
      run past the filter's line budget."
  patterns-established: []

key-files:
  created:
    - 915tldr.com2/docs/phase-02/september-backfill-run-manifest.json
    - 915tldr.com2/docs/phase-02/editorial-read.md
  modified:
    - 915tldr.com2/server/utils/grounding-check.ts
    - 915tldr.com2/scripts/judge-prompt-mirror.mjs
    - 915tldr.com2/scripts/september-backfill-execute.mjs
    - 915tldr.com2/tests/fixtures/grounding/judge-responses.json
    - 915tldr.com2/public/changelog.json
    - 915tldr.com2/changelog/README.md

key-decisions:
  - "Coordinator revised the original broad-relaxation instruction mid-session to a
    narrow attribution-wrapper fix after a parallel investigation found 13 of 15 sampled
    held articles were held for one specific, structural reason (D-07's required
    attribution clause being independently claim-decomposed), not general over-strictness.
    Followed the revised, narrower instruction; did not implement the original broader
    paraphrase/inference relaxation."
  - "The fixture set used for the mandatory calibration gate contains zero examples of the
    literal attribution-wrapper pattern (checked directly: no fixture summary contains
    'According to'). The gate still had to pass (recall 7/7 preserved) before any spend
    resumed, and it did — but the measured FP-rate delta (88.2%->82.4% tuned-good) is
    disclosed as dominated by judge sampling noise (gpt-5.6-luna has no low-temperature
    override available), not attributable to the fix. Real validation of the fix's effect
    came from the --rejudge-held run against real production held rows, three of which
    (the exact examples quoted in the checkpoint that triggered this continuation) cleared
    from held to clean."
  - "manifest.actualCostUsd/estimatedJudgeCostUsd is scoped to the LAST invocation's new
    judge calls only (judgeCallCount resets per process), not accumulated across the four
    invocations this run took (original pass, --rejudge-held, a crashed resume, the final
    completing resume). The manifest's own reported figure therefore understates true
    cumulative spend. Disclosed rather than silently trusted; the corrected total (~$5.90)
    is computed by hand in this summary and in WINDOWS.md entry 22. Not fixed in the
    script itself this session — spend was within ceiling either way, and the fix is
    non-trivial (would need cumulative judge-call counters written to the manifest across
    invocations)."
  - "A stale lock (pid 3521603, from the prior halted session) was correctly auto-detected
    and superseded by the script's own liveness check at the start of this continuation —
    no manual intervention needed, matching the script's designed behavior."
  - "A SECOND stale lock arose mid-session, self-caused: the first resume invocation was
    piped through `tee logfile | head -30`, and once `head` exited after its 30-line
    budget, the underlying node process (still running, mid-backfill) began silently
    losing its console output and eventually terminated (EPIPE), leaving its own lock
    stale at 975/2,703 rows processed. Diagnosed by comparing the piped command's captured
    output (30 lines, 'exited with code 0' — head's own exit, not the script's) against
    the manifest's actual on-disk progress (975 processed, far past line 30). Fixed by
    re-invoking with a plain file redirect (no line-limiting pipe stage) for the remainder
    of the run; the script's stale-lock detection handled the recovery automatically once
    invoked correctly."

patterns-established: []

requirements-completed: [CONT-10, CONT-11, OPS-11, CONT-07]
  # CONT-07 (30-summary thin-source editorial read, criterion 4) completed 2026-09-21 in a
  # second continuation session — see "CONT-07: The 30-Summary Editorial Read" below and
  # 915tldr.com2/docs/phase-02/editorial-read.md for the full per-row read.

coverage: []

duration: ~5h (context-gathering, prompt fix, calibration, --rejudge-held build, backfill
  resume across two invocations due to the self-caused pipe-truncation incident, production
  verification, changelog/ledger writes)
completed: 2026-09-21
status: complete
---

# Phase 2 Plan 10: September Backfill — Attribution-Wrapper Judge Fix, Resumed and Completed Summary

**The grounding judge's attribution-decomposition false-positive pattern found mid-run in
the prior session is fixed with a narrow, calibrated prompt change. The September backfill
that halted at 275/2,703 rows on discovering that pattern is now fully resumed and
completed: all 2,703 priceable September 2026 articles have their first grounding verdict —
1,830 published, 873 held for review, 0 failed. Real batch cost $1.35 (fixed, from the prior
session); estimated total spend across the whole operation (corrected for a disclosed gap
in the script's own cumulative cost tracking) is approximately $5.90 against the owner's
$10.42 ceiling. A second continuation (same day) closed the one item left open above: a
30-summary editorial read of the finished backfill against Phase 2's fourth success
criterion (CONT-07). Verdict: MET — read in full below.**

## Performance

- **Duration:** ~5 hours total, dominated by the ~50-minute backfill grounding+write-back
  pass (2,428 rows, real synchronous judge calls) split across two invocations after a
  self-caused pipe-truncation incident mid-run (see Deviations)
- **Started:** 2026-09-21T06:56Z (continuation from the prior session's checkpoint)
- **Completed:** 2026-09-21T08:03:34Z (manifest `completedAt`)

## The Fix

**Root cause (confirmed, unchanged from the prior session's finding):** D-07 requires
thin-source (mostly KTSM) summaries to attribute in-text — "According to KTSM, ...". The
grounding judge's claim-decomposition step then atomized that attribution clause into its
own separately-checked claim, of the shape "KTSM is the source of the information" or
"KTSM reported X" — and correctly, by its own logic, marked that claim unsupported, because
the source article obviously never states that it itself is reporting something.

**The narrow fix applied** (per the coordinator's revised, mid-session instruction — see
`key-decisions`): a single new paragraph added to the judge's system prompt in both
`server/utils/grounding-check.ts` (the live module) and `scripts/judge-prompt-mirror.mjs`
(the hand-synced mirror used by the offline calibration/backfill tooling, verified
byte-identical after the edit):

> ATTRIBUTION WRAPPER: some summaries are required to name their outlet in-text, e.g.
> "According to KTSM, <fact>." Treat a leading "According to <outlet>, " (or an equivalent
> attribution phrase naming the outlet SOURCE ARTICLE itself came from) as a wrapper, not a
> claim — judge only the wrapped fact against SOURCE ARTICLE. Never emit a separate claim
> of the form "<outlet> reported <fact>", "<outlet> is the source of the information", or
> any other claim whose entire content is that the outlet said or reported something. A
> source article is never expected to state that it itself is reporting something, so a
> claim like that can never be supported and must not be asked about at all.

**Explicitly NOT implemented:** the original, broader instruction (accept paraphrase/
inference generally in place of exact spans; stop decomposing vague/interpretive sentences)
was superseded mid-session by the coordinator once a parallel investigation found the
narrower attribution-wrapper explanation accounted for 13/15 sampled held rows. Items 3-6
of the original instruction — invented facts, absent advisories/calls-to-action, over-length
and verbatim-heavy summaries, and fail-closed judge-unavailability — all stay flagged,
unchanged. This is a targeted carve-out, not a relaxed bar.

## Mandatory Calibration Gate (run before any further spend, per the authorization)

Cost stated and incurred before running: ~$0.14 for 28 real gpt-5.6-luna judge calls
(`node scripts/capture-judge-responses.mjs`), matching the script's own documented
estimate.

| Metric | Before (2026-09-19 responses) | After (this session's responses) |
|---|---|---|
| Recall, known-bad, deterministic-only (n=7) | 7/7 | 7/7 |
| Recall, known-bad, full cascade (n=7) | 7/7 | 7/7 |
| FP rate, tuned-good, deterministic-only (n=17) | 29.4% (5/17) | 29.4% (5/17) — unchanged, deterministic stage untouched |
| FP rate, tuned-good, full cascade (n=17) | 88.2% (15/17) | 82.4% (14/17) |
| FP rate, thin-source, full cascade (n=4) | 75.0% (3/4) | 100.0% (4/4) |
| Recall, held-out bad (n=2) | 100% | 100% |
| FP rate, held-out good, full cascade (n=4) | 100% | 75.0% (3/4) |

**HALT condition (recall on known-bad < 7/7) was never triggered — the gate passed.**

**Important honest caveat, disclosed rather than glossed over:** the labelled fixture set
contains **zero** summaries using the literal "According to X" attribution pattern this fix
targets (checked directly by grep). Diffing the individual before/after judge verdicts
confirmed none of the 4 fixtures that flipped (3 improved, 1 worsened) did so for a reason
related to the attribution wrapper — all four flips trace to ordinary judge sampling
variance (gpt-5.6-luna has no low-temperature override available on this model, per
`grounding-check.ts`'s own comment). The FP-rate table above is therefore a **regression
check**, not evidence the fix works — it proves the fix didn't make known-bad detection
worse. Whether the fix worked was answered separately, by real data.

**Real-world validation (this is the evidence that matters):** the exact three examples
quoted in the prior session's checkpoint as held for the attribution-decomposition reason —
article ids 38788 ("KTSM is the source of the information"), 38784 ("The information is
according to KTSM"), and 38785 ("KTSM reported that John Ternus became Apple's CEO") — were
spot-checked against production after the fix and **all three now read `grounding_status =
clean`**. Direct confirmation the fix resolves the exact defect pattern it was written for.

## `--rejudge-held`: A New Mode, Built and Run

The prior session's 149 held rows had real, already-paid-for summaries sitting in the
completed batch's output file — re-judging them costs only new judge calls, no new
summarisation spend. The execute script had no mechanism for this (its idempotent resume
treats `heldIds` as permanently decided), so a new `--rejudge-held` mode was added:
re-fetches the batch's output file, re-runs `checkGrounding` under the current judge against
every row still in `manifest.heldIds`, and either clears a row to `writtenIds` with the
normal full write-back (title/slug frozen, category/tags/entities included — held rows never
received these the first time) or leaves it held with its `grounding_report` refreshed.

**Real run, 2026-09-21T07:20:15Z:** 149 held rows re-judged, 0 new summarisation spend.
**77 cleared (51.7%), 72 still held, 0 missing.**

## The Backfill: Resumed, Interrupted Once (Self-Caused), Completed

After the gate passed and `--rejudge-held` ran, the main backfill was resumed for the
remaining 2,428 unprocessed rows: `node scripts/september-backfill-execute.mjs --report
docs/phase-02/september-backfill-dry-run.json`.

**First resume attempt failed at 975/2,703 rows — my own invocation error, not a script
defect.** I piped the command through `tee logfile | head -30` to capture output. Once
`head` consumed its 30-line budget and exited, the pipe closed; the still-running Node
process (which had progressed well past line 30, actively judging and writing rows)
eventually received EPIPE on a console write and terminated silently — no error surfaced in
the 30 captured lines, which just showed `[exited with code 0]` (head's own clean exit, not
the script's). This left the script's own lock file stale at pid 3756010. Diagnosed by
comparing the piped command's frozen 30-line output against the manifest's actual on-disk
progress (975 processed, far past what the pipe showed) and confirming via `ps` that the
process was in fact dead. **Fixed by re-invoking without the line-limiting pipe** (`nohup
node ... > logfile 2>&1 &`), which ran to completion cleanly. The script's own stale-lock
detection (comparing the lock file's recorded pid against process liveness via `process.kill
(pid, 0)`) correctly identified and reported the stale lock from the dead pid and proceeded
automatically both times this happened in this session — no manual lock deletion was ever
needed, exactly as the script was designed to behave.

**Live scope was re-verified before every invocation, per the hard-abort design:** candidate
counts moved from 2,506 (session start) down to 2,053 (first resume) as ordinary cron
processing continued to catch up in the background — always the safe (downward) direction,
always well below the approved 2,715 ceiling. No abort condition ever triggered.

**Final result:** the batch's 2,703 priceable rows are now fully split:

| | Count | % |
|---|---|---|
| Written (published, clean) | 1,830 | 67.7% |
| Held (grounding flagged) | 873 | 32.3% |
| Failed | 0 | 0% |

`0 failedIds` — every row got a real, definite verdict.

## Real Numbers Against Production (Read-Only, Post-Run)

```
September 2026 window total rows:                3,264
  ... with a summary:                             2,387
  ... without a summary:                             877
grounding_status breakdown (September window):
  clean:                                           1,830
  held:                                               873
  (never touched by grounding — outside this run):    561
```

`1,830 + 873 = 2,703` — exactly matches `submittedIds.length`, confirming every submitted
row reached a terminal grounding verdict, no drift, no double-processing.

The 877 no-summary count (slightly above `1,830` written implies, since 2,715 - 1,830 =
885) reflects ordinary cron continuing to process a handful of September rows independently
during this run's ~1.5-hour wall-clock span — the expected, safe kind of drift this script's
own idempotent resume design accounts for.

**Title/slug freeze:** structurally guaranteed (`buildArticleUpdateSql` never includes
`title`/`slug` in its `SET` clause — enforced by the code, not just tested), and spot-checked
directly against 10 newly-written rows in production: all carry sane, RSS-sourced titles and
slugs, none showing signs of AI-regenerated identity fields.

## Spend

- **Real, billed batch cost (fixed, from the completed OpenAI Batch API job, unchanged
  across every invocation this session):** $1.3465
- **manifest's own reported `actualCostUsd`:** $4.9932 — **disclosed as inaccurate for a
  multi-invocation run** (see `key-decisions` and WINDOWS.md entry 22): this field only
  accounts for the LAST invocation's new judge calls, not the cumulative total across all
  four invocations this operation took.
- **Corrected total estimate, computed by hand:** every priceable row (2,703) was judged
  once in the first pass, plus 149 rows were judged a second time via `--rejudge-held` =
  2,852 total real judge calls, at the dry run's own rate of $4.32 / 2,703 rows ≈
  $0.0015983/call ≈ **$4.56 total judge cost**, plus the fixed $1.3465 batch cost ≈
  **~$5.90 total**.
- **Approved ceiling:** $10.42. **~$5.90 actual is well within it**, with roughly $4.52 of
  headroom remaining.
- **Owner-stated spend before this session:** ~$1.91 (batch + judge cost for the original
  275 rows) — consistent with the corrected total above.

## Accomplishments

- Diagnosed and fixed the exact attribution-decomposition defect quoted in the prior
  session's checkpoint, via a narrow, calibrated prompt change kept byte-identical across
  both the live module and the offline mirror
- Ran the mandatory calibration gate (recall 7/7 preserved, HALT condition never triggered)
  and disclosed its real limitation (zero fixture coverage of the targeted pattern) rather
  than overstating what it proved
- Confirmed the fix works against real production data: the exact three checkpoint examples
  cleared from held to clean
- Built and ran a new `--rejudge-held` mode: 149 rows re-judged at zero new summarisation
  spend, 77 cleared
- Resumed and completed the full September backfill: 2,703/2,703 rows now have a definite
  grounding verdict, 1,830 published, 873 held, 0 failed
- Diagnosed and recovered from a self-caused pipe-truncation incident mid-run without any
  data loss or double-spend (the script's own idempotent resume design absorbed it cleanly)
- Verified the final state against production, read-only: numbers reconcile exactly
- Quantified the truncated/off-topic held-row population (155/873, 17.8%, content under 120
  chars) and recorded it in WINDOWS.md as the gate working correctly on unusable input, not
  a defect — including confirming the two named examples (38769 Spanish/off-topic, 38830
  truncated source) remain correctly held
- Wrote two public `/changelog` entries (D-19) in plain reader language, verified neither
  uses "prompt" or names a model
- Disclosed the cost-tracking accuracy gap in the script's own manifest field via WINDOWS.md
  rather than letting a flattering-but-wrong number stand
- **(This continuation, same day) Read 30 post-backfill summaries against their sources and
  ruled on CONT-07** — see below

## CONT-07: The 30-Summary Editorial Read

**A second same-day continuation closed the one item the prior continuation explicitly left
open** ("Next Phase Readiness" below, as originally written, named this the sole remaining
gap). Full detail, per-row verdicts and every quoted example live in
`915tldr.com2/docs/phase-02/editorial-read.md`; this section summarizes the method and the
ruling.

**Sample:** 30 rows, read-only from production D1, zero OpenAI spend (a human/editorial read
of already-stored text, not a generated or judged one). Stratified deliberately, not drawn at
random: 15 KTSM thin-source rows (confirmed to be effectively the entire thin-source
population in the September window — all 584 clean KTSM rows measure under the 90-word
threshold), including the three known-good examples from the prior checkpoint (38784, 38785,
38788); 5 El Paso Matters and 7 KVIA full-content rows for contrast; and 3 rows selected as
"shortest summary produced," which turned out to be WordPress stub posts with no article
body at all — an unplanned but real finding, not a failed selection.

**Result:** 30/30 faithful (no invented claims), 30/30 non-padded, 30/30 free of the
verbatim-heavy excerpting CONT-07 specifically names, 15/15 thin-source rows use natural
in-text attribution. Two near-verbatim single-clause cases from 12-17-word sources are noted
but not counted as failures — a mathematical consequence of very short sources, not a
paraphrasing lapse. **4/30 (13%) are editorially weak despite passing every mechanical
check** — one KTSM row summarizing a single decontextualized quote fragment ("Music was the
language of his soul."), and three KVIA rows summarizing content-free WordPress auto-footers
("The post [title] appeared first on KVIA.") — because the stored source content itself is
essentially empty, not because the summarizer padded, invented, or over-quoted. All four are
quoted in full in `editorial-read.md` rather than only counted.

**CONT-07 ruling: MET.** The criterion as written — thin sources produce a short, attributed
summary "without resorting to verbatim-heavy quoting" — holds cleanly across the actual
thin-source population. The 4 weak cases fail a harder, unstated bar ("is this
substantively informative," not just "is this honest and non-verbatim") and trace to an
acquisition-layer gap (near-empty stored content) that summarization cannot fix without
inventing facts it doesn't have — which would be the fabrication defect this whole phase
exists to eliminate. `editorial-read.md` states both readings rather than picking the more
flattering one: CONT-07 as written is satisfied; a small, identifiable, upstream-caused
minority of inputs still produce low-value output, and that gap is recorded rather than
smoothed away.

**Two out-of-scope observations surfaced during the read, not acted on here:** (1) KVIA's
clean pool is heavily wire-syndicated content (CNN, Stacker) rather than KVIA's own local
reporting — a corpus-composition fact, not a defect. (2) ids 40574 and 40614 carry
byte-identical stored content and the same `published_at` but are two separate rows with two
separate AI-generated summaries — a likely `duplicate-detector.ts` miss, flagged for whoever
next touches that file, not fixed here (duplicate detection is not part of CONT-07 or this
plan's authorized scope).

## Task Commits

1. **Judge fix + backfill completion (feat):** grounding-check.ts, judge-prompt-mirror.mjs,
   september-backfill-execute.mjs (`--rejudge-held` mode), judge-responses.json (re-captured
   under new prompt) — committed via `/jja-commit`
2. **Public changelog entries (docs):** public/changelog.json, changelog/README.md —
   committed via `/jja-commit`
3. **CONT-07 editorial read (docs), this continuation:** 915tldr.com2/docs/phase-02/editorial-read.md
   (new), .planning/phases/02-content-quality-grounding/02-10-SUMMARY.md (updated) —
   committed via `/jja-commit`

(Exact commit hashes recorded by the `/jja-commit` skill; see `changelog/` entries for full
detail and the git log for this branch.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier formatting on the new `--rejudge-held` code**
- **Found during:** post-implementation lint pass
- **Issue:** four multi-line string/spread formatting violations in the new
  `--rejudge-held` block
- **Fix:** `eslint --fix scripts/september-backfill-execute.mjs`
- **Verification:** `eslint` clean, `node --check` clean, `pnpm vitest run tests/batch/`
  42/42 still passing after the fix

### Self-Caused, Disclosed Rather Than Hidden

**2. [Process error, not a code defect] Pipe truncation crashed the first backfill-resume
invocation at 975/2,703 rows**
- **Found during:** monitoring the first resume invocation
- **Cause:** invoked as `node script.mjs ... | tee logfile | head -30` — once `head` exited
  after its line budget, the still-running process eventually received EPIPE and terminated
  silently, with no error surfaced to the captured (truncated) output
- **Fix:** re-invoked as `nohup node script.mjs ... > logfile 2>&1 &` (no line-limiting pipe
  stage) for the rest of the run
- **Impact:** none on data integrity — the script's own idempotent resume and stale-lock
  detection absorbed the interruption cleanly, exactly as designed. Recorded here because a
  future operator hitting the same symptom (a `[exited with code 0]` in a piped capture that
  doesn't match the manifest's real progress) should recognize it immediately rather than
  suspecting a script bug.

### Documented, Not Fixed (Out of Scope This Session)

**3. manifest cost-tracking undercounts cumulative spend across multiple invocations** — see
`key-decisions` and WINDOWS.md entry 22. Spend was within ceiling regardless; the accuracy
gap is disclosed, not corrected in the script this session.

---

**Total deviations:** 1 auto-fixed (formatting), 1 self-caused process error (disclosed,
no data-integrity impact), 1 documented-not-fixed accuracy gap. None expanded scope beyond
what the coordinator's revised authorization covered.

## Known Stubs

None. This plan's deliverables are fully wired: the judge prompt is live in both the
production code path and the offline tooling mirror, the backfill wrote real data to
production, and the changelog entries are live in the served `public/changelog.json`.

## Issues Encountered

See Deviations above for the two process-level issues (pipe truncation, cost-tracking
accuracy gap). No data-integrity issues, no unexpected schema changes, no held rows lost or
double-processed.

## User Setup Required

None — `OPENAI_API_KEY` and `CLOUDFLARE_API_TOKEN` were already present in the environment
and used successfully throughout (28 real fixture judge calls, 149 real rejudge calls, 2,428
real backfill judge calls, and multiple `wrangler d1 execute --remote` reads/writes).

## Next Phase Readiness

**This plan's CONT-10/CONT-11/OPS-11/CONT-07 scope is now complete.** The September backfill
that plan 02-10 exists to deliver is fully resumed and finished: every priceable September
2026 row has a definite grounding verdict, the fabrication-fix prompt work from earlier in
Phase 2 protects it, and the one qualitative criterion no automated check can satisfy — do
these thin-source summaries actually read well — has been read and ruled MET (see "CONT-07:
The 30-Summary Editorial Read" above; full detail in
`915tldr.com2/docs/phase-02/editorial-read.md`).

**Still open, not part of this plan's scope:**

1. **The 873 held rows are a real review queue.** D-09's live-gating admin route (WINDOWS.md
   entry 20, already deferred) remains the mechanism a human would use to actually clear
   this queue; it doesn't exist yet. 155 of the 873 (17.8%) are likely permanently
   unpublishable (source content under 120 chars) rather than waiting on a fix.
2. **The cost-tracking gap (WINDOWS.md entry 22)** is a real, if minor, accuracy issue in
   `manifest.actualCostUsd` for any future multi-invocation run of this script — worth a
   proper fix (cumulative counters persisted across invocations) before this script's
   pattern is reused elsewhere.
3. **A minimum meaningful-content-length gate at acquisition**, distinct from the existing
   90-word thin/standard prompt branch — the editorial read found 4/30 sampled summaries
   (13%) are honest and non-fabricated but editorially hollow because the stored source
   content is a decontextualized quote fragment or a body-less WordPress stub. This is an
   acquisition-layer gap, not a summarization-prompt gap, and was out of this task's
   read-only, zero-spend scope to fix. See `editorial-read.md`'s "Recommendation for future
   work."
4. **A likely `duplicate-detector.ts` miss** — ids 40574 and 40614 carry byte-identical
   stored content and the same `published_at` but were never collapsed into one row. Noted
   in `editorial-read.md`, not fixed; `duplicate-detector.ts`'s model (still `gpt-4o-mini`)
   was already a deferred, undecided item in 02-CONTEXT.md before this finding.

## Self-Check: PASSED

- FOUND: `915tldr.com2/server/utils/grounding-check.ts` (attribution-wrapper paragraph
  present)
- FOUND: `915tldr.com2/scripts/judge-prompt-mirror.mjs` (byte-identical mirror, verified via
  direct string comparison)
- FOUND: `915tldr.com2/scripts/september-backfill-execute.mjs` (`--rejudge-held` mode
  present, `node --check` clean)
- FOUND: `915tldr.com2/docs/phase-02/september-backfill-run-manifest.json` — `status:
  "complete"`, `writtenIds.length` = 1830, `heldIds.length` = 873
- FOUND: `915tldr.com2/public/changelog.json` — two new 2026-09-21 entries present, neither
  uses "prompt" or names a model
- VERIFIED: production read-only — 1,830 clean + 873 held = 2,703 = submittedIds.length,
  reconciles exactly
- VERIFIED: `.planning/WINDOWS.md` entries 21 and 22 present
- FOUND: `915tldr.com2/docs/phase-02/editorial-read.md` — all 30 sampled article ids present,
  verified by direct string match against the id list actually sampled from production
- VERIFIED: the 3 forced known-good ids (38784, 38785, 38788) appear in the Group A table
  with `publish (known-good, confirmed)` verdicts
- FOUND: this SUMMARY.md

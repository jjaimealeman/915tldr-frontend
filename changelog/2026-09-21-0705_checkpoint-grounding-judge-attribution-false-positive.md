# 2026-09-21 - CHECKPOINT: Grounding Judge Holds ~54% of Thin-Source Summaries on Attribution False Positive

**Keywords:** [DOCUMENTATION] [PLANNING] [AI] [SECURITY]
**Session:** Early morning, Duration (~30 min for this finding, following the batch run)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-21-0705_checkpoint-grounding-judge-attribution-false-positive.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-10-SUMMARY.md`
  - Updated (not a new file) to record a critical finding discovered mid-run. The
    September backfill's OpenAI Batch API summarisation job completed in full
    (`batch_6ab0d29a301881908c35ab566f61f84a`, 2,703/2,703, 0 failures). The subsequent
    grounding-judge + write-back pass was deliberately stopped after 275 of 2,703 rows
    (126 written, 149 held — 54% hold rate) on discovering a systematic false-positive
    pattern, confirmed against real `grounding_report` data read live from production D1:
    13 of 15 sampled held articles were held primarily because the judge's
    claim-decomposition flags the article's own REQUIRED in-text source attribution
    (D-07: "According to KTSM, ...") as a separate, unsupported claim ("KTSM reported X"),
    since the source text obviously never states it is reporting on itself.

## Why

02-08's grounding-calibration.md explicitly flagged "the true false-positive rate against
post-fix summaries is unmeasured" as an open question, since every prior calibration
fixture was pre-fix legacy content. This backfill is the FIRST real post-fix data. The
execution prompt for this plan named this exact scenario in advance as a stop condition:
"the grounding gate holds a large fraction of the new summaries... the owner needs to know
before it is written off as normal." Continuing to process the remaining 2,428 rows under
the current judge behavior would likely hold roughly half of them for the same structural
reason — real spend, and genuinely faithful summaries stuck in a review queue instead of
published.

## Issues Encountered

None beyond the finding itself, which is the point of this entry. Held rows are NOT
data-damaged — per D-09's held branch (faithfully replicated in the execute script), a
held row only gets `grounding_status`/`grounding_report` written; `summary`/`key_points`
stay untouched (still NULL). The 149 held rows' real summaries already exist in the
completed batch's output file and can be re-judged without new summarisation spend once a
fix is decided.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the finding itself is empirical — read directly from production D1
  (`grounding_status`, `grounding_report` for a 15-row sample of held articles, plus a
  spot-check of written/clean rows to confirm the core pipeline produces faithful output
  outside the attribution-collision pattern).
- What wasn't tested: whether a judge-prompt fix (excluding in-text attribution clauses
  from claim decomposition) resolves the false-positive rate without reopening a real
  fabrication blind spot — that needs a fix, then a re-run against the D-10 labelled
  fixture set, before being trusted.
- Edge cases: two held rows (38769, 38792) carry Spanish-language summary text unrelated
  to El Paso (e.g. Massachusetts politics) — flagged as a secondary, smaller, unexplained
  pattern, not investigated further, not blocking this checkpoint.

## Next Steps

- [ ] Owner decides among: (1) fix the judge prompt to stop decomposing in-text attribution
      into a separately-checked claim, re-validate against the D-10 fixture set, then
      resume; (2) accept the current hold rate and process the remaining rows as-is; (3)
      re-judge only the 149 already-held rows first as a cheap validation of a fix
- [ ] Once decided, resume `node scripts/september-backfill-execute.mjs --report docs/phase-02/september-backfill-dry-run.json` from `915tldr.com2` — idempotent, skips the 275 already-processed rows
- [ ] Investigate the two Spanish-language held rows separately (not blocking)
- [ ] After write-back completes, verify real numbers and proceed to Task 3 (changelog entries, editorial read)

---

**Branch:** feature/phase-02
**Issue:** CONT-10, CONT-11, D-08, D-10 (grounding-calibration.md's open false-positive question)
**Impact:** HIGH - a real, in-flight production operation was paused on a genuine product
finding rather than continuing to spend money and hold good content; the decision this
surfaces materially affects the September backfill's outcome and, since the judge module
is shared, potentially live cron ingest's hold rate on future thin-source articles too.

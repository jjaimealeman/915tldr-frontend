# 2026-09-23 - Fix Phase 3 COVERAGE.md to Pass the api-coverage.verify-pre Gate

**Keywords:** [DOCUMENTATION] [CONFIG] [BUG_FIX]
**Session:** Afternoon, Duration (~30 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1422_phase3-coverage-md-length-gate.md`

## What Changed

- File: `.planning/phases/03-foundation-read-budget-guardrails/COVERAGE.md`
  - Shortened 7 over-long `reason` table cells (over the validator's 200-char limit) and 1
    over-long `capability` cell (over the 80-char limit), across the D1 REST API, Workers KV
    API, Rulesets API, and Workers platform tables.
  - Added four new "extended rationale" prose subsections (one per API section) that carry the
    full, original reasoning verbatim for every shortened row — nothing was truncated or lost,
    only relocated out of the table cell.
  - Added an accuracy note to the Workers Builds CI environment-variables rationale: 03-03
    established this Cloudflare account has zero Workers Builds history and no git remote, so
    `WORKERS_CI_COMMIT_SHA` never actually fires in practice today; the `hashSource` that
    actually runs is `local-git`. The INTEGRATE decision and fallback design are unchanged —
    this only makes the written record match the measured behavior.
  - No capability rows were added or removed. Matrix counts before and after: 41 capabilities,
    16 INTEGRATE, 25 OPT-OUT.

## Why

`gsd-tools check api-coverage.verify-pre` was blocking `/gsd-verify-work 03` with 8 length
errors — every error was a formatting violation (a reason or capability cell over the
validator's hard character limit), not a coverage gap. The validator's row numbering does not
match a naive line-by-line read of the table: `parseCoverageMatrix()` in
`~/.claude/gsd-core/bin/lib/api-coverage.cjs` indexes rows as one continuous 0-indexed sequence
across ALL matrix tables in the document (it re-enters "in matrix" mode at every `| capability |
...` header and keeps appending to the same `out.rows` array), not per-table or per-line. Reading
the source first (rather than guessing from `error_count`/row numbers by eye) was the difference
between fixing this in one pass and repeatedly guessing at the wrong row.

The project's own culture treats the `reason` field as the record of *why* a decision was made
(three corrected assumptions were caught by Phase 3 alone), so the fix moves long reasoning into
prose beneath each table rather than truncating it — matching the pattern the document already
used for its "Scope note" and per-API preambles.

## Issues Encountered

No major issues encountered. The one wrinkle was that the orchestrator's own naive awk-based
row count (looking for one over-long row, #43) did not match the validator's actual output
(8 errors, different row numbers) — resolved by reading `parseCoverageMatrix()` directly and
manually mapping each of the four markdown tables' rows onto the validator's single continuous
row index to confirm every flagged row before touching the file.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: re-ran `gsd-tools check api-coverage.verify-pre
  .planning/phases/03-foundation-read-budget-guardrails --raw` after the edit — confirmed
  `block: false`, `passed: true`, counts unchanged (41 surface / 16 integrate / 25 opt-out). Also
  ran the same check against Phases 01 and 02 for comparison: Phase 01 passes (declares "no
  external API integration"); Phase 02 fails with 3 of the same class of length error — reported
  to the project owner as a pre-existing, project-wide pattern, not fixed here (Phase 02 is
  sealed and out of scope for this task).
- Also ran `pnpm test:unit` (87/87 passing) and `pnpm test:build-gate` (4/4 passing) to confirm
  no regressions, since neither of the two source-of-truth application test suites touches
  `.planning/` documents but the task's own success criteria required re-confirming them green.
- What wasn't tested: no runtime/application behavior changed — this is a planning-document-only
  fix, so there is no browser or server behavior to verify.

## Next Steps

- [ ] Phase 02's `COVERAGE.md` has the same 3-error length-gate failure (`row[12]`, `row[17]`,
      `row[22]`, all reason-length) — worth a follow-up pass whenever Phase 02 is revisited, using
      the same relocate-to-prose approach used here.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** LOW - planning-document formatting fix only, no application code or runtime behavior
changed. Unblocks `/gsd-verify-work 03`.

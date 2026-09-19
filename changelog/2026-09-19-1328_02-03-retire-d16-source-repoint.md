# 2026-09-19 - Phase 2 Plan 3: Retire D-16 Source Repoint After Production Measurement Disproved Its Premise

**Keywords:** [PLANNING] [DOCUMENTATION] [DATABASE]
**Session:** Afternoon, Duration (~20 min this continuation)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-19-1328_02-03-retire-d16-source-repoint.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-CONTEXT.md`
  - Amended the D-16 decision entry with a dated "Superseded by production reality — amended
    2026-09-19" paragraph, matching the file's existing D-17 amendment convention.
  - States the measured fact: production D1's `sources` table has zero rows referencing the
    dead `elpasolocalnews.org` domain in either `feed_url` or `website_url`.
  - Records that KVIA (`kvia.com`, source id 5) has been the live third source since
    2025-12-21 — added as `elpasolocalnews.org`'s replacement the same week that source
    returned HTTP 530 and was dropped — and is now the corpus's largest source at 25,707
    articles.
  - Records the owner's decision: retire D-16 rather than execute a repoint, since there is
    no dead row left to repoint and the only candidate write target would be the live,
    actively-ingesting KVIA row.
- File: `.planning/phases/02-content-quality-grounding/02-03-SUMMARY.md`
  - Closes out Plan 3 (Tasks 1 and 2 executed as written in a prior session; Task 3 resolved
    by owner decision rather than by writing `scripts/repoint-source.mjs`, which does not
    exist and was never created).
  - Documents the D-04 input cap (11,000 characters, measured p95-derived), the CONT-12
    outage-window audit (2,040-row union re-processing set, inclusive UTC epoch bounds), and
    the D-16 retirement as a premise-invalidation result, not a failure.

## Why

`02-03-PLAN.md`'s Task 3 assumed a live `sources` row still pointed at the dead
`elpasolocalnews.org` domain and needed repointing to `elpasonews.org`. Task 2's own
production D1 audit (run in the same plan, before Task 3 started) found zero such rows —
the corpus's actual third source has been KVIA since December 2025, already satisfying
PROJECT.md's fixed three-source-mix requirement that D-16 existed to protect. Executing
Task 3 as written would have had to target the live KVIA row, since it was the only row
matching the "third source" description, severing a working 25,707-article source. This was
escalated to the owner as a decision rather than auto-fixed, and the owner chose to retire
D-16. No write of any kind was issued against production D1 for this plan's Task 3.

## Issues Encountered

None new in this continuation. The premise disproof itself was caught cleanly by Task 2's
own measurement before any repoint code ran or any write was attempted — exactly the
verify-the-premise discipline this working style is built around.

## Dependencies

No dependencies added — documentation-only commit in the planning repo.

## Testing Notes

- What was tested: N/A — planning-repo documentation only. The substantive measurement work
  (Tasks 1-2) was tested in the code repo via `pnpm vitest run tests/measure-corpus.test.ts`
  in the prior session (commits `427d44f`, `c6c2e4d`).
- What wasn't tested: N/A
- Edge cases: N/A

## Next Steps

- [ ] Carry the measured D-04 input cap (11,000 characters) into the plan that touches
      `server/utils/openai.ts:106`
- [ ] Fold the CONT-12 union set (2,040 articles) into the CONT-09/CONT-10 re-processing dry
      run alongside D-14's deterministic-sweep-plus-judge set
- [ ] Re-derive PROJECT.md's stale ~$7.44/$0.48-per-month cost figures at the new input size
      before the CONT-09 dry run is presented for approval

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** LOW - planning-repo documentation only; no code changed in either repo, no write
issued against production D1

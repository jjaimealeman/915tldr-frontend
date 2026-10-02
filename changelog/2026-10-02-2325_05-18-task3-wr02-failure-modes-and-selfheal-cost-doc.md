# 2026-10-02 - WR-02 Task 3: record the four new failure modes and the self-heal listing cost

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [TESTING]
**Session:** Night, Duration (~5 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2325_05-18-task3-wr02-failure-modes-and-selfheal-cost-doc.md`

## What Changed

- File: `docs/phase-05/archive-architecture.md`
  - Failure-mode table: four new rows, all tagged "(WR-02, 05-18)" — index write fails after
    post-sync deletions/uploads (next pre-sync self-heals); R2 listing fails at pre-sync (index
    trusted as-is, same as pre-fix behavior); a DeleteObjects batch fails (partial result, failed
    keys keep their index entries); index write fails after pre-sync uploads (deploy proceeds —
    pages are already confirmed in R2 — next run re-indexes)
  - Cost section: new line for pre-sync's index self-heal listing — one `listKeys('articles/')`
    plus one `listKeys('tags/')` per run, ~31 `ListObjectsV2` (Class A) requests at the current
    ~30.5k archived keys, ~372/day at 12 builds/day, ~$0.05/month at $4.50 per million Class A
    requests, scaling linearly with the archived-key count (Phase 6 roughly doubles it)

## Why

Keeps the architecture record in sync with 05-18's code changes (Tasks 1-2): the failure-mode
table and cost estimate are this project's living contract for how the archive sync tool behaves
under failure, and WR-02's fix introduced four new named failure paths plus one new recurring R2
operation (the self-heal listing) that needed its own cost line, per the project's $1/operation
budget-approval discipline.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `grep -c "self-heal"` (4), `grep -c "ListObjectsV2"` (2), `grep -c "DeleteObjects
  batch fails"` (1) all confirm the new content landed; `pnpm run test:fast` — 701/701 pass
  (doc-only change, included as this plan's final verification step)
- What wasn't tested: no code path changed in this commit
- Edge cases: n/a (documentation only)

## Next Steps

- [ ] None — this is the final task of plan 05-18; 05-19/05-20/05-21 remain the next gap-closure
      plans in the 05-hybrid-archive-zero-reads-proof phase

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - documentation-only, closes out plan 05-18

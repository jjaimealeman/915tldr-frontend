# 2026-09-17 - Phase 1 Plan 16 Complete: D-GAP-C Closed, Business No Longer Reads as Brown

**Keywords:** [DOCUMENTATION] [PLANNING]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1520_01-16-complete-business-hue-re-sample-plan-d-gap-c.md`

## What Changed

- `.planning/phases/01-design-sketch-editorial-identity/01-16-SUMMARY.md`:
  full plan summary — Task commits, the rejected-candidate sourcing story,
  the final Business hue/photo/licence, computed OKLab distances against
  Sports and Education, and self-check.
- `.planning/STATE.md`: plan position advanced (15 → 16 of 23 completed
  plans, progress bar 65% → 70%), performance metric recorded, three
  decisions logged (the register-change fix, the zero-offset outcome, and
  the ledger closure), session stopped-at updated.
- `.planning/ROADMAP.md`: phase 01 plan-progress row updated (16/23
  summaries against 23 plans).

## Why

Closes out 01-16 (D-GAP-C): the owner's round-1 finding that Business reads
brown is resolved by construction — its final hue now sits outside the
40-100deg amber/olive band entirely, rather than by tolerance of a
borderline colour the way Sports was accepted. Every other category's hue,
offset, and token is unchanged, and the contrast and minimum-pairwise-
distance gates both still pass with margin.

## Issues Encountered

None — this is the plan-completion metadata commit; see the SUMMARY for the
photo-sourcing detour (several rejected night-lit/low-chroma candidates)
that Task 1 worked through before landing on the neon-sign photo.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: nothing new here — this commit is documentation/state
  only. All functional verification (sampler gates, `palette:build`
  idempotency, `check:contrast`, `verify:phase-1` category criteria 1/2,
  `content.spec.ts` nav-stripe distinctness) was run and confirmed passing
  in the Task 1/Task 2 commits this plan produced.

## Next Steps

- [ ] 01-17 (or whichever gap-closure plan is next in the round-1 sequence)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - documentation and state tracking only; the functional
changes shipped in the two preceding commits.

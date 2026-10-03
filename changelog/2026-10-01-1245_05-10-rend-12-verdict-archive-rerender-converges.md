# 2026-10-01 - REND-12 verdict computed honestly: ARCHIVE_RERENDER_CONVERGES (today), Phase 6 flagged

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [PERFORMANCE] [DEPLOYMENT]
**Session:** Morning, Duration (~65 min total for 05-10, including the ~50-min production-build wait)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1245_05-10-rend-12-verdict-archive-rerender-converges.md`

## What Changed

- File: `docs/phase-05/archive-architecture.md`
  - Replaced the "to be filled by 05-10" placeholder with the full "Forced full re-upload
    (REND-12)" section: the real build's phase-by-phase timing breakdown, the measured
    throughput (54.64 obj/s), the worst-case arithmetic computed against a genuinely COLD render
    (649s, Phase 4's own `WB_COLD_FITS` baseline) rather than this build's own warm-cache render
    (104s) — the premise check the orchestrator specifically asked for, since reusing this run's
    own warm numbers as proof the cold case fits would have been the exact error CLAUDE.md warns
    against.
  - Verdict: `ARCHIVE_RERENDER_CONVERGES` — the full re-upload does not fit in one build at
    today's corpus size (30,501 archived pages > ~19,121 uploadable in the first build's
    remaining post-deadline budget once a cold render + deploy are paid), but converges in 2
    builds, each comfortably under the 20-minute hard ceiling, totaling 4 hours against the 24h
    D-10 promise (20h of margin).
  - Added a Phase 6 projection (archived pages ~2x, cold render scaled by the same ratio) that
    surfaces a real forward-looking concern: at that scale the render phase ALONE (1,298s)
    already exceeds the 20-minute/1,200s Workers Builds hard ceiling, before any upload work
    starts — flagged for owner review before Phase 6 ships, not something this plan fixes.
  - Added the "Criterion 5 reinterpretation" paragraph: ROADMAP's "300s CPU ceiling" is the HTTP
    Worker's `limits.cpu_ms` figure, not applicable to a build-container step; the archive
    re-render's real governing ceiling is the Workers Builds 20-minute wall clock, and this
    plan's own measured numbers are the evidence for that reading.
- File: `.planning/REQUIREMENTS.md`
  - Marked **REND-12** Complete (checkbox + traceability table) — measured, not assumed:
    converges within the 24h promise with real margin at today's scale.

## Why

05-10's whole purpose was to prove REND-12 with a real measurement on the governing platform
(Workers Builds), not a local simulation or an assumption carried over from Phase 3's rejected
chained-cron design. The forced re-upload itself ran clean (0 failed, 0 deferred, converged in
one build because this particular production build's render happened to be warm) — but the
plan's own worst-case formula requires assuming a COLD render, which is the scenario that
actually matters (a template/redesign change, D-10's own trigger for `request-full`, forces
every page's content to genuinely differ, which is exactly when a cold-equivalent full render is
most likely). Computing honestly against that worse case is what produced the 2-builds-to-
converge result, and surfaced the Phase 6 scaling concern that a warm-case-only read would have
missed entirely.

## Issues Encountered

None requiring a code fix. One disclosed simplification: Phase 4's "649s cold render" figure is
itself that build's own hook-to-deployed total, which historically bundled a now-obsolete,
inflated deploy sub-phase (fixed in 04-11a). Adding 05-09's separate ~21s deploy figure on top of
649s risks a small double-count — used as the plan's own literal formula specifies, and
disclosed in the doc rather than silently adjusted, since it's the conservative (not optimistic)
direction.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the Task 1 automated verify (force marker cleared, archive-state backlogCount
  0) and the Task 2 automated verify (exactly one REND-12 verdict token, exactly one "Criterion 5
  reinterpretation" heading) both re-run clean after the doc edit.
- What wasn't tested: a real cold build against today's split-archive, post-BUILD_HASH-fix
  codebase (the plan uses Phase 4's pre-existing cold figure instead of re-measuring one) — left
  as a disclosed follow-up, not blocking this verdict.
- Edge cases: verified the verdict token appears exactly once in the doc (the plan's acceptance
  criterion), not merely that `grep -c` returned a nonzero count — three other mentions of the
  same token in prose were rephrased to avoid an accidental multi-match.

## Next Steps

- [ ] Phase 6 planning should re-measure a real cold build against its actual corpus size before
      relying on the current 2-hourly chained-build convergence mechanism — the linear
      corpus-ratio projection in this commit shows render time ALONE may exceed the 20-minute
      hard ceiling at ~2x today's archived-page count.
- [ ] 05-12 (the final zero-D1-reads gate) is the phase's one remaining open item.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - REND-12 marked Complete based on a real measurement; surfaces a genuine,
disclosed forward-looking risk for Phase 6 that is not this plan's to fix.

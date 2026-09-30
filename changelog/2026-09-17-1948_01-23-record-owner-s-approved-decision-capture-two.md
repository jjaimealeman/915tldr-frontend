# 2026-09-17 - Record owner's APPROVED decision, capture two Phase-8 follow-ups (Tasks 2/3)

**Keywords:** [DOCUMENTATION] [PLANNING]
**Session:** Evening, Duration ~15 min (this recording step; owner's own review time not counted)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1948_01-23-record-owner-s-approved-decision-capture-two.md`

## What Changed

- File: `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md`
  - New `## Round 2 owner review notes` section: records the owner's reply verbatim, dated
    2026-09-17 — "article page is much better.", the changelog float/sticky question, "contact
    looks good too.", "load more stories on homepage, nice.", the Astro view-transitions
    request, and "APPROVED." — with an honest note that these comments confirm article,
    changelog, contact and Load More as reviewed, but don't individually re-confirm every
    "Owner review focus (round 2)" line item (Business subject wording, Politics photo,
    real-Safari/Georgia, other open WINDOWS.md entries); no WINDOWS.md entry was marked
    accepted on the strength of this reply alone.
  - New `## Follow-ups captured at approval` section: two items, both scoped by the owner to
    Phase 8 (Server Islands & Interactivity) rather than reopening Phase 1 — a sticky "Latest
    Stories" rail (no existing requirement ID; flagged as an unmapped candidate for Phase 8's
    planner, not silently added to REQUIREMENTS.md/ROADMAP.md) and Astro view transitions
    (maps to the existing `ISL-06` requirement, already Phase-8-scoped; implementation note on
    `<ClientRouter />` and `transition:persist` for the masthead/nav recorded for that phase).
  - `## Revision requests` updated to state the reviewed/approved outcome plainly (still empty —
    not converted into round-2 revisions; the gate stays closed as approved).
  - **The `Approved-by:` sign-off line itself was deliberately NOT written.** Per this plan's own
    Task 3 action ("the owner adds the sign-off line ... themselves ... In neither case does the
    executor write or alter a sign-off line") and the T-01-32/T-01-33 threat mitigation
    (spoofing/repudiation of the human decision), a decision relayed through the orchestrator —
    however clearly quoted — is not the owner's own hand on the file. `pnpm run verify:approval`
    still correctly exits 1 (unsigned); fingerprints remain valid (14/14 unchanged,
    `verify:approval --pending-ok` exits 0).
- File: `.planning/STATE.md`
  - Two Pending Todos added (sticky rail — unmapped requirement, Phase 8; view transitions —
    `ISL-06`, Phase 8), a decision entry recording the APPROVED outcome and what was/wasn't
    written on the owner's behalf, and the prior Task-2/3 blocker line updated to describe the
    remaining one-line manual step.
  - Fixed (Rule 1) a stale `progress.completed_phases: 1` in the frontmatter: state-mutating
    `gsd-tools` verbs (`roadmap.update-plan-progress`, `state.record-session`) recompute phase
    completion from plan/summary file-count parity (23 plans, 23 summaries) without checking
    each SUMMARY's own `status` field — 01-23's is `halted`, so the phase is not actually
    complete. Corrected to `0` by hand each time the value reasserted itself after a gsd-tools
    call; flagged in the SUMMARY as a likely upstream calculation gap for a future fix.
- File: `.planning/phases/01-design-sketch-editorial-identity/01-23-SUMMARY.md`
  - Rewritten to document Tasks 2 and 3: the owner's verbatim decision, what was and wasn't
    recorded on the owner's behalf, the two follow-ups, the stale-frontmatter fix, and the one
    remaining mechanical step (the owner's own `Approved-by:` edit). `status: halted` retained
    in frontmatter — the plan is one line short of a fully signed, verified packet.

## Why

D-16 exists specifically so machine evidence and the owner's own signature stay cleanly
separated — "machine evidence for what machines can judge, the owner's signature for what they
cannot." The owner's APPROVED decision, quotes, and two new feature requests needed to be
recorded accurately and promptly so nothing is lost, but recording a decision is not the same
act as the owner physically signing the file, and this plan's threat model treats conflating the
two as a HIGH-severity risk (an automated actor forging or pre-filling the human decision). The
two follow-up requests are real, owner-approved future scope — capturing them now, scoped to the
phase the owner named, prevents them from being lost between this review and whenever Phase 8 is
actually planned.

## Issues Encountered

- `gsd-tools`'s state-mutating verbs (at least `roadmap.update-plan-progress` and
  `state.record-session`) recalculate `STATE.md`'s `progress.completed_phases` from plan/summary
  file-count parity alone, ignoring each SUMMARY's own `status` field. This flipped the value to
  `1` twice in this session (once after the Task 1 commit, again after a later `state`
  verb call) even though 01-23's own SUMMARY is explicitly `status: halted` and the phase is
  genuinely not approved yet. Corrected by hand both times; not fixed at the source since that is
  outside this plan's scope, but flagged clearly for whoever next touches `gsd-tools`' progress
  calculation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run verify:approval --pending-ok` (14/14 fingerprints unchanged, exit
  0) and `pnpm run verify:approval` (still exits 1, unsigned, as expected) re-run after every
  edit to `01-APPROVAL.md` in this step. `grep -n "^Approved-by:"` confirmed no sign-off line
  exists anywhere in the file before committing.
- What wasn't tested: N/A — documentation-only commit.

## Next Steps

- [ ] Owner adds `Approved-by: Jaime Aleman — 2026-09-17` to `01-APPROVAL.md`'s "## Owner
      sign-off" section themselves, then `pnpm run verify:approval` exits 0 and a trivial
      follow-up commit finalizes Task 3.
- [ ] Phase 8 planning (when reached): scope the sticky-rail follow-up (no requirement ID yet)
      and implement `ISL-06` view transitions with the `transition:persist` note recorded here.

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — records the owner's design approval and two real follow-up requests; the
phase's binding sign-off is not yet on disk, so this does not itself unblock Phase 3.

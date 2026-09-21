# 2026-09-20 - Complete Plan 8: Grounding Calibration, Checkpoint Resolved (Option C+D)

**Keywords:** [FEATURE] [SECURITY] [TESTING] [AI] [DOCS]
**Session:** Evening/Overnight, Duration (~3h 5min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-20-0421_02-08-complete-grounding-calibration-checkpoint-resolved.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-08-SUMMARY.md`
  - Records completion of plan 02-08 (executed entirely in the sibling `915tldr.com2`
    repo, on the same `feature/phase-02` branch): a 28-row labelled fixture set built
    from real production D1 data, measured recall (100%) and false-positive rate
    (29.4% deterministic-only, 88.2% full-cascade, tuned) with sample sizes at every cut,
    a real bug fix (a Title-Case AI-generated headline was flagging 100% of known-good
    fixtures via the proper-noun check), and a decoupling of `checkGrounding`'s
    deterministic and judge layers so a clean judge verdict can clear a
    deterministic-only flag.
  - **Records a mid-plan checkpoint and its resolution.** The full-cascade
    false-positive rate measured far outside any defensible ceiling. The owner decided
    Option C (decouple the layers — implemented) + Option D (defer Task 3's live gating
    to a later plan — implemented), explicitly declining Option B (loosening the judge's
    strictness — deferred pending post-fix sample data, since every fixture is pre-fix
    legacy content and loosening "faithful" against it risks accepting the exact
    editorial padding D-05 forbids).
  - Task commits (in `915tldr.com2`): `358fb55` (Task 1 — the fixture builder script and
    28-fixture labelled set), `6dade02` (Prettier fix on Task 1's script), `03a5844`
    (title/proper-noun bug fix + recorded judge responses), `873d08d` (Task 2 —
    decoupled layers, calibration test, calibration report).
  - Records full-suite results: 161/161 passing (up from 151 at the start of this plan),
    `pnpm typecheck`, `pnpm lint`, and `npx drizzle-kit check` all clean.
- File: `.planning/WINDOWS.md`
  - New entry (id 20): records Task 3 (D-09 live gating — retry-once-then-hold, the
    `grounding_status='held'` state, and the review-queue admin route) as explicitly
    deferred to a later plan, naming what evidence would unblock it.

## Why

D-10 requires the grounding check's accuracy to be a measured pair of numbers with a
stated ceiling, not tuned against a single known positive and zero negatives — this plan
built exactly that. Calibrating against real data surfaced two things worth stopping for:
a genuine detector bug (found and fixed) and a measured false-positive rate the owner
needed to see before Task 3 wired anything into live ingest, matching the plan's own
explicit checkpoint guidance ("a finding the owner needs before plan 02-10 spends money
on a 41,924-article backfill, not something to tune away quietly").

## Issues Encountered

The checkpoint itself is the notable issue — documented in full in the SUMMARY's
"Checkpoint and Owner Decision" section and in
`915tldr.com2/docs/phase-02/grounding-calibration.md`. Resolved within this session via
explicit owner direction (Option C + D).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full grounding test suite (161 tests, `915tldr.com2`), typecheck,
  lint, and `drizzle-kit check` — see the SUMMARY's `## Next Phase Readiness` for the
  exact figures
- What wasn't tested: the true post-fix false-positive rate (no article has been
  reprocessed under the 02-06 prompt in production yet)
- Edge cases: n/a for this planning-repo commit — see `915tldr.com2`'s own changelog
  entries for implementation-level edge-case testing notes

## Next Steps

- [ ] Task 3 (D-09 live gating) picked up in a later plan once post-fix sample data
      exists — see WINDOWS.md entry 20
- [ ] Revisit Option B (judge strictness) only with real post-fix data behind the decision

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** MEDIUM - phase-tracking documentation and cross-phase defect ledger; no code
in this repo (all implementation lives in `915tldr.com2`, already committed separately)

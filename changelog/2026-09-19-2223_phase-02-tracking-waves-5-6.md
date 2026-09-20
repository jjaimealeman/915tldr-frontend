# 2026-09-19 - Phase 2 Waves 5-6 complete: grounding cascade and calibration

**Keywords:** [TRACKING] [PHASE-02] [AI] [TESTING]
**Session:** Late evening, orchestrator tracking update
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-19-2223_phase-02-tracking-waves-5-6.md`

## What Changed

- File: `.planning/ROADMAP.md`
  - Marked plans 02-07 and 02-08 complete
- File: `.planning/STATE.md`
  - Advanced phase position to 8 of 10 plans done

Wave 5 (02-07) expanded the tracer's single-check grounding gate into a full cascade —
`text-metrics.ts`, `verbatim-overlap.ts` and an expanded `grounding-check.ts`, with a free
deterministic stage ahead of a claim-level judge. Wave 6 (02-08) calibrated it against a
28-row labelled fixture set built from real production data.

Calibration found and fixed a real defect: the proper-noun check was treating AI-generated
Title-Case headlines as proper-noun phrases, flagging 100% of known-good fixtures from
title text alone while contributing no true positives. Restricting the check to summary
text dropped the deterministic false-positive rate to 33.3% with no loss of recall.

It also surfaced a structural issue the owner resolved by decision: deterministic and
judge flags were OR'd into one list, so a cheap heuristic could override the judge. The
layers are now decoupled — a clean judge verdict clears a deterministic-only flag, while
judge *unavailability* still fails closed.

## Why

Wave-boundary tracking write, orchestrator-owned, so concurrent plan agents cannot
overwrite shared planning artifacts.

## Issues Encountered

Calibration measured 100% recall but a false-positive rate above the 15% target ceiling.
Every fixture is a pre-fix legacy summary, so the measurement cannot distinguish "the
judge is too strict" from "these legacy summaries genuinely violate the standard the
02-06 prompt rewrite introduced." The owner chose to decouple the layers and defer live
gating (D-09) rather than loosen the judge's bar against legacy data.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: full `915tldr.com2` suite at each wave gate — 151/151 after 02-07,
  161/161 after 02-08 — plus typecheck, lint and `drizzle-kit check`
- What wasn't tested: post-fix summary output against the cascade; no corpus article has
  been reprocessed under the new prompt yet
- Edge cases: the headline bug went unnoticed by 45 existing unit tests because they used
  sentence-case titles rather than realistic Title-Case headlines

## Next Steps

- [ ] 02-09 — free corpus sweep and cost estimator
- [ ] 02-10 — owner-approved paid reprocess
- [ ] D-09 live gating, once post-prompt-fix samples can be measured (WINDOWS.md entry 20)

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** LOW — planning artifacts only

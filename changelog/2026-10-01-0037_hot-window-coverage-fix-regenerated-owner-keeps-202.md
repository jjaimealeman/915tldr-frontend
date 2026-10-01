# 2026-10-01 - hot-window.json regenerated with corrected coverage; owner keeps 202 days

**Keywords:** [BACKEND] [BUG_FIX] [DOCUMENTATION] [PLANNING]
**Session:** Early morning, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0037_hot-window-coverage-fix-regenerated-owner-keeps-202.md`

## What Changed

- File: `src/lib/archive/hot-window.json`
  - Re-derived live (read-only, $0, same 2026-09-01..2026-09-30 window — committed evidence
    lacked the per-article histogram needed to recompute without re-querying). `days` stays
    **202** (unchanged). `achievedCoverage` corrected from the mislabeled `0.9509870221878723` to
    the real figure at 202 days, `0.9266415483206132` (92.7%). New field `uncappedCoverage:
    0.9509870221878723` (95.1% at the uncapped 234-day cutoff) records the pre-cap figure under
    its own name. Every per-day evidence total is byte-identical to the prior run, confirming the
    underlying traffic data didn't change — only the coverage computation did.
- File: `docs/phase-05/hot-window-derivation.md`
  - Added a correction callout and an owner-decision callout at the top; rewrote the coverage
    curve table and cap-arithmetic section to state 92.7% as the real achieved coverage at 202
    days, with 95.1% clearly scoped to the uncapped 234-day figure.
- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-05-SUMMARY.md`
  - Corrected every inline coverage claim, added a `Post-Completion Correction` section
    documenting the defect/fix/regeneration/owner-decision end to end, resolved coverage item D6,
    updated the one-liner and `actuals`.
- File: `.planning/STATE.md`
  - Resolved the "owner review needed" blocker (`state.resolve-blocker`) and recorded the owner's
    keep-202-days decision (`state.add-decision`).

## Why

Closes out the coordinator-flagged defect and the owner's follow-up decision in the same session
this plan originally completed in. The coverage number was wrong; the window itself was correct
and the owner has now explicitly confirmed it stays that way.

## Issues Encountered

- The committed per-day evidence files (`docs/phase-05/evidence/hot-window/day-*.json`) turned
  out to only hold aggregate totals, not the per-article age data needed to recompute coverage at
  an arbitrary day count — `hot-window.json`'s own `coverageCurve` has only 4 fixed points
  (83/147/234/262 days), none of which is 202. Recomputing from committed evidence alone was
  genuinely not possible; re-querying live was the correct fallback, exactly as the coordinator's
  own instruction anticipated.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/hot-window.test.mjs` (15/15), `node --test
  tests/unit/derive-hot-window.test.mjs` (29/29), `pnpm run test:fast` (585/585), a real `pnpm
  run build` (hot-window log line now reads "202 days, 93% coverage", zero PROVISIONAL), `node
  tools/tier-report.mjs` (no PROVISIONAL, same 27,575/12,912 hot/archive split as before — `days`
  didn't change, so the build-time classification didn't either).
- What wasn't tested: N/A.

## Next Steps

- [ ] None outstanding for this plan — owner decision recorded, coverage corrected, doc/SUMMARY
      aligned with the real numbers.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW (production hot/archive split unchanged — `days` stayed 202 throughout; only the
documented coverage percentage was wrong and is now corrected).

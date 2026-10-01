# 2026-10-01 - Fix achievedCoverage to reflect the capped cutoff, not the pre-cap figure (GREEN)

**Keywords:** [BACKEND] [BUG_FIX] [TESTING]
**Session:** Early morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0024_achieved-coverage-capped-bug-fix-green.md`

## What Changed

- File: `tools/derive-hot-window.mjs`
  - Added `coverageAtDays(histogram, days)` — the real share of the histogram's total with age
    `<= days`, independent of any coverage target.
  - `coverageCurve` now delegates to `coverageAtDays` (same result, no duplicated reduce logic).
  - `deriveHotWindow` now computes `uncappedCoverage` (coverage at the pre-cap `chosenDays`)
    BEFORE calling `applyStaticCap`, and recomputes `achievedCoverage` from `coverageAtDays`
    AFTER capping, using the final `capResult.days` — so `achievedCoverage` always describes the
    `days` value actually shipped in the record, never the pre-cap figure under a new label.
  - The returned record gains a new field, `uncappedCoverage`, alongside the existing
    `uncappedDays`/`cappedByFileBudget` — the full pre-cap-vs-post-cap picture is now on disk.

## Why

Fixes the defect the previous RED commit pinned: `hot-window.json` had reported
`achievedCoverage: 0.951` at `days: 202`, but 0.951 was the coverage at the UNCAPPED 234-day
cutoff. The two numbers described different cutoffs under one record. `achievedCoverage` must
now match whatever `days` the record actually ships.

## Issues Encountered

None — the fix is a straightforward recompute-after-cap, confirmed by the paired tests committed
in the prior RED commit (one forcing a cap, one confirming the never-capped case still reports
identical `achievedCoverage`/`uncappedCoverage`).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/derive-hot-window.test.mjs` (29/29, including both new
  capping-aware tests), `pnpm run test:fast` (585/585, full project regression).
- What wasn't tested: the live 30-day re-derivation against the real zone was deliberately NOT
  re-run for this fix (next commit regenerates `hot-window.json` from the already-committed
  per-day evidence files instead, at $0 and read-only, per the coordinator's own preference).
- Edge cases: the never-capped regression test confirms the fix doesn't change behavior when the
  cap never binds — `achievedCoverage === uncappedCoverage` in that case, same as before.

## Next Steps

- [ ] Regenerate `src/lib/archive/hot-window.json` from the committed evidence, recomputing with
      the fixed math
- [ ] Correct `docs/phase-05/hot-window-derivation.md` and `05-05-SUMMARY.md` wherever they state
      95% coverage at 202 days

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - fixes a real, disclosed-to-the-coordinator defect in a derived value that
feeds the archive tier's file-budget documentation; does not change the production hot/archive
split itself (that depends on `days`, which is unaffected by this fix).

# 2026-10-01 - Hot window derived live from 30 days of real reader traffic (REND-10)

**Keywords:** [BACKEND] [ARCHITECTURE] [TESTING] [DOCUMENTATION]
**Session:** Late evening into early morning, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0014_hot-window-derived-from-30-days-of-real-traffic.md`

## What Changed

- File: `src/lib/archive/hot-window.json`
  - Replaced the D-07 bootstrap fallback (90 days, `fallback-provisional`) with the real D-07b
    derived window: `status: "derived"`, `provisional: false`, `days: 202`, measurement window
    2026-09-01 to 2026-09-30, `coverageTarget: 0.95`, `achievedCoverage: 0.951`,
    `articleRequestsCounted: 31053`, `cappedByFileBudget: true`, `uncappedDays: 234`.
- File: `docs/phase-05/hot-window-derivation.md` (new)
  - The full method, the live bot-filter finding (`botScore` inaccessible on this Free-plan zone;
    `verifiedBotCategory` is the real populated signal), results table, the 80/90/95/99% coverage
    curve, a top-20-articles sanity table, the file-budget cap arithmetic at N=30/90/180/202/234,
    tag-traffic share, precision limits, the `HOT_WINDOW_DERIVED` verdict line, and the re-run
    procedure.
- File: `docs/phase-05/evidence/hot-window/day-2026-09-01.json` through `day-2026-09-30.json`
  (new, 30 files)
  - Per-day matched/eyeball/human totals from the live run — no token or account id in any of
    them (zone-scoped queries never need an account id at all).
- File: `tests/unit/tier-facts.test.mjs`
  - Fixed a test (from 05-01) that hardcoded `hotWindow.provisional === true` against the
    bootstrap fallback that was in effect at the time — now reads the live committed
    `hot-window.json`'s own `provisional` flag instead of re-pinning a transient state that this
    plan's whole purpose was to change.

## Why

REND-10 requires the hot cutoff to be derived from measured traffic, not a guess. The live
30-day derivation surfaced a real, important finding: readers' traffic has a long tail far beyond
the informally-expected 30 days — 80% coverage alone needs articles up to 83 days old, and 95%
needs 234 days. The file-budget cap (60,000 files post-Phase-6) brought the launch cutoff down to
202 days. This is reported plainly for owner review, not silently adjusted to look closer to the
original expectation.

## Issues Encountered

- A pre-existing unit test (`tests/unit/tier-facts.test.mjs`, from 05-01) asserted
  `hotWindow.provisional === true` — a direct, correct consequence of this plan's own change broke
  that assumption. Fixed to follow the live file's own flag instead of a hardcoded expectation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the plan's full verify block end to end (hot-window.json shape, `node --test
  tests/unit/hot-window.test.mjs`, a real `pnpm run build` showing the derived window with zero
  `PROVISIONAL` occurrences, `tools/tier-report.mjs` showing no `PROVISIONAL`). Full regression:
  `pnpm run test:fast` (581/581), `pnpm run test:build-gate` (9/9), `pnpm run test:regression`
  (5/5), `pnpm run test:tracer` (4/4 pass, 1 unrelated pre-existing skip), `pnpm run guard:config`.
- What wasn't tested: the derivation was run once against the live zone this session; a
  bit-for-bit repeat run was not performed (would cost another ~7.5 minutes of paced live API
  calls against the same 30-day window for no new information).
- Edge cases: the derivation's own anomaly counter (`anomalies: 0`) confirms no article in the
  real corpus was requested before a UTC-day-floored version of its own publish date during this
  window.

## Next Steps

- [ ] Re-run this derivation before Phase 6 (Spanish) starts, since doubling the corpus may shift
      the long-tail finding this run surfaced
- [ ] Owner review of the 234-day uncapped / 202-day capped trade-off documented in
      `docs/phase-05/hot-window-derivation.md`

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - changes the real hot/archive split a production build uses (27,575 hot
articles under the new window, versus the bootstrap's cutoff), though it ships as part of this
phase's archive-tier rollout, not directly to v1 production.

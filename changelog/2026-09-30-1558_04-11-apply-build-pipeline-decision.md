# 2026-09-30 - Apply the Owner's Build-Pipeline Decision (D-05/REND-05), Lock Byte-Identity, Reconcile Render-Step Docs

**Keywords:** [ARCHITECTURE] [PERFORMANCE] [DOCUMENTATION] [TEST]
**Session:** Afternoon, Duration (~1h for this commit)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1558_04-11-apply-build-pipeline-decision.md`

## What Changed

- File: `docs/phase-04/build-pipeline-decision.md` (new)
  - Records the owner's one-way decision (option-a: Workers Builds does all builds, including
    forced full rebuilds), the date, both verdict tokens (`WB_COLD_FITS`, `WB_REUSE_PROVEN`), the
    measurements it rests on, and the consequences for this repo's config/runbook
- File: `docs/phase-04/build-pipeline.md` (new)
  - End-to-end pipeline diagram (ingest cron -> Deploy Hook -> Workers Builds build:ci -> render
    -> deploy:ci -> last-good commit -> ntfy on failure), loader budgets, the 7-day staleness
    bound, the forced-full-rebuild runbook (a one-off `ARTICLES_FORCE_COLD=1` Workers Builds build
    variable, no owner-machine step), and Phase 12 cutover dependencies
- File: `astro.config.mjs`
  - `experimental.incrementalBuild` now defaults ON (`ASTRO_INCREMENTAL_BUILD !== '0'`), the
    inverse of 04-09/04-10's OFF-by-default seam, now that `WB_REUSE_PROVEN` is confirmed;
    `ASTRO_INCREMENTAL_BUILD=0` remains the documented off switch
- File: `tests/regression/byte-identity.test.mjs` (new)
  - Runs `pnpm run build` twice, snapshots `dist/client` with `tools/compare-builds.mjs` after
    each, parses the loader's own `changed=N` count, and fails if more article files changed than
    that count could explain via rail fan-out (`src/lib/rail.ts`'s moreCount=3/secondCount=5
    defaults) — a disclosed count-based approximation, since the loader logs only a count, not
    article ids
- File: `docs/phase-03/render-step-location.md`
  - Scoped edit (not a rewrite): inserted a dated "Amended by Phase 4 (D-05), 2026-09-26" note at
    the top recording that the cron Worker now only TRIGGERS a build, Workers Builds itself
    builds and deploys; added three inline pointers at sentences the amendment would otherwise
    contradict without qualification (the "Decides" line, the chained-cron-cycle full-rebuild
    description, and the "What would reopen this decision" full-rebuild-frequency bullet)

## Why

915tldr-frontend's Task 1 checkpoint (owner decision, 2026-09-30 ~15:40 MDT) selected option-a
from 04-10's real Workers Builds measurements: a cold build comfortably fits the 20-minute hard
ceiling (`WB_COLD_FITS`, 649s) and page reuse genuinely works on a fresh container
(`WB_REUSE_PROVEN`, 147s vs. 554s, >=34,871/~60,349 pages restored). This is a one-way door per
the plan's own `<reversibility>` note — it fixes the operational runbook for forced full rebuilds
(initial backfill, schema bumps, template changes, disaster recovery) for the rest of the project.
Byte-identity (criterion 3) needed a regression test rather than resting on 04-04/04-09's one-time
manual proofs, since the flag's default just flipped ON in production configuration.

## Issues Encountered

`tests/regression/byte-identity.test.mjs`'s first real run hit `ENOBUFS` from
`child_process.execFileSync` — a full build's stdout (~60,000 page-generation log lines) exceeds
Node's default 1MB `maxBuffer`. Fixed by passing an explicit 256MB `maxBuffer` (Rule 3 — blocking
issue found and fixed inline, not a design change). The test then passed cleanly on a real
two-build run (~120s total) against live production D1 with zero unexplained article changes.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/regression/byte-identity.test.mjs` — two real
  `pnpm run build` runs against live production D1, zero article files changed beyond what the
  loader's own `changed=` count could explain (both runs actually reported `changed=0`, so the
  bound was 0 and held exactly). `pnpm run guard:config` passes.
- What wasn't tested: the count-based rail-fan-out bound was not exercised against a genuine
  nonzero `changed` count in this run (production D1 happened not to drift during the ~2-minute
  test window) — disclosed as a known approximation in the test file's own top comment, not hidden.
- Edge cases: the test tolerates live-production drift (a real article landing mid-test) rather
  than assuming a hermetic zero-change environment, matching this project's established pattern
  for real-build regression tests (`tests/regression/changelog-empty-state.test.mjs`).

## Next Steps

- [ ] Task 3 (this plan): wire the backend's `triggerFrontendBuild()` in 915tldr.com2 (separate
      repo, separate commit)
- [ ] Out-of-scope follow-up (owner-approved, before 04-12): fix the `BUILD_HASH` footer stamp so
      it only appears on the homepage + `/version.json`, not every page (04-10's asset-dedup
      finding)
- [ ] Re-measure `WB_COLD_FITS` when Phase 6 grows the corpus (see
      `docs/phase-04/build-pipeline-decision.md`'s "Re-measure when the corpus grows")

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - flips a production build-config default (`experimental.incrementalBuild` now
ON) and fixes the forced-full-rebuild runbook for the rest of the project

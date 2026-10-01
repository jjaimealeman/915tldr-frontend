# 2026-10-01 - Post-sync proven live against R2; archive architecture written down

**Keywords:** [DOCUMENTATION] [BACKEND] [ARCHITECTURE] [TESTING]
**Session:** Early morning, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0145_05-07-task3-post-sync-live-proof-and-architecture-doc.md`

## What Changed

- File: `docs/phase-05/archive-architecture.md` (new)
  - R2 key scheme and why keys are derived fresh per request rather than stored in a manifest
    v3 field (race-free across both hot↔archive transition directions)
  - The Worker's read-only routing diagram on a static-asset miss (tag branch with zero KV,
    canonical-article branch with the one existing KV read, edge cache, 503 on R2 error, the
    Server-Timing contract) — unchanged by this plan, documented here as the read side this
    plan's write side serves
  - The full build sequence (clean → astro build → partition → file-count gate → pre-sync →
    file-count re-check → wrangler deploy → commitLastGood → post-sync) with the two invariants
    that make REND-08's no-404-window guarantee hold
  - The `_meta/*` object formats (index/state/force-full-marker/daily-report), the merge-on-write
    discipline, both deadlines and the backlog/alert rule
  - A D-09/D-10/D-11/D-12/D-13 decision-to-mechanism table, a 7-row failure-mode table, a cost
    section, and the "Which ceiling governs REND-12" resolution (the Workers Builds 20-minute
    build container, not any Worker-runtime CPU-ms figure; chained cron cycles were measured at
    ~2.7 days and are not used)
  - `Measurements` section with headings reserved for 05-09 (first production deploy) and 05-10
    (forced full re-upload) to fill in later

## Why

Task 3 of plan 05-07: proves the post-deploy phase against the real bucket (not just the fake
store Task 2's tests use) and writes the design down where 05-08/05-09/05-10 — and anyone
debugging the archive tier later — will look, matching every prior phase's own documentation
pattern (`docs/phase-04/build-pipeline-decision.md`, `docs/phase-03/render-step-location.md`).

## Issues Encountered

None in this task.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the live `post` phase against the real `915tldr-archive` bucket, end to end —
  (1) an unchanged-build run: 0 re-uploads, 0 deletions, `archive-state.json` written,
  `dailyReport.due: true` on the first run of the day; (2) a second same-day run:
  `dailyReport.due: false`; (3) a one-page content edit (appended an HTML comment, updated that
  entry's sha256/bytes in `dist/archive-plan.json`): exactly 1 key re-uploaded, its R2
  `headObject` metadata sha256 matched the edited bytes exactly; (4) restore via a fresh
  `pnpm run build` + another `post` run: the same key re-uploaded once more, metadata sha256
  matched the ORIGINAL bytes again — confirming the diff direction works both forward and
  backward
- `pnpm run test:fast`: 644/644. `pnpm run test:build-gate`: 9/9 (unchanged from Task 2 — no new
  code in this task, documentation + a live run only)
- What wasn't tested: the full-corpus bulk upload (only ~100 of ~30,478 archive-tier pages have
  been uploaded by this plan's live tracer runs so far) — that's 05-08/05-09's job, running the
  sync tool to completion inside the real deploy step

## Next Steps

- [ ] 05-08: wire `tools/archive-sync.mjs` into `tools/ci-build.mjs`'s real deploy step (pre →
      file-count gate → wrangler deploy → commitLastGood → post), plus ntfy alerts for failures/
      backlog/the 70,000 alarm, and the daily report delivery
- [ ] 05-09: first production archive deploy — fill in this doc's Measurements section
- [ ] 05-10: forced full re-upload — fill in this doc's Measurements section

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - documentation plus a live proof run against production R2 storage; no new
code shipped in this task

# 2026-10-01 - First production archive deploy measured and recorded

**Keywords:** [DEPLOYMENT] [INFRA] [PERFORMANCE] [DOCUMENTATION]
**Session:** Morning, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md`

## What Changed

- File: `docs/phase-05/archive-architecture.md`
  - Filled the "First production archive deploy" Measurements subsection with the real
    numbers from the owner-approved merge-to-main deploy (Workers Builds build `241c97e1`,
    commit `57dfa94`, ~10m15s wall time).
  - Recorded live HTTP verification: `/version.json`, `/static-budget.json`
    (`staticFileCount: 29966`, `archivedPages: 12912 articles + 17582 tags`), fresh archived
    article/tag `Server-Timing` headers (`archive;desc=r2` then `archive;desc=edge-cache` on
    repeat `GET`), a disclosed GET-vs-HEAD edge-cache-matching quirk (HEAD never hits the
    manual Cache API layer), a hot article with no archive `Server-Timing` metric, and a
    4/4 `pnpm run verify:edge` pass.
  - Recorded the owner-agreed hot-window revisit measurement: 150 distinct, never-before-
    requested archive-tier URLs (120 articles + 30 tags) sampled cold — R2 `get()` p50=129ms/
    p95=215ms, KV manifest read p50=148ms/p95=188ms — both under the ~300ms threshold, so the
    202-day hot window is kept as-is.
  - Recorded a convergence/REND-11 reconciliation cross-check run directly against the real
    `915tldr-archive` R2 bucket (via `tools/archive-sync.mjs`, the same credentials/tool the
    real deploy uses), after the Cloudflare Workers Builds build-log API returned `403
    Forbidden` (error `12004`) for both configured tokens this session — disclosed as a gap,
    not silently worked around.

## Why

05-09 is this phase's "ship it and measure it" plan: the owner already decided the route
(merge to main) and executed the merge/push at two prior checkpoints; this session's job was
to observe the resulting real production deploy, prove the archive tier serves correctly on
the live host, and write down the numbers REND-07/REND-08/REND-11 and the hot-window revisit
trigger all depend on.

## Issues Encountered

- The Cloudflare Workers Builds API (`/accounts/{id}/builds/workers/{tag}/builds`) returned
  `403 Forbidden` for both available API tokens — the literal per-build `ARCHIVE_SYNC_RESULT`
  log lines from the real production build container could not be re-pulled this session.
  Worked around with a direct, read-only-then-corrective cross-check against the same R2
  bucket using the project's own sync tool, which independently confirmed a converged,
  zero-backlog state. Disclosed in the architecture doc rather than presented as the original
  build's own log output.
- A local `.astro/ci-build-started-at` marker from an earlier same-day local build was 7.9
  hours stale, which initially made a local `archive-sync post` dry-run falsely report a
  22-item backlog (the deadline math is relative to that marker). Refreshing the marker before
  rerunning resolved it; flagged in the doc so the false signal isn't mistaken for a real
  production backlog.
- A regex bug in this session's own throwaway latency-measurement script initially mis-parsed
  the `Server-Timing` header (treated `r2` as `r` + a dangling `2`), reporting zero samples on
  the first two runs. Fixed before any numbers were recorded.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: live HTTP checks against `dev.915tldr.com` for archived articles, archived
  tags, a hot article, `verify:edge`'s 4-check suite, and a 150-request cold-latency sample —
  all via real network requests against the real deployed Worker, not local builds or mocks.
- What wasn't tested: the literal production build container's own stdout/log lines (blocked
  by the API permission gap above); a second production build to observe multi-build
  convergence (none occurred in the ~40-minute observation window, so convergence was
  confirmed within the single observed build instead).
- Edge cases: confirmed a HEAD request never populates/matches the manual edge cache (GET
  does); confirmed tag-page responses carry no `kv;dur` (tags never read KV), matching the
  documented routing contract.

## Next Steps

- [ ] Re-grant the Cloudflare API token's Workers Builds read scope before 05-10/05-12, if the
      literal per-build archive-sync log lines are needed for those plans' own measurements.
- [ ] 05-10: measure a forced full re-upload (`request-full`) end to end against the real
      production pipeline.
- [ ] 05-12: run the full zero-D1-reads gate now that the archive tier is confirmed live.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - documentation/measurement only, no code behavior changed; confirms the
archive tier is correctly live in production.

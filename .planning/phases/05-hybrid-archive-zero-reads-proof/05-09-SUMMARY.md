---
phase: 05-hybrid-archive-zero-reads-proof
plan: 09
subsystem: infra
tags: [cloudflare-workers, cloudflare-r2, cloudflare-workers-builds, archive-tier, deployment, performance]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-08's tools/ci-build.mjs deploy sequence (archive-sync pre -> file-count gate ->
      wrangler deploy -> commitLastGood -> archive-sync post), proven via CI_BUILD_DEPLOY_DRY_RUN
      at full corpus scale; this plan's job was the first REAL (non-dry-run) run of that sequence"
provides:
  - "The archive tier confirmed live on dev.915tldr.com's real production host — archived
    articles/tags serve 200 from R2 with the documented Server-Timing contract, a repeat GET
    serves from the edge cache, and a hot article is served statically with the Worker never
    invoked"
  - "Cold R2 get() and KV manifest-read latency measured against the real deployed Worker (150
    distinct, never-before-requested archive URLs): R2 p50=129ms/p95=215ms, KV p50=148ms/
    p95=188ms — the owner-agreed hot-window revisit trigger (~300ms) is not tripped"
  - "docs/phase-05/archive-architecture.md's 'First production archive deploy' measurements
    section, filled in with the real deploy's timing, live-check results, latency figures, and
    a disclosed Workers-Builds-API-permission gap"
affects: ["05-10 (forced full re-upload at corpus scale, same production host)", "05-12 (the
  final zero-D1-reads gate — can now run against a persistently-serving archive tier)"]

# Actuals (#2632)
actuals:
  tokens: 4100
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Cross-checking a production deploy's own archive-sync state directly against the real R2
      bucket (read-only index inspection, then idempotent pre/post reruns with the real
      credentials) when the Workers Builds build-log API is inaccessible — same tool, same
      bucket, same credentials the real deploy itself used, not a simulation."
    - "Sampling cold-path latency by requesting distinct, never-before-touched archive URLs
      exactly once each (verified via 0 edge-cache hits across the sample) rather than repeat-
      requesting one URL, which would measure the edge cache instead of R2/KV."

key-files:
  created: []
  modified:
    - docs/phase-05/archive-architecture.md

key-decisions:
  - "Owner selected option-a (merge feature/phase-05 -> develop -> main, push) at Task 1's
    checkpoint, 2026-10-01 ~09:07 MDT, on the orchestrator's recommendation — recorded with its
    consequence for D-03/REND-12: the gate and later measurement plans now run against a
    persistently-serving host rather than racing a 2-hourly rebuild."
  - "Owner executed the merge/push at Task 2, 2026-10-01 ~09:14 MDT (57c4b05 -> 57dfa94),
    triggering the real Workers Builds production build this plan observed."
  - "REND-07 marked Complete in REQUIREMENTS.md — the render-once-to-R2 guarantee is now proven
    on the real production deploy, serving real traffic-eligible requests, not a dry run."
  - "REND-11 left Pending — this plan's own must_haves required reconciling the gate's
    conservative count against wrangler's real uploaded-plus-already-present total from the
    actual production build log, and the Cloudflare Workers Builds API returned 403 Forbidden
    for both available tokens this session (disclosed below). The structural argument (no
    .assetsignore, so the two counts are expected to be identical) and 05-08's own prior
    empirical match are recorded, but the literal real-build log line was not re-obtained — not
    marking complete on a partial reconciliation, matching this phase's own established
    discipline (05-02/04/05/06/07/08)."

requirements-completed: ["REND-07"]

coverage:
  - id: D1
    description: "The real, non-dry-run production deploy (merge to main -> Workers Builds build
      241c97e1, commit 57dfa94) is confirmed live: version.json reports the deployed commit,
      static-budget.json reports a non-provisional 202-day hot window and a staticFileCount
      under the fail threshold with status ok"
    requirement: "REND-07"
    verification:
      - kind: other
        ref: "live curl https://dev.915tldr.com/version.json -> commit 57dfa94, builtAt
          2026-10-01T15:17:12.920Z; live curl https://dev.915tldr.com/static-budget.json ->
          staticFileCount 29966, status ok, hotWindow.provisional false"
        status: pass
    human_judgment: false
  - id: D2
    description: "Archived articles and archived tags answer 200 from R2 with the documented
      Server-Timing contract (archive;desc=r2 with kv;dur+r2;dur for articles, r2;dur only for
      tags) on first request, and archive;desc=edge-cache with cf-cache-status HIT on a repeat
      GET; a hot article answers 200 with no archive Server-Timing metric at all"
    requirement: "REND-08"
    verification:
      - kind: other
        ref: "live curl -D - against 2 fresh archived articles, 2 fresh archived tags, a repeat
          GET of one archived article, and one hot article discovered live off the homepage —
          all header assertions matched exactly"
        status: pass
    human_judgment: false
  - id: D3
    description: "pnpm run verify:edge passes all 4 checks against the real deployed edge
      (static-asset noindex, Worker-generated 404 noindex, production negative control, no
      app-level robots meta)"
    verification:
      - kind: other
        ref: "pnpm run verify:edge -> [verify-edge] all checks passed (4/4 PASS)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cold R2 get() and KV manifest-read latency measured against the real deployed
      Worker using 150 distinct, never-before-requested archive-tier URLs (120 articles + 30
      tags), confirmed genuinely cold (0 edge-cache hits in the sample); result compared against
      the owner-agreed ~300ms hot-window revisit threshold"
    verification:
      - kind: other
        ref: "150-request live sample against dev.915tldr.com, parsed from each response's
          Server-Timing header -> R2 p50=129ms/p95=215ms (n=150), KV p50=148ms/p95=188ms
          (n=120); 0/150 edge-cache hits confirming genuine cold reads"
        status: pass
    human_judgment: false
  - id: D5
    description: "Convergence and REND-11 precision reconciled as far as this session's
      available access allows: a direct read-only-then-corrective cross-check against the real
      R2 bucket (same tool/credentials the deploy itself uses) confirms a converged, zero-backlog
      state; the Workers Builds build-log API access gap is disclosed, not silently worked around"
    verification:
      - kind: other
        ref: "node tools/archive-sync.mjs (read-only index inspection, then pre/post) against the
          real 915tldr-archive bucket -> 30,475/30,478 already synced immediately post-deploy, 22
          changed tag pages re-synced cleanly (uploaded:22 failed:0 deferred:0), backlog 0 after;
          Cloudflare Workers Builds API calls returned 403/12004 on both available tokens"
        status: pass
    human_judgment: true
    rationale: "The literal production build's own ARCHIVE_SYNC_RESULT log lines could not be
      independently re-obtained (API permission gap); this deliverable rests on a cross-check via
      the same tool against the same bucket, which is strong corroborating evidence but not the
      original build's own log output. An owner/human should confirm the Workers Builds dashboard
      shows no backlog/failure alert from the real build before treating REND-11 as fully closed."

duration: ~90min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 9: First Production Archive Deploy Summary

**The archive tier is confirmed live on dev.915tldr.com's real production host — a real, non-dry-run Workers Builds deploy (merge to main, commit `57dfa94`) now serves archived articles/tags from R2 with cold-read latency (R2 p95=215ms, KV p95=188ms) comfortably under the hot-window revisit threshold, while a Cloudflare API permission gap blocked pulling the real build's own archive-sync log lines — disclosed rather than papered over.**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-10-01T15:35:00Z (approx. — immediately after context/plan read, continuing
  from two owner-resolved checkpoints)
- **Completed:** 2026-10-01T17:05:00Z
- **Tasks:** 3 (Task 1 owner checkpoint — resolved before this session; Task 2 owner action —
  resolved before this session; Task 3 tracer — executed this session)
- **Files modified:** 1 (plus 2 changelog files)

## Accomplishments

- **Confirmed the real production deploy live**, independently of the orchestrator's reported
  Workers Builds metadata: `/version.json` (`commit: 57dfa94`, `builtAt:
  2026-10-01T15:17:12.920Z`) and `/static-budget.json` (`staticFileCount: 29966`, `status: "ok"`,
  `hotWindow.provisional: false`, `days: 202`) both matched the reported build exactly, as did
  `wrangler deployments list` and the Workers Versions API (version `5d03fe4d`, deployed
  `15:23:04.491Z` — the second the build finished).
- **Proved the archive tier's live routing contract end to end** on fresh, never-before-requested
  URLs: 2 archived articles and 2 archived tags returned 200 with `Server-Timing:
  archive;desc=r2` (articles carrying both `kv;dur` and `r2;dur`; tags carrying only `r2;dur`,
  matching the documented no-KV-read-for-tags contract); a repeat `GET` served
  `archive;desc=edge-cache` with `cf-cache-status: HIT`; a hot article carried no archive
  `Server-Timing` metric at all (the Worker is never invoked for a static hit). Also disclosed:
  `HEAD` requests never populate or match the manual edge cache — only `GET` does; correctness is
  unaffected, only the cache-hit optimization is GET-only.
- **`pnpm run verify:edge` passes 4/4** against the real live edge.
- **Measured cold R2/KV latency for the owner-agreed hot-window revisit trigger**: 150 distinct
  archive-tier URLs (120 articles + 30 tags), each requested exactly once, confirmed genuinely
  cold by 0 edge-cache hits across the whole sample. R2 `get()`: p50=129ms, p95=**215ms**
  (n=150). KV manifest read (articles only — tags never read KV): p50=148ms, p95=**188ms**
  (n=120). Both sit comfortably under the ~300ms threshold 05-05's owner decision named as the
  trigger to revisit the 202-day hot window → **no action, window stays as-is.**
- **Cross-checked convergence and REND-11 precision directly against the real R2 bucket**, after
  the Cloudflare Workers Builds build-log API returned `403 Forbidden` (error `12004`) for both
  configured tokens (`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`) — matching the checkpoint's own
  disclosed "needs re-auth" note. Using the project's own `tools/archive-sync.mjs` against the
  same production bucket with the same real credentials the deploy itself uses: immediately
  post-deploy the index held 30,475 of this session's local (hours-stale) 30,478-entry plan; a
  `post` run re-synced the 22 changed tag pages cleanly (`uploaded: 22, failed: 0, deferred: 0`,
  backlog cleared). 3 "new" tag uploads could not be confirmed locally (their rendered HTML isn't
  in this machine's stale `dist/archive`), but production's own live tag count (17,582) already
  exceeds this session's local snapshot (17,566) — local staleness, not a production gap.
- **Filled `docs/phase-05/archive-architecture.md`'s "First production archive deploy"
  measurements** with the `ARCHIVE_TIER_LIVE` verdict line, every number above, the route
  decision and its consequence, and the disclosed API-access gap.

## Task Commits

1. **Tasks 1-2 (owner checkpoint + owner action):** resolved before this session began — no
   commits from this agent (merge/push were the owner's own act, per project rule).
2. **Task 3 (tracer):** `f9f3e0d` (docs) — `docs/phase-05/archive-architecture.md`,
   `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md`,
   `changelog/README.md`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `docs/phase-05/archive-architecture.md` - "First production archive deploy" measurements
  subsection filled: route decision, deploy timing, live header checks, cold R2/KV latency table
  and verdict, convergence cross-check, REND-11 reconciliation, disclosed API-access gap
  (modified)
- `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md` - dev changelog
  entry for this plan's work (created)
- `changelog/README.md` - index entry added (modified)

## Decisions Made

- Owner selected **option-a** (merge to main) at Task 1, 2026-10-01 ~09:07 MDT — the archive tier
  now serves persistently rather than racing a 2-hourly rebuild; 05-10/05-12 inherit a stable
  host.
- **REND-07 marked Complete** in REQUIREMENTS.md — proven on the real production deploy.
- **REND-11 left Pending** — the must_haves' own bar (reconcile the gate count against wrangler's
  real build-log total) was only partially met: the structural argument and 05-08's prior
  empirical match are documented, but the literal real-build wrangler log line could not be
  re-obtained this session (API permission gap). Marking it complete on a partial reconciliation
  would contradict this phase's own established "don't round up" discipline.
- A direct cross-check against the live R2 bucket (same tool, same credentials as the real
  deploy) was used in place of the inaccessible build log, and disclosed as such rather than
  presented as the original build's own output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cloudflare Workers Builds API inaccessible for the planned build-log
observation**
- **Found during:** Task 3, attempting `workers_builds_list_builds`-equivalent REST calls
- **Issue:** `GET /accounts/{id}/builds/workers/{tag}/builds` returned `403 Forbidden` (error
  `12004`) for both `CLOUDFLARE_API_TOKEN` and `CF_API_TOKEN` — matches the checkpoint context's
  own disclosed "the Cloudflare builds MCP needs re-auth" note; this is a known, pre-existing
  credential-scope gap, not something introduced by this plan.
- **Fix:** Used the accessible Workers Versions/Deployments API (`wrangler deployments list`,
  the versions endpoint) to independently confirm the deploy's existence and exact timing, and
  cross-checked convergence/reconciliation directly against the real R2 bucket using the
  project's own sync tool and credentials (not a build-log substitute presented as the original).
- **Files modified:** none (read-only + idempotent sync-tool reruns against the real bucket;
  no code change)
- **Verification:** Live HTTP checks and the direct-bucket cross-check both independently
  corroborate a healthy, converged deploy; disclosed the gap explicitly in the architecture doc
  rather than hiding it.
- **Committed in:** `f9f3e0d` (documents the gap directly)

**2. [Rule 1 - Bug] Own throwaway latency-measurement script's Server-Timing parser was wrong**
- **Found during:** Task 3's own cold-latency sampling, first two runs
- **Issue:** A regex `([a-z]+)` for the Server-Timing metric name didn't allow digits, so `r2`
  parsed as `r` with the rest of the segment unmatched — all `r2;dur`/`archive;desc=r2` values
  silently dropped, reporting 0 samples.
- **Fix:** Widened the name-capture character class to `[a-z0-9]+`; filtered on the correctly
  parsed `r2Dur`/`kvDur` presence instead of the truncated `archiveDesc` value afterward.
- **Files modified:** scratch script only (`/tmp/.../measure-archive-latency.mjs`, not part of
  the repo)
- **Verification:** Re-ran the 150-request sample; all 150 parsed correctly with non-null
  R2/KV durations.
- **Committed in:** N/A (scratch file, not committed)

**3. [Rule 1 - Bug] Stale local `.astro/ci-build-started-at` marker produced a false backlog
reading**
- **Found during:** Task 3's convergence cross-check
- **Issue:** A local `archive-sync post --json` run reported `deferred: 22` with a fresh
  `backlogSince` — but the deadline math (840s/1020s) is measured from
  `.astro/ci-build-started-at`, which was 7.9 hours stale (from an earlier same-day local build),
  so the deadline had already elapsed before the run even started, immediately deferring
  everything.
- **Fix:** Regenerated the marker with the current timestamp before rerunning `pre`/`post`,
  which then completed real work (`uploaded: 22, failed: 0, deferred: 0`).
- **Files modified:** `.astro/ci-build-started-at` (gitignored, not part of the repo)
- **Verification:** Rerun with a fresh marker produced a real, non-deadline-skewed result,
  confirmed against a direct read-only index inspection before and after.
- **Committed in:** N/A (gitignored local file)

---

**Total deviations:** 3 (1 Rule 3 blocking — a genuine access-permission gap worked around and
disclosed, not silently papered over; 2 Rule 1 bugs — both in this session's own throwaway
tooling/local state, not in any committed repo code).
**Impact on plan:** None of the three affected the plan's committed deliverable. The
build-log-API gap is now a named, documented follow-up (re-grant the token's Workers Builds
scope before 05-10/05-12); the other two were measurement-tooling bugs caught and corrected
before any number was recorded.

## Issues Encountered

None beyond the three disclosed deviations above.

## User Setup Required

**One action recommended before 05-10/05-12, not blocking this plan's completion:** re-grant the
Cloudflare API token's Workers Builds read scope (Workers Builds Configuration: Read, or
equivalent) if the literal per-build `ARCHIVE_SYNC_RESULT`/wrangler asset-count log lines are
needed for those plans' own measurements. This plan's own conclusions do not depend on it — all
load-bearing evidence came from live HTTP checks and a direct cross-check against the real R2
bucket.

## Next Phase Readiness

- The archive tier is live, correctly routing, and measured on the real production host — 05-10
  (forced full re-upload) and 05-12 (the final zero-D1-reads gate) can now run against a stable,
  persistently-serving deploy rather than racing a 2-hourly rebuild.
- The 202-day hot window stays as decided in 05-05 — this plan's own revisit-trigger measurement
  (cold p95 215ms R2 / 188ms KV, both under ~300ms) confirms no change is needed.
- **Follow-up, not blocking:** re-grant the Cloudflare API token's Workers Builds read scope
  before 05-10/05-12 if those plans need the literal per-build archive-sync log output; until
  then, live HTTP checks and direct-bucket cross-checks (as used here) remain available as a
  fallback.
- REND-11 remains Pending — see "Decisions Made" above for why it was not marked complete on a
  partial reconciliation.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

`docs/phase-05/archive-architecture.md` confirmed present on disk with the `ARCHIVE_TIER_LIVE`
line (`grep -c` → 1). Commit `f9f3e0d` confirmed present in `git log --oneline --all`.

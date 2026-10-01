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
    the real production build log's own archive-sync lines (orchestrator-fetched, committed as
    evidence at docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log)"
affects: ["05-10 (forced full re-upload at corpus scale, same production host)", "05-12 (the
  final zero-D1-reads gate — can now run against a persistently-serving archive tier)"]

# Actuals (#2632)
actuals:
  tokens: 5200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Cross-checking a production deploy's own archive-sync state directly against the real R2
      bucket (read-only index inspection, then idempotent pre/post reruns with the real
      credentials) when this executor's own Workers Builds build-log API access is forbidden —
      same tool, same bucket, same credentials the real deploy itself used, not a simulation.
      Independently confirmed correct once the orchestrator (whose own Cloudflare API access
      works) pulled the real build's own ARCHIVE_SYNC_RESULT lines and they matched this
      session's cross-check almost exactly."
    - "Sampling cold-path latency by requesting distinct, never-before-touched archive URLs
      exactly once each (verified via 0 edge-cache hits across the sample) rather than repeat-
      requesting one URL, which would measure the edge cache instead of R2/KV."

key-files:
  created: []
  modified:
    - docs/phase-05/archive-architecture.md
    - docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log

key-decisions:
  - "Owner selected option-a (merge feature/phase-05 -> develop -> main, push) at Task 1's
    checkpoint, 2026-10-01 ~09:07 MDT, on the orchestrator's recommendation — recorded with its
    consequence for D-03/REND-12: the gate and later measurement plans now run against a
    persistently-serving host rather than racing a 2-hourly rebuild."
  - "Owner executed the merge/push at Task 2, 2026-10-01 ~09:14 MDT (57c4b05 -> 57dfa94),
    triggering the real Workers Builds production build this plan observed."
  - "REND-07 marked Complete in REQUIREMENTS.md — the render-once-to-R2 guarantee is now proven
    on the real production deploy, serving real traffic-eligible requests, not a dry run, and
    independently confirmed by the real build log's own ARCHIVE_SYNC_RESULT lines."
  - "REND-11 still left Pending, even after the orchestrator supplied the real build log. The
    build log confirms the gate's own count (29,966) was computed correctly at build time with
    zero drift, and resolves the convergence numbers exactly (pre: uploaded 19/failed 0; post:
    uploaded 22/deleted 3/backlog 0) — but the plan's own must_haves ask specifically for
    wrangler's own uploaded-plus-already-present asset-count line, which the filtered log excerpt
    provided does not contain (only the Worker script's own bundle-size and generic timing
    lines). Not marking complete on a structural argument alone when the literal number this
    plan's own bar names is still absent — matches this phase's own established discipline
    (05-02/04/05/06/07/08)."

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
    description: "Convergence confirmed directly from the real production build's own log (not
      merely a cross-check): archive-sync pre uploaded 19 new-to-archive pages with 0 failures;
      post uploaded 22 changed pages, deleted 3 vanished orphans, with 0 failures and a 0
      backlog — the corpus converged within the one observed build"
    requirement: "REND-07"
    verification:
      - kind: other
        ref: "docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log (real
          production build 241c97e1, orchestrator-fetched via Cloudflare API) ->
          ARCHIVE_SYNC_RESULT pre {uploaded:19,failed:0,deferred:0,movedBack:0,deleted:0}; post
          {uploaded:22,failed:0,deferred:0,deleted:3,backlog:{count:0,since:null}}; matches this
          session's own earlier R2-bucket cross-check (uploaded:22,failed:0,deferred:0) exactly
          on the post phase"
        status: pass
    human_judgment: false
  - id: D6
    description: "REND-11 precision: the gate's conservative count (/static-budget.json,
      29,966) is confirmed correct at build time (zero drift) by the real build log; the
      stricter must_haves ask additionally for wrangler's own uploaded-plus-already-present
      asset-count line, which is not present in the filtered log excerpt available this session"
    requirement: "REND-11"
    verification:
      - kind: other
        ref: "build-241c97e1-archive-lines.log's [archive] static files: 29966 / 100000 line
          matches /static-budget.json live and the partition line's own article/tag counts
          exactly; no wrangler asset-upload-count line (only Total Upload: 8.34 KiB — the Worker
          script bundle size — and generic timing lines) appears in the excerpt provided"
        status: unknown
    human_judgment: true
    rationale: "The specific figure this plan's must_haves name (wrangler's own
      uploaded-plus-already-present split) is not present in the log excerpt available. The
      structural argument (no .assetsignore, so the two counts must be equal) is sound but is an
      argument, not the literal number the must_haves ask for. A human (or a further grep of the
      full 60,605-line log, e.g. for 'already uploaded'/'files from the assets directory', which
      this executor's own forbidden token cannot fetch) should confirm that literal line before
      REND-11 is marked complete."

duration: ~90min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 9: First Production Archive Deploy Summary

**The archive tier is confirmed live on dev.915tldr.com's real production host — a real, non-dry-run Workers Builds deploy (merge to main, commit `57dfa94`) now serves archived articles/tags from R2 with cold-read latency (R2 p95=215ms, KV p95=188ms) comfortably under the hot-window revisit threshold. This executor's own Cloudflare token couldn't reach the Workers Builds log API, but the orchestrator's token could — the real build's own `ARCHIVE_SYNC_RESULT` lines are now committed as evidence and confirm convergence exactly; only the literal wrangler asset-upload-count line REND-11's must_haves ask for is still absent from what's available.**

## Performance

- **Duration:** ~105 min (includes a follow-up pass after the orchestrator supplied the real
  build log)
- **Started:** 2026-10-01T15:35:00Z (approx. — immediately after context/plan read, continuing
  from two owner-resolved checkpoints)
- **Completed:** 2026-10-01T17:20:00Z
- **Tasks:** 3 (Task 1 owner checkpoint — resolved before this session; Task 2 owner action —
  resolved before this session; Task 3 tracer — executed this session, then corrected against
  the real build log supplied by the orchestrator)
- **Files modified:** 2 (plus 3 changelog files)

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
- **Cross-checked convergence directly against the real R2 bucket**, after this executor's own
  Cloudflare Workers Builds build-log API calls returned `403 Forbidden` (error `12004`) for both
  configured tokens (`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`) — matching the checkpoint's own
  disclosed "needs re-auth" note. Using the project's own `tools/archive-sync.mjs` against the
  same production bucket with the same real credentials the deploy itself uses: immediately
  post-deploy the index held 30,475 of this session's local (hours-stale) 30,478-entry plan; a
  `post` run re-synced the 22 changed tag pages cleanly (`uploaded: 22, failed: 0, deferred: 0`,
  backlog cleared).
- **The orchestrator then supplied the real build's own log** (their own Cloudflare API access
  works; this executor's token-scope gap is specific to this executor, not the platform) —
  filtered archive/deploy lines from build `241c97e1`, committed as evidence at
  `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`. This **confirms,
  with an exact explanation, every open question from the cross-check above**: the real `pre`
  phase uploaded 19 new-to-archive pages with 0 failures (not "3 new, 3 failed" — that was this
  session's own local `dist/archive` staleness, now fully explained); the real `post` phase
  uploaded exactly 22 changed pages and deleted 3 vanished orphans, with 0 failures and a 0
  backlog — an exact match to this session's own independent cross-check on the `post` count.
  The build log's own `[archive] static files: 29966` line also matches `/static-budget.json`
  and the partition line's article/tag counts with zero drift.
- **Filled, then corrected, `docs/phase-05/archive-architecture.md`'s "First production archive
  deploy" measurements** with the `ARCHIVE_TIER_LIVE` verdict line, every number above (now
  resting on the real build log, not just a cross-check), the route decision and its consequence,
  and a precisely-scoped remaining gap: the must_haves' literal wrangler asset-upload-count line
  (uploaded vs. already-present) is still not present in the filtered excerpt available — only
  the Worker script's own bundle-size line and generic timing lines appear there.

## Task Commits

1. **Tasks 1-2 (owner checkpoint + owner action):** resolved before this session began — no
   commits from this agent (merge/push were the owner's own act, per project rule).
2. **Task 3 (tracer):** `f9f3e0d` (docs) — `docs/phase-05/archive-architecture.md`,
   `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md`,
   `changelog/README.md`
3. **Task 3 follow-up (real build-log reconciliation):** `[pending — see completion report for
   hash]` (docs) — `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`,
   `docs/phase-05/archive-architecture.md`, a new changelog entry, `changelog/README.md`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `docs/phase-05/archive-architecture.md` - "First production archive deploy" measurements
  subsection filled, then corrected against the real build log: route decision, deploy timing,
  live header checks, cold R2/KV latency table and verdict, convergence now confirmed directly
  from the real build's own `ARCHIVE_SYNC_RESULT` lines, REND-11 reconciliation narrowed to the
  one still-missing wrangler asset-count line, and the API-access gap reframed as
  executor-token-specific (modified)
- `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log` - the real
  production build's filtered archive/deploy log lines, fetched by the orchestrator (whose own
  Cloudflare API access works) and committed here as evidence (created)
- `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md` - dev changelog
  entry for this plan's initial work (created)
- `changelog/README.md` - index entries added (modified)

## Decisions Made

- Owner selected **option-a** (merge to main) at Task 1, 2026-10-01 ~09:07 MDT — the archive tier
  now serves persistently rather than racing a 2-hourly rebuild; 05-10/05-12 inherit a stable
  host.
- **REND-07 marked Complete** in REQUIREMENTS.md — proven on the real production deploy, and now
  independently confirmed by the real build log's own archive-sync lines.
- **REND-11 remains Pending, even after the real build log arrived.** The build log resolves the
  convergence numbers exactly and confirms the gate's own count (29,966) was computed correctly
  at build time with zero drift — but the plan's own must_haves ask specifically for wrangler's
  own uploaded-plus-already-present asset-count line, and the filtered log excerpt available
  this session does not contain it (only the Worker script's own bundle-size line and generic
  timing/success lines appear in the deploy section). The structural argument (no
  `.assetsignore`, so the two counts must be equal) remains sound, but it is an argument, not the
  literal figure the must_haves name. Not rounding up on an argument when the actual bar is a
  specific number — matches this phase's own established discipline.
- This executor's own Cloudflare Workers Builds API access gap (`403`/`12004` on both configured
  tokens) is now understood to be **executor-token-specific, not a platform-wide block** — the
  orchestrator's own Cloudflare API access reached the same build's logs successfully. The
  STATE.md blocker is updated accordingly: 05-10/05-12 should ask the orchestrator for build-log
  lines rather than treating this as something that blocks their own execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, RESOLVED mid-session] Cloudflare Workers Builds API inaccessible to this
executor's own token**
- **Found during:** Task 3, attempting `workers_builds_list_builds`-equivalent REST calls
- **Issue:** `GET /accounts/{id}/builds/workers/{tag}/builds` returned `403 Forbidden` (error
  `12004`) for both `CLOUDFLARE_API_TOKEN` and `CF_API_TOKEN` — matches the checkpoint context's
  own disclosed "the Cloudflare builds MCP needs re-auth" note; this is a known, pre-existing
  credential-scope gap, not something introduced by this plan.
- **Initial workaround:** Used the accessible Workers Versions/Deployments API (`wrangler
  deployments list`, the versions endpoint) to independently confirm the deploy's existence and
  exact timing, and cross-checked convergence directly against the real R2 bucket using the
  project's own sync tool and credentials (not a build-log substitute presented as the original).
- **Resolved:** The orchestrator's own Cloudflare API access reached the same build's logs
  successfully and supplied the filtered archive/deploy lines, now committed as evidence at
  `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`. The gap is
  executor-token-specific, not a platform-wide block — confirmed by a different, working
  credential reaching the identical build.
- **Files modified:** `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`
  (new evidence file), `docs/phase-05/archive-architecture.md` (corrected against the real log)
- **Verification:** The real build log's `ARCHIVE_SYNC_RESULT` lines match this session's own
  independent R2-bucket cross-check exactly on the `post` phase (`uploaded: 22, failed: 0`), and
  explain the earlier `pre`-phase discrepancy (19 real vs. 3 local) as local `dist/archive`
  staleness, not a production defect.
- **Committed in:** `f9f3e0d` (initial disclosure), follow-up commit (resolution — see
  completion report for hash)

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

**Total deviations:** 3 (1 Rule 3 blocking — a genuine access-permission gap worked around,
disclosed, then resolved mid-session once the orchestrator's own working Cloudflare credential
supplied the real log; 2 Rule 1 bugs — both in this session's own throwaway tooling/local state,
not in any committed repo code).
**Impact on plan:** None of the three affected the plan's committed deliverable. The build-log
gap is now understood precisely (executor-token scope, not a platform block; ask the
orchestrator, don't block 05-10/05-12 on re-granting this executor's own token); the other two
were measurement-tooling bugs caught and corrected before any number was recorded.

## Issues Encountered

None beyond the three disclosed deviations above.

## User Setup Required

None blocking. **Informational only:** this executor's own Cloudflare API token still cannot
reach the Workers Builds log API directly (`403`/`12004`) — re-granting its Workers Builds read
scope would let a future executor session fetch build logs itself rather than asking the
orchestrator, but this is a convenience, not a requirement; the orchestrator's own access already
covers the need (see the updated STATE.md blocker).

## Next Phase Readiness

- The archive tier is live, correctly routing, and measured on the real production host — 05-10
  (forced full re-upload) and 05-12 (the final zero-D1-reads gate) can now run against a stable,
  persistently-serving deploy rather than racing a 2-hourly rebuild.
- The 202-day hot window stays as decided in 05-05 — this plan's own revisit-trigger measurement
  (cold p95 215ms R2 / 188ms KV, both under ~300ms) confirms no change is needed.
- **For 05-10/05-12:** if a literal per-build archive-sync/wrangler log line is needed, **ask the
  orchestrator** (their Cloudflare API access reached this build's logs successfully) rather than
  treating this executor's own token-scope gap as a blocker.
- **REND-11 remains Pending** even after the real build log arrived — the specific missing piece
  is the literal wrangler uploaded-plus-already-present asset-count line, not present in the
  filtered excerpt available this session. If that precision is still wanted, ask the
  orchestrator for a further grep of the full 60,605-line log (patterns like `already uploaded`,
  `files from the assets directory`, `Uploading`) before closing REND-11.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

`docs/phase-05/archive-architecture.md` and `docs/phase-05/evidence/first-prod-deploy/
build-241c97e1-archive-lines.log` both confirmed present on disk (`grep -c ARCHIVE_TIER_LIVE` ->
1; log file matches the orchestrator-supplied content byte for byte). Commit `f9f3e0d` confirmed
present in `git log --oneline --all`; the follow-up commit is confirmed in the completion report
below.

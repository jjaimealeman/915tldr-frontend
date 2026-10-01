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
    the real production build log's own archive-sync AND wrangler asset-count lines
    (orchestrator-fetched, committed as evidence under docs/phase-05/evidence/first-prod-deploy/),
    with REND-11's three-way count mismatch (gate vs wrangler's console line vs wrangler's own
    upload accounting) reconciled file by file"
affects: ["05-10 (forced full re-upload at corpus scale, same production host)", "05-12 (the
  final zero-D1-reads gate — can now run against a persistently-serving archive tier)"]

# Actuals (#2632)
actuals:
  tokens: 6600
  tasks: 3
  commits: 6

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
    - "Reconciling a real three-way count mismatch by reproducing wrangler's own CLI behavior
      locally (WRANGLER_LOG=debug against a real --dry-run) and classifying each printed path
      against the filesystem (file vs. directory) rather than accepting the mismatch as an
      unexplained drift — found the discrepancy was in wrangler's own console message
      (counting directories, not a real under-count), not in this project's gate."

key-files:
  created: []
  modified:
    - docs/phase-05/archive-architecture.md
    - docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log
    - docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log
    - docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md
    - tools/assert-file-count.mjs

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
  - "REND-11 marked Complete in REQUIREMENTS.md, on the third pass. The real build log's wrangler
    window exposed a genuine three-way count mismatch (gate 29,966 vs wrangler's own console line
    29,978 vs wrangler's own upload accounting 29,962) that needed explaining, not assuming.
    Reconciled file by file: the 12-file gap is wrangler's own `Read N files` console line
    counting top-level directories alongside real files (reproduced locally — same 12-directory
    gap appeared against a local dry run, and the 12 extras were confirmed-as-directories by
    name: _astro, business, community, crime, education, fonts, health, politics, source,
    sports, tag, weather); the 4-file gap is four root control files the gate correctly counts
    but wrangler correctly never serves (.assetsignore, _headers, _redirects, wrangler.json — all
    confirmed present on disk). 29,966 - 4 = 29,962 exactly. No code fix was needed —
    assert-file-count.mjs's conservative-superset design was already correct; a doc comment was
    added pointing at the reconciliation evidence so this isn't reopened from scratch."

requirements-completed: ["REND-07", "REND-11"]

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
    description: "REND-11 precision: the gate's conservative count (/static-budget.json, 29,966)
      compared against wrangler's own uploaded-plus-already-present asset total (29,962) from the
      real build log, with the full three-way mismatch (gate vs. wrangler's console line vs.
      wrangler's upload accounting) explained file by file — over, never under"
    requirement: "REND-11"
    verification:
      - kind: other
        ref: "build-241c97e1-wrangler-window.log's real lines: 'Read 29978 files...', 'Found 2
          new or modified...', 'Success! Uploaded 2 files (29960 already uploaded)'; reconciled
          against a local WRANGLER_LOG=debug dry run that reproduced the identical 12-directory
          gap and named all 12 (_astro, business, community, crime, education, fonts, health,
          politics, source, sports, tag, weather) and all 4 control files
          (.assetsignore, _headers, _redirects, wrangler.json) confirmed present on disk;
          29,966 - 4 = 29,962 exactly. Full working: docs/phase-05/evidence/first-prod-deploy/
          rend-11-reconciliation.md. node --test tests/unit/file-count.test.mjs -> 14/14 pass
          (doc-comment-only change, no behavior change)"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 9: First Production Archive Deploy Summary

**The archive tier is confirmed live on dev.915tldr.com's real production host — a real, non-dry-run Workers Builds deploy (merge to main, commit `57dfa94`) now serves archived articles/tags from R2 with cold-read latency (R2 p95=215ms, KV p95=188ms) comfortably under the hot-window revisit threshold. This executor's own Cloudflare token couldn't reach the Workers Builds log API, but the orchestrator's token could — the real build log fully reconciles REND-11's three-way file-count mismatch (gate 29,966 vs. wrangler's own console line 29,978 vs. wrangler's own upload accounting 29,962), named file by file: 12 top-level directories wrangler's log message double-counts, and 4 root control files the gate correctly counts but wrangler correctly never serves. REND-07 and REND-11 are both marked Complete.**

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
- **The orchestrator then supplied a second log window** — the unfiltered span between
  `ARCHIVE_SYNC_RESULT(pre)` and `Current Version ID`, committed as evidence at
  `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log` — which contains
  the exact line the must_haves asked for: `✨ Read 29978 files from the assets directory`,
  `🌀 Found 2 new or modified static assets`, `✨ Success! Uploaded 2 files (29960 already
  uploaded)`. This produced a genuine three-way mismatch (gate `29,966` vs. wrangler's console
  line `29,978` vs. wrangler's own upload accounting `29,962`) that needed real reconciliation,
  not an assumption.
- **Reconciled both gaps file by file, reproducing wrangler's own behavior locally** (`pnpm exec
  wrangler deploy --dry-run --config wrangler.jsonc --outdir .wrangler/ci-dry-run` with
  `WRANGLER_LOG=debug`, then classifying every printed path against the real filesystem):
  the 12-file gap (`29,978 - 29,966`) is wrangler's own `Read N files` console line counting
  12 top-level **directories** alongside real files (`_astro`, `business`, `community`, `crime`,
  `education`, `fonts`, `health`, `politics`, `source`, `sports`, `tag`, `weather` — confirmed
  real directories, not a code bug, reproduced with the identical gap size locally); the 4-file
  gap (`29,966 - 29,962`) is four root control files the gate correctly counts but wrangler
  correctly never serves (`.assetsignore`, `_headers`, `_redirects`, `wrangler.json` — all
  confirmed present on disk, the last explicitly excluded by `.assetsignore`'s own ignore
  lines). `29,966 - 4 = 29,962` exactly. Full working committed at
  `docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md`.
- **Added a doc comment to `tools/assert-file-count.mjs`** pointing future readers at this
  reconciliation — no logic change (confirmed by `node --test tests/unit/file-count.test.mjs`,
  14/14 still pass) — and **marked REND-11 Complete** in `.planning/REQUIREMENTS.md`: the gate's
  count is over wrangler's real served-asset total by exactly 4, every one named, never under —
  precisely the shape the must_haves require.
- **Filled, then corrected twice, `docs/phase-05/archive-architecture.md`'s "First production
  archive deploy" measurements** with the `ARCHIVE_TIER_LIVE` verdict line and every number
  above, now fully resting on the real build log rather than a cross-check or a partial
  reconciliation.

## Task Commits

1. **Tasks 1-2 (owner checkpoint + owner action):** resolved before this session began — no
   commits from this agent (merge/push were the owner's own act, per project rule).
2. **Task 3 (tracer):** `f9f3e0d` (docs) — `docs/phase-05/archive-architecture.md`,
   `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md`,
   `changelog/README.md`
3. **Task 3 follow-up #1 (real archive-sync build-log reconciliation):** `941602f` (docs) —
   `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`,
   `docs/phase-05/archive-architecture.md`, `.planning/STATE.md`, a new changelog entry,
   `changelog/README.md` (this SUMMARY itself was also corrected in this commit)
4. **Task 3 follow-up #2 (self-reference hash fix):** `239f775` (docs) — this SUMMARY only
5. **Task 3 follow-up #3 (REND-11 wrangler asset-count reconciliation):** `[this commit — see
   completion report for hash]` (docs) — `docs/phase-05/evidence/first-prod-deploy/
   build-241c97e1-wrangler-window.log`, `docs/phase-05/evidence/first-prod-deploy/
   rend-11-reconciliation.md`, `tools/assert-file-count.mjs` (doc comment only),
   `docs/phase-05/archive-architecture.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`,
   a new changelog entry, `changelog/README.md`, this SUMMARY

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `docs/phase-05/archive-architecture.md` - "First production archive deploy" measurements
  subsection filled, then corrected twice against the real build log: route decision, deploy
  timing, live header checks, cold R2/KV latency table and verdict, convergence confirmed
  directly from the real build's own `ARCHIVE_SYNC_RESULT` lines, REND-11's three-way
  file-count mismatch fully reconciled, and the API-access gap reframed as
  executor-token-specific (modified)
- `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log` - the real
  production build's filtered archive/deploy log lines, fetched by the orchestrator (created)
- `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log` - the real
  production build's unfiltered wrangler deploy window, fetched by the orchestrator, containing
  the literal asset-upload-count line the must_haves required (created)
- `docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md` - this session's own
  file-by-file reconciliation of the three-way count mismatch, with the local reproduction
  method and the named directory/control-file lists (created)
- `tools/assert-file-count.mjs` - doc comment pointing at the reconciliation evidence; no logic
  change (modified)
- `changelog/2026-10-01-0953_05-09-first-production-archive-deploy-measured.md` - dev changelog
  entry for this plan's initial work (created)
- `changelog/README.md` - index entries added (modified)

## Decisions Made

- Owner selected **option-a** (merge to main) at Task 1, 2026-10-01 ~09:07 MDT — the archive tier
  now serves persistently rather than racing a 2-hourly rebuild; 05-10/05-12 inherit a stable
  host.
- **REND-07 marked Complete** in REQUIREMENTS.md — proven on the real production deploy, and now
  independently confirmed by the real build log's own archive-sync lines.
- **REND-11 marked Complete** in REQUIREMENTS.md, on the third pass, once the orchestrator
  supplied the wrangler deploy log window containing the literal asset-upload-count line. The
  resulting three-way mismatch (gate `29,966` vs. wrangler's console line `29,978` vs. wrangler's
  own upload accounting `29,962`) was reconciled file by file rather than accepted or dismissed:
  the 12-file gap is wrangler's own `Read N files` message counting top-level directories
  alongside files (reproduced locally with the identical gap size, all 12 confirmed as real
  directories by name); the 4-file gap is four root control files the gate correctly counts but
  wrangler correctly never serves (`.assetsignore`, `_headers`, `_redirects`, `wrangler.json`,
  all confirmed present on disk). `29,966 - 4 = 29,962` exactly — the gate is over, never under,
  with every file named, exactly the must_haves' own bar. No code fix was warranted;
  `assert-file-count.mjs` was already correct.
- This executor's own Cloudflare Workers Builds API access gap (`403`/`12004` on both configured
  tokens) is understood to be **executor-token-specific, not a platform-wide block** — the
  orchestrator's own Cloudflare API access reached the same build's logs successfully, twice.
  The STATE.md blocker is updated accordingly: 05-10/05-12 should ask the orchestrator for
  build-log lines rather than treating this as something that blocks their own execution.

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
- **Committed in:** `f9f3e0d` (initial disclosure), `941602f` (resolution against the real
  build log)

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

**4. [Rule 1 - investigated, no bug found] Real three-way static-file-count mismatch**
- **Found during:** Task 3's REND-11 reconciliation, once the orchestrator supplied the
  wrangler deploy log window
- **Issue:** The real build log exposed `assert-file-count.mjs`'s gate count (`29,966`)
  disagreeing with BOTH wrangler's own `✨ Read N files` console line (`29,978`) AND wrangler's
  own upload-accounting total (`2 + 29,960 = 29,962`) — a real, unexplained discrepancy that
  could have meant the gate was under-counting (a correctness bug against its own documented
  "never under-count" contract).
- **Investigation:** Reproduced wrangler's own behavior locally (`WRANGLER_LOG=debug` against a
  real `--dry-run`) and classified every path its debug output printed against the real
  filesystem. Found the gate was not under-counting at all: wrangler's `Read N files` line
  counts 12 top-level **directories** alongside real files (a cosmetic quirk in wrangler's own
  console message, reproduced with the identical gap size locally), and the gate's count is
  legitimately 4 higher than wrangler's served-asset total because of 4 root control files
  (`.assetsignore`, `_headers`, `_redirects`, `wrangler.json`) the gate correctly counts but
  wrangler correctly never serves.
- **Fix:** None needed — `assert-file-count.mjs`'s `countStaticFiles()` was already correct. Added
  a doc comment explaining the reconciliation so a future session doesn't reopen this
  investigation from scratch.
- **Files modified:** `tools/assert-file-count.mjs` (doc comment only, no logic change — pinned
  by `node --test tests/unit/file-count.test.mjs`, still 14/14 pass),
  `docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md` (new),
  `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log` (new),
  `docs/phase-05/archive-architecture.md`
- **Verification:** `29,966 - 4 = 29,962` matches wrangler's own reported total exactly; the
  12-directory gap reproduced locally with the identical count and named directories.
- **Committed in:** `[this commit — see completion report for hash]`

---

**Total deviations:** 4 (1 Rule 3 blocking — a genuine access-permission gap worked around,
disclosed, then resolved mid-session once the orchestrator's own working Cloudflare credential
supplied the real log; 2 Rule 1 bugs in this session's own throwaway tooling/local state, not in
any committed repo code; 1 investigated discrepancy that turned out not to be a bug at all, fully
reconciled file by file).
**Impact on plan:** None of the four affected the plan's committed deliverable negatively — if
anything, the fourth closed REND-11 completely. The build-log-API gap is now understood precisely
(executor-token scope, not a platform block; ask the orchestrator, don't block 05-10/05-12 on
re-granting this executor's own token); the file-count "gap" turned out to be a misreading of
wrangler's own console output, not a defect; the other two were measurement-tooling bugs caught
and corrected before any number was recorded.

## Issues Encountered

None beyond the four disclosed deviations above.

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
  orchestrator** (their Cloudflare API access reached this build's logs successfully, twice)
  rather than treating this executor's own token-scope gap as a blocker.
- **REND-07 and REND-11 are both Complete.** REND-11's three-way file-count mismatch is fully
  reconciled file by file (`docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md`)
  and required no code change — `assert-file-count.mjs` was already correct.
- Phase 5's remaining open items are REND-12 (forced full re-render within CPU limits, 05-10's
  job) and the final zero-D1-reads gate (05-12).

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

`docs/phase-05/archive-architecture.md`, `docs/phase-05/evidence/first-prod-deploy/
build-241c97e1-archive-lines.log`, `docs/phase-05/evidence/first-prod-deploy/
build-241c97e1-wrangler-window.log`, and `docs/phase-05/evidence/first-prod-deploy/
rend-11-reconciliation.md` all confirmed present on disk (`grep -c ARCHIVE_TIER_LIVE` -> 1; log
files match the orchestrator-supplied content byte for byte). `node --test
tests/unit/file-count.test.mjs` confirmed 14/14 still passing after the doc-comment-only edit to
`tools/assert-file-count.mjs`. Commits `f9f3e0d`, `941602f`, and `239f775` confirmed present in
`git log --oneline --all`; this commit's own hash is confirmed in the completion report.

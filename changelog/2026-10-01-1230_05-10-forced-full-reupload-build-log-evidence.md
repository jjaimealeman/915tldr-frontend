# 2026-10-01 - Forced full archive re-upload observed on the real production platform

**Keywords:** [DOCUMENTATION] [DEPLOYMENT] [INFRA]
**Session:** Morning, Duration (~65 min, including a ~50-min wait for the production build)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1230_05-10-forced-full-reupload-build-log-evidence.md`

## What Changed

- File: `docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log`
  - New committed evidence: the real Workers Builds production build log (build
    `2a6f02f5-972e-4959-b2a4-e814090bb5a1`, trigger `deploy_hook`, 727.98s total wall time),
    fetched by the orchestrator via the Cloudflare Builds API since this executor's own
    Cloudflare token still returns `403 Forbidden`/`12004` against that API (re-tried live this
    session to confirm the gap, same as 05-09's disclosed finding). Contains the real
    `ARCHIVE_SYNC_RESULT(pre)`/`ARCHIVE_SYNC_RESULT(post)` lines for the forced full re-upload
    this plan (05-10) triggered: `post` uploaded 30,501 objects, 0 failed, 0 deferred, 0 backlog,
    in 558.2s (54.64 obj/s).

## Why

05-10-PLAN.md requires forcing the real production pipeline to re-upload every archived page
(via `tools/archive-sync.mjs request-full`) and measuring the real cost on the governing
platform (Workers Builds), not a local simulation. The marker was written at 17:17:49 UTC, well
before the plan's 17:55 UTC cutoff; the next ingest-triggered production build (detected live at
18:09:54 UTC, `hashSource: workers-ci`) consumed it. This executor's own Cloudflare API token
cannot reach the Workers Builds log API directly, so the orchestrator fetched the real log on
request and it is committed here as the evidence the REND-12 verdict (next commit) rests on.

## Issues Encountered

None in this commit's own scope — the build log itself shows a clean run (0 failed, 0 deferred).
The token-scope gap against the Workers Builds API is a pre-existing, disclosed condition
(05-09), re-confirmed live, not a new issue.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: live, read-only R2 cross-checks against the real `915tldr-archive` bucket
  before and after the forced build (index entry count, 3 sampled keys' sha256/size, the
  `_meta/force-full.json` marker, `_meta/archive-state.json`'s backlog fields) — all matched the
  real build log's own reported numbers (30,501 uploaded; convergence timestamp within 1.2s of
  the log's own `post` result line). Two never-recently-requested archived tag pages
  (`/tag/outlets`, `/tag/carrington-event`) were spot-checked live after convergence and both
  served 200 via a genuine R2 read, confirming the forced re-upload did not break serving.
- What wasn't tested: the Workers Builds log API itself from this executor's own token (confirmed
  still `403`/`12004`, not retested further this session).
- Edge cases: `/tag/raf` (a previously-cached page) was checked mid-re-upload and still answered
  200, confirming the no-404-window invariant held throughout the forced re-upload, not just at
  its endpoints.

## Next Steps

- [ ] Compute and record the REND-12 verdict from these numbers (next commit, same session).

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - adds one evidence log file; no code or application behavior changed.

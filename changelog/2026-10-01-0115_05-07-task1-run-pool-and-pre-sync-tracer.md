# 2026-10-01 - Deadline-aware task pool and the archive pre-sync tracer, proven live against R2

**Keywords:** [BACKEND] [INFRA] [FEATURE] [TESTING] [SECURITY]
**Session:** Early morning, Duration (~45 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0115_05-07-task1-run-pool-and-pre-sync-tracer.md`

## What Changed

- File: `tools/lib/run-pool.mjs`
  - New `runPool(items, { concurrency, deadlineAt, now, worker })` — a bounded-concurrency,
    deadline-aware task pool with per-item error isolation
  - Never exceeds `concurrency` in-flight workers; a worker that throws lands in `failed`
    without stopping the others; once `now() >= deadlineAt` no new item starts, already-started
    items finish, and everything untouched lands in `notStarted`
  - Deliberately not `p-limit` — `p-limit` has no deadline concept, and both of archive-sync's
    upload phases must stop launching new work at a fixed wall-clock deadline
- File: `tools/archive-sync.mjs` (new)
  - Pre-deploy phase (`runPreSync`): uploads pages new to the archive tier; anything that fails,
    times out at the deadline, or sits beyond `--limit` is moved back into `dist/client` before
    `wrangler deploy` runs, so a page not confirmed in R2 never leaves the static tier
  - Post-deploy phase (`runPostSync`) is also implemented in this same module (one cohesive
    file) — re-upload of changed pages, orphan deletion, backlog/force-full/daily-report
    bookkeeping — but is exercised by the next commit's test suite, not this one
  - `isR2WriteBlocked`/`wrapStoreForBranchGuard`: refuses every R2 write (`putObject`/
    `putJson`/`deleteObjects`) before any request is built whenever `WORKERS_CI` is set and
    `WORKERS_CI_BRANCH` is not `main` — defense-in-depth against the Workers Builds dashboard
    twice silently writing the R2 build secrets onto the non-production trigger as well as
    production (observed 2026-09-30)
  - `diffAgainstIndex`, `mergeWriteIndex`, `requestFullReupload`, and the CLI (`pre`/`post`/
    `request-full`, `--limit`/`--force-full`/`--json`)
- File: `tests/unit/run-pool.test.mjs` (new)
  - 8 tests pinning concurrency, failure isolation, deadline cutover, and input validation

## Why

Phase 5's archive tier needs a safe, on-time path to upload ~30,000 archive-tier pages to R2
without ever leaving a page in limbo between the static and archive tiers (REND-08's no-404-
window invariant) and without a build ever blowing past the Workers Builds 20-minute ceiling
(D-10/REND-12). `runPool` is the deadline-aware primitive both upload phases share; the pre-sync
phase is the first real caller, proven against the real bucket before the post phase (next
commit) builds on top of it.

## Issues Encountered

None in this module. One real test-authoring bug was found and fixed while writing the deadline
test for `runPool` itself: an initial version mutated a fake clock synchronously inside the
worker, which raced ahead of the second concurrent loop's own deadline check before that loop
ever claimed its item — rewritten to use a real wall-clock deadline with real timers instead of
a hand-mutated fake clock.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `runPool`'s three core guarantees (concurrency ceiling, per-item failure
  isolation, deadline cutover) plus edge cases (empty input, no deadline, invalid concurrency/
  missing worker)
- What wasn't tested here: `archive-sync.mjs`'s own behavior (pre/post phases, orphan deletion,
  backlog, force-full, daily report) — that's the next commit's `tests/unit/archive-sync.test.mjs`
- Live-proved against the real `915tldr-archive` R2 bucket (not simulated): a
  `node tools/archive-sync.mjs pre --limit 50 --json` run against a real 60,397-page build
  uploaded exactly 50 new pages and moved the other 30,428 archive-tier pages back into
  `dist/client` (dist/client's file count rose from 29,937 to 60,365, exactly matching); the R2
  index held exactly 50 entries; 3 spot-checked `headObject` calls matched the plan's sha256 and
  byte count exactly. After a fresh `pnpm run build`, a second `pre --limit 50` run uploaded a
  different 50 pages (index grew from 50 to 100 entries) — confirming 0 re-uploads of the
  original 50.

## Next Steps

- [ ] Commit the post-phase test suite (`tests/unit/archive-sync.test.mjs`) and run the live
      post-sync tracer against the real bucket
- [ ] Write `docs/phase-05/archive-architecture.md`
- [ ] 05-08 wires `archive-sync.mjs` into `tools/ci-build.mjs`'s real deploy step

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - new build-time module that writes to production R2 storage; gated behind
credential/branch checks and proven live in this session

---
phase: 05-hybrid-archive-zero-reads-proof
plan: 13
subsystem: infra
tags: [ci-build, archive-sync, wrangler, tdd, dry-run, production-safety]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "tools/ci-build.mjs's deploy sequence (05-08), the code-review finding CR-01 (05-REVIEW.md)"
provides:
  - "A dry-run (CI_BUILD_DEPLOY_DRY_RUN=1) or failed wrangler deploy can no longer spawn archive-sync post or call commitImpl"
  - "Three CR-01 regression tests pinning the invariant, red-to-green"
  - "A credential-free live CLI proof that the fix holds on the real path"
  - "docs/phase-04/build-pipeline.md states the dry-run contract explicitly"
affects: ["05-14"]

# Actuals (#2632)
actuals:
  tokens: 3800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Deploy-step dry-run guard: confine both commitLastGood and the archive-sync post child-process spawn inside a single `!dryRun` branch, rather than guarding each independently — one predicate, one place it can't disagree with itself."

key-files:
  created: []
  modified:
    - tools/ci-build.mjs
    - tests/unit/ci-build.test.mjs
    - docs/phase-04/build-pipeline.md

key-decisions:
  - "Restructured the deploy branch so commitImpl AND the entire archive-sync post spawn/parse/alert block live inside one `if (dryRun) { log(...) } else { ... }` conditional, rather than adding a second early-return guard — keeps `isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN)` the single dry-run predicate the plan required."
  - "The pendingAlerts loop (pre's alerts, the file-count warn alarm) stays outside the dryRun/!dryRun split so a dry run still delivers every alert it gathered before the wrangler step — proven by Test B."
  - "Ran the live credential-free dry run with CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID still set (needed for wrangler deploy --dry-run auth, carry no R2/ntfy write power) while explicitly unsetting R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, NTFY_TOPIC, NTFY_TOKEN — matches the plan's own stated fallback for an auth-required dry run."

patterns-established:
  - "CR-01 regression tests reuse this file's existing fakeArchiveSyncTail/fakeDeploySpawnImpl helpers rather than inventing a new fixture shape for the new section."

requirements-completed: []  # REND-07/REND-08 deliberately NOT marked complete — see "Requirements status" below

coverage:
  - id: D1
    description: "A dry-run deploy (CI_BUILD_DEPLOY_DRY_RUN=1) never spawns archive-sync post and never calls commitImpl, returns 0, and logs the skip line"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#CR-01 (05-13): CI_BUILD_DEPLOY_DRY_RUN=1 never spawns archive-sync post, never calls commitImpl, returns 0, and logs the skip line"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dry run still delivers every pre-sync alert it gathered (alerts are not silently dropped alongside the skipped post-sync)"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#CR-01 (05-13): a dry run still delivers every pre-sync alert it gathered"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed (non-dry-run) wrangler deploy never spawns archive-sync post or calls commitImpl"
    requirement: "REND-08"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#CR-01 (05-13): a failed wrangler deploy (non-dry-run) never spawns post, never calls commitImpl, returns non-zero, notifies once naming wrangler deploy"
        status: pass
    human_judgment: false
  - id: D4
    description: "A real (non-dry-run) deploy's ordering is unchanged: pre, file-count, wrangler, commitImpl, then post"
    requirement: "REND-07"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: writes the build-start marker is NOT part of the deploy step (build-only), and spawns archive-sync pre, assert-file-count, wrangler deploy, commitImpl, then archive-sync post, in that order"
        status: pass
    human_judgment: false
  - id: D5
    description: "The fix is proven on the real CLI path, credential-free, with no R2/ntfy variables present"
    requirement: "REND-08"
    verification:
      - kind: other
        ref: "env -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY -u NTFY_TOPIC -u NTFY_TOKEN CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy, captured in .wrangler/ci-dry-run-05-13.log (gitignored)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 13: Confine ci-build's archive-sync post to the real-deploy branch (CR-01) Summary

**Fixed `tools/ci-build.mjs` so a dry-run or failed deploy can never reach `archive-sync post`, with three red-to-green regression tests and a credential-free live CLI proof.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-02T20:41:00Z
- **Completed:** 2026-10-02T21:05:00Z
- **Tasks:** 2
- **Files modified:** 3 (`tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`, `docs/phase-04/build-pipeline.md`)

## Accomplishments

- Closed the ci-build half of code-review finding CR-01 (05-REVIEW.md): `commitImpl` and the entire `archive-sync post` spawn/parse/alert-queueing block now run only inside the `!dryRun` branch of `runCi`'s deploy step — a `CI_BUILD_DEPLOY_DRY_RUN=1` rehearsal or a failed `wrangler deploy` can structurally never reach post-sync, which is the only child process with R2 write/delete power over the production bucket.
- Added three regression tests (the "CR-01 (05-13)" section in `tests/unit/ci-build.test.mjs`) genuinely run RED-then-GREEN: Test A failed against the unfixed code with `AssertionError: a dry run must never spawn archive-sync post` (quoted below); Tests B and C already held pre-fix (pinned explicitly as regression tests, not newly introduced behavior).
- Proved the fix on the real CLI path once, credential-free: `env -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY -u NTFY_TOPIC -u NTFY_TOKEN CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` produced the skip line exactly once and zero `ARCHIVE_SYNC_RESULT {"phase":"post"` lines.
- Updated `docs/phase-04/build-pipeline.md`'s DEPLOY diagram (steps 4-5) to state the dry-run contract explicitly.

## Task Commits

Each task was committed atomically (via `/jja-commit`):

1. **Task 1: Tracer — regression tests, then confine post-sync to the real-deploy branch** - `c8b727b` (feat)
2. **Task 2: Exercise the real CLI once, credential-free, and document the contract** - `0bd7344` (docs)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

_Note: Task 1 was executed as a single tracer-style commit containing both the RED test addition and the GREEN fix together (both files were committed in one commit after RED was confirmed failing and GREEN was confirmed passing) rather than two separate commits — the plan's own `<action>` block describes RED and GREEN as one continuous task, and `tdd="true"` here names the test-first discipline, not a mandate for a separate `test(...)` commit ahead of the `feat(...)` commit. The RED failure was captured and quoted below before the GREEN fix was applied, satisfying the plan's "quote the failing assertion text" requirement without a second commit._

## Files Created/Modified

- `tools/ci-build.mjs` — deploy branch: `commitImpl` and the `archive-sync post` spawn/parse/alert-queueing block moved inside `if (!dryRun) { ... }`; dry-run branch logs `[ci-build] dry run: skipping archive-sync post — it mutates the production bucket and this run deployed nothing`; deploy-step header comment updated to describe the dry-run skip for both commitLastGood and post (CR-01, 05-13)
- `tests/unit/ci-build.test.mjs` — new section "CR-01 (05-13): a deploy that deployed nothing never reaches post-sync" with Tests A, B, C (51 total tests in the file, all passing)
- `docs/phase-04/build-pipeline.md` — DEPLOY diagram steps 4 and 5 annotated with the dry-run skip contract and "CR-01, 05-13"

## Decisions Made

- See `key-decisions` in frontmatter: single `!dryRun` conditional confining both commitImpl and post (not two independent guards); pendingAlerts loop kept outside the split so dry-run alerts are still delivered; live proof run kept `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (no R2/ntfy write power) while explicitly unsetting the four R2/ntfy variables.

## RED Failure (quoted, Task 1)

Running `node --test tests/unit/ci-build.test.mjs` against the unfixed code produced:

```
✖ CR-01 (05-13): CI_BUILD_DEPLOY_DRY_RUN=1 never spawns archive-sync post, never calls commitImpl, returns 0, and logs the skip line (0.5454ms)
  AssertionError [ERR_ASSERTION]: a dry run must never spawn archive-sync post
      at TestContext.<anonymous> (file:///home/jaime/www/_github/915tldr.com/tests/unit/ci-build.test.mjs:1058:10)
  ...
    actual: false,
    expected: true,
    operator: '==',
```

After the GREEN fix, the same run reported 51/51 passing (`ℹ pass 51`, `ℹ fail 0`).

## Live Dry-Run Proof (Task 2)

Command run (R2/ntfy variables explicitly unset):
```
env -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY -u NTFY_TOPIC -u NTFY_TOKEN \
  CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy \
  2>&1 | tee .wrangler/ci-dry-run-05-13.log
```

Key output lines:
```
ARCHIVE_SYNC_RESULT {"phase":"pre",...,"disabled":true,"alerts":["archive-sync: archive tier disabled for this build — R2 credentials are not set in the environment"],...}
{"count":60486,"ceiling":100000,"failAt":80000,"status":"ok"}
--dry-run: exiting now.
[ci-build] dry run: skipping archive-sync post — it mutates the production bucket and this run deployed nothing
```

Verification:
- `grep -c "dry run: skipping archive-sync post" .wrangler/ci-dry-run-05-13.log` → `1`
- `grep -c '^ARCHIVE_SYNC_RESULT {"phase":"post"' .wrangler/ci-dry-run-05-13.log` → `0`
- `grep -c "CR-01, 05-13" docs/phase-04/build-pipeline.md` → `2`
- After restoring with `pnpm run build`: `test -f dist/archive-plan.json` succeeded, `find dist/archive -type f | wc -l` → `30713`

The run's `pre` phase disabled itself (no R2 credentials present) and moved all 30,504 planned archive pages back into `dist/client` (local-only, no R2 call) — this is pre's own existing, correct, pre-05-13 behavior and is unrelated to the CR-01 fix itself. A restoring `pnpm run build` put the partition back.

## Deviations from Plan

None — plan executed exactly as written. Task 1's RED-then-GREEN was captured as described above (quoted failure text) rather than as two separate git commits; see the Task Commits note for why this still satisfies the plan's TDD requirement.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Requirements Status

This plan's frontmatter lists `requirements: [REND-07, REND-08]`, but **neither is marked
Complete in REQUIREMENTS.md by this plan** — both remain `Gaps Found`, matching
05-VERIFICATION.md's own finding that REND-07/REND-08 are blocked by **two** independent issues:
CR-01 (dry-run post-sync — ci-build half closed here; archive-sync half still open, 05-14) and
CR-02 (the documented `pnpm run deploy` script skips pre-sync entirely — untouched by this plan).
Marking either requirement Complete now, with CR-02 and 05-14 still outstanding, would repeat the
exact premature-completion mistake 05-VERIFICATION.md's gap-closure cycle exists to fix. Left for
whichever gap-closure plan closes the last of CR-01/CR-02 to re-run `requirements mark-complete`.

## Next Phase Readiness

- 05-14 (the archive-sync-side half of CR-01: live-deployment match before any deletion) can proceed — this plan's fix is independent of and does not block it.
- `pnpm run test:fast` (679 tests) and `node --test tests/unit/ci-build.test.mjs` (51 tests) both green at the end of this plan.
- No blockers or concerns for subsequent gap-closure plans (05-15..05-21).

## Self-Check: PASSED

All claimed files found on disk; both task commit hashes (`c8b727b`, `0bd7344`) found in git log.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

# 2026-09-27 - Failing tests for the Workers Builds CI wrapper (04-09 Task 1, RED)

**Keywords:** [TESTING] [BACKEND] [CI_CD] [SECURITY]
**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1136_04-09-ci-build-wrapper-red-tests.md`

## What Changed

- File: `tests/unit/ci-build.test.mjs`
  - Added the RED half of Task 1's TDD pair: 19 tests pinning `tools/ci-build.mjs`'s
    fail-loud contract (D-15/REND-02) before that module exists.
  - Covers `classifyFailure` (first matching check line, fallback to a bare exit code),
    `redact` (named secrets plus any 40+ character token-like run), and `runCi`'s full
    behavior matrix: a failing build never reaches `wrangler deploy` and notifies exactly
    once; the notification title/body shape and its "local" fallback outside Workers
    Builds; `WORKERS_CI` set with no `NTFY_TOPIC` refuses to run before spawning anything;
    `deploy` only calls `commitImpl` after a real successful `wrangler deploy`; the
    watchdog notifies once past `BUILD_WATCHDOG_MS` (default 18 minutes) without killing
    the build; no `NTFY_TOPIC` outside CI logs only, with zero network calls; and the
    build is always spawned with `BUILD_STATE_REQUIRE_BASELINE=1`.
  - Confirmed genuine RED: `node --test tests/unit/ci-build.test.mjs` fails with
    `ERR_MODULE_NOT_FOUND` (`tools/ci-build.mjs` does not exist yet).

## Why

Test-first TDD gate for 04-09 Task 1, per this plan's `tdd="true"` requirement: the wrapper
that stands between Workers Builds and a live production deploy must prove every fail-loud
guarantee (never deploy a failed build, never fail silently) before the implementation exists,
not after.

## Issues Encountered

No major issues encountered — this is the RED commit; the module under test is intentionally
absent.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in 04-09-PLAN.md's Task 1 `<behavior>` block, as a
  named test using injectable deps seams (`spawnImpl`/`notifyImpl`/`commitImpl`/`setTimer`/
  `clearTimer`), matching this project's established `fetchImpl` convention.
- What wasn't tested: nothing yet — `tools/ci-build.mjs` does not exist. The GREEN commit
  makes all 19 tests pass.
- Edge cases: empty/undefined `classifyFailure` input, multiple matching lines (first wins),
  a 40+ char token with no matching env var name, the WORKERS_CI+`all`-step preflight, and the
  watchdog's "notify once, never kill" requirement.

## Next Steps

- [ ] Implement `tools/ci-build.mjs` (GREEN commit)
- [ ] Wire `build:ci`/`deploy:ci`/`ci:local`/`test:regression` into `package.json`
- [ ] Add `.node-version` pinning Node 24

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW — test-only commit, no runtime behavior changes yet.

# 2026-09-27 - GREEN: implement the Workers Builds CI wrapper (04-09 Task 1)

**Keywords:** [FEATURE] [BACKEND] [CI_CD] [SECURITY]
**Session:** Morning, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1140_04-09-ci-build-wrapper-green.md`

## What Changed

- File: `tools/ci-build.mjs` (new)
  - `runCi({ step, env, spawnImpl, notifyImpl, commitImpl, setTimer, clearTimer, log })`:
    the whole `build | deploy | all` wrapper. `WORKERS_CI` set with no `NTFY_TOPIC` refuses
    to run before anything is spawned; `build`/`all` always spawn `pnpm run build` with
    `BUILD_STATE_REQUIRE_BASELINE=1`; a failing build never reaches `wrangler deploy`;
    `deploy` only calls `commitImpl` (a dynamic `import()` of
    `src/lib/server/build-state.ts#commitLastGood` — never at module load, so the `build`
    step needs no KV credentials) after `wrangler deploy` itself exits 0; a watchdog
    notifies once past `BUILD_WATCHDOG_MS` (default 18 minutes, ahead of Workers Builds'
    hard 20-minute ceiling) without ever killing the build.
  - `classifyFailure(outputTail, exitCode)`: names the first output line mentioning
    `d1-articles-loader`, `changelog-loader`, `d1-client`, `kv-manifest`, `build-state`,
    `assert-no-d1`, or `listing`; falls back to `astro build exited <code>`.
  - `redact(text, env)`: strips `CLOUDFLARE_API_TOKEN`/`NTFY_TOKEN` by exact value, then
    sweeps any remaining 40+ character token-shaped run — every notification title/body
    passes through this before it ever reaches `notifyImpl`.
  - Real `notifyImpl` posts to ntfy (`{NTFY_SERVER:-https://ntfy.sh}/{NTFY_TOPIC}`,
    `Title`/`Priority: high`/`Tags: rotating_light` headers, optional Bearer auth) — no
    topic or token value is hardcoded anywhere in this file.
  - CLI entry: `node tools/ci-build.mjs <build|deploy|all>`.
- File: `package.json`
  - Added `build:ci` (`node tools/ci-build.mjs build`), `deploy:ci`
    (`node tools/ci-build.mjs deploy`), `ci:local` (`node tools/ci-build.mjs all`), and
    `test:regression` (`node --test "tests/regression/**/*.test.mjs"`).
- File: `.node-version` (new)
  - Pins `24`, matching `package.json`'s existing `engines.node: ">=24"`.

## Why

Workers Builds must never deploy a build that failed, and a failure must never go
unnoticed — D-15's whole point, and the exact class of defect ("silent staleness") this
project already shipped once in v1. All 19 tests from the RED commit now pass unmodified.

## Issues Encountered

No major issues encountered — the implementation matched the RED tests' behavior contract
on the first pass; no test needed adjustment.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/ci-build.test.mjs` (19/19 pass);
  `pnpm run test:regression` (4/4 pass, including the real-build 04-08 replay);
  `test "$(cat .node-version)" = "24"`; `grep -c "commitLastGood" tools/ci-build.mjs` (3).
- What wasn't tested: a real ntfy push and a real `wrangler deploy` — both are the default
  (non-injected) implementations, exercised only indirectly via the unit tests' deps-seam
  stubs. A live notification/deploy will be exercised for real in 04-10's Workers Builds
  setup.
- Edge cases: covered by the RED commit's 19 named tests (see that changelog entry).

## Next Steps

- [ ] Task 2: owner setup document, the incremental-build flag seam, per-page `cacheKey`s
- [ ] Task 3: local incremental-build spike (warm/fresh-clone/byte-identity measurement)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM — new build/deploy machinery, not yet wired into any live Workers Builds
pipeline (that's 04-10, a human checkpoint).

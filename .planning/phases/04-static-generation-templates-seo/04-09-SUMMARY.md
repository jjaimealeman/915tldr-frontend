---
phase: 04-static-generation-templates-seo
plan: 09
subsystem: infra
tags: [cloudflare-workers-builds, ci-cd, ntfy, astro, incremental-build, tdd, build-measurement]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-03's build-state.ts (commitLastGood/evaluateShrink/BUILD_STATE_REQUIRE_BASELINE), 04-04's rail.ts (computeRails/railFingerprint), 04-06's Worker/deploy-config finding (wrangler deploy --config wrangler.jsonc), 04-08's regression-test convention this plan's own test:regression script now runs on every ci-build.mjs invocation"
provides:
  - "tools/ci-build.mjs — the Workers Builds build/deploy wrapper: watchdog, failure classification, ntfy notification (redacted), commitLastGood only after a real successful deploy"
  - "package.json scripts: build:ci, deploy:ci, ci:local, test:regression"
  - "docs/phase-04/workers-builds-setup.md — the exact, no-secrets-values runbook for 04-10's owner setup"
  - "astro.config.mjs's experimental.incrementalBuild seam (default off) and cacheKey in the article and tag pages"
  - "tools/compare-builds.mjs — snapshot/diff dist/client file hashes between builds"
  - "docs/phase-04/build-measurements.md's 'Local incremental-build spike' section — measured verdict REUSE_WARM_ONLY for RESEARCH Open Question 2 (withastro/astro#18055), against real production data"
affects: [04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 15112
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "ci-build.mjs's spawnImpl/notifyImpl/commitImpl/setTimer/clearTimer deps-seam mirrors this project's established fetchImpl convention (build-state.ts, changelog-loader.ts) — every process spawn, network push, and KV write is injectable, so the RED test suite never spawns a real process or sends a real ntfy push"
    - "commitLastGood is reached only via a dynamic import() inside the deploy path, never at module load time — the build step needs no KV credentials at all, matching Workers Builds' separate build/deploy command model"
    - "compare-builds.mjs's isArticleFile classifies by isKnownCategory (src/lib/categories.ts), not raw path depth — tag/*.html and source/*.html sit at the same directory depth as a real article and would be misclassified by a naive check"
  removed: []

key-files:
  created:
    - tools/ci-build.mjs
    - tests/unit/ci-build.test.mjs
    - .node-version
    - docs/phase-04/workers-builds-setup.md
    - tools/compare-builds.mjs
  modified:
    - package.json
    - astro.config.mjs
    - src/pages/[category]/[slug].astro
    - src/pages/tag/[slug].astro
    - docs/phase-04/build-measurements.md

key-decisions:
  - "runCi's WORKERS_CI-without-NTFY_TOPIC preflight check applies to both the 'build' and 'all' steps, refusing to spawn anything — a deploying build must never run unmonitored (T-04-38), and this is enforced before any process starts, not after a failure is caught."
  - "The watchdog notifies once past BUILD_WATCHDOG_MS (default 18 minutes, ahead of Workers Builds' 20-minute hard ceiling) and never kills the build — this wrapper has no kill mechanism by design, since a build that is merely slow (not stuck) must be allowed to finish."
  - "docs/phase-04/workers-builds-setup.md scopes ASTRO_INCREMENTAL_BUILD=1 to the feature/phase-04 non-production branch ONLY — setting it on production before 04-11's decision would silently change production build behavior ahead of that decision."
  - "The incremental-build spike's verdict is REUSE_WARM_ONLY, not REUSE_PROVEN: reuse works reliably in a warm, same-checkout build (59,899/59,918 pages restored) but reused ZERO pages in a fresh clone with only node_modules/.astro restored — the exact shape of a Workers Builds container — reproducing withastro/astro#18055 exactly as 04-RESEARCH.md's Common Pitfall #1 warned, against this project's own real D1 loader and real production data, not a synthetic reproduction."
  - "A restored (skipped) page's data-build footer stamp reflects whichever commit last actually rendered it, not the current build's commit — confirmed by a byte-for-byte diff of a sample article with that one line stripped, showing zero remaining differences. This is a correctly-diagnosed, disclosed consequence of page restoration, flagged for 04-11's decision (not a bug, not fixed in this plan)."
  - "Toggling ASTRO_INCREMENTAL_BUILD forces the D1 loader cold on the very next build (store.keys().length === 0 triggers articlesLoader's own storeEmpty cold-trigger) — confirmed by two consecutive no-toggle flag-on builds correctly staying warm immediately after. Flagged for awareness in build-measurements.md, not fixed (out of scope: this is a real Astro/Vite config-change cache-invalidation behavior, not a bug in this project's own code)."

patterns-established:
  - "A background-vs-foreground command-sequencing mixup during the live measurement run (a run_in_background build raced the tool's own tracking, briefly letting a flag-on run execute unflagged) was caught immediately via a zero '(restored)' line count in the log and re-run correctly — no incorrect number made it into the final measurements. Documented in the plan's own changelog rather than silently corrected."

requirements-completed: [REND-02, REND-04, REND-05]

coverage:
  - id: D1
    description: "A failing build never reaches wrangler deploy, and a failure never fails silently — a failed build spawns no wrangler process and notifies exactly once, with the notification title/body redacted of secrets"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=all: a build that exits 1 returns non-zero, spawns no wrangler process, notifies exactly once"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#redact: removes the exact values of CLOUDFLARE_API_TOKEN and NTFY_TOKEN"
        status: pass
    human_judgment: false
  - id: D2
    description: "WORKERS_CI set with no NTFY_TOPIC refuses to run before spawning anything, and commitLastGood only ever runs after a real successful wrangler deploy"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=build: WORKERS_CI set with no NTFY_TOPIC fails before spawning, message names NTFY_TOPIC"
        status: pass
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi step=deploy: wrangler exit 0 calls commitImpl exactly once / wrangler exit 1 never calls commitImpl, and notifies"
        status: pass
    human_judgment: false
  - id: D3
    description: "A watchdog notifies once past BUILD_WATCHDOG_MS without killing the build; the four package.json scripts (build:ci/deploy:ci/ci:local/test:regression) exist and Node 24 is pinned"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/ci-build.test.mjs#runCi: watchdog notifies once past the default 18-minute threshold and does not kill the build"
        status: pass
      - kind: other
        ref: "test \"$(cat .node-version)\" = \"24\"; grep -q build:ci/deploy:ci/ci:local/test:regression package.json"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/phase-04/workers-builds-setup.md gives 04-10 an exact, concrete, no-secret-values runbook covering the repo remote, dashboard connection, build variables, injected-token scope check, Deploy Hooks, and build-minute allowance"
    requirement: "REND-04"
    verification:
      - kind: other
        ref: "grep -q 915tldr-frontend / deploy:ci docs/phase-04/workers-builds-setup.md"
        status: pass
    human_judgment: true
    rationale: "The doc's completeness and clarity for a human owner to follow in 04-10 is a judgment call a grep cannot fully verify."
  - id: D5
    description: "The experimental.incrementalBuild flag seam defaults off and builds succeed with it both on and off; article and tag pages return a cacheKey from getStaticPaths"
    requirement: "REND-05"
    verification:
      - kind: unit
        ref: "tests/unit/astro-config.test.mjs (18/18 pass)"
        status: pass
      - kind: other
        ref: "pnpm run build (flag off) and ASTRO_INCREMENTAL_BUILD=1 pnpm run build (flag on) both exit 0, 59,907-59,918 pages each"
        status: pass
    human_judgment: false
  - id: D6
    description: "RESEARCH Open Question 2 (withastro/astro#18055) has a measured local answer: REUSE_WARM_ONLY — reuse works in a warm checkout, fails completely in a fresh clone with only node_modules/.astro restored, and byte-identity holds once the disclosed build-stamp difference is accounted for"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "docs/phase-04/build-measurements.md#Local incremental-build spike — 5-build measurement table, tools/compare-builds.mjs diffs, verdict REUSE_WARM_ONLY"
        status: pass
    human_judgment: false

duration: ~3h10min
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 09: Workers Builds CI Wrapper, Owner Setup, and the Incremental-Build Spike Summary

**A Workers Builds wrapper that can neither ship a failed build nor fail silently (D-15), an exact no-secrets owner runbook for 04-10, and a measured local answer to this phase's biggest open risk — `experimental.incrementalBuild` reuses pages reliably in a warm checkout but reused zero of 59,918 pages in a fresh-clone simulation of a real Workers Builds container, reproducing `withastro/astro#18055` against this project's own real D1 data.**

## Performance

- **Duration:** ~3h10min (includes 8 real production builds plus a fresh-clone CI simulation)
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- Built `tools/ci-build.mjs` (test-first, 19 tests, genuine RED confirmed via `ERR_MODULE_NOT_FOUND`
  before GREEN): `runCi()`, `classifyFailure()`, `redact()` — a failing build never spawns
  `wrangler`, `commitLastGood` only runs after a real successful deploy, `WORKERS_CI` without
  `NTFY_TOPIC` refuses to run unmonitored, and a watchdog warns once past 18 minutes without ever
  killing the build.
- Wrote `docs/phase-04/workers-builds-setup.md` — a six-item, concrete-values, no-secrets runbook
  for 04-10, including the exact steps to confirm the Workers-Builds-injected `CLOUDFLARE_API_TOKEN`
  carries D1 read + Workers KV Storage edit scope.
- Wired `experimental.incrementalBuild` into `astro.config.mjs` (default off) and added `cacheKey`
  to the article and tag pages' `getStaticPaths()`; confirmed builds succeed with the flag both on
  and off.
- Ran a real, measured local incremental-build spike (8 production builds + 1 fresh-clone
  simulation) and reached a definitive verdict — **`REUSE_WARM_ONLY`** — against this project's own
  real D1 loader and real production data, directly answering RESEARCH's flagged Open Question 2
  before 04-10 spends a real Workers Builds run finding out the hard way.
- Investigated and correctly root-caused what initially looked like "every article changed" between
  a flag-off and flag-on build: a restored page's footer build-stamp reflects whenever it was last
  actually rendered, not the current commit — confirmed byte-identical once that one disclosed field
  is set aside, in every configuration tested.

## Task Commits

1. **Task 1: CI wrapper — build, deploy, watchdog, failure classification, ntfy, last-good commit**
   (`tdd="true"`) — `7465834` (test, RED — confirmed genuine via `ERR_MODULE_NOT_FOUND`) →
   `5b0db41` (feat, GREEN — 19/19 tests passing)
2. **Task 2: Owner setup document, the incremental-build flag seam and per-page cacheKeys** —
   `89730f0` (feat)
3. **Task 3: Local incremental-build spike — warm checkout, flag on/off, fresh-clone CI simulation,
   byte-identity** — `40fbcaa` (feat)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `tools/ci-build.mjs` (new) — `runCi()`, `classifyFailure()`, `redact()`; CLI `build | deploy | all`
- `tests/unit/ci-build.test.mjs` (new) — 19 tests
- `.node-version` (new) — pins `24`
- `package.json` — `build:ci`, `deploy:ci`, `ci:local`, `test:regression` scripts
- `docs/phase-04/workers-builds-setup.md` (new) — the 04-10 owner runbook
- `astro.config.mjs` — `experimental.incrementalBuild` seam (default off)
- `src/pages/[category]/[slug].astro`, `src/pages/tag/[slug].astro` — `cacheKey` in `getStaticPaths()`
- `tools/compare-builds.mjs` (new) — `snapshot()`/`diff()`, CLI
- `docs/phase-04/build-measurements.md` — new "Local incremental-build spike" section

## Decisions Made

See `key-decisions` in frontmatter above — summarized: the WORKERS_CI/NTFY_TOPIC preflight applies
to both `build` and `all`; the watchdog never kills the build; `ASTRO_INCREMENTAL_BUILD=1` is scoped
to the non-production branch only until 04-11; the spike's verdict is `REUSE_WARM_ONLY` (not
`REUSE_PROVEN`); a restored page's stale build-stamp is a disclosed, correctly-diagnosed consequence
of restoration, not a bug; and toggling the flag forces the D1 loader cold on the next build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `test:fast` failed against a dist/client left in a flag-on,
partially-restored state**
- **Found during:** Post-Task-3 overall verification (running the plan's own `<verification>`
  block, `pnpm run test:fast`)
- **Issue:** The incremental-build spike's own experiments deliberately toggled
  `ASTRO_INCREMENTAL_BUILD` on and off across many builds, leaving `dist/client` in a state where
  some pages were freshly rendered (current commit hash) and some were restored (an older commit
  hash baked into their footer) — exactly the finding documented in
  `docs/phase-04/build-measurements.md`. `tests/unit/build-stamp.test.mjs`'s pre-existing
  cross-surface check (04-04) correctly caught the resulting hash mismatch between
  `version.json` and a sampled article.
- **Fix:** Ran one final, clean flag-OFF `pnpm run build` (matching the shipped default) so every
  page in `dist/client` was freshly rendered with a consistent, current commit hash. No code
  change — `dist/client` is gitignored build output, not a committed artifact.
- **Files modified:** None (build output only).
- **Verification:** `node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"` —
  377/377 pass; `pnpm run test:build-gate` (8/8) and `pnpm run guard:config` also re-confirmed.
- **Committed in:** N/A (no code change; build artifact only, not committed)

---

**Total deviations:** 1 auto-fixed (Rule 3 — a build-output consistency issue caused by this
plan's own deliberate flag-toggling experiments, not a code defect).
**Impact on plan:** No scope creep; no code changed. The underlying finding (a restored page's
stale build-stamp) is exactly what Task 3 exists to discover and is documented, not hidden by this
fix.

## Issues Encountered

- A background/foreground command-sequencing mixup during the live measurement run: a
  `run_in_background: true` build was tracked as still-running by the harness after it had already
  completed (or the notification did not arrive), and a subsequent script invocation for the "next"
  build omitted the `ASTRO_INCREMENTAL_BUILD=1` prefix, causing one flag-on measurement to briefly
  run unflagged. Caught immediately via a zero `.html (restored)$` line count in that build's log
  (the flag-on signature never appeared), discarded, and re-run correctly with the flag set. No
  incorrect number made it into the final measurements table.
- `rm -rf` on a scratchpad temp directory (to clear a stale `node_modules/.astro` copy before
  re-copying a fresher one) was sandbox-blocked per this machine's global CLAUDE.md rule, even for
  a non-project temp path. Worked around with `cp -r src/. dest/` (overwrite-by-name), which is
  sufficient since the file being replaced (`data-store.json`) is always fully rewritten, not
  appended.
- The apparent "every article changed" full-corpus diff between a flag-off and flag-on build was
  investigated to a specific, confirmed root cause (a restored page's footer build-stamp reflecting
  its last actual render) via a manual byte-for-byte diff of one sample article, rather than
  reported as an unexplained anomaly.

## Known Stubs

None. Every artifact this plan built (`tools/ci-build.mjs`, `tools/compare-builds.mjs`, the
`astro.config.mjs`/page `cacheKey` seam) is real, functioning code, exercised against real
production D1/KV and real `pnpm run build`/`wrangler`-shaped invocations (via injected deps seams
in tests, and real process spawns in the actual spike builds).

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-04-35 through T-04-38 —
ntfy redaction, secret-value handling, preview-deploy last-good isolation, WORKERS_CI/NTFY_TOPIC
preflight) — all four are covered by `tests/unit/ci-build.test.mjs`.

## Cleanup needed (run these yourself)

None new from this plan. Carried forward, unchanged and untouched (per this project's own rule —
do not restore or stage these):
```
rm /home/jaime/www/_github/915tldr.com/src/lib/slug.ts
rm /home/jaime/www/_github/915tldr.com/src/lib/render-cost-harness.ts
rm /home/jaime/www/_github/915tldr.com/tools/measure-render-cost.mjs
```

## User Setup Required

None from this plan's own code — `docs/phase-04/workers-builds-setup.md` is itself the User Setup
document for **04-10** (the next plan, a human checkpoint): creating the `915tldr-frontend` GitHub
remote, connecting it in the Cloudflare dashboard, setting build variables, confirming the injected
token's scopes, and creating the two Deploy Hooks. This plan (04-09) touched no Cloudflare dashboard
setting and connected no repository.

## Next Phase Readiness

- 04-10 has an exact runbook (`docs/phase-04/workers-builds-setup.md`) and a working
  `tools/ci-build.mjs` to point Workers Builds' build/deploy commands at (`build:ci`/`deploy:ci`).
- 04-10's own real Workers Builds run should treat this plan's `REUSE_WARM_ONLY` verdict as the
  working assumption to confirm or refute — a genuine fresh-container CI run is the authoritative
  test this local spike approximates but cannot replace.
- 04-11 (the incremental-build production decision) has everything it needs: the measured verdict,
  the byte-identity proof, the disclosed build-stamp-on-restore caveat, and the config-toggle cold
  D1 resync cost — all in `docs/phase-04/build-measurements.md`.
- `astro.config.mjs`'s flag remains OFF by default; no production behavior changed by this plan.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

## Self-Check: PASSED

All claimed created files verified present on disk: `tools/ci-build.mjs`,
`tests/unit/ci-build.test.mjs`, `.node-version`, `docs/phase-04/workers-builds-setup.md`,
`tools/compare-builds.mjs`. All claimed commit hashes verified present in `git log --oneline`
(`7465834`, `5b0db41`, `89730f0`, `40fbcaa`). All verification commands in this SUMMARY were
actually run in this session: `node --test tests/unit/ci-build.test.mjs` (19/19),
`node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"` (377/377, after the
final clean flag-off rebuild), `pnpm run test:build-gate` (8/8), `pnpm run guard:config` (no
violations), `pnpm run test:regression` (4/4), and `node --test tests/unit/astro-config.test.mjs`
(18/18).

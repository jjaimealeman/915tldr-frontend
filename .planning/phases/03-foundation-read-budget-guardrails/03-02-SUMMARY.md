---
phase: 03-foundation-read-budget-guardrails
plan: 02
subsystem: testing
tags: [node-test, rollup-plugin, vite, astro-config, ci-guard, security]

requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "tools/assert-no-d1.mjs (03-01) — the D1-import Vite/Rollup plugin this plan proves and hardens"
provides:
  - "Permanent negative-fixture CI suite for the D1-import assertion (tests/ci-fixtures/), covering a page-shaped ARCH-02 violation, an island-shaped ARCH-03 violation crossing the .astro->.vue boundary, a clean control, and a zero-candidate non-vacuity regression guard"
  - "tools/check-config-guards.mjs — comment-stripped config scanner for ARCH-04 (removed env accessor), ARCH-05 (removed output keyword), and T-03-01 (wrangler.jsonc D1 binding)"
  - "tests/unit/astro-config.test.mjs — 13-case unit suite covering ARCH-04/05/06 and T-03-01/T-03-05, including the ARCH-06 look-alike and absent-key edges"
  - "guard:config / test:build-gate npm scripts, with test:unit now running guard:config first"
  - "tools/assert-no-d1.mjs's rejection message now reports the full BFS chain from entrypoint to forbidden module, not just the two endpoints"
affects: [03-03, 03-05]

actuals:
  tokens: 12780
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Rollup PluginContext stub, populated from a real import graph read off fixture files on disk — drives a build-time plugin's buildEnd hook directly in a unit test, without shelling out to a full astro build, while still exercising the plugin's real path-matching and forbidden-target logic"
    - "Comment-stripping that replaces removed characters with spaces (not deletion) so post-strip line numbers still match the original source — used by tools/check-config-guards.mjs for accurate violation reporting"
    - "node:vm evaluation of a config file's literal adapter-call argument, used when a third-party integration function closes over an option internally and never re-exposes it on its returned object — reads the real resolved value without depending on the package's own internals"

key-files:
  created:
    - tests/ci-fixtures/assert-no-d1.test.mjs
    - tests/ci-fixtures/page-with-d1-import.astro
    - tests/ci-fixtures/clean-page.astro
    - tests/ci-fixtures/island-wrapper.astro
    - tests/ci-fixtures/island-with-d1-import.vue
    - tests/ci-fixtures/helper-reaching-d1.ts
    - tests/ci-fixtures/harmless-helper.ts
    - tools/check-config-guards.mjs
    - tests/unit/astro-config.test.mjs
  modified:
    - tools/assert-no-d1.mjs
    - wrangler.jsonc
    - package.json

key-decisions:
  - "Drove the D1-import fixture suite by invoking assertNoD1Plugin().buildEnd() directly against a synthesized Rollup PluginContext stub, not a real astro build — the module graph fed to the stub is built by reading each fixture's real import statements off disk, so it isn't a hand-typed stand-in. This kept the suite at ~80ms instead of a multi-second real build, well inside the 90s ceiling, and the plan explicitly authorized this as the primary approach."
  - "Enhanced tools/assert-no-d1.mjs's rejection message to report the full BFS chain (entry -> ... -> forbidden module), not just the two endpoints. The original message was silent about which intermediate file a violation crossed through, which meant the island case's rejection message could not be asserted to name island-with-d1-import.vue specifically — the exact ARCH-03 boundary-crossing coverage this suite exists to prove."
  - "ARCH-06 (imageService) cannot be read off astro.config.mjs's resolved default export as 03-02-PLAN.md's action text assumed: @astrojs/cloudflare v14.3.2's cloudflare(options) closes over imageService internally and never re-exposes it on the returned integration object (confirmed by reading node_modules/@astrojs/cloudflare/dist/index.js directly). Worked around by evaluating the literal object argument passed to cloudflare(...) via node:vm — reads the real value, not source text positions, independent of the adapter's internals."
  - "Removed a stray <!-- planner-discipline-allow: d1_databases --> line from wrangler.jsonc: a GSD planning-document discipline-linter marker (used only inside .planning/*.md PLAN files elsewhere in this repo, confirmed via repo-wide grep) that had leaked verbatim from 03-01-PLAN.md into the real deployed config file, and was the ONLY literal occurrence of 'd1_databases' in the file — tripping the new T-03-01 guard against the repo's own real state on first run."

patterns-established:
  - "Zero-candidate non-vacuity regression test (Case 4) runs in an isolated spawned child process, deliberately: tools/assert-no-d1.mjs accumulates its candidate count in module-scope state across every buildEnd call within a process (03-01's own multi-pass-build fix), so a test running after other cases in the same process would never observe a true zero. Any future non-vacuity/exit-guard test for this plugin must do the same."

requirements-completed: [ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06]

coverage:
  - id: D1
    description: "A page-shaped fixture that reaches d1-client.ts transitively through a helper module is rejected, with the message naming both the entrypoint and the forbidden module"
    requirement: "ARCH-02"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 1 (ARCH-02): a page-shaped fixture that reaches d1-client.ts transitively through a helper is rejected"
        status: pass
    human_judgment: false
  - id: D2
    description: "An island-shaped fixture that reaches d1-client.ts transitively through a .vue component is rejected, and the message names the intermediate .vue file specifically — proving the .astro -> .vue boundary is actually covered, not assumed"
    requirement: "ARCH-03"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 2 (ARCH-03): an island-shaped fixture that reaches d1-client.ts transitively through a .vue component is rejected"
        status: pass
    human_judgment: false
  - id: D3
    description: "A clean control fixture importing only a harmless helper is accepted, proving the checker does not reject everything — confirmed causal by a one-time manual inversion (pointed the clean fixture at the violating helper, watched Case 3 fail, reverted)"
    requirement: "ARCH-02"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 3 (control, T-03-06): a clean fixture that imports only a harmless helper is accepted"
        status: pass
      - kind: manual_procedural
        ref: "One-time manual control inversion, documented in this SUMMARY's Deviations section — not a permanent automated test, per T-03-06's own description of a 'manual one-time inversion check'"
        status: pass
    human_judgment: false
  - id: D4
    description: "A build matching zero page/island/middleware candidates across its entire run fails loudly with an explicit message, never passing silently — the exact A1 failure mode if Astro's resolved module-id shape ever changes"
    requirement: "ARCH-02"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 4 (D-06 non-vacuity / A1 regression guard): a build matching zero page/island/middleware candidates fails loudly, never silently"
        status: pass
    human_judgment: false
  - id: D5
    description: "The removed Astro.locals.runtime.env accessor and the removed 'hybrid' output keyword each fail the config guard when present in real code, pass when only mentioned in a comment, and the real repo state passes cleanly"
    requirement: "ARCH-04"
    verification:
      - kind: unit
        ref: "tests/unit/astro-config.test.mjs (6 cases: real state passes, hybrid fails, env accessor fails, both comment-only cases pass)"
        status: pass
    human_judgment: false
  - id: D6
    description: "imageService is validated as the explicit two-key object: real config passes; string shorthand fails even though it touches the required value; a one-key object fails either way; an absent key fails; key order does not change the result"
    requirement: "ARCH-06"
    verification:
      - kind: unit
        ref: "tests/unit/astro-config.test.mjs (6 ARCH-06 cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A d1_databases Worker binding in wrangler.jsonc fails the guard, both live and commented out"
    requirement: "ARCH-02"
    verification:
      - kind: unit
        ref: "tests/unit/astro-config.test.mjs#a Worker database binding in wrangler.jsonc fails the guard, live / ...fails the guard even when commented out (T-03-01)"
        status: pass
    human_judgment: false
  - id: D8
    description: "pnpm test:unit runs the config guard before the unit glob and cannot pass while either guard has stopped gating; combined pnpm test:unit && pnpm test:build-gate completes in 2.73s, far under the 90s ceiling; no fixture is reachable from pnpm build"
    verification:
      - kind: integration
        ref: "pnpm test:unit (56/56 pass, guard:config runs first) && pnpm test:build-gate (4/4 pass); pnpm build exits 0 with fixtures present"
        status: pass
    human_judgment: false

duration: ~16min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 2: Permanent CI Guards for the D1-Import Assertion and Config Drift Summary

**A 4-case negative-fixture suite proves `tools/assert-no-d1.mjs` actually rejects transitive page and island D1 violations on every commit (not once, by hand), and a new comment-aware config scanner closes the `wrangler.jsonc` binding gap the module-graph walk cannot see by construction — both wired into `pnpm test:unit` so neither can be skipped.**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-09-22T13:50:03-06:00
- **Tasks:** 3
- **Files modified:** 12 (9 new, 3 modified) + 3 changelog files

## Accomplishments
- Built a 4-case `node:test` suite (`tests/ci-fixtures/assert-no-d1.test.mjs`) that drives the real `assertNoD1Plugin().buildEnd` hook directly against a synthesized Rollup PluginContext stub, with the module graph built by reading each fixture's real import statements off disk
- Proved the checker rejects a page-shaped ARCH-02 violation, rejects an island-shaped ARCH-03 violation that crosses the `.astro` -> `.vue` boundary (with the `.vue` file named in the rejection message), accepts a clean control (confirmed causal by a one-time manual inversion), and fails loudly — never silently — when a build matches zero page/island/middleware candidates
- Fixed `tools/assert-no-d1.mjs`'s rejection message to report the full BFS chain, not just the entrypoint and the terminal forbidden module, so the island case's message can actually name the intermediate `.vue` file it crosses through
- Built `tools/check-config-guards.mjs`: a comment-stripped scanner for the removed `Astro.locals.runtime.env` accessor (ARCH-04) and the removed `'hybrid'` output keyword (ARCH-05), plus a deliberately NOT-comment-stripped scan of `wrangler.jsonc` for a `d1_databases` binding (T-03-01) — the one gap the module-graph walk cannot see by construction
- Built `tests/unit/astro-config.test.mjs`: 13 cases covering all of the above, plus ARCH-06 (`imageService`) via a `node:vm`-based evaluation of the real `cloudflare(...)` call argument, since the installed adapter package doesn't expose that option on its returned object
- Found and fixed a stray `planner-discipline-allow` marker that had leaked from planning documents into `wrangler.jsonc` itself, which was the only literal occurrence of the forbidden string in the file and tripped the new guard on its first real run
- Wired `guard:config` and `test:build-gate` into `package.json`; `test:unit` now runs the config guard before the existing unit glob
- Measured the combined `pnpm test:unit && pnpm test:build-gate` runtime at 2.73 seconds — far under 03-VALIDATION.md's 90-second ceiling

## Task Commits

1. **Task 1: Permanent negative fixtures — page, island, and a clean control** - `d755978` (test)
2. **Task 2: Config guard — the gap the module graph cannot see** - `0c34593` (feat)
3. **Task 3: Wire both gates into the commit-time test command** - `45866c6` (chore)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `tests/ci-fixtures/assert-no-d1.test.mjs` - The 4-case fixture suite; also defines the fixture-graph builder (`buildGraph`, `idFor`, `resolveSpecifier`) that reads real imports off the fixture files
- `tests/ci-fixtures/page-with-d1-import.astro` - Deliberate ARCH-02 violation: transitively imports `d1-client.ts` via `helper-reaching-d1.ts`
- `tests/ci-fixtures/clean-page.astro` - Deliberate clean control (T-03-06): imports only the harmless helper
- `tests/ci-fixtures/island-wrapper.astro` - Deliberate ARCH-03 violation: an `.astro` island wrapper rendering a Vue component that reaches D1
- `tests/ci-fixtures/island-with-d1-import.vue` - The `.vue` component reached transitively; the file the island case's rejection message must name
- `tests/ci-fixtures/helper-reaching-d1.ts` - Shared fixture helper, imports the real `src/lib/server/d1-client.ts` directly
- `tests/ci-fixtures/harmless-helper.ts` - Shared clean-control fixture helper
- `tools/check-config-guards.mjs` - CLI guard for ARCH-04/ARCH-05/T-03-01, with `stripComments`, `scanSourceFile`, `scanWranglerForD1Binding`, `collectViolations` exported for reuse
- `tests/unit/astro-config.test.mjs` - 13-case unit suite; also defines the `node:vm`-based `extractImageService`/`imageServiceIsValid` helpers for ARCH-06
- `tools/assert-no-d1.mjs` - Rejection message now reports the full BFS chain (`entry -> ... -> d1-client.ts`) via a `parent` map, not just the two endpoints
- `wrangler.jsonc` - Removed the stray `planner-discipline-allow` comment line (see Deviations)
- `package.json` - Added `guard:config`, `test:build-gate` scripts; `test:unit` now composite

## Decisions Made
- Drove the D1-import fixture suite by invoking the plugin's `buildEnd` hook directly (in-process, against a synthesized PluginContext stub) rather than shelling out to a real `astro build` — the plan explicitly authorized this as the primary approach, and it kept the suite at ~80ms instead of the multi-second real build a full `astro build` invocation would cost, comfortably inside 03-VALIDATION.md's 90-second ceiling. The synthesized graph is not hand-typed: `buildGraph()` reads each fixture's real `import ... from '...'` statements off disk and resolves them, including a real relative import into the actual `src/lib/server/d1-client.ts` for the terminal forbidden node — so an edit to a fixture's own import is reflected automatically, and the "forbidden target" being tested against is the real file, not a stand-in string.
- Enhanced `tools/assert-no-d1.mjs`'s error message to report the full chain from entrypoint to forbidden module. The plan's acceptance criteria required the island case's rejection message to name `island-with-d1-import.vue` specifically (proving `.astro` -> `.vue` coverage, not just "some entrypoint eventually reaches d1-client.ts"), which the original entry+target-only message could not satisfy given that the real `for`-loop over entrypoints returns after the first violation found (so `island-wrapper.astro`, being processed before `island-with-d1-import.vue` in entrypoint order, would otherwise report only its own path). Tracking the BFS parent chain and reporting it in full solves this generally, and also improves real production debuggability if this checker ever fires for real.
- ARCH-06 could not be tested the way 03-02-PLAN.md's action text assumed ("import astro.config.mjs and inspect the resolved exported configuration object"): `@astrojs/cloudflare` v14.3.2's `cloudflare(options)` closes over `imageService` in its own function scope and never re-exposes it on the `{ name, hooks }` object it returns (confirmed directly by reading `node_modules/@astrojs/cloudflare/dist/index.js`'s `createIntegration({ imageService, ... })`). Worked around with a `node:vm`-based evaluation of the literal object argument passed to `cloudflare(...)` in a config source string — this reads the real resolved *value* (handles arbitrary key ordering correctly, satisfying the plan's backstop truth) rather than doing a textual/positional match, while being independent of the adapter package's own internal closure behavior.
- Removed a stray `<!-- planner-discipline-allow: d1_databases -->` line from `wrangler.jsonc`. This marker convention is used exclusively inside `.planning/*.md` PLAN files elsewhere in this repo (confirmed via a repo-wide grep across all three phases) — it is a GSD-internal planning-document discipline-linter signal, not a runtime config convention, and it had landed verbatim in the real deployed `wrangler.jsonc` as an artifact of 03-01's own plan text. It was the ONLY literal occurrence of `d1_databases` anywhere in the file; the surrounding explanatory prose about D1's deliberate absence never used the literal key name and needed no other change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The D1-import assertion's rejection message didn't name intermediate files in the BFS chain**
- **Found during:** Task 1 (writing the island-shaped fixture case)
- **Issue:** The original message format (`"${entry}" transitively imports "${id}", which reaches ${FORBIDDEN_TARGET_SUFFIX}`) only ever named the entrypoint that started the walk and the terminal forbidden module. Since the real `buildEnd` for-loop returns immediately after the first entrypoint that finds a violation, and `island-wrapper.astro` is processed before the standalone `island-with-d1-import.vue` entrypoint in discovery order, the message for the island case would have named only `island-wrapper.astro` and `d1-client.ts` — never the intermediate `.vue` file the plan's own acceptance criteria required the message to name.
- **Fix:** Track the BFS parent-discovery chain (`parent` map) and reconstruct the full path from entry to forbidden module on violation, reporting `entry -> ... -> forbidden` instead of just the two endpoints.
- **Files modified:** `tools/assert-no-d1.mjs`
- **Verification:** `tests/ci-fixtures/assert-no-d1.test.mjs`'s Case 2 asserts the message matches `/island-with-d1-import\.vue/`; passes.
- **Committed in:** `d755978`

**2. [Rule 1 - Bug] A stray planning-linter marker in wrangler.jsonc tripped the new T-03-01 guard**
- **Found during:** Task 2 (first real run of `check-config-guards.mjs` against the repo)
- **Issue:** `wrangler.jsonc` contained a leaked `<!-- planner-discipline-allow: d1_databases -->` line — a GSD-internal `.planning/*.md` discipline-linter marker that had landed verbatim in the real deployed config file as an artifact of 03-01's own plan text, and was the file's only literal occurrence of the forbidden string.
- **Fix:** Removed the stray line; the surrounding explanatory comment about D1's deliberate absence needed no other change (it never used the literal key name).
- **Files modified:** `wrangler.jsonc`
- **Verification:** `node tools/check-config-guards.mjs` now exits 0 against the real repo state; `pnpm build` still exits 0 after the change.
- **Committed in:** `0c34593`

**3. [Rule 1 - Bug] ARCH-06's planned test method (inspecting astro.config.mjs's resolved export) doesn't work against the installed adapter version**
- **Found during:** Task 2 (writing `tests/unit/astro-config.test.mjs`)
- **Issue:** `@astrojs/cloudflare` v14.3.2's `cloudflare(options)` closes over `imageService` internally and never exposes it on the integration object it returns, so there is no `config.adapter.imageService` to read.
- **Fix:** Evaluate the literal object argument passed to `cloudflare(...)` via `node:vm` instead, reading the real resolved value from source rather than the adapter's (unavailable) runtime state.
- **Files modified:** `tests/unit/astro-config.test.mjs`
- **Verification:** All 6 ARCH-06 cases pass, including the key-order backstop.
- **Committed in:** `0c34593`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs); none required a Rule 4 architectural decision.
**Impact on plan:** All three fixes were necessary for the plan's own stated acceptance criteria to be satisfiable at all, or for the new guard to pass against the repo's real state. No scope creep — all three stayed within the direct technical requirements of Task 1/Task 2's own deliverables.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None. This plan required no new credentials, packages, or external service configuration — pure test/tooling work against the repo's existing dependencies.

## Next Phase Readiness
- 03-03 (build-stamp plumbing) can proceed directly; nothing in this plan touches `Base.astro`'s footer or `/version.json`.
- 03-05 (edge/deploy config) inherits `guard:config`/`test:build-gate` as scripts ready to attach to whatever CI/deploy path gets established there — this plan deliberately did not add a `.github/` workflow or a git hook, per its own explicit scope boundary.
- No blockers remain from this plan.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 9 created files and 3 modified files verified present on disk. Task commit hashes `d755978`,
`0c34593`, `45866c6` verified present in `git log --oneline --all`. No missing items.

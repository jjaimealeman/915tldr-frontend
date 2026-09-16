---
phase: 01-design-sketch-editorial-identity
plan: 01
subsystem: testing
tags: [playwright, webkit, docker, node-http, tdd, supply-chain]

requires: []
provides:
  - "Pinned, owner-approved devDependency set (@playwright/test, subset-font, @capsizecss/core, @capsizecss/metrics, culori) installed with --ignore-scripts"
  - "Proven WebKit execution path on this Arch Linux machine (Docker fallback via mcr.microsoft.com/playwright:v1.63.0-noble), recorded in design/.webkit-mode.json"
  - "Hardened dependency-free static file server (design/scripts/serve-mockups.mjs) rooted at design/, loopback-only, GET/HEAD only, traversal-hardened"
  - "playwright.config.ts with chromium + webkit projects and webServer wiring"
  - "Engine-aware test launcher design/scripts/pw.mjs (native chromium; native-or-docker webkit)"
  - "Shared test harness design/tests/support/harness.ts (PAGES, pagesUnderTest, THEMES, WIDTHS, ZOOM_200, THEME_STORAGE_KEY, openPage, blockThirdParty) every later phase-1 spec imports"
affects: [01-02-tracer, 01-03-palette, 01-05-contrast-gate, 01-06-home-category, 01-07-article-changelog-contact, 01-08-keyboard-walk, 01-09-font-swap-matrix, 01-10-approval-packet]

actuals:
  tokens: 11095
  tasks: 3
  commits: 3

tech-stack:
  added: ["@playwright/test@1.63.0", "subset-font@2.7.0", "@capsizecss/core@4.1.3", "@capsizecss/metrics@4.2.0", "culori@4.0.2", "wrangler (npx-only, not installed)"]
  patterns:
    - "All install steps use --ignore-scripts (no lifecycle scripts execute) as the standing supply-chain mitigation for this phase"
    - "Docker containers for WebKit are invoked with --network none, --user <uid>:<gid>, and a bind mount of the repo root, so container-written files are owned by the invoking user, not root"
    - "Route handlers in blockThirdParty always call route.fallback() for local traffic, never route.continue(), so handlers registered earlier by callers still run (Playwright invokes handlers in reverse registration order)"

key-files:
  created:
    - package.json
    - package-lock.json
    - design/scripts/probe-webkit.mjs
    - design/scripts/serve-mockups.mjs
    - design/scripts/pw.mjs
    - playwright.config.ts
    - design/tests/support/harness.ts
    - design/tests/harness.spec.ts
    - design/tests/fixtures/harness.html
  modified:
    - .gitignore

key-decisions:
  - "Owner approved all 8 pinned packages/images exactly as proposed at the Task 1 legitimacy checkpoint; no substitutions needed."
  - "Native WebKit launch failed on this Arch Linux machine as anticipated (Playwright's WebKit build targets Ubuntu's ICU; this machine has ICU 78 only) — the planned Docker fallback (mcr.microsoft.com/playwright:v1.63.0-noble) was exercised for real and succeeded (WebKit 26.6), recorded in design/.webkit-mode.json."
  - "Task 3 (tdd=\"true\") was executed as a genuine RED-then-GREEN cycle with two separate commits, not one combined commit: test(01-01) for the failing harness spec, feat(01-01) for the server/launcher implementation that turned it green."

patterns-established:
  - "design/.webkit-mode.json is the single source of truth every later spec/launcher reads to decide native vs. Docker WebKit — do not re-probe per-spec."
  - "design/scripts/pw.mjs is the only entry point for running Playwright specs in this project; it hides the native/Docker distinction from callers."

requirements-completed: [DSGN-02, I18N-07, PERF-07]

coverage:
  - id: D1
    description: "Owner-approved, exact-pinned toolchain installed with --ignore-scripts; no lifecycle scripts ran"
    requirement: "DSGN-02"
    verification:
      - kind: other
        ref: "node -p \"Object.values(require('./package.json').devDependencies).every(v => /^\\d+\\.\\d+\\.\\d+$/.test(v))\" -> true; @capsizecss/metrics pinned 4.2.0"
        status: pass
    human_judgment: false
  - id: D2
    description: "WebKit launch proven on this machine (native attempted, Docker fallback used) with mode/version recorded in design/.webkit-mode.json"
    requirement: "PERF-07"
    verification:
      - kind: integration
        ref: "npm run probe:webkit -> design/.webkit-mode.json {mode: docker, webkitVersion: 26.6}"
        status: pass
    human_judgment: false
  - id: D3
    description: "Static server enforces GET/HEAD only, binds loopback only, rejects literal and percent-encoded path traversal"
    requirement: "PERF-07"
    verification:
      - kind: e2e
        ref: "design/tests/harness.spec.ts — 6 tests (health, content-type, 3x traversal 404, POST 405)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared harness blocks third-party requests and seeds theme into localStorage before any page script runs"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "design/tests/harness.spec.ts — openPage blocks third-party requests; theme seeding test"
        status: pass
    human_judgment: false
  - id: D5
    description: "Harness spec passes green in both Chromium (native) and WebKit (via pinned Docker image) through the engine-aware pw.mjs launcher"
    requirement: "PERF-07"
    verification:
      - kind: e2e
        ref: "node design/scripts/pw.mjs --project=all design/tests/harness.spec.ts -> 9/9 passed in each engine"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-16
status: complete
---

# Phase 1 Plan 1: Package Legitimacy Gate, Toolchain Install & Test Harness Summary

**Owner-approved exact-pinned toolchain installed (Playwright, subset-font, Capsize, culori); WebKit proven on this Arch machine via the pinned Playwright Docker image (native launch fails, Docker succeeds — WebKit 26.6); hardened static mockup server and shared Playwright harness pass 9/9 tests in both engines.**

## Performance

- **Duration:** ~20 min (this continuation session; Task 1 checkpoint was presented and approved in a prior session)
- **Started:** 2026-09-16T18:20:00Z (approx.)
- **Completed:** 2026-09-16T18:35:00Z
- **Tasks:** 3/3 (Task 1 approval recorded; Task 2 install + probe; Task 3 server/config/launcher/harness)
- **Files modified:** 14 (package.json, package-lock.json, .gitignore, 3 design/scripts/*.mjs, playwright.config.ts, 3 design/tests/* files, 3 changelog entries, changelog/README.md)

## Accomplishments

- Owner approved all 8 pinned packages/images at the Task 1 legitimacy checkpoint (verbatim reply below); installed with `npm install --ignore-scripts`; no lifecycle scripts ran
- Proved WebKit runs on this Arch Linux machine: native launch fails (Ubuntu-targeted ICU build vs. this machine's ICU 78), pinned Docker fallback (`mcr.microsoft.com/playwright:v1.63.0-noble`) succeeds, WebKit 26.6 — mode and image digest recorded in `design/.webkit-mode.json`
- Built a hardened, dependency-free static file server (`design/scripts/serve-mockups.mjs`) that binds loopback-only, allows GET/HEAD only, and rejects literal and percent-encoded path traversal — proven via a genuine TDD red-then-green cycle
- Built the engine-aware launcher (`design/scripts/pw.mjs`) and shared harness (`design/tests/support/harness.ts`) every later phase-1 spec will import
- All 9 `@harness` tests pass in both Chromium (native) and WebKit (Docker) via `node design/scripts/pw.mjs --project=all`

## Legitimacy gate (Task 1)

**Owner's reply (recorded verbatim, from the orchestrator's continuation message):** "approved" — the owner (Jaime) explicitly approved all 8 items exactly as pinned:
1. `@playwright/test` 1.63.0
2. `subset-font` 2.7.0
3. `@capsizecss/core` 4.1.3
4. `@capsizecss/metrics` 4.2.0 (NOT 4.3.0)
5. `culori` 4.0.2
6. `wrangler` 4.130.0 via npx only (not in package.json)
7. Docker image `mcr.microsoft.com/playwright:v1.63.0-noble` (used — native WebKit launch failed)
8. Browser binaries via `npx playwright install chromium webkit`

`test ! -d node_modules` was true at the moment the gate was presented in the prior session (no install had run before approval). No package was rejected or substituted.

## Task Commits

Each task was committed atomically (Task 3 is `tdd="true"`, so it has separate RED/GREEN commits):

1. **Task 1: Package legitimacy gate** - no commit (checkpoint recording only; approval captured in this SUMMARY per the plan's `<output>` instruction)
2. **Task 2: Install pinned toolchain, prove WebKit via Docker fallback** - `d922094` (feat)
3. **Task 3a: Add failing harness spec (RED)** - `4a37436` (test)
3. **Task 3b: Implement static server + pw launcher (GREEN)** - `9dc92ee` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `package.json` - Root manifest, exact-pinned devDependencies, npm scripts (probe:webkit, test:e2e, serve:mockups)
- `package-lock.json` - Generated lockfile
- `.gitignore` - Added node_modules/, test-results/, playwright-report/, design/.cache/, design/.webkit-mode.json, design/fonts-src/, design/palette/reference/
- `design/scripts/probe-webkit.mjs` - Native-then-Docker WebKit launch probe; writes design/.webkit-mode.json
- `design/scripts/serve-mockups.mjs` - Hardened static file server, exports `startServer()`
- `design/scripts/pw.mjs` - Engine-aware Playwright test launcher (native chromium; native-or-docker webkit)
- `playwright.config.ts` - chromium + webkit projects, webServer wiring, JSON reporter
- `design/tests/support/harness.ts` - Shared exports: PAGES, pagesUnderTest, THEMES, WIDTHS, ZOOM_200, THEME_STORAGE_KEY, openPage, blockThirdParty
- `design/tests/harness.spec.ts` - 9 `@harness`-tagged tests proving the server and harness behavior
- `design/tests/fixtures/harness.html` - Minimal fixture page used by the spec
- `changelog/2026-09-16-1230_install-toolchain-webkit-docker-fallback.md`, `changelog/2026-09-16-1231_harness-spec-red.md`, `changelog/2026-09-16-1233_static-server-playwright-harness.md`, `changelog/README.md` - Changelog entries and index (via `/jja-commit`, per project CLAUDE.md — never bare `git commit`)

## Decisions Made

- Owner approved the exact pinned package/image list with no changes (see "Legitimacy gate" above).
- WebKit runs via the planned Docker fallback, not natively — this was anticipated in the plan's objective and RESEARCH.md, and is not a deviation.
- Task 3's TDD gate was honored literally: two commits (`test` then `feat`), not one combined commit, so the RED→GREEN sequence is visible in git history per the plan-level TDD gate enforcement rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a literal "0.0.0.0" substring from a code comment**
- **Found during:** Task 3, acceptance-criteria check
- **Issue:** `design/scripts/serve-mockups.mjs` had a comment explaining the server binds to loopback and "never 0.0.0.0" — this satisfied the intent but literally violated the plan's acceptance criterion `grep -c "0.0.0.0" design/scripts/serve-mockups.mjs is 0`, since grep matches comments too.
- **Fix:** Reworded the comment to describe the same security posture without the literal substring ("never a wildcard/all-interfaces host").
- **Files modified:** design/scripts/serve-mockups.mjs
- **Verification:** `grep -c "0.0.0.0" design/scripts/serve-mockups.mjs` now returns 0; both engines re-ran green after the edit.
- **Committed in:** `9dc92ee` (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug/textual-compliance fix)
**Impact on plan:** Cosmetic-only; no behavior change. No scope creep.

## Issues Encountered

- Native WebKit launch failed exactly as the plan anticipated (Arch Linux ICU 78 vs. Playwright's Ubuntu-targeted WebKit build). This is the documented, planned-for environment risk from 01-RESEARCH.md — not a surprise, and the Docker fallback path was exercised for real (not merely coded and left unverified).
- `npx playwright install` printed the expected "host system missing dependencies" warning for this non-Ubuntu OS; no dependency-install flag was used (it would have shelled out to `apt-get`, unavailable on Arch), per the plan.

## User Setup Required

None - no external service configuration required. Docker was already installed and the user already in the `docker` group (verified during planning).

## Next Phase Readiness

- `design/tests/support/harness.ts`, `design/scripts/pw.mjs`, and `playwright.config.ts` are ready for every later phase-1 plan (01-02 through 01-10) to import without touching config.
- `design/.webkit-mode.json` (gitignored, local machine state) tells every later spec run to route WebKit through Docker on this machine.
- No blockers for 01-02 (end-to-end tracer).

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 9 created/modified files verified present on disk; all 3 task commits (`d922094`, `4a37436`, `9dc92ee`) verified present in git history.

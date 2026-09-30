---
phase: 04-static-generation-templates-seo
plan: 10
subsystem: infra
tags: [cloudflare-workers-builds, ci-cd, deploy-hooks, incremental-build, ntfy, real-platform-spike]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-09's tools/ci-build.mjs wrapper, docs/phase-04/workers-builds-setup.md runbook, the experimental.incrementalBuild flag seam, and its own local REUSE_WARM_ONLY finding (superseded by this plan's real-platform measurement); 04-06's mandatory --config wrangler.jsonc deploy fix"
provides:
  - "A connected, real Workers Builds pipeline (915tldr-frontend repo -> 915tldr-v2 Worker), proven end-to-end across 4 real builds with measured cold/warm timings"
  - "WB_COLD_FITS verdict: a cold Workers Builds build (649s) comfortably fits inside the 20-minute hard ceiling"
  - "WB_REUSE_PROVEN verdict: experimental.incrementalBuild DOES reuse pages on a genuinely fresh Workers Builds container (>=34,871/~60,349 pages), overturning 04-09's local REUSE_WARM_ONLY assumption, with an evidence-grounded explanation for the discrepancy"
  - "A real, diagnosed cost-relevant finding for 04-11: near-total asset re-upload on any commit change, caused by an unconditional BUILD_HASH footer stamp (src/layouts/Base.astro), not fixed in this plan"
  - "Two real production bugs found and fixed in tools/ci-build.mjs's D-15 failure-notification path (classifyFailure misattribution; ntfy Title header ByteString crash)"
affects: [04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 18101
  tasks: 2
  commits: 9

tech-stack:
  added: []
  patterns:
    - "classifyFailure() now anchors on this codebase's own `${moduleName}: ${message}` throw convention (falling back to loose substring matching) rather than a bare substring-anywhere scan, avoiding misattribution to benign command-echo/passing-test lines that happen to mention a check's name"
    - "toHeaderSafe() normalizes typographic punctuation and strips non-Latin1 characters before any value is used as an HTTP header, since this codebase's own error messages routinely contain em-dashes that crash undici's fetch() header construction otherwise"
    - "A temporary, clearly-labeled, self-reverting commit (not a dashboard variable) is the safe way to toggle an experimental flag for a spike on one branch, when the platform's build variables turn out not to be branch-scoped"

key-files:
  created: []
  modified:
    - docs/phase-04/workers-builds-setup.md
    - docs/phase-04/build-measurements.md
    - tools/ci-build.mjs
    - tests/unit/ci-build.test.mjs
    - astro.config.mjs
    - .planning/STATE.md

key-decisions:
  - "The dashboard's build variables are NOT branch-scoped on this account (contradicting the setup doc's original assumption) — ASTRO_INCREMENTAL_BUILD could not be set there without also reaching main ahead of 04-11's decision. Worked around with a temporary, clearly-labeled, self-reverting commit (cc1b050, reverted in 99795e3) instead."
  - "classifyFailure()'s original 'first substring match anywhere in the line' logic is a real bug, not just a theoretical one — a live D-15 drill immediately misattributed a real failure to an unrelated command echo. Fixed by anchoring on this codebase's own throw convention first."
  - "toHeaderSafe() added after the classifyFailure fix immediately surfaced a WORSE bug: a corrected, accurate failure title containing an em-dash crashed the entire ci-build process via an HTTP ByteString error. Both bugs were only found because the drill used a real failure message in this codebase's real prose style, not a synthetic ASCII fixture."
  - "WB_REUSE_PROVEN (this plan) supersedes 04-09's local WB_REUSE-adjacent REUSE_WARM_ONLY finding as the working assumption for 04-11 — a real Workers Builds container restores both a dependencies cache and a build-output cache from the prior build, which 04-09's local fresh-clone simulation never fully reproduced (it only manually copied the build-output half after a fresh pnpm install)."
  - "The near-total asset-reupload finding (BUILD_HASH unconditionally in every page's footer) is reported, not fixed — a footer-stamp design question belongs to 04-11's owner decision, not a mechanical bug fix in this plan."

patterns-established:
  - "When a real end-to-end drill immediately exposes a bug in code just fixed one line prior (classifyFailure -> toHeaderSafe), re-run the SAME drill again after each fix rather than trusting the fix in isolation — the second real bug here was found only because the drill was re-run, not because it was anticipated."

requirements-completed: [REND-04, REND-05, OPS-10]

coverage:
  - id: D1
    description: "A hook-triggered Workers Builds build runs pnpm run build:ci and completes, with duration, loader mode and D1 rows read recorded (OPS-10 trigger path proven on the real platform)"
    requirement: "OPS-10"
    verification:
      - kind: other
        ref: "Build 1 (build_uuid 3e06378e...): SUCCESS, 649s total, mode=cold rowsRead=508421, deployed version confirmed carrying the real Worker fetch handler + redirects — docs/phase-04/build-measurements.md 'Workers Builds spike' section"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second hook-triggered build restores the build cache and reports a warm loader mode, proving the Content Layer store survives between Workers Builds runs (D-06)"
    requirement: "OPS-10"
    verification:
      - kind: other
        ref: "Build 2 (build_uuid cf85732b...): dependencies + build-output cache restored, mode=warm+sweep rowsRead=48748 — docs/phase-04/build-measurements.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whether experimental.incrementalBuild reuses unchanged pages on Workers Builds is recorded as WB_REUSE_PROVEN or WB_REUSE_ABSENT"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "Build 4 (build_uuid 6c35446d...): >=34,871/~60,349 pages restored on a genuinely fresh Workers Builds container, 147s total (vs Build 3's 554s) — verdict WB_REUSE_PROVEN, docs/phase-04/build-measurements.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether a cold build fits comfortably inside the 20-minute Workers Builds limit is recorded as WB_COLD_FITS or WB_COLD_EXCEEDS"
    requirement: "REND-04"
    verification:
      - kind: other
        ref: "Build 1: 649s (10.8min) < 900s (15min) threshold, ~9.2min margin to the 20min hard ceiling — verdict WB_COLD_FITS, docs/phase-04/build-measurements.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "A deliberately failing build delivers an ntfy push naming the failed check, observed by reading the topic back (D-15)"
    requirement: "REND-04"
    verification:
      - kind: other
        ref: "Local drill (Workers Builds variable-edit access not granted, per plan's own fallback): three real runs, two real bugs found/fixed (classifyFailure misattribution, ntfy Title ByteString crash), final run delivers a correctly-titled, correctly-sanitized ntfy push, confirmed by reading the real topic back — docs/phase-04/build-measurements.md; unit tests tests/unit/ci-build.test.mjs (25/25 pass)"
        status: pass
      - kind: other
        ref: "In-container (real Workers Builds) notification path itself remains unproven — explicitly flagged for the 04-12 human-check, per this plan's own documented fallback for when dashboard variable-edit access isn't granted"
        status: unknown
    human_judgment: true
    rationale: "The local drill fully proves the notification LOGIC (classify/redact/sanitize/deliver) against the real ntfy service, but running the exact drill mechanism (a variable-edit-triggered failure) inside a real Workers Builds container was not possible in this session — 04-12 should confirm the in-container path if it becomes possible."

duration: ~2h45min (active) across two sessions separated by an overnight pause (2026-09-27 22:58 MDT start, 23:35 MDT session-1 stop; resumed 2026-09-30 for Builds 3-4)
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 10: Workers Builds Connection and Real-Platform Spike Summary

**A real, hook-triggered Workers Builds pipeline measured across 4 production builds — cold build fits comfortably inside the 20-minute ceiling (`WB_COLD_FITS`, 649s), and `experimental.incrementalBuild` genuinely reuses pages on a fresh Workers Builds container (`WB_REUSE_PROVEN`, ≥34,871/~60,349 pages), overturning 04-09's local `REUSE_WARM_ONLY` finding — plus two real D-15 notifier bugs found and fixed, and a new cost-relevant asset-dedup finding flagged for 04-11.**

## Performance

- **Duration:** ~2h45min of active work, spanning two sessions separated by an overnight pause (owner completed Task 1's checkpoint 2026-09-27 ~22:58 MDT; Task 2 ran 2026-09-27 23:00–23:35 MDT for Builds 1-2 and the D-15 drill, paused overnight pending the owner's push decision, resumed 2026-09-30 ~15:00–15:30 MDT for Builds 3-4)
- **Started:** 2026-09-27T22:58:00-06:00 (owner Task 1 completion)
- **Completed:** 2026-09-30T15:27:00-06:00
- **Tasks:** 2 (Task 1: owner checkpoint, completed by the owner; Task 2: the Workers Builds spike)
- **Files modified:** 6 substantive files (docs/phase-04/workers-builds-setup.md, docs/phase-04/build-measurements.md, tools/ci-build.mjs, tests/unit/ci-build.test.mjs, astro.config.mjs, .planning/STATE.md)

## Accomplishments

- Connected `915tldr-frontend` (GitHub) to the real `915tldr-v2` Worker via Cloudflare Workers Builds — the first time this project's delivery pipeline (D-01 through D-04) has run on the real platform rather than local `wrangler deploy`.
- Measured **Build 1 (cold, first-ever connection):** 649s total (hook POST → deployed version), D1 loader `mode=cold rowsRead=508421`, 59,977 pages in 6m11s, deploy uploaded 59,985 assets in 3m46s. Confirmed 04-06's mandatory `--config wrangler.jsonc` deploy fix holds on the real platform (the deployed Worker carries its real `fetch` handler and `_redirects` rules). **Verdict: `WB_COLD_FITS`** (10.8min, ~9.2min margin to the 20min hard ceiling).
- Measured **Build 2 (warm, no toggle):** ~237s total, dependencies + build-output cache restored (D-06 confirmed on the real platform), D1 loader `mode=warm+sweep rowsRead=48748`.
- Ran the **D-15 failure-notification drill locally** (owner did not grant dashboard variable-edit access, per the plan's own documented fallback) and found **two real production bugs** in `tools/ci-build.mjs` along the way: `classifyFailure()` was misattributing a real failure to a benign command-echo line, and the corrected title then crashed the entire process via an HTTP header `ByteString` `TypeError` on an em-dash. Both fixed, tested (25/25 unit, 383/383 full suite), and re-verified end-to-end against the real ntfy topic.
- After the owner pushed a prepared, clearly-labeled temporary commit (`cc1b050`, hardcoding `incrementalBuild=true` since the dashboard's build variables turned out not to be branch-scoped), measured **Build 3 (flag-on, first toggle):** cold again as 04-09 already documented (config-change reset, not a bug), 0/60,349 pages restored (expected — first build since the toggle). Found and root-caused a new cost-relevant finding: the deploy re-uploaded 60,355/60,355 assets (only 7 deduplicated), traced to `src/layouts/Base.astro` unconditionally printing the build's commit hash in every page's footer, defeating content-hash asset dedup on any code push — reported, not fixed (Rule 4 — a product decision for 04-11).
- Measured **Build 4 (flag-on, no toggle — the real reuse test):** confirmed ≥34,871/~60,349 pages restored via `experimental.incrementalBuild` on a genuinely fresh Workers Builds container (truncated log, disclosed as a lower bound), wall time collapsing to 147s from Build 3's 554s. **Verdict: `WB_REUSE_PROVEN`** — this contradicts and supersedes 04-09's local fresh-clone simulation (which found zero reuse), with an evidence-grounded explanation: Workers Builds restores both a dependencies cache (full `node_modules`) and a build-output cache (`node_modules/.astro`) from the same prior build, while 04-09's local simulation only ever reproduced the build-output half after a fresh `pnpm install`.
- Reverted the temporary `incrementalBuild=true` hardcode back to the env-var seam (default off) once both spike builds completed.
- Recorded account limits (6,000 build-min/month, Paid, account-wide; 6 concurrent; 20min timeout) and the owner's cost-tolerance input for 04-11 ("$0 to $5 per month is acceptable, but I would definitely want to look into optimizing later").

## Task Commits

1. **Task 1: Owner connects the public repository to Workers Builds and creates the Deploy Hooks** — completed by the owner (Jaime), 2026-09-27 ~22:58 MDT. No code commit; verified via `git remote -v`, `.dev.vars`, and the Workers Versions API showing a real repository connection.
2. **Task 2: Workers Builds spike — cold build, warm rebuild, page reuse, failure notification**:
   - `8decb68` (docs) — fix workers-builds-setup.md's non-production deploy command missing `--config wrangler.jsonc`
   - `8df3200` (fix) — `classifyFailure` no longer misattributes failures to benign lines
   - `f0218b0` (fix) — sanitize ntfy `Title` header to prevent `ByteString` crash
   - `cc1b050` (chore) — TEMPORARY hardcode `incrementalBuild=true` for the spike (reverted below)
   - `d854420` (docs) — record Build 1-2 measurements, D-15 drill writeup
   - `e95a734` (docs) — record overnight blocker (STATE.md)
   - `b131f1f` (docs) — record Build 3 and the asset-dedup finding
   - `49e4226` (docs) — record Build 4 and the `WB_REUSE_PROVEN` verdict
   - `99795e3` (revert) — revert the temporary `incrementalBuild=true` hardcode

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `docs/phase-04/workers-builds-setup.md` — corrected the non-production deploy command flag
- `docs/phase-04/build-measurements.md` — new "Workers Builds spike" section: Builds 1-4, the D-15 drill, account limits, the owner's cost input, the asset-dedup finding, and both verdict tokens
- `tools/ci-build.mjs` — `classifyFailure()` anchored on the real throw convention; `toHeaderSafe()` added
- `tests/unit/ci-build.test.mjs` — regression tests for both fixes (25/25 pass)
- `astro.config.mjs` — temporarily hardcoded `incrementalBuild=true`, then reverted to the env-var seam
- `.planning/STATE.md` — recorded and later resolved the overnight blocker

## Decisions Made

See `key-decisions` in frontmatter above — summarized: the dashboard's build variables are not branch-scoped on this account (worked around with a temporary, self-reverting commit); `classifyFailure` now anchors on this codebase's own throw convention; `toHeaderSafe` sanitizes HTTP header values; `WB_REUSE_PROVEN` supersedes 04-09's local finding as the working assumption for 04-11; the asset-dedup finding is reported, not fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `classifyFailure()` misattributed a real build failure to a benign line**
- **Found during:** Task 2, the D-15 failure-notification drill (first local run)
- **Issue:** The original "first line containing a `CHECK_PATTERNS` substring anywhere" logic picked a shell command echo (`$ node --test tests/ci-fixtures/assert-no-d1.test.mjs`) over the real failing line, because `assert-no-d1` is both a pattern name and the literal filename of an earlier, successful build step.
- **Fix:** Anchored the match on this codebase's own `${moduleName}: ${message}` throw convention first, falling back to the old substring scan.
- **Files modified:** `tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`
- **Verification:** New regression test using real log lines from the actual failing local build; 20/20 unit tests pass (post-fix); full suite 378/378 pass.
- **Committed in:** `8df3200`

**2. [Rule 1 - Bug] The corrected failure title crashed the entire ci-build process**
- **Found during:** Task 2, the D-15 drill (second local run, immediately after fix #1)
- **Issue:** The now-correct title contains an em-dash (this codebase's routine punctuation style); undici's `fetch()` throws an uncaught `TypeError: Cannot convert argument to a ByteString` for any HTTP header value with a code point above 255 — crashing the whole process and defeating D-15's "never fails silently" guarantee at the exact moment it mattered.
- **Fix:** Added `toHeaderSafe()` — normalizes em/en-dash, curly quotes, ellipsis to ASCII, strips anything else outside Latin1; applied to the `Title` header only (the POST body keeps full UTF-8).
- **Files modified:** `tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`
- **Verification:** New `toHeaderSafe` unit tests (including the exact real crashing message, round-tripped through a real `Headers` object); a third real local drill run confirmed clean exit + correct sanitized ntfy delivery. 25/25 unit, 378/378 full suite (then 383/383 after later doc-only commits added no new tests).
- **Committed in:** `f0218b0`

**3. [Rule 4 - Architectural, reported not fixed] Near-total asset re-upload on any commit change**
- **Found during:** Task 2, reviewing Build 3's deploy output (60,355/60,355 assets uploaded, only 7 deduplicated)
- **Issue:** `src/layouts/Base.astro` unconditionally prints `BUILD_HASH` in every page's footer regardless of `stamp` mode; `BUILD_HASH` changes whenever the underlying commit changes, altering the raw bytes of every page and defeating Cloudflare's content-hash asset-upload dedup on any code push.
- **Decision:** Not fixed in this plan — this is a product/design question (should an unchanged article's footer show a stable stamp, at the cost of not reflecting the exact deploying commit?) belonging to 04-11's owner decision, not a mechanical bug. Reported in full, root-caused to exact source lines, with an open question about whether it also affects same-commit steady-state rebuilds.
- **Files modified:** None (reported only)
- **Committed in:** `b131f1f` (documentation of the finding)

---

**Total deviations:** 2 auto-fixed (Rule 1 — both real production bugs in the D-15 notification path, found only via real drills using this codebase's actual prose style), 1 reported-not-fixed (Rule 4 — a cost-relevant design question deferred to 04-11).
**Impact on plan:** Both Rule 1 fixes were necessary for D-15's own must-have (an ntfy push that actually names the failed check) to genuinely work — no scope creep, both stayed inside `tools/ci-build.mjs`'s notification path. The Rule 4 finding correctly stayed a report, not a fix, since altering `Base.astro`'s footer stamp is a visible product decision outside this plan's scope.

## Issues Encountered

- **Tooling constraint:** The `cloudflare-builds` MCP tool named in this plan's execution context was not available to this executor directly; direct Cloudflare API fallback also failed (`403 Forbidden`, insufficient "Workers CI Read" token scope). Resolved via the orchestrator, which did have MCP access and relayed build logs/results throughout Task 2 — documented as the actual working arrangement, not hidden.
- **Two build logs (Build 2, Build 4) returned truncated** by the Workers Builds API before their closing lines. Total wall times for those builds were independently derived from the Workers Versions API's `created_on` timestamps instead, disclosed explicitly in `build-measurements.md` rather than presented as complete log-derived figures.
- **Cross-session pause:** Task 2 could not complete in one sitting because Deploy Hooks build whatever is on GitHub's `feature/phase-04` tip, and this session cannot push (project git rules reserve pushes for the owner via lazygit). Task 2 paused overnight with a `STATE.md` blocker and a ready-to-push commit (`cc1b050`); the owner pushed it the next day, unblocking Builds 3-4.

## Known Stubs

None. Every artifact this plan touched (`tools/ci-build.mjs`'s two fixes, `docs/phase-04/build-measurements.md`'s spike section) is real, measured against the real Workers Builds platform and real ntfy delivery — no mocked or placeholder data.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-04-39 through T-04-42 — public repo secret scan, Deploy Hook URL handling, build-token scope, fork-PR build settings) — all verified clean throughout (no hook URL or ntfy topic value leaked into any committed file, confirmed by grep before every relevant commit).

## User Setup Required

None new — Task 1's setup (the public repo, the Workers Builds connection, the Deploy Hooks, `.dev.vars`) was the owner's own completed action, already recorded as owner-completed in this plan's checkpoint context.

## Next Phase Readiness

- **04-11** (the `experimental.incrementalBuild` production decision) now has: the real-platform `WB_REUSE_PROVEN` verdict (superseding 04-09's local `REUSE_WARM_ONLY` assumption), the `WB_COLD_FITS` cold-build timing, the account cost/limits picture, the owner's cost-tolerance input, AND the new asset-dedup finding (a real cost multiplier on top of whatever incremental-build decision is made) — everything needed for that decision.
- **04-12** should confirm the in-container (real Workers Builds) D-15 notification path, since this plan's drill only proved it locally (owner didn't grant dashboard variable-edit access) — flagged explicitly in coverage item D5.
- The temporary `incrementalBuild=true` commit (`cc1b050`) and its revert (`99795e3`) both exist locally on `feature/phase-04`, not yet pushed — pushing them is not required for this plan to be complete, only for Workers Builds to reflect the reverted (default-off) state on its next real build.
- `astro.config.mjs`'s flag remains OFF by default, matching 04-09's original intent — no production behavior changed by this plan.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 9 claimed commit hashes (`8decb68`, `8df3200`, `f0218b0`, `cc1b050`, `d854420`, `e95a734`, `b131f1f`, `49e4226`, `99795e3`) confirmed present via `git log --oneline`. All claimed files (`docs/phase-04/workers-builds-setup.md`, `docs/phase-04/build-measurements.md`, `tools/ci-build.mjs`, `tests/unit/ci-build.test.mjs`, `astro.config.mjs`, `.planning/STATE.md`) confirmed present on disk with the described changes. Both required verdict tokens (`WB_COLD_FITS`, `WB_REUSE_PROVEN`) confirmed present in `docs/phase-04/build-measurements.md` via grep. Full test suite re-run: 383/383 passing after the final revert commit.

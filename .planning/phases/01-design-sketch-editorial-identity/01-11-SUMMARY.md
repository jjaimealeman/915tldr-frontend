---
phase: 01-design-sketch-editorial-identity
plan: 11
subsystem: testing
tags: [pnpm, playwright, package-manager, gap-closure, d-gap-d]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-10: the D-16 approval packet, owner review, and the revise decision that produced the 14-item closure table this plan (D-GAP-D) closes one row of"
provides:
  - "design/scripts/pw.mjs launches node_modules/@playwright/test/cli.js directly via node — host Chromium, host WebKit native, and Docker WebKit all closed to the registry-fetch path"
  - "package.json packageManager: pnpm@11.26.0"
  - "pnpm-lock.yaml tracked; package-lock.json untracked and gitignored (on disk, awaiting owner deletion)"
  - "01-VALIDATION.md, verify-approval.mjs, serve-mockups.mjs, check-contrast.mjs, build-palette.mjs all name pnpm in every user-facing command string"
  - ".planning/phases/01-design-sketch-editorial-identity/01-10-SUMMARY.md: the retroactively-written record that Phase 1 round 1 ended on outcome: revise"
affects: [01-12, 01-13, 01-14, 01-15, 01-16, 01-17, 01-18, 01-19, 01-20, 01-21, 01-22, 01-23]

actuals:
  tokens: 16400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A package runner (npx/pnpm exec/etc.) can silently fetch from the registry when the local binary is missing; calling `node` directly on the resolved path to a local CLI file (node_modules/@playwright/test/cli.js) removes that fetch path structurally — it either finds the file or fails loudly with exit 2. Applied to all three Playwright launch paths (host Chromium, host WebKit, Docker WebKit)."

key-files:
  created: []
  modified:
    - package.json
    - design/scripts/pw.mjs
    - pnpm-lock.yaml
    - .gitignore
    - package-lock.json
    - .planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md
    - design/scripts/verify-approval.mjs
    - design/scripts/serve-mockups.mjs
    - design/scripts/check-contrast.mjs
    - design/scripts/build-palette.mjs
    - design/evidence/contrast.md
    - .planning/phases/01-design-sketch-editorial-identity/01-10-SUMMARY.md

key-decisions:
  - "Lockfile parity was checked with a throwaway, read-only Node script kept in the session scratchpad (never committed) rather than any install command — 16/16 packages identical (name, version, integrity) between package-lock.json and pnpm-lock.yaml, confirming no new package entered the tree."
  - "package-lock.json was removed from the git index only (git rm --cached) and left on disk; its on-disk deletion is listed below for the owner, per the plan's never-delete-files rule."
  - "01-10-SUMMARY.md was written retroactively in Task 3 to close a genuine planning gap: 01-10 completed both its checkpoints (owner review, owner decision) but never produced its own plan-level summary at the time."

requirements-completed: [DSGN-01]

coverage:
  - id: D1
    description: "pnpm is the project's single package manager: package.json declares packageManager pnpm@11.26.0, pnpm-lock.yaml is tracked, and package-lock.json is untracked and ignored"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "git ls-files pnpm-lock.yaml (present); git ls-files --error-unmatch package-lock.json (exits 1); git check-ignore -q package-lock.json (exits 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pnpm-lock.yaml resolves the same 16 name@version@integrity triples as the owner-approved package-lock.json — no new package entered the dependency tree"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "read-only scratchpad parity script (session-local, not committed): npmCount 16, pnpmCount 16, identical: true"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Playwright launch (Chromium native, WebKit native, WebKit in Docker) runs the local @playwright/test CLI directly with node, never through a package runner that can fetch from the registry"
    requirement: "DSGN-01"
    verification:
      - kind: e2e
        ref: "pnpm run verify:phase-1 --pages=index --criteria=1,2 — SCOPED RUN, criteria 1 and 2 PASS in Chromium and WebKit (Playwright 26.6, docker)"
        status: pass
    human_judgment: false
  - id: D4
    description: "User-facing tool output and 01-VALIDATION.md name pnpm commands; 01-01..01-10 plans/summaries left untouched as historical records"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "grep for npm run/npx across verify-approval.mjs, serve-mockups.mjs, check-contrast.mjs, build-palette.mjs, 01-VALIDATION.md — none remain; git diff --stat confirms no 01-0N-PLAN.md/SUMMARY.md touched"
        status: pass
    human_judgment: false
  - id: D5
    description: "01-10-SUMMARY.md exists, says Phase 1 is NOT approved, and maps all 14 round-1 items to gap plans 01-11..01-23"
    requirement: "DSGN-01"
    verification:
      - kind: other
        ref: "01-10-SUMMARY.md contains the literal sentence 'Phase 1 is NOT approved.', outcome: revise, and a 14-row closure table naming 01-11 through 01-23"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 11: pnpm End to End (D-GAP-D) Summary

**Closed owner decision D-GAP-D: pnpm is now the project's sole, proven package manager — package.json pins `packageManager: pnpm@11.26.0`, pnpm-lock.yaml is tracked and verified 16/16 identical to the retired package-lock.json, every Playwright launch (including Docker WebKit) runs the local CLI directly via `node` instead of a package runner, and 01-10-SUMMARY.md finally records that Phase 1 round 1 ended on outcome: revise.**

## Performance

- **Duration:** ~55 min (Tasks 1-3)
- **Started:** 2026-09-17
- **Completed:** 2026-09-17
- **Tasks:** 3 (all complete)
- **Files modified:** 12

## Accomplishments

- Lockfile parity proven read-only, no install run: 16/16 packages identical (name, version, integrity) between `package-lock.json` and `pnpm-lock.yaml`.
- `design/scripts/pw.mjs` rewritten so all three Playwright launch paths (host Chromium, host WebKit native, Docker WebKit) call `node node_modules/@playwright/test/cli.js` directly, closing the package-runner registry-fetch path (T-01-35) structurally rather than by convention.
- `package.json` pins `"packageManager": "pnpm@11.26.0"`; every other field byte-identical to before.
- `pnpm run verify:phase-1 --pages=index --criteria=1,2` passed (SCOPED RUN, both criteria PASS in Chromium and WebKit) through the new pnpm-driven local-CLI launcher, and `node --test design/tests/unit/check-contrast.test.mjs` passed 17/17.
- `package-lock.json` removed from the git index (kept on disk) and added to `.gitignore`; `01-VALIDATION.md` fully converted to pnpm command wording plus a new Package manager row.
- `verify-approval.mjs`, `serve-mockups.mjs`, `check-contrast.mjs`, `build-palette.mjs` all now name `pnpm run <script>` in their user-facing strings; `design/evidence/contrast.md` regenerated with only the wording line changed.
- `01-10-SUMMARY.md` written retroactively: `outcome: revise`, the literal sentence "Phase 1 is NOT approved.", the full 14-item closure table mapping every round-1 item to its gap-closure plan, the `pnpm run verify:approval` output, and confirmation that no `Approved-by:` line was ever written or altered.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): pnpm end to end — lockfile parity → local Playwright CLI → one scoped run in both engines** - `841cc09` (feat)
2. **Task 2: Retire package-lock.json from git and move the validation contract to pnpm** - `b30577c` (chore)
3. **Task 3: pnpm wording in tool output, and the 01-10 record (not approved)** - `4068a78` (docs)

## Files Created/Modified

- `package.json` - `packageManager: pnpm@11.26.0` pin
- `design/scripts/pw.mjs` - all three launch paths now call the local Playwright CLI via `node`, never a package runner
- `pnpm-lock.yaml` - tracked for the first time (16/16 identical to package-lock.json)
- `.gitignore` - `package-lock.json` now ignored, with a dated owner-decision comment
- `package-lock.json` - removed from the git index only; stays on disk
- `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md` - every command rewritten to pnpm form; new Package manager row
- `design/scripts/verify-approval.mjs`, `serve-mockups.mjs`, `check-contrast.mjs`, `build-palette.mjs` - user-facing strings renamed to `pnpm run`
- `design/evidence/contrast.md` - regenerated; only the footer wording changed
- `.planning/phases/01-design-sketch-editorial-identity/01-10-SUMMARY.md` - retroactive record: outcome revise, closure table, verify:approval output

## Decisions Made

- Verified lockfile parity offline with a throwaway scratchpad script rather than any install/dlx command, per the plan's supply-chain gate (T-01-01) and the standing rule against running anything that can reach the npm registry.
- Left `design/scripts/lib/d1-read.mjs`'s own `npx wrangler` call unchanged (out of scope — no gap plan runs it; flagged as a Phase 3 follow-up in 01-10-SUMMARY.md).
- Did not touch `.planning/phases/01-design-sketch-editorial-identity/01-13-PLAN.md`, `01-14-PLAN.md`, or `01-23-PLAN.md`, which were already modified in the working tree before this plan started (pre-existing, unrelated edits about `docs/PRD.md` tracking) — left untouched and uncommitted, out of this plan's scope.

## Deviations from Plan

None - plan executed exactly as written. The three tasks' acceptance criteria all passed on the first attempt; no auto-fixes were needed.

## Issues Encountered

- Pre-existing uncommitted modifications were found in `01-13-PLAN.md`, `01-14-PLAN.md`, and `01-23-PLAN.md` (referencing a decision that `docs/PRD.md` is now tracked) that predate this session and are unrelated to D-GAP-D. Left as-is; not staged or committed by this plan.

## Known Stubs

None - no stub data or placeholder UI was introduced. This plan is toolchain/dependency-manager only.

## Cleanup needed (for the owner)

```
rm package-lock.json
```

The file is retired from git tracking (removed from the index, ignored going forward) but was never deleted from disk, per the plan's standing rule against the executor deleting files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-GAP-D is closed. Every later gap-closure plan (01-12 through 01-23) can run the Playwright harness through pnpm without any registry-fetch path in the launcher.
- STATE.md reflects that 01-10 finished on the revise branch (via the retroactive 01-10-SUMMARY.md).
- Follow-up for Phase 3: `design/scripts/lib/d1-read.mjs` still invokes `wrangler` through `npx`; pin `wrangler` as a real devDependency before that tool runs again.
- Pre-existing uncommitted edits in `01-13-PLAN.md`, `01-14-PLAN.md`, `01-23-PLAN.md` (docs/PRD.md tracking) remain in the working tree, untouched by this plan, for whoever executes those plans next to reconcile.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 12 modified files found on disk (or absent-as-expected for package-lock.json's index removal); all 3 commits (841cc09, b30577c, 4068a78) found in git log.

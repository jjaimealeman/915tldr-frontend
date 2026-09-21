---
phase: 02-content-quality-grounding
plan: 01
subsystem: infra
tags: [wrangler, pnpm, cloudflare-d1, linkedom, readability, js-tiktoken, dependencies]

# Dependency graph
requires: []
provides:
  - "wrangler declared as a real devDependency in 915tldr.com2, resolving from node_modules/.bin (FIX-02 closed)"
  - "linkedom, @mozilla/readability, js-tiktoken installed at audited, pinned versions"
  - "Proven authenticated production D1 read path via CLOUDFLARE_API_TOKEN, documented in docs/phase-02/d1-access.md"
  - "Baseline production articles row count (41,896) recorded for later Phase 2 measurement tasks"
affects: [02-content-quality-grounding, D-04, D-16, CONT-12, CONT-09]

# Actuals (#2632)
actuals:
  tokens: 3900
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: [wrangler@4.135.0, linkedom@0.18.13, "@mozilla/readability@0.6.0", js-tiktoken@1.0.21]
  patterns:
    - "Package-legitimacy blocking checkpoint before any pnpm add of a SUS/unaudited package"
    - "pnpm approve-builds persisted into pnpm-workspace.yaml's allowBuilds map for transitive native-postinstall deps (workerd), matching the project's existing sharp/unrs-resolver/vue-demi pattern"

key-files:
  created:
    - 915tldr.com2/docs/phase-02/d1-access.md
    - 915tldr.com2/changelog/2026-09-19-1209_pin-phase-2-dependencies-and-fix-wrangler-devdep.md
    - 915tldr.com2/changelog/2026-09-19-1215_prove-production-d1-access-and-record-baseline.md
  modified:
    - 915tldr.com2/package.json
    - 915tldr.com2/pnpm-lock.yaml
    - 915tldr.com2/pnpm-workspace.yaml
    - 915tldr.com2/changelog/README.md

key-decisions:
  - "openai left pinned at existing ^6.15.0 per explicit owner decision (not bumped to 7.x) — Batch API surface is stable across the major boundary and a version bump mid-phase was ruled out as an unwanted variable"
  - "workerd's postinstall script approved via pnpm approve-builds after confirming it is Cloudflare's own package (github.com/cloudflare/workerd, wrangler-publisher/workers-devprod org) — same trust tier as the already human-approved wrangler, and required for wrangler's tooling to function at all"
  - "Authentication used the ambient CLOUDFLARE_API_TOKEN env var (already present and valid in this environment) rather than an interactive wrangler login"

patterns-established:
  - "Production D1 reads always go through wrangler d1 execute <db> --remote --json, parsing rows from data[0].results (matches the project's existing scripts/sync-prod-to-dev.sh) — never the local Miniflare replica for measurement"

requirements-completed: [FIX-02]

coverage:
  - id: D1
    description: "wrangler declared as a real devDependency, resolving from node_modules/.bin with no global install (FIX-02)"
    requirement: "FIX-02"
    verification:
      - kind: unit
        ref: "test -x node_modules/.bin/wrangler && node_modules/.bin/wrangler --version (printed 4.135.0)"
        status: pass
      - kind: integration
        ref: "pnpm install --frozen-lockfile (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "linkedom, @mozilla/readability, js-tiktoken installed at audited, pinned versions approved by the owner"
    verification:
      - kind: unit
        ref: "node -e dependency-presence check against package.json (all four keys present)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Authenticated production D1 read proven working, live row count recorded (41,896, not the 87-row local replica)"
    verification:
      - kind: integration
        ref: "wrangler d1 execute 915tldr-db --remote --command 'SELECT COUNT(*) AS n FROM articles' --json (returned n=41896, served_by: v3-prod)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 1: Toolchain Access — wrangler Dependency Fix and Production D1 Proof Summary

**Closed FIX-02 by declaring `wrangler` a real devDependency, installed the three audited Phase 2 packages (`linkedom`, `@mozilla/readability`, `js-tiktoken`) at pinned versions, and proved an authenticated production D1 read returns the real 41,896-row corpus instead of the stale 87-row local Miniflare replica.**

## Performance

- **Duration:** 12 min (12:10 to 12:22 local, from first commit to SUMMARY write)
- **Started:** 2026-09-19T18:10:09Z (first task commit)
- **Completed:** 2026-09-19T18:11:30Z (last task commit)
- **Tasks:** 2/2 (Task 1 was a blocking-human checkpoint, approved before this continuation; Task 2 was the auto-executed install + proof task)
- **Files modified:** 7 (package.json, pnpm-lock.yaml, pnpm-workspace.yaml, changelog/README.md, 2 new changelog entries, 1 new docs file)

## Accomplishments
- `wrangler@4.135.0` added to `devDependencies`, resolving from `node_modules/.bin` — closes FIX-02, which blocked `pnpm deploy`/`pnpm deploy:dev` from guaranteeing a locally pinned binary
- `linkedom@0.18.13`, `@mozilla/readability@0.6.0`, `js-tiktoken@1.0.21` installed at the exact versions approved in the Task 1 checkpoint
- Authenticated production D1 read proven: `wrangler d1 execute 915tldr-db --remote --command "SELECT COUNT(*) AS n FROM articles" --json` returned `n: 41896`, `served_by: "v3-prod"` — confirmed against the real corpus, not a cache or local replica
- Local Miniflare replica confirmed stale for contrast: 87 rows, mtime 2025-12-21 (481x smaller, ~9 months old)
- `docs/phase-02/d1-access.md` written recording package versions, the exact (credential-redacted) command, the live row count, and a binding rule that all later Phase 2 measurement tasks must use the remote path

## Task Commits

Both commits land in the code repo `915tldr.com2` (this plan touches no files in the planning repo except this SUMMARY and STATE.md, the latter owned by the orchestrator), branch `feature/phase-02`:

1. **Task 1: Package legitimacy confirmation before any install** — checkpoint, no commit (human approved "approved" with the explicit openai-pin decision, resolved by the prior executor run/orchestrator before this continuation began)
2. **Task 2, part A: Install pinned dependencies (FIX-02)** — `219cbd0` (fix) — `915tldr.com2`
3. **Task 2, part B: Prove authenticated production D1 reads** — `9cbb87d` (docs) — `915tldr.com2`

**Plan metadata:** this SUMMARY.md commit (planning repo `915tldr.com`)

_Note: Task 2's single `<action>` block naturally split into two atomic commits — the dependency/tooling change and the D1-access proof/documentation — rather than one commit conflating an infra fix with a proof-of-access report._

## Files Created/Modified

**915tldr.com2 (code repo):**
- `package.json` — added `wrangler` devDependency, `linkedom`/`@mozilla/readability`/`js-tiktoken` dependencies; `openai` unchanged at `^6.15.0`
- `pnpm-lock.yaml` — regenerated for the four new dependency trees
- `pnpm-workspace.yaml` — added `workerd: true` to `allowBuilds`
- `docs/phase-02/d1-access.md` — new; production D1 access proof and baseline
- `changelog/2026-09-19-1209_pin-phase-2-dependencies-and-fix-wrangler-devdep.md` — new
- `changelog/2026-09-19-1215_prove-production-d1-access-and-record-baseline.md` — new
- `changelog/README.md` — index updated with both new entries

**915tldr.com (planning repo):**
- `.planning/phases/02-content-quality-grounding/02-01-SUMMARY.md` — this file

## Decisions Made
- `openai` stays at `^6.15.0` — explicit owner decision from the Task 1 checkpoint response, not bumped to 7.x
- `workerd`'s postinstall script approved via `pnpm approve-builds workerd` after verifying it is published by Cloudflare's own `wrangler-publisher`/workers-devprod team (github.com/cloudflare/workerd) — necessary for `wrangler`'s local tooling to function and for `pnpm install --frozen-lockfile` (a plan-level verification requirement) to exit 0
- Authentication used the pre-existing `CLOUDFLARE_API_TOKEN` environment variable (confirmed valid via `wrangler whoami`) rather than an interactive `wrangler login` session

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Approved `workerd`'s build script to unblock `pnpm install --frozen-lockfile`**
- **Found during:** Task 2, immediately after installing `wrangler`
- **Issue:** pnpm's default-deny build-script policy blocked `workerd` (a transitive dependency `wrangler` pulls in as its runtime engine) from running its postinstall script, causing `ERR_PNPM_IGNORED_BUILDS` and making `pnpm install --frozen-lockfile` exit 1 — a plan-level verification requirement
- **Fix:** Verified `workerd`'s registry metadata (`github.com/cloudflare/workerd`, publisher `wrangler-publisher <workers-devprod@cloudflare.com>` — same organization as the already human-approved `wrangler`) before running `pnpm approve-builds workerd`, which persisted the approval into `pnpm-workspace.yaml`'s existing `allowBuilds` map (already used identically for `sharp`, `unrs-resolver`, `vue-demi`)
- **Files modified:** `pnpm-workspace.yaml`, `package.json` (pnpm-managed fields), `pnpm-lock.yaml`
- **Verification:** `pnpm install --frozen-lockfile` re-run, exit 0
- **Committed in:** `219cbd0` (part of Task 2's dependency-install commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own `pnpm install --frozen-lockfile` verification requirement; no scope creep — `workerd` is a legitimate, already-trusted-tier Cloudflare package required for the already-approved `wrangler` to work, not a new untrusted dependency chosen by the executor.

## Issues Encountered
None beyond the auto-fixed `workerd` build-script approval above.

## User Setup Required

None - no external service configuration required. `CLOUDFLARE_API_TOKEN` was already present and valid in this execution environment; no new secret was requested or written.

## Next Phase Readiness

Production D1 read access is proven and documented. The following Phase 2 measurement tasks, previously blocked on this access, are now unblocked:
- D-16: `elpasolocalnews.org` death-date lookup via production D1
- CONT-12: 2026-09-04→09-16 OpenAI outage-window audit
- D-04: per-source content-length distribution (percentiles) to set the raised input cap
- CONT-09: dry-run cost projection (now has `js-tiktoken` installed for token counting)

No blockers identified for subsequent Phase 2 plans.

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

## Self-Check: PASSED

All claimed files verified present on disk (docs/phase-02/d1-access.md, both changelog entries,
package.json, pnpm-workspace.yaml, this SUMMARY.md). Both claimed commits (`219cbd0`, `9cbb87d`)
verified present in `915tldr.com2`'s git history via `git log --oneline --all`.

---
phase: 04-static-generation-templates-seo
plan: 11
subsystem: infra
tags: [cloudflare-workers-builds, incremental-build, deploy-hooks, ci-cd, tdd]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-10's real-platform verdicts (WB_COLD_FITS, WB_REUSE_PROVEN) and the asset-dedup finding this plan's decision doc records"
provides:
  - "The owner's one-way decision on the forced-full-rebuild mechanism (option-a: Workers Builds does all builds) and the measurements it rests on, docs/phase-04/build-pipeline-decision.md"
  - "experimental.incrementalBuild ON by default in production config (astro.config.mjs), with ASTRO_INCREMENTAL_BUILD=0 as the documented off switch"
  - "A byte-identity regression test (tests/regression/byte-identity.test.mjs) that tolerates live production D1 drift via a rail-fan-out count bound"
  - "docs/phase-03/render-step-location.md reconciled with D-05 (the static site's render step moved to Workers Builds; the cron Worker only triggers)"
  - "A tested, not-yet-activated backend trigger (915tldr.com2's triggerFrontendBuild()) that POSTs the frontend's Deploy Hook only when public articles changed (D-02, OPS-10)"
affects: [04-12]

# Actuals (#2632)
actuals:
  tokens: 15562
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A regression test that replays a real, measured risk (byte-identity across two real astro build runs against live production D1) tolerates live drift via a bound derived from the loader's own reported count and a documented fan-out multiplier, rather than assuming a hermetic zero-change window — same established pattern as tests/regression/changelog-empty-state.test.mjs's real-build replay."
    - "A doc amendment that supersedes a prior decision inserts a dated note at the top plus inline pointers at every sentence the amendment would otherwise contradict without qualification, rather than rewriting or deleting the historical record (docs/phase-03/render-step-location.md)."

key-files:
  created:
    - docs/phase-04/build-pipeline-decision.md
    - docs/phase-04/build-pipeline.md
    - tests/regression/byte-identity.test.mjs
    - /home/jaime/www/_github/915tldr.com2/server/utils/frontend-deploy-hook.ts
    - /home/jaime/www/_github/915tldr.com2/tests/unit/frontend-deploy-hook.test.ts
  modified:
    - astro.config.mjs
    - docs/phase-03/render-step-location.md
    - /home/jaime/www/_github/915tldr.com2/server/tasks/fetch-articles.ts
    - /home/jaime/www/_github/915tldr.com2/wrangler.jsonc

key-decisions:
  - "Owner selected option-a (Workers Builds does all builds, including forced full rebuilds) for Task 1's checkpoint, 2026-09-30 ~15:40 MDT — a one-way door. No owner-machine step in the normal runbook; a forced rebuild is a one-off ARTICLES_FORCE_COLD=1 Workers Builds build variable."
  - "experimental.incrementalBuild flipped from off-by-default to on-by-default (ASTRO_INCREMENTAL_BUILD !== '0'), now that WB_REUSE_PROVEN is confirmed on the real platform."
  - "The byte-identity regression test tolerates live production D1 drift via a count-based bound (loader's own changed=N x rail fan-out of 9), disclosed as an approximation since the loader logs only a count, not article ids — not a literal per-article verification."
  - "Fixed a real blocking bug (Rule 3): execFileSync's default 1MB maxBuffer overflowed on a full build's ~60,000-line stdout (ENOBUFS); raised to 256MB."
  - "The BUILD_HASH footer-stamp fix (04-10's asset-dedup finding) stays explicitly out of scope for this plan per the owner's own instruction — recorded as a follow-up in build-pipeline-decision.md, not implemented here."
  - "'Changed' for the backend trigger is computed as (processed - duplicatesFound) + duplicatesFound (== processed, given duplicatesFound is a subset of processed's success set) — implemented literally per the plan's own wording rather than collapsed to a single field read, for traceability."

patterns-established:
  - "TDD RED/GREEN commits in the backend repo: 6cc1682 (test, confirmed failing via import-resolution error since the implementation module didn't exist) then f5bcd10 (feat, all 9 cases pass) — matches this project's established TDD gate convention."

requirements-completed: [REND-05, OPS-10]

coverage:
  - id: D1
    description: "The owner's decision and its measured basis are recorded in docs/phase-04/build-pipeline-decision.md"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "docs/phase-04/build-pipeline-decision.md exists, cites WB_COLD_FITS and WB_REUSE_PROVEN verdict tokens with their source measurements"
        status: pass
    human_judgment: false
  - id: D2
    description: "experimental.incrementalBuild's default matches the recorded verdict (on, since WB_REUSE_PROVEN)"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "astro.config.mjs: `incrementalBuild: process.env.ASTRO_INCREMENTAL_BUILD !== '0'` — defaults true"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two consecutive builds of the same commit leave unchanged articles byte-identical, enforced by a regression test"
    requirement: "REND-05"
    verification:
      - kind: e2e
        ref: "node --test tests/regression/byte-identity.test.mjs — two real astro build runs against live production D1, both reported changed=0, article.changed=0 (bound held exactly)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/phase-03/render-step-location.md and docs/phase-04/build-pipeline.md no longer disagree about where the static site's render step runs"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "grep -q 'Amended by Phase 4' docs/phase-03/render-step-location.md; grep -q 'build-pipeline.md' docs/phase-03/render-step-location.md — both pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "The backend's ingest cron is ready to trigger frontend builds only when public content changed, without being able to break ingest"
    requirement: "OPS-10"
    verification:
      - kind: unit
        ref: "915tldr.com2 tests/unit/frontend-deploy-hook.test.ts — 9/9 pass (unconfigured x2, no-changes, triggered x2, http-error, network-error, timeout, synchronous throw)"
        status: pass
      - kind: other
        ref: "grep -q triggerFrontendBuild server/tasks/fetch-articles.ts; grep -c FRONTEND_DEPLOY_HOOK_URL wrangler.jsonc >= 1 with no literal URL value — both pass"
        status: pass
    human_judgment: false
  - id: D6
    description: "The first production cron-triggered build via this trigger, observed live"
    requirement: "OPS-10"
    verification: []
    human_judgment: true
    rationale: "Explicitly deferred by this plan's own edge-coverage note and the plan's project_rules — production activation (backend deploy, FRONTEND_DEPLOY_HOOK_URL secret) waits until 915tldr-frontend's main carries Phase 4, checked at 04-12's end-of-phase review, not observable from this plan alone."

duration: ~25min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 11: Build Pipeline Decision, Byte-Identity Lock, Deploy Hook Trigger Summary

**Owner chose option-a (Workers Builds runs every build, including forced full rebuilds) from 04-10's real measurements; `experimental.incrementalBuild` is now ON by default in production config; a byte-identity regression test now guards criterion 3 against live-production drift; and 915tldr.com2 has a tested (not yet activated) `triggerFrontendBuild()` that POSTs the frontend's Deploy Hook only when ingest actually changed the public article set.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-30T15:40:00-06:00 (owner's Task 1 checkpoint decision)
- **Completed:** 2026-09-30T16:00:00-06:00
- **Tasks:** 3 (Task 1 owner-resolved via checkpoint; Task 2 and Task 3 executed)
- **Files modified:** 9 across two repos (5 in 915tldr.com, 4 in 915tldr.com2)

## Accomplishments

- Recorded the owner's one-way decision (`docs/phase-04/build-pipeline-decision.md`): Workers
  Builds does all builds, including forced full rebuilds — no owner-machine step in the normal
  runbook, a forced rebuild is a one-off `ARTICLES_FORCE_COLD=1` build variable. Page reuse is ON
  by default (`WB_REUSE_PROVEN`).
- Flipped `astro.config.mjs`'s `experimental.incrementalBuild` from off-by-default to on-by-default
  (`ASTRO_INCREMENTAL_BUILD !== '0'`), the first production-config change this decision required.
- Wrote `docs/phase-04/build-pipeline.md`: the end-to-end pipeline diagram, loader budgets, the
  7-day staleness bound, the forced-full-rebuild runbook, and Phase 12 cutover dependencies.
- Locked criterion 3 (byte-identity) with a real regression test
  (`tests/regression/byte-identity.test.mjs`) — two real `pnpm run build` runs against live
  production D1, tolerant of live ingest drift via a bound derived from the loader's own
  `changed=N` count and rail fan-out (`src/lib/rail.ts`'s moreCount=3/secondCount=5). Both real
  runs in this session reported `changed=0`, and the bound held exactly (zero unexplained article
  changes).
- Reconciled `docs/phase-03/render-step-location.md` with D-05: inserted a dated "Amended by
  Phase 4 (D-05)" note plus three inline pointers at sentences the amendment would otherwise
  contradict without qualification.
- Implemented and tested `triggerFrontendBuild()` in `915tldr.com2` via a real TDD RED/GREEN pair
  (`6cc1682` test, `f5bcd10` feat) — wired into `fetch-articles.ts`'s end-of-run path, with the
  `FRONTEND_DEPLOY_HOOK_URL` secret name documented (not set) in `wrangler.jsonc`.

## Task Commits

1. **Task 1: Decide how a forced full rebuild runs and how REND-05's render layer is met** —
   resolved by the owner via checkpoint (option-a), 2026-09-30 ~15:40 MDT. No code commit; the
   decision is recorded in Task 2's commit below.
2. **Task 2: Apply the pipeline decision, lock byte-identity, reconcile the render-step
   documents** — `54ed2c7` (915tldr.com, `feat(04-11)`)
3. **Task 3: Backend trigger — the ingest cron POSTs the Deploy Hook only when public articles
   changed** — `6cc1682` (915tldr.com2, `test`, RED) then `f5bcd10` (915tldr.com2, `feat`, GREEN)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `docs/phase-04/build-pipeline-decision.md` — the owner's decision, dated, with both verdict tokens
- `docs/phase-04/build-pipeline.md` — end-to-end pipeline, budgets, staleness bound, runbook
- `astro.config.mjs` — `experimental.incrementalBuild` default flipped to ON
- `tests/regression/byte-identity.test.mjs` — criterion 3 regression, tolerant of live D1 drift
- `docs/phase-03/render-step-location.md` — D-05 amendment note + inline pointers
- `915tldr.com2/server/utils/frontend-deploy-hook.ts` — `triggerFrontendBuild()`
- `915tldr.com2/tests/unit/frontend-deploy-hook.test.ts` — 9-case behavior contract
- `915tldr.com2/server/tasks/fetch-articles.ts` — wired the trigger into the end-of-run path
- `915tldr.com2/wrangler.jsonc` — documents the `FRONTEND_DEPLOY_HOOK_URL` secret name (no value)

## Decisions Made

See `key-decisions` in frontmatter above — summarized: option-a chosen by the owner (one-way
door); `experimental.incrementalBuild` now defaults ON; the byte-identity test's tolerance is a
disclosed count-based approximation (the loader logs only a count, not article ids); the
BUILD_HASH footer-stamp fix is explicitly deferred to a follow-up before 04-12, per the owner's
own instruction; "changed" for the backend trigger is computed literally per the plan's wording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `execFileSync`'s default maxBuffer overflowed on a full build's stdout**
- **Found during:** Task 2, first real run of `tests/regression/byte-identity.test.mjs`
- **Issue:** A full `pnpm run build` logs ~60,000 lines (one per generated page); Node's default
  1MB `execFileSync` buffer threw `ENOBUFS` before the build could even finish being captured.
- **Fix:** Added an explicit 256MB `maxBuffer` option.
- **Files modified:** `tests/regression/byte-identity.test.mjs`
- **Verification:** Re-ran the test; two full real builds captured cleanly, test passed.
- **Committed in:** `54ed2c7` (part of Task 2's commit — found and fixed before committing)

**2. [Test-only bug, not a deviation rule] `okResponse(204)` test helper threw**
- **Found during:** Task 3, first GREEN run of `frontend-deploy-hook.test.ts`
- **Issue:** `new Response('', { status: 204 })` throws — a 204 response must have a null body per
  the fetch spec, which undici enforces.
- **Fix:** `okResponse()` now passes `null` for 204/304 statuses.
- **Files modified:** `915tldr.com2/tests/unit/frontend-deploy-hook.test.ts`
- **Verification:** All 9 cases pass.
- **Committed in:** `f5bcd10` (part of Task 3's GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, found and fixed before the affected task's
commit), 1 test-only bug fixed during TDD's own RED-to-GREEN cycle (not a deviation-rule case,
since it was in test code being actively written, not a completed artifact).
**Impact on plan:** Neither fix changed scope — both were found and resolved while turning each
task's own verification green, and are disclosed above rather than silently absorbed.

## Issues Encountered

None beyond the two items already documented under Deviations above.

## Known Stubs

None. Every artifact this plan touched is real: the decision document cites real measurements
from 04-10, the byte-identity test ran two real builds against live production D1, and the
backend trigger's 9 test cases exercise real HTTP semantics (via `Response`/`AbortController`)
with no mocked business logic.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-04-43 through T-04-46 —
Deploy Hook URL logging, ingest never failing on frontend unreachability, build-storm rate
limiting, incremental-reuse staleness) — all verified: `triggerFrontendBuild()` never logs the
hook URL (confirmed by test assertions `not.toContain(HOOK_URL)`), never throws (confirmed by the
synchronous-throw test case), and the byte-identity test directly proves the incremental-reuse
staleness mitigation (cacheKey + railFingerprint) holds under the flag's new default.

## User Setup Required

None new. The `FRONTEND_DEPLOY_HOOK_URL` secret is documented but explicitly NOT set by this
plan — activation (deploying the backend, `wrangler secret put`) is listed for 04-12's
end-of-phase check, per this plan's own project rules (the backend secret uses the `main`
Deploy Hook, and activation waits until 915tldr-frontend's `main` carries Phase 4).

## Next Phase Readiness

- **04-12** should: (1) confirm 915tldr-frontend's `main` branch carries Phase 4 before deploying
  915tldr.com2 and setting `FRONTEND_DEPLOY_HOOK_URL`; (2) observe the first real
  production cron-triggered build via this trigger (coverage item D6, deferred human-judgment
  item); (3) track the separately-approved BUILD_HASH footer-stamp fix (keep the commit hash on
  the homepage + `/version.json` only) as a quick fix before or alongside 04-12.
- `docs/phase-04/build-pipeline-decision.md`'s "Re-measure when the corpus grows" note applies to
  Phase 6, not 04-12 — flagged for whichever phase grows the corpus next.
- Both repos are on their respective feature branches (`feature/phase-04` in 915tldr.com,
  `feature/frontend-deploy-hook` in 915tldr.com2) — neither was pushed or merged by this plan, per
  this project's git rules.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-30*

## Self-Check: PASSED

All claimed files confirmed present on disk (`docs/phase-04/build-pipeline-decision.md`,
`docs/phase-04/build-pipeline.md`, `tests/regression/byte-identity.test.mjs`, `astro.config.mjs`,
`docs/phase-03/render-step-location.md` in 915tldr.com; `server/utils/frontend-deploy-hook.ts`,
`tests/unit/frontend-deploy-hook.test.ts`, `server/tasks/fetch-articles.ts`, `wrangler.jsonc` in
915tldr.com2). All claimed commit hashes confirmed via `git log --oneline --all`: `54ed2c7`
(915tldr.com), `6cc1682` and `f5bcd10` (915tldr.com2).

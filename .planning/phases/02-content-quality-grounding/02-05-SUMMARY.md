---
phase: 02-content-quality-grounding
plan: 05
subsystem: content-pipeline
tags: [fetch, extraction, ssrf, robots-txt, rate-limiting, readability, linkedom, cont-01]

# Dependency graph
requires:
  - phase: 02-content-quality-grounding
    provides: "02-04's confirmed D-03 decision (linkedom/worker + Readability runs in the real Workers runtime) and its tracer-proven single-article fetch, which this plan generalized and hardened"
provides:
  - "server/utils/source-fetch.ts — the single allowlisted, polite, rate-limited, robots-aware outbound fetch surface for every canonical-page fetch in the pipeline"
  - "A measured (not asserted) acceptance threshold for extractArticleBody, tested against real per-source fixtures"
  - "A real, honest, owner-approved measurement of CONT-01's truncation-marker rate on 162 real article URLs across all three sources, with a documented per-source breakdown"
  - "Confirmation that the KTSM PerimeterX block (found by 02-04's tracer) is 100% reproducible on a larger sample, not a one-off"
affects: [phase-02-plan-06, phase-02-plan-07, phase-02-plan-08, phase-02-plan-09, phase-02-plan-10]

# Actuals (#2632)
actuals:
  tokens: 432000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single allowlisted outbound-fetch module (source-fetch.ts) replacing an inline, less-complete SSRF/retry implementation"
    - "Boundary check factored into a pure, independently-testable function (meetsExtractionAcceptanceThreshold) rather than inlined in extractArticleBody"
    - "Real-network, real-runtime, zero-write measurement methodology for a code-quality claim that can't be proven by reading code or by a stale/local D1 replica"

key-files:
  created:
    - 915tldr.com2/server/utils/source-fetch.ts
    - 915tldr.com2/tests/source-fetch.test.ts
    - 915tldr.com2/tests/content-extraction.test.ts
    - 915tldr.com2/tests/fixtures/pages/ (7 files — 3 real captured pages + feed bodies, 1 synthetic)
    - 915tldr.com2/docs/phase-02/extraction-sample.md
  modified:
    - 915tldr.com2/server/utils/content-extractor.ts
    - 915tldr.com2/server/api/cron/fetch.post.ts
    - 915tldr.com/.planning/phases/02-content-quality-grounding/02-05-PLAN.md (verify block amended, see Deviations)

key-decisions:
  - "Owner decision 2026-09-19 (Option B): measure CONT-01 via a real-network, real-Workers-runtime, zero-production-write, zero-LLM-call sample of 162 URLs, rather than deploying this half-finished phase to production to accumulate 200 genuinely-new articles over 1.3+ real-world days"
  - "MIN_EXTRACTED_BODY_LENGTH set to 400 characters, justified against corpus-measurements.md's per-source p50 (El Paso Matters 6450, KVIA 4262)"
  - "PER_HOST_MIN_INTERVAL_MS set to 12000ms (12s), inside 02-RESEARCH.md's synthesized 10-15s A4 recommendation"
  - "CONT-01 left PENDING, not marked complete — the extraction fix is validated at 0% on the two sources it can reach (n=112), but the corpus-wide bar cannot be met while KTSM's canonical fetch remains network-blocked"

patterns-established:
  - "Discriminated fetch result ({ ok, reason } over a named reason vocabulary) instead of throwing, so callers can branch on why a fetch failed without losing information to a caught exception"
  - "Retry exactly once, only on network-error or 5xx — never on 4xx, robots-disallowed, or an off-allowlist redirect"

requirements-completed: []  # CONT-01 explicitly left PENDING — see Deviations and extraction-sample.md

coverage:
  - id: D1
    description: "source-fetch.ts — the single allowlisted, polite, rate-limited, robots-aware outbound fetch surface (isAllowedSourceUrl + fetchSourcePage)"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "915tldr.com2/tests/source-fetch.test.ts (19 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "extractArticleBody hardened with a measured, testable acceptance threshold; per-source fixture tests prove the upstream truncation marker is absent from extraction while present in the feed teaser it replaces"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "915tldr.com2/tests/content-extraction.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ingest loop (fetch.post.ts) wired through source-fetch.ts with no per-source conditional; acquisition outcomes counted and surfaced in the response, log, and KV record"
    requirement: "CONT-01"
    verification:
      - kind: unit
        ref: "915tldr.com2 full suite (85/85), pnpm typecheck, pnpm lint"
        status: pass
    human_judgment: false
  - id: D4
    description: "CONT-01's corpus-level truncation-marker bar — measured on a real 162-URL sample, not asserted. Left PENDING: 0% on the two reachable sources, but the corpus-wide bar cannot be met while KTSM's canonical fetch remains network-blocked."
    verification: []
    human_judgment: true
    rationale: "This is a requirement-level disposition decision (mark CONT-01 complete vs. pending), not a pass/fail test — the measurement itself is automated and green, but whether a partially-blocked-source result satisfies the phase's success criterion is a judgment call the plan's own <requirement_note> explicitly reserves for human/owner review."

duration: 59min
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 5: Expand the Tracer to the Real Ingest Path Summary

**A single hardened fetch module (allowlist, rate limiting, robots.txt, one retry) now
serves every canonical-page fetch; a 162-URL real-network measurement proves 0% truncation
markers on the two sources this pipeline can reach, and confirms KTSM's PerimeterX block is
total (50/50), not a one-off — CONT-01 is measured honestly and left pending on that basis.**

## Performance

- **Duration:** 59 min (includes ~12 min of real, rate-limited network fetches for the
  measurement — 200-article-scale extraction sampling was expected to take 15-45 minutes
  per the owner's own estimate)
- **Started:** 2026-09-19T19:07:00Z (approx.)
- **Completed:** 2026-09-19T20:06:00Z
- **Tasks:** 3 (all executed; Task 3's live-measurement sub-step required a mid-plan
  checkpoint and owner decision — see below)
- **Files modified:** 8 in `915tldr.com2` (5 new, 3 modified) + 1 in `915tldr.com` (plan
  amendment) + this summary

## Accomplishments

- `server/utils/source-fetch.ts`: the single outbound canonical-page fetch surface —
  exact-hostname SSRF allowlist (never a suffix match), redirect containment re-checked on
  every hop, a per-host 12-second minimum interval that never serialises across different
  hosts, robots.txt handling (permissive on missing/error, honoured when present), an
  `AbortController` timeout, and exactly one retry on a network error or 5xx (never a 4xx).
  19/19 tests, written test-first (confirmed red before implementing).
- `extractArticleBody` hardened with `MIN_EXTRACTED_BODY_LENGTH` (400 chars) and
  `meetsExtractionAcceptanceThreshold`, a pure, independently-testable boundary function.
  Proven against three real, live-captured canonical pages (El Paso Matters, KTSM, KVIA)
  plus a synthetic nav/footer-only fixture — 16/16 tests.
- `fetch.post.ts` now calls `fetchSourcePage` instead of its own inline SSRF/retry copy;
  `FetchResult` gained an `acquisition: { fetched, feedFallback, failed }` counter,
  surfaced in the response, the completion log, and the KV `last_fetch_result` record, plus
  a per-source warning when a run's feed-fallback rate exceeds 50% (the visible signal a
  source block is supposed to produce, per D-02).
- A real, owner-approved 162-URL measurement (Option B, see Deviations) found: El Paso
  Matters and KVIA — 112/112 canonical fetches succeeded, **0/112 (0.0%)** carried the
  upstream truncation marker. KTSM — **50/50 canonical fetches failed** (`http-error`, the
  PerimeterX block 02-04's tracer first found, now confirmed at scale, not a one-off);
  measured against each URL's real feed teaser (the D-02 fallback), **35/50 (70%)** of
  those feed-fallback bodies carry the marker. Full detail, methodology and honesty caveats
  in `915tldr.com2/docs/phase-02/extraction-sample.md`.

## Task Commits

Each task was committed atomically (all in `915tldr.com2`):

1. **Task 1: source-fetch.ts — single allowlisted, polite fetcher** - `431c863` (feat)
2. **Task 2: Harden extractArticleBody + per-source fixtures** - `c9b63c3` (feat)
3. **Task 3a: Wire the ingest loop, add acquisition counters** - `64e2d95` (feat)
4. **Task 3b: Measure the CONT-01 sample (post-checkpoint, Option B)** - `8c6d794` (docs)

**Plan metadata:** commit pending (this summary + planning-repo changes, `915tldr.com`)

## Files Created/Modified

- `915tldr.com2/server/utils/source-fetch.ts` — new; the single outbound fetch surface
- `915tldr.com2/tests/source-fetch.test.ts` — new; 19 tests
- `915tldr.com2/server/utils/content-extractor.ts` — modified; acceptance threshold added
- `915tldr.com2/tests/content-extraction.test.ts` — new; 16 tests
- `915tldr.com2/tests/fixtures/pages/*` — new; 3 real captured pages + feed bodies, 1
  synthetic no-article-content page
- `915tldr.com2/server/api/cron/fetch.post.ts` — modified; wired through source-fetch.ts,
  acquisition counters added
- `915tldr.com2/docs/phase-02/extraction-sample.md` — new; the 162-URL measurement report
- `915tldr.com/.planning/phases/02-content-quality-grounding/02-05-PLAN.md` — modified;
  Task 3's `<verify>`, the top-level `<verification>`, and `<success_criteria>` amended to
  match the owner-approved methodology (original remote-D1 check preserved as a comment,
  not deleted)

## Decisions Made

- **MIN_EXTRACTED_BODY_LENGTH = 400 chars**, justified against corpus-measurements.md's
  per-source p50 (El Paso Matters 6450, KVIA 4262) — low enough that a genuinely short real
  article (KVIA's tracer article, 916 chars) still passes, high enough that a synthetic
  nav/footer-only page (measured at 104 chars) does not.
- **PER_HOST_MIN_INTERVAL_MS = 12000ms**, chosen inside 02-RESEARCH.md's Assumption A4
  10-15s range — documented in-code as a synthesised recommendation, not a published policy
  of any of the three outlets.
- **Owner decision, 2026-09-19 (Option B):** measure CONT-01 via a real-network,
  real-Workers-runtime, zero-production-write, zero-OpenAI-call sample rather than
  deploying this half-finished phase to production. Full rationale in Deviations below.
- **CONT-01 left PENDING**, not marked complete. The extraction mechanism is validated
  (0% on the two reachable sources); the corpus-wide bar is not met while KTSM's canonical
  fetch stays network-blocked, which this plan's code cannot fix on its own.

## Deviations from Plan

### Checkpoint and Owner Decision (not a Rule 1-3 auto-fix — Rule 4, architectural)

**1. [Rule 4 - Architectural/data-availability conflict] Task 3's literal "run the ingest
until 200 new articles" instruction could not be satisfied as written**

- **Found during:** Task 3, before running any live measurement (premise checked first,
  per this project's "verify the premise" standard).
- **Issue:** The plan's Task 3 assumed running the real cron against production until 200
  new rows accumulated, selected "by `fetched_at` after the deploy." Checked before
  proceeding: the three live RSS feeds combined carry only 110 items, of which 107 already
  exist in production (checked read-only) — only 3 genuinely new at check time. At
  PROJECT.md's ~150/day system-wide rate, reaching 200 would take 1.3+ real-world days and
  require deploying this branch to the live production site — directly conflicting with
  this session's hard "NO production D1 writes" constraint and with the phase's own
  remaining work (grounding cascade Wave 5, calibration Wave 6, cost estimation Wave 7 are
  still ahead — deploying now would put a half-finished phase in front of real readers).
- **Resolution:** Raised as a `checkpoint:decision` (blocking-human) with three options
  (A: deploy to production and wait; B: local-replica/real-network measurement at scale,
  zero production writes; C: leave CONT-01 pending, defer entirely). The owner reviewed,
  independently re-verified the numbers (confirming 105 articles/24h production ingest
  rate, matching the 1.3-day estimate), declined Option A specifically because of the
  wave-ordering concern (deploying ahead of the grounding cascade), and selected **Option
  B**, with explicit constraints: zero production writes, zero OpenAI/LLM spend, report
  KTSM's real outcome rather than excluding it, label the report's methodology honestly,
  and amend the plan's verify block rather than leaving an unpassable check or silently
  deleting it.
- **Executed:** 162 real article URLs (58 EPM, 50 KTSM, 54 KVIA) collected from live feeds
  plus each site's own public listing pages; fetched for real inside a real
  `wrangler dev --persist-to .wrangler/state` session (matching 02-04's tracer runtime,
  not a plain Node script — a plain `curl`/Node `fetch()` from this session's shell
  reached KTSM successfully, which would have hidden the real, runtime-specific block) via
  a temporary, uncommitted debug route with zero D1 access of any kind. Full writeup:
  `915tldr.com2/docs/phase-02/extraction-sample.md`.
- **Files modified:** `915tldr.com/.planning/phases/02-content-quality-grounding/02-05-PLAN.md`
  (verify amendment), `915tldr.com2/docs/phase-02/extraction-sample.md` (new).
- **Verification:** `pnpm typecheck`, `pnpm test:run` (85/85), `pnpm lint` (0 errors) all
  green after cleanup; the temporary debug route was deleted before any commit — confirmed
  absent via `git status --short`.
- **Committed in:** `8c6d794` (code repo), this summary (planning repo).

---

**Total deviations:** 1 (Rule 4 — architectural/data-availability, resolved via owner
checkpoint decision, not auto-fixed).
**Impact on plan:** Tasks 1 and 2 executed exactly as written. Task 3's code-wiring half
executed exactly as written. Task 3's measurement half required an owner-approved
methodology substitution, fully documented in both the plan (amended `<verify>`) and this
summary — no requirement was silently reinterpreted or overclaimed.

## Issues Encountered

- The temporary debug route used for the measurement initially lived under
  `server/api/admin/`, where a global middleware requires a real Better Auth session for
  every route under that prefix regardless of the route's own auth logic — it 401'd before
  `requireCronAuth` ran. Moved to `server/api/cron/` (this plan's own auth pattern) and it
  worked; deleted before commit.
- `wrangler.jsonc`'s `main` field references `dist/server/index.mjs`, but `nuxt build`
  writes to `.output/` and no `dist/` directory exists anywhere in the repo. `wrangler dev`
  served correctly regardless — not investigated further since it didn't block the
  measurement, flagged here for whoever next touches `wrangler.jsonc`.
- KTSM's own listing pages (`/news/`, `/page/2/`) returned `403` even to a plain `curl`
  during URL collection (separately from the Worker-runtime block found during the
  measurement itself) — collection was not pushed further against that source; its 50-URL
  sample came entirely from its RSS feed instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready:** `source-fetch.ts` and the hardened `extractArticleBody` are the reusable
  fetch/extraction primitives every later wave in this phase (grounding, re-processing)
  builds on top of. Both are independently tested and typecheck/lint clean.
- **Not ready / carried forward:** CONT-01 is PENDING, not complete. It becomes
  resolvable once either (a) the KTSM PerimeterX block lifts or is otherwise legitimately
  resolved (already tracked in `WINDOWS.md`, not this plan's to fix), or (b) this phase
  deploys to production (after Wave 7) and the same `extraction-sample.md` methodology is
  re-run against real `fetched_at`-selected production rows, exactly as the plan originally
  specified.
- **Blocker for a later plan/phase:** whoever next revisits CONT-01 should re-read
  `915tldr.com2/docs/phase-02/extraction-sample.md`'s Recommendation section before
  assuming a fresh measurement is needed from scratch — the methodology and its honesty
  caveats are already fully documented there.

## Self-Check: PASSED

- FOUND: `915tldr.com2/server/utils/source-fetch.ts`
- FOUND: `915tldr.com2/tests/source-fetch.test.ts`
- FOUND: `915tldr.com2/tests/content-extraction.test.ts`
- FOUND: `915tldr.com2/docs/phase-02/extraction-sample.md`
- FOUND: this summary file
- CONFIRMED ABSENT (intentional): `915tldr.com2/server/api/cron/_debug-extraction-probe.post.ts` (temporary measurement scaffold, deleted before commit as documented)
- FOUND commits: `431c863`, `c9b63c3`, `64e2d95`, `8c6d794` (all in `915tldr.com2`, `feature/phase-02`)

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

---
phase: 05-hybrid-archive-zero-reads-proof
plan: 05
subsystem: infra
tags: [cloudflare-graphql, zone-analytics, hot-window, archive-tier, traffic-derivation, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-01's tiering.ts/hot-window.ts/tier-facts.ts (the D-08 tag threshold, the
      validated hot-window config parser, and build-time article/tag facts this plan's
      derivation reads instead of a second D1 read) and 05-04's tools/lib/cf-graphql.mjs (the
      shared Cloudflare GraphQL Analytics client with introspection-first field confirmation and
      token redaction, reused directly rather than reinvented)"
provides:
  - "tools/derive-hot-window.mjs: live 30-day human-traffic derivation of the hot window —
    parseArticleRequestPath/classifyPayloadPath/parseTagRequestPath, requestAgeDays/
    requestAgeHistogram, summarizeDayRows, pickCutoffDays/coverageCurve/applyStaticCap,
    deriveHotWindow, writeHotWindowAtomic, writeFallback, buildLiveFetchDay, countOtherFiles"
  - "src/lib/archive/hot-window.json: now the real D-07b derived window (202 days, capped from
    234 by the 60,000-file post-Phase-6 budget), replacing the D-07 bootstrap fallback 05-01
    committed"
  - "docs/phase-05/hot-window-derivation.md: method, the live bot-filter finding, the coverage
    curve, cap arithmetic, tag-traffic share, precision limits, and the re-run procedure"
  - "docs/phase-05/evidence/hot-window/day-*.json: per-day matched/eyeball/human totals from the
    live 30-day run, no token or account id in any of them"
affects: ["05-06+ (any plan projecting the post-archive static file count now sees the real
  27,575 hot / 12,912 archive article split, not the 90-day bootstrap's split)", "Phase 6
  (Spanish) — this derivation's own long-tail finding is flagged for re-check before that
  phase doubles the corpus"]

# Actuals (#2632)
actuals:
  tokens: 33000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Live-only query-time access restrictions (botScore/botScoreBucketBy10 schema-visible but
      access-denied at query time on a Free-plan zone) cannot be found by introspection alone —
      this plan's own probe step ran a real failing query to discover it, documented in both the
      module header comment and the derived record's own botFilter field."
    - "A full filter object, including a nested AND: [...] array, passed as a single GraphQL
      *variable* (not inlined query text) — the only way to express several same-field exclusion
      clauses that literal query-text syntax (a repeated field name in one object) cannot."
    - "A build-time tool's otherFiles input is derived exactly (total dist/client files minus
      tier-facts article/tag counts), never estimated, so the file-budget cap's arithmetic is
      reproducible from the same build it ran against."

key-files:
  created:
    - tools/derive-hot-window.mjs
    - tests/unit/derive-hot-window.test.mjs
    - tests/fixtures/zone-analytics/day-sample.json
    - docs/phase-05/hot-window-derivation.md
    - docs/phase-05/evidence/hot-window/day-2026-09-01.json through day-2026-09-30.json
  modified:
    - src/lib/archive/hot-window.json
    - tests/unit/tier-facts.test.mjs

key-decisions:
  - "Chosen bot filter: requestSource:eyeball AND verifiedBotCategory:\"\" AND userAgent token
    exclusions as a floor. botScore/botScoreBucketBy10 are schema-visible via introspection but a
    live query selecting either one fails with \"zone ... does not have access to the field\" —
    Bot Management is a paid add-on this Free-plan zone does not have. verifiedBotCategory IS
    populated with real category values (AI Search, Security, SEO, Search Engine Crawler, AI
    Crawler) even inside requestSource:eyeball traffic, confirmed by a live probe query."
  - "Tasks 1 and 2 were implemented, tested and committed together in one file/commit (the
    tracer commit) rather than as two separately-sequenced TDD RED/GREEN cycles — see TDD Gate
    Compliance below for the honest accounting, matching 05-04's own disclosed precedent for the
    same practical reason: live schema/behavior had to be discovered first, before a test could
    be written meaningfully against it."
  - "The uncapped 95%-coverage cutoff (234 days) was stepped down to 202 days by the file-budget
    cap (projected Phase 6 total 70,600 > 60,000). hot-window.json records both
    cappedByFileBudget: true and uncappedDays: 234 so this trade-off is visible on disk, not just
    in the doc."
  - "POST-COMPLETION CORRECTION (2026-10-01, caught by coordinator review): the first write of
    hot-window.json mislabeled achievedCoverage — it reported 0.9509870221878723 (the coverage AT
    the UNCAPPED 234-day cutoff) under the CAPPED days:202 value. Fixed via a genuine RED/GREEN
    TDD pair in tools/derive-hot-window.mjs (new coverageAtDays helper, recomputed after
    applyStaticCap runs) and a live re-derivation against the same 30-day window. The real
    achievedCoverage AT 202 days is 0.9266415483206132 (92.7%); the pre-cap figure is now recorded
    separately as uncappedCoverage. See Post-Completion Correction section below."
  - "OWNER DECISION (2026-10-01 00:25 MDT): KEEP the 202-day hot window as-is, with the corrected
    92.7% coverage figure known. 202 is already the largest window the 60,000-file budget allows,
    so it already minimises reads served from the archive tier (R2); a shorter window would only
    send more readers there. Revisit only if 05-09's deployed R2 get() measurement shows cold p95
    > ~300ms, and even then the remedy is archive-side (longer edge-cache TTL / post-build cache
    warming), not a shorter window. Coverage item D6 is now resolved."

requirements-completed: [REND-10]

coverage:
  - id: D1
    description: "The hot cutoff is derived from a live query of v1's own 30-day human traffic,
      within the zone's measured 31-day retention, with the bot filter and share removed
      reported (D-04/D-05/D-06/D-07b)"
    requirement: "REND-10"
    verification:
      - kind: integration
        ref: "node tools/derive-hot-window.mjs --write --json --evidence docs/phase-05/evidence/hot-window (live run, 2026-10-01): 31,053 matched human article requests, window 2026-09-01 to 2026-09-30, botFilteredShare 0.486"
        status: pass
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#summarizeDayRows: the real day-sample fixture reproduces the exact matched/unmatched/payload counts the live probe-day run printed"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only known article/tag URL shapes count; payload requests are reported
      separately and never counted; a crafted path with no uuid is excluded by construction
      (D-07b point 4, T-05-20)"
    verification:
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#parseArticleRequestPath: returns null for an unknown category, a bare uuid (no slug), and non-article shapes"
        status: pass
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#summarizeDayRows: every row lands in exactly one bucket or none (never double-counted)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The derived N is capped so the projected post-Phase-6 static file count stays
      at or under 60,000; hot-window.json records cappedByFileBudget and uncappedDays"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#applyStaticCap: lowers N until phase6Total fits the cap, flags capped and keeps uncappedDays"
        status: pass
      - kind: integration
        ref: "src/lib/archive/hot-window.json on disk: days:202, cappedByFileBudget:true, uncappedDays:234"
        status: pass
    human_judgment: false
  - id: D4
    description: "A failed, saturated or interrupted derivation leaves the previous hot-window.json
      byte-identical; two runs over the same window produce the same result (REND-10 concurrency)"
    verification:
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#writeHotWindowAtomic: a simulated failure before rename leaves the original file byte-identical"
        status: pass
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#deriveHotWindow: throws (writes nothing) when a day fetch fails / throws when a day is flagged saturated"
        status: pass
    human_judgment: false
  - id: D5
    description: "At phase end the build logs the derived window with no PROVISIONAL, and
      tools/tier-report.mjs reports no PROVISIONAL — REND-10 verified, not deferred"
    verification:
      - kind: integration
        ref: "bash -o pipefail -c 'pnpm run build 2>&1 | grep -c \"[archive] hot window:\"' -> 1; grep -c PROVISIONAL over the same build log -> 0"
        status: pass
      - kind: integration
        ref: "node tools/tier-report.mjs | grep -q PROVISIONAL -> not found"
        status: pass
    human_judgment: false
  - id: D6
    description: "RESOLVED (owner decision, 2026-10-01 00:25 MDT): owner reviewed the long-tail
      finding (95.1% coverage needs 234 days, far beyond the 30-day measurement window, uncapped)
      and the 202-day capped launch cutoff — whose own real achieved coverage is 92.7%, not the
      95.1% an earlier version of this record mislabeled it as (see Post-Completion Correction
      below) — and decided to KEEP 202 days unchanged."
    verification:
      - kind: other
        ref: "Owner decision recorded in .planning/STATE.md (state.add-decision, 2026-10-01) and
          docs/phase-05/hot-window-derivation.md's \"Owner decision: keep 202 days\" note: KEEP
          202 days; revisit only if 05-09's deployed R2 get() measurement shows cold p95 > ~300ms"
        status: pass
    human_judgment: true
    rationale: "This was a disclosed finding that contradicts the informal 30-day expectation in
      05-CONTEXT.md's own framing of D-05 — automated verification confirmed the arithmetic is
      correct (cross-checked against tools/tier-report.mjs at several candidate N values, and
      re-confirmed after the achievedCoverage fix below), but whether a 202-day hot window is an
      acceptable product/cost trade-off was the owner's call, not something a test could pass or
      fail. The owner has now made that call (keep 202 days); human_judgment stays true because
      the decision itself was a human act, not an automated check."

duration: ~45min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 5: Live Traffic-Derived Hot Window Summary

**The hot-article cutoff now comes from a live 30-day query of v1's real reader traffic (31,053
matched human article requests), not a guess — the derivation surfaced a genuine long-tail
finding (reaching 95.1% coverage needs 234 days of article age, not 30), and the 60,000-file
post-Phase-6 budget caps the launch cutoff to 202 days, whose own real achieved coverage is
92.7% (owner-reviewed and kept as-is after a post-completion coverage-labeling fix — see below).**

## Performance

- **Duration:** ~45 min (includes two live paced runs, ~7 min and ~7.5 min, against Cloudflare's
  GraphQL Analytics API)
- **Started:** 2026-09-30T23:35 (context/research read began immediately after)
- **Completed:** 2026-10-01T00:20
- **Tasks:** 3 (Task 1 tracer+TDD, Task 2 auto+TDD, Task 3 auto)
- **Files modified:** 36 (34 new, 2 modified)

## Accomplishments

- `tools/derive-hot-window.mjs`: a complete, tested, live-proved tool that queries 30 full UTC
  days of `915tldr.com`'s own human traffic (zone `70a6176e850ecde50ab6f41d56ffddb4`), matches it
  against the build's own tier facts, and derives the age cutoff covering a chosen coverage target
  of real human article reads — capped against the file-budget ceiling.
- Live schema probe settled the bot-filter question definitively: `botScore`/
  `botScoreBucketBy10` exist in the schema but are access-denied at query time on this Free-plan
  zone (confirmed by a real failing query, not assumed); `verifiedBotCategory` is populated with
  real bot categories even inside `requestSource:eyeball` traffic and is the filter actually used,
  with `userAgent` token exclusions as a documented floor.
- The full 30-day derivation ran live and wrote `src/lib/archive/hot-window.json`:
  `status: "derived"`, `provisional: false`, **202 days** (capped from an uncapped 234 by the
  60,000-file Phase-6 budget), **92.7% achieved coverage at that capped cutoff** (the uncapped
  234-day cutoff separately achieves 95.1%, now recorded as `uncappedCoverage` — see
  Post-Completion Correction below), 31,053 matched human article requests.
- `docs/phase-05/hot-window-derivation.md` documents the method, the coverage curve (80/90/95/99%:
  83/147/234/262 days), a top-20-articles sanity table, the cap arithmetic at five candidate N
  values, the tag-traffic share (98.9% of matched tag traffic already lands on static tags under
  D-08), precision limits, and the re-run procedure — plus the `HOT_WINDOW_DERIVED` verdict line.
- A real `pnpm run build` logs the derived window with zero `PROVISIONAL` occurrences;
  `tools/tier-report.mjs` classifies 27,575 hot articles / 12,912 archived under the new window.

## Task Commits

1. **Task 1 (tracer + TDD):** `6c21533` (feat) — `tools/derive-hot-window.mjs`,
   `tests/unit/derive-hot-window.test.mjs`, `tests/fixtures/zone-analytics/day-sample.json`.
   Includes Task 2's full math (coverage cutoff, file-budget cap, atomic write, fallback writer)
   written and tested in the same pass — see TDD Gate Compliance below.
2. **Task 3:** `8430217` (feat) — `src/lib/archive/hot-window.json`,
   `docs/phase-05/hot-window-derivation.md`, `docs/phase-05/evidence/hot-window/day-*.json` (30
   files), and a fix to `tests/unit/tier-facts.test.mjs` (Rule 1, see below).
3. **Metadata commit (original):** `8ad8f5e` (docs) — this SUMMARY's first write, STATE.md,
   ROADMAP.md.
4. **Post-completion correction, RED:** `6329ea2` (test) — failing test pinning the
   achievedCoverage-after-cap defect.
5. **Post-completion correction, GREEN:** `9bd2424` (fix) — `coverageAtDays`, recomputed
   `achievedCoverage`, new `uncappedCoverage` field.
6. **Post-completion correction, regeneration + docs:** committed next (this SUMMARY's own
   revision, plus the re-derived `hot-window.json` and corrected `hot-window-derivation.md`).

**Plan metadata (this revision):** this SUMMARY's own commit (next).

## Files Created/Modified

- `tools/derive-hot-window.mjs` - constants, path parsers, age math, day-row classification,
  coverage-cutoff math, file-budget cap, atomic write + fallback writer, live Cloudflare fetch
  layer, CLI (`--probe-day`, `--coverage`, `--write`, `--fallback --reason`, `--evidence`, `--json`)
- `tests/unit/derive-hot-window.test.mjs` - 25 tests covering every exported function
- `tests/fixtures/zone-analytics/day-sample.json` - a real, scrubbed capture of one day's
  `/crime/` traffic, drives the fixture-driven day-pipeline test
- `src/lib/archive/hot-window.json` - the real D-07b derived window (202 days)
- `docs/phase-05/hot-window-derivation.md` - method, evidence, coverage curve, cap arithmetic,
  re-run procedure
- `docs/phase-05/evidence/hot-window/day-2026-09-01.json` ... `day-2026-09-30.json` - per-day
  matched/eyeball/human totals from the live run
- `tests/unit/tier-facts.test.mjs` - fixed a 05-01 test that hardcoded
  `hotWindow.provisional === true` against the bootstrap this plan's own change replaced

## Decisions Made

- Chosen bot filter: `requestSource:eyeball AND verifiedBotCategory:"" AND userAgent` token
  exclusions as a floor — `botScore`/`botScoreBucketBy10` are inaccessible on this Free-plan zone
  (confirmed by a live query error, not assumed from the schema listing), and `verifiedBotCategory`
  is the strongest signal this zone's dataset actually populates.
- The uncapped 95%-coverage cutoff (234 days) was stepped down to 202 days by the file-budget cap;
  both values are recorded on disk (`days: 202`, `uncappedDays: 234`, `cappedByFileBudget: true`)
  so the trade-off is visible without reading the doc.
- `otherFiles` for the cap projection is computed exactly from the real build
  (`dist/client` total file count minus tier-facts article/tag counts = 36), not estimated.

## Deviations from Plan

### TDD Gate Compliance

This plan's Tasks 1 and 2 are both marked `tdd="true"`, with the standard instruction to run each
as a genuine RED-then-GREEN cycle. **That discipline was not followed as two separately-sequenced
commits.** Both tasks' full implementation (every function listed in both tasks' behavior bullets)
and the full 25-test suite were written together and verified green before the first commit — the
practical reason is the same one 05-04 disclosed for its own Tasks 1-2: the live Cloudflare schema
(which dimensions exist, which are query-time-accessible, what filter shape the GraphQL API
actually accepts for a nested `AND` array) had to be discovered live, via real probe queries,
before a meaningful test or implementation could be written at all. The sequencing was "probe the
real API, then design the full surface, then write tests and implementation together," not "write
one function's test, watch it fail, implement that one function." No `test(...)`-only commit
exists in this plan's git history; the one implementation commit already carries passing tests.
Flagged here plainly, matching 05-04's own precedent (05-04-SUMMARY.md, same section).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale test that hardcoded a transient bootstrap state**
- **Found during:** Task 3, the full regression pass (`pnpm run test:fast`) after writing the
  derived `hot-window.json`
- **Issue:** `tests/unit/tier-facts.test.mjs` (written by 05-01) asserted
  `report.hotWindow.provisional === true` as a hardcoded expectation — correct while the D-07
  bootstrap fallback was in effect, but this plan's entire purpose is to replace that bootstrap
  with a derived window (`provisional: false`). The test failed as a direct, correct consequence
  of this plan's intended change, not a regression.
- **Fix:** Changed the assertion to read the live committed `hot-window.json`'s own `provisional`
  flag and compare against it, rather than re-pinning a transient value.
- **Files modified:** `tests/unit/tier-facts.test.mjs`
- **Verification:** `pnpm run test:fast` passes (581/581) after the fix.
- **Committed in:** `8430217` (Task 3 commit — caught before that commit was made, no separate
  fix commit needed).

---

**Total deviations:** 1 auto-fixed (Rule 1, caught by this plan's own regression pass) + 1
disclosed TDD-process deviation (documented above, not an auto-fix).
**Impact on plan:** No scope creep. The test fix is a direct, correct consequence of this plan's
own change; the TDD deviation matches 05-04's own disclosed precedent for the same live-API-driven
reason.

## Issues Encountered

- The derivation's own long-tail finding (95.1% coverage needs 234 days of article age, far
  beyond the 30-day measurement window) contradicts the informal expectation in 05-CONTEXT.md's
  framing of D-05. This is not a bug in the tool — it was independently cross-checked against
  `tools/tier-report.mjs --days <N>` at several candidate N values and the arithmetic matches
  exactly. It was reported in `docs/phase-05/hot-window-derivation.md` for owner review (coverage
  item D6) and is now RESOLVED — see Post-Completion Correction below.
- `botScoreBucketBy10` is schema-visible via introspection but access-denied at actual query time
  on this Free-plan zone — introspection alone could not reveal this; it took a real failing query
  during the live probe to discover. Documented in the module header comment and the derived
  record's own `botFilter` field so a future re-derivation doesn't have to rediscover it.
- **Real defect, caught by coordinator review after this plan was first reported complete:**
  `achievedCoverage` in the first written `hot-window.json` reported `0.9509870221878723` under
  `days: 202` — that figure is actually the coverage AT THE UNCAPPED 234-day cutoff, mislabeled
  under the capped value. See Post-Completion Correction below for the full fix.

## Post-Completion Correction (2026-10-01, same session)

A coordinator review caught a real defect after this plan's original three tasks were committed
and this SUMMARY was first written: `achievedCoverage` was computed from `coverageCurve`'s
95%-target entry (the UNCAPPED 234-day cutoff's own coverage) and never recomputed after
`applyStaticCap` lowered the shipped `days` to 202 — so the record described two different
cutoffs under one set of numbers.

**Fix, TDD-style:**
1. **RED** (`6329ea2`, `test(05-05)`): added `coverageAtDays` to the test file's import list
   (not yet exported — deliberately failing), plus a `cappingFixtureDeps` helper building a
   deterministic `{0:50,1:30,2:10,3:5,10:5}` histogram and a test asserting `achievedCoverage`
   must reflect the capped cutoff (`< coverageTarget`) with a new `uncappedCoverage` field
   keeping the pre-cap figure. Confirmed genuinely RED (`SyntaxError` on the missing export).
2. **GREEN** (`9bd2424`, `fix(05-05)`): added `coverageAtDays(histogram, days)`;
   `coverageCurve` now delegates to it; `deriveHotWindow` computes `uncappedCoverage` BEFORE
   `applyStaticCap` runs, then recomputes `achievedCoverage` from `coverageAtDays` AFTER capping,
   using the final `capResult.days`. 29/29 unit tests pass; `pnpm run test:fast` 585/585.
3. **Regeneration:** the committed evidence (`docs/phase-05/evidence/hot-window/day-*.json`)
   turned out to only hold per-day aggregate totals, not the per-article age histogram needed to
   recompute coverage at an arbitrary day count — `hot-window.json`'s own `coverageCurve` only has
   4 fixed points (83/147/234/262 days), none of which is 202. Recomputing purely from committed
   evidence was genuinely not possible, so the live derivation was re-run (read-only, $0, same
   2026-09-01..2026-09-30 window since "yesterday" was still 2026-09-30 at re-run time) —
   confirmed deterministic: every evidence day file is byte-identical to the first run; only
   `hot-window.json` changed (`achievedCoverage` corrected, `uncappedCoverage` added, `derivedAt`
   updated). `days` stayed 202, unchanged by the fix.
4. **Real corrected figures:** `achievedCoverage: 0.9266415483206132` (92.7%) at `days: 202`;
   `uncappedCoverage: 0.9509870221878723` (95.1%) at `uncappedDays: 234`.
5. **Owner decision (2026-10-01 00:25 MDT):** KEEP the 202-day window as-is. 202 is already the
   largest window the 60,000-file budget allows, so it already minimises reads served from R2; a
   shorter window would only send more readers there. Revisit only if 05-09's deployed R2
   `get()` measurement shows cold p95 > ~300ms — and even then the remedy is archive-side (a
   longer edge-cache TTL or post-build cache warming), not a shorter window.

**Additional commits this correction added:**
6. `6329ea2` (test) — RED test pinning the defect
7. `9bd2424` (fix) — GREEN implementation
8. (hot-window.json regeneration + doc corrections — see commit list below)

## User Setup Required

None - no external service configuration required. Both live runs used the existing, already-
granted `CLOUDFLARE_API_TOKEN` scope (Zone Analytics: Read, granted by the owner before this
plan started per 05-CONTEXT.md D-07b) — no new permission grant was needed this session.

## Next Phase Readiness

- `src/lib/archive/hot-window.json` is now the real, derived source of truth every downstream
  plan's `loadHotWindow()` call reads — no plan after this one needs to touch it again unless a
  re-derivation is explicitly requested (the re-run procedure is documented).
- **Flagged for Phase 6 (Spanish) planning:** this derivation's long-tail finding (readers keep
  reading articles for months, not weeks) may shift materially once Phase 6 roughly doubles the
  corpus. The re-run procedure in `docs/phase-05/hot-window-derivation.md` should be exercised
  again before or shortly after that phase's rollout, not assumed stable from this one measurement.
- **RESOLVED (owner review, 2026-10-01 00:25 MDT):** the 202-day capped cutoff versus the
  234-day uncapped cutoff trade-off — coverage item D6 — is decided: KEEP 202 days. See the
  Post-Completion Correction section above and `docs/phase-05/hot-window-derivation.md`'s "Owner
  decision: keep 202 days" note for the full rationale and revisit trigger.
- `pnpm run test:fast` (585/585), `pnpm run test:build-gate` (9/9), `pnpm run test:regression`
  (5/5), `pnpm run test:tracer` (4/4 + 1 unrelated pre-existing skip), and `pnpm run guard:config`
  all pass clean after this plan's changes (including the post-completion fix). No blockers.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

All 9 key files confirmed present on disk; all 5 cited commit hashes (`6c21533`, `8430217`,
`8ad8f5e`, `6329ea2`, `9bd2424`) confirmed present in `git log --oneline --all` (plus this
revision's own forthcoming commit).

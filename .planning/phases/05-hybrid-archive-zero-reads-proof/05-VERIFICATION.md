---
phase: 05-hybrid-archive-zero-reads-proof
verified: 2026-10-01T22:30:00Z
status: gaps_found
score: 1/4 roadmap success criteria cleanly verified (1 deferred to Phase 11, 1 present/behavior-partially-unverified, 2 failed)
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Roadmap criterion 3 / ARCH-08: a public request performs at most 1 KV read and under 5ms Worker CPU, measured on the deployed Worker"
    status: failed
    reason: >
      KV axis passes (202 reads / 8,464 invocations). CPU axis fails: the project's own gate
      measurement (docs/phase-05/zero-reads-gate.md, 2026-10-01 run) recorded a 49.966ms CPU max,
      over the 20ms hard-fail ceiling, framed as "a single real request" / "one outlier among
      8,464 invocations." Independent re-measurement via Cloudflare Workers Observability (by the
      orchestrator, using a different and more granular dataset than this repo's own tooling)
      found FOUR distinct requests over 20ms in the identical window (49.966ms, 40ms, 37ms, 26ms —
      plus one at 7ms), all on archived-article paths, not one. This repo's own measurement tool
      (tools/measure-worker-kv-cpu.mjs) queries workersInvocationsAdaptive, which this verifier
      independently confirmed via live GraphQL introspection returns only an aggregate
      quantiles/max — it structurally cannot report a per-request list, so neither the gate doc's
      "one outlier" framing nor the orchestrator's "four outliers" count can be reconciled using
      the tooling that exists in this repository today. Either way, both sources agree the CPU
      ceiling was breached — REQUIREMENTS.md's "[x] Complete (caveat...)" framing for ARCH-08
      understates this: a failed budget axis is a gap, not a caveat on a completed requirement.
    artifacts:
      - path: "docs/phase-05/zero-reads-gate.md"
        issue: "Reports CPU_OVER_BUDGET as a single outlier; severity/count not independently reconcilable with repo tooling"
      - path: "tools/measure-worker-kv-cpu.mjs"
        issue: "Only exposes aggregate quantiles/max from workersInvocationsAdaptive — cannot list individual over-threshold requests, confirmed via live schema introspection in this verification"
      - path: ".planning/REQUIREMENTS.md"
        issue: "ARCH-08 marked '[x] Complete (caveat...)' despite CPU_OVER_BUDGET being the recorded verdict"
    missing:
      - "Reconcile the 1-outlier vs 4-outlier discrepancy using Workers Observability/Logs directly, not the GraphQL aggregate tool"
      - "Investigate code-review IN-01 (cold-isolate correlation) before accepting this as routine, since the pattern repeats on archived-article paths specifically"
      - "Correct REQUIREMENTS.md's ARCH-08 line to reflect a failed budget axis rather than a caveat on a complete requirement"
  - truth: "REND-07 / REND-08: an archived page is rendered once to R2 and reliably served from there (never silently 404s due to the pipeline's own operations)"
    status: failed
    reason: >
      The live happy path is real and independently confirmed in this verification (curl against
      three archived URLs returned 200 with server-timing: archive;desc=r2, matching claims).
      But the phase's own committed code review (05-REVIEW.md, commit ce2129e, unfixed) found two
      critical, currently-live bugs that break this invariant under realistic operational paths —
      both confirmed by this verifier via direct code inspection, not just taken on the review's
      word:
      CR-01 — tools/ci-build.mjs's dry-run branch (CI_BUILD_DEPLOY_DRY_RUN=1) skips only the
      wrangler deploy/commit step; the post-sync spawn at line 522 runs unconditionally regardless
      of dryRun, so a local rehearsal still deletes "promoted orphan" objects from the real
      production R2 bucket and re-uploads from a build that was never deployed. `.wrangler/ci-dry-run/`
      already exists in this tree, meaning this path has already been exercised at least once.
      CR-02 — package.json's documented `deploy` script (`"deploy": "pnpm run guard:config &&
      wrangler deploy --config wrangler.jsonc"`) skips `archive-sync pre` entirely, confirmed by
      direct inspection; any page crossing the hot/archive boundary since the last CI sync deploys
      as neither static nor in R2 and 404s until the next CI build picks it up.
      Neither bug has a fix commit after the review (git log shows the review itself, ce2129e, as
      the most recent commit).
    artifacts:
      - path: "tools/ci-build.mjs"
        issue: "Lines ~506-522: post-sync spawned unconditionally even when wrangler deploy ran with --dry-run (confirmed by direct read)"
      - path: "package.json"
        issue: "'deploy' script runs plain 'wrangler deploy', bypassing archive-sync pre entirely (confirmed by direct read)"
      - path: "tools/archive-sync.mjs"
        issue: "Post-sync deletions keyed on local dist/client state, not on what is actually live-deployed (CR-01/WR-01)"
    missing:
      - "Gate post-sync on a dry-run flag / live-deployment match, per 05-REVIEW.md's CR-01 fix proposal"
      - "Make the deploy script refuse to run without a confirmed pre-sync marker, per CR-02's fix proposal"
  - truth: "Roadmap criterion 5 / REND-10: the hot-content cutoff is derived from measured request traffic — a capability, not a one-time fluke"
    status: failed
    reason: >
      The original derivation (05-05, 202-day window, owner-approved) is real and not in
      question. But this verifier independently reproduced code-review finding WR-08 live against
      the current tree: `countOtherFiles()` in tools/derive-hot-window.mjs computes
      `walk(dist/client) - articles.length - tags.length`, and since `pnpm run build` now
      partitions archived pages OUT of dist/client, this returns -30467 (recursive dist/client
      file count 29,982 against 60,449 tier-facts article+tag entries) — confirmed by directly
      importing and calling the function in this session. Any real (non `--probe-day`)
      re-derivation run therefore throws `deriveHotWindow requires a non-negative integer
      deps.otherFiles` before doing anything. 05-12's own end-of-phase human-check instructs the
      owner to "ask for a re-run with another --coverage" if the derived window needs revisiting —
      that re-run is currently broken.
    artifacts:
      - path: "tools/derive-hot-window.mjs"
        issue: "countOtherFiles() (lines ~674-690) does not account for the archive-tier pages partition-archive.mjs moves out of dist/client; reproduced live returning -30467"
    missing:
      - "Count dist/client + dist/archive together (or otherwise account for partitioned pages) before the re-derivation path is exercised again"
deferred:
  - truth: "Roadmap criterion 2: an archived-article request's Worker→R2 latency is shown to fit inside the 1.5s LCP budget"
    addressed_in: "Phase 11"
    evidence: >
      Phase 5's own canonical measurement (05-11) reports R2_LATENCY_EXCEEDS_LCP (archived p95 LCP
      1,788ms vs the 1,500ms budget; R2/KV cost itself is small and not the cause — p95 172ms/155ms).
      Phase 11 Success Criterion 2 explicitly states "Field p75 mobile measures LCP under 1.5s" as
      the real release gate, and 05-11-SUMMARY.md / WINDOWS.md entry #27 both explicitly frame this
      finding as "flagged for owner review before Phase 11's real field-LCP release gate." This is
      not a silent pass — Phase 5's own literal criterion-2 text is NOT met today, only carried
      forward with full disclosure to the phase that actually gates on it.
behavior_unverified_items:
  - truth: "Roadmap criterion 4: total deployed static-asset file count is reported daily"
    test: "Confirm a real ntfy low-priority daily file-count report has actually arrived (not just that the code path to send one exists and is wired into tools/ci-build.mjs)"
    expected: "One daily report notification per day, with count vs. the 100,000 ceiling and the 80,000 fail threshold"
    why_human: "This is a recurring runtime behavior (a notification arriving on a schedule) that a one-time code/wiring check cannot observe; 05-12's own Task 3 human-check list names this exact confirmation and it is not recorded as resolved anywhere in 05-VALIDATION.md's Manual-Only Verifications table"
human_verification:
  - test: "Confirm a real ntfy daily file-count report has arrived today, and that no archive alert fired unexpectedly"
    expected: "One low-priority ntfy notification per day with the current file count against the 100,000/80,000 thresholds"
    why_human: "Recurring scheduled behavior; the code path (tools/ci-build.mjs's dailyReport logic) is confirmed present and wired, but actual delivery was never checked by this verifier or recorded as resolved in 05-VALIDATION.md"
  - test: "Reconcile the ARCH-08 CPU-outlier count: is it 1 request (per docs/phase-05/zero-reads-gate.md) or 4 (per the orchestrator's independent Workers Observability query)?"
    expected: "A definitive count and, ideally, a root-cause correlation with Server-Timing/isolate-cold-start data (code review IN-01), pulled from Workers Observability/Logs directly rather than the GraphQL aggregate tool this repo's own measurement script uses"
    why_human: "This verifier confirmed the repo's own tool (tools/measure-worker-kv-cpu.mjs) is structurally incapable of listing individual over-threshold requests (live-confirmed via GraphQL schema introspection); resolving the discrepancy requires a data source neither this verifier nor the project's own tooling currently queries"
  - test: "Decide whether CR-01/CR-02 (destructive dry-run post-sync; deploy script skipping pre-sync) must be fixed before Phase 6 relies on this pipeline, or tracked as an accepted risk"
    expected: "An explicit owner decision, recorded in STATE.md or an override, one way or the other"
    why_human: "This is a product/engineering risk-acceptance call on a real, reproducible defect, not something an automated check resolves"
---

# Phase 5: Hybrid Archive & Zero-Reads Proof — Verification Report

**Phase Goal:** Prove the premise — a public request reads zero D1 rows — or stop the project here for architecture review.
**Verified:** 2026-10-01T22:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### The core premise (ARCH-01) — VERIFIED

This is the one truth the phase was commissioned to prove, and it holds up under independent
re-checking, not just by reading the SUMMARY:

- **Structural leg, re-confirmed live by this verifier**: `GET /accounts/{id}/workers/scripts/915tldr-v2/settings`
  against the real Cloudflare API, run directly in this verification session, returns binding
  types `["r2_bucket", "assets", "kv_namespace"]` — **no `d1` binding**, independently of the
  SUMMARY's claim.
- **"No per-Worker D1 attribution exists" claim, re-confirmed live by this verifier**: a direct
  GraphQL introspection of `AccountD1AnalyticsAdaptiveGroupsDimensions` in this session returned
  exactly `databaseId, databaseRole, date, datetime, datetimeFifteenMinutes, datetimeFiveMinutes,
  datetimeHour, datetimeMinute, datetimeSixHours, servedByInstance, servedByRegion` — no
  `scriptName`/`workerName`-shaped field. The criterion-1 reinterpretation (structure + delta,
  not a literal "0 rows by this Worker" query) is a real platform limitation, not a convenient
  excuse.
- **Delta leg**: load-window `rowsRead` (1,684,090) sits well inside the 7-day baseline
  (mean 3,743,139.29, +3σ = 9,913,212.29; z = −1.0011). Code review CR-03 (confirmed by direct
  inspection below) found the load window is measured over slightly fewer 5-minute buckets than
  the baseline (bucket-alignment bias toward PASS), but the corrected number (~1.87M) still sits
  far below even the lowest single baseline window (2,399,162) — the verdict is robust to the
  correction. CR-03 is tracked as a tooling-correctness gap for the *next* gate run, not a reason
  to distrust this one's PASS.

**ARCH-01 is genuinely proven, not merely asserted.** This is the headline result and it checks out.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP Phase 5 criterion, verbatim intent) | Status | Evidence |
|---|---|---|---|
| 1 | D1 analytics shows 0 rows read attributable to the public worker (structure + measured delta, reinterpreted) | ✓ VERIFIED | Live-reconfirmed: no D1 binding on deployed Worker; no per-Worker D1 analytics dimension exists; z=-1.0011 within background even after CR-03's bucket-alignment correction |
| 2 | Archived-article Worker→R2 latency shown to fit inside the 1.5s LCP budget | ✗ FAILED (deferred to Phase 11, see Deferred Items) | docs/phase-05/archive-latency.md: `R2_LATENCY_EXCEEDS_LCP` — archived p95 LCP 1,788ms vs 1,500ms budget, canonical run |
| 3 | ≤1 KV read and <5ms Worker CPU (p99) / <20ms (max), measured on the deployed Worker | ✗ FAILED | docs/phase-05/zero-reads-gate.md: KV fine (202/8,464); `CPU_OVER_BUDGET`, max 49.966ms. Severity/count disputed — see gap and human-verification item |
| 4 | Tag pages default to archive tier, top-N promoted hot; file count reported daily, 80k build-fail gate | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (mechanism verified; daily-delivery behavior not confirmed) | `FILE_COUNT_FAIL_THRESHOLD = 80_000` confirmed live in `tools/assert-file-count.mjs`; tag threshold (10) tested in 05-01; daily-report wiring confirmed in `tools/ci-build.mjs`. Actual daily arrival never confirmed by any human or test — see human_verification |
| 5 | Hot cutoff derived from measured traffic (not a guess); full re-render under the governing CPU/build ceiling | ✗ FAILED | One-time derivation (05-05) and re-render convergence (`ARCHIVE_RERENDER_CONVERGES`, 05-10) are real and well-evidenced. But re-derivation is currently broken: `countOtherFiles()` reproduced live by this verifier returns **-30467** against the current `dist/client`, so any real re-run throws before doing anything (code review WR-08, confirmed) |

**Score:** 1/4 roadmap criteria cleanly verified (criterion 2 excluded from this score — see Deferred Items; criterion 4 is present+wired but has one unconfirmed recurring behavior).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Criterion 2 (R2 latency fits the 1.5s LCP budget) | Phase 11 | Phase 11 SC2: "Field p75 mobile measures LCP under 1.5s..." — the real release gate; 05-11/WINDOWS.md #27 explicitly defer the field measurement there while disclosing the lab finding now |

### Requirements Coverage

All 8 requirement IDs assigned to this phase (ARCH-01, ARCH-08, REND-07, REND-08, REND-09,
REND-10, REND-11, REND-12) are claimed across the 12 plans' frontmatter — none are orphaned
(verified by grepping every `requirements:` line across `05-*-PLAN.md` against REQUIREMENTS.md's
Phase 5 row).

| Requirement | Plan(s) | REQUIREMENTS.md status | Verifier finding |
|---|---|---|---|
| ARCH-01 | 05-04, 05-12 | Complete | ✓ SATISFIED — independently re-confirmed live (see above) |
| ARCH-08 | 05-03, 05-04, 05-12 | Complete (caveat) | ✗ BLOCKED on the CPU axis — a failed budget is a gap, not a caveat on "Complete"; severity disputed (1 vs 4 outliers), see gap |
| REND-07 | 05-02, 05-06, 05-07, 05-08, 05-09, 05-10, 05-11 | Complete | ✗ BLOCKED on operational-safety grounds — happy path live-confirmed, but CR-01/CR-02 (confirmed by direct code read) can break the "rendered once, reliably served" invariant under real paths already exercised in this tree |
| REND-08 | 05-03, 05-09, 05-11 | Complete | ✗ BLOCKED, same reason as REND-07 — happy path live-confirmed (curl spot-checks below), pipeline-safety gap unresolved |
| REND-09 | 05-01, 05-06 | Complete | ✓ SATISFIED — tag-threshold tests (9/10/11 boundary) + live `/tag/crucero` served as archive-tier, matching design |
| REND-10 | 05-01, 05-05 | Complete | ✗ BLOCKED on the re-derivation axis — one-time derivation is real; the re-run capability is currently broken (live-reproduced, WR-08) |
| REND-11 | 05-06, 05-08, 05-09 | Complete | ⚠️ Mechanism SATISFIED; daily-delivery behavior not confirmed by any human or test (human_verification item) |
| REND-12 | 05-07, 05-08, 05-10 | Complete | ✓ SATISFIED — real production forced-full-reupload (30,501 objects, 0 failures) measured on Workers Builds; criterion-5 "300s" reinterpretation (Worker CPU doesn't apply to a build-time process; governing ceiling is Workers Builds' 20-minute wall clock) is architecturally sound and disclosed plainly |

### Live Spot-Checks Performed By This Verifier

| Check | Command/Method | Result |
|---|---|---|
| Deployed Worker bindings | `GET /accounts/{id}/workers/scripts/915tldr-v2/settings` (live, this session) | `["r2_bucket","assets","kv_namespace"]` — no `d1` binding, confirming leg 1b independently |
| D1 analytics per-Worker dimension | Live GraphQL introspection of `AccountD1AnalyticsAdaptiveGroupsDimensions` | No `scriptName`/`workerName` field — confirms the criterion-1 reinterpretation is a real platform limit |
| Archived article serving | `curl -I https://dev.915tldr.com/business/airbnb-market-trends-...` | `200`, `server-timing: archive;desc=r2, kv;dur=115, r2;dur=87` — matches claims |
| Archived tag serving | `curl -I https://dev.915tldr.com/tag/crucero` | `200`, `server-timing: archive;desc=r2, r2;dur=90` (zero KV, matching the tag branch's design) |
| `tools/ci-build.mjs` CR-01 claim | Direct read, lines ~506-522 | Confirmed: post-sync spawn is unconditional on `dryRun`; only the `wrangler deploy`/commit step is skipped |
| `package.json` CR-02 claim | Direct read | Confirmed: `"deploy": "pnpm run guard:config && wrangler deploy --config wrangler.jsonc"` — no `archive-sync pre` call |
| `tools/derive-hot-window.mjs` WR-08 claim | Direct function call: `countOtherFiles()` against the current tree | Confirmed: returns **-30467** (dist/client recursive count 29,982 vs. 60,449 tier-facts article+tag entries) |
| `tools/load-test-zero-reads.mjs` CR-03 claim | Direct read, lines ~84-86, ~154-160, ~873-881 | Confirmed: `loadWindow` passed to `fetchD1RowsRead` unaligned; `comparableWindows()` aligns baseline windows to 5-minute boundaries — the two sides use different alignment |
| Code review fix status | `git log --oneline -5` | No fix commits after `ce2129e` (the review itself is the most recent commit) — all findings above remain live and unfixed |

### Anti-Patterns / Code-Review Findings (05-REVIEW.md, committed, unfixed)

| Finding | Severity | Verifier confirmation | Impact |
|---|---|---|---|
| CR-01: dry-run rehearsal still runs destructive post-sync against production R2 | Critical | Confirmed by direct code read | Breaks REND-07/REND-08 under a path already exercised in this tree |
| CR-02: documented `pnpm run deploy` skips pre-sync entirely | Critical | Confirmed by direct code read | Breaks REND-07/REND-08 under the documented manual deploy path |
| CR-03: gate load window measured over fewer buckets than baseline (PASS-biased) | Critical | Confirmed by direct code read; verdict survives correction | Tooling-correctness gap; does not reverse ARCH-01's PASS |
| WR-08: `derive-hot-window` cannot run against a partitioned build | Warning (promoted — live-reproduced) | **Independently reproduced live by this verifier**: -30467 | Blocks REND-10 re-derivation capability right now |
| WR-01/WR-02/WR-03/WR-04/WR-05/WR-06/WR-07/WR-09 | Warning | Not independently re-run (time-boxed); code citations in 05-REVIEW.md are specific and plausible given CR-01/CR-02/WR-08's confirmed accuracy rate (3/3 spot-checked claims confirmed exactly) | Carried forward, not independently re-verified here |

### Human Verification Required

1. **Daily file-count report delivery** — confirm a real ntfy notification has actually arrived
   today with the file count vs. the 100,000/80,000 thresholds. The code path exists and is
   wired (`tools/ci-build.mjs`), but delivery was never confirmed by a human or a test, and is not
   listed as resolved in 05-VALIDATION.md's Manual-Only Verifications table.
2. **ARCH-08 CPU-outlier count** — reconcile "1 outlier" (project's own gate doc) against "4
   outliers" (orchestrator's independent Workers Observability query, which uses a dataset this
   repo's own tooling cannot query). This verifier confirmed the repo's tool structurally cannot
   answer this question; resolving it needs direct Workers Observability/Logs access.
3. **CR-01/CR-02 risk acceptance** — an explicit owner decision on whether the archive-sync
   pipeline's two confirmed critical bugs must be fixed before Phase 6 relies on it, or are an
   accepted, tracked risk.

### Gaps Summary

The phase's headline result — **ARCH-01, zero D1 reads on the public path — is genuinely proven**,
and this verifier independently re-confirmed its two load-bearing structural facts (no D1 binding;
no per-Worker D1 analytics dimension) live, not just by reading the SUMMARY. That result should
not be read down because of the gaps below.

But three of the other four roadmap success criteria for this phase are not met as literally
written, and the phase's own committed code review — produced as part of this phase's own
deliverables, not by this verifier — found two critical, still-unfixed bugs (CR-01, CR-02) that
can break the archive tier's basic serving invariant under operational paths already exercised in
this repository. This verifier independently confirmed all three of the review's most material
claims (CR-01, CR-02, and WR-08) by direct code inspection or by actually running the affected
function, and every one checked out exactly as described. ARCH-08's CPU budget failure is real by
the project's own measurement; the dispute is only over how many requests breached it, a question
neither the project's tooling nor this verifier's own live re-check could resolve with the data
sources available — which is itself worth escalating, since "we don't know if it's 1 or 4" is a
different risk posture than "a single fluke."

None of this should halt the project (D-02 applies only to the `ZERO_READS_*` verdict, which is
`PROVEN`) — but "Phase 5 complete" and "REND-07/08/10 Complete, ARCH-08 Complete (caveat)" in
REQUIREMENTS.md overstate what currently holds up under independent re-checking.

---

_Verified: 2026-10-01T22:30:00Z_
_Verifier: Claude (gsd-verifier)_

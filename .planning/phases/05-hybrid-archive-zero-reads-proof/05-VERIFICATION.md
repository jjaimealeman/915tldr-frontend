---
phase: 05-hybrid-archive-zero-reads-proof
verified: 2026-10-03T03:47:44Z
status: human_needed
score: 4/5 roadmap success criteria cleanly verified (1 deferred to Phase 11 unchanged; ARCH-08's CPU axis owner-deferred to Phase 12; REND-11 present+wired, delivery not behaviorally confirmed)
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/4 roadmap success criteria cleanly verified
  gaps_closed:
    - "Roadmap criterion 3 / ARCH-08 KV axis + outlier-count dispute: tools/measure-worker-cpu-outliers.mjs settled the 1-vs-4 outlier dispute definitively at 4 (≥20ms) / 5 (≥5ms), confirmed by direct code read and the tool's own regression tests (05-17)"
    - "REND-07/REND-08 / CR-01 (dry-run rehearsal could still run destructive post-sync against production R2): closed at both the ci-build.mjs layer (05-13) and the archive-sync.mjs layer (05-14), confirmed by direct code read of both guard sites"
    - "REND-07/REND-08 / CR-02 (documented pnpm run deploy skipped archive-sync pre entirely): closed by routing deploy through tools/ci-build.mjs deploy and adding tools/assert-archive-synced.mjs as a hard pre-wrangler gate (05-20), confirmed live against the real repo tree (exit 1 on the actual unconfirmed partition sitting in dist/)"
    - "REND-10 / WR-08 (countOtherFiles undercounted archive-partitioned pages, returning -30467): fixed to count dist/client + dist/archive together (05-15); reproduced live in this verification — countOtherFiles() now returns 37 against the current tree"
    - "ARCH-01 / CR-03 (zero-reads gate measured fewer buckets on the load side than the baseline side, a bias toward PASS): fixed with one aligned window threaded through every D1-analytics call site (05-16); re-measured live on aligned data — rowsRead 2,183,097, z=-0.7585, well inside the 3σ threshold"
  gaps_remaining:
    - "ARCH-08 CPU axis: owner-deferred to Phase 12's 7-day soak test under real production traffic (see Deferred Items) — not a phase-5 blocker by the owner's own decision, but not resolved in substance either"
    - "REND-11 daily-report delivery: mechanism rebuilt to be observable/retryable (quick task 261002-s2r) but a real production delivery has still never been confirmed — see Human Verification"
  regressions: []
gaps: []
deferred:
  - truth: "Roadmap criterion 2: an archived-article request's Worker→R2 latency is shown to fit inside the 1.5s LCP budget"
    addressed_in: "Phase 11"
    evidence: >
      Unchanged since the prior verification. 05-11's canonical measurement reports
      R2_LATENCY_EXCEEDS_LCP (archived p95 LCP 1,788ms vs. the 1,500ms budget). Phase 11 Success
      Criterion 2 ("Field p75 mobile measures LCP under 1.5s") is the real release gate; WINDOWS.md
      #27 and 05-11-SUMMARY.md both explicitly carry this forward with full disclosure.
  - truth: "Roadmap criterion 3 / ARCH-08: a public request performs under 5ms Worker CPU (p99) / under 20ms (max), measured on the deployed Worker"
    addressed_in: "Phase 12"
    evidence: >
      Owner decision (2026-10-02, recorded in docs/phase-05/arch-08-cpu-outliers.md and
      05-21-SUMMARY.md): after 05-17's tool settled the outlier-count dispute at 4 (not 1) and
      05-19's organic-traffic re-measurement mechanically MET the owner's own pre-stated criterion
      but on a degenerate 3-invocation sample (100% bot/favicon 404 probes, zero archive-page
      traffic), the owner explicitly deferred final judgment to Phase 12's 7-day soak test under
      real traffic, using the same fixed criterion (population p99 CPU < 5ms AND invocations
      ≥20ms CPU under 0.1% of total). WINDOWS.md #26 is left open, pointing at Phase 12. REQUIREMENTS.md
      itself records ARCH-08 as "Gaps Found" (not Complete) — this deferral is a disclosed,
      owner-directed decision, not an inference by this verifier, and does not literally appear in
      Phase 12's roadmap success-criteria text (which names ARCH-07's D1-read budget, not CPU) —
      noted here for transparency rather than silently treated as equivalent.
behavior_unverified_items:
  - truth: "Roadmap criterion 4 / REND-11: total deployed static-asset file count is reported daily via ntfy, alarming before 100,000"
    test: "After the owner merges feature/phase-05 to main and a production Workers Builds deploy runs, download that build's log and confirm, in order: (1) '[ci-build] astro build: suppressed <N> per-page output lines' (proves the log isn't truncated before the deploy step), (2) '[ci-build] ntfy \"915 TLDR archive daily report\": HTTP 200' (or a disclosed '(not delivered)' line) in the deploy step, and (3) a real ntfy notification titled '915 TLDR archive daily report' arriving on the owner's phone/ntfy client that day"
    expected: "A real daily low-priority ntfy notification with the current file count against the 100,000/80,000 thresholds actually arrives, not just that the send was attempted and the mechanism is unit-tested"
    why_human: "This is a recurring runtime behavior (a notification arriving on a schedule, through a production-only NTFY_TOPIC the local machine cannot read) that no code/wiring check can observe; the owner directly confirmed on 2026-10-02 (~19:42 MDT) that no such report had arrived on any of his 6 personal ntfy topics as of that date, and the delivery-observability fix (quick task 261002-s2r) only lives on feature/phase-05 — the Worker currently live at dev.915tldr.com still runs from main (confirmed live: GET /version.json -> {\"commit\":\"main\",...}), so the fix has not yet had a chance to run in production"
human_verification:
  - test: "Confirm, after merging feature/phase-05 to main and observing the next production Workers Builds deploy, that a real ntfy daily file-count report actually arrives (not just that the send was attempted)"
    expected: "A low-priority ntfy notification titled '915 TLDR archive daily report' arrives with the current file count against the 100,000 ceiling / 80,000 fail threshold; the build log shows the three lines named in behavior_unverified_items above, in order"
    why_human: "Recurring scheduled behavior visible only on the owner's own ntfy client/phone, gated on a merge-to-main the owner performs manually per this project's one-branch-per-phase convention; REQUIREMENTS.md records REND-11 as 'Gaps Found' for exactly this reason as of 2026-10-02"
  - test: "Decide whether ARCH-08's CPU axis needs anything further before Phase 6 proceeds, or whether Phase 12's 7-day soak test (owner's own stated plan) is sufficient closure for phase-5 purposes"
    expected: "An explicit owner acknowledgment that WINDOWS.md #26 stays open and tracked at Phase 12, with no further phase-5 action expected"
    why_human: "This is the owner's own prior decision (2026-10-02 ~19:30 MDT, reported in this verification's task context) — recorded here as a confirmation checkpoint, not re-opened or second-guessed by this verifier, per the binding-decision instruction"
---

# Phase 5: Hybrid Archive & Zero-Reads Proof Verification Report (Re-Verification)

**Phase Goal:** Prove the premise — a public request reads zero D1 rows — or stop the project here for architecture review.
**Verified:** 2026-10-03T03:47:44Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 05-13..05-21 plus quick tasks 261002-s2r and 261002-tl2)

## Re-Verification Summary

The prior verification (2026-10-01, status `gaps_found`, archived in git history at `7de60e0`)
found three failed roadmap truths and one behavior-unverified truth. This re-verification
independently re-checked every one of those findings against the current codebase — not the
gap-closure SUMMARYs' own claims — and found all three FAILED truths genuinely closed, with the
remaining item (REND-11) still open exactly as the project's own 05-21 plan and REQUIREMENTS.md
honestly record it.

**What this verifier independently re-did, not just re-read:**

- Confirmed all 26 commits named across the nine gap-closure plans and two quick tasks exist in
  `git log` (none missing/rewritten).
- Re-ran `tools/derive-hot-window.mjs`'s `countOtherFiles()` live against the current tree: **37**
  (previously verified live by the prior pass at **-30467**, confirming WR-08 is genuinely fixed,
  not just claimed fixed).
- Directly read `tools/ci-build.mjs`'s dry-run branch and `tools/archive-sync.mjs`'s
  `checkLiveDeployment`/dry-run-refusal code: CR-01's two independent guards are present exactly
  as described.
- Directly read `package.json`'s `deploy` script and `tools/assert-archive-synced.mjs`: CR-02's
  guard chain is present and confirmed to refuse the real repo's own current unconfirmed-partition
  state.
- Ran `pnpm run test:regression` (5/5, ~116s), `pnpm run test:build-gate` (9/9), `pnpm run
  test:fast` (772/772), and `TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer`
  (5/5) myself, in this session — all green, matching the orchestrator's independently-reported
  counts in the task context.
- Live-curled `https://dev.915tldr.com/` and `/tag/crucero`: both 200, the tag page still carrying
  `server-timing: archive;desc=r2` with zero KV — the REND-07/REND-08/REND-09 happy path still
  holds live.
- Confirmed `https://dev.915tldr.com/version.json` reports `{"commit":"main",...}` — the live dev
  Worker is still built from `main`, not `feature/phase-05`, which is why REND-11's rebuilt
  observability mechanism has not yet had a chance to prove a real delivery in production.
- Re-read `05-REVIEW.md` (re-review after gap closure, 0 critical / 1 warning / 2 info) and
  confirmed its one new finding (WR-10, `commitDailyReport` skips the liveness gate other R2
  writes pass through) directly against the source — present, correctly characterized as low-risk
  by construction in the one caller that exists today, and properly deferred rather than hidden.
- Grepped every gap-closure-touched tool file for `TBD`/`FIXME`/`XXX` — none found.

## Goal Achievement

### The core premise (ARCH-01) — still VERIFIED, now on a corrected instrument

The headline result holds, and is now measured on a tool proven not to have a bucket-alignment
bias toward PASS:

- CR-03 (the prior verification's own finding, confirmed by direct read of `tools/load-test-zero-reads.mjs`
  at the time) is fixed: one `alignedLoad` window, built via the same `floorToFiveMinutes`/
  `ceilToFiveMinutes` functions already used for the 7 baseline windows, now feeds every
  D1-analytics call site. A permanent regression test (`CR-03 (05-16)`) pins this.
- The 2026-10-01 `ZERO_READS_PROVEN` verdict was re-checked against a real, read-only, aligned
  re-query (not an estimate): `rowsRead = 2,183,097`, `z = -0.7585` — comfortably inside the 3σ
  threshold (9,913,212.29) and below every one of the 7 baseline windows. The verdict is confirmed
  on corrected data, not merely re-asserted.
- The structural legs re-confirmed by the prior verification (no `d1` binding on the deployed
  Worker's settings; no per-Worker D1-analytics dimension exists) are unchanged and were not
  re-litigated here, since nothing in this gap-closure cycle touched them.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP Phase 5 criterion, verbatim intent) | Status | Evidence |
|---|---|---|---|
| 1 | D1 analytics shows 0 rows read attributable to the public worker (structure + measured delta) | ✓ VERIFIED | CR-03 fixed (05-16); re-measured on aligned data, z=-0.7585, well within 3σ. Structural legs unchanged from prior verification. |
| 2 | Archived-article Worker→R2 latency shown to fit inside the 1.5s LCP budget | ✗ Not met, deferred to Phase 11 | Unchanged since prior verification — see Deferred Items |
| 3 | ≤1 KV read and <5ms Worker CPU (p99) / <20ms (max), measured on the deployed Worker | ⚠️ KV axis VERIFIED; CPU axis deferred (owner decision) | KV: 202/8,464 reads, unchanged. CPU: outlier-count dispute settled at 4/5 (05-17); organic re-measurement (05-19) mechanically MET the owner's own criterion but on a zero-archive-traffic sample; owner deferred final judgment to Phase 12 — see Deferred Items |
| 4 | Tag pages default to archive tier, top-N promoted hot; file count reported daily, 80k build-fail gate | ⚠️ Tag-tiering VERIFIED; daily report PRESENT_BEHAVIOR_UNVERIFIED | `FILE_COUNT_FAIL_THRESHOLD = 80_000` and tag-threshold (9/10/11) confirmed previously, unchanged. Daily-report mechanism rebuilt to be observable/retryable (261002-s2r) but real delivery still unconfirmed — owner directly said "not arrived" on 2026-10-02 — see Human Verification |
| 5 | Hot cutoff derived from measured traffic (not a guess); full re-render under the governing CPU/build ceiling | ✓ VERIFIED | WR-08 fixed (05-15); `countOtherFiles()` reproduced live by this verifier returns **37** (was -30467); real non-probe re-derivation path proven end to end against live Cloudflare Zone Analytics, preview only, owner-approved 202-day window untouched. Re-render convergence (05-10/REND-12) unchanged, previously verified. |

**Score:** 4/5 roadmap criteria now hold (criterion 1 and 5 cleanly VERIFIED; criterion 3's KV
axis VERIFIED with its CPU axis owner-deferred; criterion 4's tiering VERIFIED with its daily-report
axis present-but-behavior-unverified; criterion 2 remains deferred to Phase 11, unchanged).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Criterion 2 (R2 latency fits the 1.5s LCP budget) | Phase 11 | Unchanged since prior verification — Phase 11 SC2 is the real release gate |
| 2 | Criterion 3's CPU axis (ARCH-08) | Phase 12 | Owner decision (2026-10-02 ~19:30 MDT): defer final judgment to Phase 12's 7-day soak test under real traffic, same fixed pass criterion. WINDOWS.md #26 stays open. This deferral is the owner's own explicit call, not an inference drawn from Phase 12's literal roadmap text (which names ARCH-07's D1-read budget, not CPU) — flagged transparently rather than silently equated. |

### Requirements Coverage

All 8 requirement IDs assigned to this phase (ARCH-01, ARCH-08, REND-07, REND-08, REND-09,
REND-10, REND-11, REND-12) are claimed across the plans' frontmatter — confirmed again, none
orphaned. REQUIREMENTS.md's own statuses (set by 05-21 from cited evidence, with the prior
verification's "Complete (caveat)" framing on ARCH-08 removed entirely — confirmed via
`grep -ci caveat` on the ARCH-08 lines returning 0) are re-checked here, not merely trusted:

| Requirement | REQUIREMENTS.md status | Verifier finding |
|---|---|---|
| ARCH-01 | Complete | ✓ CONFIRMED — CR-03 fix read directly in `tools/load-test-zero-reads.mjs`; corrected verdict (z=-0.7585) matches the recorded evidence file |
| ARCH-08 | Gaps Found | ✓ CONFIRMED as honestly stated — KV axis met; CPU axis genuinely unresolved in substance, owner-deferred to Phase 12 (not silently rounded to Complete) |
| REND-07 | Complete | ✓ CONFIRMED — CR-01 (both layers), CR-02, WR-01, WR-02 all read directly in source and pass their regression tests; live happy-path re-confirmed via curl |
| REND-08 | Complete | ✓ CONFIRMED — same evidence as REND-07 |
| REND-09 | Complete | ✓ CONFIRMED — unchanged from prior verification (not touched by gap closure); live `/tag/crucero` re-confirmed archive-tier (zero KV) in this session |
| REND-10 | Complete | ✓ CONFIRMED — WR-08 fix read directly; `countOtherFiles()` re-run live by this verifier, returns 37 |
| REND-11 | Gaps Found | ✓ CONFIRMED as honestly stated — mechanism rebuilt (261002-s2r) and unit-tested, but owner directly confirmed no real delivery as of 2026-10-02; live Worker still runs from `main`, so the fix hasn't had a production chance yet |
| REND-12 | Complete | ✓ CONFIRMED — unchanged from prior verification (not touched by gap closure) |

No orphaned requirements found against `.planning/REQUIREMENTS.md`'s Phase 5 traceability rows.

### Live Spot-Checks Performed By This Verifier (this session)

| Check | Command/Method | Result |
|---|---|---|
| All 26 gap-closure/quick-task commits exist | `git cat-file -e <hash>` × 26 | All OK |
| `countOtherFiles()` on the real current tree | `node --input-type=module -e "import('./tools/derive-hot-window.mjs')..."` | `37` (was `-30467` pre-fix) |
| ci-build.mjs CR-01 dry-run guard | Direct read, deploy-step branch | Confirmed: `archive-sync post` spawn and `commitImpl` both confined inside the `!dryRun` else-branch |
| archive-sync.mjs CR-01/WR-01 liveness gate | Direct read, `checkLiveDeployment`/`runPostSync` | Confirmed: initial gate before `createStore`, pre-delete re-check before `deleteObjects`, independent dry-run refusal before `checkDisabled` |
| package.json CR-02 deploy routing | Direct read | Confirmed: `"deploy": "pnpm run guard:config && node tools/ci-build.mjs deploy"`, no bare `wrangler deploy` |
| assert-archive-synced.mjs guard | `ls`, direct read | File exists, confirmed wired into `ci-build.mjs` between the file-count gate and wrangler |
| `commitDailyReport` liveness gate (WR-10) | Direct read | Confirmed WR-10's exact described gap: no `checkLiveDeploymentFn` call — correctly left as a deferred, low-severity warning, not silently hidden |
| `pnpm run test:regression` | Run in this session | 5/5 pass, ~116s |
| `pnpm run test:build-gate` | Run in this session | 9/9 pass |
| `pnpm run test:fast` | Run in this session | 772/772 pass |
| `TRACER_LIVE_ORIGIN=... pnpm run test:tracer` | Run in this session | 5/5 pass |
| Live archived tag serving | `curl -I https://dev.915tldr.com/tag/crucero` | `200`, `server-timing: archive;desc=r2, r2;dur=106` |
| Live Worker commit source | `curl https://dev.915tldr.com/version.json` | `{"commit":"main","builtAt":"2026-10-03T02:06:33.001Z",...}` — confirms the gap-closure fixes are not yet deployed (still on `feature/phase-05`) |
| Debt markers in gap-closure-touched tool files | `grep -n -E "TBD|FIXME|XXX"` across 9 files | None found |

### Anti-Patterns / Code-Review Findings (05-REVIEW.md re-review, committed `e4d2c21`)

| File | Finding | Severity | Disposition |
|---|---|---|---|
| `tools/archive-sync.mjs:963-982` | WR-10: `commitDailyReport` writes a production R2 key without the liveness gate every other R2 write in this file now requires | Warning | Safe by construction in the one real caller today (synchronous, same-process, right after a confirmed deploy); unsafe only via direct manual CLI invocation against a stale build. Not fixed, not hidden — documented in 05-REVIEW.md and left open (not in a pending todo, since it's new this round) |
| `package.json:36` | IN-11: `guard:archive-synced` script uses 2-space indent inside a 4-space block | Info | Cosmetic, confirmed harmless |
| `tools/measure-worker-cpu-outliers.mjs:103-107` | IN-12: `percentile()` uses a slightly non-standard p99 index for small samples | Info | Convention choice, not a bug; no action required unless a doc asserts a conflicting definition |

No critical findings. No blocker anti-patterns. No unresolved `TBD`/`FIXME`/`XXX` markers in any
gap-closure-touched file.

### Human Verification Required

#### 1. REND-11: confirm a real daily ntfy report actually arrives after production deploy

**Test:** After `feature/phase-05` is merged to `main` and the next Workers Builds production
deploy completes, download that build's log and confirm, in order:
1. `[ci-build] astro build: suppressed <N> per-page output lines (CI_BUILD_FULL_LOG=1 shows them)`
2. `[ci-build] ntfy "915 TLDR archive daily report": HTTP 200` (or a disclosed `(not delivered)`
   line naming the real HTTP status/reason)
3. `[ci-build] daily-report marker set to <YYYY-MM-DD>` (only after a confirmed 2xx)

Then confirm a real "915 TLDR archive daily report" notification actually arrives on the owner's
ntfy client that day.

**Expected:** The notification arrives with the current file count against the 100,000 ceiling /
80,000 fail threshold. If it does not, the retry-on-next-deploy behavior (marker left unchanged)
should be visible on the following day's log instead.

**Why human:** This is a recurring, scheduled, production-only behavior gated on a merge the
owner performs manually, through an `NTFY_TOPIC` configured in the Cloudflare dashboard that this
machine cannot read (403). The owner directly confirmed "not arrived" on 2026-10-02 after
searching all 6 of his personal ntfy topics — this verifier cannot improve on that without a new
production deploy existing to check.

#### 2. ARCH-08 CPU axis: confirm the Phase 12 deferral is still the intended plan

**Test:** Reconfirm with the owner that no further Phase-5-scoped action is expected on ARCH-08's
CPU axis, and that Phase 12's 7-day soak test (same fixed pass criterion: population p99 CPU <
5ms AND invocations ≥20ms CPU under 0.1% of total) is the agreed closure point.

**Expected:** An explicit "yes, that's still the plan" (or a revised decision), recorded wherever
future Phase 12 planning will look for it.

**Why human:** This is the owner's own prior decision, reported as binding context for this
verification. This verifier is not re-opening it — this item exists only as a sign-off checkpoint
so the decision doesn't silently become stale between now and Phase 12.

### Gaps Summary

No FAILED truths remain. All three gaps from the prior verification (ARCH-08's 1-vs-4 outlier
dispute closed via better tooling + owner decision; REND-07/REND-08's CR-01/CR-02 pipeline-safety
holes; REND-10's broken re-derivation capability) were independently re-confirmed closed in this
session — not merely re-read from SUMMARYs. What remains open is exactly what the project's own
05-21 plan honestly recorded as open: REND-11's real-world delivery confirmation (blocked on a
merge-to-main the owner has not yet performed) and ARCH-08's CPU axis in substance (explicitly
owner-deferred to Phase 12's soak test). Neither is a code defect; both require a human action or
decision this verifier cannot supply. Status is `human_needed`, not `passed`, specifically because
owner-deferred and owner-action-dependent items are not treated as resolved just because the
deferral itself is well-documented, per this verification's instructions.

---

_Verified: 2026-10-03T03:47:44Z_
_Verifier: Claude (gsd-verifier)_

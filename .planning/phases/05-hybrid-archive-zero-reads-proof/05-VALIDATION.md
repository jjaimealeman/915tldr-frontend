---
phase: 5
slug: hybrid-archive-zero-reads-proof
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-30
updated: 2026-10-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `05-RESEARCH.md` § Validation Architecture. Filled in by 05-12 (Task 3) after every
> plan (05-01 through 05-12) completed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (unit/integration/regression/tracer) + Playwright for live browser journeys |
| **Config file** | none — `package.json` scripts |
| **Quick run command** | `pnpm run test:fast` |
| **Full suite command** | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` |
| **Measured runtime (2026-10-01, this session, warm cache)** | `pnpm run test:fast`: **676 tests, ~2.3s**. `pnpm run build` (warm): **~42s** (60,466 pages built, partition + file-count gate included). Full suite chain below: **see "Full Suite Result"**. |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test:fast`
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite green, plus the live gates (ARCH-01 leg 2 load test, ARCH-08 KV/CPU measurement, REND-12 full re-render measurement) run and documented — **confirmed, see below**.
- **Max feedback latency:** ~45 seconds (one warm build)

---

## Per-Task Verification Map

*One row per task across every plan in this phase (05-01 through 05-12). "Automated Command" is
the command that re-proves the row; "File Exists" confirms the test/evidence artifact is on disk
(re-checked live, 2026-10-01); "Status" is the last-observed real result, drawn from each plan's
own SUMMARY.md coverage section and re-confirmed by this session's full-suite re-run (see "Full
Suite Result" below). D-07b superseded D-07a: there is no daily collector — REND-10 was derived
live from the platform's real 31-day retention in 05-05, not a bootstrapped fallback.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|:---:|:---:|
| 05-01-T1 | 05-01 | 1 | REND-09, REND-10 | T-05-01 | Build emits tier facts; tier-report classifies them | integration (build) | `pnpm run build && node --test tests/unit/tier-facts.test.mjs && node tools/tier-report.mjs --json` | ✅ | ✅ pass |
| 05-01-T2 | 05-01 | 1 | REND-09 | T-05-02 | Tag threshold inclusive at 10; article cutoff inclusive; malformed hot window rejected | unit | `node --test tests/unit/tiering.test.mjs tests/unit/hot-window.test.mjs` | ✅ | ✅ pass |
| 05-01-T3 | 05-01 | 1 | REND-10 | T-05-02 | Every build logs the hot window; the bootstrap fallback says PROVISIONAL (superseded by 05-05's derived window) | integration (build) | build log grep for the hot-window line + `node --test tests/unit/tier-facts.test.mjs` | ✅ | ✅ pass |
| 05-02-T1 | 05-02 | 1 | REND-07 | T-05-SC | Package legitimacy confirmed before install (`@aws-sdk/client-s3@3.1144.0`) | checkpoint (blocking-human) | — (owner-resolved before 05-02's executor spawned) | N/A | ✅ resolved |
| 05-02-T2 | 05-02 | 1 | REND-07 | T-05-05, T-05-06 | Private bucket + bucket-scoped credential (owner) | checkpoint (human-action) | — (owner created `915tldr-archive`, bucket-scoped token) | N/A | ✅ resolved |
| 05-02-T3 | 05-02 | 1 | REND-07 | T-05-04, T-05-06 | Live R2 round trip; bucket has no public access | integration (live) | `node tools/r2-roundtrip.mjs` (with `.dev.vars` loaded) | ✅ | ✅ pass |
| 05-02-T4 | 05-02 | 1 | REND-07 | T-05-07, T-05-08 | Key allow-list; no secret in errors; guard rejects Worker → r2-client | unit + build-gate | `node --test tests/unit/r2-client.test.mjs && pnpm run test:build-gate` | ✅ | ✅ pass |
| 05-03-T1 | 05-03 | 1 | REND-08 | T-05-09, T-05-14 | Bundled Worker serves an archived canonical URL from R2 with one KV read | integration (bundle) | `pnpm exec wrangler deploy --dry-run --config wrangler.jsonc --outdir .wrangler/dry-run-05 && node --test tests/unit/worker-bundle.test.mjs tests/unit/article-redirect.test.mjs && pnpm run guard:config` | ✅ | ✅ pass |
| 05-03-T2 | 05-03 | 1 | REND-08, ARCH-08 | T-05-09, T-05-10, T-05-15 | Tag path, static parity, 503 on R2 error, ≤1 KV per request shape | unit | `node --test tests/unit/archive-route.test.mjs tests/unit/worker.test.mjs tests/unit/article-redirect.test.mjs` | ✅ | ✅ pass |
| 05-03-T3 | 05-03 | 1 | ARCH-08 | T-05-12 | Edge cache stores only archived 200s; hits cost 0 KV and 0 R2 | unit + bundle | dry-run bundle + `node --test tests/unit/worker.test.mjs tests/unit/worker-bundle.test.mjs && pnpm run test:build-gate && pnpm run guard:config` | ✅ | ✅ pass |
| 05-04-T1 | 05-04 | 1 | ARCH-01 | T-05-16, T-05-17 | Live D1 baseline on `552ba1d1`; deployed Worker has no D1 binding | unit + live | `node --test tests/unit/load-test-zero-reads.test.mjs && node tools/load-test-zero-reads.mjs --baseline-only --json` | ✅ | ✅ pass |
| 05-04-T2 | 05-04 | 1 | ARCH-01 | T-05-18 | Verdict can never be PASS on an invalid window | unit | `node --test tests/unit/load-test-zero-reads.test.mjs` | ✅ | ✅ pass |
| 05-04-T3 | 05-04 | 1 | ARCH-08 | T-05-16 | KV reads and CPU read live off the deployed Worker | unit + live | `node --test tests/unit/measure-worker-kv-cpu.test.mjs && node tools/measure-worker-kv-cpu.mjs --from <ISO> --to <ISO> --assume-no-build --json` | ✅ | ✅ pass |
| 05-05-T1 | 05-05 | 2 | REND-10 | T-05-19, T-05-21 | One live day of human-only article traffic matched and aged | unit + live | `node --test tests/unit/derive-hot-window.test.mjs && node tools/derive-hot-window.mjs --probe-day --json` | ✅ | ✅ pass |
| 05-05-T2 | 05-05 | 2 | REND-10 | T-05-20 | Coverage cutoff, file-budget cap, atomic write, fallback writer | unit | `node --test tests/unit/derive-hot-window.test.mjs` | ✅ | ✅ pass |
| 05-05-T3 | 05-05 | 2 | REND-10 | T-05-19 | Derived (not provisional) window written and used by the build | live + build | `src/lib/archive/hot-window.json` status check + `node --test tests/unit/hot-window.test.mjs` + build log grep (0 PROVISIONAL occurrences) | ✅ | ✅ pass |
| 05-06-T1 | 05-06 | 2 | REND-07, REND-09, REND-11 | T-05-22, T-05-23 | Build partitions output, gates and publishes the count | integration (build) | `pnpm run build && test -f dist/archive-plan.json && test -f dist/client/static-budget.json` | ✅ | ✅ pass |
| 05-06-T2 | 05-06 | 2 | REND-09, REND-11 | T-05-22, T-05-23 | 79,999 passes / 80,000 fails / 70,000 warns; partition path safety | unit | `node --test tests/unit/partition-archive.test.mjs tests/unit/file-count.test.mjs` | ✅ | ✅ pass |
| 05-06-T3 | 05-06 | 2 | REND-09 | — | Existing build-output tests hold across both tiers; page reuse ≥ 95% | full suite | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression` | ✅ | ✅ pass |
| 05-07-T1 | 05-07 | 3 | REND-07 | T-05-27 | Pages leave static only after their R2 PUT is confirmed | unit + live | `node --test tests/unit/run-pool.test.mjs` + `node tools/archive-sync.mjs pre --limit 50 --json` (with `.dev.vars`) | ✅ | ✅ pass |
| 05-07-T2 | 05-07 | 3 | REND-07, REND-12 | T-05-25, T-05-26, T-05-28 | Changed pages re-uploaded; capped deletions; deadline backlog; D-12 | unit | `node --test tests/unit/archive-sync.test.mjs` | ✅ | ✅ pass |
| 05-07-T3 | 05-07 | 3 | REND-07 | T-05-26 | Post phase proven live; architecture recorded | live + doc | `node tools/archive-sync.mjs post --json` (with `.dev.vars`) + architecture doc grep | ✅ | ✅ pass |
| 05-08-T1 | 05-08 | 4 | REND-07, REND-11 | T-05-30 | Real deploy step end to end with a wrangler dry run | unit + live | `node --test tests/unit/ci-build.test.mjs && pnpm run build && CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` (with `.dev.vars`) | ✅ | ✅ pass |
| 05-08-T2 | 05-08 | 4 | REND-11, REND-12 | T-05-29, T-05-31, T-05-32 | Alerts, 70,000 alarm, daily report, fallback guard, R2 redaction | unit | `node --test tests/unit/ci-build.test.mjs` | ✅ | ✅ pass |
| 05-08-T3 | 05-08 | 4 | REND-12 | — | Pipeline docs agree on where the archive renders | doc | grep for the three new doc sections | ✅ | ✅ pass |
| 05-09-T1 | 05-09 | 5 | REND-07 | T-05-33 | Owner chooses the route to dev.915tldr.com | checkpoint (decision) | — (owner selected option-a: merge to main, 2026-10-01 ~09:07 MDT) | N/A | ✅ resolved |
| 05-09-T2 | 05-09 | 5 | REND-07 | T-05-33 | Owner merges and pushes (option-a only) | checkpoint (human-action) | — (owner executed merge/push ~09:14 MDT, 57c4b05 → 57dfa94) | N/A | ✅ resolved |
| 05-09-T3 | 05-09 | 5 | REND-07, REND-08, REND-11 | T-05-33, T-05-34 | Archive tier live; count reconciled; verify:edge passes | live | `/static-budget.json` check + `pnpm run verify:edge` + `ARCHIVE_TIER_LIVE` grep | ✅ | ✅ pass |
| 05-10-T1 | 05-10 | 6 | REND-12 | T-05-35 | Forced full re-upload converges; marker cleared | live | R2 state check (no force marker, backlogCount 0) + `docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log` | ✅ | ✅ pass |
| 05-10-T2 | 05-10 | 6 | REND-12 | — | REND-12 verdict + criterion-5 reinterpretation | doc | `grep -Ec "ARCHIVE_RERENDER_(FITS|CONVERGES|EXCEEDS)" docs/phase-05/archive-architecture.md` → 1 (`ARCHIVE_RERENDER_CONVERGES`) | ✅ | ✅ pass |
| 05-11-T1 | 05-11 | 6 | REND-08 | T-05-36, T-05-37 | Live URL contract for archived articles and tags; noindex on archived | integration (live) | `node --test tests/integration/url-shapes.test.mjs && pnpm run verify:edge` | ✅ | ✅ pass (71/71, 5/5) |
| 05-11-T2 | 05-11 | 6 | REND-08 | — | Real Chromium clicks reach archived pages | e2e | `node --test tests/integration/browser-journeys.test.mjs` | ✅ | ✅ pass (10/10) |
| 05-11-T3 | 05-11 | 6 | REND-08 | — | R2 get p50/p95 and archived LCP vs 1.5 s (criterion 2) | measurement | `node tools/measure-archive-latency.mjs --json --evidence docs/phase-05/evidence/latency` | ✅ | ⚠️ measured, `R2_LATENCY_EXCEEDS_LCP` (owner review flagged, not blocking — see `docs/phase-05/archive-latency.md`) |
| 05-12-T1 | 05-12 | 7 | ARCH-01, ARCH-08 | T-05-38 | Gate and KV/CPU measured in one valid window | live | `pnpm run guard:config && pnpm run test:build-gate` + load test + KV/CPU over the same window | ✅ | ✅ pass (20,000 req, window 2026-10-01T20:34:05.536Z–21:16:29.049Z) |
| 05-12-T2 | 05-12 | 7 | ARCH-01 | T-05-39 | Verdict recorded; FAIL halts the project (D-02) | doc | `grep -Ec "ZERO_READS_(PROVEN\|FAILED\|INCONCLUSIVE)" docs/phase-05/zero-reads-gate.md` → 1 (`ZERO_READS_PROVEN`) | ✅ | ✅ pass — `ZERO_READS_PROVEN`; ARCH-08 recorded `FAIL` on the CPU-max axis only (disclosed, not a project halt) |
| 05-12-T3 | 05-12 | 7 | all | — | Validation complete; full suite green live | full suite | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` | ✅ | ✅ pass — see "Full Suite Result" below |
| 05-13-T1 | 05-13 | 1 | REND-07, REND-08 | T-05-40, T-05-41 | A dry-run or failed deploy can never reach archive-sync post or commitImpl (CR-01, ci-build half) | unit (TDD red→green) | `node --test tests/unit/ci-build.test.mjs` | ✅ | ✅ pass (51/51) |
| 05-13-T2 | 05-13 | 1 | REND-08 | T-05-42, T-05-43 | Fix proven on the real CLI path, credential-free; dry-run skip logged explicitly | live + doc | `env -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY -u NTFY_TOPIC -u NTFY_TOKEN CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` | ✅ | ✅ pass |
| 05-14-T1 | 05-14 | 1 | REND-08 | T-05-44, T-05-46 | runPostSync refuses R2 mutation unless the live deployment matches this build (CR-01/WR-01, archive-sync half) | unit (TDD red→green) | `node --test tests/unit/archive-sync.test.mjs` | ✅ | ✅ pass (33/33) |
| 05-14-T2 | 05-14 | 1 | REND-07, REND-08 | T-05-45, T-05-48 | Independent dry-run refusal; pre-delete liveness re-check closes the upload-phase TOCTOU window | unit (TDD red→green) | `node --test tests/unit/archive-sync.test.mjs` | ✅ | ✅ pass (38/38) |
| 05-14-T3 | 05-14 | 1 | REND-07 | T-05-47, T-05-49 | Real network proof, credential-free; architecture doc records the new contract | live + doc | `checkLiveDeployment({attempts:1})` against `https://dev.915tldr.com` (one-liner, captured in SUMMARY) | ✅ | ✅ pass |
| 05-15-T1 | 05-15 | 1 | REND-10 | T-05-50 | `countOtherFiles` sums `dist/client` + `dist/archive`; negative-result guard (WR-08) | unit (TDD red→green) | `node --test tests/unit/derive-hot-window.test.mjs` | ✅ | ✅ pass (34/34) |
| 05-15-T2 | 05-15 | 1 | REND-10 | T-05-51, T-05-52 | Real, non-probe re-derivation runs end to end live (preview only); owner-approved window untouched | live + doc | `node tools/derive-hot-window.mjs --json --evidence docs/phase-05/evidence/hot-window-rederive-20261002` | ✅ | ✅ pass (exit 0; `hot-window.json` sha256 identical before/after) |
| 05-16-T1 | 05-16 | 1 | ARCH-01 | T-05-53 | Load window and the 7 baseline windows are aligned identically (CR-03 fix) | unit (TDD red→green) | `node --test tests/unit/load-test-zero-reads.test.mjs` | ✅ | ✅ pass (54/54) |
| 05-16-T2 | 05-16 | 1 | ARCH-01 | T-05-54, T-05-55 | 2026-10-01 `ZERO_READS_PROVEN` verdict re-checked against real aligned data; correction recorded additively | live + doc | live `fetchD1RowsRead` re-query → `docs/phase-05/evidence/gate-20261001T203348Z/load-window-aligned-recheck.json` | ✅ | ✅ pass (rowsRead=2,183,097; z=-0.7585) |
| 05-17-T1 | 05-17 | 1 | ARCH-08 | T-05-56, T-05-57, T-05-59 | Per-request CPU-outlier tool built and verified live against the Workers Observability telemetry API | unit + live | `node --test tests/unit/measure-worker-cpu-outliers.test.mjs` + live run over the 05-12 gate window | ✅ | ✅ pass (19 unit tests; live: 4 ≥20ms, 5 ≥5ms) |
| 05-17-T2 | 05-17 | 1 | ARCH-08 | T-05-58 | IN-01 correlation evidence gathered without asserting a root cause; decision doc built with 3 undecided options | unit + doc | `node --test tests/unit/measure-worker-cpu-outliers.test.mjs` (correlation suites) | ✅ | ✅ pass |
| 05-18-T1 | 05-18 | 2 | REND-08 | T-05-60 | A post-sync index-write failure can no longer crash the run; pre-sync self-heals a stale index entry (WR-02) | unit (TDD red→green) | `node --test tests/unit/archive-sync.test.mjs` | ✅ | ✅ pass (39/39) |
| 05-18-T2 | 05-18 | 2 | REND-07, REND-08 | T-05-61, T-05-62, T-05-63 | `deleteObjects` reports partial results instead of throwing; every remaining R2 call degrades to a named alert | unit (TDD red→green) | `node --test tests/unit/r2-client.test.mjs tests/unit/archive-sync.test.mjs && pnpm run test:build-gate` | ✅ | ✅ pass (70/70 + 9/9) |
| 05-18-T3 | 05-18 | 2 | REND-08 | T-05-61 | Architecture doc records four new failure-mode rows and the self-heal listing's cost | doc | grep for the four new failure-mode rows + the new Cost line | ✅ | ✅ pass |
| 05-19-T1 | 05-19 | 2 | ARCH-08 | T-05-64 | Owner decides how ARCH-08's CPU axis is resolved (accept / fix / re-measure) | checkpoint (decision) | — (owner selected option (c), re-measure, with the pass criterion fixed before measuring, 2026-10-02 ~19:05 MDT) | N/A | ✅ resolved |
| 05-19-T2 | 05-19 | 2 | ARCH-08 | T-05-65 | Decision recorded verbatim; re-measurement run read-only against the pre-stated criterion; correction additive-only | doc + live | `grep -c '## Owner decision (05-19' docs/phase-05/arch-08-cpu-outliers.md` + live `measure-worker-kv-cpu.mjs` / `measure-worker-cpu-outliers.mjs` run | ✅ | ✅ pass — mechanically MET (p99 1.314ms, 0/3 ≥20ms); sample was 100% bot/404 probes, zero archive-page traffic (disclosed) |
| 05-20-T1 | 05-20 | 3 | REND-08 | T-05-66, T-05-67 | archive-sync pre writes a keyed sync marker; the new guard refuses an unconfirmed partitioned `dist/` (CR-02) | unit (TDD red→green) + live | `node --test tests/unit/assert-archive-synced.test.mjs tests/unit/archive-sync.test.mjs` + live run against the real repo tree | ✅ | ✅ pass (9 + 5 new tests; live run exits 1, correctly refusing the real unconfirmed partition) |
| 05-20-T2 | 05-20 | 3 | REND-07 | T-05-68 | `pnpm run deploy` routed through `ci-build.mjs deploy` and gated on the guard; stale build-start marker ignored (IN-06) | unit (TDD red→green) | `node --test tests/unit/ci-build.test.mjs` | ✅ | ✅ pass (package.json contract + 4-to-5-spawn ordering tests) |
| 05-20-T3 | 05-20 | 3 | REND-07, REND-08 | T-05-69 | Pipeline and architecture docs describe the guarded deploy path end to end | doc | grep checks per 05-20-PLAN.md Task 3's own acceptance criteria | ✅ | ✅ pass |
| 05-21-T1 | 05-21 | 4 | REND-11 | T-05-70, T-05-71 | Owner confirms/refutes daily-report delivery from read-only evidence; no topic name or token printed | checkpoint (human-verify) | — (owner replied "not arrived" after searching all 6 ntfy topics, 2026-10-02 ~19:42 MDT) | N/A | ✅ resolved — not arrived |
| 05-21-T2 | 05-21 | 4 | ARCH-01, ARCH-08, REND-07..REND-12 | T-05-70 | 05-VALIDATION.md brought up to date for 05-13..05-21; gap-closure full-suite re-run recorded | doc + full suite | `grep -c "^\| 05-21-T"` / `grep -c "Gap-closure re-run (05-21"` / `grep -c "Daily file-count report delivery"` + `pnpm run test:fast` | ✅ | ✅ pass (test:fast 736/738 — see "Gap-closure re-run" below) |
| 05-21-T3 | 05-21 | 4 | ARCH-01, ARCH-08, REND-07..REND-12 | T-05-70 | Every Phase 5 requirement status set from evidence; deferred review findings parked in a todo | doc | `grep -ci 'caveat'` on the ARCH-08 lines (= 0) + todo-file ID grep + traceability-row grep | ✅ | ✅ pass |

*Status: ⬜ pending · ✅ green/resolved · ❌ red · ⚠️ flaky/flagged*

---

## Full Suite Result (2026-10-01, 05-12 Task 3)

Run live, against the deployed `dev.915tldr.com` (commit `main` = `57dfa94`'s descendant per the
merge history; the 05-12 fix commits on `feature/phase-05` are tooling/doc-only — zero diff on
`src`, `wrangler.jsonc`, `package.json`, `astro.config.mjs` relative to the deployed `main` — so
the tracer's live assertions hold against the real deployment):

```
pnpm run test:unit          -> 676/676 pass
pnpm run test:build-gate    -> 9/9 pass
pnpm run test:regression    -> 5/5 pass (criterion 3 byte-identity across two consecutive builds,
                                ~130s total)
TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer -> 5/5 pass (live against
                                dev.915tldr.com: canonical path 200, trailing-slash redirect,
                                manifest v2 slug round-trip)
```

**Exit code: 0 for the full chain.** Every suite green, zero failures, zero skips.

---

## Gap-closure re-run (05-21, 2026-10-02)

Run live on `feature/phase-05` (not yet merged to main; `dev.915tldr.com` still serves the last
deployed `main` build — the 05-13..05-20 gap-closure plans are tooling/test/doc-only changes to
`tools/`, `tests/`, and `docs/`, so the tracer's live assertions against the deployed site are
unaffected, same reasoning 05-12/05-16 already established):

```
pnpm run test:unit          -> 745/747 pass (9/9 design/tests/unit + 736/738 tests/unit); exit 1
pnpm run test:build-gate    -> 9/9 pass; exit 0
pnpm run test:regression    -> 5/5 pass (criterion 3 byte-identity, ~112s); exit 0
TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer -> 5/5 pass (live against
                                dev.915tldr.com: canonical path 200, trailing-slash redirect,
                                manifest v2 slug round-trip); exit 0
```

**Chained exit code: 1.** The `&&`-chained full-suite command stops at `test:unit`'s non-zero
exit. The two failing tests are **pre-existing and out of this plan's scope**, not caused by any
05-13..05-21 task: `tests/unit/seo-surfaces.test.mjs`'s two robots.txt assertions
("robots.txt matches the fixture line-for-line except the Sitemap lines" and "robots.txt
preserves the Content-signal line and the per-bot AI-training blocks") fail because commit
`143eede` ("chore(seo): allow PerplexityBot and Perplexity-User in robots.txt", 2026-10-02
17:59:00, this branch) intentionally added a new `PerplexityBot`/`Perplexity-User` `Allow` block
to `public/robots.txt` without updating `tests/fixtures/v1-robots.txt` or the test's own
bot-disallow list, which both still expect `PerplexityBot` disallowed. None of 05-13 through
05-21 touch `public/robots.txt` or `tests/unit/seo-surfaces.test.mjs`. Recorded in
`deferred-items.md` per the execute-plan scope-boundary rule (only auto-fix issues directly
caused by the current task's changes) — not fixed here. `pnpm run test:build-gate`,
`pnpm run test:regression`, and the live tracer suite (the three suites this plan's own 05-13..
05-21 work actually touches) are all green at 100%.

`pnpm run test:fast` (the Task 2 `<verify>` command) independently confirms the same count:
736/738 pass, exit 1, identical two pre-existing failures.

**This is why `nyquist_compliant` is set to `false` in this file's frontmatter** (see
"Validation Sign-Off" below) — the literal full-suite command this file defines did not exit 0 on
this run, even though the two failures are unrelated to every requirement this phase targets and
to every one of this plan's own file changes.

---

## Wave 0 Requirements

- [x] `tools/assert-file-count.mjs` + `tests/unit/file-count.test.mjs` — REND-11 (05-06)
- [x] `src/lib/archive/tiering.ts` + `tests/unit/tiering.test.mjs` — REND-09 (05-01)
- [x] `tools/load-test-zero-reads.mjs` — ARCH-01 leg 2 (05-04, fixed live for the real CLI path by 05-12)
- [x] Archived-article and archived-tag cases in `tests/integration/url-shapes.test.mjs` — REND-07/08 (05-11)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Resolution |
|----------|-------------|------------|-------------------|------------|
| Hot-window cutoff sanity review | REND-10 | Owner judgement on whether the derived cutoff is sensible | Review the derived cutoff and the top-N article list in `docs/phase-05/hot-window-derivation.md` | **Resolved 2026-10-01 00:25 MDT** — owner reviewed and chose to KEEP the 202-day window as-is |
| Package legitimacy of `@aws-sdk/client-s3` | REND-07 | Never auto-approved (supply-chain gate) | 05-02 Task 1: confirm the npm publisher/repo and the version to pin | **Resolved** — approved, pinned at exactly `3.1144.0` |
| Private R2 bucket, bucket-scoped credential, production-only build secrets | REND-07 | Token creation and Workers Builds variables are dashboard-only | 05-02 Task 2 instructions | **Resolved** — bucket + credential created, verified live |
| Route to dev.915tldr.com (merge to main vs local deploy) and the merge itself | REND-07, ARCH-01 (D-03) | Owner decision; Claude never merges or pushes | 05-09 Tasks 1-2 | **Resolved 2026-10-01 ~09:07-09:14 MDT** — option-a (merge to main) selected and executed by the owner |
| Coverage target (0.95) and post-Phase-6 static cap (60,000) | REND-10 | Product judgment on a measured curve | docs/phase-05/hot-window-derivation.md; re-run with `--coverage` to change | **Resolved** — same decision as the hot-window cutoff review above (202 days kept) |
| Archived vs static visual identity | REND-08 | Visual judgment | 05-11 screenshots (scratchpad, not committed per project rule) | **End-of-phase check — see below**, confirmed visually indistinguishable this session (05-11) |
| Criterion 2 (R2 latency vs. 1.5s LCP) finding | REND-08 | Real, disclosed lab-measurement finding needing owner review before Phase 11, not an automated pass/fail | `docs/phase-05/archive-latency.md` | **OPEN, non-blocking** — `R2_LATENCY_EXCEEDS_LCP` on the canonical run; flagged for owner attention before Phase 11's field-LCP release gate, does not block Phase 5 completion |
| ARCH-08 CPU-max outlier (49.966ms vs. 20ms hard-fail; per-request-corrected to 4 invocations ≥20ms, 5 ≥5ms, 05-17) | ARCH-08 | Owner judgment needed on accept/fix/re-measure, not a code defect this plan re-architects | `docs/phase-05/arch-08-cpu-outliers.md` "Owner decision (05-19)" | **Resolved 2026-10-02 ~19:05 MDT** — owner chose option (c), re-measure, with the pass criterion fixed before measuring (population p99 CPU < 5ms AND invocations ≥20ms CPU under 0.1% of total, over 2026-10-02's full UTC day of natural `dev.915tldr.com` traffic). Re-measurement mechanically **MET** the criterion (p99 1.314ms, 0/3 invocations ≥20ms). But the 3-invocation sample was 100% bot-scan/favicon 404 probes — zero archive-page requests — so the MET verdict does not test the disputed cold-start/outlier code path. **ARCH-08's CPU axis remains an open gap** (`WINDOWS.md` #26 stays open; only option (a), accept-cold-start, would have waived it — not chosen). *Previously: caveat (05-12, 2026-10-01) — "KV reads and CPU p99 (2.846ms) confirmed within budget... a single real request... spiked to 49.966ms CPU... disclosed, not hidden... tracked for `/gsd-verify-work`, not a project halt."* |
| Daily file-count report delivery | REND-11 | Recurring scheduled behavior a one-time code/wiring check cannot observe | 05-21 Task 1: R2 `_meta/daily-report.json` marker check + 72h ntfy poll (read-only) + owner's own phone/app search | **OPEN — not observed as of 2026-10-02.** R2 marker `_meta/daily-report.json` = `{"lastReportDate":"2026-10-02"}` — a production post-sync run on 2026-10-02 decided a report was due and attempted to send it. A 72h ntfy poll of the local shell's topic found 0 messages titled "915 TLDR archive daily report" and 0 archive alerts. Owner reply (2026-10-02 ~19:42 MDT, verbatim in substance): **"not arrived"** — searched all 6 personal ntfy topics (M75s_alerts, M75s_log, M75s_mindjogapp, M75s_notifications, M75s_reminders, M75s_scout), found no "915 TLDR archive daily report" message on any day; the only related message was a LOCAL `ci-build` failure alert from 2026-10-01 01:42 AM (proves local ci-build→ntfy delivery works, says nothing about the production daily report). No unexpected archive alerts observed. Workers Builds' own `NTFY_TOPIC` (dashboard-configured) could not be read by the local API token (403) — which topic production actually sends to remains unverified. Carry-forward: `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`. |
| CR-01/CR-02 fix vs accept risk | REND-07, REND-08 | Owner risk call on two confirmed critical pipeline-safety bugs, not an automated pass/fail | 05-VERIFICATION.md Gaps / Human Verification item 3 | **Resolved 2026-10-02** — owner chose FIX (not accept-as-risk); closed by 05-13 (ci-build half of CR-01), 05-14 (archive-sync half of CR-01/WR-01), 05-18 (WR-02), and 05-20 (CR-02). All four plans' fixes live on `feature/phase-05` and run in Workers Builds only once the owner merges this branch to `main` — they are proven here by unit tests and live/credential-free CLI proofs against the branch, not by a production deploy. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (checkpoints — 05-19-T1, 05-21-T1 — are each immediately followed by an automated/doc confirmation task)
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [ ] `nyquist_compliant: true` — **set to `false`** (2026-10-02): the gap-closure full-suite re-run's literal chained command (`pnpm run test:unit && ...`) exited 1. The failure is two pre-existing `tests/unit/seo-surfaces.test.mjs` assertions broken by an unrelated commit (`143eede`, robots.txt/Perplexity policy change) that no 05-13..05-21 plan touches — `test:build-gate`, `test:regression`, and the live `test:tracer` suite (the suites this phase's own work actually exercises) are all 100% green. See "Gap-closure re-run (05-21, 2026-10-02)" above for the full breakdown and `deferred-items.md` for the unfixed-here record. Per the rule in this file's own Task 2 instructions ("keep `nyquist_compliant: true` only if ... the suite passed"), the literal outcome governs over the root-cause analysis, so this is recorded as `false` rather than rounded up to `true`.

**Approval:** Phase 5's core premise is `ZERO_READS_PROVEN` (ARCH-01), re-confirmed on real
aligned data by 05-16's CR-03 fix (corrected rowsRead 2,183,097, z=-0.7585, still far inside the
3σ threshold). REND-07/REND-08's two confirmed critical pipeline-safety bugs (CR-01, CR-02) and
REND-08's WR-02 index-integrity gap are now fixed (05-13, 05-14, 05-18, 05-20) and proven by
regression tests + live/credential-free CLI runs on `feature/phase-05`; REND-10's re-derivation
capability is restored and live-proven (05-15, WR-08). ARCH-08's CPU axis was re-measured per the
owner's 05-19 decision and mechanically MET the pre-stated criterion, but the measured sample
contained zero archive-page traffic, so the axis is recorded as an **open gap**, not a caveat on
"Complete" (WINDOWS.md #26 stays open). REND-11's daily report delivery was checked with the
owner directly (05-21 Task 1) and is recorded **OPEN — not observed**. Criterion 2's lab-LCP
finding remains deferred to Phase 11 per 05-11/WINDOWS.md #27. None of this triggers D-02 (that
applies only to the `ZERO_READS_*` verdict, which remains `PROVEN`) — but per this gap-closure
pass, `nyquist_compliant` is `false` pending either a fix to the unrelated robots.txt test or a
clean re-run once that lands. **Validated: 2026-10-01. Gap-closure re-run: 2026-10-02 (05-21,
partial — see above).**

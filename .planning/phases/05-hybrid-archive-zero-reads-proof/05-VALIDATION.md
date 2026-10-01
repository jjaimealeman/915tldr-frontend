---
phase: 5
slug: hybrid-archive-zero-reads-proof
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (unit/integration/regression/tracer) + Playwright for live browser journeys |
| **Config file** | none — `package.json` scripts |
| **Quick run command** | `pnpm run test:fast` |
| **Full suite command** | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` |
| **Estimated runtime** | `test:fast` ~3s; `test:unit` ~45s (warm build); full suite ~2.5 min (measured 2026-09-30) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test:fast`
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite green, plus the live gates (ARCH-01 leg 2 load test, ARCH-08 KV/CPU measurement, REND-12 full re-render measurement) run and documented
- **Max feedback latency:** ~45 seconds (one warm build)

---

## Per-Task Verification Map

*Filled by the planner from each plan's `<verify>` block (2026-09-30); statuses are updated by the
executor and finalized in 05-12 Task 3. D-07b superseded D-07a: there is no daily collector — REND-10
is derived live from the platform's 31-day retention and verified in this phase.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | REND-09, REND-10 | T-05-01 | Build emits tier facts; tier-report classifies them | integration (build) | `pnpm run build && node --test tests/unit/tier-facts.test.mjs && node tools/tier-report.mjs --json` | ❌ W0 | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | REND-09 | T-05-02 | Tag threshold inclusive at 10; article cutoff inclusive; malformed hot window rejected | unit | `node --test tests/unit/tiering.test.mjs tests/unit/hot-window.test.mjs` | ❌ W0 | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | REND-10 | T-05-02 | Every build logs the hot window; the bootstrap fallback says PROVISIONAL | integration (build) | build log grep for PROVISIONAL + `node --test tests/unit/tier-facts.test.mjs` | ❌ W0 | ⬜ pending |
| 05-02-T1 | 05-02 | 1 | REND-07 | T-05-SC | Package legitimacy confirmed before install | checkpoint (blocking-human) | — | — | ⬜ pending |
| 05-02-T2 | 05-02 | 1 | REND-07 | T-05-05, T-05-06 | Private bucket + bucket-scoped credential (owner) | checkpoint (human-action) | — | — | ⬜ pending |
| 05-02-T3 | 05-02 | 1 | REND-07 | T-05-04, T-05-06 | Live R2 round trip; bucket has no public access | integration (live) | `node tools/r2-roundtrip.mjs` (with `.dev.vars` loaded) | ❌ W0 | ⬜ pending |
| 05-02-T4 | 05-02 | 1 | REND-07 | T-05-07, T-05-08 | Key allow-list; no secret in errors; guard rejects Worker → r2-client | unit + build-gate | `node --test tests/unit/r2-client.test.mjs && pnpm run test:build-gate` | ❌ W0 | ⬜ pending |
| 05-03-T1 | 05-03 | 1 | REND-08 | T-05-09, T-05-14 | Bundled Worker serves an archived canonical URL from R2 with one KV read | integration (bundle) | `pnpm exec wrangler deploy --dry-run --config wrangler.jsonc --outdir .wrangler/dry-run-05 && node --test tests/unit/worker-bundle.test.mjs tests/unit/article-redirect.test.mjs && pnpm run guard:config` | ❌ W0 | ⬜ pending |
| 05-03-T2 | 05-03 | 1 | REND-08, ARCH-08 | T-05-09, T-05-10, T-05-15 | Tag path, static parity, 503 on R2 error, ≤1 KV per request shape | unit | `node --test tests/unit/archive-route.test.mjs tests/unit/worker.test.mjs tests/unit/article-redirect.test.mjs` | ⚠️ partial | ⬜ pending |
| 05-03-T3 | 05-03 | 1 | ARCH-08 | T-05-12 | Edge cache stores only archived 200s; hits cost 0 KV and 0 R2 | unit + bundle | dry-run bundle + `node --test tests/unit/worker.test.mjs tests/unit/worker-bundle.test.mjs && pnpm run test:build-gate && pnpm run guard:config` | ⚠️ partial | ⬜ pending |
| 05-04-T1 | 05-04 | 1 | ARCH-01 | T-05-16, T-05-17 | Live D1 baseline on `552ba1d1`; deployed Worker has no D1 binding | unit + live | `node --test tests/unit/load-test-zero-reads.test.mjs && node tools/load-test-zero-reads.mjs --baseline-only --json` | ❌ W0 | ⬜ pending |
| 05-04-T2 | 05-04 | 1 | ARCH-01 | T-05-18 | Verdict can never be PASS on an invalid window | unit | `node --test tests/unit/load-test-zero-reads.test.mjs` | ❌ W0 | ⬜ pending |
| 05-04-T3 | 05-04 | 1 | ARCH-08 | T-05-16 | KV reads and CPU read live off the deployed Worker | unit + live | `node --test tests/unit/measure-worker-kv-cpu.test.mjs && node tools/measure-worker-kv-cpu.mjs --from <ISO> --to <ISO> --assume-no-build --json` | ❌ W0 | ⬜ pending |
| 05-05-T1 | 05-05 | 2 | REND-10 | T-05-19, T-05-21 | One live day of human-only article traffic matched and aged | unit + live | `node --test tests/unit/derive-hot-window.test.mjs && node tools/derive-hot-window.mjs --probe-day --json` | ❌ W0 | ⬜ pending |
| 05-05-T2 | 05-05 | 2 | REND-10 | T-05-20 | Coverage cutoff, file-budget cap, atomic write, fallback writer | unit | `node --test tests/unit/derive-hot-window.test.mjs` | ❌ W0 | ⬜ pending |
| 05-05-T3 | 05-05 | 2 | REND-10 | T-05-19 | Derived (not provisional) window written and used by the build | live + build | hot-window.json status check + `node --test tests/unit/hot-window.test.mjs` + build log grep | ❌ W0 | ⬜ pending |
| 05-06-T1 | 05-06 | 2 | REND-07, REND-09, REND-11 | T-05-22, T-05-23 | Build partitions output, gates and publishes the count | integration (build) | `pnpm run build && test -f dist/archive-plan.json && test -f dist/client/static-budget.json` | ❌ W0 | ⬜ pending |
| 05-06-T2 | 05-06 | 2 | REND-09, REND-11 | T-05-22, T-05-23 | 79,999 passes / 80,000 fails / 70,000 warns; partition path safety | unit | `node --test tests/unit/partition-archive.test.mjs tests/unit/file-count.test.mjs` | ❌ W0 | ⬜ pending |
| 05-06-T3 | 05-06 | 2 | REND-09 | — | Existing build-output tests hold across both tiers; page reuse ≥ 95% | full suite | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression` | ✅ | ⬜ pending |
| 05-07-T1 | 05-07 | 3 | REND-07 | T-05-27 | Pages leave static only after their R2 PUT is confirmed | unit + live | `node --test tests/unit/run-pool.test.mjs` + `node tools/archive-sync.mjs pre --limit 50 --json` (with `.dev.vars`) | ❌ W0 | ⬜ pending |
| 05-07-T2 | 05-07 | 3 | REND-07, REND-12 | T-05-25, T-05-26, T-05-28 | Changed pages re-uploaded; capped deletions; deadline backlog; D-12 | unit | `node --test tests/unit/archive-sync.test.mjs` | ❌ W0 | ⬜ pending |
| 05-07-T3 | 05-07 | 3 | REND-07 | T-05-26 | Post phase proven live; architecture recorded | live + doc | `node tools/archive-sync.mjs post --json` (with `.dev.vars`) + architecture doc grep | ❌ W0 | ⬜ pending |
| 05-08-T1 | 05-08 | 4 | REND-07, REND-11 | T-05-30 | Real deploy step end to end with a wrangler dry run | unit + live | `node --test tests/unit/ci-build.test.mjs && pnpm run build && CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` (with `.dev.vars`) | ✅ | ⬜ pending |
| 05-08-T2 | 05-08 | 4 | REND-11, REND-12 | T-05-29, T-05-31, T-05-32 | Alerts, 70,000 alarm, daily report, fallback guard, R2 redaction | unit | `node --test tests/unit/ci-build.test.mjs` | ✅ | ⬜ pending |
| 05-08-T3 | 05-08 | 4 | REND-12 | — | Pipeline docs agree on where the archive renders | doc | grep for the three new doc sections | ✅ | ⬜ pending |
| 05-09-T1 | 05-09 | 5 | REND-07 | T-05-33 | Owner chooses the route to dev.915tldr.com | checkpoint (decision) | — | — | ⬜ pending |
| 05-09-T2 | 05-09 | 5 | REND-07 | T-05-33 | Owner merges and pushes (option-a only) | checkpoint (human-action) | — | — | ⬜ pending |
| 05-09-T3 | 05-09 | 5 | REND-07, REND-08, REND-11 | T-05-33, T-05-34 | Archive tier live; count reconciled; verify:edge passes | live | `/static-budget.json` check + `pnpm run verify:edge` + `ARCHIVE_TIER_LIVE` grep | ⚠️ partial | ⬜ pending |
| 05-10-T1 | 05-10 | 6 | REND-12 | T-05-35 | Forced full re-upload converges; marker cleared | live | R2 state check (no force marker, backlogCount 0) | ❌ W0 | ⬜ pending |
| 05-10-T2 | 05-10 | 6 | REND-12 | — | REND-12 verdict + criterion-5 reinterpretation | doc | `ARCHIVE_RERENDER_*` verdict grep | ❌ W0 | ⬜ pending |
| 05-11-T1 | 05-11 | 6 | REND-08 | T-05-36, T-05-37 | Live URL contract for archived articles and tags; noindex on archived | integration (live) | `node --test tests/integration/url-shapes.test.mjs && pnpm run verify:edge` | ⚠️ partial | ⬜ pending |
| 05-11-T2 | 05-11 | 6 | REND-08 | — | Real Chromium clicks reach archived pages | e2e | `node --test tests/integration/browser-journeys.test.mjs` | ⚠️ partial | ⬜ pending |
| 05-11-T3 | 05-11 | 6 | REND-08 | — | R2 get p50/p95 and archived LCP vs 1.5 s (criterion 2) | measurement | `node tools/measure-archive-latency.mjs --json --evidence docs/phase-05/evidence/latency` | ❌ W0 | ⬜ pending |
| 05-12-T1 | 05-12 | 7 | ARCH-01, ARCH-08 | T-05-38 | Gate and KV/CPU measured in one valid window | live | `pnpm run guard:config && pnpm run test:build-gate` + load test + KV/CPU over the same window | ✅ | ⬜ pending |
| 05-12-T2 | 05-12 | 7 | ARCH-01 | T-05-39 | Verdict recorded; FAIL halts the project (D-02) | doc | `ZERO_READS_*` verdict grep | ❌ W0 | ⬜ pending |
| 05-12-T3 | 05-12 | 7 | all | — | Validation complete; full suite green live | full suite | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tools/assert-file-count.mjs` + `tests/unit/file-count.test.mjs` — REND-11
- [ ] `src/lib/archive/tiering.ts` + `tests/unit/tiering.test.mjs` — REND-09
- [ ] `tools/load-test-zero-reads.mjs` — ARCH-01 leg 2
- [ ] Archived-article and archived-tag cases in `tests/integration/url-shapes.test.mjs` — REND-07/08

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hot-window cutoff sanity review | REND-10 | Owner judgement on whether the derived cutoff is sensible | Review the derived cutoff and the top-N article list in `docs/phase-05/hot-window-derivation.md` |
| Package legitimacy of `@aws-sdk/client-s3` | REND-07 | Never auto-approved (supply-chain gate) | 05-02 Task 1: confirm the npm publisher/repo and the version to pin |
| Private R2 bucket, bucket-scoped credential, production-only build secrets | REND-07 | Token creation and Workers Builds variables are dashboard-only | 05-02 Task 2 instructions |
| Route to dev.915tldr.com (merge to main vs local deploy) and the merge itself | REND-07, ARCH-01 (D-03) | Owner decision; Claude never merges or pushes | 05-09 Tasks 1-2 |
| Coverage target (0.95) and post-Phase-6 static cap (60,000) | REND-10 | Product judgment on a measured curve | docs/phase-05/hot-window-derivation.md; re-run with `--coverage` to change |
| Archived vs static visual identity | REND-08 | Visual judgment | 05-11 screenshots (scratchpad); end-of-phase list in 05-12 Task 3 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

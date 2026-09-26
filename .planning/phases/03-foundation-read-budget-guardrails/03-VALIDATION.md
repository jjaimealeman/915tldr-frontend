---
phase: 3
slug: foundation-read-budget-guardrails
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `03-RESEARCH.md` § Validation Architecture. The planner fills the
> Per-Task Verification Map once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (unit + build-invocation integration) · `@playwright/test` 1.63.0 (already installed from Phase 1, E2E only) |
| **Config file** | `playwright.config.ts` (exists); unit tests have no config file — the `node --test` glob is inlined in the `package.json` script |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e` |
| **Estimated runtime** | ~90 seconds (the D-06 build-invocation fixtures dominate — each runs a real `astro build`) |

**Gap this phase must close:** no build-test harness exists yet. Phase 3 is the first phase
needing one, because the D-06 negative fixtures must invoke the actual `astro build` (or at
minimum the Rollup plugin directly against fixture files) and assert a non-zero exit.

---

## Sampling Rate

- **After every task commit:** Run `node --test "tests/unit/**/*.test.mjs"`
- **After every plan wave:** Run `pnpm test:unit && pnpm test:e2e`, including a real `astro build`
  invocation against the fixture tree
- **Before `/gsd-verify-work`:** Full suite green, **plus** the OPS-02 `curl -I` smoke check
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> **Note on requirement→row mapping.** The seeded table listed ARCH-04 against an output-keyword
> grep and ARCH-06 against the removed env accessor. REQUIREMENTS.md assigns them the other way
> round: ARCH-04 is the `cloudflare:workers` env import, ARCH-05 is the output keyword, ARCH-06
> is `imageService`. The rows below follow REQUIREMENTS.md. Threat refs are renumbered to the
> `T-03-NN` ids used in the plans' `<threat_model>` blocks.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01 T2 (tracer) | 03-01 | 1 | ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, REND-06 | T-03-01, T-03-02, T-03-04 | The assertion runs inside the real build; the Worker config declares no D1 binding; D1 access is confined to one chokepoint module | integration (end-to-end build) | `pnpm build && pnpm test:tracer` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T1 | 03-02 | 2 | ARCH-02 | T-03-04 | Build rejects any public route whose module graph reaches the D1 client (transitive) | integration (build-invocation) | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T1 | 03-02 | 2 | ARCH-03 | T-03-04 | Build rejects any island file whose module graph reaches the D1 client, transitively and across the `.astro` → `.vue` boundary | integration (build-invocation) | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T2 | 03-02 | 2 | ARCH-04 | T-03-05 | Bindings read via the `cloudflare:workers` env import; the removed `Astro.locals.runtime.env` accessor fails the guard, and a comment-only occurrence does not false-positive | unit + comment-stripped scan | `node tools/check-config-guards.mjs && node --test tests/unit/astro-config.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T2 | 03-02 | 2 | ARCH-05 | T-03-05 | `output: 'static'`; the removed v5 output keyword fails the guard | unit + comment-stripped scan | `node tools/check-config-guards.mjs && node --test tests/unit/astro-config.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T2 | 03-02 | 2 | ARCH-06 | — | `imageService` is the explicit two-key object; string shorthand, one-key object, and absent key all fail | unit (resolved-config assertion) | `node --test tests/unit/astro-config.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-02 T3 | 03-02 | 2 | ARCH-02..06 | T-03-01 | Both gates run from the project's normal test command, so neither can silently stop gating | wiring | `pnpm guard:config && pnpm test:unit && pnpm test:build-gate` | ❌ W0 → created by this task | ⬜ pending |
| 03-03 T1 | 03-03 | 2 | OPS-05, OPS-06 | T-03-07 | `/version.json` and the footer report the same hash from one module, with the hash's provenance recorded | integration (build output) | `pnpm build` + cross-surface agreement check | ❌ W0 → created by this task | ⬜ pending |
| 03-03 T2 | 03-03 | 2 | OPS-05, OPS-06 | T-03-07, T-03-09 | The git fallback refuses to fire inside CI (shallow-checkout hazard); a hardcoded footer fails the cross-surface case | unit | `pnpm build && node --test tests/unit/build-stamp.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-03 T3 | 03-03 | 2 | OPS-08 | — | N/A | doc assertion | README contains `read budget` plus all four budget figures and names the enforcement mechanism | ❌ W0 → created by this task | ⬜ pending |
| 03-04 T2 | 03-04 | 2 | REND-06 | T-03-10, T-03-11 | Incomplete entries are rejected before the wire; no write sets a TTL; bulk writes batch at ≤10,000 pairs | unit | `node --test tests/unit/manifest-schema.test.mjs` | ❌ W0 → created by this task | ⬜ pending |
| 03-04 T3 | 03-04 | 2 | REND-06 | T-03-12 | The documented schema records the Phase 6 pairing rule and what the manifest does not guarantee | doc assertion | field count in `docs/phase-03/render-manifest.md` matches the exported interface | ❌ W0 → created by this task | ⬜ pending |
| 03-05 T1 | 03-05 | 3 | OPS-02 | T-03-13 | The v2 Worker claims the dev hostname exactly; production still serves v1 | integration (live deploy) | `pnpm exec wrangler deploy` + live `/version.json` 200 + production-undisturbed check | N/A — live | ⬜ pending |
| 03-05 T2 | 03-05 | 3 | OPS-02 | T-03-03 | Dev host returns `X-Robots-Tag: noindex` from the edge; production does not | manual / post-deploy smoke | `curl -sS -D - -o /dev/null https://dev.915tldr.com/ \| grep -i x-robots-tag` | N/A — live | ⬜ pending |
| 03-05 T3 | 03-05 | 3 | OPS-02 | T-03-03, T-03-15 | Verified on a static response, a Worker-generated response, and a production negative control — re-runnable on every deploy | live verification CLI | `pnpm verify:edge` | ❌ W0 → created by this task | ⬜ pending |
| 03-06 T1 | 03-06 | 4 | REND-06 (D-01 measurement) | T-03-17, T-03-20 | Dry run reports row count and projected cost before any bulk corpus read; failures fail loudly rather than being dropped from the distribution | measurement | `node tools/measure-d1-pagination.mjs --dry-run --json` | ❌ W0 → created by this task | ⬜ pending |
| 03-06 T2 | 03-06 | 4 | REND-06 (D-01 measurement) | — | Measured against the real tracer slice per D-02, as a distribution with fixed startup cost separated | measurement | `node tools/measure-render-cost.mjs --count 50 --json` | ❌ W0 → created by this task | ⬜ pending |
| 03-06 T3 | 03-06 | 4 | REND-06 (D-01 measurement) | T-03-16, T-03-18, T-03-19 | The CPU probe Worker is deleted after measurement; production D1 and the production cron Worker are read-only | measurement + teardown | Workers listing no longer shows the probe; `docs/phase-03/measurements.md` records all three numbers | ❌ W0 → created by this task | ⬜ pending |
| 03-07 T2 | 03-07 | 5 | REND-06 (D-01 decision) | T-03-21, T-03-22, T-03-23 | STATE.md is edited in scope, not rewritten; the 300-second figure is confirmed or corrected out loud | doc assertion | decision doc + STATE.md cross-reference check; `git diff --stat .planning/STATE.md` | ❌ W0 → created by this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Checkpoint tasks (no automated verify by design):** 03-01 T1 (package legitimacy, blocking
human — never auto-approvable), 03-04 T1 (Spanish counterpart identity, one-way decision),
03-07 T1 (render-step location, open decision). Each is a human gate, not a test gap.

**Sampling continuity:** no three consecutive tasks lack an automated verify. Every `auto` and
`tracer` task in all seven plans carries an `<automated>` command.

---

## Wave 0 Requirements

Each item names the plan and task that creates it, so no Wave 0 gap is left unowned.

- [ ] `tests/ci-fixtures/page-with-d1-import.astro` — D-06 negative fixture for ARCH-02 → **03-02 T1**
- [ ] `tests/ci-fixtures/island-with-d1-import.vue` — D-06 negative fixture for ARCH-03, reached
      **transitively** (not a direct import in the `.astro` file — that is the whole point) → **03-02 T1**
- [ ] `tests/ci-fixtures/clean-page.astro` — positive control; without it a checker that rejected
      everything would pass both negative fixtures → **03-02 T1** *(added by the planner; not in
      the seeded list, and load-bearing)*
- [ ] `tests/ci-fixtures/assert-no-d1.test.mjs` — harness invoking the checker against all three
      fixtures and asserting rejection/acceptance → **03-02 T1**
- [ ] `tests/unit/astro-config.test.mjs` — new, no existing coverage → **03-02 T2**
- [ ] `tools/check-config-guards.mjs` — comment-stripped config guard → **03-02 T2**
- [ ] `tests/unit/build-stamp.test.mjs` — new, no existing coverage → **03-03 T2**
- [ ] `tests/unit/manifest-schema.test.mjs` — new, no existing coverage → **03-04 T2**
- [ ] `tests/tracer/tracer.test.mjs` — end-to-end proof that the built HTML and the KV manifest
      entry agree with the live D1 row → **03-01 T2** *(added by the planner: the tracer needs its
      own `<automated>` verify, and no seeded row covered it)*
- [ ] `tools/verify-edge-headers.mjs` — live OPS-02 verification → **03-05 T3**
- [ ] `package.json` `test:unit` glob extended to cover `tests/unit/**` as well as
      `design/tests/unit/**` → **03-01 T2**. Without this, every new Phase 3 unit test is written
      and never run — the current glob only matches the Phase 1 tree.
- [ ] Framework install: **none needed** — Phase 1 already installed `@playwright/test`, and the
      unit runner is Node's built-in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge `X-Robots-Tag: noindex` on the dev host | OPS-02 | Depends on live Cloudflare zone configuration, which lives outside version control (D-08 accepted tradeoff). A build-time test cannot observe it. | `pnpm verify:edge` (03-05 T3) drives three real requests: the static response, a Worker-generated 404, and a production negative control. Must be re-checked on **every** deploy, not once at sign-off — the Transform Rule can be silently removed by an unrelated zone-config change. |
| Three measured numbers recorded | REND-06 / D-01 | Measurement, not assertion — the value is the recorded figure, and the decision it drives. | Cron-worker CPU headroom, per-page render cost (ms), D1 REST pagination p50/p95 at the **live** corpus row count queried at measurement time — not 41,233 (ROADMAP) and not 41,896 (03-RESEARCH.md, 2026-09-19); both are already stale relative to each other. Each written down with how it was measured (03-06); render-step location decided from them (03-07). |
| Footer build stamp renders in the approved position | OPS-05 | `workflow.human_verify_mode` is `end-of-phase`, so this is a `<verify><human-check>` on 03-03 T1 rather than a blocking checkpoint. It is the phase's only visual surface. | Run `pnpm preview`, open the article URL, confirm the footer reads `build <hash> · <date>` matching `design/mockups/article.html`'s position and styling, with no layout shift. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

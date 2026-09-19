---
phase: 2
slug: content-quality-grounding
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` § Validation Architecture. The planner fills the
> per-task rows once PLAN.md task IDs exist.

**Repo note:** the pipeline code under test lives in the sibling `915tldr.com2`
repo, not this one. All commands below run from `915tldr.com2` unless stated.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 [VERIFIED: `915tldr.com2/package.json` devDependencies] |
| **Config file** | `915tldr.com2/vitest.config.ts` |
| **Quick run command** | `pnpm vitest run <file>` (targeted — never watch mode) |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~TBD seconds (measure during Wave 0) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <file>` for the file(s) touched
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite green, plus `npx prettier --check .` and `pnpm typecheck`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CONT-01 | — | N/A | integration | `pnpm vitest run tests/content-extraction.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONT-02, CONT-06 | — | N/A | unit | `pnpm vitest run tests/grounding/length-check.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONT-04, CONT-05 | — | N/A | unit | `pnpm vitest run tests/grounding/fixture-set.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONT-07 | — | N/A | unit | `pnpm vitest run tests/grounding/verbatim-overlap.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONT-11 | — | N/A | unit (mocked OpenAI client) | `pnpm vitest run tests/batch/resubmit.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FIX-01 | — | N/A | unit + integration | `pnpm vitest run tests/admin/reprocess-chunking.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FIX-03 | — | N/A | lint/format | `npx prettier --check app/pages/privacy.vue` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner: replace `TBD` with real task IDs, plan numbers and waves; add rows for any
requirement above that a plan splits across multiple tasks. Every phase requirement
(CONT-01…CONT-12, FIX-01…FIX-03, OPS-11) must land in at least one row or in the
Manual-Only table below.*

---

## Wave 0 Requirements

- [ ] Production D1 read access — install and authenticate `wrangler` in `915tldr.com2`
      (also satisfies FIX-02). Hard prerequisite: the local Miniflare replica is 87 rows,
      last synced 2025-12-21, and is useless for the length distribution, source
      death-date lookup, and CONT-12 outage-window audit.
- [ ] `tests/content-extraction.spec.ts` — CONT-01
- [ ] `tests/grounding/length-check.spec.ts` — CONT-02, CONT-06
- [ ] `tests/grounding/fixture-set.spec.ts` — CONT-04, CONT-05 (requires the labelled
      fixture set to be built from real corpus rows first — a data task, not just a test file)
- [ ] `tests/grounding/verbatim-overlap.spec.ts` — CONT-07
- [ ] `tests/batch/resubmit.spec.ts` — CONT-11 (mocked OpenAI client; no real API calls in CI)
- [ ] `tests/admin/reprocess-chunking.spec.ts` — FIX-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ~30 summaries of sub-90-word sources show no padding, no invented advisories, no verbatim-heavy excerpting | CONT-07 (criterion 4) | Editorial judgement — "reads as padded" is not mechanically decidable; the automated verbatim-overlap and length checks are necessary but not sufficient | Sample 30 rows where source word count < 90 from the re-processed set; read each summary against its source; record pass/fail and any failure mode |
| Dry-run row count and projected dollar cost approved before re-processing starts | CONT-09, CONT-10 (criterion 3) | Owner approval gate — by design a human decision, not an assertion | Run the dry-run script; present row count + projected cost; do not start the batch until Jaime approves the figure |
| `detect-duplicates` coverage across the 2026-09-04 → 2026-09-16 outage window | CONT-12 (criterion 6) | Requires production D1 access and interpretation of whether the gap is real | Query the outage window in production D1 for null/truncated/absent summaries and duplicate-detection coverage; fold affected rows into the re-processing set |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

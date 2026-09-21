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
| **Estimated runtime** | ~7 seconds for the full suite (193 tests, 16 files — measured 2026-09-19 during plan 02-09) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <file>` for the file(s) touched
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd-verify-work`:** Full suite green, plus `npx prettier --check .` and `pnpm typecheck`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

All commands run from `/home/jaime/www/_github/915tldr.com2`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | FIX-02 | T-02-SC | Blocking human legitimacy check before any install | checkpoint | *(blocking-human checkpoint — not auto-verifiable by design)* | n/a | ✅ resolved (owner approved 02-01-PLAN.md Task 1) |
| 02-01-T2 | 02-01 | 1 | FIX-02 | T-02-05 | No credential in any committed file | CLI | `test -x node_modules/.bin/wrangler && node_modules/.bin/wrangler --version` | ✅ | ✅ green (re-verified 02-09: `4.135.0`) |
| 02-02-T1 | 02-02 | 1 | FIX-01 | T-02-09 | No statement binds >100 parameters | unit | `pnpm vitest run tests/admin/reprocess-chunking.test.ts` | ✅ | ✅ green |
| 02-02-T2 | 02-02 | 1 | FIX-01 | T-02-04, T-02-10 | Admin gate untouched; chunking splits, never drops | integration | `pnpm vitest run tests/admin/reprocess-chunking.test.ts` | ✅ | ✅ green |
| 02-02-T3 | 02-02 | 1 | FIX-03 | — | N/A | lint/format | `npx prettier --check app/pages/privacy.vue && pnpm format:check` | ✅ | ✅ green for `privacy.vue`; `format:check` alone flags 3 PRE-EXISTING files unrelated to any 02-02 change (fixture-set.test.ts, judge.test.ts, verbatim-overlap.test.ts — see deferred-items.md) |
| 02-03-T1 | 02-03 | 2 | CONT-01 | T-02-11 | Measurement script is SELECT-only | unit | `pnpm vitest run tests/measure-corpus.test.ts` | ✅ | ✅ green |
| 02-03-T2 | 02-03 | 2 | CONT-12 | T-02-11 | Inclusive epoch bounds recorded, zero-rows never omitted | unit | `pnpm vitest run tests/measure-corpus.test.ts` | ✅ | ✅ green |
| 02-03-T3 | 02-03 | 2 | CONT-12 | T-02-12, T-02-13 | Dry-run default, explicit `--source-id`, pre-image logged | CLI | `wrangler d1 execute 915tldr-db --remote --command "SELECT id,feed_url,website_url FROM sources WHERE feed_url LIKE '%elpasonews.org%'" --json` | ✅ | ✅ green — re-verified 02-09: 0 rows (D-16 retired, no dead source row exists; matches corpus-measurements.md) |
| 02-04-T1 | 02-04 | 3 | CONT-01 | T-02-15 | One-way production migration gated by a human | checkpoint | *(blocking decision checkpoint — not auto-verifiable by design)* | n/a | ✅ resolved (migration 0007 applied to production, 02-04-SUMMARY.md) |
| 02-04-T2 | 02-04 | 3 | CONT-01, CONT-02, CONT-03, CONT-04, CONT-06, CONT-08 | T-02-01, T-02-02, T-02-04, T-02-14, T-02-15 | SSRF allowlist; labelled prompt sections; additive-only migration; grounding gates the write | integration (real Workers runtime) | `pnpm typecheck && wrangler d1 execute 915tldr-db --local --persist-to .wrangler/state --command "SELECT acquisition_status, grounding_status, LENGTH(content), LENGTH(summary), key_points FROM articles WHERE acquisition_status='fetched' ORDER BY id DESC LIMIT 1" --json` | ✅ | ✅ green per 02-04-SUMMARY.md self-check; `pnpm typecheck` re-confirmed clean during 02-09 |
| 02-04-T3 | 02-04 | 3 | CONT-01 | — | N/A | doc assertion | `node -e "…tracer-evidence.md contains 'D-03 decision'…"` | ✅ | ✅ green (`docs/phase-02/tracer-evidence.md` present) |
| 02-05-T1 | 02-05 | 4 | CONT-01 | T-02-01, T-02-16, T-02-17 | Full-hostname allowlist, redirect containment, politeness, timeout, one retry | unit | `pnpm vitest run tests/source-fetch.test.ts` | ✅ | ✅ green |
| 02-05-T2 | 02-05 | 4 | CONT-01 | — | N/A | unit (committed fixtures, offline) | `pnpm vitest run tests/content-extraction.test.ts` | ✅ | ✅ green |
| 02-05-T3 | 02-05 | 4 | CONT-01 | T-02-18 | Degraded acquisition counted per run | integration + measured sample | `wrangler d1 execute 915tldr-db --remote --command "SELECT acquisition_status, COUNT(*) FROM articles WHERE acquisition_status IS NOT NULL GROUP BY acquisition_status" --json` | ✅ | ✅ green — re-run 02-09: 100% `feed_fallback` (41,932 rows; the acquisition_status column's default, matching D-02 not having shipped to any re-fetched row yet) |
| 02-06-T1 | 02-06 | 4 | CONT-02, CONT-03, CONT-08 | T-02-02, T-02-14 | Labelled sections preserved; bounded input at the measured cap | unit | `pnpm vitest run tests/prompt-shape.test.ts` | ✅ | ✅ green |
| 02-06-T2 | 02-06 | 4 | CONT-07 | T-02-02 | Variant axis cannot select a weaker prohibition block | unit | `pnpm vitest run tests/prompt-shape.test.ts` | ✅ | ✅ green |
| 02-06-T3 | 02-06 | 4 | CONT-02 | T-02-20 | Identity freeze on re-processing | unit (in-memory D1) | `pnpm vitest run tests/ai-processor-store.test.ts` | ✅ | ✅ green |
| 02-07-T1 | 02-07 | 5 | CONT-02, CONT-06 | T-02-24 | Logs carry flag codes and truncated evidence, not bodies | unit | `pnpm vitest run tests/grounding/length-check.test.ts` | ✅ | ✅ green |
| 02-07-T2 | 02-07 | 5 | CONT-07 | T-02-23 | Rolling-row LCS bounded for a 35k-character source | unit | `pnpm vitest run tests/grounding/verbatim-overlap.test.ts` | ✅ | ✅ green |
| 02-07-T3 | 02-07 | 5 | CONT-04 | T-02-02, T-02-21, T-02-22 | Cited spans re-verified in code; every failure path flags | unit (mocked client) | `pnpm vitest run tests/grounding/judge.test.ts` | ✅ | ✅ green |
| 02-08-T1 | 02-08 | 6 | CONT-05 | T-02-27 | Read-only fixture build; refuses to write an undersized set | CLI | `node -e "…labelled-set.json has ≥1 bad and ≥20 good, unique uuids…"` | ✅ | ✅ green — re-verified 02-09: 7 bad, 21 good, all uuids unique |
| 02-08-T2 | 02-08 | 6 | CONT-04, CONT-05 | T-02-22 | No false-green against an empty fixture set | unit | `pnpm vitest run tests/grounding/fixture-set.test.ts` | ✅ | ✅ green |
| 02-08-T3 | 02-08 | 6 | CONT-04 | T-02-04, T-02-25, T-02-26 | Held rows unpublishable; admin gate inherited; exactly one retry | integration (in-memory D1) | `pnpm vitest run tests/grounding/gate-invariant.test.ts` | ❌ not built | ⏸ DEFERRED — owner decision 2026-09-19 (02-08-SUMMARY.md "Option D"): the full-cascade false-positive rate measured too far outside the target ceiling against pre-fix legacy fixtures to wire D-09 live gating responsibly. `tests/grounding/gate-invariant.test.ts` does not exist and is not planned until unblocked (WINDOWS.md entry 20: needs a post-fix labelled sample). Re-plan this task once that data exists — do not treat the missing file as a regression. |
| 02-09-T1 | 02-09 | 7 | CONT-09, OPS-11 | T-02-03 | Ceiling-to-the-cent threshold comparison | unit | `pnpm vitest run tests/reprocess/cost-estimate.test.ts` | ✅ | ✅ green (15 tests) |
| 02-09-T2 | 02-09 | 7 | CONT-09, CONT-12, OPS-11 | T-02-03, T-02-11, T-02-28, T-02-29 | Calls nothing paid; import boundary forbids re-fetch | CLI | `node scripts/reprocess-dry-run.mjs --limit 200 && grep -c 'chat.completions' scripts/reprocess-dry-run.mjs` | ✅ | ✅ green — also verified the FULL unlimited sweep (no `--limit`), report + JSON under `docs/phase-02/` |
| 02-09-T3 | 02-09 | 7 | CONT-12, OPS-11 | T-02-03 | Union dedupe; zero-row report still written | unit | `pnpm vitest run tests/reprocess/dry-run.test.ts` | ✅ | ✅ green (17 tests) |
| 02-10-T1 | 02-10 | 8 | OPS-11, CONT-10 | T-02-03 | Human approves an exact figure against a live balance | checkpoint | *(blocking decision checkpoint — not auto-verifiable by design)* | n/a | ⬜ pending (02-10 not yet executed) |
| 02-10-T2 | 02-10 | 8 | CONT-10, CONT-11, OPS-11, CONT-12 | T-02-03, T-02-06, T-02-09, T-02-20, T-02-28, T-02-29, T-02-30, T-02-31 | Report gate, fingerprint re-check, run lock, identity freeze, chunked write-back | unit + CLI | `pnpm vitest run tests/batch/ && node scripts/reprocess-execute.mjs` *(expects non-zero with no `--report`)* | ❌ W8 | ⬜ pending (02-10 not yet executed) |
| 02-10-T3 | 02-10 | 8 | CONT-07 | T-02-20 | Public disclosure of a content change readers already saw | doc assertion + human-check | `node -e "…editorial-review.md covers 30 uuids; changelog.json carries both entries…"` | ❌ W8 | ⬜ pending (02-10 not yet executed) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement coverage:** CONT-01 (02-03-T1, 02-04-T2, 02-05-T1/T2/T3), CONT-02 (02-04-T2,
02-06-T1/T3, 02-07-T1), CONT-03 (02-04-T2, 02-06-T1), CONT-04 (02-04-T2, 02-07-T3,
02-08-T2/T3), CONT-05 (02-08-T1/T2), CONT-06 (02-04-T2, 02-07-T1), CONT-07 (02-06-T2,
02-07-T2, 02-10-T3), CONT-08 (02-04-T2, 02-06-T1), CONT-09 (02-09-T1/T2/T3), CONT-10
(02-10-T1/T2), CONT-11 (02-10-T2), CONT-12 (02-03-T2/T3, 02-09-T2/T3, 02-10-T2), FIX-01
(02-02-T1/T2), FIX-02 (02-01-T1/T2), FIX-03 (02-02-T3), OPS-11 (02-09-T1/T2/T3,
02-10-T1/T2). All 16 phase requirements are covered.

---

## Test-file creation map

02-RESEARCH.md described these as "Wave 0" gaps. They are not all Wave 0 — each test file is
created by the plan that creates the code it covers, test-first where the task is marked
`tdd="true"`. The one genuine Wave-0-style hard prerequisite is production D1 read access.

- [x] **Production D1 read access** — plan **02-01**, Wave 1. Installed and authenticated
      `wrangler` (also satisfies FIX-02). Hard prerequisite for the length distribution, the
      source death-date lookup, the CONT-12 outage audit and the CONT-09 dry run: the local
      Miniflare replica is 87 rows, last synced 2025-12-21.
- [x] `tests/admin/reprocess-chunking.test.ts` — plan 02-02, Wave 1 — FIX-01
- [x] `tests/measure-corpus.test.ts` — plan 02-03, Wave 2 — CONT-01, CONT-12
- [x] `tests/source-fetch.test.ts` — plan 02-05, Wave 4 — CONT-01
- [x] `tests/content-extraction.test.ts` — plan 02-05, Wave 4 — CONT-01
- [x] `tests/prompt-shape.test.ts` — plan 02-06, Wave 4 — CONT-02, CONT-03, CONT-07, CONT-08
- [x] `tests/ai-processor-store.test.ts` — plan 02-06, Wave 4 — CONT-02 (and D-06, D-12)
- [x] `tests/grounding/length-check.test.ts` — plan 02-07, Wave 5 — CONT-02, CONT-06
- [x] `tests/grounding/verbatim-overlap.test.ts` — plan 02-07, Wave 5 — CONT-07
- [x] `tests/grounding/judge.test.ts` — plan 02-07, Wave 5 — CONT-04
- [x] `tests/grounding/fixture-set.test.ts` — plan 02-08, Wave 6 — CONT-04, CONT-05 (requires
      the labelled fixture set built from real corpus rows first — a data task, not just a
      test file)
- [ ] `tests/grounding/gate-invariant.test.ts` — plan 02-08, Wave 6 — CONT-04 (D-09). **NOT
      BUILT — deferred by owner decision 2026-09-19** (02-08-SUMMARY.md "Option D"): the
      full-cascade false-positive rate against pre-fix legacy fixtures was too far outside the
      target ceiling to wire D-09 live gating responsibly. Tracked in WINDOWS.md entry 20; needs
      a post-fix labelled sample to unblock, not a code fix.
- [x] `tests/reprocess/cost-estimate.test.ts` — plan 02-09, Wave 7 — CONT-09, OPS-11
- [x] `tests/reprocess/dry-run.test.ts` — plan 02-09, Wave 7 — CONT-12, OPS-11
- [ ] `tests/batch/jsonl.test.ts` — plan 02-10, Wave 8 — CONT-10 (not yet executed)
- [ ] `tests/batch/resubmit.test.ts` — plan 02-10, Wave 8 — CONT-11 (mocked OpenAI client; no
      real API calls in CI) (not yet executed)

**Naming:** every file above ends in `.test.ts`. `vitest.config.ts:9` sets
`include: ['tests/**/*.test.ts']`, so a `.spec.ts` file is silently never run — which is why
02-RESEARCH.md's `.spec.ts` naming was corrected.

---

## Manual-Only Verifications

| Behavior | Requirement | Owning task | Why Manual | Test Instructions |
|----------|-------------|-------------|------------|-------------------|
| ~30 summaries of sub-90-word sources show no padding, no invented advisories, no verbatim-heavy excerpting | CONT-07 (criterion 4) | 02-10-T3 `<human-check>` | Editorial judgement — "reads as padded" is not mechanically decidable; the automated verbatim-overlap and length checks are necessary but not sufficient | Sample 30 rows whose source word count is under 90 by a stated selection rule (not hand-picked) from the re-processed set; read each summary against its source; record per row the uuid, both word counts and four verdicts in `docs/phase-02/editorial-review.md` |
| Dry-run row count and projected dollar cost approved before re-processing starts | CONT-09, CONT-10, OPS-11 (criterion 3) | 02-10-T1 `checkpoint:decision` | Owner approval gate — by design a human decision, not an assertion. Never auto-approvable | Quote the figures from the newest dry-run report verbatim; check the live OpenAI balance; do not start the batch until Jaime approves, naming the report filename |
| Production D1 migration of four additive columns | CONT-01, CONT-04 (D-02, D-06) | 02-04-T1 `checkpoint:decision` | One-way door on a live 435 MB table; the apply mechanism also needs checking against the remote migrations ledger rather than assuming | Present `wrangler d1 migrations list --remote` output, the absence of `migrations_dir` in `wrangler.jsonc`, and the current highest migration number; then decide |
| Package legitimacy for the two SUS and one unaudited package | FIX-02 | 02-01-T1 `checkpoint:human-verify` (blocking-human) | Never auto-approvable per the package-legitimacy protocol, regardless of `workflow.auto_advance` | Open each package's registry page; confirm repository, publisher and absence of a postinstall script |
| `detect-duplicates` coverage across the 2026-09-04 → 2026-09-16 outage window | CONT-12 (criterion 6) | 02-03-T2 (measurement) + human reading | The query is automated; whether the measured gap is real requires interpreting a stored-state proxy for "did detection run" | The script records the proxy condition used and labels it a proxy; read that section of `docs/phase-02/corpus-measurements.md` and judge whether the gap is genuine before it joins the re-processing set |
| Two public changelog entries read as reader language, not engineering notes | D-19 | 02-10-T3 `<human-check>` | Tone and honesty are judgement calls | Open `/changelog` on the running site and read both entries as a reader would |
| Five held articles' grounding reasons point an editor at the right sentence | CONT-04 (D-09) | 02-08 `<human-check>` | A false-positive rate under a ceiling does not tell you whether the *reasons* are actionable | Read five held articles from the review queue against their sources; record the uuids and the verdict on each |
| Actual run cost reconciled against the OpenAI account's usage page | OPS-11 | 02-10 `<human-check>` | The manifest figure derives from the batch response; the billed figure on the account is authoritative | Check the account usage page for the run date and the balance after the run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

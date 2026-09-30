# 2026-09-19 - Phase 2 planned: ten plans across eight waves for content quality & grounding

**Keywords:** [PLANNING] [DOCUMENTATION] [BACKEND] [SECURITY]
**Session:** Late morning, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-19-1114_phase-2-plan-content-quality-grounding.md`

## What Changed

- File: `.planning/phases/02-content-quality-grounding/02-01-PLAN.md`
  - Wave 1: package-legitimacy blocking checkpoint for the two SUS and one unaudited package
  - Pinned installs making `wrangler` a real devDependency (FIX-02) and adding linkedom, @mozilla/readability, js-tiktoken
  - Proof of authenticated production D1 reads, recorded with a real corpus row count
- File: `.planning/phases/02-content-quality-grounding/02-02-PLAN.md`
  - Wave 1: generic `chunk()` helper and a bound-parameter-budgeted reset (FIX-01), 97 ids on the UPDATE and 100 on the DELETEs
  - Prettier fix for `app/pages/privacy.vue` (FIX-03) plus a repo-wide format check
- File: `.planning/phases/02-content-quality-grounding/02-03-PLAN.md`
  - Wave 2: read-only production measurement — per-source content-length distribution, truncation-marker baseline, the derived D-04 input cap
  - CONT-12 outage-window audit with inclusive epoch bounds, and the dead source's last-article date
  - D-16 repoint of the third source to elpasonews.org, dry-run by default
- File: `.planning/phases/02-content-quality-grounding/02-04-PLAN.md`
  - Wave 3: the tracer — one article end-to-end through fetch, Workers-side extraction, the new prompt, the grounding gate and a columnar write, inside a real Workers runtime
  - A blocking decision checkpoint ahead of the one-way additive migration against production D1
  - Records the D-03 go/no-go on linkedom + Readability, which research could not verify
- File: `.planning/phases/02-content-quality-grounding/02-05-PLAN.md`
  - Wave 4: `source-fetch.ts` as the single outbound fetch surface with a full-hostname allowlist, redirect containment, identifying User-Agent, per-host rate limit and robots handling
  - Per-source extraction fixtures and the 200-article truncation-marker sample (CONT-01)
- File: `.planning/phases/02-content-quality-grounding/02-06-PLAN.md`
  - Wave 4: prompt rewrite — proportional length with a hard ceiling, facts-only key points, an explicit prohibition block, the `gpt-5.6-luna` pin
  - Thin-source attribution decided in code at a tested 90-word boundary
  - Columnar key points and the D-12 title/slug freeze on re-processing
- File: `.planning/phases/02-content-quality-grounding/02-07-PLAN.md`
  - Wave 5: one shared `text-metrics.ts` length definition, the deterministic check stage, verbatim-overlap scoring, and the claim-level judge with code-verified source spans
- File: `.planning/phases/02-content-quality-grounding/02-08-PLAN.md`
  - Wave 6: labelled fixture set built from real corpus rows and keyed by UUID, a measured false-positive ceiling, live gating with one stricter retry, and a review queue with a visible count
- File: `.planning/phases/02-content-quality-grounding/02-09-PLAN.md`
  - Wave 7: token-validated cost estimator, the free corpus sweep, the outage union, and a fingerprinted dry-run report that calls nothing paid
- File: `.planning/phases/02-content-quality-grounding/02-10-PLAN.md`
  - Wave 8: owner approval checkpoint, report-gated Batch execution with a run lock and expired-remainder resubmission, public changelog entries and the thirty-summary editorial read
- File: `.planning/phases/02-content-quality-grounding/COVERAGE.md`
  - OpenAI API coverage matrix scoped to this project's surface: 13 INTEGRATE, 11 OPT-OUT, each opt-out with a reason
- File: `.planning/phases/02-content-quality-grounding/02-PATTERNS.md`
  - Pattern map with verified analogs and line numbers, including the correction that test files must be `.test.ts` not `.spec.ts`
- File: `.planning/phases/02-content-quality-grounding/02-VALIDATION.md`
  - Per-task verification map filled in: 28 rows with task ids, waves, threat refs and runnable commands
  - Manual-only table expanded to eight rows, each bound to its owning checkpoint or human-check
- File: `.planning/ROADMAP.md`
  - Phase 2 plan list and wave structure replacing the TBD placeholder; progress row updated to 0/10 Planned

## Why

Phase 2 fixes three defects that compound: content arrives pre-truncated, the prompt rewards
padding and invents advisories, and nothing checks whether a summary's claims trace back to its
source. The decomposition leads with a tracer because the phase rests on one unverified
assumption — that linkedom plus Readability runs inside this Worker's bundle — and one
irreversible act, the additive migration against the live 435 MB production database. Proving
the first and gating the second before five expansion plans depend on them is the point of the
ordering.

Wave 1 opens with wrangler because every measurement the phase needs is blocked on production
D1 access, and the local Miniflare replica is 87 rows last synced nine months ago. Installing
wrangler also closes FIX-02, so the prerequisite and the defect fix are the same act.

The spend gate is structural rather than procedural: the dry run computes and writes a
fingerprinted report, and the execute command refuses to start without being pointed at one
whose fingerprint still matches. A confirm flag is one flag away from being skipped by an agent
and an interactive prompt does not survive cron.

## Issues Encountered

- 02-RESEARCH.md's Validation Architecture named test files with a `.spec.ts` extension, but
  `vitest.config.ts:9` includes only `tests/**/*.test.ts`. Every test file in every plan is
  named `.test.ts`; a `.spec.ts` file would have been silently never run.
- Migration numbering is ambiguous: `develop` carries migrations through 0005 while the unmerged
  `feature/fix/d1-sort-index` branch adds a 0006. The tracer plan requires the number be derived
  from `drizzle-kit generate` at execution time rather than hardcoded, and the migration
  checkpoint requires the remote migrations ledger be inspected before choosing an apply
  mechanism — `wrangler.jsonc` has no `migrations_dir`, so `d1 migrations apply` would look in
  the wrong place today.
- Judging the deterministically-flagged subset is itself a paid operation, which made the OPS-11
  gate circular if the dry run performed it. Resolved by splitting: the sweep is free and
  projects both the judge-stage and batch-stage cost into one report, and a single approval
  covers both.
- An early draft of 02-10 carried a `grep -c 'confirm' == 0` gate that the script's own
  "confirmed set" identifiers would have failed. Narrowed to the flag literal with an allowlist
  marker.

## Dependencies

No dependencies added to this repo. The plans specify additions to the sibling `915tldr.com2`
repo — `wrangler` (devDependency, FIX-02), `linkedom`, `@mozilla/readability` and `js-tiktoken` —
behind a blocking human legitimacy checkpoint in plan 02-01.

## Testing Notes

- What was tested: all ten plans pass `verify.plan-structure` and `frontmatter.validate` with
  zero errors and zero warnings; every source path and line number cited in the plans was
  verified against the live `915tldr.com2` checkout rather than taken from research
- What wasn't tested: nothing executes yet — these are plans. The 16 test files they specify do
  not exist
- Edge cases: the spec-less probe fallback supplied 24 unresolved edges; all 24 are resolved into
  explicit acceptance criteria and each plan carries a ledger showing which it owns, so the
  no-silent-drop count balances at 24

## Next Steps

- [ ] Land or set aside `feature/fix/d1-sort-index` in `915tldr.com2`, then create
      `feature/phase-02` off `develop` (D-18 — Jaime creates it in lazygit)
- [ ] Confirm `wrangler` authentication or a `CLOUDFLARE_API_TOKEN` with D1 read scope exists
- [ ] Run `/gsd-execute-phase 2` after `/clear`
- [ ] Plan 02-01 Task 1 is a blocking human checkpoint and is never auto-approvable

---

**Branch:** feature/phase-02
**Issue:** N/A
**Impact:** HIGH - defines all implementation work for Phase 2, including two one-way doors (a production D1 migration and a 41k-row re-processing run) and the spend gate that guards the second

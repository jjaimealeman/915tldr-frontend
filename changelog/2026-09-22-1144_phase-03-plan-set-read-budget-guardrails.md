# 2026-09-22 - Phase 3 plan set: seven plans, five waves, tracer-first

**Keywords:** [PLANNING] [INFRA] [TESTING] [SECURITY] [CONFIG]
**Session:** Late morning, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1144_phase-03-plan-set-read-budget-guardrails.md`

## What Changed

- File: `.planning/phases/03-foundation-read-budget-guardrails/03-01-PLAN.md`
  - Wave 1. Blocking human checkpoint on the package-legitimacy audit, then the phase's single
    `type="tracer"` slice: one live D1 row → a real URL → a KV manifest entry, with the D1-import
    assertion live inside the build. Must verify before any expansion task runs.
  - Carries the canonical "Artifacts this phase produces" table (33 artifacts) and the
    Edge Probe Ledger accounting for all 12 probe items.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-02-PLAN.md`
  - Wave 2. Permanent negative CI fixtures plus the comment-stripped config guard.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-03-PLAN.md`
  - Wave 2. `/version.json` and the footer derived from one module with recorded hash provenance;
    README states the read budget.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-04-PLAN.md`
  - Wave 2. Render manifest hardened and documented; gated on a one-way decision about the
    Spanish counterpart identity model.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-05-PLAN.md`
  - Wave 3. Deploy to dev.915tldr.com plus the edge Transform Rule, verified against a live
    response header rather than built output.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-06-PLAN.md`
  - Wave 4. The three D-01 measurements, including an empirical read on the cron CPU ceiling.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-07-PLAN.md`
  - Wave 5. Render-step location decided from the measured numbers and written down.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-PATTERNS.md`
  - Maps 12 files to closest in-repo analogs — 7 found, 5 genuinely greenfield.
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-VALIDATION.md`
  - Per-Task Verification Map filled with real task IDs, plans and waves.
  - Corrected the ARCH-04/ARCH-06 row mapping against REQUIREMENTS.md.
- File: `.planning/phases/03-foundation-read-budget-guardrails/COVERAGE.md`
  - Four-API coverage matrix (D1 REST, KV, Rulesets, Workers platform). Every OPT-OUT carries a
    reason; three are scoped this-phase-only so Phases 4 and 6 re-decide from full coverage.
- File: `.planning/ROADMAP.md`
  - Phase 3 plan list populated; wave dependency headers annotated.
- File: `.planning/STATE.md`
  - Status set to "Ready to execute", plan count 7.

## Why

Phase 3 exists to make the project's one non-negotiable constraint — zero D1 reads on the public
request path — structurally impossible to violate rather than merely documented. That shapes every
choice in the plan set.

The assertion is a Rollup/Vite `buildEnd` module-graph walk over Astro's already-resolved graph,
not a grep and not a `dependency-cruiser` run. Grep cannot see a transitive import.
`dependency-cruiser` was evaluated and rejected outright because it has no `.astro` parser, so the
exact file type that matters most is invisible to it. Walking the graph Astro itself produced means
the check sees what the bundler sees.

The negative fixtures are deliberately transitive: the `.astro` page imports a component, which
imports a helper, which imports the D1 client — and the violation crosses the `.astro` → `.vue`
boundary. A direct-import fixture would pass while the real failure mode went uncaught, which is
the sort of green test that is worse than no test.

A separate cheap grep guard covers `wrangler.jsonc` for a `d1_databases` binding. This closes a gap
the module-graph walk cannot see by construction: a binding added in config is not a module-graph
edge, so no amount of import analysis will ever notice it.

Tracer-first ordering means the risky end-to-end path is proven on one real article before any
breadth is added, and D-02 already required the measurements be taken against that real slice
rather than a synthetic benchmark — so the tracer and the measurement harness are the same code.

## Issues Encountered

- **A requirement-ID mismatch between two planning documents.** REQUIREMENTS.md assigns ARCH-04 to
  the `cloudflare:workers` env import and ARCH-06 to `imageService`; the ROADMAP's success-criteria
  prose lists them in the opposite order. REQUIREMENTS.md was treated as authoritative and
  03-VALIDATION.md's seeded rows were corrected to match, with a note recording the change.

- **A ROADMAP criterion in tension with the research's reference shape.** Criterion 3 requires the
  manifest to *already carry* the Spanish counterpart ID so Phase 6 never needs a backfill
  re-render. 03-RESEARCH.md's reference shape declares that field `string | null`, "null until
  Phase 6 backfill". A field that is null for all 42,000 articles satisfies any key-presence test
  and delivers none of the benefit. This became a decision checkpoint in 03-04 plus a
  `must_haves.prohibitions` entry forbidding the structurally-always-null solution.

- **A STATE.md blocker that may rest on a wrong number.** STATE.md cites a flat "300-second Worker
  CPU ceiling". Cloudflare's own limits table gives Cron Trigger CPU time as 30s under a 1-hour
  interval but 15 minutes at 1-hour-or-longer intervals — and this project's cron runs every two
  hours. This bears directly on the render-step-location decision, so it is planned as something
  measured empirically in 03-06, not assumed.

- **The edge probe classified poorly on this phase.** It tagged the build-time assertion as
  "concurrency" and asked what `imageService` returns "for empty input". Protocol forbids
  auto-dismissing probe items, so the seven unclassified rows are carried as explicit flagged
  assumptions with an honest note about the category fit rather than dressed up as real edges.

- **All seven core packages flagged `SUS` by the legitimacy audit.** Assessed as a heuristic
  false-positive pattern — recent patch tags on mature, high-download, verified-repo packages.
  Carried as a blocking human checkpoint in 03-01 rather than silently accepted or silently
  rejected.

## Dependencies

No dependencies added. This commit contains planning artifacts only — no `package.json` change.
The Standard Stack install itself is scheduled work inside 03-01.

## Testing Notes

- What was tested: the plan set itself, by `gsd-plan-checker`, which returned VERIFICATION PASSED
  on the first iteration with no blockers. Requirements coverage 10/10, decision coverage 8/8,
  post-planning gap analysis 18/18. Wave safety confirmed — no `files_modified` overlap within any
  wave, despite `package.json`, `wrangler.jsonc`, `Base.astro` and `kv-manifest.ts` each being
  touched by several plans in different waves.
- What wasn't tested: nothing executable exists yet. No code ships in this commit.
- Edge cases: the checker's own report restated the edge-probe arithmetic incorrectly
  ("5 + 1 + 7 = 12", which is 13). The ledger in 03-01 was checked directly and is correct —
  4 explicit plus 1 backstop marker authored into `must_haves`, 7 flagged assumptions, 12 total,
  no drops.

## Next Steps

- [ ] Resolve the STATE.md / ROADMAP disagreement about the `articles-semantic` vector gap — STATE.md
      labels it "URGENT, Phase 3" and claims a Phase 3 success criterion covers it, but no such
      criterion exists, it appears in none of the ten requirement IDs, and 03-CONTEXT.md's phase
      boundary excludes it. It feeds SRCH-02/SRCH-03 in Phase 9. One of the two documents is wrong.
- [ ] Run `/gsd-execute-phase 3`, which opens on the package-legitimacy checkpoint.
- [ ] Decide the Spanish counterpart identity model at 03-04's checkpoint (derived UUID /
      nullable-until-Phase-6 / translation-group ID).
- [ ] Decide the render-step location at 03-07's checkpoint, from the numbers 03-06 measures.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM — planning artifacts only, no runtime code, but this plan set governs how the
project's core architectural constraint gets enforced.

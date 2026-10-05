# 2026-10-03 - Phase 06 plans created: Bilingual (17 plans, 10 waves)

**Keywords:** [PLANNING] [DOCUMENTATION] [I18N]
**Session:** Night, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-0355_phase-06-plans-created.md`

## What Changed

- File: `.planning/phases/06-bilingual/06-01-PLAN.md` … `06-17-PLAN.md`
  - Pipeline track (915tldr.com2): same-call bilingual ingest tracer, Spanish grounding, production migration of `article_translations` (owner consent), measured backfill dry run + pilot, go-live decision, resumable Batch backfill, completion + live convergence
  - Frontend track: language-aware Worker/R2 keys, build/sync side of Spanish keys, EN/ES dictionary + Base hreflang/switcher/Umami tag, `articlesEs` collection, article pages, listings + 404, static pages with fluent review, per-language feeds/sitemaps, measured build budget gate, deploy, live verification
  - Every plan carries a threat model, must_haves with edge-probe truths and prohibitions, and an artifacts list
- File: `.planning/phases/06-bilingual/COVERAGE.md`
  - API coverage matrix for OpenAI, D1, R2 and Umami (passes the api-coverage gate)
- File: `.planning/phases/06-bilingual/06-VALIDATION.md`
  - Per-task verification map filled from the plans' verify blocks
- File: `.planning/phases/06-bilingual/06-PATTERNS.md`
  - Pattern map the plans reference (produced earlier this session)
- File: `.planning/ROADMAP.md`
  - Phase 6 plan list with wave structure

## Why

Phase 6 is two repos, a production migration, a ~40,761-row paid backfill and a doubled static
site. The plans put every production change and every spend behind an owner checkpoint with
measured numbers, fix the uuid-only KV/R2/redirect keys first, and measure the build and file
budgets before anything deploys or any backfill money is spent.

## Issues Encountered

- Key-scheme decision recorded: the KV manifest entry stays the shared translation-group identity
  (no Spanish manifest entries); R2 keys add `es/` alongside the unchanged English keys. Rated
  costly, not one-way.
- Research's ~$1.49 backfill estimate is not trusted; a rough projection lands near $20+ for the
  translation stage alone. 06-08 measures it and 06-13 asks for approval with the real figure.
- Suspected pre-existing gap: archived R2 pages reference the hashed stylesheet of the build that
  rendered them; a CSS hash change can leave them unstyled until re-uploaded. 06-16 checks it live.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: frontmatter and plan-structure validation on all 17 plans; wave/dependency and
  file-overlap check; requirement coverage (all 9 IDs); api-coverage gate on COVERAGE.md.
- What wasn't tested: nothing executed — planning artifacts only.

## Next Steps

- [ ] `/gsd-execute-phase 6` (06-01 starts with Jaime creating `feature/phase-06` in 915tldr.com2)
- [ ] Owner decisions ahead: migration consent (06-03), Spanish page review (06-07), go-live and backfill ceiling (06-13), deploy route (06-15), Umami language report (06-16)

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - defines all Phase 6 execution; no code changed

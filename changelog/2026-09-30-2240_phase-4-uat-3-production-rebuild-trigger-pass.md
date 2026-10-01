# 2026-09-30 - Phase 4 UAT 3 passes: one ingest cycle, one production build

**Keywords:** [DOCS] [TESTING] [DEPLOY] [CRON] [D1]
**Session:** Night, Duration (~0.3 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2240_phase-4-uat-3-production-rebuild-trigger-pass.md`

## What Changed

- File: `.planning/phases/04-static-generation-templates-seo/04-UAT.md`
  - Test 3 (production activation of the rebuild trigger, OPS-10) marked PASS with evidence
  - Current test advanced to 4; summary now 3 passed, 1 pending
  - Recorded a side finding: v1 duplicate detection fails on every ingest run

## Why

UAT 3 could only be checked against a real cron cycle after Phase 4 merged to main. The 04:00 UTC
2026-10-01 run of v1 Worker `915tldr` (version 4a4af16e) was that cycle. Evidence gathered:

- v1 logs: 13 new / 97 skipped / 0 fetch errors; 6 processed, 0 failed (3 held by grounding);
  `Frontend deploy hook: triggered`.
- Workers Builds for `915tldr-v2`: exactly one build after 04:00 UTC
  (`e8a27400-5f12-4709-b2de-9a73c0c1e9a6`, `main`, 04:06:25Z, success).
- Content: dev.915tldr.com's top three stories are exactly the three newest public articles in D1
  and match v1's live `/api/articles`. v1's homepage HTML lagged behind on a `max-age=300` cached
  render — a v1 caching artefact, not a v2 discrepancy.

## Issues Encountered

v1's duplicate detection throws on every run: the `article_entities`/`entities` IN-list binds about
116 parameters, over D1's 100-parameter ceiling. It failed on all 25 runs since at least
2026-09-29, before tonight's 02:12Z v1 deploy, so it is pre-existing rather than a Phase 2
regression, and no rollback was done. Effect: `duplicatesFound` is always 0, so cross-source
duplicates publish and are counted as "changed" when deciding whether to trigger a rebuild.

The Workers Observability MCP `events` view failed to parse scheduled-run events (missing
`requestId`); the `calculations` view grouped by message worked instead.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: v1 Worker logs for the 04:00 UTC run, Workers Builds list and build detail,
  dev vs v1 homepage HTML, v1 `/api/articles`, read-only D1 lookup of the lead articles.
- What wasn't tested: build-failure notification (UAT 4, still pending).
- Edge cases: a run with zero changes (`no-changes` reason) was not observed in this window.

## Next Steps

- [ ] Fix v1 duplicate detection: chunk the entity IN-list to 100 or fewer params (915tldr.com2)
- [ ] Run UAT 4 (real in-container build-failure ntfy notification)

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW

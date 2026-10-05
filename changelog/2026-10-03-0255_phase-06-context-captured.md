# 2026-10-03 - Phase 06 context captured: Bilingual

**Keywords:** [PLANNING] [DOCUMENTATION] [I18N]
**Session:** Night, Duration (~50 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-0255_phase-06-context-captured.md`

## What Changed

- File: `.planning/phases/06-bilingual/06-CONTEXT.md`
  - 17 implementation decisions (D-01…D-17) across data shape, URLs, launch/backfill, switcher/chrome
  - Spanish lives in a sibling `article_translations` table; title/summary/key points only
  - Grounding check extends to Spanish; a Spanish-only failure publishes English and holds Spanish
  - `/es` + identical English path; Spanish-origin articles labelled "Originally reported in Spanish"
  - `/es` fully public at ship (overrides PROJECT.md's "launch on 2-4 weeks of data" rule)
  - Full ~40,761-article Batch API backfill after a costed dry run
  - I18N-10 via Umami Languages report; Umami tag goes on v1 now and v2
  - Header + per-article switcher, plain links, no cookie, no auto-redirect
- File: `.planning/phases/06-bilingual/06-DISCUSSION-LOG.md`
  - Audit trail of options presented and chosen, plus the mid-session archive-size interlude
- File: `.planning/STATE.md`
  - Session recorded: stopped at "Phase 6 context gathered"

## Why

Phase 6 needed its implementation decisions locked before research and planning. Mid-discussion,
the owner weighed cutting the archive to speed the rebuild. Measured numbers (40,761 public
articles; ~1,170 production article requests/day; 80% of reads need an 83-day window) showed the
archive costs little and is still read, so the plan continues as written.

## Issues Encountered

- The Umami tag (stats.915websites.com) was found never installed on v1 or v2, code or live, which
  explains an empty dashboard. Recorded as D-11 and a quick task.
- `tools/derive-hot-window.mjs` has no hostname filter: the Oct 1 dev load test (13,472 requests on
  dev.915tldr.com) contaminated the 2026-10-02 re-derivation preview. The in-force 202-day window
  (Sep 1-30 sample, ~1.7% dev traffic) is unaffected. Logged under deferred ideas.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: live D1 counts (read-only SELECT); per-host Cloudflare GraphQL breakdown Sep 3 -
  Oct 2; curl of live v1/dev v2 HTML for the Umami tag.
- What wasn't tested: whether this Umami instance exposes a Languages report (research must confirm).

## Next Steps

- [ ] `/gsd-plan-phase 6`
- [ ] Quick task in 915tldr.com2: add the Umami tag to v1
- [ ] Update PROJECT.md's `/es` launch rule at phase transition (D-09)
- [ ] Add a hostname filter to `tools/derive-hot-window.mjs`; correct the re-derivation section of `docs/phase-05/hot-window-derivation.md`

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - locks Phase 6 scope and overrides one PROJECT.md decision

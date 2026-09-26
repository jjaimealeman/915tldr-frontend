# 2026-09-26 - Trailing slash: decided to drop it in Phase 4, RSS gotcha recorded

**Keywords:** [DOCUMENTATION] [SEO] [ARCHITECTURE] [PLANNING]
**Session:** Morning, Duration (~0.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1130_trailing-slash-dropped-rss-gotcha-recorded.md`

## What Changed

- File: `.planning/ROADMAP.md`
  - Phase 4's "Carried from Phase 3" note now records the owner's decision: drop the trailing slash (`trailingSlash: 'never'` + `build.format: 'file'`) so v2 matches v1's URL shape
  - Records that every internal link in `src/` is absolute (checked 2026-09-26), so the setting's usual risk (relative links resolving differently) does not apply
  - Adds the Astro RSS gotcha: `rss()` emits trailing-slash links regardless of `trailingSlash`, so the `/rss.xml` endpoint must pass `trailingSlash: false`, with a verification step
  - Removes the earlier "Likely fix" wording, which the decision replaces

## Why

Phase 3 UAT item 1. v2 currently answers `/path` with a 307 to `/path/`; v1 answers `/path` with 200. Nine months of indexed URLs are in the no-slash form, and PROJECT.md requires them to carry over unchanged. The redirect also costs a round trip against the release-blocking 1.5s LCP budget. The deferral to Phase 4 was already recorded on 2026-09-23; this entry turns "likely fix" into a decision and adds the RSS detail that would otherwise surface late.

## Issues Encountered

No major issues encountered. The RSS behaviour comes from the Astro docs' RSS recipe ("Removing trailing slashes"), found through the astro-docs MCP. It has not been reproduced in this codebase, because `/rss.xml` does not exist in v2 yet.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: grep of `src/` for internal `href` values (all absolute)
- What wasn't tested: the config change itself. It belongs to Phase 4 and was not applied here.
- Edge cases: any future relative link would break under `trailingSlash: 'never'`, so the ROADMAP note says to keep links absolute

## Next Steps

- [ ] Phase 4: apply `trailingSlash: 'never'` + `build.format: 'file'`, rebuild, redeploy to dev, confirm `/path` answers 200 directly
- [ ] Phase 4: pass `trailingSlash: false` to `rss()` and verify `/rss.xml` item links

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** Low. Planning record only, no code or config change.

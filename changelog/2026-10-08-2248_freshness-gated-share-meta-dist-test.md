# 2026-10-08 - Freshness-gated real-build test for share metadata on built pages

**Keywords:** [TESTING] [FRONTEND]
**Session:** Night, Duration (~6 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2248_freshness-gated-share-meta-dist-test.md`

## What Changed

- File: `tests/helpers/dist-fresh.mjs`
  - New `builtPagesHaveShareMeta()` probe: true when the built home page already carries `property="og:image"`
- File: `tests/unit/share-meta-dist.test.mjs`
  - New. Five tests on real built output: a hot EN article and its ES twin (og:type article; article:published_time equals the body `<time datetime>` and the JSON-LD datePublished; modified_time equals dateModified; section equals articleSection; og:url equals canonical; the right card and author), listing pages stay `website` with no `article:` key, the 404 page, and a noindex source page keeping its share tags
  - Every test is gated through `staleDistReason`, so it reports a visible skip naming the newer source file until a real build exists
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-04 (SOC-03). A local full build writes production KV, so the real article templates are not rendered here. This test will check them the first time anyone builds, and says so loudly in the meantime instead of passing vacuously or failing against the 2026-10-04 dist.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: against the current stale dist the file reports 5 skipped, 0 pass, 0 fail, each skip naming `src/layouts/Base.astro`; `pnpm run test:fast` 1173 tests, 1159 pass, 0 fail, 14 skipped
- What wasn't tested: the assertions themselves against a real build (none exists), so their selectors are unproven until then
- Edge cases: archive-tier article pages are read through `readBuiltPage`

## Next Steps

- [ ] Run this file after the first real build (07-06 checkpoint decides when)

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tests only

# 2026-09-26 - Phase 4 research: Content Layer loader, and a risky experimental flag

**Keywords:** [PLANNING] [RESEARCH] [ARCHITECTURE] [PERFORMANCE]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1554_04-research-static-generation-templates-seo.md`

## What Changed

- File: `.planning/phases/04-static-generation-templates-seo/04-RESEARCH.md`
  - Recommends Astro's real Content Layer API (`defineCollection` plus a hand-written Loader) over Phase 3's `getStaticPaths()` + direct D1 calls. The Loader's `meta` store persists in `node_modules/.astro/`, which Workers Builds caches, so a `last_sync` watermark can drive the cheap incremental D1 query.
  - Flags `experimental.incrementalBuild` as the main risk. An open upstream issue (`withastro/astro#18055`) reports it never reuses pages on a fresh CI machine, and a Workers Builds container is exactly that.
  - Notes that Phase 3's plan for chaining a full rebuild across cron cycles doesn't carry over once `astro build` moves to Workers Builds (20-minute hard limit per build).
  - Confirms `build.format: 'file'` resolves the `/crime` vs `/crime/**` collision (FIX-04), and that `wrangler.jsonc` was missing `not_found_handling`.
  - Package legitimacy audit: `@astrojs/rss` OK; `@astrojs/sitemap` flagged "too-new" (likely false positive, human check required).

## Why

Phase 4 had to pick a data-loading pattern and a build host before planning. The research also turned two unknowns into spikes the plan has to run before relying on them: does a Loader throw fail the build, and does incremental build reuse pages on CI?

## Issues Encountered

- Cloudflare's native trailing-slash handling redirects with 307, never 301, in every mode. Recorded for the plan rather than assumed away.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: claims checked against Astro docs (Context7) and Cloudflare docs; package versions from the npm registry.
- What wasn't tested: both open questions were left for Wave 0 spikes. Later results: 04-01 proved a Loader throw fails `astro build`. 04-09 reproduced #18055 locally (verdict `REUSE_WARM_ONLY`), but a full build turned out to take about 1 minute, so no reuse still fits the 20-minute limit.

## Next Steps

- [x] Validation strategy
- [x] `/gsd-plan-phase 4`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** Medium. Planning only, but it set the loader architecture and the spike list.
**Note:** Replaces an auto-generated placeholder (2026-09-27).

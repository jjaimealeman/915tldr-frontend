# 2026-09-26 - 04-01 complete: 328 real articles live on dev at their v1 URLs

**Keywords:** [DOCS] [PLANNING] [DEPLOYMENT]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1718_04-01-complete-content-layer-loader-canonical-urls.md`

## What Changed

- File: `.planning/phases/04-static-generation-templates-seo/04-01-SUMMARY.md`
  - Records the tracer result: 328 real article pages built from a 3-day D1 window through the new Content Layer Loader, deployed to dev.915tldr.com at canonical URLs built from the stored `articles.slug`, each with a schema-v2 KV manifest entry.
  - Spike result: a throw inside `Loader.load()` does fail `astro build` (exit 1, tested with a real invalid token).
  - Two pre-existing tests fixed because this plan broke them (`build.format: 'file'` changed file discovery; manifest v2 requires `slug`).
- Files: `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`: plan progress and requirement status.

## Why

Plan close-out. Every later Phase 4 plan builds on this slice, so its measured results and deviations are recorded where the next executor reads them.

## Issues Encountered

- The trailing-slash variant of an article URL answers 307, not 301. It's Cloudflare's native behaviour, documented in `docs/phase-04/spikes.md` as a named deviation.
- `tools/verify-edge-headers.mjs` still imports the retired `src/lib/slug.ts`. Left for plan 04-12, which owns that file.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: live HTTP checks on dev (canonical path 200 with no `Location`; trailing slash 307), unit and tracer tests.
- What wasn't tested: only a 3-day window was built. The full corpus was 04-03's job.

## Next Steps

- [x] 04-02 shared chrome and head metadata

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** Medium
**Note:** Replaces an auto-generated placeholder (2026-09-27).

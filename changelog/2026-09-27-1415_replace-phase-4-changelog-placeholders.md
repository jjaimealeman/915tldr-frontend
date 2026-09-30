# 2026-09-27 - Replaced four Phase 4 placeholder changelog entries with real ones

**Keywords:** [DOCUMENTATION]
**Session:** Afternoon, Duration (~0.3 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1415_replace-phase-4-changelog-placeholders.md`

## What Changed

- File: `changelog/2026-09-26-1554_04-research-static-generation-templates-seo.md`
  - Placeholder diffstat replaced with the research's findings: Content Layer Loader, the `experimental.incrementalBuild` risk (#18055), the 307 trailing-slash behaviour, and how both spikes later resolved
- File: `changelog/2026-09-26-1555_phase-4-add-validation-strategy.md`
  - Placeholder replaced with the requirement-to-test map and sampling rules
- File: `changelog/2026-09-26-1649_04-create-phase-plan.md`
  - Placeholder replaced with the 12 plans across 6 waves, and why they're ordered that way
- File: `changelog/2026-09-26-1718_04-01-complete-content-layer-loader-canonical-urls.md`
  - Placeholder replaced with 04-01's close-out: 328 real articles on dev at stored-slug URLs; the Loader throw fails the build
- File: `changelog/2026-09-26-2340_04-02-format-structured-data-categories-green.md`
  - Two invisible line-separator characters (U+2028/U+2029) replaced with their literal names. The file was describing exactly that corruption and had been corrupted by it.
- File: `changelog/README.md`
  - Index rows added for the four entries (they had never been indexed) and for this one

## Why

Three of the placeholders came from last session's planning commits, and one from 04-01's final metadata commit. All four went through a commit path other than `/jja-commit`, so the hook wrote a bare diffstat tagged `[auto-generated]`. From 04-02 on, every executor commit was routed through `/jja-commit`.

## Issues Encountered

- 19 more files in `changelog/` still match `[auto-generated]`, from Phases 1–3. At least three are false positives (`README.md` and two entries that mention the tag while describing earlier cleanups). Not touched here: out of this session's scope.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `grep -rlP '[\x{2028}\x{2029}]' changelog` returns nothing; none of the four files still carries the `[auto-generated]` keyword.
- What wasn't tested: facts in the replacement entries were taken from this session's plan summaries and `docs/phase-04/build-measurements.md`, not re-measured.

## Next Steps

- [ ] Decide whether to sweep the Phase 1–3 placeholder backlog

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** Low. Documentation only.

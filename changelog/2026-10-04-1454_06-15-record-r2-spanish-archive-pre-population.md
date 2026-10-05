# 2026-10-04 - 06-15: Spanish archive pre-populated in R2, deploy record written

**Keywords:** [DOCUMENTATION] [PLANNING] [I18N] [DEPLOYMENT] [INFRASTRUCTURE]
**Session:** Afternoon, Duration (~0.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-1454_06-15-record-r2-spanish-archive-pre-population.md`

## What Changed

- File: `docs/phase-06/deploy-record.md`
  - New record of the route Jaime chose (merge and push, no local deploy) and the approval to pre-populate R2
  - Suite result before any upload: 1021/1021 unit, 9/9 build gate, 5/5 regression
  - Pre-population: 31,018 new `es/` objects (13,290 `es/articles/`, 17,728 `es/tags/`) uploaded in one pass, 0 failed
  - Verification by listing R2 and reading the archive index; no English index entry was rewritten
  - Class A cost: about 31,200 operations, up to about 0.14 USD at list price
  - Production KV manifest writes from the cold local build, disclosed
  - Static-file headroom watch and the steps Jaime takes to ship
- File: `changelog/README.md`
  - Index row for this entry

## Why

The first real bilingual build should only have to deploy, not also carry about 31,000 new Spanish
archive objects through its pre-sync window. The objects were uploaded ahead of time by a
credentialed local run that deploys nothing.

## Issues Encountered

- The plan's literal command (`ci:local`) would have rebuilt cold and rewritten about 40.7k production KV manifest entries a second time, so the dry-run deploy step was run directly against the existing build, with the build-start marker written by hand. Disclosed in the record.
- The cold local build already wrote manifest entries carrying this checkout's hash (`afb5f4b`) to production KV. Confirmed by a read of one entry; no consumer of that field was found in the Worker.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: full suite (1021 + 9 + 5 passing), R2 key counts against the plan, index entries against the pass start time, a second preflight showing 0 new keys
- What wasn't tested: English objects were not re-read byte for byte; the account's month-to-date R2 usage was not read
- Edge cases: the 31,018 changed English archive objects were deliberately left for the post-deploy sync

## Next Steps

- [ ] Jaime merges `feature/phase-06` into `develop` and `main` and pushes
- [ ] Confirm `ARTICLES_FORCE_COLD`, `ASTRO_INCREMENTAL_BUILD`, `ALLOW_FALLBACK_HOT_WINDOW` are not set in the dashboard
- [ ] 06-16: compare the first Workers Builds timing with the 643s projection

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - writes 31,018 new objects to the production archive bucket; no code or deploy change

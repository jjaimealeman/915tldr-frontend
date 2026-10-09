# 2026-10-08 - Phase 7 pre-merge deploy record and live "before" snapshot

**Keywords:** [DOCUMENTATION] [DEPLOYMENT] [TOOLING]
**Session:** Night, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2335_pre-merge-deploy-record-live-before-snapshot.md`

## What Changed

- File: `docs/phase-07/evidence/live-check-pre.json`
  - New. Output of `tools/verify-share-meta.mjs --host dev.915tldr.com --json` before the deploy: 125 checks, 33 pass, 92 fail (the expected "before" state), live version.json commit `main`, stylesheet `/_astro/Base.h88la9Hn.css`
- File: `docs/phase-07/deploy-record.md`
  - New. "Before merge" section: branch HEAD, live state, page weights before, green gate results, Jaime's 07-06 answers as applied, and the deploy-impact arithmetic (62,036 archived objects, about 0.28 USD R2 Class A as an estimate, 59,621 static files from a stale 2026-10-04 plan)
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-08 Task 1. Jaime merges and pushes next, and has to read the deploy's real consequences first. The pre-deploy live snapshot is the baseline that the post-deploy check is compared against.

## Issues Encountered

No major issues encountered. `dist/archive-plan.json` and `dist/client/static-budget.json` are 4 days stale and are labelled as such in the record.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: test:fast (1207 tests, 1193 pass, 0 fail, 14 skipped), five node --test files (94/94), guard:config, og-card render --review; read-only GETs against dev.915tldr.com via the checker
- What wasn't tested: pnpm build, test:unit, test:regression, typecheck (not allowed this plan); real share scrapers; stylesheet-href stability (expectation only until the post-deploy comparison)
- Edge cases: none

## Next Steps

- [ ] Jaime merges feature/phase-07 into develop and main and pushes (07-08 Task 2)
- [ ] 07-08 Task 3 post-deploy live proof against the merged commit

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - documentation and evidence files only

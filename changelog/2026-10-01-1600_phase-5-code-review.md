# 2026-10-01 - Phase 5 code review: 3 blockers, 9 warnings, 10 info

**Keywords:** [REVIEW] [ARCHITECTURE] [TESTING] [DOCUMENTATION]
**Session:** Afternoon, Duration (~0.3 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1600_phase-5-code-review.md`

## What Changed

- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-REVIEW.md`
  - Standard-depth review of the 24 source/tool files Phase 5 changed (diff base 05a09a3)
  - CR-01: `CI_BUILD_DEPLOY_DRY_RUN=1` still runs archive post-sync, which deletes R2 objects for pages static in an undeployed build (production 404s until the next real deploy)
  - CR-02: `pnpm run build` + plain `pnpm run deploy` ships an archive partition without the pre-sync upload
  - CR-03: zero-reads gate load window is not bucket-aligned like the baseline (biased toward PASS; recorded verdict still holds after correction)
  - WR-01..09 and IN-01..10, incl. WR-08: `countOtherFiles()` in derive-hot-window returns -30,466 after a partitioned build

## Why

Required code-review gate at the end of Phase 5 execution, before phase verification.

## Issues Encountered

The orchestrator HEAD-checked 150 archived URLs on dev.915tldr.com (120 random + the 30 newest archived articles) after the review: 150/150 returned 200, so no CR-01/CR-02 damage is live — the 20:06 UTC production build reconverged R2. The blockers are latent, not active.

The review found no code on the archive path that plausibly costs the 26–49 ms CPU spikes seen in the gate window (ARCH-08); cold-isolate startup fits the evidence better but is unconfirmed.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: static review; reviewer ran `tools/assert-no-d1.mjs` (exit 0) and measured `countOtherFiles()` on the current tree
- What wasn't tested: fixes — none applied yet
- Edge cases: overlapping builds (WR-01), partial post-sync failure (WR-02), KV outage returns 404 vs R2 outage 503 (WR-06)

## Next Steps

- [ ] Fix CR-01..03 and WR-08 (gap closure or `/gsd-code-review 05 --fix`)
- [ ] Phase verification, then resolve ARCH-08 CPU-max gap

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM

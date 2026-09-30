# 2026-09-30 - Build 3 measurements plus a new asset-dedup finding for 04-11

**Keywords:** [DOCUMENTATION] [CI_CD] [PERFORMANCE] [DEPLOYMENT]
**Session:** Afternoon, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1517_build3-measurements-and-asset-dedup-finding.md`

## What Changed

- File: `docs/phase-04/build-measurements.md`
  - Recorded Build 3 (flag-on, first toggle after the owner pushed `cc1b050` on 2026-09-30):
    cold again as documented (04-09's known toggle-reset behavior), 0/60,349 pages restored
    (expected — first build since the flag flipped on)
  - Added a new finding: the deploy re-uploaded 60,355 of 60,355 assets (only 7 already
    present), root-caused to `src/layouts/Base.astro` unconditionally printing `BUILD_HASH` in
    every page's footer regardless of `stamp` mode, so any commit change alters the raw bytes of
    every page and defeats Cloudflare's content-hash asset-upload deduplication
  - Added a placeholder for Build 4 (the real reuse test), to be filled in once it completes

## Why

Task 2's spike continues to measure real Workers Builds behavior. Build 3 confirms the expected
cold-reset-on-toggle behavior 04-09 already documented locally, now proven on the real platform.
The asset re-upload was unexpected (only ~370 of 60,355 pages genuinely changed content-wise
between Build 1/2 and Build 3, yet nearly all were re-uploaded) and directly affects 04-11's cost
model, so it was investigated to a specific, source-verified root cause rather than left as an
unexplained anomaly or silently absorbed into the existing cold-build numbers.

## Issues Encountered

The root cause required reading `src/layouts/Base.astro` and `src/lib/build-info.ts` together:
`stampDate` is correctly stamp-gated (stable for `stamp="commit"` articles) but `BUILD_HASH`
itself has no equivalent gate and is derived from the commit SHA, which genuinely differed between
Build 1/2 (an earlier commit) and Build 3 (`e95a734`). Whether this also affects same-commit
steady-state rebuilds (the D-02 cron-triggered case, no new commit) was NOT verified in this
session — flagged as an open question for 04-11 rather than guessed at.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: The root cause is confirmed directly from source code (`Base.astro` line 152,
  `build-info.ts`'s `resolveBuildHash()`), not merely inferred from the upload count alone.
- What wasn't tested: Two consecutive same-commit Deploy-Hook-triggered builds, which would
  isolate whether this finding applies to every deploy or only actual code pushes.
- Edge cases: N/A for this doc-only change.

## Next Steps

- [ ] 04-11 should decide whether to gate `BUILD_HASH` in the footer the same way `stampDate`
      already is (or omit it from `stamp="commit"` pages), given its cost impact on asset uploads
- [ ] Verify whether same-commit steady-state rebuilds also lose dedup, or only actual code pushes

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - real, diagnosed cost-relevant finding for 04-11's production decision; not
fixed in this plan (Rule 4 — product/design decision, not a mechanical bug)

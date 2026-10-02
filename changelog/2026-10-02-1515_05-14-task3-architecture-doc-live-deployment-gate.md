# 2026-10-02 - Document the live-deployment gate in the archive architecture record

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [SECURITY] [DEPLOYMENT]
**Session:** Afternoon, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1515_05-14-task3-architecture-doc-live-deployment-gate.md`

## What Changed

- File: `docs/phase-05/archive-architecture.md`
  - Build sequence: added a paragraph under step 10 (`archive-sync post`) describing the dry-run refusal, the live `/version.json` match requirement (commit + builtAt, polling up to 6×10s), and the pre-delete re-check (CR-01/WR-01, 05-14).
  - Failure-mode table: added three rows — "Dry run reaches post (direct invocation)", "Live deployment is not this build (overlapping or out-of-order builds, propagation failure, origin unreachable)" (flagging that a persistent occurrence is an incident, not a quiet no-op, since it also silently defers REND-11's daily report and REND-12's re-render), and "Live deployment changes mid-run" (the pre-delete re-check's own skip).
  - New "Live origin" section: documents `ARCHIVE_SYNC_LIVE_ORIGIN` (default `https://dev.915tldr.com`, https-only), states it MUST be updated at the Phase 12 production cutover or every `post` run will silently skip, and notes there is no override flag — a manual `post` invocation against a local build is refused by design.

## Why

05-14's Task 1 and Task 2 implemented the live-deployment gate in code; this task makes the contract legible to a future reader (or operator at the Phase 12 cutover) without having to re-derive it from the diff. The "persistent skip = incident" framing matters specifically because a silently-skipping `post` also means REND-11's daily file-count report and REND-12's forced re-render both stop happening, with no deploy-blocking signal to notice it.

## Issues Encountered

No major issues encountered — documentation-only change, no code touched.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run test:fast` (689/689 pass — confirms the doc change didn't touch any code path); grep checks confirmed both failure-mode rows and the `ARCHIVE_SYNC_LIVE_ORIGIN`/Phase-12 paragraph are present.
- What wasn't tested: N/A (docs only).
- Edge cases: N/A.

## Next Steps

- [ ] 05-20: close CR-02 (the separate `pnpm run deploy` skipping pre-sync entirely) — the last open gap from 05-REVIEW.md before REND-07/REND-08 can be marked Complete
- [ ] 05-21: final requirement closure once all gap-closure plans (05-13 through 05-21) land

---

**Branch:** feature/phase-05
**Issue:** CR-01 / WR-01 (05-REVIEW.md)
**Impact:** LOW - documentation only; makes an already-shipped safety contract legible, including an explicit Phase 12 cutover obligation

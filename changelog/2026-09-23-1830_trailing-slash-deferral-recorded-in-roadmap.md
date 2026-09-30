# 2026-09-23 - Trailing-Slash Redirect Deferral Recorded as an Explicit Phase 4 Carry-Over

**Keywords:** [DOCUMENTATION] [SEO] [ARCHITECTURE]
**Session:** Evening, Duration (~10min, part of a larger Phase 3 UAT follow-up session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1830_trailing-slash-deferral-recorded-in-roadmap.md`

## What Changed

- File: `.planning/ROADMAP.md`
  - Added a "Carried from Phase 3" note under Phase 4's success criteria recording the owner's
    scope decision (03-UAT.md item 1, 2026-09-23): v2 currently serves `/path` → 307 → `/path/`
    (Astro's default directory-style output, no `trailingSlash` configured) while v1 serves
    `/path` → 200 directly, measured live on both hosts
  - States the likely fix (`trailingSlash: 'never'` with `build.format: 'file'`) without applying
    it, and points at criterion 4 and the already-mapped SEO-04/FIX-04/FIX-05 requirements as
    where it must be resolved

## Why

Every v1-emitted indexed link is in the no-slash form, so under v2's current default every one of
nine months of indexed URLs would take an extra 307 redirect hop before the page loads — against
a release-blocking 1.5s LCP budget. The URL still resolves (Phase 3 criterion 4's letter is
satisfied), but "resolves" and "resolves unchanged, with no added latency" are different claims,
and the gap needed to be an explicit, owner-made decision rather than something Phase 4's planner
discovers cold. SEO-04/FIX-04/FIX-05 were already mapped to Phase 4 in REQUIREMENTS.md, so this is
a scope boundary being recorded, not new work being invented.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (87/87 pass) and `pnpm test:build-gate` (4/4 pass) — confirmed
  unaffected, since this is a documentation-only roadmap edit touching no application code
- What wasn't tested: N/A — no code path changed
- Edge cases: N/A

## Next Steps

- [ ] Phase 4's planner must apply `trailingSlash: 'never'` + `build.format: 'file'` (or an
      equivalent fix) and re-measure `/path` against `/path/` on both v1 and v2 before sign-off

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** LOW - Documentation-only; records a scope decision, changes no application code

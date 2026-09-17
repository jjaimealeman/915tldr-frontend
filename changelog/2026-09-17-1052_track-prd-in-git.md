# 2026-09-17 - Track docs/PRD.md in Git

**Keywords:** [DOCUMENTATION] [PLANNING]
**Session:** Morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1052_track-prd-in-git.md`

## What Changed

- File: `docs/PRD.md`
  - Tracked for the first time, content unchanged (52 KB, the v2 rebuild PRD)
- File: `.planning/phases/01-design-sketch-editorial-identity/01-13-PLAN.md`
  - PRD §6.5 amendment is now committed with Task 3 (`git add docs/PRD.md` only), replacing the "docs/ is untracked, on disk only" instructions and acceptance check
- File: `.planning/phases/01-design-sketch-editorial-identity/01-14-PLAN.md`
  - PRD §5.2/§6.8 amendment is committed with its task, not left untracked
- File: `.planning/phases/01-design-sketch-editorial-identity/01-23-PLAN.md`
  - Approval packet wording: the D-GAP-A amendment is in git, not on disk only

## Why

Owner decision (2026-09-17). Plans 01-13 and 01-14 amend the PRD to record the owner's font-display and headline-typeface decisions. While the PRD was untracked, those amendments had no diff, no history and no way to undo them. Tracking the PRD before 01-13 runs means both amendments show up as real, reviewable diffs.

## Issues Encountered

No major issues encountered. A quick scan of the PRD for secrets (keys, tokens, account IDs, emails) found only env var names and cost estimates. The repo has no git remote, so this commit publishes nothing.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: after the edits, grep confirmed no plan still describes docs/PRD.md as untracked (the one remaining "untracked" in 01-14 is about a font file)
- What wasn't tested: N/A, documentation-only commit
- Edge cases: docs/screenshots/ and .gsd/ are intentionally left untracked

## Next Steps

- [ ] 01-12: summary markdown → safe HTML (TDD)
- [ ] 01-13/01-14: commit the PRD amendments with their tasks

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - documentation and planning only

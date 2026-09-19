# 2026-09-17 - Logged the Chrome Font-Swap Finding to the Project's Defect Ledger

**Keywords:** [DOCUMENTATION] [PLANNING]
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1121_01-13-record-chromium-optional-swap-finding-in-win.md`

## What Changed

- `.planning/WINDOWS.md`: added entry 9, recording that the `font-display:
  optional` fix (see the previous entry) does not prevent a late font swap
  in Chrome, verified in a clean reproduction, while Safari's engine
  behaves correctly.

## Why

This project keeps a running list of every open defect and unresolved
finding in one place so nothing gets forgotten between sessions or lost in
a chat transcript. Recording it here is what makes it visible before the
site ships, not something that has to be remembered.

## Issues Encountered

None — bookkeeping only.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: N/A, ledger update only.
- What wasn't tested: N/A.

## Next Steps

- [ ] Owner decision on the Chrome finding, then resume 01-13 Tasks 2-3

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - planning record only

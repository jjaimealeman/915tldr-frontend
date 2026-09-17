# 2026-09-17 - Retire package-lock.json from git; move 01-VALIDATION.md to pnpm wording

**Keywords:** [CONFIG] [DOCUMENTATION] [DEPENDENCIES]
**Session:** Afternoon, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1705_retire-npm-lockfile-pnpm-validation-wording.md`

## What Changed

- File: `package-lock.json`
  - Removed from the git index only (`git rm --cached`). The file is left on disk — never deleted — for the owner to remove manually.
- File: `.gitignore`
  - Added a comment ("pnpm is the package manager, owner decision D-GAP-D, 2026-09-17") followed by `package-lock.json`, so it can no longer be re-committed by accident.
- File: `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md`
  - Every `npm run X` command rewritten to `pnpm run X`; every `npm run X -- --flag` rewritten to `pnpm run X --flag` (pnpm forwards flags without the `--` separator).
  - The Wave 0 browser-install note rewritten to `pnpm exec playwright install chromium webkit`.
  - Added a "Package manager | pnpm (owner decision D-GAP-D, 2026-09-17); package-lock.json retired" row under Test Infrastructure.
  - Frontmatter, statuses, and every other section left untouched.
  - No 01-01 … 01-10 PLAN or SUMMARY file was edited — those stay historical.

## Why

D-GAP-D (owner decision, 2026-09-17) chose pnpm as the project's single package manager. git can only meaningfully track one lockfile; keeping both invites drift between them. The living validation contract (01-VALIDATION.md) is the document contributors and future plans actually run commands from, so its wording has to match the tool that's actually installed.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added or removed. `package-lock.json` still describes the same resolved tree as `pnpm-lock.yaml` (verified 16/16 identical in the prior commit); it is simply no longer the tracked lockfile.

## Testing Notes

- What was tested: `git ls-files --error-unmatch package-lock.json` (exits non-zero, confirming untracked); `git check-ignore -q package-lock.json` (exits 0, confirming ignored); grep of 01-VALIDATION.md for `npm run`/`npx` (none remain) and for `pnpm run verify:phase-1` (present); confirmed `package-lock.json` still exists on disk; confirmed `git diff --stat` touches no 01-0N-PLAN.md or 01-0N-SUMMARY.md file.
- What wasn't tested: N/A — this task is documentation/config only, no runtime behavior changed.
- Edge cases: N/A.

## Next Steps

- [ ] Cleanup needed (for the owner): `rm package-lock.json`
- [ ] Task 3: pnpm wording in tool output (verify-approval.mjs, serve-mockups.mjs, check-contrast.mjs, build-palette.mjs); record 01-10 as `outcome: revise`

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - config/documentation only; package-lock.json remains on disk for the owner to delete

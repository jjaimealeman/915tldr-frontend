# 2026-09-23 - Phase 12 Directory Reorganization Recorded (Plain Parent, Two Repos)

**Keywords:** [DOCUMENTATION] [PLANNING] [ARCHITECTURE]
**Session:** Evening, Duration (~20min, part of a larger Phase 3 UAT follow-up session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1900_phase12-directory-reorg-recorded.md`

## What Changed

- File: `.planning/todos/pending/2026-09-23-split-repos-into-plain-parent-directory.md` (new)
  - Todo with `resolves_phase: 12` frontmatter, auto-filed into `completed/` by execute-phase's
    `close_phase_todos` step when Phase 12 lands, surfaced by `/gsd-progress` until then
  - Records the target layout: a plain parent directory `915tldr.com/` (not a repo) holding two
    separate git repos, `915tldr-frontend/` and `915tldr-backend/`, mirroring the owner's existing
    `LizMonroy_website/babs-admin` / `babs-boutique` precedent
  - Notes the project-prefixed child names are deliberate (zoxide frecency navigation across
    129+ project directories makes bare `frontend`/`backend` unusable), that this is a `mv` not a
    migration (GSD resolves project root via `git rev-parse --show-toplevel`), and that historical
    changelog entries referencing old absolute paths should not be rewritten
- File: `.planning/ROADMAP.md`
  - Added a "Deliverable" line under Phase 12's success criteria pointing at the todo
- File: `.planning/PROJECT.md`
  - Added a brief note under "Directory trap" stating the two-repo layout is a permanent split
    (not a rebuild artifact) and pointing at the READMEs and the Phase 12 todo for detail

## Why

Recorded so the planned reorganization lives on the roadmap and in a trackable todo rather than
only in the owner's head — it happens at Phase 12 specifically (when the Nuxt app moves to
`admin.915tldr.com` and the split becomes real in production, not before), so a todo with
`resolves_phase: 12` is the correct mechanism: GSD auto-closes it exactly when that phase
completes, and `/gsd-progress` keeps it visible until then.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (87/87) and `pnpm test:build-gate` (4/4) — confirmed
  unaffected, documentation/planning-only change
- What wasn't tested: the todo's `resolves_phase: 12` auto-close behavior itself — that only
  exercises when Phase 12 actually completes, which is many phases away
- Edge cases: N/A

## Next Steps

- [ ] At Phase 12, execute the directory move described in the todo once the admin split is real
      in production, then verify `git rev-parse --show-toplevel` and zoxide entries still resolve
      correctly from the new paths in both repos

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** LOW - Documentation/planning-only; no application code changed

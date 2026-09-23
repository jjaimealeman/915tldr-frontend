# 2026-09-23 - Repo-Role READMEs: Frontend/Backend Split Is Permanent, Not Transitional

**Keywords:** [DOCUMENTATION] [ARCHITECTURE]
**Session:** Evening, Duration (~20min, part of a larger Phase 3 UAT follow-up session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1850_repo-role-readmes-frontend-backend-split.md`

## What Changed

- File: `README.md`
  - Added a role block at the top: `915tldr.com` (frontend, Astro, reads D1 at build time) vs
    `915tldr.com2` (backend, Nuxt, owns the 2-hourly ingest cron)
  - Added a "This is a split, not a replacement" section citing PROJECT.md and ROADMAP evidence
    that both repos are permanent, plus a phase-ownership table (frontend: 1, 3, 4, 5, 7, 8, 9,
    11; backend: 2, 6, 12) and a note that `.planning/` lives only in this repo but governs both
- File: `915tldr.com2/README.md` (sibling repo, edited but **left uncommitted** — that repo is on
  the protected `develop` branch; the owner reviews and commits it separately in lazygit)
  - Same role block and split rationale, mirrored for the backend repo's perspective

## Why

The owner spent real time confused about which of the two identically-prefixed repo names
(`915tldr.com` / `915tldr.com2`) was which during a 2026-09-22 session. `915tldr.com2` reads as
"an old copy," not "the backend that owns the ingest cron" — and the split is permanent
(PROJECT.md's own "Nuxt app retained for pipeline/admin" constraint, ROADMAP Phase 12's
admin.915tldr.com criterion), so the fix is documentation that states the split plainly rather
than something to hold in memory. A Phase 12 todo tracks a longer-term directory rename; this
README fix is the immediate mitigation.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (87/87) and `pnpm test:build-gate` (4/4) — confirmed
  unaffected, documentation-only change
- What wasn't tested: N/A — no code path changed
- Edge cases: N/A

## Next Steps

- [ ] See `.planning/todos/pending/2026-09-23-split-repos-into-plain-parent-directory.md`
      (resolves at Phase 12) for the longer-term directory reorganization this README fix defers

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** LOW - Documentation-only; no application code changed

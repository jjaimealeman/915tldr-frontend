---
created: 2026-09-23T18:20:12Z
title: Split repos into a plain parent directory at Phase 12
area: tooling
severity: minor
files:
  - 915tldr.com/README.md
  - 915tldr.com2/README.md
resolves_phase: 12
---

## Problem

The owner spent real time confused about which of `915tldr.com` and `915tldr.com2` is which
(2026-09-22 night session). This is a v2-rebuild-permanent split, not a transitional state —
`915tldr.com` is the frontend (Astro, public site, reads D1 at build time) and `915tldr.com2` is
the backend (Nuxt, pipeline + admin, owns the 2-hourly ingest cron). Both READMEs now carry a
role block and phase-ownership table (Phase 3 UAT follow-up, 2026-09-23) as an interim fix, but
the underlying directory names (`915tldr.com`, `915tldr.com2`) still don't say which is which —
`.com2` reads as "an old copy" or "a duplicate," not "the backend."

## Solution

At **Phase 12** ("Admin Split, Cutover & Budget Routine" — not before; that's when the Nuxt app
moves to `admin.915tldr.com` and the split becomes permanent in production too), reorganize into
a plain parent directory containing two separate git repos, mirroring the owner's existing
`LizMonroy_website/` precedent (verified: `babs-admin` and `babs-boutique` are each their own git
repo; the parent directory itself is NOT a repo):

```
915tldr.com/                 plain directory (NOT a repo)
  915tldr-frontend/          Astro — public site. Holds .planning/ for BOTH repos.
  915tldr-backend/           Nuxt  — pipeline + admin + 2-hourly ingest cron
```

Keep the project prefix in the child directory names deliberately (`915tldr-frontend` /
`915tldr-backend`, not bare `frontend`/`backend`) — matching `babs-admin`/`babs-boutique`, not
`admin`/`boutique`. The owner navigates 129+ project directories by zoxide frecency
(`zoxide query --list --score`); bare `frontend`/`backend` entries would be indistinguishable
from every other project's frontend/backend directories and unusable via frecency lookup.

**This is a `mv`, not a migration.** GSD tooling resolves the project root via
`git rev-parse --show-toplevel`, which is unaffected by the parent directory's name or the git
repos' location on disk — only the two `.git` directories and their relative position to each
other matter, and both move together as a unit.

**Do not rewrite historical changelog entries.** Existing changelog entries referencing the old
absolute paths (`/home/jaime/www/_github/915tldr.com`, `/home/jaime/www/_github/915tldr.com2`)
are historical records of what was true at the time they were written — leave them as-is. Only
new entries after the Phase 12 reorg should use the new paths.

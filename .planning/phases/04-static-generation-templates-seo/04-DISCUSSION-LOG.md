# Phase 4: Static Generation, Templates & SEO - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-26
**Phase:** 4-Static Generation, Templates & SEO
**Areas discussed:** How cron triggers the build, Old URLs & the 404 page, v1 routes outside the list, Fail-loud thresholds

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Tracer apostrophe test | `html.includes(row.title)` fails on `&#39;`; resolves_phase 4 | ✓ |
| Split repos into parent dir | Keyword false-match; todo itself says Phase 12 | ✓ (then reversed) |

**Notes:** The owner first folded both. Claude flagged that the repo-split todo says "Phase 12, not
before". After confirming Workers Builds connects to the GitHub repo rather than the local path,
the owner kept the split at Phase 12 and Phase 4 only picks the GitHub name.

---

## How cron triggers the build

| Option | Description | Selected |
|--------|-------------|----------|
| Hosted CI | GitHub Actions or Cloudflare Workers Builds; needs a remote | ✓ (Workers Builds) |
| This machine, on a timer | systemd timer; stale whenever the machine is off | |
| Home server | Same, on an always-on box | |

**User's choice:** "hosted CI, CF workers." Given as free text after the first question batch was
rejected for clarification.
**Notes:** Claude then verified against Cloudflare docs: Deploy Hooks exist (2026-04-01), build
caching covers `node_modules/.astro`, and Workers Builds needs a GitHub/GitLab repo connected.

| Question | Options | Selected |
|----------|---------|----------|
| Trigger | Ingest cron POSTs the hook / separate cron Worker | Ingest cron POSTs the hook |
| Remote | Public GitHub / private GitHub / GitLab | Public GitHub |
| Prod branch | main / develop | main |
| Phase 3 D-01 | Amend explicitly / treat as consistent | Amend explicitly |
| Repo name | 915tldr-frontend / 915tldr.com / 915tldr | 915tldr-frontend |
| Local split timing | Keep at Phase 12 / do it in Phase 4 | Keep at Phase 12 |

---

## Old URLs & the 404 page

| Question | Options | Selected |
|----------|---------|----------|
| Non-canonical article URLs | 301 to canonical via Worker (1 KV read) / exact match else 404 | 301 via Worker |
| 8-char short IDs | Drop / keep (extra KV key) / keep only if research finds usage | Drop |
| 404 suggestions | Static index, no AI / Worker+KV+AI / Worker+KV, no AI | Static index, no AI |

**Notes:** Scout found v1 resolves by UUID only and regenerates slugs on AI retitle, and that the
Phase 3 tracer's `slugify()` diverges from v1's `generateSlug()`. The stored-slug rule (D-07) was
recorded as a correctness fact, not offered as a choice.

---

## v1 routes outside the list

| Question | Options | Selected |
|----------|---------|----------|
| /about, /privacy, /terms | Port current content as static / leave to Phase 10 | Port as static |
| /tags, /sources, /source/*, /categories | Build /tags + /source/*, 301 rest / build all / 301 all home | Build /tags + /source/*, 301 rest |
| /stats, /new, /search | 301 /new, /search waits, drop /stats / also build /stats statically | 301 /new, /search waits, drop /stats |

---

## Fail-loud thresholds

| Question | Options | Selected |
|----------|---------|----------|
| Changelog history | JSON + 6 D1 rows / JSON only / move source into this repo | JSON + 6 D1 rows |
| "Fewer than expected" | Never shrink vs last good build / fixed floor / both | Never shrink |
| On failure | Keep last deploy + alert / keep last deploy, log only | Keep last deploy + alert |

**Notes:** Claude checked the data sources first. v1's public changelog reads
`915tldr.com2/public/changelog.json` (12 entries); D1 `public_changelogs` has 6 orphaned rows from
Dec 2025 (one read-only COUNT query, 6 rows read). A per-build `COUNT(*)` was rejected on budget
grounds: ~500k rows/day.

---

## Claude's Discretion

- Where last-good-build counts persist (recommend KV)
- Trailing-slash variant handling at the edge
- Structured data shape and News sitemap mechanics
- Deterministic rendering for byte-identical unchanged articles
- 404 index size/coverage

## Deferred Ideas

- Statically built `/stats` page — later phase / backlog
- Repo split into a plain parent directory — stays at Phase 12

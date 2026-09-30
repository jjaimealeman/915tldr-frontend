---
phase: 03
slug: foundation-read-budget-guardrails
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-09-26
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Build host (Node) → Cloudflare REST APIs | `astro build` and the tools read D1 and read/write KV over the REST API | `CLOUDFLARE_API_TOKEN` (secret), article rows, manifest entries |
| Build output → public Worker / static assets | Everything in `dist/client/` is served publicly from `dev.915tldr.com` | Rendered HTML, `/version.json`; must contain no server-only code and no secret |
| `src/lib/server/` → public entrypoints | Build-time-only modules (D1 client, KV manifest) must be unreachable from any on-demand page, endpoint, middleware or island | Code paths that hold the API token |
| Zone configuration → edge responses | Transform Rule on `915tldr.com` sets `X-Robots-Tag: noindex` on the two non-production hosts | Indexing policy |
| Two repos sharing one zone | v1 Nuxt (`915tldr.com2`) and v2 Astro (`915tldr.com`) both deploy Workers to hostnames on `915tldr.com` | Route and Custom Domain bindings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering / EoP | `wrangler.jsonc` | high | mitigate | No `d1_databases` block; `tools/check-config-guards.mjs` fails on one in the source file and in the generated `dist/client/wrangler.json`; runs before `build` and `deploy` (commit 7821c06) | closed |
| T-03-02a (03-04) | Information Disclosure | Cloudflare API token | high | mitigate | Every token-reading module lives in `src/lib/server/`; `tools/assert-no-d1.mjs` rejects any public entrypoint reaching that directory; KV page and island fixtures (Cases 5–6) fail the build (commit 7763b96) | closed |
| T-03-02b (03-01) | Information Disclosure | `src/lib/server/d1-client.ts` → Vite bundle | high | mitigate | Token read from `process.env` only, used only in the Authorization header, absent from error text; `dist/client` contains no token, `Bearer`, or REST path | closed |
| T-03-03a (03-01) | Information Disclosure | build logs / committed files | high | mitigate | `.dev.vars`/`.env` gitignored and never in history; live token value appears 0 times across all branches | closed |
| T-03-03b (03-05) | Tampering (of policy) | Transform Rule on `915tldr.com` | high | mitigate | Rule definition recorded in `docs/phase-03/edge-config.md` with recreation steps; `pnpm verify:edge` re-proves it live | closed |
| T-03-04 | Tampering | `tools/assert-no-d1.mjs` matcher | high | mitigate | Cumulative zero-candidate guard via exit handler; non-vacuity Case 4 | closed |
| T-03-05 | Tampering | guard false-negative on comments | medium | mitigate | Comment stripping in `check-config-guards.mjs`; live vs comment-only tests | closed |
| T-03-06 | Spoofing (of assurance) | `tests/ci-fixtures/` | medium | mitigate | Clean control Case 3, shown causal by a reject-everything inversion | closed |
| T-03-07 | Spoofing / Repudiation | `src/lib/build-info.ts` | high | mitigate | CI sha first, git refused under CI, explicit `unknown`; `hashSource` published | closed |
| T-03-08 | Information Disclosure | `/version.json` | low | accept | See Accepted Risks | closed |
| T-03-09 | Tampering | `Base.astro` footer | medium | accept | See Accepted Risks | closed |
| T-03-10 | Tampering (of state) | `src/lib/server/kv-manifest.ts` | high | mitigate | Validation before any network call; tests assert zero requests on invalid input | closed |
| T-03-11 | DoS (budget) | `putManifestEntriesBulk` | medium | mitigate | 10,000-pair batching; 25,000 entries → exactly 3 requests (tested) | closed |
| T-03-12 | Repudiation | manifest entries | medium | accept | See Accepted Risks | closed |
| T-03-13 | EoP (route hijack) | `wrangler.jsonc` routes | high | mitigate | Exact-hostname binding, no wildcard; live bindings verified; v1 dev deploy script repointed to `admin-dev` (see Residuals) | closed |
| T-03-14 | Information Disclosure | `dev.915tldr.com` | medium | accept | See Accepted Risks | closed |
| T-03-15 | Spoofing (of assurance) | `tools/verify-edge-headers.mjs` | medium | mitigate | Live article discovery, self-loaded `.dev.vars`, production negative control; inversion exits 1 | closed |
| T-03-16 | DoS (self-inflicted) | `tools/cpu-ceiling-probe/` | high | mitigate | Probe Worker deleted, confirmed absent in account listing; no bindings in probe config | closed |
| T-03-17 | DoS (budget) | `tools/measure-d1-pagination.mjs` | medium | mitigate | Dry run by default; `--execute` required; budget comparison in report | closed |
| T-03-18 | Tampering | production D1 and production cron Worker | high | mitigate | Measurement tools issue SELECT only; production `915tldr` last deployed 2026-09-19, before execution began | closed |
| T-03-19 | Information Disclosure | measurement report files | high | mitigate | No `Bearer`/`Authorization` values in reports; only `$CLOUDFLARE_API_TOKEN` references | closed |
| T-03-20 | Spoofing (of assurance) | reported measurements | medium | mitigate | Tools throw and exit 1 on API failure; no report written on failure (forced-failure test) | closed |
| T-03-21 | Repudiation / Tampering (of record) | `.planning/STATE.md` | medium | mitigate | Scoped edits only (commit 7692ad2); decision log and metrics intact | closed |
| T-03-22 | Spoofing (of assurance) | `docs/phase-03/render-step-location.md` | medium | mitigate | Every figure cites its `measurements.md` section; numeric reopen threshold recorded | closed |
| T-03-23 | Repudiation | STATE.md's 300-second figure | medium | mitigate | Corrected to the measured 902,000 ms with the reason recorded | closed |
| T-03-SC | Tampering (supply chain) | npm dependencies | high | mitigate | Package-legitimacy gate in 03-01; human approval recorded; versions pinned; wrangler 4.136.3 deviation human-approved | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above high count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-08 | `/version.json` exposes only the short commit hash, build time and hash source. No secret, no internal path. Rationale in 03-03's threat model. | Plan 03-03 (owner-approved plan) | 2026-09-22 |
| AR-03-02 | T-03-09 | The footer stamp could be altered by someone with repo write access, but that attacker already controls the whole site. The cross-surface test reads built output, so a desync is caught. Rationale in 03-03's threat model. | Plan 03-03 (owner-approved plan) | 2026-09-22 |
| AR-03-03 | T-03-12 | Manifest entries carry no signature; anyone with KV write can alter one. Scope and limits documented in `docs/phase-03/render-manifest.md` "What this does not guarantee". | Plan 03-04 (owner-approved plan) | 2026-09-22 |
| AR-03-04 | T-03-14 | `dev.915tldr.com` is public. It serves published articles only, with no user data and no auth surface, and is noindexed at the edge. | Plan 03-05 (owner-approved plan) | 2026-09-22 |

---

## Residuals and Follow-ups (non-blocking)

- **Nuxt repo not yet committed.** `915tldr.com2` on `develop` holds three uncommitted changes that finish the hostname move: `scripts/prepare-dev-wrangler.mjs` (route → `admin-dev.915tldr.com/*`), `wrangler.dev.jsonc`, `README.md`. Until committed, a `pnpm deploy:dev` from another checkout would recreate a `dev.915tldr.com/*` zone route and take the host back from v2. Owner action.
- **`admin-dev.915tldr.com` has no threat entry.** It serves the v1 Nuxt admin/pipeline app since 03-05. AR-03-04 covers `dev.915tldr.com` only. That host's Better Auth `trustedOrigins` (`915tldr.com2/server/lib/auth.ts`) does not list `admin-dev.915tldr.com`. Phase 12 replaces Better Auth with Cloudflare Access; until then, register the host in that phase's threat model.
- **The page exemption in the D1-import guard fails open.** A page counts as prerendered unless it contains the literal text `export const prerender = false`. A page made on-demand some other way would not be checked. Documented in the guard's header; to be revisited when Phase 4 adds on-demand routes.
- **CPU probe can be redeployed.** `pnpm measure:cpu deploy` would bring back a 2-hourly CPU burner; removal depends on running `delete`.
- **Register hygiene.** T-03-02 and T-03-03 were each used for two different threats (split a/b above). T-03-01 and T-03-04 were declared in both 03-01 and 03-02, and the two T-03-01 texts disagreed. No SUMMARY carried a `## Threat Flags` section. Future plans should allocate IDs from one phase-wide sequence.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-26 | 26 | 25 | 1 (T-03-02a, high) | gsd-security-auditor |
| 2026-09-26 | 26 | 26 | 0 | orchestrator, after remediation commits 7763b96 and 7821c06 (6/6 build-gate, inversion proven) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-26

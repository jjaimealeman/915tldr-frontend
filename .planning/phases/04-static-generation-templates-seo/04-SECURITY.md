---
phase: 04
slug: static-generation-templates-seo
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-09-30
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (04-01 … 04-12 `<threat_model>` blocks). Verified at ASVS L1
> (grep/evidence depth) on 2026-09-30.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Build → Cloudflare D1/KV REST | Credentialed build-time calls | API token (secret); article rows; render manifest |
| D1 row content → static HTML / JSON-LD / XML | AI-generated titles and summaries from scraped RSS | Untrusted text |
| D1 `url` → outbound link href | Original article URL from the outlet's feed | Untrusted URL |
| D1 slugs → output file names / KV keys | A slug becomes a path | Untrusted identifiers |
| KV `build:last-good` → build decisions | Stored state that gates whether a build may ship | Build integrity state |
| Internet → Worker (asset misses only) | Fully untrusted request path and query | Request URL |
| Requested URL → 404 page script | Path tokens rendered next to titles | Untrusted path |
| npm registry → project dependencies | New third-party code enters the build | Supply chain |
| Build → live v1 `changelog.json` | Network fetch of a public file | Owner-authored public text |
| CI environment → ntfy | Failure text leaves the build container | Build logs (may contain secrets) |
| GitHub (public repo) → Workers Builds | Public source triggers credentialed builds | Source code; build token in env |
| Backend cron → Deploy Hook | Secret URL used from the production pipeline Worker (`915tldr.com2`) | Bearer-style URL |
| Test runner / local deploy → dev.915tldr.com | Read-only tests; credentialed owner deploy | Noindexed dev host |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | d1-client.ts / kv-manifest.ts errors | high | mitigate | Errors carry status + D1/KV response text only (`d1-client.ts:86,93`); token read from env, never interpolated | closed |
| T-04-02 | Tampering | Stored slug in URL path | medium | mitigate | `ARTICLE_SLUG_RE = /^[a-z0-9-]{1,100}$/` (`article-url.ts:14`); `validateManifestEntry` (`kv-manifest.ts:177`) | closed |
| T-04-03 | Tampering | Title/summary rendered into HTML | medium | mitigate | Astro default escaping; no stray `set:html` (only JSON-LD + validated summary body) | closed |
| T-04-04 | Elevation of Privilege | D1 reachable from a public entrypoint | high | mitigate | No `prerender = false` anywhere in `src/`; `test:build-gate` runs inside `build` (`package.json:45`) | closed |
| T-04-05 | Tampering | `toSafeJsonLd` | high | mitigate | Escapes `<`, U+2028, U+2029 after stringify (`structured-data.ts:36-44`); `tests/unit/structured-data.test.mjs` | closed |
| T-04-06 | Tampering | ArticleCard/Base text and attributes | medium | mitigate | `set:html` in `Base.astro:105-107` used solely for `toSafeJsonLd` output | closed |
| T-04-07 | Information Disclosure | build-info.ts git calls | low | accept | See Accepted Risks AR-04-01 | closed |
| T-04-08 | Spoofing | Canonical link | low | mitigate | `new URL(canonicalPath, Astro.site)` (`Base.astro:73`); pages prerendered, no request data | closed |
| T-04-09 | Denial of Service | Loader D1 query cost | high | mitigate | `WARM/SWEEP/COLD_ROWS_READ_BUDGET` (`articles-loader.ts:89-100`) fail the build before store mutation; `rows_read` required (`d1-client.ts:96-99`) | closed |
| T-04-10 | Tampering | `build:last-good` state | medium | mitigate | `validateLastGoodShape` (`build-state.ts:72`); commit only from validated pending file | closed |
| T-04-11 | Repudiation | Silent article loss | high | mitigate | `evaluateShrink` before mutation; `ALLOWED_ARTICLE_SHRINK` explicit (`articles-loader.ts:290-298`); zero rows always fails | closed |
| T-04-12 | Information Disclosure | build-state.ts / kv-manifest.ts errors | medium | mitigate | Status + body only; "never logged" convention (`build-state.ts:11`) | closed |
| T-04-13 | Elevation of Privilege | Credentialed module reachable from public code | high | mitigate | Both modules under `src/lib/server/`, guarded by `tools/assert-no-d1.mjs` + `tests/ci-fixtures/` | closed |
| T-04-14 | Tampering | summaryBodyHtml → `set:html` | high | mitigate | Closed block contract + `validateBlocks` (`summary.ts:122`); `tests/unit/summary.test.mjs` | closed |
| T-04-15 | Tampering | Outbound `href={article.url}` | medium | mitigate | `z.url({ protocol: /^https?$/ })` (`articles-loader.ts:111`); article-markup test | closed |
| T-04-16 | Tampering | JSON-LD headline/description | high | mitigate | Every `ld+json` script goes through `toSafeJsonLd` (`Base.astro:105-107`) | closed |
| T-04-17 | Spoofing | Misattributed reporting | medium | mitigate | Single source row; `tests/unit/article-markup.test.mjs` asserts agreement | closed |
| T-04-18 | Tampering | Tag/source slug as file path | medium | mitigate | `CATEGORY/TAG/SOURCE_SLUG_RE = /^[a-z0-9-]+$/` (`article-url.ts:17-32`); source guard added in 04-followups | closed |
| T-04-19 | Tampering | Listing text rendering | low | mitigate | No `set:html` in listing pages | closed |
| T-04-20 | Denial of Service | File count vs 100,000 asset ceiling | medium | accept | See Accepted Risks AR-04-02 | closed |
| T-04-21 | Elevation of Privilege | D1 reachable from public routes | high | mitigate | All pages prerendered via `getCollection`; build gate green | closed |
| T-04-22 | Spoofing / Tampering | Worker 301 Location (open redirect) | high | mitigate | `location` built only by `articlePath` from validated manifest fields (`article-redirect.ts:68-104`); `worker.ts:65` appends only `url.search`; `tests/unit/article-redirect.test.mjs` | closed |
| T-04-23 | Tampering | Worker uuid parsing | medium | mitigate | `decodeURIComponent` in try/catch, strict UUID match, lowercased (`article-redirect.ts:25-40`) | closed |
| T-04-24 | Denial of Service | Worker CPU / KV on garbage URLs | medium | mitigate | No uuid → no KV read; one KV read max; GET/HEAD only (`worker.ts:31`) | closed |
| T-04-25 | Tampering | 404 suggestion rendering (XSS) | high | mitigate | `createElement`/`setAttribute`/`textContent` only (`404.astro:155-158`); `tests/unit/not-found.test.mjs` | closed |
| T-04-26 | Elevation of Privilege | Worker reaching credentialed modules | high | mitigate | `src/worker.ts` in `ENTRYPOINT_EXACT_FILES`; `worker-with-kv-import.ts` fixture proves rejection | closed |
| T-04-27 | Information Disclosure | Worker logs | low | mitigate | `console.error` without headers/cookies (`worker.ts:50-51`) | closed |
| T-04-SC | Tampering | npm installs (@astrojs/rss, @astrojs/sitemap) | high | mitigate | Blocking human checkpoint approved (04-07-SUMMARY Task 1); exact pins `4.0.19` / `3.7.4` (`package.json:55-56`); lockfile committed | closed |
| T-04-28 | Tampering | News sitemap / RSS XML injection | medium | mitigate | `escapeXml` (`seo-feeds.ts:20,70-71`); `tests/unit/news-sitemap.test.mjs` | closed |
| T-04-29 | Information Disclosure | robots.txt policy drift | medium | mitigate | `seo-surfaces.test.mjs:36` matches the v1 fixture line for line except Sitemap lines. 04-07 threat flag (policy goes from fully open to blocking AI crawlers) is an owner decision recorded 2026-09-27 | closed |
| T-04-30 | Elevation of Privilege | Feed endpoints reaching D1 | high | mitigate | Endpoints prerendered, `getCollection` only (`rss.xml.ts:14`, `news-sitemap.xml.ts:7`) | closed |
| T-04-31 | Denial of Service | Changelog fetch outage | medium | mitigate | Fetch failure / invalid JSON / shrink throws (`changelog-loader.ts:145-156`); `tests/regression/changelog-empty-state.test.mjs` | closed |
| T-04-32 | Tampering | changelog.json content | low | mitigate | Schema validation; Astro escaping, no `set:html` | closed |
| T-04-33 | Spoofing | `V1_CHANGELOG_URL` override | low | accept | See Accepted Risks AR-04-03 | closed |
| T-04-34 | Repudiation | Contact form silently discarding messages | medium | mitigate | `<fieldset disabled>` until Phase 10 (`contact.astro:107`) | closed |
| T-04-35 | Information Disclosure | ntfy notification body | high | mitigate | `redact()` named values + 40+ char token-shaped runs (`ci-build.mjs:39-61`); `tests/unit/ci-build.test.mjs` | closed |
| T-04-36 | Information Disclosure | NTFY_TOPIC / tokens in repo | high | mitigate | `.dev.vars` and `.env` gitignored (`.gitignore:14-15`); no topic URL or token literal in tracked files (git grep 2026-09-30) | closed |
| T-04-37 | Tampering | Preview builds advancing last-good | medium | mitigate | Only `deploy:ci` reaches `commitLastGood` (`ci-build.mjs:197-200`); non-production builds run `wrangler versions upload` | closed |
| T-04-38 | Repudiation | Silent build failure | high | mitigate | Refuses to run with `WORKERS_CI` set and no `NTFY_TOPIC` (`ci-build.mjs:282-284`); 18-min watchdog ahead of 20-min limit | closed |
| T-04-39 | Information Disclosure | Public repo contents | high | mitigate | Credential-pattern git grep clean (2026-09-30); `.dev.vars`/`.env` gitignored | closed |
| T-04-40 | Spoofing / DoS | Deploy Hook URL disclosure | medium | mitigate | No real `deploy_hooks/` URL in either repo (only `super-secret-hook` test placeholder in `915tldr.com2`); stored as wrangler secret | closed |
| T-04-41 | Elevation of Privilege | Build token scope | medium | mitigate | `docs/phase-04/workers-builds-setup.md` §4 has owner confirm D1 Read + KV Edit on the platform-injected token, and step 4 (added 2026-09-30) says not to broaden beyond Workers deploy / D1 Read / KV Edit | closed |
| T-04-42 | Tampering | Fork PRs triggering builds | medium | accept | See Accepted Risks AR-04-05. Planned mitigation ("leave fork builds disabled") references a dashboard control that does not exist | closed |
| T-04-43 | Information Disclosure | Deploy Hook URL in backend logs | medium | mitigate | `triggerFrontendBuild` never logs URL; tests assert `not.toContain(HOOK_URL)` (`915tldr.com2/server/utils/frontend-deploy-hook.ts`) | closed |
| T-04-44 | Denial of Service | Ingest failing because of the frontend | high | mitigate | Never throws, returns discriminated result; 10 s `AbortController` timeout (`frontend-deploy-hook.ts:12-86`) | closed |
| T-04-45 | Denial of Service | Build storms | low | accept | See Accepted Risks AR-04-04 | closed |
| T-04-46 | Tampering | Incremental reuse serving stale pages | medium | mitigate | `cacheKey` + `railFingerprint` (`rail.ts:76`); `tests/regression/byte-identity.test.mjs` | closed |
| T-04-47 | Information Disclosure | Deploying to dev.915tldr.com | medium | mitigate | `pnpm run verify:edge` re-proves noindex header + `workers_dev: false` (`tools/verify-edge-headers.mjs`) | closed |
| T-04-48 | Tampering | Stale deploy verified by mistake | low | mitigate | `url-shapes.test.mjs:123` asserts `/version.json` commit = local HEAD | closed |
| T-04-49 | Information Disclosure | Screenshots / logs with secrets | low | mitigate | Screenshots in session scratchpad; tests print URLs + status codes only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-07 | Only a commit hash and date are exposed, both public by design (OPS-05/06) | Plan 04-02 (owner-approved plan) | 2026-09-30 |
| AR-04-02 | T-04-20 | ~60k files at today's corpus against a 100,000 ceiling; Phase 5 adds tag tiering and the 80,000-file guard (REND-10) | Plan 04-05 (owner-approved plan) | 2026-09-30 |
| AR-04-03 | T-04-33 | Build-environment variable controlled by the owner only (Workers Builds settings / local shell) | Plan 04-08 (owner-approved plan) | 2026-09-30 |
| AR-04-04 | T-04-45 | At most one POST per 2-hourly run; Cloudflare dedupes queued hook builds and rate-limits to 10/min per Worker | Plan 04-11 (owner-approved plan) | 2026-09-30 |
| AR-04-05 | T-04-42 | Workers Builds Branch control has no fork toggle (owner screenshot 2026-09-30: production branch `main`, non-production builds on, nothing else). Per Cloudflare docs, builds trigger on pushes to the connected repo; fork PR commits are pushed to the contributor's fork, so fork PRs very likely do not build (inference, not stated by Cloudflare). Worst case is bounded: a non-production build runs `wrangler versions upload`, cannot deploy production, and cannot advance last-good (T-04-37). **Reminder:** before `main` goes live, open one throwaway fork PR and confirm no build appears in the Worker's build history. | Jaime Aleman | 2026-09-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-30 | 50 | 50 | 0 | /gsd-secure-phase (orchestrator, ASVS L1 grep-depth; auditor short-circuited per workflow rule) |

### Security Audit 2026-09-30
| Metric | Count |
|--------|-------|
| Threats found | 50 (46 mitigate, 4 accept at plan time) |
| Closed | 50 (45 mitigated with evidence, 5 accepted) |
| Open | 0 |

SUMMARY threat flags incorporated: 04-07 `policy-change` on `public/robots.txt` → T-04-29 (owner decision 2026-09-27).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-30

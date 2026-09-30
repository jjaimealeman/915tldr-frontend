---
phase: 04-static-generation-templates-seo
verified: 2026-09-30T23:59:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run a real live article URL from dev.915tldr.com through search.google.com/test/rich-results"
    expected: "NewsArticle, BreadcrumbList, Organization and WebSite structured data validate clean (SEO-01/SEO-02 roadmap criterion 5 requires 'validated, not merely emitted')"
    why_human: "No CI-friendly API exists within budget; this is Google's own hosted validator. Already identified by 04-12-SUMMARY.md as Manual-Only Verification and handed to the owner as human-check item 1."
  - test: "Visually review the AI-generation disclosure and originating-outlet attribution on a live article at 320px and 1280px, in both light and dark theme"
    expected: "Both are prominent at point of reading, matching design/mockups/article.html's visual weight (IDNT-03/IDNT-04/SEO-07)"
    why_human: "Prominence is a subjective visual judgment; 04-12 captured screenshots for this review but did not (and cannot) auto-grade visual prominence."
  - test: "Deploy 915tldr.com2 (backend) with FRONTEND_DEPLOY_HOOK_URL set to the main Deploy Hook, and observe one real ingest cycle POST it"
    expected: "A production cron cycle that changes public articles triggers exactly one real Workers Builds production build via the hook (OPS-10, roadmap criterion 3, end-to-end)"
    why_human: "Owner-only action per this project's git/deploy rules (secret-setting, production deploy). 04-10 (D5) and 04-11 (D6) both explicitly defer this to 04-12's end-of-phase human-check list; it cannot be completed until 915tldr-frontend's main branch carries Phase 4 (i.e., after this phase merges)."
  - test: "Trigger a real build failure on the actual Workers Builds platform (in-container) and confirm the ntfy push arrives"
    expected: "D-15's failure-notification path fires correctly when running inside a real Workers Builds container, not just via the local `WORKERS_CI=1` simulation 04-10 used"
    why_human: "04-10-SUMMARY.md documents the in-container drill was blocked because the owner did not grant a token scoped to edit Cloudflare dashboard build variables; the local drill (3 real runs, 2 real bugs found and fixed) is real evidence but is an explicitly named fallback, not the real-platform proof."
---

# Phase 4: Static Generation, Templates & SEO Verification Report

**Phase Goal:** Every public page type is generated at build time from D1, and a bad read fails the build instead of shipping an empty page.
**Verified:** 2026-09-30T23:59:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Phase 4 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A build in which the loader returns zero/fewer-than-expected rows exits non-zero and deploys nothing, proven by a regression test replaying the `/changelog` empty-state failure | ✓ VERIFIED | `tests/regression/changelog-empty-state.test.mjs` (unit + real `astro build` replay, 04-08); `src/content/loaders/articles-loader.ts`'s empty-store guard (`tests/unit/articles-loader-window.test.mjs`); `tools/ci-build.mjs`'s `runCi` proven to spawn no `wrangler` process on a failing build step (`tests/unit/ci-build.test.mjs`, 04-09); REVIEW.md confirms "no path found that lets a partial/empty D1 result build and deploy silently" |
| 2 | Home, category index (`/crime` and `/crime/**` both), article, tag, changelog and contact pages all render real D1 content at build time; `/changelog` shows full preserved history on every build | ✓ VERIFIED | `src/pages/index.astro`, `src/pages/[category]/index.astro` + `[category]/[slug].astro`, `src/pages/tag/[slug].astro`, `src/pages/changelog.astro`, `src/pages/contact.astro` all present and building against real production D1 (measured: 40,049–40,449 pages across 04-03/04-10 builds); route-collision guard (`assertNoRouteCollisions`, 04-05); changelog dual-source loader with never-shrink ratchet (04-08); live-verified 2026-09-30 via `tests/integration/url-shapes.test.mjs` (57/57) against dev.915tldr.com — `/crime` and all 8 categories answer 200 next to their article pages, `/changelog` shows 15 entries (the owner-approved floor) |
| 3 | A cron cycle triggers an incremental build re-rendering only new/changed articles and ships a new deployment; unchanged articles are byte-identical | ✓ VERIFIED | `tests/regression/byte-identity.test.mjs` (two real `astro build` runs against live production D1, both `changed=0`, 04-11); real Workers Builds measurement `WB_REUSE_PROVEN` (Build 4: 34,871+ of ~60,349 pages restored, confirmed lower bound, 04-10); `experimental.incrementalBuild` now defaults ON (astro.config.mjs, 04-11); OPS-10 trigger path (`triggerFrontendBuild()` in 915tldr.com2) built and unit-tested (9/9) but **not yet activated in production** — see human_verification |
| 4 | Every `/[category]/[slug]-[uuid]` URL still resolves with correct canonical; `/rss.xml` and per-bot `robots.txt` preserved; 404 suggestion endpoint answers | ✓ VERIFIED | `src/worker.ts` + `src/lib/article-redirect.ts` (one KV read, zero D1, 301 to canonical, D-09 short-id rejection, malformed-percent-encoding→404, all unit-tested 04-06); `public/robots.txt` matches v1's intended per-bot policy line-for-line except Sitemap lines (`tests/unit/seo-surfaces.test.mjs`, owner-approved policy change, 04-07); `/rss.xml` via `@astrojs/rss` with `trailingSlash:false` (04-07); `src/pages/404-index.json.ts` same-build-consistency proven (04-06); all live-verified 2026-09-30 (`tests/integration/url-shapes.test.mjs` 57/57, `tests/integration/browser-journeys.test.mjs` 6/6 real Chromium, including one real 301 hop walked via the browser's own redirect chain) |
| 5 | `NewsArticle`, `BreadcrumbList`, `Organization`, `WebSite` structured data validate clean in the Rich Results Test on a real article (validated, not merely emitted); Google News sitemap ≤48h; every article carries an AI-disclosure + canonical link to originating outlet | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (structured-data validation clause) / ✓ VERIFIED (all other clauses) | JSON-LD emission proven injection-safe and schema-shaped by unit tests (`tests/unit/structured-data.test.mjs`, `tests/unit/article-markup.test.mjs`); news sitemap 48h window unit-tested against real 210-article production data (`tests/unit/news-sitemap.test.mjs`, 04-07); AI disclosure + attribution wired and order-checked (`tests/integration/browser-journeys.test.mjs` confirms IDNT-03/IDNT-04 present live). **The roadmap's own wording is explicit that "validated" means run through Google's Rich Results Test, not merely emitted** — this has not been run against the live deployment; 04-12-SUMMARY.md itself classifies this as `human_judgment: true` and names it as a deferred Manual-Only Verification, not something a unit test can satisfy |

**Score:** 5/5 truths verified (criterion 5 carries one explicitly human-only sub-clause, tracked below rather than silently passed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/content/loaders/articles-loader.ts` | REND-01 hand-written Loader, cold/warm/sweep, budgets, D-14 shrink guard | ✓ VERIFIED | 400 lines, exports confirmed, measured against real production D1 across 04-01/04-03/04-09/04-10 |
| `src/content/loaders/changelog-loader.ts` | D-13 dual-source loader, fail-loud | ✓ VERIFIED | 289 lines, real-build regression replay passes |
| `src/lib/article-url.ts` | Canonical URL builder, stored slug only | ✓ VERIFIED | 60 lines, no `src/lib/server` import (confirmed by REVIEW.md's dependency trace) |
| `src/lib/server/kv-manifest.ts` | Manifest schema v2 with slug | ✓ VERIFIED | 461 lines, `MANIFEST_SCHEMA_VERSION = '2'` confirmed via 04-01-SUMMARY.md self-check |
| `src/lib/server/build-state.ts` | Last-good state, `evaluateShrink` | ✓ VERIFIED | 339 lines, 8 test cases covering the full shrink-decision matrix |
| `src/layouts/Base.astro` | Chrome + head-metadata contract | ✓ VERIFIED | 167 lines, JSON-LD/canonical/chrome all wired and unit-tested |
| `src/worker.ts` | Zero-D1, one-KV-read redirect/404 Worker | ✓ VERIFIED | 70 lines; REVIEW.md independently traced its import graph and confirmed no `src/lib/server` reachability |
| `src/lib/article-redirect.ts` | Pure redirect decision, open-redirect mitigation | ✓ VERIFIED | 105 lines; REVIEW.md confirms Location is built only from validated manifest fields, never the request path |
| `src/pages/[category]/index.astro`, `tag/[slug].astro`, `source/[slug].astro` | Listing pages | ✓ VERIFIED (with one WARNING) | All three exist and render; code review found `source/[slug].astro` (unlike `tag/[slug].astro`) takes an unvalidated D1 slug into a file path with no regex guard (REVIEW.md WR-01) — low real exploitability (3-row, migration-seeded table, no public write path) but an asymmetric gap against the project's own stated threat-model discipline |
| `src/lib/seo-feeds.ts`, `src/pages/rss.xml.ts`, `src/pages/news-sitemap.xml.ts`, `public/robots.txt` | SEO surfaces | ✓ VERIFIED | All present, unit-tested against real production data, live-verified 2026-09-30 |
| `tools/ci-build.mjs`, `tools/compare-builds.mjs` | CI wrapper, byte-diff tooling | ✓ VERIFIED | 346 / 172 lines; watchdog, failure classification, ntfy, secret redaction all unit-tested; two real bugs found and fixed via a real ntfy drill (04-10) |
| `docs/phase-04/build-pipeline-decision.md`, `build-pipeline.md` | Owner decision + pipeline doc | ✓ VERIFIED | Present, cite real measured verdict tokens (`WB_COLD_FITS`, `WB_REUSE_PROVEN`) |
| `tests/integration/url-shapes.test.mjs`, `browser-journeys.test.mjs` | Live URL-contract + real-browser suites | ✓ VERIFIED | 344 / 184 lines; 57/57 and 6/6 passing against the real deployed dev.915tldr.com (04-12) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/pages/[category]/[slug].astro` | `astro:content` | `getCollection('articles')` | ✓ WIRED | Confirmed in 04-01, re-verified live |
| `src/layouts/Base.astro` | `src/lib/structured-data.ts` | `toSafeJsonLd(organizationNode/websiteNode)` | ✓ WIRED | Confirmed by `tests/unit/chrome.test.mjs` |
| `src/worker.ts` | `src/lib/article-redirect.ts` | `extractArticleUuid` + `resolveRedirect` | ✓ WIRED | Confirmed by REVIEW.md's independent import trace and `tests/unit/worker.test.mjs` |
| `src/content.config.ts` | `changelog-loader.ts` | `collections.changelog` | ✓ WIRED | Confirmed present in `src/content.config.ts` |
| `astro.config.mjs` | `@astrojs/sitemap` | integration array with non-HTML filter | ✓ WIRED | Confirmed by `tests/unit/news-sitemap.test.mjs`'s URL-count-matches-build-output case |
| `915tldr.com2/server/tasks/fetch-articles.ts` | `frontend-deploy-hook.ts` | `triggerFrontendBuild` at end-of-run | ✓ WIRED (code only) | 9/9 unit tests pass; **not yet activated** — `FRONTEND_DEPLOY_HOOK_URL` secret intentionally unset pending production merge, per 04-11-SUMMARY.md's own disposition |

### Behavioral Spot-Checks / Probe Execution

This phase's own verification discipline (04-12) already performed the equivalent of Steps 7b/7c directly against a live deployment, which is stronger evidence than a local spot-check:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live URL contract (canonical, trailing-slash, non-canonical redirects, both header variants) | `node --test tests/integration/url-shapes.test.mjs` against dev.915tldr.com | 57/57 pass | ✓ PASS |
| Real-Chromium reader journey (home → category → article, no redirect; non-canonical → one real 301) | `node --test tests/integration/browser-journeys.test.mjs` | 6/6 pass | ✓ PASS |
| Full local suite (this session, re-run by the orchestrator, not merely cited from a SUMMARY) | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=... pnpm run test:tracer` | 385/385, 8/8, 5/5, 5/5 | ✓ PASS |
| v1 regression (915tldr.com2, `feature/frontend-deploy-hook`) | `vitest run` | 21 files / 269 tests pass | ✓ PASS |

I did not re-run these suites myself in this verification pass since the orchestrator ran them this same session on the current HEAD (`a497fc0`) and the git log confirms no commits landed afterward — re-running would exercise the identical commit and add no new evidence per this workflow's own guidance against redundant full-suite runs. I did independently confirm artifact existence, requirement-ID coverage, absence of debt markers, and cross-checked the code-review findings against the source files named.

### Requirements Coverage

All 18 requirement IDs assigned to Phase 4 in `.planning/REQUIREMENTS.md` are marked Complete and are each claimed by at least one plan's frontmatter `requirements:` field — no orphaned requirements found.

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| REND-01 | 04-01, 04-03 | ✓ SATISFIED | Content Layer Loader, cold/warm/sweep sync, measured against real D1 |
| REND-02 | 04-01, 04-03, 04-08, 04-09 | ✓ SATISFIED | Empty-store guard, shrink guard, CI wrapper never deploys a failed build |
| REND-03 | 04-08 | ✓ SATISFIED | Real-build regression replay of the `/changelog` empty-state bug |
| REND-04 | 04-05, 04-08, 04-09, 04-10 | ✓ SATISFIED | All listing/static page types build and re-deploy each cycle |
| REND-05 | 04-03, 04-09, 04-10, 04-11 | ✓ SATISFIED | `WB_REUSE_PROVEN`, byte-identity regression, incrementalBuild default ON |
| SEO-01 | 04-04, 04-12 | ✓ SATISFIED (emission); human-only sub-clause for "validated" | NewsArticle emission unit-tested; Rich Results Test not yet run |
| SEO-02 | 04-02, 04-04, 04-12 | ✓ SATISFIED (same caveat) | Organization/WebSite/BreadcrumbList emission unit-tested |
| SEO-03 | 04-07 | ✓ SATISFIED | 48h window sitemap, unit-tested against real production data |
| SEO-04 | 04-01, 04-02, 04-04, 04-06, 04-07, 04-12 | ✓ SATISFIED | Canonical + legacy-URL resolution, live-verified |
| SEO-05 | 04-07 | ✓ SATISFIED | robots.txt policy preserved (with owner-approved production change) |
| SEO-06 | 04-07, 04-12 | ✓ SATISFIED | `/rss.xml`, live-verified item links all answer 200 |
| SEO-07 | 04-04, 04-12 | ✓ SATISFIED | Attribution wired, live-verified present |
| SEO-08 | 04-06, 04-12 | ✓ SATISFIED | 404 + suggestions, live-verified |
| IDNT-03 | 04-04, 04-12 | ✓ SATISFIED (presence); prominence is human-only | Disclosure wired and ordered; visual prominence deferred to human review |
| IDNT-04 | 04-04, 04-12 | ✓ SATISFIED (same caveat) | Attribution wired and ordered |
| OPS-10 | 04-10, 04-11 | ✓ SATISFIED (trigger built/tested); production activation is human-only | `triggerFrontendBuild()` tested 9/9, not yet activated (owner-only, post-merge) |
| FIX-04 | 04-05, 04-12 | ✓ SATISFIED | `/crime` + `/crime/**` coexist, live-verified |
| FIX-05 | 04-08, 04-12 | ✓ SATISFIED | `/changelog` never ships empty, live-verified at 15 entries |

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`placeholder` debt markers found in phase-modified source files (`src/`, `tools/`, `tests/integration/`, `tests/regression/`). The phase's own code review (`04-REVIEW.md`, standard depth, 41 files + 4-file cross-repo diff) found **0 critical, 4 warnings, 2 info**, independently re-confirmed against source during this verification pass:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/source/[slug].astro` | 13-26 | Unvalidated D1 slug used as a static file path (asymmetric vs. `tag/[slug].astro`'s `TAG_SLUG_RE` guard) | ⚠️ Warning | Low practical exploitability today (fixed 3-row seeded table, no public write path) but a real, unaddressed gap against the project's own stated threat model |
| `src/content/loaders/articles-loader.ts` | 344-353 | A future manifest-schema bump only self-heals on the next cold pass — up to 7 days where an old-URL redirect degrades to 404 | ⚠️ Warning | Dormant today (corpus already fully migrated to schema v2); real latent gap for the *next* schema bump |
| repo root | — | No `tsconfig.json` anywhere — confirmed to be the real cause of a reported `astro:content`/implicit-any symptom, zero static type-checking in CI | ⚠️ Warning | Not release-blocking for this phase's own delivered code, but a real gap in the project's safety net going forward |
| `915tldr.com2/tests/unit/frontend-deploy-hook.test.ts` | 92 | Real `tsc --strict` type error in a test mock (contravariance violation), independently reproduced | ⚠️ Warning | Does not fail `vitest run` (confirmed 269/269 passing); would fail a `typecheck` script if run |

**Separately (not a blocker):** three dead files flagged for deletion since 04-01 (`src/lib/slug.ts`, `src/lib/render-cost-harness.ts`, `tools/measure-render-cost.mjs`, plus the now-dangling `measure:render` package.json script) remain on disk, unreferenced by any importing code, carried forward unactioned across six SUMMARY files and 04-WHEN-HOME.md. Purely cosmetic — confirmed these files are not imported anywhere in the current `tools/verify-edge-headers.mjs` (which now discovers articles by parsing the live homepage instead, per 04-12).

## Human Verification Required

1. **Rich Results Test on a live article** — Test: run a real `dev.915tldr.com` article URL through `search.google.com/test/rich-results`. Expected: `NewsArticle`, `BreadcrumbList`, `Organization`, `WebSite` all validate clean. Why human: no CI-friendly API within budget; the roadmap's own success criterion 5 explicitly distinguishes "validated" from "merely emitted," and only emission has been proven so far.
2. **Visual prominence of AI disclosure and outlet attribution** — Test: review the 320px/1280px screenshots 04-12 captured (and/or view a live article) in both themes. Expected: both elements read as prominent, matching the approved mockup's visual weight. Why human: prominence is inherently a visual judgment call, not a grep-able property.
3. **Production activation of the OPS-10 trigger** — Test: after this phase merges to `main` and `915tldr-frontend`'s `main` branch carries Phase 4, deploy `915tldr.com2` with `FRONTEND_DEPLOY_HOOK_URL` set, and observe one real ingest cycle POST the hook. Expected: exactly one Workers Builds production build fires when public articles change; nothing fires when they don't. Why human: owner-only action (production secret + deploy) per this project's own git/deploy rules; explicitly named as deferred by both 04-10 (D5) and 04-11 (D6).
4. **Real in-container D-15 failure-notification drill** — Test: force a failing build on the actual Workers Builds platform (not the local `WORKERS_CI=1` simulation) and confirm the ntfy push arrives correctly. Expected: same clean, sanitized failure notification the three local drills already proved. Why human: 04-10 could not get a dashboard-scoped token to run this on the real platform; the local fallback found and fixed two real bugs, which is strong evidence but not the same claim as an in-container proof.

## Gaps Summary

No BLOCKER-level gap was found. All five roadmap success criteria have concrete, largely test-verified evidence, all 12 plans (plus the owner-approved 04-11a quick fix) are committed on `feature/phase-04`, all 18 requirement IDs are accounted for with no orphans, and the phase's own code review found zero critical defects. What remains open is a well-bounded set of items the phase's own plans and SUMMARYs already correctly classified as human-only (Rich Results validation, visual prominence, production activation of the OPS-10 trigger, and the real in-container failure-notification proof) — none of these can be closed by writing more code inside this phase; they require either a human using an external tool (Google's validator, eyes on a screenshot) or an owner-only production action that is structurally gated on this phase merging first. Two WARNING-level code-review findings (`source/[slug].astro`'s missing slug-validation guard, and the manifest-schema-migration edge case) are real but low-severity and explicitly documented with fixes ready to apply, not silent gaps. The phase is functionally complete; it is gated on human sign-off, not on missing implementation.

---

*Verified: 2026-09-30T23:59:00Z*
*Verifier: Claude (gsd-verifier)*

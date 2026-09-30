---
phase: 04-static-generation-templates-seo
plan: 12
subsystem: testing
tags: [live-verification, playwright, chromium, cloudflare-workers, seo, deploy]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "Every prior 04-plan's build artifact (Worker redirects, SEO surfaces, listing/article/static pages, changelog, the Workers Builds pipeline, the footer build-stamp fix) — this plan deploys and live-verifies all of it together for the first time"
provides:
  - "A deployed dev.915tldr.com carrying the full Phase 4 build (Version ID 2b16cdeb-9eb5-4930-bc68-d68fda98a26f)"
  - "tools/verify-edge-headers.mjs's live-article discovery rewritten to parse the deployed homepage instead of listing the entire KV render manifest (which never scaled past a handful of keys, per its own doc comment, and Phase 4 has now populated ~40k+)"
  - "tests/integration/url-shapes.test.mjs — 57-case live HTTP URL-contract suite (both navigation-header and plain-request variants) against the deployed site"
  - "tests/integration/browser-journeys.test.mjs — 6-case real-Chromium reader-journey suite against the deployed site, including a real redirect-chain proof and 320px/1280px screenshots for the owner's prominence review"
  - "04-VALIDATION.md fully filled: per-task verification map for all 12 plans, both Wave 0 spikes confirmed, wave_0_complete: true, nyquist_compliant: true"
affects: []

# Actuals (#2632)
actuals:
  tokens: 16122
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Live-site discovery by parsing the deployed page itself (homepage's first [data-card] link) rather than listing every key of a build-time store that was never designed to scale to the full corpus — the same 'ask the live host, don't trust stored bookkeeping' principle this project already established in tools/verify-edge-headers.mjs's earlier OPS-02 hardening."
    - "A browser-driven integration test (node:test + @playwright/test's chromium launcher directly, not @playwright/test's own runner) proves a redirect chain via the browser's own request.redirectedFrom() rather than a second fetch — the strongest available proof that what a real click experiences matches what a manual fetch reports."

key-files:
  created:
    - tests/integration/url-shapes.test.mjs
    - tests/integration/browser-journeys.test.mjs
  modified:
    - tools/verify-edge-headers.mjs
    - .planning/phases/04-static-generation-templates-seo/04-VALIDATION.md

key-decisions:
  - "verify-edge-headers.mjs's check 4 discovery mechanism replaced entirely: homepage-parsing instead of KV-manifest listing. No D1/KV credentials, no src/lib/slug.ts import, needed for discovery any more."
  - "tests/integration/url-shapes.test.mjs's /changelog assertion uses CHANGELOG_MIN_EXPECTED=15 (04-08's already owner-approved floor), not this plan's own must_haves text of 18 — the 18 figure predates 04-08's execution-time finding that v1's live changelog.json currently serves only 9 entries, not 12. Asserting 18 would make the test permanently fail against a correctly-behaving production."
  - "04-VALIDATION.md's wave_0_complete and nyquist_compliant both set to true: every task across all 12 plans in the phase has an automated verify, or is a documented owner-checkpoint immediately followed by one; no 3 consecutive tasks anywhere lack automated verification."

patterns-established:
  - "Live URL-contract tests always run both header variants (navigation vs. plain) — codifying the 04-06 navigation-header routing trap finding as a standing test pattern, not a one-off fix."

requirements-completed: [SEO-01, SEO-02, SEO-04, SEO-06, SEO-07, SEO-08, IDNT-03, IDNT-04, FIX-04, FIX-05, REND-04]

coverage:
  - id: D1
    description: "Every public URL contract (canonical article URLs, trailing-slash redirects, non-canonical/legacy-uuid redirects, 404s, category pages, legacy-route redirects, sitemap, robots.txt, news-sitemap window, changelog count) holds on the deployed site for both navigation and plain requests"
    requirement: "SEO-04"
    verification:
      - kind: e2e
        ref: "tests/integration/url-shapes.test.mjs (57/57 pass, both request-header variants, against dev.915tldr.com)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tools/verify-edge-headers.mjs finds a live article without listing the KV namespace, staying usable at ~40k manifest keys"
    requirement: "SEO-04"
    verification:
      - kind: other
        ref: "grep -c listManifestArticleIds tools/verify-edge-headers.mjs returns 0; pnpm run verify:edge 4/4 checks pass post-deploy"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real Chromium browser clicking home -> category -> article lands on the canonical URL with no redirect, and navigating to a non-canonical URL ends on the canonical after exactly one 301"
    requirement: "SEO-04"
    verification:
      - kind: e2e
        ref: "tests/integration/browser-journeys.test.mjs (6/6 pass, real Chromium, against dev.915tldr.com)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unknown-uuid path matching a recent story's title shows the 404 suggestions section, client-side, within 5 seconds"
    requirement: "SEO-08"
    verification:
      - kind: e2e
        ref: "tests/integration/browser-journeys.test.mjs#an unknown-uuid path matching a recent story's title shows 404 suggestions within 5s"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every /rss.xml item link sampled answers 200 directly; /crime and all 8 category indexes answer 200 live next to their article pages (FIX-04); /changelog shows at least the owner-approved floor of entries live (FIX-05)"
    requirement: "FIX-04, FIX-05"
    verification:
      - kind: e2e
        ref: "tests/integration/url-shapes.test.mjs (article-URL, category-page, and /changelog cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The live 404 page returns HTTP 404 with the styled page; /categories, /sources and /new answer 301 to /; /sitemap.xml answers 301 to /sitemap-index.xml"
    requirement: "SEO-08"
    verification:
      - kind: e2e
        ref: "tests/integration/url-shapes.test.mjs (404, legacy-route, and sitemap-redirect cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase 4's validation map is complete, Wave 0 spikes confirmed, and the phase is Nyquist-compliant"
    verification:
      - kind: other
        ref: "04-VALIDATION.md: wave_0_complete: true, nyquist_compliant: true; full suite (test:unit 385/385, test:build-gate 8/8, test:regression 5/5, live test:tracer 5/5) all green"
        status: pass
    human_judgment: false
  - id: D8
    description: "Structured data validates clean in Google's Rich Results Test on a live article; the AI disclosure and outlet attribution are visually prominent"
    verification: []
    human_judgment: true
    rationale: "Rich Results validation requires a human to run search.google.com/test/rich-results against a live URL and read the result; visual prominence is a subjective visual judgment on the 320px/1280px screenshots this plan captured. Both are this plan's own documented Manual-Only Verifications — see the human-check list below."
  - id: D9
    description: "Production activation of the backend Deploy Hook trigger (OPS-10) after merge, and the D-15 in-container notification path"
    verification: []
    human_judgment: true
    rationale: "Explicitly deferred by 04-10-SUMMARY.md (D5) and 04-11-SUMMARY.md (D6) to this plan's own end-of-phase human-check list — activation requires deploying 915tldr.com2 and setting a production secret, which is an owner-only action per this project's own git/deploy rules, not something this plan executes."

duration: ~1h50min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 12: Live Verification, Deployment, and Validation Close-Out Summary

**Deployed the full Phase 4 build to dev.915tldr.com and proved every public URL/SEO contract live — a 57-case fetch-based suite and a 6-case real-Chromium suite, both passing for the way readers actually reach the site — while fixing `verify-edge-headers.mjs`'s live-article discovery so it no longer lists an ~40k-key KV namespace, and closing out Phase 4's validation map as Nyquist-compliant.**

## Performance

- **Duration:** ~1h50min
- **Started:** 2026-09-30T22:16:00Z (approx, phase transition from 04-11a completion)
- **Completed:** 2026-09-30T22:57:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified — `tools/verify-edge-headers.mjs`, `tests/integration/url-shapes.test.mjs`, `tests/integration/browser-journeys.test.mjs`, `.planning/phases/04-static-generation-templates-seo/04-VALIDATION.md`, plus this SUMMARY)

## Accomplishments

- Rewrote `tools/verify-edge-headers.mjs`'s check-4 live-article discovery: it now fetches the
  live homepage and takes the first `[data-card] a[href]` link instead of listing every key in
  the KV render manifest (which `src/lib/server/kv-manifest.ts`'s own doc comment says plainly
  "will NOT scale once Phase 4 populates the full ~41,000 article corpus" — Phase 4 has now done
  exactly that). No `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/
  `RENDER_MANIFEST_KV_NAMESPACE_ID` env vars are read by this script any more, and it no longer
  imports `src/lib/server/d1-client.ts`, `src/lib/server/kv-manifest.ts`, or `src/lib/slug.ts`.
- Deployed the phase to `dev.915tldr.com` via `pnpm run ci:local` (Version ID
  `2b16cdeb-9eb5-4930-bc68-d68fda98a26f`, 60,365 assets uploaded, 7 already present). The first
  `wrangler deploy` attempt hit a transient Cloudflare API `500 Internal Server Error`; retried the
  deploy step alone via `pnpm run deploy:ci` (build output already on disk) and it succeeded
  cleanly.
- Wrote `tests/integration/url-shapes.test.mjs`: a 57-case live URL-contract suite against
  `LIVE_ORIGIN` (`https://dev.915tldr.com`), every redirect case run twice (navigation headers and
  plain-request headers). Covers: 5 sampled canonical article URLs (200, no redirect);
  trailing-slash variants (observed **307**, matching the already-documented Cloudflare-native
  deviation from CONTEXT.md's literal "301" wording); a non-canonical wrong-category/wrong-slug
  URL and `/article/<uuid>` (both 301 to canonical); an unknown well-formed uuid (404 with
  `data-404-suggestions` markup) and a no-uuid path (404); all 8 category pages and their
  trailing-slash variants; `/categories`/`/sources`/`/new` (301 to `/`); `/sitemap.xml` (301 to
  `/sitemap-index.xml`, which itself answers 200); `robots.txt`'s exact `Content-signal` line;
  `/news-sitemap.xml`'s 48h window against `/version.json`'s `builtAt`; and `/changelog`'s entry
  count. Also includes a stale-deploy guard (T-04-48): asserts `/version.json`'s reported commit
  equals local `HEAD` before trusting any other check. All 57 cases pass.
- Wrote `tests/integration/browser-journeys.test.mjs`: 6 real-Chromium journeys (`node:test` +
  `@playwright/test`'s `chromium` launcher directly, with the same fontconfig isolation
  `design/scripts/pw.mjs` uses) — home → Crime nav click → first article card click (real mouse
  clicks, each navigation's own response/redirect checked); a non-canonical `/article/<uuid>` URL
  resolving to canonical after exactly one real 301 hop, walked via the browser's own
  `request.redirectedFrom()` chain (not a second `fetch`); an unknown-uuid path built from a real
  article's own category+slug showing `[data-404-suggestions]` visible with a link within 5s;
  `/categories` → homepage; `/crime/` → `/crime`; and 320px/1280px article screenshots captured to
  the session scratchpad (not committed) for the owner's prominence review. All 6 pass.
- Filled `04-VALIDATION.md`'s Per-Task Verification Map with one row per task across all 12 plans
  in the phase, ticked both Wave 0 spikes (loader-throw propagation, confirmed 04-01; Workers
  Builds page reuse, confirmed `WB_REUSE_PROVEN` on the real platform, 04-10) and all 7 Wave 0 test
  files, recorded measured feedback latency (warm `pnpm run build`: 39.9s; `pnpm run test:fast`:
  2.5s; full suite chain: 2m34s), and set `wave_0_complete: true` / `nyquist_compliant: true` —
  every task in the phase has an automated verify or is a documented owner-checkpoint immediately
  followed by one, with no 3 consecutive tasks anywhere lacking automated verification.
- Ran the full suite once against the live deployment:
  `pnpm run test:unit` (385/385), `pnpm run test:build-gate` (8/8), `pnpm run test:regression`
  (5/5, includes a real two-build byte-identity replay), and
  `TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` (5/5, live check against this
  plan's own deployment) — all green.

## Task Commits

1. **Task 1: Make edge verification scale, deploy the phase, and run the live URL-contract suite**
   — `5601114` (feat)
2. **Task 2: Drive the reader's path in a real browser** — `23623eb` (test)
3. **Task 3: Fill the validation map and hand the owner the human-only checks** — `a0dd4a0` (docs)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `tools/verify-edge-headers.mjs` — live-article discovery rewritten to parse the deployed
  homepage instead of listing the KV render manifest
- `tests/integration/url-shapes.test.mjs` (new) — 57-case live HTTP URL-contract suite
- `tests/integration/browser-journeys.test.mjs` (new) — 6-case real-Chromium reader-journey suite
- `.planning/phases/04-static-generation-templates-seo/04-VALIDATION.md` — full per-task map,
  Wave 0 ticks, measured latency, `wave_0_complete`/`nyquist_compliant` set true

## Decisions Made

See `key-decisions` in frontmatter above — summarized: `verify-edge-headers.mjs`'s discovery
mechanism replaced entirely (homepage parsing, not KV listing); the `/changelog` test asserts
against the already-approved `CHANGELOG_MIN_EXPECTED=15` floor from 04-08, not this plan's own
stale "18" text; Phase 4's validation map is now Nyquist-compliant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / premise correction] `/changelog` test asserted the plan's stale "18 entries" figure**
- **Found during:** Task 1, first real run of `tests/integration/url-shapes.test.mjs` against the
  deployed site
- **Issue:** The plan's own `must_haves.truths` says "/changelog shows at least 18 entries live" —
  that figure predates 04-08's execution-time finding (already recorded in `04-08-SUMMARY.md`):
  v1's live `changelog.json` currently serves only 9 entries (3 more, committed 2026-09-21, were
  never deployed), so production genuinely publishes 9 + 6 D1 = 15 entries today, not 18. Asserting
  18 in a new test would make it permanently fail against correctly-behaving production — the
  exact "verify the premise before executing the conclusion" trap.
- **Fix:** Test now asserts against `CHANGELOG_MIN_EXPECTED = 15` (a local constant, duplicated
  rather than imported per this project's own established convention for plain `node --test`
  files that can't resolve `astro/loaders`/`astro/zod`), with a comment citing
  `src/content/loaders/changelog-loader.ts`'s own already-documented, owner-approved floor and its
  never-shrink ratchet (which will raise this automatically once v1 deploys the missing 3 entries).
- **Files modified:** `tests/integration/url-shapes.test.mjs`
- **Verification:** Re-ran the suite; 57/57 pass.
- **Committed in:** `5601114` (Task 1 commit)

**2. [Operational, not a deviation rule] Transient Cloudflare API 500 on the first deploy attempt**
- **Found during:** Task 1, the first `pnpm run ci:local` invocation
- **Issue:** `wrangler deploy` (inside `ci:local`) failed instantly with a generic Cloudflare API
  `500 Internal Server Error` (code 10013) on a `GET /accounts/.../workers/services/915tldr-v2`
  call — not a code or config problem; the log shows the failure happened before any asset upload
  began.
- **Fix:** Retried the deploy step alone (`pnpm run deploy:ci`, reusing the already-built `dist/`
  output) — succeeded cleanly on the second attempt, uploading all 60,365 assets.
- **Files modified:** None (operational retry only)
- **Verification:** `pnpm run verify:edge` and both integration suites pass against the resulting
  deployment.
- **Committed in:** N/A (no code change; documented here and in the Task 1 changelog entry)

---

**Total deviations:** 1 auto-fixed (Rule 1 — premise correction, aligning a new test with an
already-owner-approved production floor rather than a stale plan figure), 1 operational retry
(transient platform error, no code change).
**Impact on plan:** No scope creep. The changelog fix keeps the new test honest about what
production actually serves today, per this project's own "verify the premise" standard; the
deploy retry is a standard transient-infrastructure recovery, not a design change.

## Issues Encountered

None beyond the two items documented above under Deviations.

## Known Stubs

None. Every artifact this plan touched is real: the deployment is a real `wrangler deploy` against
the real `915tldr-v2` Worker, both integration suites run real HTTP/browser requests against that
real deployment, and the validation map's every row cites a real, re-run command or measurement.

## Threat Flags

None beyond what this plan's own `<threat_model>` already registered (T-04-47 through T-04-49 —
live-deployment information disclosure, stale-deploy-verified-by-mistake, and screenshot/log
secret disclosure) — all verified clean: `pnpm run verify:edge` re-proves the edge noindex posture
post-deploy; `tests/integration/url-shapes.test.mjs`'s T-04-48 case asserts the deployed commit
equals local `HEAD` before trusting any other check; and both new test files print only URLs and
status codes, never a secret value.

## User Setup Required

None new. This plan authenticated against Cloudflare using credentials already present in this
session's environment (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) — no new external service
configuration was introduced.

## Owner Human-Check List (end-of-phase, workflow.human_verify_mode = end-of-phase)

The following can only be confirmed by a human — everything automatable has been automated and
verified above:

1. **Rich Results Test** (search.google.com/test/rich-results) on one live article URL from
   `dev.915tldr.com`: confirm `NewsArticle`, `BreadcrumbList`, `Organization` and `WebSite` are all
   detected with zero errors; note any warnings (SEO-01/SEO-02 — "validated, not merely emitted").
2. **Prominence:** open the 320px and 1280px screenshots captured this session (session
   scratchpad, not committed — re-run `SCREENSHOT_OUTPUT_DIR=<dir> node --test
   tests/integration/browser-journeys.test.mjs` to regenerate) and the live article in both light
   and dark system themes — confirm the AI disclosure and "Original reporting" line are clearly
   visible right after the summary (IDNT-03/IDNT-04, SEO-07).
3. **Acknowledge the trailing-slash redirect code**: this session re-confirmed **307** live
   (`docs/phase-04/spikes.md`'s Cloudflare-native finding) — CONTEXT.md asked for 301, and native
   `html_handling` has no configuration that emits 301 without routing every mismatched request
   through the Worker, which this project deliberately avoids for cost/architecture reasons.
4. **Acknowledge the footer build-stamp semantics change** (04-11a): article pages' footer stamp
   now shows the commit *date*, not the build time; `/version.json` still reports `builtAt`
   separately.
5. **Review the flagged assumptions** listed in each plan's "Edge coverage" sections (REND-02,
   REND-03, REND-05, SEO-02, SEO-03, SEO-05, SEO-06, OPS-10, FIX-04, FIX-05) and the three
   descriptor-less prohibition groups noted across the phase's plans.
6. **OPS-10 production activation** — after merging `feature/phase-04` → `develop` → `main` and
   pushing `915tldr-frontend`: confirm the production Workers Builds run succeeds; deploy the
   `915tldr.com2` branch and run `wrangler secret put FRONTEND_DEPLOY_HOOK_URL` with the **main**
   Deploy Hook (never the `feature/phase-04` spike hook used during 04-10's measurement); after the
   next 2-hourly ingest cycle that adds a story, confirm one hook-triggered production build
   appears.
7. **D-15 in-container notification path**: 04-10's drill fully proved the notification *logic*
   (classify/redact/sanitize/deliver) locally against the real ntfy service, but running the exact
   drill mechanism inside a real Workers Builds container was not possible in that session (no
   dashboard variable-edit access granted) — confirm one real Workers Builds failure notification
   when convenient.
8. **Cleanup** (your action — this executor does not delete files, per this project's rules):
   - `rm src/lib/slug.ts` — no longer imported anywhere in the codebase (confirmed via grep this
     session); the owner previously indicated intent to delete this file.
   - `rm src/lib/render-cost-harness.ts`
   - `rm tools/measure-render-cost.mjs`
   - Remove the `measure:render` script from `package.json`

## Next Phase Readiness

- Phase 4's automated scope is complete: all 12 plans executed, `04-VALIDATION.md` is
  `nyquist_compliant: true`, and the phase's full suite (unit, build-gate, regression, tracer) is
  green against the live deployment.
- The 8-item human-check list above is the only remaining work before the phase can be considered
  fully closed out — none of it is code.
- `.planning/STATE.md` now reports Phase 4 as `ready_for_verification` (this was plan 12 of 12).

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-30*

## Self-Check: PASSED

Verified `tools/verify-edge-headers.mjs` no longer contains `listManifestArticleIds` (grep count:
0) and exports `discoverLiveArticlePath` (grep confirmed). Verified `tests/integration/
url-shapes.test.mjs` and `tests/integration/browser-journeys.test.mjs` both exist on disk and
their most recent runs reported 57/57 and 6/6 passing respectively (re-run in this session).
Verified `.planning/phases/04-static-generation-templates-seo/04-VALIDATION.md` contains
`wave_0_complete: true` and `nyquist_compliant: true` (grep confirmed). Verified all 3 claimed
commit hashes (`5601114`, `23623eb`, `a0dd4a0`) present via `git log --oneline -5`. Verified the
live deployment's Version ID (`2b16cdeb-9eb5-4930-bc68-d68fda98a26f`) against the real
`wrangler deploy` output captured this session.

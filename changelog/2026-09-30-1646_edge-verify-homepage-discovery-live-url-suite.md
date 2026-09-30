# 2026-09-30 - Live URL Contracts Verified on Deployed dev.915tldr.com

**Keywords:** [TESTING] [DEPLOYMENT] [BACKEND] [SEO]
**Session:** Afternoon, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1646_edge-verify-homepage-discovery-live-url-suite.md`

## What Changed

- File: `tools/verify-edge-headers.mjs`
  - Rewrote check 4's live-article discovery: now fetches the live homepage and takes the first
    `[data-card] a[href]` link, instead of listing every key in the KV render manifest (~40k+ keys
    today) and resolving each candidate through D1.
  - Removed the `src/lib/server/d1-client.ts`, `src/lib/server/kv-manifest.ts`, and
    `src/lib/slug.ts` imports entirely — no `.dev.vars`/`CLOUDFLARE_ACCOUNT_ID`/
    `CLOUDFLARE_API_TOKEN`/`RENDER_MANIFEST_KV_NAMESPACE_ID` loading is needed for discovery
    any more.
- File: `tests/integration/url-shapes.test.mjs` (new)
  - 57-case live URL-contract suite against `LIVE_ORIGIN` (default `https://dev.915tldr.com`):
    canonical article URLs, trailing-slash redirects, non-canonical/legacy `/article/<uuid>`
    redirects, 404 behavior (unknown uuid and no-uuid paths), all 8 category pages and their
    trailing-slash variants, legacy route redirects (`/categories`, `/sources`, `/new`),
    `/sitemap.xml`, `robots.txt`'s Content-signal line, `/news-sitemap.xml`'s 48h window, and
    `/changelog`'s entry count. Every redirect-producing case runs twice — once with browser
    navigation headers (`Sec-Fetch-Mode: navigate`, etc.) and once with plain request headers.
  - Includes a stale-deploy guard (`T-04-48`): asserts `/version.json`'s reported commit equals
    local `HEAD` before trusting any other check in the file.

## Why

Phase 4's own CLAUDE.md verification standard requires driving the path a reader actually takes,
not just a curl-only check — the navigation-header routing trap found during 04-06 planning is
exactly the kind of bug a curl-only check would pass. This also fixes a scaling problem flagged
in `src/lib/server/kv-manifest.ts`'s own doc comment: `listManifestArticleIds()` was never meant
to scale past a handful of entries, and Phase 4 has now populated the full ~40k-article corpus.

Deployed the phase to `dev.915tldr.com` via `pnpm run ci:local` so the live suite has something
current to check against.

## Issues Encountered

The first `wrangler deploy` attempt (inside `pnpm run ci:local`) failed with a transient
Cloudflare API `500 Internal Server Error` (code 10013, generic/unknown) on the initial
`GET /accounts/.../workers/services/915tldr-v2` call — not a code or config issue. Retried the
deploy step alone via `pnpm run deploy:ci` (the build output was already on disk) and it
succeeded cleanly: 60,365 assets uploaded (7 already present), Version ID
`2b16cdeb-9eb5-4930-bc68-d68fda98a26f`.

The live `url-shapes.test.mjs` run first failed one case: `/changelog` renders 15 entries, not
the plan's literal "18." This is not a new bug — `src/content/loaders/changelog-loader.ts`'s
`CHANGELOG_MIN_EXPECTED = 15` already documents an owner-approved floor from 04-08's execution
(v1's live `changelog.json` currently serves only 9 entries, not the 12 the plan's original "18"
figure assumed; 9 + 6 D1 rows = 15). The test now asserts against 15, matching the already-
established, already-approved floor, with a comment pointing at 04-08-SUMMARY.md and the
loader's own never-shrink ratchet (which will raise this automatically once v1 deploys the
missing 3 entries).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full 57-case `tests/integration/url-shapes.test.mjs` suite against the
  real deployed `dev.915tldr.com`, both navigation-header and plain-request variants;
  `pnpm run verify:edge` re-run post-deploy (4/4 checks pass, confirmed zero KV list calls).
- Observed trailing-slash redirect status: **307** for both article and category paths — matches
  the already-documented deviation from CONTEXT.md's literal "301" wording
  (`docs/phase-04/spikes.md`), not a new finding.
- What wasn't tested: Google Rich Results validation, visual prominence checks, and production
  activation of the backend Deploy Hook — all explicitly deferred to the owner's end-of-phase
  human-check list (Task 3 of this plan).

## Next Steps

- [ ] Task 2: real-browser (Playwright/Chromium) navigation checks against the same deployment
- [ ] Task 3: fill `04-VALIDATION.md`'s per-task map and hand off the owner's human-only checklist

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - live verification tooling and a new integration suite; no production code
path changed (dev.915tldr.com only)

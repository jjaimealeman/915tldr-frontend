# 2026-10-01 - Archived pages now prove the same live URL contract as static pages

**Keywords:** [TESTING] [BUG_FIX] [DEPLOYMENT]
**Session:** Morning, Duration (~90 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1041_05-11-live-url-contract-parity-for-archived-pages.md`

## What Changed

- File: `tests/helpers/archive-sample.mjs` (new)
  - `loadArchivePlan()` reads the local build's `dist/archive-plan.json`, throwing a clear
    "run `pnpm run build` first" message if missing.
  - `pickArchivedArticles(plan, n, { marginDays })` samples archived articles whose
    `publishedAt` sits at least `marginDays` past the hot/archive cutoff, reading
    `.astro/tier-facts-articles.json` for the dates the plan file itself strips.
  - `pickArchivedTags(plan, n, { maxCount })` samples small archived tags (≤ `maxCount`
    articles) from `.astro/tier-facts-tags.json`.
  - `pickStaticTag(plan, { minCount })` finds a non-archived tag with ≥ `minCount` articles,
    for comparing redirect shapes against a known-static baseline.
- File: `tests/integration/url-shapes.test.mjs`
  - Widened the T-04-48 stale-deploy guard: accepts exact commit equality, or an ancestor
    relationship in EITHER direction with zero diff on the guarded paths (`src`, `tools`,
    `wrangler.jsonc`, `package.json`, `astro.config.mjs`) — this repo's per-phase-branch
    workflow means local HEAD routinely runs ahead of the last deploy by doc-only commits.
  - The guard now also resolves a non-hash `/version.json` commit value through git — discovered
    live that Cloudflare Workers Builds reports the literal branch name (`"main"`) instead of a
    sha for a non-push-triggered (scheduled/ingest) rebuild.
  - Added archived-article cases (canonical 200 + archive Server-Timing metric + content-type
    parity, trailing-slash single-redirect, wrong-category 301) and archived-tag cases (canonical
    200 + archive metric, `/` and `.html` suffix parity against a static tag, unknown-tag styled
    404), for both navigation-header and plain request kinds, plus a HEAD-on-archived-article
    case.
- File: `tools/verify-edge-headers.mjs`
  - Added check 5: an archived article (served by the Worker's R2 branch) carries
    `x-robots-tag: noindex`.
  - Added `discoverArchivedArticlePath()` — discovers a sample path from the local build's
    `dist/archive-plan.json` (an archived page is no longer linked from the live homepage once
    partitioned out of the static output, so check 4's live-homepage-crawl approach can't reach
    it).
  - Missing input (no `--archived-path`, no local build) now reports the check as `SKIP`, never
    silently as `PASS`.

## Why

05-11's objective is proving the archive tier from the reader's side on the deployed site — the
same URL contract (redirects, suffixes, 404s, noindex) that already holds for static pages must
also hold for archived ones. Doing this against the real deployed site (not a unit-test fake)
required discovering real archived URLs, which only exist in a local build's own partition
output, with a safety margin from the tier boundary so build-to-build drift between this local
build and the live one can never sample a URL that's crossed the cutoff.

## Issues Encountered

- **Stale-deploy guard tripped by a genuine (if trivial) code drift.** `/version.json` reported
  the live deployed commit as `"main"` (a scheduled/ingest-triggered production rebuild's own
  quirk — resolves via `git rev-parse main` to `57dfa94`), and that commit's guarded-path tree
  differed from local HEAD by one 12-line doc comment in `tools/assert-file-count.mjs` (already
  confirmed behavior-neutral by 05-09's own test re-run). Per this plan's own context instruction
  ("if /version.json shows a different commit, re-run `pnpm run ci:local` first"), redeployed
  `dev.915tldr.com` directly from local HEAD via `pnpm run deploy:ci`
  (`node tools/ci-build.mjs deploy`) — zero archive-sync changes (fully idempotent, $0 cost, no
  code changes), confirmed via `/version.json` now reporting `commit: "1f22fc8"` with
  `hashSource: "local-git"`, an exact match to local HEAD.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/integration/url-shapes.test.mjs` — 71/71 pass, both request
  kinds, every new archived case (canonical 200, trailing-slash redirect, wrong-category redirect,
  tag suffix parity, unknown-tag 404, HEAD). `pnpm run verify:edge` — 5/5 checks pass including
  the new archived-page noindex check.
- What wasn't tested: criterion-2 R2 latency/LCP measurement (05-11 Task 3) and the real-browser
  click journeys (05-11 Task 2) — both still pending in this plan.
- Edge cases: archived article trailing-slash redirects as 301 (the Worker's own redirect
  branch, since the exact-slash static file no longer exists once partitioned into R2) — a
  different status than a hot article's 307 (Cloudflare's own `html_handling`); logged, not
  asserted to one value, matching this file's existing convention for the hot-article case.

## Next Steps

- [ ] 05-11 Task 2: real-Chromium click journeys into archived articles/tags
- [ ] 05-11 Task 3: measure R2 latency (p50/p95) and archived-page LCP against the 1.5s budget

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - extends live verification coverage to the archive tier; no production
runtime code changed (test/tooling files only), one redeploy of the dev host to align its
reported build commit with local HEAD.

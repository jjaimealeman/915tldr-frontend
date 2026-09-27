---
phase: 04-static-generation-templates-seo
plan: 07
subsystem: seo
tags: [astro-rss, astrojs-sitemap, robots-txt, google-news-sitemap, rss, sitemap]

requires:
  - phase: 04-static-generation-templates-seo
    provides: "articles-loader.ts Content Layer collection (04-01), sortNewestFirst/listing.ts (04-05), articlePath (04-01/04-06)"
provides:
  - "Static /robots.txt shipping v1's INTENDED per-bot AI-crawler-blocking policy (a deliberate production policy change from what v1 actually serves today)"
  - "Static /rss.xml (30 newest articles, v1-parity channel metadata and guid format, trailing-slash-free links)"
  - "Static /news-sitemap.xml (Google News namespace, 48-hour rolling window, hand-written)"
  - "Static /sitemap-index.xml + child sitemaps via @astrojs/sitemap, filtered to public HTML pages only"
  - "src/lib/seo-feeds.ts pure selectors (selectNewsWindow, newsSitemapXml, escapeXml) reusable by any future feed"
affects: [04-12-live-verification, phase-05-premise-gate, ops-monitoring]

actuals:
  tokens: 12659
  tasks: 3
  commits: 4

tech-stack:
  added: ["@astrojs/rss@4.0.19", "@astrojs/sitemap@3.7.4"]
  patterns:
    - "Pure seo-feeds.ts module (no astro:content/D1/KV import) mirrors listing.ts's testability pattern"
    - "@astrojs/sitemap filter excludes any URL whose final path segment carries a dotted extension -- a general, non-hand-maintained signal for 'not an HTML page' under this project's extensionless URL scheme"

key-files:
  created:
    - src/lib/seo-feeds.ts
    - src/pages/rss.xml.ts
    - src/pages/news-sitemap.xml.ts
    - public/robots.txt
    - tests/fixtures/v1-robots.txt
    - tests/unit/seo-surfaces.test.mjs
    - tests/unit/news-sitemap.test.mjs
  modified:
    - astro.config.mjs
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Owner decision 2026-09-27: public/robots.txt ships v1's INTENDED per-bot policy (server/routes/robots.txt.ts's rendered body, AI-training bots blocked), not the live trivial file production actually serves -- v1's own static public/robots.txt shadows its elaborate server route, so that policy has never actually been served. This is a deliberate production policy change on next deploy, not a bug fix."
  - "astro.config.mjs's sitemap() filter excludes any URL with a dotted final path segment (rss.xml, news-sitemap.xml, version.json, 404-index.json) rather than a hand-maintained list -- confirmed against the package's own astro:build:done hook source that all src/pages/ routes, not just HTML pages, appear in its input list"
  - "Owner-approved exact pins: @astrojs/rss@4.0.19, @astrojs/sitemap@3.7.4 -- re-verified against the live npm registry immediately before install, matched the checkpoint-approved versions exactly"

patterns-established:
  - "seo-feeds.ts: pure, D1/KV-free feed-selection module, unit-testable under plain node --test, following listing.ts's established shape"
  - "Dist-output test convention (skip if unbuilt, assert on real dist/client bytes) extended to XML feeds via regex extraction, no XML-parser dependency added (fast-xml-parser confirmed not hoisted in this pnpm store)"

requirements-completed: [SEO-03, SEO-04, SEO-05, SEO-06]

coverage:
  - id: D1
    description: "robots.txt carries v1's per-bot policy (Content-signal, AI-crawler blocking) with Sitemap lines naming the v2 sitemap index and news sitemap"
    requirement: "SEO-05"
    verification:
      - kind: unit
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: robots.txt matches the fixture line-for-line except the Sitemap lines"
        status: pass
      - kind: unit
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: robots.txt preserves the Content-signal line and the per-bot AI-training blocks"
        status: pass
      - kind: unit
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: robots.txt names the v2 sitemap index and news sitemap, and only those"
        status: pass
    human_judgment: false
  - id: D2
    description: "/rss.xml lists the 30 newest public stories with v1's channel metadata and guid format, trailing-slash-free links"
    requirement: "SEO-06"
    verification:
      - kind: unit
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: rss.xml has at most 30 items, and every link/guid answers a page this build produced"
        status: pass
      - kind: unit
        ref: "tests/unit/seo-surfaces.test.mjs#seo-surfaces: rss.xml channel carries v1's title, description and language"
        status: pass
    human_judgment: false
  - id: D3
    description: "/news-sitemap.xml lists only public stories published within 48 hours of build, newest first, capped at 1,000, in Google's news: namespace"
    requirement: "SEO-03"
    verification:
      - kind: unit
        ref: "tests/unit/news-sitemap.test.mjs (selectNewsWindow/newsSitemapXml behavior cases: boundary, future-date, 1000-cap, tiebreak, escaping, empty urlset, namespaces)"
        status: pass
      - kind: unit
        ref: "tests/unit/news-sitemap.test.mjs#news-sitemap: news-sitemap.xml exists, parses, and every loc maps to a real built article page"
        status: pass
    human_judgment: false
  - id: D4
    description: "/sitemap-index.xml and child sitemaps list every public HTML page except 404, generated from the build's own route list"
    requirement: "SEO-04"
    verification:
      - kind: unit
        ref: "tests/unit/news-sitemap.test.mjs#news-sitemap: sitemap-index.xml exists and references at least one child sitemap"
        status: pass
      - kind: unit
        ref: "tests/unit/news-sitemap.test.mjs#news-sitemap: across all sitemap children, URL count equals built HTML file count (minus 404.html), no trailing slashes except root, no /404"
        status: pass
    human_judgment: true
    rationale: "SEO-04's ordering-determinism truth (must_haves backstop row: same URLs in the same order on every build) was not verified across two separate builds this session -- @astrojs/sitemap does not document a stable ordering guarantee, and only single-build count/content correctness was proven. Flagged for owner review per the plan's own 'Edge coverage' section."

duration: 21min
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 07: SEO Surfaces (robots.txt, RSS, sitemaps) Summary

**Static robots.txt/rss.xml/news-sitemap.xml/sitemap-index.xml built entirely from the Content Layer collection at build time — zero D1 reads — and a real, owner-approved production crawler-policy change discovered and resolved mid-execution.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-27T15:33:00Z (approx, continuation of Phase 4 execution)
- **Completed:** 2026-09-27T15:54:11Z
- **Tasks:** 3 (Task 1 checkpoint/decision, Task 2, Task 3 tdd)
- **Files modified:** 10

## Accomplishments

- `public/robots.txt` ships v1's fully-authored per-bot policy (Content-signal, ~25 named
  user-agents, AI-training bots disallowed) — discovered mid-execution that this policy has
  **never actually been served in production** (v1's own static file shadows its server route);
  owner decided to ship the intended policy anyway, a real production behavior change on next
  deploy.
- `/rss.xml` — 30 newest public articles via `@astrojs/rss`, matching v1's channel metadata,
  30-item limit, and guid format exactly (the package derives `<guid isPermaLink="true">`
  automatically from each item's own link, confirmed by reading the package source).
- `/news-sitemap.xml` — hand-written Google News sitemap (no package covers the `news:`
  namespace), 48-hour rolling window anchored at build time, proven against a real 210-article
  in-window count from production data.
- `/sitemap-index.xml` + 2 child sitemaps via `@astrojs/sitemap`, filtered to exactly the built
  HTML pages (59,888 URLs = 59,889 built pages minus `404.html`), confirmed by direct count
  against real `dist/client` output.
- `src/lib/seo-feeds.ts` — pure, D1/KV-free module (`selectNewsWindow`, `newsSitemapXml`,
  `escapeXml`, size constants) reusable by any future feed work.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint** — decision only, no commit (owner approved
   `@astrojs/rss@4.0.19` + `@astrojs/sitemap@3.7.4` in the orchestrator session)
2. **Task 2: Install feed packages; port robots.txt; build /rss.xml** — `68d3e91` (feat)
3. **Task 3: Google News sitemap and general sitemap** — `37087e6` (test, RED) → `4452e0f`
   (feat, GREEN)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

_Note: Task 3 (`tdd="true"`) produced two commits (test → feat); its pure-selector behavior tests
passed immediately at RED time because `seo-feeds.ts` was fully implemented in Task 2 by the
plan's own file split (not a false-RED — see "TDD Gate Compliance" below), while the three
genuinely new dist-output tests were confirmed to fail (ENOENT/assertion) before the GREEN commit
by temporarily moving the current build's sitemap artifacts out of `dist/client` (`mv`, restored
immediately, never `rm`)._

## TDD Gate Compliance

Task 3's gate sequence is present in git log: `test(04-07): add failing tests...` (`37087e6`)
followed by `feat(04-07): implement the Google News sitemap...` (`4452e0f`). RED was genuinely
verified only for the task's own new behavior (the three dist-output cases); the pure-selector
cases inherited a working implementation from Task 2's own commit (per the plan's explicit file
split — `src/lib/seo-feeds.ts` is listed under Task 2's files, not Task 3's) and passed
immediately, which is expected, not a fail-fast violation.

## Files Created/Modified

- `src/lib/seo-feeds.ts` — pure selectors/escaping for RSS and the news sitemap
- `public/robots.txt` — v1's intended per-bot policy, sitemap lines updated
- `tests/fixtures/v1-robots.txt` — the diff baseline (route's rendered body, not the live file)
- `src/pages/rss.xml.ts` — `@astrojs/rss`-based feed endpoint
- `src/pages/news-sitemap.xml.ts` — hand-written Google News sitemap endpoint
- `astro.config.mjs` — added `@astrojs/sitemap` integration with a non-HTML-endpoint filter
- `package.json`, `pnpm-lock.yaml` — `@astrojs/rss@4.0.19`, `@astrojs/sitemap@3.7.4` (exact pins)
- `tests/unit/seo-surfaces.test.mjs` — robots.txt/rss.xml dist-output tests
- `tests/unit/news-sitemap.test.mjs` — pure-selector behavior tests + sitemap dist-output tests

## Decisions Made

- **Owner decision (2026-09-27), robots.txt policy:** ship v1's intended per-bot AI-crawler-
  blocking policy (the rendered body of `server/routes/robots.txt.ts`), not the live trivial
  `User-Agent: *\nDisallow:` file production actually serves today. Root cause: v1's own static
  `public/robots.txt` shadows its elaborate server route in Nitro's routing order, so the
  carefully-authored policy has never been live. This is a **deliberate production crawler-policy
  change** taking effect on v2's deploy (GPTBot/ClaudeBot/CCBot/etc. go from allowed to blocked),
  not a silent side effect and not a bug fix — see "Deviations from Plan" below for the full
  discovery, options presented, and the owner's reasoning.
- **Sitemap filter as a general dotted-extension rule**, not a hand-maintained exclusion list —
  confirmed against `@astrojs/sitemap`'s own `astro:build:done` hook source that its `pages` input
  includes every route under `src/pages/`, not just HTML pages.
- Package versions exact-pinned at the owner-approved values (`4.0.19` / `3.7.4`), re-verified
  against the live npm registry immediately before install per the checkpoint's own instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Premise verification, not Rule 1-4] Plan's robots.txt fallback instruction assumed a false premise about what's live in production**
- **Found during:** Task 2, before any file was written
- **Issue:** Task 2's action text said "capture v1's live robots.txt; if it differs from source,
  the live body wins." Curling `https://915tldr.com/robots.txt` (cache-busted, confirmed via
  response headers, checked both apex and `www`) returned a fully permissive
  `User-Agent: *\nDisallow:` with no `Content-signal` line, no per-bot rules, and no `Sitemap:`
  line — directly contradicting the plan's own `must_haves.truths` and threat-model prohibition
  ("MUST NOT relax v1's AI-crawler or Content-signal policy"). Root cause: v1's static
  `public/robots.txt` (also just `Disallow:`) shadows its own `server/routes/robots.txt.ts` in
  Nitro's routing order — the elaborate, well-commented per-bot policy has never actually been
  served. Following the plan's literal fallback instruction would have shipped a robots.txt that
  still allows every AI-training bot, the opposite of the plan's stated intent.
- **Action:** This was not a Rule 1-3 auto-fixable bug and not confidently a Rule 4 unilateral
  call either way (it changes production crawler behavior in a way a human should consciously
  choose) — surfaced as a `checkpoint:decision` before writing any file. The owner reviewed the
  finding (independently re-verified with their own cache-busted curl and file diff) and selected
  Option A: ship the intended policy.
- **Fix:** `tests/fixtures/v1-robots.txt` captures `server/routes/robots.txt.ts`'s rendered body
  (siteUrl substituted) rather than a live curl capture; `public/robots.txt` is that body with
  only the two `Sitemap:` lines changed.
- **Files modified:** `public/robots.txt`, `tests/fixtures/v1-robots.txt`, `tests/unit/seo-surfaces.test.mjs`
- **Verification:** `diff <(grep -v '^Sitemap:' fixture) <(grep -v '^Sitemap:' built)` byte-identical; `seo-surfaces.test.mjs` asserts Content-signal and every named AI-training bot's `Disallow: /` are present in the built output.
- **Committed in:** `68d3e91` (Task 2 commit)

---

**Total deviations:** 1 (premise-verification checkpoint, owner-resolved)
**Impact on plan:** No scope creep — the fix stayed within Task 2's own file list. The impact is
entirely in *content*, not architecture: production's robots.txt behavior changes on next deploy,
by deliberate owner choice, not by accident.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: policy-change | `public/robots.txt` | Ships v1's intended AI-crawler-blocking policy, which has never been live in production. On v2's deploy, GPTBot/ClaudeBot/CCBot/Google-Extended/Bytespider/PerplexityBot/etc. go from unrestricted access to `Disallow: /` — a real, owner-approved change to what has been crawlable, not merely a code correctness fix. Already covered by the plan's own T-04-29 threat-register disposition (mitigate), but flagged again here because the *magnitude* of the discrepancy (a fully-open policy going fully-restrictive) was larger than the plan's authors appear to have anticipated when they wrote the "live body wins" fallback clause. |

## Issues Encountered

None beyond the robots.txt premise-verification finding above (documented as a deviation, not a
bug). All builds, tests, and guards passed cleanly on the first real attempt for both tasks.

## User Setup Required

None — no external service configuration required. (Operational note for 04-12: once deployed,
confirm Google Search Console / Cloudflare pick up the new `sitemap-index.xml`, and that the new
robots.txt policy is actually being honored by a real crawler request, not just present in the
served file.)

## Next Phase Readiness

- SEO-03, SEO-04, SEO-05, SEO-06 all shipped as static, zero-D1-read build artifacts — no
  outstanding work for this plan's scope.
- **Owner review flagged (SEO-04 ordering):** `@astrojs/sitemap` does not document a stable
  ordering guarantee across builds; this session verified single-build correctness (URL count,
  no leaked non-HTML/404 URLs) but did not compare two separate builds for identical ordering.
  Marked `human_judgment: true` in this SUMMARY's coverage block for D4.
- **Owner review flagged (production policy change):** the robots.txt discovery/decision above
  should be visible to whoever handles the next production deploy — AI-training bots that have
  had unrestricted access to 915tldr.com will be blocked starting with v2's first deploy.
- 04-12's live verification (per the plan's own Next Steps) should include a real crawler-facing
  check of robots.txt, an RSS-reader subscription-continuity check, and confirming Search Console
  picks up the new sitemap.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

## Self-Check: PASSED

All 8 claimed files confirmed present on disk; all 3 claimed commit hashes (`68d3e91`, `37087e6`,
`4452e0f`) confirmed present in `git log --oneline --all`.

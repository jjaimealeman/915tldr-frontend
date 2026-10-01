---
status: testing
phase: 04-static-generation-templates-seo
source: [04-VERIFICATION.md]
started: 2026-09-30T17:15:00-06:00
updated: 2026-09-30T22:25:00-06:00
---

## Current Test

number: 4
name: Real in-container build-failure notification
expected: |
  the ntfy push arrives with a correct title (D-15)
awaiting: user response

## Tests

### 1. Rich Results Test on a live dev article
Run a real article URL from dev.915tldr.com through https://search.google.com/test/rich-results
expected: NewsArticle, BreadcrumbList, Organization and WebSite structured data validate clean
result: PASS — owner ran the Google Rich Results Test 2026-09-30: page fetch successful,
NewsArticle + BreadcrumbList valid. The tool's "crawl failed" note is expected — dev.915tldr.com
sends `X-Robots-Tag: noindex` by design (a dev host, not production). Two non-critical items were
reported and are resolved: missing top-level `image` is expected (imagery is a later phase, not a
Phase 4 scope item), and the `isBasedOn` "Unnamed item" NewsArticle warning (missing
image/author/headline on a node that was never meant to carry its own) is fixed by changing
`isBasedOn`'s `@type` from `NewsArticle` to `CreativeWork` (04-followups task 2,
`src/lib/structured-data.ts`).

### 2. AI disclosure and outlet attribution are prominent
Review a live article at 320px and 1280px, in light and dark theme
expected: both are prominent at the point of reading, matching design/mockups/article.html's visual weight (IDNT-03/IDNT-04/SEO-07)
result: PASS — owner reviewed disclosure/attribution on Pixel and desktop Firefox/Chrome
2026-09-30: "prominent enough" at both breakpoints. Note: the approved design is light-by-default
— dark theme currently applies only via the planned theme-toggle island (ISL-07, Phase 8), not
`prefers-color-scheme`, so "dark theme" review in practice meant confirming the toggle's absence
doesn't regress the light-theme disclosure/attribution weight, not a live dark-mode render.

### 3. Production activation of the rebuild trigger (after Phase 4 merges to main)
Deploy 915tldr.com2 with FRONTEND_DEPLOY_HOOK_URL set to the main Deploy Hook; watch one real ingest cycle
expected: a cron cycle that changes public articles triggers exactly one Workers Builds production build (OPS-10, roadmap criterion 3)
result: PASS — checked 2026-09-30 22:20 MDT against the 04:00 UTC 2026-10-01 cron on v1 Worker
`915tldr` (version 4a4af16e). (1) v1 logs: fetch 13 new / 97 skipped / 0 errors; AI processing
6 processed, 0 failed (grounding held 3); task ended `Frontend deploy hook: triggered` and
`Complete in 343631ms`. (2) Workers Builds for `915tldr-v2`: exactly one build after 04:00 UTC —
`e8a27400-5f12-4709-b2de-9a73c0c1e9a6`, branch `main`, created 04:06:25Z (no commit hash, as a
Deploy Hook build has none), outcome **success**; dev.915tldr.com/version.json reports
`builtAt 2026-10-01T04:07:42Z`, `hashSource workers-ci`. (3) Content: dev's top three stories
(Pike execution statement, Paxton in El Paso, California governor rivals) are exactly the three
newest public articles in D1 (ids 43721/43719/43724, all ingested 04:00 UTC this run) and match
v1's live `/api/articles`. v1's homepage HTML still led with an older story (Kyle Busch, id 43713)
— a stale `cache-control: max-age=300` render on v1's side, not a v2 discrepancy.
Side finding, NOT a Phase 2/4 regression and not a rollback trigger: v1's duplicate detection
throws on every run — the `article_entities`/`entities` IN-list binds ~116 params, over D1's
100-param ceiling. It failed on all 25 runs since at least 2026-09-29, i.e. before today's 02:12Z
deploy. Consequence: `duplicatesFound` is 0, so cross-source duplicates currently publish and
`changed` counts them as newly public. Tracked for a v1 fix (chunk the IN list ≤100).

### 4. Real in-container build-failure notification
Trigger a real build failure on Workers Builds (not the local WORKERS_CI=1 simulation)
expected: the ntfy push arrives with a correct title (D-15)
result: [pending]

## Summary

total: 4
passed: 3
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

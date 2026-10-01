---
status: testing
phase: 04-static-generation-templates-seo
source: [04-VERIFICATION.md]
started: 2026-09-30T17:15:00-06:00
updated: 2026-09-30T18:10:00-06:00
---

## Current Test

number: 3
name: Production activation of the rebuild trigger (after Phase 4 merges to main)
expected: |
  a cron cycle that changes public articles triggers exactly one Workers Builds production build
  (OPS-10, roadmap criterion 3)
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
result: [pending]

### 4. Real in-container build-failure notification
Trigger a real build failure on Workers Builds (not the local WORKERS_CI=1 simulation)
expected: the ntfy push arrives with a correct title (D-15)
result: [pending]

## Summary

total: 4
passed: 2
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

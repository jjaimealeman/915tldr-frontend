---
phase: 07-imagery-share-cards
plan: 05
subsystem: share-validation-tooling
tags: [share-cards, open-graph, verification-tooling, cloudflare-analytics, crawlers]
requires: ["07-01", "07-03", "07-04"]
provides:
  - tools/verify-share-meta.mjs (checkSharePage, pngDimensions, robotsRulesFor, isPathAllowed, SCRAPER_USER_AGENTS, runShareChecks; pnpm run verify:share)
  - tools/measure-share-fetches.mjs (buildShareFetchQuery, summariseShareFetches, verifyShareFetchSchema, fetchShareGroups; pnpm run measure:share)
  - the pre-deploy baseline of what dev.915tldr.com serves today
  - the measured fact that dev-host static requests are visible in zone analytics
affects: [07-06, 07-07, 07-08, 07-09]
tech-stack:
  added: []
  patterns:
    - live checker with injected fetch and discovery seams, proven able to fail and able to pass
    - zone-analytics query with schema introspection before every run, inputs as GraphQL variables only
key-files:
  created:
    - tools/verify-share-meta.mjs
    - tests/unit/verify-share-meta.test.mjs
    - tools/measure-share-fetches.mjs
    - tests/unit/measure-share-fetches.test.mjs
  modified:
    - package.json
key-decisions:
  - "Expected values come from src/lib/share-meta.ts (SHARE_IMAGE_*, OG_LOCALE, ICON_LINKS), so copy changes in 07-07 flow into the checker without edits"
  - "robots.txt matching is exact on the product token: FacebookBot never matches facebookexternalhit, which falls under *"
  - "measure-share-fetches has its own introspection helper reading inputFields too, because cf-graphql introspectType reads only fields"
requirements-completed: []
duration: ~35 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 5
---

# Phase 7 Plan 05: Share-meta checker and card-fetch measurement Summary

`pnpm run verify:share` checks a live host's pages, cards and icons for the full share tag set and crawler reachability (fails on today's tagless dev host, passes on the head-harness pages), and `pnpm run measure:share` reads Cloudflare zone analytics for who fetched the cards, with status and bytes; dev-host static requests are visible in analytics within about 74 seconds.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | verify-share-meta checks real pages end to end | 49c57d0 | tools/verify-share-meta.mjs, tests/unit/verify-share-meta.test.mjs, package.json |
| 2 RED | failing tests for crawler UA probes and robots resolution | b4c941c | tests/unit/verify-share-meta.test.mjs |
| 2 GREEN | UA probes, robotsRulesFor, isPathAllowed | 9879822 | tools/verify-share-meta.mjs |
| 3 RED | failing tests for the zone-analytics measurement | 4e741d5 | tests/unit/measure-share-fetches.test.mjs |
| 3 GREEN | measure-share-fetches and the measure:share script | 17256b6 | tools/measure-share-fetches.mjs, package.json |

Each commit carries its `changelog/` entry and README index row. The public `changelog.json` was not touched (tooling only).

## Acceptance results (real output)

Task 1:
- `node --test tests/unit/verify-share-meta.test.mjs`: 16 pass, 0 fail at the Task 1 commit; each broken fixture fails exactly its expected set (for example missing og:image:alt fails only `og:image:alt`; an empty og:description fails `no empty meta content` and `og:description`).
- Positive runs, all `[verify-share] all checks passed`, exit 0: `--html tests/fixtures/head-harness/dist/en-listing.html --lang en --kind page`, `.../en-article.html --lang en --kind article`, `.../es-article.html --lang es --kind article`.
- `grep -c '"verify:share": "node tools/verify-share-meta.mjs"' package.json` printed `1`.
- Negative baseline, live and read-only, `node tools/verify-share-meta.mjs --host dev.915tldr.com` exit 1. Header line and selected verbatim lines:

```
[verify-share] host dev.915tldr.com, version.json commit main, homepage stylesheet /_astro/Base.h88la9Hn.css
PASS version.json — commit main
PASS live article discovery — /community/gabby-garza-cooks-fajitas-as-garzas-great-great-granddaughter-e61a8c45-57e7-45f7-aa28-ea06e605a400
FAIL EN home (/): og:image — expected "https://dev.915tldr.com/og-image.png", observed null
FAIL EN home (/): icon links — expected [...three ICON_LINKS...], observed []
FAIL ES home (/es): og:image — expected "https://dev.915tldr.com/og-image-es.png", observed null
FAIL card en status — https://dev.915tldr.com/og-image.png -> 404 text/html 10629 bytes x-robots-tag=noindex
FAIL card es status — https://dev.915tldr.com/og-image-es.png -> 404 text/html 10629 bytes x-robots-tag=noindex
FAIL /favicon.ico status — https://dev.915tldr.com/favicon.ico -> 404 text/html 10629 bytes x-robots-tag=noindex
FAIL /favicon.svg status — https://dev.915tldr.com/favicon.svg -> 404 text/html 10629 bytes x-robots-tag=noindex
FAIL /apple-touch-icon.png status — https://dev.915tldr.com/apple-touch-icon.png -> 404 text/html 10629 bytes x-robots-tag=noindex
SKIP page weight (info) — EN home 11945 bytes; ES home 12168 bytes; EN article 14015 bytes; ES article 14249 bytes; noindex page 28433 bytes
```
  The first run had 88 FAIL lines (every og/twitter/article/icon check on all five pages, plus the five asset 404s). The `/es/source/ktsm` noindex page did carry the robots noindex meta, so that guard passed. The discovered article was a live community article; its ES twin returned 200.

Task 2 (RED b4c941c precedes GREEN 9879822; RED confirmed failing with `does not provide an export named 'SCRAPER_USER_AGENTS'`):
- `node --test tests/unit/verify-share-meta.test.mjs`: 23 pass, 0 fail.
- Live run against dev.915tldr.com after GREEN (verbatim):

```
PASS UA probe facebook: article page — 200 14015 bytes (facebookexternalhit/1.1)
FAIL UA probe facebook: EN card — facebook (facebookexternalhit/1.1) got status 404 for https://dev.915tldr.com/og-image.png
PASS UA probe x: article page — 200 14015 bytes (Twitterbot/1.0)
FAIL UA probe x: EN card — x (Twitterbot/1.0) got status 404 for https://dev.915tldr.com/og-image.png
PASS UA probe slack: article page — 200 14015 bytes (Slackbot-LinkExpanding)
FAIL UA probe slack: EN card — slack (Slackbot-LinkExpanding) got status 404 for https://dev.915tldr.com/og-image.png
PASS UA probe whatsapp: article page — 200 14015 bytes (WhatsApp/2.23.20.0)
FAIL UA probe whatsapp: EN card — whatsapp (WhatsApp/2.23.20.0) got status 404 for https://dev.915tldr.com/og-image.png
PASS robots.txt facebookexternalhit — matches group *; / allowed, article allowed, /og-image.png allowed
PASS robots.txt Twitterbot — matches group *; / allowed, article allowed, /og-image.png allowed
PASS robots.txt Slackbot — matches group *; / allowed, article allowed, /og-image.png allowed
PASS robots.txt WhatsApp — matches group *; / allowed, article allowed, /og-image.png allowed
[verify-share] 92 check(s) FAILED
```
  As expected: every crawler UA gets 200 for the article page and 404 for the card (not deployed). The noindex header did not block any of the four UAs from the page. This is edge-side only; it says nothing about the platforms' own fetchers.

Task 3 (RED 4e741d5 precedes GREEN 17256b6; RED confirmed failing with `ERR_MODULE_NOT_FOUND`):
- `node --test tests/unit/measure-share-fetches.test.mjs`: 9 pass, 0 fail.
- `grep -c '"measure:share": "node tools/measure-share-fetches.mjs"' package.json` printed `1`.
- Live schema check ran against the real API and PASSED (every run introspects first): `ZoneHttpRequestsAdaptiveGroups.count`, `...Sum.edgeResponseBytes`, `...Dimensions.clientRequestPath/userAgent/edgeResponseStatus`, and the filter fields `datetime_geq`, `datetime_lt`, `clientRequestHTTPHost`, `clientRequestPath_in` all exist on this Free-plan zone.
- Visibility probe: `T0=2026-10-09T04:55:30Z`, `curl` of `https://dev.915tldr.com/version.json` returned 200. Poll at 04:55:41 (11 s): no rows. Poll at 04:56:44 (74 s): `/version.json	status 200	1 req	727 bytes/req	UA "curl/8.22.0"`. So dev-host static-asset requests ARE visible in zone analytics, with a lag between 11 and 74 seconds (60 s polling granularity). 07-09 can state the SOC-08 number from edge data.
- A read-only 6-hour query of the default card paths (these are this plan's own earlier probes, all 404 because nothing is deployed):

```
/og-image-es.png	status 404	3 req	4110 bytes/req	file 42524 bytes	UA "node"
/og-image.png	status 404	3 req	4107 bytes/req	file 41539 bytes	UA "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
/og-image.png	status 404	1 req	4113 bytes/req	file 41539 bytes	UA "WhatsApp/2.23.20.0"
/og-image.png	status 404	1 req	4117 bytes/req	file 41539 bytes	UA "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
```
  This also shows the analytics keep the raw User-Agent string.
- `git grep -F -c "$CLOUDFLARE_API_TOKEN"` printed nothing, exit 1 (token value in no tracked file).

## Fast suite totals (`pnpm run test:fast`)

| Run | tests | pass | fail | skipped |
|-----|-------|------|------|---------|
| Before (07-04 end) | 1173 | 1159 | 0 | 14 |
| After Task 1 | 1189 | 1175 | 0 | 14 |
| After Task 2 GREEN | 1196 | 1182 | 0 | 14 |
| After Task 3 GREEN | 1205 | 1191 | 0 | 14 |

No pre-existing or new failures. The suite is red at each RED commit by design (the new test file imports a missing export or module); not run at the RED commits.

## Deviations from Plan

**1. [Process] Tracer gate substituted by an automated re-run.** `workflow.auto_advance` and `_auto_chain_active` are both false, so the executor spec calls for a `checkpoint:human-verify` after the tracer commit. The orchestrator instructed a full autonomous run, so after committing 49c57d0 I re-ran the tracer's automated verify (16 tests pass; three harness runs exit 0) and continued. No human looked at the tracer. Same substitution as 07-01.

**2. [Rule 3 - Blocking] `introspectType` cannot read the filter input type.** `tools/lib/cf-graphql.mjs`'s `introspectType` returns only `fields`, which is `[]` for `ZoneHttpRequestsAdaptiveGroupsFilter_InputObject` (input types use `inputFields`). `measure-share-fetches.mjs` therefore has its own `liveIntrospect` that reads both. The shared library is unchanged.

**3. [Process] Task 2 tests were authored with Task 1 and split out.** I wrote the full test file once, then committed Task 1 without the Task 2 cases and added them in the RED commit, so the RED-before-GREEN order holds as the plan requires.

**4. [Process] First visibility-probe loop gave a false "SEEN".** My `grep -q 'req'` matched the word "requests" in the no-rows message. I re-ran the loop matching `status ` and the numbers above come from that second loop (the request had already been made; `since` stayed at T0). The first poll window had ended 0.5 s after T0, so it carried no information.

**5. [Process] REQUIREMENTS.md not touched.** Frontmatter lists SOC-07 and SOC-08, but this plan only builds the instruments; the validator passes and the numbers are 07-08/07-09. `requirements.mark-complete` was not called.

## Findings for later plans

- `https://dev.915tldr.com/version.json` reports `commit: "main"`, a branch name, not a commit hash. `--expect-stylesheet` is therefore the only reliable way to confirm which build the dev host is serving (current homepage stylesheet `/_astro/Base.h88la9Hn.css`). 07-08 should record this.
- Dev-host 404 responses carry `x-robots-tag: noindex` and are about 4.1 KB on the wire (10,629 bytes of HTML).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-07-12: the token is read from `process.env` only through `cf-graphql.mjs`, errors go through `redact()` (a unit test feeds a token-shaped string through a GraphQL error), `.dev.vars` was never read, and no tracked file contains the token value. T-07-13: the analytics tool contains no mutation, and host, paths and dates are validated and sent as variables (a unit test asserts neither host nor paths appear in the query text). T-07-14: raw User-Agent strings and Cloudflare's own counts are printed and the output states the data is sampled. T-07-15: UA probes are labelled edge-side only.

## Not verified

- Nothing was run against a deployed host that carries the tags: every PASS path for live pages is covered by unit fixtures and the head-harness pages only; the live host was only ever seen failing.
- `SCRAPER_USER_AGENTS` are representative strings, not the platforms' real ones, and the probes come from this machine, so they say nothing about the platforms' own fetchers, IPs or their behaviour against a noindex host (D-20 platform half is 07-09).
- The robots.txt parser handles groups, `*` and `$` patterns, longest match; it is not a full RFC 9309 implementation and was tested against `public/robots.txt` plus small fixtures only.
- Zone-analytics lag was bracketed (11 to 74 s), not measured precisely, from a single request.
- No typecheck, no full build, no browser, no dev server.

## Cleanup needed

None.

## Self-Check: PASSED

- FOUND: tools/verify-share-meta.mjs, tests/unit/verify-share-meta.test.mjs, tools/measure-share-fetches.mjs, tests/unit/measure-share-fetches.test.mjs
- FOUND commits: 49c57d0, b4c941c, 9879822, 4e741d5, 17256b6

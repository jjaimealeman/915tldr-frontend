# 2026-09-30 - derive-hot-window tracer: live human-traffic parsers, age math, proved against real traffic

**Keywords:** [BACKEND] [INFRA] [TESTING] [PLANNING]
**Session:** Late evening, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2349_derive-hot-window-tracer-live-human-traffic-parsers.md`

## What Changed

- File: `tools/derive-hot-window.mjs` (new)
  - `parseArticleRequestPath`/`classifyPayloadPath`/`parseTagRequestPath`: pure parsers for the
    only URL shapes that count toward the hot-window derivation (article pages, their Nuxt
    `_payload.json` client-navigation requests, and tag pages) — everything else (`/cdn-cgi/rum`,
    `/_nuxt/*`, `/api/_nuxt_icon/*`, category listing pages, a crafted path with no uuid) is
    excluded by construction.
  - `requestAgeDays`/`requestAgeHistogram`: whole-UTC-day request age, clamped to 0 and flagged
    an anomaly if a publish date is somehow after the request day.
  - `summarizeDayRows`: classifies one day's bot-filtered rows against the build's real tier
    facts (matched/unmatched article requests, payload requests, matched/unmatched/static/archive
    tag requests) — every row lands in exactly one bucket or none.
  - `buildLiveFetchDay`/`fetchAggregateTotal`/`fetchPathGroupRows`: the live Cloudflare GraphQL
    fetch layer (zone-scoped `httpRequestsAdaptiveGroups`, no account id needed), with automatic
    hourly-query splitting if a day saturates the row limit.
  - `--probe-day` CLI mode: runs one real day's human-traffic query end to end and prints the
    matched count and the bot filter's share removed.
- File: `tests/unit/derive-hot-window.test.mjs` (new)
  - 25 unit tests covering every parser, the age math, `summarizeDayRows`, and a fixture-driven
    test proving the day pipeline reproduces the exact matched/unmatched/payload counts a live
    run printed for one real day of production traffic.
- File: `tests/fixtures/zone-analytics/day-sample.json` (new)
  - A real, scrubbed-of-identifiers capture of one day's `/crime/` traffic from 915tldr.com
    (zone `70a6176e850ecde50ab6f41d56ffddb4`), with the chosen bot filter already applied.

## Why

Phase 5's REND-10 requires the hot-article cutoff to be derived from real reader traffic, not a
guess. This tracer proves the hardest unknown first: whether this Free-plan zone's Cloudflare
GraphQL Analytics dataset can actually distinguish human article reads from bot/crawler noise.
Live introspection and a live query this session settled it: `botScore`/`botScoreBucketBy10` are
NOT accessible on this zone (Bot Management is a paid add-on this zone doesn't have — confirmed
by a live "does not have access to the field" error), but `verifiedBotCategory` IS populated with
real values ("AI Search", "Search Engine Optimization", "Search Engine Crawler", "AI Crawler",
"Security") even inside `requestSource: "eyeball"` traffic. The chosen filter is therefore
`requestSource:eyeball AND verifiedBotCategory:""`, with `userAgent` token exclusions (several
case variants each) applied as a floor on top, exactly as the plan's context instructed when the
strongest *populated* signal, not the strongest theoretically-available one, had to be chosen.

## Issues Encountered

- `botScoreBucketBy10` is schema-visible via introspection but access-denied at query time on this
  Free-plan zone — a live-only failure mode introspection alone couldn't reveal; had to actually
  run a data query to discover it. Documented in the module header and the `botFilter` field of
  every derived record, rather than assumed from the schema listing alone.
- Cloudflare's GraphQL filter type has `_notlike` but no case-insensitive `_notilike` negation, so
  excluding bot user-agent tokens needed multiple `_notlike` clauses (one per case variant) ANDed
  together via the filter's `AND: [...]` array — confirmed live that passing the whole filter
  object (including the nested `AND` array) as a GraphQL *variable* works, where expressing the
  same thing as literal query text with a repeated field name would not.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every parser's accept/reject shapes, the age-math boundary and anomaly case,
  `summarizeDayRows`'s bucket exclusivity, and a fixture-driven cross-check against this build's
  real tier facts reproducing the exact live-measured counts (174 matched, 0 unmatched, 33
  payload) for the captured day.
- What wasn't tested: the hourly-saturation-split path (`fetchPathGroupRows`'s fallback branch)
  has no unit test — this zone's real traffic volume (145 rows/category/day) never approaches the
  9,999-row limit, so the branch is exercised only by code review, not a live or fixture run.
- Edge cases: a crafted path with no uuid at all (`/crime/this-page-has-no-uuid-in-it-at-all`,
  13 real requests in the captured day) correctly falls into neither bucket, proving the
  tamper-resistance design (T-05-20) holds against real traffic, not just synthetic test input.

## Next Steps

- [ ] Task 2: coverage-cutoff math, file-budget cap, atomic write, and the D-07 fallback writer
- [ ] Task 3: run the live 30-day derivation, write `hot-window.json`, document the method

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new build-time tool and tests only; no production code path changed yet

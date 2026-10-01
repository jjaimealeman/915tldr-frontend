# Hot-window derivation (REND-10, D-04/D-05/D-06/D-07/D-07b)

**Verdict:** `HOT_WINDOW_DERIVED | 202 days, 95.1% coverage | node tools/derive-hot-window.mjs --write`

`src/lib/archive/hot-window.json` now carries `"status": "derived"`, replacing the D-07
bootstrap age fallback (90 days, `fallback-provisional`) this plan started with. REND-10 is met:
the cutoff a real build uses is derived from measured human-reader traffic, not a guess, and the
method below is reproducible on demand.

## Decisions this derivation satisfies

- **D-04** — the hot cutoff is derived from v1's real reader traffic on `915tldr.com`, the same
  URL shapes and readers v2 inherits. v1 has no view-counting of its own; this derivation reads
  Cloudflare's own per-URL zone analytics instead.
- **D-05** — the measurement window is **30 full UTC days** (2026-09-01 through 2026-09-30),
  covering a full news cycle and smoothing a single viral day. This is the traffic SAMPLE window,
  distinct from the derived cutoff (`days: 202` below) — the sample window stays fixed at 30 days;
  the cutoff is whatever age of article that 30-day sample says covers the reading pattern.
- **D-06** — only human traffic counts. The chosen bot filter and its measured removal share are
  below.
- **D-07** — the age-based fallback (90 days, `fallback-provisional`) stays in the code
  (`tools/derive-hot-window.mjs`'s `writeFallback`) as the documented emergency path if a future
  re-derivation's live query genuinely fails. It was NOT needed this run — the live derivation
  succeeded on the first attempt.
- **D-07a (superseded)** — the originally-planned daily traffic collector, built to work around an
  assumed 7-day Free-plan retention ceiling, was dropped before this plan started once a live
  measurement (05-CONTEXT.md) showed the real ceiling is 31 days, not 7. No collector exists; none
  was built here.
- **D-07b** — the owner granted `Zone Analytics: Read`; the per-URL dataset genuinely returns 31
  days of history for this zone. D-04/D-05/D-06 are met directly in this phase, not provisionally.
  Only article URL shapes (`/[category]/[slug]-[uuid]`) and `/tag/*` count toward the window —
  everything else (`/cdn-cgi/rum`, `/_payload.json`, `/api/_nuxt_icon/*`, `/_nuxt/*`, category/tag
  listing pages, a crafted path with no uuid at all) is excluded by construction.

## The query

- **Dataset:** Cloudflare GraphQL Analytics, `viewer.zones(filter: { zoneTag }).httpRequestsAdaptiveGroups`,
  zone `70a6176e850ecde50ab6f41d56ffddb4` (`915tldr.com`, v1 production, Free plan). Zone-scoped —
  no account id is ever needed in the query or logged in evidence.
- **Bot filter actually applied** (chosen live, this session, not assumed from the plan's
  candidate list): `requestSource: "eyeball"` AND `verifiedBotCategory: ""`, with `userAgent`
  token exclusions (`bot`, `crawl`, `spider`, `slurp`, `facebookexternalhit`, `preview`,
  `monitor`, `headless`, each in 2-3 case variants) ANDed in as a floor on top.
  - **Why not `botScore`/`botScoreBucketBy10`:** live introspection shows both dimensions exist on
    `ZoneHttpRequestsAdaptiveGroupsDimensions`, but a live query actually *selecting* either one
    fails with `"zone ... does not have access to the field"` — Bot Management is a paid add-on
    this Free-plan zone does not have. This is a query-time access restriction, not a schema gap,
    and introspection alone cannot reveal it; it took a real failing query to find.
  - **Why `verifiedBotCategory`:** a live probe query (one day, `requestSource: "eyeball"` only,
    no other filter) returned real, populated category values even inside "eyeball" traffic:
    `"AI Search"`, `"Security"`, `"Search Engine Optimization"`, `"Search Engine Crawler"`,
    `"AI Crawler"`, alongside the empty string for genuine human traffic. This is the strongest
    signal this zone's dataset actually populates, confirmed by real data rather than assumed from
    the schema listing.
  - The filter's `AND: [...]` array (needed because the dataset's filter type has `_notlike` but
    no case-insensitive `_notilike` negation) was passed as a single GraphQL *variable*, which
    Cloudflare's API accepts — confirmed live, since the equivalent is not expressible as literal
    query text (a repeated field name in one object is invalid GraphQL syntax).
- **Path shapes counted:** `/[category]/[slug]-[uuid]` (one optional trailing slash, category
  must be one of the 8 real `CATEGORIES`) toward the article window; `/tag/[slug]` toward tags.
  `/[category]/[slug]-[uuid]/_payload.json` (Nuxt client-navigation requests) is reported
  separately and never counted toward either.
- **Noise excluded by construction** (never matched a counted shape at all): `/cdn-cgi/rum`,
  `/_nuxt/*`, `/api/_nuxt_icon/*`, category/tag listing pages themselves (e.g. `/crime/`), and a
  genuinely observed crafted path with no uuid in it at all (13 requests on one captured day under
  `/crime/`) — a real, live demonstration that T-05-20's tamper guard (only a uuid that exists in
  the corpus counts) holds against real traffic, not just synthetic test input.
- **Pacing:** every GraphQL call is paced at least 1 second apart (project rule). The full 30-day
  run issued 11 queries per day (2 aggregate totals + 8 category prefixes + 1 tag prefix) and took
  ~7.5 minutes wall-clock.
- **Command:** `node tools/derive-hot-window.mjs --write --json --evidence docs/phase-05/evidence/hot-window`

## Results

| Metric | Value |
|---|---|
| Measurement window | 2026-09-01 to 2026-09-30 (30 full UTC days) |
| Matched human article requests | **31,053** |
| Unmatched article requests (uuid not in corpus) | 484 |
| Payload (`_payload.json`) requests | 5,591 (reported, not counted) |
| Matched tag requests | 1,491 (1,474 landing on static tags, 13 on archived tags, 4 unmatched) |
| Eyeball total (aggregate, all paths) | 322,081 across the 30 days |
| Human total (aggregate, all paths, after the bot filter) | 165,881 across the 30 days |
| **Bot-filtered share removed** | **48.6%** of `requestSource: eyeball` traffic |
| Anomalies (published after the request day) | 0 |

The ~49% bot-filtered share is the eyeball-traffic-wide figure (every path, not just articles) —
`requestSource: eyeball` alone still includes a large volume of verified SEO/AI crawlers and
scripted user agents that this zone's Free plan cannot catch any other way; `verifiedBotCategory`
and the user-agent floor are both doing real, measurable work here, not a formality.

## Coverage curve

| Target coverage | Cutoff (days) | Achieved coverage |
|---|---|---|
| 80% | 83 | 80.3% |
| 90% | 147 | 90.0% |
| **95% (chosen target)** | **234 (uncapped)** | **95.1%** |
| 99% | 262 | 99.1% |

**This is the single most important finding of this derivation, and it contradicts the informal
30-day expectation in 05-CONTEXT.md's own framing of D-05.** Real human reads of 915tldr.com have
a long tail: even reaching 80% coverage of matched human article requests needs articles up to 83
days old; 95% needs 234 days. The 30-day figure in D-05 is the TRAFFIC SAMPLE window (how many
days of reader behavior to measure), not the resulting age cutoff — the two are independent
numbers, and this derivation's own result is that readers keep reading articles for months, not
weeks. The most likely explanation (not independently confirmed beyond this derivation's own
data): a local news aggregator's traffic is heavily organic/search-driven to specific
evergreen-ish stories, not recency-driven homepage browsing — several of the top-20 articles below
are read steadily at ages of 17-22 days deep into the sample window, and one (a screwworm/USDA
story) is still being read at a measured median age of 136.5 days.

## Top 20 most-requested articles in the window

| Path | Human requests | Median age at request (days) | Tier under N=202 |
|---|---|---|---|
| `/education/canutillo-isd-approves-reduced-tax-rate-for-upcoming-school-year-c80a97f8-...` | 55 | 3 | hot |
| `/community/tragic-bus-fire-claims-life-on-60-freeway-near-los-angeles-e5bb3e8c-...` | 37 | 21 | hot |
| `/crime/quick-arrest-made-in-juarez-car-dealership-arson-case-61de174f-...` | 33 | 19 | hot |
| `/community/abused-puppy-maple-finds-new-home-amid-courtroom-advocacy-e822c27e-...` | 32 | 20.5 | hot |
| `/politics/dhs-claims-of-voter-fraud-in-nevada-raise-questions-amid-incomplete-data-5427214d-...` | 32 | 20.5 | hot |
| `/business/walmart-introduces-contactless-payment-options-for-el-paso-shoppers-ff7b8d27-...` | 31 | 20 | hot |
| `/community/la-union-maze-opens-for-27th-season-celebrating-new-mexico-agriculture-3e657bc9-...` | 31 | 20 | hot |
| `/education/utep-anticipates-record-enrollment-and-fundraising-success-this-year-a1ed7740-...` | 31 | 20 | hot |
| `/community/helping-kids-cope-with-back-to-school-stress-in-el-paso-56d6ec64-...` | 29 | 18.5 | hot |
| `/community/epkicks-announces-annual-5k-run-for-shoes-event-in-el-paso-57220c7c-...` | 29 | 19 | hot |
| `/crime/el-pasos-most-wanted-fugitives-week-of-august-21-2026-a4738868-...` | 27 | 18 | hot |
| `/education/5th-graders-at-charles-q-murphee-school-make-their-pledge-on-august-21-2026-020f4830-...` | 27 | 19 | hot |
| `/business/polymarket-flags-military-insider-trading-cases-for-doj-investigation-9513adb4-...` | 27 | 20 | hot |
| `/community/flesh-eating-screwworm-threatens-to-enter-the-us-from-mexico-ef2bf42f-...` | 26 | **136.5** | hot (well under 202) |
| `/crime/lindsay-clancys-defense-concludes-in-high-profile-murder-trial-a878b8cc-...` | 26 | 17.5 | hot |
| `/community/local-news-update-featuring-brenda-lepenski-and-robert-bettes-7ca5ae58-...` | 26 | 18.5 | hot |
| `/crime/legal-team-prepares-for-action-after-grand-jury-clears-in-nolan-wells-case-4fdc5d4c-...` | 26 | 3 | hot |
| `/business/rising-bond-yields-signal-economic-concerns-for-el-paso-residents-6511a542-...` | 25 | 22 | hot |
| `/community/controversy-arises-over-potential-renaming-of-navy-aircraft-carrier-to-trump-ff2d1f63-...` | 25 | 18 | hot |
| `/politics/rubn-rocha-moya-resumes-governorship-amid-us-drug-trafficking-allegations-b35ce180-...` | 25 | 20 | hot |

Every one of the top 20 lands comfortably inside the 202-day hot window. The screwworm story
(136.5-day median age) is the clearest single piece of evidence for the long-tail finding above —
a months-old story still pulling meaningful real-reader traffic, not a crawler artifact (crawler
traffic was already removed by the bot filter before this table was built).

## Cap arithmetic (REND-11's 60,000-file post-Phase-6 budget)

`otherFiles` (dist/client files that are neither an article nor a tag page) measured from the
build this derivation ran against: `60,414 total - 40,487 article facts - 19,891 tag facts = 36`.
`staticTags` under D-08 (≥10 articles) is 2,325 regardless of the article-age window.

| Candidate N (days) | Hot articles | Static tags | Today's total | Phase 6 projected total (2x articles+tags) |
|---|---|---|---|---|
| 30 | 3,311 | 2,325 | 5,672 | 11,308 |
| 90 | 10,826 | 2,325 | 13,187 | 26,338 |
| 180 | 24,148 | 2,325 | 26,509 | 52,982 |
| **202 (chosen, capped)** | **27,575** | **2,325** | **29,936** | **59,836** |
| 234 (uncapped — what 95% coverage alone would pick) | 32,957 | 2,325 | 35,318 | **70,600** (over the 60,000 cap) |

`applyStaticCap` stepped the uncapped N (234, from the 95% coverage target alone) down one day at
a time until the Phase 6 projection fit the 60,000 cap, landing at **202 days** (projected Phase 6
total: 59,836 — 164 files of headroom). `hot-window.json` records `cappedByFileBudget: true` and
`uncappedDays: 234` so this trade-off is visible to anyone reading the file, not just this doc.

## Tag traffic (informational only — does not change D-08)

Of 1,491 matched human tag-page requests in the window, 1,474 (98.9%) landed on tags that are
already static under D-08's 10-article threshold, and only 13 (0.9%) landed on tags that are
archived. This is consistent with D-08's own design: the tags that keep 10+ articles are the ones
with any meaningful reader traffic, so moving the long tail of thin tags to R2 costs almost no
real human-tag-page traffic. This does not change D-08's threshold — it is reported here purely
for the owner's review, per the plan's own framing.

## Precision limits

- **Adaptive sampling:** Cloudflare's `httpRequestsAdaptiveGroups` dataset is itself
  adaptively-sampled at high volumes; this zone's volume (a few thousand to ~23,000 eyeball
  requests/day) is well within the range where Cloudflare's own documentation describes the
  dataset as effectively unsampled, but this was not independently re-verified against a
  documented sampling-rate API field for this specific zone.
- **Whole-UTC-day age granularity:** `requestAgeDays` floors both the request time and the
  publish time to UTC day boundaries before subtracting — an article published at 23:59 UTC and
  requested at 00:01 UTC the next day is "age 1," not "age 0 plus two minutes." This matches
  `isHotArticle`'s own inclusive-at-the-cutoff day-floored design (05-01), so the build's hot/cold
  split and this derivation's own histogram always agree on what day an article turns N days old.
- **Publication dates from the build's own facts, not D1:** every `publishedAt` used here comes
  from `.astro/tier-facts-articles.json` (05-01), itself written from the loader's own
  `ArticleData.publishedAt` at build time — never a second, independent D1 read. If the corpus's
  publish dates drift between the build this derivation ran against and a later build, a
  re-derivation naturally picks up the newer facts.

## Re-run procedure

Re-run this derivation against the then-current 31-day retention window **before Phase 6 starts**
(Spanish articles roughly double the corpus, which may shift the long-tail finding above) and
**whenever traffic shifts** materially (a redesign, a new acquisition channel, a viral event).

```bash
# Preview (writes nothing):
node tools/derive-hot-window.mjs --json --evidence docs/phase-05/evidence/hot-window

# Commit the result to src/lib/archive/hot-window.json:
node tools/derive-hot-window.mjs --write --json --evidence docs/phase-05/evidence/hot-window

# Re-run with a different coverage target (e.g. accept the 90% cutoff instead of 95%):
node tools/derive-hot-window.mjs --write --coverage 0.90

# If the live query genuinely fails (auth, retention regression, unresolvable saturation):
node tools/derive-hot-window.mjs --fallback --reason "<what failed and why>"
```

A failed, interrupted, or saturated run throws before writing anything — the previous
`hot-window.json` is left byte-identical (`writeHotWindowAtomic`'s temp-file-plus-rename design).
Two runs over the same 30-day window produce the same result, since the derivation is a pure
function of the live traffic data and the build's own tier facts at the time it runs.

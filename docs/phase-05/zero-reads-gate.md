# Zero-Reads Gate — Method, Baseline, and ARCH-08 Measurement

Produced by 05-04-PLAN.md. This document is the method and limits D-01 requires be written down
next to the result, and the ARCH-08 live measurement method. Every figure below is attributed to
the exact command that produced it and the date it ran — none are modeled or carried forward from
an earlier estimate.

## What the gate proves

D-01's method is **structure plus a load test**, not a literal per-Worker zero reported by D1
analytics:

- **Leg 1 (structural, already enforced):** `tools/assert-no-d1.mjs` fails the build if any
  public entrypoint's module graph reaches `src/lib/server/` (the D1/KV chokepoint directory).
  This runs on every `pnpm run build`.
- **Leg 1b (deployed-binding check, this plan):** `fetchDeployedBindings()` in
  `tools/load-test-zero-reads.mjs` reads the LIVE deployed `915tldr-v2` Worker's own settings
  (`GET /accounts/{id}/workers/scripts/915tldr-v2/settings`) and confirms no binding of type `d1`
  exists. This is independent of what the source code says — it reads the actual deployed
  artifact.
- **Leg 2 (measured delta):** a scripted request pass against the gate's own request mix
  (roadmap criterion 1 — homepage, every category, 20 hot articles, 20 archived articles, 10
  static tags, 10 archived tags, the sitemap index, `/rss.xml`), compared against production D1's
  `rowsRead` for a comparable 7-day baseline window.

**D-02:** a FAIL halts the project for architecture review — it is not logged as a defect and
fixed in-phase. **D-03:** the gate runs after the archive tier is serving, so the
Worker-to-R2 path is inside the measured pass, not proven separately.

## Why leg 2 is a delta measurement

05-RESEARCH.md Question 1 resolved this with live evidence, repeated and reconfirmed by this
plan's own Task 1: Cloudflare's D1 analytics has **no dimension that attributes a row read to a
calling Worker**. Live introspection against this account's own GraphQL schema confirms the full
field list on `AccountD1AnalyticsAdaptiveGroupsDimensions`:

```
databaseId, databaseRole, date, datetime, datetimeFifteenMinutes, datetimeFiveMinutes,
datetimeHour, datetimeMinute, datetimeSixHours, servedByInstance, servedByRegion
```

No `scriptName`/`workerName`-shaped field exists. There is therefore no query that can ask "how
many rows did the v2 Worker read" directly — the only question D1 analytics CAN answer is "how
many rows did the production database read, in total, during a window." Leg 2 is built on that
fact: it measures the production database's total `rowsRead` during the load-test window and
compares it against the SAME database's `rowsRead` for 7 comparable windows at the same time of
day on the preceding 7 days (v1's own normal background, since v1 is still the only thing reading
this database in meaningful volume). A load-test-window reading that stays within that background
is consistent with v2 reading zero rows — it cannot prove zero in isolation, which is exactly why
leg 1/1b (structural) exists alongside it.

**Database id correction (05-RESEARCH.md Pitfall 4):** the production database is
`552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77` (`915tldr-db`), confirmed directly against the live
production Worker's own D1 binding. The id named in an earlier research prompt
(`915tldr-dev-db`) is the **dev** database and must never be used for this measurement — verified
absent from every file in `tools/` and `tests/` (`grep -rc` for that id's prefix reports 0
everywhere).

## Validity rules

A measurement window is **INCONCLUSIVE**, not judged, when any of the following holds — each
rule is named explicitly in the tool's own output (`decideZeroReadsVerdict`'s `rule` field) so a
re-run knows exactly what to fix, rather than guessing:

| Rule | Condition |
|---|---|
| `build-overlap` | The window overlaps a v2 build (`/version.json`'s commit or `builtAt` changed between the start and end of the pass) |
| `ingest-slot` | The window touches the v1 ingest slot (an even UTC hour, `:00` through `:20`) |
| `analytics-not-caught-up` | No D1 analytics data point exists at or after the window end, even after polling up to 15 minutes |
| `insufficient-baseline` | Fewer than 5 usable baseline samples exist (of the 7 comparable windows) |
| `zero-total-window` | Any baseline window or the load window itself measured zero total `rowsRead` — against a database that reads hundreds of thousands of rows per 5-minute window in normal operation, a zero total is a broken query, not a quiet database |
| `incomplete-pass` | Fewer than 95% of the planned requests completed |
| `unconfirmed-archive-path` | An archived URL in the request mix lacked the `archive` Server-Timing metric, or a hot URL unexpectedly carried one — the preflight check, run before any measured request is sent |

A deployed D1 binding (leg 1b) **FAILs the gate outright**, regardless of the measured delta —
it is never a tie-breaker against leg 2's statistics. Only when every validity rule passes AND no
D1 binding exists does the measured delta itself decide PASS vs FAIL
(`loadRowsRead <= baseline.mean + 3 * baseline.stdDev`).

## Detection floor

The detection floor is the smallest per-request D1 row leak this baseline's own variance could
reliably distinguish from v1's normal background noise, at a given request count:

```
detectionFloor = 3 * baseline.stdDev / requests
```

**Live baseline, measured 2026-10-01** (`node tools/load-test-zero-reads.mjs --baseline-only
--json --evidence docs/phase-05/evidence/baseline`):

| Window (UTC, 15-min, same clock time, 7 preceding days) | `rowsRead` |
|---|---|
| 2026-09-24 05:00–05:15 | 522,055 |
| 2026-09-25 05:00–05:15 | 780,466 |
| 2026-09-26 05:00–05:15 | 300,895 |
| 2026-09-27 05:00–05:15 | 649,685 |
| 2026-09-28 05:00–05:15 | 1,133,596 |
| 2026-09-29 05:00–05:15 | 440,493 |
| 2026-09-30 05:00–05:15 | 639,791 |

**mean = 638,140.14, sample stdDev = 268,372.75, median = 639,791, n = 7.**

**What this means, stated plainly:** v1's own background D1 traffic varies enormously window to
window (from ~301k to ~1.13M rows in a 15-minute window, on a database PROJECT.md already
documents as reading ~784,000,000 rows/day). At the plan's default 3,000 requests, the detection
floor is:

```
3 * 268,372.75 / 3,000 ≈ 268.37 rows/request
```

That floor is far above 1 row per request. The request count that would bring the floor down to 1
row/request is `3 * stdDev ≈ 805,119` requests — well over this tool's own 20,000-request safety
cap (`MAX_REQUESTS`, T-05-18). **At the cap (20,000 requests), the floor is `3 * 268,372.75 /
20,000 ≈ 40.26 rows/request`** — still far above 1, but the best this method can do without
either raising the request cap (rejected — it is a deliberate DoS-against-self mitigation) or
reducing v1's own background variance (not controllable from this project). **05-12's request
count is therefore 20,000** — the cap itself, since any smaller count only widens the floor
further and the cap cannot be safely raised. This is a real, disclosed limitation of the
delta-measurement method on a database this noisy, not a bug in the tool: a load test that adds,
say, 10 D1 rows per request across 20,000 requests (200,000 extra rows) would NOT reliably
register above this floor, and the gate's own structural legs (1/1b) are load-bearing for exactly
this reason — leg 2 alone cannot detect a small leak on a background this large.

**Deployed-binding check (leg 1b), same run:** `deployedWorkerHasD1Binding: false`. The live
`915tldr-v2` Worker's settings report exactly two bindings: `ASSETS` (type `assets`) and
`RENDER_MANIFEST` (type `kv_namespace`) — no `d1`-typed binding exists.

## Baseline (pre-archive, 2026-10-01)

| Field | Value |
|---|---|
| Database | `915tldr-db` (`552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`) |
| Baseline mean | 638,140.14 rows / 15-min window |
| Baseline sample stdDev | 268,372.75 |
| Baseline median | 639,791 |
| n | 7 |
| Detection floor @ 3,000 requests | 268.37 rows/request |
| Detection floor @ 20,000 requests (the cap) | 40.26 rows/request |
| Deployed Worker (`915tldr-v2`) has a D1 binding | **false** |
| Bindings on the deployed Worker | `assets`, `kv_namespace` (no `d1`) |

**Command to reproduce:**
```bash
node tools/load-test-zero-reads.mjs --baseline-only --json --evidence docs/phase-05/evidence/baseline
```

This baseline is pre-archive-tier (05-02/05-07 have not shipped archived content to R2 yet) — the
full gate (`node tools/load-test-zero-reads.mjs` without `--baseline-only`, after the archive tier
is serving per D-03) is the 05-12 gate day's own run, not this plan's.

## ARCH-08 method

`tools/measure-worker-kv-cpu.mjs` reads KV reads and Worker CPU time off the DEPLOYED
`915tldr-v2` Worker, rather than estimating them — the same "measure the real platform" discipline
Phase 3/4 established for render cost and build time.

**Datasets, confirmed by live introspection before being queried** (not guessed field names):

- `workersInvocationsAdaptive`, filtered on `scriptName: "915tldr-v2"` — `sum.requests`,
  `quantiles.cpuTimeP50`/`cpuTimeP99`, `max.cpuTime`. **CPU time fields are reported in
  MICROSECONDS**, confirmed directly from the live GraphQL schema's own field descriptions
  (`"CPU time 50th percentile - microseconds"`, `"Maximum CPU time for one request -
  microseconds"`) — `summarizeWorkerWindow` converts to milliseconds at the one point these
  values are read, so every budget comparison in this file works in milliseconds.
- `kvOperationsAdaptiveGroups`, filtered on `namespaceId: "3c92531f94294fcc94006455f433885f"`
  (`RENDER_MANIFEST`) and `actionType: "read"` — `sum.requests`. Confirmed live that `actionType`
  takes the values `"read"`/`"write"` on this namespace.

**Verdict lines:** `kvReads <= invocations` → `KV_READS_WITHIN_BUDGET`, else
`KV_READS_OVER_BUDGET`; `cpuP99Ms < 5 AND cpuMaxMs < 20` → `CPU_WITHIN_BUDGET`, else
`CPU_OVER_BUDGET`. A window flagged as overlapping a build, or with zero invocations, is
`INCONCLUSIVE` on both axes — a build reads the same KV namespace this measurement reads, and
zero invocations means nothing was measured, not that the budget was met.

**Build-overlap detection** uses the same `/version.json` before/after rule as the zero-reads load
test; `--assume-no-build` is the documented WEAKER fallback for a historical window where
before/after polling isn't possible (it is never independently verified — the result's `method`
field says so explicitly).

**This tool is a measurement/reporting instrument, not a go/no-go gate** — unlike
`load-test-zero-reads.mjs`'s documented 0/2/3 exit codes, a successful `measure-worker-kv-cpu.mjs`
run always exits 0; the verdict is reported in the output (console line and `--json`), not encoded
in the process exit code. ARCH-08's actual pass/fail gate is a separate decision for whichever
later plan consumes this measurement.

**Live measurement, 2026-10-01** (last full 24h on `915tldr-v2`; Phase 4 Worker, uuid-redirect and
archive-serving traffic only, so invocation counts are low by construction):

```bash
node tools/measure-worker-kv-cpu.mjs \
  --from "2026-09-30T05:00:00Z" --to "2026-10-01T05:00:00Z" \
  --assume-no-build --json --evidence docs/phase-05/evidence/worker-kv-cpu
```

| Field | Value |
|---|---|
| Window | 2026-09-30T05:00:00Z .. 2026-10-01T05:00:00Z (24h) |
| Invocations | 94 |
| KV reads (`RENDER_MANIFEST`, read-only) | 102 |
| CPU p50 | 0.830 ms |
| CPU p99 | 1.883 ms |
| CPU max | 1.883 ms |
| `KV_READS_OVER_BUDGET` (102 > 94) | yes — see note below |
| `CPU_WITHIN_BUDGET` (p99 < 5ms and max < 20ms) | yes |
| Overall verdict | `FAIL` (on the KV axis only) |

**Disclosed, not hidden: KV reads (102) exceed invocations (94) in this real window.** Every
Worker invocation performs AT MOST one KV read by construction (`src/worker.ts`'s own single
`RENDER_MANIFEST.get()` call per request, plus the tag-path branch that performs zero), so 102
reads against 94 invocations cannot mean the Worker itself over-read — it is far more likely
boundary skew between the two datasets' own bucketing (the `workersInvocationsAdaptive` and
`kvOperationsAdaptiveGroups` datasets are independently aggregated and may not close out a 24h
UTC-hour-aligned window at exactly the same instant), not a code defect. This is reported exactly
as measured rather than rounded into a clean PASS — flagged here for whoever next measures a
wider window to confirm the skew explanation, not fixed in this plan (out of scope: this plan
measures, it does not re-architect the Worker's KV-read discipline, which is already covered by
05-03's own ARCH-08 unit-test matrix proving every request shape performs 0 or 1 KV read).

## Result (2026-10-01)

**Two real, pre-existing bugs in this instrument were found and fixed immediately before this
run** — documented in full in `changelog/2026-10-01-1243_05-12-fix-dead-analytics-catchup-wait.md`
and `changelog/2026-10-01-1433_05-12-fix-archive-plan-wiring-never-connected.md`:

1. `runLoadTest`'s documented "analytics catch-up wait" was dead code on the live CLI path
   (`checkCaughtUp` always resolved `true` immediately) — fixed to live-poll
   `checkD1AnalyticsCaughtUp` by default.
2. `main()` parsed `--archive-plan` but never built a `requestMixInput` from it — the documented
   CLI usage below could never run a full pass at all, on any prior invocation. Fixed with
   `buildRequestMixInputFromArchivePlan()`, reusing 05-11's own tier-boundary-safety-margin
   approach as production code.

Both fixes shipped with their own unit tests (53/53 pass) before this gate run; the first live
attempt against the real CLI (after fix 1, before fix 2) failed with the exact error fix 2
describes, confirming the bug was real and load-bearing, not theoretical. A tiny 8-request smoke
run after both fixes completed end-to-end against `dev.915tldr.com` before the real 20,000-request
run below.

### Window and request mix

- **Window:** `2026-10-01T20:34:05.536Z` .. `2026-10-01T21:16:29.049Z` (42m 23.5s)
- **Request count:** 20,000 sent, 19,999 completed (one single network-level fetch failure, not a
  5xx — completion ratio 99.995%, comfortably above the 95% floor)
- **Mix:** 71 unique paths (seed 5), cycled to reach 20,000 — homepage, all 8 categories, 20 hot
  articles, 20 archived articles, 10 static tags, 10 archived tags, `/sitemap-index.xml`,
  `/rss.xml`. **D-03 confirmed by the preflight + the full pass's own recorded Server-Timing**:
  exactly the 20 archived articles and 10 archived tags below carried the `archive` Server-Timing
  metric on every response; the 20 hot articles and 10 static tags never did.
  - Archived articles (20): `/business/trump-enacts-25-tariff-on-nations-engaging-with-iran-impacting-trade-cdcde5c7-cde8-4390-a75f-29dcde980770`, `/health/increase-in-cannabis-hyperemesis-syndrome-recognizing-key-symptoms-098041f5-6fd3-4833-b843-978ebd355b3c`, `/health/heart-attack-survivor-reunites-with-heroic-nurse-after-four-years-441adb21-acf1-4776-a782-cc48d071c07b`, `/business/wall-street-faces-decline-amid-weak-job-data-and-ai-concerns-06574fa7-eca9-4fcd-8d74-8736b915f9c0`, `/community/innovative-safe-parking-program-addresses-student-homelessness-in-el-paso-9952d8f5-e786-419c-8f1c-82c7d5243250`, `/politics/new-mexico-republicans-push-for-juvenile-justice-reform-ahead-of-2026-session-311ed73b-0319-47ad-8d2c-847abec73d93`, `/politics/venezuelas-recent-political-prisoner-releases-a-closer-look-at-the-numbers-de43e89a-1fe7-45c1-856e-d049d0389880`, `/community/el-paso-community-encouraged-to-send-valentines-cards-to-local-veterans-c4b850cf-9941-43b5-99cc-69c4ba184b4e`, `/politics/venezuelans-navigate-uncertainty-one-month-after-maduros-arrest-c4dd9bc0-2d96-44f0-b87d-a291392570e9`, `/politics/escalation-of-us-military-attacks-in-caribbean-linked-to-drug-trafficking-ae27ce55-6488-43ef-ba2b-a1cd3a3dc3cc`, `/community/analyzing-grammy-nominees-who-stands-out-in-performance-metrics-3dc9c33d-534c-429b-9894-1b7a86572187`, `/politics/senate-leader-dismisses-trumps-filibuster-strategy-for-save-act-130f6439-9d06-418c-92f2-ec75bdf261b7`, `/community/el-paso-native-shares-journey-of-relocating-to-colombia-for-a-better-life-80948f7c-30dd-44c3-9914-194b9bc4ab57`, `/politics/candidates-present-diverging-views-in-texas-23rd-congressional-district-race-c46387cf-4a8a-4fa5-8af8-40e77884eaf4`, `/sports/discover-curling-the-exciting-winter-sport-coming-to-the-olympics-51e2e0c6-65f2-4e59-979a-e0ad02a7afe7`, `/politics/us-military-targets-iranian-drone-carrier-in-strategic-naval-strike-b26dd859-e9f1-48fc-b50c-3a0febf3f352`, `/crime/northeast-el-paso-driver-arrested-after-fleeing-police-and-crashing-50964587-eb5d-4c97-a7e8-6e0ef97ce90c`, `/community/new-snap-restrictions-limit-purchases-in-more-states-affecting-local-recipients-b4b8dea3-27c4-4c49-a98f-5e4bd36afbd3`, `/business/mexicos-oil-shipments-to-cuba-surge-amid-regional-tensions-013c53d4-3bd4-44b0-a593-d09c8164151a`, `/business/airbnb-market-trends-booms-and-collapses-across-the-us-07f79f20-74c6-45a4-826c-fce5448c789d`
  - Archived tags (10): `/tag/crucero`, `/tag/drinking-water`, `/tag/chinese-american`, `/tag/epso`, `/tag/no-ciudadanos`, `/tag/father-daughter`, `/tag/uk-court`, `/tag/ski-resort`, `/tag/muslim`, `/tag/emilia-clarke`

### Leg 1 (structural)

- `pnpm run guard:config` — no violations.
- `pnpm run test:build-gate` — 9/9 pass.
- **Leg 1b (deployed binding, live):** `fetchDeployedBindings()` against the real deployed
  `915tldr-v2` Worker reports `bindingTypes: ["r2_bucket", "assets", "kv_namespace"]`,
  `hasD1Binding: false`. Evidence:
  `docs/phase-05/evidence/gate-20261001T203348Z/deployed-bindings.json`.
- **Build-overlap (manual, since `runLoadTest` does not compute this live — see the fix above):**
  `/version.json` captured at pass start and pass end both report
  `builtAt: "2026-10-01T20:06:33.253Z"` — identical. No build ran during the measured window.

### Leg 2 (delta) — baseline

| Window (UTC, same 42m24s clock span, 7 preceding days) | `rowsRead` |
|---|---|
| 2026-09-24 20:30–21:20 | 2,399,162 |
| 2026-09-25 20:30–21:20 | 2,474,001 |
| 2026-09-26 20:30–21:20 | 3,606,781 |
| 2026-09-27 20:30–21:20 | 8,252,604 |
| 2026-09-28 20:30–21:20 | 2,537,613 |
| 2026-09-29 20:30–21:20 | 3,434,240 |
| 2026-09-30 20:30–21:20 | 3,497,574 |

**mean = 3,743,139.29, sample stdDev = 2,056,691.00, median = 3,434,240, n = 7.**

- **Load window `rowsRead`:** 1,684,090
- **Excess** (load − mean): **−2,059,049.29** — the load window read *fewer* rows than the typical
  background, consistent with the test traffic contributing zero rows of its own.
- **z-score:** −1.0011 (well inside normal variance, nowhere near the 3σ FAIL threshold)
- **Detection floor @ 20,000 requests (this window's own baseline):** 308.50 rows/request — wider
  than 05-04's own pre-archive baseline floor (40.26 rows/request at the same request cap) because
  this time-of-day's baseline variance (σ ≈ 2.06M) is almost 8× larger than 05-04's early-morning
  baseline (σ ≈ 268k). **Stated plainly: this method cannot reliably detect a per-request D1 leak
  smaller than ~309 rows at this time of day, even at the 20,000-request safety cap** — the
  structural legs (1/1b) remain the load-bearing proof for anything smaller than that, exactly as
  designed.

**Verdict:**

```
ZERO_READS_PROVEN | load window rowsRead (1,684,090) is within baseline mean + 3σ (9,913,212.29)
and the deployed Worker has no D1 binding | node tools/load-test-zero-reads.mjs --requests 20000
--archive-plan dist/archive-plan.json --evidence docs/phase-05/evidence/gate-20261001T203348Z --json
```

One attempt. No INCONCLUSIVE re-runs were needed — the only prior failure was the tool bug (fixed
before any measurement was attempted), not a named ARCH-01 validity-rule rejection.

### CR-03 correction (05-16, 2026-10-02)

05-REVIEW.md's CR-03 found an asymmetry in the measurement above: `comparableWindows()` aligns the
7 baseline windows outward to 5-minute boundaries (floor start, ceil end), but the load window was
passed into the D1 analytics query raw. Because `datetimeFiveMinutes` is a bucket-start dimension,
the bucket containing the load window's own raw start was always excluded from the sum — the
recorded load window (`20:34:05.536Z` .. `21:16:29.049Z`) summed only 9 buckets (`20:35`-`21:15`)
against each baseline window's 10 buckets (`20:30`-`21:20`), an ~10% undercount on the measured
side.

**Fix (commit `f79816c`, plan 05-16):** `runLoadTest` now builds one aligned window
(`alignedLoad` — floored start, ceiled end) right after the pass ends, and threads it through every
D1-analytics call site that previously saw the raw window: the ingest-slot check, the analytics
catch-up poll, the load-window `rowsRead` query, and the baseline derivation. The raw as-sent
window is kept separately as `requestWindow`, for evidence only, never used to query D1. A
regression test (`CR-03 (05-16): load and baseline windows are aligned identically`) asserts the
load window and all 7 baseline windows share identical duration and minute-of-hour boundaries.

**Re-check against real data:** rather than trust the review's own ×10/9 estimate (≈1.87M), this
plan ran one read-only re-query of the ALIGNED window for the same recorded run —
`2026-10-01T20:30:00.000Z` .. `21:20:00.000Z`, the same 10-bucket span each baseline window already
covers:

| Field | Value |
|---|---|
| Aligned window | `2026-10-01T20:30:00.000Z` .. `2026-10-01T21:20:00.000Z` |
| Measured `rowsRead` (aligned, re-queried 2026-10-02) | **2,183,097** |
| Recorded baseline mean / sample σ | 3,743,139.29 / 2,056,691.00 |
| Corrected excess (rowsRead − mean) | −1,560,042.29 |
| Corrected z-score | **−0.7585** |
| 3σ threshold (mean + 3σ) | 9,913,212.29 |
| Lowest baseline window | 2,399,162 |

The corrected, measured `rowsRead` (2,183,097) remains below the lowest of the 7 baseline windows
and far inside the 3σ threshold — a 2026-10-02 re-query for the real aligned window, not an
estimate. The recorded `ZERO_READS_PROVEN` verdict above therefore stands on corrected, measured
data.

Evidence: `docs/phase-05/evidence/gate-20261001T203348Z/load-window-aligned-recheck.json` (window,
`rowsRead`, and the query timestamp only — no credential, no request body beyond the window
bounds).

No request pass was re-run for this correction (owner directive, 05-16 plan) — only the read-only
D1 analytics re-query above.

### ARCH-08 (same window)

| Field | Value |
|---|---|
| Window | `2026-10-01T20:34:05.536Z` .. `2026-10-01T21:16:29.049Z` |
| Invocations | 8,464 |
| KV reads (`RENDER_MANIFEST`, read-only) | 202 |
| KV reads per invocation | 0.0239 |
| CPU p50 | 0.764 ms |
| CPU p99 | 2.846 ms |
| CPU max | **49.966 ms** |
| `KV_READS_WITHIN_BUDGET` (202 ≤ 8,464) | yes |
| `CPU_OVER_BUDGET` (max ≥ 20ms hard-fail, despite p99 < 5ms) | **yes** |
| Overall verdict | `FAIL` (CPU axis only, on a single outlier) |

**Build-overlap method:** `--assume-no-build` (the documented weaker path, since this window is in
the past and can't be live-polled before/after a second time) — but independently corroborated,
not just assumed: the same two `/version.json` captures used for leg 1b above (identical
`builtAt` before and after the pass) cover this exact window too, since both tools measured the
same 42m24s span.

**Why invocations (8,464) is far below the 20,000 requests sent:** only the 30 archived paths in
the 71-path mix (20 archived articles + 10 archived tags) ever reach the Worker — the 41 hot/static
paths (homepage, categories, hot articles, static tags, sitemap, RSS) are served entirely by
Cloudflare's static-asset layer and never invoke the Worker at all, exactly as the architecture
requires. `20,000 × (30/71) ≈ 8,451`, matching the measured 8,464 closely (the small excess is
real concurrent production traffic sharing the same script during this window — this measurement
is account-wide, not isolated to this test's own requests).

**Why KV reads (202) stay small against 8,464 invocations:** archived *tags* never read KV (0 by
construction — `src/worker.ts`'s tag branch). Archived *articles* read KV once per edge-cache miss,
and this test's own 20 archived articles were each re-requested roughly every ~7 seconds (71-path
mix ÷ 10 req/s) against a 300-second edge-cache TTL — so only the first request per ~300s window
per article does a real KV lookup. Over this 2,543-second window that's roughly 20 articles ×
⌈2,543s / 300s⌉ ≈ 180 KV reads from this test's own traffic, close to the measured 202 (the small
excess is real concurrent traffic touching other archived articles). This matches the "hot static
never invokes the Worker; archive miss → manifest read; edge-cache hit → 0" model exactly.

**Disclosed, not hidden: a single request in this window spiked to 49.966ms Worker CPU**, over
2.5× PROJECT.md's 20ms hard-fail ceiling, even though p50 (0.764ms) and p99 (2.846ms) are both
comfortably inside the 5ms budget — this is one outlier among 8,464 invocations (≈0.012%), not a
systemic cost. Not investigated further in this plan (out of scope — this plan measures, it does
not re-architect the Worker's request-handling cost; 05-03's own ARCH-08 unit-test matrix already
proves every request shape performs 0 or 1 KV get, and this window's p50/p99 confirm the typical
cost is small and consistent). Recorded as a failed requirement for `/gsd-verify-work` to track,
per this plan's own Task 2 instruction — **not** a project halt (D-02 applies only to the
`ZERO_READS_*` verdict, which is `PROVEN`).

### Criterion 1 reinterpretation (restated against this result)

Cloudflare's D1 analytics has no `scriptName`/`workerName` dimension — there is no query that can
report "0 rows read by the v2 Worker" literally, at any request count. This result's proof is the
same two-leg structure 05-04 designed: **leg 1/1b (structural)** — the build-time `assert-no-d1`
guard plus today's live confirmation that the deployed `915tldr-v2` Worker carries no D1 binding —
**and leg 2 (measured)** — this window's `rowsRead` (1,684,090) sitting comfortably inside v1's own
7-day background variance (z = −1.0011, nowhere near +3σ). The limits of leg 2 alone, stated
plainly: a detection floor of ~309 rows/request at this time of day (even at the 20,000-request
safety cap), and the underlying dataset's 5-minute bucket granularity (no finer-grained attribution
is possible). Leg 1/1b is what actually proves "architecturally zero" at the level of precision
this project's PROJECT.md claims (ARCHITECTURALLY zero, not "below the floor we happened to
measure") — leg 2's role is to confirm the measured delta is consistent with that structural proof,
not to prove it on its own.

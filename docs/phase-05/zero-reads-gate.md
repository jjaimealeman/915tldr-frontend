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

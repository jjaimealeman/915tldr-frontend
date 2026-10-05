# ARCH-08 CPU Outliers — Method, Definitive Counts, Reconciliation, IN-01 Correlation, Decision Inputs

Produced by plan 05-17 to settle the dispute 05-REVIEW.md raised: the project's own gate doc
(`docs/phase-05/zero-reads-gate.md`) reported "a single request spiked to 49.966ms," while an
independent orchestrator query against Workers Observability claimed four requests ≥20ms. This
document records the verified method, the resulting per-request counts, how they reconcile with
the existing aggregate measurement, what the available correlation evidence does and does not
support for IN-01 (cold isolate vs request logic), and the three undecided options for the
owner's 05-19 checkpoint. **No decision is made here.**

## Method (verified 2026-10-02)

- **API:** Cloudflare Workers Observability telemetry REST API,
  `POST /accounts/{account_id}/workers/observability/telemetry/query`, dataset
  `cloudflare-workers` (explicitly named via `parameters.datasets` — omitting it silently
  queries a different, metadata-only dataset with zero `$workers.*` fields, confirmed by
  comparing the two datasets' key lists: 22 keys vs 151 keys).
- **Keys used:** `$workers.cpuTimeMs` (integer milliseconds — no microsecond conversion, unlike
  the GraphQL `workersInvocationsAdaptive` dataset), `$workers.wallTimeMs`, `$workers.event.path`,
  `$workers.event.response.status`, `$workers.event.request.cf.colo`, `$workers.scriptVersion.id`,
  `$workers.outcome`, `$workers.scriptName`, `$metadata.requestId`.
- **Retention:** Workers Logs on the Paid plan is 7 days
  (<https://developers.cloudflare.com/workers/observability/logs/workers-logs>, confirmed via
  Context7 `/llmstxt/developers_cloudflare_workers_llms-full_txt`, 2026-10-02). The gate window
  (2026-10-01T20:34:05.536Z–21:16:29.049Z) was ~1 day old at verification time — well inside
  retention; the precondition's expiry-fallback branch was not needed.
- **Permission:** Account → Workers Observability → Read (Cloudflare dashboard custom-token
  permission group). Sufficient for `keys`, `values`, and `query` (both the default COUNT view
  and the `view: "events"` raw-event view). It does **not** grant creating a saved query (POST
  `/accounts/{account_id}/workers/observability/queries` returned 403 under this scope) — not
  needed, since an arbitrary `queryId` string works as an ad-hoc query once `parameters` is
  supplied.
- **Sampling:** `wrangler.jsonc`'s `observability.enabled: true` carries no `head_sampling_rate`
  (default 1 = unsampled), consistent with the count-view total (8,477) and the GraphQL
  aggregate's total (8,464) being close rather than off by an order of magnitude.
- **A significant constraint discovered, not assumed:** the `events`-view has a hard **2000-row
  cap with no cursor/offset** (Zod `too_big` at 2001; 2000 itself succeeds; a top-level `offset`
  key is rejected by schema validation). The gate window has ~8,477 total invocations — more than
  the cap — so a full per-request enumeration of *every* invocation in this window is not
  achievable via this endpoint, full stop, independent of how many pages are requested. This is
  why the outlier fetch below filters server-side on `$workers.cpuTimeMs > 5` (5 matches, far
  under the cap) rather than fetching unfiltered.
- **Exact commands run** (credentials via `process.env`, loaded from the shell profile —
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`, never `.dev.vars` for this plan):
  ```bash
  node tools/measure-worker-cpu-outliers.mjs \
    --from 2026-10-01T20:34:05.536Z --to 2026-10-01T21:16:29.049Z \
    --min-cpu-ms 5 --correlate --json \
    --evidence docs/phase-05/evidence/cpu-outliers-gate-20261001

  node tools/measure-worker-kv-cpu.mjs \
    --from 2026-10-01T20:34:05.536Z --to 2026-10-01T21:16:29.049Z \
    --assume-no-build --json \
    --evidence docs/phase-05/evidence/cpu-outliers-gate-20261001/aggregate
  ```
- Full endpoint/shape/key/retention/permission record:
  `docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json`.

## Definitive counts

| Figure | Per-request (this plan) | Aggregate (`measure-worker-kv-cpu.mjs`, GraphQL `workersInvocationsAdaptive`) |
|---|---|---|
| Total invocations, window | **8,477** (via the telemetry API's own COUNT-view calculation over the same `cloudflare-workers` raw table — not subject to the events-view's 2000-row cap) | 8,464 |
| Count ≥ 20ms CPU | **4** | not derivable (aggregate datasets have no per-request count) |
| Count ≥ 5ms CPU | **5** | not derivable |
| Max CPU | **49ms** (integer-ms precision; mathematically the true window max — any higher value would itself have matched the `cpuTimeMs > 5` filter and appeared in this set) | 49.966ms (microsecond precision — same event, lower-precision field here) |
| p99 CPU | **not independently re-derived from per-request data in this run** — see note below | 2.846ms |

**On p99:** `summarizeCpuOutliers`'s `p99Ms`/`maxMs` fields operate on whatever event set they are
given. This run fetched only the 5 invocations with `cpuTimeMs > 5` (to stay under the 2000-row
cap), so the `p99Ms: 49` in `summary.json` is the p99 **of those 5 outliers**, not of the full
8,477-invocation population — the true population p99 falls among the ~8,472 sub-5ms invocations
this run did not enumerate (doing so is the exact scenario the 2000-row cap blocks for this
window). Reporting that `summary.json` field as "the window's p99" would repeat, in a new form,
the original ARCH-08 mistake of presenting an unsupported figure as measured. The aggregate's
2.846ms p99 is cited above for reference, labeled as the aggregate's own figure.

**Every invocation ≥ 5ms CPU in the window** (full per-request list; timestamp in UTC):

| Timestamp | Path | Status | CPU (ms) | Wall (ms) | Colo | Script version |
|---|---|---|---|---|---|---|
| 2026-10-01T20:39:35.065Z | `/business/airbnb-market-trends-booms-and-collapses-across-the-us-07f79f20-74c6-45a4-826c-fce5448c789d` | 200 | 49 | 64 | LAX | `e3de22ab-f30d-4d36-a21e-59f57aaa62f4` |
| 2026-10-01T21:09:54.994Z | `/politics/new-mexico-republicans-push-for-juvenile-justice-reform-ahead-of-2026-session-311ed73b-0319-47ad-8d2c-847abec73d93` | 200 | 40 | 249 | LAX | `e3de22ab-f30d-4d36-a21e-59f57aaa62f4` |
| 2026-10-01T20:43:48.459Z | `/business/wall-street-faces-decline-amid-weak-job-data-and-ai-concerns-06574fa7-eca9-4fcd-8d74-8736b915f9c0` | 200 | 37 | 44 | LAX | `e3de22ab-f30d-4d36-a21e-59f57aaa62f4` |
| 2026-10-01T21:13:51.258Z | `/business/wall-street-faces-decline-amid-weak-job-data-and-ai-concerns-06574fa7-eca9-4fcd-8d74-8736b915f9c0` | 200 | 26 | 35 | LAX | `e3de22ab-f30d-4d36-a21e-59f57aaa62f4` |
| 2026-10-01T20:34:08.355Z | `/business/implications-of-paramounts-merger-on-cnns-editorial-independence-0000e250-e1d1-431c-b2dc-bad7dc7404ce` | 200 | 7 | 333 | LAX | `e3de22ab-f30d-4d36-a21e-59f57aaa62f4` |

All five requests returned HTTP 200 and `outcome: "ok"` — no errors, no non-2xx responses, one
script version throughout the window (no mid-window deploy).

## Reconciliation

The gate doc's framing — "a single request spiked to 49.966ms... one outlier among 8,464
invocations" — was an inference from `workersInvocationsAdaptive`'s `max.cpuTime` field: an
aggregate maximum can report *that* a request that slow happened, but it has no way to report
*how many* requests crossed any other threshold. Reading "the max was 49.966ms" as "there was
exactly one outlier" quietly assumed a distribution shape (one spike, everything else far below
it) that the aggregate dataset cannot confirm or deny.

The per-request data settles it: **the true count is 4 invocations ≥20ms CPU, and 5 ≥5ms CPU** —
matching the orchestrator's independent finding from 05-REVIEW.md (four ≥20ms: 49.966, 40, 37, 26
ms, plus one at 7ms) almost exactly, down to the individual CPU values (the per-request API
reports whole milliseconds; the orchestrator's figures carried additional precision from a
different query path, but the same five events are being described).

The two tools' TOTAL invocation counts differ slightly: 8,477 (per-request, this plan) vs 8,464
(aggregate, `measure-worker-kv-cpu.mjs`) — a 13-invocation, 0.15% gap. This is consistent with
`tests/unit/measure-worker-kv-cpu.test.mjs`'s own documented observation that the project's two
measurement paths (GraphQL `workersInvocationsAdaptive` vs the Observability telemetry dataset)
can show "genuine, if mild" skew on the same real window, most plausibly from the two datasets'
independent time-bucketing at the window's edges. The gap is reported here, not reconciled away —
it does not change the outlier count, which is this plan's actual subject.

## IN-01 correlation

05-REVIEW.md's IN-01 (`src/worker.ts:103-168, 181-273`) found nothing in the request-path code
that plausibly costs tens of milliseconds — cited here, not re-derived: the archive path does one
`new URL()`, one `decodeURIComponent`, two small anchored regexes, a `JSON.parse` of a 4-field KV
value, builds one `Headers` object, runs a 3-element `formatServerTiming` map/join, and calls
`Response.clone()` (a native stream tee in workerd). None of it is loop-heavy or data-size
dependent. The reviewer's own hypothesis, from the code alone, was a cold-isolate one-time cost
(script compile, global/binding setup).

**Per-outlier correlation features** (full data:
`docs/phase-05/evidence/cpu-outliers-gate-20261001/correlation.json`):

| CPU (ms) | Path (shortened) | True full-window repeat count of this path | This invocation's rank among those repeats | Gap since the previous invocation in the known population*, same colo | Offset into window |
|---|---|---|---|---|---|
| 49 | airbnb-market-trends… | 281 | 36th | 1,438 ms | 329.5s |
| 40 | new-mexico-republicans… | 280 | 237th | 7,197 ms | 2,149.5s |
| 37 | wall-street-faces-decline… | 281 | 65th | 4 ms | 582.9s |
| 26 | wall-street-faces-decline… (same path as the 37ms row) | 281 | 264th | 14 ms | 2,385.7s |
| 7 | implications-of-paramounts-merger… | 1 | 1st | n/a (no prior invocation in the known population) | 2.8s |

\* "Known population" = the 5 outliers plus the **true, fully-enumerated** occurrence history of
each outlier's own path (fetched via a direct `$workers.event.path eq` filter, confirmed exact
against a bogus-path control returning 0 matches) — NOT the full ~8,477-invocation window. Every
outlier shares one colo (LAX) that almost certainly carries most of this window's traffic;
enumerating all of it is blocked by the same 2000-row/no-cursor cap documented above. A
`coloAvailable`/caveat field in `correlation.json` makes this explicit. **"Gap since the previous
invocation" above is therefore a lower bound on recency, not a proven adjacency** — there may be
other, lower-CPU invocations at the same colo in between that this plan's data collection did not
capture.

**What this plan found that neither the gate doc nor 05-REVIEW.md had:**

1. **Four of the five outliers sit on exactly three paths, each hit 280–281 times across the
   42-minute window — roughly once every 9 seconds, for the entire window.** That is not an
   organic traffic pattern; it is consistent with a fixed-interval synthetic prober or load-test
   script (e.g. `tools/load-test-zero-reads.mjs`'s own repeated-URL sampling, which is what the
   gate window's traffic was generated by) hitting a small, fixed URL sample in a loop. A bogus
   control path confirmed the per-path filter itself is exact (0 matches), so the 280–281 figures
   are not an artifact of an overly broad filter.
2. **The sole outlier NOT on a heavily-repeated path (7ms, the smallest of the five) was hit
   exactly once in the entire window.** The size ordering — the only one-off request has the
   smallest outlier CPU, while all four larger ones sit on paths polled ~280 times — is a
   correlation worth recording, not a proof of cause.
3. **Two of the four ≥20ms outliers (37ms and 26ms) have sub-20ms gaps (4ms, 14ms) since the
   previous invocation in the known population, at the same colo.** A gap that short is more
   consistent with a request arriving while another request on the same colo was already in
   flight (isolate/CPU contention under concurrent load) than with the classic "idle isolate goes
   cold, next request pays startup cost" pattern the reviewer's code-only hypothesis described —
   that pattern predicts a *long* idle gap before the expensive request, not a near-simultaneous
   one. The other two outliers (49ms and 40ms, gaps of 1,438ms and 7,197ms) do not show this
   pattern either way; the gap length alone does not rule cold-isolate in or out for them.
4. **No key name in the `cloudflare-workers` dataset's full 151-key set matches
   `/cold|isolate|startup|warm/i`** (`findColdStartKeys`, checked against the live key list). This
   API has no field that could directly confirm "this was the isolate's first request" — the
   `Server-Timing` correlation the reviewer originally proposed (`archive;desc=r2` vs
   `edge-cache`) is not visible through this dataset either; it would require a response-side log,
   which this Worker does not currently emit.

**What this does and does not support:** the repeated-polling correlation (finding 1) and the
one-off-vs-smallest-outlier pattern (finding 2) are consistent with the CPU cost being connected
to *how the gate's own load generation hit the Worker*, not to the archive-serving code itself —
which aligns with the reviewer's code-level finding that nothing in the request path is
loop-heavy or data-size-dependent. The short-gap finding (3) mildly favors a concurrency-pressure
explanation over a classic cold-isolate-after-idle one for two of the four ≥20ms outliers, but
does not rule out cold isolates for the other two, and this API has no field (finding 4) that can
confirm either hypothesis directly. **No root cause is asserted here.** IN-02 (`nodejs_compat`
enabled with zero `node:` imports in the bundle, possibly adding per-isolate global setup cost) is
named as an untested hypothesis, per the reviewer's own fix suggestion ("try removing it in a
preview version and compare `cpuTimeP99` and `max`") — not evaluated in this plan.

ARCH-08's concurrency edge case is resolved explicitly, per this plan's own prohibition: the
counts above include whatever concurrent real traffic was running on `915tldr-v2` during the gate
window (the query filters only on `scriptName`, not on request origin), and this document says so
plainly rather than silently assuming the window was isolated synthetic traffic.

## Decision inputs

Three options, with the evidence for each. **No option is recommended here on the owner's
behalf** — this is 05-19's decision.

**(a) Accept cold-start/contention outliers under a documented ARCH-08 CPU definition.**
Evidence for: p50 is 0.76ms and p99 (aggregate) is 2.846ms — the overwhelming majority of traffic
is far under budget; the 5 outliers in this 42-minute window are 0.06% of 8,477 invocations;
nothing in the request-path code is loop-heavy or size-dependent (05-REVIEW.md, confirmed again
here); the repeated-polling correlation suggests the outliers may be connected to how this
specific gate measurement generates load, not to organic traffic shape. Evidence against: this
plan did not prove a cold-isolate or concurrency root cause (finding 4 — no API field can), so
"accepting" an unproven mechanism as the explanation is itself an assumption, same as the one this
plan was built to avoid repeating.

**(b) Treat it as a code/config defect to fix** (requires a deploy, therefore a new gap plan).
Evidence for: IN-02's `nodejs_compat` flag is enabled with zero `node:` imports anywhere in the
bundle — removing an unused compatibility flag is low-risk and directly testable via
`cpuTimeP99`/`max` on a preview deploy, per the reviewer's own suggestion. Evidence against: no
evidence in this plan's data specifically implicates `nodejs_compat` over any other cold-start
contributor (V8/isolate setup is not attributable to a single flag from this dataset); a deploy
carries its own risk and this plan's mandate (read-only measurement) does not cover one.

**(c) Re-measure before deciding** (read-only, over a fresh natural-traffic window, with this
tool; a new synthetic load pass would need separate owner approval, per this project's budget and
safety constraints). Evidence for: this plan's correlation evidence strongly implicates the gate
window's own synthetic polling pattern (findings 1–2) as connected to which requests became
outliers — a fresh window driven by organic reader traffic (not a repeated-URL load test) would
show whether the same outlier pattern recurs without that specific polling shape, which would be
informative either way. Evidence against: Workers Logs retention is 7 days; the current gate
window is already a day old, so there is a limited runway before this specific evidence
disappears, and natural traffic may simply not produce enough high-CPU samples in any one
re-measurement window to be conclusive (0.06% outlier rate on this window).

## Owner decision (05-19, 2026-10-02)

**Jaime's reply, verbatim** (2026-10-02 ~19:05 MDT, in-session; option (c) was recommended by the
orchestrator, the owner chose it, then picked the rate-based rule over "strict zero" and "p99
only"):

> re-measure: 2026-10-02T00:00:00Z to 2026-10-03T00:00:00Z (the last full UTC day, natural traffic
> on dev.915tldr.com / worker 915tldr-v2) + PASS iff population p99 CPU < 5ms AND invocations with
> CPU >= 20ms are under 0.1% of total invocations in the window

Option chosen: **(c) re-measure.** Pass criterion fixed BEFORE measuring (T-05-64): population p99
CPU < 5ms (aggregate, `measure-worker-kv-cpu.mjs`) AND the share of invocations with CPU ≥ 20ms
under 0.1% of total invocations in the window (per-request, `measure-worker-cpu-outliers.mjs`).

### Re-measurement (read-only, $0)

Commands run (credentials via shell-environment `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`,
per this plan's execution rules — not `.dev.vars`):

```bash
node tools/measure-worker-kv-cpu.mjs \
  --from 2026-10-02T00:00:00Z --to 2026-10-03T00:00:00Z \
  --assume-no-build --json --evidence docs/phase-05/evidence/cpu-outliers-remeasure/aggregate

node tools/measure-worker-cpu-outliers.mjs \
  --from 2026-10-02T00:00:00Z --to 2026-10-03T00:00:00Z \
  --correlate --json --evidence docs/phase-05/evidence/cpu-outliers-remeasure
```

`--assume-no-build` is used for the same reason 05-17 used it for the 05-12 gate window: this
window is entirely in the past, so a live before/after `/version.json` poll run now cannot confirm
whether a build happened at any point *during* the window — only `--assume-no-build`'s documented
weaker method applies to a historical window. (Actual UTC time at measurement, confirmed before
running: `2026-10-03T01:22:17Z` — the window is a genuinely completed UTC day, not one still in
progress.)

| Field | Value | Source |
|---|---|---|
| Window | `2026-10-02T00:00:00Z` .. `2026-10-03T00:00:00Z` | both tools |
| Total invocations (aggregate) | 3 | `measure-worker-kv-cpu.mjs` |
| Total invocations (per-request events-view) | 3 | `measure-worker-cpu-outliers.mjs` (`total`) |
| Total invocations (per-request COUNT-view, cap-immune) | 3 | `measure-worker-cpu-outliers.mjs` (`totalFromCountQuery`) |
| Population CPU p50 | 1.133 ms | `measure-worker-kv-cpu.mjs` (GraphQL quantile) |
| **Population CPU p99** | **1.314 ms** | `measure-worker-kv-cpu.mjs` (GraphQL quantile) |
| Population CPU max | 1.314 ms (aggregate) / 1 ms (per-request, integer-ms) | both tools |
| Invocations ≥ 5ms CPU | 0 | `measure-worker-cpu-outliers.mjs` (`overBudget`) |
| **Invocations ≥ 20ms CPU** | **0** | `measure-worker-cpu-outliers.mjs` (`overHardFail`) |
| **Share ≥ 20ms CPU** | **0 / 3 = 0%** | computed |

All three raw evidence files (`events.normalized.json`, `summary.json`, `correlation.json`,
`aggregate/workers-invocations.json`, `aggregate/kv-operations.json`) are under
`docs/phase-05/evidence/cpu-outliers-remeasure/`. No account id or credential appears in any of
them (checked directly — `fetchImpl`/`redact` already strip them at the single read boundary, and
a direct grep for the account id against every evidence file returned 0 matches).

**Mechanical verdict against the pre-stated criterion: MET.**
- Population p99 CPU: 1.314 ms < 5 ms — **true**.
- Share of invocations ≥ 20 ms CPU: 0% < 0.1% — **true**.
- Both clauses of the AND hold → the pre-stated criterion is satisfied by the letter of what was
  fixed before measuring.

**Disclosed, not hidden — a finding that changes what this MET verdict is actually evidence of:**
all 3 invocations in this 24-hour window are **not** archive-page traffic at all. The full,
unfiltered per-request list (`events.normalized.json`) is:

| Path | Status | CPU (ms) | Colo |
|---|---|---|---|
| `/.git/HEAD` | 404 | 1 | VIE |
| `/favicon.ico` | 404 | 1 | LAX |
| `/favicon.ico` | 404 | 1 | LAX |

These are automated vulnerability-scanner/browser-favicon 404 probes — paths that reach the Worker
only because they don't match a static asset and fall through to the 404 handler. **Not one
invocation in this window touched an archived article or archived tag** (the KV-manifest-read,
cold-isolate-candidate code path this entire ARCH-08 CPU dispute is about). This is a materially
different situation from "synthetic load traffic" (the gate window's repeated-URL polling that
05-17's IN-01 correlation flagged) — it is the *absence* of the traffic this criterion was
designed to characterize. The criterion's own evidence-against note anticipated exactly this risk
before measuring: "natural traffic may simply not produce enough high-CPU samples in any one
re-measurement window to be conclusive" — what was not anticipated is that the window would
contain zero samples of the relevant *code path* at all, independent of CPU cost.

**What this does and does not establish:** the MET verdict is accurate against the literal,
pre-fixed formula and is not retroactively reinterpreted here (T-05-65 — no softening, no erasing).
But because the sample contains no archive-page requests, this measurement cannot confirm or deny
whether the gate window's CPU outliers (49/40/37/26/7 ms, per 05-17) recur, or do not recur, under
genuine organic archive-reader traffic — it only confirms that this Worker's incidental 404
bot-scan handling costs ~1ms, which was never in dispute. `dev.915tldr.com` is a low-traffic
development host (not production), and this result is consistent with 05-17's own baseline
measurement (94 invocations/24h on this same Worker, pre-archive) — a full UTC day without a
single real archive-page hit is plausible on this host, not an anomaly in the measurement itself.

**Consequence for ARCH-08's CPU axis:** per this plan's Task 2 instructions, option (c) leaves
ARCH-08 as a gap regardless of the mechanical MET/NOT-MET result — WINDOWS.md #26 stays **open**
(not waived; waiving is reserved for option (a) only). The mechanical MET result is recorded
faithfully above; it is not treated as resolving ARCH-08, both because the plan's own rule reserves
resolution for option (a) and because the zero-archive-traffic composition of this sample means a
MET verdict here does not actually speak to the disputed code path. A future measurement that
confirms it captured genuine archive-article/archive-tag invocations (not just whatever the Worker
happens to receive) would be the stronger version of this same test, should the owner choose to
re-run it.

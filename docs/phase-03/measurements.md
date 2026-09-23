# Phase 3 Measurements — D-01's Three Numbers

Produced by 03-06-PLAN.md. These are the three measured inputs 03-07's render-step location
decision (cron worker / separate Worker via Queues / CI) rests on. Every figure below is
attributed to the method that produced it, the date, and the exact command to reproduce it —
none are modeled or carried forward from an earlier estimate. **This document makes no
render-step decision** — that is 03-07's checkpoint, the owner's call.

## 1. D1 REST pagination latency and rows-read cost, at the full corpus

**Method:** `tools/measure-d1-pagination.mjs --execute`, run 2026-09-23 against live production
D1 (`552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`). Mirrors `src/lib/server/d1-client.ts`'s real joined
query shape (processed, category-resolved articles). Full report:
`docs/phase-03/d1-pagination-report.md`.

**Reproduce:** `node tools/measure-d1-pagination.mjs --execute`

| Metric | Offset pagination (`LIMIT`/`OFFSET`) | Keyset pagination (`WHERE uuid > ?`) |
|---|---|---|
| Row count (this session) | 39,827 | 39,827 |
| Page size | 500 | 500 |
| Request count | 80 | 80 |
| p50 latency | 916.1ms | 489.0ms |
| p95 latency | 1327.3ms | 621.2ms |
| **Rows read (D1-reported, `meta.rows_read`)** | **49,420,384** | **11,451,051** |
| Total wall-clock | 76.8s | 40.3s |

**Headline p50/p95 (offset — the pagination strategy Phase 4 is most likely to use):
p50 = 916.1ms, p95 = 1327.3ms, sample count = 80.**

**The load-bearing finding:** offset pagination reads **49,420,384 rows** for a single pass over
39,827 distinct articles — **9.9x the 5,000,000-row PROJECT.md hard-fail budget**, and 1,241x the
dry run's own conservative pre-execution projection. Keyset reads 11,451,051 rows — still 2.3x
the hard-fail budget, but 4.3x cheaper than offset. Both figures are dominated by the LEFT JOINs
and the correlated per-row tags subquery (which run for every row scanned, not just every row
returned), and offset pagination compounds this further because each request re-scans and
discards every row before its own offset. **Whatever loader Phase 4 builds must not page through
the full corpus with a naive `LIMIT/OFFSET` query shaped like this one** — keyset is
meaningfully cheaper but still exceeds the stated hard-fail budget for a single full pass, which
is itself relevant to how large a "full rebuild" can be before it needs to be spread across
multiple days or made incremental-only (D-04's content-hash staleness signal already exists for
exactly this reason).

Offset and keyset pagination differ materially in both latency (53.2% relative difference at
p95) and rows-read (4.3x), refuting 03-RESEARCH.md's prediction of "no measurable difference at
~84 pages" — that prediction covered latency only and did not anticipate the rows-read gap,
which turned out to be the more consequential number.

## 2. Per-page render cost, against the real tracer slice

**Method:** `tools/measure-render-cost.mjs --count 50`, run 2026-09-23 against the real tracer
slice (`src/pages/[category]/[slug].astro`) — a real D1 read, a real render, a real KV manifest
write, per D-02. 50 articles sampled at evenly-spaced ranks of a corpus-wide
`ORDER BY LENGTH(summary)` (39,687 candidates), spanning the real summary-length distribution
rather than the newest 50 articles. Full report: `docs/phase-03/render-cost-report.md`.

**Reproduce:** `node tools/measure-render-cost.mjs --count 50`

| Component | min | p50 | p95 | max | n |
|---|---|---|---|---|---|
| D1 read | 191.2ms | 230.9ms | 335.0ms | 461.5ms | 50 |
| Render (frontmatter only — see exclusion note) | 0.06ms | 0.07ms | 0.13ms | 0.26ms | 50 |
| Manifest build (SHA-256 hash) | 0.12ms | 0.14ms | 0.27ms | 0.36ms | 50 |
| Manifest write (KV network PUT) | 289.4ms | 338.2ms | 415.1ms | 429.9ms | 50 |
| **Total (sum of components)** | **488.7ms** | **573.3ms** | **735.9ms** | **765.0ms** | **50** |

**Fixed build-startup cost** (Vite/Astro initialisation, module graph, the D1-import assertion
walk — isolated from per-page cost): **~1.8s** (measured as total child `astro build` wall-clock
minus the sum of all 50 pages' measured component time, floored at 0; not itself per-page).

**What "render" excludes:** the `render` component times this page's own frontmatter script
(date formatting) only, not Astro's template-to-HTML string compilation, which runs after the
frontmatter block and is not independently instrumentable from inside it. For this page's
simple template, that excluded cost is expected to be small but is NOT measured here.

**The load-bearing finding:** manifest write (the KV network PUT), not the render itself,
dominates per-page cost — p50 338ms vs. the render component's 0.07ms. D1 read is second at
p50 231ms. A render step that batches or parallelises KV writes has more headroom to work with
than one that assumes rendering itself is the bottleneck.

## 3. Cron Trigger CPU ceiling, empirically measured

**Documented ceiling, confirmed firsthand** (not carried forward from STATE.md's assumption):
fetched `developers.cloudflare.com/workers/platform/limits/` directly, 2026-09-23 — Workers Paid
plan, "CPU time per Cron Trigger": **30 seconds at intervals shorter than 1 hour; 15 minutes
(900,000ms) at intervals of 1 hour or longer.** This project's production ingest cron
(`915tldr.com2/wrangler.jsonc`, `"0 */2 * * *"`) is a 2-hour interval — the **15-minute row
applies**, not the 30-second row.

**Correction to STATE.md's carried-forward figure — STATE.md was WRONG, stated plainly:**
STATE.md's blockers list reasoned from a flat **300-second (5-minute)** Worker CPU ceiling. That
figure is the HTTP-request ceiling's configurable maximum (`limits.cpu_ms`, up to 5 min), not
the Cron Trigger ceiling. The real ceiling for this project's 2-hour-interval cron, both
documented AND now empirically confirmed below, is **~900 seconds (15 minutes) — 3x higher**
than the 300-second figure STATE.md carried forward.

**Empirical probe (Part A), method:** `tools/cpu-ceiling-probe/` — a standalone Worker
(`915tldr-cpu-probe`, no bindings, distinct name) with a `scheduled` handler that burns CPU in a
tight synchronous loop, deployed with the SAME `"0 */2 * * *"`-shaped 2-hour interval as
production (offset variants used to get multiple real firings inside one session — see the
methodology note in `tools/cpu-ceiling-probe/wrangler.limits-high.jsonc`). Triggered by its own
real Cron Trigger firing (no synthetic/local simulation used for the reported number — the
documented `/cdn-cgi/local/scheduled` test route was tried first via `wrangler dev --remote` and
found to 404 in remote mode; it is a local-Miniflare-only convenience, not something that
exercises real edge enforcement, so it was abandoned in favour of waiting for genuine firings).
Cross-checked against Cloudflare's own platform-reported `cpuTime`/`outcome` via `wrangler tail`
and the GraphQL Analytics API (`workersInvocationsAdaptive`) — never against this repo's own
in-Worker `console.log` timestamps alone, which turned out to be an unreliable cross-check (see
below).

**Result — the real 2-hour-interval cron ceiling, measured:**

| Field | Value |
|---|---|
| `outcome` | `exceededCpu` |
| Platform-reported `cpuTime` | **902,000ms (902.0s ≈ 15.03 min)** |
| Platform-reported `wallTime` | 979,952ms (≈16.33 min) |
| `limits.cpu_ms` configured on this invocation | 300,000ms (the platform's own configuration-time maximum — see below) |
| Cron expression | 2-hour interval (`"15 */2 * * *"` variant), matching production's row |
| Exception message | `"Worker exceeded CPU time limit."` |

**Self-report vs. platform-report — a real disagreement, called out rather than resolved by
picking one:** the Worker's own `console.log` interval markers (logged every ~1 second inside
the burn loop) were expected to provide an independent cross-check, but only the FIRST log line
(`scheduled-start`) survived to the delivered tail event — every subsequent per-second log from
the ~902-second run was lost. This held for the HTTP-triggered control run too (see below), so
it is a structural property of a hard CPU-limit kill (buffered logs are not flushed on a forced
termination), not a bug specific to this probe. **The platform's own `cpuTime`/`wallTime`/
`outcome` fields are the only reliable source for this measurement** — in-Worker self-timing
cannot be trusted at the exact moment of termination, which is itself a finding worth carrying
into any future observability work on the real render step.

**Wall-time vs. documented cap, a second minor discrepancy:** the documented wall-time cap for
any Cron Trigger invocation is 900,000ms (15 min) regardless of interval, but the measured
`wallTime` was 979,952ms — about 8.9% over that figure. Not investigated further this session;
noted rather than silently rounded away.

**`limits.cpu_ms` interaction (Open Question 1) — answered, with an important asymmetry stated
explicitly:**
1. **Configuration-time finding (from `wrangler deploy` itself, not the docs):** the platform
   REJECTS any `limits.cpu_ms` value above 300,000ms outright — `wrangler deploy` failed with
   `"Cannot set CPU time limit higher than 300 seconds (300000 ms) [code: 10206]"` when this
   session tried to configure 3,000,000ms. The knob's own maximum matches the separate
   "CPU time per HTTP request" ceiling (5 min / 300,000ms), not the cron-specific ceiling.
2. **Runtime finding (the empirical probe above):** with `limits.cpu_ms` explicitly set to that
   maximum (300,000ms), the cron invocation ran to **902,000ms of CPU time** — three times past
   its own configured cap — before the platform terminated it for exceeding the CRON ceiling, not
   the configured `cpu_ms` value. **`limits.cpu_ms` does not apply to Cron Trigger invocations at
   all**, at least not in the direction tested (a value at its own maximum, which is already
   below the cron ceiling, had zero effect). It answers the "does it RAISE the ceiling" half of
   Open Question 1 by construction (the knob cannot even be configured high enough to test a
   raise) and answers "does it LOWER the ceiling" empirically: no, not from this value.
3. **Not tested, stated as a real gap rather than glossed over:** whether an explicitly LOW
   `limits.cpu_ms` (e.g. 5 seconds) WOULD be honored for a cron invocation remains untested this
   session — the session's real-time budget for waiting on additional natural cron firings (each
   requiring a fresh ~15-40 minute wait for propagation + observability-delivery lag, itself an
   unplanned discovery — see below) was exhausted after securing the load-bearing result above.
   If this asymmetry matters to 03-07's decision, `tools/cpu-ceiling-probe/wrangler.limits-low.jsonc`
   (already prepared, `limits.cpu_ms: 5000`) is ready to deploy and re-run.

**An unplanned methodology finding, worth carrying forward:** this session's FIRST attempt (the
un-modified `"0 */2 * * *"` baseline, no `limits.cpu_ms`, registered ~50 minutes before its
target firing) appeared to produce ZERO observability data — both `wrangler tail` and the
GraphQL Analytics API returned nothing in the 30+ minutes following the expected firing time,
which looked at first like the Cron Trigger silently failed to fire despite the schedules API
confirming registration. The SECOND attempt's data (the 902,000ms result reported above)
eventually arrived via `wrangler tail` **~37 minutes after its actual `scheduledTime`** — meaning
the true cause was **observability delivery lag, not a firing failure**. The first attempt's
`wrangler tail` session had already been killed (by this session's own wait script) before that
same ~37-minute delay window could have delivered its data, which is the most likely explanation
for its apparent silence. **Lesson for any future live-Worker measurement in this project: do
not tear down a `wrangler tail` capture immediately after a target event time — Cloudflare's own
observability pipeline can lag the real event by tens of minutes.**

**Existing production cron headroom (Part B), method:** read-only `wrangler tail` against the
real, unmodified `915tldr` Worker (`915tldr.com2`), filtering for `event.cron`-shaped entries
(distinguishing real scheduled invocations from the Worker's much higher-volume HTTP traffic).
Captured window: 2026-09-22 23:16 UTC through 2026-09-23 06:04 UTC (~6h48m). Only ONE of the
expected four 2-hour boundaries in that window (00:00, 02:00, 04:00, 06:00 UTC) actually appears
in the capture — the 06:00 UTC firing, with two invocations 8 seconds apart. The 00:00/02:00/
04:00 firings were not captured; the most likely explanation is `wrangler tail`'s documented
sampling behaviour under high traffic (this Worker serves a live production news site), not that
those firings did not happen. **Sample size is small (n=2) and explicitly stated as such — this
is not a multi-day, high-confidence percentile.**

| Metric | Value |
|---|---|
| Window | 2026-09-23T06:00:29Z – 2026-09-23T06:00:37Z (one 2-hour firing, 2 invocations) |
| Sample count | 2 |
| CPU time, nearest-rank p50 | 120ms |
| CPU time, nearest-rank p95 | 619ms |
| Wall time (informational — mostly I/O wait, not CPU-bound) | 14,579ms and 134,970ms |

**Headroom = measured ceiling (902,000ms) − measured existing usage (p95 = 619ms) ≈ 901,381ms —
99.93% of the cron CPU ceiling is unused by the real production ingest job today.** The existing
cron has essentially total headroom; the constraint on using this same Worker/schedule for
rendering is NOT "not enough room next to the ingest job" — it is whether rendering itself,
measured in §2 above, can fit inside the ceiling at all. That is what §4 checks next.

## 4. Consistency check — does a full-corpus rebuild fit the measured ceiling?

**Projection formula:** `fixed startup + row count × per-page cost`, at both p50 and p95,
compared against the measured 902,000ms ceiling and the 901,381ms headroom above. Both the
per-page figures and the fixed-startup figure this projection uses are §2's own measured output
— reproduce them together with `node tools/measure-render-cost.mjs --count 50` before trusting
this table at a different corpus size or a different Astro/adapter version.

| Row count | Per-page cost | Projected full-corpus render time | vs. 902,000ms ceiling |
|---|---|---|---|
| 39,827 (today's live count, §1) | p50 = 573.3ms | 39,827 × 573.3ms + 1.8s ≈ **22,836s ≈ 6.34 hours** | **25.3x OVER the ceiling** |
| 39,827 (today's live count, §1) | p95 = 735.9ms | 39,827 × 735.9ms + 1.8s ≈ **29,307s ≈ 8.14 hours** | **32.5x OVER the ceiling** |
| 82,000 (STATE.md's anticipated future bilingual corpus size) | p50 = 573.3ms | 82,000 × 573.3ms + 1.8s ≈ **47,012s ≈ 13.06 hours** | **52.1x OVER the ceiling** |
| 82,000 (STATE.md's anticipated future bilingual corpus size) | p95 = 735.9ms | 82,000 × 735.9ms + 1.8s ≈ **60,346s ≈ 16.76 hours** | **66.9x OVER the ceiling** |

**Stated plainly, unfavourable as it is: a single Cron Trigger invocation cannot render this
project's full corpus in one pass, by more than an order of magnitude, at today's corpus size —
and the gap widens further at the anticipated future bilingual size.** At the measured p95
per-page cost, roughly **1,223 articles** fit inside one 902-second invocation
(`902,000 ÷ 735.9`); at p50, roughly **1,574**. A single 2-hour cron cycle's normal INCREMENTAL
workload (new + changed articles since the last cycle) is very likely to be comfortably under
that per-invocation ceiling — nothing measured here rules out a cron-triggered INCREMENTAL
render — but a FULL rebuild (a schema migration, a template change invalidating the whole
manifest, or the initial backfill) cannot run as one invocation and would need roughly 26-33
cron cycles run back-to-back (~2-2.75 days at the current 2-hour cadence) OR a fan-out mechanism
(Queues, or a CI job outside the Workers CPU-limited runtime entirely) to parallelise across
many invocations within a shorter wall-clock window.

**This independently confirms §1's finding from a completely different angle.** §1 found that a
single full-corpus D1 read (via naive offset pagination) already exceeds PROJECT.md's rows-read
budget by ~10x on its own, before any rendering happens at all. §4 finds that even ignoring the
D1 budget entirely, the CPU cost of rendering the corpus exceeds the cron ceiling by 25-33x.
**Two independent constraints, arrived at by different measurements, point the same direction:
whatever Phase 4 builds, it must not attempt a full-corpus rebuild in a single cron invocation.**

**On STATE.md's original reasoning, corrected in full:** STATE.md estimated "~4ms/page" and a
"300s ceiling" to conclude a full rebuild takes "~330s, over the 300s ceiling ... Queues fan-out
may be required." The qualitative conclusion (fan-out or an alternative to a single cron
invocation is likely necessary) turns out to still be directionally right, but for reasons two
orders of magnitude different from the stated arithmetic: the REAL per-page cost (§2) is
**~140-180x higher** than the assumed 4ms (measured 573-736ms, not 4ms), and the REAL ceiling
(§3) is **3x higher** than the assumed 300s (measured ~902s, not 300s). These two errors happen
to point toward a similar qualitative conclusion, which is exactly the kind of coincidence this
whole plan exists to catch rather than accept on faith — a future estimate built on either of
STATE.md's original numbers would have been wrong by more than 100x on the cost side alone.

## Cost of this measurement

The probe's own CPU usage across every invocation this session (5 HTTP-triggered control runs at
~32.5s CPU each + 1 real cron-triggered run at ~902s CPU) totals approximately **1,062,500ms
(≈1.06 million CPU-ms)**. Workers Paid plan includes 30 million CPU-ms/month before any
additional charge, and even treating the whole amount as pure overage: `1.0625M ÷ 1M × $0.02 ≈
$0.021`. Combined with 6 total requests (`$0.30`/million, negligible), **total real spend for
this entire measurement task is approximately 2 cents — confirmed well under the $1 threshold**,
consistent with the pre-deployment estimate. The probe Worker was deleted immediately after the
last measurement was captured, confirmed absent from a full account Workers listing.

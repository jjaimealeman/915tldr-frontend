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

## 1b. Bulk fetch + in-memory stitch — a query-shape hypothesis test (03-06-ADDENDUM)

**Why this exists:** after 03-06 completed, the orchestrator checked the query planner directly
against production D1 (`EXPLAIN QUERY PLAN` on the joined `ARTICLE_SELECT` shape) and found the
plan is already optimal:

```
SEARCH a USING INDEX articles_uuid_unique (uuid>?)
CORRELATED SCALAR SUBQUERY 1
  SEARCH atg USING COVERING INDEX sqlite_autoindex_article_tags_1 (article_id=?)
  SEARCH t USING INTEGER PRIMARY KEY (rowid=?)
```

No missing index. The 49.4M/11.5M rows-read costs in §1 above are not an indexing problem — they
are a **query-shape** problem: `SELECT_COLUMNS` runs a correlated scalar subquery for tags once
per article row (39,827+ times) plus a per-row category LEFT JOIN. This section tests the
hypothesis that eliminating both fits the rows-read budget.

**Method:** `tools/measure-d1-pagination.mjs --execute` (extended, same invocation as §1 — the
bulk pass now runs alongside offset/keyset by default; `--skip-bulk` restores 03-06's original
scope), run 2026-09-23 in the same session as this document's §1 re-measurement, against the same
live production D1. Shape: paginate `articles` alone via keyset on `a.uuid` — **no LEFT JOIN, no
correlated subquery**, filtered only on `a.status = 'processed'` (a native column; the category
filter can't be pushed down without the join this shape exists to eliminate). Separately,
bulk-fetch `article_tags JOIN tags` and `article_categories JOIN categories WHERE is_primary = 1`
in their own keyset-paginated (on `rowid`) passes. Stitch all three into the same output record
shape as §1's `ArticleRow` in memory in Node, then drop any article with no resolved primary
category (mirroring §1's `c.slug IS NOT NULL` filter). Bulk pages are 5,000 rows (vs. §1's 500) —
a one-time build-time bulk fetch has no reason to keep round-trip count small the way a
per-request paginated API does; verified empirically that a 5,000-row `LIMIT` returns cleanly
before choosing the value.

**Reproduce:** `node tools/measure-d1-pagination.mjs --execute` (full report:
`docs/phase-03/d1-pagination-report.md`, this section's numbers are its "Executed — bulk fetch"
section)

| Metric | Articles (native only) | `article_tags` JOIN `tags` | `article_categories` JOIN `categories` (is_primary=1) | **Total (bulk)** |
|---|---|---|---|---|
| Rows fetched | 39,871 | 189,654 | 39,882 | 39,867 stitched output records |
| Rows read (`meta.rows_read`) | 497,936 | 379,308 | 79,764 | **957,008** |
| Requests (round trips) | 8 | 38 | 8 | 54 |

**The load-bearing finding: the bulk-fetch shape reads 957,008 rows total — 24.01 rows per
stitched article returned, 0.083x (12x cheaper than) keyset's 11,466,920, and 51.7x cheaper than
offset's 49,470,624. This is WITHIN the 5,000,000-row hard-fail budget (0.19x of it) for a single
full-corpus pass**, and comfortably within the 2,000,000-row daily budget too. Removing the
per-row correlated subquery and per-row LEFT JOIN — the two mechanisms §1 identified as the actual
cost driver, not indexing — is sufficient to bring a full-corpus D1 pass under PROJECT.md's
rows-read ceiling. This is a genuinely different result from §1's offset/keyset findings, not a
restatement of them.

**What this does NOT cover, stated plainly:**

- **A small predicate mismatch, reported not hidden:** the articles-only pass filters on
  `a.status = 'processed'` alone (39,871 rows) because the category-resolved filter requires the
  join this shape avoids. 4 of those 39,871 have no resolved primary category and are dropped at
  the in-memory stitch step, landing on the same 39,867-record output count as §1's re-measured
  corpus this session. A real implementation would pay for reading those 4 extra rows every pass —
  negligible at this corpus size, but not zero.
- **Output equivalence, verified not assumed:** 20 evenly-spaced sample records from the 39,867
  stitched output were re-fetched via the ORIGINAL joined query by uuid (20 extra requests, 294
  rows read — excluded from the 957,008 total above as verification overhead, not production
  cost) and compared field-by-field. Tags were compared as a **sorted set**, not an exact string —
  the two shapes have no guaranteed matching concatenation order between a correlated subquery's
  `GROUP_CONCAT` and this script's own rowid-ordered bulk join. **Result: all 20 matched
  field-for-field.** This is a 20-record sample of 39,867, not an exhaustive check.
- **Memory ceiling — a real, marginal finding, not a clean pass:** peak Node heap during the
  in-memory stitch measured **128.4 MB**, sampled via `process.memoryUsage().heapUsed` at each
  pipeline stage in this Node process. That is **over** the 128 MB Workers isolate memory limit,
  by a small margin (0.3%). This is a Node-process proxy, not a measurement inside an actual
  Worker isolate — a Worker's baseline heap overhead differs from a Node CLI script's, in either
  direction, and this number was not re-measured inside a deployed Worker. **Stated plainly: this
  shape's naive in-memory stitch, as implemented for this measurement, would not obviously fit
  inside a Worker's memory limit today, and margin-of-error concerns run in the direction of
  "might not fit" rather than "comfortably fits."** A production implementation could very
  plausibly reduce this (e.g., building `Map`s keyed by article_id more compactly, releasing
  intermediate row arrays before building the final stitched array, or running the bulk fetch and
  stitch in Node at build time — which is where 03-06 §2 and this project's Sharp-image-service
  decision already put comparable work — rather than inside the Workers runtime at all). Whether
  this shape runs in a Node build step or inside a Worker is exactly the kind of architectural
  question 03-07's checkpoint exists to make, not one this addendum resolves.
- **This changes the D1-budget answer, not the CPU-ceiling answer on its own.** See the updated
  §4 consistency check below for the render-time projection under this shape's assumptions.

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

### §4b. Recomputed under §1b's bulk-fetch shape (PROJECTION, not a re-measurement — 03-06-ADDENDUM)

§1b found the bulk-fetch shape amortizes D1 access into one upfront pass rather than one network
round trip per rendered page. That changes this section's projection formula: the per-page
D1-read component (p50 230.9ms / p95 335.0ms, §2's table) is no longer paid per page — it is
replaced by the one-time bulk-fetch wall-clock measured in §1b (26.6s for all 3 passes + stitch).
**This is a composed projection, not a new end-to-end measurement** — the tracer page itself was
NOT rewired to render from a bulk-fetched in-memory dataset this session; that would be real
Phase 4 loader work, out of scope for this addendum. It combines two measured inputs (§1b's
bulk-fetch wall-clock, §2's already-measured render + manifest-write components) rather than
introducing a new modeled constant.

| Metric | Old projection (§4, per-page D1 read included) | New projection (§1b's bulk-fetch shape) |
|---|---|---|
| Per-page cost used | p50 = 573.3ms / p95 = 735.9ms (full 4-component total) | p50 = 342.4ms / p95 = 400.9ms (render + manifest build + manifest write only — D1-read component removed) |
| One-time D1 cost | none modeled separately (paid per-page, embedded above) | 26.6s (§1b's measured bulk-fetch + stitch wall-clock, paid once) |
| Projected full-corpus render time (39,867 articles) | p50 ≈ 6.34h / p95 ≈ 8.14h | **p50 ≈ 3.80h / p95 ≈ 4.45h** |
| vs. 902,000ms (≈0.25h) cron CPU ceiling | 25.3x-32.5x OVER | **15.2x-17.8x OVER** |

**Stated plainly: the bulk-fetch shape roughly HALVES the projected full-corpus render time (from
6.3-8.1h to 3.8-4.5h) by removing the per-page D1 round trip, but it does NOT bring a full rebuild
under the cron CPU ceiling.** 15-18x over is still an order of magnitude past the 902,000ms
ceiling — this projection strengthens §4's original conclusion (no single cron invocation can
render the full corpus) rather than overturning it. It also does not change §1b's own D1
rows-read finding, which is the number that actually answers whether this shape fits
PROJECT.md's read budget (it does, per §1b) — the render-time projection here is a separate
question, about CPU time, not row reads.

**Combining §1b and §4b:** the bulk-fetch query shape is a real improvement on the D1 rows-read
axis (957,008 rows vs. 49.4M/11.5M — comfortably under the hard-fail budget, where offset/keyset
were not) and a real but partial improvement on the render-time axis (3.8-4.5h vs. 6.3-8.1h — both
still far over the cron ceiling). Neither number, alone or combined, changes 03-06's core
conclusion: **Phase 4 must not attempt a full-corpus rebuild in a single cron invocation, however
the D1 access is shaped.** What the bulk-fetch shape does establish is that the D1 rows-read
constraint specifically — previously the more severe of the two blocking findings — is solvable
by query shape alone, without indexing changes, leaving the CPU-ceiling constraint as the
remaining blocker for a full rebuild's execution strategy (fan-out via Queues, a CI job outside
the Workers CPU-limited runtime, or incremental-only rendering).

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

**03-06-ADDENDUM cost (§1b/§4b, 2026-09-23):** read-only D1 REST API calls only — no Worker
deployed, no writes to D1 or KV. This session's `--execute` run issued 80 (offset) + 80 (keyset) +
54 (bulk fetch) + 20 (equivalence check) = 234 D1 REST API requests, all `SELECT`s, reading
49,470,624 + 11,466,920 + 957,008 + 294 ≈ 61.9M rows total across the whole session. D1 Standard
pricing includes 25 billion rows read/month free; even at Cloudflare's paid-tier overage rate
(~$0.001/million rows read), 61.9M rows is a fraction of a cent. No spend beyond what D1's free
tier already covers.

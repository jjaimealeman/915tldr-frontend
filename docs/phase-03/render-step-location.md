# Render Step Location — D-01 Decision

> **Amended by Phase 4 (D-05), 2026-09-26.** For the static site (this document's subject), the
> render step itself no longer runs inside the cron Worker — Phase 4 moved `astro build` onto
> Cloudflare Workers Builds. The cron Worker's role for the static site is now to TRIGGER a
> Workers Builds build (via a Deploy Hook, D-02, OPS-10) after ingest finishes, only when public
> articles changed; Workers Builds itself builds and deploys. **This decision's measured-workload
> conclusions below stand unchanged** — the ~1.2%-at-mean / ~5.1%-at-peak headroom figures, the
> "no new infrastructure" reasoning, and the rejected-option analysis are still the correct record
> of why a render step (wherever it now runs) does not need Queues or a from-scratch CI pipeline.
> What changed is only WHERE that step executes and under what per-build ceiling (Workers Builds'
> 20-minute hard limit, not the cron Worker's ~900s wall-time/CPU ceiling this document measured —
> see `docs/phase-04/build-pipeline-decision.md` for the Workers Builds-specific measurements
> this amendment rests on: `WB_COLD_FITS`, `WB_REUSE_PROVEN`). **Phase 5's R2 archive
> re-render may still run inside this cron Worker** — that path is untouched by D-05, which
> concerns only the static site's `astro build` step. Full pipeline: `docs/phase-04/build-pipeline.md`.

**Decision: the render step runs inside the existing 2-hour cron Worker (Option A) — for both
the normal steady-state incremental render and the rare full-corpus rebuild**, which runs as the
same incremental machinery repeated across consecutive cron cycles with staleness forced, not as
a separate mechanism. No new infrastructure (no Queues, no CI pipeline) is introduced by this
decision.

**Historical note (pre-Phase-4): this section described the ORIGINAL plan, since superseded by
the amendment above for the static site.** It is retained below verbatim as the historical
record of the measured reasoning that ruled OUT Option B (Queues) and Option C (CI) — the same
reasoning Phase 4's planner relied on rather than re-litigating from scratch. Read every
"runs inside the cron Worker" statement below as describing the ORIGINAL Option A design, not
Phase 4's actual as-built pipeline.

Owner decision, 2026-09-23, made from the three measurements this plan exists to put in front of
them (`docs/phase-03/measurements.md`) plus one additional measurement taken to close a gap this
plan's own checkpoint flagged as unmeasured (see "The measurement that closed the gap" below).

## The figures this was decided from

Every figure below is a reference into `docs/phase-03/measurements.md` — reproduce there, not
here, before trusting a number that may have changed since 2026-09-23.

| Figure | Value | Section |
|---|---|---|
| Real cron CPU ceiling (this project's 2-hour interval) | 902,000ms, empirically fired | §3 |
| STATE.md's carried-forward figure it replaces | 300,000ms — confirmed **wrong by 3x** | §3 |
| Existing production cron CPU usage | p50 120ms / p95 619ms (n=2) | §3 Part B |
| Headroom vs. ceiling | ~901,381ms unused — 99.93% | §3 Part B |
| Per-page cost, current per-request D1 shape | p50 573.3ms / p95 735.9ms (KV write dominates at p50 338ms; render itself is p50 0.07ms) | §2 |
| Per-page cost, bulk-fetch shape | p50 342.4ms / p95 400.9ms + one-time 26.6s bulk fetch | §1b / §4b |
| Full-corpus rebuild projection, current shape | 6.34h (p50) / 8.14h (p95) — 25.3x–32.5x OVER the ceiling | §4 |
| Full-corpus rebuild projection, bulk-fetch shape | 3.80h (p50) / 4.45h (p95) — 15.2x–17.8x OVER the ceiling | §4b |
| Articles that fit inside one cron invocation | ~1,223 (p95) / ~1,574 (p50) | §4 |
| D1 rows/pass — offset / keyset / bulk-fetch | 49.4M (9.9x over 5M hard-fail) / 11.5M (2.3x over) / 957,008 (0.19x — under) | §1, §1b |
| Bulk-fetch in-memory stitch peak heap | 128.4MB vs. 128MB Workers isolate limit — marginally over, Node-process proxy, not Worker-verified | §1b |

## The measurement that closed the gap

The 03-07 checkpoint recommended Option A but flagged one number as unmeasured: how many
articles actually arrive per 2-hour cycle in production, against the ~1,223–1,574 per-invocation
capacity §4 measured. The orchestrator closed this directly against live production D1:

```sql
SELECT SUM(cnt), ROUND(AVG(cnt),1), MAX(cnt), COUNT(*)
FROM (SELECT created_at/7200 AS b, COUNT(*) AS cnt FROM articles
      WHERE created_at > unixepoch()-604800 GROUP BY b)
```

| Measure | Value |
|---|---|
| Articles ingested, trailing 7 days | 1,158 |
| **Mean per 2-hour cycle** | **15** |
| **Busiest single cycle observed** | **62** |
| Cycles with data | 77 of 84 |
| Capacity per invocation (§4) | ~1,223 (p95) – ~1,574 (p50) |

**This is the load-bearing evidence for Option A, not the 99.93% CPU-headroom figure alone.**
Steady-state consumes ~1.2% of one invocation's capacity at the mean (15/1,223); the busiest
observed cycle in a full week consumed ~5.1% (62/1,223) — roughly 20x headroom at observed peak,
not merely at a theoretical ceiling. Option A is ruled in by a real measured workload, not by an
assumption about what the workload might be.

## Why Option A won

- The steady-state workload (15 articles/cycle mean, 62 at the observed peak) sits nowhere near
  the ~1,223–1,574 per-invocation capacity §4 measured — roughly 20x headroom at the worst
  observed week, not a near-miss.
- No new infrastructure: no queue to reason about, no CI pipeline to stand up on an account that
  currently has zero Workers Builds history and no git remote (03-03) — "render in CI" here
  concretely means "on a developer's own machine or infrastructure that doesn't exist yet," a
  real setup cost, not a free lunch.
- Matches ROADMAP.md's own Phase 4 success criterion 3 as already written ("A cron cycle triggers
  an incremental build that re-renders only new and changed articles") — no rewrite of a
  criterion already committed to this shape.
- The one real cost — a full-corpus rebuild cannot run in a single invocation and instead spans
  ~26–33 chained cron cycles (~2.7 days wall-clock at the measured ~1,223/cycle p95 capacity: 
  39,827 ÷ 1,223 ≈ 33 cycles) — was explicitly accepted by the owner as a cost worth paying for a
  rare event (initial backfill, a schema migration, or a template change invalidating the whole
  manifest), rather than standing up Queues or CI to shave that to hours for something that
  happens a handful of times a year at most. **Superseded for the static site by 04-11
  (`docs/phase-04/build-pipeline-decision.md`): a forced full rebuild now runs as a single
  Workers Builds build (`ARTICLES_FORCE_COLD=1`), not a multi-day chained-cron-cycle sequence —
  `WB_COLD_FITS` confirmed a cold build fits well inside Workers Builds' 20-minute ceiling.**

## Why each rejected option lost

**Option B — separate Worker via Queues.** Not ruled out by any measured number (fan-out would
comfortably clear every ceiling above), but not ruled in by one either: nothing measured shows
the steady-state workload needs fan-out, and the full-rebuild case Queues would speed up is rare
enough that the owner accepted a multi-day chained-cron-cycle alternative instead of paying for a
queue, a producer, a consumer, and partial-batch-failure handling — complexity this whole phase
exists to avoid, not add, for a workload that measures at ~1.2% of one invocation's capacity.

**Option C — CI / Node build.** Loses on the same measured non-necessity (nothing forces it) plus
a real, named operational cost: this account has zero Workers Builds history and this repo has no
git remote (03-03) — CI is infrastructure that would have to be built, not infrastructure that
exists and merely needs pointing at this repo. No measured ceiling (CPU, memory, or D1 rows-read)
requires escaping the Workers runtime for the steady-state workload this decision governs.

## Derived findings recorded as binding constraints on Phase 4

These were not in `measurements.md` as written — they are arithmetic and platform-documentation
synthesis performed against its already-measured figures during this checkpoint, and are recorded
here because they change what Phase 4 is allowed to build, not merely what this decision is.

### 1. Staleness detection must not re-scan the full corpus every cron cycle

The bulk-fetch shape (§1b) fits comfortably inside the 5,000,000-row single-pass hard-fail budget
at 957,008 rows. But PROJECT.md's D1 budget is a **daily** figure (`<2,000,000` soft,
`>5,000,000` hard-fail), and this cron runs 12 times/day:

> **957,008 rows/pass × 12 cycles/day = 11,484,096 rows/day — 5.7x PROJECT.md's 2,000,000-row
> soft budget and 2.3x its 5,000,000-row daily hard-fail.**
>
> Staleness detection MUST NOT re-scan the full corpus each cron cycle. The bulk-fetch shape that
> fits the single-pass budget (957,008 rows) exceeds the DAILY hard-fail when run 12x/day. Use a
> cheap incremental signal — `WHERE updated_at > last_render_time`, or a flag set by the ingest
> pipeline — and reserve the full bulk-fetch pass for forced full rebuilds only.

At a measured 15 articles/cycle mean, this is trivially satisfiable — but only if Phase 4's loader
is built to look for changed rows, not to bulk-fetch and diff the whole corpus every cycle. This
is the single easiest way for Phase 4 to silently violate the project's core D1 budget while
appearing to use the "cheap" query shape §1b just validated. A forced full rebuild (Option A's
own worst case, above) is the one context where a full bulk-fetch pass is legitimate, and it
already runs at most once across a whole multi-day rebuild window, not once per cycle within it.

### 2. Per-page cost is Node wall-clock time, not confirmed Worker CPU time — but the conclusion holds anyway

§2's per-page cost (573–736ms) was measured as elapsed wall-clock time in a Node child process
(`astro build`), and its two largest components — the D1 read (231ms p50) and the KV write
(338ms p50) — are network I/O waits. Cloudflare's CPU-time model excludes I/O wait from billed
CPU time (the same principle §3 Part B already applies to its own data, labeling wall time
"informational — mostly I/O wait, not CPU-bound"). This means §4/§4b's projections, which compare
this wall-clock per-page cost directly against the 902,000ms **CPU**-time ceiling, may be
comparing the wrong two things for an I/O-dominated workload if the true binding constraint were
CPU time alone.

**It does not change the conclusion.** Cron Triggers carry a second, independent ceiling:
Cloudflare's Duration limits table lists a 15-minute (900,000ms) **wall-time** cap for a Cron
Trigger invocation, separate from the CPU-time table — confirmed directly against
`developers.cloudflare.com/workers/platform/limits/`. For an I/O-dominated workload like this
one, the wall-time cap is what actually binds, and it sits at essentially the same ~900-second
figure as the measured CPU ceiling. §4 and §4b's projections stand as written; this is a
precision note on which ceiling mechanism governs, not a correction to either number.

## Flagged for other phases — not fixed here, out of this plan's file scope

1. **ROADMAP.md Phase 4 success criterion 3** already reads "A cron cycle triggers an incremental
   build that re-renders only new and changed articles and ships a new Worker deployment" — this
   is consistent with Option A as written today. No change needed; noted so Phase 4's planner
   does not re-open a question this decision already answers.
2. **ROADMAP.md Phase 5 success criterion 5** references "no single Worker invocation exceeding
   the 300 s CPU ceiling" for a full archive re-render. This may be a legitimate, distinct figure
   (Phase 5's archive re-render is plausibly an HTTP-triggered Worker path, where 300,000ms is the
   correct configurable maximum, not the Cron Trigger ceiling this plan corrected). Flagged for
   Phase 5's own planner to confirm which ceiling actually governs that path, rather than assuming
   either way.
3. **KV bulk-write batching** (10,000 pairs/request, <100MB body — verified directly against
   Cloudflare's "Write key-value pairs" documentation, no longer the unverified carried-forward
   citation 03-04-SUMMARY flagged) is worth a Phase 4 investigation regardless of this decision:
   the manifest write at p50 338ms dominates every full-rebuild projection above, and collapsing
   ~39,827 sequential single PUTs into a handful of bulk calls would shrink every rebuild-duration
   number in this document, in either the steady-state or the full-rebuild case. Also confirmed:
   "Bulk writes are not supported using the KV binding" — any bulk-write implementation must use
   the REST API path, consistent with this project's existing build-time D1 REST access pattern.

## What this decides / does not decide

**Decides (as originally written, 2026-09-23 — see the amendment at the top of this document for
what actually shipped):** where the render step executes (inside the existing 2-hour cron
Worker), for both the steady-state incremental case and the full-rebuild case (via chained cron
cycles, not a separate mechanism). **As amended by Phase 4 (D-05):** the render step (`astro
build`) itself runs on Cloudflare Workers Builds; the cron Worker's role is reduced to triggering
it. The full-rebuild case also moved off chained cron cycles onto a single Workers Builds build
(04-11, option-a) — see `docs/phase-04/build-pipeline-decision.md`.

**Does not decide:**
- The incremental-render mechanism itself (which rows are considered stale, how the manifest's
  content hash is compared) — that is Phase 4's own work (REND-02/REND-03).
- The hot/archive tiering that changes the corpus size the render step operates over — that is
  Phase 5's.
- Whether KV bulk-write batching is adopted — flagged above as a Phase 4 investigation, not
  decided here.

## What would reopen this decision

This decision holds as long as the steady-state workload stays well inside one cron invocation's
measured capacity. Concretely, reopen it if any of the following becomes true:

- **Sustained per-cycle new/changed article volume approaches the measured capacity** —
  specifically, if the mean or a recurring peak trends toward roughly half of the ~1,223 (p95)
  per-invocation figure (~600 articles/cycle), the safety margin this decision relies on
  (currently ~20x at the observed weekly peak) has eroded by an order of magnitude and the
  decision should be re-measured, not assumed to still hold.
- **Full rebuilds become frequent rather than rare.** This decision (as originally written)
  accepted a ~2.7-day wall-clock window for a full rebuild on the premise that a full rebuild is
  an occasional event (initial backfill, a schema migration, a template change). If full rebuilds
  become a routine operational need, the cost calculus shifts toward Option B (Queues) or Option C
  (CI). **As amended, the static site's actual full-rebuild path (04-11, a single Workers Builds
  build) has its own reopening condition — re-measure if the corpus grows enough that a cold
  Workers Builds build approaches the 20-minute ceiling; see
  `docs/phase-04/build-pipeline-decision.md`'s "Re-measure when the corpus grows" note.**
- **The corpus grows toward STATE.md's anticipated 82,000-row bilingual size** and per-cycle
  ingest volume grows proportionally — re-run the trailing-7-day ingest-volume query above against
  the larger corpus before assuming the same ~20x headroom still holds.
- **Any of the ceiling figures this decision depends on changes** — a Cloudflare platform change
  to the Cron Trigger CPU or wall-time ceiling, or a change to this project's cron interval away
  from 2 hours (which would move the applicable ceiling row in Cloudflare's Duration/CPU tables).

# Phase 6 Plan 17: Backfill Convergence on dev.915tldr.com

**Recorded:** 2026-10-05. All requests were GET-only against `https://dev.915tldr.com`. Nothing was
forced: no re-upload, no deploy hook, no write of any kind.
**Last backfill write:** 2026-10-05T11:23:35Z (pipeline repo `translation-backfill-log.md`, chunk 50;
first backfill write of this run 2026-10-05T06:12Z).

Labels: **MEASURED** = observed in this session. **DERIVED** = arithmetic on measured values.

## Premise finding: the backfilled rows are all hot-tier, not archive-tier

The plan samples "archive-tier" backfilled articles, expecting D-10's re-render through the archive
chain (REND-12). That set is empty.

| Fact | Value | Label |
|---|---|---|
| Hot window | 202 days (`src/lib/archive/hot-window.json`, D-07b) | MEASURED (file) |
| Archive cutoff of the local plan | 2026-03-16T00:00:00Z (`dist/archive-plan.json`, built 2026-10-04) | MEASURED (file) |
| Backfilled window | published 2026-07-10 to 2026-10-04 (the newest 10,000 eligible, shape B) | MEASURED (D1) |
| Public articles older than the cutoff (archive tier) | 13,290 | MEASURED (D1), matches build-budget.md's archivedEn |
| `origin='backfill'` rows with `published_at` before the cutoff | 0 | MEASURED (D1) |
| Clean Spanish rows in the archive tier | 2, both `backfill-pilot` (article ids 9 and 10, written 2026-10-04T06:54:23Z) | MEASURED (D1) |
| Archive-tier eligible articles deferred by decision | 13,243 with stored content (17,336 hot-tier deferred) | MEASURED (D1) |

So this backfill adds **no** archive-tier re-upload work (DERIVED: build-budget.md section 6's
26,580-object backlog assumed backfilling the whole archive; with 0 backfilled archive-tier rows the
re-upload is the 2 pilot articles' two languages, 4 objects, and was already served). The backfilled
rows reach readers through the ordinary hot-tier static build on the next ingest-triggered build. The
REND-12 archive re-upload path would matter only if the 13,243 deferred archive-tier articles are later
extended; this plan's convergence projection (CONVERGES_24H, derived) stays untested at scale.

**Substitution I made, stated plainly:** instead of 20 archive-tier articles I sampled hot-tier
clean backfilled articles, picked evenly across the whole window by publish date (2026-07-10 to
2026-09-29), and I separately checked the only 2 archive-tier clean rows that exist.

## What each check counts

For each sampled article (English canonical path `/<category>/<slug>-<uuid>`, built from D1):

1. `GET /es<path>` is 200, contains the Spanish title written to D1 (HTML-entity-decoded), and carries
   no `data-fallback-note`.
2. `GET <path>` (English) is 200 and declares `<link rel="alternate" hreflang="es"`.
3. `Server-Timing` of both pages is recorded (`archive;desc=r2` or `edge-cache` means Worker-served
   archive tier; empty means a static asset).

A page passes only if all three of the first two hold.

## Round 0: before the next build

Taken 2026-10-05T11:27Z, 4 minutes after the last write. Live build at that time: `builtAt`
`2026-10-05T10:09:35.044Z` (`/version.json`), which predates 758 of the 3,563 clean rows.

**15/20 pass.** The 5 that did not are the five oldest samples (published 07-10, 07-15, 07-19, 07-22,
07-27); they show the fallback note and no hreflang `es`. They are exactly the rows written after that
build began: their D1 write times are 11:23:35Z, 11:12:10Z, 11:00:42Z, 10:47:19Z and 10:31:50Z, while the
rows that pass (for example id 33819, written 09:27:59Z) were written before it. The backfill writes
newest first, so the oldest rows come last. MEASURED.

## Round 1: first ingest-triggered build after the last write

New build observed live: `builtAt` **2026-10-05T12:14:04.054Z**, which is **50.5 minutes** after the
last write (DERIVED from the two timestamps). Sampled at 2026-10-05T12:18:30Z, **54.9 minutes** after
the last write.

| Sample | n | Spanish title, no fallback note | English declares hreflang es | Pass | Archive-served |
|---|---|---|---|---|---|
| Same 20 as round 0 (evenly spaced, 2026-07-10 to 2026-09-29) | 20 | 20 | 20 | **20/20** | 0 (all static) |
| Independent wider sample, 40 more (offset 5, same spacing) | 40 | 40 | 40 | **40/40** | 0 |
| Negative control: 10 held backfilled rows | 10 | 0 shown | 0 | all 10 show the fallback note, as designed | 0 |
| Archive-tier clean (pilot) ids 10 and 9, published 2025-12-14 and 2025-12-15 | 2 | 2 | 2 | **2/2** | 2/2, `archive;desc=r2` on both languages |

All MEASURED. Round 0 to round 1 moved 15/20 to 20/20 on the same articles, across one build. Held rows
correctly keep the English fallback with no Spanish title shown and no hreflang `es`.

The two archive-tier pilot articles were written 2026-10-04T06:54:23Z and show real Spanish from the
archive tier now. The time from their write to my observation (about 29 hours) is not a convergence
time: the first frontend build containing Phase 6's `/es` pages may have come well after the write, and
I did not measure when each of their objects was re-uploaded. It shows only that the REND-12 chain
produced Spanish for an archive-tier article at n=2.

## Comparison with 06-12's CONVERGES_24H projection

That projection (build-budget.md section 6, DERIVED) was for a 26,580-object archive re-upload backlog
that this scoped backfill does not create. Measured here: hot-tier rows converged in **one build,
50.5 minutes after the last write**, well inside 24 hours. The archive re-upload rate was not measured
because there was no archive backlog to measure. Not tested: an actual archive-tier backlog.

## Remaining steps for the orchestrator

None are required for this backfill: the sampled set is 20/20 and 40/40. Optional, if more evidence is
wanted:

1. Re-run the same GET sample after one more ingest build (about 2 hours): `node sample.mjs
   clean-rows.json 20 0` (scripts kept in the session scratchpad, not in the repo).
2. If Jaime later approves extending the backfill to the 13,243 archive-tier deferred articles, run a
   real archive-tier convergence measurement then (build-budget.md section 6's projection applies to
   that case, still derived, never measured).

converged: yes - 20/20 hot-tier backfilled clean articles show Spanish with no fallback note and an English hreflang es, 54.9 minutes after the last backfill write (one ingest build, builtAt 2026-10-05T12:14:04Z); archive-tier criterion not applicable because 0 backfilled rows are archive-tier (the 2 archive-tier pilot rows also pass, 2/2)

# Archive-Tier Latency — Worker→R2 Cost and LCP Fit (ROADMAP Criterion 2)

Produced by 05-11-PLAN.md Task 3. Measures the archive tier's actual cost on the real deployed
Worker (`dev.915tldr.com`, commit `1f22fc8`, `hashSource: local-git` — redeployed directly from
this plan's own branch to align the live build with local HEAD; see 05-11-SUMMARY.md) and judges
it against the project's LCP budget. Complements 05-09's own cold R2/KV measurement
(`docs/phase-05/archive-architecture.md`'s "First production archive deploy" section, 150
samples, R2 p95 215ms / KV p95 188ms) with a larger sample (200 cold reads), a client-TTFB
comparison across three request classes, and — new in this plan — lab LCP in real Chromium.

**Tool:** `tools/measure-archive-latency.mjs --json --evidence docs/phase-05/evidence/latency`
**Evidence:** `docs/phase-05/evidence/latency/` (`result.json` plus the raw per-request sample
arrays for all three measurements)

## Method

1. **R2 latency (cold).** 200 distinct archived article URLs, sampled with `tests/helpers/
   archive-sample.mjs`'s `pickArchivedArticles` (2-day margin past the hot/archive cutoff),
   excluding the handful of paths Tasks 1/2 of this same plan already touched earlier in the
   session. Each requested exactly once — a repeat would measure the 300s edge cache, not R2/KV.
   Only responses whose `Server-Timing` names `archive;desc=r2` (confirmed NOT an edge-cache hit)
   count toward the R2/KV duration stats.
2. **TTFB comparison.** The SAME 50 of those paths, re-requested immediately after (well inside
   the 300s edge-cache TTL — confirmed `archive;desc=edge-cache` on every one), against 50 hot
   (never-archived) article paths served entirely by the static-asset layer (no Worker
   invocation, no `Server-Timing` header at all).
3. **Lab LCP.** Real Chromium (`@playwright/test`'s own launcher, the same fontconfig isolation
   `tests/integration/browser-journeys.test.mjs` uses), Playwright's `Pixel 7` device descriptor
   (a real Chromium-on-Android profile — `userAgent` carries `Chrome/153.0`, `viewport`
   412×839, `deviceScaleFactor` 2.625, `isMobile: true`), a FRESH browser context per page (no
   shared cache/cookies across samples), no artificial network/CPU throttling. 20 archived + 20
   hot article pages; LCP read via `PerformanceObserver({ type: 'largest-contentful-paint',
   buffered: true })` after an 800ms settle delay (`performance.getEntriesByType()` alone always
   returns empty for this entry type — a buffered-only type, confirmed live against this exact
   host during this tool's own development; see the tool's own code comment).

**Operator-machine caveat (disclosed, not hidden):** this measurement ran on the developer's own
workstation (16-core, load average ~1.5 at measurement time — not CPU-starved), not an isolated
CI lab runner. Four back-to-back full runs during this session showed real run-to-run LCP
variance (archived p95: 1200ms, 1212ms, 2108ms, 1788ms) while R2/KV durations stayed tight and
consistent (R2 p95 range 118-184ms across the three bug-fixed runs; see "Why LCP, not R2/KV" below
for what's actually driving that variance). The FOURTH run is reported below as canonical —
committed to as the recorded run BEFORE it was executed, specifically to avoid selecting the most
favorable of the four. This is a LAB proxy; **field LCP at mobile p75 remains Phase 11's actual
release gate** (PROJECT.md: "LCP < 1.5s ... mobile p75, field"), not this measurement.

## Results (canonical run, 2026-10-01T17:07:13.498Z)

### R2 / KV latency (Worker→R2, cold)

| Metric | n | min | p50 | p95 | max |
|---|---|---|---|---|---|
| R2 `get()` (`r2;dur`) | 200 | 78ms | 104ms | **172ms** | 447ms |
| KV manifest read (`kv;dur`, articles only) | 200 | 78ms | 113ms | **155ms** | 201ms |
| Archived object size (from the local build's own `dist/archive-plan.json` `bytes` field — the
  Worker streams the R2 body with no `Content-Length` header, confirmed live, HTTP/2) | 200 | — | 13,070B median | 13,605B p95 | — |

Consistent with 05-09's own 150-sample measurement (R2 p95 215ms, KV p95 188ms) and the
owner-agreed ~300ms hot-window revisit trigger (05-05's decision) — this larger 200-sample run
sits comfortably under that threshold too. **No action on the hot window.**

### Client TTFB (three request classes)

| Class | n | p50 | p95 |
|---|---|---|---|
| Archived, cache-miss (cold R2+KV) | 200 | 352ms | **465ms** |
| Archived, edge-hit (served from `caches.default`, zero R2/KV reads) | 50 | 126ms | **149ms** |
| Hot, static (Workers Static Assets, Worker never invoked) | 50 | 166ms | **188ms** |

An archived cache-miss costs roughly 280-300ms more TTFB than a hot static page at p95 (465ms vs.
188ms) — almost entirely the R2+KV read cost measured above (172 + 155 = 327ms combined, matching
the gap). An archived edge-hit (within the 300s TTL) is actually comparable to, or faster than, a
hot static request in this sample (149ms vs. 188ms p95) — the manual Cache API layer performs
well once warm.

### Lab LCP (mobile Chromium, Pixel 7 descriptor)

| Group | n | p75 | p95 |
|---|---|---|---|
| Archived articles | 20 | 1,400ms | **1,788ms** |
| Hot articles | 20 | 1,168ms | **1,484ms** |

Archived p95 LCP (1,788ms) exceeds the 1,500ms budget on this canonical run — see "## Verdict"
below for the full verdict line and owner-review notes.

## Why LCP, not R2/KV, is the actual gap — and why hot pages are close to the line too

The R2/KV read cost itself is small relative to the LCP gap: TTFB for an archived miss is only
~280ms slower than a hot static page (465ms vs. 188ms p95), but LCP for archived pages is
**~300ms slower than hot pages at p95** (1,788ms vs. 1,484ms) — roughly the same gap, which is
consistent and expected (the archive tier's own cost shows up almost entirely in TTFB, as
designed; it does not compound further downstream). **The dominant contributor to LCP for BOTH
groups is NOT the archive tier** — it's whatever happens between TTFB and paint for this page
template generally: hot pages ALSO sit close to the 1.5s line (p95 1,484ms, p75 1,168ms) despite
zero archive-tier involvement at all. This points at general page-weight/render cost (images,
fonts, layout) as the primary lever for closing this gap — not the archive-serving mechanism
specifically, which is doing its job (R2/KV p95 well under 200ms each).

## Worst-case arithmetic against the budget

Archived p95 TTFB (465ms) + archived-vs-hot LCP delta (304ms) ≈ the 1,788ms observed archived p95
LCP tracks directly from hot p95 LCP (1,484ms) plus the archive tier's own TTFB tax (roughly
280-300ms) — not from any R2/KV cost compounding further down the render pipeline. If the archive
tier's TTFB tax were fully eliminated (an archived page served exactly as fast as a hot one),
archived p95 LCP would land close to hot's own 1,484ms — **still only marginally under the
1,500ms budget**, because the underlying page template is already close to the line regardless of
tier. This is the real, actionable finding: the archive tier adds a real but modest and
well-understood tax (~300ms, matching its own measured R2+KV cost almost exactly); the page
template itself is the thing sitting closest to the 1.5s ceiling.

## Verdict

**`R2_LATENCY_EXCEEDS_LCP` | archived p95 LCP 1,788ms > 1,500ms budget (canonical run,
2026-10-01T17:07:13.498Z, n=20) | `node tools/measure-archive-latency.mjs --json --evidence
docs/phase-05/evidence/latency`**

**Flagged for owner review (criterion 2, lab measurement):** this is a LAB proxy on an operator
workstation, not Phase 11's field measurement, and the four-run range (1200-2108ms archived p95)
straddles the 1,500ms line depending on run — this is not a clean, unambiguous fail, but it is not
a clean pass either, and per this plan's own instruction the result is reported as measured, not
adjusted to pass. Two things are worth the owner's attention before Phase 11:

1. The archive tier's own cost (R2+KV, ~300ms combined p95) is small, consistent, and not the
   primary risk — no action needed there.
2. The underlying page template's own LCP (hot pages, zero archive-tier involvement) already sits
   close to the 1.5s line in this lab proxy (p95 1,484ms) — general page-weight/render
   optimization (images, fonts) is the lever that would create real headroom for both groups,
   not a change to the archive-serving mechanism.

Field LCP at mobile p75 (PROJECT.md's actual release gate) should be the basis for any go/no-go
decision — this lab proxy exists to flag risk early, not to replace that measurement.

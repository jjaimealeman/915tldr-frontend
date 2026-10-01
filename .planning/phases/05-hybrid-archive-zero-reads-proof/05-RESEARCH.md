# Phase 5: Hybrid Archive & Zero-Reads Proof - Research

**Researched:** 2026-09-30/10-01
**Domain:** Cloudflare Workers/R2/KV/D1 analytics, Astro static+archive hybrid rendering, Workers Builds CI
**Confidence:** MEDIUM — two of CONTEXT.md's highest-priority unverified questions are now answered
with direct, live, first-party evidence (see below); several downstream consequences of those
answers are new findings this session surfaced that the locked decisions did not anticipate and
are flagged as discussion points, not overridden.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The zero-reads gate (ARCH-01) — what counts as proof**
- **D-01:** The gate passes on **structure plus a load test**, not on a literal per-Worker "0"
  read from D1 analytics. Leg 1 (structural): v2's Worker has no D1 binding, already enforced at
  build time by `tools/assert-no-d1.mjs`. Leg 2 (measured): a scripted pass of a few thousand
  requests covering the roadmap's request mix (homepage, all 8 categories, 20 hot articles,
  20 archived articles, 20 tag pages including archived ones, sitemap, `/rss.xml`). D1 rows-read
  for that window must stay within v1's normal background for a comparable window. The
  researcher must first establish **whether** D1 analytics can attribute reads to a calling
  Worker (unverified as of this discussion). If they can, use that as a stronger leg 2. Either
  way the method and its limits are written down next to the result.
  — Reversibility: reversible — it is a measurement method, not a deployed contract.
- **D-02:** A failed gate halts the project for architecture review, as written in the
  roadmap. A non-zero read is not logged as a defect and fixed in-phase. Phase 6 does not start
  on top of an unproven premise.
- **D-03:** The gate runs **after** the archive tier is serving. The archived-article and
  archived-tag paths (Worker → R2) are the riskiest part of the request mix and must be inside
  the measured pass, not proven separately.

**Hot window (REND-10) — derived from traffic**
- **D-04:** The hot cutoff is derived from **v1's real reader traffic on 915tldr.com** (same URL
  shapes, same readers v2 will inherit), using Cloudflare's per-URL request data. v1 has no view
  counting of its own (checked 2026-09-30: no view/analytics columns or beacons in 915tldr.com2).
  Waiting for v2 traffic was rejected: v2 has no real readers until the Phase 12 cutover.
- **D-05:** **30-day window**, covering a full news cycle and smoothing a single viral day.
- **D-06:** **Human traffic only.** Crawlers sweep the archive evenly and would make every
  article look hot. Archived pages still serve correctly to crawlers via R2.
- **D-07:** **Fallback when per-URL history is unavailable or too thin:** a provisional
  **age-based cutoff** (keep the newest N days static, N chosen to fit comfortably under the 80k
  margin). It must be **visibly flagged as provisional** wherever it is recorded, and re-derived
  from traffic once a 30-day window exists. How much per-URL history the platform retains, and on
  which plan, is unverified and is the researcher's first check.

**Tag tiering (REND-09)**
- **D-08:** A tag stays **static only if it has 10 or more articles** (about 2,325 tags today).
  All other tags render to R2. This frees about 17,500 static files. The threshold is applied at
  build time, so tags promote and demote automatically as they grow.
- **D-09:** **Archived tag pages update in the same 2-hour cycle.** When newly ingested articles
  carry an archived tag, only the touched tag pages are re-rendered to R2 on that cycle (usually a
  few dozen pages). Tag pages must never visibly lag their articles.

**Archive freshness (REND-07, REND-12)**
- **D-10:** **Redesign or template change: the archive re-renders in the background within
  24 hours.** The deploy ships hot pages in the new design immediately. For up to a day, archived
  pages may show the previous design. A deploy is never blocked on the full archive re-render.
  The full re-render must complete without any single Worker invocation exceeding the CPU ceiling
  (REND-12).
- **D-11:** **Content changes to an archived article** re-render **just that article in the same
  2-hour cycle**, the same rule as D-09.
- **D-12:** **Partial R2 write failure: keep the old copy and alert.** The previous R2 object
  keeps serving. The owner gets an ntfy push naming how many pages failed. The next cycle
  retries. One bad page never blocks the rest.

**File-count budget (REND-11)**
- **D-13:** The build fails at **80,000** static files. Reported daily against the 100,000
  ceiling. Baseline: 60,387 (2026-09-30).

### Claude's Discretion
- Where the archive render runs (Workers Builds in Node writing to R2, versus a Worker), and how
  R2 objects are keyed and versioned, as long as D-09 to D-12 hold and ARCH-08's ≤1 KV read /
  <5 ms CPU per public request holds on the archive path too.
- How "touched" articles and tags are detected per cycle (reuse of the render manifest and
  loader's warm-mode change detection is expected).
- Load-test tooling, request count and the baseline window for D-01's leg 2.
- Where the daily file-count report is delivered (it joins D1 reads and spend in the existing
  daily routine).

### Deferred Ideas (OUT OF SCOPE)
- **Thin one-article tag pages.** Whether to noindex or stop building 1-article tags is an SEO
  decision for Phase 11 or later, not an archive-tier decision. Phase 5 only moves them to R2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Public page request completes with zero D1 row reads, verified against Cloudflare D1 analytics | §"Question 1" below resolves whether D1 analytics can attribute reads to a Worker (it cannot); confirms D-01's leg-2 design (databaseId-filtered delta measurement) and corrects the database id to use |
| ARCH-08 | A public request performs at most 1 KV read and under 5ms Worker CPU | §"Worker fall-through architecture" — extend the existing single manifest KV read rather than add a second lookup; R2 `get()` is I/O wait, not billed CPU |
| REND-07 | Articles outside the hot window render once to R2 and serve from there | §"Render pipeline & the CPU/wall-time ceiling", §"R2 architecture" |
| REND-08 | Archived article request falls through static-asset layer, served from R2 | §"Worker fall-through architecture", Code Examples |
| REND-09 | Tag pages default to archive tier; top-N promoted to static | §"Tag manifest — new design surface" |
| REND-10 | Hot-content cutoff derived from measured traffic | §"Question 2" below — zone plan, permission, and retention findings; this is the load-bearing finding of this research |
| REND-11 | Total static-asset file count reported daily, alarms before 100,000 | §"File-count budget enforcement" |
| REND-12 | Full archive re-render completes without exceeding Worker CPU limits | §"Render pipeline & the CPU/wall-time ceiling" — resolves the open flag left by Phase 3's 03-07 decision document |
</phase_requirements>

## Summary

This phase hinges on two previously-unverified platform facts, both resolved this session with
first-party evidence (live Cloudflare API calls against this account, plus official docs):

1. **Cloudflare D1 analytics cannot attribute rows-read to a calling Worker.** Confirmed by
   directly introspecting the GraphQL schema for `d1AnalyticsAdaptiveGroups` and
   `d1QueriesAdaptiveGroups` — the only dimensions are `databaseId`, `databaseRole`, date/time
   variants, and `servedByInstance`/`servedByRegion`. There is no script/worker-name dimension.
   D-01's leg 2 must be the delta-measurement design CONTEXT.md already anticipated as the
   fallback: measure `rowsRead` for the production database (`552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`
   — **not** `252435de-25d3-4e0a-8652-c2cb0ea1751c`, which this research found is actually the
   **dev** database; see "Correction" below) during a baseline window, then again during the
   scripted load-test window, and confirm no attributable delta.

2. **The 30-day traffic window D-04/D-05 call for is very likely not obtainable today.** The
   `915tldr.com` zone is confirmed on Cloudflare's **Free** plan. The project's own API token
   currently lacks the `Zone Analytics: Read` permission (a live query failed with an explicit
   authorization error naming that scope), so no per-URL request data can be pulled at all right
   now. Even once granted, Cloudflare's documented retention for the adaptive per-request dataset
   that carries `clientRequestPath` is **~7 days on Free and Pro plans**, 31 days on Business, 90
   on Enterprise — a paid-plan upgrade to get 30 days of retroactive history would cost far more
   than this project's stated budget tolerates. **Practical consequence: D-07's "provisional
   age-based cutoff" is very likely the mechanism Phase 5 actually ships with at launch**, not a
   rarely-used fallback — this should be surfaced to the user as a discussion point before
   planning locks it in, since it changes the character of D-04/D-05 from "primary mechanism,
   fallback available" to "fallback is likely the real mechanism for some time." See
   "Workers Analytics Engine" below for a zero-cost, plan-independent way to start accumulating
   real traffic data going forward so the 30-day window eventually becomes available on its own.

Beyond those two questions, this phase's other hard problem is **where archive rendering and the
full re-render run**, because Phase 3 and Phase 4 already measured and documented two different,
incompatible ceilings for "a render step," and Phase 3's own decision record explicitly flagged
this phase to resolve which one applies. This research resolves it: **the archive tier — both the
touched-page per-cycle render and the full background re-render — should run inside the same
Workers Builds build Phase 4 already uses for the static site**, not a separate cron-chained
Worker mechanism. The old chained-cron-cycle full-rebuild pattern Phase 3 proved out took ~2.7
days for the current corpus — it cannot satisfy D-10's 24-hour SLA. Workers Builds already proves
a full-corpus render+deploy in ~11 minutes against a 20-minute hard ceiling, with measured headroom
documented in Phase 4. This is Claude's Discretion territory per CONTEXT.md and is presented here
as a strong recommendation with the evidence behind it, not an override of a locked decision.

**Primary recommendation:** Extend the Workers Builds pipeline (not a new cron/Queue mechanism) to
also render archive-tier pages to R2 in the same build that already renders hot pages to
`dist/client`; extend the render-manifest KV schema (v3) so the deployed Worker's one existing KV
read also returns tier + R2 key, so `REND-08`'s fall-through path costs the Worker nothing beyond
what it already pays for the uuid-redirect path; treat D-07's provisional age-based cutoff as the
real Phase 5 launch mechanism and start Workers Analytics Engine logging now so a genuine 30-day
traffic-derived cutoff becomes available within the milestone.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hot-page serving | CDN / Static (Workers Static Assets) | — | Unchanged from Phase 4; a static-asset hit never reaches a Worker |
| Archived-page serving | API / Backend (deployed Worker, `src/worker.ts`) | Database / Storage (R2) | Static-asset MISS falls through to the Worker, which proxies the object from R2 — this is the one new runtime code path this phase adds |
| Tier assignment (hot vs. archive) | Build time (Workers Builds, Node) | — | A build-time decision, not a runtime one — the Worker only reads the *result* (which tier an entry is in) from KV, never computes it |
| Hot/archive cutoff derivation | Build time (Workers Builds, reading Cloudflare Analytics) | Operator-reviewed (manual re-derivation per D-07) | Traffic analysis happens once per cutoff recalculation, not per request |
| File-count enforcement | Build time (Workers Builds, a new assertion script) | — | Mirrors `tools/assert-no-d1.mjs`'s existing pattern — a build-time gate, not a runtime check |
| Zero-D1-reads proof | Build time (structural, `assert-no-d1.mjs`) | Operator-run load test (external script against the deployed Worker) | Leg 1 is build-time; Leg 2 is an out-of-band measurement against Cloudflare's own analytics, not code running inside the Worker |
| Daily file-count / budget report | Operations (wherever the existing D1-reads/spend daily routine lives) | — | Claude's Discretion per CONTEXT.md; no such routine exists yet in this repo (OPS-07 is Phase 12) — flagged as an open question below |

## Standard Stack

### Core
No new runtime dependency is required for the Worker's own read path — it extends the existing
`r2_buckets`/`kv_namespaces` binding pattern already in `wrangler.jsonc`. The only new dependency
is for the **build-time write** path, where Workers Builds (a Node process with no live Cloudflare
bindings, the same constraint already documented for D1 access) needs to write objects to R2.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | **3.1144.0** (npm, published 2026-09-30) [ASSUMED — package name from training/WebSearch, not yet confirmed via an official Cloudflare doc page naming this exact package] | R2's documented S3-compatible API, used from the Workers Builds Node process to `PutObject` archive-tier HTML (and read back for verification) at build time | This is the same category of problem the project already solved for D1 ("REST API called directly" because no live binding exists at build time) — R2 ships an S3-compatible HTTP API specifically for this out-of-Worker-runtime use case [CITED: developers.cloudflare.com/r2/api/, developers.cloudflare.com/r2/get-started/s3/, via WebSearch summary — not independently re-fetched this session]. **Package-legitimacy gate flagged this `SUS` — see audit table below; treat as a checkpoint before install despite the package being AWS's own official SDK.** |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-limit` | **7.3.3** (npm, published 2026-09-18) [ASSUMED] | Bound concurrency for the thousands of `PutObjectCommand` calls a full archive re-render issues, so the build doesn't open an unbounded number of simultaneous R2 requests | Only needed if a plain `Promise.all` over tens of thousands of writes proves too bursty against R2's rate limits during measurement — start without it, add if the full-rebuild measurement shows request errors or throttling |

### R2 access at runtime (no package — binding, see Architecture)
| Approach | Package | Verdict |
|----------|---------|---------|
| `r2_buckets` binding in `wrangler.jsonc`, `env.ARCHIVE_BUCKET.get(key)` inside `src/worker.ts` | none — Workers runtime API | **Recommended for the deployed Worker's read path.** Zero new dependency, mirrors the existing `RENDER_MANIFEST` KV binding exactly. `R2Bucket.get()` returns an `R2ObjectBody` whose `.body` is a `ReadableStream`, pipeable directly into `new Response(obj.body)` [CITED: developers.cloudflare.com/r2/api/workers/workers-api-reference/, fetched this session]. |
| R2 S3-compatible API (`@aws-sdk/client-s3`) at Workers Builds build time | `@aws-sdk/client-s3` | **Recommended for the build-time write path only.** No live binding exists in a Workers Builds Node process (same reasoning already documented in this project's own research for why D1 access at build time uses the REST API, not `drizzle-orm/d1`). |
| Shell out to `wrangler r2 object put <bucket>/<key> --file=... --remote` | none — child_process | Viable for small numbers of objects (parity with the project's existing `wrangler versions upload` build step), but is one process spawn per object — likely too slow for tens of thousands of archive pages in a single build. Not recommended as the primary bulk-write mechanism; flagged as a possible single-object repair tool for D-12's "keep old copy, alert, retry next cycle" path instead. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending the existing Workers Builds pipeline to also render archive pages | A separate cron-triggered Worker, chaining across multiple 2-hour cycles (the ORIGINAL Phase 3 pattern, since superseded) | **Not recommended.** Phase 3 measured this exact mechanism taking ~2.7 days for a ~40k-article full rebuild — it cannot meet D-10's 24-hour SLA. See "Render pipeline" below. |
| Workers Analytics Engine for forward traffic collection | Rely solely on Cloudflare's zone-level `httpRequestsAdaptiveGroups` | Zone analytics is plan-gated (7 days on Free/Pro) and is a third-party-collected dataset the project doesn't control the retention of; Workers Analytics Engine is a first-party dataset the Worker itself writes, available on any plan, with 3-month retention [CITED: developers.cloudflare.com/analytics/analytics-engine/limits/]. Recommended as a parallel, not instead-of, measure — see "Workers Analytics Engine" below. |
| `@aws-sdk/client-s3` for R2 writes | Hand-rolled AWS SigV4 request signing over `fetch()` | Hand-rolling SigV4 is a well-known "don't hand-roll" trap (subtle canonical-request bugs are a classic security/correctness footgun) — use the SDK. |

**Installation:**
```bash
pnpm add @aws-sdk/client-s3
pnpm add p-limit  # only if concurrency throttling proves necessary during measurement
```

**Version verification:** confirmed live via `npm view @aws-sdk/client-s3 version` (3.1144.0,
published 2026-09-30) and `npm view p-limit version` (7.3.3, published 2026-09-18) this session —
[VERIFIED: npm registry] for version/existence only; package-name provenance is still `[ASSUMED]`
per the package-name-provenance rule since both names came from training knowledge / WebSearch,
not an official Cloudflare doc page or Context7 result naming them explicitly.

## Package Legitimacy Audit

| Package | Registry | Age (latest release) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|--------------|---------|-------------|
| `@aws-sdk/client-s3` | npm | published 2026-09-30 (same day as this research) | 54,250,738/week | `github.com/aws/aws-sdk-js-v3` | **SUS** (reason: `too-new`) | Flagged — planner must add `checkpoint:human-verify` before install, despite the package being AWS's own official scoped SDK with a known repo and massive adoption. The gate's heuristic treats any recent release as suspicious regardless of download count; the downloads/repo signals here are about as strong as a legitimacy check can produce. |
| `p-limit` | npm | published 2026-09-18 | 394,471,319/week | `github.com/sindresorhus/p-limit` | **SUS** (reason: `too-new`) | Same disposition as above — flag, don't block; downloads/repo are strong mitigating evidence. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@aws-sdk/client-s3`, `p-limit` — both flagged solely
on release recency, not on any actual legitimacy signal (both have extremely high weekly downloads
and well-known official repositories). The planner should still add the required
`checkpoint:human-verify` task before either install, per protocol, but can note this context in
the checkpoint so the human reviewer isn't surprised to see a "suspicious" flag on AWS's own SDK.

*Checked via `node gsd-core/bin/gsd-tools.cjs query package-legitimacy check --ecosystem npm
@aws-sdk/client-s3 p-limit`, 2026-09-30.*

## Architecture Patterns

### System Architecture Diagram

```
                              ┌─────────────────────────────┐
                              │   Cloudflare Workers Builds   │
                              │   (triggered by ingest cron   │
                              │    Deploy Hook, D-02/OPS-10)  │
                              └──────────────┬───────────────┘
                                             │
                         ┌───────────────────┼───────────────────────┐
                         ▼                                           ▼
          ┌──────────────────────────┐                ┌───────────────────────────┐
          │ articles-loader.ts        │                │ NEW: archive-tier render   │
          │ (warm/warm+sweep/cold)    │                │ step — same build, iterates│
          │ D1 REST API at build time │                │ "touched" archived entries │
          └──────────────┬────────────┘                │ (D-09/D-11)                │
                         │                              └──────────────┬─────────────┘
                         ▼                                             ▼
          ┌──────────────────────────┐                ┌───────────────────────────┐
          │ astro build → dist/client │                │ R2 PutObject (S3-compatible│
          │ (hot pages only)          │                │ API, @aws-sdk/client-s3)   │
          └──────────────┬────────────┘                └──────────────┬─────────────┘
                         │                                             │
                         ▼                                             ▼
          ┌──────────────────────────┐                ┌───────────────────────────┐
          │ NEW: assert-file-count   │                │ 915tldr archive R2 bucket  │
          │ (fails build >80,000)    │                │ (archived articles + tags) │
          └──────────────┬────────────┘                └───────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────┐                ┌───────────────────────────┐
          │ wrangler versions upload  │                │ render-manifest KV (v3):   │
          │ (deploys dist/client)     │                │ +tier, +r2Key per entry    │
          └──────────────┬────────────┘                └──────────────┬─────────────┘
                         │                                             │
                         ▼                                             │
            ┌─────────────────────────────┐                           │
            │  Reader request → Workers    │                           │
            │  Static Assets               │                           │
            └──────────────┬───────────────┘                           │
                HIT (hot page)│  MISS (archived or unknown path)        │
                         ▼    └───────────────┬─────────────────────────┘
                   Served directly            ▼
                   (Worker never runs) ┌─────────────────────────┐
                                       │ src/worker.ts (fetch)    │
                                       │ 1 KV read: manifest entry│◄─ extended schema
                                       │ tier=archive? → R2.get() │
                                       │ tier=hot/missing? → 301  │
                                       │ or ASSETS.fetch (404)    │
                                       └──────────────┬────────────┘
                                                      ▼
                                       Response (optionally cached at
                                       the edge via caches.default —
                                       see Common Pitfalls)
```

### Recommended Project Structure
```
src/
├── worker.ts                  # extended: add archive-serving branch, still ≤1 KV read
├── lib/
│   ├── archive/
│   │   ├── r2-client.ts       # NEW — build-time-only, S3-compatible PutObject helper (mirrors d1-client.ts's "build-time only, never imported by an entrypoint" pattern)
│   │   └── tiering.ts         # NEW — pure functions: isHotArticle(publishedAt, cutoff), isHotTag(articleCount)
│   └── server/
│       └── kv-manifest.ts     # extended: v3 schema adds tier + r2Key fields
tools/
├── assert-file-count.mjs      # NEW — mirrors assert-no-d1.mjs's build-gate pattern
├── load-test-zero-reads.mjs   # NEW — D-01 leg 2: scripted request pass + before/after D1 rowsRead delta
docs/phase-05/
├── archive-architecture.md    # NEW — record the R2 key scheme, manifest v3 schema, which ceiling governs
├── zero-reads-gate.md         # NEW — D-01's method and result, including the D1-attribution finding
└── hot-window-derivation.md   # NEW — records whichever of D-04/D-07 actually ran, flagged provisional if D-07
```

### Pattern 1: Extend the existing single KV read, don't add a second one
**What:** The Worker already performs exactly one `env.RENDER_MANIFEST.get(`manifest:${uuid}`,
'json')` call per request that reaches it (confirmed by reading `src/worker.ts` directly this
session — see Code Examples). ARCH-08 caps this at ≤1 KV read. The archive-serving branch must
reuse this SAME read, not add a second lookup for "is this archived."
**When to use:** Any time a new per-request decision needs data — check whether it can be folded
into an already-planned read before adding a new one.
**Example:** Bump `MANIFEST_SCHEMA_VERSION` to `'3'` (it is currently `'2'`, confirmed in
`docs/phase-03/render-manifest.md`) and add two fields to every entry: `tier: 'hot' | 'archive'`
and `r2Key: string | null` (null for hot entries). The Worker's existing single `get()` call then
has everything it needs to decide hot-redirect vs. archive-R2-serve vs. not-found, with zero
additional reads.

### Pattern 2: Tag pages need their own manifest-like record — this doesn't exist yet
**What:** `docs/phase-03/render-manifest.md`'s documented schema (confirmed by direct read, full
field table above) is **article-keyed only** (`manifest:<uuid>`). There is no existing per-tag KV
record. REND-09's tag-tiering decision (≥10 articles → static) and the Worker's need to resolve
"is this tag path archived, and what's its R2 key" both require a **new** keyspace, e.g.
`tag-manifest:<tag-slug>`, following the same validation-before-write, no-expiration discipline
documented for the article manifest.
**When to use:** This is new design surface for the plan, not a reuse of existing code — flag it
explicitly as such rather than assuming "reuse the render manifest" (CONTEXT.md's Claude's
Discretion wording) means the *article* manifest literally covers tags too.

### Pattern 3: Cache R2-served archive pages at the edge
**What:** Use the Workers `caches.default` Cache API to cache the `Response` built from an R2
object, keyed by the request URL, with an explicit `Cache-Control` TTL. Since an archived page
changes at most once per 2-hour cycle (D-11) or once per 24h (D-10), a TTL in that range means
only the first request after a change pays R2's measured latency; every other request for that
window is served from Cloudflare's edge cache, not R2.
**When to use:** Strongly recommended given the R2 latency variance found in this research (see
Common Pitfalls) — this is the standard mitigation, not a nice-to-have.
**Example:**
```typescript
// Source: developers.cloudflare.com/r2/api/workers/workers-api-reference/ (get/put shapes),
// combined with the standard Workers Cache API pattern (CITED, not independently re-fetched
// this session for the caches.default-specific page — verify exact method signatures before
// implementing).
const cache = caches.default;
const cacheKey = new Request(url.toString(), request);
let response = await cache.match(cacheKey);
if (!response) {
  const obj = await env.ARCHIVE_BUCKET.get(r2Key);
  if (!obj) return env.ASSETS.fetch(request); // archived but missing — fall through to 404
  response = new Response(obj.body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=7200' },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
}
return response;
```

### Anti-Patterns to Avoid
- **Re-fetching D1 to decide tiering at request time:** zero D1 reads is the whole point of this
  phase; hot/archive tier must be a build-time-computed, KV-stored fact the Worker only reads.
- **A second KV namespace or a second `get()` call for tier lookup:** defeats ARCH-08's ≤1 KV read
  budget for no benefit — fold tier/R2-key into the existing manifest entry (Pattern 1).
- **Reusing the chained-cron-cycle full-rebuild mechanism from Phase 3 for the archive full
  re-render:** that mechanism is proven to take ~2.7 days at current corpus size — it cannot meet
  D-10's 24-hour SLA. See "Render pipeline" below.
- **Hand-rolling S3 request signing:** use `@aws-sdk/client-s3`, not a bespoke SigV4 implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signing R2's S3-compatible API requests | A bespoke AWS SigV4 signer | `@aws-sdk/client-s3`'s `S3Client` + `PutObjectCommand` | SigV4 has well-documented, subtle canonical-request bugs; this is exactly the class of problem a maintained SDK exists to absorb |
| Caching archived responses at the edge | A custom in-Worker LRU/memory cache | The Workers `caches.default` Cache API | Workers isolates are ephemeral and not shared across edge locations — an in-memory cache gives none of the cross-request benefit the Cache API gives for free |
| Concurrency-limiting bulk R2 writes | A hand-rolled semaphore/queue | `p-limit` (if measurement shows it's needed) | A well-tested one-function library for exactly this; a hand-rolled version is extra surface for a subtle off-by-one or unhandled-rejection bug during a rare, high-stakes full-rebuild path |

**Key insight:** every "don't hand-roll" item in this phase exists because this phase pushes the
project's first code into two areas (R2 build-time writes, edge-level response caching) it hasn't
touched before — reach for the platform-provided or ecosystem-standard tool, not a bespoke
mechanism, for both.

## Common Pitfalls

### Pitfall 1: The ROADMAP's "300s CPU ceiling" for REND-12 is almost certainly the wrong number for this phase
**What goes wrong:** A plan that takes ROADMAP.md's success criterion 5 ("no single Worker
invocation exceeding the 300 s CPU ceiling") at face value and designs the full re-render around a
5-minute budget.
**Why it happens:** That figure is the HTTP-request Worker CPU ceiling's configurable maximum
(`limits.cpu_ms`, capped at 300,000ms by the platform itself — confirmed in
`docs/phase-03/measurements.md` §3), not the ceiling that actually governs whichever execution
context ends up running the archive re-render. Phase 3's own decision record
(`docs/phase-03/render-step-location.md`, item 2 under "Flagged for other phases") explicitly left
this for Phase 5 to resolve: *"This may be a legitimate, distinct figure... Flagged for Phase 5's
own planner to confirm which ceiling actually governs that path, rather than assuming either way."*
**How to avoid:** This research's conclusion, with evidence: route the archive full re-render
through the SAME Workers Builds build mechanism Phase 4 already uses (D-05/04-11's "option-a"), not
a Cron-Trigger-invoked Worker. Workers Builds' hard ceiling is a **20-minute wall-clock build
timeout** [VERIFIED: `docs/phase-04/build-pipeline-decision.md` line 21, "`WB_COLD_FITS` verdict |
649s comfortably fits the 20-minute hard ceiling (~9.2min margin over the 900s/15min threshold)"],
not a Workers-runtime CPU-ms figure at all — REND-12's "Worker invocation" phrasing predates
Phase 4's D-05 amendment and should be read as "build/render invocation," whichever mechanism that
turns out to be. If the plan instead chooses a genuine Cron-Trigger Worker for this (viable, but
not recommended — see Pitfall 2), the real ceiling there is **~900,000ms CPU / ~980,000ms wall time
for a 2-hour-interval cron**, not 300,000ms [VERIFIED: `docs/phase-03/measurements.md` §3, "Platform-reported
cpuTime | 902,000ms (902.0s ≈ 15.03 min)"], a figure Phase 3 established by firing a real empirical
probe against this exact platform/interval, not from documentation alone.
**Warning signs:** A plan task that budgets the full re-render against "300 seconds" without
naming which execution mechanism (Workers Builds build vs. Cron Trigger Worker) that number
applies to.

### Pitfall 2: The previously-proven full-rebuild mechanism (chained cron cycles) cannot meet D-10's 24-hour SLA
**What goes wrong:** Reusing Phase 3's original full-rebuild design (chain the render across
successive 2-hour cron cycles until the whole corpus is covered) for the archive tier's full
re-render.
**Why it happens:** That mechanism was measured, not estimated: a full-corpus rebuild at ~40k
articles needs **26–33 chained cron cycles ≈ 2.7 days** at the measured per-invocation capacity
[VERIFIED: `docs/phase-03/render-step-location.md` line 93, "~26–33 cron cycles run back-to-back
(~2.7 days wall-clock at the measured ~1,223/cycle p95 capacity... )"]. D-10 requires the full
re-render to complete within **24 hours** — 2.7 days is ~2.7x over that budget even before
accounting for the archive tier adding R2-write time on top of whatever articles need re-rendering.
**How to avoid:** Use Workers Builds instead (see Pitfall 1's recommendation) — it already renders
and deploys the full ~60k-page corpus in ~11 minutes [VERIFIED:
`docs/phase-04/build-measurements.md` line 20, "Workers Builds cold build (Build 1) | 649s
(10.8min) total"], which comfortably fits inside a 24-hour window with enormous margin even after
adding archive-tier R2 writes on top.
**Warning signs:** Any plan task description that mentions "chained cron cycles" or "multiple
2-hour cycles" for the full re-render.

### Pitfall 3: R2 `get()` latency from a Worker is not a known-fast number — measure it, don't assume it
**What goes wrong:** Assuming R2 reads behave like KV reads (low double-digit milliseconds) when
sizing the LCP budget for archived-article requests.
**Why it happens:** Community-reported R2 `get()` latencies from a Worker vary widely — some
reports show 100–200ms typical, others show spikes to 300–900ms+ for same-region requests
[LOW confidence — community forum posts via WebSearch, not an official Cloudflare SLA; Cloudflare
does not publish an official R2 `get()` latency figure]. At the high end this threatens roadmap
criterion 2's 1.5s LCP budget once added to TTFB, DNS, TLS, and render time.
**How to avoid:** Roadmap criterion 2 already requires this be measured live on the deployed
Worker — treat that as non-negotiable, not a formality. Independently, cache R2-served responses
at the edge (Pattern 3 above) so only the first request per cache-TTL window pays R2's latency at
all; this is cheap insurance regardless of what the live measurement shows. Note: R2 `get()` is
I/O wait, not CPU time — per the same CPU-time model `docs/phase-03/render-step-location.md`
already established for KV ("Cloudflare's CPU-time model excludes I/O wait from billed CPU time"),
a slow R2 read threatens the LCP budget, **not** ARCH-08's <5ms Worker CPU budget — don't conflate
the two when writing verification tasks.
**Warning signs:** A plan or test that treats "R2 latency" and "Worker CPU time" as the same
measurement.

### Pitfall 4: v1's production D1 database ID is not the one given in the research prompt
**What goes wrong:** Filtering D1 analytics by `databaseId: 252435de-25d3-4e0a-8652-c2cb0ea1751c`
(the id the orchestrator's research prompt named; CONTEXT.md itself names no id) for the Leg 2 baseline/load-test comparison.
**Why it happens:** That id is `915tldr-dev-db`, bound only in `915tldr.com2/wrangler.dev.jsonc`.
**VERIFIED directly this session**: `curl .../workers/scripts/915tldr/settings` (the real
production Worker) shows its `DB` binding's `database_id` is `552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`
(`915tldr-db`) — confirmed against the account's own D1 database list and the live production
Worker's own binding settings, not inferred from a config file alone.
**How to avoid:** Use `552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77` for every D1-analytics query this
phase runs (baseline window and load-test window both). Filtering on the dev database id would
either show misleadingly-zero activity (if the dev db genuinely gets no production traffic) or
conflate unrelated dev-environment reads with the production signal D-01 needs — either way, a
measurement error that would undermine the zero-reads gate's credibility.
**Warning signs:** Any script or doc in this phase referencing `252435de-...` as "the production
database."

## Code Examples

### The Worker's current fall-through logic — the exact starting point this phase extends
```typescript
// Source: src/worker.ts (read directly this session, VERIFIED, lines 1-70 — quoted here in full
// because every line of it is load-bearing for where the archive branch must be added)
import { extractArticleUuid, resolveRedirect } from './lib/article-redirect.ts';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RENDER_MANIFEST: { get(key: string, type: 'json'): Promise<unknown> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const uuid = extractArticleUuid(url.pathname);
    if (!uuid) {
      return env.ASSETS.fetch(request);
    }

    let entry: unknown;
    try {
      entry = await env.RENDER_MANIFEST.get(`manifest:${uuid}`, 'json');
    } catch (err) {
      console.error(
        `[worker] render-manifest KV read failed for uuid ${uuid}: ${err instanceof Error ? err.message : String(err)}`
      );
      return env.ASSETS.fetch(request);
    }

    const decision = resolveRedirect(url.pathname, entry);
    if (decision.type === 'not-found') {
      return env.ASSETS.fetch(request);
    }

    return new Response(null, {
      status: 301,
      headers: { Location: decision.location + url.search, 'Cache-Control': 'public, max-age=3600' },
    });
  },
};
```
**Critical gap this exposes:** `extractArticleUuid(url.pathname)` returns null for any tag path
(`/tag/<slug>`) and for any already-canonical article path with no uuid-mismatch — meaning
**archived tag pages are NOT reachable through any existing code path today.** The archive branch
needs its own routing condition (does this path look like a tag path, or a canonical article path
whose manifest entry says `tier: 'archive'`?), not merely a new `if` inside the existing
uuid-extraction branch.

### Existing manifest schema (v2) — the extension point for tier/r2Key
```
// Source: docs/phase-03/render-manifest.md (read directly this session, VERIFIED, lines 23-36,
// 199-219 — every field name and type quoted verbatim)
articleId: string            // articles.uuid
translationGroupId: string   // == articleId today
language: 'en' | 'es'        // always 'en' today
contentHash: string          // sha256 of title+summary+tags
schemaVersion: string        // MANIFEST_SCHEMA_VERSION, currently '2'
renderedAt: string           // ISO 8601
buildHash: string            // commit identity
category: string             // denormalised category slug
publishedAt: number          // epoch SECONDS
slug: string                 // added in v2 (04-01), matches ARTICLE_SLUG_RE
```
**Proposed v3 addition (not yet implemented — this phase's own work):**
```typescript
tier: 'hot' | 'archive';
r2Key: string | null;        // null when tier === 'hot'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Render step runs inside the 2-hour cron Worker, chained across cycles for a full rebuild | Render step (`astro build`) runs on Workers Builds; the cron Worker only triggers via Deploy Hook | Phase 4, D-05 (04-11, 2026-09-30) | Phase 5's archive re-render should follow this same migration, not the superseded pattern — see Pitfalls 1-2 |
| STATE.md's assumed "300s / ~4ms-per-page" render-cost model | Measured: ~900s cron CPU ceiling (3x higher), ~573-736ms/page render cost (140-180x higher) | Phase 3, 03-06/03-07 | Any Phase 5 capacity planning must start from the measured figures, not the superseded estimate |
| `experimental.incrementalBuild` assumed unreliable on CI (local fresh-clone simulation showed 0 pages restored) | Proven on the real platform: ≥34,871/~60,349 pages restored, `WB_REUSE_PROVEN` | Phase 4, 04-10 (2026-09-30) | A touched-pages-only archive re-render (D-09/D-11) can likely piggyback on the same page-reuse mechanism, worth confirming during planning |

**Deprecated/outdated:**
- Chained-cron-cycle full rebuilds: superseded by Workers Builds for the static site (D-05); this
  research recommends the same supersession apply to the archive tier.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@aws-sdk/client-s3` is the correct/current package name for R2's S3-compatible API from Node | Standard Stack | If wrong, the build-time R2-write mechanism doesn't exist as named; low risk — this is AWS's own extremely well-known SDK, easy to re-confirm at implementation time |
| A2 | The Cache API code shape in Pattern 3 (`caches.default`, `cache.match`/`cache.put`) is exactly correct for this project's Workers runtime configuration | Architecture Patterns, Pattern 3 | Low risk if wrong — this is a very standard, widely-documented Workers pattern, but was not independently re-fetched from an official doc page this session (time-boxed); verify the exact method signatures before implementing |
| A3 | Workers Analytics Engine is available on this account without a plan upgrade and at near-zero cost for this project's write volume | Standard Stack / Summary | If wrong (e.g., it requires a Workers Paid plan — this account appears to have Workers Paid already based on Phase 3/4's CPU-ceiling figures matching the Paid-plan table, but this was not independently re-confirmed this session for Analytics Engine specifically), the "start collecting forward traffic now" recommendation needs a cost/plan check first |
| A4 | The ~7-day Free/Pro retention figure applies specifically to `httpRequestsAdaptiveGroups` (the dataset with `clientRequestPath`), not only to the Security Analytics UI feature that happens to use the same underlying dataset | Summary / Question 2 | If the underlying retention differs from what powers the Security Analytics UI, the "D-07 is likely the real mechanism" conclusion could be too pessimistic — re-verify directly once Zone Analytics Read permission is granted, by querying `date_geq` further and further back and observing where real data stops returning |

**If this table is empty:** N/A — see above.

## Open Questions

### Question 1 (CONTEXT.md's highest priority — RESOLVED)
**Can Cloudflare D1 analytics attribute rows read to a specific calling Worker?**
- What we know: **No.** [VERIFIED: live GraphQL schema introspection against this account,
  2026-09-30 — `query { __type(name: "AccountD1AnalyticsAdaptiveGroupsDimensions") { fields { name
  } } }` and the `...QueriesAdaptiveGroupsDimensions` equivalent both return exactly:
  `databaseId, databaseRole, date, datetime, datetimeFifteenMinutes, datetimeFiveMinutes,
  datetimeHour, datetimeMinute, datetimeSixHours, servedByInstance, servedByRegion` (plus `error`,
  `query` for the Queries variant). No field named anything like `scriptName`, `workerName`, or
  similar exists — a direct attempt to query `scriptName` returned `"unknown field \"scriptName\""`.]
  Corroborated independently: [CITED: `developers.cloudflare.com/d1/observability/metrics-analytics/`,
  via WebFetch summary this session: "D1's analytics do not attribute rows-read to specific Worker
  scripts... retained for the past 31 days."]
- What's unclear: Nothing material — this is resolved with high confidence from two independent
  sources (live schema introspection + official docs).
- Recommendation: D-01's leg 2 must be the delta-measurement design already anticipated as the
  fallback (not the "stronger leg 2" CONTEXT.md hoped attribution might provide): measure
  `rowsRead` for `databaseId: 552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77` (the correct production id —
  see Pitfall 4) over a baseline window, then over the scripted load-test window, and confirm no
  attributable delta beyond v1's normal variance.

### Question 2 (CONTEXT.md's second-highest priority — RESOLVED, with a significant practical consequence)
**What per-URL HTTP request data does Cloudflare retain for the `915tldr.com` zone, and can it
yield a 30-day human-only per-URL request count?**
- What we know:
  - Zone plan: [VERIFIED: `GET /zones?name=915tldr.com` → `"plan":{"name":"Free Website", ...}`,
    this account, this session]
  - The `clientRequestPath`, `botScore`, and `verifiedBotCategory` dimensions needed for D-04/D-06
    all exist on the `ZoneHttpRequestsAdaptiveGroupsDimensions` type [VERIFIED: live GraphQL schema
    introspection this session].
  - The current `CLOUDFLARE_API_TOKEN` **cannot currently read this data at all** — a live query
    against `httpRequestsAdaptiveGroups` for this zone failed with: `"Actor
    '...' does not have permission 'com.cloudflare.api.account.zone.analytics.read' for zone
    70a6176e850ecde50ab6f41d56ffddb4"` [VERIFIED: live API response, this session].
  - Documented retention for the dataset behind Security Analytics (built on
    `httpRequestsAdaptive`/`httpRequestsAdaptiveGroups`, per the same doc page): **"Free & Pro: Up
    to the last 7 days... Business: Up to the last 31 days... Enterprise: Up to the last 90
    days."** [CITED: `developers.cloudflare.com/waf/analytics/security-analytics/`, via WebFetch
    summary this session.]
- What's unclear: Whether the raw `httpRequestsAdaptiveGroups` dataset's retention is identical to
  the Security Analytics UI feature's retention (both are documented as using the same underlying
  dataset, but this wasn't independently confirmed with a live query reaching back exactly 7/31
  days, since the permission gap blocked any live query at all) — see Assumption A4.
- Recommendation (two actions, not mutually exclusive):
  1. **Ask the owner to grant `Zone Analytics: Read`** to the existing API token (a read-only,
     zero-cost permission grant — the same kind of scope grant this project has already done twice
     before, in Phase 3's 03-01 and 03-05) so the actual retention boundary can be confirmed with a
     real query before the plan locks in D-04 vs. D-07.
  2. **Treat D-07's provisional age-based cutoff as the real Phase 5 launch mechanism.** Even with
     the permission granted, Free-plan retention (~7 days per the citation above) falls well short
     of D-05's 30-day requirement, and a plan upgrade to Business ($200/mo-class pricing) to get
     31-day retention is wildly out of proportion to this project's stated ~$10-20 total rebuild
     budget. This is a genuine tension between a locked decision (D-04/D-05: derive from real
     30-day traffic) and a platform/budget constraint this research surfaced — **flag this for the
     user as a discussion point before the plan finalizes**, rather than silently defaulting to
     D-07 or silently recommending a cost the user hasn't approved.

### Question 3 (new — raised by this research, not in CONTEXT.md)
**Which execution mechanism should run the archive-tier render, and does it change REND-12's
applicable CPU/wall-time ceiling?**
- What we know: see Pitfalls 1 and 2 above — Workers Builds (20-min hard ceiling, ~11-min measured
  cold-build time at current corpus size) is a much better fit than a Cron-Trigger Worker
  (~900s/~15-min ceiling, previously measured taking 2.7 days via chaining for a full rebuild).
- What's unclear: How much WALL-CLOCK TIME the archive tier's own R2-write step adds on top of the
  already-measured ~11-minute hot-page build, at the scale of ~17,500 freed tag pages plus however
  many articles fall outside the hot window. This has not been measured (no archive code exists
  yet) and is squarely in-scope for this phase's own build-out and measurement work, not something
  this research could pre-measure.
- Recommendation: Budget a dedicated measurement task early in the plan — build a small-scale
  prototype of the R2-write step (e.g., 500 archived pages) inside a real Workers Builds build and
  measure its marginal wall-clock cost, the same empirical discipline Phase 3/4 already applied to
  every other capacity question in this project, before committing to folding the full archive tier
  into the same build that must also ship hot pages promptly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wrangler` CLI | Deploy, R2 object operations | ✓ | 4.136.3 | — |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` env vars | All Cloudflare API/GraphQL access | ✓ | — | — |
| D1 Analytics read permission | D-01 leg 2 measurement | ✓ (already works — used this session) | — | — |
| **Zone Analytics Read permission** | D-04's per-URL traffic query | ✗ — confirmed missing this session | — | Ask owner to grant (same pattern as Phase 3's prior scope grants); until granted, use D-07 |
| R2 bucket for the archive tier | REND-07/08 | Not yet created (no `r2_buckets` binding in `wrangler.jsonc` today — confirmed by reading the full file this session) | — | Must be created as part of this phase's own work; not a blocker, just not-yet-done |
| Workers Analytics Engine binding | Forward traffic collection (recommended, not required) | Not yet added | — | Optional — only needed if the team wants to start accumulating real 30-day data now rather than waiting on a Zone Analytics permission grant |

**Missing dependencies with no fallback:** none — every gap above has a stated fallback or is
in-scope build-out work for this phase itself.

**Missing dependencies with fallback:** Zone Analytics Read permission (fallback: D-07's
provisional cutoff, pending owner grant).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no Jest/Vitest/Mocha [VERIFIED: `package.json` scripts, read directly this session] |
| Config file | none — plain `node --test` glob invocations in `package.json` scripts |
| Quick run command | `pnpm run test:fast` (`node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"`) |
| Full suite command | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && pnpm run test:tracer` (the combination STATE.md's 04-12 entry describes as "full suite" for this project) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| ARCH-01 | Zero D1 reads on public path (Leg 2, measured) | smoke/integration (new, against live D1 analytics + deployed Worker) | `node tools/load-test-zero-reads.mjs` | ❌ Wave 0 |
| ARCH-08 | ≤1 KV read, <5ms Worker CPU per request | integration (new, against deployed Worker via `wrangler tail`/GraphQL `workersInvocationsAdaptive`) | `node tools/measure-worker-kv-cpu.mjs` (extend the pattern from `tools/cpu-ceiling-probe/`) | ❌ Wave 0 |
| REND-07/08 | Archived article served from R2 via fall-through | integration (new, extends `tests/integration/url-shapes.test.mjs`'s live-request pattern) | `node --test tests/integration/url-shapes.test.mjs` (extended) | ⚠️ Partial — file exists, archive cases don't |
| REND-09 | Tag tiering threshold (≥10 articles → static) | unit (new, on the pure tiering function) | `node --test tests/unit/tiering.test.mjs` | ❌ Wave 0 |
| REND-10 | Hot cutoff derived from traffic | manual/human-verify — depends on Zone Analytics permission grant; not realistically automatable this session | n/a — documented procedure in `docs/phase-05/hot-window-derivation.md` | ❌ Wave 0 (doc, not test) |
| REND-11 | File count reported daily, fails build >80,000 | unit (new, on a fixture directory) + build-gate | `node --test tests/unit/file-count.test.mjs`, wired into `pnpm run build` | ❌ Wave 0 |
| REND-12 | Full re-render doesn't exceed the applicable ceiling | integration/smoke (new, mirrors `tools/cpu-ceiling-probe/`'s empirical-measurement discipline, but against a Workers Builds build, not a Cron Trigger) | documented measurement in `docs/phase-05/archive-architecture.md` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm run test:fast`
- **Per wave merge:** full suite (`test:unit`, `test:build-gate`, `test:regression`, `test:tracer`)
- **Phase gate:** full suite green, plus the two live/measured gates (ARCH-01 Leg 2, REND-12) run
  and documented before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tools/assert-file-count.mjs` + `tests/unit/file-count.test.mjs` — REND-11
- [ ] `src/lib/archive/tiering.ts` + `tests/unit/tiering.test.mjs` — REND-09
- [ ] `tools/load-test-zero-reads.mjs` — ARCH-01 Leg 2
- [ ] Extend `tests/integration/url-shapes.test.mjs` with archived-article and archived-tag cases — REND-07/08
- [ ] `docs/phase-05/hot-window-derivation.md`, `docs/phase-05/archive-architecture.md`,
      `docs/phase-05/zero-reads-gate.md` — documentation deliverables this phase's own research
      pattern (established by every prior phase) requires

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No new auth surface this phase |
| V3 Session Management | No | — |
| V4 Access Control | Yes | R2 bucket must not be publicly listable/readable outside the Worker's own binding — use a private bucket with only the Worker's `r2_buckets` binding and the build-time S3-API credentials scoped to that one bucket, never a public R2 custom domain for the archive bucket |
| V5 Input Validation | Yes | The `r2Key`/`tier` manifest fields must go through the same `validateManifestEntry()` rejection discipline already documented for every other field (never trust an unvalidated key into `R2Bucket.get()`) |
| V6 Cryptography | No new surface | R2/S3 request signing is handled by `@aws-sdk/client-s3`, not hand-rolled (see Don't Hand-Roll) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| R2 key injection via a crafted URL path (path traversal into unintended object keys) | Tampering | Derive `r2Key` only from the validated manifest entry already looked up by uuid/slug — never construct an R2 key directly from unvalidated request path segments |
| Build-time R2 credentials (S3 access key/secret) leaking into client-visible output or logs | Information Disclosure | Store as Workers Builds build secrets (same pattern as `CLOUDFLARE_API_TOKEN` today), never log the key/secret, never embed in any file that ships to `dist/client` |
| A failed/partial R2 write silently serving stale or missing content | Denial of Service (partial) | Already addressed by D-12 (keep old copy, alert via ntfy, retry next cycle) — ensure the implementation actually checks the `PutObjectCommand` response before considering a page "archived" |

## Sources

### Primary (HIGH confidence)
- Live Cloudflare GraphQL Analytics API introspection and queries against this account
  (`5b8888b49c34148054bdec527c05dc27`), 2026-09-30 — D1 analytics dimension schema, zone plan,
  production D1 database binding, Zone Analytics permission check. Treated as VERIFIED per this
  research's own epistemic standard: a direct, authenticated read against the live, authoritative
  system itself, not a third-party description of it.
- `src/worker.ts`, `wrangler.jsonc`, `docs/phase-03/render-manifest.md`,
  `docs/phase-03/render-step-location.md`, `docs/phase-03/measurements.md`,
  `docs/phase-04/build-pipeline-decision.md`, `docs/phase-04/build-measurements.md`,
  `docs/phase-04/loader.md`, `package.json` — all read directly this session, quoted verbatim where
  cited.

### Secondary (MEDIUM confidence)
- `developers.cloudflare.com/d1/observability/metrics-analytics/` (WebFetch summary) — D1 analytics
  attribution and 31-day retention, corroborating the live introspection finding.
- `developers.cloudflare.com/waf/analytics/security-analytics/` (WebFetch summary) — per-plan
  retention figures for the `httpRequestsAdaptive`/`httpRequestsAdaptiveGroups` dataset.
- `developers.cloudflare.com/r2/pricing/`, `developers.cloudflare.com/r2/api/workers/workers-api-reference/`,
  `developers.cloudflare.com/analytics/analytics-engine/limits/` (WebFetch summaries) — R2 pricing,
  `R2Bucket` binding method signatures, Workers Analytics Engine retention/limits.

### Tertiary (LOW confidence)
- WebSearch results on R2 `get()` latency from community forum posts (no official Cloudflare SLA
  published) — flagged explicitly in Pitfall 3 as needing the roadmap's own required live
  measurement, not as a number to design against.
- WebSearch summary naming `@aws-sdk/client-s3` as the R2 S3-compatible client package — package
  name is `[ASSUMED]` per the package-name-provenance rule despite passing the registry/legitimacy
  check (see Package Legitimacy Audit).

## Metadata

**Confidence breakdown:**
- D1 analytics attribution (Question 1): HIGH — resolved via live, direct schema introspection
  against this account, corroborated by official docs.
- Per-URL traffic retention (Question 2): MEDIUM-HIGH on the zone-plan/permission facts (VERIFIED
  live), MEDIUM on the exact retention-days figure (CITED, not independently re-confirmed with a
  live query due to the permission gap — see Assumption A4).
- Render-pipeline/CPU-ceiling recommendation (Question 3): MEDIUM — strongly evidenced by Phase 3/4's
  own measurements, but the archive tier's own marginal R2-write cost at scale is unmeasured
  (explicitly flagged as this phase's own first measurement task, not something research could
  pre-produce).
- Standard stack (R2 S3 client): MEDIUM — package exists and is current (VERIFIED via registry),
  but its selection as "the" Cloudflare-recommended approach is WebSearch-sourced, not independently
  confirmed against an official Cloudflare doc page naming it directly.

**Research date:** 2026-09-30 / 2026-10-01
**Valid until:** ~14 days for the Cloudflare-platform-specific findings (plan/permission/retention
details can change without notice); ~30 days for the architectural recommendations (Workers Builds
vs. Cron Trigger, manifest schema extension) which rest on this project's own already-stable
Phase 3/4 measurements.

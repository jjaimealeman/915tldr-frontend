# Architecture Research: Static/Hybrid Content Delivery at ~82k Pages on Cloudflare Workers

**Domain:** Hybrid-static content site (news aggregator), Astro 7 on Cloudflare Workers Static Assets, ~41,233 articles doubling to ~82,466 under bilingual EN/ES, growing ~200 files/day
**Researched:** 2026-09-16
**Confidence:** MEDIUM-HIGH (Cloudflare platform mechanics verified against current docs; the render-step-location and search decisions are explicitly left open and require project-specific measurement — see below)

This document answers the architecture question for the **new Astro 7 public site only**. The
existing Nuxt pipeline/admin app and D1 database are retained unchanged; this document treats
them as an upstream black box that writes to D1 on a 2-hour cron and is otherwise out of scope.

---

## 0. The load-bearing fact that reshapes every answer below

**Workers Static Assets are not writable at request time.** They are uploaded as part of a
Worker **version deployment** (via Wrangler, or the underlying Cloudflare Assets Upload Session
API). A Cloudflare Worker's `fetch()` handler cannot add, replace, or remove a static asset for
its own Worker — there is no runtime "write a static file" API. Static assets are immutable
per deployed version.

This means **"hot content regenerated every cron" is not a KV/R2-style write. It is a new Worker
deployment**, shipped every cron cycle (or on whatever trigger you choose), containing the full
current hot-tier asset manifest. Every architectural decision below — where rendering runs,
whether Queues mediate, how incremental builds work — has to route around this fact rather than
assume Workers can self-update their static tier. This is the single biggest thing that should
change how phase 3/4 (Static generation, Hybrid archive) get planned, and it is not stated
explicitly in the PRD's architecture diagram.

**R2, by contrast, is a normal read/write object store reachable from any Worker at runtime.**
`env.ARCHIVE_BUCKET.put()` / `.get()` work from inside a request handler or a cron-triggered
Worker with no deployment step. This is why the archive tier (R2) and the hot tier (Workers
Static Assets) are architecturally asymmetric, not just "two storage backends" — one is a
build artifact, one is a live data store.

---

## 1. Hybrid static + archive split

### How it is conventionally implemented on Cloudflare

The pattern (Cloudflare's own reference architecture for "mostly-static, occasionally-dynamic"
sites, and what Astro's Cloudflare adapter is built to support) is:

1. **Astro builds two things from one `astro build` run** with `output: 'static'` plus the
   Cloudflare adapter: (a) a static asset directory for pages that should ship as Workers
   Static Assets, and (b) a server entry (`dist/_worker.js` under the adapter) that runs for
   everything else — archive fallback, server islands (`/_server-islands/*`), search, and any
   other dynamic route. Astro's Cloudflare adapter always emits this server entry even in
   "static" output mode specifically because server islands require it — so "static site" on
   Cloudflare with server islands is really "static-asset-first hybrid Worker," not a pure
   static deploy.
2. **Asset-vs-Worker routing is Cloudflare's native behavior, not custom code.** With
   `run_worker_first` left at its default (`false`), Cloudflare's edge checks the static asset
   manifest **before** invoking the Worker at all. A match serves directly from Cloudflare's
   asset storage — genuinely zero Worker CPU, zero cold start, edge-cached automatically. A
   miss falls through to the Worker's `fetch()` handler automatically. No manual
   `env.ASSETS.fetch()` proxying is needed for this to work; that API exists for the opposite
   case (Worker code wanting to intentionally serve an asset from within custom logic), not for
   the fallback direction this project needs.
3. **Inside the Worker (only invoked for the fallback minority of requests)**, the handler:
   - Matches the request path against the existing `/[category]/[slug]-[uuid]` pattern (must
     stay unchanged — nine months of indexed URLs).
   - Computes a deterministic R2 key from `{lang, uuid}` (not from the human-readable slug,
     which can theoretically change — key by the stable `uuid`).
   - `env.ARCHIVE_BUCKET.get(key)` → streams the HTML body back with `Content-Type: text/html`
     and `Cache-Control` set so Cloudflare's edge cache (via the Cache API, `caches.default`)
     can absorb repeat hits without a second R2 round trip.
   - Returns a real 404 (matching the existing suggestion-endpoint behavior) if the key genuinely
     doesn't exist — this is how you distinguish "old article, correctly archived" from
     "typo/dead link," and it's also how a mis-generated render manifest gets caught.

### Request path, concretely

```
Request → Cloudflare edge
             │
             ├─ path matches static asset manifest? ──yes──► served from asset storage
             │                                               (~0ms Worker CPU, edge-cached,
             │                                                zero D1, zero R2)
             │
             └─ no match ──► Worker fetch() invoked
                                 │
                                 ├─ /_server-islands/*  → render island (KV/API, never D1)
                                 ├─ /[cat]/[slug]-[uuid] → R2 GET → stream HTML (archive tier)
                                 ├─ /search?q=...        → Vectorize/embedding path (see §5)
                                 └─ anything unmatched   → 404
```

### Latency cost of the R2 hop

R2 reads (Class B operations, $0.36/M, 10M/month included per Cloudflare's current pricing —
separate from the project's stated Class A allowance) are cheap in dollar terms but are **not**
free in latency terms the way a static-asset hit is. A live `bucket.get()` from a Worker is an
object-storage round trip — commonly tens of milliseconds, not the sub-millisecond, edge-local
cost of a matched static asset. At ~30KB per archived HTML page this is not large, but it is the
one place in the request path where TTFB is not "basically zero," and it is exactly the kind of
cost that can quietly blow the LCP < 1.5s / TTFB budget on an archive page if left uncached.

**Mitigation, and what phase 4 must measure:** cache the R2 response at Cloudflare's edge
(`Cache-Control: public, max-age=…` + explicit `caches.default.put()`, since R2 objects aren't
auto-cached the way static assets are). First hit pays the R2 latency; every subsequent hit at
that PoP is edge-cache-fast. **Measurement for phase 4:** p50/p95 Worker-to-R2 `get()` latency
for a ~30KB object, cold and warm-cache, from a real deployed Worker — not a local estimate.
This single number tells you whether archive pages need any additional mitigation (e.g.
Smart Placement) beyond edge caching.

---

## 2. Incremental builds and the render manifest

### Render manifest — structure and storage (KV, as planned)

A render manifest belongs in KV because it's small, hot, read-heavy, and read from multiple
places (the render step, the CI check, the budget routine). Recommended shape — one KV value
per language pair, keyed simply (`render:manifest`), holding:

```json
{
  "generatedAt": "2026-09-16T14:00:00Z",
  "sourceCronRunId": "…",
  "hotWindow": { "en": 2000, "es": 2000 },
  "articles": [
    { "id": "uuid", "lang": "en", "slug": "…", "esCounterpart": "uuid-or-null",
      "updatedAt": "…", "tier": "hot|archive", "r2Key": "articles/en/uuid.html|null" }
  ],
  "tags": { "static": ["utep", "city-council", "…"], "archiveOnly": ["…", "…"] }
}
```

Two things this structure has to carry that are easy to omit and expensive to retrofit:

- **`esCounterpart`** on every record — hreflang pairing (§6) needs to resolve the sibling
  language version regardless of which tier each side currently lives in.
- **A static/archive tier split for tags**, not just articles — see §6, this is a real ceiling
  risk the PRD's page-count math does not currently account for.

### What triggers an incremental build

The existing 2-hour cron in the Nuxt pipeline app is the natural trigger — it already knows
exactly which article IDs it just inserted or updated (it has to, to write them to D1). The
cleanest coupling: **at the end of each ingestion cron run, the pipeline writes a "delta" record**
(new/changed article IDs + lang) either directly to KV or via a small authenticated endpoint,
and that delta is what the render step consumes — not a full table scan. This keeps the "what
changed" computation where the data already lives (the pipeline just wrote it) rather than
re-deriving it by diffing D1 state from the render side.

At ~200 new files/day over roughly twelve 2-hour cron cycles, a typical delta is ~17 articles
(~34 with both languages) — small enough that "full re-render on every cron" isn't even
necessary in the steady state; only actually-changed pages need to move. A **full re-render**
(all ~82k pages) is a separate, deliberately-triggered operation — after a template change —
and should be treated as a distinct, rarer, batch job (see §3), not something that runs on the
regular cron path.

---

## 3. OPEN DECISION — where the render step runs

Restating §0's implication precisely: rendering the **archive tier** (HTML → R2) is a normal
Worker/cron operation. Rendering the **hot tier** (HTML → Workers Static Assets) is a
**deployment** operation — it requires Wrangler (or the Cloudflare Assets Upload Session API
directly) and ends in a new Worker version going live. These are different enough operations
that "does the render step live in the cron worker or a separate worker" is really two
questions bundled into one, and they don't have to have the same answer.

### Option A — render inside the existing Nuxt cron worker (admin.915tldr.com)

**For:** One fewer deployable; the delta is already known there for free; no cross-service
coordination.

**Against, concretely:**
- The existing cron worker already does RSS fetch + LLM summarisation/tagging + duplicate
  detection + embeddings in each 2h run. Adding HTML rendering and an R2 write loop shares its
  CPU budget. Workers Paid plan CPU limit is configurable, **default 30 seconds per invocation,
  max 5 minutes (300,000 ms)**. A steady-state delta of ~34 pages is trivial against that
  ceiling. A **full 82,466-page re-render is not** — even at an optimistic ~4ms of Worker CPU
  per page (template render + R2 write), that's ~330 seconds, already past the 300s hard
  ceiling, before counting the actual LLM/RSS work the same invocation also has to do.
- **The cron worker cannot itself deploy the hot static-asset tier** — see §0. Even if rendering
  happened inside it, "shipping" the hot tier still requires a separate deploy step (Wrangler
  CLI / Assets Upload Session API), which a Cloudflare Worker cannot invoke against itself in
  the normal sense (it *can* call Cloudflare's control-plane REST API via `fetch()` with an API
  token, but that is a materially different, heavier, and less-tested code path than a Worker
  doing its normal job — see Option C).
- **Failure isolation is the real cost.** If a rendering bug throws inside the same invocation
  that just did the (comparatively expensive, LLM-driven) ingestion work, you risk conflating
  two very different failure domains — a template bug now has a blast radius that includes
  whether new articles get ingested at all that cycle, or at minimum makes triage slower ("did
  ingestion fail, or just rendering?").

### Option B — separate dedicated render Worker, decoupled via Cloudflare Queues (`ARTICLE_QUEUE`)

**For:** Clean failure isolation (a render bug can't touch ingestion); Queues give at-least-once
delivery, retries, and a dead-letter queue for free; batches naturally rate-limit the CPU-per-
invocation problem since Queues consumers process bounded batches (**max 100 messages per
batch**, configurable batch timeout, and consumer Workers have the **same CPU-time limits as any
other Worker** — so a queue doesn't remove the ceiling, it lets you stay under it by processing
in many small invocations instead of one large one).

**Against:** More moving parts for a workload (~34 pages/cron in steady state) that doesn't
need queue-level backpressure most of the time. Queues earn their complexity specifically for
the **full-rebuild case**: fan out ~82,466 render jobs into batches of ≤100, let the consumer
process them across many invocations with automatic retry on failure, rather than trying to
force one invocation to survive a 5-minute CPU ceiling doing 82k renders sequentially.

**This is the concrete tradeoff, not an abstract one:** use Queues for the rare, large,
failure-prone operation (full rebuild after a template change), and a simple manifest-driven
batch pass for the routine, small, steady-state delta. Using Queues for both is not wrong, just
unnecessary overhead for the common case.

### Option C — the deploy step is neither A nor B, it's CI

Regardless of A vs B, **the hot-tier deploy itself should not run inside a Cloudflare Worker at
all.** It belongs in whatever CI environment already runs `wrangler deploy` for this project
(GitHub Actions is the conventional choice, triggered on a schedule matching the cron cadence,
or via `repository_dispatch` fired from the admin worker at the end of each ingest cycle). A
Worker *can* call Cloudflare's Assets Upload Session API directly via `fetch()`, but doing so
means reimplementing what Wrangler already does (content-hash-based incremental asset upload,
manifest assembly, version finalization) inside a CPU/time-constrained request handler — worse
tooling, worse observability, no real benefit over letting CI do it with real Wrangler.

**Recommended split:**
- Ingestion cron (existing, unchanged) → writes D1 → writes a small delta to KV.
- Render step (new; Option A for steady-state deltas is defensible given the small volume, but
  Option B/Queues is the safer default the moment a full rebuild is on the table) → renders HTML
  from the delta, writes archive pages to R2 directly, and for hot-tier pages, produces a build
  output directory (or triggers an Astro build via CI with the delta as input).
- **Deploy of the hot tier → CI (GitHub Actions), not a Worker**, via Wrangler, on the same
  cadence as the cron or debounced (e.g., deploy at most once per cron cycle even if the render
  step itself batches more granularly).

### What would have to be MEASURED to decide A vs B definitively

1. **Actual CPU time of the existing ingestion cron invocation, today**, measured via Workers
   Observability — how much headroom exists under the 300s ceiling before rendering is added at
   all. This number is currently unknown and is the single fact that settles "can Option A even
   work for the steady-state case."
2. **Per-page render cost** (template render + R2 `put()`) measured for a real Astro page against
   real D1 data, not estimated — multiply by 82,466 to get the true full-rebuild wall-clock/CPU
   cost, which tells you whether Queues fan-out is *required* (not just nice-to-have) for the
   full-rebuild path.
3. **Frequency of full rebuilds in practice** — if template changes are rare (weeks apart), a
   manual/CI-triggered full-rebuild path that doesn't need to be fast is acceptable even if it
   takes an hour end-to-end via Queues batches. If frequent, the cost of that path matters more
   and argues harder for Queues from day one.

---

## 4. Server islands (`server:defer`) on Workers Static Assets

### How they actually work

A component marked `server:defer` is **not** rendered into the static HTML shell at build time.
Astro emits a placeholder (`<astro-island>`-style element) plus whatever `slot="fallback"`
content you provide, which is what paints immediately — this is what protects LCP/CLS, since the
fallback occupies the island's real dimensions from first paint. After the page hydrates
client-side, a **second HTTP request** fires from the browser to a dedicated route
(`/_server-islands/<ComponentName>`) carrying an encrypted payload of the component's props. That
request is **not** a static asset — it always falls through to the Worker's `fetch()` handler
(exactly the fallback path described in §1), which renders just that one component server-side
and returns its HTML fragment for the client to swap in.

**This means a page built entirely of Workers Static Assets still causes Worker invocations —
one per island, per page view** (unless edge-cached, see below). The "static" claim is about the
page shell, not about zero Worker involvement end-to-end. This is fine and expected — it just
needs to be explicit, because it's the mechanism by which the zero-D1-reads guarantee has to be
verified at the island level too, not just the page-shell level (§ below, and CI assertion scope).

**A server adapter is mandatory** for `server:defer` to work at all, even on an otherwise fully
static site — Astro's own docs are explicit that server islands require an adapter, which is why
the Cloudflare adapter has to be present regardless of how "static" the rest of the site is.

### CPU cost per island

Rendering the island component itself is cheap Worker CPU (a template render with no DB access
— single-digit milliseconds). The real cost is whatever the island's data source is:

- **Weather / 7-day forecast**: should read from **KV** (already the plan), populated by the
  existing cron's weather fetch against `api.weather.gov`, not fetch NWS live on every page
  view. This keeps the island fast and avoids hammering a free public API from every visitor.
- **"Updated Xm ago"**: pure computation (current time minus the article's stored timestamp,
  already denormalized into the rendered page or manifest) — no external call at all, cheapest
  possible island.

### What's cached, and what shouldn't be

Because weather/forecast content is **identical across all visitors** at a given moment, the
island response can carry `Cache-Control: public, s-maxage=<N>` and be cached at Cloudflare's
edge via the Cache API — most requests then never reach the Worker's render logic at all, only
the first request per edge PoP per TTL window does. This is the single highest-leverage
optimization for island cost, since it turns "one Worker invocation per page view" into "one
Worker invocation per cache-TTL window per edge location."

"Updated Xm ago" is the opposite case — it's correct only if freshly computed (or cached for
at most ~60s), since its entire purpose is to be time-accurate. Don't cache it the same way as
weather, or it defeats its own purpose.

### D1 boundary at the island level

Every island handler runs inside the same Worker as the archive/search fallback, so **the
build-time CI assertion that "no public route imports the D1 binding" must cover
`/_server-islands/*` routes explicitly, not just the top-level page routes** — an island is a
public route by this project's own definition (it's reachable by an anonymous browser request)
even though it never appears as a static asset or a conventional page path.

---

## 5. OPEN DECISION — search without D1

### The structural problem with keeping FTS5

FTS5 lives inside D1. A search endpoint backed by it is, definitionally, a public request that
reads D1. The PROJECT.md Core Value statement is explicit that the zero-reads guarantee is
"architecturally zero... not fewer," enforced by a **build-time CI assertion that no public
route imports the D1 binding**. A search endpoint on FTS5 cannot satisfy that assertion without
either (a) being carved out as an explicit, documented, permanent exception to the Core Value —
which is a real re-scoping of a stated non-negotiable, not a minor caveat — or (b) being counted
against the separate `D1 reads/day < 2,000,000` budget as a deliberate, bounded trade. Either way
this needs to be a named decision in the roadmap, not something that gets discovered mid-
implementation.

### Honest comparison at ~41k docs × 2 languages

| Dimension | FTS5 (D1) | Vectorize (`articles-semantic`) |
|---|---|---|
| Zero-D1-reads compliance | **Violates it directly** — needs an explicit carve-out | Compliant by construction — no D1 in the query path |
| Query quality | Strong for exact terms, entity names, typo-tolerant-ish BM25 ranking; weak for "find me articles about the thing without knowing the exact words" | Strong for conceptual/paraphrase queries; historically weaker than lexical search on exact proper nouns (e.g. "UTEP", street names) unless hybrid-reranked |
| Cross-language matching | **None** — FTS5 matches literal tokens; an English query will not surface a Spanish-only article about the same event, or vice versa | **Possible, not guaranteed** — depends entirely on whether the embeddings already in `articles-semantic` were generated by a multilingual model that places EN and ES text in a shared vector space. This is currently unverified in the PRD/PROJECT.md and must be checked against the actual embedding pipeline code, not assumed |
| Latency | Fast, but only relevant if the D1-read carve-out is accepted | Embedding generation (Workers AI) + ANN query, two hops; needs measuring at this corpus size, not assumed fast |
| Cost at this scale | Already-paid-for D1, no incremental infra cost, but breaks a stated hard requirement | Vectorize billing is `(queried + stored vector dimensions) × unit price` — at ~82k stored vectors and realistic query volume, back-of-envelope cost is low, but must be computed, not assumed, especially once query volume includes bilingual search |
| Operational complexity | Zero new — endpoint exists in spirit already for FTS-style search patterns | Requires: embeddings kept in sync with every new/changed article (a **pipeline-side** write, fine re: zero-reads since it's not on the public path); a query-time embedding step (Workers AI call) before every search; a plan for enriching vector-query results with renderable fields (title, slug, snippet) without touching D1 — either denormalize those fields into Vectorize metadata, or into KV |

### Recommendation

Vectorize is the only option structurally compatible with the stated Core Value without an
explicit exception. Given the project explicitly states "Zero D1 reads... Not fewer" as
non-negotiable, and that FTS5 requires breaking that promise for one specific endpoint,
**Vectorize is the default unless measurement disqualifies it** — the burden of proof should be
on Vectorize failing quality/latency/cost checks, not on justifying the carve-out for FTS5.

A practical mitigation for Vectorize's proper-noun weakness: since the corpus already has
**46,090 extracted entities**, a hybrid approach — exact entity-name match against a small
KV-resident entity index (not D1) as a fast-path, falling back to Vectorize for everything
else — gets most of the benefit of lexical matching for names without touching D1 at all. This
is worth prototyping rather than treating it as pure lexical-vs-semantic.

### What must be MEASURED before this decision is final

1. **Embedding model coverage** — read the actual pipeline code that populates
   `articles-semantic` (not the PRD prose) to determine whether embeddings are generated from a
   multilingual model. If they are English-only today, cross-language search requires
   re-embedding once Spanish summaries exist — cheap in dollar terms (same order of magnitude as
   the ~$4 Spanish text backfill) but must be scheduled as its own step, not assumed automatic.
2. **Relevance**, empirically: run ~30-50 realistic queries (including proper nouns like "UTEP,"
   "city council," street/neighborhood names, and paraphrased/topical queries) through Vectorize
   and rate top-5 results by hand. This is the only way to know whether the proper-noun weakness
   is bad enough in practice to require the entity-index hybrid above.
3. **Query-path latency**, measured end-to-end from a deployed Worker: embedding generation via
   Workers AI + Vectorize ANN query, p50/p95, at the real corpus size once bilingual embeddings
   exist (~82k vectors).
4. **Cost**, computed (not estimated) from Vectorize's actual pricing formula
   (`(queried + stored vector dimensions) × dimensions × unit rate`) against a realistic search
   query volume for this traffic level (~10.5k total site requests/day today; search is a
   fraction of that).
5. **Result enrichment path** — confirm Vectorize metadata (or a KV-resident lookup keyed by
   article ID) can supply everything a search-results UI needs (title, slug, category, snippet,
   published date, language) without a D1 read, for both tiers of the archive split.

---

## 6. Bilingual routing and the 100,000-file ceiling

### Routing and hreflang

`/es/[category]/[slug]-[uuid]` as the Spanish mirror of `/[category]/[slug]-[uuid]` is the
conventional pattern and keeps the existing (must-not-break) English URL scheme untouched at its
root. Every page — in either language, in either tier (hot static or R2 archive) — needs:

- `<link rel="alternate" hreflang="en" href="…">` and `hreflang="es" href="…">` pointing at each
  other, plus `hreflang="x-default"` at the English version (the existing canonical).
- This requires the render manifest (§2) to carry the sibling ID/slug for every article, because
  an English hot-tier article may need to link to a Spanish sibling that has already aged into
  the R2 archive tier, and vice versa — cross-tier hreflang pairing has to work, which means the
  pairing data can't live only in whichever tier's metadata happens to be nearby; it belongs in
  the manifest, which both tiers read from at render time.

### The 100,000-file ceiling — the math the PRD's own estimate doesn't fully cover

PROJECT.md's own "~90 days to the ceiling" estimate is consistent with counting **articles
only**: 82,466 initial bilingual article pages, growing ~200/day (100 new × 2 languages), reaches
100,000 in `(100,000 − 82,466) / 200 ≈ 88 days` — this is presumably where "roughly 90 days" comes
from, and it is the reason the R2 archive tier is structural rather than optional (as the PRD
already states).

**What that estimate does not appear to include: tag pages.** The corpus has **18,007 tags**. If
every tag gets its own static page in both languages, that alone is **36,014 files** — nearly
40% of the entire 100,000-file ceiling, before a single article or category page is counted.
Category pages (8 × 2 = 16) are negligible by comparison; tags are the real risk.

**Recommendation:** tag pages should default to the **archive tier (R2)**, rendered the same way
as old articles, with only a curated set of high-traffic tags (top-N by article count, or top-N
by measured request volume once analytics exist — echoing the same "derive from traffic, don't
guess" principle PROJECT.md already applies to archive depth) promoted to the hot static tier.
This is a genuine gap between the PRD's stated ceiling math and the actual page inventory, and
it should be corrected in the roadmap rather than discovered when the hot-tier deploy starts
failing at file-count limits.

### Sitemaps and RSS

- A single `sitemap.xml` cannot hold ~82k+ URLs (the sitemap protocol caps at 50,000 URLs /
  50MB per file) — this needs a **sitemap index** pattern, split at minimum by language
  (`sitemap-en.xml`, `sitemap-es.xml`, each themselves possibly chunked), referenced from one
  small `sitemap.xml` index file.
- **Google News sitemap** (last 48 hours only, per PRD §6.6) stays small and always hot-tier —
  it's inherently bounded by recency, so it never threatens the file ceiling.
- `/rss.xml` and `/es/rss.xml` (or equivalent), bounded to the most recent N items, always
  hot-tier — same reasoning as the News sitemap.

---

## 7. Build-time image optimisation, and where Cloudflare Images fits

Sharp runs in Node at build time; it does not run in the Workers runtime at all. This is the
conventional and correct split for a prerendered site:

- **Build-time (Node, CI)**: `astro:assets` (`<Image>`/`<Picture>`) processes every content
  image — AVIF/WebP generation, responsive `srcset`, explicit `width`/`height` for CLS
  prevention — at `astro build` time, using Sharp under the hood. This runs wherever the render
  step's build happens (per §3, that's CI, not a Worker), which is architecturally convenient:
  the same environment that already needs Node/Wrangler for the hot-tier deploy is exactly where
  Sharp needs to run.
- **Remote source images** (58% of articles pull from KVIA/KTSM per the PRD) need to pass
  through `image.domains` / `remotePatterns` so Astro treats them as first-class optimizable
  images rather than raw hotlinks — this has to happen at the same build-time step, meaning the
  build step needs network access to fetch those remote originals during `astro build`, which is
  a build-time dependency worth flagging (a slow or flaky upstream image host slows the whole
  build, and a bulk full-rebuild — §3 — multiplies that risk across tens of thousands of remote
  fetches).
- **Runtime/on-demand path → Cloudflare Images, never Sharp.** Any image transformation that has
  to happen in response to a live request (rather than being baked in at build time) — e.g., a
  resize variant nobody pre-generated — must go through Cloudflare Images, since Workers cannot
  run Sharp. Given this site is fully prerendered, this path should be rare by design; treat any
  reliance on it as a sign that build-time generation missed a variant, not as a normal code
  path.
- **Workers AI (Flux-Schnell) generated images and `gpt-image-2.5-flare` hero images** (per PRD
  §9) are generated once, stored in R2, and then flow through the same build-time `astro:assets`
  pipeline as any other source image for their responsive variants — generation and optimization
  are two separate steps, not one.

---

## 8. Component boundaries and suggested build order

### Component boundaries — what talks to what

| Component | Owns | Talks to | Never talks to |
|---|---|---|---|
| Ingestion cron (existing Nuxt, `admin.915tldr.com`) | RSS fetch, LLM summarise/tag, dedup, embeddings, D1 writes | D1 (write), Vectorize (write, embeddings), KV (write delta/manifest) | Public request path — unaffected by this rebuild |
| Render step (new; location per §3) | Turning changed D1 rows into HTML | D1 (**read, build-time only**), KV (manifest read/write), R2 (archive writes), build output for CI deploy | Public request path directly — its output is consumed by the deploy step and the public Worker, never invoked live by a visitor |
| CI deploy (GitHub Actions / Wrangler) | Publishing new Worker versions carrying the hot static-asset tier | Cloudflare control-plane API (Workers Assets Upload Session), git/build artifacts from the render step | D1, R2 (not directly — it deploys what the render step already produced) |
| Public Worker (`915tldr.com`, Astro + Cloudflare adapter) | Serving static assets (native), archive fallback (R2 read), server islands, search | R2 (read), KV (read, for island data + search enrichment), Vectorize (read, for search), Workers AI (read, embedding generation for search queries) | **D1 — structurally, enforced by CI assertion** |
| Static asset layer (Cloudflare-managed) | Hot pages, homepage, category/tag (curated) pages | Nothing — served natively, Worker never invoked on a hit | Everything else |

### Data flow direction (explicit)

```
RSS sources
   │ (existing, unchanged)
   ▼
Ingestion cron (Nuxt, admin.915tldr.com)
   │ writes
   ▼
D1 (unchanged schema)
   │ read, build-time only ──────────────┐
   ▼                                     │
Render step                              │ (Vectorize embeddings written
   │ writes                              │  here too, pipeline-side —
   ├──► KV (manifest, hot values)        │  never on the public path)
   ├──► R2 (archive HTML)                │
   └──► build output ──► CI (Wrangler deploy) ──► Workers Static Assets (hot tier)
                                                        │
                                          Public Worker (fetch handler)
                                             │ reads at request time
                                             ├──► R2 (archive fallback)
                                             ├──► KV (island data, search enrichment)
                                             ├──► Vectorize (search query)
                                             └──► Workers AI (query embedding)
                                             ✗ NEVER D1
```

The direction that matters most for the zero-reads guarantee: **D1 is read exactly once per
piece of content, at render time, by a process that is never invoked by a public request.**
Everything downstream of the render step (KV, R2, Vectorize, static assets) is a denormalized,
pre-computed artifact. The public Worker's job is to serve those artifacts and to run cheap,
self-contained computation (islands) against them — never to go back to the source of truth.

### Suggested build order (dependencies, not calendar)

This tracks the PRD's own phase table (§16) but makes the *why* of the ordering explicit where
it isn't already:

1. **Render manifest schema + KV storage** must exist before anything else, because both the
   hot-tier build and the archive-tier build read from it, and hreflang pairing needs it from
   the start (retrofitting sibling-ID tracking after pages are already rendered means
   re-rendering everything once to backfill it).
2. **Static generation of homepage/category/(curated) tag pages** can be built and validated
   against real D1 data (read at build time, which is always allowed) before the archive/R2 path
   exists — this is the PRD's phase 3, and it's the right place to prove the D1-read-at-build-
   time / zero-at-request-time split works before adding the R2 fallback complexity.
3. **R2 archive tier + Worker fallback routing** (PRD phase 4) depends on #1 and #2 — it needs
   the manifest to know what's archived vs hot, and it needs the static tier to exist so the
   fallback logic has something to *not* match against. This is also where the zero-D1-reads
   proof has to actually be run and measured, per the PRD's own framing of phase 4 as gating the
   whole architecture.
4. **Server islands** (weather, forecast, "updated Xm ago") can be built in parallel with #2/#3
   once the Cloudflare adapter and Worker entry point exist, since islands are independent of
   the archive-vs-hot decision — they hit the Worker either way. Should land before #6
   (interactivity) closes, since the PRD schedules it there.
5. **Search (Vectorize path)** depends on confirming embedding coverage (§5, measurement #1) —
   this should be checked early (ideally before or during phase 2, "Foundation") because it
   determines whether a Spanish-embedding backfill needs to be scheduled alongside the existing
   Spanish-summary backfill (PRD phase 8), not discovered after.
6. **Bilingual doubling of the whole pipeline** (PRD's phases 2-4 per §7.5 of the PRD) should
   land the tag-page tier decision (§6 above) at the same time the hot/archive split for articles
   is decided — doing article tiering first and tag tiering as an afterthought risks a second
   pass through the ceiling math.
7. **CI deploy pipeline (Wrangler-based)** needs to exist before phase 4 can be meaningfully
   tested end-to-end, since "hot tier regenerated every cron" is not real until something
   actually deploys it (§0/§3) — this is implicit in the PRD's phase 7 ("Admin split... render
   trigger wired") but the CI half of it isn't currently named as its own deliverable and should
   be.

---

## Anti-Patterns

### Anti-Pattern 1: Treating R2 and Workers Static Assets as interchangeable "storage tiers"

**What people do:** Design the hot/archive split as if promoting a page from archive to hot (or
back) is just "move the object between two buckets."
**Why it's wrong:** One tier is a live object store a Worker can write to anytime; the other is
an immutable per-version deployment artifact that requires a CI/Wrangler step to change at all.
Treating them as symmetric leads to designs that assume the Worker can "just write" a page into
the hot tier at request time or cron time, which it structurally cannot.
**Instead:** Model the hot tier as a build/deploy output, not a data store. Anything that needs
to change without a deploy belongs in R2 or KV, not the static asset set.

### Anti-Pattern 2: Full corpus re-render inside a single Worker invocation

**What people do:** Assume "re-rendering is cheap, no AI involved" (true, per the PRD's own
cost framing) means it's also *fast enough to fit in one invocation*.
**Why it's wrong:** 82,466 pages at even a few milliseconds each exceeds the 300-second Worker
CPU ceiling on the Paid plan well before it exceeds any dollar budget. Cheap and fast are
different axes; this project's cost framing (§4.1 of the PRD) only covers the first.
**Instead:** Any operation touching the full corpus (post-template-change rebuild, prompt-driven
re-summarisation's downstream re-render) should be batched — via Queues fan-out or a chunked CI
job — regardless of how cheap it is per-unit.

### Anti-Pattern 3: Search as "just another API route"

**What people do:** Bolt a `/api/search` route onto the existing D1-backed query patterns
because that's the fastest thing to ship, planning to "optimize later."
**Why it's wrong:** This project's Core Value statement treats zero D1 reads as structural and
CI-enforced, not aspirational. A D1-backed search endpoint either breaks a stated hard
requirement or requires a formally-scoped exception decided in advance — it is not a detail to
defer.
**Instead:** Decide the search backend (§5) as an explicit roadmap item with its own
measurement gate, before any search UI is built against it.

---

## Sources

- [Astro server islands guide](https://docs.astro.build/en/guides/server-islands/) — `server:defer`, fallback slots, adapter requirement
- [Astro on-demand rendering / adapters](https://docs.astro.build/en/guides/on-demand-rendering/) — adapter requirement even for static-output sites using server islands
- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Workers Static Assets — billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) — 100,000 file ceiling (Paid, Wrangler ≥ 4.34.0), 20,000 on Free
- [Cloudflare Workers Static Assets — worker script / routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) — `run_worker_first`, asset-first fallback behavior
- [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/) — CPU time (default 30s, max 5 min on Paid), 30M CPU-ms/month included
- [Cloudflare Queues — consumer concurrency / limits](https://developers.cloudflare.com/queues/platform/limits) — max 100 messages/batch, consumer Worker shares standard CPU limits
- [Cloudflare Vectorize — pricing](https://developers.cloudflare.com/vectorize/platform/pricing/) — `(queried + stored vector dimensions) × dimensions × rate` billing model, not billed for CPU/idle indexes
- [Cloudflare Vectorize — limits](https://developers.cloudflare.com/vectorize/platform/limits/) — up to 10M vectors/index, up to 1,536 dimensions at time of writing
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing) — Class A ($4.50/M) vs Class B ($0.36/M) operations, free tier storage/ops
- Project-internal: `.planning/PROJECT.md`, `docs/PRD.md` §3, 4, 7, 13, 14 (2026-09-15/16) — corpus size, cost/read budgets, existing bindings (`ARTICLE_QUEUE`, `articles-semantic` Vectorize index)

---
*Architecture research for: 915tldr.com v2 rebuild — public site delivery architecture*
*Researched: 2026-09-16*

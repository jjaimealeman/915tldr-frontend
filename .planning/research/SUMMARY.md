# Research Synthesis: 915 TLDR v2 Rebuild

**Synthesized:** 2026-09-16
**Research phase:** STACK, FEATURES, ARCHITECTURE, PITFALLS (all 4 researchers completed)
**Confidence:** MEDIUM overall — multiple critical findings contradict existing documentation

---

## Corrections to Existing Assumptions

**These findings override or directly contradict the PRD and PROJECT.md. They must be fixed before architecture work proceeds.**

### 1. Astro Environment Bindings API — Breaking Change in v13/Astro 6

**Finding (STACK.md):** `Astro.locals.runtime.env` was **removed** in `@astrojs/cloudflare` v13 / Astro 6. The pattern the PRD assumes is stale.

**Current pattern:**
```ts
import { env } from 'cloudflare:workers';
const article = await env.ARTICLE_ARCHIVE.get(`${slug}.html`); // R2
const forecast = await env.RENDER_MANIFEST.get('latest', { type: 'json' }); // KV
```

**Action:** Audit PRD §3, §4, §14 for any reference to `Astro.locals.runtime.env` or `event.context.cloudflare.env`; replace with `import { env } from 'cloudflare:workers'` wherever it appears.

---

### 2. Astro Output Modes — `hybrid` Mode Removed in v5

**Finding (STACK.md):** `output: 'hybrid'` was merged into `'static'` as of Astro v5. The keyword is removed, not deprecated — it will error or silently ignore.

**Current pattern:**
```ts
export default defineConfig({
  output: 'static', // not 'hybrid'
  // Per-route opt-out:
  // export const prerender = false; // in any .astro page needing on-demand rendering
});
```

**Action:** Use `output: 'static'` (the default in Astro 7) with per-route `export const prerender = false` for weather/islands/search paths.

---

### 3. Image Service Defaults Changed — `cloudflare-binding` is Now Default

**Finding (STACK.md):** `@astrojs/cloudflare`'s `imageService` **defaults to `'cloudflare-binding'`** since v14.2.0.

**Correct configuration:**
```ts
adapter: cloudflare({
  imageService: { build: 'compile', runtime: 'passthrough' },
}),
```

**Why this matters:** The PRD explicitly chose deterministic Node-based Sharp builds. Without this override, builds will silently attempt to use live Cloudflare Images binding at build time.

**Action:** Set `imageService` explicitly in Cloudflare adapter config before phase 5 (Imagery).

---

### 4. View Transitions / Client Router — Rename in Astro v5

**Finding (STACK.md):** `<ViewTransitions />` was renamed to `<ClientRouter />` as a breaking change.

**Current:**
```astro
import { ClientRouter } from 'astro:transitions';
<ClientRouter fallback="animate" />
```

**Action:** Use `ClientRouter` throughout; any old documentation referencing `ViewTransitions` is stale.

---

### 5. Workers Static Assets Are Immutable Per Version — Not Runtime Writable

**Finding (ARCHITECTURE.md §0):** Workers Static Assets are uploaded as part of a Worker **version deployment**. A Worker's `fetch()` handler **cannot** write to them at request time.

**What this means:** Every cron cycle produces a new Worker deployment (via Wrangler) containing the updated static asset manifest. This is not a runtime write; it is a new versioned deployment.

**Consequences:**
- The hot tier is immutable between deployments.
- R2 (the archive tier) is the only actually-writable storage reachable from a running Worker.
- The architectural decision between "render step in cron worker" vs. "separate worker" vs. "CI" becomes load-bearing.

**Action:** Explicitly scope where the hot-tier deploy happens (Phase 2-4 decision).

---

### 6. The 100k File Ceiling Math — Tag Pages Not Counted

**Finding (ARCHITECTURE.md §6):** The PRD's "~90 days to ceiling" estimate counts articles only. **Tag pages (18,007 tags × 2 languages = 36,014 files) are not included.**

**The correct math:**
- 82,466 bilingual article pages
- +36,014 tag pages (if all in hot tier)
- = **118,480 files** (over the ceiling *immediately*)

**Implication:** Tag pages must default to the **archive tier (R2)**, with only top-N by traffic promoted to hot static assets. This is a genuine gap in the PRD's ceiling math.

**Action:** Implement tag-page tiering decision in Phase 4 (Hybrid archive). Do not assume all tag pages can stay in the hot tier.

---

### 7. Summary Length Check Insufficient — Content-Level Grounding Required

**Finding (PITFALLS.md §6):** The PRD's "flag any summary longer than its source" check would **not have caught the actual production fabrication example** quoted in the PRD.

**The fabricated example:**
> *"Residents and dealership owners are urged to remain vigilant and report any suspicious activity to the authorities."*

This was **length-compliant** but entirely fabricated.

**What's needed:** A content/grounding check — n-gram overlap against source, entity/claim extraction, or LLM-as-judge validation that every claim appears in source text.

**Action:** Implement in Phase 8 (Content quality), running alongside the prompt fix as a verification step for the archive re-process dry run.

---

### 8. Static Generation Relocates `/changelog` Empty-State, Doesn't Remove It

**Finding (PITFALLS.md §4):** The PRD claims (§15): *"Static generation removes that failure mode outright."* **Correction:** Static generation **relocates** the failure to build time.

A content layer loader reading from D1 at build time can timeout, return zero rows, or hit schema issues. The Astro Content Loader API does not fail the build by default for empty results — it succeeds silently, produces empty-state HTML, which then gets deployed and cached.

**Action:** Every content layer loader must validate row counts and throw on suspicious results — matching the "fail loudly" pattern already established in PROJECT.md for the border board.

---

### 9. FlareCMS `flareLoader` Is Product-Specific, Not a Generic D1 Pattern

**Finding (STACK.md §2):** The PRD references `flareLoader` as a content-loader template for D1. `flareLoader` is **not** a generic pattern — it is a specific client for **Flare CMS**, and the `@flare-cms/astro` package is not published to npm.

**Correct approach:** Write a bespoke custom Astro `Loader` using the D1 REST API against the existing D1 schema (documented in STACK.md with code sample).

**Action:** Remove any reference to `flareLoader` as a copy-paste template.

---

### 10. No Drizzle ORM Runtime Driver for D1-HTTP

**Finding (STACK.md §2):** `drizzle-orm`'s D1 client (`drizzle-orm/d1`) requires a live `D1Database` binding (Workers-only). There is no HTTP driver for build-time queries.

**Implication:** Use raw `fetch()` against the D1 REST API or `wrangler d1 execute --remote --json` instead.

---

### 11. Server Islands Always Trigger Worker Requests

**Finding (ARCHITECTURE.md §4):** Server islands (`server:defer`) are rendered per-request, which means a page built entirely of Workers Static Assets **still causes Worker invocations** — one per island per page view (unless edge-cached).

**Implication:** Islands are *not* "zero Worker involvement" — they are "defer rendering until request." This is intentional, but it means the "zero D1 reads on public path" CI assertion must scan island component files too, not just `.astro` pages.

**Action:** Extend the build-time CI assertion (Pitfall 1) to scan island components for D1 imports.

---

### 12. Verbatim-Heavy Excerpting Is a Legal Risk

**Finding (FEATURES.md, citing AP v. Meltwater precedent):** The hot-news misappropriation doctrine protects short snippet + hyperlink (fair use), but does not clearly protect substantial verbatim reproduction.

**Implication:** The fix for summary-padding must not swing toward longer direct quotes. A genuine paraphrase with a short, clearly-attributed direct quote is the safe middle ground.

**Action:** The summarizer prompt fix (Phase 8) should not include "can use longer direct quotes for thin sources" as a mitigation.

---

## Executive Summary

The rebuild's core premise — zero D1 reads on the public request path via hybrid static architecture — is sound and well-researched. However, **Astro's API surface has shifted materially between v5-v7**, and the PRD was written against interim API shapes that no longer exist. These corrections (items 1-4) are blocking: code written to the PRD's API assumptions will not compile.

The second category (items 5-12) are architectural and legal:

- **Workers Static Assets are deployment artifacts, not data stores.** This shapes where rendering happens — not a detail, a constraint.
- **The 100k file ceiling is tighter than the PRD's math suggests.** Tag pages create an immediate 36k-file burden that must be architecturally solved.
- **Content validation and legal risk are intertwined.** The length-only summary check leaves the exact failure class that motivated this rebuild open. Adding content-level grounding is not optional.

**Confidence:** MEDIUM-HIGH on technical corrections (API changes from Astro docs); MEDIUM on architecture implications (requires phase-specific measurement).

---

## Key Findings by Stream

### STACK.md — Technology & Versions

**Recommended Core Stack:**
- `astro@7.3.2`, `@astrojs/cloudflare@14.3.1`, `wrangler@4.132.0` (floor ≥4.34.0 for 100k file ceiling)
- `@astrojs/vue@7.0.2`, `vue@3.5.42`, `@vueuse/core@14.4.0`
- Custom Astro `Loader` calling D1 REST API for content layer
- `zod@4.6.5` imported via `astro/zod`

**Critical API Changes:**
1. **Removed:** `Astro.locals.runtime.env` → use `import { env } from 'cloudflare:workers'`
2. **Removed:** `output: 'hybrid'` → use `output: 'static'` with per-route `export const prerender = false`
3. **Renamed:** `<ViewTransitions />` → `<ClientRouter />`
4. **Changed default:** `imageService` → must explicitly set `{ build: 'compile', runtime: 'passthrough' }`
5. **Missing:** No runtime `drizzle-orm` D1-HTTP driver; use REST API directly

**Confidence:** MEDIUM-HIGH (versions verified via npm; APIs from Astro docs via Context7).

---

### FEATURES.md — Product Scope & Gaps

**Table Stakes Confirmed:**
- Fast, mobile-first, ad-free reading ✓
- Canonical attribution + prominent link ✓
- RSS feed ✓
- Structured data / Google News sitemap ✓
- Named masthead ✓
- Search ✓

**True Gaps:**
1. **Per-article AI-disclosure label** — recommend adding to §6.1 structured-data work
2. **Breaking-news alerts** (distinct from digests) — should be explicitly prioritized over digests once subscriber gate clears
3. **Push notifications** — appropriately conflicts with static architecture, should be named as explicit non-goal

**Differentiators Validated:**
- Entity pages (46k entities, novel at this scale)
- Story threads/timelines
- Entity-follow subscriptions

**Legal Risk:** Verbatim-heavy excerpting contradicts fair-use precedent (AP v. Meltwater).

**Confidence:** MEDIUM (cross-checked against PRD; legal doctrine from authoritative sources).

---

### ARCHITECTURE.md — System Design & Open Decisions

**Resolved Patterns:**

| Component | Pattern | Why |
|---|---|---|
| Hot tier | Workers Static Assets | Sub-millisecond, edge-cached, zero Worker CPU |
| Archive tier | R2 | Writable at runtime, 1.1 GB (KV = 1 GB limit) |
| Manifest | KV | Small, hot, read-heavy; carries hreflang pairing, tier decisions |
| Image optimization | Sharp at build time (Node) | Deterministic, no live Cloudflare dependency |
| Search embedding | Workers AI per-request | Enables semantic/cross-language search |

**Open Decisions Requiring Measurement (Phase 2-4):**

1. **Where does rendering happen?** Options: (A) inside cron worker, (B) separate worker via Queues, (C) CI via Wrangler. **Measurement needed:** actual cron CPU headroom, per-page render cost, frequency of full rebuilds.

2. **Search backend — FTS5 or Vectorize?** FTS5 is strong lexically but requires D1 on public path (violates Core Value). Vectorize avoids the conflict but needs confirmation on: embedding model coverage (EN-only vs multilingual), query latency, relevance on proper nouns, cost. **Recommendation:** Vectorize is default; burden of proof on carving out FTS5 exception.

3. **Tag page tiering?** **Resolved:** Tag pages default to R2 archive tier; only top-N by traffic promoted to hot static assets. This decision must land in Phase 4.

**Confidence:** MEDIUM-HIGH on patterns (verified against Cloudflare/Astro docs); MEDIUM on open decisions (identified correctly but resolution requires measurement).

---

### PITFALLS.md — Risks & Prevention

**Critical Pitfalls (Release-Blocking):**

| Pitfall | Prevention Phase | Safeguard |
|---|---|---|
| D1 reads reintroduced on public path | Foundation (2) | Build-time CI assertion that fails if any public route imports D1; extend to scan island components |
| Staleness invisible (deploy ≠ render ≠ cache-fresh) | Foundation (2) | Git hash + `/version.json` distinguish states; team uses this as first diagnostic step |
| Server islands break silently | Interactivity (6) | Every island requires `slot="fallback"`; every fetch has timeout; props <2048B; `ASTRO_KEY` pinned; CI scanner covers island files |
| Content layer loader ships empty page | Static generation (3) | Loader validates row counts, throws on suspicious results (zero when expected non-empty, or large delta) |
| 100k static-asset ceiling approached silently | Hybrid archive (4) | Total asset count tracked in daily budget; CI fails at 80k safety margin (not 100k hard limit) |
| LLM padding/fabrication after prompt fix | Content quality (8) | Automated grounding check (n-gram overlap or LLM-as-judge, not just length) runs in dry-run before costed re-process; continues on ongoing pipeline |
| Bulk backfills throttled or incomplete at 24h | Imagery (5), Content quality (8) | Client-side throttling with exponential backoff; explicit documented plan for unfinished Batch jobs before real run |

**Confidence:** MEDIUM-HIGH on prevention strategies (grounded in v1's documented defects); LOW on some implementation details (from web survey, not authoritative sources).

---

## Implications for Roadmap

### Suggested Phase Structure

1. **Phase 1: Design & Specification** — PRD corrections, mockups validated against Spanish text length and colour-palette combinations, gate on static HTML mockup approval + contrast/keyboard review.

2. **Phase 2: Foundation** — Astro scaffold with correct `imageService` config, CI assertion (no D1 imports in public routes/islands), render manifest schema in KV with hreflang pairing. **Spikes:** actual cron CPU headroom, per-page render cost, D1 REST API pagination performance at 41k rows. **Gate:** CI assertion passes, manifest works, measurements complete.

3. **Phase 3: Static Generation** — Homepage/categories/recent articles pages, custom content layer loader (D1 REST API pattern), share-card generation. **Spike:** D1 REST pagination perf. **Gate:** Lighthouse 100 perf/SEO/a11y; LCP <1.5s, CLS <0.05.

4. **Phase 4: Hybrid Archive** — R2 setup, Worker fallback routing, tag-page tiering (all tags → R2, top-N traffic → static). **Spikes:** Worker→R2 latency, embedding model coverage, archive depth derived from traffic analysis. **Gate:** Asset count <80k; zero D1 reads end-to-end verified; R2 caching strategy validated.

5. **Phase 5: Imagery** — Ingest filter (reject junk images), Workers AI Flux-Schnell backfill (15,624 images), GPT Image 2.5 Flare for heroes + daily lead. **Spike:** actual tier-3 cost per image. **Action:** build throttling + batch-status utility. **Gate:** all articles have real 1200×630 cards; X/Facebook/WhatsApp actual platform validation.

6. **Phase 6: Interactivity** — Weather + 7-day forecast islands, "updated Xm ago" islands, theme toggle. **Requirement:** every island has `slot="fallback"`, timeout on fetches, props <2048B, `ASTRO_KEY` pinned. **Gate:** CI scans islands; resilience tested under failed upstream.

7. **Phase 7: Admin Split** — Cloudflare Access (replaces Better Auth), cron trigger wiring, daily budget routine. **Gate:** unauthenticated admin request confirmed blocked; budget routine runs.

8. **Phase 8: Content Quality** — Prompt rewrite (prohibit advisories/calls-to-action), automated grounding check (n-gram overlap or LLM-as-judge), dry-run 41k-article archive re-process, batched re-process via Batch API. **Action:** reuse throttling utility from Phase 5. **Gate:** grounding check passes on 100% of dry-run; PR review of check logic; sample spot-checks.

9. **Phase 9: Bilingual** — Spanish generation at ingest, language detection, `/es` routing, per-language sitemaps/RSS. **Spike:** Spanish embedding backfill if `articles-semantic` is EN-only. **Gate:** 41k articles have Spanish summaries; hreflang pairing verified end-to-end; Spanish-length content doesn't break layouts.

10. **Phase 10: Search** — Measurement results from Phase 4 spike, FTS5 vs Vectorize decision gate, implementation. If Vectorize: hybrid entity-name fast-path (KV-resident entity index). **Gate:** relevance validated on 30-50 test queries; p95 latency <500ms; cost-per-query <$0.001.

11. **Phase 11: Quality Gates** — Manual keyboard + screen-reader audit (WCAG 2.2 AA), contrast combos, 320px/200% zoom reflow, Lighthouse CI full page set, real platform share-card validation, edge-level noindex on dev subdomain, legal review (fair-use compliance). **Gate:** Lighthouse 100 perf/SEO/a11y; LCP p75 mobile <1.5s, INP <100ms, CLS <0.05; zero blocking audit issues.

12. **Phase 12: Cutover** — Dual-running v1/v2, gradual traffic rollout, rollback tested. **Gate:** v2 sustains 7 days at 100% under budget; zero D1 reads from public paths.

### Research Flags & Measurements Needed

| Phase | Measurement | Blocker? |
|---|---|---|
| 2 | Cron-worker actual CPU headroom (Workers Observability) | YES — determines render-step location |
| 2 | Per-page render cost (template + R2 write) | YES — affects full-rebuild estimates |
| 3 | D1 REST API pagination perf at 41k rows | YES — if fails, implement SQLite snapshot fallback |
| 4 | Worker→R2 get() latency for ~30KB (cold/warm) | YES — determines if archive meets LCP budget |
| 4 | Embedding model coverage: EN-only or multilingual? | YES — determines if Phase 9 Spanish backfill needed (~$1.49 delta) |
| 5 | Actual GPT Image 2.5 cost per image | YES — PRD estimate unverified |
| 10 | Vectorize: embedding coverage, latency, relevance, cost at bilingual scale | YES — determines FTS5 vs Vectorize decision |

---

## Open Questions Awaiting Measurement

1. **Which embedding model populates `articles-semantic`? Multilingual or EN-only?** — Read pipeline code (not PRD prose). Determines Phase 9 Spanish backfill necessity. Cost delta: ~$1.49 if EN-only. **Resolve:** Phase 2.

2. **Current cron-worker CPU usage?** — Workers Observability CPU histogram for 2-hour cron. Determines whether render lives in cron (Option A) or needs separation (B/C). **Resolve:** Phase 2.

3. **Per-page render cost?** — Wall-clock milliseconds for one Astro build + R2 `put()`. Informs full-rebuild time (82,466 pages × cost). **Resolve:** Phase 2.

4. **Worker→R2 latency for ~30KB (cold and warm-cached)?** — P50/P95 from real deployed Worker. Determines if archive meets LCP <1.5s budget. Measured via custom instrumentation or Cloudflare Analytics Engine. **Resolve:** Phase 4.

5. **D1 REST API pagination at 41k rows?** — Pagination latency p50/p95 for articles query. Determines if build-time REST calls are fast enough for steady-state renders (~34 pages = ~17 DB round trips). Fallback: SQLite snapshot export. **Resolve:** Phase 3.

6. **Actual GPT Image 2.5 cost per image?** — Call API for one hero, inspect usage. PRD's ~$0.08/image, ~$1.20/mo is unverified. **Resolve:** Phase 5 (before backfill approval).

7. **Vectorize performance at bilingual scale?** — Embedding model (is it multilingual?), query latency (p50/p95), relevance on 30-50 test queries, cost formula at realistic search volume. **Resolve:** Phase 4 or Phase 10 (measure early so Phase 10 scope is firm).

8. **Entity filtering for dedicated pages?** — Which of 46k entities warrant a page? Traffic analysis or mention frequency. **Resolve:** Phase 4.

9. **Render manifest includes hreflang pairing (esCounterpart)?** — Check if existing/planned manifest carries sibling article IDs. **Resolve:** Phase 2.

10. **Existing D1 bug (reprocess-all.post.ts 100-param ceiling)?** — Does archive loader chunk ID-list queries safely? **Resolve:** Phase 2.

---

## Confidence Assessment

| Area | Level | Notes |
|---|---|---|
| **Stack** | MEDIUM-HIGH | Versions verified vs npm (HIGH); Astro APIs from docs via Context7 (MEDIUM, not per-item cross-verified); fonts from WebSearch only (LOW, needs spike) |
| **Features** | MEDIUM | Features vs PRD numbers (HIGH); legal doctrine (MEDIUM-HIGH); competitor analysis from WebSearch (LOW) |
| **Architecture** | MEDIUM-HIGH | Cloudflare/Astro platform mechanics vs official docs (HIGH); render location and search decisions require measurement |
| **Pitfalls** | MEDIUM | Official docs (MEDIUM); community gotchas from WebSearch (LOW); v1 defects are well-documented (MEDIUM-HIGH) |

**What This Means:** Begin Phase 1 with high confidence; all corrections are blocking. Phases 2-4 will surface new unknowns; plan iterations. Phase 10 (Search) has genuine uncertainty; start measuring early. Every high-confidence spike should complete by Phase 2 end.

---

## Sources

**STACK.md:** npm registry (HIGH); Astro/Cloudflare official docs via Context7 (MEDIUM); Cloudflare changelog/API reference (HIGH); WebSearch for tooling/community patterns (LOW).

**FEATURES.md:** Poynter/Lenfest Table Stakes (MEDIUM); competitor review via WebSearch (MEDIUM); legal doctrine (AP v. Meltwater, Lexology) (MEDIUM); EU AI Act, Trust Project (MEDIUM); project PRIMARY: PROJECT.md, PRD v2.0 (HIGH).

**ARCHITECTURE.md:** Astro/Cloudflare official docs (MEDIUM); platform limits/pricing (HIGH); project PRIMARY: PROJECT.md, PRD §3-4, §7, §13-14 (HIGH).

**PITFALLS.md:** Astro/Cloudflare docs (MEDIUM); community survey on gotchas (LOW); project PRIMARY: PROJECT.md, PRD v1 defect history (HIGH).

---

*Synthesis complete. All 4 research streams integrated. Ready for `/gsd-plan-phase 1`.*

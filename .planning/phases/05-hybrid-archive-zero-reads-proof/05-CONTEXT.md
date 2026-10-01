# Phase 5: Hybrid Archive & Zero-Reads Proof - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the project's premise: a public request reads zero D1 rows. If the proof fails, the project
stops for architecture review. Alongside the proof, add the R2 archive tier. Articles outside a
traffic-derived hot window, and tags below a size threshold, render once to R2. They are served by
the Worker when a request falls through the static-asset layer. Static file count becomes a
watched, build-enforced budget line.

Requirements: ARCH-01, ARCH-08, REND-07, REND-08, REND-09, REND-10, REND-11, REND-12.

**Why the archive tier is needed now (measured 2026-09-30, `dist/client` from tonight's build):**
- **60,387 static files** deployed. That is about 40,050 article pages plus **19,882 tag pages**,
  plus listings and static pages. The ceiling is 100,000 and the planned fail margin is 80,000.
- At about 90 new articles a day, the 80k margin is roughly 7 months away with no change.
- **Phase 6 (Spanish) roughly doubles the article count.** Without an archive tier that alone
  crosses the 100,000 ceiling. The archive tier is the precondition for Phase 6, not a fix for a
  current failure.

</domain>

<decisions>
## Implementation Decisions

### The zero-reads gate (ARCH-01) — what counts as proof
- **D-01:** The gate passes on **structure plus a load test**, not on a literal per-Worker "0"
  read from D1 analytics. Leg 1 (structural): v2's Worker has no D1 binding, already enforced at
  build time by `tools/assert-no-d1.mjs`. Leg 2 (measured): a scripted pass of a few thousand
  requests covering the roadmap's request mix (homepage, all 8 categories, 20 hot articles,
  20 archived articles, 20 tag pages including archived ones, sitemap, `/rss.xml`). D1 rows-read
  for that window must stay within v1's normal background for a comparable window. The
  researcher must first establish **whether** D1 analytics can attribute reads to a calling
  Worker (unverified as of this discussion). If they can, use that as a stronger leg 2. Either
  way the method and its limits are written down next to the result.
  — **Reversibility:** reversible — it is a measurement method, not a deployed contract.
- **D-02:** **A failed gate halts the project for architecture review, as written in the
  roadmap.** A non-zero read is not logged as a defect and fixed in-phase. Phase 6 does not start
  on top of an unproven premise.
- **D-03:** The gate runs **after** the archive tier is serving. The archived-article and
  archived-tag paths (Worker → R2) are the riskiest part of the request mix and must be inside
  the measured pass, not proven separately.

### Hot window (REND-10) — derived from traffic
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

### Tag tiering (REND-09)
- **D-08:** A tag stays **static only if it has 10 or more articles** (about 2,325 tags today).
  All other tags render to R2. This frees about 17,500 static files. The threshold is applied at
  build time, so tags promote and demote automatically as they grow.
  Measured distribution (2026-09-30): 10,240 tags (51%) have exactly 1 article; 13,336 have 2 or
  fewer; 4,200 have 5 or more; 2,325 have 10 or more; 1,034 have 25 or more. Per-page counts are
  capped at 30 cards, so the true counts for the largest tags are higher.
- **D-09:** **Archived tag pages update in the same 2-hour cycle.** When newly ingested articles
  carry an archived tag, only the touched tag pages are re-rendered to R2 on that cycle (usually a
  few dozen pages). Tag pages must never visibly lag their articles.

### Archive freshness (REND-07, REND-12)
- **D-10:** **Redesign or template change: the archive re-renders in the background within
  24 hours.** The deploy ships hot pages in the new design immediately. For up to a day, archived
  pages may show the previous design. A deploy is never blocked on the full archive re-render.
  The full re-render must complete without any single Worker invocation exceeding the CPU ceiling
  (REND-12).
- **D-11:** **Content changes to an archived article** (a re-summary now, a Spanish version in
  Phase 6) re-render **just that article in the same 2-hour cycle**, the same rule as D-09.
- **D-12:** **Partial R2 write failure: keep the old copy and alert.** The previous R2 object
  keeps serving. The owner gets an ntfy push naming how many pages failed. The next cycle
  retries. This is the same pattern as Phase 4's failed-build handling (Phase 4 D-15). One bad
  page never blocks the rest.

### File-count budget (REND-11)
- **D-13:** The build fails at **80,000** static files (roadmap criterion 4). The current count is
  reported daily against the 100,000 ceiling. Today's measured baseline is 60,387.

### Claude's Discretion
- Where the archive render runs (Workers Builds in Node writing to R2, versus a Worker), and how
  R2 objects are keyed and versioned, as long as D-09 to D-12 hold and ARCH-08's ≤1 KV read /
  <5 ms CPU per public request holds on the archive path too.
- How "touched" articles and tags are detected per cycle (reuse of the render manifest and
  loader's warm-mode change detection is expected).
- Load-test tooling, request count and the baseline window for D-01's leg 2.
- Where the daily file-count report is delivered (it joins D1 reads and spend in the existing
  daily routine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § "Phase 5: Hybrid Archive & Zero-Reads Proof": goal and the five
  success criteria. Criterion 1's request mix is the gate's request mix.
- `.planning/REQUIREMENTS.md`: ARCH-01, ARCH-08, REND-07 to REND-12.
- `.planning/PROJECT.md` Key Decisions: "Tag pages default to the archive tier", "File count is a
  watched budget line", "R2 for the archive, not KV" (~1.1 GB estimate), "Static assets are
  immutable per deployment", "Archive depth derived from traffic". Also the Constraints section
  (100,000-file ceiling, Wrangler ≥ 4.34.0, D1 100-parameter limit).

### Build pipeline this phase extends
- `docs/phase-04/build-pipeline-decision.md`: option-a (Workers Builds does all builds),
  incremental build ON. Consequence 5 requires re-measuring cold builds as the corpus grows.
- `docs/phase-04/build-pipeline.md`: forced-full-rebuild runbook (`ARTICLES_FORCE_COLD=1`).
- `docs/phase-04/build-measurements.md`: cold 649s / warm 147s on Workers Builds; D1 rows per
  build.
- `docs/phase-04/loader.md`: loader modes, row budgets, never-shrink check.
- `.planning/phases/04-static-generation-templates-seo/04-CONTEXT.md`: D-01 (Workers Builds),
  D-02 (ingest cron POSTs Deploy Hook), D-07/D-08 (canonical URLs, Worker 301s), D-15 (failed
  build deploys nothing and alerts).

### Render manifest and edge config
- `docs/phase-03/render-manifest.md`: KV render manifest contract (the Worker's one KV read).
- `docs/phase-03/edge-config.md`: static-asset / Worker routing.
- `docs/phase-03/render-step-location.md`: render step location (amended by Phase 4 D-05).
- `docs/phase-03/render-cost-report.md`, `docs/phase-03/measurements.md`: render cost figures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/worker.ts` + `src/lib/article-redirect.ts`: the Worker already handles fall-through
  (a non-matching path goes to `env.ASSETS.fetch`) with exactly one KV read for uuid paths. The
  R2 archive path slots in here and must keep the ≤1 KV read budget.
- `src/content/loaders/articles-loader.ts`: cold/warm/sweep modes and change detection. This is
  the natural source of "which articles and tags changed this cycle" for D-09/D-11.
- `tools/assert-no-d1.mjs` + `tests/ci-fixtures/assert-no-d1.test.mjs`: the structural leg of
  D-01. It must keep covering any new Worker code (an R2 serving module).
- `tools/ci-build.mjs`: Workers Builds wrapper with ntfy alerting. This is the D-12 alert path.
- `tools/verify-edge-headers.mjs`, `tests/integration/url-shapes.test.mjs`,
  `tests/integration/browser-journeys.test.mjs`: live URL-contract suites to extend to archived
  URLs.

### Established Patterns
- Byte-identity across builds is regression-tested (`tests/regression/byte-identity.test.mjs`).
  R2-rendered pages should come from the same templates and be byte-identical to what the static
  build would emit.
- Measurements are recorded in `docs/phase-NN/*.md` with the command that reproduces them;
  verdicts carry names (e.g. `WB_COLD_FITS`).
- Owner-facing failures alert via ntfy; failure leaves the previous good state serving.

### Integration Points
- `wrangler.jsonc`: v2 currently binds only `ASSETS` and `RENDER_MANIFEST` (KV). An R2 binding is
  added here. No D1 binding may ever be added (D-01 leg 1).
- 915tldr.com2 ingest cron (`server/tasks/fetch-articles.ts`, `server/utils/frontend-deploy-hook.ts`):
  triggers the production build once per ingest when public articles changed (went live
  2026-09-30, UAT 3 pending).

</code_context>

<specifics>
## Specific Ideas

- The gate request mix is taken verbatim from roadmap criterion 1, with archived articles and
  archived tag pages included (D-03).
- R2 `get()` p50/p95 latency for ~30 KB objects must be recorded on the deployed Worker and shown
  to fit inside the 1.5 s LCP budget (roadmap criterion 2).

</specifics>

<deferred>
## Deferred Ideas

- **Thin one-article tag pages.** 10,240 tags (51%) have exactly one article. Whether to noindex
  them or not build them at all is an SEO and content decision, not an archive-tier one. It belongs
  in Phase 11 (Quality Gates) or its own decision. Phase 5 only moves them to R2.

### Reviewed Todos (not folded)
- `2026-09-26-tracer-test-html-entity-title.md`: already fixed in Phase 4 (the tracer now
  compares decoded titles via `tests/helpers/html-text.mjs`). It can be moved to
  `.planning/todos/completed/`.
- `2026-09-23-split-repos-into-plain-parent-directory.md`: belongs to Phase 12 (`resolves_phase: 12`).

</deferred>

---

*Phase: 05-hybrid-archive-zero-reads-proof*
*Context gathered: 2026-09-30*

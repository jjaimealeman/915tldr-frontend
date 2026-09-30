# Phase 3: Foundation & Read-Budget Guardrails - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **structural guarantee that the public request path cannot reach D1**,
plus the observability to tell deploy, render and cache layers apart when debugging.

It is the phase PROJECT.md's core value depends on: *"Zero D1 reads on the public request path.
Not 'fewer' — architecturally zero, enforced structurally at build time."* Everything else in
the rebuild is described as negotiable; this is not.

Concretely: the Astro scaffold, the build-time D1-import assertion, the KV render manifest,
the three measurements that decide where rendering runs, and the version/noindex surfaces.

**Not in scope:** generating the public pages themselves (Phase 4), the R2 archive tier and the
zero-reads proof (Phase 5), Spanish routing (Phase 6). This phase builds the guardrail and the
foundation those phases run inside.

**Repo note:** unlike Phase 2, **all code in this phase lands in this repo**
(`/home/jaime/www/_github/915tldr.com`) on `feature/phase-03`. The sibling `915tldr.com2`
Nuxt app is not touched.

</domain>

<decisions>
## Implementation Decisions

### Render-step location

- **D-01:** The render step's location (cron worker / separate worker via Queues / CI) is
  **decided from measurement, not chosen up front**. Success criterion 5 requires three numbers
  recorded rather than guessed: cron-worker CPU headroom, per-page render cost in ms, and D1
  REST API pagination p50/p95 at ~42k rows. The decision is deferred to those figures and must
  be written down with them.
  Rationale for taking this literally: Phase 2 had two confident estimates collapse under
  measurement — the published `~$7.44` backfill that re-derived to `$80.01–$144.13`, and D-16's
  "dead source row" that did not exist at all. Both were plausible and both were wrong.
  — **Reversibility:** costly — moving the render step after Phase 4 has built against it means
  rewriting the build/deploy pipeline and re-timing the whole render budget.

- **D-02:** The measurement is taken **against a real tracer slice, not a synthetic benchmark**.
  Scaffold one real article page end-to-end first — D1 REST read at build time, render, KV
  manifest write — then measure that. A fixture-driven Astro benchmark measures a different code
  path than production.
  Rationale: the project's own verification standard, and the 2026-08-27 incident where testing
  a page by fetching its URL (server render) rather than clicking through (client path) produced
  an hour of chasing a harmless bug and a rolled-back deployment. Phase 2's tracer (02-04) found
  three live `gpt-5.6-luna` API incompatibilities that no amount of code reading would have
  surfaced.

### Render manifest schema (REND-06)

- **D-03:** The manifest is keyed **one KV key per article** (e.g. `manifest:<uuid>`), not a
  single blob and not sharded.
  Rationale: O(1) independent reads and writes, and no read-modify-write race between concurrent
  renders. A single blob at ~42k articles × ~200 bytes ≈ 8 MB against KV's 25 MB value ceiling
  works today but shrinks as the corpus grows, and every render would rewrite the whole thing.
  The per-article KV reads happen at **build/render time, not on the public request path**, so
  they do not touch PROJECT.md's ≤1 KV read/request budget.
  — **Reversibility:** costly — changing the key shape after Phase 4/5 build against it means
  migrating every manifest entry and updating every reader.

- **D-04:** Each manifest entry records, at minimum:
  - **Spanish counterpart ID** — MANDATORY from day one. Success criterion 3 requires it
    explicitly so Phase 6's hreflang pairing never forces a full-corpus re-render.
  - **Content hash** of the source row (summary/title/tags) — the staleness signal that lets the
    render step skip unchanged articles. This is the main lever keeping rebuild cost bounded.
  - **Render version / schema version** — which template and manifest schema produced the entry,
    so a template change can invalidate selectively instead of globally.
  - **Rendered-at timestamp + build hash** — pairs with OPS-05/OPS-06 so "is this page stale, or
    is the cache lying?" is answerable. That question is the phase goal's second half.
  - **Category + published_at**, denormalised — so the render step can make tiering and routing
    decisions without a second D1 read. Phase 5 splits hot/archive tiers and will want these.
  — **Reversibility:** one-way for the Spanish counterpart ID specifically — omitting it and
  adding it later is precisely the full-corpus re-render this field exists to prevent.

### D1-import assertion (ARCH-02, ARCH-03)

- **D-05:** Detection is an **import-graph walk from public entrypoints** — resolve the actual
  module graph from each public route and island entry, then assert no path reaches the D1
  binding. Not a grep scan, not a shallow AST scan of file trees.
  Rationale: only a graph walk catches a **transitive** violation — a page importing a helper
  that imports the binding. A grep also cannot distinguish an import from a mention in a comment
  or docstring, and this repo's own planning docs quote the banned patterns verbatim.
  ARCH-03 requires island components and `/_server-islands/*` to be covered, not just `.astro`
  pages; islands compile from ordinary `.vue` files into server-rendered endpoints, so a
  page-file scan misses them entirely.
  — **Reversibility:** reversible — the checker is self-contained; its detection strategy can be
  strengthened later without touching application code.

- **D-06:** The assertion is proven by **permanent negative test fixtures in CI** — a
  page-shaped file and an island-shaped file, each carrying a deliberate D1 import, that the
  suite asserts the checker REJECTS. Not a one-time manual demonstration.
  Rationale: Phase 2's CONT-06 defect is the exact failure mode — **248 tests passed while 253
  production rows violated the requirement**, because the check existed but had silently stopped
  gating. A guard nobody proves still fires is a guard you do not have. Permanent fixtures also
  catch the case where an Astro upgrade changes island output paths and the scan stops matching.
  This satisfies success criterion 1's "watch CI go red both times" on every commit rather than
  once.

### Scaffold adoption of Phase 1 output

- **D-07:** Phase 1's `design/mockups/style.css` is **ported wholesale** as the global
  stylesheet; Astro components are authored to emit the same class names and DOM shape the
  approved mockups use. Not restructured into scoped component styles, and not a hybrid split.
  Rationale: Phase 1's visual output was formally approved (`01-APPROVAL.md`). Wholesale port
  keeps that approval valid essentially byte-for-byte, and keeps D-13's contrast table — which
  is *generated from the CSS tokens*, not hand-written — valid without re-derivation. A
  restructure reinterprets approved output and would require re-proving contrast and the
  empirically-measured zero-layout-shift behaviour.
  — **Reversibility:** reversible — styles can be refactored into scoped components later once
  the visual result is locked and regression-tested.

### Staging noindex (OPS-02)

- **D-08:** `dev.915tldr.com`'s `X-Robots-Tag: noindex` is served by a **Cloudflare Transform
  Rule** scoped to the dev hostname — zone-level config, independent of the app and of any
  deploy.
  Rationale: it holds even if the Worker errors or a broken build ships, which an `_headers`
  file shipped with the build does not. A Worker-set header is unsuitable by construction:
  static asset requests bypass the Worker entirely (`run_worker_first: false`), which is the
  whole point of this architecture, so it would not cover most responses.
  Tradeoff accepted: the rule lives in Cloudflare config rather than version control, so it must
  be documented and verified by response header (which OPS-02 requires anyway).

### Claude's Discretion

These carry no gray area — the stack research already fixes them, and they were not discussed:
- **ARCH-04:** bindings via `import { env } from 'cloudflare:workers'`; `Astro.locals.runtime.env`
  is removed in `@astrojs/cloudflare` v13 / Astro 6 and must appear nowhere.
- **ARCH-05:** `output: 'static'` with per-route `export const prerender = false`. `'hybrid'` is
  a removed keyword as of Astro v5, not a deprecation — it must not appear.
- **ARCH-06:** `imageService: { build: 'compile', runtime: 'passthrough' }` set **explicitly**.
  The adapter default changed to `'cloudflare-binding'` as of v14.2.0, which would silently
  introduce a live Cloudflare-account dependency into the build.
- **OPS-05 / OPS-06 / OPS-08:** version surfacing and the README read-budget statement are
  clear-cut; the planner chooses the mechanism.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project constraints and architecture
- `.planning/PROJECT.md` — the zero-D1-reads core value, the read budget (<2M D1 reads/day hard
  fail >5M; Worker CPU <5ms/request; KV ≤1 read/request), Core Web Vitals targets, and the
  banned-package list (NuxtHub).
- `.claude/CLAUDE.md` — the pinned stack (Astro 7.3.2, `@astrojs/cloudflare` 14.3.1,
  `@astrojs/vue` 7.0.2, wrangler ≥4.34.0), the Workers Static Assets 100,000-file ceiling, the
  D1 100-bound-parameter limit, and the `imageService` / `output: 'hybrid'` / `ClientRouter`
  traps written up in full.
- `.planning/ROADMAP.md` §"Phase 3" — the goal and the six numbered success criteria. Criterion
  5 is the one that governs D-01.
- `.planning/REQUIREMENTS.md` — ARCH-02…ARCH-06, REND-06, OPS-02, OPS-05, OPS-06, OPS-08.

### Phase 1 output this phase consumes
- `design/mockups/style.css` — the approved stylesheet, ported wholesale per D-07.
- `design/mockups/{index,category,article,changelog,contact}.html` — approved page shapes.
- `design/mockups/feed/page-*.json` — static feed fixtures (D-05 amended in Phase 1).
- `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` — the colour system
  (D-01 tiered category colour, D-02 photography-sampled hues, D-03 dark-mode third ramp,
  D-04 near-neutral palette), the font-swap decision as amended by D-GAP-A
  (`font-display: optional` + preloads), and D-13's token-generated contrast table.
- `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` — the signed approval
  D-07 is protecting.

### Phase 2 output and open findings
- `.planning/phases/02-content-quality-grounding/02-VERIFICATION.md` — passed with two recorded
  owner overrides (CONT-01, CONT-10).
- `.planning/WINDOWS.md` entries 19–24 — open findings carried forward, including the KTSM
  PerimeterX block and the deferred D-09 live grounding gate.
- `915tldr.com2/docs/phase-02/d1-access.md` — the **proven** D1 REST/wrangler command shape and
  the live corpus baseline. Note the path: this doc lives in the sibling repo.
- `915tldr.com2/docs/phase-02/corpus-measurements.md` — real content-length distribution, useful
  for sizing render cost.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design/mockups/style.css` + the 5 approved HTML pages — the visual contract this scaffold
  must reproduce (D-07).
- `design/mockups/feed/page-*.json` — ready-made fixtures for rendering without hitting D1,
  useful for tests and for the negative-fixture work in D-06.
- `design/scripts/` + `package.json` scripts (`check:contrast`, `verify:phase-1`,
  `test:unit`, `test:e2e`, `fonts:build`, `palette:build`) — an established Playwright + Node
  tooling pattern this phase's CI checks can follow rather than invent.

### Established Patterns
- **This repo currently has no application code** — no `server/`, `app/` or `src/`. It holds
  `.planning/`, `design/`, `docs/`, `changelog/`. Phase 3 is the first code to land here, so the
  scaffold sets the conventions rather than fitting into existing ones.
- **Cross-repo split:** the Nuxt pipeline/admin stays in `915tldr.com2` and is not touched.
- **Commit discipline:** commits go through `/jja-commit`, never bare `git commit` — the
  repo has a pre-commit hook that writes `[auto-generated]` changelog placeholders otherwise.
  Nine such placeholders already exist from earlier phases and remain uncleaned.

### Integration Points
- **D1 REST API at build time** — the pattern is proven (Phase 2, 41,924 rows). The loader runs
  in Node during `astro build`, never in a Worker. `drizzle-orm/d1` is Workers-binding-only and
  cannot be used here.
- **KV** — the render manifest (D-03/D-04). Build/render-time access only.
- **Cloudflare zone config** — the Transform Rule for `dev.915tldr.com` (D-08) lives outside the
  repo.

</code_context>

<specifics>
## Specific Ideas

- Success criterion 1 wants the assertion demonstrated failing on **both** a `.astro` page and a
  file under the island component tree. D-06 encodes both as permanent fixtures.
- Success criterion 2 wants a grep for `'hybrid'` and `Astro.locals.runtime.env` to return zero
  hits. Worth wiring as a CI check alongside the import-graph walk, not just a manual grep —
  same reasoning as D-06.
- Success criterion 4 wants `/version.json` and the public footer to agree on short commit hash
  and build timestamp, and the README to state the read budget.

</specifics>

<deferred>
## Deferred Ideas

- **KTSM PerimeterX block** (WINDOWS entry 19) — blocks CONT-01 and degrades one of three
  sources to truncated feed teasers. It affects the data Phase 4 renders, but resolving it is
  neither this phase's scope nor solvable in code without evasion, which the owner ruled out.
- **D-09 live grounding gate** (WINDOWS entry 20) — the calibrated cascade is built but not
  wired into live ingest. Belongs with the pipeline, not the scaffold.
- **`duplicate-detector.ts` miss** — confirmed on article ids 40574/40614 (byte-identical source,
  same timestamp, two rows, two different summaries). Pipeline-side; also still on
  `gpt-4o-mini` while the rest of the pipeline moved to `gpt-5.6-luna`.
- **Nine `[auto-generated]` changelog placeholders** from Phase 1 and early Phase 2 — cosmetic
  cleanup, owner's call, not phase work.
- **`.gsd/` and `docs/screenshots/` untracked** — `.gsd/` is regenerated runtime state and
  should be gitignored; `docs/screenshots/` is 16 MB of Phase 1 "before" captures whose
  versioning is an open decision.

</deferred>

---

*Phase: 3-Foundation & Read-Budget Guardrails*
*Context gathered: 2026-09-21*

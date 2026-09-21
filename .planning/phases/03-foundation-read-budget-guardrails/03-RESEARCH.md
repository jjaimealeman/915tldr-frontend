# Phase 3: Foundation & Read-Budget Guardrails - Research

**Researched:** 2026-09-21
**Domain:** Astro 7 + Cloudflare Workers scaffold, build-time import-graph enforcement, Cloudflare KV/Workers platform limits, edge header policy
**Confidence:** MEDIUM-HIGH (stack/config claims verified against official Astro/Cloudflare docs directly; the import-graph-assertion *mechanism* is a synthesis from official Rollup/Vite plugin APIs, not a single off-the-shelf recipe, so it carries a slightly lower confidence than the pure-config claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The render step's location (cron worker / separate worker via Queues / CI) is decided
  from measurement, not chosen up front. Three numbers must be recorded: cron-worker CPU
  headroom, per-page render cost in ms, D1 REST API pagination p50/p95 at ~42k rows.
  Reversibility: costly.
- **D-02:** The measurement is taken against a real tracer slice (one real article page
  end-to-end: D1 REST read at build time → render → KV manifest write), not a synthetic
  benchmark.
- **D-03:** The render manifest is keyed one KV key per article (`manifest:<uuid>`), not a
  single blob and not sharded. Reversibility: costly.
- **D-04:** Each manifest entry records at minimum: Spanish counterpart ID (mandatory from day
  one, one-way reversibility), content hash of source row, render/schema version, rendered-at
  timestamp + build hash, category + published_at (denormalised).
- **D-05:** The D1-import assertion is an import-graph walk from public entrypoints (pages +
  islands), not a grep scan or shallow AST scan of file trees. Must catch transitive violations
  and must cover island components / `/_server-islands/*`, not only `.astro` pages.
  Reversibility: reversible.
- **D-06:** The assertion is proven by permanent negative test fixtures in CI (a page-shaped
  file and an island-shaped file, each with a deliberate D1 import, that the suite asserts the
  checker REJECTS) — not a one-time manual demonstration. Precedent: Phase 2's CONT-06 defect
  (248 tests passed while 253 production rows violated the requirement because a check existed
  but silently stopped gating).
- **D-07:** Phase 1's `design/mockups/style.css` is ported wholesale as the global stylesheet;
  Astro components emit the same class names/DOM shape as the approved mockups. Not restructured
  into scoped component styles. Reversibility: reversible (later refactor is fine once locked).
- **D-08:** `dev.915tldr.com`'s `X-Robots-Tag: noindex` is served by a Cloudflare Transform Rule
  scoped to the dev hostname — zone-level config, independent of app/deploy. Tradeoff accepted:
  lives outside version control, must be documented and verified by response header.

### Claude's Discretion

- **ARCH-04:** bindings via `import { env } from 'cloudflare:workers'`; `Astro.locals.runtime.env`
  is removed in `@astrojs/cloudflare` v13 / Astro 6 and must appear nowhere.
- **ARCH-05:** `output: 'static'` with per-route `export const prerender = false`. `'hybrid'` is a
  removed keyword as of Astro v5, not a deprecation — must not appear.
- **ARCH-06:** `imageService: { build: 'compile', runtime: 'passthrough' }` set explicitly. The
  adapter default changed to `'cloudflare-binding'` as of v14.2.0.
- **OPS-05 / OPS-06 / OPS-08:** version surfacing and the README read-budget statement are
  clear-cut; the planner chooses the mechanism.

### Deferred Ideas (OUT OF SCOPE)

- KTSM PerimeterX block (WINDOWS entry 19) — not this phase's scope.
- D-09 live grounding gate (WINDOWS entry 20) — pipeline-side, not the scaffold.
- `duplicate-detector.ts` miss (article ids 40574/40614) — pipeline-side.
- Nine `[auto-generated]` changelog placeholders — cosmetic, owner's call.
- `.gsd/` and `docs/screenshots/` untracked — housekeeping, not phase work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-02 | Build fails if any public route/island/middleware/endpoint can reach the D1 binding | See "The D1-Import Assertion" — Rollup module-graph walk design, verified via official Rollup plugin-development docs |
| ARCH-03 | Assertion scans island component files and `/_server-islands/*`, not only `.astro` pages | See "The D1-Import Assertion" entrypoint enumeration; server-island path confirmed via Astro docs + issue tracker |
| ARCH-04 | Bindings via `import { env } from 'cloudflare:workers'`; no `Astro.locals.runtime.env` | Confirmed verbatim via Context7 `/withastro/docs` |
| ARCH-05 | `output: 'static'` + per-route `prerender = false`; `'hybrid'` appears nowhere | Confirmed verbatim via Context7 `/withastro/docs`; removal of `hybrid` cross-checked against CLAUDE.md's prior research |
| ARCH-06 | `imageService: { build: 'compile', runtime: 'passthrough' }` set explicitly | Confirmed verbatim via Context7 `/withastro/docs`, including the v14.2.0 default-change note |
| REND-06 | Render manifest in KV records what's rendered and at which version | See "Render Manifest Schema" — KV limits fetched directly from Cloudflare docs; schema follows D-03/D-04 |
| OPS-02 | `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge, verified by response header | See "Edge Noindex Header" — Transform Rule mechanics and the `_headers`-file gap that makes D-08 necessary |
| OPS-05 | Deployed short commit hash + build timestamp in public footer | See "Build-Stamp Plumbing" — `WORKERS_CI_COMMIT_SHA` confirmed directly from Cloudflare docs |
| OPS-06 | `/version.json` exposes build hash | Same as OPS-05 |
| OPS-08 | Read budget stated in README | No external research needed; content-authoring task, see Summary |
</phase_requirements>

## Summary

This phase has one hard technical unknown (how to make ARCH-02/03 real, not aspirational) and
one hard measurement unknown (where the render step lives). Everything else — the Astro config
shape, the KV manifest schema, the edge header mechanism, and the build-stamp plumbing — is
already fully specified by official documentation with no ambiguity, and the version numbers
found here (astro 7.3.3, `@astrojs/cloudflare` 14.3.2, `@astrojs/vue` 7.0.3, `wrangler` 4.136.1)
are trivial patch bumps ahead of the versions pinned in `.claude/CLAUDE.md` five days ago — safe
to install as-is.

**On the D1-import assertion (ARCH-02/03):** the project's own architecture already makes this
easier than it sounds. Because `output: 'static'` means D1 access happens through a hand-written
Astro Content Loader that runs once, in Node, during `astro build` — never inside the deployed
Worker — there is no `d1_databases` binding in the Astro app's `wrangler.jsonc` at all, and there
does not need to be one. The real risk isn't a Workers binding; it's the *Node-only D1 REST
client module* accidentally being imported by a component, island, or middleware file that Vite
then bundles into the on-demand Worker output (server islands, `prerender = false` routes,
actions). D-05's "resolve the actual module graph" instruction points at the correct fix:
centralize all D1 access behind one file (e.g. `src/lib/server/d1-client.ts`), then write a
Rollup/Vite plugin that walks the *real*, already-resolved module graph Astro's own build
produced — using `this.getModuleInfo(id).importedIds` / `.dynamicallyImportedIds` from the
`buildEnd` hook, where Rollup's own docs confirm this data is complete and will not change
further — from every public entrypoint (every `.astro` page not marked `prerender = true`,
every server-island component, middleware, and API endpoint) and asserts none of them reach that
one file. This is the same technique bundle-visualizer tools use to draw dependency graphs; here
it's used to forbid a path instead of drawing it. `dependency-cruiser` was evaluated as an
alternative and rejected as the *primary* mechanism — it has no `.astro` parser, so it can only
see the compiled-JS *output*, not islands' actual dependency shape — but it remains useful as a
secondary belt-and-suspenders check restricted to the plain `.ts`/`.js` files under `src/lib/`.

**On the render-step location (D-01):** this research changes the shape of the decision. The
project's own carried-forward blocker assumed a flat 300-second Worker CPU ceiling ("a full 82k
rebuild at ~4ms/page is ~330s, over the 300s Worker CPU ceiling"). Cloudflare's own limits page,
fetched directly this session, states the CPU ceiling for a Cron Trigger depends on the
trigger's *interval*: 30 seconds for intervals under 1 hour, but **15 minutes (900,000ms)** for
intervals of 1 hour or more. The existing production cron (`915tldr.com2/wrangler.jsonc`,
`"crons": ["0 */2 * * *"]`, a 2-hour interval) qualifies for the 15-minute ceiling, not 30
seconds and not a flat 300s figure. That does not resolve D-01 by itself — the real cron worker
already spends CPU on RSS fetch/summarization/dedup, and headroom must still be *measured*, not
assumed — but it means the "Queues fan-out is required" conclusion in STATE.md's blockers may
have been reached from a wrong ceiling, and the measurement task in this phase should confirm
the effective ceiling empirically (deliberately run a CPU-bound scheduled handler) rather than
trust either number.

**Primary recommendation:** build the Astro scaffold exactly as `.claude/CLAUDE.md` already
specifies (verified current), centralize D1 access behind one module and enforce its
unreachability from public entrypoints with a custom Rollup/Vite plugin proven by permanent CI
fixtures, key the KV render manifest one-key-per-article with the five D-04 fields, serve the
noindex header via Transform Rule (confirmed to run at the edge on the way back to the client,
independent of whether a Worker or the static-asset layer served the response), stamp the build
from Cloudflare Workers Builds' own `WORKERS_CI_COMMIT_SHA` environment variable, and take the
three D-01 measurements against the real tracer slice before deciding where rendering runs — do
not carry forward the 300-second assumption without re-deriving it against the real 15-minute
cron ceiling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| D1-import build assertion | Build tooling / CI | — | Runs entirely inside `astro build`'s Vite/Rollup pipeline; never reaches a runtime tier by design |
| Astro config (`output`, `imageService`, `env`) | Build tooling / CI | Frontend Server (islands) | Config is resolved at build time; `imageService.runtime` and `cloudflare:workers env` affect the on-demand Worker at runtime |
| KV render manifest | Database / Storage | Build tooling / CI (writer) | KV is the storage tier; writes happen from the Node build/render step, not from the public Worker |
| `X-Robots-Tag: noindex` | CDN / Edge | — | A Transform Rule is zone-level HTTP policy, independent of both the Worker and the static-asset layer |
| Build-stamp (`/version.json`, footer) | Build tooling / CI | Browser / Client (footer display) | Value originates from Workers Builds' CI environment variable, baked into the static output at build time |
| Render-step location decision | Build tooling / CI (candidate: CI) | API / Backend (candidate: cron Worker or Queues consumer) | Undecided by design (D-01); the three tiers being measured against each other are exactly Build/CI vs. two runtime-Worker shapes |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `astro` | **7.3.3** [ASSUMED: package name/ecosystem fit is training knowledge; version confirmed `npm view astro version`, live 2026-09-21] | Static site generator + island architecture | Already locked by CLAUDE.md; patch-bumped from 7.3.2 five days ago, no breaking change noted |
| `@astrojs/cloudflare` | **14.3.2** [ASSUMED name; version confirmed `npm view`, live 2026-09-21] | Adapter for Cloudflare Workers — on-demand routes, server islands, bindings | Confirmed via Context7 `/withastro/docs`: `imageService` object form (`{ build, runtime }`) requires this package, `v14.2.0+` |
| `@astrojs/vue` | **7.0.3** [ASSUMED name; version confirmed `npm view`] | Vue island support | Locked by CLAUDE.md |
| `vue` | **3.5.43** [ASSUMED name; version confirmed `npm view`] | Vue 3 runtime for islands | Peer dependency of `@astrojs/vue` |
| `wrangler` | **4.136.1** [ASSUMED name; version confirmed `npm view`] — floor `>=4.34.0` | Build/deploy CLI, D1 REST access, KV bulk writes | Confirmed floor via CLAUDE.md's prior research; current version comfortably above it |
| `zod` | via `astro/zod` re-export, registry current **4.6.5** [ASSUMED name; version confirmed `npm view`] | Input validation for future Astro Actions | Import from `astro/zod`, not the bare package — CLAUDE.md's own prior finding, unchanged |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vueuse/core` | 14.4.0 (per CLAUDE.md's prior research, not re-verified this session — out of scope for this phase, no islands ship yet) | Composition utilities | Phase 8, not this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Rollup/Vite plugin (module-graph walk) for the D1-import assertion | `dependency-cruiser` as the *primary* mechanism | Rejected as primary: no native `.astro` parser [CITED: WebSearch result quoting dependency-cruiser's supported-extensions list — `.jsx`, `.tsx`, `.vue`, `.svelte`, no `.astro`], so it cannot see into island entrypoints the way D-05/ARCH-03 require. Usable as a *secondary* check scoped to `src/lib/**/*.ts` only. |
| Cloudflare Transform Rule for noindex (D-08, locked) | Workers Static Assets `_headers` file | Rejected by the user's own decision (D-08) and independently confirmed here: `_headers` rules apply only to responses the static-asset layer itself serves — Cloudflare's own docs state "Custom headers defined in the `_headers` file are not applied to responses generated by your Worker code" [CITED: developers.cloudflare.com/workers/static-assets/headers/, fetched directly] — so it cannot cover on-demand (server-island) responses on the same hostname, only static ones. |
| One KV key per article (D-03, locked) | Single manifest blob, or sharded blobs | Rejected per D-03's own stated rationale; independently confirmed the 25 MiB KV value ceiling [CITED: developers.cloudflare.com/kv/platform/limits/, fetched directly] makes a single blob viable *today* (~42k × ~200B ≈ 8MB) but fragile as the corpus grows, exactly as D-03 argued. |

**Installation:**
```bash
pnpm add astro @astrojs/cloudflare @astrojs/vue vue
pnpm add -D wrangler
```

**Version verification:** confirmed live against the npm registry this session (2026-09-21):
```
astro                 7.3.3
@astrojs/cloudflare   14.3.2
@astrojs/vue          7.0.3
vue                   3.5.43
wrangler              4.136.1
zod                   4.6.5
```
All are patch/minor bumps ahead of `.claude/CLAUDE.md`'s pins from five days prior — no
migration notes found for any of them (checked via `npm view <pkg> versions` diffing against
the pinned version; none introduced a major-version boundary).

## Package Legitimacy Audit

| Package | Registry | Age (this version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|--------------|---------|-------------|
| `astro` | npm | Published 2026-09-16, i.e. 5 days old for the specific `7.3.3` patch tag | 4,182,388/wk | github.com/withastro/astro | SUS (`too-new`) | **Heuristic false positive — approved.** The gate flags recency of the exact patch tag, not the package; `astro` has 4.18M weekly downloads and a verified official org repo. Per protocol, tag inline and require a `checkpoint:human-verify` before install regardless. |
| `@astrojs/cloudflare` | npm | Published 2026-09-16 | 661,679/wk | github.com/withastro/astro | SUS (`too-new`) | Same as above — heuristic false positive, `checkpoint:human-verify` required by protocol |
| `@astrojs/vue` | npm | Published 2026-09-16 | 167,072/wk | github.com/withastro/astro | SUS (`too-new`) | Same |
| `vue` | npm | Published 2026-09-17 | 12,112,486/wk | github.com/vuejs/core | SUS (`too-new`) | Same |
| `wrangler` | npm | Published 2026-09-21 (today) | 16,302,667/wk | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Same — Cloudflare ships `wrangler` patches very frequently; this is expected cadence, not a red flag |
| `zod` | npm | Published 2026-09-13 | 213,873,599/wk | github.com/colinhacks/zod | SUS (`too-new`) | Same (re-exported via `astro/zod`, not installed standalone) |
| `dependency-cruiser` (secondary/optional tool) | npm | Published 2026-09-20 | 2,841,146/wk | github.com/sverweij/dependency-cruiser | SUS (`too-new`) | Same — only relevant if the planner adopts the secondary `src/lib` check |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** all seven above, uniformly due to the "too-new" heuristic firing on very recent patch releases of extremely high-download, verified-repo packages. **This is very likely a heuristic false positive class**, not a supply-chain concern — every package has an official GitHub org repo and download counts in the hundreds-of-thousands to hundreds-of-millions per week. Per protocol, the planner must still insert a `checkpoint:human-verify` task before the install step so a human confirms the resolved tarball/version before it lands in the lockfile.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │         BUILD TIME (Node, CI)            │
                     │                                           │
  D1 REST API  ─────▶│  Content Loader (src/lib/server/d1-      │
  (fetch, token       │  client.ts) — the ONE module allowed     │
   from env)          │  to reach D1                             │
                     │        │                                  │
                     │        ▼                                  │
                     │  astro:content collections                │
                     │        │                                  │
                     │        ▼                                  │
                     │  astro build (Vite/Rollup)                │
                     │    ├─ prerendered .astro pages ──────┐    │
                     │    ├─ server-island endpoints ───┐   │    │
                     │    └─ [PLUGIN] buildEnd hook:    │   │    │
                     │       walk module graph from all │   │    │
                     │       page + island entrypoints, │   │    │
                     │       assert none import         │   │    │
                     │       d1-client.ts  ──FAIL BUILD  │   │    │
                     │                    if reached     │   │    │
                     │        │                          │   │    │
                     │        ▼                          ▼   ▼    │
                     │  KV render manifest write   Worker bundle  │
                     │  (manifest:<uuid> per       (islands +     │
                     │   article, via REST/        on-demand only,│
                     │   wrangler bulk put)         NO D1 binding)│
                     └─────────────────────────────────────────┘
                                      │
                                      ▼
                     ┌─────────────────────────────────────────┐
                     │         RUNTIME (Cloudflare edge)         │
                     │                                           │
  Reader request ───▶│  Transform Rule (dev host only):          │
                     │  X-Robots-Tag: noindex added to           │
                     │  EVERY response leaving the zone          │
                     │        │                                  │
                     │        ▼                                  │
                     │  run_worker_first: false                  │
                     │    ├─ static asset match? ──▶ served      │
                     │    │   directly, Worker NEVER invoked      │
                     │    └─ no match / server-island path ──▶   │
                     │        Worker (islands, actions) ──▶      │
                     │        env.KV / env.AI / env.CACHE only   │
                     │        (no env.DB — binding doesn't exist)│
                     └─────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── pages/                    # public routes; prerender=true by default (output:'static')
├── components/                # shared .astro/.vue components reachable from pages
├── islands/                   # server:defer island wrapper components (ARCH-03 scope)
├── content/                   # astro:content collection config (calls the Loader)
├── lib/
│   ├── server/
│   │   └── d1-client.ts       # THE ONLY module allowed to reach D1 (build-time only)
│   └── kv-manifest.ts         # render-manifest read/write helpers (build/render-time only)
├── middleware.ts               # ARCH-03 scope: must not import d1-client.ts
tools/
└── assert-no-d1.mjs            # the Vite/Rollup plugin implementing D-05/ARCH-02/ARCH-03
tests/
└── ci-fixtures/
    ├── page-with-d1-import.astro      # D-06 negative fixture #1
    └── island-with-d1-import.astro    # D-06 negative fixture #2
wrangler.jsonc                  # NO d1_databases entry — see Don't Hand-Roll
```

### Pattern 1: The D1-Import Assertion as a Rollup Module-Graph Walk

**What:** A Vite plugin (registered via `vite: { plugins: [...] }` in `astro.config.mjs`, or via
an integration's `astro:config:setup` hook calling `updateConfig({ vite: { plugins: [...] } })`)
that, in the `buildEnd` hook, calls `this.getModuleIds()` and, for each id,
`this.getModuleInfo(id)` to read `.importedIds` and `.dynamicallyImportedIds`. It performs a BFS
from every public entrypoint (every `.astro` file under `src/pages/**` not exporting
`prerender = true`, every file under `src/islands/**`, `src/middleware.ts`, and any API endpoint
under `src/pages/api/**`) and throws (causing the Rollup build to fail, which fails
`astro build`) if the BFS ever reaches `src/lib/server/d1-client.ts`.

**When to use:** This is the single mechanism satisfying ARCH-02 and ARCH-03 together, because
it operates on Astro's own already-resolved module graph — the same graph Vite used to decide
what actually ships — rather than a separate static-analysis pass that has to re-implement
Astro's `.astro`/`.vue` resolution rules.

**Why `buildEnd`, not `generateBundle`:** Rollup's own plugin-development docs state that
`importedIds` and `dynamicallyImportedIds` "will no longer change after `buildEnd`," so `buildEnd`
is the earliest point at which the graph is guaranteed complete and stable for every module —
`generateBundle`/`closeBundle` also work but add no benefit here. [CITED: rollupjs.org/plugin-development/, fetched directly this session]

**Example (skeleton, not copy-paste-verified against a real Astro build — flag for the planner
to prove against the tracer slice per D-02):**
```javascript
// tools/assert-no-d1.mjs
const FORBIDDEN = /\/src\/lib\/server\/d1-client\.ts$/;
const ENTRYPOINT_GLOBS = [
  'src/pages/**/*.astro',   // excluding prerender=true — filtered at runtime by reading exports
  'src/islands/**/*.astro',
  'src/middleware.ts',
];

export function assertNoD1Plugin() {
  return {
    name: 'assert-no-d1-import',
    buildEnd() {
      const moduleIds = this.getModuleIds ? [...this.getModuleIds()] : [];
      const entrypoints = moduleIds.filter((id) =>
        ENTRYPOINT_GLOBS.some((pattern) => matchGlob(id, pattern))
      );
      for (const entry of entrypoints) {
        const seen = new Set();
        const queue = [entry];
        while (queue.length) {
          const id = queue.pop();
          if (seen.has(id)) continue;
          seen.add(id);
          if (FORBIDDEN.test(id)) {
            this.error(
              `D1-import assertion violated: ${entry} transitively imports ${id}`
            );
          }
          const info = this.getModuleInfo(id);
          if (!info) continue;
          queue.push(...(info.importedIds ?? []));
          queue.push(...(info.dynamicallyImportedIds ?? []));
        }
      }
    },
  };
}
```
`this.error(...)` inside a Rollup hook throws and fails the build — this is standard Rollup
plugin-context behavior. [CITED: rollupjs.org/plugin-development/ — PluginContext error semantics]

**Astro integration wiring (verified pattern):**
```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { assertNoD1Plugin } from './tools/assert-no-d1.mjs';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'passthrough' },
  }),
  vite: {
    plugins: [assertNoD1Plugin()],
  },
});
```
[CITED: Context7 `/withastro/docs` — `output: 'static'`, `imageService` object form, and
`vite.plugins` are each confirmed verbatim from official docs snippets fetched this session]

### Pattern 2: Content Loader as the Single D1 Chokepoint

**What:** One hand-written `astro/loaders` Loader module (`src/lib/server/d1-client.ts`) is the
only code in the repository that ever calls the D1 REST API. Everything downstream — pages,
islands, the render manifest — consumes `astro:content` collection data, never the loader
directly.

**When to use:** Always, in this project. This is what makes the D-05 graph-walk cheap: instead
of detecting arbitrary "D1 usage" patterns (raw `fetch()` calls to
`api.cloudflare.com/.../d1/database/...`, a `cloudflare:workers` `env.DB` property access, etc.)
the check collapses to one question — "does any public entrypoint's module graph reach this one
file" — which is exactly what a reachability BFS answers cleanly.

**Consequence for `wrangler.jsonc`:** because D1 access never happens inside the Worker, the
Astro app's `wrangler.jsonc` should declare **no `d1_databases` binding at all**. This is
stronger than passing the CI check — it makes a runtime D1 read structurally impossible even if
someone tried, because `env.DB` would be `undefined` in the deployed Worker. Compare against the
existing Nuxt app's `wrangler.jsonc` [VERIFIED: 915tldr.com2/wrangler.jsonc:19-25 — `"d1_databases": [ { "binding": "DB", "database_name": "915tldr-db", "database_id": "552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77", ... } ]`], which *does* bind D1 because it's the pipeline/admin app, not the public one — do not copy that block into the new Astro app's config.

### Anti-Patterns to Avoid

- **Scanning `.astro` source files with grep or a generic AST tool for "D1" strings:** rejected
  by D-05 explicitly; also concretely wrong because it can't distinguish a real import from a
  comment/docstring, and this repo's own planning docs quote the banned patterns verbatim (a
  grep for `d1-client` would false-positive on this very RESEARCH.md if it were scanned).
- **Relying on `_headers` for the dev-host noindex requirement:** confirmed this session that
  `_headers` rules are explicitly scoped to static-asset responses and do not apply to
  Worker-generated ones [CITED: developers.cloudflare.com/workers/static-assets/headers/] — since
  server islands exist on this same architecture (Phase 8), a `_headers`-only approach would miss
  every on-demand response on `dev.915tldr.com`.
- **Setting `output: 'hybrid'`:** removed keyword as of Astro v5; not present anywhere in current
  official docs' config reference, which only documents `'static'` and `'server'`.
  [CITED: Context7 `/withastro/docs` configuration-reference.mdx]
- **Reading `Astro.locals.runtime.env`:** removed API as of `@astrojs/cloudflare` v13 / Astro 6;
  the official upgrade guide's own migration snippet shows the old line struck through in favor
  of `import { env } from 'cloudflare:workers'`. [CITED: Context7 `/withastro/docs`
  integrations-guide/cloudflare.mdx]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Detecting whether a module transitively imports another module | A custom static-analysis/AST walker that re-implements `.astro`/`.vue`/alias resolution | Rollup's own `this.getModuleInfo(id).importedIds`/`.dynamicallyImportedIds` from a Vite plugin's `buildEnd` hook | Vite/Astro have already done the hard part (resolving every kind of import Astro supports) by the time your plugin hook runs; re-deriving that resolution logic is exactly the "shallow AST scan" D-05 rejects, and it will drift out of sync with Astro upgrades |
| Percentile computation on D1 REST latency samples | A statistics library | Nearest-rank percentile, computed inline — the same method Phase 2's `measure-corpus.mjs` already used [VERIFIED: 915tldr.com2/docs/phase-02/corpus-measurements.md:23 — "percentiles computed in this script via nearest-rank (D1/SQLite has no percentile function)"] | Consistency with the project's own established measurement methodology; SQLite/D1 has no native percentile function so this was already solved once |
| Writing 42k KV manifest entries one HTTP call at a time | A hand-rolled retry/backoff loop calling `put()` per key | The KV bulk-write REST endpoint, up to 10,000 pairs per call, <100MB per request | Confirmed directly: "Write more than one key-value pair at a time with Wrangler or via the REST API. The bulk API can accept up to 10,000 KV pairs at once." [CITED: developers.cloudflare.com/kv/api/write-key-value-pairs/, fetched directly] — one bulk call per ~5 chunks instead of 42,000 individual round-trips |
| Injecting the deployed commit hash into the build | Shelling out to `git rev-parse` inside the build script and hoping the CI checkout has full history | Cloudflare Workers Builds' own injected `WORKERS_CI_COMMIT_SHA` environment variable | Officially documented, zero extra tooling, and matches what the platform actually deploys (a shallow-clone CI checkout can make `git rev-parse` return the wrong thing; the platform variable cannot) [CITED: developers.cloudflare.com/workers/ci-cd/builds/configuration/, fetched directly] |

**Key insight:** every "Don't Hand-Roll" item above exists because the platform (Rollup, D1,
Workers KV, or Workers Builds) already computed the exact fact the project needs and exposes it
through a documented API — the temptation in each case is to re-derive that fact independently
(via string scanning, a stats library, per-key writes, or `git` shell-outs) in a way that is
strictly worse and drifts out of sync with the platform's own behavior.

## Common Pitfalls

### Pitfall 1: Assuming the flat "300-second Worker CPU ceiling" applies to this project's cron

**What goes wrong:** Sizing the render step's location against a flat 300-second CPU budget
(the number carried in STATE.md's blockers list) when the actual ceiling for this project's
2-hour-interval cron is 15 minutes (900,000ms), or possibly even more if `limits.cpu_ms` can
still be configured upward from there — this session's fetch of Cloudflare's own limits table
did not fully disambiguate whether the interval-based Cron Trigger figures (30s/15min) are a
hard ceiling independent of `limits.cpu_ms`, or whether `limits.cpu_ms` still applies within
them.

**Why it happens:** The Workers platform limits page presents CPU time as two separate rows —
"CPU time per HTTP request" (default 30s, configurable to 5 min via `limits.cpu_ms`) and "CPU
time per Cron Trigger" (30s under 1hr interval, 15 min at 1hr+) — and it is easy to read the
HTTP-request row's 5-minute figure as the general ceiling that also applies to cron.
[CITED: developers.cloudflare.com/workers/platform/limits/, fetched directly this session — see
raw table quoted in Summary]

**How to avoid:** Treat the interval-based cron figure (15 min for this project's 2-hour cron) as
the number to design against, but confirm it empirically as part of D-01's measurement task:
deploy a trivial scheduled handler that deliberately burns CPU in a tight loop and observe at
what wall-clock/CPU-time point it is terminated, cross-checked against Workers Observability's
reported CPU time for that invocation.

**Warning signs:** A render-step design that pre-emptively assumes Queues fan-out is
*necessary* without first measuring real per-page render cost against the real (15-minute, not
300-second) ceiling — this could be over-engineering a problem that fits in a single cron
invocation.

### Pitfall 2: Treating "too-new" package-legitimacy flags as a blocking signal for mature ecosystems

**What goes wrong:** Every Core package in this phase's stack (`astro`, `@astrojs/cloudflare`,
`vue`, `wrangler`, `zod`) triggered a `SUS` verdict from the legitimacy gate purely because their
latest patch tag was published within the last several days — a normal release cadence for
actively-maintained, extremely high-download packages, not a supply-chain risk signal.

**Why it happens:** The "too-new" heuristic checks the *specific resolved version's* publish
date, not the package's overall age or reputation — a legitimate package with weekly patch
releases will trip this on every install.

**How to avoid:** Cross-check weekly download count and source-repo authenticity (all seven
packages here resolve to their project's official GitHub org) before treating a `SUS` verdict as
meaningful; still insert the `checkpoint:human-verify` the protocol requires, but the human check
should take seconds given the download/repo evidence already gathered here.

**Warning signs:** None specific to this phase — this is a one-time note so the planner doesn't
mistake seven false-positive flags for seven real problems.

## Runtime State Inventory

Not applicable — Phase 3 is greenfield (first code in this repo; no rename/refactor/migration).

## Common Pitfalls (continued)

### Pitfall 3: Believing `dependency-cruiser` alone satisfies ARCH-03

**What goes wrong:** Adopting `dependency-cruiser`'s `reachable: true` rule type as the *sole*
enforcement mechanism because it directly supports exactly the "transitive reachability" concept
D-05 asks for, without noticing it cannot parse `.astro` files at all.

**Why it happens:** `dependency-cruiser`'s `reachable`/`viaNot` rule shape [CITED: WebSearch
result quoting github.com/sverweij/dependency-cruiser/blob/develop/doc/rules-reference.md] is a
close conceptual match to D-05's requirement, which makes it tempting to reach for as the whole
solution.

**How to avoid:** Use it only for the sub-graph of plain `.ts`/`.js` files (e.g., verifying
`src/lib/kv-manifest.ts` never imports `src/lib/server/d1-client.ts` either), and rely on the
custom Rollup/Vite plugin (Pattern 1) for anything that touches `.astro`/`.vue` island files —
which is the ARCH-03-mandated coverage the grep/AST-tool approach explicitly cannot provide.

**Warning signs:** A CI green light from `dependency-cruiser` alone, with island files silently
excluded from its `includeOnly`/`exclude` config because the tool errored on `.astro` syntax and
someone worked around the error by excluding the directory instead of routing island coverage
through the Rollup plugin.

## Code Examples

### Render Manifest Entry Shape (D-04)

```typescript
// One KV key per article: `manifest:<uuid>`
interface ManifestEntry {
  articleId: string;              // matches D1 articles.id (uuid)
  spanishCounterpartId: string | null;  // D-04 mandatory field — null until Phase 6 backfill
  contentHash: string;            // hash of (summary + title + tags) from the source row
  renderVersion: string;          // template/schema version that produced this entry
  renderedAt: string;             // ISO 8601 timestamp
  buildHash: string;              // short commit hash (see Build-Stamp Plumbing)
  category: string;               // denormalised, avoids a second D1 read at render time
  publishedAt: number;            // epoch seconds, denormalised
}
```
This shape is a direct translation of D-04's five bullet points — no external source needed
beyond CONTEXT.md itself; flagged `[ASSUMED]` only insofar as the exact field *names* are this
researcher's choice, not a locked decision. The planner/executor is free to rename fields as long
as all five D-04 categories are represented.

### KV Bulk Write for Manifest Population

```bash
# Populate/refresh the render manifest in batches of <=10,000 pairs
wrangler kv bulk put manifest-entries-batch-1.json --namespace-id <RENDER_MANIFEST_KV_ID>
```
Where `manifest-entries-batch-1.json` is `[{ "key": "manifest:<uuid>", "value": "<JSON string>" }, ...]`.
[CITED: developers.cloudflare.com/kv/api/write-key-value-pairs/, fetched directly — "Write more
than one key-value pair at a time with Wrangler or via the REST API. The bulk API can accept up
to 10,000 KV pairs at once."]

### Build-Stamp Plumbing (OPS-05/OPS-06)

```javascript
// astro.config.mjs (excerpt) — bake the commit SHA into a virtual module at build time
const commitSha = process.env.WORKERS_CI_COMMIT_SHA ?? 'local-dev';
const buildTimestamp = new Date().toISOString();
```
`WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH` are injected automatically by Workers Builds'
CI/CD system; `CI=true` and `WORKERS_CI=1` distinguish a Builds run from local dev.
[CITED: developers.cloudflare.com/workers/ci-cd/builds/configuration/, fetched directly this
session]. For a `wrangler deploy` run from a local machine (not Workers Builds CI) this variable
will be absent — fall back to `git rev-parse --short HEAD` locally only, never in CI, to avoid
the shallow-clone mismatch risk noted in Don't Hand-Roll.

Expose the same two values two ways to satisfy OPS-05/OPS-06 from one source of truth:
- `/version.json` — a static file emitted at build time containing `{ "commit": commitSha, "builtAt": buildTimestamp }`
- Public footer — rendered from the same build-time constants via a virtual module (see Pattern:
  Passing build-time configuration via virtual module, confirmed via Context7
  `/withastro/docs` adapter-reference.mdx) so both surfaces are guaranteed to agree, addressing
  success criterion 4's "both report... the same".

### D1 REST Pagination Measurement Harness (D-01 measurement #3)

```javascript
// tools/measure-d1-pagination.mjs — run against production D1, following the Phase 2 pattern
const PAGE_SIZE = 500; // well under the 1,200 req/5min Cloudflare API rate limit for ~84 pages
const latencies = [];
let offset = 0;
while (true) {
  const start = performance.now();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: 'SELECT id, title, summary, category, published_at, tags FROM articles WHERE status = ? ORDER BY id LIMIT ? OFFSET ?',
        params: ['processed', PAGE_SIZE, offset],
      }),
    }
  );
  const json = await res.json();
  latencies.push(performance.now() - start);
  const rows = json[0]?.results ?? [];
  if (rows.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}
// nearest-rank percentile, same method as 915tldr.com2/docs/phase-02/corpus-measurements.md
```
The `data[0]?.results` response shape is confirmed from the same session's prior work.
[VERIFIED: 915tldr.com2/docs/phase-02/d1-access.md:69-71 — "the JSON output nests rows one level
deep under `<top-level-array>[0].results`, exactly as `scripts/sync-prod-to-dev.sh` already
assumes (`data[0]?.results`)"]. Keyset pagination (`WHERE id > ?`) is preferable to
`LIMIT/OFFSET` for very deep pages per general D1 guidance [CITED: WebSearch summary of D1
best-practices discussion — cursor-based over offset-based pagination] but at ~84 pages total for
the full corpus, `OFFSET` is unlikely to show a measurable difference; note this as a secondary
check if p95 looks worse than expected.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `output: 'hybrid'` | `output: 'static'` + per-route `prerender = false` | Astro v5 | `'hybrid'` is a removed keyword, not deprecated-but-working — configuring it errors or is silently ignored depending on version |
| `Astro.locals.runtime.env` | `import { env } from 'cloudflare:workers'` | `@astrojs/cloudflare` v13 / Astro 6 | Old API removed entirely |
| `imageService` implicit default | `imageService: 'cloudflare-binding'` as the *explicit* default | `@astrojs/cloudflare` v14.2.0 | A fresh install now silently takes a live Cloudflare-account dependency at build+runtime unless overridden |
| `<ViewTransitions />` | `<ClientRouter />` from `astro:transitions` | Astro v5 | Not used in this phase but relevant to the same major-version boundary (Phase 8) |

**Deprecated/outdated:** the WebSearch result claiming server islands "require `output: 'server'`"
is outdated/imprecise per the authoritative Astro adapter-reference doc (`preserveBuildServerDir`
exists specifically to support server islands inside a `'static'` build) — do not follow that
blog's guidance; `output: 'static'` + an adapter is the correct, current configuration for this
project.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact skeleton code for the Rollup `buildEnd` plugin (`tools/assert-no-d1.mjs`) is untested against a real Astro build — the *APIs it calls* (`this.getModuleIds`, `this.getModuleInfo`, `this.error`) are confirmed from official Rollup docs, but the glob-matching against Astro's actual resolved module ids (which include Astro's internal virtual-module prefixes) is not verified | Pattern 1 | The skeleton may need adjustment once run against a real build (e.g. matching `.astro`-compiled ids may require inspecting `info.meta` or a different id shape than a raw file path) — this is exactly why D-06 requires permanent CI fixtures, which will catch a broken matcher immediately |
| A2 | Whether the Cron Trigger CPU ceiling (30s / 15min by interval) can be raised further by `limits.cpu_ms`, or whether it is a hard ceiling independent of that config knob | Common Pitfalls #1, Summary | If it's a hard ceiling, D-01's cron-worker option is capped at 15 min regardless of configuration; if `limits.cpu_ms` still applies within it, the effective ceiling could differ — either way this must be resolved by the empirical CPU-burn test recommended in Pitfall 1, not assumed from the docs table alone |
| A3 | `dependency-cruiser` lacks `.astro` support | Don't Hand-Roll, Alternatives Considered, Pitfall 3 | Sourced from a WebSearch summary of the tool's own docs, not a direct fetch of its extensions list — low risk of being wrong (the claim matches the tool's well-known JS/TS/Vue/Svelte scope) but not independently re-verified against the library's source this session |
| A4 | Manifest entry field *names* (`articleId`, `spanishCounterpartId`, etc.) | Code Examples | Purely this researcher's naming choice to satisfy D-04's five required categories — no risk beyond bikeshedding; the planner/executor should feel free to rename |
| A5 | Astro's `security.serverIslandBodySizeLimit` default (1 MB) is unrelated to the encrypted-props 2048-byte URL limit noted in ISL-05, but both numbers appear in the same official doc page and could be confused | Code Examples (indirect) | Low risk this phase (islands ship in Phase 8), flagged so the two limits aren't conflated later |

## Open Questions

1. **Does `limits.cpu_ms` in `wrangler.jsonc` interact with the interval-based Cron Trigger CPU
   ceiling, or is the 30s/15min figure fixed regardless of that setting?**
   - What we know: Cloudflare's limits page lists both a general "CPU time per HTTP request"
     row (configurable 30s→5min via `limits.cpu_ms`) and a separate "CPU time per Cron Trigger"
     row (30s/15min by interval, no "default" language suggesting configurability).
   - What's unclear: whether setting `limits.cpu_ms: 300000` in the render Worker's config
     changes the cron-specific ceiling, raises it further, or has no effect on scheduled
     invocations at all.
   - Recommendation: resolve empirically as part of D-01's measurement task (Pitfall 1) before
     finalizing the render-step location — this is a "measure, don't guess" item exactly like the
     three numbers CONTEXT.md already calls for, and belongs in the same measurement pass.

2. **Where, precisely, should the new Astro app's `wrangler.jsonc` Worker be named, and does it
   need its own KV namespace for the render manifest, or should it share the existing `KV`
   namespace (`bc7910383eae457d96ade270fb74ff58`) that the Nuxt app already binds?**
   - What we know: the existing Nuxt app's Worker is named `915tldr` and owns KV namespaces `KV`
     and `CACHE` [VERIFIED: 915tldr.com2/wrangler.jsonc:3, 28-38]; per ROADMAP Phase 12, the
     public site eventually serves from `915tldr.com` "on the Astro worker" while the Nuxt app
     moves to `admin.915tldr.com` — implying two distinct Worker deployments coexist for most of
     the project.
   - What's unclear: whether the render manifest should live in a brand-new KV namespace scoped
     to the Astro app (cleaner separation, avoids any risk of key collisions with the Nuxt app's
     existing `KV` namespace usage) or reuse the existing one.
   - Recommendation: create a new, dedicated KV namespace for the render manifest
     (e.g. `915tldr-render-manifest`) rather than reuse `KV` — this is a cheap, reversible choice
     (Cloudflare allows 1,000 namespaces per account) and avoids any ambiguity about which app
     owns which keys during the Phase 3–12 period when both apps run simultaneously.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Astro build, all tooling | ✓ (per `package.json` `engines.node >=24`, already enforced in this repo) | — | — |
| pnpm | Package manager | ✓ (`packageManager: pnpm@11.26.0` in `package.json`) | 11.26.0 | — |
| Cloudflare API token (`CLOUDFLARE_API_TOKEN`) | D1 REST reads, KV bulk writes, wrangler auth | ✓ — confirmed present and valid in this execution environment per Phase 2's own record [VERIFIED: 915tldr.com2/docs/phase-02/d1-access.md:30-33 — "Authenticated via the `CLOUDFLARE_API_TOKEN` environment variable (confirmed present and valid... via `wrangler whoami`... scoped to account `5b8888b49c34148054bdec527c05dc27`)"] | — | — |
| `astro`, `@astrojs/cloudflare`, `@astrojs/vue`, `vue`, `wrangler` | Entire phase | Not yet installed in this repo (`node_modules/.bin` currently only has `playwright`, `woff2_compress.js`) — this phase is the first to install them | See Standard Stack | None needed — install is in-scope |
| Cloudflare Workers Builds CI (vs. local `wrangler deploy`) | `WORKERS_CI_COMMIT_SHA` for build-stamp | Unconfirmed whether this project's deploy pipeline uses Workers Builds (git-connected CI/CD) or local/manual `wrangler deploy` | — | If local-only, fall back to `git rev-parse --short HEAD` at deploy time and document that the footer/version.json reflect the *deploying developer's* checkout, not a CI-verified commit |

**Missing dependencies with no fallback:** none — every dependency above is either already
present or is the phase's own install target.

**Missing dependencies with fallback:** Workers Builds CI environment (see row above) — falls
back to local `git rev-parse` if this project deploys via local `wrangler deploy` rather than
git-connected Workers Builds. The planner should confirm which deploy path this project actually
uses (check for a Cloudflare dashboard git connection / existing `.github/workflows`) before
committing to `WORKERS_CI_COMMIT_SHA` as the sole source.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.63.0 (already installed, used for Phase 1's mockup tests) + Node's built-in `node --test` (used for Phase 1's unit tests, see `test:unit` script) |
| Config file | `playwright.config.ts` (exists); no unit-test config file — `node --test` glob is inlined in the `package.json` script |
| Quick run command | `node --test "design/tests/unit/**/*.test.mjs"` (existing pattern) — new Phase 3 unit tests should follow the same glob convention under a new `src/`-adjacent test directory |
| Full suite command | `pnpm test:unit && pnpm test:e2e` (existing scripts) |

No dedicated Astro/Vite build-test framework exists yet in this repo — Phase 3 is the first to
need one (for the D-06 negative fixtures, which must run the actual `astro build` — or at minimum
invoke the Rollup plugin directly against fixture files — and assert a non-zero exit / thrown
error).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| ARCH-02 | Build fails on any D1-reaching public route | integration (build-invocation) | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` (asserts `astro build` against the page fixture exits non-zero) | ❌ Wave 0 |
| ARCH-03 | Build fails on any D1-reaching island file | integration (build-invocation) | Same test file, second case against the island fixture | ❌ Wave 0 |
| ARCH-04/05/06 | Astro config shape is correct | unit / static grep | `grep -rn "Astro.locals.runtime.env\|output: 'hybrid'" src/ astro.config.mjs` exits 0 findings; a snapshot test asserts `astro.config.mjs`'s resolved config object matches expected shape | ❌ Wave 0 |
| REND-06 | Manifest entry contains all D-04 fields | unit | `node --test tests/unit/manifest-schema.test.mjs` | ❌ Wave 0 |
| OPS-02 | Edge noindex header present | manual/smoke (cannot be asserted from a build-time test — depends on live zone config) | `curl -I https://dev.915tldr.com \| grep -i x-robots-tag` | N/A — post-deploy smoke check, not a CI unit test |
| OPS-05/06 | Version surfaces agree | unit | `node --test tests/unit/build-stamp.test.mjs` asserting `/version.json` and footer HTML derive from the same constant | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/ci-fixtures/**/*.test.mjs tests/unit/**/*.test.mjs`
- **Per wave merge:** full suite including a real `astro build` invocation against the fixture
  tree
- **Phase gate:** full suite green, plus the OPS-02 manual `curl -I` smoke check (cannot be
  automated in CI since it depends on live Cloudflare zone configuration outside version control)

### Wave 0 Gaps

- [ ] `tests/ci-fixtures/page-with-d1-import.astro` — the D-06 negative fixture for ARCH-02
- [ ] `tests/ci-fixtures/island-with-d1-import.astro` — the D-06 negative fixture for ARCH-03
- [ ] `tests/ci-fixtures/assert-no-d1.test.mjs` — the test harness invoking `astro build` (or the
      plugin directly) against both fixtures and asserting rejection
- [ ] `tests/unit/manifest-schema.test.mjs` — new, no existing coverage
- [ ] `tests/unit/build-stamp.test.mjs` — new, no existing coverage
- [ ] Framework install: none needed beyond what Phase 1 already installed (`@playwright/test`,
      Node's built-in test runner); `astro`/`@astrojs/cloudflare` themselves are the Standard
      Stack install, not a test-framework install

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This phase ships no auth surface |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | Partial — yes | The entire phase *is* an access-control mechanism (D1 unreachability from public code); enforced by the build-time assertion, not a runtime authorization check |
| V5 Input Validation | Deferred | No user input accepted in this phase (forms arrive Phase 10); `astro/zod` is pinned for that future need, not exercised here |
| V6 Cryptography | Deferred | `ASTRO_KEY` (server-island prop encryption) is Phase 8 scope, not this phase — no islands with props ship yet |
| V13 API / Configuration | Yes | Cloudflare API token handling (D1 REST, KV bulk writes) — must never be logged or committed, matching the project's own established pattern from Phase 2 [VERIFIED: 915tldr.com2/docs/phase-02/d1-access.md:33-34 — "No token value is recorded anywhere in this file, in git history, or in any log captured by this task — per OPS-11"] |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| A future contributor adds a `d1_databases` binding to the Astro app's `wrangler.jsonc` "just to try something," reintroducing a live D1 path the CI graph-walk doesn't cover (because the binding itself isn't a module-graph edge) | Elevation of Privilege / Tampering | The D-05 assertion catches *code* reaching D1, not config; add a secondary, trivial CI check that greps `wrangler.jsonc` for `d1_databases` and fails if present — cheap, deterministic, and closes the one gap the module-graph walk cannot see by construction |
| Cloudflare API token leaking into a client-bundled build artifact (e.g. accidentally referenced from an island component instead of only the Node-side Content Loader) | Information Disclosure | Centralizing D1/token access behind `src/lib/server/d1-client.ts` (Pattern 2) and asserting its unreachability from public entrypoints (Pattern 1) mitigates this as a side effect — if the token-holding module can't be reached from the client bundle, the token can't ship in it either |
| Transform Rule for the dev-host noindex header silently removed or mis-scoped during an unrelated zone-config change (it lives outside version control per D-08's accepted tradeoff) | Tampering (of policy, not code) | OPS-02's own verification method — `curl -I` checked as part of routine deploys, not just once — is the correct standing mitigation; the planner should schedule this check to recur, not run it once at sign-off |

## Sources

### Primary (HIGH confidence)
- Context7 `/withastro/docs` — queried for: `output: 'static'` config, per-route `prerender`,
  server-island `server:defer`, `preserveBuildServerDir`, `imageService` object form and its
  v14.2.0 default change, `cloudflare:workers env` import replacing `Astro.locals.runtime.env`,
  `astro:config:setup` / `updateConfig({ vite: { plugins } })` integration pattern. All snippets
  quoted verbatim from official Astro documentation source files.
- `developers.cloudflare.com/workers/platform/limits/` — fetched directly (raw markdown via
  `curl`) this session, 2026-09-21. CPU time, subrequest, static-asset-file-count, and duration
  limits tables quoted verbatim.
- `developers.cloudflare.com/kv/platform/limits/` — fetched directly this session. Value size,
  key size, write-rate, and bulk-write limits quoted verbatim.
- `developers.cloudflare.com/d1/platform/limits/` — fetched directly this session. Bound
  parameter limit (100), max row/string/BLOB size (2MB), queries-per-invocation, and SQL
  statement length quoted verbatim.
- `developers.cloudflare.com/fundamentals/api/reference/limits/` — fetched directly this session.
  General Cloudflare REST API rate limit (1,200 requests/5 minutes) that governs D1 REST API
  calls from the build-time Node loader.
- `developers.cloudflare.com/kv/api/write-key-value-pairs/` — fetched directly this session. KV
  bulk-write endpoint (up to 10,000 pairs/call) and same-key write-rate guidance quoted verbatim.
- `developers.cloudflare.com/workers/ci-cd/builds/configuration/` — fetched directly this
  session. `WORKERS_CI_COMMIT_SHA`/`WORKERS_CI_BRANCH`/`CI`/`WORKERS_CI` default environment
  variables quoted verbatim.
- `rollupjs.org/plugin-development/` — fetched directly this session. `this.getModuleInfo(id)`
  field semantics and `buildEnd`-hook completeness guarantee quoted verbatim.
- `915tldr.com2/wrangler.jsonc` (this session's `Read`, lines 3, 19-25, 28-38) — existing Worker
  name, D1 binding, KV namespaces, cron schedule (`0 */2 * * *`).
- `915tldr.com2/docs/phase-02/d1-access.md` (this session's `Read`) — proven D1 REST/wrangler
  access pattern, `CLOUDFLARE_API_TOKEN` auth confirmation, JSON response shape
  (`data[0]?.results`).
- `915tldr.com2/docs/phase-02/corpus-measurements.md` (this session's `Read`) — live corpus row
  count (41,896 as of 2026-09-19, ahead of ROADMAP's cited 41,233), nearest-rank percentile
  methodology precedent.
- npm registry, `npm view <pkg> version`, live query 2026-09-21 — `astro`, `@astrojs/cloudflare`,
  `@astrojs/vue`, `vue`, `wrangler`, `zod` current versions.
- `gsd-tools query package-legitimacy check` — legitimacy verdicts for all seven packages
  installed or referenced by this phase.

### Secondary (MEDIUM confidence)
- WebSearch summary of `developers.cloudflare.com/rules/transform/response-header-modification/`
  and related community pages — Transform Rules execute "at the edge on the way back to the
  client," after caching; not independently cross-checked against a second primary source this
  session, but consistent with D-08's own stated rationale.
- WebSearch summary of `dependency-cruiser`'s rules-reference (`reachable`/`viaNot` rule shape)
  and its lack of `.astro` file support.

### Tertiary (LOW confidence)
- A single WebSearch/blog result (nickyt.co) claiming server islands "require `output: 'server'`"
  — contradicted by the authoritative Astro adapter-reference doc (`preserveBuildServerDir`) and
  treated as outdated/imprecise in this research, not relied upon.
- General Vite plugin `resolveId`/module-graph WebSearch results — used only to confirm the
  *existence* of the technique before verifying its concrete API surface directly against
  Rollup's own docs (which is the source actually cited in Pattern 1).

## Metadata

**Confidence breakdown:**
- Standard stack (Astro config, versions): HIGH — every config claim confirmed verbatim against
  official Astro docs via Context7, every version confirmed live against the npm registry
- Cloudflare platform limits (KV, D1, Workers CPU, Builds env vars): HIGH — every number in this
  document was fetched directly from the current official Cloudflare docs pages this session, not
  recalled from training data
- D1-import assertion mechanism (Pattern 1): MEDIUM — the underlying Rollup APIs are officially
  documented and verified, but the specific skeleton plugin is a synthesis, not a proven,
  battle-tested recipe; D-06's permanent CI fixtures exist precisely to catch any gap between this
  design and Astro's real build output
- Render-step location inputs (D-01): MEDIUM — the cron CPU ceiling figure is now sourced from
  official docs (up from an unsourced "300s" assumption in STATE.md), but Open Question 1 (does
  `limits.cpu_ms` interact with the interval-based ceiling) remains genuinely unresolved and must
  be measured, not assumed, before the render-step decision is finalized

**Research date:** 2026-09-21
**Valid until:** 30 days for the Cloudflare platform-limits figures (stable, but Cloudflare does
revise limits); 14 days for the exact npm package versions (Astro/Wrangler ship frequently per
this project's own CLAUDE.md observation — re-verify versions immediately before the install
task if more than two weeks have passed since this research)

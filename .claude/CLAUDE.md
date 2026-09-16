<!-- GSD:project-start source:PROJECT.md -->

## Project

**915 TLDR — v2 Rebuild**

915 TLDR is a local news aggregator for El Paso. It pulls RSS from three local outlets,
summarises each article with an LLM, tags and categorises it, detects cross-source
duplicates, and publishes the result as a free, ad-free community news site. It is built in
the open — every change is documented publicly on `/changelog`.

v2 is a rebuild of the **public site and its delivery architecture**, not of the pipeline
behind it. The data (41,233 articles, 435 MB of D1) does not move.

**Core Value:** **Zero D1 reads on the public request path.** Not "fewer" — architecturally zero, enforced
structurally at build time. Everything else in this rebuild is negotiable; this is not.

### Constraints

- **Performance**: D1 reads per public request = **0**. Hard fail above 0. Enforced by a
  build-time assertion that no public route can import the D1 binding.

- **Performance**: D1 reads/day < 2,000,000 (hard fail > 5,000,000); Worker CPU < 5ms/request;
  KV reads ≤ 1/request.

- **Performance**: LCP < 1.5s, INP < 100ms, CLS < 0.05, FCP < 1.0s (mobile p75, field).
  Release-blocking, not aspirational.

- **Accessibility**: WCAG 2.2 AA fully met; Lighthouse accessibility and SEO must be 100.
  AAA is not claimed — 7:1 contrast everywhere is incompatible with a colour-forward editorial
  design, and claiming it would be false.

- **Budget**: No operation spending > $1 runs without explicit prior approval and an estimate.
  No bulk corpus operation runs without a dry run reporting row count and projected cost.
  **All bulk backfills use the Batch API** (50% discount, applies to text and image models).

- **Budget**: Total rebuild spend ~$10 one-time (image backfill) + ~$7.44 (summary
  re-processing, batched) + ~$1.49 (Spanish backfill, batched) + tier 3 heroes (to be measured).

- **Tech stack**: Astro 7 + `@astrojs/vue` + VueUse on Cloudflare Workers. Nuxt app retained
  for pipeline/admin. No NuxtHub (sunset 2025-12-31) — direct Cloudflare bindings only.

- **Tech stack**: Sharp does not run on Workers. Image optimisation happens at build time in
  Node; any on-demand path uses Cloudflare Images. Getting this wrong ships broken images —
  and the adapter default works *against* you here (see `imageService` in Key Decisions).

- **Budget**: The OpenAI account hit a **$0 balance** and returned HTTP 429
  `credit_balance_exhausted` before being refunded on 2026-09-16 (~$19.91, auto-reload on).
  Planned OpenAI spend for this rebuild (~$7.44 re-processing + ~$1.49 Spanish + tier 3
  images) fits, but with little headroom. Balance is a monitored line in the daily routine,
  not an assumption.

- **Platform**: Workers Static Assets caps at 100,000 files per version (Paid plan).
  Wrangler ≥ 4.34.0 required.

- **Platform**: D1 allows a maximum of **100 bound parameters per statement** — verified
  empirically 2026-09-15 (100 succeeds, 101 fails with `SQLITE_ERROR`).

- **Platform**: OpenAI image rate limits are per-minute image counts (5 IPM at Tier 1 up to
  250 IPM at Tier 5). Binding constraint for any bulk image work, ahead of cost.

- **Compatibility**: Nine months of indexed URLs must keep resolving — `/[category]/[slug]-[uuid]`
  carries over unchanged. `/rss.xml` preserved.

- **Migration**: Zero-risk by construction. v2 is additive and read-only against production
  data; v1 keeps serving throughout. Rollback is a DNS/route change.

- **Dependencies**: Three RSS sources fixed for the duration — a changing source mix would
  confound budget validation.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `astro` | **7.3.2** (npm, published 2026-09-08) | Static site generator + island architecture | Matches the constraint already fixed in PROJECT.md. Astro 7's Vite 8 + Rust compiler ship faster builds, which matters directly here: a hybrid archive that regenerates ~2,000 recent articles every cron cycle needs a fast build, not a slow one. Pin the exact patch, don't float `^7`, since Astro ships frequently (7.3.0 → 7.3.2 in five days this month) and a silent minor bump mid-project is the kind of drift this rebuild exists to prevent. |
| `@astrojs/cloudflare` | **14.3.1** (npm) | Adapter for Cloudflare Workers — on-demand routes, server islands, R2/KV/image bindings | Required even though the site is overwhelmingly static: server islands (`server:defer` for weather, "updated Xm ago") are on-demand rendered and Astro's own docs state an adapter is required to use `server:defer` at all, independent of the rest of the site's output mode. |
| `wrangler` | **4.132.0** (npm) — floor **>= 4.34.0**, hard requirement | Build/deploy CLI, Workers Static Assets, D1 REST access for migrations | 4.34.0 is the *minimum* to get the 100,000-file Paid-plan asset ceiling (see Workers Static Assets section) — below it, Wrangler silently enforces the old 20,000 cap regardless of plan. Current is 4.132.0; there is no reason to pin below latest here since Wrangler is a build-time-only CLI, not a runtime dependency. |
| `@astrojs/vue` | **7.0.2** (npm) | Vue island support for Astro | Matches PROJECT.md's fixed choice (`@astrojs/vue` + VueUse). Current major (7.x) tracks Astro 7's integration API; no known breaking incompatibility with Astro 7.3. |
| `vue` | **3.5.42** (npm) | Vue 3 runtime for islands | Peer dependency of `@astrojs/vue`. Vue 3.5.x is the current stable line — no need for a 4.x (none exists at time of research). |
| `@vueuse/core` | **14.4.0** (npm) | Composition utilities for interactive islands (search, filter, theme toggle, scroll effects) | Current major. **See Pitfalls note below — this is the one place in the stack with a real, still-open gotcha, not a solved problem.** |
| `zod` | **4.6.5** (npm) — but see note | Input validation for Astro Actions (contact form, subscribe form) | Astro re-exports Zod from `astro/zod` — import from there, not a separate `zod` dependency, to guarantee version alignment with whatever Zod version Astro Actions itself validates against internally. Zod 4's top-level validators (`z.email()`) replace the deprecated Zod 3 chain style (`z.string().email()`); use the new style throughout. |

### D1 Access at Build Time (no package — hand-rolled, see Architecture note)

| Approach | Package | Verdict |
|----------|---------|---------|
| Cloudflare D1 REST API, called directly with `fetch()` | none — raw HTTP | **Recommended.** Official, documented endpoint: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`, `Authorization: Bearer {CLOUDFLARE_API_TOKEN}`, JSON body `{ sql, params }` or `{ batch: [...] }`. Paginate with `LIMIT/OFFSET` or keyset pagination across 41k+ rows inside the loader's `load()` method. |
| `drizzle-orm` D1 HTTP driver at *query* time | `drizzle-orm` | **Does not exist.** `drizzle-kit` (the migration CLI) has a `d1-http` driver for `migrate`/`push`/`studio`, but `drizzle-orm`'s runtime client (`drizzle-orm/d1`) is Workers-binding-only — it takes a live `D1Database` binding, which a Node build script does not have. Do not assume Drizzle solves this; it solves migrations, not build-time reads. |
| Shell out to `wrangler d1 execute --remote --json` | none — child_process | Viable fallback, reuses Wrangler's own auth (no separate API token to manage), but slower and clumsier for many paginated queries against 41k rows. Use the REST API instead unless there's a reason to avoid managing a Cloudflare API token in CI. |

### Fonts

| Tool | Purpose | Notes |
|------|---------|-------|
| `glyphhanger` | Manual variable-font subsetting to the used character set (Latin + Spanish diacritics) | Well-established, still current. Run at build time, commit or generate the subset `woff2` as a build step. |
| `fontaine` (unjs) | Auto-generates metric-compatible `@font-face` fallback blocks (`size-adjust`, `ascent-override`, etc.) computed via `capsize` against a system fallback | Framework-agnostic post-build plugin; not Astro-specific but works as a Vite plugin, which Astro sits on top of. **Confidence LOW on this whole section — WebSearch only, not cross-checked against Context7/official docs.** Verify current recommended integration path for a Vite/Astro (not Nuxt) project before committing. |

## Answers to the Specific Questions

### 1. Astro 7 — version, adapter, static vs hybrid, server islands

- **Astro 7.3.2**, actively releasing (patch cadence of days, not weeks).
- **`@astrojs/cloudflare` 14.3.1.**
- **`output: 'hybrid'` no longer exists.** As of Astro v5, `hybrid` was merged into `static`. There are now only two output modes: `'static'` (default — everything prerendered by default, any route can opt out per-route with `export const prerender = false`) and `'server'` (everything on-demand by default, opt into prerendering per-route). **For this project: use `output: 'static'`** (the merged hybrid/static mode) — it is the correct mode for "mostly static, a few on-demand routes/islands," which is exactly this project's shape. Do not configure `output: 'hybrid'`; it will error or be silently ignored depending on the Astro version — it is a removed keyword, not a deprecated-but-working one.
- **Server islands: `server:defer` directive**, e.g. `<Weather server:defer />`. Requires an adapter installed (confirmed — `@astrojs/cloudflare` satisfies this) even though the rest of the site is prerendered. This is the mechanism for weather, 7-day forecast, and "updated Xm ago" per PROJECT.md.

### 2. Content layer loaders — flareLoader and the current idiomatic pattern

### 3. Workers Static Assets

- **File ceiling: 100,000 per Worker version on Paid/Workers-for-Platforms plans; 20,000 on Free.** Confirmed directly against Cloudflare's official changelog post (2025-09-02, "Increased static asset limits for Workers").
- **Minimum Wrangler version: 4.34.0.** Below that version, Wrangler enforces the old 20,000-file cap *regardless of plan* — this is a client-side Wrangler restriction, not a server-side account restriction, so upgrading Wrangler alone (no plan change) unlocks the higher ceiling on Paid.
- **Currently installed: 4.132.0** — comfortably above the floor.
- **`wrangler.jsonc` config:**
- **Coexistence with a Worker script:** `assets.directory` + `main` can both be set in the same `wrangler.jsonc`. `run_worker_first: false` (the default) serves matched static files directly without invoking the Worker at all — correct for this project, since the entire point is that static asset requests never touch a Worker (and therefore never touch D1). `run_worker_first` can also take a glob array (e.g. `["/api/*", "!/api/docs/*"]`) for selective invocation, which is the mechanism to route server-island requests to the Worker while everything else stays a pure asset hit.

### 4. `astro:assets` — Image/Picture, remote sources, Sharp vs Cloudflare Images

- **`<Image>` / `<Picture>` from `astro:assets`** are current and unchanged in shape. `<Picture formats={['avif','webp']} alt="...">` emits a `<picture>` with `<source>` per format plus a raster `<img>` fallback with explicit `width`/`height` already set — this is the CLS defense PROJECT.md requires, and it's automatic, not something to hand-roll.
- **Remote images (58% of articles, sourced from KVIA/KTSM) require explicit allow-listing.** Two mechanisms, both current: `image.domains: ["kvia.com", "ktsm.com"]` (exact hostname allow-list) or `image.remotePatterns: [{ protocol: "https" }]` (pattern-based, broader). An unlisted remote source throws a `RemoteImageNotAllowed` build error — this is enforced, not advisory.
- **Sharp vs Cloudflare Images — this is the one place where the commonly-assumed pattern is now outdated.** `@astrojs/cloudflare`'s `imageService` option, **as of v14.2.0, defaults to `'cloudflare-binding'`** — meaning the *default* behavior on a fresh `@astrojs/cloudflare` install is to use the Cloudflare Images binding for transforms **both at build-time prerendering and at runtime**, not Sharp. This contradicts the common (and until recently correct) assumption that "Sharp doesn't run on Workers, so image work happens in Node at build time" is automatically what you get — it now requires an explicit config choice.

### 5. `@astrojs/vue` + VueUse — versions and known issues

- `@astrojs/vue` **7.0.2**, `vue` **3.5.42**, `@vueuse/core` **14.4.0** — all current per npm registry.
- **Known, still-relevant issue class (not fixed by version bumps, it's structural to islands architecture):** VueUse composables that read browser-only state at `setup()` time — `useDark`, `useMediaQuery`/color-scheme detection, `useColorMode`, anything touching `window`/`matchMedia`/`localStorage` synchronously — produce a hydration mismatch inside `client:load` or `client:visible` Vue islands, because Astro's prerender pass has no `window` and the client then hydrates against different initial state. This is documented against Astro's GitHub issue tracker (`withastro/astro#6425`) and is a class of bug, not a single fixed issue — it will recur with any new VueUse composable used the naive way. **Directly relevant to this project's theme toggle island** (light/dark, PROJECT.md §5.3). **Mitigation:** guard reads with `typeof window !== 'undefined'`, or hydrate the affected island with `client:only="vue"` instead of `client:load` (forfeits SSR of that specific island, acceptable for a theme toggle since it has no meaningful server-rendered content anyway), or read the browser state inside `onMounted()` rather than at `setup()`/`ref()` initialization.

### 6. Astro Actions + Zod 4 — contact and subscribe forms

- Import Zod from **`astro/zod`**, not a bare `zod` dependency — guarantees version alignment with what Astro Actions validates against internally.
- **Zod 4 syntax matters here**: use top-level `z.email()`, not the Zod 3-style chained `z.string().email()` (still works in Zod 4 as a deprecated alias in some cases, but the top-level form is current and should be the default in new code).
- Client-side: `import { actions } from 'astro:actions'`, call `actions.subscribe(formData)`, then `import { navigate } from 'astro:transitions/client'` for a client-side redirect on success without a full page reload — pairs with `ClientRouter` (below).
- Both forms are **writes** — this is architecturally clean against the zero-D1-reads constraint, since Actions run server-side (on-demand) but a form POST is not "the public request path" the constraint is about (that constraint is about GET/read routes serving pages, not about accepting a write).

### 7. `ClientRouter` / View Transitions

### 8. R2 and KV bindings from an Astro/Workers route

- `cf` object (geo/request metadata): read directly off the incoming `Request`, not `Astro.locals.runtime.cf`.
- `caches` API: the global `caches` object directly, not `Astro.locals.runtime.caches`.
- `ExecutionContext`: now at `Astro.locals.cfContext`, replacing `Astro.locals.runtime.ctx`.

### 9. Self-hosted variable fonts — subsetting and `size-adjust` fallbacks

- `glyphhanger` for subsetting to the actual character set (Instrument Serif + Source Serif 4, Latin + Spanish diacritics — PROJECT.md §5.2) — well-established, low risk.
- `fontaine` (unjs) for auto-generated metric-compatible fallback `@font-face` blocks — plausible and commonly cited in 2025-2026 web-perf writing, but not verified against Astro/Vite-specific integration docs in this pass.
- The Safari `size-adjust`-yes/`ascent-override`-no claim is a single WebSearch result, not independently confirmed against caniuse.com or MDN — **do not ship a fallback strategy that depends on `ascent-override`/`descent-override` working cross-browser without re-verifying this claim directly first.**

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hand-written Content Loader against D1 REST API | `flareLoader` / Flare CMS as published | Only if 915tldr.com's data layer were rebuilt on top of Flare CMS's own schema and REST API — explicitly out of scope per PROJECT.md ("migrating data" is a non-goal). Not applicable here. |
| `imageService: { build: 'compile', runtime: 'passthrough' }` (Sharp at build) | `imageService: 'cloudflare-binding'` (the new default) | If the team later wants on-the-fly image variants without a build step (e.g. arbitrary crop/format negotiation per request), at the cost of introducing a live Cloudflare-account dependency into what is otherwise a deterministic, offline-buildable static site. Not recommended given the zero-runtime-dependency philosophy elsewhere in this rebuild. |
| D1 REST API called directly with `fetch()` | Shell out to `wrangler d1 execute --remote --json` | If CI environment cannot securely hold a standalone `CLOUDFLARE_API_TOKEN` but does have `wrangler` already authenticated (e.g. via OIDC in a Cloudflare-native CI product). Otherwise the REST API is simpler to paginate and reason about for 41k+ rows. |
| `client:only="vue"` for the theme-toggle island | `client:load` + defensive `typeof window` guards | If SSR-rendering *some* visual state of the toggle (e.g. showing a sun/moon icon matching a `Cookie`/`Accept-Language`-derived guess) is valuable enough to accept the hydration-mismatch risk and code the guards carefully. For a simple toggle, `client:only` is simpler and the FOUC is negligible. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `output: 'hybrid'` | Removed keyword as of Astro v5 — merged into `'static'`. Configuring it is stale, not just non-idiomatic. | `output: 'static'` with per-route `export const prerender = false` where needed. |
| `<ViewTransitions />` | Renamed to `<ClientRouter />` in the Astro v5 upgrade — a breaking change, not a soft deprecation. | `import { ClientRouter } from 'astro:transitions'`. |
| `Astro.locals.runtime.env` / `event.context.cloudflare.env` | Removed in `@astrojs/cloudflare` v13 / Astro 6. The latter was never even an Astro pattern (it's Nuxt/NuxtHub shape, and NuxtHub is separately banned project-wide). | `import { env } from 'cloudflare:workers'`. |
| `drizzle-orm/d1` (the Workers-binding driver) for a *build-time* Node script | Requires a live `D1Database` binding that only exists inside a running Worker — not available to `astro build` running in CI/Node. | Raw `fetch()` against Cloudflare's D1 REST API, or `wrangler d1 execute --remote --json` shelled out. |
| Relying on `@astrojs/cloudflare`'s default `imageService` (`cloudflare-binding`) without setting it explicitly | Silently introduces a live Cloudflare-account dependency into the build step, contradicting this project's already-decided "Sharp at build time in Node" approach. | Explicit `imageService: { build: 'compile', runtime: 'passthrough' }`. |
| `flareLoader` as a drop-in for this project's D1 schema | It's a different product's client against a different product's REST API (Flare CMS), and the npm package isn't even publicly published. Treating it as "the" pattern to copy will waste a phase. | Hand-written custom `Loader` (see code sample above). |
| `zod` as a standalone dependency for Actions input | Risks version skew against whatever Zod version Astro Actions itself expects/re-exports. | `import { z } from 'astro/zod'`. |

## Stack Patterns by Variant

- Fall back to exporting a SQLite snapshot via `wrangler d1 export --remote` to a local file at cron/build time, then reading it locally with `node:sqlite` or `better-sqlite3` inside the loader instead of paginated HTTP calls. Slower to set up, much faster to iterate once set up, and avoids Cloudflare API rate limits on a 41k-row full rebuild.
- This is a fallback to validate, not the default recommendation — the REST API path is simpler and should be tried first.
- Ship `size-adjust` unconditionally and treat `ascent-override`/`descent-override`/`line-gap-override` as enhancement-only, verified with a visual regression check in Safari specifically during Phase 9.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `astro@7.3.2` | `@astrojs/cloudflare@14.3.1` | Both current as of 2026-09-16; no known incompatibility flagged in this research pass. |
| `astro@7.3.2` | `@astrojs/vue@7.0.2` | Major-version-aligned (both track Astro's own major); current. |
| `@astrojs/vue@7.0.2` | `vue@3.5.42`, `@vueuse/core@14.4.0` | Current; VueUse hydration gotcha (see §5) is structural to islands architecture, not a version-specific bug — will not be "fixed" by future patch bumps alone. |
| `@astrojs/cloudflare@14.3.1` | `wrangler>=4.34.0` | Adapter itself doesn't enforce this, but the 100,000-file Workers Static Assets ceiling does — below 4.34.0, deploys silently cap at 20,000 files regardless of plan, which this project's ~41k-and-growing article set will exceed quickly. |
| `astro/zod` (re-export) | `zod@4.6.5` (registry current) | Import via `astro/zod`, not the bare package, to avoid skew — see "What NOT to Use." |

## Sources

- Context7 `/withastro/docs` (official Astro documentation mirror, High source reputation, benchmark 83.66) — queried for: Astro 7/output modes/Cloudflare adapter config/server islands, Content Loader API, `astro:assets` Image/Picture/remote patterns, Astro Actions + Zod, `ClientRouter`/View Transitions, Cloudflare adapter env/bindings migration. Confidence: MEDIUM per this project's classify-confidence tier for the `context7` provider (not independently re-verified against a second source per item, but sourced from Astro's own docs repo).
- npm registry (`npm view <pkg> version`, `npm view astro versions --json`, live query 2026-09-16) — `astro`, `@astrojs/cloudflare`, `@astrojs/vue`, `@astrojs/db`, `@vueuse/core`, `vue`, `wrangler`, `zod` current versions. Treat as HIGH confidence — this is the package registry itself, not a secondary source.
- Cloudflare official changelog, `developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/` — Workers Static Assets file-count ceilings (100,000 Paid / 20,000 Free) and Wrangler 4.34.0 floor. Fetched directly, not paraphrased from a blog.
- Cloudflare official docs, `developers.cloudflare.com/workers/static-assets/binding/` — `wrangler.jsonc` assets/binding/`run_worker_first` config shape.
- Cloudflare official API reference, `developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/` — D1 REST API endpoint, auth, request/response shape.
- WebSearch (no single authoritative source; confidence MEDIUM-to-LOW per item as marked inline) — flareLoader/Flare CMS characterization, `@astrojs/vue`/VueUse hydration-mismatch issue (`withastro/astro#6425`), Drizzle D1-HTTP driver scope (migrations-only, not runtime queries), font-subsetting tooling (`glyphhanger`, `fontaine`, `fontfetch`) and the unverified Safari `size-adjust` claim.
- `orm.drizzle.team/docs/sqlite/connect-cloudflare-d1` (WebFetch) — confirmed no runtime `drizzle-orm` D1-HTTP client exists; Workers-binding-only.
- `flarecms.dev` (WebFetch, two pages) — returned no substantive content on the Astro-loader integration specifics; the `flareLoader` characterization above rests on WebSearch results referencing the GitHub repo and package description, not a directly fetched doc page. **This is the weakest-sourced claim in this document and is exactly the one PROJECT.md/PRD leans on by name — recommend the Phase 2 spike confirm it firsthand rather than trusting this research alone.**

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

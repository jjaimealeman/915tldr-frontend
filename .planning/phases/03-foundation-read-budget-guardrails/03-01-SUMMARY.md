---
phase: 03-foundation-read-budget-guardrails
plan: 01
subsystem: infra
tags: [astro, cloudflare-workers, d1, kv, wrangler, vite-plugin, tracer]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "Approved stylesheet (design/mockups/style.css), approved article DOM shape (design/mockups/article.html), approved fonts"
  - phase: 02-content-quality-grounding
    provides: "Production D1 REST auth/response-unwrapping convention (915tldr.com2/docs/phase-02/d1-access.md), OPS-11 token-handling rule"
provides:
  - "Buildable Astro 7 app in this repo (astro.config.mjs, wrangler.jsonc, package.json scripts)"
  - "The D1-import assertion (tools/assert-no-d1.mjs) wired into the real astro build via a Vite plugin"
  - "The single D1 chokepoint module (src/lib/server/d1-client.ts) — build-time-only REST reads"
  - "The render-manifest KV module (src/lib/kv-manifest.ts) and a dedicated KV namespace (915tldr-render-manifest)"
  - "The article route on the preserved /[category]/[slug]-[uuid] URL shape"
  - "The Phase 1 approved stylesheet and fonts, ported byte-for-byte into the app"
  - "A proven, corrected wrangler.jsonc shape for this Astro/adapter version (no main field, assets.directory: dist/client, session: false)"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07]

actuals:
  tokens: 58801
  tasks: 2
  commits: 1

tech-stack:
  added: ["astro@7.3.3", "@astrojs/cloudflare@14.3.2", "@astrojs/vue@7.0.3", "vue@3.5.43", "wrangler@4.136.3"]
  patterns:
    - "Single D1 chokepoint module (src/lib/server/d1-client.ts) — every other module reaches D1 only transitively through it, so a module-graph walk can police the whole app from one forbidden-target string"
    - "Rollup/Vite buildEnd plugin for build-time-only structural assertions, registered via vite.plugins so it runs inside astro build's own pipeline rather than as a separate skippable script"
    - "One KV key per manifest entry (manifest:<uuid>), never a blob, never sharded"
    - "prerenderEnvironment: 'node' required explicitly — @astrojs/cloudflare defaults prerendering to a Miniflare/workerd sandbox even under output: 'static'"

key-files:
  created:
    - astro.config.mjs
    - wrangler.jsonc
    - tools/assert-no-d1.mjs
    - src/lib/server/d1-client.ts
    - src/lib/kv-manifest.ts
    - src/lib/slug.ts
    - src/layouts/Base.astro
    - "src/pages/[category]/[slug].astro"
    - src/styles/global.css
    - tests/tracer/tracer.test.mjs
    - .dev.vars (gitignored, not committed)
  modified:
    - package.json
    - .gitignore
    - pnpm-lock.yaml

key-decisions:
  - "wrangler pinned to 4.136.3 (current latest at install time), not the plan's researched 4.136.1 — human-approved deviation; wrangler is a build-time-only CLI with floor >=4.34.0, so a newer patch carries no architectural risk."
  - "915tldr-render-manifest is a namespace dedicated to this app, created fresh rather than reusing the Nuxt pipeline app's existing KV/CACHE namespaces, per 03-RESEARCH.md Open Question 2."
  - "session: false set explicitly on the Cloudflare adapter — this app uses no Astro Sessions API, and leaving the default on would silently provision an unwanted SESSION KV binding and worker bundle."
  - "wrangler.jsonc's assets.directory corrected to dist/client (not dist) and its main field removed entirely, both discovered only by running a real build against this exact Astro/adapter version pair — the plan's assumed shape (dist/_worker.js/index.js, assets.directory: dist) does not match reality for @astrojs/cloudflare 14.3.2 with preserveBuildClientDir/preserveBuildServerDir."

patterns-established:
  - "Pattern 1 (module-graph D1-import assertion): buildEnd hook, this.getModuleIds()/this.getModuleInfo(), normalise ids (strip \\0 prefix and ?query suffix) before comparison, BFS from every public entrypoint, this.error() on reaching the forbidden module, this.error() again if the candidate set is empty across the whole build (not per-pass)."
  - "Pattern 2 (single D1 chokepoint): src/lib/server/d1-client.ts is the only module allowed to import fetch-to-D1 code; every other module that needs a row calls a function exported from here."
  - "Prerendered pages (no export const prerender = false) are exempt from the D1-import assertion, because their D1 access runs once at build time in Node and is never bundled into the deployed Worker. Islands and middleware get no such exemption."

requirements-completed: [ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, REND-06]

coverage:
  - id: D1
    description: "pnpm build reads one real article row from production D1 over the REST API, at build time in Node, and emits a prerendered HTML file carrying that row's headline text"
    requirement: "ARCH-04"
    verification:
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#tracer: one real article renders and is recorded > exactly one article HTML file was emitted"
        status: pass
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#tracer: one real article renders and is recorded > the built HTML carries the live headline"
        status: pass
    human_judgment: false
  - id: D2
    description: "The build writes a manifest:<uuid> KV entry for that article containing all eight D-04 fields, including spanishCounterpartId"
    requirement: "REND-06"
    verification:
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#tracer: one real article renders and is recorded > the KV manifest entry agrees with the D1 row"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/assert-no-d1.mjs runs inside the real astro build and completes without error on a clean tree, proving it is wired in and loaded"
    requirement: "ARCH-02"
    verification:
      - kind: integration
        ref: "pnpm build (stdout: '[assert-no-d1] entrypoints found: ...' logged on every buildEnd pass, exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Astro app's wrangler.jsonc declares no D1 binding, so env.DB is structurally undefined in the deployed Worker"
    requirement: "ARCH-06"
    verification:
      - kind: unit
        ref: "node -e comment-stripped grep for d1_databases against wrangler.jsonc, exits 0 (plan acceptance criteria script)"
        status: pass
    human_judgment: false
  - id: D5
    description: "design/mockups/style.css is present at src/styles/global.css byte-for-byte identical to the Phase 1 approved original"
    requirement: "ARCH-05"
    verification:
      - kind: other
        ref: "cmp -s design/mockups/style.css src/styles/global.css"
        status: pass
    human_judgment: false
  - id: D6
    description: "wrangler.jsonc's real deploy shape (assets.directory, main field, session config) is correct for this exact Astro 7.3.3 / @astrojs/cloudflare 14.3.2 build output, not just for `astro build` succeeding"
    verification: []
    human_judgment: true
    rationale: "pnpm build and pnpm test:tracer prove the build succeeds and the tracer's own file-system walk finds the article under dist/, but neither exercises `wrangler deploy` or a live Worker request against dist/client as the asset root — that first real deploy is 03-05's job. Flagging this here so it is not silently assumed proven by the build-only tests in this plan."

duration: ~10min (this continuation only — excludes the prior session's work up through the KV-scope blocker)
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 1: One Real Article, End to End Summary

**Live D1 row → Node build-time REST read → prerendered `/weather/...-<uuid>` page through Phase 1's approved stylesheet → `manifest:<uuid>` KV entry, with the D1-import Vite-plugin guardrail already running inside `astro build`.**

## Performance

- **Duration:** ~10 min (this continuation session; resumed after a prior run's scaffold was already built and build-verified, blocked only on a missing `Workers KV Storage:Edit` token scope)
- **Completed:** 2026-09-22T19:30:38Z
- **Tasks:** 2 (Task 1 package-legitimacy checkpoint — approved in the prior session; Task 2 tracer — completed this session)
- **Files modified:** 19 (16 new, 3 modified) + 2 changelog files

## Accomplishments
- Created the `915tldr-render-manifest` KV namespace (id `3c92531f94294fcc94006455f433885f`), confirmed no collision with the Nuxt app's existing `915tldr-kv`/`915tldr-cache` namespaces
- Wired the real namespace id into `wrangler.jsonc` and a gitignored `.dev.vars`, removing the stale "PENDING" blocker comment
- Got `pnpm build` to a clean exit 0 against Astro 7.3.3 + `@astrojs/cloudflare` 14.3.2, fixing three build-blocking issues the prior scaffold hadn't yet hit (stale `main` field, unwanted auto-provisioned `SESSION` KV binding, a bundler bug that dropped a frontmatter-local `slugify()` function)
- Proved the full architecture end-to-end: one real production article (`201187fa-6484-4516-99d5-7e41da203323`, category `weather`) read from D1, rendered to `dist/client/weather/.../index.html` with its real headline text, and its 8-field manifest entry written to and read back from the real KV namespace
- Confirmed the D1-import assertion (`tools/assert-no-d1.mjs`) runs on every `astro build` pass and holds correctly against a build that legitimately imports the D1 client from a prerendered page
- Confirmed Phase 1's full 43-test suite still passes unmodified

## Task Commits

1. **Task 1: Package legitimacy gate** — approved by the human in the prior session (checkpoint, no code commit)
2. **Task 2: End-to-end "one real article renders and is recorded"** - `81a9723` (feat)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `astro.config.mjs` - Astro config: static output, Cloudflare adapter with explicit two-key `imageService`, `prerenderEnvironment: 'node'`, `session: false`, `@astrojs/vue`, `assertNoD1Plugin()` wired into `vite.plugins`
- `wrangler.jsonc` - Worker config: no `main` field, no D1 binding, one KV binding (`RENDER_MANIFEST` → `915tldr-render-manifest`), `assets.directory: "dist/client"`
- `tools/assert-no-d1.mjs` - `assertNoD1Plugin()` — the D1-import structural guardrail, already present from the prior session and correct against a real build (no changes needed this session)
- `src/lib/server/d1-client.ts` - `queryD1()`, `fetchLatestArticle()`, `fetchArticleById()` — the one module permitted to reach D1
- `src/lib/kv-manifest.ts` - `ManifestEntry`, `buildManifestEntry()`, `putManifestEntry()`, `getManifestEntry()`
- `src/lib/slug.ts` - **new this session.** `slugify()` extracted out of `[slug].astro`'s frontmatter after the bundler silently dropped it there (see Deviations)
- `src/layouts/Base.astro` - Page chrome reproducing `design/mockups/article.html`
- `src/pages/[category]/[slug].astro` - The one tracer route; now imports `slugify` from `src/lib/slug.ts` instead of declaring it locally
- `src/styles/global.css`, `public/fonts/*.woff2` - Byte-for-byte ports of the Phase 1 approved stylesheet and fonts
- `tests/tracer/tracer.test.mjs` - End-to-end `node:test` proof, unmodified from the prior session and passing as written
- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` - Five packages installed; `build`/`dev`/`preview`/`deploy`/`test:tracer` scripts added; `test:unit` glob widened
- `.gitignore` - `dist/`, `.astro/`, `.wrangler/`, `.dev.vars`, `.env`
- `.dev.vars` - gitignored, not committed; holds `RENDER_MANIFEST_KV_NAMESPACE_ID` for local builds

## Decisions Made
- Used `wrangler@4.136.3` (current latest) rather than the plan's researched `4.136.1` — a build-time-only CLI dependency, no architectural risk, user's own choice within the Task 1 approval.
- Kept the dedicated `915tldr-render-manifest` KV namespace rather than reusing an existing Nuxt-app namespace, per the plan's explicit instruction and 03-RESEARCH.md Open Question 2.
- Loaded `.dev.vars` into the shell environment (`set -a; source .dev.vars; set +a`) before every `pnpm build`/`pnpm test:tracer` invocation in this session, rather than relying on Wrangler's Miniflare `.dev.vars` auto-loading — because `prerenderEnvironment: 'node'` deliberately bypasses the Miniflare sandbox that auto-loading depends on, so the build's `process.env` is the literal host shell environment. **This matters for CI/deploy setup in 03-05**: whatever runs `astro build` there must export `RENDER_MANIFEST_KV_NAMESPACE_ID` into its own process environment directly; it cannot rely on `.dev.vars` being picked up automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `prerenderEnvironment` defaults to `'workerd'`, not Node, even under `output: 'static'`**
- **Found during:** Task 2 (prior session; already fixed and present in the scaffold this session inherited)
- **Issue:** `@astrojs/cloudflare` >=13.1.0 defaults build-time prerendering to a simulated Miniflare/workerd sandbox. `process.env` reads inside `getStaticPaths()` throw even though the host shell has the variable set, contradicting 03-RESEARCH.md Pattern 2's premise ("the Content Loader ... runs once, in Node, during `astro build`").
- **Fix:** `prerenderEnvironment: 'node'` set explicitly in `astro.config.mjs`.
- **Files modified:** `astro.config.mjs`
- **Verification:** `pnpm build` succeeds and `d1-client.ts`'s `process.env.CLOUDFLARE_ACCOUNT_ID` read resolves.
- **Committed in:** `81a9723`

**2. [Rule 1 - Bug] The D1-import assertion's blanket "every page under `src/pages/**` is forbidden" rule was wrong**
- **Found during:** Task 2 (prior session)
- **Issue:** A prerendered page's frontmatter legitimately imports `d1-client.ts` — that code runs once at build time and is never bundled into the Worker. The plan's own Pattern 1 prose anticipated this carve-out but the naive literal reading did not implement it.
- **Fix:** `tools/assert-no-d1.mjs` exempts pages lacking `export const prerender = false` from the entrypoint set (`isPrerenderExempt`).
- **Files modified:** `tools/assert-no-d1.mjs`
- **Verification:** Real build against the tracer's own prerendered page produces `entrypoints found: 0 (candidates: 1, 1 prerender-exempt)` — correctly exempted, not a false positive.
- **Committed in:** `81a9723`

**3. [Rule 1 - Bug] `astro build` runs multiple bundler passes with different module universes**
- **Found during:** Task 2 (prior session)
- **Issue:** A per-pass "zero entrypoints matched → fail" check false-fails, because the Cloudflare adapter's own worker-entry bundling pass legitimately has zero page-shaped candidates in a project with no islands/middleware yet.
- **Fix:** Accumulate candidate counts across the whole build via a `process.on('exit')` guard rather than failing inside any single `buildEnd` call.
- **Files modified:** `tools/assert-no-d1.mjs`
- **Verification:** `pnpm build` completes with 3 `[assert-no-d1]` log lines across passes, no false failure.
- **Committed in:** `81a9723`

**4. [Rule 1 - Bug] Production D1 schema doesn't match the plan's assumed `articles` columns**
- **Found during:** Task 2 (prior session)
- **Issue:** No `category`/`tags` columns exist directly on `articles` — they live in join tables (`article_categories`→`categories` where `is_primary=1`; `article_tags`→`tags`, `GROUP_CONCAT`'d). The manifest/URL key is `articles.uuid` (TEXT), not `articles.id` (INTEGER PK). `published_at` is epoch **seconds** (INTEGER), not an ISO string or milliseconds.
- **Fix:** `d1-client.ts`'s `ARTICLE_SELECT` joins the real tables; `[slug].astro` multiplies `published_at * 1000` before constructing a `Date`.
- **Files modified:** `src/lib/server/d1-client.ts`, `src/pages/[category]/[slug].astro`
- **Verification:** Tracer test's live D1 read and rendered `<time datetime>` both check out against the real row.
- **Committed in:** `81a9723`

**5. [Rule 3 - Blocking] `wrangler.jsonc`'s `main` field pointed at a file this build never produces**
- **Found during:** Task 2 (this session — first real `pnpm build` after the KV scope was granted)
- **Issue:** `"main": "dist/_worker.js/index.js"` is the pre-Astro-6 convention. `astro build` failed immediately at Vite config resolution: "The provided Wrangler config main field ... doesn't point to an existing file."
- **Fix:** Removed the `main` field entirely. Astro's own docs ("Configure wrangler.jsonc for static sites") show no `main` entry at all for a static site with no `server:defer` islands, which this tracer is.
- **Files modified:** `wrangler.jsonc`
- **Verification:** `pnpm build` proceeds past config resolution.
- **Committed in:** `81a9723`

**6. [Rule 2 - Missing Critical] `@astrojs/cloudflare` auto-provisions an unwanted `SESSION` KV binding**
- **Found during:** Task 2 (this session)
- **Issue:** Build log printed `Enabling sessions with Cloudflare KV with the "SESSION" KV binding` — the adapter auto-enables Astro's Sessions API and injects a second, unrequested KV binding into the emitted worker config the moment any KV namespace exists in `wrangler.jsonc`. This project uses no Sessions API and the extra binding is unaccounted-for surface.
- **Fix:** `session: false` set explicitly in the Cloudflare adapter config.
- **Files modified:** `astro.config.mjs`
- **Verification:** Rebuild no longer logs the sessions-enabled line; `dist/client/wrangler.json`'s auto-generated `kv_namespaces` no longer includes `SESSION`.
- **Committed in:** `81a9723`

**7. [Rule 1 - Bug] Real build output lands in `dist/client/`, not directly in `dist/`**
- **Found during:** Task 2 (this session)
- **Issue:** `wrangler.jsonc`'s `assets.directory: "dist"` would, on a real deploy, point the Worker's static-asset binding at a directory containing only `client/` and `server/` subfolders — no site files directly under `dist/`. The adapter's `preserveBuildClientDir`/`preserveBuildServerDir` features split output this way even for a fully static build.
- **Fix:** `assets.directory` corrected to `"dist/client"`. Corroborated by the adapter's own auto-generated `dist/client/wrangler.json`, whose `assets.directory` is `"."` (relative to itself).
- **Files modified:** `wrangler.jsonc`
- **Verification:** File tree inspection (`find dist -maxdepth 2`) confirms the shape; acceptance-criteria scripts still pass since they check for `RENDER_MANIFEST`/absence of `d1_databases`, not the directory value specifically — flagged as coverage item D6 for 03-05 to prove against a real `wrangler deploy`.
- **Committed in:** `81a9723`

**8. [Rule 1 - Bug] A frontmatter-local `slugify()` function was silently dropped by the bundler**
- **Found during:** Task 2 (this session)
- **Issue:** `[slug].astro`'s frontmatter declared `function slugify(title) {...}` at the top level, called only from `getStaticPaths()`. Astro 7.3.3's rolldown-based bundler compiled the chunk with the `getStaticPaths` export and the call site intact but omitted the function body entirely, producing a runtime `ReferenceError: slugify is not defined` during static-path generation. Inspecting the compiled chunk (`dist/server/.prerender/chunks/_slug__*.mjs`) confirmed the function was simply absent from output — every other frontmatter symbol (imports, `getStaticPaths`, the component body) compiled correctly.
- **Fix:** Extracted `slugify()` into its own module, `src/lib/slug.ts`, imported normally. Also hardened its diacritics-stripping regex from a literal combining-character range (`/[̀-ͯ]/g`, prone to encoding corruption when typed/copied) to the standard Unicode escape (`/[̀-ͯ]/g`).
- **Files modified:** `src/lib/slug.ts` (new), `src/pages/[category]/[slug].astro`
- **Verification:** `pnpm build` completes and emits the expected slugified URL path (`el-paso-faces-level-3-flash-flood-risk-amid-heavy-rain-forecast-201187fa-6484-4516-99d5-7e41da203323`).
- **Committed in:** `81a9723`

---

**Total deviations:** 8 auto-fixed (6 Rule 1 bugs, 1 Rule 2 missing-critical, 1 Rule 3 blocking) across the prior and current session; none required a Rule 4 architectural decision or a new checkpoint.
**Impact on plan:** All auto-fixes were necessary for `pnpm build`/`pnpm test:tracer` to pass at all, or for `wrangler.jsonc` to describe a config that would actually work on a real `wrangler deploy`. No scope creep — every fix stayed inside this task's own file set (`files_modified` plus one new small utility module).

## Issues Encountered
None beyond the deviations documented above — all were found and resolved within this task's normal fix-attempt budget (no task exceeded 3 auto-fix attempts).

## User Setup Required
None further. The `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` env vars and the token's `Workers KV Storage:Edit` scope — the two `user_setup` items this plan declared — are both already satisfied in this execution environment. `.dev.vars` (gitignored) holds `RENDER_MANIFEST_KV_NAMESPACE_ID` for future local builds in this same environment; a new environment (e.g. CI) will need that same value set as `915tldr-render-manifest`'s id, `3c92531f94294fcc94006455f433885f`, either via its own `.dev.vars` or an exported environment variable (see Decisions Made above — `.dev.vars` is not auto-loaded under `prerenderEnvironment: 'node'`).

## Next Phase Readiness
- 03-02 (permanent CI guard, negative fixtures for `tools/assert-no-d1.mjs`) can proceed directly — the plugin's exported `normalizeId`/`isCandidate`/`isEntrypoint`/`isForbidden`/`assertNoD1Plugin` surface is stable and proven against a real build.
- 03-03 (build-stamp module) has a known placeholder to replace: `Base.astro`'s footer `<p data-build>build 0000000 · 2026-09-16</p>` line.
- 03-04 (manifest schema expansion) has two known placeholders to replace: `renderVersion: '0'` (literal, needs the exported schema-version constant) and `spanishCounterpartId: null` (population strategy still an open one-way decision, correctly not invented here).
- 03-05 (edge/deploy config) should treat coverage item **D6** as its first order of business: this plan proves `astro build` produces correct output and `tools/assert-no-d1.mjs` holds, but **no plan yet has run a real `wrangler deploy` against this `wrangler.jsonc`** — the `assets.directory: "dist/client"` correction found here is inferred from the adapter's own generated config and the build's file tree, not from a successful live deploy. Also carry forward: whatever runs `astro build` in CI must set `RENDER_MANIFEST_KV_NAMESPACE_ID` (and the Cloudflare credentials) directly in its process environment — `.dev.vars` alone is not sufficient under `prerenderEnvironment: 'node'`.
- No blockers remain from this plan. The package-legitimacy and KV-token-scope gates are both fully resolved.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 11 created/modified files listed above verified present on disk. Task 2's commit hash `81a9723` verified present in `git log --oneline --all`. No missing items.

## Correction Note (T-03-02a security remediation, appended, not rewriting the above)

This summary's `patterns-established` and `provides` sections describe `src/lib/server/d1-client.ts`
as "the single D1 chokepoint module" protected by `tools/assert-no-d1.mjs`. That claim was true for
D1 access specifically, but this plan also created `src/lib/kv-manifest.ts` (KV render-manifest
access) OUTSIDE `src/lib/server/`, reading `CLOUDFLARE_API_TOKEN` directly at four call sites with
no structural guard coverage — the module-graph guard above forbade only the exact filename
`src/lib/server/d1-client.ts`, not a directory, so this sibling credential-holding module was never
in its forbidden set. A later security audit ran the real guard against synthetic on-demand
page/island fixtures importing `kv-manifest.ts` and found them accepted (control case correctly
rejected, proving the gap was scope, not a broken walk). No production exposure existed at the time
this plan was completed — Phase 3 had no real on-demand route or island yet — but it would have
opened silently with Phase 4's server islands. Fixed in the T-03-02a remediation: `kv-manifest.ts`
moved to `src/lib/server/kv-manifest.ts`, and the guard now forbids the whole `src/lib/server/`
directory. Full detail: `docs/phase-03/render-manifest.md`'s "Guard enforcement" section.

---
phase: 04-static-generation-templates-seo
plan: 06
subsystem: infra
tags: [cloudflare-workers, wrangler, kv, seo, redirects, security, tdd]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-01's manifest schema v2 (slug field) and articlePath()/UUID_RE/CATEGORY_SLUG_RE/ARTICLE_SLUG_RE from src/lib/article-url.ts; 04-02's Base layout and ArticleCard component; 03-02's assert-no-d1.mjs D1-import guard and its 03-VALIDATION.md 90-second fixture-suite convention"
provides:
  - "This project's first Cloudflare Worker (src/worker.ts): at most one KV read, zero D1 reads, running only on a static-asset miss"
  - "src/lib/article-redirect.ts — pure, unit-tested extractArticleUuid()/resolveRedirect() with an open-redirect mitigation (Location built only from validated manifest fields)"
  - "wrangler.jsonc wired for navigation-safe Worker routing (assets_navigation_has_no_effect, not_found_handling, html_handling) — plus a corrected deploy invocation (wrangler deploy --config wrangler.jsonc) required for the adapter to actually bundle a custom Worker on a fully static Astro site"
  - "tools/assert-no-d1.mjs extended to src/worker.ts, with tests/ci-fixtures/assert-no-d1.test.mjs Case 7/8 providing the ACTUAL live enforcement for that file (the Rollup-based live guard cannot see it during a real build — documented as KNOWN LIMITATION #2)"
  - "src/pages/404.astro + 404-index.json.ts — D1-free, suggestion-bearing 404 page with a same-build-consistency guarantee"
  - "public/_redirects — D-11/D-12 legacy-route redirects"
affects: [04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 12758
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Worker fetch handlers stay pure-logic-free: all decision logic (uuid extraction, redirect validation, open-redirect mitigation) lives in a plain, independently-unit-tested module (article-redirect.ts); the Worker itself only wires one KV read and builds the Response — keeps the 5ms-CPU public request path trivially small and testable without a Miniflare/workerd runtime"
    - "tests/ci-fixtures/assert-no-d1.test.mjs's buildRealGraph(): a synthetic-fixture test suite can ALSO drive the real checker against REAL repository files by absolute path (not just fixture stand-ins) when a file's live Rollup coverage is structurally unavailable — re-reads the real file's own current imports on every run, so it never goes stale the way a hardcoded snapshot would"
    - "@astrojs/cloudflare 14.3.2 marks the entry-Worker build environment devOnly (excluded from the deployed config) whenever Astro's computed buildOutput is fully 'static' — independent of a custom main's value. A project mixing a fully static Astro site with a custom Worker for asset-miss handling MUST deploy via `wrangler deploy --config wrangler.jsonc` (bypassing the adapter's auto-redirected `dist/client/wrangler.json`), not a bare `wrangler deploy`."

key-files:
  created:
    - src/lib/article-redirect.ts
    - src/worker.ts
    - src/pages/404.astro
    - src/pages/404-index.json.ts
    - public/_redirects
    - tests/unit/article-redirect.test.mjs
    - tests/unit/worker.test.mjs
    - tests/unit/not-found.test.mjs
    - tests/ci-fixtures/worker-with-kv-import.ts
  modified:
    - wrangler.jsonc
    - package.json
    - tools/assert-no-d1.mjs
    - tools/check-config-guards.mjs
    - tests/ci-fixtures/assert-no-d1.test.mjs

key-decisions:
  - "Deploy invocation MUST pin `--config wrangler.jsonc` (package.json's `deploy` script, plus a CRITICAL comment in wrangler.jsonc itself) — found via the plan's own instructed inspection of the adapter-generated deploy config, not assumed: a bare `wrangler deploy` silently drops the custom `main` (and therefore the whole Worker) whenever Astro's build has zero on-demand routes, because @astrojs/cloudflare marks that whole build environment devOnly independent of what `main` names."
  - "`pnpm run test:build-gate` wired into the `build` script — the live Rollup-based D1-import guard (assertNoD1Plugin) never actually sees src/worker.ts during a real astro build (its devOnly environment is never built at all, confirmed by grepping a full build log for zero 'worker.ts' occurrences), so the fixture suite's real-graph case (Case 8, buildRealGraph) is the ONLY current-content check for this file, and must run on every build to matter."
  - "tools/check-config-guards.mjs's T-03-02a-era comment ('wrangler deploy actually reads dist/client/wrangler.json') corrected, not reversed, for this project post-04-06: the source-file scan (scanWranglerForD1Binding) is once again the authoritative check now that deploy reads wrangler.jsonc directly; the generated-file scan stays as harmless supplementary coverage."
  - "src/pages/404-index.json.ts and 404.astro reimplement the newest-first/uuid-tiebreak sort inline rather than importing src/lib/listing.ts (04-05's parallel module), per the plan's own instruction to keep this task's diff independent of that plan's concurrent work."

patterns-established:
  - "A Worker's own env bindings get a minimal local TypeScript interface (no @cloudflare/workers-types dependency exists in this project) — confirmed absent from node_modules before declaring one inline in src/worker.ts, per the plan's documented fallback."

requirements-completed: [SEO-04, SEO-08]

coverage:
  - id: D1
    description: "A non-canonical article URL (wrong category, wrong slug, or /article/<uuid>) whose uuid has a v2 manifest entry answers one 301 to the canonical path, built only from validated manifest fields (never the request path) — one KV read, zero D1 reads"
    requirement: "SEO-04"
    verification:
      - kind: unit
        ref: "tests/unit/article-redirect.test.mjs#resolveRedirect: a non-canonical path with a valid v2 entry redirects to the canonical path; #the Location is built only from validated manifest fields (T-04-22)"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: a GET for a non-canonical path with a stubbed KV entry answers 301 with the canonical Location plus the original query string, and exactly one KV get call"
        status: pass
    human_judgment: false
  - id: D2
    description: "The canonical path itself is never redirected to itself (loop guard); D-09 8-character short ids never match; malformed percent-encoding falls through to the 404 page, never a 500"
    requirement: "SEO-04"
    verification:
      - kind: unit
        ref: "tests/unit/article-redirect.test.mjs#resolveRedirect: the canonical path itself never redirects (loop guard); #extractArticleUuid: returns null for an 8-character short id (D-09); #extractArticleUuid: returns null for malformed percent-encoding"
        status: pass
      - kind: unit
        ref: "tests/unit/worker.test.mjs#worker: a KV get that throws falls through to env.ASSETS.fetch, never a 500"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Worker is bundled with navigation-safe routing (assets_navigation_has_no_effect) and both assets keys (not_found_handling, html_handling), confirmed against the real adapter-generated deploy config and a real dry-run bundling this project's own code"
    requirement: "SEO-04"
    verification:
      - kind: other
        ref: "pnpm exec wrangler deploy --config wrangler.jsonc --dry-run: worker.js contains this project's redirect code with RENDER_MANIFEST + ASSETS bindings; dist/client/wrangler.json carries compatibility_flags:[\"nodejs_compat\",\"assets_navigation_has_no_effect\"] and assets:{\"not_found_handling\":\"404-page\",\"html_handling\":\"auto-trailing-slash\"}"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Worker is inside the D1-import guard's scope: a synthetic Worker-shaped fixture reaching kv-manifest.ts is rejected, and the REAL src/worker.ts -> article-redirect.ts -> article-url.ts graph (re-read from disk every run) is accepted"
    requirement: "SEO-04"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 7 (T-04-26): a Worker-shaped fixture that reaches kv-manifest.ts transitively through a helper is rejected; #Case 8 (T-04-26, control): the REAL src/worker.ts -> article-redirect.ts -> article-url.ts graph is accepted"
        status: pass
    human_judgment: false
  - id: D5
    description: "Any unmatched URL gets the styled, noindex 404 page (HTTP 404 via env.ASSETS.fetch + not_found_handling) with a static Recent-stories list plus a client-matched suggestions section, DOM-built via textContent/createElement only, never an HTML-string sink"
    requirement: "SEO-08"
    verification:
      - kind: unit
        ref: "tests/unit/not-found.test.mjs#not-found: 404.html exists, is noindex, and has at least one static card plus the suggestions section; #not-found: 404.html's inline script uses only textContent, never an HTML-string sink (T-04-25)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 404 suggestion index (404-index.json) is generated by the same build as the pages it links to — every path in it maps to an existing file in THAT build's own output, sized under 100KB"
    requirement: "SEO-08"
    verification:
      - kind: unit
        ref: "tests/unit/not-found.test.mjs#not-found: 404-index.json parses, has <= NOT_FOUND_INDEX_COUNT entries, is <= 100KB, and every path maps to a real built page (same-build consistency)"
        status: pass
    human_judgment: false
  - id: D7
    description: "/categories, /sources, /new answer 301 to /; /sitemap.xml answers 301 to /sitemap-index.xml; /search and /stats fall through to the 404 page with no rule"
    requirement: "SEO-04"
    verification:
      - kind: unit
        ref: "tests/unit/not-found.test.mjs#not-found: _redirects carries the D-11/D-12 rules"
        status: pass
      - kind: other
        ref: "cmp public/_redirects dist/client/_redirects (byte-identical)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Live behaviour for both request kinds (navigate vs. plain, Sec-Fetch-Mode) against the deployed Worker — the one thing this plan's own <verification> block explicitly defers to 04-12"
    verification: []
    human_judgment: true
    rationale: "This plan does not deploy; 04-06's own <verification> block states live navigate-vs-plain-request behavior is verified on the deployed site in 04-12. No automated coverage exists here by design."

duration: ~30min
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 06: Worker, Non-Canonical URL Redirects, and 404 Suggestions Summary

**This project's first Cloudflare Worker resolves non-canonical article URLs to their canonical path with one KV read and zero D1 reads, backed by a pure unit-tested redirect module, a corrected `--config wrangler.jsonc` deploy invocation (found and fixed after the adapter silently dropped the custom Worker on a fully static build), and a D1-free 404 page whose suggestions come from a build-time index instead of v1's per-404 D1 query and OpenAI call.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-27T15:00:41Z (04-05's completion commit)
- **Completed:** 2026-09-27T15:30:58Z
- **Tasks:** 3
- **Files modified:** 14 (9 created, 5 modified)

## Accomplishments

- Built `src/lib/article-redirect.ts` (test-first, genuine RED/GREEN TDD pair): `extractArticleUuid()`
  handles case, trailing slash, `.html`, D-09 short-id rejection, and malformed percent-encoding
  without throwing; `resolveRedirect()` validates a manifest entry defensively, applies a loop
  guard, and builds the redirect `Location` ONLY from validated fields (T-04-22 open-redirect
  mitigation) — 21 unit tests across the redirect module and the Worker's `fetch` handler.
- Wired the Worker into `wrangler.jsonc` (`main`, `assets_navigation_has_no_effect`,
  `not_found_handling`, `html_handling`) and extended `tools/assert-no-d1.mjs` to cover it.
- **Found and fixed a real architectural landmine** the plan's own Task 2 text anticipated and
  told the executor to investigate before trusting: `@astrojs/cloudflare` 14.3.2 marks the entire
  entry-Worker build environment `devOnly` whenever the Astro app has zero on-demand routes
  (true here, pre-Phase-8) — independent of what `main` names — so a bare `wrangler deploy` would
  have silently shipped WITHOUT this Worker, defeating D-08 while every other guard stayed green.
  Confirmed via a real dry-run bundling the actual Worker code once `--config wrangler.jsonc` is
  passed explicitly; fixed in `package.json`'s `deploy` script and documented with a CRITICAL
  comment in `wrangler.jsonc`.
- **Found and fixed a real D1-guard coverage gap** caused by the same root fact: the live
  Rollup-based `assertNoD1Plugin` never sees `src/worker.ts` during a real `astro build` (its
  `devOnly` environment is never actually built — confirmed by grepping a full build log for zero
  "worker.ts" occurrences). The only real, current-content check is
  `tests/ci-fixtures/assert-no-d1.test.mjs`'s new Case 8 (`buildRealGraph`, reads the real file's
  imports off disk every run); wired `test:build-gate` into `build` so that check runs on every
  build, closing the gap this plan's own change opened.
- Built the D1-free 404 page (`src/pages/404.astro` + `404-index.json.ts`): a static "Recent
  stories" list plus a plain page script (not a hydrated island) that fetches a build-time index
  and DOM-builds up to 5 suggestions via `createElement`/`setAttribute`/`textContent` only. Every
  path in the index is proven to map to a real file in the SAME build's own output.
- Added `public/_redirects` for v1's retired `/categories`, `/sources`, `/new`, and `/sitemap.xml`.
- Full regression suite: 312/312 unit tests passing, 8/8 D1-import fixture cases (including the
  two new ones), full real `pnpm run build` against production D1/KV.

## Task Commits

1. **Task 1: Redirect decision module and the Worker fetch handler** (`tdd="true"`) —
   `e960169` (test, RED) → `bc00bdf` (feat, GREEN)
2. **Task 2: Wire the Worker into wrangler.jsonc; extend the D1-import guard** — `7463773` (feat)
3. **Task 3: Static 404 page with build-time suggestion index; legacy-route redirects** —
   `960826a` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## Files Created/Modified

- `src/lib/article-redirect.ts` (new) — `extractArticleUuid()`, `resolveRedirect()`, no imports
  from the D1/KV chokepoint directory
- `src/worker.ts` (new) — the Worker's `fetch` handler: one KV read at most, zero D1 reads
- `wrangler.jsonc` — `main`, `assets_navigation_has_no_effect`, both `assets.*` keys, and a
  CRITICAL comment documenting the mandatory `--config wrangler.jsonc` deploy flag
- `package.json` — `deploy` now `wrangler deploy --config wrangler.jsonc`; `build` now runs
  `test:build-gate` before `astro build`
- `tools/assert-no-d1.mjs` — `src/worker.ts` in `ENTRYPOINT_EXACT_FILES`, plus a KNOWN LIMITATION
  #2 comment documenting why that alone provides no live coverage
- `tools/check-config-guards.mjs` — corrected the now-stale "wrangler deploy reads the generated
  config" claim
- `tests/ci-fixtures/assert-no-d1.test.mjs` — `runAgainstGraph`/`buildRealGraph`/
  `runRealGraphScenario`, Case 7 (synthetic Worker->kv-manifest rejection) and Case 8 (real-graph
  acceptance)
- `tests/ci-fixtures/worker-with-kv-import.ts` (new fixture)
- `src/pages/404.astro`, `src/pages/404-index.json.ts` (new) — the D1-free 404 page and its index
- `public/_redirects` (new) — D-11/D-12 rules
- `tests/unit/article-redirect.test.mjs`, `tests/unit/worker.test.mjs`, `tests/unit/not-found.test.mjs`
  (new)

## Decisions Made

- Deploy MUST use `wrangler deploy --config wrangler.jsonc` — see key-decisions above.
- `test:build-gate` wired into `build` — see key-decisions above.
- `tools/check-config-guards.mjs`'s comment corrected to reflect deploy now reading `wrangler.jsonc`
  directly again.
- 404 pages reimplement the newest-first sort inline rather than importing `src/lib/listing.ts`
  (04-05's parallel module), per the plan's own instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `@astrojs/cloudflare` silently drops a custom Worker `main` on a fully static build**
- **Found during:** Task 2, following the plan's own explicit instruction to inspect the generated
  deploy config rather than trust a bare dry-run
- **Issue:** `@astrojs/cloudflare` 14.3.2 computes `buildOutput === 'static'` whenever the app has
  zero on-demand routes and marks the entry-Worker build environment `devOnly` purely from that —
  independent of `main`'s value. `devOnly` environments are excluded from the adapter's
  auto-generated `dist/client/wrangler.json`, which `wrangler deploy` reads BY DEFAULT via its own
  redirect (`.wrangler/deploy/config.json`). A real build's generated config carried every other
  key correctly but omitted `main` entirely — a bare `wrangler deploy` would ship without this
  Worker while every other check stayed green. The plan's own literal `<verify>` command (a
  `--dry-run` with no `--config`) would not have caught this, since a dry-run exits 0 regardless.
- **Fix:** `package.json`'s `deploy` script now passes `--config wrangler.jsonc` explicitly,
  bypassing the adapter's redirect; confirmed via a real dry-run whose `worker.js` contains this
  project's own redirect code with both `RENDER_MANIFEST`/`ASSETS` bindings present. A CRITICAL
  comment in `wrangler.jsonc` documents this so a future manual deploy isn't run bare.
- **Files modified:** `package.json`, `wrangler.jsonc`
- **Verification:** Real `wrangler deploy --config wrangler.jsonc --dry-run` bundles the correct
  Worker; `Total Upload` rose from 0.34 KiB (broken default path) to 3.20 KiB (real Worker code)
- **Committed in:** `7463773` (Task 2 commit)

**2. [Rule 2 - Missing critical functionality] The live D1-import guard cannot see `src/worker.ts` during a real build**
- **Found during:** Task 2, while investigating the finding above
- **Issue:** Because `src/worker.ts`'s whole build environment is `devOnly`, it is never actually
  built by Vite/Rollup during `astro build` — confirmed by grepping a full build log for zero
  "worker.ts" occurrences. `assertNoD1Plugin`'s live Rollup-graph walk therefore structurally
  cannot see this file, unlike pages/islands. The only real, current-content protection is
  `tests/ci-fixtures/assert-no-d1.test.mjs`'s fixture suite, which was not wired into `build` or
  `test:unit`.
- **Fix:** Added `pnpm run test:build-gate` as a `build` script step; documented as "KNOWN
  LIMITATION #2" in `tools/assert-no-d1.mjs` with the re-check condition (Phase 8's first
  on-demand route may change `buildOutput`, which should be re-verified before relying on this
  limitation staying true).
- **Files modified:** `package.json`, `tools/assert-no-d1.mjs`
- **Verification:** `pnpm run build`'s own log now shows `test:build-gate`'s 8/8 passing output at
  the front of every build
- **Committed in:** `7463773` (Task 2 commit)

**3. [Rule 1 - Test-authoring bug] `NOT_FOUND_INDEX_COUNT` cannot be imported into a plain `node --test` file**
- **Found during:** Task 3, first attempt to write `tests/unit/not-found.test.mjs`
- **Issue:** `src/pages/404-index.json.ts` imports the `astro:content` virtual module, which only
  resolves inside Astro's own Vite build — a plain Node test importing it directly would throw.
- **Fix:** Duplicated the constant (`500`) as a local `const` in the test file with a comment
  explaining why, matching `tests/unit/listing-pages.test.mjs`'s own established
  dist-output-only testing convention.
- **Files modified:** `tests/unit/not-found.test.mjs`
- **Verification:** `node --test tests/unit/not-found.test.mjs` passes
- **Committed in:** `960826a` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking deploy-config issue, 1 missing security-guard
coverage, 1 test-authoring fix)
**Impact on plan:** The first two deviations were both real, previously-undetected gaps that
would have silently shipped D-08 as a no-op and left its own new entrypoint unguarded — found only
because the plan's own Task 2 text insisted on inspecting the generated deploy config rather than
trusting a dry-run's exit code. No scope creep: every fix stayed inside deploy invocation and
guard wiring, never touching `src/worker.ts`/`article-redirect.ts`'s own design.

## Issues Encountered

Both architectural findings above were investigated to a specific, confirmed root cause (reading
`@astrojs/cloudflare`'s and `@cloudflare/vite-plugin`'s own source, and a real build's own log)
rather than worked around or accepted as unexplained "wrangler weirdness." No threshold was
weakened and no plan artifact (must_haves, threat model, file list) needed to change — the fix is
entirely in which command/config governs a deploy and which build step re-proves the guard.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 04-07 (sitemaps) can proceed: `/sitemap.xml` already redirects to `/sitemap-index.xml`, which
  that plan will build.
- 04-12 owns the one thing this plan's own `<verification>` block explicitly defers: live
  navigate-vs-plain-request behavior against the deployed Worker, and re-confirming the
  trailing-slash redirect status code (04-01 measured 307).
- Whoever plans Phase 8 (first `server:defer` island / on-demand route) should re-check
  `tools/assert-no-d1.mjs`'s KNOWN LIMITATION #2 — `buildOutput` may no longer be `'static'` at
  that point, which could change whether the live guard directly covers `src/worker.ts`.

## Self-Check: PASSED

All 14 files-created/modified paths confirmed present on disk; all 4 task commit hashes
(`e960169`, `bc00bdf`, `7463773`, `960826a`) confirmed present in `git log --oneline --all`.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

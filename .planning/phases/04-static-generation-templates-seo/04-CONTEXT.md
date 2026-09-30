# Phase 4: Static Generation, Templates & SEO - Context

**Gathered:** 2026-09-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers **every public page type generated at build time from D1, rebuilt on each
cron cycle, with a loader that fails the build instead of shipping an empty page** — plus the SEO
surfaces v1 already has (canonicals, `robots.txt`, `/rss.xml`, structured data, Google News
sitemap, 404 suggestions) carried over without reintroducing a D1 read on the public path.

Page types in scope: home, category index (`/crime` and `/crime/**`), article, tag (`/tag/*` and
a `/tags` index), per-source (`/source/*`), changelog, contact, and the ported static pages
`/about`, `/privacy`, `/terms` (see D-10).

It also stands up the delivery pipeline that makes "regenerate every cron" real: a public GitHub
remote, Cloudflare Workers Builds, and a Deploy Hook the ingest cron calls (D-01…D-05).

**Not in scope:** the R2 archive tier, tag tiering and the zero-reads proof (Phase 5); Spanish
routing (Phase 6); share cards and imagery (Phase 7); islands (Phase 8); search (Phase 9); the
About-page rewrite (Phase 10).

**Repo note:** most code lands in this repo (`915tldr.com`) on `feature/phase-04`. One small change
lands in the sibling backend repo `915tldr.com2`: the ingest cron POSTing the Deploy Hook (D-02).

</domain>

<decisions>
## Implementation Decisions

### Build & deploy pipeline (REND-04, OPS-10)

- **D-01:** The 2-hourly static build runs on **Cloudflare Workers Builds** (hosted CI), not on the
  owner's machine and not inside a Worker. `astro build` + `wrangler deploy` need Node, the repo and
  credentials; none of that runs inside a Worker, and static assets are immutable per deployment.
  — **Reversibility:** costly — moving the build host later means re-wiring the trigger, secrets,
  build cache and deploy credentials.

- **D-02:** Each build is triggered by the **existing ingest cron in `915tldr.com2` POSTing a
  Workers Builds Deploy Hook** after ingest finishes, **only when rows changed**. No blind clock;
  no race with a slow ingest. The hook URL is stored as a secret in the backend Worker.
  Verified 2026-09-26 against Cloudflare docs: Deploy Hooks exist for Workers Builds (changelog
  2026-04-01), are branch-scoped URLs, auto-deduplicate a hook fired again before its build starts,
  and are rate-limited to 10 builds/min per Worker. Cloudflare's own example calls one from a Cron
  Trigger Worker.

- **D-03:** The repo gets a **public GitHub remote named `915tldr-frontend`** — matching the
  Phase 12 target name in the repo-split todo, so the later local `mv` converges on an existing
  name. Public fits "built in the open". No secrets in the tree: D1/KV credentials live in Workers
  Builds environment variables. **The owner creates the remote and pushes via lazygit; Claude never
  pushes, creates branches or merges.**
  — **Reversibility:** one-way — a public repo name is a published contract (links, Workers Builds
  connection); renaming later breaks both.

- **D-04:** The Deploy Hook builds **`main`** as production. Matches git flow: only merged,
  released code serves production; content refreshes rebuild `main`'s code with fresh D1 data.
  Feature/develop work never auto-deploys to production.

- **D-05 (amends Phase 3 D-01):** Phase 3 recorded "the render step runs inside the existing 2-hour
  cron Worker". For the **static site** that is superseded: the cron Worker **triggers**; Workers
  Builds **builds and deploys**. Phase 3's "no new infrastructure" rationale no longer holds for
  this part (Workers Builds + a GitHub remote are new). Phase 3's measured-workload conclusions
  (15 articles/cycle mean, 62 peak) still stand, and Phase 5's R2 archive render may still live in
  the cron Worker as Phase 3 D-01 intended. The planner must update
  `docs/phase-03/render-step-location.md` (or add a Phase 4 note beside it) so the two documents do
  not disagree.

- **D-06:** Incremental loading must use **Workers Builds build caching** so the loader fetches only
  changed rows and keeps the rest from the previous build. Verified 2026-09-26: build caching
  auto-detects Astro and caches `node_modules/.astro` (plus the pnpm store); retention 7 days after
  last read; 10 GB per project. Binding constraint carried from Phase 3: **a full-corpus scan every
  cycle is 11.5M rows/day, 2.3× the daily hard-fail**, so the steady-state loader must use an
  incremental signal (e.g. `updated_at > last_sync`). Research must confirm Astro's content-layer
  data store actually lives inside the cached directory, and must define the behaviour when the
  cache is cold (first build, or purged after 7 idle days): a cold build is a legitimate full fetch
  (~957k rows once), not a failure.

### URL compatibility & 404 (SEO-04, SEO-08, FIX-04)

- **D-07:** Article URLs are built from the **stored `articles.slug` column**, never re-derived
  from the title. Scout finding: the Phase 3 tracer uses its own `src/lib/slug.ts` `slugify()`,
  which does **not** match v1's `generateSlug()` (`915tldr.com2/server/utils/rss.ts:215` — strips
  non-`[a-z0-9\s-]` chars so "don't" → `dont`, not `don-t`; caps at 100 chars). v1 also regenerates
  the slug when the AI retitles an article (`915tldr.com2/server/utils/queue-processor.ts:132`).
  Canonical URL shape stays `/${category.slug}/${article.slug}-${uuid}` (as built by v1's
  `app/components/ArticleCard.vue:94`).
  — **Reversibility:** one-way — a wrong slug in a published canonical/sitemap is indexed by search
  engines and must then be redirected forever.

- **D-08:** **Non-canonical article URLs 301 to the canonical URL via the Worker.** v1 resolves by
  UUID only (`915tldr.com2/app/pages/[category]/[slug].vue`): slug text is ignored and a wrong
  category redirects; it also has `/article/[uuid]`. On a static-asset miss, the Worker parses the
  full UUID from the path, reads that article's KV manifest entry (**1 KV read, 0 D1 reads**) and
  301s to the canonical path; no UUID or no entry → the static 404 page. This requires the KV
  manifest entry to carry **`slug`** (and category slug) — a new field, so the manifest schema
  version is bumped per Phase 3 D-04's render-version rule.
  — **Reversibility:** costly — adding a manifest field touches every entry and every reader.

- **D-09:** **8-character short IDs are dropped.** Nothing in v1's link generation emits them
  (`ArticleCard.vue` uses the full UUID). The planner may add a cheap research check (grep v1, the
  sitemap and RSS for short-ID URLs); if real usage turns up, surface it rather than silently
  adding keys.

- **D-10a (404 suggestions):** Carried over as a **static, build-time index with no AI and no
  D1**: a compact JSON of recent/top articles (title, slug, category, uuid) that the 404 page
  matches path tokens against. v1's per-404 D1 `LIKE` + OpenAI call (rate-limited 10/min) is not
  ported. The 404 page must still be useful without JS (e.g. a static list of recent articles).
  The index-matching script is plain page script, not a new island — ISL-08 limits islands to
  search, category filter, theme toggle, load-more and weather.

### v1 routes not in the Phase 4 page list

- **D-10:** `/about`, `/privacy`, `/terms` — **port v1's current content as static pages** in the
  approved chrome now, so cutover never loses a privacy policy. Phase 10 rewrites About (IDNT-01/02).
- **D-11:** Build **`/tags`** (index) and **`/source/[slug]`** (3 sources) as static pages, keeping
  v1's URL shapes (`/tag/<slug>`, `/source/<slug>`). **`/categories` and `/sources` 301** to their
  nearest equivalent (homepage/nav). Research checks which of these actually receive traffic before
  the planner fixes the redirect targets.
- **D-12:** **`/new` 301 → `/`**; **`/search` is not built** until Phase 9; **`/stats` is dropped**
  — it was the per-request-aggregate pattern behind the 784M reads/day.

### Fail-loud loader & changelog (REND-02, REND-03, FIX-05)

- **D-13:** `/changelog`'s "full preserved history" = **`915tldr.com2/public/changelog.json`
  (12 entries, newest 2026-09-21, written by the commit skill) merged with the 6 rows in D1
  `public_changelogs` (all public, Dec 2025)**. Scout finding: v1's public page reads only the JSON
  (`app/pages/changelog.vue:19`, the `useFetch('/changelog.json')` race behind the empty-state
  bug); the D1 table is orphaned but holds entries nothing else shows. Research decides how the
  frontend build obtains the JSON, which lives in the other repo (fetch from the live v1 URL at
  build time, or vendor a copy), and the fail-loud rule applies to both sources.

- **D-14:** "Fewer rows than expected" = **never shrink versus the last good build**. The last good
  build's counts (articles; changelog entries) are persisted, and a new build must load ≥ that count
  minus an explicit, named allowance for intentional deletions. Zero extra D1 reads — a
  `COUNT(*)` per build would read ~41k rows × 12 = ~500k rows/day, a quarter of the daily budget.
  Zero rows is always a failure. The REND-03 regression test replays the `/changelog` empty-state
  failure against this rule.
  — **Reversibility:** reversible.

- **D-15:** A failed build **deploys nothing — the previous version keeps serving — and the owner
  gets a push notification** (ntfy) naming the failed check. A log-only failure is rejected: silent
  staleness is how v1 drifted for nine months.

### Carried forward (already decided — not re-discussed)

- **Trailing slash (owner, 2026-09-26, ROADMAP Phase 4):** `trailingSlash: 'never'` +
  `build.format: 'file'`; pass `trailingSlash: false` to `rss()`; verify `/rss.xml` item links have
  no trailing slash and each answers 200 directly. Keep all internal links absolute.
- **Staleness detection is incremental** (Phase 3 render-step-location.md, binding constraint 1).
- **AI disclosure + outlet attribution** (IDNT-03, IDNT-04, SEO-07) are already designed in the
  approved mockup `design/mockups/article.html` (`data-ai-disclosure` and `data-attribution`
  paragraphs, lines ~291–293). Templates reproduce that markup; no new design.
- Phase 3: one KV manifest key per article (D-03/D-04), `output: 'static'`, bindings via
  `cloudflare:workers`, `imageService` explicit, `style.css` ported wholesale (D-07), the D1-import
  graph-walk assertion.

### Claude's Discretion

- Where the last-good-build counts are persisted (D-14). Recommendation: KV, because it survives a
  build-cache purge; the build already writes KV.
- Trailing-slash variant handling at the edge (e.g. Workers Static Assets `html_handling`), provided
  the result is `/path` → 200 and `/path/` → a single 301 to `/path`.
- Structured data shape (SEO-01/02) and Google News sitemap mechanics (SEO-03), within "validated in
  the Rich Results Test, not merely emitted".
- Byte-identical output for unchanged articles (criterion 3): deterministic rendering (no build
  timestamps inside article bodies).
- Which article set the 404 index covers (D-10a), sized to stay small.

### Folded Todos

- **Tracer test fails when the newest article title contains an apostrophe**
  (`.planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md`). `tests/tracer/tracer.test.mjs`
  compares `html.includes(row.title)` against the raw D1 value; Astro escapes `'` to `&#39;`. Phase 4
  replaces the single-article tracer with full static generation — fold the fix into whatever test
  succeeds it: compare against the HTML-escaped title (or decode entities first) and add a unit case
  with an apostrophe and an ampersand.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project constraints
- `.planning/PROJECT.md` — zero-D1-reads core value, read budget (<2M/day, hard fail >5M; ≤1 KV
  read/request; Worker CPU <5ms), Key Decisions incl. "Loader must fail loud", "Drop the trailing
  slash", "Staleness detection must not rescan the corpus".
- `.planning/ROADMAP.md` §"Phase 4" — goal, five success criteria, the trailing-slash decision and
  the RSS gotcha.
- `.planning/REQUIREMENTS.md` — REND-01…05, SEO-01…08, IDNT-03/04, OPS-10, FIX-04, FIX-05.
- `.claude/CLAUDE.md` — pinned stack, Workers Static Assets 100k-file ceiling, D1 100-parameter
  limit, branching rules (Claude never pushes/creates branches).

### Phase 3 output this phase builds on
- `.planning/phases/03-foundation-read-budget-guardrails/03-CONTEXT.md` — D-01 (amended here by
  D-05), D-03/D-04 manifest shape, D-05/D-06 D1-import assertion, D-07 stylesheet port.
- `docs/phase-03/render-step-location.md` — render-step decision, the incremental-staleness binding
  constraint, and the KV bulk-write investigation flagged for Phase 4.
- `docs/phase-03/measurements.md`, `docs/phase-03/render-manifest.md`,
  `docs/phase-03/d1-pagination-report.md` — measured figures the loader design depends on.
- `src/lib/server/d1-client.ts`, `src/lib/server/kv-manifest.ts`,
  `src/pages/[category]/[slug].astro`, `tools/assert-no-d1.mjs`, `astro.config.mjs`.

### Approved design
- `design/mockups/{index,category,article,changelog,contact}.html` + `design/mockups/style.css` —
  approved page shapes (01-APPROVAL.md). `article.html` carries the disclosure/attribution markup.

### v1 behaviour to preserve (sibling repo `915tldr.com2`)
- `app/pages/[category]/[slug].vue` — UUID-only resolution, wrong-category redirect (D-08).
- `app/components/ArticleCard.vue:94` — canonical URL composition (D-07).
- `server/utils/rss.ts:215` `generateSlug()`; `server/utils/queue-processor.ts:132` slug
  regeneration on retitle (D-07).
- `server/api/404-suggestions.get.ts` — v1 404 behaviour being replaced (D-10a).
- `server/routes/robots.txt.ts`, `server/routes/rss.xml.ts`, `server/routes/sitemap.xml.ts` —
  per-bot robots policy (AI crawlers, `Content-signal`), RSS and sitemap to preserve (SEO-05/06).
- `public/changelog.json`, `app/pages/changelog.vue`, D1 table `public_changelogs` (D-13).
- `app/pages/{about,privacy,terms}.vue`, `app/pages/tag/[slug].vue`, `app/pages/source/[slug].vue`
  — content and URL shapes to port (D-10, D-11).

### Platform (verified 2026-09-26)
- https://developers.cloudflare.com/changelog/post/2026-04-01-deploy-hooks/ — Deploy Hooks.
- https://developers.cloudflare.com/workers/ci-cd/builds/build-caching/ — Astro cache dir, retention.
- https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/ — triggers, build API.
- Workers Builds monthly build-minute limit — **not verified**; ~360 builds/month expected.
  Research must check `developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/server/d1-client.ts` — the single D1 access module (REST API, throws on non-2xx /
  `success:false`); the graph-walk assertion is built around it staying the only D1 entry point.
- `src/lib/server/kv-manifest.ts` — `buildManifestEntry` / `putManifestEntry`; extend with `slug`
  (D-08). Phase 3 flagged KV bulk writes (10,000 pairs/request, REST only) as a Phase 4
  investigation — the single PUT at p50 338ms dominates rebuild time.
- `src/layouts/Base.astro`, `src/styles/global.css` — approved chrome and stylesheet.
- `src/lib/build-info.ts` — `BUILD_HASH`, the single build-identity source.
- `tools/assert-no-d1.mjs` + `tests/ci-fixtures/*` — the guard any new route/island must pass.

### Established Patterns
- `getStaticPaths()` reads D1 at build time with `prerenderEnvironment: 'node'` (Phase 3 finding:
  the adapter otherwise prerenders in workerd, where `process.env` is empty).
- Frontmatter-local helper functions can be dropped by Astro 7.3.3's bundler — put helpers in
  modules (`src/lib/slug.ts` history).
- `published_at` is epoch seconds; category/tags live in join tables (`article_categories`,
  `article_tags`), not columns.
- Commits via `/jja-commit` only.

### Integration Points
- `915tldr.com2` ingest cron → Deploy Hook POST (D-02).
- Workers Builds env vars for `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` (build-time D1 + KV).
- The Worker's static-miss path (D-08 301s, 404 page) — must pass the D1-import assertion.

</code_context>

<specifics>
## Specific Ideas

- The tracer's `slugify()` is the first thing to retire — replacing it with the stored slug is a
  correctness fix, not a refactor (D-07).
- Build-failure alerts use ntfy, which the owner already uses.
- Scout confirmed the v1 changelog JSON is 12 entries and the D1 table 6 rows (one `SELECT COUNT`,
  6 rows read, 2026-09-26) — the regression test's "full history" has a concrete expected size.

</specifics>

<deferred>
## Deferred Ideas

- **A statically built `/stats` page** — precomputed at build time it would fit "built in the
  open", but it is beyond this phase's listed page types. Candidate for a later phase or backlog.

### Reviewed Todos (not folded)
- **Split repos into a plain parent directory** (`.planning/todos/pending/2026-09-23-split-repos-into-plain-parent-directory.md`)
  — stays at Phase 12 per its own rationale. Workers Builds connects to the GitHub repo, not the
  local path, so the local `mv` has no CI benefit now. Phase 4 only aligns the GitHub name
  (`915tldr-frontend`, D-03) with the todo's target.

</deferred>

---

*Phase: 4-Static Generation, Templates & SEO*
*Context gathered: 2026-09-26*

# 915 TLDR — v2 Rebuild

## What This Is

915 TLDR is a local news aggregator for El Paso. It pulls RSS from three local outlets,
summarises each article with an LLM, tags and categorises it, detects cross-source
duplicates, and publishes the result as a free, ad-free community news site. It is built in
the open — every change is documented publicly on `/changelog`.

v2 is a rebuild of the **public site and its delivery architecture**, not of the pipeline
behind it. The data (41,233 articles, 435 MB of D1) does not move.

## Core Value

**Zero D1 reads on the public request path.** Not "fewer" — architecturally zero, enforced
structurally at build time. Everything else in this rebuild is negotiable; this is not.

## Business Context

- **Customer**: El Paso residents (and, latently, Juárez — 1.4M people, same news events)
- **Revenue model**: None directly. The site is the portfolio piece that sells `915website.com`;
  direct local sponsorship is the only ad format compatible with the performance budget
- **Success metric**: D1 reads/day under 2,000,000 sustained for 7 days — down from 784,000,000
- **Strategy notes**: `docs/PRD.md` v2.0 (2026-09-15)

## Requirements

### Validated

<!-- Shipped in v1 and relied upon. These carry forward unchanged. -->

- ✓ RSS ingestion from KVIA, KTSM, El Paso Matters — existing
- ✓ LLM summarisation, tagging, categorisation (8 categories) — existing
- ✓ Cross-source duplicate detection — existing
- ✓ Entity extraction (46,090 entities) — existing
- ✓ Vector embeddings in Vectorize (`articles-semantic`) — existing, barely used
- ✓ Admin UI, ~30 endpoints — existing, moves without rebuild
- ✓ Public changelog with preserved history — existing
- ✓ Weather widget against `api.weather.gov` (grid `EPZ/86,64`) — existing
- ✓ `robots.txt` per-bot policy including AI-crawler and `Content-signal` rules — existing
- ✓ URL scheme `/[category]/[slug]-[uuid]` — existing, must keep resolving

### Active

<!-- v2 scope. Hypotheses until shipped and verified against the budget. -->

**Architecture**
- [ ] Public site is Astro 7 on Workers Static Assets, hybrid static
- [x] Zero D1 reads on the public request path, enforced by a build-time assertion — ✓ Phase 3
      (runs inside `pnpm build`/`deploy`; there is no CI yet, so "CI assertion" means the build itself)
- [ ] Hot content (homepage, categories, tags, recent articles) regenerated at cron
- [ ] Archive rendered once to R2 at ingest, never recomputed
- [ ] KV holds only small hot values (render manifest, precomputed counts)
- [ ] Server islands for weather, 7-day forecast, "updated Xm ago"
- [ ] Daily budget routine reporting reads and spend against section 4 thresholds

**Content quality** *(moved ahead of bilingual generation — see Key Decisions)*
- [ ] Content extraction fixed — no more `[...]` truncation (14.7% of corpus today)
- [ ] Summary length proportional to source; no fixed word floor
- [ ] Prompt explicitly prohibits advisories, calls to action, and impact analysis
      not present in the source
- [ ] Affected archive re-processed once, batched, after dry run and approval
- [ ] Automated **grounding/entailment** check — every claim in a summary traces to the source.
      Ships in the same phase as the prompt rewrite; the costed dry run depends on it
- [ ] Automated check flags any summary longer than its source (necessary, not sufficient —
      the real production fabrication was length-compliant)
- [ ] Thin sources do not fall back to verbatim-heavy excerpting (aggregator legal risk)

**Bilingual**
- [ ] Spanish summaries generated at ingest, in the same model call
- [ ] `/es` routing, `hreflang` pairs, per-language sitemaps and RSS
- [ ] Language detection at ingest (also required for the `lang="es"` a11y rule)
- [ ] `/es` is public from day one (D-09, `.planning/phases/06-bilingual/06-CONTEXT.md`); Umami language data (D-11) informs how much to *promote* Spanish, not whether it exists. *Supersedes the earlier "launch decided on 2-4 weeks of measured data" rule.*

**Quality gates** *(release-blocking)*
- [ ] WCAG 2.2 AA verified — automated plus manual keyboard and screen-reader pass
- [ ] Lighthouse 100 accessibility, 100 SEO, ≥95 performance across the page set
- [ ] LCP p75 mobile < 1.5s, INP < 100ms, CLS < 0.05
- [ ] `NewsArticle` / `BreadcrumbList` / `Organization` structured data, validated
- [ ] Google News sitemap for the last 48 hours
- [ ] Self-hosted subset fonts with `size-adjust` fallbacks

**Design**
- [ ] Static HTML/CSS mockups approved before any Astro work
- [ ] Editorial 1990s-magazine identity, Chihuahuan desert palette, 8 category colours
- [ ] Light default, dark secondary, both fully designed
- [ ] Contrast and keyboard review passed *before* the design is accepted

**Imagery**
- [ ] Ingest filter rejecting emoji sprites, generic placeholders, undersized images —
      applied retroactively to the existing 1,098 junk images
- [ ] Per-article generation via Workers AI Flux-Schnell for the 15,624 without a usable image
- [ ] 8 category heroes + daily lead via `gpt-image-2.5-flare`, sharing one visual identity
      via reference images
- [ ] Every article has a real 1200×630 Open Graph card, validated on X, Facebook, WhatsApp

**Product**
- [ ] Subscribe capture — email, categories, entity follows, language, unsubscribe token
- [ ] About page with a named human and plain-English disclosure of how the AI works
- [x] Deployed commit hash in the footer and at `/version.json` — ✓ Phase 3
- [x] `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge — ✓ Phase 3 (also covers `admin-dev.915tldr.com`)
- [ ] Admin behind Cloudflare Access at `admin.915tldr.com`

### Out of Scope

- **Rewriting the ingestion pipeline** — RSS fetch, duplicate detection, embeddings are nine
  months of tuning and are where regression risk lives. *Exception: content extraction and
  the summary prompt, which are a correctness defect, not an optimisation.*
- **Rewriting the admin** — ~30 working endpoints seen by one person. It moves, it doesn't
  get rebuilt.
- **Migrating data** — same database, same schema, same bindings. Additive changes only.
- **Better Auth and any auth framework** — the `user` table has 1 row, there are no signup
  routes and no digest code. Replaced by Cloudflare Access at the edge. (§15 of the PRD still
  lists Better Auth under "carried forward"; that line is stale and contradicts §3.2 and §10.1.)
- **Digests / newsletter sending** — capture ships, sending does not. A daily email to three
  people is not worth the deliverability commitment. Gate to build: ~50-100 confirmed
  subscribers *and* analytics confirming real traffic.
- **Expanding news sources** — deferred to v2.1. Changing the source mix mid-rebuild would
  confound the architecture work, which needs a stable ingest rate to validate against.
- **Programmatic ads (AdSense et al.)** — hundreds of KB of third-party JS cannot coexist with
  Lighthouse 100 and LCP < 1.5s. Genuine either/or, decided deliberately.
- **Comments** — unbounded moderation commitment for a solo operator.
- **Coverage-gap analysis** — technically easy, but turns a neutral aggregator into a media
  critic and picks fights with the outlets the site depends on.
- **Reader accounts, personalisation, mobile app** — v3+ material.
- **Switching LLM providers** — staying on OpenAI. One vendor, one bill, no new integration
  surface in a pipeline already being opened for the prompt fix.

## Context

**What went wrong in v1.** The v1.0 PRD forecast ~50K D1 reads/day. Measured 2026-09-15:
**784,000,000/day** — 15,680× over. Traffic matched the forecast almost exactly (~10.5K
requests/day vs ~10K predicted); reads did not. The site performs roughly 75,000 row reads to
serve one request. The cause is not slow queries: every page recomputes aggregates over the
full article table on demand, for content that changes twelve times a day when the cron runs.
`/api/tags` alone reads 408,969 rows per uncached call.

**Nothing watched the number for nine months.** That is the actual defect — the missing
guardrail, not the missing index. The rebuild fixes it by removing D1 from the request path
entirely, and by adding a daily routine that would have caught the drift in week one.

**The second defect, found 2026-09-15 and arguably worse.** 39.3% of stored source content is
under 90 words and 14.7% is visibly truncated mid-sentence with a `[...]` marker, while the
prompt demands a "comprehensive TLDR (100-200 words)". The model pads to hit the floor.
16.6% of summaries contain an advisory phrase. Verbatim from production, on a story that
reported only an arson arrest:

> *"Residents and dealership owners are urged to remain vigilant and report any suspicious
> activity to the authorities."*

Nobody urged anything. On a news site in a border community, inventing official-sounding
guidance is a credibility and potentially a harm issue. This is why the pipeline non-goal has
an exception.

**Why bilingual, and why not for the obvious reason.** El Paso is 80%+ Hispanic, but most
El Pasoans are bilingual and English-dominant for media, so that statistic alone does not
justify it. Two better reasons: Spanish-dominant households (older residents, recent arrivals)
are genuinely underserved by every local aggregator; and Juárez is 1.4 million people ten
minutes away, sharing the same crime, weather, border and economy news, with nobody
aggregating across the line. The metro is binational and the current site serves half of it.
Only 565 of 37,180 articles (1.5%) originate in Spanish today.

**Platform capability left on the table.** `env.AI` (Workers AI) and Vectorize
(`articles-semantic`) are already bound and paid for and barely used. Workers Static Assets,
Astro server islands, and content layer loaders are all new since v1.0. The NWS weather
endpoint already returns 14 forecast periods and the code reads `periods[0]` and discards the
rest — a 7-day forecast costs zero additional API calls.

**Known defects to fix during the move:** `reprocess-all.post.ts` binds an unbounded ID list
across four `inArray` calls and will breach D1's 100-parameter ceiling; `pnpm deploy` calls a
bare `wrangler` that is not a dependency; Prettier error at `app/pages/privacy.vue:164`;
category index routeRules gap (`/crime/**` never matches `/crime`); `/changelog` renders empty
because the SSR-time `useFetch('/changelog.json')` intermittently races and the empty payload
is cached for an hour — static generation removes that failure mode outright.

**Directory trap — the live code is NOT in this directory.** This repo
(`/home/jaime/www/_github/915tldr.com`) holds only `docs/` and `.planning/`. Every
`wrangler.jsonc`, server route, cron endpoint and `embeddings.ts` for the running system is in
**`/home/jaime/www/_github/915tldr.com2`**. Building v2 here is correct (PRD §15 step 1), but
anything that inspects, measures or modifies the *current* system must target `915tldr.com2`.
The project-research pass read this directory and so found planning prose where it expected
implementation — which is why the embedding model went unestablished until a direct check.
Any phase touching the existing pipeline or admin operates on `915tldr.com2`.

**This two-repo layout is a permanent split, not a transitional rebuild artifact** (recorded
2026-09-23 after the owner lost real time to this exact confusion). `915tldr.com` is the frontend
(Astro, public site, reads D1 at build time); `915tldr.com2` is the backend (Nuxt, pipeline +
admin, owns the 2-hourly ingest cron) and is retained indefinitely per this document's own "Nuxt
app retained for pipeline/admin" tech-stack constraint and ROADMAP Phase 12's criterion that the
Nuxt app serves production traffic from `admin.915tldr.com`. Each repo's README carries the full
role block and phase-ownership table; a Phase 12 todo
(`.planning/todos/pending/2026-09-23-split-repos-into-plain-parent-directory.md`) tracks
reorganizing both into a plain parent directory with clearer child-repo names once the admin
split is real in production, not before.

**Open questions that need a measurement or a codebase check, not a guess.** Research
deliberately declined to assert answers on these:

| Question | Why it matters | How to settle it |
|---|---|---|
| ~~Which embedding model populates `articles-semantic`?~~ **RESOLVED 2026-09-16: `@cf/baai/bge-base-en-v1.5`, 768-dim, Workers AI — English-only.** | Vectorize's cross-language advantage is **gone**. Spanish queries will not semantically match English vectors. Search now has three paths, none free: keep FTS5 with a scoped D1 carve-out, re-embed the corpus with a multilingual model (`bge-m3` or equivalent), or run per-language indexes | Answered — feeds SRCH-02 |
| ~~Did article embeddings silently stop on 2026-09-04?~~ **RESOLVED 2026-09-16: no.** | Embeddings run on Workers AI, billed separately from the OpenAI credit balance. The $0 balance could not starve them. Vectors for that window should exist | Answered |
| **Did the OpenAI-dependent cron endpoints fail from 2026-09-04 to 2026-09-16?** | `server/api/cron/process`, `fetch` and `detect-duplicates` in `915tldr.com2` call OpenAI and would have returned HTTP 429 for twelve days. If `process` does summarisation, ~1,200 articles may be unsummarised or half-processed; if `detect-duplicates` failed, duplicates passed through silently. This would enlarge the content-quality re-processing set | Query `articles` for rows in that window with null/short summaries; check cron logs. **Check in `915tldr.com2`, not here** |
| Current cron worker CPU headroom | Decides whether the render step can live in the cron worker | Workers Observability |
| Real per-page render cost | A full 82k rebuild at ~4ms/page is ~330s — over the 300s Worker CPU ceiling regardless of location, so it needs Queues fan-out | Measure on a deployed worker |
| Worker → R2 `get()` latency at ~30 KB | The archive hop is on the critical path for most article requests | Measure on a deployed worker |
| D1 REST API pagination performance at 41,233 rows | The whole build depends on the loader; no Drizzle runtime driver exists for D1-HTTP | Phase 2 spike |
| Astro build time and memory at 41k–82k pages via a D1 loader | No public benchmark exists for a DB-backed loader at this scale — closer to novel territory than general Astro scaling suggests | Phase 3 spike |
| WhatsApp's real share-card image ceiling (~300 KB per community sources, undocumented) | WhatsApp is the strictest platform and matters most locally | Test against actual generated cards |

**Prior cost incident.** A previous remediation attempt produced an unforecast ~$40 AI charge
by pushing the corpus back through the summariser. Every money-spending operation in this
rebuild is now enumerated with a ceiling and a gate, and re-rendering HTML is explicitly
distinguished from re-processing with a model.

## Constraints

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid static, not pure prerender | Pure prerendering is over the 100,000-file ceiling **immediately**, not in 18 months and not in 90 days: 41,233 articles × 2 languages = 82,466, **plus 18,007 tags × 2 = 36,014 tag pages** ≈ **118,000 files** before categories or static pages. The PRD's "82k exceeds 100k" was wrong arithmetic with a right conclusion; an earlier correction to "~90 days" counted articles only. A full rebuild every 2h would also become the next cost problem. | — Pending |
| Tag pages default to the archive tier | 36,014 tag pages is 36% of the entire file ceiling for content almost nobody requests directly. Only top-N tags by article count get promoted to hot static; the rest render once to R2 like the article archive. | — Pending |
| File count is a watched budget line | The ceiling is currently handled by architectural choice but nothing measures it. The "hot content" cutoff is a number that drifts. It joins D1 reads and spend in the daily routine — same "measure it or it drifts" logic that produced this rebuild. | — Pending |
| R2 for the archive, not KV | ~37,000 pages × ~30 KB ≈ 1.1 GB. KV includes 1 GB — over the line immediately. R2 includes 10 GB. | — Pending |
| `/es` launches public from day one, not on 2-4 weeks of data | Owner decision recorded as D-09 (06-CONTEXT.md, 2026-10): `/es` is linked, indexed and in the sitemap as soon as Phase 6 ships. The earlier rule (wait for 2-4 weeks of measured data) is superseded. The owner chose this knowing the 80%-Hispanic figure alone does not justify Spanish (see "Why bilingual" above); language data from Umami (D-11) now informs how much to promote Spanish, not whether it exists. | Decided (D-09) — Phase 6 |
| Content quality moves to **phase 2** | The PRD put the prompt fix at phase 8 but started Spanish generation at phase 2 — which would generate fabricated advisories in Spanish for six phases, then pay to redo them. Fix the prompt before any new summary is written in either language. | — Pending |
| Summariser: `gpt-5.6-luna` | GPT-4o Mini is from Aug 2024. Luna is the small model of OpenAI's newest family — best instruction-following in the cheap tier, which is precisely the padding defect. Ongoing delta is **$0.48/month**; batched corpus backfill is **~$7.44**, *under* the PRD's existing $8.92 estimate for staying put. | — Pending |
| Stay on OpenAI; no Gemini | Gemini 2.5 Flash-Lite is 33% cheaper on both axes, but a second vendor means a second bill and a new integration surface in a pipeline described as nine months of tuning. Not worth $0.48/month. | — Pending |
| Batch API mandatory for backfills | 50% discount, 24h window, and the backfills are offline and latency-insensitive. Applies to image models too. Ongoing cron stays on standard rates. | — Pending |
| Tier 2 imagery stays on Flux-Schnell | $0.00063/image vs ~10-13× that for the cheapest OpenAI tier — ~$10 vs ~$125 for the 15,624 backfill, and ongoing (~40/day = 2,304 neurons) sits entirely inside the free 10,000/day. Not close. | — Pending |
| Tier 3 imagery: Flare vs Sunburst **reopened** | `gpt-image-2` is superseded. An earlier note here said Flare and Sunburst are "identically priced" — that was true of the **rate** ($30/M output) and wrong about the **cost**, because token consumption varies enormously by model. Measured 2026-09-16, same prompt at 2048×1152: `gpt-image-2` high = 5,650 output tokens = **$0.1706**; `gpt-image-2.5-sunburst` high = 1,413 tokens = **$0.0435** (3.9× cheaper); sunburst `xhigh` = 2,511 tokens = **$0.0764**. Flare has not been measured. Sunburst may deliver higher quality *and* editing precision for less than Flare. Phase 1 measures both (IMG-09) and decides. | ⚠️ Revisit |
| Category heroes need retry handling | A `gpt-image-2.5-sunburst` call returned HTTP 400 and succeeded on retry with identical parameters — transient. The `jja-imagen` script exits on any HTTP error with no backoff, so one hiccup kills a batch mid-run. Generating 8 heroes in a single pass needs a retry wrapper or a resumable loop. | — Pending |
| Reference-image prompting form | Verified working 2026-09-16: assigning explicit roles in caps — "Use the FIRST image as the subject and the SECOND image only as the style and lighting reference" — produced clean subject/style separation and honoured negative constraints. A single fixed style reference passed to every call holds a set together better than re-describing the style in words. Masks, `--transparent` and single-image `--edit` also verified. | ✓ Good |
| Tier 3 cost measured, not estimated | GPT Image 2.5's token consumption is unpublished and the GPT Image 2 calculator explicitly does not apply. **Partially settled 2026-09-16:** OpenAI bills image output per *token*, so the flat $0.02/$0.04/$0.08 table was only ever correct at one resolution. A measured low-quality 1024×1024 `gpt-image-2` generation billed **$0.0060**, not the $0.020 estimated — the old table ran **3.3× high**. Edits cost more than generations ($0.0142 measured) because image-input tokens count. Phase 1 still measures `gpt-image-2.5-flare` specifically; no side-by-side against `gpt-image-2` exists yet. | ⚠️ Revisit |
| Astro bindings via `cloudflare:workers` | `Astro.locals.runtime.env` was **removed** in `@astrojs/cloudflare` v13 / Astro 6. Current pattern is `import { env } from 'cloudflare:workers'`. The commonly-cited pattern is stale. | ✓ Good — implemented and guarded in Phase 3 |
| `output: 'static'`, not `'hybrid'` | `output: 'hybrid'` was merged into `'static'` in Astro v5 — the keyword is removed, not deprecated. Per-route opt-out is `export const prerender = false`. The *architecture* is still hybrid; the config keyword is gone. | ✓ Good — implemented and guarded in Phase 3 |
| `imageService` set explicitly | `@astrojs/cloudflare` has defaulted `imageService` to `cloudflare-binding` since v14.2.0 — the opposite of the build-time-Sharp assumption. Must be set explicitly to `{ build: 'compile', runtime: 'passthrough' }` or images break on deploy, which is precisely the failure the PRD warns about. | ✓ Good — implemented and guarded in Phase 3 |
| Hand-written D1 loader, not FlareCMS | The PRD cites the "FlareCMS `flareLoader` pattern" for D1 → content collections. **FlareCMS is an unfinished project and cannot be used** (owner's call, 2026-09-16); `@flare-cms/astro` is not published to npm. Replaced by a hand-written `Loader` from `astro/loaders` calling the D1 REST API. Side benefit: the fail-loud assertion below lives in our own code. No `drizzle-orm` runtime driver exists for D1-HTTP, so Drizzle does not help here. | — Pending |
| Static assets are immutable per deployment | Workers Static Assets are **not writable at request time** — they are a per-version deployment artifact. "Hot content regenerated every cron" therefore means shipping a new Worker deployment via Wrangler/CI every two hours, not writing files from a Worker. R2 *is* a live read/write store from inside a Worker. This asymmetry shapes phases 3 and 4. | — Pending |
| Grounding check, not just a length check | The PRD's rule ("flag any summary longer than its source") would **not** have caught the actual production fabrication — the invented advisory was plausible, well-formed and length-compliant. A grounding/entailment check is required and must ship in the **same phase** as the prompt rewrite, because the costed re-processing dry run depends on it. Length checking stays; it is necessary, not sufficient. | — Pending |
| Loader must fail loud | PRD §15 claims static generation "removes outright" the `/changelog` empty-state bug. It **relocates** it: a content layer loader that returns zero or partial rows without throwing is not an error to Astro's Content Loader API, so an empty page builds, deploys and caches exactly like a correct one — worse, baked into an artifact rather than a 1h cache. Explicit assertion in the loader plus a direct regression test. | — Pending |
| Fixing padding must not mean quoting more | §8.3 offers "present the source excerpt with attribution" for thin sources. Verbatim-heavy excerpting is a live legal risk for aggregators (*AP v. Meltwater*, *Dow Jones v. Briefing.com*, hot-news misappropriation). The safe posture is prominent attribution **plus genuinely transformative summarisation** — not longer quotes. | — Pending |
| CI assertion covers islands too | Server islands always trigger a real Worker request via `/_server-islands/*`, even on fully static pages. Five silent D1-reintroduction vectors were identified: search endpoint, islands, sitemap, middleware, and admin-pattern copy-paste. The assertion scans island component files, not just `.astro` pages. | ✓ Good — implemented and guarded in Phase 3 |
| Per-article AI disclosure, not just About | EU AI Act Article 50 has been in force since Aug 2026 and is becoming the de facto disclosure norm even for US-only sites. Disclosure belongs at point of consumption on each article, not only centralised on the About page. Low marginal cost — the article template is already being touched. | — Pending |
| Share cards stay deterministic composition | GPT Image 2.5 can render text well now, but the original premise is unchanged: $0 per article vs ~$300 for 37,180, and composition cannot misspell *Ysleta* or a council member's name. A garbled headline in a share card is the exact credibility damage the content-quality work exists to undo. | — Pending |
| Category heroes share identity via reference images | Multi-reference editing with assigned roles (style / subject / background) is the direct answer to eight heroes needing to read as one visual system rather than eight unrelated generations. | — Pending |
| Cloudflare Access replaces Better Auth | 1 user, 0 signup routes, no digest code. Deletes a framework, four tables, a login page and all session handling — and authenticating at the edge is more secure than a self-managed password. | — Pending |
| Subscription capture ships, digests do not | Capture is one form and one table with no compliance surface beyond confirm/unsubscribe. Sending is a deliverability commitment (SPF/DKIM/DMARC, bounce handling, shared domain reputation with the contact form). Let the list compound first. | — Pending |
| Entity following over category subscription | 46,090 entities are already extracted and surface nowhere. *"Email me when 915 TLDR covers UTEP"* is uniquely enabled by the existing pipeline and needs no accounts. Category subscription is the commodity version. | — Pending |
| Archive depth derived from traffic | The PRD's 2,000 figure is the only number in the document not grounded in a measurement. Phase 4 measures what is actually requested, then picks the cut. | — Pending |
| Search implementation left open | FTS5 lives in D1, so keeping it means the search endpoint is a public request that reads D1 — the zero-reads guarantee would need an explicit carve-out. Vectorize avoids that and handles cross-language matching, but is unproven at this corpus size. Phase research measures both. | — Pending |
| Render step location left open | Depends on cron-worker CPU headroom, which nobody has measured. Phase research decides. | ✓ Decided Phase 3: the existing 2-hour cron Worker (Option A). Measured ingest is 15 articles/cycle (62 peak) against ~1,223 capacity. A full rebuild spans ~33 cycles. See `docs/phase-03/render-step-location.md`. |
| No programmatic advertising, ever | Incompatible with Lighthouse 100 and LCP < 1.5s. Monetisation is the site-as-portfolio plus direct local sponsorship (one static image, one link, no script). | — Pending |
| Model/tool choice is decided by looking | Image quality gated on looking at 10 images; summariser gated on reading ~30 summaries of short-source articles. No public benchmark measures "does it pad a 90-word source", so a leaderboard cannot settle it. | — Pending |
| Render manifest identity: translation group | Phase 6 has not decided whether Spanish is extra columns or a separate row, so the manifest carries `translationGroupId` (the English uuid) plus `language`. It is never null and never points at a row that doesn't exist. Same shape as the existing `duplicate_groups` table. | ✓ Good — Phase 3 (03-04) |
| Staleness detection must not rescan the corpus | The bulk-fetch query reads 957,008 rows per pass, which is fine once. At 12 cron runs a day that is 11.5M rows, 2.3× the daily hard fail. Phase 4 must use an incremental signal such as `updated_at > last_render`. | — Pending (binding on Phase 4) |
| Hostnames: v2 owns `dev.`, Nuxt moves to `admin-dev.` | `dev.` is the dev-tier convention and v2 is the site. The Nuxt app is kept for pipeline and admin only, so it moves off the bare hostnames now; `admin.915tldr.com` follows at Phase 12. | ✓ Good — Phase 3 (03-05) |
| Drop the trailing slash | v2 answered `/path` with a 307 to `/path/`; v1 answers 200 directly. Nine months of indexed URLs are in the no-slash form. Use `trailingSlash: 'never'` + `build.format: 'file'`, and pass `trailingSlash: false` to `rss()`. | — Pending (Phase 4) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state

---
*Last updated: 2026-09-26 after Phase 3*

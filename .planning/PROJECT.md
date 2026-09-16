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
- [ ] Zero D1 reads on the public request path, enforced by a build-time CI assertion
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
- [ ] Automated check flags any summary longer than its source

**Bilingual**
- [ ] Spanish summaries generated at ingest, in the same model call
- [ ] `/es` routing, `hreflang` pairs, per-language sitemaps and RSS
- [ ] Language detection at ingest (also required for the `lang="es"` a11y rule)
- [ ] `/es` public launch decided on 2-4 weeks of measured data, not demographics

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
- [ ] Deployed commit hash in the footer and at `/version.json`
- [ ] `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge
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
  Node; any on-demand path uses Cloudflare Images. Getting this wrong ships broken images.
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
| Hybrid static, not pure prerender | 41,233 articles × 2 languages grows ~200 files/day; pure prerendering hits the 100,000-file ceiling in roughly **90 days**, not 18 months. A full 41k rebuild every 2h would also become the next cost problem. | — Pending |
| R2 for the archive, not KV | ~37,000 pages × ~30 KB ≈ 1.1 GB. KV includes 1 GB — over the line immediately. R2 includes 10 GB. | — Pending |
| Content quality moves to **phase 2** | The PRD put the prompt fix at phase 8 but started Spanish generation at phase 2 — which would generate fabricated advisories in Spanish for six phases, then pay to redo them. Fix the prompt before any new summary is written in either language. | — Pending |
| Summariser: `gpt-5.6-luna` | GPT-4o Mini is from Aug 2024. Luna is the small model of OpenAI's newest family — best instruction-following in the cheap tier, which is precisely the padding defect. Ongoing delta is **$0.48/month**; batched corpus backfill is **~$7.44**, *under* the PRD's existing $8.92 estimate for staying put. | — Pending |
| Stay on OpenAI; no Gemini | Gemini 2.5 Flash-Lite is 33% cheaper on both axes, but a second vendor means a second bill and a new integration surface in a pipeline described as nine months of tuning. Not worth $0.48/month. | — Pending |
| Batch API mandatory for backfills | 50% discount, 24h window, and the backfills are offline and latency-insensitive. Applies to image models too. Ongoing cron stays on standard rates. | — Pending |
| Tier 2 imagery stays on Flux-Schnell | $0.00063/image vs ~10-13× that for the cheapest OpenAI tier — ~$10 vs ~$125 for the 15,624 backfill, and ongoing (~40/day = 2,304 neurons) sits entirely inside the free 10,000/day. Not close. | — Pending |
| Tier 3 imagery: `gpt-image-2.5-flare` | `gpt-image-2` is superseded. Flare and Sunburst are **identically priced**, so the choice is speed vs quality; Flare's quality ≈ gpt-image-2 with faster turnaround, which suits generating the daily lead inside the cron window. | — Pending |
| Tier 3 cost measured, not estimated | GPT Image 2.5's token consumption is unpublished and the GPT Image 2 calculator explicitly does not apply. The PRD's ~$0.08/image and ~$1.20/month are unverified — and didn't reconcile anyway (8 heroes + a daily lead at $0.08 is $2.40/mo). One test call in phase 1 settles it. | — Pending |
| Share cards stay deterministic composition | GPT Image 2.5 can render text well now, but the original premise is unchanged: $0 per article vs ~$300 for 37,180, and composition cannot misspell *Ysleta* or a council member's name. A garbled headline in a share card is the exact credibility damage the content-quality work exists to undo. | — Pending |
| Category heroes share identity via reference images | Multi-reference editing with assigned roles (style / subject / background) is the direct answer to eight heroes needing to read as one visual system rather than eight unrelated generations. | — Pending |
| Cloudflare Access replaces Better Auth | 1 user, 0 signup routes, no digest code. Deletes a framework, four tables, a login page and all session handling — and authenticating at the edge is more secure than a self-managed password. | — Pending |
| Subscription capture ships, digests do not | Capture is one form and one table with no compliance surface beyond confirm/unsubscribe. Sending is a deliverability commitment (SPF/DKIM/DMARC, bounce handling, shared domain reputation with the contact form). Let the list compound first. | — Pending |
| Entity following over category subscription | 46,090 entities are already extracted and surface nowhere. *"Email me when 915 TLDR covers UTEP"* is uniquely enabled by the existing pipeline and needs no accounts. Category subscription is the commodity version. | — Pending |
| Archive depth derived from traffic | The PRD's 2,000 figure is the only number in the document not grounded in a measurement. Phase 4 measures what is actually requested, then picks the cut. | — Pending |
| Search implementation left open | FTS5 lives in D1, so keeping it means the search endpoint is a public request that reads D1 — the zero-reads guarantee would need an explicit carve-out. Vectorize avoids that and handles cross-language matching, but is unproven at this corpus size. Phase research measures both. | — Pending |
| Render step location left open | Depends on cron-worker CPU headroom, which nobody has measured. Phase research decides. | — Pending |
| No programmatic advertising, ever | Incompatible with Lighthouse 100 and LCP < 1.5s. Monetisation is the site-as-portfolio plus direct local sponsorship (one static image, one link, no script). | — Pending |
| Model/tool choice is decided by looking | Image quality gated on looking at 10 images; summariser gated on reading ~30 summaries of short-source articles. No public benchmark measures "does it pad a 90-word source", so a leaderboard cannot settle it. | — Pending |

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
*Last updated: 2026-09-16 after initialization*

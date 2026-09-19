# Product Requirements Document: 915tldr.com (v2 rebuild)

**Version:** 2.0
**Created:** September 15, 2026
**Supersedes:** `915tldr.com2/docs/PRD.md` (v1.0, December 18, 2025)
**Status:** Draft — pending roadmap

---

## 1. Why this rebuild exists

The v1.0 PRD set an infrastructure budget. Here it is, verbatim, next to what was measured
on 2026-09-15:

| Resource | v1.0 estimate | Measured 2026-09-15 | Ratio |
|---|---|---|---|
| **D1 reads** | ~50K/day | **784,000,000/day** | **15,680x** |
| D1 writes | ~1K/day | ~1.2K/day | on target |
| Worker requests | ~10K/day | ~10.5K/day | on target |

Traffic matched the forecast almost exactly. **Reads did not.** The site is doing roughly
75,000 row reads to serve a single request, on a low-traffic community news site nobody
promotes.

The cause is not bad code. It is that **every page recomputes aggregates over the full
article table on demand**, for content that only changes twelve times a day when the cron
runs. Measured per uncached call against production:

| Endpoint | rows read |
|---|---|
| `/api/tags` | 408,969 |
| `/api/stats` | ~80,000 |
| `/api/categories` | 74,525 |
| `/api/articles` `COUNT` (unfiltered) | 37,181 |
| `/api/articles` `COUNT` (per-category) | 15,228 |

Nothing watched this number for nine months. That is the actual defect, and it is the one
this rebuild must fix permanently — not by writing faster queries, but by removing the
read path from the request path entirely.

### Secondary drivers

- The public site is a Nuxt SSR app rendering content that is ~95% static between cron runs.
- The UI has not been revisited since launch and does not reflect the project's ambition.
- 42% of articles display no meaningful image; several hundred display a 72x72 emoji sprite.
- Nine months of Cloudflare platform capability (Workers Static Assets, Workers AI,
  server islands) is unused.

---

## 2. Goals and non-goals

### Goals

1. **D1 reads on the public request path: zero.** Not "lower" — architecturally zero.
2. A public site that is genuinely static, generated at cron time.
3. An editorial visual identity worth the content behind it.
4. Article imagery that never reads as recycled.
5. **A read budget that is enforced and watched**, so this cannot silently drift again.
6. **WCAG 2.2 AA, Lighthouse 100 on accessibility and SEO, and Core Web Vitals inside
   target** — enforced in CI, not aspirational. See section 6.
7. **Bilingual by construction** — English and Spanish generated at ingest, `/es` launched
   on evidence. See section 7.
8. **Summaries that do not invent.** No published summary contains material absent from its
   source. See section 8.

### Non-goals

- **Rewriting the ingestion and AI pipeline.** RSS fetch, duplicate detection and embedding
  work, and represent nine months of tuning. Out of scope — **with one exception: content
  extraction and the summary prompt, see section 8.4.** That is a correctness defect, not an
  optimisation.
- **Rewriting the admin.** ~30 endpoints, working, seen only by the owner. It moves, it does
  not get rebuilt — except for its authentication, see below.
- **Migrating data.** The D1 schema and its contents stay exactly where they are.
- **Expanding news sources.** Deferred to v2.1 — see section 19. The rebuild ships against
  the existing three so that source changes never confound the architecture work.
- **Reader accounts and digests.** Subscription *capture* ships (section 10); digests and any
  auth framework do not. Comments are declined outright — see 12.2.
- Personalisation or a mobile app. Still v3+ material.

### What is explicitly preserved

| Asset | Size | Note |
|---|---|---|
| `articles` | 41,233 rows | irreplaceable; nine months of OpenAI spend |
| `tags` | 18,007 | |
| `entities` | 46,090 | |
| `article_tags` | 177,504 | |
| D1 database | 435 MB | same database, same bindings, no migration |
| `public_changelogs` | — | powers `/changelog`; history preserved |

### Build in public — retained and elevated

The `/changelog` page stays, and its framing stays: *"915 TLDR is being built in the open.
Every feature, fix, and improvement is documented here as it happens. Because transparency
builds trust, and this site belongs to El Paso — not just its creator."*

It is one of the more distinctive things about the project and it survives the rebuild intact:

- Existing entries carry forward; the timeline is not reset
- The plain-English writing rule holds — entries are for El Paso residents, not developers
- The rebuild itself gets documented there as it happens, including this architecture change
- It earns a proper editorial treatment in the new design rather than a bulleted list

---

## 3. Architecture

Three deployables against one unchanged database.

```
                     ┌──────────────────────────┐
  RSS sources ─────► │  Pipeline + Admin        │  (existing Nuxt app, retained)
                     │  admin.915tldr.com       │
                     │  cron every 2h           │
                     └────────┬─────────────────┘
                              │ writes
                     ┌────────▼─────────────────┐
                     │  D1: 915tldr-db          │  unchanged schema + data
                     └────────┬─────────────────┘
                              │ read ONLY at cron time
                     ┌────────▼─────────────────┐
                     │  Build/render step       │  generates HTML
                     └────┬──────────────┬──────┘
                          │              │
              ┌───────────▼────┐   ┌─────▼──────────────┐
              │ Static assets  │   │ R2: rendered HTML  │
              │ (hot content)  │   │ (archive)          │
              └───────────┬────┘   └─────┬──────────────┘
                          │              │
                     ┌────▼──────────────▼──────┐
                     │  915tldr.com (Astro 7)   │  0 D1 reads
                     └──────────────────────────┘
```

### 3.1 Public site — Astro 7, hybrid static

**Decision: hybrid, not pure static.**

Workers Static Assets caps at **100,000 files per Worker version** on the Paid plan (20,000
on Free; requires Wrangler >= 4.34.0, currently 4.131.2). At 41,233 articles growing ~100/day,
pure prerendering fits today and reaches the ceiling in roughly 18 months. A full 41k-page
rebuild every two hours would also become the next cost problem.

| Content | Delivery | Regenerated |
|---|---|---|
| Homepage, category pages, tag pages, static pages | Static asset | every cron |
| ~2,000 most recent articles | Static asset | incrementally |
| Older articles | Rendered HTML in R2 | once, at ingest |
| Weather, 7-day forecast, "updated Xm ago" | Astro server island | per request |
| Search | Island, hitting a search-only endpoint | — |

Only new and changed articles re-render. The archive is written once and never recomputed.

**Archive store: R2, not KV.** KV includes 1 GB of storage; ~37,000 rendered pages at ~30 KB
is roughly 1.1 GB, which lands over the line immediately. R2 includes 10 GB. KV remains the
right store for small hot values (render manifest, precomputed counts).

**Re-rendering is cheap and involves no AI.** A full archive re-render is ~37,000 R2 writes
against 1,000,000 Class A operations included per month. Changing a template is not an
expensive operation. See section 4.1.

### 3.2 Pipeline + admin — retained Nuxt app

Moves to `admin.915tldr.com`. Gains one responsibility: after each cron run, generate the
render manifest and trigger the public site's incremental build.

Rebuilding this would be weeks of work for zero user-visible benefit, and it is where the
regression risk lives. It stays.

**One exception: authentication is removed, not ported.**

Measured 2026-09-15: the `user` table contains **1 row**. There is no reader registration, no
subscription, no digest, and no newsletter anywhere in the codebase — `RESEND_API_KEY` is used
only by the contact form. Better Auth is a full authentication framework, plus four tables
(`user`, `session`, `account`, `verification`) and a login page, guarding a single-user admin.

Replaced by **Cloudflare Access** (Zero Trust), free for up to 50 users, which authenticates
at the edge before a request reaches the Worker. This deletes Better Auth, its four tables,
`/admin/login`, and all session handling — and is more secure than a self-managed password.

If reader accounts ever ship (digests, saved articles), real authentication returns then.
Building it now for a user base of one is the kind of weight that produced this rebuild.

### 3.3 Data

No migration. Same database, same schema, same bindings. Additive changes only (for example
a table recording generated-image assignments). The v2 site can be built, deployed and
validated while v1 is still serving, because neither writes to anything the other reads.

---

## 4. Performance budget — the guardrail

This is the section the v1.0 PRD had and nobody ever checked. It is now a requirement with
a test attached.

| Metric | Budget | Hard fail |
|---|---|---|
| **D1 reads per public request** | **0** | > 0 |
| D1 reads per day, total | < 2,000,000 | > 5,000,000 |
| D1 writes per day | < 5,000 | > 20,000 |
| KV reads per public request | <= 1 | > 2 |
| Worker CPU per public request | < 5 ms | > 20 ms |
| LCP (mobile, p75) | < 1.5 s | > 2.5 s |
| CLS | < 0.05 | > 0.1 |

**Enforcement, all three required:**

1. **CI check** — a build-time assertion that no public route imports the D1 binding.
   Structural, not advisory: if a public page can reach D1, the build fails.
2. **Daily routine** — a scheduled Claude Code routine (`/schedule`) queries the Cloudflare
   D1 analytics API, compares against the budget above, and reports. This is the thing that
   would have caught the 15,680x drift in week one instead of month nine.
3. **Budget stated in the README** — so the number is visible to whoever reads the repo next,
   including a future model.

---

## 4.1 Cost controls — no unexpected bills

A previous remediation attempt on this project produced an unforecast ~$40 AI charge. That
must not recur. Every operation in this rebuild that can cost money is listed here with its
ceiling. **Anything not on this list does not spend money.**

### What costs nothing

| Operation | Why it is free |
|---|---|
| Rendering 37,180 pages to HTML | Worker CPU + R2 writes; no model is called |
| Full archive re-render after a template change | ~37,000 R2 writes vs 1,000,000/month included |
| Serving the site | Static assets are free; R2 reads well inside the included tier |
| Migrating the data | Nothing moves |
| Cloudflare Access | Free up to 50 users |

**Re-rendering is not re-processing.** The ~$40 charge came from pushing the article corpus
back through GPT-4o Mini. Articles already carry their summaries, tags and categories; the
rebuild reads those and emits HTML. **No article is ever re-summarised as part of this work.**

### What costs money

| Operation | Ceiling | Gate |
|---|---|---|
| Image quality test (10 images, Flux-Schnell) | **~$0.01** | none needed |
| Image backfill, 15,624 articles | **~$10 one-time** | **explicit approval, after the test** |
| Ongoing per-article images (~40/day) | **$0** — inside the free 10,000 neurons/day | — |
| Category + daily hero images (gpt-image-2) | ~$1/month | approval at phase 5 |
| Workers AI vs OpenAI summarisation trial | < $1 | approval before running |
| Spanish summaries, full archive backfill (section 7) | **~$4 one-time** | approval at phase 8 |
| Summary re-processing after the prompt fix (section 8) | **~$5-9 one-time** | **dry run, then approval** |

**On the re-processing line specifically.** This is the one operation in the rebuild that
re-runs a model over existing articles — the same class of work that produced the unforecast
~$40 charge previously. It is scoped and costed here so it cannot surprise anyone:

- GPT-4o Mini at $0.15/M input, $0.60/M output
- ~800 input tokens + ~200 output tokens per article
- Re-processing only the affected subset (~20,000 of 37,180, those with thin or truncated
  source) rather than the whole corpus: **~$5**
- Whole corpus including Spanish summaries, worst case: **~$13**

It runs once, after a dry run reporting exact row count and projected cost, and only on
explicit approval. It does not run on a schedule and it does not run again.

### Rules

1. **No operation that spends more than $1 runs without explicit approval**, stated in
   advance with an estimate.
2. **No bulk operation over the article corpus runs without a dry run first** reporting row
   count and projected cost.
3. **The image backfill is gated on a 10-image quality test.** If Flux-Schnell output is not
   good enough, the backfill does not happen and the budget goes to a smaller gpt-image-2 set
   instead. This decision is made by looking at images, not by assuming.
4. The daily budget routine (section 4) reports spend alongside reads.

---

## 5. Design

### 5.1 Direction

**Editorial, 1990s magazine — bold and colourful, not monochrome newsprint.**

The reference is *Wired* circa 1993-96 and that era's editorial design: oversized display
type, confident colour blocking, visible rules and section furniture, pull quotes as
structural elements. Not Memphis-pattern retro pastiche.

**Sense of place.** The palette derives from the Chihuahuan desert and El Paso itself —
sun-bleached terracotta, turquoise, marigold, deep indigo night sky — rather than a generic
retro template. Each of the eight categories owns a colour from that system.

**Bold in the chrome, disciplined in the grid.** 1990s magazine layouts were print:
asymmetric, layered, type over image. People *scan* a news site. So: loud headers, category
system, pull quotes and dividers; clean and legible article grid. The failure mode to avoid
is a site that photographs beautifully and reads badly.

### 5.2 Typography

| Role | Face | Note |
|---|---|---|
| Wordmark "915 TLDR" | **Instrument Serif** | single weight; never synthesised bold |
| Headlines | **Source Serif 4 Bold** | 700, variable wght |
| Body / UI | **Source Serif 4** | variable, designed for screen reading |

Serif throughout. Deliberately **not** Playfair Display or Merriweather (the current
headline face) — both are signatures of AI-generated sites.

**Amended 2026-09-17 — owner decision D-GAP-B (Phase 1 review):** "not too crazy about the
thin font for the headings". Previously: Instrument Serif for display/headlines.

### 5.3 Theme

**Light default, dark secondary.** The current site is dark-first, which suits a dashboard
and not a newspaper. Both themes fully designed; light is the one that gets the attention.

### 5.4 Motion

- Page transitions via Astro `ClientRouter` (View Transitions)
- Scroll and intersection effects via VueUse
- Subtle and structural — motion that explains hierarchy, not decoration
- `prefers-reduced-motion` respected throughout, no exceptions
- No animation permitted to affect LCP or CLS; the budget in section 4 governs

### 5.5 Interactivity — Vue islands

`@astrojs/vue`, with VueUse. **Islands are for genuine interaction only**: search, category
filter, theme toggle, load-more, weather. The article grid stays pure HTML — if it renders
as an island, the architecture has failed.

### 5.6 Process — sketch before build

**Static HTML/CSS mockups first**, before anything touches Astro or real data. Flat files,
hand-written, iterated until the look is right. Only then does it become components.

Nothing gets wired to 41,233 articles until the design is settled and approved.

---

## 6. Quality gates: accessibility, SEO, performance

These are **release-blocking requirements**, not aspirations. A local news site that fails an
accessibility audit or Core Web Vitals has no standing to call itself professional work.

### 6.1 Accessibility — WCAG 2.2 Level AA

**Target: WCAG 2.2 Level AA, fully met.** AAA is adopted where it comes free (contrast on
body text, for instance) but is not the headline claim: full AAA demands 7:1 contrast on all
text, no images of text, and sign-language interpretation for video. It is not achievable for
a colour-forward editorial design, and claiming it would be false. AA is the level that
ADA and Section 508 enforcement actually uses.

Requirements:

- **Contrast** — 4.5:1 body text, 3:1 large text and UI components, verified per theme. The
  bold category palette in section 5 is constrained by this, not the reverse.
- **Keyboard** — every interactive element reachable and operable, visible focus indicators
  that are not clipped, logical tab order, working skip link.
- **Semantics** — one `h1` per page, correct heading hierarchy, landmark regions, real
  `<button>`/`<a>` rather than clickable `div`s.
- **Images** — meaningful `alt` on content images; `alt=""` on decorative ones. Generated
  imagery gets alt text derived from the article, never the filename.
- **Language** — `lang` on `<html>`, and **`lang="es"` on Spanish-language articles**. The
  corpus already contains Spanish content from local feeds; announcing it as English is a
  real screen-reader failure. Language detection happens at ingest.
- **Motion** — `prefers-reduced-motion` honoured for every transition and animation.
- **Forms** — labels tied to inputs, errors announced, contact form fully keyboard-operable.
- **Zoom** — usable at 200% zoom and 320px width without horizontal scroll or content loss.

Verified with `jja-lighthouse` (axe-based) plus manual keyboard and screen-reader passes.
Automated tooling catches roughly a third of real issues; the manual pass is not optional.

### 6.2 Core Web Vitals

Field metrics, mobile, p75. Note **INP replaced FID** — FID is retired and is not a target.

| Metric | Google "good" | **Our target** | Blocks release |
|---|---|---|---|
| LCP | < 2.5 s | **< 1.5 s** | > 2.0 s |
| INP | < 200 ms | **< 100 ms** | > 200 ms |
| CLS | < 0.1 | **< 0.05** | > 0.1 |
| FCP | < 1.8 s | **< 1.0 s** | > 1.8 s |
| TBT (lab) | < 200 ms | **< 100 ms** | > 300 ms |

We target well inside "good" because the site is **static HTML off an edge cache**. If a
prerendered page cannot beat these numbers, something is wrong with the implementation.

### 6.3 Lighthouse

| Category | Target | Blocks release |
|---|---|---|
| Performance | 100 | < 95 |
| Accessibility | 100 | < 100 |
| Best Practices | 100 | < 95 |
| SEO | 100 | < 100 |

Accessibility and SEO must be 100. Both are objective checklists on a static content site;
anything less is an unfixed defect. Run across representative pages — home, category, article,
changelog, contact — not just the homepage, via `jja-unlighthouse`.

### 6.4 Images — `astro:assets`

- `<Image>` / `<Picture>` from `astro:assets` for every content image
- **`srcset` + `sizes`** on all responsive imagery; AVIF and WebP with fallback
- **Explicit `width`/`height`** on every image — this is the main CLS defence
- `fetchpriority="high"` and no lazy-loading on the LCP image; `loading="lazy"` below the fold
- Remote source images (58% of articles come from KVIA/KTSM) pass through
  `image.domains` / `remotePatterns` so they are optimised rather than hotlinked raw

**Build-time vs runtime:** Sharp does not run on Cloudflare Workers. Because pages are
prerendered, optimisation happens at **build time in Node**, where Sharp is fine. Any
on-demand path uses Cloudflare Images instead. This distinction is easy to get wrong and
produces broken images on deploy.

### 6.5 Fonts

Source Serif 4 and Instrument Serif, **self-hosted, not fetched from Google at runtime**.

- Subset to the characters actually used, including Spanish diacritics
- `woff2` only
- `font-display: optional`, with `<link rel="preload">` for the above-the-fold faces — each page
  view renders either the webfont from first paint or the metric-compatible fallback throughout;
  there is no mid-render swap and so no swap-triggered layout shift. Fallbacks keep `size-adjust`
  metric compatibility because the fallback-kept view still has to look right.
- Variable fonts where available, to cut requests

Amended 2026-09-17 — owner decision D-GAP-A during the Phase 1 design review (see
.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md). Previously: font-display: swap.

### 6.6 SEO

Static prerendering already wins most of this. What must be explicit:

- **Structured data** — `NewsArticle` per article (headline, datePublished, dateModified,
  author, publisher, image), `BreadcrumbList`, `Organization`, `WebSite`. Validated, not
  merely emitted.
- **Google News sitemap** for articles from the last 48 hours, alongside the main sitemap.
  This is how a news aggregator gets indexed quickly and the current site does not have one.
- **Canonical URLs** on every page; the `/[category]/[slug]-[uuid]` scheme carries over so
  nine months of indexed URLs keep resolving.
- **Open Graph and social cards** — see 6.8, treated as a first-class surface.
- **`robots.txt`** — port the existing per-bot policy, including AI-crawler rules and
  `Content-signal` directives. That work is good and should not be lost.
- **RSS** preserved at `/rss.xml`.
- **Source attribution** — articles are summaries of others' reporting. Canonical links back
  to the original outlet stay prominent, for ethics as much as SEO.
- **404s** — the existing suggestion endpoint carries over.

### 6.7 Mobile

Mobile-first, not mobile-tolerated. Most local news traffic is phones.

- Fluid layout from 320px up, no horizontal scroll at any width
- Tap targets at least 44x44px with adequate spacing
- Text readable without zoom; no viewport-locking
- Tested on real viewport sizes, not just a desktop browser narrowed

### 6.8 Open Graph and social sharing

For a local news aggregator, the share card **is** the product on social platforms. Most
people will see a 915 TLDR card in a feed long before they see the site. It is treated as a
designed surface, not a meta tag afterthought.

**Required tags, every page:**

- `og:title`, `og:description`, `og:url` (canonical), `og:site_name`, `og:type`
  (`article` for articles, `website` elsewhere), `og:locale` — with `og:locale:alternate` for
  the Spanish counterpart (section 7)
- `og:image`, plus `og:image:width`, `og:image:height`, `og:image:alt`, `og:image:type`.
  Dimensions are not optional — omitting them makes platforms skip or crop the preview.
- Article-specific: `article:published_time`, `article:modified_time`, `article:section`
  (category), `article:tag`, `article:author`
- `twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`,
  `twitter:image`, `twitter:image:alt`

**Image requirements:**

- **1200x630** (1.91:1), under 5 MB, absolute HTTPS URL — never relative
- Every article has a real image via the tiers in section 9; **no article ever shares with a
  blank or generic card**, which is the current failure mode for the 42% with no usable image
- Generated at build time alongside the page, stored in R2

**Generated share cards.** Where an article has no strong photograph, generate a branded card
at build time: headline in Instrument Serif, category colour block, 915 TLDR mark, source
attribution. This is deterministic image composition, not AI generation — no per-article cost,
and it guarantees every share looks intentional. [Headline face under review after D-GAP-B —
re-decide when share cards are built.]

**Validation is part of the definition of done.** Cards are checked in the Facebook Sharing
Debugger, X Card Validator, and by pasting real links into iMessage, WhatsApp and Slack —
WhatsApp in particular matters here and is the strictest about image size and absolute URLs.
"The tags are present in the HTML" is not verification; someone looks at the rendered card.

### 6.9 Enforcement

Same principle as the read budget: **a target nobody measures is a target that drifts.**

1. **CI gate** — Lighthouse CI on the representative page set; build fails below the
   blocking thresholds in 6.3.
2. **Phase gate** — the design phase does not close until mockups pass contrast and keyboard
   review. Retrofitting accessibility into a finished design is where it usually fails.
3. **Ongoing** — the daily routine reports Core Web Vitals field data alongside D1 reads.

---

## 7. Bilingual — English and Spanish

### 7.1 Why

El Paso is 80%+ Hispanic, but that statistic alone does not justify this: most El Pasoans are
bilingual and English-dominant for media. Two better reasons:

1. **The households that need Spanish news are genuinely underserved** — older residents,
   recent arrivals, and Spanish-dominant homes. No local aggregator serves them.
2. **Juárez.** 1.4 million people, ten minutes away, Spanish-first, sharing most of the same
   news events: crime, weather, border, economy. No English-language aggregator serves them
   and no Juárez outlet aggregates El Paso. The metro area is binational and the current site
   serves half of it.

Current corpus: roughly **565 of 37,180 articles (1.5%)** originate in Spanish.

### 7.2 Cost — negligible

The pipeline already sends every article to a model. Requesting a Spanish summary **in the
same call** costs only the additional output tokens.

| | cost |
|---|---|
| Backfill all 37,180 articles | **~$4 one-time** |
| Ongoing (~100/day) | pennies per month |

Translation is not the expensive part. Retrofitting the architecture is.

### 7.3 Architectural consequences — decide now, not later

- **Page count doubles**, ~41k to ~82k. This alone exceeds the 100,000 static-asset ceiling,
  which makes the R2 archive in section 3.1 structural rather than optional.
- `/es/...` routing, `hreflang` pairs on every page, per-language sitemaps and RSS
- **Language detection at ingest** — also required by the `lang="es"` accessibility rule in
  section 6.1, so it is needed regardless
- **Spanish text runs 15-25% longer than English.** Headline and card layouts must survive
  that, which is a design constraint in phase 1, not a bug found in phase 6.

### 7.4 Editorial risk

Unreviewed machine translation of news is not consequence-free. A mistranslated crime,
health, or immigration story in a border community can do real harm. Requirements:

- Summaries are disclosed as AI-generated, in both languages — consistent with the
  build-in-public ethos
- Canonical link to the original source is prominent, so a reader can always check
- Spot-check process before `/es` launches publicly

### 7.5 Launch gate

**Build bilingual-ready from day one; launch `/es` on evidence, not demographics.**

1. Generate Spanish summaries at ingest from the start of the rebuild
2. Architect `/es` routing, hreflang and the doubled page count into phases 2-4
3. Log `Accept-Language` at the edge and install analytics on the **new** site
4. Decide the public launch of `/es` after 2-4 weeks of real data

The content and architecture are ready either way; only the decision to surface it waits.

---

## 8. Content quality — summaries and extraction

Measured 2026-09-15. This section exists because the honest answer to "are readers getting
enough from the TLDR?" turned out to be "in 39% of cases they are getting *more* than the
source contained, and some of it is invented."

### 8.1 What was measured

| Metric | Value |
|---|---|
| Average summary | 848 chars (~154 words) — inside the prompt's 100-200 word instruction |
| Average source content | 3,219 chars (~585 words) |
| Overall compression | 26.3% retained |
| **Source content under 500 chars (~90 words)** | **14,619 (39.3%)** |
| Average summary for those | **616 chars (~112 words)** |
| Source visibly truncated with `[...]` | 5,463 (14.7%) |
| Summaries containing an advisory phrase | 6,182 (16.6%) |

### 8.2 Two defects

**Defect 1 — extraction truncates.** 14.7% of stored content ends mid-sentence with a `[...]`
marker, and 39.3% is under 90 words. The model is summarising a fragment, not an article.

**Defect 2 — the prompt sets a word floor regardless of input.** It asks for a "comprehensive
TLDR (100-200 words, 3-5 sentences)" with the stated goal that readers "understand the full
story without needing to read the original." When the source is 90 words, the model pads.

Observed padding, verbatim from production:

> *"This event raises concerns about safety and security in the area, particularly for
> businesses. Residents and dealership owners are urged to remain vigilant and report any
> suspicious activity to the authorities."*

The source reported only that a man was arrested for arson at a dealership. **Nobody urged
anything.** The advisory was generated to fill the word count, and it reads like official
guidance. A share of the 16.6% figure is legitimate — police do issue advisories — but with
39% of sources under 90 words, much of it is fabrication.

On a news site, in a border community, this is a credibility and potentially a harm issue.

### 8.3 Requirements

1. **Fix extraction first.** A summary of a truncated fragment cannot be correct no matter how
   good the prompt is. Diagnose the `[...]` truncation before touching the prompt.
2. **Length proportional to source.** No fixed floor. A 90-word source gets a short summary or
   none at all — presenting the source excerpt with attribution is better than padding it.
3. **Explicit prohibition in the prompt** on adding advisories, calls to action, impact
   analysis, or editorial framing not present in the source.
4. **Re-process the affected archive** once the prompt is fixed — scoped, costed and approved
   under the section 4.1 rules. This is the one operation in the rebuild that legitimately
   needs to re-run the model over existing articles.
5. **Automated check**: flag any summary longer than its source for review.

### 8.4 Scope change

Section 2 lists the ingestion and AI pipeline as a non-goal. **This is the exception.** It is
not an optimisation — it is a correctness and trust defect affecting one in six published
summaries. Fixing it is in scope; the rest of the pipeline is not.

---

## 9. Imagery

### 9.1 Current state (measured, 37,180 processed articles)

| | count | share |
|---|---|---|
| Usable source image | 21,556 | 58.0% |
| No image at all | 14,526 | 39.1% |
| Emoji sprite (`s.w.org/.../emoji/72x72/*.png`) | 556 | 1.5% |
| Generic station art | 542 | 1.5% |

The ingester takes the first image in the RSS item. WordPress feeds inline emoji as images,
so several hundred articles display a 72x72 waving hand or microphone as their hero.

### 9.2 Strategy — three tiers

**Tier 1 — source image (58%, free).** Used when genuinely usable. Requires an ingest-time
filter rejecting emoji sprites, known generic placeholders, and anything below a minimum
dimension. This filter is retroactive: it reclassifies the existing 1,098 junk images.

**Tier 2 — per-article generation via Workers AI (~$10 one-time, $0/month ongoing).**

`@cf/black-forest-labs/flux-1-schnell` on the already-bound `env.AI` costs 4.80 neurons per
512x512 tile plus 9.60 neurons per step. A 1024x1024 image at 4 steps is **57.6 neurons,
about $0.00063** — roughly 32x cheaper than `gpt-image-2`'s cheapest tier.

| | gpt-image-2 (low) | flux-1-schnell |
|---|---|---|
| Per image | $0.02 | **$0.00063** |
| Backfill 15,624 articles | $312 | **~$10** |
| Ongoing (~40/day) | ~$24/month | **$0** |

Workers Paid includes **10,000 neurons/day at no charge** — about 173 images per day at this
size. Roughly 40 new articles per day need a fallback, so ongoing generation sits entirely
inside the free allocation. Backfill can either be paid for at once (~$10) or spread across
~90 days inside the daily allowance.

This supersedes the curated-library approach. Every article gets its own image, so the
recycled-image problem disappears by construction rather than by hashing into a pool.

**Tier 3 — bespoke hero images (~$1/month).** Flux-Schnell's quality is below `gpt-image-2`
and shows at full-bleed size. The 8 category hero images and the daily lead story use
`jja-imagen` (`gpt-image-2`, high quality, ~$0.08) where the image is actually seen large.

**Total: ~$10 one-time, ~$1/month ongoing.**

Cost reference: `gpt-image-2` $0.02 low / $0.04 medium / $0.08 high. Workers AI $0.011 per
1,000 neurons above the free daily 10,000.

### 9.3 Storage

Generated images land in R2 (`BLOB`, already bound), served through Cloudflare Images for
resizing and format negotiation. Assignments recorded in D1 so they survive rebuilds.

---

## 10. Reader subscription

### 10.1 Subscription is not registration

These are routinely conflated and the difference is large:

| | Needs | Ongoing obligation |
|---|---|---|
| **Subscription** | email address + preferences, one D1 row | a confirm link and an unsubscribe link |
| **Registration** | passwords, resets, sessions, GDPR/CCPA data rights, breach surface | permanent |

**Digests need only the first.** No password, no login, no session. Preference changes go
through a magic link — one token, one row. This is how newsletters work.

Better Auth was never a reader system: measured 2026-09-15, one user, zero signup routes, no
digest code. `@sidebase/nuxt-auth` is not an option either, since the public site is Astro.
If reader accounts are ever genuinely needed, Better Auth is framework-agnostic and returns
then. **No auth framework ships in v2.**

### 10.2 Architecturally compatible

A subscribe form is a **write**. A digest is generated by **cron**. Neither touches the public
read path, so the zero-D1-reads guarantee in section 4 survives intact.

### 10.3 What ships in v2 — capture only

One form, one table:

- Email address, confirmed via double opt-in
- Category subscriptions (the eight existing categories)
- **Entity follows** — see 10.4
- Preferred language, English or Spanish (section 7)
- Unsubscribe token

That is roughly a day of work and carries no compliance surface beyond confirm and
unsubscribe links.

### 10.4 Entity following — the differentiator

The corpus already contains **46,090 extracted entities**: people, places, organisations.
That makes a feature possible that no other local outlet can offer:

> *"Email me when 915 TLDR covers UTEP."*
> *"Notify me about El Paso Water."*
> *"Anything about my city council district."*

Category subscription is the commodity version. **Entity following is the one that is
uniquely enabled by the pipeline already built**, and it needs no accounts — an email address
and a list of entity IDs.

Note that "subscribe to a specific article" does not work as a concept: articles do not
update, so there is nothing to notify about. Following a *topic* is the real want.

### 10.5 Digests — deferred, and gated

**Digests do not ship in v2.** A daily email to three people is not worth the operational
surface. Build the capture, let the list compound, decide on evidence.

**Trigger to build:** the list clears roughly 50-100 confirmed subscribers **and** analytics
confirm real human traffic. Both measurable; neither guessable today.

**Sending:** Cloudflare Email Service (Beta, Workers Paid), not Resend — consistent with the
`jja-lead-form` rule. Sends to verified destination addresses are free; sending to arbitrary
recipients requires onboarding a sending domain first. New accounts start on a conservative
daily quota that scales with sending reputation.

**The real cost is deliverability, not code:**

- SPF, DKIM and DMARC on the sending domain
- **One-click `List-Unsubscribe`** — required by CAN-SPAM and by Gmail/Yahoo bulk-sender rules
- Bounce and complaint handling, list hygiene

**Shared-reputation risk:** `915tldr.com` sending reputation is shared with the contact form
and any other mail from that domain. A stale list with high bounce rates damages all of it.
A newsletter is an operational commitment, not a feature.

---

## 11. Identity — who built this

The current About page describes the product. It should describe the person.

For a community news site, **trust is personal**. A faceless AI aggregator scraping local TV
stations is easy to distrust; a named person in El Paso who built it in the open and documents
every change is not. The build-in-public changelog already leans on this — the About page
should finish the thought.

Requirements:

- Real name, photo, and why this exists — written in first person
- **How the AI works, plainly**: what is automated, what is summarised, where the reporting
  actually comes from, and that the summaries are AI-generated
- Prominent attribution to the original outlets. 915 TLDR summarises other people's
  journalism; saying so clearly is both ethics and credibility.
- Contact route that is not a form-only dead end
- Links to `jjaimealeman.com` and `915website.com`

Reference: `915website.com/about` is the tone to match.

This page is also the monetisation funnel described in section 12.3 — it is where a local
business that likes the site finds out who can build them one.

---

## 12. Product opportunities — what this could become

Not scope for the rebuild. Captured because the assets that make these possible already exist
and would otherwise be forgotten.

### 12.1 Ranked by leverage

**1. Entity pages.** 46,090 entities are already extracted and currently surface nowhere. A
page per person, place and organisation — *everything 915 TLDR knows about UTEP, El Paso
Water, the mayor* — turns a news feed into a local knowledge base. Enormous SEO surface and
genuinely useful. Constrained by the page-count ceiling in section 3.1, so start with the top
few hundred entities by article count, not all 46,090.

**2. Story threads.** Duplicate detection already groups articles covering the same event.
Extend it across time: *"this story has been covered six times over three weeks — here is the
timeline."* Readers want the thread; no local TV station provides one.

**3. Border wait times — already built, port it.** The highest-frequency local utility in
this metro. Everyone in El Paso and Juárez checks bridge waits, and it is not news, it is
*habit* — the thing that makes a site a daily open rather than an occasional read. Pairs
naturally with the binational argument in section 7.

**This does not need designing.** A working implementation exists at
`logistics.915website.com/server/utils/border.ts`: source `https://bwt.cbp.gov/api/bwtnew`
(public federal open data, no key), KV-cached, with stale-data handling that fails loudly
rather than rendering an empty board that reads as "no delays anywhere". Port it.

**4. Air quality.** Border-region pollution and dust events are a real local health concern
and a genuine daily utility. Pairs with the weather island and the border board as a single
"El Paso right now" strip.

**5. Semantic related articles.** The `articles-semantic` Vectorize index is bound and barely
used. Related-by-meaning rather than by shared tag, at no per-request D1 cost.

**6. "On this day."** Fourteen months of El Paso news is now an archive. *What happened here
this week last year* is a feature no local outlet offers and costs nothing to compute.

**7. Civic layer.** Council agendas, election information, public meeting calendars. This is
where "serves the community in ways other outlets cannot" becomes literally true — and where
the El Paso Matters source gap in section 18 matters most.

### 12.2 Considered and set aside

**Coverage-gap analysis** — showing which source covered a story and which did not is
technically easy and genuinely novel, but it turns a neutral aggregator into a media critic
and picks fights with the outlets whose work the site depends on. Interesting; not worth it.

**Comments.** Moderation is an unbounded commitment for a solo operator.

### 12.3 Monetisation — an honest assessment

**Programmatic ad networks are incompatible with this PRD.** AdSense and equivalents load
hundreds of kilobytes of third-party JavaScript. Lighthouse 100 and LCP under 1.5 seconds
(section 6) cannot survive it. That is a genuine either/or, and it should be decided
deliberately rather than discovered later.

What does work:

1. **The site as portfolio.** This is the strongest and most immediate. A fast, beautiful,
   accessible, bilingual local site is the best sales asset `915website.com` has — local
   businesses see it and want one. The About page in section 11 is the funnel. Realistically
   this is the return in year one.
2. **Direct local sponsorship.** One self-hosted static image and a link — no network, no
   script, no performance cost. *"This week's weather, brought to you by [local business]."*
   Higher effective rate than programmatic and it does not violate the budget.
3. **Newsletter sponsorship**, once the section 10 list exists. Historically the best
   monetisation for local newsletters, and it costs the site nothing.
4. **Member support** — a tip link. Low yield, but honest and cheap.

Local news monetisation is genuinely hard. The realistic position: infrastructure costs a
few dollars a month, the site pays for itself as a demonstration of capability, and direct
sponsorship becomes viable only once there is an audience to report on.

---

## 13. Build, deploy and environments

### 13.1 Environments

Three hosts, matching the existing convention.

| Host | Purpose | Indexed |
|---|---|---|
| `915tldr.com` | Public site — Astro, static | yes |
| `dev.915tldr.com` | Staging, same build, dev database | **no — `noindex` enforced** |
| `admin.915tldr.com` | Pipeline + admin, behind Cloudflare Access | no |

`dev.` must carry `X-Robots-Tag: noindex` at the edge, not merely a meta tag — a staging copy
of a news site is a duplicate-content problem and it has been an issue on this account before.
See the `jja-cloudflare-deploy` skill for the zone-routing traps.

### 13.2 Build identification — git hash in the footer

**The deployed commit hash appears in the site footer, publicly.**

The reason is operational, not decorative: with a static site regenerated on a cron, "is the
fix actually live?" becomes a genuinely hard question. Tonight's session lost real time to
exactly that class of problem — a cached page served from a render made hours earlier. A hash
in the footer answers it in one glance.

- Short hash (7 chars), linked to the commit if the repo is public, plain text if not
- Build timestamp alongside it
- Injected at build time from `git rev-parse --short HEAD`, not read at runtime
- Also exposed at `/version.json` for the budget routine and for scripted checks

Visible to everyone is fine and intended. It is a build-in-public project (section 2).

### 13.3 Local data layer

The site already carries a weather widget. Treated as a first-class "El Paso right now"
surface rather than a decoration, it becomes a reason to visit daily.

| Data | Source | Cost | Status |
|---|---|---|---|
| Weather | `api.weather.gov` (NWS), grid `EPZ/86,64` | free, no key | **exists** |
| 7-day forecast | **same response, already fetched** | **free** | see below |
| Border wait times | `bwt.cbp.gov/api/bwtnew` | free, no key | implementation exists |
| Air quality | TBD (AirNow or equivalent) | free tier | new |

**The 7-day forecast is already being fetched and discarded.** The NWS forecast endpoint
returns 14 periods — seven days of day/night pairs — and `server/api/weather.get.ts` reads
`periods[0]` and drops the rest. Rendering a week costs **zero additional API calls**; it is
purely a display change.

All three are cached in KV and rendered as **server islands** (section 14), so they stay live
on an otherwise static page without touching D1. They do not affect the read budget.

**Scope:** weather including the 7-day forecast ships in v2 — it is free and already fetched.
Border and air quality are fast-follows immediately after cutover; the border code is a port,
not a build.

---

## 14. Platform capabilities to adopt

| Capability | Use | Status |
|---|---|---|
| Workers Static Assets | Public site delivery | new since v1.0 |
| Astro server islands (`server:defer`) | Weather, "updated Xm ago" on static pages | new |
| Astro content layer loaders | D1 -> content collections (the FlareCMS `flareLoader` pattern) | new |
| Astro Actions + Zod 4 | Contact form | new |
| **Workers AI** (`env.AI`) | Evaluate replacing OpenAI for summarisation | **already bound, unused** |
| **Vectorize** (`articles-semantic`) | Semantic search and related articles | **already bound, barely used** |
| Cloudflare Images | Image resizing and delivery | |
| Queues (`ARTICLE_QUEUE`) | Already bound; review whether the render step should use it | |

`env.AI` and Vectorize are already provisioned and paid for. Workers AI replacing GPT-4o Mini
for summarisation is worth a measured comparison — quality first, cost second.

---

## 15. Migration and cutover

Zero-risk by construction: v2 is additive and read-only against production data.

1. Build v2 in `/home/jaime/www/_github/915tldr.com` against the **dev** database.
2. Point it at production D1 read-only; verify output against the live site.
3. Deploy to `dev.915tldr.com`, validate the full budget in section 4.
4. Move the existing Nuxt app to `admin.915tldr.com`.
5. Cut `915tldr.com` over to the Astro worker.
6. Watch for 48 hours against the budget.
7. Only then: rename `915tldr.com2` to `_SUPERSEDED` and delete both old directories.

**Rollback** at any point is a DNS/route change back to the existing worker, which remains
deployed and functional throughout.

### Carried forward from v1

- `wrangler.jsonc` bindings and secrets
- Drizzle schema and migration history (`0000`-`0006`)
- The `idx_articles_status_published` index added 2026-09-14
- Ingestion, AI processing, duplicate detection, embeddings
- Admin UI and Better Auth
- Changelog history, both developer and public

### Known defects to fix during the move

- `server/api/admin/articles/reprocess-all.post.ts` binds an unbounded ID list across four
  `inArray` calls and will exceed D1's 100-parameter ceiling
- `pnpm deploy` and `pnpm deploy:dev` call a bare `wrangler` that is not a dependency
- Prettier error at `app/pages/privacy.vue:164`
- Category index routeRules gap (`/crime/**` never matches `/crime`)
- `/changelog` renders empty. `app/pages/changelog.vue` does `useFetch('/changelog.json')`;
  the asset serves correctly standalone but the SSR-time fetch of it intermittently returns
  nothing, so the page renders its empty state, hydration trusts the empty payload, and the
  result is cached for an hour. Found 2026-09-15 during baseline screenshot capture. Static
  generation removes this failure mode outright - there is no runtime fetch to race.

---

## 16. Phases

Sequencing for the roadmap. Each phase ends in something viewable.

| # | Phase | Ends with |
|---|---|---|
| 1 | **Design sketch** | Static HTML/CSS mockups, approved look |
| 2 | **Foundation** | Astro 7 + Cloudflare, D1 loader, budget CI check |
| 3 | **Static generation** | Homepage, categories, tags rendering from real data |
| 4 | **Hybrid archive** | KV render path, older articles served, 0 D1 reads proven |
| 5 | **Imagery + share cards** | Ingest junk filter, Workers AI generation, OG cards validated |
| 6 | **Interactivity** | Vue islands, search, transitions, motion, subscribe capture, weather |
| 7 | **Admin split** | Nuxt app at `admin.915tldr.com`, render trigger wired |
| 8 | **Content quality** | Extraction fixed, prompt rewritten, archive re-processed |
| 9 | **Quality gates** | WCAG AA verified, Lighthouse in CI, CWV measured, cards checked |
| 10 | **Cutover** | Live on all three hosts, git hash in footer, budget watched, routine scheduled |

Phase 1 gates everything visual — including a contrast and keyboard review before the design
is accepted, since accessibility retrofitted into a finished design is where it usually fails.
Phase 4 gates the entire premise — if reads are not zero
there, the architecture is wrong and we stop and reconsider.

---

## 17. Open decisions

| # | Decision | Notes |
|---|---|---|
| 1 | Workers AI vs OpenAI for summarisation | Needs a quality comparison on real articles |
| 2 | Tier 3 bespoke hero images | ~$1.20/month; yes/no |
| 3 | Search implementation | Keep FTS5, or move to Vectorize semantic |
| 4 | Archive depth | Prerender 2,000 recent articles, or a different cut |
| 5 | Whether the render step runs in the cron worker or a separate one | |

---

## 18. Success criteria

This rebuild is successful when all of the following hold for 7 consecutive days:

- [ ] D1 reads on public request path: **0**, verified structurally
- [ ] D1 reads/day below 2,000,000
- [ ] LCP p75 mobile below 1.5s
- [ ] Zero articles displaying an emoji sprite or unbranded placeholder
- [ ] Zero summaries longer than their source; no fabricated advisories on spot-check
- [ ] Every article shares with a real Open Graph card, validated on X, Facebook and WhatsApp
- [ ] Spanish summaries generated for the full archive; `/es` decision made on measured data
- [ ] Lighthouse: 100 accessibility, 100 SEO, >= 95 performance across the page set
- [ ] WCAG 2.2 AA verified, automated plus manual keyboard and screen-reader pass
- [ ] LCP p75 mobile < 1.5s, INP < 100ms, CLS < 0.05
- [ ] Deployed commit hash visible in the footer and at `/version.json`
- [ ] `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge
- [ ] Budget routine running daily and reporting
- [ ] A named human is visible on the About page, with plain-English disclosure of how the
      AI works and prominent attribution to source outlets
- [ ] The owner prefers looking at it to the old one

---

## 19. Deferred to v2.1 — news sources

Not in the rebuild. Changing the source mix mid-rebuild would confound the architecture work,
and the budget in section 4 needs a stable ingest rate to validate against. Captured here so
it is not lost.

### Current state (measured 2026-09-15)

| Source | Active | Articles | Share |
|---|---|---|---|
| KVIA | yes | 25,284 | 61.3% |
| KTSM | yes | 15,354 | 37.2% |
| El Paso Matters | yes | 595 | **1.4%** |

41,233 articles from three sources in roughly fourteen months.

### Two findings worth acting on

**El Paso Matters is barely contributing.** It is marked active but has produced 595 articles
against KVIA's 25,284 — and it is the only independent, non-broadcast newsroom in the mix.
Either its feed is truncated, partly broken, or it simply publishes far less. Worth
diagnosing on its own; a local news aggregator leaning 98% on two TV stations has a
noticeable editorial tilt toward breaking news and away from civic reporting.

**Source diversity is the highest-leverage content improvement available.** The existing
pipeline already handles summarisation, tagging, categorisation and cross-source duplicate
detection — duplicate detection in particular gets *more* valuable with more sources, since
it is what stops the same story appearing four times.

### v2.1 scope

- Diagnose the El Paso Matters feed
- Survey El Paso and Las Cruces outlets: print, radio, university, government, bilingual
  and Spanish-language sources
- Evaluate `fetch_method: 'scrape'` for outlets without usable RSS (the `sources` schema
  already supports it)
- Re-tune duplicate detection thresholds for a larger source set
- Consider source-level trust weighting for the lead story

`915tldr.com2/docs/` and the older `915tldr.com_2025-07_OLD-DELETE/docs/el_paso_rss_feeds.md`
both contain earlier source research worth revisiting before starting from scratch.

---

## Appendix A: measurements taken 2026-09-15

All against production D1 (`915tldr-db`, `552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`).

| Query | rows read |
|---|---|
| `/api/tags` aggregate | 408,969 |
| `/api/categories` aggregate | 74,525 |
| `/api/stats` hero | 41,153 |
| `/api/stats` by-day | 41,895 |
| tag page `COUNT` | 39,660 |
| `/api/articles` `COUNT` unfiltered | 37,181 |
| `/api/articles` `COUNT` per-category | 15,228 |
| `/sitemap.xml` (post-fix) | ~6,000 |
| article listing (post-index) | 40 |
| `/rss.xml` (post-index) | 148 |

Daily totals, `915tldr-db`:

| Date (UTC) | rows read |
|---|---|
| 2026-09-08 | 219,718,051 |
| 2026-09-09 | 234,037,082 |
| 2026-09-10 | 92,621,592 |
| 2026-09-11 | 180,268,486 |
| 2026-09-12 | 153,549,627 |
| 2026-09-13 | 182,591,060 |
| 2026-09-14 | 164,966,583 |
| 2026-09-15 | 584,837,127 (partial; post-fix rate ~784M/day projected) |

D1 hard constraint discovered 2026-09-15: **maximum 100 bound parameters per statement**.
Verified empirically — 100 succeeds, 101 fails with
`too many SQL variables at offset 226: SQLITE_ERROR`.

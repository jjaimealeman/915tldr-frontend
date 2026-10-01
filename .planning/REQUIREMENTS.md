# Requirements: 915 TLDR v2 Rebuild

**Defined:** 2026-09-16
**Core Value:** Zero D1 reads on the public request path — architecturally zero, enforced structurally at build time.

## v1 Requirements

### Architecture & Read Budget

- [ ] **ARCH-01**: A public page request completes with zero D1 row reads, verified against Cloudflare D1 analytics
- [x] **ARCH-02**: The build fails if any public route, island component, middleware, or endpoint can reach the D1 binding
- [x] **ARCH-03**: The D1-import assertion scans island component files and `/_server-islands/*` paths, not only `.astro` pages
- [x] **ARCH-04**: Bindings are accessed via `import { env } from 'cloudflare:workers'`; no use of the removed `Astro.locals.runtime.env`
- [x] **ARCH-05**: Astro config uses `output: 'static'` with per-route `export const prerender = false`; `'hybrid'` appears nowhere
- [x] **ARCH-06**: `imageService` is set explicitly to `{ build: 'compile', runtime: 'passthrough' }` rather than inheriting the `cloudflare-binding` default
- [ ] **ARCH-07**: Total D1 reads per day stay under 2,000,000 for 7 consecutive days
- [x] **ARCH-08**: A public request performs at most 1 KV read and under 5ms Worker CPU

### Content Loading & Render

- [x] **REND-01**: A hand-written `astro/loaders` Loader reads articles from the D1 REST API at build time
- [x] **REND-02**: The loader throws and fails the build when it returns zero or fewer rows than expected — an empty result never ships as a successful build
- [x] **REND-03**: A regression test reproduces the `/changelog` empty-state failure and proves the loader rejects it
- [x] **REND-04**: Homepage, category pages, tag indexes and static pages regenerate on each cron cycle via a new Worker deployment
- [x] **REND-05**: Only new and changed articles re-render; unchanged articles are not recomputed
- [x] **REND-06**: A render manifest in KV records what has been rendered and at which version
- [ ] **REND-07**: Articles outside the hot window are rendered once to R2 and served from there
- [x] **REND-08**: A request for an archived article falls through the static-asset layer to the Worker and is served from R2
- [x] **REND-09**: Tag pages default to the archive tier; only top-N tags by article count are promoted to hot static
- [x] **REND-10**: The hot-content cutoff is derived from measured request traffic, not a fixed guess
- [ ] **REND-11**: Total deployed static-asset file count is reported daily and alarms before 100,000
- [ ] **REND-12**: A full archive re-render completes without exceeding Worker CPU limits

### Content Quality

- [x] **CONT-01**: Content extraction no longer truncates mid-article; the `[...]` marker rate drops to near zero on newly ingested articles
- [x] **CONT-02**: Summary length is proportional to source length, with no fixed word floor
- [x] **CONT-03**: The prompt explicitly prohibits advisories, calls to action, impact analysis, and editorial framing absent from the source
- [x] **CONT-04**: An automated grounding check flags any summary containing a claim not traceable to its source
- [x] **CONT-05**: The grounding check catches the known production example (the fabricated "urged to remain vigilant" advisory), which is length-compliant
- [x] **CONT-06**: An automated check flags any summary longer than its source
- [x] **CONT-07**: Thin sources produce a short summary or attributed excerpt without resorting to verbatim-heavy quoting
- [x] **CONT-08**: Summarisation runs on `gpt-5.6-luna`
- [x] **CONT-09**: A dry run reports exact row count and projected cost before any re-processing run
- [x] **CONT-10**: The affected archive is re-processed once, via the Batch API, after explicit approval
- [x] **CONT-11**: Batch jobs handle the 24-hour cancellation window — unfinished work is detected and resubmitted, not silently lost
- [x] **CONT-12**: Articles ingested during the 2026-09-04 → 2026-09-16 OpenAI outage window are audited for missing or truncated summaries and for skipped duplicate detection; any gap is quantified and folded into the re-processing set

### Bilingual

- [ ] **I18N-01**: Each article carries an English and a Spanish summary, generated in the same model call
- [ ] **I18N-02**: Source language is detected at ingest and stored
- [ ] **I18N-03**: Spanish-language articles render with `lang="es"` on the appropriate element
- [ ] **I18N-04**: `/es/...` routes exist for every public page type
- [ ] **I18N-05**: Every page emits correct `hreflang` pairs including `x-default`
- [ ] **I18N-06**: Separate sitemaps and RSS feeds exist per language
- [x] **I18N-07**: Card and headline layouts survive Spanish text running 15-25% longer without overflow or clipping
- [ ] **I18N-08**: Language is chosen by the reader, never by IP or browser auto-redirect
- [ ] **I18N-09**: Spanish summaries carry the same AI-generation disclosure as English
- [ ] **I18N-10**: `Accept-Language` is logged at the edge to inform the `/es` launch decision

### Design

- [x] **DSGN-01**: Static HTML/CSS mockups exist and are approved before any Astro component work begins
- [x] **DSGN-02**: Mockups pass contrast and keyboard review before the design is accepted
- [x] **DSGN-03**: Display type is Instrument Serif, body is Source Serif 4; neither Playfair Display nor Merriweather appears
- [x] **DSGN-04**: Each of the eight categories owns a distinct colour from a Chihuahuan desert palette
- [x] **DSGN-05**: Light and dark themes are both fully designed, light being the default
- [x] **DSGN-06**: The article grid renders as pure HTML, not as a hydrated island
- [x] **DSGN-07**: `/changelog` receives an editorial treatment rather than a bulleted list, with history preserved

### Accessibility

- [x] **A11Y-01**: Body text meets 4.5:1 contrast and large text/UI components meet 3:1, verified in both themes
- [ ] **A11Y-02**: Every interactive element is keyboard reachable and operable with a visible, unclipped focus indicator
- [ ] **A11Y-03**: A working skip link is present and the tab order is logical
- [ ] **A11Y-04**: Each page has exactly one `h1` with a correct heading hierarchy and landmark regions
- [ ] **A11Y-05**: Interactive controls are real `<button>`/`<a>` elements, not clickable `div`s
- [ ] **A11Y-06**: Content images carry meaningful `alt`; decorative images carry `alt=""`; generated imagery derives alt text from the article
- [ ] **A11Y-07**: `prefers-reduced-motion` is honoured by every transition and animation
- [ ] **A11Y-08**: Form labels are tied to inputs and errors are announced
- [ ] **A11Y-09**: The site is usable at 200% zoom and 320px width with no horizontal scroll or content loss
- [ ] **A11Y-10**: Lighthouse accessibility scores 100 across home, category, article, changelog and contact
- [ ] **A11Y-11**: A manual keyboard and screen-reader pass is completed and recorded

### Performance

- [ ] **PERF-01**: LCP p75 mobile is under 1.5s
- [ ] **PERF-02**: INP is under 100ms
- [ ] **PERF-03**: CLS is under 0.05
- [ ] **PERF-04**: FCP is under 1.0s and lab TBT under 100ms
- [ ] **PERF-05**: Lighthouse performance is at least 95 across the representative page set
- [ ] **PERF-06**: Lighthouse CI fails the build below the blocking thresholds
- [x] **PERF-07**: Fonts are self-hosted, subset including Spanish diacritics, woff2 only, with `size-adjust` metric-compatible fallbacks
- [ ] **PERF-08**: The LCP image carries `fetchpriority="high"` and is not lazy-loaded
- [ ] **PERF-09**: Every image has explicit `width`/`height`
- [ ] **PERF-10**: Responsive images emit `srcset`/`sizes` with AVIF and WebP plus fallback

### SEO

- [x] **SEO-01**: Every article emits valid `NewsArticle` structured data, validated not merely emitted
- [x] **SEO-02**: `BreadcrumbList`, `Organization` and `WebSite` structured data are present and valid
- [x] **SEO-03**: A Google News sitemap covers articles from the last 48 hours
- [x] **SEO-04**: Every page has a canonical URL and existing `/[category]/[slug]-[uuid]` URLs still resolve
- [x] **SEO-05**: The existing per-bot `robots.txt` policy, including AI-crawler and `Content-signal` rules, is preserved
- [x] **SEO-06**: `/rss.xml` is preserved
- [x] **SEO-07**: Canonical links to the originating outlet are prominent on every article
- [x] **SEO-08**: The 404 suggestion endpoint carries over
- [ ] **SEO-09**: Lighthouse SEO scores 100 across the representative page set

### Social Sharing

- [ ] **SOC-01**: Every page emits `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type` and `og:locale` with `og:locale:alternate`
- [ ] **SOC-02**: Every page emits `og:image` with explicit `width`, `height`, `alt` and `type`
- [ ] **SOC-03**: Articles emit `article:published_time`, `article:modified_time`, `article:section`, `article:tag` and `article:author`
- [ ] **SOC-04**: Twitter card tags are present with `summary_large_image`
- [ ] **SOC-05**: Every article has a 1200×630 share card under 5MB at an absolute HTTPS URL
- [ ] **SOC-06**: Share cards are produced by deterministic composition, not AI generation, and no article shares blank or generic
- [ ] **SOC-07**: Cards are validated by human inspection in the Facebook debugger, X validator, iMessage, WhatsApp and Slack
- [ ] **SOC-08**: Generated card file size is verified against WhatsApp's real ceiling

### Imagery

- [ ] **IMG-01**: An ingest filter rejects emoji sprites, known generic placeholders and undersized images
- [ ] **IMG-02**: The filter is applied retroactively, reclassifying the existing 1,098 junk images
- [ ] **IMG-03**: Zero articles display an emoji sprite or unbranded placeholder
- [ ] **IMG-04**: Articles without a usable source image receive a generated image via Workers AI Flux-Schnell
- [ ] **IMG-05**: A 10-image quality test gates the backfill; the decision is made by looking at the images
- [ ] **IMG-06**: The 15,624-article backfill runs only after explicit approval, with a dry run first
- [ ] **IMG-07**: Ongoing per-article generation stays inside the free 10,000 neurons/day allocation
- [ ] **IMG-08**: Eight category hero images share one visual identity, generated via reference images on `gpt-image-2.5-flare`
- [ ] **IMG-09**: Real per-image cost is measured from `usage.output_tokens` and recorded, not estimated
- [ ] **IMG-10**: Generated images are stored in R2 and their assignments recorded in D1 so they survive rebuilds

### Search

- [ ] **SRCH-01**: Readers can search articles from the public site
- [ ] **SRCH-02**: The search backend is chosen by measurement against the real corpus in both languages
- [ ] **SRCH-03**: If the chosen backend reads D1, the exception is explicitly scoped and capped in the budget; otherwise zero D1 reads holds without exception

### Interactivity

- [ ] **ISL-01**: Weather and a 7-day forecast render as server islands from the existing NWS response with no additional API calls
- [ ] **ISL-02**: An "updated Xm ago" indicator renders as a server island
- [ ] **ISL-03**: Islands supply an explicit `slot="fallback"` and degrade visibly when upstream is slow or down
- [ ] **ISL-04**: `ASTRO_KEY` is pinned as a stable secret so island prop decryption survives rolling deploys and CDN caching
- [ ] **ISL-05**: Island encrypted props stay under 2048 bytes so requests remain cacheable GETs
- [ ] **ISL-06**: Page transitions use `<ClientRouter />` from `astro:transitions`
- [ ] **ISL-07**: The theme toggle island hydrates without a mismatch warning
- [ ] **ISL-08**: Islands are limited to search, category filter, theme toggle, load-more and weather

### Reader Subscription

- [ ] **SUB-01**: A reader can submit an email address to subscribe
- [ ] **SUB-02**: Subscription is confirmed by double opt-in
- [ ] **SUB-03**: A subscriber can select any of the eight categories
- [ ] **SUB-04**: A subscriber can follow named entities from the existing 46,090
- [ ] **SUB-05**: A subscriber selects a preferred language
- [ ] **SUB-06**: Every subscriber row carries an unsubscribe token and a working unsubscribe link
- [ ] **SUB-07**: Preference changes go through a magic link with no password or session
- [ ] **SUB-08**: The subscribe path performs writes only and never a D1 read on the public request path

### Identity & Disclosure

- [ ] **IDNT-01**: The About page names a real person, with photo, written in first person
- [ ] **IDNT-02**: The About page explains in plain English what is automated, what is summarised and where the reporting comes from
- [x] **IDNT-03**: Each article carries AI-generation disclosure at point of consumption, not only on the About page
- [x] **IDNT-04**: Original outlets are prominently attributed on every article
- [ ] **IDNT-05**: A contact route exists that is not a form-only dead end
- [ ] **IDNT-06**: Links to `jjaimealeman.com` and `915website.com` are present

### Operations

- [ ] **OPS-01**: The public site serves from `915tldr.com` on the Astro worker
- [x] **OPS-02**: `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge, verified by response header
- [ ] **OPS-03**: The Nuxt pipeline and admin serve from `admin.915tldr.com` behind Cloudflare Access
- [ ] **OPS-04**: Better Auth, its four tables, `/admin/login` and all session handling are removed
- [x] **OPS-05**: The deployed short commit hash and build timestamp appear in the public footer
- [x] **OPS-06**: `/version.json` exposes the build hash for scripted checks
- [ ] **OPS-07**: A daily routine reports D1 reads, spend, OpenAI balance, static-asset file count and Core Web Vitals against budget
- [x] **OPS-08**: The read budget is stated in the README
- [ ] **OPS-09**: Rollback to the existing worker is a route change and is verified before cutover
- [x] **OPS-10**: The cron run triggers the public site's incremental build
- [x] **OPS-11**: No operation costing more than $1 runs without prior approval and an estimate

### Known Defect Fixes

- [x] **FIX-01**: `reprocess-all.post.ts` no longer binds an unbounded ID list across `inArray` calls; D1's 100-parameter ceiling is respected
- [x] **FIX-02**: `pnpm deploy` and `pnpm deploy:dev` resolve `wrangler` as a real dependency
- [x] **FIX-03**: The Prettier error at `app/pages/privacy.vue:164` is resolved
- [x] **FIX-04**: Category index routes resolve (`/crime` as well as `/crime/**`)
- [x] **FIX-05**: `/changelog` renders its content reliably

## v2 Requirements

Deferred. Tracked, not in this roadmap.

### Content Sources

- **SRC-01**: Diagnose why El Paso Matters produces 595 articles against KVIA's 25,284
- **SRC-02**: Survey El Paso and Las Cruces print, radio, university, government and Spanish-language outlets
- **SRC-03**: Evaluate `fetch_method: 'scrape'` for outlets without usable RSS
- **SRC-04**: Re-tune duplicate detection for a larger source set
- **SRC-05**: Source-level trust weighting for the lead story

### Product Surface

- **PROD-01**: Entity pages for the top few hundred entities by article count
- **PROD-02**: Story threads grouping repeated coverage of one event over time
- **PROD-03**: Border wait times, ported from `logistics.915website.com/server/utils/border.ts`
- **PROD-04**: Air quality as part of an "El Paso right now" strip
- **PROD-05**: Semantic related articles via Vectorize
- **PROD-06**: "On this day" from the fourteen-month archive
- **PROD-07**: Civic layer — council agendas, elections, public meeting calendars

### Messaging

- **MSG-01**: Daily or weekly digest sending via Cloudflare Email Service
- **MSG-02**: Breaking-news alerts, sequenced ahead of scheduled digests
- **MSG-03**: SPF, DKIM, DMARC, one-click `List-Unsubscribe`, bounce and complaint handling

### Pipeline

- **PIPE-01**: Workers AI vs OpenAI summarisation comparison on the fixed prompt

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting RSS ingestion, duplicate detection, embeddings | Nine months of tuning; where regression risk lives. Only extraction and the summary prompt are opened |
| Rewriting the admin UI | ~30 working endpoints seen by one person |
| Migrating or reshaping D1 data | Same database, schema and bindings; additive changes only |
| Better Auth or any auth framework | 1 user, 0 signup routes, no digest code. Cloudflare Access replaces it |
| Digest sending in v1 | A daily email to three people is not worth the deliverability commitment |
| Expanding news sources | Would confound architecture validation, which needs a stable ingest rate |
| Programmatic advertising | Incompatible with Lighthouse 100 and LCP under 1.5s |
| Comments | Unbounded moderation commitment for a solo operator |
| Coverage-gap analysis | Turns a neutral aggregator into a media critic and picks fights with source outlets |
| Push notifications | Native app surface; no app, and web push is a poor fit for this audience |
| Reader accounts, personalisation, mobile app | v3+ material |
| Switching LLM providers | One vendor, one bill; no new integration surface |
| FlareCMS / `flareLoader` | Unfinished project, not usable; `@flare-cms/astro` unpublished |
| Autoplay video, popups, interstitials | Performance budget and reader trust |
| IP or browser-based `/es` auto-redirect | Language is the reader's choice |
| Regional Spanish hreflang variants | Over-fragmentation with no audience benefit |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 5 | Pending |
| ARCH-02 | Phase 3 | Complete |
| ARCH-03 | Phase 3 | Complete |
| ARCH-04 | Phase 3 | Complete |
| ARCH-05 | Phase 3 | Complete |
| ARCH-06 | Phase 3 | Complete |
| ARCH-07 | Phase 12 | Pending |
| ARCH-08 | Phase 5 | Complete |
| REND-01 | Phase 4 | Complete |
| REND-02 | Phase 4 | Complete |
| REND-03 | Phase 4 | Complete |
| REND-04 | Phase 4 | Complete |
| REND-05 | Phase 4 | Complete |
| REND-06 | Phase 3 | Complete |
| REND-07 | Phase 5 | Pending |
| REND-08 | Phase 5 | Complete |
| REND-09 | Phase 5 | Complete |
| REND-10 | Phase 5 | Complete |
| REND-11 | Phase 5 | Pending |
| REND-12 | Phase 5 | Pending |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Complete |
| CONT-04 | Phase 2 | Complete |
| CONT-05 | Phase 2 | Complete |
| CONT-06 | Phase 2 | Complete |
| CONT-07 | Phase 2 | Complete |
| CONT-08 | Phase 2 | Complete |
| CONT-09 | Phase 2 | Complete |
| CONT-10 | Phase 2 | Complete |
| CONT-11 | Phase 2 | Complete |
| CONT-12 |Phase 2| Complete |
| I18N-01 | Phase 6 | Pending |
| I18N-02 | Phase 6 | Pending |
| I18N-03 | Phase 6 | Pending |
| I18N-04 | Phase 6 | Pending |
| I18N-05 | Phase 6 | Pending |
| I18N-06 | Phase 6 | Pending |
| I18N-07 | Phase 1 | Complete |
| I18N-08 | Phase 6 | Pending |
| I18N-09 | Phase 6 | Pending |
| I18N-10 | Phase 6 | Pending |
| DSGN-01 | Phase 1 | Complete |
| DSGN-02 | Phase 1 | Complete |
| DSGN-03 | Phase 1 | Complete |
| DSGN-04 | Phase 1 | Complete |
| DSGN-05 | Phase 1 | Complete |
| DSGN-06 | Phase 1 | Complete |
| DSGN-07 | Phase 1 | Complete |
| A11Y-01 | Phase 1 | Complete |
| A11Y-02 | Phase 11 | Pending |
| A11Y-03 | Phase 11 | Pending |
| A11Y-04 | Phase 11 | Pending |
| A11Y-05 | Phase 11 | Pending |
| A11Y-06 | Phase 7 | Pending |
| A11Y-07 | Phase 8 | Pending |
| A11Y-08 | Phase 10 | Pending |
| A11Y-09 | Phase 11 | Pending |
| A11Y-10 | Phase 11 | Pending |
| A11Y-11 | Phase 11 | Pending |
| PERF-01 | Phase 11 | Pending |
| PERF-02 | Phase 11 | Pending |
| PERF-03 | Phase 11 | Pending |
| PERF-04 | Phase 11 | Pending |
| PERF-05 | Phase 11 | Pending |
| PERF-06 | Phase 11 | Pending |
| PERF-07 | Phase 1 | Complete |
| PERF-08 | Phase 7 | Pending |
| PERF-09 | Phase 7 | Pending |
| PERF-10 | Phase 7 | Pending |
| SEO-01 | Phase 4 | Complete |
| SEO-02 | Phase 4 | Complete |
| SEO-03 | Phase 4 | Complete |
| SEO-04 | Phase 4 | Complete |
| SEO-05 | Phase 4 | Complete |
| SEO-06 | Phase 4 | Complete |
| SEO-07 | Phase 4 | Complete |
| SEO-08 | Phase 4 | Complete |
| SEO-09 | Phase 11 | Pending |
| SOC-01 | Phase 7 | Pending |
| SOC-02 | Phase 7 | Pending |
| SOC-03 | Phase 7 | Pending |
| SOC-04 | Phase 7 | Pending |
| SOC-05 | Phase 7 | Pending |
| SOC-06 | Phase 7 | Pending |
| SOC-07 | Phase 7 | Pending |
| SOC-08 | Phase 7 | Pending |
| IMG-01 | Phase 7 | Pending |
| IMG-02 | Phase 7 | Pending |
| IMG-03 | Phase 7 | Pending |
| IMG-04 | Phase 7 | Pending |
| IMG-05 | Phase 7 | Pending |
| IMG-06 | Phase 7 | Pending |
| IMG-07 | Phase 7 | Pending |
| IMG-08 | Phase 7 | Pending |
| IMG-09 | Phase 7 | Pending |
| IMG-10 | Phase 7 | Pending |
| SRCH-01 | Phase 9 | Pending |
| SRCH-02 | Phase 9 | Pending |
| SRCH-03 | Phase 9 | Pending |
| ISL-01 | Phase 8 | Pending |
| ISL-02 | Phase 8 | Pending |
| ISL-03 | Phase 8 | Pending |
| ISL-04 | Phase 8 | Pending |
| ISL-05 | Phase 8 | Pending |
| ISL-06 | Phase 8 | Pending |
| ISL-07 | Phase 8 | Pending |
| ISL-08 | Phase 8 | Pending |
| SUB-01 | Phase 10 | Pending |
| SUB-02 | Phase 10 | Pending |
| SUB-03 | Phase 10 | Pending |
| SUB-04 | Phase 10 | Pending |
| SUB-05 | Phase 10 | Pending |
| SUB-06 | Phase 10 | Pending |
| SUB-07 | Phase 10 | Pending |
| SUB-08 | Phase 10 | Pending |
| IDNT-01 | Phase 10 | Pending |
| IDNT-02 | Phase 10 | Pending |
| IDNT-03 | Phase 4 | Complete |
| IDNT-04 | Phase 4 | Complete |
| IDNT-05 | Phase 10 | Pending |
| IDNT-06 | Phase 10 | Pending |
| OPS-01 | Phase 12 | Pending |
| OPS-02 | Phase 3 | Complete |
| OPS-03 | Phase 12 | Pending |
| OPS-04 | Phase 12 | Pending |
| OPS-05 | Phase 3 | Complete |
| OPS-06 | Phase 3 | Complete |
| OPS-07 | Phase 12 | Pending |
| OPS-08 | Phase 3 | Complete |
| OPS-09 | Phase 12 | Pending |
| OPS-10 | Phase 4 | Complete |
| OPS-11 | Phase 2 | Complete |
| FIX-01 | Phase 2 | Complete |
| FIX-02 | Phase 2 | Complete |
| FIX-03 | Phase 2 | Complete |
| FIX-04 | Phase 4 | Complete |
| FIX-05 | Phase 4 | Complete |

**Coverage:**

- v1 requirements: 138 total
- Mapped to phases: 138
- Unmapped: 0 ✓
- Duplicates: 0 ✓

**Phase totals:** Phase 1: 10, Phase 2: 15, Phase 3: 10, Phase 4: 18, Phase 5: 8, Phase 6: 9, Phase 7: 22, Phase 8: 9, Phase 9: 3, Phase 10: 13, Phase 11: 14, Phase 12: 6

---
*Requirements defined: 2026-09-16*
*Last updated: 2026-09-16 after roadmap creation — 137/137 requirements mapped across 12 phases*

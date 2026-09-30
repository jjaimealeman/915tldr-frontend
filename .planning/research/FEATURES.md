# Feature Research

**Domain:** Local/community news aggregator (bilingual, El Paso/Juárez)
**Researched:** 2026-09-16
**Confidence:** MEDIUM overall — LOW-confidence web sources throughout (see Sources), but cross-checked against the PRD's own numbers and against a legal doctrine with real case history, which raises effective confidence on the two sections that matter most (AI disclosure, aggregator legal risk).

This is a v2 rebuild, not a greenfield product. The PRD already exhaustively specifies most of
this milestone's feature set (sections 7, 9, 10, 11, 12). This document does **not** re-argue
decisions the PRD has already made well — it flags what the PRD's list is missing against 2026
reader expectations, and sharpens the conventional behavior of features the PRD has already
committed to building.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist on any credible 2026 local news site. Checked against PRD §7–§13.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fast, mobile-first, ad-clutter-free reading | Baseline for any news site since Core Web Vitals became a ranking factor; doubly true for a phone-first local audience | LOW (already the whole point of the rebuild) | PRD §6 covers this exhaustively and is the strongest section in the document. Not a gap. |
| Canonical attribution + link to original outlet on every summary | Ethical minimum for an aggregator; also the load-bearing legal defense (see Anti-Features/legal section below) | LOW | PRD §6.6 and §11 already require this. Not a gap — just note it must be genuinely prominent, not a footnote link (see legal analysis). |
| RSS feed | Still expected by a meaningful slice of a tech-literate local audience, and required for many aggregator/platform pickups | LOW | Already shipped, preserved in PRD §13. Not a gap. |
| Structured data / Google News sitemap | Table stakes for any site that wants search or Google News surfacing at all | MEDIUM | PRD §6.6 already requires `NewsArticle`, `BreadcrumbList`, Google News sitemap. Not a gap. |
| **A named, visible masthead / "who runs this" surface** | Readers distrust faceless aggregation more than ever in an AI content era; a real name is the single cheapest trust signal available | LOW | PRD §11 already requires this. Not a gap — but see "Trust Project"–style indicators below, which go one step further and are not yet in scope. |
| **Breaking-news email alerts (distinct from the daily digest)** | Every competitor examined (Patch, NewsBreak, Axios Local) treats "notify me the moment something breaking happens" as separate from a scheduled digest — it's the highest-retention feature category in local news apps | MEDIUM | **Gap.** PRD §10.5 explicitly defers *all* sending (digests included) until 50-100 confirmed subscribers. That's a defensible sequencing call given the deliverability cost argued in §10.5 — but the PRD should be explicit that breaking-news alerts, not just daily digests, are the first thing to build once that gate is cleared. A daily digest and a breaking-news alert are different products with different urgency expectations; conflating them under "digests" risks building the wrong one first. |
| **Search** | Users expect to search a news archive of 41K+ articles; a site this size without search reads as broken | MEDIUM–HIGH | **Already flagged as PRD open decision #3** (FTS5 vs. Vectorize). Correctly identified as needing phase research — not a gap, just confirming it's genuinely table stakes and shouldn't slip. |
| Push notifications (mobile web) | 2026 local news apps (NewsBreak, Patch) lean heavily on push for breaking news; a PWA-style push permission prompt is increasingly expected even on a mobile *website*, not just native apps | MEDIUM | **True gap, not currently in PRD scope anywhere** (not even in §12 "considered"). Likely appropriately out of scope for this milestone (adds a service-worker + permission UX + backend fan-out, works against the "zero D1 reads, static site" architecture), but it should be named explicitly as a deferred table-stakes item rather than silently absent, so it isn't rediscovered as a surprise complaint later. |
| Weather as a genuine daily-open reason | Confirmed by PRD's own reasoning in §13.3 — this is well understood and already shipping | LOW | Not a gap. The 7-day forecast expansion is correctly scoped as "free, already fetched." |

### Differentiators (Competitive Advantage)

Features that set 915 TLDR apart from every other local outlet in the market. These should
align with the project's Core Value (zero-D1-reads architecture doesn't preclude ambitious
product surface — it's actually what *enables* cheaply serving these at scale).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Entity pages** (PRD §12.1 #1) | 46,090 extracted entities, currently surfacing nowhere. No local news precedent found for a per-entity profile page at this scale — this is genuinely novel, not a copy of an established local-news pattern. Research found entity-based SEO is a recognized *discipline* (Semrush, Neil Patel, entity-linking guides) but no comparable *consumer product* doing "everything we know about UTEP" for a mid-size metro. | MEDIUM–HIGH | PRD correctly gates this to top-N entities by article count, not all 46K, given the page-count ceiling. **What a good entity page needs, per what this domain's SEO conventions call for**: canonical entity name + aliases, a short auto-generated description, every article mentioning the entity in reverse-chron order, related entities (co-occurrence), and a way to *follow* it (directly feeds §10.4 subscription). Treat it as a template that reuses the archive rendering pipeline in §3.1 — an entity page is structurally a filtered article list, not a new content type, which keeps it inside the zero-D1-reads architecture. |
| **Story threads / timelines** (PRD §12.1 #2) | Duplicate detection already groups same-event articles; extending across time into an explicit "here's the timeline" view is a recognized content pattern (TimelineJS-style grouping, news-story-chain clustering) with no dominant single UI convention — meaning 915 TLDR has real design latitude here, not a template to copy. | MEDIUM | Two implementation paths, both legitimate: (a) a lightweight timeline module bolted onto the "lead" article of a cluster, or (b) a dedicated thread page URL. Given the zero-D1-reads constraint, (a) is cheaper — it's a rendering-time join over already-detected duplicates, no new schema. Depends on duplicate detection (existing pipeline) already tagging cluster membership usably; verify that data shape exists before scoping. |
| **Entity-follow subscriptions** (PRD §10.4) | Correctly identified by the PRD itself as "uniquely enabled by the pipeline already built" and the sharpest differentiator in the whole document. Research confirms this is *not* a commodity pattern — most newsletter tooling supports category/tag segments, but exposing entity-level follow granularity directly to readers is unusual even among well-resourced outlets. | LOW (capture only, per §10.3) | Depends on entity pages existing to give the follow action a natural UI surface (follow button lives on the entity page). Not a hard dependency for the *data model* (§10.3 ships entity-follow capture regardless), but it is a dependency for reader *discoverability* of the feature — an entity-follow capture form with no entity pages to browse is a feature with no on-ramp. |
| **Bilingual, binational framing (not just translation)** | The PRD's own reasoning in §7.1 — serving Juárez, not just El Paso's Spanish-dominant households — is the differentiator; translation alone is a commodity (every major outlet auto-translates now). What's differentiated is treating `/es` as a first-class binational edition, not an afterthought locale. | Already fully scoped in PRD §7 | Not a gap — the PRD's own framing already identifies this correctly. One addition worth naming: language switcher **placement** matters more than usual here because it's serving two genuinely different audiences, not just an accessibility nicety — put it in the primary nav, not a footer link, and persist the choice across visits. |
| **Build-in-public changelog, elevated** (PRD §2, §13.2) | Public changelogs are proven to build trust and let evaluators (in this case, prospective 915website.com clients) assess the product directly — directly supports the stated dual purpose of the site as portfolio piece. | LOW (already shipping, PRD asks for editorial treatment upgrade) | Convention check: best-practice changelogs group entries by type (not by internal phase/commit), lead with a bolded one-line user-facing impact statement, and are 1-3 sentences — "describe impact, not implementation." Worth auditing existing changelog copy against this before the "proper editorial treatment" pass in §2, since GSD phase-completion changelog entries can drift toward developer-facing language. |
| **Git hash + build timestamp in footer** (PRD §13.2) | Unusual for a consumer news site but directly serves the build-in-public identity and solves a real operational problem the PRD documents happening in-session. | LOW | Not really a reader-facing differentiator (most readers won't notice), but it's free, on-brand, and diagnostically valuable. Keep as scoped. |

### Anti-Features (Commonly Requested, Often Problematic)

The PRD has already ruled out comments, programmatic ads, coverage-gap analysis, and
reader accounts/personalization. Research surfaced additional anti-features worth naming
explicitly so they don't get proposed later as "obvious wins":

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| **Autoplay video** | Video-play counts look good in analytics dashboards; "modern news sites have video" | Directly measured reader resentment ("I'm on your site to READ the news"); actively drives abandonment; also a CWV/CLS and LCP risk that conflicts with PRD §4's hard performance budget | If video is ever added (not currently planned), click-to-play only, never autoplay, never replacing headline text on category pages |
| **Stacked popups/interstitials** (email capture modal, cookie banner, location prompt all firing at once) | Each individual popup is locally justified (grow the list! comply with consent! personalize!) but the *stack* is what readers report hating | Directly conflicts with PRD's accessibility (§6.1) and CWV (§6.2) commitments — interstitials are a known CLS and INP source, and are explicitly penalized by Google's page-experience signals | One inline, dismissible subscribe capture (already scoped in §10.3), no modal, no stacking with cookie/location prompts |
| **Coverage-gap analysis** (already ruled out in PRD §12.2) | Confirmed correct call — turns a neutral aggregator into a media critic, picks fights with the source outlets the pipeline depends on | — | — |
| **Verbatim-heavy excerpting instead of genuine summarization** | Tempting shortcut for hitting the PRD's own "length proportional to source" fix in §8.3 — if a source is thin, pulling a longer direct quote feels like an easy way to add length without "inventing" content | This is exactly the pattern that has gotten aggregators sued under the hot-news misappropriation doctrine (Dow Jones v. Briefing.com — copying near-verbatim headlines/text at volume). Fair use protects short snippet + hyperlink; it does not clearly protect substantial verbatim reproduction, especially when the aggregator's version could substitute for the original | For thin sources: a short, genuinely paraphrased summary plus a clearly-labeled short direct quote with quotation marks and attribution — never let the summary's excerpted portion approach source length. The PRD's own automated "flag summaries longer than source" check (§8.3.5) is a good complementary guardrail but doesn't catch verbatim-heavy short summaries; consider a similarity check against source text specifically, not just a length check. |
| **Auto-redirecting readers to `/es` by IP or browser language** | Feels like good personalization — "why make Spanish speakers click a switcher?" | Auto-redirect based on IP/Accept-Language actively harms SEO (Googlebot may not follow/crawl redirected content the way a real user would) and removes user agency — a bilingual border-region reader may deliberately want the English edition regardless of browser locale | Visible, persistent language switcher in primary nav; use `Accept-Language` only as *signal* for the §7.5 launch-decision analytics, never as an automatic redirect (the PRD already implicitly avoids this by treating `/es` launch as a manual decision, but the *within-site* switcher behavior isn't explicitly specified — worth stating outright when phase 2-4 architecture is built) |
| **Regional Spanish targeting (`es-MX` vs `es-ES` hreflang variants)** | Seems more "correct" per generic international-SEO advice | Overengineering for this audience — El Paso/Juárez Spanish is a specific border dialect that doesn't cleanly map to either Spain or generic Mexican-Spanish SEO conventions, and splitting hreflang variants multiplies the already-doubled page count (PRD §7.3) for no reader benefit | Single generic `es` hreflang value; do not fragment into regional variants |

## Feature Dependencies

```
Entity extraction (existing, 46,090 entities)
    └──requires (already satisfied)──> Entity pages (differentiator, new)
                                            └──enables──> Entity-follow subscription UI on-ramp
                                                              (data model already independent per §10.3)

Duplicate detection (existing pipeline)
    └──requires──> Story threads/timelines (differentiator, new)
                       (needs cluster-membership data shape verified before scoping)

Language detection at ingest (PRD §7.3, §6.1)
    └──requires──> lang="es" a11y attribute (PRD §6.1)
    └──requires──> /es routing + hreflang (PRD §7.3)
    └──requires──> Language switcher UX decision (this doc)

Subscribe capture (PRD §10.3, in scope)
    └──enhances──> Entity-follow subscription (needs entity pages for discoverability, not for data capture)
    └──blocks──> Digests/breaking-news alerts (explicitly deferred, PRD §10.5, gated on 50-100 subscribers)

Breaking-news alerts (differentiator gap, this doc)
    └──conflicts with──> "Digests" framing in PRD §10.5 if treated as the same feature
       (should be sequenced as a distinct, higher-priority send type once the §10.5 gate clears)

Push notifications (table-stakes gap, this doc)
    └──conflicts with──> Zero-D1-reads / pure-static architecture (PRD §4)
       (requires a service worker + subscription endpoint; likely correctly out of scope for this milestone)

Search (PRD open decision #3)
    └──conflicts with──> Zero D1 reads on public path if FTS5 is chosen
       (Vectorize avoids the conflict; this is why the PRD correctly left it as phase research)
```

### Dependency Notes

- **Entity pages require entity extraction:** already satisfied by the existing pipeline (46,090 entities) — this is why entity pages are the PRD's own top-ranked opportunity (§12.1 #1). No new pipeline work needed, only a new render template.
- **Story threads require duplicate-detection cluster data:** verify the existing duplicate-detection output actually preserves *which* articles belong to the same cluster (not just a boolean "is duplicate" flag) before scoping a timeline feature — if only pairwise duplicate flags exist, cluster reconstruction is extra work not currently budgeted anywhere in the PRD.
- **Breaking-news alerts conflict with the "digests" framing:** the PRD's §10.5 gate (50-100 subscribers + confirmed traffic) is a sound gate for *scheduled* digest sending, which is the deliverability-heavy, operationally risky product. A breaking-news alert is architecturally similar (same sending infrastructure, same SPF/DKIM/DMARC requirement) but is a different reader promise. Recommend the roadmap treat "sending infrastructure" as one gated capability that unlocks both, with breaking-news alerts as the first thing built on top of it, not digests.
- **Push notifications conflict with the zero-D1-reads static architecture:** a push subscription endpoint is a write path (fine, same class as the subscribe form) but *sending* push requires a live process watching for breaking news, which is a different operational surface than the cron-driven rendering pipeline. This is very likely intentionally out of scope for a milestone whose entire premise is "stop doing expensive live things" — flagging it so it's a deliberate exclusion, not a forgotten one.
- **Search conflicts with zero D1 reads if implemented via FTS5:** already correctly identified as PRD open decision #3. This research did not resolve it (it's implementation-level, appropriately deferred to phase research) but confirms search itself is table stakes, so the *decision* is urgent even if the *answer* isn't ready yet.

## MVP Definition

This is a v2 rebuild of an existing, shipping product — "MVP" here means "this milestone's
launch scope," not a first version. Reframed accordingly against the PRD's own phase list
(§16).

### Launch With (this milestone, v2)

Already fully scoped by the PRD; listed here only to confirm research does not contradict it:

- [ ] Zero-D1-reads architecture (PRD core value) — validates the entire rebuild premise
- [ ] Content quality fix (PRD §8) — correctness/trust issue, correctly prioritized ahead of bilingual generation
- [ ] Bilingual generation at ingest, `/es` launch decided on evidence (PRD §7)
- [ ] WCAG 2.2 AA + Lighthouse 100 + CWV budget (PRD §6) — release-blocking, correctly so
- [ ] Subscribe capture: email + category + entity-follow + language (PRD §10.3)
- [ ] About page with named human + plain-English AI disclosure (PRD §11) — see AI-disclosure note below
- [ ] Real per-article imagery, three-tier strategy (PRD §9)
- [ ] Git hash in footer, noindex on dev, Access on admin (PRD §13)

**One addition this research recommends folding into the existing About-page/AI-disclosure work (PRD §11):** the disclosure should appear at the point of consumption (a small, consistent per-article label — "AI-generated summary" or similar, near the byline), not only centralized on the About page. EU AI Act Article 50 and emerging norms (Trust Project's Authorship/Type indicator) both point toward disclosure being visible where the content is read, not just linked from elsewhere. This is a low-complexity addition to §6.1/§6.6 structured-data work already planned (the `NewsArticle` schema and article template are already being touched) and meaningfully de-risks the credibility concern the PRD itself raises in §7.4 and §8.

### Add After Validation (fast-follow, v2.1+)

Matches PRD §12.1's own ranking, with this research's additions marked:

- [ ] Entity pages, starting with top-N by article count (PRD §12.1 #1)
- [ ] Story threads/timelines (PRD §12.1 #2)
- [ ] Border wait times — port existing code (PRD §12.1 #3)
- [ ] Air quality (PRD §12.1 #4)
- [ ] **Breaking-news email alerts** — recommend sequencing ahead of scheduled digests once the §10.5 subscriber gate clears (this research)
- [ ] Semantic related articles via Vectorize (PRD §12.1 #5)
- [ ] "On this day" (PRD §12.1 #6)

### Future Consideration (v3+, explicitly deferred)

- [ ] Push notifications — conflicts with static architecture; revisit only if a live/edge notification path is added for another reason
- [ ] Scheduled digest sending — deliverability commitment, correctly gated (PRD §10.5)
- [ ] Civic layer / council agendas (PRD §12.1 #7)
- [ ] Reader accounts, personalization, mobile app (PRD §2 non-goal, correctly so)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Per-article AI-disclosure label (not just About page) | HIGH | LOW | P1 |
| Entity pages | HIGH | MEDIUM–HIGH | P2 |
| Story threads/timelines | MEDIUM | MEDIUM | P2 |
| Breaking-news alerts (vs. generic digest) | HIGH | MEDIUM (gated on §10.5) | P2 |
| Search (implementation TBD) | HIGH | MEDIUM–HIGH | P1 (decision), P2 (build) |
| Push notifications | MEDIUM | HIGH (architecture conflict) | P3 |

**Priority key:** P1 = must resolve/ship this milestone; P2 = should have, first fast-follow; P3 = future consideration, explicitly deferred.

## Competitor Feature Analysis

No single competitor matches 915 TLDR's specific combination (AI-summarized aggregation +
bilingual + entity-level pipeline), so this compares by feature dimension rather than by
named product-to-product match.

| Feature | Axios Local | Patch | 915 TLDR approach |
|---------|--------------|--------|--------------------|
| Content model | Original city-newsroom reporting + "Deep Dive" pillar pages | Original hyperlocal reporting + community-submitted content | Aggregation + LLM summarization of 3 existing outlets — fundamentally different content model, so direct feature parity isn't the goal; trust/attribution mechanics matter more here than for an original-reporting outlet |
| Alerts | Editorial digest (AM-style newsletter) | Breaking-news email subscription, opt-in per category | 915 TLDR should adopt Patch's granular "subscribe to breaking news" pattern for the eventual alert feature (PRD §10.5 fast-follow), not just Axios's single daily digest |
| Topic/entity depth | Pillar/cluster content strategy (editorial, hand-built) | None found at entity granularity | 915 TLDR's entity pages are automated and at a scale (46K entities) neither competitor operates at — genuine differentiation, not parity-seeking |
| Bilingual | Not found | Not found (English-only, US hyperlocal focus) | 915 TLDR's bilingual/binational framing has no direct local-news competitor in this research — supports the PRD's own framing that this is a differentiator, not a checkbox |
| Monetization | Newsroom-funded (VC-backed media co.) | Syndication/local ads | 915 TLDR's portfolio-piece + direct-sponsorship model (PRD §12.3) is architecturally distinct and correctly does not attempt to copy either |

## Sources

All sources below are unauthenticated web search results (LOW confidence per the source-hierarchy
classifier — no curated/HIGH-confidence provider was configured for this research pass).
Findings are presented as directional/conventional-practice signal, not verified fact, except
where cross-referenced against multiple independent sources (noted).

- [Table Stakes: Poynter's Local News Innovation Program](https://www.poynter.org/shop/business-work/table-stakes-poynters-local-news-innovation-program-2023/)
- [Table Stakes Local News Transformation Program — Lenfest Institute](https://www.lenfestinstitute.org/our-work/table-stakes/)
- [10 Best Local News Apps for Your City in 2026](https://www.inspirefusion.com/best-local-news-apps-2026/)
- [Patch: subscribe to breaking news alerts](https://patch.com/new-york/newcity/how-to-subscribe-to-breaking-news-alerts-on-new-city-patch)
- [Axios vows to save local news](https://www.axios.com/2022/01/02/axios-vows-save-local-news)
- [Axios news SEO playbook: Speed, authority and brevity — Search Engine Land](https://searchengineland.com/axios-news-seo-playbook-speed-authority-brevity-384924)
- [Hreflang guide for multi-language SEO](https://www.seozoom.com/hreflang-attribute-what-it-is-and-how-to-use-it-on-multi-language-sites-without-mistakes/)
- [Hreflang Spanish: Complete Guide](https://better-i18n.com/en/blog/hreflang-html-spanish/)
- [Hreflang — Wikipedia](https://en.wikipedia.org/wiki/Hreflang)
- [Double Opt-In Best Practices — Customer.io](https://customer.io/learn/deliverability/double-opt-in-best-practices)
- [What is the double opt-in process — IONOS](https://www.ionos.com/digitalguide/e-mail/technical-matters/the-double-opt-in-process/)
- [What Are Entities & Why Do They Matter for SEO — Semrush](https://www.semrush.com/blog/entity-based-seo-strategy/)
- [Entity-Based SEO — Neil Patel](https://neilpatel.com/blog/entity-based-seo/)
- [TimelineJS — Knight Lab](https://timeline.knightlab.com/)
- [Analyzing Evolving Stories in News Articles (arXiv)](https://arxiv.org/html/1703.08593)
- [Understanding News Story Chains using IR and Network Clustering](https://www.tandfonline.com/doi/full/10.1080/19312458.2018.1536972)
- [Liveblogging — Wikipedia](https://en.wikipedia.org/wiki/Liveblogging)
- [11 Best Practices for Changelogs — Beamer](https://www.getbeamer.com/blog/11-best-practices-for-changelogs)
- [Product Changelog Guide For 2026](https://easydesk.app/blog/product-changelog)
- [European Commission: Code of Practice on Transparency of AI-generated Content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
- [The EU AI Act's Transparency Rules: Article 50 Practical Guide](https://artificialintelligenceact.eu/transparency-rules-article-50/)
- [How to Label AI-Generated Content: New Transparency Rules Explained](https://cookie-script.com/guides/how-to-label-ai-generated-content/amp)
- [Understanding Trust Indicators — The Trust Project](https://thetrustproject.org/trust-indicators/)
- [20 Leading News Groups Join Trust Project — Santa Clara University](https://www.scu.edu/ethics/about-the-center/center-news/trust-indicators-reach-127-million/)
- [Top 10 UI Annoyances — Jakob Nielsen](https://jakobnielsenphd.substack.com/p/ui-annoyances)
- [Why Popups And Auto Play Are Killing The Internet](https://builtwithbricks.io/why-popups-and-auto-play-are-killing-the-internet/)
- ["Hot News" misappropriation claims — news aggregators and beyond — Lexology](https://www.lexology.com/library/detail.aspx?g=71669f27-f371-4dbf-8138-8590da108acd)
- [Content aggregation: spreading or stealing the news? — Reporters Committee for Freedom of the Press](https://www.rcfp.org/journals/news-media-and-law-summer-2012/content-aggregation-spreadi/)
- [The "Hot News" doctrine analyzed — Vondran Legal](https://www.vondranlegal.com/copyright-hot-news-doctrine-explained)
- Cross-project sources: `/home/jaime/www/_github/915tldr.com/.planning/PROJECT.md`, `/home/jaime/www/_github/915tldr.com/docs/PRD.md` (v2.0, 2026-09-15) — treated as HIGH confidence, primary source of truth for what is already in/out of scope

---
*Feature research for: local/community news aggregator (915tldr.com v2)*
*Researched: 2026-09-16*

# Roadmap: 915 TLDR v2 Rebuild

## Overview

The journey starts by fixing what is *wrong* before building what is *new*: an approved,
accessible design on paper (Phase 1) and truthful summaries in the pipeline (Phase 2) both
land before a single Astro file exists. Phase 3 installs the guardrail whose absence caused
this rebuild — a build-time assertion that no public route can reach D1 — and takes the
measurements that decide where rendering runs. Phases 4 and 5 build the two tiers and then
**prove the premise**: zero D1 rows read on a public request, or the architecture is wrong and
work stops. Phase 6 doubles the corpus into Spanish, now safe because the prompt was fixed
four phases earlier. Phases 7-10 add imagery, islands, search and the reader-facing product
surface. Phase 11 measures the release-blocking accessibility and performance numbers on the
real site. Phase 12 moves the admin behind Cloudflare Access, starts the daily budget routine
*before* traffic moves, and cuts over — with success defined as 7 consecutive days under
2,000,000 D1 reads/day, down from 784,000,000.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Design Sketch & Editorial Identity** - Approved static HTML/CSS mockups that pass contrast and keyboard review before any Astro work (completed 2026-09-17)
- [x] **Phase 2: Content Quality & Grounding** - Fix extraction, prompt and grounding so no fabricated summary is ever written in a second language (completed 2026-09-21)
- [x] **Phase 3: Foundation & Read-Budget Guardrails** - Astro scaffold, the CI D1-import assertion, the render manifest, and the measurements that decide the render step (completed 2026-09-26)
- [ ] **Phase 4: Static Generation, Templates & SEO** - A fail-loud D1 loader and every public page type generated at build time
- [ ] **Phase 5: Hybrid Archive & Zero-Reads Proof** - R2 archive tier, tag tiering, and the measured proof of zero D1 reads on the public path
- [ ] **Phase 6: Bilingual** - Spanish summaries at ingest, `/es` routing, hreflang pairs and per-language feeds
- [ ] **Phase 7: Imagery & Share Cards** - Junk-image filter, generated imagery, and share cards validated on real platforms
- [ ] **Phase 8: Server Islands & Interactivity** - Weather, forecast and theme islands that degrade visibly instead of failing silently
- [ ] **Phase 9: Search** - Backend chosen by measurement, with no quiet exception to the zero-reads guarantee
- [ ] **Phase 10: Reader Subscription & Trust Surface** - Double opt-in subscription with entity follows, plus a named human and plain-English AI disclosure
- [ ] **Phase 11: Quality Gates** - The release-blocking accessibility, performance and SEO numbers measured on the real site
- [ ] **Phase 12: Admin Split, Cutover & Budget Routine** - Cloudflare Access, the daily guardrail routine, verified rollback, and 7 days under budget

## Phase Details

### Phase 1: Design Sketch & Editorial Identity

**Goal**: An approved, accessible visual system exists as static HTML/CSS — and is *accepted* — before any Astro code is written.
**Depends on**: Nothing (first phase)
**Requirements**: DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, DSGN-07, A11Y-01, PERF-07, I18N-07
**Success Criteria** (what must be TRUE):

  1. Static HTML/CSS mockups exist for home, category, article, changelog and contact in both light (default) and dark themes, the owner has explicitly approved them, and no `.astro` component file exists yet.
  2. Every text/background pair in both themes measures ≥4.5:1 for body text and ≥3:1 for large text and UI components, recorded as a checked contrast table covering all eight Chihuahuan-desert category colours — the design is not accepted until this passes.
  3. Every interactive element in the mockups is keyboard reachable and operable with a visible, unclipped focus indicator, verified by a keyboard-only walk of each mockup (not by inspecting CSS).
  4. Mockups render Spanish copy running 25% longer than the English equivalent with no overflow, clipping or content loss in cards and headlines.
  5. Instrument Serif (display) and Source Serif 4 (body) are self-hosted, subset to include Spanish diacritics, woff2-only, with `size-adjust` metric-compatible fallbacks measured to produce zero layout shift on swap; Playfair Display and Merriweather appear nowhere; the article grid is pure HTML with zero JavaScript.

**Plans:** 23/23 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Dependency legitimacy gate, pinned install, WebKit-on-Arch proof (native or Docker), static server and Playwright harness

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Tracer: one real D1 row → index.html → token layer → contrast gate → subset fonts and fallbacks → font-swap measurement → D-16 runner

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Palette: photo-sampled hues on shared OKLCH stops, dark ramp, swatch evidence (D-01–D-04, C-01)
- [x] 01-04-PLAN.md — D-06 stress set from live D1 (read-only), changelog copy, real + width-calibrated synthetic Spanish (D-15)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Contrast gate hardened test-first; becomes the Phase 3 CI guard (D-13)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Home and category mockups: typographic lead, reverse-chron stress grid, masthead colour block (D-01, D-09, D-12)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-07-PLAN.md — Article (standfirst deck, no pull quotes), changelog dispatches, contact; final font subset (D-10, D-11)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-08-PLAN.md — Scripted keyboard walk with clipping checks, structure and content-integrity specs, evidence (D-14)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 01-09-PLAN.md — Spanish +25% overflow, 320 px / 200% reflow, full font-swap matrix and report (D-07, D-08, D-15)

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 01-10-PLAN.md — Unscoped run, fingerprinted 01-APPROVAL.md, owner keyboard walk and sign-off (D-16) — owner chose **revise** (2026-09-17)

**Gap closure — round 1 owner review (see 01-APPROVAL.md "Revision requests")**

**Wave 10**

- [x] 01-11-PLAN.md — pnpm migration (D-GAP-D): lockfile parity, local Playwright CLI, package-lock.json retired; 01-10 record (not approved)
- [x] 01-12-PLAN.md — TDD: summary markdown → typed blocks → safe HTML (defect 9 groundwork)

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 01-13-PLAN.md — font-display: optional + classified CLS re-measure with a positive control; PRD §6.5 amended (D-GAP-A)

**Wave 12** *(blocked on Wave 11 completion)*

- [x] 01-14-PLAN.md — Source Serif 4 Bold headlines, Instrument Serif wordmark only (D-GAP-B); opsz-pinned subsets ≤60/30 KB; Instrument Serif Italic retired

**Wave 13** *(blocked on Wave 12 completion)*

- [x] 01-15-PLAN.md — Spanish +25% recalibration for the new type system (criterion 4)

**Wave 14** *(blocked on Wave 13 completion)*

- [x] 01-16-PLAN.md — Business hue from a new photo, outside the amber/olive band (D-GAP-C)

**Wave 15** *(blocked on Wave 14 completion)*

- [x] 01-17-PLAN.md — Header rule removed, toggle in the column at 1920px, external links in a new tab with an accessible cue (requests 1, 6; defect 10)

**Wave 16** *(blocked on Wave 15 completion)*

- [x] 01-18-PLAN.md — Rendered Key Details on all pages; category lead image-or-typographic fallback (defect 9; request 2)

**Wave 17** *(blocked on Wave 16 completion)*

- [x] 01-19-PLAN.md — Article right rail at ≥1024px; full width at 768px (requests 3, 7)

**Wave 18** *(blocked on Wave 17 completion)*

- [x] 01-20-PLAN.md — Changelog layout fix + rail; contact centred with button spacing; full width at 768px (requests 4, 5, 7)

**Wave 19** *(blocked on Wave 18 completion)*

- [x] 01-21-PLAN.md — Load more from static JSON: extraction, feed pages, shared head script, focus management, runner checks (request 8)

**Wave 20** *(blocked on Wave 19 completion)*

- [x] 01-22-PLAN.md — Content, Spanish and glyph checks run against the fully loaded home feed (request 8)

**Wave 21** *(blocked on Wave 20 completion)*

- [x] 01-23-PLAN.md — Unscoped run, strict round-2 packet with revision history, owner re-review and decision (D-16)

**UI hint**: yes

### Phase 2: Content Quality & Grounding

**Goal**: Summaries are faithful to their sources before a single new summary is written in any language.
**Depends on**: Nothing (pipeline-side; runs independently of Phase 1)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08, CONT-09, CONT-10, CONT-11, CONT-12, FIX-01, FIX-02, FIX-03, OPS-11
**Success Criteria** (what must be TRUE):

  1. On a 200-article sample of newly ingested articles, the `[...]` truncation marker rate is under 1% (down from 14.7% of the corpus) and zero summaries are longer than their source; summary length tracks source length with no fixed word floor.
  2. The grounding check flags the known production fabrication — *"Residents and dealership owners are urged to remain vigilant…"*, which is length-compliant and well-formed — and runs automatically on every newly ingested article alongside the length check.
  3. A dry run reports exact affected row count and projected cost in dollars before any re-processing begins; the run does not start until the owner approves that figure, uses the Batch API, and detects and resubmits only the remainder of any job unfinished at the 24-hour window.
  4. Reading ~30 summaries of sub-90-word sources on `gpt-5.6-luna` shows no padding, no invented advisories or calls to action, and no verbatim-heavy excerpting — thin sources produce a short attributed summary, not a longer quote.
  5. `reprocess-all.post.ts` chunks its ID lists to at most 100 bound parameters per statement and completes against the real corpus without `SQLITE_ERROR`; `pnpm deploy` and `pnpm deploy:dev` resolve `wrangler` as a real dependency; `app/pages/privacy.vue` passes Prettier.
  6. The 2026-09-04 → 2026-09-16 OpenAI outage gap is quantified before the dry run in criterion 3: the count of articles ingested in that window with a null, truncated or absent summary, and whether `detect-duplicates` ran. Any affected rows join this phase's re-processing set rather than being discovered later. **Checked in `915tldr.com2`, not this repo.**

**Plans:** 11/10 plans complete

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Toolchain: package-legitimacy gate, pinned installs (FIX-02), proven production D1 read access
- [x] 02-02-PLAN.md — Known defects: D1 100-parameter chunking helper + reprocess-all fix (FIX-01), Prettier (FIX-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-03-PLAN.md — Production corpus measurement: D-04 cap, CONT-12 outage audit, source death date, D-16 repoint

**Wave 3** *(blocked on Wave 2)*

- [x] 02-04-PLAN.md — Tracer: one article end-to-end — fetch → extract → summarise → ground → columnar write, plus the one-way production migration gate

**Wave 4** *(blocked on Wave 3)*

- [x] 02-05-PLAN.md — Extraction at scale: allowlisted polite fetcher, per-source fixtures, 200-article marker-rate sample (CONT-01)
- [x] 02-06-PLAN.md — Prompt: proportional length, facts-only key points, code-decided thin-source attribution, `gpt-5.6-luna` (CONT-02/03/07/08)

**Wave 5** *(blocked on Wave 4)*

- [x] 02-07-PLAN.md — Grounding detection: shared length unit, deterministic suite, verbatim overlap, claim-level judge with span re-verification (CONT-04/06/07)

**Wave 6** *(blocked on Wave 5)*

- [x] 02-08-PLAN.md — Labelled fixture set, false-positive ceiling, live gating with one stricter retry and a visible review queue (CONT-05)

**Wave 7** *(blocked on Wave 6)*

- [x] 02-09-PLAN.md — Dry run: free corpus sweep, outage union, token-validated cost projection, corpus fingerprint (CONT-09, OPS-11)

**Wave 8** *(blocked on Wave 7)*

- [x] 02-10-PLAN.md — Owner approval gate, report-gated Batch execution with expired-remainder resubmission, public changelog, editorial read (CONT-10/11, OPS-11)

### Phase 3: Foundation & Read-Budget Guardrails

**Goal**: The project cannot silently reintroduce D1 on the public path, and every layer (deploy / render / cache) can be told apart when debugging.
**Depends on**: Phase 1
**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, REND-06, OPS-02, OPS-05, OPS-06, OPS-08
**Success Criteria** (what must be TRUE):

  1. Adding a D1 import to any public route, island component, middleware or endpoint fails the build — demonstrated by deliberately adding one to a `.astro` page *and* one to a file under the island component tree, and watching CI go red both times.
  2. Astro config uses `output: 'static'` with per-route `export const prerender = false`, explicit `imageService: { build: 'compile', runtime: 'passthrough' }`, and `import { env } from 'cloudflare:workers'`; grepping the repo for `'hybrid'` and `Astro.locals.runtime.env` returns zero hits.
  3. The render manifest exists in KV with a documented schema that already carries the Spanish counterpart ID per article, so hreflang pairing never requires a backfill re-render of the corpus.
  4. `curl -I https://dev.915tldr.com` returns `X-Robots-Tag: noindex` from the edge (not an app meta tag); `/version.json` and the public footer both report the deployed short commit hash and build timestamp; the README states the read budget.
  5. Three numbers are recorded, not guessed: cron-worker CPU headroom, per-page render cost in ms, and D1 REST API pagination p50/p95 at 41,233 rows. The render-step location (cron worker / separate worker via Queues / CI) is decided from them and written down.

**Plans**: 7/7 plans executed in 5 waves

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Package-legitimacy gate, then the end-to-end tracer: one live D1 row rendered to a real URL with a KV manifest entry, assertion live in the build (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Permanent negative fixtures proving the assertion fires on a page and an island, plus the comment-stripped config guard (wave 2)
- [x] 03-03-PLAN.md — Build stamp: `/version.json` and the footer from one module with recorded provenance, plus the README read budget (wave 2)
- [x] 03-04-PLAN.md — Manifest schema hardened and documented; one-way decision on how the Spanish counterpart identity is populated (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Deploy to dev.915tldr.com and serve the edge noindex Transform Rule, verified by live response header (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-06-PLAN.md — The three D-01 measurements, including an empirical answer to the cron CPU ceiling question (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-07-PLAN.md — Render-step location decided from the measured numbers and written down (wave 5)

### Phase 4: Static Generation, Templates & SEO

**Goal**: Every public page type is generated at build time from D1, and a bad read fails the build instead of shipping an empty page.
**Depends on**: Phase 3
**Requirements**: REND-01, REND-02, REND-03, REND-04, REND-05, SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06, SEO-07, SEO-08, IDNT-03, IDNT-04, OPS-10, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):

  1. A build in which the hand-written `astro/loaders` Loader returns zero rows — or fewer than the manifest expects — exits non-zero and deploys nothing, proven by a regression test that replays the `/changelog` empty-state failure.
  2. Home, category index (both `/crime` and `/crime/**` resolve), article, tag, changelog and contact pages all render real content read from the D1 REST API at build time, and `/changelog` shows its full preserved history on every build.
  3. A cron cycle triggers an incremental build that re-renders only new and changed articles and ships a new Worker deployment; unchanged articles are byte-identical to the previous version.
  4. Every existing `/[category]/[slug]-[uuid]` URL still resolves with a correct canonical; `/rss.xml` and the per-bot `robots.txt` (AI-crawler and `Content-signal` rules intact) are preserved; the 404 suggestion endpoint still answers.
  5. `NewsArticle`, `BreadcrumbList`, `Organization` and `WebSite` structured data validate clean in the Rich Results Test on a real article (validated, not merely emitted); the Google News sitemap contains only the last 48 hours; every article carries an AI-generation disclosure at point of consumption and a prominent canonical link to the originating outlet.

**Carried from Phase 3 (owner decision, 03-UAT.md item 1, 2026-09-23):** v2 currently serves
`/path` → 307 → `/path/` (Astro's default directory-style output, no `trailingSlash` set) while
v1 serves `/path` → 200 directly — measured live on both. Every v1-emitted indexed link is in the
no-slash form, so under v2 every one of nine months of indexed URLs would take an extra redirect
hop against a release-blocking 1.5s LCP budget, and criterion 4 above ("every existing
`/[category]/[slug]-[uuid]` URL still resolves") is satisfied but not "unchanged". This
criterion and SEO-04/FIX-04/FIX-05 (already mapped to this phase in REQUIREMENTS.md) are where it
must be resolved.

**Decided (owner, 2026-09-26): drop the trailing slash.** Set `trailingSlash: 'never'` with
`build.format: 'file'` in `astro.config.mjs`, so v2 matches v1's URL shape exactly and indexed
URLs answer 200 with no redirect. The usual risk of this setting — relative links such as
`href="story"` resolving differently — does not apply: every internal link in `src/` is absolute
(`/`, `/changelog`, `/contact`, `` `/${row.category}` ``, `/fonts/…`), checked 2026-09-26. Keep new
links absolute.

**RSS gotcha — must be handled in the same change.** Per the Astro docs (RSS recipe, "Removing
trailing slashes"): the RSS feed emits links WITH a trailing slash by default, *regardless of the
`trailingSlash` config*. Pass `trailingSlash: false` to the `rss()` helper in the `/rss.xml`
endpoint, or the feed's links will not match the page URLs. Verify by fetching `/rss.xml` and
checking that item links have no trailing slash and each answers 200 directly.

**Plans**: 12/12 plans executed in 6 waves

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: one real article D1 → Content Layer loader → stored-slug canonical page → KV manifest v2 → live on dev; Spike 1 (does a Loader throw fail the build?) (wave 1)
- [x] 04-02-PLAN.md — Approved chrome in Base, head-metadata contract, deterministic date formatting, safe JSON-LD, shared ArticleCard (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Full loader: dry run, cold/warm/sweep modes, rows-read budgets, never-shrink check vs KV last-good, first measured full-corpus build (wave 2)
- [x] 04-04-PLAN.md — Article template: AI disclosure, attribution, tags, rail (owner decision on byte-identity), NewsArticle/BreadcrumbList, canonical (wave 2)
- [x] 04-05-PLAN.md — Listing pages: home, 8 category indexes (FIX-04), tag pages + /tags, source pages (wave 2)
- [x] 04-06-PLAN.md — First Worker: non-canonical 301 via one KV read, navigation-safe routing, 404 page with build-time suggestions, legacy redirects (wave 2)
- [x] 04-07-PLAN.md — SEO surfaces: package-legitimacy checkpoint, robots.txt, /rss.xml (no trailing slash), news sitemap (48 h), general sitemap (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-08-PLAN.md — /changelog dual-source loader with fail-loud rules and the REND-03 real-build regression; contact/about/privacy/terms (wave 3)
- [x] 04-09-PLAN.md — CI wrapper (never deploys a failed build, ntfy on failure), Workers Builds setup doc, local incremental-build spike (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-10-PLAN.md — Owner connects 915tldr-frontend to Workers Builds; hook-triggered cold/warm builds, page reuse and failure drill measured (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-11-PLAN.md — Owner decides the full-rebuild mechanism (one-way); apply it, byte-identity regression, D-05 doc amendment, backend Deploy Hook trigger (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-12-PLAN.md — Deploy and verify every URL/SEO contract live, in a real browser; validation map; owner human-checks (wave 6)

**UI hint**: yes

### Phase 5: Hybrid Archive & Zero-Reads Proof

**Goal**: Prove the premise — a public request reads zero D1 rows — or stop the project here for architecture review.
**Depends on**: Phase 4
**Requirements**: ARCH-01, ARCH-08, REND-07, REND-08, REND-09, REND-10, REND-11, REND-12
**Success Criteria** (what must be TRUE):

  1. Cloudflare D1 analytics report **0 rows read** attributable to the public worker across a scripted pass over the homepage, all 8 category pages, 20 hot articles, 20 archived articles, 20 tag pages, the sitemap and `/rss.xml`. A non-zero result halts the project — this is the gate, not a check.
  2. An archived article request misses the static-asset layer, falls through to the Worker and is served from R2, with Worker→R2 `get()` latency for ~30 KB objects recorded as p50/p95 numbers and shown to fit inside the 1.5 s LCP budget.
  3. A public request performs at most 1 KV read and under 5 ms of Worker CPU, measured on the deployed worker rather than estimated.
  4. Tag pages default to the R2 archive tier with only a measured top-N by article count promoted to hot static; total deployed static-asset file count is reported daily, the current count is recorded against the 100,000 ceiling, and the build fails at an 80,000-file safety margin.
  5. The hot-content cutoff is derived from measured request traffic over a stated window — not a fixed guess — and a full archive re-render completes with no single Worker invocation exceeding the 300 s CPU ceiling.

**Plans**: 17/21 plans executed — 12 executed in 7 waves; 9 gap-closure plans (05-13..05-21, from 05-VERIFICATION.md + 05-REVIEW.md) in 4 waves

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Tiering rules (D-08 tag threshold, inclusive age cutoff), hot-window config (bootstrap D-07 fallback), build-time tier facts, tier-report (wave 1)
- [x] 05-02-PLAN.md — Package-legitimacy checkpoint, owner creates private R2 bucket + bucket-scoped credential, build-time R2 client with live round trip and build-gate case (wave 1)
- [x] 05-03-PLAN.md — Worker serves archived articles (one KV read) and tags (zero KV) from R2, static-parity headers, 503 on R2 error, edge cache, Server-Timing (wave 1)
- [x] 05-04-PLAN.md — Zero-reads load test (leg 1b + leg 2 delta vs v1 background) and ARCH-08 KV/CPU tool, TDD'd and baseline-proven live (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-05-PLAN.md — Derive the hot window from 30 days of live human-only traffic (D-04..D-07b), capped by the file budget; REND-10 met in-phase (wave 2)
- [x] 05-06-PLAN.md — Post-build partition of archive-tier pages, 80,000-file build gate, /static-budget.json, tests across both tiers (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-07-PLAN.md — Archive sync: pre-deploy upload with move-back, post-deploy re-upload/orphans/backlog, deadlines, D-09..D-12, architecture record (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-08-PLAN.md — Wire archive sync and the count gate into the Workers Builds wrapper; alerts, 70,000 alarm, daily file-count report, fallback guard; pipeline docs (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-09-PLAN.md — Owner decides the route to dev.915tldr.com (costly decision: merge to main vs local deploy); first archive-tier deploy observed and live-checked (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 05-10-PLAN.md — REND-12: forced full re-upload through the real pipeline; verdict with the criterion-5 (300 s) reinterpretation (wave 6)
- [x] 05-11-PLAN.md — Live URL contract and real-browser journeys for archived pages; R2 latency p50/p95 and archived LCP vs 1.5 s (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 05-12-PLAN.md — The zero-reads gate (D-01..D-03, halt on failure) and ARCH-08 on the deployed Worker; validation map closed (wave 7)

**Gap closure — Wave 1** *(2026-10-02, owner scope: verifier gaps + safety warnings)*

- [x] 05-13-PLAN.md — CR-01 (ci-build): a dry-run or failed deploy never spawns archive-sync post; credential-free real-CLI rehearsal
- [x] 05-14-PLAN.md — CR-01 + WR-01 (archive-sync): post refuses a dry run and any build that is not the live deployment; pre-delete re-check
- [x] 05-15-PLAN.md — WR-08 / REND-10: countOtherFiles counts dist/client + dist/archive; real re-derivation run end to end, preview only
- [x] 05-16-PLAN.md — CR-03: load window aligned exactly like the baseline; 2026-10-01 verdict re-checked with a read-only aligned re-query
- [ ] 05-17-PLAN.md — ARCH-08: repeatable per-request CPU tool on Workers Observability (API verified live); 1-vs-4 reconciliation; IN-01 correlation

**Gap closure — Wave 2** *(blocked on Gap closure Wave 1 completion)*

- [x] 05-18-PLAN.md — WR-02: R2 failures can't leave the index lying; pre self-heals via listKeys; deleteObjects partial results
- [ ] 05-19-PLAN.md — ARCH-08 owner decision (accept with definition / fix code / re-measure) recorded; WINDOWS #26 per decision

**Gap closure — Wave 3** *(blocked on Gap closure Wave 2 completion)*

- [ ] 05-20-PLAN.md — CR-02 (+ IN-06 part): `pnpm run deploy` routed through ci-build; sync marker + guard before wrangler; stale build-start marker ignored

**Gap closure — Wave 4** *(blocked on Gap closure Wave 3 completion)*

- [ ] 05-21-PLAN.md — REND-11 daily-report human check; 05-VALIDATION.md and evidence-based REQUIREMENTS.md statuses; deferred review findings parked

### Phase 6: Bilingual

**Goal**: Every article exists in English and Spanish, and the reader — never an IP lookup — chooses which one they see.
**Depends on**: Phase 2 (prompt fixed first), Phase 5 (tiering absorbs the doubled corpus)
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, I18N-06, I18N-08, I18N-09, I18N-10
**Success Criteria** (what must be TRUE):

  1. Each newly ingested article carries an English and a Spanish summary produced in the same model call, with source language detected and stored; the Spanish backfill of the archive runs via the Batch API only after a costed dry run and approval.
  2. `/es/...` exists for every public page type; every page emits self-referencing `hreflang` pairs plus `x-default`, verified per page pair, with separate sitemaps and RSS feeds per language.
  3. Requesting any page with a Spanish `Accept-Language` header lands on the English page — language changes only when the reader chooses it, with no IP or browser auto-redirect anywhere in the stack.
  4. Spanish-language articles render with `lang="es"` on the correct element and carry the same AI-generation disclosure as their English counterparts.
  5. `Accept-Language` is logged at the edge and a report of Spanish-preferring request share is available to inform the `/es` launch decision on 2-4 weeks of measured data.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Imagery & Share Cards

**Goal**: Every article has a real image and a share card that renders correctly on the platforms people actually paste links into.
**Depends on**: Phase 4
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, IMG-06, IMG-07, IMG-08, IMG-09, IMG-10, SOC-01, SOC-02, SOC-03, SOC-04, SOC-05, SOC-06, SOC-07, SOC-08, PERF-08, PERF-09, PERF-10, A11Y-06
**Success Criteria** (what must be TRUE):

  1. Zero articles display an emoji sprite, generic placeholder or undersized image: the ingest filter rejects them going forward and the retroactive pass reclassifies all 1,098 existing junk images.
  2. A 10-image Flux-Schnell quality test is decided by looking at the images, and the 15,624-article backfill runs only after a costed dry run and explicit approval; ongoing per-article generation stays inside the free 10,000 neurons/day allocation.
  3. Eight category heroes read as one visual system (generated via reference images on `gpt-image-2.5-flare`), and real per-image cost is recorded from `usage.output_tokens` as a measured dollar figure — the flat-rate table is not used.
  4. Every article has a 1200×630 share card at an absolute HTTPS URL under 5 MB, produced by deterministic composition with no AI-rendered text, verified by pasting real URLs into the Facebook debugger, X validator, iMessage, WhatsApp and Slack; the file size that actually renders on WhatsApp is recorded as a number.
  5. Generated images live in R2 with assignments recorded in D1 so they survive rebuilds; every image emits explicit `width`/`height`, `srcset`/`sizes` with AVIF and WebP plus fallback, and meaningful `alt` (or `alt=""` when decorative); the LCP image carries `fetchpriority="high"` and is never lazy-loaded; every page emits the full Open Graph, `article:*` and `summary_large_image` Twitter tag set.

**Plans**: TBD
**UI hint**: yes

### Phase 8: Server Islands & Interactivity

**Goal**: The few dynamic pieces of the page degrade visibly instead of failing silently.
**Depends on**: Phase 3
**Requirements**: ISL-01, ISL-02, ISL-03, ISL-04, ISL-05, ISL-06, ISL-07, ISL-08, A11Y-07
**Success Criteria** (what must be TRUE):

  1. Weather and a 7-day forecast render as server islands from a single existing NWS response (`EPZ/86,64`) with zero additional API calls, and an "updated Xm ago" indicator renders as a server island.
  2. With each upstream deliberately blocked or slowed past its timeout, every island shows its `slot="fallback"` content and the page still renders — verified by actually failing each upstream, not by reading the code.
  3. `ASTRO_KEY` is pinned as a stable secret and every island's encrypted prop payload measures under 2048 bytes, so island requests stay cacheable GETs and survive a rolling deploy without decryption errors.
  4. Islands number exactly five — search, category filter, theme toggle, load-more, weather — the CI D1-import scan covers every island file and `/_server-islands/*` path, and the theme toggle hydrates with no mismatch warning in the console.
  5. `<ClientRouter />` from `astro:transitions` drives page transitions, and every transition and animation is suppressed under `prefers-reduced-motion: reduce`.

**Plans**: TBD
**UI hint**: yes

### Phase 9: Search

**Goal**: Readers can search the corpus in both languages without the zero-reads guarantee acquiring a quiet exception.
**Depends on**: Phase 5, Phase 6 (Spanish content must exist to test cross-language relevance)
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Known constraint (resolved 2026-09-16)**: `articles-semantic` is populated by `@cf/baai/bge-base-en-v1.5` — **768-dim and English-only**. Vectorize as it stands cannot match Spanish queries to English article vectors, so its cross-language advantage does not exist today. Three candidate paths, none free.
**Success Criteria** (what must be TRUE):

  1. All three viable paths are measured against the real corpus in English *and* Spanish on 30-50 test queries — (a) FTS5 with a scoped D1 carve-out, (b) re-embedding the corpus with a multilingual model such as `bge-m3`, (c) per-language indexes — and the choice is written down with the relevance, p95 latency and cost numbers that decided it, not chosen on architecture preference. If (b) is chosen, it is a corpus-wide operation and takes a dry run and approval under the §4.1 rules.
  2. A reader can search from any public page and get relevant results, with p95 query latency under 500 ms and cost per query under $0.001.
  3. Either search performs zero D1 reads and the Core Value holds without exception, or the D1 exception is explicitly scoped, capped with a stated daily read ceiling inside the 2,000,000/day budget, and approved by the owner. Silently reading D1 is not an available outcome.

**Plans**: TBD
**UI hint**: yes

### Phase 10: Reader Subscription & Trust Surface

**Goal**: A reader can subscribe on their own terms, and can tell who made this and how the AI works.
**Depends on**: Phase 4
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SUB-08, IDNT-01, IDNT-02, IDNT-05, IDNT-06, A11Y-08
**Success Criteria** (what must be TRUE):

  1. A reader submits an email, selects any of the eight categories, follows named entities drawn from the existing 46,090, and picks a preferred language; nothing counts as subscribed until a double opt-in link is clicked.
  2. Every subscriber row carries a working unsubscribe token and link, and preference changes go through a magic link with no password and no session anywhere in the flow.
  3. A scripted subscribe and preference change shows 0 D1 rows read attributable to the public request — the subscribe path writes only.
  4. The About page names a real person with a photo, written in first person, and explains in plain English what is automated, what is summarised and where the reporting comes from; a contact route exists that is not a form-only dead end; links to `jjaimealeman.com` and `915website.com` are present.
  5. Every form input has an associated label and validation errors are announced, verified with an actual screen reader rather than by inspecting markup.

**Plans**: TBD
**UI hint**: yes

### Phase 11: Quality Gates

**Goal**: The release-blocking numbers are met on the real site — measured, not asserted.
**Depends on**: Phases 1, 4, 6, 7, 8, 10
**Requirements**: A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-09, A11Y-10, A11Y-11, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, SEO-09
**Success Criteria** (what must be TRUE):

  1. Lighthouse scores 100 accessibility and 100 SEO, and at least 95 performance, across home, category, article, changelog and contact — and Lighthouse CI fails the build below those thresholds.
  2. Field p75 mobile measures LCP under 1.5 s, INP under 100 ms and CLS under 0.05; lab measures FCP under 1.0 s and TBT under 100 ms.
  3. A manual keyboard and screen-reader pass across every page type is completed and recorded with zero blocking findings: the skip link works, tab order is logical, focus indicators stay visible and unclipped inside `overflow` containers, and no island creates a keyboard trap.
  4. Every page has exactly one `h1` with a correct heading hierarchy and landmark regions, and every interactive control is a real `<button>` or `<a>` — zero clickable `div`s in the rendered output.
  5. The site is usable at 200% zoom and at 320 px width with no horizontal scroll and no content loss, in both light and dark themes.

**Plans**: TBD
**UI hint**: yes

### Phase 12: Admin Split, Cutover & Budget Routine

**Goal**: v2 serves `915tldr.com` under budget, with the guardrail that was missing for nine months running daily before traffic moves.
**Depends on**: Phase 11
**Requirements**: ARCH-07, OPS-01, OPS-03, OPS-04, OPS-07, OPS-09
**Success Criteria** (what must be TRUE):

  1. The Nuxt pipeline and admin serve from `admin.915tldr.com` behind Cloudflare Access, and an unauthenticated request against every admin route — including newly added ones — is blocked at the edge; Better Auth, its four tables, `/admin/login` and all session handling are removed from the repo.
  2. A daily routine reports D1 reads, spend, OpenAI account balance, static-asset file count and field Core Web Vitals against their budget thresholds, and it is confirmed running *before* public traffic moves.
  3. Rollback to the existing v1 worker is exercised as a real route change and verified to serve correctly before cutover — not documented and assumed.
  4. `915tldr.com` serves from the Astro worker and D1 reads stay under 2,000,000/day for 7 consecutive days at 100% traffic (down from 784,000,000/day), with zero reads attributable to public requests.

**Deliverable (owner decision, 2026-09-23):** reorganize `915tldr.com`/`915tldr.com2` into a
plain parent directory (`915tldr.com/`, not a repo) holding two separate git repos
(`915tldr-frontend/`, `915tldr-backend/`), mirroring the `LizMonroy_website/babs-admin` /
`babs-boutique` precedent — see `.planning/todos/pending/2026-09-23-split-repos-into-plain-parent-directory.md`
(`resolves_phase: 12`) for the full rationale.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

Phases 1 and 2 are independent of each other and may run in parallel. Phase 8 depends only on
Phase 3 and may run alongside Phases 5-7.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design Sketch & Editorial Identity | 23/23 | Complete    | 2026-09-17 |
| 2. Content Quality & Grounding | 11/10 | Complete    | 2026-09-21 |
| 3. Foundation & Read-Budget Guardrails | 7/7 | Complete    | 2026-09-26 |
| 4. Static Generation, Templates & SEO | 12/12 | In Progress|  |
| 5. Hybrid Archive & Zero-Reads Proof | 17/21 | In Progress|  |
| 6. Bilingual | 0/TBD | Not started | - |
| 7. Imagery & Share Cards | 0/TBD | Not started | - |
| 8. Server Islands & Interactivity | 0/TBD | Not started | - |
| 9. Search | 0/TBD | Not started | - |
| 10. Reader Subscription & Trust Surface | 0/TBD | Not started | - |
| 11. Quality Gates | 0/TBD | Not started | - |
| 12. Admin Split, Cutover & Budget Routine | 0/TBD | Not started | - |

## Measurement Obligations

These are deliberately unresolved in the roadmap. Each is placed where it must be settled, and
appears as a success criterion of that phase.

| Measurement | Phase | Why it cannot be guessed |
|---|---|---|
| Cron-worker CPU headroom | 3 | Decides whether the render step lives in the cron worker, a separate worker via Queues, or CI |
| Real per-page render cost (ms) | 3 | A full 82k rebuild at ~4 ms/page is ~330 s — over the 300 s Worker CPU ceiling regardless of location |
| D1 REST API pagination at 41,233 rows | 3 | The entire build depends on the loader; no Drizzle runtime driver exists for D1-HTTP |
| ~~`articles-semantic` vector gap~~ **RESOLVED 2026-09-16** | — | Embeddings run on Workers AI, billed separately from the OpenAI credit balance. The $0 balance could not starve them. No gap |
| ~~Which embedding model populates `articles-semantic`~~ **RESOLVED 2026-09-16: `@cf/baai/bge-base-en-v1.5`, English-only** | — | Answered by direct code check. Vectorize's cross-language advantage does **not** exist today — this changes the Phase 9 option set, it does not remove the decision |
| OpenAI cron-outage gap 2026-09-04 → 2026-09-16 (**urgent**) | 2 | `cron/process`, `cron/fetch` and `cron/detect-duplicates` call OpenAI and returned 429 for ~12 days. ~1,200 articles may be unsummarised or half-processed and duplicates may have passed through. Sizes Phase 2's re-processing set, so it must be known before the dry run |
| Astro build time and memory at 41k-82k pages via a D1-backed loader | 4 | No public benchmark exists for a DB-backed loader at this scale — near-novel territory |
| Worker → R2 `get()` latency at ~30 KB | 5 | The archive hop is on the critical path for most article requests |
| Hot-content cutoff from measured request traffic | 5 | The PRD's 2,000 figure is the only number in it not grounded in a measurement |
| Real per-image cost from `usage.output_tokens` | 7 | GPT Image 2.5 billing is per output token; the flat-rate table ran 3.3× high when measured |
| WhatsApp's real share-card size ceiling | 7 | Undocumented, and WhatsApp is the strictest platform and the one that matters most locally |
| Search backend: FTS5 vs Vectorize | 9 | FTS5 lives in D1 and would need an explicit carve-out to the Core Value; Vectorize is unproven at this corpus size |

---
*Roadmap created: 2026-09-16*

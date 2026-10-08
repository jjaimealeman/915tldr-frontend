# Phase 6: Bilingual - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Every public article exists in English and Spanish. The Spanish version is produced in the same
model call as the English one and checked by the same grounding check. Every public page type is
mirrored under `/es/...` with self-referencing `hreflang` pairs plus `x-default`. Each language
gets its own sitemap and RSS feed. The reader chooses the language through plain links; nothing
redirects by IP, browser language or cookie. Spanish-language content carries `lang="es"` and the
same AI disclosure as English. The existing ~40,761-article archive is backfilled through the Batch
API after a costed dry run.

**Why Spanish (owner, 2026-10-03):** Spanish-speaking readers in El Paso and Juárez are not served
by the local outlets. A complete, free Spanish edition could make 915 TLDR their primary local
news source. Spanish is now a conviction, not an experiment gated on data (see D-09).

**Not in scope:** translating tags or slugs (D-02); a remembered language preference (D-14); the
Umami engagement-tracking setup beyond the base tag (deferred); the contact-page/reader-feedback
push (deferred); imagery, islands, search (Phases 7–9).

</domain>

<decisions>
## Implementation Decisions

### Spanish data shape (I18N-01, I18N-02, I18N-09)
- **D-01:** Spanish content lives in a new **sibling table `article_translations`** keyed by
  `(article_id, language)`, holding at least title, summary, key_points and the translation's own
  grounding status/report. `articles` and every existing query and index stay untouched. This
  matters because a previous unrelated index flip silently made related-articles 26× more
  expensive. Pairing maps directly onto the render manifest's `translationGroupId` (English uuid)
  plus `language` (Phase 3, `src/lib/server/kv-manifest.ts`). — **Reversibility:** costly — the
  loader, manifest builder, pipeline writes and backfill all target this table; moving to another
  shape means a D1 migration plus rewriting each reader.
- **D-02:** Only **title, summary and key points** are translated. Tags, entities and source names
  stay untranslated. Category display names (Crime → Crimen, etc.) come from a **fixed UI label
  map**, never the model. Slugs are not translated (Phase 4 D-07: slugs are frozen identity).
- **D-03:** **Source language is detected at ingest and stored** (I18N-02). It drives `lang="es"`
  on Spanish-origin source titles/links and the "Originally reported in Spanish" label (D-07).
  Detection method is up to Claude (e.g. returned by the same model call vs. a local heuristic).
- **D-04:** **The Phase 2 grounding check also runs on the Spanish summary**, with the same review
  queue. Spanish readers are the least able to cross-check a fabricated claim against the English
  source.
- **D-05:** **English passes, Spanish fails → publish English, hold Spanish.** The Spanish version
  goes to the review queue. Until it clears, the `/es` URL for that article serves the English
  content with a short "no disponible en español todavía" note (and correct `lang` attributes).
  One bad translation never delays the news. The same fallback applies to any article whose
  Spanish version doesn't exist yet (e.g. mid-backfill).

### URLs & Spanish-origin articles (I18N-03, I18N-04, I18N-05, I18N-06)
- **D-06:** Spanish URLs are **`/es` + the identical English path**:
  `/es/[category]/[slug]-[uuid]`, `/es/tag/[slug]`, `/es/source/[slug]`, `/es/about`, etc. Every
  public page type is mirrored. The switcher just adds or removes `/es`. Phase 4's 301-to-canonical
  logic applies under `/es` too. — **Reversibility:** one-way — once indexed and shared,
  `/es` URLs are a published contract (same reasoning as nine months of v1 URLs).
- **D-07:** **Spanish-origin articles (~1.5%) are handled like every other article**: the same call
  produces both languages and both pages pair via hreflang. The English page shows
  **"Originally reported in Spanish"** next to the source link, and the source link carries
  `lang="es"`.
- **D-08:** Defaults accepted: **`x-default` → English** for every pair; **`/es/rss.xml`** plus a
  **Spanish sitemap** alongside the English ones (I18N-06). Whether `/es` also gets a Google News
  sitemap is up to Claude.

### Launch & backfill (I18N-10, success criterion 1)
- **D-09:** **`/es` is fully public as soon as the phase ships**: linked, indexed and in the
  sitemap from day one. **This overrides PROJECT.md's "`/es` launch decided on 2–4 weeks of
  measured data" rule**, which must be updated at phase transition. Language data now informs how
  much to *promote* Spanish, not whether it exists. The owner chose this knowing PROJECT.md argues
  the 80%-Hispanic figure alone doesn't justify Spanish; the rationale in `<domain>` is the
  owner's.
- **D-10:** **Backfill the whole archive (~40,761 public articles)** through the Batch API, after a
  dry run reporting row count and projected cost (budget estimate ~$1.49; re-measure, don't trust
  it) and explicit owner approval. The 60,000 static-file budget already assumes this (59,836
  projected). Spanish pages for archived articles re-render per Phase 5 D-11, within REND-12's
  per-invocation CPU ceiling.
  - **Amended 2026-10-07 (owner decision):** the backfill shipped as the newest 10,000 articles, translation-only with flagged rows held (cost $3.41, 8.8% of public articles clean Spanish); older articles serve the D-05 English fallback until a later, separately approved extension.
- **D-11:** **I18N-10 is met through Umami**, not Worker code. The owner's self-hosted Umami tag
  goes on **both v1 (now, as a separate quick task in `915tldr.com2`) and v2**:
  `<script defer src="https://stats.915websites.com/script.js" data-website-id="8e82b1af-925f-4a5a-b0d1-e02f616ae077"></script>`.
  Umami's browser-language report (`navigator.language`, effectively the first `Accept-Language`
  choice) is the language-share report. **Research must confirm this instance actually exposes a
  Languages report** before I18N-10 is marked met. If it doesn't, fall back to an aggregate-bucket
  counter (es-first / en-first / other) with no IPs, no full headers and no D1. Note that most v2
  HTML is served as static assets without invoking the Worker (`run_worker_first: false`), so a
  Worker-only counter would miss most requests.
  - Verified 2026-10-03: the tag was **never installed** in v1 code, v2 code, live `915tldr.com`
    or `dev.915tldr.com`, which is why the Umami dashboard shows zero.
  - The third-party script must not break Lighthouse 100 / LCP < 1.5s (keep `defer`; Phase 11
    measures it), and the Privacy page (EN + ES) must disclose it.

### Switcher & site chrome (I18N-08)
- **D-12:** The language switcher appears **in the site header on every page** ("Español" /
  "English") **and as a visible "Leer en español" / "Read in English" link near the top of each
  article**. These are plain links to the paired URL with no JavaScript. Most readers arrive via
  search directly on an article, so the header alone is too easy to miss.
- **D-13:** **No automatic language selection anywhere.** No IP lookup, no `Accept-Language`
  redirect, no cookie-based redirect (I18N-08). Success criterion 3 is verified by requesting
  pages with a Spanish `Accept-Language` and getting English.
- **D-14:** **Persistence is links only, no cookie.** Every internal link on an `/es` page stays
  inside `/es`, so a reader who picked Spanish keeps browsing in Spanish. A fresh arrival at an
  English URL sees English plus the switcher.
- **D-15:** UI strings (nav, footer, buttons, labels, the AI disclosure) come from a **small fixed
  EN/ES dictionary**. The AI disclosure in Spanish carries the same meaning as the English one
  (I18N-09).
- **D-16:** **About, Privacy, Terms and Contact under `/es` are drafted in Spanish by Claude and
  reviewed by a fluent human (owner, Liz, or another reviewer) before shipping.** Privacy and Terms
  are close to legal text, and About is the trust page.
- **D-17:** **`/es/changelog` has a Spanish header and intro, with entries left in English**
  (`lang="en"` on them) and a one-line note that build notes are published in English. Future
  entries are not translated.

### Claude's Discretion
- The source-language detection method (D-03).
- The exact `article_translations` columns beyond the required ones, its indexes, and migration
  mechanics in `915tldr.com2`.
- Spanish register and tone (neutral Latin American Spanish suits an El Paso/Juárez audience; avoid
  Spain-specific vocabulary) and the exact prompt change for same-call bilingual output.
- Whether `/es` gets its own Google News sitemap (D-08).
- Backfill ordering (newest first is the obvious default) and cycle pacing within REND-12.
- Exact wording of the fallback note, the "Originally reported in Spanish" label and the switcher
  labels.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 6: Bilingual" — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — I18N-01…06, I18N-08…10 (I18N-07 already met in Phase 1)
- `.planning/PROJECT.md` §"Why bilingual" and Key Decisions — rationale, budget lines (~$1.49
  Spanish backfill), Batch-API rule. **D-09 above supersedes its "launch on 2–4 weeks of data"
  line.**
- `docs/PRD.md` §7 "Bilingual — English and Spanish" (line ~506) and §6.1 Language (`lang="es"`
  rule, line ~363)

### Prior-phase decisions this phase builds on
- `.planning/phases/03-foundation-read-budget-guardrails/03-CONTEXT.md` D-04 — manifest identity:
  `translationGroupId` + `language`
- `src/lib/server/kv-manifest.ts` — `ManifestEntry.translationGroupId` / `language: 'en' | 'es'`
  (lines ~15–72, ~138–147)
- `.planning/phases/04-static-generation-templates-seo/04-CONTEXT.md` D-07 (frozen slugs), D-08
  (301 to canonical), D-14/D-15 (fail-loud loader, failed build deploys nothing)
- `.planning/phases/05-hybrid-archive-zero-reads-proof/05-CONTEXT.md` D-11 (per-article
  re-render of archived content), D-13 (80,000 file fail line)
- `docs/phase-05/hot-window-derivation.md` §"Cap arithmetic" — 60,000-file post-Phase-6 budget,
  59,836 projected
- `.planning/phases/02-content-quality-grounding/02-CONTEXT.md` — grounding check design (D-04
  extends it to Spanish)

### Pipeline (separate repo `../915tldr.com2`)
- `server/db/schema.ts` — `articles` table (no language column today)
- `server/utils/openai.ts` — summariser prompt and response shape (title/summary/keyPoints)
- `server/utils/ai-processor.ts` — processing and storage path
- `server/utils/grounding-check.ts` — grounding judge to extend to Spanish
- `server/utils/batch-jsonl.ts`, `server/utils/cost-estimate.ts` — existing Batch API and dry-run
  cost tooling for the backfill

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/categories.ts` — the 8 categories; extend it (or add alongside it) with the Spanish
  display-name label map (D-02).
- `src/lib/seo-feeds.ts`, `src/pages/rss.xml.ts`, `src/pages/news-sitemap.xml.ts` — feed and
  sitemap generation to parameterise by language.
- `src/lib/structured-data.ts` — JSON-LD; needs `inLanguage` per page.
- `src/layouts/Base.astro` — the `<html lang>`, hreflang `<link>`s and header switcher go here.
- `src/components/ArticleCard.astro` — already proven against +25% Spanish text (I18N-07).
- `design/tests/support/i18n.ts` — Phase 1 Spanish test copy, including "Puntos clave".
- `../915tldr.com2/server/utils/batch-jsonl.ts` + `cost-estimate.ts` — Batch API and dry-run
  costing used by the Phase 2 re-processing backfill.

### Established Patterns
- **Zero D1 reads on the public path**: Spanish pages are built and stored exactly like English
  ones (static hot tier + R2 archive). Nothing on the request path reads D1. The CI D1-import
  assertion must cover `/es` routes.
- **Incremental builds** (Phase 4 D-06, Workers Builds caching) and the "never shrink vs. last
  good build" rule now apply per language.
- **Hot/archive tiering** by age (202-day hot window) applies to Spanish pages identically.

### Integration Points
- Pipeline ingest (2-hour cron in `915tldr.com2`) writes `article_translations` rows in the same
  model call as the English summary.
- The build-time D1 loader joins `article_translations` to emit `language: 'es'` manifest entries
  with the shared `translationGroupId`.
- Page routes under `src/pages/` gain `/es` mirrors (probably an `es/` route tree or a language
  param; planner's call).

</code_context>

<specifics>
## Specific Ideas

- Fallback note on a missing or held Spanish version: "no disponible en español todavía".
- English page label for Spanish-origin articles: "Originally reported in Spanish".
- Article-level switcher copy: "Leer en español" / "Read in English".
- The Umami tag above, verbatim, with `defer`.
- The owner wants the Spanish edition to feel complete on day one; an almost empty `/es` would be
  a weak first impression for the readers being courted (hence D-10's full backfill).

</specifics>

<deferred>
## Deferred Ideas

- **Contact page as a bigger focus, and actively asking readers "what do you want/need?"** before
  building more features (owner, 2026-10-03). Fits Phase 10 (Reader Subscription & Trust Surface)
  or its own small phase. Owner's principle: don't build features on our guesses about what
  readers want.
- **Deploy a real working product as soon as possible** (owner, 2026-10-03). A roadmap ordering
  question (e.g. whether cutover moves earlier) to raise at the next roadmap review, not in this
  phase.
- **Umami engagement setup**: owner will grant Claude browser access to configure events/goals to
  measure engagement. Separate task.
- **Umami tag on v1 now**: quick task in `915tldr.com2`, outside this phase's repo (D-11).
- **`tools/derive-hot-window.mjs` has no hostname filter.** The zone includes `dev.` and
  `admin-dev.`; the Oct 1 load test (13,472 dev requests) contaminated the 2026-10-02 re-derivation
  preview (44,515 requests, "261 days / 78.6%"). The in-force 202-day window from the Sep 1–30
  derivation is unaffected (dev/admin-dev were ~1.7% of that sample). Filter to `915tldr.com` +
  `www.` before any re-run, and correct the re-derivation section of
  `docs/phase-05/hot-window-derivation.md`.

### Reviewed Todos (not folded)
- "Split repos into a plain parent directory at Phase 12", "Tracer test fails when the newest
  article title contains an apostrophe", "Phase 5 code-review findings deferred from gap closure".
  These matched on generic keywords only and aren't bilingual work.

</deferred>

---

*Phase: 06-bilingual*
*Context gathered: 2026-10-03*

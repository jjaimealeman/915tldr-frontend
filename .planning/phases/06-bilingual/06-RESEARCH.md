# Phase 6: Bilingual - Research

**Researched:** 2026-10-03
**Domain:** Bilingual (EN/ES) content pipeline, D1 schema extension, Astro static-site i18n routing, Cloudflare KV/R2 archive-tier serving, OpenAI Batch API cost projection
**Confidence:** MEDIUM — the content/routing architecture is HIGH confidence (read directly from this repo's own source); the Batch-backfill cost figure and the Umami Languages-report claim are MEDIUM/LOW and flagged below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spanish data shape (I18N-01, I18N-02, I18N-09)**
- D-01: Spanish content lives in a new sibling table `article_translations` keyed by `(article_id, language)`, holding at least title, summary, key_points and the translation's own grounding status/report. `articles` and every existing query and index stay untouched. Pairing maps directly onto the render manifest's `translationGroupId` (English uuid) plus `language` (Phase 3, `src/lib/server/kv-manifest.ts`). Reversibility: costly.
- D-02: Only title, summary and key points are translated. Tags, entities and source names stay untranslated. Category display names (Crime → Crimen, etc.) come from a fixed UI label map, never the model. Slugs are not translated (Phase 4 D-07: slugs are frozen identity).
- D-03: Source language is detected at ingest and stored (I18N-02). It drives `lang="es"` on Spanish-origin source titles/links and the "Originally reported in Spanish" label (D-07). Detection method is up to Claude.
- D-04: The Phase 2 grounding check also runs on the Spanish summary, with the same review queue.
- D-05: English passes, Spanish fails → publish English, hold Spanish. The Spanish version goes to the review queue. Until it clears, the `/es` URL for that article serves the English content with a short "no disponible en español todavía" note (and correct `lang` attributes). Same fallback for any article whose Spanish version doesn't exist yet (e.g. mid-backfill).

**URLs & Spanish-origin articles (I18N-03, I18N-04, I18N-05, I18N-06)**
- D-06: Spanish URLs are `/es` + the identical English path: `/es/[category]/[slug]-[uuid]`, `/es/tag/[slug]`, `/es/source/[slug]`, `/es/about`, etc. Every public page type is mirrored. The switcher just adds or removes `/es`. Phase 4's 301-to-canonical logic applies under `/es` too. Reversibility: one-way.
- D-07: Spanish-origin articles (~1.5%) are handled like every other article: the same call produces both languages and both pages pair via hreflang. The English page shows "Originally reported in Spanish" next to the source link, and the source link carries `lang="es"`.
- D-08: Defaults accepted: `x-default` → English for every pair; `/es/rss.xml` plus a Spanish sitemap alongside the English ones (I18N-06). Whether `/es` also gets a Google News sitemap is up to Claude.

**Launch & backfill (I18N-10, success criterion 1)**
- D-09: `/es` is fully public as soon as the phase ships: linked, indexed and in the sitemap from day one. This overrides PROJECT.md's "`/es` launch decided on 2–4 weeks of measured data" rule, which must be updated at phase transition.
- D-10: Backfill the whole archive (~40,761 public articles) through the Batch API, after a dry run reporting row count and projected cost (budget estimate ~$1.49; re-measure, don't trust it) and explicit owner approval. The 60,000 static-file budget already assumes this (59,836 projected). Spanish pages for archived articles re-render per Phase 5 D-11, within REND-12's per-invocation CPU ceiling.
- D-11: I18N-10 is met through Umami, not Worker code. The owner's self-hosted Umami tag goes on both v1 (now, separate quick task in `915tldr.com2`) and v2: `<script defer src="https://stats.915websites.com/script.js" data-website-id="8e82b1af-925f-4a5a-b0d1-e02f616ae077"></script>`. Umami's browser-language report (`navigator.language`, effectively the first `Accept-Language` choice) is the language-share report. Research must confirm this instance actually exposes a Languages report before I18N-10 is marked met. If it doesn't, fall back to an aggregate-bucket counter (es-first / en-first / other) with no IPs, no full headers and no D1. Verified 2026-10-03: the tag was never installed in v1 code, v2 code, live `915tldr.com` or `dev.915tldr.com`. The script must not break Lighthouse 100 / LCP < 1.5s (keep `defer`); the Privacy page (EN + ES) must disclose it.

**Switcher & site chrome (I18N-08)**
- D-12: The language switcher appears in the site header on every page ("Español" / "English") and as a visible "Leer en español" / "Read in English" link near the top of each article. Plain links, no JavaScript.
- D-13: No automatic language selection anywhere. No IP lookup, no `Accept-Language` redirect, no cookie-based redirect (I18N-08). Success criterion 3 is verified by requesting pages with a Spanish `Accept-Language` and getting English.
- D-14: Persistence is links only, no cookie. Every internal link on an `/es` page stays inside `/es`.
- D-15: UI strings (nav, footer, buttons, labels, the AI disclosure) come from a small fixed EN/ES dictionary. The AI disclosure in Spanish carries the same meaning as the English one (I18N-09).
- D-16: About, Privacy, Terms and Contact under `/es` are drafted in Spanish by Claude and reviewed by a fluent human before shipping.
- D-17: `/es/changelog` has a Spanish header and intro, with entries left in English (`lang="en"` on them) and a one-line note that build notes are published in English.

### Claude's Discretion
- The source-language detection method (D-03).
- The exact `article_translations` columns beyond the required ones, its indexes, and migration mechanics in `915tldr.com2`.
- Spanish register and tone (neutral Latin American Spanish; avoid Spain-specific vocabulary) and the exact prompt change for same-call bilingual output.
- Whether `/es` gets its own Google News sitemap (D-08).
- Backfill ordering (newest first is the obvious default) and cycle pacing within REND-12.
- Exact wording of the fallback note, the "Originally reported in Spanish" label and the switcher labels.

### Deferred Ideas (OUT OF SCOPE)
- Contact page as a bigger focus, actively asking readers what they want (fits Phase 10 or its own phase).
- Deploy a real working product as soon as possible (roadmap ordering question, not this phase).
- Umami engagement setup (events/goals) — separate task.
- Umami tag on v1 now — quick task in `915tldr.com2`, outside this phase's repo.
- `tools/derive-hot-window.mjs` has no hostname filter — separate bug, not bilingual work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| I18N-01 | Each article carries an English and a Spanish summary, generated in the same model call | `server/utils/openai.ts`'s `processArticleWithAI`/`buildSummaryPrompt` is the one call to extend; see Architecture Patterns §1 and Code Examples §1 |
| I18N-02 | Source language is detected at ingest and stored | Recommend the same model call return `sourceLanguage`; `article_translations`/`articles` schema design in Architecture Patterns §2 |
| I18N-03 | Spanish-language articles render with `lang="es"` on the appropriate element | `src/layouts/Base.astro` currently hardcodes `<html lang="en">` — Common Pitfalls §4 |
| I18N-04 | `/es/...` routes exist for every public page type | Route-tree mirroring pattern, Architecture Patterns §3 |
| I18N-05 | Every page emits correct `hreflang` pairs including `x-default` | Code Examples §2; no Astro built-in does this automatically — must be hand-added to `Base.astro` |
| I18N-06 | Separate sitemaps and RSS feeds exist per language | `@astrojs/sitemap`'s `i18n` option (Context7-verified) plus a second `/es/rss.xml` route reusing `src/lib/seo-feeds.ts` — Architecture Patterns §4 |
| I18N-08 | Language is chosen by the reader, never by IP or browser auto-redirect | Confirms NOT to use Astro's default i18n middleware/`prefixDefaultLocale`/fallback redirect — Don't Hand-Roll §1 |
| I18N-09 | Spanish summaries carry the same AI-generation disclosure as English | Fixed EN/ES UI dictionary pattern, Architecture Patterns §5 |
| I18N-10 | `Accept-Language` is logged at the edge to inform the `/es` launch decision | Umami Languages report — Open Questions §1, Common Pitfalls §8 |
</phase_requirements>

## Summary

This phase is less "learn a new technology" and more "extend five already-built, already-hardened
subsystems to carry a second language without breaking the invariants each one was built to
guarantee." Every one of those subsystems was read directly from this repo for this research pass,
and three of them have a real, previously-invisible collision risk once a second language shares
the same article `uuid`:

1. **The render manifest is keyed by uuid alone** (`manifest:<uuid>`, one KV entry per article) —
   writing a Spanish entry for the same uuid will silently overwrite the English one at the same
   key unless the key scheme becomes language-aware.
2. **The R2 archive key is keyed by uuid alone** (`articles/<uuid>.html`) — the same collision, one
   layer down, in the archive-tier Worker.
3. **The Worker's redirect/canonical-path comparison never considers `/es`** — a request to
   `/es/<category>/<slug>-<uuid>` for an archived article today would 301 straight back to the
   English canonical path, because `resolveRedirect`'s canonical-path builder has no language
   dimension at all.

None of this is a new finding from outside the repo — all three are read directly out of
`src/lib/server/kv-manifest.ts`, `src/lib/archive/archive-route.ts` and
`src/lib/article-redirect.ts`, with line citations below. The fix in all three cases is the same
shape: make the key/comparison language-aware (e.g. `manifest:<uuid>:<language>`,
`articles/<uuid>/<language>.html`), not a new library or a different architecture.

On the content side, the single `articles` Content Layer collection (and the ~10 `getCollection
('articles')` call sites across `src/pages/`) assume one English row per uuid. The lowest-risk
design — directly following this project's own D-01 precedent of "the existing thing stays
untouched" — is a **second, Spanish-only collection** (`articles_es`, sourced from the new
`article_translations` table) joined at render time to the existing English collection by
`uuid`/`translationGroupId`, rather than doubling entries inside the one collection every existing
page, rail and sitemap already iterates over unconditionally.

For the OpenAI side: pricing is confirmed current and **unchanged** from the figures already
committed in `915tldr.com2/server/utils/cost-estimate.ts` (Batch: $0.10/1M input, $0.60/1M output;
standard: $0.20/1M input, $1.20/1M output) — re-verified directly against `developers.openai.com`
today. But those MEASURED_* constants were measured against the **summarisation** prompt, not a
**translation-only** backfill prompt — the ~$1.49 backfill estimate in CONTEXT.md cannot be
validated by reusing them, and a rough order-of-magnitude projection using conservative assumptions
(below) suggests the real figure could plausibly be several times higher. This must be re-measured
with a real 10-row sample against the actual backfill prompt, exactly as Phase 2's own CONT-09 dry
run did — not assumed from the stated figure, and not computed by this research pass either.

**Primary recommendation:** extend the existing single-call summarisation prompt to also return
`sourceLanguage`, `titleEs`, `summaryEs` and `keyPointsEs` in the same JSON response (I18N-01/02,
zero new dependencies); store Spanish output in a new `article_translations` table and a parallel
`articles_es` Astro content collection; make the render-manifest KV key and the R2 archive key
language-qualified before any Spanish archive-tier serving is attempted; and re-measure the Batch
backfill cost against the real translation-only prompt before spending anything.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bilingual summarisation (I18N-01/02) | Pipeline (Nuxt/Worker, `915tldr.com2`) | — | Same model call that already writes `articles`; `storeProcessingResults` is the only write path |
| Spanish storage (`article_translations`) | Database (D1) | Pipeline | Sibling table, D-01; pipeline is the only writer |
| Spanish grounding check (I18N-01/D-04) | Pipeline | — | Reuses `grounding-check.ts`'s existing two-stage cascade, called a second time |
| `/es` route tree + hreflang/lang attrs (I18N-03/04/05) | Frontend build (Astro, `915tldr.com`) | — | Build-time only, per this project's zero-D1-reads constraint |
| Sitemaps/RSS per language (I18N-06) | Frontend build | — | `@astrojs/sitemap` + a second RSS route, both build-time |
| Language switcher, no auto-redirect (I18N-08) | Browser (plain `<a>` links) | Frontend build | No middleware, no JS — D-13 forbids any redirect logic |
| Archived Spanish page serving | CDN/Worker (R2 + KV) | — | Must extend the existing uuid-only KV/R2 key schemes to carry `language` |
| Accept-Language measurement (I18N-10) | CDN/Analytics (Umami, external) | — | D-11: explicitly NOT Worker code — a static-asset response never invokes the Worker to log anything |
| Backfill batch job | Pipeline (OpenAI Batch API) | Database (D1) | Reuses `batch-jsonl.ts`/`cost-estimate.ts` patterns from Phase 2 |

## Standard Stack

### Core
No new runtime dependency is required. Every piece of this phase is built from packages and
patterns already pinned in this repo.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `astro` | 7.3.3 [VERIFIED: package.json:60] | Static site generator | Already the project's framework; no version change needed for this phase |
| `@astrojs/sitemap` | 3.7.4 [VERIFIED: package.json:58] | Per-language sitemap via its `i18n` option | Already installed; its `i18n: { defaultLocale, locales }` config emits `xhtml:link` alternates per URL — exactly the shape I18N-06 needs [CITED: Context7 /withastro/docs, integrations-guide/sitemap.mdx, queried 2026-10-03] |
| `@astrojs/rss` | 4.0.19 [VERIFIED: package.json:57] | RSS feed generation | Already used by `src/pages/rss.xml.ts`; a second `/es/rss.xml.ts` route reuses it unchanged |
| `openai` | `^6.15.0` [VERIFIED: 915tldr.com2/package.json] | Model client in the pipeline repo | Already pinned; no change — the bilingual output is a prompt/schema change, not a client change |
| `js-tiktoken` | 1.0.21 [VERIFIED: 915tldr.com2/package.json] | Token counting for the Batch cost dry run | Already used by `cost-estimate.ts`; reuse directly, do not re-implement |

### Supporting (optional)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `franc` | latest (verified OK on npm registry, see Package Legitimacy Audit) | Cheap deterministic language-ID as a second opinion on the model's self-reported `sourceLanguage` | Only if the planner wants the same "deterministic check first, LLM judge second" cascade this project already uses in `grounding-check.ts` — not required to ship I18N-02, since the model's own structured output can report `sourceLanguage` directly in the same call at zero extra dependency cost |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Model self-reports `sourceLanguage` in the same JSON call | A standalone JS language-detection library (`franc`, `cld`) run before/after the model call | The library adds a dependency and a second code path to maintain for a signal the model already has to produce faithfully anyway (it's translating the text — it has to know what language the source was in); only worth adding as a cheap sanity cross-check, not as the primary signal |
| Spanish-only `articles_es` collection, joined by uuid at render time | Doubling entries inside the single `articles` collection (composite id `<uuid>:<language>`) | Doubling inside one collection means every existing `getCollection('articles')` call site (rails, listings, RSS, both sitemaps — ~10 files) must add a language filter or silently double its output; a second collection leaves 100% of existing English code paths untouched, matching D-01's own stated rationale one layer up |
| Language-qualified KV/R2 keys (`manifest:<uuid>:<language>`, `articles/<uuid>/<language>.html`) | A single uuid-keyed manifest entry carrying both languages' data as sub-fields | A combined-entry schema bump (v3) is also viable, but it couples the hot/warm/cold loader write path for BOTH languages to one KV write succeeding — a single flagged Spanish translation (D-05: English publishes, Spanish holds) is cleaner to express as two independent keys than as partial-failure handling inside one JSON blob |

**Installation:** none — no new dependency is required for the recommended path. If the planner
chooses the `franc` cross-check: `npm install franc`.

**Version verification:** confirmed live via `npm view astro version` (7.3.5 latest; this repo pins
7.3.3, a few patches behind but not a blocker) and `npm view franc version` (6.2.0 latest) on
2026-10-03.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `franc` | npm | published 2024-01-11 (this major; project itself is much older — `wooorm/franc`, a long-maintained library) [VERIFIED: gsd-tools package-legitimacy check, 2026-10-03] | 429,000/week | github.com/wooorm/franc | OK | Approved (optional — see Alternatives Considered; not required for I18N-02) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

No other new package names are proposed by this research. `franc`'s name was sourced from
WebSearch results (not an authoritative doc), so despite the clean registry verdict above it is
still tagged `[ASSUMED]` per the package-name provenance rule — confirm the exact package
(`franc` vs `franc-min` vs `franc-all`) against its own README before installing, if the planner
chooses to use it at all.

## Architecture Patterns

### System Architecture Diagram

```
Ingest (915tldr.com2, 2-hour cron)
  RSS fetch -> content-extractor -> processArticleWithAI (ONE OpenAI call)
     |
     +--> [NEW] response also carries: sourceLanguage, titleEs, summaryEs, keyPointsEs
     |
     v
  checkGrounding(English) ---clean---> storeProcessingResults -> articles (unchanged)
  checkGrounding(Spanish) ---clean---> [NEW] article_translations (title/summary/keyPoints/groundingStatus)
                           ---flagged--> held, article_translations row withheld (D-05)

Build (915tldr.com, Workers Builds, every cron cycle)
  D1 REST (build-time only, src/lib/server/d1-client.ts)
     articles (unchanged query)              [NEW] article_translations (new query, chunked at 100 params)
       |                                           |
       v                                           v
  Content Layer: `articles` collection       [NEW] Content Layer: `articles_es` collection
  (English, EVERY existing page/rail/feed    (Spanish only: title/summary/keyPoints/groundingStatus,
   untouched)                                 keyed by translationGroupId)
       |                                           |
       +---------------------+----------------------+
                             v
                 src/pages/[category]/[slug].astro  (English, unchanged)
                 src/pages/es/[category]/[slug].astro  [NEW] (looks up articles_es by uuid;
                                                         falls back to English content + the
                                                         "no disponible" note per D-05 when the
                                                         Spanish entry is missing/held)
                             |
                             v
                 render-manifest KV write — [NEW] language-qualified key
                 R2 archive write (cold/archive tier) — [NEW] language-qualified key

Request (Cloudflare Worker, archive-tier miss only)
  extractArticleUuid(path) -> [NEW] also detect /es prefix -> language
  RENDER_MANIFEST.get(`manifest:<uuid>:<language>`)  [NEW key shape]
  ARCHIVE_BUCKET.get(`articles/<uuid>/<language>.html`)  [NEW key shape]

Edge (Cloudflare zone, every request, hot or archived, Worker-invoked or not)
  Umami <script defer> tag -> stats.915websites.com (logs Accept-Language-derived
  navigator.language client-side; NOT Worker code, NOT D1 — satisfies D-11)
```

### Recommended Project Structure
```
src/
├── content/loaders/
│   ├── articles-loader.ts         # unchanged — English collection
│   └── articles-es-loader.ts      # NEW — Spanish-only collection, sourced from article_translations
├── lib/
│   ├── server/
│   │   ├── d1-client.ts           # extend: fetchTranslationsWindow / fetchTranslationsByIds
│   │   └── kv-manifest.ts         # extend: manifestKey becomes language-aware (schema v3)
│   ├── archive/
│   │   └── archive-route.ts       # extend: articleArchiveKey/tagArchiveKey take a language param
│   ├── i18n/                      # NEW — fixed EN/ES UI dictionary (D-15), category label map (D-02)
│   └── article-redirect.ts        # extend: resolveRedirect/extractArticleUuid become language-aware
├── pages/
│   ├── [category]/[slug].astro    # unchanged (English)
│   ├── rss.xml.ts                 # unchanged (English)
│   ├── news-sitemap.xml.ts        # unchanged (English) — or parameterize `news:language`, see Pitfalls §5
│   └── es/                        # NEW mirror tree — one thin route file per existing page type,
│       ├── [category]/[slug].astro    #   each importing the SAME shared lib functions with language='es'
│       ├── [category]/index.astro
│       ├── tag/[slug].astro
│       ├── source/[slug].astro
│       ├── tags.astro
│       ├── changelog.astro        # D-17: Spanish header/intro, English entries
│       ├── about.astro / privacy.astro / terms.astro / contact.astro   # D-16: human-reviewed
│       ├── rss.xml.ts             # reuses src/lib/seo-feeds.ts, Spanish content
│       └── news-sitemap.xml.ts    # only if Claude's Discretion (D-08) opts in
└── worker.ts                      # extend: language-aware manifest/R2 key derivation
```

### Pattern 1: Same-call bilingual summarisation (I18N-01/02)
**What:** Extend `buildSummaryPrompt`'s JSON contract (`server/utils/openai.ts`) to request
`sourceLanguage`, `titleEs`, `summaryEs`, `keyPointsEs` alongside the existing English fields, in
the exact same `chat.completions.create` call.
**When to use:** Every new article at ingest (live path, `ai-processor.ts`'s `processPendingArticles`).
**Example — current call shape to extend (read directly, not paraphrased):**
```typescript
// Source: 915tldr.com2/server/utils/openai.ts:222-245 (verbatim fields relevant to this extension)
const response = await client.chat.completions.create({
  model: 'gpt-5.6-luna',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  max_completion_tokens: 4000,
  response_format: { type: 'json_object' },
})
```
See Common Pitfalls §6 — `max_completion_tokens: 4000` was already raised once because
gpt-5.6-luna's reasoning-token overhead starved visible output on long articles; doubling the
expected visible-output length (English + Spanish in one response) without re-measuring this
budget risks the same empty-response failure mode this constant was raised to fix.

### Pattern 2: Spanish-only content collection, joined by uuid (I18N-03/04)
**What:** A second Astro Content Layer collection (`articles_es`), loaded from
`article_translations`, keyed by `translationGroupId` (the English article's own uuid — already
the exact identity field `src/lib/server/kv-manifest.ts` defines for this purpose).
**When to use:** Every `/es` page template. The template reads the English entry (identity: uuid,
slug, category, tags, source, publishedAt — none of which D-02 translates) from the existing
`articles` collection, and the Spanish entry (title/summary/keyPoints) from `articles_es`,
falling back to the English entry's own fields when no Spanish entry exists or it's held (D-05).
**Why not one collection:** every current `getCollection('articles')` caller assumes one row per
uuid — see the full list in Common Pitfalls §3.
**Example — the existing identity field this pattern reuses, read verbatim:**
```typescript
// Source: src/lib/server/kv-manifest.ts:62-85 (ManifestEntry interface, verbatim)
export interface ManifestEntry {
  articleId: string;
  /** Equal to the article's own `articleId` for every entry written today (English-only corpus).
   * Phase 6's Spanish entries will carry the SAME `translationGroupId` as their English
   * counterpart — pairing is "same translationGroupId", never "follow a pointer to a specific
   * record". Never null... */
  translationGroupId: string;
  /** Always `'en'` today — no Spanish content is ingested yet. Phase 6 writes `'es'` entries
   * carrying the same `translationGroupId`. */
  language: 'en' | 'es';
  // ...contentHash, schemaVersion, renderedAt, buildHash, category, publishedAt, slug
}
```
This confirms the pairing identity (`translationGroupId` + `language`) was already designed for
exactly this phase back in Phase 3 — the gap is that the KV *key* built from it (next pattern)
was not.

### Pattern 3: Language-qualified manifest/archive keys (CRITICAL — fixes a real collision)
**What goes wrong today:** `kv-manifest.ts`'s own key function and the Worker's archive-key
function are BOTH keyed on `articleId` alone, with no `language` dimension at all:
```typescript
// Source: src/lib/server/kv-manifest.ts:165-167 (verbatim)
function manifestKey(articleId: string): string {
  return `manifest:${articleId}`;
}
```
```typescript
// Source: src/lib/archive/archive-route.ts:28-33 (verbatim)
export function articleArchiveKey(articleId: string): string {
  const lower = typeof articleId === 'string' ? articleId.toLowerCase() : articleId;
  if (typeof lower !== 'string' || !UUID_RE.test(lower)) {
    throw new Error(`archive-route: invalid articleId: ${JSON.stringify(articleId)}`);
  }
  return `${ARCHIVE_ARTICLE_PREFIX}${lower}.html`;
}
```
Writing a Spanish `ManifestEntry` for the same uuid calls `putManifestEntry`, which PUTs to
`manifest:<uuid>` — the exact same key the English entry already occupies
(`kv-manifest.ts:275-298`, `putManifestEntry`'s own doc comment: "Writes one manifest entry, keyed
`manifest:<articleId>`"). The second write silently overwrites the first. The same collision
exists for the R2 archive object key.

Separately, the Worker's canonical-path check has no `/es` awareness at all:
```typescript
// Source: src/lib/article-redirect.ts:100-113 (verbatim)
let canonical: string;
try {
  canonical = articlePath(candidate.category, candidate.slug, candidate.articleId);
} catch { return { type: 'not-found' }; }

if (pathname === canonical) {
  return { type: 'canonical', articleId: candidate.articleId.toLowerCase() };
}
return { type: 'redirect', location: canonical };
```
`articlePath` (`src/lib/article-url.ts:46-51`) never emits an `/es` prefix. A request to
`/es/<category>/<slug>-<uuid>` for an article that's fallen into the archive tier would extract
the uuid fine (`extractArticleUuid` matches on the trailing uuid regardless of prefix — confirmed:
`TRAILING_UUID_RE` in `article-redirect.ts:20-21` anchors on the END of the path only), fetch the
ENGLISH manifest entry (there is no other one today), build the English canonical path, find
`pathname !== canonical`, and **301-redirect the Spanish request straight to the English page** —
silently defeating D-13 ("no automatic language selection") from the wrong direction (not an
auto-redirect TO Spanish, but an involuntary redirect AWAY from it).
**Fix shape (not yet built — for the planner):** extend the manifest key to
`manifest:<uuid>:<language>`, the R2 key to `articles/<uuid>/<language>.html` (or an equivalent
`es/articles/<uuid>.html` prefix split), and extend `extractArticleUuid`/`resolveRedirect` to also
detect and carry an `/es` prefix through the canonical-path comparison. This only matters once an
article crosses into the archive tier (REND-07/08) — a *hot*, statically-built `/es` page is a
plain file on disk and never touches this code path at all. But D-10 explicitly backfills
~40,761 archived-tier articles, so this is not a corner case Phase 6 can defer.

### Pattern 4: hreflang + per-language sitemap (I18N-05/06)
**What:** Astro has no automatic `<link rel="alternate" hreflang>` generation — it must be
hand-added to `src/layouts/Base.astro`'s `<head>`, once per page, pointing at the paired URL (or
omitted/self-only if no Spanish counterpart exists yet). `@astrojs/sitemap`'s `i18n` config DOES
automate the sitemap-level alternates:
```javascript
// Source: Context7 /withastro/docs, integrations-guide/sitemap.mdx (verbatim)
sitemap({
  i18n: {
    defaultLocale: 'en', // All urls that don't contain `es` or `fr` after the origin are `en`
    locales: {
      en: 'en-US', // defaultLocale's value MUST be present in `locales` keys
      es: 'es-ES',
    },
  },
})
```
This can likely coexist with the project's existing `sitemap({ filter: ... })` call
(`astro.config.mjs:72-81`) by passing both `filter` and `i18n` in the same config object — not
independently confirmed in this research pass against this exact combination; verify during
execution with a real build and inspect the emitted `sitemap-0.xml`.
**x-default:** `@astrojs/sitemap`'s `i18n` option does not appear (from the docs fetched) to emit
an `x-default` entry automatically — that must be added by hand in `Base.astro`'s own
`<link rel="alternate" hreflang="x-default">` tag, pointed at the English URL per D-08.

### Pattern 5: Fixed EN/ES UI dictionary (I18N-09, D-15)
**What:** A small, flat key→{en,es} map (nav labels, footer links, the AI-disclosure sentence, the
"Leer en español"/"Read in English" switcher copy, the fallback note) — not a full i18n
library (`i18next`, `astro-i18next`, etc.). This project's whole UI surface is ~15-20 fixed
strings per D-15's own framing; a general-purpose i18n framework is unjustified weight for a
fixed, short string set that a plain TypeScript object already serves, and avoids pulling in
a library with its own routing/middleware opinions that could reintroduce the auto-redirect
behavior D-13 forbids.

### Anti-Patterns to Avoid
- **Using Astro's built-in `i18n` config/middleware** (`astro:i18n`, `routing: "manual"` or
  otherwise): it exists to solve exactly the auto-redirect/fallback-locale problem D-13 explicitly
  forbids. Even `routing: "manual"` ships helper functions (`redirectToDefaultLocale`,
  `redirectToFallback`) whose entire purpose is the behavior this phase must NOT have. A plain,
  hand-written `/es` route tree with no Astro i18n config at all is simpler and strictly safer
  here. [CITED: Context7 /withastro/docs, guides/internationalization.mdx, queried 2026-10-03]
- **Reusing the single `articles` collection for both languages** — see Alternatives Considered.
- **Hardcoding `news:language` to `'en'`** in the news sitemap for Spanish-origin entries — see
  Common Pitfalls §5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| hreflang-aware sitemap alternates | A hand-written second sitemap generator for `/es` | `@astrojs/sitemap`'s `i18n` config (already installed) | Already does the `xhtml:link` alternate-generation this phase needs; hand-rolling it duplicates a solved problem |
| Batch JSONL request/response handling for the backfill | A new batch-file builder/parser | `915tldr.com2/server/utils/batch-jsonl.ts` (`buildBatchRequests`, `parseBatchOutput`, `expiredCustomIds`) | Already handles custom_id collision checks, the 24h-expiry resubmission split (CONT-11) and malformed-line tolerance — the Spanish backfill is a new prompt shape through the exact same plumbing |
| Batch/standard cost projection | A new cost calculator | `915tldr.com2/server/utils/cost-estimate.ts` (`projectBatchCost`, `TokenTally`, `ceilCents`/`roundCentsHalfUp`) | Already encodes the OPS-11 rounding contract (ceiling for the $1 threshold, half-up for display) — reuse directly, only add NEW measured constants for the translation-only prompt shape (the existing `MEASURED_MEAN_SUMMARY_OUTPUT_TOKENS` etc. were measured against a different prompt and do not transfer) |
| Language-ID sanity check | A hand-rolled heuristic (character-set sniffing, stopword lists) | `franc` (if wanted at all — see Alternatives Considered) | A maintained, 429k-weekly-download library already does n-gram language ID across 400+ languages; a hand-rolled heuristic is the kind of custom solution this section exists to warn against, and it isn't even needed as the PRIMARY signal (the model's own self-report is) |

**Key insight:** every piece of machinery this phase actually needs (batch cost projection, batch
file I/O, sitemap alternates, grounding verification) already exists in this codebase or its
pinned dependencies. The real work is schema/key extension (`article_translations`, manifest/R2
key shape) and route-tree mirroring — not new tooling.

## Runtime State Inventory

> Phase 6 is additive (a new table, a new collection, a new route tree), not a rename/refactor —
> most categories below are "none." Included for completeness because this phase does touch
> cross-repo state (the pipeline repo, a live analytics account, and PROJECT.md's own text).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None found requiring migration — `article_translations` is a NEW table; no existing D1 rows need rewriting. The ~40,761-row backfill (D-10) is a bulk INSERT, not a migration of existing rows. | Code (new table + writer) |
| Live service config | Umami dashboard at `stats.915websites.com`, website id `8e82b1af-925f-4a5a-b0d1-e02f616ae077` — config lives in Umami's own hosted UI, not in this repo's git history. Confirmed 2026-10-03 (CONTEXT.md D-11): the tracking script is not installed anywhere yet, so there is no existing Umami config to disturb — this phase is the FIRST write. | Install the `<script>` tag (this repo + a separate v1 quick task); verify the Languages report appears once traffic flows (see Open Questions §1) |
| OS-registered state | None — no Task Scheduler/pm2/systemd/launchd state touches this phase. | None |
| Secrets/env vars | None new — no new API key or secret is introduced. The existing `OPENAI_API_KEY`/`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` env vars cover every new call this phase adds. | None |
| Build artifacts | `src/content.config.ts`'s `collections` export changes shape (adds `articles_es`) — any cached `node_modules/.astro` content-layer store from a pre-Phase-6 build will not have this collection; a cold Content Layer sync (already the loader's own self-healing "cold" mode, `LOADER_STATE_VERSION` bump) handles this automatically once the collection is registered — no manual cache-clear needed, matching Phase 3/4's own precedent. | None beyond the code change itself |

**Also flag (not in the five categories above, but real pre-existing text that this phase's own
locked decision requires changing):** PROJECT.md's "`/es` launch decided on 2–4 weeks of measured
data" line is superseded by D-09 and "must be updated at phase transition" per CONTEXT.md's own
wording — this is a documentation update task, not a runtime-state one, but it is a required
non-code deliverable of this phase.

## Common Pitfalls

### Pitfall 1: KV manifest key collision between languages
**What goes wrong:** A Spanish `ManifestEntry` write for uuid `X` overwrites the English entry
already stored at `manifest:X`.
**Why it happens:** `manifestKey()` (`src/lib/server/kv-manifest.ts:165-167`) is keyed on
`articleId` alone; `language` is a field INSIDE the stored JSON value, not part of the KV key.
**How to avoid:** Bump the key scheme to include `language` (e.g. `manifest:<uuid>:<language>`)
before any Spanish manifest entry is ever written. This is schema v3 territory (`kv-manifest.ts`'s
own `MANIFEST_SCHEMA_VERSION` constant already exists for exactly this kind of bump).
**Warning signs:** An archived-tier Spanish article 301-redirecting to English, or a build log
showing manifest writes succeeding with no error while `/es` pages silently serve stale/wrong
content once they fall out of the hot window.

### Pitfall 2: R2 archive key collision between languages
**What goes wrong:** Same shape as Pitfall 1, one layer down — `articleArchiveKey()`
(`src/lib/archive/archive-route.ts:28-33`) builds `articles/<uuid>.html` with no language segment.
**How to avoid:** Extend to `articles/<uuid>/<language>.html` (or an `es/` key prefix split) and
update the corresponding `assertArchiveKey` validation and `tools/archive-sync.mjs`'s upload logic
in lockstep — a mismatched key shape between the Worker's read path and the sync tool's write path
reintroduces exactly the class of bug 05-07/05-14's own code-review findings (CR-01/CR-02) already
fixed once for the English-only archive.
**Warning signs:** `[worker] archived article missing from R2` log lines (the existing
sync-bug-signal log in `src/worker.ts`) appearing for `/es` requests specifically.

### Pitfall 3: Doubling the single `articles` collection breaks every existing listing/rail/feed
**What goes wrong:** If Spanish entries are added into the SAME `articles` collection (even with a
composite id), every one of these existing call sites silently doubles its output or needs a
retrofitted language filter: `src/pages/index.astro`, `src/pages/[category]/index.astro`,
`src/pages/[category]/[slug].astro` (both the page itself and `computeRails`'s neighbour
selection), `src/pages/tag/[slug].astro`, `src/pages/source/[slug].astro`, `src/pages/tags.astro`,
`src/pages/rss.xml.ts`, `src/pages/news-sitemap.xml.ts`.
**Why it happens:** none of these files currently filter by language because there has only ever
been one language.
**How to avoid:** Use a separate `articles_es` collection (Pattern 2) so these files need zero
changes for the English path; only the NEW `/es` mirror route files need to know about the second
collection at all.
**Warning signs:** The homepage feed or a category rail showing an article twice (once per
language) after a careless schema change.

### Pitfall 4: `Base.astro` hardcodes `<html lang="en">`
**What goes wrong:** I18N-03 ("Spanish-language articles render with `lang="es"` on the appropriate
element") is currently impossible to satisfy for the document root, because:
```astro
<!-- Source: src/layouts/Base.astro:82 (verbatim) -->
<html lang="en">
```
**How to avoid:** Add a `lang` prop to `Base.astro`'s `Props` interface (alongside the existing
`page`, `title`, `canonicalPath`, etc.), defaulting to `'en'`, and pass `lang="es"` from every
`/es` page. This is a small, mechanical change but easy to miss since every other Phase 6 change
is additive (new files) while this one is a required EDIT to an already-shipped, heavily-depended-on
shared layout.
**Warning signs:** Lighthouse/axe flagging a lang-mismatch on any `/es` page; a screen reader
announcing Spanish content with English pronunciation rules.

### Pitfall 5: The Google News sitemap hardcodes `<news:language>en</news:language>`
**What goes wrong:**
```typescript
// Source: src/lib/seo-feeds.ts:76-80 (verbatim, inside newsSitemapXml)
<news:publication>
  <news:name>${NEWS_PUBLICATION_NAME}</news:name>
  <news:language>en</news:language>
</news:publication>
```
This is a STATIC string, not derived from the article's own language — a byte-for-byte copy used
for every entry regardless of which language it describes.
**Why it happens:** written in Phase 4, when only English existed.
**How to avoid:** Parameterize `news:language` by the sitemap's own language (or by each article's
language, if a combined sitemap is ever considered) BEFORE wiring up any `/es/news-sitemap.xml` —
this is Claude's Discretion whether to build at all (D-08), but if built, this hardcode must not
survive unchanged.
**Warning signs:** Google Search Console flagging a language mismatch on Spanish News-indexed URLs.

### Pitfall 6: `max_completion_tokens: 4000` was already a measured-tight budget for ONE language
**What goes wrong:** `openai.ts`'s own comments record that this model is reasoning-heavy and
previously returned an EMPTY response at a 1,500-token budget against a full-length English-only
article — the budget was raised to 4,000 specifically to fix that. Asking the same call to also
produce a full Spanish title/summary/keyPoints roughly doubles the expected VISIBLE output length
without any corresponding change to the completion-token ceiling.
**How to avoid:** Re-measure against a real sample of bilingual-prompt calls before shipping to
live ingest — do not assume 4,000 remains sufficient; budget for a higher ceiling (e.g. 7,000-8,000)
and confirm empirically, mirroring how 1,500→4,000 was itself an empirical fix, not a guess.
**Warning signs:** `No response from OpenAI` throws (the existing guard in `processArticleWithAI`)
spiking specifically after the bilingual prompt change ships.

### Pitfall 7: Phase 5 already flagged that Phase 6's file-count and cold-build-time budgets are tight
**What goes wrong:** this is not a new finding — it's a PRE-EXISTING flag from Phase 5's own
closing work that Phase 6 must re-measure, not assume is fine:
- The 202-day hot window's own cap arithmetic projects **59,836 static files at 2x today's
  corpus — only 164 files of headroom under the 60,000-file budget**
  [VERIFIED: docs/phase-05/hot-window-derivation.md:171-191, quoted in full in that doc's "Cap
  arithmetic" table].
- `tools/assert-file-count.mjs` fails the build at 80,000 files and warns at 70,000
  [VERIFIED: tools/assert-file-count.mjs:30-32, `FILE_COUNT_FAIL_THRESHOLD = 80_000`,
  `FILE_COUNT_WARN_THRESHOLD = 70_000`, `STATIC_ASSET_CEILING = 100_000`] — the projected 59,836
  total stays under even the WARN line today, but leaves near-zero margin for organic corpus
  growth once Spanish pages double the count.
- STATE.md's own Phase 5 closing note: *"05-10's linear-scaling projection (archived pages ~2x,
  cold render scaled by the same ratio) shows render time ALONE (~1,298s) may already exceed the
  20-minute Workers Builds hard ceiling once the corpus roughly doubles... flagged for Phase 6 to
  re-measure a real cold build against its actual corpus size before relying on the current
  2-hourly chained-build convergence mechanism."*
**How to avoid:** Treat both numbers (file-count headroom and cold-render wall-clock) as an
UNVERIFIED PROJECTION, not a given — schedule a real measured cold build against the actual
post-Phase-6 corpus size early in execution, before building out the full backfill pipeline on top
of an assumption that might not hold.
**Warning signs:** `assert-file-count.mjs` WARN/FAIL lines in a Workers Builds log; a forced
full-corpus rebuild exceeding Workers Builds' 20-minute ceiling.

### Pitfall 8: Umami's Languages report has not been directly confirmed live on this instance
**What goes wrong:** CONTEXT.md D-11 itself requires this to be confirmed before I18N-10 is marked
met. This research pass confirmed from Umami's own documentation (mirrored, since
`docs.umami.is/docs/reports` 404'd directly) that a browser-language breakdown is a standard
dashboard feature, not a Pro-only add-on [CITED: mintlify.wiki/umami-software/umami/features/dashboards,
cross-checked against umami.is/blog/understanding-the-insights-report and
docs.umami.is/docs/api/website-stats, queried 2026-10-03] — but this is a DOCUMENTATION claim about
the product, not a live screenshot of `stats.915websites.com`'s own dashboard, which the tag has
never been installed on (confirmed 2026-10-03, per CONTEXT.md).
**How to avoid:** After installing the tag (this phase, plus the separate v1 quick task) and
letting real traffic accumulate, take a live look at the dashboard's Languages/breakdown panel
before marking I18N-10 complete — exactly as D-11 itself instructs. If it's absent on this
specific self-hosted version/plan, fall back to D-11's own documented Plan B (an aggregate
es-first/en-first/other bucket counter, no IPs, no D1).
**Warning signs:** none visible from outside — this can only be confirmed by logging into the
actual dashboard once traffic flows.

## Code Examples

### Current (English-only) manifest key — the exact function Pattern 3 extends
```typescript
// Source: src/lib/server/kv-manifest.ts:165-167
function manifestKey(articleId: string): string {
  return `manifest:${articleId}`;
}
```

### Current (English-only) archive key — the exact function Pattern 3 extends
```typescript
// Source: src/lib/archive/archive-route.ts:28-33
export function articleArchiveKey(articleId: string): string {
  const lower = typeof articleId === 'string' ? articleId.toLowerCase() : articleId;
  if (typeof lower !== 'string' || !UUID_RE.test(lower)) {
    throw new Error(`archive-route: invalid articleId: ${JSON.stringify(articleId)}`);
  }
  return `${ARCHIVE_ARTICLE_PREFIX}${lower}.html`;
}
```

### @astrojs/sitemap i18n config (CITED, Context7)
```javascript
// Source: Context7 /withastro/docs, integrations-guide/sitemap.mdx, queried 2026-10-03
sitemap({
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: 'en-US',
      es: 'es-ES',
    },
  },
});
```

### D1 100-param chunking — must extend to any new `article_translations` query
```typescript
// Source: src/lib/server/d1-client.ts:120-133 (verbatim — the ceiling and its chunker)
export const D1_MAX_BOUND_PARAMS = 100;
export function chunkIds<T>(ids: T[], size: number = D1_MAX_BOUND_PARAMS): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
```
Reuse this directly for any new `article_translations` `IN (...)` lookup — do not write a second
chunker.

### Batch pricing constants — reuse, re-verified current
```typescript
// Source: 915tldr.com2/server/utils/cost-estimate.ts:51-57 (verbatim)
export const STANDARD_INPUT_RATE_PER_MILLION_USD = 0.2
export const STANDARD_OUTPUT_RATE_PER_MILLION_USD = 1.2
export const BATCH_INPUT_RATE_PER_MILLION_USD = 0.1
export const BATCH_OUTPUT_RATE_PER_MILLION_USD = 0.6
```
Re-verified directly against `developers.openai.com/api/docs/pricing` on 2026-10-03: these four
numbers are UNCHANGED from the 2026-09-19 figure these constants were originally sourced from.
[CITED: developers.openai.com/api/docs/pricing, fetched directly 2026-10-03; cross-checked against
independent WebSearch aggregator results returning identical figures]. The short/long-context
threshold is 272,000 input tokens [CITED: same source] — this project's articles (capped at 11,000
chars, well under that) will never cross into long-context pricing, bilingual or not.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ~$1.49 Spanish-backfill cost estimate in CONTEXT.md/PROJECT.md cannot be validated by reusing `cost-estimate.ts`'s existing `MEASURED_*` constants, because those were measured against the summarisation prompt, not a translation-only prompt; a rough projection using conservative assumptions (≈700 input + ≈500 output tokens/article × 40,761 articles at Batch rates) lands closer to $15 than $1.49 | Summary, Pitfall 7-adjacent | If the real cost is materially higher than $1.49, OPS-11's >$1-requires-approval gate still applies (D-10 already requires a dry run + explicit approval) — the risk is a surprised owner at approval time, not an un-gated spend, but the planner should budget real measurement time for this, not trust either figure |
| A2 | `@astrojs/sitemap`'s `filter` and `i18n` options can be passed together in one `sitemap({...})` call with no conflict | Pattern 4 | If they conflict, the Google-News/version/rss.xml exclusion filter (SEO-04, already shipped) could regress, or the i18n alternates could silently not apply — verify with a real build early |
| A3 | A second Astro Content Layer collection (`articles_es`) is the lowest-risk design vs. doubling the existing `articles` collection | Architecture Patterns §2, Alternatives Considered | If wrong, the planner builds the wrong join shape and has to retrofit every existing `getCollection('articles')` call site anyway, on top of the new work |
| A4 | The model's own structured-output self-report of `sourceLanguage` is sufficient for I18N-02 without a separate deterministic library | Pattern 1, Don't Hand-Roll | If the model's self-report proves unreliable in practice (e.g. for short/ambiguous source text), a `franc`-based cross-check (already legitimacy-cleared above) is a low-cost fallback to add |
| A5 | Umami's Languages/browser-language breakdown is present on this specific self-hosted instance and plan tier | Pitfall 8, Open Questions §1 | If absent, D-11's own documented fallback (aggregate bucket counter) is needed instead — CONTEXT.md already anticipates this, so the risk is scoped, not open-ended |

## Open Questions

1. **Does `stats.915websites.com`'s actual Umami dashboard expose a Languages report?**
   - What we know: Umami's own documentation (mirrored sources, since the canonical docs page
     404'd on direct fetch) describes browser-language breakdown as a standard dashboard feature.
   - What's unclear: whether THIS specific self-hosted instance/version actually shows it — it has
     never had any traffic with the tag installed.
   - Recommendation: install the tag (this phase + the v1 quick task), let traffic accumulate, then
     check the live dashboard before marking I18N-10 complete, exactly as D-11 instructs. Do not
     treat this research's documentation-only confirmation as sufficient on its own.

2. **What should the rail/neighbour cards on an `/es` article page show when a neighbour article
   has no Spanish translation yet (mid-backfill)?**
   - What we know: D-05 defines the fallback behavior for the ARTICLE being viewed (serve English
     + a note). It does not explicitly cover the "More in `<Category>`" rail's neighbour CARDS,
     which currently render via `ArticleCard` with English title/category name
     (`src/pages/[category]/[slug].astro:164-175`).
   - What's unclear: whether a Spanish article page's rail should show English-titled cards for
     not-yet-translated neighbours, or omit them, or flag them.
   - Recommendation: flag for `/gsd-discuss-phase` follow-up or planner judgment call — likely
     "show English title, same as the article-level D-05 fallback" for consistency, but this
     wasn't explicitly locked in CONTEXT.md.

3. **Exact KV/R2 key shape for the language-qualified manifest/archive schema (Pattern 3).**
   - What we know: the collision is real and must be fixed before any Spanish archive-tier serving.
   - What's unclear: the exact string shape (`manifest:<uuid>:<language>` vs. a nested JSON value
     vs. something else) — this is a genuine design decision, not something this research should
     lock in unilaterally given how much downstream code (`archive-sync.mjs`, `assertArchiveKey`,
     the Worker's read path) depends on getting it right once.
   - Recommendation: planner should treat this as a dedicated task with its own design note,
     mirroring how 05-03-PLAN.md documented its own R2-key-scheme decision in
     `docs/phase-05/archive-architecture.md`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| OpenAI API (gpt-5.6-luna) | I18N-01/02, Batch backfill | ✓ (already in production use) | — | — |
| Cloudflare D1 | `article_translations` table | ✓ (same database, additive) | — | — |
| Cloudflare KV (`915tldr-render-manifest`) | Language-qualified manifest keys | ✓ (existing namespace, schema bump only) | — | — |
| Cloudflare R2 (`915tldr-archive`) | Language-qualified archive keys | ✓ (existing bucket, key-shape change only) | — | — |
| Umami (self-hosted, `stats.915websites.com`) | I18N-10 | ✓ (account exists; tag not yet installed anywhere — see Runtime State Inventory) | — | Aggregate-bucket counter (D-11's own documented Plan B) if the Languages report is absent |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Umami Languages report (fallback already specified in
CONTEXT.md D-11).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (no Jest/Vitest/etc. in this repo for the frontend) [VERIFIED: package.json scripts, read directly] |
| Config file | none — plain glob invocation |
| Quick run command | `pnpm run test:fast` (`node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"` — no build step) |
| Full suite command | `pnpm run test:unit` (runs `pnpm run build` first, then the same unit globs) plus `pnpm run test:regression` and `pnpm run test:tracer` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| I18N-01 | Bilingual output present in the same model call's response | unit (pipeline repo) | `node --test server/utils/openai.test.ts` (pattern) | ❌ Wave 0 — extend existing openai/grounding tests in `915tldr.com2` |
| I18N-02 | `sourceLanguage` stored and retrievable | unit | new test against `article_translations`/schema | ❌ Wave 0 |
| I18N-03 | `lang="es"` on the correct element | unit + integration | extend `tests/integration/url-shapes.test.mjs`-style live check | ❌ Wave 0 |
| I18N-04 | `/es/...` exists for every page type | integration | extend `tests/integration/url-shapes.test.mjs` (71 existing checks — add an `/es` parallel set) | ✅ file exists, needs extension |
| I18N-05 | hreflang + x-default pairs | unit | new test against `Base.astro`'s rendered `<head>` | ❌ Wave 0 |
| I18N-06 | Per-language sitemap + RSS | unit | extend `tests/unit/news-sitemap.test.mjs` (file exists for English; needs an `/es` variant) | ✅ file exists, needs extension |
| I18N-08 | No auto-redirect on Spanish `Accept-Language` | integration | extend `tests/integration/url-shapes.test.mjs` or `tools/verify-edge-headers.mjs`'s live check | ✅ file exists, needs extension |
| I18N-09 | AI disclosure present in Spanish | unit | extend `tests/unit/article-markup.test.mjs` | ✅ file exists, needs extension |
| I18N-10 | Accept-Language informs the launch decision (Umami) | manual-only | live dashboard check (Open Questions §1) — not automatable from this repo | — manual, justified: the signal lives in a third-party hosted product's UI |

### Sampling Rate
- **Per task commit:** `pnpm run test:fast`
- **Per wave merge:** `pnpm run test:unit && pnpm run test:regression`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual Umami dashboard check
  for I18N-10 and a live `/es` page browser check (this project's own CLAUDE.md verification
  standard: "the code is present in the built output" is not verification for anything
  interactive/visual — drive a real page).

### Wave 0 Gaps
- [ ] A test proving the manifest/R2 key collision (Pattern 3/Pitfall 1-2) is fixed — e.g. write
  both an English and Spanish `ManifestEntry` for the same uuid and assert both are independently
  readable back.
- [ ] A test proving `/es` archive-tier requests do NOT redirect to English (the Pitfall 3 failure
  mode) once the key scheme is fixed.
- [ ] `article_translations` schema test (shape, grounding-status values, D-05 fallback behavior).
- [ ] hreflang/x-default rendering test against `Base.astro`.
- [ ] Framework install: none — `node --test` is already wired.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface in this phase |
| V3 Session Management | no | No new session surface |
| V4 Access Control | no | `/es` content is public by design (D-09) |
| V5 Input Validation | yes | Extend `article-url.ts`'s existing regex-validation discipline (`UUID_RE`, `ARTICLE_SLUG_RE`, `CATEGORY_SLUG_RE`) to any new language-qualified key/path construction — never derive a manifest/R2 key from raw request-path text, matching the existing `articleArchiveKey`/`tagArchiveKey` convention of throwing on anything that doesn't match a strict regex |
| V6 Cryptography | no | No new cryptographic surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via AI-generated Spanish text injected into JSON-LD or HTML | Tampering | Reuse `src/lib/structured-data.ts`'s existing `toSafeJsonLd` escaping for any NEW Spanish JSON-LD nodes (`inLanguage: 'es'` variants) — do not hand-roll a second escaper |
| Open redirect via a crafted `/es`-prefixed path | Tampering | `resolveRedirect`'s existing discipline (build the redirect target ONLY from validated manifest fields via `articlePath`, never from request-path text) must be preserved when extending it to be language-aware — do not let the `/es` prefix itself flow unvalidated into a constructed redirect `Location` |
| Manifest/R2 key injection via a malformed `language` value | Tampering | Validate `language` against a closed enum (`'en' | 'es'`) at every key-construction point, exactly as `validateManifestEntry` already does for the existing `language` field (`kv-manifest.ts:196-200`) — extend, don't bypass, that existing check |
| Over-broad PII collection disguised as "just Accept-Language logging" | Information Disclosure | D-11 already constrains this: no IPs, no full headers, no D1, no Worker-side logging at all — the Umami client-side script is the only approved mechanism; do not add a Worker-side `Accept-Language` logger as a "belt and suspenders" measure, since that would directly contradict D-11/D-13's own privacy-by-construction framing |

## Sources

### Primary (HIGH confidence)
- This repository, read directly: `src/lib/server/kv-manifest.ts`, `src/lib/archive/archive-route.ts`,
  `src/lib/article-redirect.ts`, `src/lib/article-url.ts`, `src/lib/server/d1-client.ts`,
  `src/content/loaders/articles-loader.ts`, `src/content.config.ts`, `src/layouts/Base.astro`,
  `src/lib/seo-feeds.ts`, `src/lib/structured-data.ts`, `src/pages/rss.xml.ts`,
  `src/pages/news-sitemap.xml.ts`, `src/pages/index.astro`, `src/pages/[category]/[slug].astro`,
  `src/worker.ts`, `astro.config.mjs`, `package.json`, `tools/assert-file-count.mjs`,
  `docs/phase-05/hot-window-derivation.md`, `docs/phase-05/archive-architecture.md`, `.planning/STATE.md`
- The pipeline repo (`../915tldr.com2`), read directly, read-only: `server/db/schema.ts`,
  `server/utils/openai.ts`, `server/utils/grounding-check.ts`, `server/utils/ai-processor.ts`,
  `server/utils/batch-jsonl.ts`, `server/utils/cost-estimate.ts`, `package.json`
- `developers.openai.com/api/docs/pricing` — fetched directly 2026-10-03, gpt-5.6-luna standard and
  Batch pricing, short/long-context threshold (272,000 tokens)
- npm registry (`npm view astro version`, `npm view franc version`), live 2026-10-03

### Secondary (MEDIUM confidence)
- Context7 `/withastro/docs` — Astro i18n manual routing, `@astrojs/sitemap` i18n config, queried
  2026-10-03

### Tertiary (LOW confidence)
- WebSearch-only, not independently re-verified against a single authoritative doc page: `franc`
  vs `cld` vs `langdetect` comparison claims; the exact Umami dashboard confirmation (mirrored docs
  only — `docs.umami.is/docs/reports` itself 404'd on direct fetch, so this rests on a third-party
  documentation mirror plus the vendor's own blog, not the canonical docs page)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency required; every version cited was read from this repo's
  own `package.json` or confirmed live against the npm registry.
- Architecture: HIGH for the collision findings (read directly from source with line citations);
  MEDIUM for the recommended fix shapes (sound reasoning from the existing code, but not yet built
  or tested).
- Pitfalls: HIGH for Pitfalls 1-6 (all read directly from source); MEDIUM for Pitfall 7 (carried
  forward from Phase 5's own flagged, unresolved projection — not re-measured in this pass); LOW
  for Pitfall 8 (Umami's actual behavior on this instance is unconfirmed by design — CONTEXT.md
  itself requires a live check).
- Cost/backfill: LOW — the $1.49 figure cannot be validated by this research pass; flagged as
  Assumption A1, requiring a real measured dry run before any spend, consistent with CONTEXT.md's
  own "re-measure, don't trust it" framing of that number.

**Research date:** 2026-10-03
**Valid until:** 30 days for the architecture/code findings (stable, this repo's own source);
7 days for the OpenAI pricing figures (a model this new moves fast per this project's own prior
research convention); re-verify the Umami dashboard claim at the moment the tag is actually
installed, not on a calendar schedule.

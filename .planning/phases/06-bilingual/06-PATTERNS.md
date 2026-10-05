# Phase 6: Bilingual - Pattern Map

**Mapped:** 2026-10-03
**Files analyzed:** 27
**Analogs found:** 24 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/content/loaders/articles-es-loader.ts` (new) | model/loader | batch/CRUD | `src/content/loaders/articles-loader.ts` | exact |
| `src/content.config.ts` (modify) | config | CRUD | itself (modify in place) | exact |
| `src/lib/server/d1-client.ts` (extend) | service | CRUD | itself — add `fetchTranslationsWindow`/`fetchTranslationsByIds` beside existing `fetchPublicArticlesWindow` | exact |
| `src/lib/server/kv-manifest.ts` (extend) | service | event-driven/CRUD | itself — `manifestKey()` becomes language-aware | exact |
| `src/lib/archive/archive-route.ts` (extend) | utility | file-I/O | itself — `articleArchiveKey()` gains a `language` param | exact |
| `src/lib/article-redirect.ts` (extend) | middleware | request-response | itself — `resolveRedirect`/`extractArticleUuid` gain `/es` awareness | exact |
| `src/lib/article-url.ts` (extend) | utility | transform | itself — `articlePath`/`articleParams` gain a language prefix option | exact |
| `src/lib/i18n/dictionary.ts` (new) | config/utility | transform | `src/lib/categories.ts` (fixed lookup-table pattern) | role-match |
| `src/lib/i18n/category-labels.ts` (new) | config | transform | `src/lib/categories.ts` | exact shape |
| `src/layouts/Base.astro` (modify) | component | request-response | itself — add `lang` prop + hreflang `<link>`s | exact |
| `src/pages/es/[category]/[slug].astro` (new) | route | request-response | `src/pages/[category]/[slug].astro` | exact |
| `src/pages/es/[category]/index.astro` (new) | route | request-response | `src/pages/[category]/index.astro` | exact |
| `src/pages/es/tag/[slug].astro` (new) | route | request-response | `src/pages/tag/[slug].astro` | exact |
| `src/pages/es/tags.astro` (new) | route | request-response | `src/pages/tags.astro` | exact |
| `src/pages/es/source/[slug].astro` (new) | route | request-response | `src/pages/source/[slug].astro` | exact |
| `src/pages/es/changelog.astro` (new) | route | request-response | `src/pages/changelog.astro` | role-match (D-17 behavior differs) |
| `src/pages/es/about.astro` / `privacy.astro` / `terms.astro` / `contact.astro` (new) | route | request-response | `src/pages/about.astro` etc. (English originals) | exact |
| `src/pages/es/rss.xml.ts` (new) | route | streaming/transform | `src/pages/rss.xml.ts` | exact |
| `src/pages/es/news-sitemap.xml.ts` (new, discretionary) | route | transform | `src/pages/news-sitemap.xml.ts` | exact |
| `src/worker.ts` (extend) | controller | request-response | itself — language-aware manifest/R2 key derivation in the archive-tier path | exact |
| `astro.config.mjs` (modify) | config | transform | itself — add `i18n` block to the existing `sitemap({...})` call | exact |
| `915tldr.com2/server/db/schema.ts` (extend) | model | CRUD | itself — new `articleTranslations` table beside `articles` | exact |
| `915tldr.com2/server/utils/openai.ts` (extend) | service | request-response | itself — extend `AIProcessingResult`/prompt to carry `sourceLanguage`, `titleEs`, `summaryEs`, `keyPointsEs` | exact |
| `915tldr.com2/server/utils/ai-processor.ts` (extend) | service | event-driven | itself — `storeProcessingResults` gains a second write to `article_translations` | exact |
| `915tldr.com2/server/utils/grounding-check.ts` (extend) | service | request-response | itself — call `checkGrounding` a second time against the Spanish summary | exact |
| `915tldr.com2/server/scripts/backfill-translations.ts` (new) | script | batch | `915tldr.com2/server/utils/batch-jsonl.ts` + `cost-estimate.ts` (composition, not inheritance) | role-match |
| `tests/integration/url-shapes.test.mjs` (extend) | test | request-response | itself | exact |

## Pattern Assignments

### `src/content/loaders/articles-es-loader.ts` (loader, batch/CRUD)

**Analog:** `src/content/loaders/articles-loader.ts` (418 lines)

**Header/doc-comment pattern** (lines 1-30) — copy this project's convention of a long design-rationale header citing the plan that produced it, and the explicit-`.ts`-extension import rule:
```typescript
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { UUID_RE, ARTICLE_SLUG_RE, CATEGORY_SLUG_RE } from '../../lib/article-url.ts';
import { isKnownCategory } from '../../lib/categories.ts';
import {
  fetchPublicArticlesWindow,
  fetchAllArticlesStitched,
  fetchArticlesStitchedByIds,
  fetchChangedSince as fetchChangedSinceD1,
  // ...
} from '../../lib/server/d1-client.ts';
import {
  buildManifestEntry,
  putManifestEntriesBulk,
  deleteManifestEntries,
  MANIFEST_SCHEMA_VERSION,
  type ManifestEntry,
} from '../../lib/server/kv-manifest.ts';
import {
  readLastGood as readLastGoodState,
  writePendingBuildState as writePendingBuildStateFn,
  evaluateShrink,
  type LastGoodState,
} from '../../lib/server/build-state.ts';
```

**Core pattern:** cold/warm/warm+sweep sync modes, each with its own bounded D1 read budget, `LOADER_STATE_VERSION` bump for forced cold rebuilds, never-shrink check via `evaluateShrink`. The new `articles-es-loader.ts` should reuse this exact structure against `article_translations` instead of re-inventing sync semantics — key difference: the Spanish collection is sparse (not every article has a translation yet, D-05), so "missing" is an expected steady state, not a shrink violation. The shrink check must be scoped to the Spanish row count's own trend, not compared against the English collection's count.

**Constants to mirror** (lines 62-80): `SYNC_WINDOW_SECONDS`, `LOADER_STATE_VERSION`, `SWEEP_INTERVAL_SECONDS`, `SWEEP_OVERLAP_SECONDS`, `COLD_RESYNC_INTERVAL_SECONDS` — give the Spanish loader its own independent constants (even if same values) rather than importing the English ones, so a future tuning change to one doesn't silently retune the other.

---

### `src/content.config.ts` (config)

**Full current file** (17 lines) — this is the exact edit target:
```typescript
import { defineCollection } from 'astro:content';
import { articlesLoader } from './content/loaders/articles-loader';
import { changelogLoader } from './content/loaders/changelog-loader';

const articles = defineCollection({
  loader: articlesLoader(),
});

const changelog = defineCollection({
  loader: changelogLoader(),
});

export const collections = { articles, changelog };
```
**Required edit:** add `import { articlesEsLoader } from './content/loaders/articles-es-loader';`, a third `defineCollection` for `articlesEs`, and add it to the exported `collections` map — purely additive, matching the file's existing one-collection-per-loader shape. Note the `LegacyContentConfigError` trap already documented in this file's header comment: this file MUST stay at `src/content.config.ts`, not move to `src/content/config.ts`.

---

### `src/lib/server/kv-manifest.ts` and `src/lib/archive/archive-route.ts` (CRITICAL — key collision fix)

**Analog:** themselves — this is an in-place extension, not a new file modeled on something else.

**Current (collision) state, verbatim:**
```typescript
// src/lib/server/kv-manifest.ts:165-167
function manifestKey(articleId: string): string {
  return `manifest:${articleId}`;
}
```
```typescript
// src/lib/archive/archive-route.ts:28-33
export function articleArchiveKey(articleId: string): string {
  const lower = typeof articleId === 'string' ? articleId.toLowerCase() : articleId;
  if (typeof lower !== 'string' || !UUID_RE.test(lower)) {
    throw new Error(`archive-route: invalid articleId: ${JSON.stringify(articleId)}`);
  }
  return `${ARCHIVE_ARTICLE_PREFIX}${lower}.html`;
}
```
**Fix pattern:** extend each function's signature to take a `language: 'en' | 'es'` parameter and fold it into the returned key (`manifest:<uuid>:<language>`, `articles/<uuid>/<language>.html`), validating `language` against a closed enum at the same point `UUID_RE` is already validated — do not let an unvalidated string reach key construction (Security Domain V5 in RESEARCH.md). Every caller of `manifestKey`/`articleArchiveKey` (loader, worker, `tools/archive-sync.mjs`) must be updated in lockstep or the Worker's read path and the sync tool's write path will disagree — this exact class of bug was already fixed once for English-only archive (CR-01/CR-02, Phase 5).

**Validation pattern to extend, verbatim:** `kv-manifest.ts:196-200`'s `validateManifestEntry` already closed-enum-validates the `language` field inside the stored value — extend that same check to the key-construction call sites rather than writing a second validator.

---

### `src/lib/article-redirect.ts` (middleware, request-response)

**Analog:** itself.

**Current state with no `/es` awareness, verbatim:**
```typescript
// src/lib/article-redirect.ts:100-113
let canonical: string;
try {
  canonical = articlePath(candidate.category, candidate.slug, candidate.articleId);
} catch { return { type: 'not-found' }; }

if (pathname === canonical) {
  return { type: 'canonical', articleId: candidate.articleId.toLowerCase() };
}
return { type: 'redirect', location: canonical };
```
**Fix pattern:** `extractArticleUuid` already matches on the trailing uuid regardless of prefix (`TRAILING_UUID_RE`, lines 20-21) — the gap is purely that `articlePath` never emits `/es`. Detect an `/es/` prefix on `pathname` before calling `articlePath`, carry it into the canonical-path comparison, and build the redirect target only from validated manifest fields (never from raw request-path text) — preserving the existing open-redirect mitigation documented in RESEARCH.md's Security Domain table.

---

### `src/lib/article-url.ts` (utility, transform)

**Analog:** itself — extend `articlePath`/`articleParams`.

**Current validation-then-build pattern, verbatim** (lines 34-51):
```typescript
function assertMatches(value: string, re: RegExp, label: string): void {
  if (typeof value !== 'string' || !re.test(value)) {
    throw new Error(`article-url: invalid ${label}: ${JSON.stringify(value)}`);
  }
}

export function articlePath(categorySlug: string, slug: string, uuid: string): string {
  assertMatches(categorySlug, CATEGORY_SLUG_RE, 'categorySlug');
  assertMatches(slug, ARTICLE_SLUG_RE, 'slug');
  assertMatches(uuid, UUID_RE, 'uuid');
  return `/${categorySlug}/${slug}-${uuid}`;
}
```
**Fix pattern:** add an optional `language: 'en' | 'es' = 'en'` parameter, validated against a closed enum via the same `assertMatches`-style throw-on-mismatch discipline, and prepend `/es` only when `language === 'es'`. Keep the function's "throw, naming the offending value" contract — do not silently coerce an invalid language. This module has **no imports from `src/lib/server/`** by design (it's bundled directly into the Worker) — the language-aware version must preserve that isolation.

---

### `src/lib/i18n/dictionary.ts` and `category-labels.ts` (new, config)

**Analog:** `src/lib/categories.ts` (28 lines, full file read) — the fixed lookup-table pattern this project already uses for the 8-category nav:
```typescript
export interface Category {
  slug: string;
  name: string;
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'crime', name: 'Crime' },
  // ...
] as const;

export function categoryName(slug: string): string | undefined {
  return CATEGORIES.find((category) => category.slug === slug)?.name;
}
```
**Pattern to copy:** a `readonly ... as const` array/object, a typed accessor function returning `| undefined` on miss (never throwing for a UI label lookup — contrast with `article-url.ts`'s throw-on-tampering discipline, which is for a different threat model). Build `src/lib/i18n/category-labels.ts` as `CATEGORY_LABELS_ES: Record<string, string>` keyed by the same `slug` values already in `CATEGORIES` (Crime→Crimen, etc. per D-02 — never model-generated). Build `src/lib/i18n/dictionary.ts` as a flat `{ key: { en: string; es: string } }` map per RESEARCH.md Pattern 5 — same shape discipline, no new i18n library.

---

### `src/layouts/Base.astro` (component, request-response) — REQUIRED EDIT, not additive

**Analog:** itself (170 lines, full file read).

**Current hardcoded root, verbatim** (line 82):
```astro
<html lang="en">
```
**Props interface to extend** (lines 19-49) — add `lang?: 'en' | 'es'` (default `'en'`) alongside the existing `page`, `title`, `canonicalPath`, `jsonLd` props, following this exact destructuring pattern:
```typescript
const {
  page,
  title,
  description,
  canonicalPath,
  noindex = false,
  jsonLd = [],
  activeCategory,
  datelineEpoch,
  stamp = 'build',
  buildStamp = false,
  layout,
} = Astro.props;
```
**hreflang insertion point:** right after the existing `<link rel="canonical">` (line 102) and RSS `<link>` (line 104) — add `<link rel="alternate" hreflang="es" href="...">`, the reciprocal `en` link, and `<link rel="alternate" hreflang="x-default" href="<english-url>">` per D-08. Astro has no built-in for this (RESEARCH.md Pattern 4) — it is a hand-added `<head>` block, same category as the existing JSON-LD `<script>` tags just below it.
**Nav/footer links** (lines 130-148, 156-159): every `<a href="/${category.slug}">` and footer link must become language-aware (prefix `/es` when `lang === 'es'`) to satisfy D-14 ("every internal link on an `/es` page stays inside `/es`"). Add the switcher link (D-12, "Español"/"English") in the header near the wordmark, and reuse `articlePath(..., 'es')` (once extended) rather than string-concatenating `/es` ad hoc.

---

### `src/pages/es/*` route tree (routes, request-response)

**Analog for `[category]/[slug].astro`, `tag/[slug].astro`, `tags.astro`, `source/[slug].astro`:** the English sibling of the same name — e.g. `src/pages/tag/[slug].astro` for `src/pages/es/tag/[slug].astro`.

**Core pattern to copy, verbatim** (`src/pages/tag/[slug].astro:10-62`, `getStaticPaths` shape):
```typescript
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import ArticleCard from '../../components/ArticleCard.astro';
import { articlePath, TAG_SLUG_RE } from '../../lib/article-url';
import { groupByTag, TAG_PAGE_COUNT } from '../../lib/listing';

export async function getStaticPaths() {
  const entries = await getCollection('articles');
  const allArticles = entries.map((entry) => entry.data);
  const grouped = groupByTag(allArticles);
  return [...grouped.entries()].map(([slug, entry]) => {
    if (!TAG_SLUG_RE.test(slug)) {
      throw new Error(`tag/[slug]: invalid tag slug "${slug}" — must match ${TAG_SLUG_RE}`);
    }
    // ...
  });
}
```
**What changes for the `/es` mirror:** add a second `getCollection('articlesEs')` call, join by `translationGroupId`/uuid, pass both the English identity fields (category, tags, source, slug, uuid — none translated, D-02) and the Spanish content fields (title/summary/keyPoints, falling back to English + "no disponible en español todavía" per D-05) into the same `<Base lang="es" ...>` + `<ArticleCard>` markup. Reuse `articlePath(category.slug, slug, uuid, 'es')` for every internal link so `canonicalPath` and card `href`s stay inside `/es` (D-14). **Tag/slug validation discipline (`TAG_SLUG_RE.test(slug)` throw) must be copied unchanged** — slugs are identity, never translated.

**Analog for `about.astro`/`privacy.astro`/`terms.astro`/`contact.astro`:** the English original of the same name — copy page structure/props wiring; content itself is D-16 (human-reviewed Spanish prose), not a code pattern.

**Analog for `changelog.astro`:** `src/pages/changelog.astro` for structure, but D-17 requires different content behavior (Spanish header/intro, English entries left untranslated with `lang="en"` on each entry and a one-line note) — role-match, not exact, flagged in classification table.

---

### `src/pages/es/rss.xml.ts` (route, streaming/transform)

**Analog:** `src/pages/rss.xml.ts` (47 lines, full file read).

**Full pattern to copy, verbatim:**
```typescript
import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { articlePath } from '../lib/article-url';
import { sortNewestFirst } from '../lib/listing';
import { RSS_ITEM_COUNT } from '../lib/seo-feeds';

export const GET: APIRoute = async (context) => {
  const entries = await getCollection('articles');
  const articles = sortNewestFirst(entries.map((entry) => entry.data)).slice(0, RSS_ITEM_COUNT);

  return rss({
    title: '915 TLDR - El Paso News, Simplified',
    description: '...',
    site: context.site!,
    trailingSlash: false,
    customData: '<language>en-us</language>',
    items: articles.map((article) => ({
      title: article.title,
      link: articlePath(article.category.slug, article.slug, article.uuid),
      pubDate: new Date(article.publishedAt * 1000),
      description: article.summary,
      categories: [article.category.name],
      source: { url: context.site!.href, title: article.source.name },
    })),
  });
};
```
**Changes for `/es/rss.xml.ts`:** read `articlesEs` joined to `articles`, change `customData` to `<language>es-us</language>`, use `articlePath(..., 'es')` for `link`. **Do not drop `trailingSlash: false`** — the file's own header comment explains this is required independent of `astro.config.mjs`'s project-level setting; the same trap applies to the Spanish feed.

---

### `src/pages/es/news-sitemap.xml.ts` (discretionary, D-08) and Pitfall 5

**Analog:** `src/lib/seo-feeds.ts:76-80` (the hardcoded language bug to NOT copy):
```typescript
<news:publication>
  <news:name>${NEWS_PUBLICATION_NAME}</news:name>
  <news:language>en</news:language>
</news:publication>
```
This is a static string copied verbatim from Phase 4 — if building the Spanish Google News sitemap at all, parameterize `news:language` by the sitemap's own language before reuse, per RESEARCH.md Pitfall 5.

---

### `astro.config.mjs` (config)

**Pattern to extend:** the existing `sitemap({ filter: ... })` call (lines 72-81, cited in RESEARCH.md) — add an `i18n` key alongside `filter`:
```javascript
sitemap({
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'en-US', es: 'es-ES' },
  },
  // existing filter: ... stays
});
```
RESEARCH.md flags this combination (`filter` + `i18n` together) as unverified (Assumption A2) — confirm with a real build early, inspecting the emitted `sitemap-0.xml`, rather than assuming.

---

### `src/worker.ts` (controller, request-response)

**Analog:** itself — the archive-tier miss path that calls `extractArticleUuid`/`RENDER_MANIFEST.get`/`ARCHIVE_BUCKET.get`. Extend the key derivation to detect the `/es` prefix (via the now-language-aware `article-redirect.ts`) and read `manifest:<uuid>:<language>` / `articles/<uuid>/<language>.html` instead of the English-only keys. This file is read-only context here (no direct excerpt pulled beyond the manifest/archive key functions already shown above, which it calls).

---

### `915tldr.com2/server/db/schema.ts` (model, CRUD)

**Analog:** itself — the existing `articles` table definition (lines 23-60, read directly):
```typescript
export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uuid: text('uuid').notNull().unique(),
    // ...
    groundingStatus: text('grounding_status'),
    groundingReport: text('grounding_report'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  },
  table => [
    index('idx_articles_status_dup').on(table.status, table.isDuplicate),
    index('idx_articles_published_at').on(table.publishedAt),
    index('idx_articles_source_id').on(table.sourceId),
  ]
)
```
**Pattern to copy for `article_translations`:** same `sqliteTable(name, columns, indexFn)` shape, drizzle `index()` calls in the trailing array, `references(() => articles.id, { onDelete: 'cascade' })` (used elsewhere in this file for child tables like `tags`/duplicate groups per the grep results) for the FK to `articles.id`, and the same `groundingStatus`/`groundingReport` column pair reused verbatim for the Spanish translation's own grounding verdict (D-01 requires it). Composite key: `primaryKey({ columns: [table.articleId, table.language] })` (the `primaryKey` import is already present at the top of this file) — matches D-01's `(article_id, language)` key exactly.

---

### `915tldr.com2/server/utils/openai.ts` (service, request-response)

**Analog:** itself — `AIProcessingResult` interface and the `chat.completions.create` call already cited in RESEARCH.md Pattern 1 (lines 222-245, 29-45). Extend `AIProcessingResult` with `sourceLanguage: 'en' | 'es' | ...`, `titleEs: string`, `summaryEs: string`, `keyPointsEs: string[]`, and extend `buildSummaryPrompt`'s JSON-contract instructions to request them in the same `response_format: { type: 'json_object' }` call — zero new client code, matching this file's own doc-comment convention of recording *why* each constant/model choice was made (see the top-of-file comment on `gpt-5.6-luna`).
**Pitfall to carry over:** `max_completion_tokens: 4000` is a previously-measured-tight budget for one language (RESEARCH.md Pitfall 6) — must be re-measured, not left unchanged, once Spanish output roughly doubles expected visible-output length.

---

### `915tldr.com2/server/utils/ai-processor.ts` (service, event-driven)

**Analog:** itself — `storeProcessingResults` (line 191) and `processPendingArticles` (line 36). Add a second write (to `article_translations`) inside the same function, gated on the Spanish grounding verdict (D-05: clean → write, held → withhold row). Mirror the existing `formatSummaryWithKeyPoints` (line 159) helper's shape for any Spanish-specific formatting rather than inlining string-building logic.

---

### `915tldr.com2/server/utils/grounding-check.ts` (service, request-response)

**Analog:** itself — `checkGrounding` (async, line 498) and `runDeterministicChecks` (line 165). D-04 requires calling this a second time against the Spanish summary with the same two-stage (deterministic-then-LLM-judge) cascade — call the existing exported function twice (English args, then Spanish args), do not fork a parallel Spanish-only grounding module.

---

### `915tldr.com2/server/scripts/backfill-translations.ts` (new script, batch)

**Analog (compose, don't inherit):** `915tldr.com2/server/utils/batch-jsonl.ts` (`buildBatchRequests` line 78, `parseBatchOutput` line 181, `expiredCustomIds` line 250, `customIdForArticle`/`articleIdFromCustomId` lines 29-34) and `915tldr.com2/server/utils/cost-estimate.ts` (`estimateRequestInputTokens` line 187, `projectBatchCost` line 279, `ceilCents`/`roundCentsHalfUp` lines 218-223, and the pricing constants already cited in RESEARCH.md: `BATCH_INPUT_RATE_PER_MILLION_USD = 0.1`, `BATCH_OUTPUT_RATE_PER_MILLION_USD = 0.6`).
**Pattern:** call `buildBatchRequests`/`parseBatchOutput` unchanged against a NEW translation-only prompt shape, and call `projectBatchCost` with NEW measured token-tally constants (do not reuse `MEASURED_MEAN_SUMMARY_OUTPUT_TOKENS` etc. — RESEARCH.md Assumption A1 explicitly says these don't transfer to a translation-only prompt). The dry-run-before-spend discipline (D-10) mirrors Phase 2's own CONT-09 dry run — same two-step shape: project cost first, get explicit owner approval, then run.

---

## Shared Patterns

### Zero-D1-reads-on-public-path discipline
**Source:** project-wide constraint, enforced structurally; see `src/lib/server/` directory boundary (only build-time/Worker-archive-tier code may import it) and `src/lib/article-url.ts`'s explicit "no imports from `src/lib/server/`" header comment.
**Apply to:** every new `/es` page template and `article-url.ts` extension — the language-aware `articlePath` must stay in the no-D1-import module; only the loader and Worker touch D1/KV directly.

### Throw-on-invalid, never-coerce validation
**Source:** `src/lib/article-url.ts:34-38` (`assertMatches`), `src/lib/archive/archive-route.ts:28-33` (`UUID_RE.test` throw), `src/lib/server/kv-manifest.ts:196-200` (`validateManifestEntry`).
**Apply to:** every new language-dimension check (the `'en' | 'es'` enum at every key-construction and URL-construction point) — extend this existing discipline, do not introduce a silent-fallback-to-English anywhere except the explicitly-designed D-05 fallback (missing/held Spanish content → English + note, which is a deliberate product decision, not a validation bypass).

### Separate collection over doubled collection
**Source:** RESEARCH.md Pattern 2/Pitfall 3, confirmed against this repo's own `src/content.config.ts` one-loader-per-collection shape.
**Apply to:** `articles-es-loader.ts` + `articlesEs` collection — keeps all ~10 existing `getCollection('articles')` call sites (rails, listings, both sitemaps, RSS) untouched; only new `/es` files and the new loader know about the second collection.

### Doc-comment-with-rationale header convention
**Source:** every file read in this pass (`articles-loader.ts:1-30`, `article-url.ts:1-8`, `kv-manifest.ts`'s own `manifestKey` doc comment, `tag/[slug].astro:1-9`, `rss.xml.ts:1-16`) opens with a comment block citing the plan/decision that produced the code and any non-obvious constraint (e.g. why `trailingSlash: false` is required, why imports must carry `.ts` extensions).
**Apply to:** every new file in this phase — follow this convention, citing the relevant CONTEXT.md decision ID (D-01..D-17) or RESEARCH.md pattern number.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/i18n/dictionary.ts` (as a flat EN/ES string map) | config | transform | No existing bilingual-string file exists yet in this repo; `src/lib/categories.ts` is the closest structural analog (fixed lookup table) but holds only English names today — content, not pattern, is new |
| Umami `<script>` tag installation | config/markup | event-driven (client-side analytics) | No existing third-party analytics script is installed anywhere in this repo (confirmed in RESEARCH.md Runtime State Inventory — "the tracking script is not installed anywhere yet"); the planner should add it directly inside `Base.astro`'s `<head>` near the font-preload `<link>`s, with `defer`, and disclose it on the Privacy page (EN + ES) |
| `article_translations` D1 migration mechanics (`915tldr.com2`) | migration | batch | No prior migration in this pipeline repo was read in this pass beyond the schema file itself; planner should check `915tldr.com2`'s existing migrations directory (not covered by this research pass's file list) for the project's actual migration-runner convention before hand-writing SQL |

## Metadata

**Analog search scope:** `src/content/loaders/`, `src/lib/`, `src/layouts/`, `src/pages/`, `src/worker.ts`, `astro.config.mjs` (this repo); `server/db/`, `server/utils/` (`../915tldr.com2`, read-only)
**Files scanned:** 24 read directly in this pass (plus verbatim excerpts already cited in 06-RESEARCH.md reused without re-reading)
**Pattern extraction date:** 2026-10-03

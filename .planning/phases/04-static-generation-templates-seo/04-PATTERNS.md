# Phase 4: Static Generation, Templates & SEO - Pattern Map

**Mapped:** 2026-09-26
**Files analyzed:** 24
**Analogs found:** 20 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/content/config.ts` | config | CRUD (collection def) | `astro.config.mjs` (config-as-code, explicit-over-default convention) | role-match |
| `src/content/loaders/articles-loader.ts` | service (data loader) | CRUD, incremental | `src/lib/server/d1-client.ts` + `src/pages/[category]/[slug].astro`'s `getStaticPaths` | exact (logic) / role-match (Loader shape is new) |
| `src/pages/index.astro` | route/component | request-response (build-time render) | `design/mockups/index.html` (UI contract) + `src/pages/[category]/[slug].astro` (Astro/D1 wiring) | exact (UI) / role-match (data) |
| `src/pages/[category]/index.astro` | route/component | request-response, CRUD (paginated listing) | `design/mockups/category.html` + `src/pages/[category]/[slug].astro` | exact (UI) / role-match (data) |
| `src/pages/[category]/[page].astro` | route/component | request-response, pagination | `design/mockups/index.html`'s load-more/pagination markup + `[category]/index.astro` (once built) | role-match |
| `src/pages/[category]/[slug].astro` (extend) | route/component | request-response, CRUD | itself (existing file, extend) + `design/mockups/article.html` (rail/tags/disclosure markup) | exact |
| `src/pages/tag/[slug].astro` | route/component | request-response, CRUD | `src/pages/[category]/index.astro` (once built) / `design/mockups/category.html` | role-match |
| `src/pages/tags.astro` | route/component | request-response (index listing) | `design/mockups/category.html` (list/grid shape) | partial |
| `src/pages/source/[slug].astro` | route/component | request-response, CRUD | `src/pages/[category]/index.astro` (once built) | role-match |
| `src/pages/changelog.astro` | route/component | request-response, dual-source merge (JSON fetch + D1) | `design/mockups/changelog.html` (UI) + `src/lib/server/d1-client.ts` (D1 read pattern) | exact (UI) / partial (no existing dual-source merge analog) |
| `src/pages/contact.astro` | route/component | request-response, static | `design/mockups/contact.html` (verbatim port, no live form) | exact |
| `src/pages/about.astro` | route/component | request-response, static | `design/mockups/contact.html` (chrome/structure only — no v1 about page in this repo) | partial |
| `src/pages/privacy.astro` | route/component | request-response, static | `design/mockups/contact.html` (chrome only) | partial |
| `src/pages/terms.astro` | route/component | request-response, static | `design/mockups/contact.html` (chrome only) | partial |
| `src/pages/404.astro` | route/component | request-response, event-driven (client script) | `design/mockups/index.html`'s load-more `<script>` (DOM-building conventions) | role-match |
| `src/pages/rss.xml.ts` | route (endpoint) | transform, batch | `src/lib/server/d1-client.ts` (data fetch shape) — no existing RSS endpoint in this repo | partial |
| `src/pages/news-sitemap.xml.ts` | route (endpoint) | transform, batch | same as `rss.xml.ts` — no existing sitemap endpoint in this repo | partial |
| `src/pages/categories.ts` | route (endpoint) | request-response (301) | none in-repo — new redirect-endpoint shape | none |
| `src/pages/sources.ts` | route (endpoint) | request-response (301) | none in-repo — new redirect-endpoint shape | none |
| `src/lib/server/kv-manifest.ts` (extend: add `slug`, category slug fields) | service/model | CRUD | itself (existing file, extend) | exact |
| `src/worker.ts` / Cloudflare Worker entry (D-08 301 + 404 fallback) | middleware/controller | request-response, event-driven | `src/lib/server/kv-manifest.ts` (`getManifestEntry`) — no existing Worker `main` entrypoint in this repo (first one, per wrangler.jsonc comment) | partial |
| `wrangler.jsonc` (add `not_found_handling`, `html_handling`, `main`) | config | — | itself (existing file, extend) | exact |
| `astro.config.mjs` (add `trailingSlash`, `build.format`, integrations) | config | — | itself (existing file, extend) | exact |
| `tests/regression/changelog-empty-state.test.mjs` | test | request-response | `tests/unit/manifest-schema.test.mjs` / `tests/ci-fixtures/assert-no-d1.test.mjs` (Node `--test` style) | role-match |
| `tests/unit/articles-loader.test.mjs` | test | CRUD | `tests/unit/manifest-schema.test.mjs` (validates a module's pure functions with stubbed fetch) | exact |

## Pattern Assignments

### `src/content/loaders/articles-loader.ts` (service, CRUD/incremental)

**Analog:** `src/lib/server/d1-client.ts` (query shape, error handling) + `src/lib/server/kv-manifest.ts` (validation/hashing conventions) + RESEARCH.md Pattern 1 (Loader shape itself, since no Loader exists yet in this repo).

**Imports pattern** (mirror `[category]/[slug].astro` lines 9-13, adapted to a Loader module):
```typescript
import type { Loader } from 'astro/loaders';
import { queryD1 } from '../../lib/server/d1-client';
```

**Core D1-query pattern to copy** (`src/lib/server/d1-client.ts` lines 55-84, 92-129):
```typescript
export async function queryD1<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  // ... throws on non-2xx or success:false — never returns an empty array silently
}
const ARTICLE_SELECT = `
  SELECT a.uuid AS id, a.title, a.summary, c.slug AS category, a.published_at, (...) AS tags, a.status
  FROM articles a
  LEFT JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1
  LEFT JOIN categories c ON c.id = ac.category_id
`;
```
Reuse `ARTICLE_SELECT` and extend it with `a.slug` (D-07: canonical slug column) rather than re-deriving via `src/lib/slug.ts`'s `slugify()` — that helper is being retired for URL generation per D-07's anti-pattern note.

**Fail-loud pattern to copy** (`d1-client.ts` lines 71-81, and `[category]/[slug].astro` lines 60-62):
```typescript
if (!response.ok) {
  const text = await response.text();
  throw new Error(`...: D1 REST API responded ${response.status} ${response.statusText}: ${text}`);
}
// and, at the call site:
if (!row) {
  throw new Error('...: fetchX() returned no row — cannot build the page');
}
```
Apply this same "throw, never fall back to empty" discipline inside `load()` for D-14's "never shrink vs. last-good count" rule — RESEARCH.md's own Pattern 1 example (cold-sync zero-rows throw) should be copied nearly verbatim.

**Hashing/digest pattern to copy** (`src/lib/server/kv-manifest.ts` lines 94-121, `computeContentHash`):
```typescript
function normalizeTags(tags: string | null): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0).sort();
}
export async function computeContentHash(row: HashableFields): Promise<string> {
  const { createHash } = await import('node:crypto');
  const stable = JSON.stringify({ title: row.title ?? '', summary: row.summary ?? '', tags: normalizeTags(row.tags) });
  return createHash('sha256').update(stable).digest('hex');
}
```
Use the same normalize-then-hash approach for the Loader's `generateDigest()` input, so the Content Layer `digest` and the existing KV manifest `contentHash` stay conceptually aligned (both exist so Phase 4 doesn't invent a second, drifting staleness signal).

**Env var pattern to copy** (`d1-client.ts` lines 41-47, `kv-manifest.ts` lines 42-48 — identical `requireEnv` in both files):
```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`<module>: ${name} is not set in the environment`);
  return value;
}
```

---

### `src/pages/[category]/[slug].astro` (extend existing route)

**Analog:** itself (`src/pages/[category]/[slug].astro`, current 122 lines) + `design/mockups/article.html` lines 250-300 for the new markup this phase adds (rail, tags section, AI disclosure, attribution).

**getStaticPaths + slug pattern to copy** (lines 21-79): keep the `fetchLatestArticle`/`fetchArticleById` + `buildManifestEntry`/`putManifestEntry` sequence, but per D-07 replace `slugify(row.title)` (line 51, 74) with the stored `row.slug` column once the loader/`d1-client` exposes it — do not extend `src/lib/slug.ts`, retire its use in URL generation.

**Chrome/layout pattern already correct — copy unchanged** (lines 106-121, `<Base>` wrapper, `data-uuid`/`data-category`/`data-reading-column` attributes): this is the pattern every new page type should follow — `<Base page="..." title={...}>` wrapping page-type-specific markup, never a bespoke `<html>` shell (that shell lives only in `Base.astro`).

**New markup to port verbatim from the mockup** (`design/mockups/article.html` lines 274-292 — AI disclosure + attribution, already approved, IDNT-03/04/SEO-07):
```html
<p data-ai-disclosure>This summary was written by AI from reporting by KTSM. <a href="..." rel="noopener external" target="_blank">It may leave out detail — read the original story.<svg data-new-tab-icon ...></svg><span data-new-tab-cue data-visually-hidden> (opens in a new tab)</span></a></p>
<p data-attribution>Original reporting: <a href="..." rel="noopener external" target="_blank">KTSM<svg data-new-tab-icon ...></svg><span data-new-tab-cue data-visually-hidden> (opens in a new tab)</span></a></p>
<section data-tags aria-labelledby="tags-heading">
  <h2 id="tags-heading">Tags</h2>
  <a href="category.html">holiday</a>
  ...
</section>
```
Port this markup with `data-*` attributes and structure unchanged; only replace static mockup text/hrefs with template expressions bound to the D1 row.

---

### `src/pages/index.astro`, `src/pages/[category]/index.astro`, `src/pages/tag/[slug].astro`, `src/pages/source/[slug].astro` (new listing pages)

**Analog:** `design/mockups/index.html` / `design/mockups/category.html` for markup; `src/pages/[category]/[slug].astro`'s `getStaticPaths` + `d1-client` wiring for the data side.

**Base layout usage pattern** (copy from `src/layouts/Base.astro` lines 1-9 and its `<Base page="..." title="...">` contract) — every new page imports and wraps in `Base`, never re-declares `<head>`/font-preloads/footer.

**Nav/category-list markup to copy verbatim** (`design/mockups/category.html`, the `<nav aria-label="Sections">` block with `data-nav-category`/`data-category`/`data-stripe` per category) — this is shared chrome across index/category/tag/source pages; consider factoring into a partial if repeated identically, but do not alter the markup shape (approved design, D-07/mockup-parity requirement from CONTEXT.md).

**Theme-toggle + load-more client script to copy verbatim** (`design/mockups/index.html`, the inline `<script>` block) — DOM-building convention already audited (T-01-58): `createElement`/`setAttribute`/`textContent` only, never `innerHTML`. Reuse this exact convention for D-10a's 404-suggestion script (see below) since it is the same "matched title as untrusted-ish data" rendering problem.

---

### `src/pages/404.astro` (D-10a static suggestion index)

**Analog:** `design/mockups/index.html`'s load-more `<script>` block (DOM-building convention) — no existing 404 page in this repo.

**Safe-rendering pattern to copy** (`design/mockups/index.html`, `appendInlines` helper and surrounding load-more script): render suggestion titles via `document.createTextNode` / `element.textContent`, never `innerHTML` — this is also the Security Domain requirement (V5, XSS via 404 suggestion index) called out in RESEARCH.md.

---

### `src/pages/rss.xml.ts`, `src/pages/news-sitemap.xml.ts` (new SEO endpoints)

**Analog:** `src/lib/server/d1-client.ts` for the "fetch already-synced data, never re-query at request time" discipline; no existing endpoint file to copy structurally (RESEARCH.md Code Examples §3/§5 are the closest thing to an analog — treat as primary reference since no in-repo precedent exists).

**Error/escaping pattern to copy** (`d1-client.ts`'s throw-on-failure discipline, plus RESEARCH.md's `toSafeJsonLd`/`escapeXml` helpers for the two endpoints that hand-build XML/JSON-LD):
```typescript
function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
```

---

### `src/lib/server/kv-manifest.ts` (extend: `slug` + category-slug fields, D-08)

**Analog:** itself. Follow the existing versioning convention exactly (lines 25-29, `MANIFEST_SCHEMA_VERSION`) — bump the version constant when adding the new field, and extend `validateManifestEntry` (lines 162-197) with the same "name the offending field" throw style:
```typescript
export const MANIFEST_SCHEMA_VERSION = '2'; // bumped for D-08's slug + categorySlug fields

// in validateManifestEntry's requiredNonEmptyStrings array, add 'slug', 'categorySlug'
```
Do not add a new file for this — `d1-client.ts`'s own comment establishes that this module and `d1-client.ts` are the only two files permitted under `src/lib/server/`, and the D1-import assertion (`tools/assert-no-d1.mjs`) is written against that directory boundary, not individual filenames.

---

### Cloudflare Worker entrypoint (new `main`, D-08 non-canonical 301 + 404 fallback)

**Analog:** `src/lib/server/kv-manifest.ts`'s `getManifestEntry` (lines 363-382) for the KV-read shape; no existing Worker `main` file in this repo (wrangler.jsonc's own comment: "No main field: this tracer's output is fully static").

**KV-read pattern to copy**:
```typescript
export async function getManifestEntry(articleId: string, opts: { fetchImpl?: FetchImpl } = {}): Promise<ManifestEntry | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = requireEnv('CLOUDFLARE_API_TOKEN');
  const key = manifestKey(articleId);
  const response = await fetchImpl(kvValueUrl(key), { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) { /* throw, do not swallow */ }
  return (await response.json()) as ManifestEntry;
}
```
Note: the deployed Worker uses the **`RENDER_MANIFEST` KV binding** (wrangler.jsonc `kv_namespaces`), not the REST API with a bearer token — `getManifestEntry`'s *shape* (validate presence, distinguish 404-as-null from a real error, never swallow) is the pattern to copy; the actual binding call inside the Worker will be `env.RENDER_MANIFEST.get(key)`, not `fetch()`. Per the Security Domain table, validate the extracted UUID strictly against a UUID regex before using it in the KV lookup or `Location` header — do not reflect the raw path segment (open-redirect mitigation).

---

### `wrangler.jsonc` (add `not_found_handling`, `html_handling`, `main`)

**Analog:** itself — follow the file's own established commenting convention (every non-obvious key gets a multi-line comment naming the requirement it satisfies and the finding behind it, e.g. lines 60-66's `assets` block comment). Add:
```jsonc
"assets": {
  "directory": "dist/client",
  "binding": "ASSETS",
  "not_found_handling": "404-page",
  "html_handling": "auto-trailing-slash"
}
```

---

### Tests: `tests/unit/articles-loader.test.mjs`, `tests/regression/changelog-empty-state.test.mjs`

**Analog:** `tests/unit/manifest-schema.test.mjs` and `tests/ci-fixtures/assert-no-d1.test.mjs` for the Node `--test` style and stubbed-fetch injection convention already established by `kv-manifest.ts`'s `opts.fetchImpl` pattern (lines 240-263, 274-309, 363-382 all accept `opts.fetchImpl` for exactly this reason — RESEARCH.md's own test map explicitly says to follow this precedent for the new loader test).

## Shared Patterns

### `<Base>` page chrome
**Source:** `src/layouts/Base.astro`
**Apply to:** every new `.astro` page (index, category, tag, source, changelog, contact, about, privacy, terms, 404, article extension)
```astro
import Base from '../../layouts/Base.astro';
...
<Base page="article" title={`915 TLDR — ${row.title}`}>
  <!-- page content -->
</Base>
```
`Base.astro` already owns `<head>`, font preloads, `<header>` (wordmark/tagline), `<footer>` (changelog/contact links, attribution, build stamp) — no new page should duplicate any of this.

### D1 access chokepoint
**Source:** `src/lib/server/d1-client.ts`
**Apply to:** `articles-loader.ts` and any other build-time data need — `tools/assert-no-d1.mjs`'s module-graph walk enforces that only `src/lib/server/*` may reach D1; a new loader file belongs at `src/content/loaders/`, importing `queryD1`/`ARTICLE_SELECT` from `d1-client.ts` rather than issuing its own `fetch()` calls.

### Env var access
**Source:** `requireEnv` (duplicated identically in `d1-client.ts` and `kv-manifest.ts`)
**Apply to:** any new module reading `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/`RENDER_MANIFEST_KV_NAMESPACE_ID` — copy the same throw-if-missing helper rather than inlining `process.env.X!` or a silent default.

### Fail-loud / never-shrink discipline
**Source:** `d1-client.ts` (`queryD1` throws on non-2xx/`success:false`), `[category]/[slug].astro` (`if (!row) throw ...`)
**Apply to:** the new Loader (`REND-02`), the changelog dual-source merge (`D-13`/`D-14`), the RSS/sitemap endpoints (never render an empty feed silently) — the `/changelog` empty-state bug (FIX-05) is explicitly the failure mode this discipline exists to prevent from recurring.

### DOM-building convention (no `innerHTML`)
**Source:** `design/mockups/index.html`'s load-more script (`createElement`/`setAttribute`/`textContent`/`createTextNode` only)
**Apply to:** `404.astro`'s client-side suggestion-matching script (D-10a) — same untrusted-content-rendering shape as the load-more feed items.

### Schema-version bump discipline
**Source:** `src/lib/server/kv-manifest.ts` (`MANIFEST_SCHEMA_VERSION`)
**Apply to:** the manifest extension for D-08 (`slug`, category slug fields) — bump the version constant, extend `validateManifestEntry`'s required-fields list, do not silently widen the type without a version bump.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/pages/categories.ts` | route (endpoint) | request-response (301) | No redirect-only endpoint exists in this repo yet; use RESEARCH.md's Astro endpoint (`GET`, return `Response.redirect`) shape directly — there is no in-repo precedent, only the general D1-fetch discipline applies |
| `src/pages/sources.ts` | route (endpoint) | request-response (301) | Same as above |
| `src/pages/rss.xml.ts` | route (endpoint) | transform, batch | No existing RSS/XML endpoint in this repo; RESEARCH.md's `@astrojs/rss` Code Example is the closest available reference |
| `src/pages/news-sitemap.xml.ts` | route (endpoint) | transform, batch | No existing sitemap endpoint in this repo; RESEARCH.md's hand-written Code Example is the closest available reference |
| Cloudflare Worker `main` entrypoint (D-08) | middleware/controller | request-response, event-driven | This is the first `main` field this repo's `wrangler.jsonc` will ever declare (its own comment confirms "No main field" was deliberate through Phase 3) — only the KV-read shape from `kv-manifest.ts` transfers, not a route/controller shape |

## Metadata

**Analog search scope:** `src/`, `design/mockups/`, `tests/`, `tools/`, `wrangler.jsonc`, `astro.config.mjs`
**Files scanned:** ~30 (all of `src/`, all mockup HTML files, all test files, `tools/assert-no-d1.mjs`)
**Pattern extraction date:** 2026-09-26

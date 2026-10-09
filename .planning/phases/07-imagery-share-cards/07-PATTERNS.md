# Phase 7: Share Cards & Head Metadata - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 11
**Analogs found:** 9 / 11 (2 binary assets have no code analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/layouts/Base.astro` (modify) | layout/head | request-response (build-time render) | itself (canonical/hreflang block, lines 92-145) | exact |
| `src/lib/i18n/share-meta.ts` (new, optional helper: locale map, card URL, alt, about path) | utility | transform | `src/lib/i18n/hreflang.ts` | role-match |
| `src/lib/i18n/dictionary.ts` (modify: ES/EN card alt strings, if kept in dictionary) | config | transform | existing `aboutPageTitle` entry (line 174) | exact |
| `src/pages/[category]/[slug].astro` (modify: pass `article` prop) | page template | build-time | itself, lines 111-155 | exact |
| `src/pages/es/[category]/[slug].astro` (modify: pass `article` prop) | page template | build-time | itself, lines 100-155 | exact |
| `public/og-image.png`, `public/og-image-es.png` | static asset | file | v1 `915tldr.com2/public/og-image.png` | asset |
| `public/favicon.ico`, `favicon.svg`, `apple-touch-icon.png` | static asset | file | v1 `915tldr.com2/public/favicon.{ico,svg}` | asset |
| `tests/unit/share-meta.test.mjs` (new) | test | dist-HTML assertion | `tests/unit/chrome.test.mjs` | exact |
| `tests/unit/share-card-assets.test.mjs` (new: PNG size/dimension) | test | file | `tests/unit/seo-surfaces.test.mjs` | role-match |
| `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md` (docs, D-02/D-04) | docs | n/a | no code analog | none |
| SOC-07/08 validation report | docs | n/a | no analog | none |

Article pages are exactly two templates (grep of `jsonLd` callers): `src/pages/[category]/[slug].astro` and `src/pages/es/[category]/[slug].astro`. Other `jsonLd` users (`[category]/index`, `tag/[slug]`, `tags`, `source/[slug]` and `es/*` twins) are listings and get only the base og set.

## Pattern Assignments

### `src/layouts/Base.astro` (layout, build-time render)

**Props pattern** (lines 23-66): JSDoc'd optional props, destructured with defaults at lines 68-83. Add one optional prop, for example:
```ts
/** 07 (D-15): article-only inputs for article:* tags. Omitted on non-article pages. */
article?: { publishedIso: string; section: string; tags: string[] };
```
Do not add a second layout (CONTEXT code_context).

**Absolute URL / lang wiring** (lines 92-104), reuse these variables, do not recompute:
```ts
const origin = Astro.site?.origin ?? SITE_ORIGIN;
const canonicalHref = canonicalPath ? new URL(canonicalPath, Astro.site).href : undefined;
const otherLang: Language = lang === 'en' ? 'es' : 'en';
const resolvedAlternates = alternates ?? (noindex || !canonicalPath ? 'none' : 'paired');
```
Gotchas for the planner:
- `canonicalPath` is optional. `og:url` should fall back sensibly (omit, or use `canonicalHref`) when absent. D-14 says every page emits `og:url`, so check which pages lack `canonicalPath` (noindex pages, 404) and decide.
- `og:image` URL: `new URL(lang === 'es' ? '/og-image-es.png' : '/og-image.png', origin).href`.
- About author URL: `new URL(localizedPath('/about', lang), origin).href` (`localizedPath` is already imported, line 18).
- `og:locale:alternate`: map `{en:'en_US', es:'es_US'}`; alternate = map[otherLang].
- `og:title` = `title`, `og:description` = `description` (guard like line 118: `{description && ...}`).

**Insertion point:** after the canonical + hreflang block (lines 133-138) and the robots meta (line 139), before or after the RSS alternate link (lines 140-145), and before the JSON-LD scripts (line 146). Existing tag style to copy:
```astro
{canonicalHref && <link rel="canonical" href={canonicalHref} />}
{alternateLinkList.map((link) => (<link rel="alternate" hreflang={link.hreflang} href={link.href} />))}
{noindex && <meta name="robots" content="noindex" />}
```
Icon links go next to the font preloads (lines 119-132): absolute-from-root hrefs like `/fonts/...`, so use `/favicon.ico`, `/favicon.svg` (`type="image/svg+xml"`), `/apple-touch-icon.png` (`rel="apple-touch-icon"`).

**Multi-value tags:** `article:tag` is one `<meta property="article:tag">` per tag, via `.map` like line 148's `jsonLd.map`. Use `property=`, not `name=`, for og:* and article:*; `name=` for `twitter:*`.

**Determinism (04-11a):** the file's own comment (lines 40-49) is the constraint: never put `BUILD_HASH` / `BUILD_TIMESTAMP` in per-page head tags. Only source-derived values (title, description, `publishedAt`, tags, fixed asset URLs). No `?v=` cache-busters on image URLs (D-07 also forbids versioned names). Tag order must be fixed (I18N-05 byte-identity, see `tests/regression/byte-identity.test.mjs`).

---

### Article templates (page template, build-time)

**EN** `src/pages/[category]/[slug].astro` lines 113-128, 144-155. The single source for the published time is `bylineDatetime` (line 115, `isoWithOffset(article.publishedAt)`), already fed to `newsArticleNode` as `datePublishedIso` (line 123). D-18: reuse this same variable for `article:published_time` AND `article:modified_time` (structured-data.ts lines 168-169 also sets `dateModified: datePublishedIso`).
```astro
<Base page="article" title={...} description={standfirst} canonicalPath={canonicalPath}
  alternates={enLangModel.alternates} jsonLd={[newsArticle, breadcrumb]}
  activeCategory={article.category.slug} datelineEpoch={article.publishedAt}
  stamp="commit" layout="with-rail">
```
Add e.g. `article={{ publishedIso: bylineDatetime, section: article.category.name, tags: article.tags.map((tg) => tg.name) }}`. Tags mapping already exists at line 125; section at line 124.

**ES** `src/pages/es/[category]/[slug].astro` lines 111-129, 141-155: same shape, but `section: categoryEs` (line 101, Spanish label via `categoryLabel`), tags from `article.tags` (English names today, same as JSON-LD line 125, so stay consistent), `lang="es"`, and it passes `noindex={model.noindex}` (D-14: noindex pages still emit og tags).

---

### `src/lib/i18n/share-meta.ts` (optional new helper, pure transform)

**Analog:** `src/lib/i18n/hreflang.ts`. Pure TS, `import type`/`.ts` extension imports, throws on invalid `lang` via `assertLanguage` (never silently falls back):
```ts
import { assertLanguage, localizedPath, type Language } from '../article-url.ts';
export function alternateLinks(opts) { const { canonicalPath, lang, mode, origin } = opts; assertLanguage(lang); ... new URL(path, origin).href }
```
Benefit: unit-testable without a build (hreflang.test.mjs style) for the locale map, card path and alt. Absolute URL construction: `new URL(path, origin).href` (hreflang.ts line 66). `SITE_ORIGIN` from `structured-data.ts` line 20 is the fallback when `Astro.site` is absent.

**Dictionary strings** (if used): `t(key, lang)` (dictionary.ts line 226) throws on unknown key. Entry shape example, line 174: `aboutPageTitle: { en: 'About 915 TLDR', es: 'Acerca de 915 TLDR' },`. Keys `tagline` / `datelinePlace` already exist; check them before adding a new card tagline. Alt wording is locked by D-10 (ES pending owner confirmation).

---

### Tests (dist-HTML assertions)

**Analog:** `tests/unit/chrome.test.mjs` (real built article HTML) and `tests/unit/seo-surfaces.test.mjs`.

**Boilerplate to copy** (chrome.test.mjs lines 8-43):
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';
test('name', { skip: !DIST_BUILT && SKIP_REASON }, () => { ... });
```
`findArticleHtmlFiles` / `readSampleArticleHtml` are defined inline there (not shared). Use `tests/helpers/built-page.mjs` `readBuiltPage(...)` to read a specific path, which handles hot (`dist/client`) vs archived (`dist/archive`) pages. Style: regex extraction on HTML, no XML/HTML parser dependency (seo-surfaces header says so).

**What to assert:** on an EN article, an ES article, a listing, and a noindex page (source/tag): og:* set present; `og:image` absolute `https://` and ends `/og-image.png` (EN) or `/og-image-es.png` (ES); width/height/type/alt; `twitter:card=summary_large_image`; no `twitter:site`; article pages have `article:published_time` equal to the `<time datetime>` and the JSON-LD `datePublished`; non-article pages have no `article:*`; `article:author` ends `/about` or `/es/about`; icon links present; `public/og-image*.png` exist, <5 MB, IHDR 1200x630 (read bytes 16-24 of the PNG, no dependency).

**Runner:** `node --test`. Scripts in package.json: `test:fast` (no build), `test:unit` (builds first), `test:regression`, `test:build-gate`. New tests go in `tests/unit/` so both globs pick them up. Build-time guards live in `tools/*.mjs` (`assert-file-count.mjs`, `assert-no-d1.mjs`, `check-config-guards.mjs`) with a paired `tests/unit/*.test.mjs`; no head-tag guard exists yet, so a plain test is enough.

---

### Static assets

`public/` today contains only `fonts/`, `_redirects`, `robots.txt`. There are NO favicon or og files, so everything is new. Sources: `/home/jaime/www/_github/915tldr.com2/public/` has `favicon.ico`, `favicon.svg`, `logo-light.png`, `logo-dark.png`, `og-image.png` (v1, 317 KB). Card source outside repo: `~/.claude/cache/og-card/v1-masthead.{html,png}` + `render.cjs`. Note `public/_redirects` is read by Workers Static Assets before the Worker; nothing needed for new static files (Astro copies `public/` verbatim; confirm no `_redirects` rule shadows `/og-image*.png`).

## Shared Patterns

### Absolute URLs
Use `Astro.site?.origin ?? SITE_ORIGIN` then `new URL(path, origin).href` (Base.astro lines 92-93; hreflang.ts line 66). Never concatenate strings; never hardcode `https://915tldr.com` in templates. On dev host `Astro.site` may differ from prod, so the og:image URL follows the host (check astro.config `site` when planning D-19 validation on `dev.915tldr.com`).

### Language/path
`localizedPath('/about', lang)` yields `/about` or `/es/about`. `localizedPath` throws if given an already-`/es` path; `pairedPath(canonicalPath)` goes the other way.

### Trailing slash
Base.astro throws if `canonicalPath` ends with `/` (lines 85-90); `trailingSlash: 'never'`. `og:url` must equal `canonicalHref` exactly.

### Determinism
No build-time values in head tags (Base.astro lines 36-49, plan 04-11a). `tests/regression/byte-identity.test.mjs` and `tests/unit/build-stamp.test.mjs` guard this; run them after the change.

### Escaping
Astro escapes attribute values automatically in `content={...}`; do not use `set:html` for meta content. Only JSON-LD uses `toSafeJsonLd` (structured-data.ts line 39).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `public/og-image.png`, `og-image-es.png`, `apple-touch-icon.png` | binary assets | Hand-composed from the v1 masthead HTML; ES copy needs owner sign-off (D-06) |
| ROADMAP/REQUIREMENTS/PROJECT amendments | docs | Follow existing doc structure; no code analog |
| Platform validation report (SOC-07/08) | manual | Owner pastes; record WhatsApp size as a number, list what was not checked |

## Metadata

**Analog search scope:** `src/layouts`, `src/pages`, `src/lib`, `src/lib/i18n`, `tests/{unit,helpers}`, `tools`, `public`, package.json scripts, v1 `public/`
**Files scanned:** ~25 (targeted reads)
**Pattern extraction date:** 2026-10-08

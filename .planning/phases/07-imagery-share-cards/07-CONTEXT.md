# Phase 7: Share Cards & Head Metadata (was: Imagery & Share Cards) - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 was cut down by the owner on 2026-10-08. It no longer generates or displays any page imagery. What remains:

1. **One static share card per language** (EN + ES), same design, at an absolute HTTPS URL, used as `og:image` on every page.
2. **The full head-metadata set in `src/layouts/Base.astro`** — `og:*`, `article:*`, `twitter:*` — which v2 does not emit at all today (`dev.915tldr.com` has no `og:*`/`twitter:*` tags).
3. **The icon set** — `/favicon.ico`, `/favicon.svg`, apple-touch-icon — which return 404 on dev today.
4. **Real-platform validation** of the card (SOC-07/SOC-08) — the file size that actually renders on WhatsApp is recorded as a number.

**Why the cut (owner, 2026-10-08):** lower cost; images distract; stays true to "AI-generated summaries". v1 shows one category placeholder (Midjourney `community.webp` etc.) on every article, ignoring the real photo, and the owner called it hideous. No per-article OG images either: `nuxt-og-image` is Nuxt-only and v2 is Astro. Revisit later.

**Must ship before cutover:** the v2 meta-tag/icon gap above (v1 emits all of it).

</domain>

<decisions>
## Implementation Decisions

### Phase shape & roadmap amendment
- **D-01:** Phase 7 stays its own phase, renamed **"Share Cards & Head Metadata"**. Branch `feature/phase-07` already exists (same commit as `develop` 4dfe7e9). Not folded into Phase 8, not a `/gsd-quick`.
- **D-02:** **Dropped requirements:** IMG-01..IMG-10, PERF-08, PERF-09, PERF-10, A11Y-06. They move verbatim to a **"Deferred / v2.x"** section in `REQUIREMENTS.md` with the reason (cost, distraction, "true to AI summaries"); traceability rows are marked Deferred. They are not deleted.
- **D-03:** **SOC-05/SOC-06 collapse** to: one static 1200×630 card per language at an absolute HTTPS URL under 5 MB, hand-composed (no AI-rendered text, no per-article generation). "Every article has a card" is satisfied by every article pointing at the shared card. **Kept as written:** SOC-01, 02, 03, 04, 07, 08.
- **D-04:** The Phase 7 ROADMAP entry (goal, requirements list, success criteria 1–3 and the imagery half of 5) must be rewritten to match. Success criteria around IMG/Flux/Flare/R2 are removed; the "full Open Graph, `article:*` and `summary_large_image` tag set" and the "WhatsApp size recorded as a number" criteria stay.

### Share card design & files
- **D-05:** **V1 masthead** design (owner's pick; V3 colour band liked least): off-white paper `#FAFAF8`, ink `#14161A`, Instrument Serif wordmark "915 TLDR", italic tagline, credit line, the bubble logo mark top-left, 8-colour category stripe along the bottom. Source of truth: `~/.claude/cache/og-card/v1-masthead.{html,png}` + `render.cjs` (HTML references `file://` fonts in `915tldr.com/public/fonts` and `915tldr.com2/public/logo-light.png`).
- **D-06:** **Two cards:** `public/og-image.png` (EN) and `public/og-image-es.png` (ES). Same design; tagline and credit line in Spanish on the ES card. `/es` is public and indexed (D-09 of Phase 6), so an English card on a Spanish link would read as a bug. Spanish copy must be written and confirmed with the owner at plan time (the EN card says "El Paso news, in brief." and "Summaries of reporting by KTSM, KVIA and other El Paso outlets — always credited, always linked.").
- **D-07:** **URLs are `/og-image.png` and `/og-image-es.png`** — matches v1's URL so existing shared links and scraper caches keep working. No versioned filename, no `/og/` directory. Referenced as an absolute URL built from `Astro.site`. Two static files only (the static-file count is a watched budget line: ~29,966 of the 80,000 fail threshold).
- **D-08:** **Format: PNG** (current EN card is 1200×630, 317 KB). Measure what WhatsApp actually renders and **record the outcome as a number** (SOC-08); fall back to a smaller JPEG **only if** the PNG fails to render. Same plan for the ES card. WhatsApp's real ceiling is currently unverified.

### og:image and alt
- **D-09:** `og:image` carries explicit `width` (1200), `height` (630), `type` (`image/png`) and `alt` (SOC-02) on every page.
- **D-10:** **`og:image:alt` describes the card**, not the page: EN "915 TLDR — El Paso news, in brief."; ES "915 TLDR — Noticias de El Paso, en breve." (ES wording to be confirmed with D-06). Per-page/article-headline alt was rejected because it would misdescribe a generic image.
- **D-11:** Spanish pages (`lang = 'es'`) use `og-image-es.png` and the ES alt; English pages use `og-image.png`. Language comes from the existing `lang` prop on `Base.astro`.

### Icons & header
- **D-12:** **Header stays the text wordmark** (matches the approved v2 mockups, 01-APPROVAL.md). The bubble mark is NOT added to the header; it appears only on the share card and as the favicon. No layout/CLS change to any page's chrome this phase.
- **D-13:** **Icon set:** port v1's `favicon.ico` (32×32) and `favicon.svg` from `915tldr.com2/public/`, plus a **180px `apple-touch-icon.png`** made from the bubble mark. Explicitly NOT shipping 192/512 PNGs or a web manifest. `<link rel="icon">` / `apple-touch-icon` tags must be added to `Base.astro` (it has none today).

### Meta tags
- **D-14:** **Every page** (including noindex pages) emits `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type`, `og:locale` (+ `og:locale:alternate`), the `og:image` set above, and `twitter:card=summary_large_image`. Noindex pages are NOT stripped — a pasted link to them still previews.
- **D-15:** **Articles** additionally emit `article:published_time`, `article:modified_time`, `article:section`, `article:tag` (only the article's own tags) and `article:author`.
- **D-16:** **`article:author` = the site's `/about` page URL** (`/es/about` equivalent for Spanish pages). Consistent with the JSON-LD NewsArticle node, which names the 915 TLDR Organization as author and credits outlets separately. No person is named; the originating outlet is not used as author.
- **D-17:** **No `twitter:site`** — the owner has not supplied a handle. Do not invent one. Add it later only if a real handle exists.
- **D-18:** `article:published_time`/`modified_time` reuse the same source value as `datePublishedIso` in `src/lib/structured-data.ts` (published and modified are the same value today) so the two never disagree.

### Validation (SOC-07)
- **D-19:** Validate against **`dev.915tldr.com`, all five platforms**: Facebook debugger, X validator, iMessage, WhatsApp, Slack — EN and ES pages. The owner does the pastes; the report records what each showed and **says plainly what was not checked**. Repeat on prod after cutover. Test the card as a small thumbnail too (wordmark + tagline legibility), not only full-size.
- **D-20:** The dev host is noindex; confirm the Facebook/X scrapers can still fetch it (noindex should not block them, but this is unverified — measure, don't assume).

### Plan-time owner decisions (2026-10-08, answered by the owner during `/gsd-plan-phase`)
- **D-21:** **og:image origin = a committed constant**, `SHARE_IMAGE_ORIGIN = 'https://dev.915tldr.com'` in `src/lib/share-meta.ts`, enforced by a build guard (`tools/assert-share-origin.mjs`, run by `guard:config` on every `pnpm build`) that requires it to equal the single primary `custom_domain` route in `wrangler.jsonc`. **Supersedes the "built from `Astro.site`" wording of D-07** (D-07's URLs `/og-image.png` / `/og-image-es.png` are unchanged). Deliberate deviation: lets D-19 validate the new cards on the dev host now. Not an environment variable: Astro's incremental build reuses a page when its cacheKey and module dependency hash are unchanged, so an env-var change would not re-render reused pages. At cutover the constant switches to `https://915tldr.com` (the guard fails the build until it does).
- **D-22:** **`og:locale:alternate` on every page**, including English pages with no Spanish counterpart (hreflang mode `self`) — the literal SOC-01/D-14 reading. Overrides UI-SPEC Open Item 3's default (omit on `self` pages). No toggle.
- **D-23:** **`favicon.ico` = a 32x32 rasterisation of `favicon.svg`**; v1's `favicon.ico` (measured: a Nuxt logo) is not ported. Amends D-13 (which said to port v1's `.ico`). The owner's wording called favicon.svg "the bubble mark"; measured 2026-10-08, v1's `favicon.svg` is a blue rounded "915" tile and the bubble mark is `logo-light.png` — the identity is re-confirmed at the 07-06 review checkpoint.

### Claude's Discretion
- Exact Spanish tagline/credit-line wording (subject to owner confirmation per D-06).
- `og:type` for non-article pages (`website` is the expected default).
- `og:locale` mapping details (`en_US` / `es_US` expected) and `og:description` fallback chain per page type, reusing each page's existing `description`.
- How the apple-touch-icon is rendered from the bubble mark, and whether the card is regenerated via `render.cjs` or committed as a final PNG only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` — Phase 7 entry (line ~442); must be rewritten per D-04
- `.planning/REQUIREMENTS.md` — SOC-01..08 (lines ~113–122), IMG-01..10, PERF-08..10, A11Y-06; traceability table (~lines 305–320); needs the Deferred section per D-02
- `.planning/PROJECT.md` — lines ~268–272 (imagery Key Decisions: Tier 2/3 imagery rows are now moot and should be annotated as superseded)
- `.planning/phases/06-bilingual/06-CONTEXT.md` — D-09 (`/es` public from day one), hreflang/`lang` conventions

### Code
- `src/layouts/Base.astro` — head block; no `og:*`, `twitter:*` or icon links today; `lang` prop and `canonicalPath` already exist
- `src/lib/structured-data.ts` — `datePublishedIso`, Organization `@id` author; keep meta tags consistent with it
- `src/lib/article-url.ts`, `src/lib/i18n/hreflang.ts`, `src/lib/i18n/dictionary.ts` — language/path helpers for `og:url`, `og:locale:alternate`, `/about` vs `/es/about`
- `src/styles/global.css` — v2 tokens (paper `#FAFAF8`, ink `#14161A`, `--cat-*` colours)
- `public/fonts` — Instrument Serif + Source Serif 4 (used by the card)

### Card source & v1 assets
- `~/.claude/cache/og-card/v1-masthead.html`, `v1-masthead.png`, `render.cjs` — the chosen card (outside the repo; copy what is needed in)
- `/home/jaime/www/_github/915tldr.com2/public/` — `favicon.ico`, `favicon.svg`, `logo-light.png`, `logo-dark.png`, current v1 `og-image.png` (1200×630, 317 KB)

### Handoff
- Session handoff 2026-10-08 (session 90637c3b): decisions + rejected alternatives (Flux/OpenAI backfills, on-demand OG rendering, 41k static OG files)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Base.astro` `lang` prop + `localizedPath()` / `alternateLinks()`: drive `og:locale`, `og:locale:alternate`, `og:url`, and the `/about` vs `/es/about` author URL.
- `structured-data.ts` `SITE_ORIGIN` / `origin`: absolute URL base for `og:image`.
- v1 `favicon.ico` / `favicon.svg` / bubble mark `logo-light.png`: ready to port.

### Established Patterns
- Head metadata lives in one layout; every page wraps in `Base.astro`, so one edit covers all pages. Article pages pass extra props (e.g. `stamp='commit'`, `jsonLd`) — article-specific `article:*` data needs a new optional prop rather than a second layout.
- Builds must stay deterministic for Cloudflare's content-hash dedup (04-11a): no build-time values (hash, timestamp) in per-page head tags.
- Static file count is a watched budget; adding 2 PNGs + 3 icon files is negligible.

### Integration Points
- `Base.astro` head (after canonical/alternate links) for tags and icon links.
- `public/` for the two cards and icon files.
- Article page template(s) pass `article:*` inputs (published/modified, section, tags).

</code_context>

<specifics>
## Specific Ideas

- Card is the "V1 masthead" mockup: logo mark top-left, large "915 TLDR" in Instrument Serif, italic "El Paso news, in brief.", thin rule, credit line, 8-colour stripe along the bottom edge.
- The owner floated a URL like `https://915tldr.com/og` earlier; superseded by D-07 (keep v1's `/og-image.png`).
- Verify by pasting real URLs; "the tags are in the HTML" is not verification.

</specifics>

<deferred>
## Deferred Ideas

- **Per-article OG images** — revisit later (Astro has no `nuxt-og-image`; options not evaluated).
- **Any page imagery** (per-article or category heroes) — the whole IMG-* set, moved to "Deferred / v2.x".
- **Flux-Schnell / OpenAI image backfills** (~$10–18 Flux, ~$47–94 OpenAI batched, estimates) — rejected for cost.
- **On-demand OG rendering** and **41k static OG files** — rejected (unmeasured CPU/timeout risk; static-file budget).
- **Bubble mark in the site header** — rejected for now (D-12).
- **Web manifest / 192–512 icons** — not shipping (D-13).
- **`twitter:site`** — add only if a real handle is provided.

</deferred>

---

*Phase: 07-Share Cards & Head Metadata*
*Context gathered: 2026-10-08*

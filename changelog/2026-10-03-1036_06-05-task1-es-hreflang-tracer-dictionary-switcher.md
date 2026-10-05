# 2026-10-03 - 06-05 Task 1: /es ships as a reciprocal hreflang pair with Spanish chrome and a plain-link switcher

**Keywords:** [FRONTEND] [FEATURE] [I18N] [TESTING] [ACCESSIBILITY]
**Session:** Morning, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1036_06-05-task1-es-hreflang-tracer-dictionary-switcher.md`

## What Changed

- File: `src/lib/i18n/dictionary.ts` (new)
  - Fixed flat `DICTIONARY` map (`{ key: { en, es } }`, D-15) covering every chrome string
    harvested from Base.astro, the home/category/tag/source/404/changelog/static-page templates:
    skip link, tagline, nav label, theme toggle, the language-switch labels (D-12), footer links,
    attribution, credit, new-tab cue, the AI disclosure sentence (I18N-09), the D-07
    "Originally reported in Spanish" label, the D-05 fallback note, and every listing-page
    heading/empty-state string
  - `t(key, lang, vars?)` — throws on an unknown key or an invalid language, substitutes
    `{name}`-style placeholders with plain string replacement (never `set:html`, T-06-20)
- File: `src/lib/i18n/category-labels.ts` (new)
  - `CATEGORY_LABELS_ES` (D-02, fixed map, never model-generated) and `categoryLabel(slug, lang)`
    — mirrors `categories.ts`'s own never-throws UI-lookup contract
- File: `src/lib/i18n/hreflang.ts` (new)
  - `pairedPath(canonicalPath)` — the other language's path via prefix add/remove
  - `alternateLinks({ canonicalPath, lang, mode, origin })` — `paired` (en/es/x-default,
    reciprocal, fixed order per I18N-05), `self` (en + x-default only, for a future
    English-only article), `none` (noindex pages)
- File: `src/layouts/Base.astro`
  - New props `lang` (default `'en'`), `alternates` (defaults to `'none'` when noindex/no
    canonicalPath, else `'paired'`), `switchPath`
  - `<html lang={lang}>`; renders `alternateLinks(...)` right after the canonical `<link>`; the
    RSS alternate link is now language-aware (`/rss.xml` vs `/es/rss.xml`)
  - Skip link, tagline, dateline place, nav aria-label/labels, theme-toggle label, footer
    links/attribution/credit/new-tab-cue all now draw from `t(...)`; nav/footer/wordmark hrefs go
    through `localizedPath` so an `/es` page never links outside `/es` (D-14)
  - New `<p data-lang-switch>` plain-link switcher in the header (D-12) — "Español" on English
    pages, "English" on Spanish pages, pointing at the paired path
- File: `src/pages/es/index.astro` (new)
  - The first `/es` page (D-09: public from day one) — mirrors `src/pages/index.astro`'s feed
    selection exactly; card hrefs via `articlePath(..., 'es')`, category names via
    `categoryLabel(..., 'es')`; wraps the (still-English, pending 06-06/06-10) titles/summaries in
    `lang="en"` since the Spanish content collection doesn't exist yet
- File: `src/styles/global.css`
  - `[data-lang-switch]` — small text, existing link colour/focus ring, no new tokens, no layout
    shift (always server-rendered)
- File: `tests/unit/i18n.test.mjs` (new), `tests/unit/hreflang.test.mjs` (new)
  - Dictionary/category-label contract tests; pure `alternateLinks`/`pairedPath` builder tests;
    dist-based checks proving a real build's `/` and `/es` emit the identical reciprocal
    en/es/x-default set, the correct `<html lang>`, the switcher's exact text/href, and that no
    internal `<a>` href on `es.html` escapes `/es` except the switcher itself

## Why

Phase 6 (bilingual) needs every page to declare its own language, pair with its counterpart via
`hreflang`, and let the reader switch languages with a plain link — never an automatic
header/cookie/IP-based redirect (D-13). This is the plan's tracer task: it proves the whole
chrome/hreflang/switcher mechanism end-to-end on the one page that exists today (the home page)
before later plans (06-06+) add the Spanish content collection and the rest of the `/es` route
tree on top of this now-proven foundation.

## Issues Encountered

No major issues encountered. `pnpm run typecheck` reports 1 pre-existing, unrelated failure
(`astro check`'s own D1-import-guard pass reports "entrypoints found: 0" and exits 1) — confirmed
via `git stash -u` to reproduce identically on the untouched `db005a2` commit, so it predates this
work and is out of this task's scope. The diagnostics themselves report 0 errors in both states.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (real build against live production D1, 60,674 pages);
  `dist/client/es.html`/`index.html` both verified for `<html lang>` and the reciprocal alternate
  set; `node --test tests/unit/i18n.test.mjs tests/unit/hreflang.test.mjs` (20/20 pass); full
  `pnpm run test:fast` (857/857 pass, no regressions from the Base.astro/global.css changes);
  `pnpm run test:build-gate` (9/9 pass — the new `i18n/` modules add no `src/lib/server/` reach).
- What wasn't tested: the Spanish date/byline formatting (Task 2), the Umami tag (Task 2), the
  `'es'` reserved-route guard (Task 2), and the no-auto-language source scan (Task 2) — all
  deferred to this plan's second task by design.
- Edge cases: the language switch link is the one deliberate exception to the "every `/es`
  internal link starts with `/es`" rule (it points back to English on purpose) — pinned explicitly
  in the new dist-based test rather than left as an untested assumption.

## Next Steps

- [ ] Task 2 of 06-05-PLAN.md: Spanish dates, `ArticleCard` language props, the `'es'` reserved
      top-level route, the Umami analytics tag, and the no-auto-language source-scan guard

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - the first live `/es` page and every page's hreflang/switcher plumbing; no
real Spanish article content yet (06-06/06-10 add that on top of this).

---
phase: 06-bilingual
plan: 05
subsystem: i18n
tags: [astro, i18n, hreflang, seo, accessibility, analytics]

# Dependency graph
requires:
  - phase: 06-bilingual (06-02)
    provides: "Language-aware article-url.ts helpers (LANGUAGES, Language, assertLanguage, languageOfPath, localizedPath, articlePath(..., language))"
provides:
  - "Fixed EN/ES UI dictionary (src/lib/i18n/dictionary.ts: DICTIONARY, t) and Spanish category label map (src/lib/i18n/category-labels.ts: CATEGORY_LABELS_ES, categoryLabel)"
  - "hreflang alternate-link builder (src/lib/i18n/hreflang.ts: alternateLinks, pairedPath) — paired/self/none modes, fixed en/es/x-default order"
  - "Base.astro lang/alternates/switchPath props: <html lang>, reciprocal hreflang links, a plain-link language switcher, and every nav/footer/wordmark href routed through localizedPath"
  - "The first live /es page (src/pages/es/index.astro), reciprocal with / on every chrome element"
  - "Spanish-aware date formatting (src/lib/format.ts: formatBylineTime({language}), formatDateline(epoch, language)), fixed arrays, byte-identical English output"
  - "ArticleCard lang/contentLang props for per-card language + fallback-content marking (D-05)"
  - "'es' reserved as a top-level route (src/lib/listing.ts RESERVED_TOP_LEVEL) — I18N-04 adjacency"
  - "The self-hosted Umami analytics tag (D-11), live on every page"
  - "Structural no-auto-language guard (tests/unit/no-auto-language.test.mjs) scanning src/ for Accept-Language/navigator.language/CF-country/request.cf/document.cookie reads"
affects: [06-bilingual-content-collection, 06-bilingual-route-tree, 06-bilingual-static-pages, 06-bilingual-changelog]

# Actuals (#2632)
actuals:
  tokens: 16200
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed flat {key: {en, es}} dictionary (no i18n library) — RESEARCH.md Pattern 5, mirrors categories.ts's own fixed-lookup-table convention"
    - "Date/time Spanish formatting built from fixed arrays (ES_MONTHS_ABBR/FULL, ES_WEEKDAYS_FULL), never Intl locale-name output — same byte-identity discipline as the pre-existing AP_MONTHS table"
    - "alternateLinks' 3 modes (paired/self/none) resolved once in Base.astro from noindex/canonicalPath, so every future page gets correct hreflang behavior with zero per-page wiring"
    - "localizedPath used for every chrome href (nav/footer/wordmark/switcher) so an /es page can never leak outside /es (D-14) by construction, not by per-page discipline"

key-files:
  created:
    - src/lib/i18n/dictionary.ts
    - src/lib/i18n/category-labels.ts
    - src/lib/i18n/hreflang.ts
    - src/pages/es/index.astro
    - tests/unit/i18n.test.mjs
    - tests/unit/hreflang.test.mjs
    - tests/unit/no-auto-language.test.mjs
    - .planning/phases/06-bilingual/deferred-items.md
  modified:
    - src/layouts/Base.astro
    - src/lib/format.ts
    - src/components/ArticleCard.astro
    - src/lib/listing.ts
    - src/styles/global.css
    - tests/unit/format.test.mjs
    - tests/unit/chrome.test.mjs

key-decisions:
  - "Base.astro's alternates prop defaults to 'paired' whenever canonicalPath is set and noindex is false — applies to EVERY page site-wide (not just the home page this plan ships), matching the phase's stated goal ('every public page type is mirrored... with hreflang pairs plus x-default') rather than hand-wiring it per future page"
  - "Spanish home's article cards mark lang=\"es\" contentLang=\"en\" per card (ArticleCard's new prop), not a section-level lang=\"en\" wrapper — correct per-element language marking from the start, even though Task 1 shipped the coarser wrapper as an interim step before Task 2 added the prop"
  - "pnpm run typecheck's non-zero exit is a pre-existing, unrelated astro-check-vs-astro-build tooling characteristic (confirmed via git stash -u against the untouched prior commit) — logged to deferred-items.md rather than fixed, per the executor's own scope-boundary rule"

patterns-established:
  - "Every new i18n module (dictionary.ts, category-labels.ts, hreflang.ts) imports article-url.ts's Language/assertLanguage and has zero src/lib/server/ imports, preserving the Worker-safe boundary article-url.ts itself documents"

requirements-completed: []  # I18N-03, I18N-05, I18N-08, I18N-09 and I18N-10 (this plan's frontmatter requirements) are intentionally left Pending in REQUIREMENTS.md, matching this project's own established precedent (05-02/05-04/06-02): the MECHANISMS are built and proven on the one page that exists today (the home page), but each requirement's full behavior is not yet live everywhere a human would check it. I18N-05/I18N-03's hreflang/lang mechanism now defaults on for every future page via Base.astro, but only / and /es exist today. I18N-08's switcher/no-auto-language guard are proven, but 06-02-SUMMARY.md already flagged an unresolved zone-level-Transform-Rule caveat for I18N-08 outside this repo's audit scope — unchanged by this plan. I18N-09's AI-disclosure string exists in the dictionary with matching meaning but is not yet wired into any real article page (no /es article page exists until 06-06+). I18N-10's Umami tag is live, but whether this instance exposes a Languages report is explicitly flagged unresolved until 06-16 (06-05-PLAN.md's own "Flagged assumptions" section).

coverage:
  - id: D1
    description: "dist/client/es.html has <html lang=\"es\">, Spanish chrome (skip link, tagline, nav labels, footer) from the fixed dictionary, and every internal link on it starts with /es except the deliberate language switch"
    requirement: "I18N-03"
    verification:
      - kind: unit
        ref: "tests/unit/hreflang.test.mjs#hreflang: es.html declares <html lang=\"es\">, index.html declares <html lang=\"en\">"
        status: pass
      - kind: unit
        ref: "tests/unit/hreflang.test.mjs#hreflang: every internal href on es.html starts with /es, except the switch link (\"/\"), \"#main\" and external links"
        status: pass
    human_judgment: false
  - id: D2
    description: "The English home and /es each emit exactly three alternate links in the fixed order en, es, x-default, reciprocal"
    requirement: "I18N-05"
    verification:
      - kind: unit
        ref: "tests/unit/hreflang.test.mjs#hreflang: / and /es emit reciprocal en/es/x-default alternates, in that fixed order"
        status: pass
      - kind: unit
        ref: "tests/unit/hreflang.test.mjs#alternateLinks: mode \"paired\" on an English page returns en/es/x-default in that fixed order, absolute URLs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every page's header carries a plain <a> language switch with no JavaScript, pointing at the paired URL (D-12)"
    requirement: "I18N-08"
    verification:
      - kind: unit
        ref: "tests/unit/chrome.test.mjs#chrome: es.html's language switch points to \"/\" with text \"English\"; index.html's points to \"/es\" with text \"Español\""
        status: pass
    human_judgment: false
  - id: D4
    description: "'es' is a reserved top-level route — assertNoRouteCollisions(['es']) throws, so no category can ever collide with the Spanish tree"
    requirement: "I18N-04"
    verification:
      - kind: other
        ref: "node -e \"import('./src/lib/listing.ts').then(m=>{try{m.assertNoRouteCollisions(['es']);}catch(e){console.log(e.message)}})\" -> 'listing: category slug \"es\" collides with a reserved top-level route'"
        status: pass
    human_judgment: false
  - id: D5
    description: "The dictionary holds every UI string the /es mirrors need, with non-empty en and es values; category display names come from the fixed label map, never the model"
    requirement: "I18N-09"
    verification:
      - kind: unit
        ref: "tests/unit/i18n.test.mjs#DICTIONARY: every entry has a non-empty en and es string"
        status: pass
      - kind: unit
        ref: "tests/unit/i18n.test.mjs#categoryLabel: translates every CATEGORIES slug, en passthrough + es from the fixed map"
        status: pass
    human_judgment: false
  - id: D6
    description: "The self-hosted Umami tag appears verbatim, deferred, once in the <head> of every built page sampled (home, category, article, tag, /es)"
    requirement: "I18N-10"
    verification:
      - kind: unit
        ref: "tests/unit/chrome.test.mjs#chrome: every sampled page (home, a category, an article, a tag, /es) carries the Umami tag exactly once, with defer"
        status: pass
    human_judgment: true
    rationale: "I18N-10 also requires confirming this Umami instance exposes a Languages report before the requirement is met (D-11) — explicitly deferred to 06-16's live check per 06-05-PLAN.md's own 'Flagged assumptions' section; the tag's presence/shape alone is proven here, not the full requirement."
  - id: D7
    description: "No source file under src/ reads Accept-Language, navigator.language, a country header, request.cf or document.cookie to pick a language"
    requirement: "I18N-08"
    verification:
      - kind: unit
        ref: "tests/unit/no-auto-language.test.mjs#no-auto-language: the real src/ tree has zero non-comment occurrences of any forbidden surface"
        status: pass
      - kind: unit
        ref: "tests/unit/no-auto-language.test.mjs#astro.config.mjs: defines no top-level \"i18n\" config key"
        status: pass
    human_judgment: false
  - id: D8
    description: "Spanish byline/dateline formatting is deterministic (fixed arrays, not Intl locale names) and English output stays byte-identical"
    verification:
      - kind: unit
        ref: "tests/unit/format.test.mjs#formatBylineTime: Spanish month abbreviation table — every month gets a trailing period, including May/June/July (unlike English)"
        status: pass
      - kind: unit
        ref: "tests/unit/format.test.mjs#formatDateline: English output is byte-identical whether or not \"en\" is passed explicitly"
        status: pass
      - kind: integration
        ref: "pnpm run test:regression (byte-identity, two consecutive real builds against live production D1) — 5/5 pass"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-10-03
status: complete
---

# Phase 6 Plan 05: Language, Hreflang, Chrome & the First /es Page Summary

**The first live `/es` page (home) ships as a reciprocal `hreflang` pair with full Spanish chrome, a plain-link switcher, Spanish-formatted dates, and the Umami analytics tag — on a fixed EN/ES dictionary that costs no i18n library.**

## Performance

- **Duration:** ~50min
- **Completed:** 2026-10-03
- **Tasks:** 2
- **Files modified:** 15 (8 new, 7 modified)

## Accomplishments

- `src/lib/i18n/dictionary.ts` ships a fixed, flat EN/ES UI dictionary (D-15) covering every chrome
  string this phase's templates need — skip link, tagline, nav, footer, the switcher labels
  (D-12), the AI disclosure (I18N-09), the D-05 fallback note, the D-07 "Originally reported in
  Spanish" label, and every listing/404/changelog/static-page heading harvested from the existing
  English templates — with `t(key, lang, vars?)` throwing on an unknown key or invalid language.
- `src/lib/i18n/category-labels.ts` ships the fixed Spanish category label map (D-02,
  `categoryLabel`), mirroring `categories.ts`'s own never-throws UI-lookup contract.
- `src/lib/i18n/hreflang.ts`'s `alternateLinks`/`pairedPath` builder emits the fixed
  `en, es, x-default` order (D-08/I18N-05) in three modes (`paired`/`self`/`none`), wired into
  `Base.astro` so every future page gets correct hreflang behavior automatically from its
  `canonicalPath`/`noindex` props, with no per-page opt-in required.
- `Base.astro` gained `lang`/`alternates`/`switchPath` props: `<html lang>`, the reciprocal
  hreflang links, a plain-link language switcher (D-12, no JavaScript), and every nav/footer/
  wordmark href routed through `localizedPath` so an `/es` page can never link outside `/es`
  (D-14) by construction.
- `src/pages/es/index.astro` is the first live `/es` page — D-09's "public from day one" applies
  immediately, mirroring the English home's feed selection exactly, with cards marked
  `lang="es" contentLang="en"` since real Spanish article content doesn't exist until 06-06+.
- `src/lib/format.ts` gained Spanish byline/dateline formatting from fixed arrays (never `Intl`
  locale names, matching the existing `AP_MONTHS` byte-identity discipline) — English output is
  byte-identical to before.
- `ArticleCard.astro` gained `lang`/`contentLang` props — the page's language drives the byline
  formatter, and fallback-language title/summary text is still correctly marked (D-05).
- `'es'` is now a reserved top-level route (`RESERVED_TOP_LEVEL`, I18N-04 adjacency) and the
  self-hosted Umami tag (D-11) is live, verbatim, deferred, on every built page.
- `tests/unit/no-auto-language.test.mjs` structurally guards D-13: a real-tree scan (plus a
  self-test proving the pattern actually catches each forbidden surface) confirms no source file
  reads `Accept-Language`, `navigator.language(s)`, the Cloudflare country header, `request.cf`/
  `.cf.country` or `document.cookie` to pick a language, and `astro.config.mjs` defines no
  Astro-native `i18n` key (which ships fallback-redirect helpers D-13 forbids).

## Task Commits

Each task was committed atomically (Task 2 as a genuine TDD RED/GREEN pair):

1. **Task 1: Tracer — a real build emits / and /es as a reciprocal hreflang pair with Spanish chrome, lang="es" and /es-only internal links** - `5f0c747` (feat)
2. **Task 2 (RED): failing coverage for Spanish dates, the Umami tag and the no-auto-language guard** - `bb3440d` (test)
3. **Task 2 (GREEN): Spanish dates, ArticleCard language props, the reserved /es route and the Umami tag** - `ffb2fc4` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Task 1 is `type="tracer"` — executed and committed as a single real, verified slice (build +
both new test files passing) per its own `<verify>`. Jaime pre-approved auto-continuing a tracer
feedback gate whose evidence is fully automated (no browser/visual check needed here); the gate
was re-run and passed before Task 2 began, logged as "tracer gate auto-continued per Jaime's
standing approval (2026-10-03)."_

## Files Created/Modified

- `src/lib/i18n/dictionary.ts` - `DICTIONARY`, `DictionaryKey`, `t(key, lang, vars?)`
- `src/lib/i18n/category-labels.ts` - `CATEGORY_LABELS_ES`, `categoryLabel(slug, lang)`
- `src/lib/i18n/hreflang.ts` - `pairedPath()`, `alternateLinks()`, `AlternateMode`
- `src/layouts/Base.astro` - `lang`/`alternates`/`switchPath` props; `[data-lang-switch]` markup;
  Umami tag; every chrome string/href now language-aware
- `src/pages/es/index.astro` - the Spanish home, `/es`
- `src/lib/format.ts` - `formatBylineTime(..., { language })`, `formatDateline(epoch, language)`
- `src/components/ArticleCard.astro` - `lang`, `contentLang` props
- `src/lib/listing.ts` - `'es'` in `RESERVED_TOP_LEVEL`
- `src/styles/global.css` - `[data-lang-switch]` styling (existing tokens only)
- `tests/unit/i18n.test.mjs`, `tests/unit/hreflang.test.mjs`, `tests/unit/no-auto-language.test.mjs` - new
- `tests/unit/format.test.mjs`, `tests/unit/chrome.test.mjs` - extended
- `.planning/phases/06-bilingual/deferred-items.md` - new, logs one out-of-scope discovery

## Decisions Made

- `Base.astro`'s `alternates` default (`'paired'` whenever `canonicalPath` is set and `noindex`
  is false) applies site-wide, not just to the home page this plan ships — matches the phase's
  stated goal of mirroring every public page type, rather than requiring per-page opt-in later.
- The Spanish home's cards mark `lang="es" contentLang="en"` per card (via `ArticleCard`'s new
  prop) once Task 2 added it, replacing Task 1's coarser section-level `lang="en"` wrapper — the
  plan's own action text anticipated this exact two-step sequence.
- `pnpm run typecheck`'s non-zero exit is logged to `deferred-items.md`, not fixed — confirmed via
  `git stash -u` to be a pre-existing, unrelated `astro check` characteristic (see below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - completeness] Added a `skipLink` dictionary entry and wired it into Base.astro**
- **Found during:** Task 1
- **Issue:** The plan's must-haves explicitly list the skip link as part of the Spanish chrome
  ("skip link, tagline, nav labels, footer") but the action text's dictionary harvest list did
  not separately call it out by key name.
- **Fix:** Added `skipLink: { en: 'Skip to content', es: 'Saltar la navegación' }` (the `es_real`
  value already approved in Phase 1's `design/fixtures/spanish-stress.json`) and wired
  `<a data-skip-link href="#main">{t('skipLink', lang)}</a>`.
- **Files modified:** `src/lib/i18n/dictionary.ts`, `src/layouts/Base.astro`
- **Commit:** `5f0c747`

**2. [Rule 1 - bug] Fixed the Umami tag test regex to match Astro's actual rendered output**
- **Found during:** Task 2 verification
- **Issue:** The initial `chrome.test.mjs` assertion required the literal string `is:inline` in
  the built HTML, but `is:inline` is an Astro compile-time-only directive that is stripped before
  the script tag is rendered — the test failed against a correctly-implemented tag.
- **Fix:** Corrected the regex to match the actual rendered shape (`<script defer src="..."
  data-website-id="...">`), confirmed against the real built `dist/client/index.html`.
- **Files modified:** `tests/unit/chrome.test.mjs`
- **Commit:** `bb3440d` (test file; the implementation itself needed no change)

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).
**Impact on plan:** Both were necessary for correctness/completeness. No scope creep.

## Issues Encountered

**`pnpm run typecheck` does not exit 0** (one of the plan's own acceptance criteria for Task 2).
Confirmed via `git stash -u` against the untouched prior commit (`db005a2`) that this command
already exited 1 before any 06-05 work — the real diagnostics report **0 errors** in both states;
the non-zero exit comes from `tools/assert-no-d1.mjs`'s own D-06 non-vacuity guard, which fails
loud when `astro check`'s content-sync pass (unlike a real `astro build`) never visits any
page-shaped module. Out of scope per the executor's scope-boundary rule (pre-existing, unrelated
to Spanish dates/card props/the reserved route/the Umami tag/the no-auto-language guard). Logged
to `.planning/phases/06-bilingual/deferred-items.md` rather than fixed.

## User Setup Required

None - no external service configuration required. The Umami tag points at the owner's own
already-provisioned `stats.915websites.com` instance (D-11); no new credentials or dashboard
setup needed for this plan.

## Next Phase Readiness

- The dictionary, category labels, hreflang builder, `Base.astro`'s language props, and Spanish
  date formatting are all proven and ready for 06-06+ to build the real `articlesEs` content
  collection and the rest of the `/es` route tree (category/tag/source/article/static pages) on
  top of this foundation with zero additional plumbing.
- `RESERVED_TOP_LEVEL` now includes `'es'`, so no later plan's category work can ever collide
  with the Spanish tree.
- Two items are explicitly deferred to 06-16's live/real-browser pass, matching this plan's own
  "Flagged assumptions": confirming screen-reader voice-switching on mixed-language pages
  (I18N-03), and confirming the Umami instance exposes a Languages report (I18N-10, D-11).
- No blockers for subsequent plans.

---
*Phase: 06-bilingual*
*Completed: 2026-10-03*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/lib/i18n/dictionary.ts`,
`src/lib/i18n/category-labels.ts`, `src/lib/i18n/hreflang.ts`, `src/pages/es/index.astro`,
`tests/unit/i18n.test.mjs`, `tests/unit/hreflang.test.mjs`, `tests/unit/no-auto-language.test.mjs`,
`.planning/phases/06-bilingual/deferred-items.md`). All three task commits (`5f0c747`, `bb3440d`,
`ffb2fc4`) confirmed present in `git log --oneline --all`.

# 2026-10-04 - Tracer: /es/rss.xml and Per-Language Sitemap Files

**Keywords:** [FRONTEND] [FEATURE] [I18N] [SEO] [TESTING] [BUG_FIX]

**Session:** Early morning, Duration (~65 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-04-0707_06-11-task1-es-rss-and-per-language-sitemaps.md`

## What Changed

- File: `src/pages/es/rss.xml.ts` (new)
  - Spanish RSS feed, mirroring `src/pages/rss.xml.ts` exactly in shape: joins `articles` with
    `articlesEs`, keeps only publishable Spanish versions (D-05, `translated: true`), newest
    first, capped at `RSS_ITEM_COUNT`, `<language>es-us</language>`, Spanish title/summary/
    category label, `/es` links. `src/pages/rss.xml.ts` itself is untouched.
- File: `src/lib/i18n/sitemap.ts` (new)
  - `spanishSitemapExclusions()`: reads the Spanish article tier facts
    (`ARTICLE_FACTS_ES_PATH`) once per build and returns the set of `/es` article paths whose
    translation is held/missing (`translated: false`) — these must never appear in a sitemap.
  - `sitemapChunks()`: `@astrojs/sitemap`'s `chunks` option, partitioning every URL into an
    `en`/`es` file set via `languageOfPath` — the same exact-first-segment test every other
    `/es` routing decision in this project already uses.
- File: `astro.config.mjs`
  - `sitemap()`'s `filter` now also drops any path in `spanishSitemapExclusions()`; added
    `chunks: sitemapChunks()` and `i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } }`
    to turn on per-language `xhtml:link` alternates.
  - Confirmed against a real build: because `filter` runs before the package's own i18n-pairing
    step, an excluded fallback `/es` page is already gone by the time alternates are computed —
    its English counterpart ends up with no Spanish URL to pair with, so it gets zero alternate
    links. Zero dangling `xhtml:link` hrefs found across 80,861 real sitemap URLs. No `serialize`
    step was needed — resolves 06-11-PLAN.md's Assumption A2 by direct observation.
  - Real build output: `sitemap-index.xml` now lists 3 chunk files (`sitemap-en-0.xml`,
    `sitemap-en-1.xml`, `sitemap-es-0.xml`) rather than the plan's anticipated "exactly two" —
    both languages' URL counts (~60k each) exceed `@astrojs/sitemap`'s 45,000-per-file default,
    so English alone splits into two files. The per-language partition itself (no English URL in
    any `es`-named file, no non-`/es` URL in any `es`-named file, no empty file) is fully met;
    only the literal file *count* differs from the plan's prose, which the plan itself flagged
    as an unresolved assumption to decide from the real build.
- File: `tests/unit/es-feeds.test.mjs` (new)
  - Direct unit coverage for `sitemapChunks()`, plus dist-output coverage: `/es/rss.xml` parses
    and is Spanish; every sitemap child file is single-language and non-empty; no untranslated
    `/es` article path appears in any sitemap; every `xhtml:link` href resolves to a real `<loc>`
    somewhere in the sitemap; the excluded endpoints (404, rss.xml, news-sitemap.xml,
    version.json, 404-index.json, both languages) appear in none.
- File: `tests/unit/astro-config.test.mjs`
  - Added string-shape assertions (matching this file's existing `extractCloudflareCallArgSource`
    technique, generalized into `extractCallArgSource`) that the real `sitemap()` call sets
    `chunks: sitemapChunks()`, the `i18n` option, and the `spanishSitemapExclusions()` filter line.
- File: `tests/unit/no-auto-language.test.mjs` (Rule 1 — see Issues Encountered)
  - Scoped the existing "no top-level i18n key" regex to exclude the `sitemap(...)` call's own
    argument span, since `@astrojs/sitemap`'s legitimate, unrelated `i18n` option would otherwise
    false-positive against a blanket `/\bi18n\s*:/` match. Added a sanity-check test proving the
    exclusion isn't silently swallowing a real violation.
- File: `tests/unit/news-sitemap.test.mjs` (Rule 1 — see Issues Encountered)
  - Fixed the sitemap/built-file-count cross-check to subtract the count of untranslated `/es`
    fallback articles (now correctly excluded from the sitemap) from the expected total.
- File: `src/lib/seo-feeds.ts`
  - Fixed an import path typo introduced while writing this plan's code (`../article-url.ts` ->
    `./article-url.ts`, since both files are siblings in `src/lib/`) — caught immediately by the
    first real build, before any commit.

## Why

I18N-06/D-08: Spanish readers and search engines need their own RSS feed and sitemap, and
untranslated English-fallback pages served under `/es` must never be advertised as indexable
Spanish content.

## Issues Encountered

**[Rule 1 - Bug] `tests/unit/no-auto-language.test.mjs`'s blanket `i18n:` regex would have
false-flagged this plan's own legitimate change** — the 06-05 test forbids a top-level Astro
`i18n` routing key (D-13), but its regex had no way to distinguish that from
`@astrojs/sitemap`'s own, unrelated `i18n` option nested inside the `sitemap(...)` call this plan
adds. Fixed by excising that call's own argument span before the check, with a new sanity test
proving the exclusion doesn't hide a real violation.

**[Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs`'s sitemap/built-file-count cross-check didn't
account for newly-excluded untranslated `/es` articles** — correctly excluding ~40,691
untranslated fallback pages from the sitemap (the whole point of this plan) dropped the real
total below what the pre-existing formula expected. Fixed by subtracting that count, read from
the same Spanish tier facts the exclusion itself uses.

## Dependencies

No dependencies added — `@astrojs/sitemap` 3.7.4 was already installed; its `chunks`/`i18n`
options (available since 3.7.0) were simply not yet in use.

## Testing Notes

- What was tested: `pnpm run build` (real build against production D1, 121,554 pages) followed by
  `node --test tests/unit/es-feeds.test.mjs tests/unit/news-sitemap.test.mjs
  tests/unit/seo-surfaces.test.mjs tests/unit/astro-config.test.mjs tests/unit/no-auto-language.test.mjs`
  (60/60 pass), the full `pnpm run test:fast` suite (1019/1019), and `pnpm run test:build-gate`
  (9/9) — all green.
- What wasn't tested: a real browser/visual check of `/es/rss.xml` or the sitemap XML — not
  required by this plan's acceptance criteria (dist-output assertions only). Jaime pre-approved
  auto-continuing the tracer feedback gate for fully-automated evidence; logged here as "tracer
  gate auto-continued per Jaime's standing approval (2026-10-03)".
- Edge cases: verified via direct inspection of the real build output (not just the tests) that
  the Spanish sitemap chunk contains exactly the 13 currently-translated articles plus every
  non-article `/es` page (tags, categories, sources, trust pages, home) — zero untranslated
  articles leaked through.

## Next Steps

- [ ] Task 2 of this same plan (06-11): the Spanish Google News sitemap and robots.txt — follow-up
  commit, not yet staged.

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - gives Spanish readers and search engines their own RSS feed and sitemap,
and stops untranslated English-fallback `/es` pages from ever being advertised as indexable
Spanish content.

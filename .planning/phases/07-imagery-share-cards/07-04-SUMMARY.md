---
phase: 07-imagery-share-cards
plan: 04
subsystem: head-metadata
tags: [share-cards, open-graph, article-tags, astro, test-harness]
requires: ["07-03"]
provides:
  - shareMetaTags article branch (og:type article, article:published_time, modified_time, section, tag, author)
  - Base.astro optional `article` prop
  - EN and ES article templates passing article={{ publishedIso: bylineDatetime, section, tags }}
  - head-harness variants en-article, es-article, en-article-no-tags
  - tests/helpers/dist-fresh.mjs builtPagesHaveShareMeta()
  - tests/unit/share-meta-dist.test.mjs (freshness-gated, skipped until a real build)
affects: [07-05, 07-06, 07-07, 07-08, 07-09]
tech-stack:
  added: []
  patterns:
    - one source variable (bylineDatetime) feeding the byline, the JSON-LD and the meta tags
    - freshness-gated dist test with a visible skip reason
key-files:
  created:
    - tests/unit/share-meta-dist.test.mjs
  modified:
    - src/lib/share-meta.ts
    - src/layouts/Base.astro
    - src/pages/[category]/[slug].astro
    - src/pages/es/[category]/[slug].astro
    - tests/unit/share-meta.test.mjs
    - tests/fixtures/head-harness/src/variants.ts
    - tests/fixtures/head-harness/src/pages/[variant].astro
    - tests/unit/head-harness.test.mjs
    - tests/helpers/dist-fresh.mjs
key-decisions:
  - "article:modified_time equals published_time: the pipeline records one instant and the JSON-LD already sets dateModified = datePublished (D-18)"
  - "publishedIso must end in Z or a +-HH:MM offset; a naive local time throws share-meta: instead of emitting an ambiguous tag"
requirements-completed: []
duration: ~15 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 4
---

# Phase 7 Plan 04: Article tags and og:type article Summary

Both article templates now hand the layout their existing byline instant, category name and tag names, and the head carries og:type `article` plus article:published_time, modified_time, section, one article:tag per tag and article:author (the site's /about page, per language), proven on three new head-harness variants and a freshness-gated real-build test that skips visibly until a build exists.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for the article branch | 78f5dd9 | tests/unit/share-meta.test.mjs |
| 1 GREEN | shareMetaTags emits og:type article and the article:* set | 8ad8218 | src/lib/share-meta.ts |
| 2 | Base `article` prop, both templates, three harness variants | 5461c9e | src/layouts/Base.astro, both article templates, variants.ts, [variant].astro, head-harness.test.mjs |
| 3 | Freshness-gated real-build test | a0e4eb0 | tests/helpers/dist-fresh.mjs, tests/unit/share-meta-dist.test.mjs |

Each commit carries its `changelog/` entry and README row. The public `changelog.json` was not touched (nothing is live until merge).

## Acceptance results (real output)

Task 1:
- RED: `node --test tests/unit/share-meta.test.mjs` showed 13 pass, 6 fail before 78f5dd9.
- GREEN: `node --test tests/unit/share-meta.test.mjs tests/unit/head-harness.test.mjs` 37 pass, 0 fail; strict tsc on `src/lib/share-meta.ts` exit 0.

Task 2 (`node --test tests/unit/head-harness.test.mjs tests/unit/share-meta.test.mjs`: 39 pass, 0 fail):
- `grep -o 'property="article:tag"' dist/en-article.html | wc -l` printed `2`; same on `en-article-no-tags.html` printed `0`.
- `grep -o '<meta property="article:author" content="[^"]*"' dist/es-article.html` printed `<meta property="article:author" content="https://915tldr.com/es/about"`.
- `grep -c 'publishedIso: bylineDatetime'` printed `1` for each of the two templates.
- `git diff ef4318a -- <both templates> | grep -c '^-[^-]'` printed `0`.
- `diff <(git show ef4318a:src/layouts/Base.astro | sed -n '/<body data-page/,$p') <(sed -n '/<body data-page/,$p' src/layouts/Base.astro)` exit 0.
- es-article head, in order: published_time, modified_time `2026-09-20T08:15:00-06:00`, section `Crimen`, tag `El Paso Police`, tag `Arrest`, author `https://915tldr.com/es/about`.

Task 3:
- `node --test tests/unit/share-meta-dist.test.mjs`: `pass 0`, `fail 0`, `skipped 5`; every skip reason reads "dist does not yet show this behaviour and predates src/layouts/Base.astro — rebuild with `pnpm build`".
- `grep -c 'export function builtPagesHaveShareMeta' tests/helpers/dist-fresh.mjs` printed `1`.
- `pnpm run guard:config` exit 0.

## Fast suite totals (`pnpm run test:fast`)

| Run | tests | pass | fail | skipped |
|-----|-------|------|------|---------|
| Before (07-03 end) | 1159 | 1150 | 0 | 9 |
| After Task 2 | 1168 | 1159 | 0 | 9 |
| After Task 3 | 1173 | 1159 | 0 | 14 |

No new failures; the five new skips are the dist tests.

## Deviations from Plan

**1. [Plan premise] `grep -c 'property="article:tag"'` cannot print 2.** Built harness HTML is a single line, so `grep -c` (which counts lines) prints 1 for a page with two tags. Measured with `grep -o ... | wc -l` instead: 2 and 0, as the plan intends. The unit assertion in head-harness.test.mjs counts elements via the head parser (2 and 0).

**2. [Process] The ef4318a comparisons were usable as written.** 07-03 only touched the head of Base.astro and no plan touched the article templates, so ef4318a is still a valid baseline; no previous-plan commit substitution was needed. The templates' diff has zero removed lines.

**3. [Process] REQUIREMENTS.md not touched.** SOC-03 is proven on the harness and by the builder tests, but the two real article templates have not been rendered (no build allowed) and the live scraper validation is 07-08/07-09. `requirements.mark-complete` was not called.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-07-01: section and tags reach markup only through Astro attribute expressions, the same path the 07-03 injection variant covers. T-07-16: one variable (`bylineDatetime`) feeds meta, byline and JSON-LD; the harness asserts meta equals the body `<time datetime>`, and the dist test asserts equality with JSON-LD on real pages once a build exists. T-07-17: author URLs are pinned by unit and harness tests.

## Not verified

- The two real article templates were never rendered: they need the D1 loaders, which a full build runs and which write production KV. Their wiring is proven only through the harness rendering Base.astro with the same props shape, plus the diff showing a single added attribute each.
- `tests/unit/share-meta-dist.test.mjs` assertions have never executed (all five skip against the stale 2026-10-04 dist), so its selectors (article discovery, JSON-LD parsing, `<time>` lookup, ES twin path) are untested against real output. I checked the JSON-LD key names (`datePublished`, `dateModified`, `articleSection`) against `src/lib/structured-data.ts` only.
- No typecheck or `astro check` of the .astro files (forbidden); no dev server, browser or real scraper.
- Page weight of the extra article tags was not measured.

## Cleanup needed

None. (`tests/fixtures/head-harness/.astro/determinism-copy/` is git-ignored build output left by the determinism test; delete at will.)

## Self-Check: PASSED

- FOUND: src/lib/share-meta.ts, src/layouts/Base.astro, tests/unit/share-meta-dist.test.mjs, tests/helpers/dist-fresh.mjs
- FOUND commits: 78f5dd9, 8ad8218, 5461c9e, a0e4eb0

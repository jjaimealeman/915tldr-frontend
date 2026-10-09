---
phase: 07-imagery-share-cards
plan: 03
subsystem: head-metadata
tags: [share-cards, open-graph, twitter-card, icons, astro, test-harness]
requires: ["07-01", "07-02"]
provides:
  - src/lib/share-meta.ts full shareMetaTags (validated, fixed order, og:locale:alternate on every page)
  - Base.astro icon links (ICON_LINKS) ahead of the share tags
  - head-harness variants en-home, en-self, es-noindex, en-no-description, no-canonical, injection
  - tests/unit/share-meta.test.mjs
affects: [07-04, 07-07, 07-08, 07-09]
tech-stack:
  added: []
  patterns:
    - one pure ordered tag builder rendered by one shared layout block
    - quote-aware element scanner to prove hostile text creates no element
    - double-build head comparison for determinism
key-files:
  created:
    - tests/unit/share-meta.test.mjs
  modified:
    - src/lib/share-meta.ts
    - src/layouts/Base.astro
    - tests/fixtures/head-harness/src/variants.ts
    - tests/unit/head-harness.test.mjs
key-decisions:
  - "fallbackPageUrl strips .html and /index.html: under build.format 'file' Astro.url.pathname includes the extension (measured), so the 404 pages would otherwise get og:url ending in .html"
  - "Injection element check uses a quote-aware tag scanner, not a raw '<script' count, because Astro leaves a literal '<script>' inert inside a quoted content value"
requirements-completed: []
duration: ~12 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 11000
  tasks: 2
  commits: 3
---

# Phase 7 Plan 03: Full share-tag set and icon links Summary

Every page head now carries the three icon links and the full 14-tag og/twitter set (og:title through twitter:image:alt, og:locale:alternate on every page per D-22, no X handle/title/description/image tags), built by one validated pure function and proven on eight head-harness variants including hostile text, noindex, no description, no canonicalPath and a determinism double build.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for the full ordered og/twitter set | 2e039ee | tests/unit/share-meta.test.mjs |
| 1 GREEN | shareMetaTags builds the full ordered set with validation | 34cfc14 | src/lib/share-meta.ts |
| 2 | Icon links in Base.astro, 8 harness variants, full-set assertions | 69b51b7 | src/layouts/Base.astro, src/lib/share-meta.ts, tests/fixtures/head-harness/src/variants.ts, tests/unit/head-harness.test.mjs, tests/unit/share-meta.test.mjs |

Each commit carries its `changelog/` entry and README index row (jja-commit procedure). The public `changelog.json` was not touched (nothing is live until merge).

## Acceptance results (real output)

Task 1:
- RED confirmed failing against the tracer-only builder before commit 2e039ee.
- `node --test tests/unit/share-meta.test.mjs`: 11 pass, 0 fail after GREEN.
- tsc (strict, `--ignoreConfig`) on `src/lib/share-meta.ts`: exit 0.
- `node --test tests/unit/head-harness.test.mjs` after Task 1: 5 pass, 0 fail (07-01 expectations unchanged).

Task 2 (`node --test tests/unit/head-harness.test.mjs tests/unit/share-meta.test.mjs`: 30 pass, 0 fail; harness build ~0.9 s):
- `grep -c 'name="twitter:card" content="summary_large_image"' .../dist/es-noindex.html` printed `1`.
- `grep -c 'property="og:locale:alternate" content="es_US"' .../dist/en-self.html` printed `1`; `grep -l 'property="og:locale:alternate"' dist/*.html | wc -l` printed `8`, equal to `ls dist/*.html | wc -l` = `8`.
- `grep -o '<meta property="og:url" content="[^"]*"' .../dist/no-canonical.html` printed `<meta property="og:url" content="https://915tldr.com/no-canonical"`.
- `grep -c 'rel="apple-touch-icon" href="/apple-touch-icon.png"' .../dist/en-home.html` printed `1`.
- Body-region diff against ef4318a (`sed -n '/<body data-page/,$p'`) exit 0. This plan only edits the head, and 07-01 did too, so the literal ef4318a comparison holds here (no deviation needed for this check).
- Injection variant raw attribute: `<meta property="og:title" content="Quote &quot; &amp; <script>alert(1)</script> — 915 TLDR"`. Quote and ampersand are entities, the literal `<script>` stays inert inside the quoted value, and the element sequence of the injection head equals en-listing's.
- `pnpm run guard:config`: exit 0 (`[assert-share-origin] ok`).

## Fast suite totals (`pnpm run test:fast`)

| Run | tests | pass | fail | skipped |
|-----|-------|------|------|---------|
| Before (07-02 end) | 1134 | 1125 | 0 | 9 |
| After Task 1 GREEN | 1145 | 1136 | 0 | 9 |
| After Task 2 | 1159 | 1150 | 0 | 9 |

No new failures.

## Deviations from Plan

**1. [Rule 1 - Bug] fallbackPageUrl returned `.html` URLs.** The plan expects the no-canonical variant's og:url to be `https://915tldr.com/no-canonical`. First run gave `https://915tldr.com/no-canonical.html`: under `build.format: 'file'` (the root config and the harness) Astro's `Astro.url.pathname` carries the extension. The real consumers are `src/pages/404.astro` and `src/pages/es/404.astro`, the only pages without `canonicalPath`, which would have shipped og:url `.../404.html`. Fix in `fallbackPageUrl`: strip `/index.html` to its directory and a trailing `.html`; four unit cases added. Not measured on the real 404 pages (no production build allowed); measured on the harness, which mirrors the root `build.format`. Commit 69b51b7.

**2. [Plan premise] "number of `<script` openings equals en-listing's" cannot pass as written.** The literal `<script>` in the hostile title remains verbatim inside the quoted `og:title` content (plan test (e) itself notes `<`/`>` stay literal), so a raw substring count was 4 versus 3. Replaced with a quote-aware tag scanner that compares the whole element-name sequence of the injection head to en-listing's, plus the script-element count. This is stricter than the plan's check, not weaker. Commit 69b51b7.

**3. [Process] REQUIREMENTS.md not touched.** Frontmatter lists SOC-01, SOC-02, SOC-04, but they are proven only on the harness: article tags are 07-04 and live scraper validation is 07-08/07-09. `requirements.mark-complete` was not called.

**4. [Process] Slip, corrected before commit.** While editing `fallbackPageUrl` a scripted replace also removed the validation helpers (`ALTERNATE_MODES`, `requireText`, `requireHttpsUrl`); 27 tests went red, I restored the helpers, and the committed state is the full 30-pass state.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-07-01 holds: values reach markup only through Astro attribute expressions; the injection variant asserts entity escaping, no new element and an exact decoded round trip. T-07-09: og:url is the canonical href or a site-origin path, asserted never equal to the og:image origin. T-07-10: all 8 heads byte-identical across two builds.

## Not verified

- No full `pnpm build`, typecheck or `astro check` (forbidden or out of scope); Base.astro changes are exercised through the harness, which renders the real layout.
- The real 404 pages' og:url was not observed in a real build; the `.html` stripping is shown on the harness (same `build.format`) and by unit tests.
- No dev server, no browser, no real scraper or validator (07-08/07-09).
- X falling back from og:* to its own title/description/image is documented behaviour, not measured.
- The page-weight increase (UI-SPEC estimate 1.2-1.6 KB) was not measured; 07-08 measures a live page.
- Icon files exist (harness test g) but their rendering in browser tabs was not looked at in this plan.

## Cleanup needed

None. (`tests/fixtures/head-harness/.astro/determinism-copy/` is git-ignored build output left by the determinism test; delete at will.)

## Metadata commit scope

STATE.md and ROADMAP.md are changed by the gsd state and roadmap tools in this step and staged explicitly with this SUMMARY.

## Self-Check: PASSED

- FOUND: src/lib/share-meta.ts, src/layouts/Base.astro, tests/unit/share-meta.test.mjs, tests/unit/head-harness.test.mjs, tests/fixtures/head-harness/src/variants.ts
- FOUND commits: 2e039ee, 34cfc14, 69b51b7

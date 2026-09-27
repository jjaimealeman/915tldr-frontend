# 2026-09-27 - Static 404 page with build-time suggestion index; legacy-route redirects (04-06 Task 3, plan complete)

**Keywords:** [FEATURE] [FRONTEND] [SEO] [SECURITY] [TESTING] [ROUTING]
**Session:** Morning, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0950_04-06-not-found-page-and-redirects.md`

## What Changed

- File: `src/pages/404-index.json.ts` (new)
  - Prerendered `GET` returning the `NOT_FOUND_INDEX_COUNT` (500) newest public articles as
    compact `{ t: title, p: path }` objects, sorted newest-first with a uuid-ascending tiebreak
    (reimplemented inline, not imported from `src/lib/listing.ts`, per the plan's own instruction
    to keep this task independent of 04-05's parallel work). Reads the same in-memory Content
    Layer collection every other page reads — no D1, no KV, same-build guarantee.
- File: `src/pages/404.astro` (new)
  - `<Base page="404" noindex>` with a heading, one sentence, a static "Recent stories" list (10
    newest articles as compact `ArticleCard`s — useful with JavaScript off), and an initially
    `hidden` `section[data-404-suggestions][aria-live="polite"]`.
  - A plain inline page script (not a hydrated island, per ISL-08) that tokenizes
    `location.pathname` (drops short/hex-fragment tokens), fetches `/404-index.json`, scores each
    entry by token overlap against its path/title words, and renders the top 5 (score >= 1) via
    `createElement`/`setAttribute`/`textContent` only — matching `design/mockups/index.html`'s
    established DOM-building convention (T-01-58). A fetch/JSON failure leaves the static list as
    the result.
- File: `public/_redirects` (new)
  - D-11/D-12: `/categories`, `/sources`, `/new` -> `/` (301); `/sitemap.xml` ->
    `/sitemap-index.xml` (301, the real sitemap lands in 04-07). `/search` and `/stats`
    deliberately carry no rule (fall through to the 404 page).
- File: `tests/unit/not-found.test.mjs` (new)
  - Against `dist/client`: `404.html` exists/noindex/has >= 1 static card + suggestions section;
    its inline script uses `.textContent` and never an HTML-string sink; `404-index.json` parses,
    is <= 500 entries and <= 100KB, and every path maps to an existing built file in THIS SAME
    build (same-build consistency, the exact guarantee D-10a requires); `_redirects` carries all
    four rules.

## Why

Phase 4 Plan 06, Task 3 (final task, plan complete): unknown URLs need a useful, D1-free 404
(SEO-08) with suggestions that can never point at a page the build didn't also produce; v1's
retired routes need to keep answering something sane (D-11/D-12).

## Issues Encountered

**[Rule 1 - test-authoring fix] `NOT_FOUND_INDEX_COUNT` cannot be imported into a plain
`node --test` file.** `src/pages/404-index.json.ts` imports the `astro:content` virtual module,
which only resolves inside Astro's own Vite build — importing it directly from
`tests/unit/not-found.test.mjs` (a plain Node test file) would throw at import time. Fixed by
duplicating the constant (`500`) as a local `const` in the test file with a comment explaining why,
matching this suite's own established "assert on `dist/client` output, never the source module"
convention (`tests/unit/listing-pages.test.mjs`'s same pattern).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (full real build, includes 404.astro/404-index.json.ts in this
  build's own page count — 59,889 pages vs. 59,888 before); `cmp public/_redirects
  dist/client/_redirects` (byte-identical); `node --test tests/unit/not-found.test.mjs` (4/4
  passing, including the every-path-exists same-build check against all ~500 index entries); full
  `design/tests/unit/**` + `tests/unit/**` regression suite (312/312 passing, no regressions)
- `dist/client/404-index.json` measured at 98,860 bytes (~96.5KB) — under the 100KB ceiling but
  worth monitoring as titles grow; `NOT_FOUND_INDEX_COUNT` is the lever if it needs to shrink
- What wasn't tested: a real live navigate-vs-plain-request comparison against the deployed 404
  page and a live click-through of the suggestion-matching script in a real browser — that's
  04-12's job per the phase plan
- Edge cases: a fetch/JSON failure leaving the static list as-is is implemented (a `.catch()` with
  no fallback logic) but not exercised by an automated test in this task — would require mocking
  `fetch` in a real browser context (Playwright), out of scope for this unit-test-only task per the
  plan's own `<verify>` block

## Next Steps

- [ ] 04-06 (this plan) is complete — all three tasks committed
- [ ] 04-12's live verification should include: both request kinds against a non-canonical article
      URL (navigate vs. plain), the four `_redirects` rules live, and a real-browser pass over the
      404 suggestion script (Playwright, not just static HTML inspection)
- [ ] Re-check `tools/assert-no-d1.mjs`'s KNOWN LIMITATION #2 (Task 2) once Phase 8 adds a real
      on-demand route

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - completes 04-06; D1-free 404 with build-time suggestions, legacy-route
redirects, no regressions

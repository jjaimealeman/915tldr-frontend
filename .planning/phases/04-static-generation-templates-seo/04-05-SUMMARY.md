---
phase: 04-static-generation-templates-seo
plan: 05
subsystem: frontend
tags: [astro, seo, listing-pages, routing, testing, tdd]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-01's Content Layer loader/collection + article-url helpers, 04-02's Base layout, ArticleCard and structured-data modules, 04-04's full article template (category/[slug].astro) that this plan's category pages sit beside"
provides:
  - "src/lib/listing.ts — compareNewestFirst()/sortNewestFirst(), groupByCategory() (all 8 CATEGORIES keys incl. empty), groupByTag(), groupBySource(), tagIndex(), assertNoRouteCollisions()/RESERVED_TOP_LEVEL, and the page-count constants (CATEGORY_PAGE_COUNT/TAG_PAGE_COUNT/SOURCE_PAGE_COUNT=30, TAGS_INDEX_COUNT=100, HOME_FEED_COUNT=7) every listing page draws from"
  - "src/lib/article-url.ts's TAG_SLUG_RE (T-04-18)"
  - "Real routes: / (home), /<category> x8 (FIX-04, coexisting with /<category>/** article pages), /tag/<slug> (one per tag with a public article), /tags (top 100, A-Z grouped), /source/<slug> (3 fixed sources)"
affects: [04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 11150
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A frontmatter-local top-level const/function referenced only from getStaticPaths() can be silently dropped by Astro 7.3.3's bundler (same class as 03-01's slugify() bug) — the fix is always the same: extract to a real .ts module and import it, never declare it inline in the .astro frontmatter"
    - "groupByCategory() pre-populates all 8 fixed category slugs as Map keys (including explicit empty arrays) so a zero-article category still gets a real page with an empty-state message, never a missing route or a 404"
    - "A build-time log line + a gitignored .astro/*.json scratch file lets a post-build test cross-check a getStaticPaths route's own authoritative count against the built file count, without re-deriving the count independently and risking two wrong-but-agreeing numbers"

key-files:
  created:
    - src/lib/listing.ts
    - src/pages/index.astro
    - src/pages/[category]/index.astro
    - src/pages/tag/[slug].astro
    - src/pages/tags.astro
    - src/pages/source/[slug].astro
    - tests/unit/listing.test.mjs
    - tests/unit/listing-pages.test.mjs
  modified:
    - src/lib/article-url.ts

key-decisions:
  - "Category masthead omits the mockup's decorative data-category-description subtitle (e.g. 'Economy, development, jobs') — no category-description field exists anywhere in the data model (src/lib/categories.ts is slug+name only) and no plan artifact specified one; fabricating copy not backed by any real source was rejected in favor of omitting it. Flagged for owner review if that subtitle is wanted later (would need a new CATEGORIES field or a D1 source)."
  - "HOME_FEED_COUNT=7 counted directly from design/mockups/index.html's no-JS feed state (1 lead + 6 grid cards between the feed:start/feed:end markers), cited in a code comment rather than assumed"
  - "TAG_SLUG_RE moved into src/lib/article-url.ts rather than declared inline in tag/[slug].astro's frontmatter, after the inline version was silently dropped by the bundler (see Deviations) — matches this project's established fix pattern from 03-01's slugify() bug"

requirements-completed: [REND-04, FIX-04]

coverage:
  - id: D1
    description: "One tested, deterministic selection module (src/lib/listing.ts) backs every listing page: newest-first sort with a uuid tiebreak, category/tag/source grouping, a count-sorted tag index, and a route-collision guard that fails the build if a category slug ever collided with a reserved top-level route"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing.test.mjs (15 tests, TDD RED/GREEN pair)"
        status: pass
    human_judgment: false
  - id: D2
    description: "/ renders the approved homepage with the newest public stories (HOME_FEED_COUNT=7, lead + grid) from the build's loader data, newest-first, canonical https://915tldr.com/"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#listing-pages: index.html exists with HOME_FEED_COUNT cards, newest-first, canonical https://915tldr.com/"
        status: pass
    human_judgment: false
  - id: D3
    description: "/crime answers with the Crime category index (dist/client/crime.html) while /crime/<slug>-<uuid> article pages resolve beside it — the same holds for all 8 categories (FIX-04); each category page shows its own aria-current nav state, ≤30 cards newest-first, and the correct canonical"
    requirement: "FIX-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#listing-pages: each of the 8 category indexes exists with the right nav/card/canonical shape (8 sub-tests, one per category)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every tag carried by at least one public article has a page at /tag/<slug> listing up to 30 of its newest stories; /tags lists the 100 most-used tags grouped A-Z; a tag with zero public articles gets no page"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#listing-pages: dist/client/tag/*.html count matches the build-time authoritative tag count (exact-count cross-check + 200-article sample subset check); #listing-pages: a sampled tag page lists at most TAG_PAGE_COUNT cards, newest first; #listing-pages: dist/client/tags.html has at most TAGS_INDEX_COUNT tag links"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each of the 3 sources has a page at /source/<slug> listing up to 30 of its newest stories (v1 parity)"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#listing-pages: dist/client/source/ holds exactly 3 files"
        status: pass
    human_judgment: false
  - id: D6
    description: "No two routes emit the same output path — assertNoRouteCollisions runs before any category page generates and throws naming the offending slug if a category slug ever collides with a reserved top-level route name"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing.test.mjs#assertNoRouteCollisions: throws naming the colliding slug; #assertNoRouteCollisions: the 8 real category slugs pass"
        status: pass
    human_judgment: false
  - id: D7
    description: "A category with zero public articles still renders its page with an explicit empty-state message, never a blank grid; every listing sorts newest-first with a uuid tiebreak for deterministic ordering across builds"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/listing.test.mjs#groupByCategory: returns a Map with all 8 CATEGORIES slugs as keys, including empty categories; #compareNewestFirst: equal publishedAt breaks ties by uuid ascending"
        status: pass
    human_judgment: false

duration: ~16min
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 05: Listing Pages — Home, Category, Tag, Tags Index & Source Summary

**Home, the 8 category indexes (with `/crime` coexisting with `/crime/**`), every tag page, `/tags` and the 3 source pages now render real D1 content from one shared, tested selection module — 59,888 total pages built, 59,897 deployed files, well under the 100,000 Workers Static Assets ceiling.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-27T14:45:59Z (prior plan's completion commit)
- **Completed:** 2026-09-27T14:58:07Z
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments

- Built `src/lib/listing.ts` — the single tested, deterministic selection module (sort, group,
  tag index, route-collision guard) every listing page draws from, via a genuine TDD RED/GREEN
  pair (15 tests).
- Built the homepage (`src/pages/index.astro`): a flat, newest-first feed of `HOME_FEED_COUNT`
  (7) cards drawn from the real Content Layer collection, v1's title/description ported verbatim,
  the Phase 8 load-more island's markup deliberately omitted.
- Built all 8 category indexes (`src/pages/[category]/index.astro`, FIX-04): with
  `build.format: 'file'`, `/crime.html` now coexists with the `/crime/` article directory;
  `getStaticPaths` returns all 8 categories regardless of article count (an empty category still
  renders a real page with an explicit empty-state message), and `assertNoRouteCollisions` runs
  before any page generates.
- Built tag pages (`src/pages/tag/[slug].astro`, one per tag with a public article), `/tags`
  (`src/pages/tags.astro`, top 100 tags grouped A-Z), and the 3 source pages
  (`src/pages/source/[slug].astro`) — v1 URL-shape parity throughout.
- Found and fixed a real bundler bug (same class as 03-01's `slugify()` regression): a
  frontmatter-local `TAG_SLUG_RE` const referenced only from `getStaticPaths()` was silently
  dropped by Astro 7.3.3's bundler; fixed by moving it into `src/lib/article-url.ts`.
- Ran a real `pnpm run build` against production D1 twice (before and after the Task 3 fix):
  final build produced 59,888 pages (40,117 home/category/article pages from Task 2's build plus
  19,767 tag pages, `tags.html`, and 3 source pages), 59,897 total deployed files.

## Task Commits

1. **Task 1: Listing selection module (sort, group, tag index, route-collision guard) — test-first**
   (`tdd="true"`) — `88f2efc` (test, RED) → `dabba73` (feat, GREEN)
2. **Task 2: Homepage and the 8 category indexes (FIX-04)** — `80e7c25` (feat)
3. **Task 3: Tag pages, the /tags index and per-source pages** — `7759d8f` (feat, includes the
   `TAG_SLUG_RE` bundler-bug fix)

**Plan metadata:** this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update, committed via
`jja-commit` following this file.

## Files Created/Modified

- `src/lib/listing.ts` (new) — `compareNewestFirst()`, `sortNewestFirst()`, `groupByCategory()`,
  `groupByTag()`, `groupBySource()`, `tagIndex()`, `assertNoRouteCollisions()`,
  `RESERVED_TOP_LEVEL`, `HOME_FEED_COUNT`, `CATEGORY_PAGE_COUNT`, `TAG_PAGE_COUNT`,
  `SOURCE_PAGE_COUNT`, `TAGS_INDEX_COUNT`
- `src/pages/index.astro` (new) — the homepage
- `src/pages/[category]/index.astro` (new) — the 8 category indexes (FIX-04)
- `src/pages/tag/[slug].astro` (new) — tag pages
- `src/pages/tags.astro` (new) — the `/tags` index
- `src/pages/source/[slug].astro` (new) — per-source pages
- `src/lib/article-url.ts` — added `TAG_SLUG_RE`
- `tests/unit/listing.test.mjs` (new) — 15 tests for `src/lib/listing.ts`
- `tests/unit/listing-pages.test.mjs` (new) — 15 tests against real built pages (home, 8
  categories, tag/tags/source)

## Decisions Made

- Category masthead omits the mockup's decorative `data-category-description` subtitle — no data
  source exists for it; see key-decisions above.
- `HOME_FEED_COUNT=7`, cited directly from `design/mockups/index.html`'s no-JS feed state.
- `TAG_SLUG_RE` lives in `src/lib/article-url.ts`, not inline in `tag/[slug].astro`'s frontmatter
  — required by the bundler bug fix (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A frontmatter-local `const TAG_SLUG_RE` was silently dropped by Astro 7.3.3's bundler**
- **Found during:** Task 3, first real build attempt for tag pages
- **Issue:** `tag/[slug].astro` originally declared `const TAG_SLUG_RE = /^[a-z0-9-]+$/;` at the top
  level of its own frontmatter, referenced only inside `getStaticPaths()`. The build failed at
  static-path generation with `ReferenceError: TAG_SLUG_RE is not defined`. Inspecting the compiled
  chunk (`dist/server/.prerender/chunks/_slug__*.mjs`) confirmed the declaration was simply absent
  from output, while every other frontmatter symbol compiled correctly — the exact same bug class
  already documented in `03-01-SUMMARY.md` (a frontmatter-local `slugify()` function dropped under
  the same conditions).
- **Fix:** Moved `TAG_SLUG_RE` into `src/lib/article-url.ts` (the existing home for
  `ARTICLE_SLUG_RE`/`CATEGORY_SLUG_RE`) and imported it normally, matching the established fix
  pattern from the earlier bug.
- **Files modified:** `src/lib/article-url.ts`, `src/pages/tag/[slug].astro`
- **Verification:** A full `pnpm run build` completed cleanly (59,888 pages, ~2m 6s); the built
  `dist/client/tag/*.html` count (19,767) matches `.astro/tag-build-log.json`'s authoritative count
  exactly.
- **Committed in:** `7759d8f` (Task 3 commit)

**2. [Rule 1 - Bug] `src/lib/listing.ts`'s own doc comment tripped the plan's acceptance grep**
- **Found during:** Task 1, first acceptance-criteria check
- **Issue:** The plan's `grep -c "lib/server" src/lib/listing.ts` acceptance grep (expected 0)
  initially returned 1 — the module's own doc comment described the D1-access boundary using the
  literal path substring `src/lib/server/`, the same false-positive class documented in
  04-02-SUMMARY.md's Deviation 3.
- **Fix:** Reworded the comment to describe the same constraint without the literal substring.
- **Files modified:** `src/lib/listing.ts`
- **Verification:** `grep -c "lib/server" src/lib/listing.ts` returns 0; all 15 tests still pass.
- **Committed in:** `dabba73` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — one a real bundler bug, one an acceptance-grep
false positive from comment wording).
**Impact on plan:** Both fixes were necessary for the build/acceptance checks to genuinely pass.
Neither touched application behavior beyond what the plan specified.

## Issues Encountered

None beyond the two Rule 1 fixes documented above.

## Known Stubs

None. Every page built in this plan (home, all 8 categories, every tag page, `/tags`, all 3 source
pages) renders real production D1 content via a real `pnpm run build`, not mock or placeholder
data.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-04-18 tag/source slug
validation, T-04-19 escaping, T-04-20 file-count ceiling, T-04-21 D1 boundary) — no new
security-relevant surface was introduced beyond those four already-tracked items.

## Cleanup needed (run these yourself)

None new from this plan. Carried forward from 04-01/04-02/04-03/04-04, unchanged and untouched (per
this project's own rule — do not restore or stage these):
```
rm /home/jaime/www/_github/915tldr.com/src/lib/slug.ts
rm /home/jaime/www/_github/915tldr.com/src/lib/render-cost-harness.ts
rm /home/jaime/www/_github/915tldr.com/tools/measure-render-cost.mjs
```

## User Setup Required

None — `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` were already present in the shell environment
(carried forward from Phase 3/04-03/04-04), and no new infrastructure was needed for this plan.

## Next Phase Readiness

- Every listing page type PROJECT.md/ROADMAP.md's Phase 4 scope calls for (home, category, tag,
  tags, source) is now real and building against production D1 — later plans in this phase
  (sitemaps, RSS, 404, static pages) can rely on `src/lib/listing.ts`'s grouping/sorting as the
  canonical selection logic rather than re-deriving it.
- T-04-20 (file-count ceiling) is now measured at today's corpus: 59,897 deployed files, ~60% of
  the 100,000 Workers Static Assets ceiling. Phase 5 owns tag tiering and the 80,000-file build
  guard per the threat register's own disposition — this plan did not need either, but the margin
  is worth re-checking as the tag count (currently 19,767) continues to grow with the corpus.
- The category masthead's omitted decorative subtitle (see Decisions) is a candidate for
  04-12's/owner's end-of-phase visual review if that copy is wanted — it would need a new data
  source (a `CATEGORIES` field or a D1 column), which is out of this plan's scope.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

## Self-Check: PASSED

All claimed created files verified present on disk: `src/lib/listing.ts`, `src/pages/index.astro`,
`src/pages/[category]/index.astro`, `src/pages/tag/[slug].astro`, `src/pages/tags.astro`,
`src/pages/source/[slug].astro`, `tests/unit/listing.test.mjs`, `tests/unit/listing-pages.test.mjs`.
`src/lib/article-url.ts`'s `TAG_SLUG_RE` addition confirmed present. All claimed commit hashes
verified present in `git log` (`88f2efc`, `dabba73`, `80e7c25`, `7759d8f`). All verification
commands in this SUMMARY were actually run in this session: `node --test tests/unit/listing.test.mjs`
(15/15), a real `pnpm run build` (twice — 40,117 pages before Task 3's fix, 59,888 after),
`node --test tests/unit/listing-pages.test.mjs` (15/15), the full `design/tests/unit/**` +
`tests/unit/**` suite (287/287), the 6-test D1-import build-gate, and `find dist/client -type f | wc -l` (59,897).

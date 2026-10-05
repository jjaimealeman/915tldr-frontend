# 2026-10-01 - A real reader clicks into archived pages without extra hops

**Keywords:** [TESTING] [FEATURE]
**Session:** Morning, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1055_05-11-real-browser-journeys-into-archived-pages.md`

## What Changed

- File: `tests/helpers/archive-sample.mjs`
  - Added `archivedArticleUuids(plan)` — the full set of archived article uuids, used to confirm
    a tag page's listed article card actually lands on archived content before clicking it (a
    small/old tag does not guarantee every article carrying it is itself archived).
  - Added `archivedTagSlugs(plan)` — the full set of archived tag slugs, used to find a hot
    article whose own rendered tag links include at least one archived tag.
- File: `tests/integration/browser-journeys.test.mjs`
  - Added two live-discovery helpers (`findArchivedTagWithArchivedFirstCard`,
    `findHotArticleWithArchivedTag`) that probe real candidate pages over plain `fetch()`,
    paced under the project's 10 req/s cap, before any Playwright navigation.
  - Added four real-Chromium journeys: (a) open an archived tag page, real-click its first
    article card, land on that archived article's canonical URL with 200/no-redirect and the
    clicked card's own title visible in `<h1>`; (b) open a hot article, real-click one of its
    tag links whose tag is archived, land on the archived tag page with 200/no-redirect and its
    heading visible; (c) navigate directly to an archived article's trailing-slash variant and
    confirm exactly one redirect hop via the browser's own `redirectedFrom()` chain; (d) capture
    320px/1280px screenshots of an archived article for the owner's visual parity check.

## Why

05-11's Task 2 proves REND-08 "by the path readers actually take" (this project's own
verification standard) — a synthetic `fetch()`-based proof (already done in Task 1) is necessary
but not sufficient; a real browser driving real mouse clicks through the archive tier's two entry
points (a tag listing leading into an archived article, an article's own tags leading into an
archived tag) is what actually confirms a reader never hits an extra redirect or a broken page.

## Issues Encountered

No major issues encountered. Discovery required real probing rather than assumption: an archived
tag's own listed articles are not guaranteed to be archived themselves (tag archival tracks the
tag's total lifetime article count; article archival tracks the article's own publish date) —
confirmed live that most small/old tags' first-listed article is still hot, so the discovery
helper checks multiple candidates until it finds a genuinely archived one.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/integration/browser-journeys.test.mjs` — 10/10 pass,
  including all four new 05-11 journeys, against the real deployed Chromium-driven
  dev.915tldr.com.
- What wasn't tested: criterion-2 R2 latency/LCP measurement (05-11 Task 3, still pending).
- Edge cases: the archived-article screenshot was visually reviewed (320px and 1280px) and is
  indistinguishable from a static article page — same layout, same "More in Business"/"Earlier"
  rail, same tag links, same footer.

## Next Steps

- [ ] 05-11 Task 3: measure R2 latency (p50/p95) and archived-page LCP against the 1.5s budget

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - test-only changes; no production runtime code touched.

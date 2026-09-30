---
phase: 04-static-generation-templates-seo
plan: 04
subsystem: article-template-seo
tags: [astro, structured-data, seo, trust-surface, rail, tdd]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-01's Content Layer loader/collection + article-url helpers, 04-02's Base layout, ArticleCard, structured-data and format modules, 04-03's full cold/warm/sweep loader and real production data"
provides:
  - "src/lib/summary.ts — splitStandfirst() (Phase 1 D-10 standfirst deck via Intl.Segmenter + abbreviation-merge), summaryBodyHtml() (single-escaper summary rendering through design/scripts/lib/summary-markdown.mjs)"
  - "src/lib/rail.ts — computeRails() (owner-selected article-relative rail, one pass over the collection), railFingerprint()"
  - "The full approved article template on src/pages/[category]/[slug].astro: byline, standfirst, summary body, AI disclosure, outlet attribution, tags, rail, canonical, NewsArticle + BreadcrumbList JSON-LD, stamp=\"commit\", layout=\"with-rail\""
affects: [04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

# Actuals (#2632)
actuals:
  tokens: 42000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Intl.Segmenter('en-u-ss-standard', {granularity:'sentence'}) for standfirst splitting, corrected with an explicit non-terminal-abbreviation merge list (ICU has no abbreviation dictionary of its own)"
    - "summaryBodyHtml never re-escapes text itself — design/scripts/lib/summary-markdown.mjs's renderSummaryHtml is the single escaping path (T-04-14), enforced by the plan's own grep acceptance criteria"
    - "computeRails sorts the whole collection once (publishedAt desc, uuid asc tie-break), groups by category preserving that order, then slices bounded windows per article — O(n) over the corpus, not O(n^2)"
    - "Article rail is article-relative (owner decision, option-a), not build-clock-relative — an unchanged article's neighbours never change unless a neighbour itself changes, which is what makes criterion 3 hold"

key-files:
  created:
    - src/lib/summary.ts
    - src/lib/rail.ts
    - tests/unit/summary.test.mjs
    - tests/unit/rail.test.mjs
    - tests/unit/article-markup.test.mjs
  modified:
    - src/pages/[category]/[slug].astro
    - tests/unit/build-stamp.test.mjs
    - tests/unit/chrome.test.mjs

key-decisions:
  - "Task 1 checkpoint (owner, 2026-09-26): option-a, the article-relative rail — \"More in <Category>\" = 3 same-category stories published immediately before this one; second group (heading \"Earlier\") = 5 site-wide stories immediately before this one. Chosen specifically because it keeps unchanged articles byte-identical (criterion 3), unlike the approved mockup's true \"Latest\" (option-b, rejected) or a client-JS overlay (option-c, not built)."
  - "latest.json.ts intentionally NOT created — that file is option-c-only per the plan, and option-a was selected."
  - "Rule 1 fix (chrome.test.mjs): the pre-existing Organization/WebSite JSON-LD count assertion used a raw substring match that also matched NewsArticle.isBasedOn.publisher's nested \"@type\":\"Organization\" object one level down — a real false-positive risk now that every article page emits a NewsArticle. Fixed to parse each <script> block and check its own top-level @type."

requirements-completed: [IDNT-03, IDNT-04, SEO-07, SEO-01, SEO-02, SEO-04]

coverage:
  - id: D1
    description: "Standfirst split and summary body rendering are pure, tested functions matching the approved mockup's exact standfirst/body pair, with render-time escaping as the only escaping path"
    requirement: "IDNT-03, IDNT-04"
    verification:
      - kind: unit
        ref: "tests/unit/summary.test.mjs (12 tests: mockup pair, 5 abbreviation non-breaks, one-sentence case, empty input, inline Key Details, keyPoints append, null keyPoints, inline-wins-over-keyPoints)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeRails implements the owner-selected article-relative rail (option-a) in one O(n) pass, correctly bounding more/second at moreCount/secondCount, empty for the oldest article, deterministic tie-break; railFingerprint reacts to any neighbour field change"
    requirement: "REND-05 (criterion 3 prerequisite)"
    verification:
      - kind: unit
        ref: "tests/unit/rail.test.mjs (12 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every sampled built article page carries exactly one AI disclosure and one attribution inside the article, agreeing outlet names, matching hrefs equal to NewsArticle.isBasedOn.url, correct document order, one canonical/NewsArticle/BreadcrumbList each, no Person node, keywords omitted when untagged, and every time[datetime] ends in a real Mountain-Time offset"
    requirement: "IDNT-03, IDNT-04, SEO-01, SEO-02, SEO-04, SEO-07"
    verification:
      - kind: unit
        ref: "tests/unit/article-markup.test.mjs (25 evenly-sampled article files against a real pnpm build)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Article pages render data-stamp=\"commit\" and a footer date equal to version.json's committedAt (never builtAt) — required so the footer doesn't drift on every unchanged rebuild"
    requirement: "REND-05 (criterion 3 prerequisite)"
    verification:
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: an article page carries data-stamp=\"commit\" and its footer date matches version.json's committedAt"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unchanged article re-renders byte-identically across two consecutive real builds against production D1/KV (criterion 3), empirically measured across the entire corpus, not sampled"
    requirement: "REND-05"
    verification:
      - kind: other
        ref: "Two consecutive `pnpm run build` runs (this continuation session), diffed by byte-equality over every built article HTML file: 40,108 files present in both builds, 40,108 byte-identical, 0 differing, 0 added/removed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The build-time D1-import structural gate is unaffected by this plan's new pure modules (summary.ts, rail.ts import no lib/server module)"
    requirement: "ARCH-02/03 (carried gate)"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs (6/6 pass)"
        status: pass
    human_judgment: false

duration: ~35min (continuation session; original session's task work already committed)
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 04: Full Article Template — Disclosure, Attribution, Rail & Structured Data Summary

**Every article page now renders the full approved trust surface (AI disclosure, outlet attribution), NewsArticle + BreadcrumbList structured data, and an article-relative rail (owner-selected option-a) — empirically proven byte-identical across two full real builds of all 40,108 articles.**

## Continuation Note

This plan was executed by a prior session that committed all three tasks (RED tests, GREEN
implementation, full template port) before being killed by an API rate limit, immediately before
running final verification. This session did not redo any committed work — it read the plan and
diffed the three existing commits against every acceptance criterion and `<verify>` step, ran the
full test suite against a real build, and then ran the byte-identity check the prior session's last
action had started but not finished. No code changes were needed; verification found the prior
session's work correct and complete as committed.

## Owner Decision (Task 1 checkpoint)

Recorded here as owner-selected, per the prior session's handoff: on 2026-09-26 the owner (Jaime)
selected **option-a, the article-relative rail** — "More in `<Category>`" holds the 3 same-category
stories published immediately before the article; a second group, headed "Earlier" (not the
mockup's "Latest"), holds the 5 site-wide stories published immediately before it. Pure static
HTML, no JS. Chosen specifically because option-b (the approved mockup's literal "Latest") bakes
the newest site-wide stories into all ~40,000 pages, changing every page on every 2-hourly build and
defeating criterion 3 and REND-05; option-c (a client-JS overlay) was available but not selected.
`src/pages/latest.json.ts` was correctly NOT created, since that file only exists for option-c.

## Performance

- **Duration:** ~35 min this continuation session (task work itself: ~40 min in the original
  session, per its own changelog entries)
- **Tasks:** 3 (all previously committed; this session verified only)
- **Files modified:** 8 (5 created, 3 modified) — see Files Created/Modified

## Accomplishments

- Verified `src/lib/summary.ts`'s `splitStandfirst()` against the approved mockup's exact
  standfirst/body pair plus 5 known non-terminal-abbreviation cases (`Dr.`, `St.`, `a.m.`/`p.m.`,
  `Sept.`, `No.`), and `summaryBodyHtml()`'s single-escaper contract (`renderSummaryHtml` is the
  only escaping path; `grep -c "replace(/&/g" src/lib/summary.ts` returns 0).
- Verified `src/lib/rail.ts`'s `computeRails()` implements the owner's option-a decision in one
  O(n) pass with the correct sort/tie-break and bounded per-group slicing, and `railFingerprint()`
  reacts to every neighbour-field change tested.
- Ran a real `pnpm run build` (40,108 pages, ~1m 48s) against real production D1/KV (warm mode,
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` already in the shell environment) and confirmed
  all 48 tests in `article-markup.test.mjs` + `build-stamp.test.mjs` + `chrome.test.mjs` pass, plus
  the full 257-test `pnpm run test:fast` suite and the 6-test `pnpm run test:build-gate` D1-import
  structural gate.
- **Empirically measured byte-identity (criterion 3) across the whole corpus, not a sample:** built
  twice in a row against unchanged production data, saved the first build's `dist/client` output,
  compared every one of the 40,108 built article HTML files byte-for-byte against the second build.
  Result: 40,108/40,108 identical, 0 differing, 0 files added or removed between builds. This is the
  strongest form of criterion 3 verification available short of running the real cron pipeline.

## Task Commits

All three tasks were committed in the original (interrupted) session:

1. **Task 1: Owner checkpoint decision** — no code commit (decision recorded above; resolved
   2026-09-26, relayed to this continuation via the orchestrator's handoff, not re-solicited)
2. **Task 2: Standfirst split, summary body, rail selection** (`tdd="true"`) — `f47f99d` (test, RED)
   then `7c6d7ad` (feat, GREEN)
3. **Task 3: Full article template port** — `05ddc01` (feat)

**Plan metadata:** this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update, committed via
`jja-commit` following this file.

## Files Created/Modified

- `src/lib/summary.ts` (new) — `splitStandfirst()`, `summaryBodyHtml()`
- `src/lib/rail.ts` (new) — `computeRails()`, `railFingerprint()`
- `tests/unit/summary.test.mjs`, `tests/unit/rail.test.mjs` (new) — 24 tests total
- `src/pages/[category]/[slug].astro` — full template port: byline, standfirst, summary body via
  `set:html`, AI disclosure, outlet attribution, tags section, article-relative rail (two grid
  groups via `ArticleCard variant="compact"`), canonical, `newsArticleNode`/`breadcrumbNode` wired
  into `Base`'s `jsonLd`, `stamp="commit"`, `layout="with-rail"`
- `tests/unit/article-markup.test.mjs` (new) — 1 outer test, 25 evenly-sampled per-file subtests
- `tests/unit/build-stamp.test.mjs` — footer-date cross-surface test updated for
  `stamp="commit"`/`committedAt` (article pages no longer use the default build-timestamp mode)
- `tests/unit/chrome.test.mjs` — Organization/WebSite JSON-LD count assertion fixed (see
  Deviations)

## Decisions Made

- Owner: article-relative rail, option-a (see Owner Decision above).
- `latest.json.ts` not created — option-c-only, not the selected option.
- Rail's second-group heading is "Earlier" (not the mockup's "Latest") — the direct, disclosed
  consequence of the owner's option-a selection.

## Deviations from Plan

### Auto-fixed Issues (found and fixed in the original session, verified here)

**1. [Rule 1 - Bug] `chrome.test.mjs`'s Organization/WebSite JSON-LD count used a substring match
that also matched a nested node**
- **Found during:** Task 3, first real build with a `NewsArticle` node present on article pages
- **Issue:** The pre-existing test filtered JSON-LD `<script>` blocks with
  `.includes('"@type":"Organization"')`. `NewsArticle.isBasedOn.publisher` is itself a real,
  distinct Organization object nested one level down (naming the original outlet, not 915 TLDR) —
  the raw substring match counted it as a second site-wide Organization block, which it is not.
- **Fix:** Parse each script's JSON and filter on the node's own top-level `@type`.
- **Files modified:** `tests/unit/chrome.test.mjs`
- **Verification (this session):** `node --test tests/unit/chrome.test.mjs` — `chrome: exactly one
  Organization and one WebSite JSON-LD script block` passes against the real built pages.
- **Committed in:** `05ddc01` (Task 3 commit)

No other deviations. This continuation session made no code changes — every acceptance criterion,
grep check, and `<verify>` command in the plan passed against the already-committed work without
modification.

## Issues Encountered

None. The prior session's work was complete and correct; this session's only job was verification,
which passed cleanly on the first attempt (build, 48-test template suite, 257-test full suite,
6-test build-gate, and the two-build byte-identity diff).

## Known Stubs

None. Every module and every article page path exercised in this plan (disclosure, attribution,
tags, rail, structured data, canonical) is real, production-verified code, run against real
production D1 data via a real `pnpm run build`, not a mock or placeholder.

## Cleanup needed (run these yourself)

None new from this plan. Carried forward from 04-01/04-02/04-03, unchanged and untouched (per this
project's own rule — do not restore or stage these):
```
rm /home/jaime/www/_github/915tldr.com/src/lib/slug.ts
rm /home/jaime/www/_github/915tldr.com/src/lib/render-cost-harness.ts
rm /home/jaime/www/_github/915tldr.com/tools/measure-render-cost.mjs
```

## User Setup Required

None — `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` were already present in the shell environment
(carried forward from Phase 3/04-03), and no new infrastructure was needed for this plan.

## Next Phase Readiness

- Every article page in the full 40,108-article corpus now carries the complete IDNT-03/04 and
  SEO-01/02/04/07 trust-and-structured-data surface — later Phase 4 plans (tag pages, source pages,
  sitemaps, RSS) can rely on this as the canonical article shape.
- Criterion 3 (byte-identical unchanged articles) is now empirically proven at full-corpus scale,
  not just asserted — later plans that touch the rail, the footer stamp, or the summary renderer
  should re-run this same two-build diff if they change any of those three inputs.
- The owner's rail decision (option-a, "Earlier" heading) is a permanent, disclosed departure from
  design/mockups/article.html's literal "Latest" — any future visual QA pass (e.g. 04-12) should
  check against this plan's decision, not the raw mockup file.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

## Self-Check: PASSED

All claimed files verified present on disk: `src/lib/summary.ts`, `src/lib/rail.ts`,
`tests/unit/summary.test.mjs`, `tests/unit/rail.test.mjs`, `tests/unit/article-markup.test.mjs`,
`src/pages/[category]/[slug].astro`, `tests/unit/build-stamp.test.mjs`, `tests/unit/chrome.test.mjs`.
`src/pages/latest.json.ts` confirmed absent (correct — option-a, not option-c). All claimed commit
hashes verified present in `git log` (`f47f99d`, `7c6d7ad`, `05ddc01`). All verification commands in
this SUMMARY were actually run in this session, not assumed: `node --test
tests/unit/summary.test.mjs tests/unit/rail.test.mjs` (24/24 pass), `pnpm run build` (40,108 pages,
twice), `node --test tests/unit/article-markup.test.mjs tests/unit/build-stamp.test.mjs
tests/unit/chrome.test.mjs` (48/48 pass), `node --test "design/tests/unit/**/*.test.mjs"
"tests/unit/**/*.test.mjs"` (257/257 pass), `node --test tests/ci-fixtures/assert-no-d1.test.mjs`
(6/6 pass), and the two-build byte-identity diff (40,108/40,108 identical).

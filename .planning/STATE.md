---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: milestone
current_phase: 04
current_phase_name: Static Generation, Templates & SEO
status: executing
stopped_at: Completed 04-11-PLAN.md
last_updated: "2026-09-30T22:01:37.703Z"
last_activity: 2026-09-26
last_activity_desc: Phase 03 complete, transitioned to Phase 4
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 52
  completed_plans: 51
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-16)

**Core value:** Zero D1 reads on the public request path — architecturally zero, enforced structurally at build time.
**Current focus:** Phase 04 — Static Generation, Templates & SEO

## Current Position

Phase: 04 (Static Generation, Templates & SEO) — EXECUTING
Plan: 12 of 12
Status: Ready to execute
Last activity: 2026-09-26 — Phase 04 execution started

Progress: [██████████] 98%

## Performance Metrics

**Velocity:**

- Total plans completed: 41
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 23 | - | - |
| 02 | 11 | - | - |
| 03 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 20min | 3 tasks | 14 files |
| Phase 01 P02 | 50min | 2 tasks | 23 files |
| Phase 01 P03 | 71min | 3 tasks | 16 files |
| Phase 01 P04 | 20min | 2 tasks | 6 files |
| Phase 01 P05 | 40min | 2 tasks | 18 files |
| Phase 01 P06 | 155min | 2 tasks | 4 files |
| Phase 01 P07 | 55min | 3 tasks | 5 files |
| Phase 01 P08 | 55min | 3 tasks | 6 files |
| Phase 01 P09 | 45min | 2 tasks | 8 files |
| Phase 01 P11 | 55min | 3 tasks | 12 files |
| Phase 01 P12 | 8min | 2 tasks | 2 files |
| Phase 01 P13 | 76min | 3 tasks | 12 files |
| Phase 01 P14 | 25min | 3 tasks | 15 files |
| Phase 01 P15 | 35min | 2 tasks | 4 files |
| Phase 01 P16 | 35min | 2 tasks | 15 files |
| Phase 01 P17 | 32min | 3 tasks | 9 files |
| Phase 01 P18 | 35min | 3 tasks | 10 files |
| Phase 01 P19 | 25min | 2 tasks | 21 files |
| Phase 01 P20 | 11min | 2 tasks | 34 files |
| Phase 01 P21 | 35min | 3 tasks | 20 files |
| Phase 01 P22 | 19min | 3 tasks | 8 files |
| Phase 02 P04 | 131min | 3 tasks | 13 files |
| Phase 03 P01 | ~10min (continuation) | 2 tasks | 19 files |
| Phase 03 P02 | 16min | 3 tasks | 12 files |
| Phase 03 P03 | ~50min | 3 tasks | 6 files |
| Phase 03 P04 | ~35min | 2 tasks | 5 files |
| Phase 03 P05 | ~65min | 3 tasks | 5 files |
| Phase 03 P06 | 135min | 3 tasks | 17 files |
| Phase 03 P07 | ~30min | 2 tasks | 2 files |
| Phase 04 P01 | ~25min | 3 tasks | 17 files |
| Phase 04 P02 | ~15min | 2 tasks | 11 files |
| Phase 04 P03 | 43min | 3 tasks | 15 files |
| Phase 04 P04 | ~35min (continuation) | 3 tasks | 8 files |
| Phase 04 P05 | ~16min | 3 tasks | 9 files |
| Phase 04 P06 | 30min | 3 tasks | 14 files |
| Phase 04 P07 | 21min | 3 tasks | 10 files |
| Phase 04 P08 | ~90min | 3 tasks | 12 files |
| Phase 04 P09 | ~3h10min | 3 tasks | 10 files |
| Phase 04 P10 | ~2h45min (active, spanning two sessions) | 2 tasks | 6 files |
| Phase 04 P11 | ~25min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Content quality moved to Phase 2 — ahead of all bilingual generation, so no fabricated advisory is ever written in Spanish and then paid for twice.
- Roadmap: The CI D1-import assertion (ARCH-02/03) sits in Phase 3 Foundation as structural prevention, extended to island files in Phase 8.
- Roadmap: Loader fail-loud assertion (REND-02/03) ships in the same phase as the loader itself (Phase 4). This project already shipped the bug it prevents.
- Roadmap: Phase 5 is the premise gate — a non-zero D1 read on the public path halts the project for architecture review rather than being logged as a defect.
- Roadmap: The grounding check (CONT-04/05) ships with the prompt rewrite (CONT-03) because the costed dry run (CONT-09) depends on it.
- [Phase 01]: Owner approved all 8 pinned packages/images exactly as proposed; no substitutions needed.
- [Phase 01]: Native WebKit launch fails on this Arch machine as anticipated; Docker fallback (mcr.microsoft.com/playwright:v1.63.0-noble) proven, WebKit 26.6.
- [Phase 01]: Task 3 TDD gate executed as two real commits (test then feat), not one combined commit.
- [Phase ?]: [Phase 01]: Font-swap CLS measured via network-level font hold, not document.fonts FontFace status, since the latter behaves inconsistently across engines under a held request.
- [Phase ?]: [Phase 01]: This Playwright-WebKit build (26.6) never composites while a font resource is pending, regardless of font-display:swap — measureFontSwap reports prePaintObserved:false honestly rather than a fabricated number; flagged for a real-Safari spot-check before 01-APPROVAL.md.
- [Phase ?]: Phase 01: Three photo-sampled category hue pairs (crime/sports, business/health, politics/weather) were too close together for the 0.05 minimum OKLab distance; resolved by raising block/vivid-dark chroma to 0.150 plus small documented +-4 to +-6deg hueOffsets, found via brute-force search.
- [Phase ?]: Phase 01: politics' palette photo substitutes a Santa Fe, NM dusk sky for the literal Franklin Mountains/El Paso skyline -- genuine full-darkness El Paso night photos measured near-zero chroma. Flagged for owner review, not hidden.
- [Phase ?]: 01-04: card-headline/card-summary/worst-case source from D-06 rows that turned out to be genuine Spanish-original wire content, not English — es_real recorded identical to en with a note rather than fabricating a translation.
- [Phase ?]: 01-04: skip-link's real translation changed from a literal 'Saltar al contenido' (no diacritics) to 'Saltar la navegación' — a natural, functionally-equivalent a11y phrasing that carries a diacritic and fits the calibration script's width band.
- [Phase ?]: 01-05: coverage rule implemented as union-find over pure var() alias edges, not a hand-written list — one structure covers both directions the plan's coverage examples describe.
- [Phase ?]: 01-05: fixed a pre-existing (01-02) check-contrast.mjs CLI bug — parseArgs only accepted --flag=value, not the documented --flag value form, which silently invalidated every fixture-based test until fixed.
- [Phase ?]: [Phase 01] 01-06: D-06/D-07 stress cards merged into the home grid's true reverse-chronological order (by real published_at), not appended as a separate block — required by D-12's 'no per-category sections' read literally.
- [Phase ?]: [Phase 01] 01-06: root-caused a WebKit font-swap CLS gate failure to the pinned Docker test image lacking Georgia/Noto Serif (fc-list confirmed only Liberation family installed) rather than weakening the CLS threshold; flagged non-blocking in WINDOWS.md for owner review, real devices commonly have these fonts.
- [Phase ?]: 01-07: A pre-existing structural test requires a populated [data-grid] on every mockup page; changelog.html and contact.html each got a Latest Stories grid to satisfy it (Rule 2).
- [Phase ?]: 01-07: main > article's margin:auto against a ch-unit max-width was a real font-swap CLS bug (centering shifts the left edge when ch's pixel value changes on swap) — fixed by left-anchoring instead of centering.
- [Phase ?]: 01-07: Two criterion-5 findings (WebKit on article.html, Chromium native-CLS on changelog.html) were investigated to a specific root cause and recorded in WINDOWS.md rather than force-fixed or dismissed.
- [Phase ?]: 01-08: WebKit's focus-triggered scrollIntoView leaves a tall field mostly off-screen on focus (stops as soon as any part clears the viewport edge, unlike Chromium); fixed globally with scroll-padding-block-end: 12rem on html, not by weakening the test.
- [Phase ?]: 01-08: category.html's D-01 masthead header was a body-level sibling of main, computing to a duplicate banner ARIA landmark; moved inside main (matching article.html's pattern), full-bleed look restored with a scoped negative margin.
- [Phase ?]: 01-08: content.spec.ts's fixture-uuid lookup must prefer the real-row shape (has a status field) over a same-uuid bare image-candidate record found earlier in stress-set.json's object-traversal order.
- [Phase ?]: 01-09: Split Task 2's geometry.ts work into a standalone bug-fix commit (fragment-based CLS measurement, entry 8) and a separate feature-extension commit (swap-matrix), via targeted git add -p hunk staging.
- [Phase ?]: 01-09: Criterion 5 (font-swap CLS) genuinely fails once scroll=mid is measured on all five pages, both engines — root cause is capsize size-adjust's inability to guarantee identical line-wrap points between substituted typefaces, inherent to font-display:swap (PRD-locked). No CSS fix attempted; left as an explicit owner decision (Rule 4) rather than threshold-weakened.
- [Phase ?]: 01-11: D-GAP-D closed — pnpm is the sole package manager; pw.mjs launches the local Playwright CLI directly via node (no package runner) in all three launch paths; pnpm-lock.yaml verified 16/16 identical to package-lock.json
- [Phase ?]: 01-11: 01-10-SUMMARY.md written retroactively — Phase 1 round 1 ended on outcome: revise (owner review 2026-09-17), not approved; 14-item closure table maps to gap plans 01-11..01-23
- [Phase ?]: 01-12: parseGroup explicitly splits a lone **Key Details:** header line from preceding prose when both share one blank-line-delimited group (no blank line between them) — needed because the generic space-join rule would otherwise merge them into one paragraph
- [Phase ?]: 01-12: validateBlocks treats strong:false as invalid, not merely redundant — the block contract's only allowed value for strong is true
- [Phase ?]: 01-13: font-display:optional genuinely works in both Chromium and WebKit — two prior 'genuine Chromium bug' conclusions (prior session's and this continuation's own first pass) were both wrong, refuted by a coordinator's CDP-based reproduction; true causes were test-host fontconfig contamination (Instrument Serif/Source Serif 4 locally installed) and an unrelated theme-toggle CLS bug, both fixed
- [Phase ?]: 01-13: WINDOWS entry 13 (open) — article.html's italic Instrument Serif standfirst deck is not preloaded and deterministically never wins the optional block period on any load, in either engine; a real, permanent, content-visible consequence of the fixed 2-preload D-GAP-A scope, flagged for owner judgement
- [Phase ?]: 01-14: D-GAP-B closed literally — headlines Source Serif 4 Bold via --font-headline (aliases --font-body); Instrument Serif is the wordmark alone, weight 400, font-synthesis:none
- [Phase ?]: 01-14: fixed a dormant bug in css-tokens.mjs's isColorValue() — culori's hex parser accepts bare hex digits with no '#', misclassifying a font-weight value like 700 as a colour; tightened to require the '#' prefix
- [Phase ?]: 01-14: Source Serif 4 subsets shrunk 40.8%/22.2% of baseline by pinning the opsz axis to each source's own fvar default (design/scripts/lib/font-axes.mjs); Instrument Serif Italic retired from git index (file kept on disk)
- [Phase ?]: 01-14: WINDOWS.md entry 13 updated, not closed — its Instrument-Serif-specific framing is now stale after D-GAP-B, but the underlying non-preload-italic risk persists for the smaller Source Serif 4 Italic file
- [Phase ?]: 01-15: Container-growth overflow heuristic exempted hyphenation-eligible elements (hyphens:auto only engages once lang is known, which injectText() sets) — fixed a real false positive, not a threshold weakening; vClipped remains authoritative.
- [Phase ?]: 01-15: calibrate-spanish.mjs's 100px calibration proxy under-predicted real in-page ratios for short strings at small UI sizes (skip-link: 1.3303@100px vs 1.3784@16.896px real); added a dense 12-58px sweep that widens each component's hi to cover its worst realistic-size ratio (9/22 components widened).
- [Phase ?]: 01-16: D-GAP-C closed -- Business's colour is re-sampled from a real Ciudad Juárez neon-sign photo (152.1deg, forest green), moving out of the 40-100deg amber/olive register entirely rather than trying another yellow-orange photo.
- [Phase ?]: 01-16: Business's hueOffset is 0 -- the new photo-sampled hue alone clears the 0.05 minimum pairwise OKLab distance floor with no hand-picked nudge; Health's retained +4 offset reason rewritten to stand alone.
- [Phase ?]: 01-16: WINDOWS.md entry 3 closed -- Sports (49.4deg) was accepted by the owner in round 1 in their own words; Business is resolved by construction (outside the amber/olive band), not by owner tolerance.
- [Phase ?]: 01-17: (1920-1280)/2 acceptance-check premise was wrong -- html's font-size is a fluid clamp() token resolving to 18px at 1920px viewport width, not a fixed 16px/rem; chrome.spec.ts now derives the expected 80rem pixel value from the root's real computed font-size
- [Phase ?]: 01-17: tab-order must-have truth omitted a real, pre-existing focus stop -- category/article/changelog/contact.html's masthead is a real <a href=index.html> home link (index.html alone uses a plain non-link h1); chrome.spec.ts's expected sequence now detects [data-wordmark] a per page instead of asserting a sequence that contradicts 4 of 5 pages' actual markup
- [Phase ?]: 01-18: render-summaries.mjs only matches <p data-summary> (not already-converted <div data-summary>), so re-running it is always idempotent -- no separate has-run state needed
- [Phase ?]: 01-18: fixed a real regression in i18n.ts's injectText() -- a [data-summary] hook now renders injected Spanish through the real markdown converter instead of pasting raw fixture markdown as flat text, which broke once white-space:pre-line was removed
- [Phase ?]: 01-18: the category lead's :not(:has([data-frame] img)) CSS is additive to the build-time image-selection contract, not a replacement -- it also catches an image failing/being removed after the page ships
- [Phase ?]: 01-19: the rail's 'Latest' five rows and order were computed directly from stress-set.json's cases.feed array (already reverse-chronological), re-verified against the plan's front-matter list, and re-derived at test time in content.spec.ts rather than hardcoded.
- [Phase ?]: 01-19: 'More in Community' cards were moved (not duplicated) into the new aside[data-rail], converted to a compact variant with frame and summary stripped.
- [Phase ?]: 01-19: [data-rail] [data-grid]'s single-column override was written once outside any media query -- two-selector specificity beats the bare [data-grid] rule inside the 48em/80em blocks regardless of source order, so no duplication was needed.
- [Phase ?]: 01-20: reproduced the changelog dispatch squeeze before any fix — real, but confined to >=80em (1280/1920px), not 768px as the owner's screenshot label suggested
- [Phase ?]: 01-20: fixed the dispatch grid with explicit grid-template-areas rather than reordering the auto-placement columns — immune to source-order/implicit-grid surprises
- [Phase ?]: 01-20: contact column centred with a fixed --column-narrow: 44rem (rem, not ch/em) — the 01-07 font-swap-CLS centring prohibition targets font-relative units only, so margin-inline:auto is safe here
- [Phase ?]: 01-21: split the 33-card feed by pure document order (6 initial + feed pages of 6) with no reordering, since D-12's reverse-chronological order is a must-have; the Spanish/long-content stress cards now sit behind the button, deliberately deferred to already-planned 01-22
- [Phase ?]: 01-21: build-feed.mjs's --extract self-verifies renderCardHtml against the live DOM before ever writing home-feed.json, catching a lossy extraction at the source
- [Phase ?]: 01-21: measured (PerformanceObserver layout-shift), not assumed, zero native CLS during a real load-more click -- the apparent rect movement is a uniform scroll offset from focus moving to the off-screen 7th card, not a reflow
- [Phase ?]: 01-22: expandFeed(page) real-click loop restores content/Spanish/glyph coverage of all 27 load-more cards; no threshold weakened, no feed reorder
- [Phase ?]: 01-22: load-more-button's Spanish-overflow check runs before expandFeed (button legitimately hides once the feed is exhausted, per 01-21's own behavior) — extracted checkComponentSpanishOverflow so the same assertion body runs at both moments
- [Phase ?]: 01-22: build-fonts.mjs's feed-expansion is a self-contained expandFeedInPage, not an import of the test-only feed.ts helper — keeps the build script independent of the test suite
- [Phase ?]: 01-23: strict D-16 gate restored (01-10's criterion-5 exception removed); unscoped verify:phase-1 5/5 PASS both engines; round-2 01-APPROVAL.md regenerated with round-1 history preserved verbatim; plan halted at Task 2 pending owner review
- [Phase ?]: 01-23: fixed a real bug in write-approval-packet.mjs's readFallbackFacesPerEngine — font-cls.md's newer positive-control table was polluting the Environment section's fallback-face list
- [Phase ?]: 01-23: owner reviewed the round-2 packet and replied APPROVED (2026-09-17), with two forward-carried feature requests (sticky rail, Astro view transitions) both deferred to Phase 8 per owner decision; executor did not write the Approved-by sign-off line itself — that remains the owner's own act per T-01-32/T-01-33
- [Phase ?]: 02-04: D-03/D-CAUTION-2 CONFIRMED — linkedom/worker + Readability runs inside a real Workers runtime, proven via a live wrangler dev tracer run (no HTMLRewriter fallback needed)
- [Phase ?]: 02-04: requirements-completed deliberately omits CONT-01 — its success criterion is a corpus-level statistic (near-zero truncation-marker rate at ingest), proven only for n=1 by this tracer; left pending for plan 02-05+'s at-scale validation
- [Phase ?]: 02-04: grounding gate (checkGrounding) proven live — correctly held a real article after catching two genuine unsupported claims, and published a clean one; gpt-5.6-luna needed max_completion_tokens (not max_tokens) and no custom temperature, discovered only by running the live endpoint
- [Phase ?]: wrangler pinned to 4.136.3 (current latest) instead of the plan's researched 4.136.1 — build-time-only CLI, no architectural risk, human-approved within Task 1's package-legitimacy gate
- [Phase ?]: Dedicated KV namespace 915tldr-render-manifest created (id 3c92531f94294fcc94006455f433885f) rather than reusing the Nuxt pipeline app's existing KV/CACHE namespaces
- [Phase ?]: wrangler.jsonc corrected against a real build: no main field, assets.directory is dist/client not dist, session: false set explicitly — @astrojs/cloudflare 14.3.2's real output shape differs from 03-RESEARCH.md's assumption
- [Phase ?]: 03-02: Drove D1-import fixture suite by invoking assertNoD1Plugin().buildEnd() directly against a synthesized PluginContext stub built from fixtures' real imports, not a full astro build — kept suite inside the 90s ceiling (~80ms).
- [Phase ?]: 03-02: Enhanced assert-no-d1.mjs's rejection message to report the full BFS chain (entry -> ... -> forbidden module), not just the two endpoints, so the island case can name the intermediate .vue file it crosses through.
- [Phase ?]: 03-02: ARCH-06 (imageService) tested via node:vm evaluation of the real cloudflare(...) call argument, not astro.config.mjs's resolved export — @astrojs/cloudflare v14.3.2 closes over imageService internally and never re-exposes it.
- [Phase ?]: 03-02: Removed a stray planner-discipline-allow marker that had leaked from 03-01-PLAN.md into the real wrangler.jsonc, the only literal occurrence of d1_databases in the file, which tripped the new T-03-01 guard.
- [Phase ?]: Deploy path resolved as local wrangler deploy (not git-connected Workers Builds CI), verified via Workers Builds API against this account's existing Workers (zero build history).
- [Phase ?]: resolveBuildHash exported as a pure function of env for direct testability, per 03-03-PLAN.md Task 2's stated preference.
- [Phase ?]: 03-04: Task 1 checkpoint resolved as Option C — translationGroupId + language replace spanishCounterpartId; the group id equals the article's own uuid today and is never null, reusing the existing duplicate_groups pattern already live in production D1.
- [Phase ?]: 03-04: renderVersion renamed to schemaVersion; buildManifestEntry no longer accepts a version param at all — every entry gets the exported MANIFEST_SCHEMA_VERSION automatically, closing the drift that produced the 03-01 tracer's hand-written renderVersion: '0'.
- [Phase ?]: 03-04: KV bulk-write 10,000-pair ceiling carried forward from 03-RESEARCH.md's already-fetched citation, not re-verified live — the cloudflare-docs MCP tool was unavailable in this execution's tool surface; flagged in docs/phase-03/render-manifest.md and SUMMARY coverage item D7 for confirmation before corpus-scale use.
- [Phase ?]: 03-05: noindex Transform Rule extended to cover admin-dev.915tldr.com in addition to dev.915tldr.com (admin-dev didn't exist when the plan's Task 2 was scoped; leaving it out would ship a new crawlable admin surface).
- [Phase ?]: 03-05: executed the noindex-rule task before the deploy task (mandatory ordering) so the rule was proven live on admin-dev.915tldr.com before any v2 code shipped — no unprotected crawlable window ever existed.
- [Phase ?]: 03-05: session:false in astro.config.mjs was a no-op in 03-01's original location (inside the adapter call instead of Astro's top-level config key) — first real wrangler deploy exposed it; fixed by moving the key.
- [Phase ?]: 03-05: a stale zone Worker Route for dev.915tldr.com out-prioritized the freshly-reassigned Custom Domain for 3+ minutes, contrary to Cloudflare's documented precedence; deleting the stale route (per the plan's own anticipated cleanup step) resolved it immediately.
- [Phase ?]: 03-06: STATE.md's 300s cron CPU ceiling and ~4ms/page render cost were both wrong (measured: ~900s ceiling, 573-736ms/page) — full-corpus rebuild takes 6.3-8.1hrs against the real ceiling, 25-33x over.
- [Phase ?]: 03-06: naive D1 offset pagination reads 49.4M rows for one 39,827-row pass — 9.9x PROJECT.md's 5M hard-fail budget; keyset pagination is 4.3x cheaper (11.5M rows) but still over budget. Phase 4's loader must not page the full corpus this way.
- [Phase ?]: 03-06: limits.cpu_ms (max configurable 300,000ms) has no effect on Cron Trigger CPU ceiling — confirmed empirically, a real cron-triggered burn ran to 902,000ms of CPU regardless.
- [Phase ?]: 03-07: D-01 render-step location decided as Option A (existing 2-hour cron Worker) for both steady-state incremental renders and full-corpus rebuilds (chained across ~26-33 cron cycles), not Queues or CI — ruled in by a measured real ingest volume of 15 articles/cycle mean (62 peak) against a ~1,223-1,574/cycle capacity, ~20x headroom at the worst observed week. See docs/phase-03/render-step-location.md.
- [Phase ?]: 03-07: staleness detection for Phase 4's loader must not bulk-fetch the full corpus every cron cycle — 957,008 rows/pass x 12 cycles/day = 11.48M rows/day, 5.7x PROJECT.md's 2M daily soft budget and 2.3x its 5M daily hard-fail, even though a single bulk-fetch pass fits comfortably. Use an incremental signal (updated_at comparison or an ingest-set flag) instead; reserve the full bulk-fetch pass for forced full rebuilds only.
- [Phase ?]: 04-01: A Content Layer Loader throw does fail astro build (RESEARCH Open Question 1 CONFIRMED by spike) - REND-02/03's fail-loud guarantee can rest on it
- [Phase ?]: 04-01: Trailing-slash redirect measured at 307, not 301 - Cloudflare's native html_handling never emits 301 in any mode; named deviation from CONTEXT.md's wording, flagged for end-of-phase owner review
- [Phase ?]: 04-01: Manifest schema bumped to v2 - every entry now carries slug (D-08), enabling a future zero-D1-read non-canonical-URL Worker redirect (plan 04-06) from one KV read
- [Phase ?]: 04-02: toSafeJsonLd escapes <, >, &, and the line/paragraph separator code points (built via String.fromCharCode, not a typed escape sequence) after JSON.stringify -- each JSON-LD node carries its own @context since Base.astro renders each as an independent <script> block
- [Phase ?]: 04-02: home page's wordmark renders as a plain <h1> matching design/mockups/index.html verbatim; every other page gets <p data-wordmark><a href="/">915 TLDR</a></p>, per the plan's own interface note
- [Phase ?]: 04-02: footer gains About/Privacy/Terms links beside the mockup's Changelog/Contact -- a named, plan-specified addition to the approved mockup footer (D-10's static pages need a way in)
- [Phase ?]: 04-02: a single-backslash \u2028/\u2029-style escape sequence typed directly into this session's file-write tool call gets silently decoded into the real invisible Unicode character before it reaches disk -- worked around via String.fromCharCode(...) at runtime instead of typing the escape sequence into source text
- [Phase ?]: 04-03: evaluateShrink's explained set is every observed nonPublic uuid from the current fetch, not pre-filtered against previous.ids — the function's own intersection logic makes pre-filtering redundant
- [Phase ?]: 04-03: Rule 1 fix — a NULL/empty summary (140 of ~40,183 production articles) is classified nonPublic with reason missing-summary, matching the existing no-primary-category pattern, rather than crashing the whole cold build on a Zod schema violation
- [Phase ?]: 04-03: Rule 1 fix — cold mode no longer sets meta.lastSweep; the original draft did, which silently skipped warm+sweep mode on every real deployment's first post-cold build (found by the plan's own verification sequence not matching its expected output)
- [Phase ?]: 04-03: peak RSS measured via /proc/<pid>/status VmHWM polling since /usr/bin/time -v is not installed on this machine; equivalent figure, no new system package installed
- [Phase ?]: 04-04: Owner selected option-a (article-relative rail) for Task 1's checkpoint — More in <Category> + Earlier neighbours computed from the article's own position, not a build clock, to satisfy criterion 3
- [Phase ?]: 04-04: chrome.test.mjs's Organization/WebSite JSON-LD count assertion fixed (Rule 1) — a substring match was also matching NewsArticle.isBasedOn.publisher's nested Organization node; now parses top-level @type
- [Phase ?]: 04-04: criterion 3 (byte-identical unchanged articles) empirically confirmed across the full 40,108-article corpus via two consecutive real builds, not sampled
- [Phase ?]: 04-05: Category masthead omits the mockup's decorative subtitle - no data source exists for it (categories.ts is slug+name only); flagged for owner review if wanted later
- [Phase ?]: 04-05: Found and fixed a real bundler bug (same class as 03-01's slugify()) - a frontmatter-local TAG_SLUG_RE const referenced only from getStaticPaths() was silently dropped by Astro 7.3.3's bundler; moved into src/lib/article-url.ts
- [Phase ?]: 04-05: HOME_FEED_COUNT=7 cited directly from design/mockups/index.html's no-JS feed state (1 lead + 6 grid cards)
- [Phase ?]: 04-06: wrangler deploy MUST pin --config wrangler.jsonc — @astrojs/cloudflare 14.3.2 marks the entry-Worker environment devOnly (dropping a custom main) whenever the Astro app has zero on-demand routes, independent of main's value; found via the plan's own instructed inspection of the generated deploy config, not assumed.
- [Phase ?]: 04-06: test:build-gate wired into the build script — the live Rollup-based D1-import guard cannot see src/worker.ts during a real astro build (its devOnly environment is never built at all), so the fixture suite's real-graph case is the only current-content check for this file.
- [Phase ?]: 04-07: Owner decision -- public/robots.txt ships v1's INTENDED per-bot AI-crawler-blocking policy (server/routes/robots.txt.ts's rendered body), not the live trivial file production actually serves -- v1's static public/robots.txt shadows its own server route, so that policy has never actually been served. Deliberate production policy change on next deploy.
- [Phase ?]: 04-07: astro.config.mjs's sitemap() filter excludes any URL with a dotted final path segment (rss.xml, news-sitemap.xml, version.json, 404-index.json) rather than a hand-maintained list, confirmed against the package's own astro:build:done hook source.
- [Phase ?]: 04-08: Owner-adjusted CHANGELOG_MIN_EXPECTED to 15 (not the planned 18) after confirming v1's live changelog.json genuinely serves fewer entries today (3 entries committed to v1's repo 2026-09-21 were never deployed, last deploy 2026-09-19T17:13Z) -- the never-shrink baseline ratchets this back up to 18 automatically once v1 deploys.
- [Phase ?]: 04-08: v1's /contact page never publishes a contact address anywhere in its rendered markup (confirmed by reading server/api/contact.post.ts) -- no address was fabricated for the new contact.astro; the mockup's own jjaimealeman.com/915website.com links already provide a way to reach the owner.
- [Phase ?]: 04-08: [data-contact-column] reused as the narrow reading column for about/privacy/terms (not [data-reading-column], which is paired with the rail layout) -- confirmed against design/mockups/style.css before reuse.
- [Phase ?]: 04-09: incremental-build spike verdict is REUSE_WARM_ONLY (withastro/astro#18055 reproduced locally) — reuse works in a warm checkout but reused zero pages in a fresh-clone CI simulation; byte-identity confirmed once a restored page's disclosed stale build-stamp is accounted for
- [Phase ?]: 04-09: ASTRO_INCREMENTAL_BUILD scoped to feature/phase-04 non-production branch only, per docs/phase-04/workers-builds-setup.md — production stays off until 04-11's decision
- [Phase ?]: 04-09: toggling ASTRO_INCREMENTAL_BUILD forces the D1 loader cold on the next build (store.keys().length===0) — a real, measured Astro/Vite config-change cache-invalidation behavior, flagged for awareness not fixed
- [Phase ?]: 04-10: WB_COLD_FITS (649s cold build) and WB_REUSE_PROVEN (>=34,871/~60,349 pages restored on a real fresh Workers Builds container) both confirmed on the real platform, superseding 04-09's local REUSE_WARM_ONLY assumption -- explained by Workers Builds restoring both a dependencies cache and a build-output cache from the prior build, unlike 04-09's local fresh-clone simulation which only reproduced the build-output half.
- [Phase ?]: 04-10: found and fixed two real bugs in tools/ci-build.mjs's D-15 notification path during a live drill -- classifyFailure() was misattributing failures to benign command-echo lines, and the corrected title then crashed the process via an HTTP header ByteString error on an em-dash. Both fixed and verified end-to-end against the real ntfy topic.
- [Phase ?]: 04-10: found (not fixed, Rule 4) that src/layouts/Base.astro unconditionally prints BUILD_HASH in every page's footer, defeating content-hash asset-upload dedup on any commit change (Build 3 re-uploaded 60,355/60,355 assets, only 7 deduped) -- flagged as a cost-relevant finding for 04-11's decision.
- [Phase ?]: 04-11: Owner selected option-a (Workers Builds does all builds, including forced full rebuilds) for the D-05 forced-rebuild mechanism and REND-05's render layer — a one-way door, 2026-09-30 ~15:40 MDT.
- [Phase ?]: 04-11: experimental.incrementalBuild flipped from off-by-default to on-by-default in astro.config.mjs, now that WB_REUSE_PROVEN (04-10) is confirmed on the real platform; ASTRO_INCREMENTAL_BUILD=0 remains the documented off switch.
- [Phase ?]: 04-11: tests/regression/byte-identity.test.mjs tolerates live production D1 drift via a count-based bound (loader's own changed=N x rail fan-out of 9) since the loader logs only a count, not article ids — a disclosed approximation, not a literal per-article check.
- [Phase ?]: 04-11a (owner-approved quick fix, 2026-09-30): Base.astro's footer build-stamp (`BUILD_HASH`) is now opt-in via a new `buildStamp` prop, default false — only the homepage passes `buildStamp={true}`; /version.json is unaffected (reads build-info.ts directly). Fixes 04-10's "near-total asset re-upload" finding: before, all ~60,359 built HTML files carried the commit hash and changed bytes on every commit; after, only 1 (the homepage) does.

### Pending Todos

- **Sticky "Latest Stories" rail** (Phase 8: Server Islands & Interactivity, alongside ISL-06). Owner decision 2026-09-17: deferred to the Astro build phase, not a Phase 1 mockup addition — Phase 1's approved mockups are unchanged; the rail's scroll behaviour is deliberately unproven until then. Owner: "can the latest stories be made to float? is that a sticky? so as the reader scrolls, the latest stories remains visible?" (raised against changelog.html; article.html carries the same rail per 01-19). Implementation note: `position: sticky` on the rail column (`aside[data-rail]`), a `top` offset clearing the masthead, disabled below the 64em breakpoint where the rail stacks below the reading column. No existing requirement ID covers this — flag as an unmapped requirement candidate for whoever scopes Phase 8 (ROADMAP.md's current Phase 8 criteria don't mention rail stickiness); not added to REQUIREMENTS.md/ROADMAP.md by this session. Sticky positioning and view transitions interact (owner's own framing) — build both together.
- **Astro view transitions** (Phase 8: Server Islands & Interactivity). Owner decision 2026-09-17, same phase as the sticky rail: "since the site is astro. i would like view transitions. a nice subtle fade in/out of content as the navigation remains static/visible with no transition." Already covered by existing requirement **ISL-06** ("Page transitions use `<ClientRouter />` from `astro:transitions`", REQUIREMENTS.md, mapped to Phase 8) and ROADMAP.md Phase 8 success criterion 5. Implementation note for that phase: Astro 7 uses `<ClientRouter />` from `astro:transitions` (`<ViewTransitions />` was removed in v5); the persistent masthead/nav needs `transition:persist` (or a named transition) so it never animates, matching the owner's "navigation remains static/visible with no transition" request.

### Blockers/Concerns

- **URGENT, Phase 3:** The OpenAI account sat at $0 returning HTTP 429 from 2026-09-04 to 2026-09-16. If `articles-semantic` is fed by OpenAI embeddings, ~1,200 articles may have no vector — silently degrading duplicate detection and semantic search. Verify before Phase 9 depends on it.
- **RESOLVED — Phase 3, 03-07.** Render-step location (D-01) is decided: the render step runs
  inside the **existing 2-hour cron Worker (Option A)**, for both the steady-state incremental
  render and the rare full-corpus rebuild (via the same incremental machinery, chained across
  ~26-33 cron cycles with staleness forced, rather than a separate mechanism). Full reasoning,
  figures, rejected alternatives and the reopening threshold: `docs/phase-03/render-step-location.md`.
  This replaces this line's own prior "CORRECTED — Phase 3, 03-06" wording (that correction's
  full text is preserved in `docs/phase-03/measurements.md` §3 and 03-06-SUMMARY.md, not lost):
  the carried-forward **300-second Worker CPU
  ceiling figure this line originally reasoned from was WRONG, and remains corrected, not
  reopened** — the real ceiling for this project's 2-hour-interval cron is **~900 s (15 min)**,
  confirmed both from Cloudflare's own docs and by an empirical burn test, 3x higher than the
  300 s this project had been reasoning from. A new measurement closed the one gap 03-07's own
  checkpoint flagged as unmeasured: real production ingest volume over the trailing 7 days is
  **15 articles/cycle (mean), 62 at the busiest observed cycle** — against a measured
  ~1,223-1,574 article-per-invocation capacity, roughly 20x headroom at the worst observed week.
  A binding constraint on Phase 4 falls out of this decision: staleness detection must NOT
  re-scan the full corpus every cron cycle (the bulk-fetch shape that fits the single-pass 5M-row
  hard-fail budget at 957,008 rows would hit 11.48M rows/day at 12 cycles/day — 5.7x the daily
  soft budget and 2.3x the daily hard-fail); use a cheap incremental signal instead. Full detail
  in the decision document.

- Astro build time and memory at 41k-82k pages via a D1-backed loader has no public benchmark. Phase 4 is closer to novel territory than general Astro scaling suggests.
- One Phase 3 success criterion (the `articles-semantic` vector-gap check) has no dedicated REQ-ID; it is a measurement obligation feeding SRCH-02/SRCH-03 in Phase 9. Recorded deliberately rather than dropped.
- Phase 1: WebKit (Playwright 26.6, Docker) never composites while a font resource is pending, regardless of font-display:swap — font-swap CLS measurement reports prePaintObserved:false honestly for this engine; needs a real-Safari spot-check before 01-APPROVAL.md sign-off (see 01-02-SUMMARY.md coverage D8).
- Phase 1: three items need owner C-01/subject-fidelity sign-off before 01-APPROVAL.md -- politics' photo is Santa Fe dusk not El Paso/Franklin Mountains; weather's sampled hue reads azure-blue not turquoise; Sports/Business block-stop hues (49.4deg/94.5deg) visually sit near the amber-olive-reading-as-brown risk C-01 flags. See 01-03-SUMMARY.md.
- Phase 1: Criterion 5 (font-swap CLS) requires an owner decision before 01-APPROVAL.md — accept the documented residual shift, adjust the fallback font stack, or reopen the font-display:swap PRD decision. See 01-09-SUMMARY.md and design/evidence/font-cls.md.
- **RESOLVED — Phase 1, 01-13 Task 1** (see WINDOWS.md entries 9-12, all `fixed`; supersedes the two prior blocker lines this replaces). Entries 9/10's claim that Chromium's `font-display:optional` genuinely fails to prevent a late swap was WRONG — refuted by the coordinator's rigorous reflow-probe (scroll + forced reflow + a new same-family span never swapped) and confirmed via authoritative CDP `CSS.getPlatformFontsForNode`. True root cause (entry 11): this dev machine has "Instrument Serif"/"Source Serif 4" (this project's own primary webfont names) installed as local user fonts under `~/.local/share/fonts` (leftover from earlier design work); a same-named local font collision makes Chromium apply a late-arriving optional font, purely a test-environment contamination bug. Fixed in `design/scripts/pw.mjs` by isolating `XDG_DATA_HOME` for native (non-Docker) Playwright launches. A second, unrelated, real bug (entry 12) was found while getting the new `referenceNativeCls` check to pass honestly: index.html's theme-toggle button used `display:` while `[hidden]`, so JS revealing it after DOMContentLoaded caused a real, font-unrelated CLS (confirmed with a fonts-free control). Fixed in `design/mockups/style.css` (`visibility:hidden` instead, same box reserved). `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/font-cls.spec.ts` now passes cleanly and repeatably (3/3 runs, both engines): every row classifies fallback-kept/prePaintObserved:true/fontDisplay:optional. Tasks 2-3 unblocked, no owner decision needed, no threshold weakened.
- **UPDATED — Phase 1, 01-23 Task 2/3** (supersedes the prior line above). The owner completed the round-2 review and replied **APPROVED**, with spot comments on article/changelog/contact/load-more and two new feature requests (sticky rail, Astro view transitions — both deferred to the Astro build phase, see Pending Todos). Per this plan's own non-negotiable rule (T-01-32/T-01-33, "the executor never writes the owner's sign-off line, and never records an approval on the owner's behalf"), the executor did NOT add the `Approved-by:` line to `01-APPROVAL.md` — that relayed "APPROVED" came through the orchestrator, not the owner's own hand on the file, and the plan requires the literal line to be the owner's own act. **Remaining step (owner-only, not a code blocker):** add `Approved-by: <name> — 2026-09-17` to the "## Owner sign-off" section of `01-APPROVAL.md`, then `pnpm run verify:approval` will exit 0 and a trivial follow-up commit finalizes Task 3.
- **RESOLVED — Phase 3, 03-01 Task 2.** The Cloudflare token gained `Workers KV Storage:Edit` (D1:Edit and the account id were confirmed intact in the same pass). The `915tldr-render-manifest` KV namespace was created (id `3c92531f94294fcc94006455f433885f`), wired into `wrangler.jsonc` and a gitignored `.dev.vars`. `pnpm build` and `pnpm test:tracer` both pass end-to-end against the real D1 row and the real KV namespace; Phase 1's 43-test suite is unaffected. Three further build-blocking issues were found and fixed in the same session (stale `wrangler.jsonc` `main` field, an unwanted auto-provisioned `SESSION` KV binding, and a bundler bug dropping a frontmatter-local `slugify()` function) — see 03-01-SUMMARY.md for full detail. 03-01 is complete.
- **RESOLVED — Phase 3, 03-05 (both prior halts).** The owner granted the missing Rulesets/Transform Rules token scope. Resumed from mandatory-ordering Step 2 and completed the plan: the noindex Transform Rule now covers `dev.915tldr.com` AND `admin-dev.915tldr.com` (extended scope, Rule 2 deviation — admin-dev didn't exist when the plan's Task 2 was first scoped); `915tldr-v2` is deployed and live on `dev.915tldr.com` (Custom Domain reassigned from `915tldr-dev`, `workers_dev: false`, stale zone Worker Route deleted after it was found to be out-prioritizing the reassignment); `pnpm verify:edge` (`tools/verify-edge-headers.mjs`) re-proves the whole policy on every future deploy. Two real bugs found and fixed along the way: `session: false` was a no-op in the wrong astro.config.mjs location (03-01's claimed fix never worked), and a stale zone Worker Route silently out-prioritized a correctly-reassigned Custom Domain for 3+ minutes, contrary to Cloudflare's documented precedence. Production (`915tldr.com`/`www.915tldr.com`) and `admin-dev.915tldr.com` verified unaffected throughout. See 03-05-SUMMARY.md for full detail. 03-05 is complete.
- 04-07: production robots.txt behavior changes on next deploy -- v1's AI-crawler-blocking policy (Content-signal, GPTBot/ClaudeBot/CCBot/etc. Disallow) has never actually been served (v1's static public/robots.txt shadowed its own server route); v2 ships the intended policy, an owner-approved but real change to what's been crawlable. Also flagged: SEO-04 sitemap ordering-determinism unverified across two builds (@astrojs/sitemap documents no stable ordering guarantee) -- see 04-07-SUMMARY.md coverage D4.
- **RESOLVED — Phase 4, 04-10 Task 2.** The owner chose option (a) and pushed `cc1b050` on 2026-09-30. Builds 3-4 ran on the real Workers Builds platform: Build 3 (flag-on, first toggle) was cold again as 04-09 already documented, 0/60,349 pages restored (expected); Build 4 (flag-on, no toggle) confirmed at least 34,871/~60,349 pages restored via `experimental.incrementalBuild` on a genuinely fresh Workers Builds container, wall time collapsing from 554s to 147s. **Verdict: `WB_REUSE_PROVEN`** — contradicts and supersedes 04-09's local `REUSE_WARM_ONLY` finding; likely explained by Workers Builds restoring both a dependencies cache and a build-output cache from the prior build, which 04-09's local fresh-clone simulation never fully reproduced. A new cost-relevant finding surfaced along the way: Build 3's deploy re-uploaded 60,355/60,355 assets (only 7 deduplicated), root-caused to `src/layouts/Base.astro` unconditionally printing `BUILD_HASH` in every page's footer — reported for 04-11, not fixed (Rule 4). The temporary `incrementalBuild=true` hardcode was reverted (`99795e3`) once both spike builds completed. See `04-10-SUMMARY.md` and `docs/phase-04/build-measurements.md` for full detail. 04-10 is complete.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-30T22:01:37.686Z
Stopped at: Completed 04-11-PLAN.md
Resume file: None

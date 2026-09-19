---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: milestone
current_phase: 02
current_phase_name: content-quality-grounding
status: executing
stopped_at: Phase 2 context gathered
last_updated: "2026-09-19T18:01:09.657Z"
last_activity: 2026-09-19
last_activity_desc: Phase 02 execution started
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 33
  completed_plans: 23
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-16)

**Core value:** Zero D1 reads on the public request path — architecturally zero, enforced structurally at build time.
**Current focus:** Phase 02 — content-quality-grounding

## Current Position

Phase: 02 (content-quality-grounding) — EXECUTING
Plan: 1 of 10
Status: Executing Phase 02
Last activity: 2026-09-19 — Phase 02 execution started

Progress: [██████████] 96%

## Performance Metrics

**Velocity:**

- Total plans completed: 23
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 23 | - | - |

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

### Pending Todos

- **Sticky "Latest Stories" rail** (Phase 8: Server Islands & Interactivity, alongside ISL-06). Owner decision 2026-09-17: deferred to the Astro build phase, not a Phase 1 mockup addition — Phase 1's approved mockups are unchanged; the rail's scroll behaviour is deliberately unproven until then. Owner: "can the latest stories be made to float? is that a sticky? so as the reader scrolls, the latest stories remains visible?" (raised against changelog.html; article.html carries the same rail per 01-19). Implementation note: `position: sticky` on the rail column (`aside[data-rail]`), a `top` offset clearing the masthead, disabled below the 64em breakpoint where the rail stacks below the reading column. No existing requirement ID covers this — flag as an unmapped requirement candidate for whoever scopes Phase 8 (ROADMAP.md's current Phase 8 criteria don't mention rail stickiness); not added to REQUIREMENTS.md/ROADMAP.md by this session. Sticky positioning and view transitions interact (owner's own framing) — build both together.
- **Astro view transitions** (Phase 8: Server Islands & Interactivity). Owner decision 2026-09-17, same phase as the sticky rail: "since the site is astro. i would like view transitions. a nice subtle fade in/out of content as the navigation remains static/visible with no transition." Already covered by existing requirement **ISL-06** ("Page transitions use `<ClientRouter />` from `astro:transitions`", REQUIREMENTS.md, mapped to Phase 8) and ROADMAP.md Phase 8 success criterion 5. Implementation note for that phase: Astro 7 uses `<ClientRouter />` from `astro:transitions` (`<ViewTransitions />` was removed in v5); the persistent masthead/nav needs `transition:persist` (or a named transition) so it never animates, matching the owner's "navigation remains static/visible with no transition" request.

### Blockers/Concerns

- **URGENT, Phase 3:** The OpenAI account sat at $0 returning HTTP 429 from 2026-09-04 to 2026-09-16. If `articles-semantic` is fed by OpenAI embeddings, ~1,200 articles may have no vector — silently degrading duplicate detection and semantic search. Verify before Phase 9 depends on it.
- Render-step location (cron worker / separate worker via Queues / CI) is unresolved pending the Phase 3 CPU-headroom and per-page-cost measurements. A full 82k rebuild at ~4 ms/page is ~330 s, over the 300 s Worker CPU ceiling regardless of location, so Queues fan-out may be required.
- Astro build time and memory at 41k-82k pages via a D1-backed loader has no public benchmark. Phase 4 is closer to novel territory than general Astro scaling suggests.
- One Phase 3 success criterion (the `articles-semantic` vector-gap check) has no dedicated REQ-ID; it is a measurement obligation feeding SRCH-02/SRCH-03 in Phase 9. Recorded deliberately rather than dropped.
- Phase 1: WebKit (Playwright 26.6, Docker) never composites while a font resource is pending, regardless of font-display:swap — font-swap CLS measurement reports prePaintObserved:false honestly for this engine; needs a real-Safari spot-check before 01-APPROVAL.md sign-off (see 01-02-SUMMARY.md coverage D8).
- Phase 1: three items need owner C-01/subject-fidelity sign-off before 01-APPROVAL.md -- politics' photo is Santa Fe dusk not El Paso/Franklin Mountains; weather's sampled hue reads azure-blue not turquoise; Sports/Business block-stop hues (49.4deg/94.5deg) visually sit near the amber-olive-reading-as-brown risk C-01 flags. See 01-03-SUMMARY.md.
- Phase 1: Criterion 5 (font-swap CLS) requires an owner decision before 01-APPROVAL.md — accept the documented residual shift, adjust the fallback font stack, or reopen the font-display:swap PRD decision. See 01-09-SUMMARY.md and design/evidence/font-cls.md.
- **RESOLVED — Phase 1, 01-13 Task 1** (see WINDOWS.md entries 9-12, all `fixed`; supersedes the two prior blocker lines this replaces). Entries 9/10's claim that Chromium's `font-display:optional` genuinely fails to prevent a late swap was WRONG — refuted by the coordinator's rigorous reflow-probe (scroll + forced reflow + a new same-family span never swapped) and confirmed via authoritative CDP `CSS.getPlatformFontsForNode`. True root cause (entry 11): this dev machine has "Instrument Serif"/"Source Serif 4" (this project's own primary webfont names) installed as local user fonts under `~/.local/share/fonts` (leftover from earlier design work); a same-named local font collision makes Chromium apply a late-arriving optional font, purely a test-environment contamination bug. Fixed in `design/scripts/pw.mjs` by isolating `XDG_DATA_HOME` for native (non-Docker) Playwright launches. A second, unrelated, real bug (entry 12) was found while getting the new `referenceNativeCls` check to pass honestly: index.html's theme-toggle button used `display:` while `[hidden]`, so JS revealing it after DOMContentLoaded caused a real, font-unrelated CLS (confirmed with a fonts-free control). Fixed in `design/mockups/style.css` (`visibility:hidden` instead, same box reserved). `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/font-cls.spec.ts` now passes cleanly and repeatably (3/3 runs, both engines): every row classifies fallback-kept/prePaintObserved:true/fontDisplay:optional. Tasks 2-3 unblocked, no owner decision needed, no threshold weakened.
- **UPDATED — Phase 1, 01-23 Task 2/3** (supersedes the prior line above). The owner completed the round-2 review and replied **APPROVED**, with spot comments on article/changelog/contact/load-more and two new feature requests (sticky rail, Astro view transitions — both deferred to the Astro build phase, see Pending Todos). Per this plan's own non-negotiable rule (T-01-32/T-01-33, "the executor never writes the owner's sign-off line, and never records an approval on the owner's behalf"), the executor did NOT add the `Approved-by:` line to `01-APPROVAL.md` — that relayed "APPROVED" came through the orchestrator, not the owner's own hand on the file, and the plan requires the literal line to be the owner's own act. **Remaining step (owner-only, not a code blocker):** add `Approved-by: <name> — 2026-09-17` to the "## Owner sign-off" section of `01-APPROVAL.md`, then `pnpm run verify:approval` will exit 0 and a trivial follow-up commit finalizes Task 3.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-19T16:14:49.684Z
Stopped at: Phase 2 context gathered
Resume file: .planning/phases/02-content-quality-grounding/02-CONTEXT.md

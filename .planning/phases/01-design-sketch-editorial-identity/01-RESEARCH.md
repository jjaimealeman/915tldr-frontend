# Phase 1: Design Sketch & Editorial Identity - Research

**Researched:** 2026-09-16
**Domain:** Static HTML/CSS design system — WCAG 2.2 AA verification tooling, self-hosted variable-font subsetting, CLS-safe font fallbacks, browser-driven keyboard/overflow assertions
**Confidence:** MEDIUM — the eight open tooling questions from CONTEXT.md are now answered with a primary recommendation each; the weakest link is the Safari/Playwright-WebKit divergence, which is a genuine, unresolved platform gap, not a research gap.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Palette tiering.** Category colour is tiered, not uniform. Vivid colour appears as stripes/rules/labels in the grid; darkened, contrast-verified colour **blocks** are reserved for two contexts only: the category index masthead and the article category header. Text always stays on the neutral ink/paper pair in the grid.

**D-02 — Palette derivation.** Eight hues sampled from real photography, then forced onto fixed lightness/chroma stops in OKLCH. Hue from photo, lightness from the scale. Contrast passes by construction.

**D-03 — Dark-mode ramp.** A third lightness ramp on the same eight hues (three stops per hue: vivid-on-light, text-safe block, vivid-on-dark). Category identity constant across themes.

**D-04 — Neutrals.** Near-neutral, barely warm. Light: paper `#FAFAF8`, ink `#14161A`. Dark: paper `#121417`, ink `#E8EAED`. (Supersedes a withdrawn warm-bone `#F7F3EC`/`#1A1714` pair — see C-01.)

**D-05 — File structure.** 7 files: `index.html`, `category.html`, `article.html`, `changelog.html`, `contact.html`, one shared `style.css`, and `fonts/`. Themes flip via `data-theme` on `<html>`, driven by CSS custom properties — the mechanism the real site will use. Both themes exist in every file without duplicating markup.

**D-06 — Mockup content.** Real rows from the live D1 corpus, stress-picked to span extremes: longest/shortest headline, 200-word padded summary, ~40-word thin summary, 5-tag/0-tag article, no-image case, junk-image case, Spanish headline +25% longer. **Critical:** Phase 2 removes the 100–200 word summary floor; cards must survive both a two-line and a six-line summary, not today's uniformly-padded lengths.

**D-07 — Viewports.** Mobile-first, three widths: base CSS at 320px, `min-width` queries at ~768 and ~1280. One stylesheet, no extra files. Worst case drawn explicitly: 320px + Spanish copy + longest-in-corpus headline, simultaneously. 200% zoom is not a viewport width and must be verified by driving a real browser, not by drawing a file.

**D-08 — Font-swap CLS proof.** Proven empirically: throttle the network so the fallback paints before woff2 arrives, record CLS across the swap with `PerformanceObserver`, in Chrome **and** a WebKit engine. Settles whether `size-adjust` and `ascent-override`/`descent-override` actually hold in the browser, not just arithmetically.

**D-09 — Cards and lead.** Type-led cards: category stripe, Instrument Serif headline, summary, source, time. Image is an enhancement, never an empty slot. One lead story at larger scale, image-led when a usable image exists, falling back to a deliberate typographic treatment when not (42% of articles have no image — PRD §9.1).

**D-10 — Standfirst, no pull quotes.** The oversized structural type role is a standfirst deck — one sentence between headline and body, drawn from the summary's own opening sentence. Pull quotes dropped entirely (deliberate deviation from PRD §5.1 — flag at next phase transition).

**D-11 — Changelog treatment.** `/changelog` renders as dated dispatches: date as furniture, Instrument Serif title, existing `items[]` as flowing prose rather than a `<ul>`. No change to entry format or `/jja-commit`.

**D-12 — Homepage below the lead.** Single reverse-chronological feed, all categories mixed. Category stripe does wayfinding; persistent category nav gives access to the eight sections. No category-reserved space anywhere on the homepage.

**D-13 — Contrast table generation.** Generated from CSS tokens, not hand-written. A script reads custom properties out of `style.css`, computes every ratio that matters, emits markdown, exits non-zero on failure. Becomes the Phase 3 CI guard. Table shape: 3 verified rows (lightness held constant per ramp), not 16 per-colour checks. Re-verify each ramp against the **final** neutrals.

**D-14 — Keyboard walk.** Scripted plus the owner's own pass. A Playwright script tabs every focusable element on every mockup in both themes, screenshots each focus state, asserts (a) a visible focus indicator exists and (b) its box plus outline offset is not clipped by any `overflow` ancestor. Owner's manual pass judges tab order/operability and constitutes criterion-1 approval.

**D-15 — Spanish test copy.** Real translated Spanish plus a synthetic +25% floor. Real Spanish for the stress set exercises true diacritics; one synthetic case per component padded to exactly +25% over its English source. Both asserted programmatically (`scrollWidth > clientWidth`, truncation detection, card height grows rather than clips).

**D-16 — Approval form.** One runner plus signed `01-APPROVAL.md`. A single command runs all five criteria and prints a criterion-by-criterion verdict. `01-APPROVAL.md` pastes that output, links screenshot evidence, carries the owner's dated sign-off. One-way: Phase 3 onward treats this as settled.

**C-01 — Palette register (owner constraint, overrides plain reading of DSGN-04).** Tan/brown/beige/adobe/terracotta are **out** of the palette and the neutrals. Source the eight hues from the saturated end of the real place: deep indigo night sky, hard turquoise daylight, ocotillo red, sotol/creosote green, marigold/violet sunset, saturated El Paso/Juárez storefront and neon colour. DSGN-04's literal wording ("Chihuahuan desert palette") is superseded by this constraint; recommend revising DSGN-04's wording at the next phase transition.

**Platform constraint (flagged for the planner).** Safari is not available — the owner is on Arch Linux. D-08's WebKit pass must come from Playwright's bundled WebKit build, which is the same engine family but **not** identical to Apple's shipped Safari. This research confirms that gap is real and currently asymmetric in a specific, checkable way (see Pitfall 4 and Open Question 1 below) — do not report "Safari verified" from a Linux run.

### Claude's Discretion

None claimed in CONTEXT.md — every locked decision above was selected by the owner from presented options. This research exercises discretion only on the **eight tooling questions** CONTEXT.md explicitly left open (see `<deferred>` below), which is what this document answers.

### Deferred Ideas (OUT OF SCOPE)

None — the discussion stayed within phase scope; no new capabilities were proposed.

**Open within this phase** (not deferred out of it — CONTEXT.md asks research/planning to resolve these, not the owner):
1. Link colour and focus-ring colour, including focus contrast against the eight coloured block backgrounds.
2. Whether 915 TLDR owns a brand colour distinct from the eight category hues.
3. Masthead/wordmark treatment and eight-category nav behaviour at 320px.
4. Category index masthead treatment (one of D-01's two block contexts).
5. **Subsetting toolchain** — answered below (glyphhanger primary, subset-font as fallback).
6. Whether mockups carry real images or placeholders, given the junk-image problem.
7. Theme toggle needs a few lines of JS to flip `data-theme` — DSGN-06's zero-JS rule applies to the **article grid**, not the chrome; confirm that reading holds (it does — see Architecture Patterns).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DSGN-01 | Static HTML/CSS mockups exist and are approved before Astro work begins | D-05 file structure; D-16 approval runner; "Don't Hand-Roll" — no `.astro`, no component library, no bundler for the mockups themselves |
| DSGN-02 | Mockups pass contrast and keyboard review before acceptance | D-13 contrast-from-tokens script (culori/colorjs.io + WCAG relative-luminance formula, verified); D-14 Playwright keyboard-walk + clipping detection |
| DSGN-03 | Instrument Serif display, Source Serif 4 body; neither Playfair Display nor Merriweather appears | Font subsetting toolchain (glyphhanger/subset-font); `@capsizecss/metrics` confirmed to carry metrics for both faces, enabling CLS-safe fallbacks |
| DSGN-04 | Each category owns a distinct colour (wording superseded by C-01 — saturated El Paso/Juárez register, not desert-tan) | OKLCH→sRGB conversion (culori/colorjs.io) feeds the same D-13 contrast script |
| DSGN-05 | Light and dark themes both fully designed, light default | D-05 `data-theme` custom-property mechanism; D-13 contrast table covers both ramps |
| DSGN-06 | Article grid renders as pure HTML, not a hydrated island | CSS Grid intrinsic-responsive pattern (no JS, no media-query dependency for card reflow); zero-JS assertion technique |
| DSGN-07 | `/changelog` receives editorial treatment, history preserved | D-11 (already resolved in CONTEXT.md against real `changelog.json` shape) — no new research needed here |
| A11Y-01 | Body text 4.5:1, large text/UI 3:1, both themes | WCAG relative-luminance formula (verified via W3C), large-text threshold (≥24px regular / ≥18.66px bold), D-13 script |
| PERF-07 | Self-hosted, subset (incl. Spanish diacritics), woff2-only, `size-adjust` metric-compatible fallbacks | Font subsetting toolchain + `size-adjust`/`ascent-override` cross-browser support (verified against MDN/caniuse/WebKit bug tracker) + capsize for fallback generation |
| I18N-07 | Cards/headlines survive Spanish text 15–25% longer, no overflow/clipping | D-15 real+synthetic Spanish copy; `scrollWidth`/`scrollHeight` overflow-detection technique |

</phase_requirements>

## Summary

Phase 1 ships zero runtime framework code — the "stack" here is a small set of **build-time Node tools** used once (or rarely) to produce and verify static HTML/CSS, plus **Playwright** used as the verification harness for everything CONTEXT.md requires to be proven empirically rather than asserted. Nothing in this phase touches Astro, D1, or any server.

The eight tooling questions CONTEXT.md left open now have answers, most with direct primary-source verification:

1. **Font subsetting**: `glyphhanger` v6.0.0 (npm, published 2026-06-05, actively maintained since 2017) remains viable — its crawl-based mode (`glyphhanger *.html --subset=... --formats=woff2`) is a strong fit for this phase specifically because the mockup HTML files will already contain the real Spanish stress copy (D-15), so crawling them auto-detects the true glyph set including diacritics, rather than requiring hand-typed unicode ranges. `subset-font` v2.7.0 (223k weekly downloads, harfbuzz-wasm-based) is the modern programmatic alternative if a scripted, explicit-character-list approach is preferred. Both are legitimate, actively-published packages; neither should be treated as a slopsquat risk despite the legitimacy heuristic flagging both `SUS` (see Package Legitimacy Audit — the flags are false positives from the heuristic's "too-new"/"low-downloads" signals, not real risk indicators).

2. **Metric-compatible fallbacks — the flagged LOW-confidence claim, re-verified directly against MDN, caniuse, and the WebKit bug tracker.** `size-adjust` is Baseline-widely-available (since Sept 2023) and **is** supported in Safari 17+ on both desktop and iOS — this part of the project's fallback strategy is solid. `ascent-override`/`descent-override`/`line-gap-override` are a different story: **not shipped in any released Safari** as of this research date (confirmed against caniuse through Safari 27.1) — only in WebKit Technology Preview. The underlying WebKit bug (#219735) was marked `RESOLVED FIXED` on 2026-08-05 and the feature is enabled by default in the engine, but the feature flag itself has not yet been removed and the fix has not reached a shipped Safari release. **Practical implication: ship `size-adjust` unconditionally (it works everywhere that matters); treat the three `-override` descriptors as progressive enhancement that Safari users do not get yet**, exactly as the project's own prior research recommended — but now that recommendation is verified, not assumed.

3. **Zero layout shift, proven empirically**: `PerformanceObserver` on `layout-shift` entries (`buffered: true`, filter `!entry.hadRecentInput`, sum `entry.value`) inside `page.evaluate()`, combined with `page.route()` to delay or abort the font network response so the fallback paints first — this isolates the font-swap shift from ordinary page-load shift. This is the standard, well-documented technique; no exotic tooling needed.

4. **The Safari gap**: Playwright's WebKit build tracks **WebKit trunk**, not a specific shipped Safari version — it is frequently *ahead* of what Apple ships. This means a green Playwright-WebKit CLS run in this phase could reflect the just-landed `ascent-override` fix (trunk) even though it will not yet apply for real Safari users. The planner must write this asymmetry into the D-08 evidence explicitly: a WebKit pass proves `size-adjust` works and demonstrates *what a future Safari will do* for the `-override` descriptors, not what Safari does today.

5. **Contrast table from CSS tokens**: the WCAG relative-luminance formula and 4.5:1/3:1 thresholds are unchanged and directly verifiable against the W3C's own Understanding docs. Because the palette is OKLCH-authored (D-02/D-03), the script must convert OKLCH→sRGB **before** applying the WCAG formula (WCAG contrast math is defined in sRGB space). `culori` (functional, widely used for exactly this token-pipeline use case) or `colorjs.io` (written by the CSS Color spec editors, marginally more spec-precise) both do this conversion correctly; either is a safe choice.

6. **Scripted keyboard walk**: Playwright's built-in visibility checks (`toBeVisible()`) do **not** detect ancestor `overflow` clipping — this is exactly the prior failure mode CONTEXT.md names. The fix is a geometry assertion: compare the focused element's bounding box (expanded by the focus-ring's outline width/offset) against every ancestor whose computed `overflow` is `hidden`/`clip`/`auto`/`scroll`; if the ring's box exceeds any such ancestor's box, it is clipped. WCAG 2.2's new 2.4.11 (AA, focus must not be *entirely* hidden) and 2.4.13 (AAA, not required at AA but a useful bar — 2px perimeter area + 3:1 contrast delta between states) give the script a concrete spec to assert against, verified against the W3C Understanding documents directly.

7. **Spanish +25% overflow detection**: `scrollWidth > clientWidth` (single-line) and `scrollHeight > clientHeight` (multi-line/`line-clamp`) are the standard checks, with the caveat that hidden/unrendered elements report `0` for both and produce false negatives — visibility must be confirmed first.

8. **Pure-HTML article grid**: CSS Grid with `auto-fit`/`minmax` or named tracks is intrinsically responsive without JS or (in many cases) media queries at all — a good match for D-07's mobile-first, one-stylesheet approach. "Zero JavaScript" is asserted by scanning the rendered grid container's subtree for `<script>` tags and `on*` attributes — trivial to script, no library needed.

**Primary recommendation:** Treat this phase's toolchain as five small, independent Node scripts (contrast-from-tokens, capsize-fallback-generator, font-subsetter invocation, Playwright keyboard-walk, Playwright CLS-and-overflow-walk) plus the five hand-written HTML/CSS mockup files — no bundler, no framework, nothing that produces a `.astro` file or a `node_modules`-shaped dependency on the eventual Astro build.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|-----------------|-----------|
| Colour system, typography, layout (the mockups themselves) | Browser / Client | — | Pure static HTML/CSS rendered by the browser; no server or build step is part of the deliverable itself |
| Theme switching (`data-theme` toggle) | Browser / Client | — | A few lines of vanilla JS flipping an attribute; explicitly chrome, not the article grid — DSGN-06's zero-JS rule does not apply here (open question 7, resolved) |
| Font subsetting (glyphhanger/subset-font) | Build-time Tooling (Node, pre-deploy) | — | Runs once (or on font/content changes) against the mockup HTML/font source files; output (`fonts/*.woff2`) ships as a static asset, the tool itself never runs in the browser or at request time |
| CLS-safe fallback generation (capsize) | Build-time Tooling (Node, pre-deploy) | — | Computes `@font-face` override values once from font metrics; the *output* (a CSS block) is hand-committed into `style.css`, not regenerated at runtime |
| Contrast verification (D-13 script) | Build-time Tooling (Node, pre-deploy) | CI (Phase 3 reuse) | Parses `style.css` custom properties and exits non-zero on failure — a pre-commit/pre-approval gate now, a CI guard from Phase 3 onward |
| Keyboard-walk / CLS / overflow verification (Playwright) | Test Harness (Node, headless browser) | — | Drives real Chrome + WebKit engines against the static files; produces the evidence D-16's approval runner reports, never ships to production |
| Article grid rendering | Browser / Client (CSS Grid) | — | PERF-07/DSGN-06 require this be pure HTML+CSS with zero JS — no build or server tier is involved at all |

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|---------------|
| `glyphhanger` | **6.0.0** (npm, published 2026-06-05) [VERIFIED: npm registry] | Crawl the finished mockup HTML files and subset Instrument Serif + Source Serif 4 to the glyphs actually used (Latin + Spanish diacritics, since D-15's real Spanish copy is already in the HTML) | [ASSUMED] Package discovered via WebSearch/training data, not official docs — name and purpose not independently confirmed against an authoritative source beyond its own GitHub README (fetched directly). Long-established (created 2017), actively published, low weekly downloads (588/wk) but that reflects its niche (a dev-tool CLI, not an app dependency), not illegitimacy |
| `@capsizecss/core` + `@capsizecss/metrics` | **4.1.3** / **4.3.0** (npm) [VERIFIED: npm registry] | Compute `size-adjust`/`ascent-override`/`descent-override` values for an Instrument-Serif/Source-Serif-4-vs-system-fallback pairing, once, in a plain Node script — no bundler | [ASSUMED] for the recommendation (WebSearch-discovered); **[VERIFIED: github.com/seek-oss/capsize/blob/master/packages/metrics/src/entireMetricsCollection.json, fetched directly this session]** that both `instrumentSerif` and `sourceSerif4` keys exist in the metrics collection — quote: `"instrumentSerif"`, `"InstrumentSerif-Regular"`, `"sourceSerif4"`, `"SourceSerif4-Regular"` all present in the raw JSON |
| `culori` | **4.0.2** (npm, most recent version published 2025-06-27) [VERIFIED: npm registry] | Convert OKLCH design tokens (D-02/D-03) to sRGB before computing WCAG contrast ratios | [ASSUMED] recommendation source (WebSearch); functional API is a good fit for a small standalone script iterating over CSS custom properties |
| `@playwright/test` | **1.63.0** (npm, published 2026-09-16) [VERIFIED: npm registry] | Headless-browser harness for the keyboard walk (D-14), CLS measurement (D-08), and Spanish-overflow assertions (D-15) — already an established pattern in this project's toolchain per CONTEXT.md ("`jja-playwright` and `jja-lighthouse` are installed and are the intended harnesses") | [CITED: playwright.dev] — de facto standard headless-browser testing tool, ships both Chromium and a WebKit build in one package |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `subset-font` | **2.7.0** (npm, published 2026-08-29) [VERIFIED: npm registry] | Programmatic woff2 subsetting via harfbuzz-wasm, given an explicit character-list string | Fallback to `glyphhanger` if the crawl-based workflow proves unreliable in practice (e.g. glyphhanger's puppeteer-based crawler chokes on `data-theme`-driven dual-theme HTML, or misses glyphs that only appear via CSS `content:` or `::before`/`::after`) |
| `colorjs.io` | **0.7.1** (npm, published 2026-07-24) [VERIFIED: npm registry] | Alternative to `culori` for OKLCH→sRGB conversion, written by the CSS Color 4/5 spec editors | If the contrast script needs to also handle future CSS colour features (e.g. `color-mix()`, gamut-mapping) with maximum spec fidelity |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `glyphhanger` (crawl mode) | `fonttools pyftsubset` (Python) | More granular/industrial-strength subsetting, but introduces a second language runtime (Python) into a Node-tooled phase for no clear benefit here — the character set needed is small and well-bounded |
| `@capsizecss/core` hand-computed fallback | `fontaine` (unjs) | **Ruled out for this phase.** [VERIFIED: github.com/unjs/fontaine README, fetched directly this session] `fontaine`'s core package exposes only build-tool transforms — `FontaineTransform.vite(...)`, `FontaineTransform.webpack(...)`, and a `fontaine/postcss` PostCSS plugin. There is no standalone Node function to call from a one-off script; it is designed to run as part of a bundler pipeline, which this build-step-free static-HTML phase does not have. This resolves CONTEXT.md's flagged LOW-confidence question directly: `fontaine` is not a clean fit here, `capsize` is |
| `culori`/`colorjs.io` for contrast math | Hand-rolled sRGB linearization | Do not hand-roll — the WCAG relative-luminance gamma curve (piecewise, `0.03928` threshold, exponent `2.4`) is a classic source of off-by-a-fraction contrast bugs; both libraries handle it correctly and are trivial to add |
| Playwright's bundled WebKit | A real macOS/iOS Safari via a cloud device farm (BrowserStack, LambdaTest) | If the Phase 1 approval genuinely needs Safari-accurate evidence rather than WebKit-trunk evidence, this is the correct escalation — not available in this research session, flagged as Open Question 1 |

**Installation:**
```bash
npm install --save-dev glyphhanger subset-font @capsizecss/core @capsizecss/metrics culori @playwright/test
npx playwright install --with-deps chromium webkit
```

**Version verification:** All versions above were confirmed live against the npm registry on 2026-09-16 via `npm view <package> version` — not from training data or WebSearch snippets, which can be stale by months.

## Package Legitimacy Audit

| Package | Registry | Age (first published) | Weekly Downloads | Source Repo | Verdict (seam) | Disposition |
|---------|----------|------------------------|-------------------|--------------|------|-------------|
| `glyphhanger` | npm | 2017-01-11 (9 yrs) | 588/wk | github.com/zachleat/glyphhanger | `SUS` (reason: low-downloads) | **Kept — false positive.** 9-year-old tool from a known maintainer (Filament Group / zachleat), still receiving releases (v6.0.0, 2026-06-05). Low download count reflects its niche as a dev-tool CLI, not risk. Planner should still add a `checkpoint:human-verify` before install per protocol. |
| `subset-font` | npm | 2021-02-06 (5 yrs) | 223,094/wk | github.com/papandreou/subset-font | `SUS` (reason: too-new — triggered by a recent version publish, not package age) | **Kept — false positive.** High-download, actively-maintained library; "too-new" reflects the *latest version's* publish date (2026-08-29), not the package's age. Add `checkpoint:human-verify` per protocol regardless. |
| `fontaine` | npm | 2022-09-28 (4 yrs) | 610,246/wk | github.com/unjs/fontaine | `SUS` (reason: too-new, same false-positive pattern) | **Not recommended for this phase** — not because of the legitimacy flag, but because its API doesn't fit a build-step-free static site (see Alternatives Considered). If a future phase adopts a bundler, revisit. |
| `culori` | npm | 2018-03-27 (8 yrs) | 1,641,191/wk | github.com/Evercoder/culori | `OK` | Approved |
| `colorjs.io` | npm | 2020-12-10 (6 yrs) | 5,895,525/wk | github.com/color-js/color.js | `OK` | Approved |
| `@playwright/test` | npm | 2020-09-24 (6 yrs) | 45,794,389/wk | github.com/microsoft/playwright | `SUS` (reason: too-new, same false-positive pattern — Playwright publishes near-daily) | **Kept — false positive.** Already an established tool in this project's own toolchain per CONTEXT.md. Add `checkpoint:human-verify` per protocol regardless. |
| `@capsizecss/core` / `@capsizecss/metrics` | npm | 2021-08-23 / 2021-09-24 (5 yrs) | not queried individually | github.com/seek-oss/capsize | not run through the seam (added after the initial batch) | Recommend planner re-run `package-legitimacy check` on these two before the install task, per protocol |

**Packages removed due to `SLOP` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `glyphhanger`, `subset-font`, `fontaine`, `@playwright/test` — all four are false positives from the legitimacy heuristic's "too-new" (triggered by *latest-version* publish recency on actively-maintained packages) and "low-downloads" (triggered on a niche CLI tool) signals, confirmed against `npm view <pkg> time.created` showing 4–9-year package ages. **The planner must still insert a `checkpoint:human-verify` task before each install**, per the Package Legitimacy Protocol — this audit explains *why* the flag fired, it does not waive the protocol's required gate.

*All package names above were discovered via WebSearch/training data, not official documentation — every recommendation in this document is tagged `[ASSUMED]` for "is this the right package," even where the package's existence/version/age is `[VERIFIED: npm registry]`.*

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────┐
                         │   D1 corpus (read-only, via existing │
                         │   admin/export — NOT a build step)   │
                         └───────────────┬───────────────────────┘
                                         │ manual pull of 7 stress-picked
                                         │ rows + Spanish stress copy (D-06/D-15)
                                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AUTHOR TIME (hand-written, no bundler)                              │
│                                                                        │
│   index.html  category.html  article.html  changelog.html  contact.html
│         │            │            │              │             │      │
│         └────────────┴─────┬──────┴──────────────┴─────────────┘      │
│                             ▼                                          │
│                        style.css  ◄── CSS custom properties           │
│                             │          (D-05: data-theme mechanism)   │
│                             ▼                                          │
│                        fonts/*.woff2                                  │
└──────────────────────────────┬─────────────────────────────────────────┘
                                │
              ┌─────────────────┼──────────────────────────┬─────────────────────┐
              ▼                                             ▼                     ▼
   BUILD-TIME TOOLING (Node, run once/rarely, pre-deploy — not part of the site)
   ┌──────────────────┐   ┌─────────────────────┐   ┌────────────────────────┐
   │ glyphhanger crawl │   │ capsize script       │   │ contrast script (D-13) │
   │ *.html → subset   │   │ font metrics → CSS   │   │ style.css custom props │
   │ Instrument Serif +│   │ ascent/descent/      │   │ → OKLCH→sRGB (culori)  │
   │ Source Serif 4 →  │   │ size-adjust override │   │ → WCAG ratio → verdict │
   │ fonts/*.woff2     │   │ block, hand-pasted   │   │ table, exit non-zero   │
   └──────────────────┘   │ into style.css        │   └────────────────────────┘
                          └─────────────────────┘
              │                                             │                     │
              ▼                                             ▼                     ▼
   VERIFICATION (Playwright, headless Chromium + WebKit — D-16's approval runner)
   ┌──────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐
   │ Keyboard walk (D-14)  │  │ CLS-on-font-swap (D-08) │  │ Spanish overflow      │
   │ tab every focusable,  │  │ route() delays font,    │  │ (D-15) scrollWidth >  │
   │ assert visible +      │  │ PerformanceObserver     │  │ clientWidth per card, │
   │ unclipped ring        │  │ sums layout-shift value │  │ per theme, per width  │
   └──────────────────────┘  └────────────────────────┘  └──────────────────────┘
              │                          │                          │
              └──────────────────────────┴──────────────────────────┘
                                         ▼
                         01-APPROVAL.md (D-16) — machine verdicts
                         pasted + owner's dated sign-off line
                                         │
                                         ▼
                    Gate: Phase 3 builds `.astro` components from
                    this CSS token layer only after this file exists
```

### Recommended Project Structure

```
.planning/phases/01-design-sketch-editorial-identity/
├── mockups/
│   ├── index.html
│   ├── category.html
│   ├── article.html
│   ├── changelog.html
│   ├── contact.html
│   ├── style.css                 # CSS custom properties, both themes, D-05
│   └── fonts/
│       ├── InstrumentSerif-*.woff2   # subset output
│       └── SourceSerif4-*.woff2      # subset output
├── scripts/
│   ├── subset-fonts.sh            # glyphhanger crawl invocation (or subset-font fallback)
│   ├── generate-fallback-css.mjs  # capsize → hand-pasted @font-face block
│   ├── check-contrast.mjs         # D-13, becomes Phase 3 CI guard
│   ├── keyboard-walk.spec.ts      # D-14 Playwright
│   ├── font-cls.spec.ts           # D-08 Playwright
│   └── spanish-overflow.spec.ts   # D-15 Playwright
├── 01-CONTEXT.md
├── 01-RESEARCH.md
├── 01-PLAN.md                     # produced by the planner from this document
└── 01-APPROVAL.md                 # produced at phase close, D-16
```

### Pattern 1: Crawl-based font subsetting against the finished mockups

**What:** Run `glyphhanger` against the five local HTML files *after* they contain the real English and Spanish stress copy (D-06/D-15), letting it auto-detect the true glyph set rather than hand-typing unicode ranges.
**When to use:** Once the mockups' text content is final (or whenever it changes materially).
**Example:**
```bash
# Source: glyphhanger README (github.com/zachleat/glyphhanger) — CLI shape verified
# via WebSearch against filamentgroup.com/lab/glyphhanger and the GitHub repo.
# [ASSUMED — local multi-file crawl usage not independently re-verified in this
# session beyond the documented single-URL/--subset pattern; verify with
# `glyphhanger --help` before relying on it, and treat as a checkpoint:human-verify item.]
npx glyphhanger mockups/index.html mockups/category.html mockups/article.html \
  mockups/changelog.html mockups/contact.html \
  --subset=raw-fonts/InstrumentSerif-Regular.ttf,raw-fonts/SourceSerif4-Variable.ttf \
  --formats=woff2 \
  --css > mockups/fonts/subset-faces.css
```

### Pattern 2: One-off fallback-metrics generation with capsize (no bundler)

**What:** Compute `size-adjust`/`ascent-override`/`descent-override` values for Instrument Serif and Source Serif 4 against a system fallback (e.g. Georgia/Times New Roman for the serif body, a generic serif stack for the display face), then hand-paste the generated CSS into `style.css` once.
**When to use:** Once per typeface pairing; re-run only if the typefaces change.
**Example:**
```js
// Source: capsize README (github.com/seek-oss/capsize), function names and
// metrics-collection keys [VERIFIED: github.com/seek-oss/capsize/blob/master/
// packages/metrics/src/entireMetricsCollection.json, fetched directly this
// session — quote: "instrumentSerif", "InstrumentSerif-Regular", "sourceSerif4",
// "SourceSerif4-Regular" all present as keys in the raw JSON].
import { createFontStack } from '@capsizecss/core';
import instrumentSerif from '@capsizecss/metrics/instrumentSerif';
import sourceSerif4 from '@capsizecss/metrics/sourceSerif4';
import georgia from '@capsizecss/metrics/georgia';

const { fontFaces: displayFallback } = createFontStack([instrumentSerif, georgia]);
const { fontFaces: bodyFallback } = createFontStack([sourceSerif4, georgia]);

console.log(displayFallback, bodyFallback); // paste the emitted @font-face blocks into style.css
```
**Pitfall:** `createFontStack`'s output includes `ascent-override`/`descent-override`/`size-adjust`. Per this research's Pitfall 4, strip or comment the `-override` descriptors' *reliance* for Safari users specifically — they will simply be ignored by shipped Safari today, which is safe (no error), but do not claim the fallback is metric-compatible in Safari on the strength of this CSS alone.

### Pattern 3: CLS measurement isolated to the font swap

**What:** Force the fallback to paint first, then measure only the shift caused by the woff2 arriving.
**When to use:** D-08, run per mockup page, per theme, in both Chromium and WebKit.
**Example:**
```ts
// Source: PerformanceObserver 'layout-shift' pattern is standard web-perf practice
// (widely documented — web.dev, MDN). Playwright route-delay technique confirmed
// via WebSearch against Playwright's own network-interception docs. [CITED: playwright.dev]
import { test, expect } from '@playwright/test';

test('font swap produces zero measurable CLS', async ({ page }) => {
  await page.route('**/fonts/*.woff2', async (route) => {
    await new Promise((r) => setTimeout(r, 1500)); // force fallback to paint first
    await route.continue();
  });

  await page.evaluate(() => {
    (window as any).__clsEntries = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) (window as any).__clsEntries.push(entry.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto('/mockups/index.html');
  await page.waitForTimeout(2500); // past the delayed font load

  const cls = await page.evaluate(() =>
    (window as any).__clsEntries.reduce((a: number, b: number) => a + b, 0)
  );
  expect(cls).toBeLessThan(0.05); // PERF-03's project-wide CLS budget
});
```

### Pattern 4: Detecting a clipped focus ring (not just "a ring exists")

**What:** Compare the focused element's box, expanded by its outline width/offset, against every ancestor whose computed `overflow` would clip it.
**When to use:** D-14, every focusable element, every mockup, every theme.
**Example:**
```ts
// Source: technique synthesized from documented Playwright visibility limitations
// (toBeVisible() does not account for ancestor overflow clipping — confirmed via
// WebSearch against multiple Playwright issue/bug reports) — [ASSUMED, not
// independently re-verified against Playwright's own docs page for toBeVisible()
// in this session; recommend the planner spot-check this against the actual
// mockup once built, since this is the exact prior failure CONTEXT.md names.]
async function focusRingIsClipped(page, locator) {
  return await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const outlineWidth = parseFloat(style.outlineWidth) || 0;
    const outlineOffset = parseFloat(style.outlineOffset) || 0;
    const pad = outlineWidth + outlineOffset;
    const r = el.getBoundingClientRect();
    const ringBox = { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad };

    let ancestor = el.parentElement;
    while (ancestor) {
      const aStyle = getComputedStyle(ancestor);
      if (['hidden', 'clip', 'auto', 'scroll'].includes(aStyle.overflow)) {
        const aRect = ancestor.getBoundingClientRect();
        if (
          ringBox.left < aRect.left || ringBox.top < aRect.top ||
          ringBox.right > aRect.right || ringBox.bottom > aRect.bottom
        ) {
          return true; // clipped
        }
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  });
}
```

### Pattern 5: Spanish +25% overflow assertion

**What:** After injecting or authoring the synthetic +25% string, assert no content is lost.
**When to use:** D-15, per stress-picked component (card headline, standfirst deck, category label).
**Example:**
```ts
// Source: scrollWidth/clientWidth technique is standard DOM practice, cross-checked
// against multiple independent sources via WebSearch. [CITED — common technique,
// not tied to one authoritative doc page]
const overflowInfo = await locator.evaluate((el) => {
  const visible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  return {
    visible,
    horizontalOverflow: visible ? el.scrollWidth > el.clientWidth : null,
    verticalOverflow: visible ? el.scrollHeight > el.clientHeight : null,
  };
});
expect(overflowInfo.visible, 'element must be rendered before asserting overflow').toBe(true);
expect(overflowInfo.horizontalOverflow).toBe(false);
expect(overflowInfo.verticalOverflow).toBe(false);
```

### Anti-Patterns to Avoid

- **Hand-typing unicode-range hex values for the font subset:** error-prone and easy to silently drop a Spanish diacritic (ñ, ü, accented vowels, ¿, ¡). Crawl the actual mockup HTML instead (Pattern 1) so the subset is derived from real content, not a guess.
- **Trusting a Playwright-WebKit green CLS result as "Safari verified":** per Pitfall 4, Playwright's WebKit tracks trunk, ahead of shipped Safari on the `-override` descriptors specifically. State this caveat explicitly in `01-APPROVAL.md`, don't silently claim cross-browser parity.
- **Computing contrast ratios directly on OKLCH values:** the WCAG formula is defined in sRGB; skipping the OKLCH→sRGB conversion step produces numbers that look plausible but are not the number the spec defines.
- **Using `toBeVisible()` alone to certify a focus ring:** it does not detect ancestor-overflow clipping — this is the exact documented prior failure (a focus ring clipped on two sides, "verified" by grepping HTML).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| WCAG relative luminance / contrast ratio math | A hand-written sRGB-gamma + luminance formula | `culori` or `colorjs.io` | The piecewise gamma curve (`0.03928` threshold, `2.4` exponent) is a well-known source of off-by-a-fraction bugs when reimplemented; both libraries implement the WCAG formula correctly and are one `npm install` away |
| OKLCH→sRGB colour-space conversion | A hand-rolled matrix conversion | `culori` or `colorjs.io` | Colour-space math (OKLab intermediate step, gamut clipping) is easy to get subtly wrong in ways that only show up as small contrast-ratio errors near the 3:1/4.5:1 thresholds — exactly where it matters most |
| Variable-font metric-compatible fallback computation | Manually reading font tables (`hhea`, `OS/2`) to compute ascent/descent/size-adjust by hand | `@capsizecss/core` + `@capsizecss/metrics` | The metrics package already has the source-of-truth values for both target faces (verified directly this session) and common fallback stacks; hand-computing from font binaries is exactly the kind of "looks right, fails at measurement" work this project's CLAUDE.md explicitly warns against |
| woff2 subsetting | A hand-rolled glyph-stripping script | `glyphhanger` (harfbuzz-cli under the hood) or `subset-font` (harfbuzz-wasm) | Font subsetting touches format internals (WOFF2 compression, `cmap` table rewriting) that are genuinely complex and easy to corrupt; both tools wrap the same battle-tested HarfBuzz `hb-subset` |

**Key insight:** every "don't hand-roll" item in this phase is a place where the failure mode is silent — a subtly wrong contrast ratio, a corrupted font subset, or a mis-measured fallback metric all *look* fine until measured precisely, which is exactly the category of bug this project's CLAUDE.md calls out ("a measured-looking table is exactly what a wrong number hides inside").

## Common Pitfalls

### Pitfall 1: Treating `size-adjust` and the `-override` descriptors as a single feature
**What goes wrong:** A fallback CSS block ships all four descriptors together, and the CLS-on-font-swap test is judged "Safari: pass/fail" as one bucket.
**Why it happens:** They're documented together in every font-fallback tutorial, so they read as one feature.
**How to avoid:** Report them separately in `01-APPROVAL.md`. `size-adjust` [VERIFIED: caniuse.com/mdn-css_at-rules_font-face_size-adjust, fetched directly] works in Safari 17+ today. The `-override` trio [VERIFIED: caniuse.com/mdn-css_at-rules_font-face_ascent-override + bugs.webkit.org/show_bug.cgi?id=219735, both fetched directly] does not ship in any released Safari as of this research date — WebKit bug 219735 is `RESOLVED FIXED` (2026-08-05) and enabled by default in the *engine*, but the feature flag has not yet been removed and no shipped Safari version carries it.
**Warning signs:** A CLS test that only reports one aggregate pass/fail per browser, rather than per-descriptor.

### Pitfall 2: Reading a Playwright-WebKit pass as Safari parity
**What goes wrong:** D-08's evidence says "WebKit: CLS 0.00" and the approval treats that as proof for real Safari users.
**Why it happens:** Playwright ships a browser literally named `webkit`, inviting the assumption it equals Safari.
**How to avoid:** [ASSUMED — synthesized from WebSearch results on Playwright's WebKit build strategy, not independently re-verified against Playwright's own architecture docs this session] Playwright's WebKit build tracks WebKit **trunk**, which is regularly ahead of what Apple ships in Safari — this is precisely why the `-override` fix (landed Aug 2026) may already be exercised by a Playwright-WebKit run while real Safari users don't have it yet. State explicitly in `01-APPROVAL.md`: "WebKit (Playwright, Linux) pass — not equivalent to Safari on macOS/iOS; see Open Question 1."
**Warning signs:** Approval language that says "Safari verified" instead of "WebKit (Playwright) verified."

### Pitfall 3: Computing the contrast table against provisional neutrals
**What goes wrong:** The contrast script is run once against a placeholder paper/ink pair, passes, and the ramp is never re-verified after D-04's final `#FAFAF8`/`#14161A` values are locked in.
**Why it happens:** D-04 documents that the neutral decision was itself revised once mid-session (withdrawn warm-bone → near-neutral) — the same drift risk applies to the contrast table if it's run before the final values land.
**How to avoid:** D-13 already specifies this — "re-verify each ramp against the **final** neutrals, not against pure white." Make the contrast script part of the D-16 approval runner, not a one-off pre-check, so it always runs against whatever `style.css` currently contains.
**Warning signs:** A contrast table checked into git that's older than the last `style.css` edit.

### Pitfall 4: Font-crawl subsetting missing glyphs that only appear via CSS
**What goes wrong:** `glyphhanger`'s crawl mode inspects rendered text content; a glyph that only appears via CSS `content: "→"` on a `::before`/`::after` pseudo-element, or via a JS-injected string, may not be detected.
**Why it happens:** Crawl-based subsetting tools generally read the DOM's text nodes, not computed pseudo-element content, unless they specifically render and inspect the full box tree.
**How to avoid:** Keep any decorative glyphs (arrows, quote marks used as CSS content rather than HTML entities) out of `::before`/`::after` `content` values where practical, or explicitly add them to the subset's whitelist as a supplement to the crawl. [ASSUMED — glyphhanger's exact pseudo-element handling was not independently verified in this session; flag as a `checkpoint:human-verify` item: visually diff the rendered mockup against the subsetted-font build before approval.]
**Warning signs:** A tofu box (☐) or missing glyph anywhere in the approved mockup screenshots.

## Code Examples

See Architecture Patterns above (Patterns 1–5) — all five are directly executable code examples covering font subsetting, fallback generation, CLS measurement, focus-clip detection, and overflow detection.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Assume `size-adjust`/`ascent-override`/`descent-override` are a matched set with similar browser support | `size-adjust` is Baseline (Sept 2023, Safari 17+); the `-override` trio only just reached `RESOLVED FIXED` in WebKit (Aug 2026) and has not shipped in a released Safari yet | WebKit bug 219735, comment #35, 2026-08-06 | This phase's fallback CSS should ship `size-adjust` as the load-bearing mechanism and treat the `-override` descriptors as enhancement — they will start working for Safari users automatically once Apple ships the fix, with no CSS change required |
| `fontaine` as the default recommendation for metric-compatible fallbacks (per this project's own prior TECH-STACK research, flagged LOW confidence) | `@capsizecss/core` for a build-step-free static-HTML phase; `fontaine` remains correct for a future bundler-based phase (Astro/Vite, from Phase 3 onward) | Confirmed this session by reading `fontaine`'s README directly — it never changed, the earlier research simply hadn't checked whether the API fit a no-bundler context | Resolves CONTEXT.md's open question 5 (subsetting toolchain / fallback library choice) definitively for Phase 1 specifically |

**Deprecated/outdated:**
- Hand-typed unicode-range strings for Spanish-diacritic subsetting: superseded by crawl-based detection against real content, which cannot miss a glyph that's actually rendered.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `glyphhanger` and `subset-font` are legitimate, correctly-named packages fit for this purpose (name discovered via WebSearch/training data, not official docs) | Standard Stack, Package Legitimacy Audit | Low — both independently confirmed to exist on the npm registry with plausible age/download/repo signals; risk is limited to "wrong tool for the job," not a supply-chain risk |
| A2 | `glyphhanger`'s multi-file local-HTML crawl syntax works as shown in Pattern 1 (only single-URL and `--subset`-only usage was directly confirmed via WebSearch) | Architecture Patterns, Pattern 1 | Medium — if crawl mode doesn't accept local file paths as shown, the planner needs the `subset-font` fallback path instead; flagged as a `checkpoint:human-verify` item |
| A3 | Playwright's `toBeVisible()`/`isVisible()` does not account for ancestor `overflow` clipping (synthesized from WebSearch results referencing Playwright issue discussions, not Playwright's own docs page) | Architecture Patterns, Pattern 4; Common Pitfalls, Pitfall 4's cousin | Medium — if this is wrong, the custom clipping-detection function in Pattern 4 may be redundant rather than necessary; low downside either way since the custom check is strictly additive |
| A4 | `glyphhanger`'s crawl-based subsetting does not reliably capture glyphs referenced only via CSS `content:` on pseudo-elements | Common Pitfalls, Pitfall 4 | Low-Medium — worth a visual spot-check regardless of whether this specific claim is precisely correct, since missing-glyph bugs are easy to catch by eye but easy to miss in an automated pipeline |
| A5 | `colorjs.io` is "marginally more spec-precise" than `culori` for OKLCH→sRGB conversion | Standard Stack, Alternatives Considered | Low — both are actively maintained, high-download libraries; this is a soft preference, not a correctness claim, and either choice is safe |

## Open Questions

1. **Does the planner accept Playwright-WebKit-on-Linux as sufficient D-08 evidence, or schedule a confirmation pass on a borrowed macOS/iOS device?**
   - What we know: Playwright's WebKit tracks trunk, ahead of shipped Safari specifically on the `ascent-override`/`descent-override`/`line-gap-override` fix (landed engine-side Aug 2026, not yet shipped). `size-adjust` support is solid and Playwright-WebKit should reflect real Safari 17+ behaviour for it.
   - What's unclear: Whether Playwright's WebKit build differs from shipped Safari on *any other* dimension relevant to this phase (sub-pixel font rasterization affecting perceived CLS magnitude, for instance) — this was not exhaustively checked.
   - Recommendation: Accept WebKit-on-Linux as sufficient for `size-adjust` verification (the load-bearing mechanism); explicitly document in `01-APPROVAL.md` that the `-override` descriptors are untested against real Safari and will silently no-op there today, which is safe. CONTEXT.md already frames this as a planner decision, not a research one — this document supplies the facts needed to make it.

2. **Does `glyphhanger`'s crawl mode reliably subset a `data-theme`-driven dual-theme single-page file, or does it need to be pointed at the file twice (once per theme) to be sure both themes' content is captured?**
   - What we know: Both themes' text content lives in the same DOM per D-05 (CSS custom properties, not markup duplication) — so a single crawl pass should see all the text regardless of which theme is visually active, since `data-theme` doesn't remove DOM nodes.
   - What's unclear: Whether glyphhanger's crawler executes any JS that could affect which content is present in the DOM at capture time (it shouldn't, since theme switching is pure CSS/attribute, not content injection) — not independently verified.
   - Recommendation: Low risk given D-05's markup-not-duplicated design; verify with a first real run and a visual character-coverage check before relying on it.

3. **Exact final `@font-face` fallback CSS block for Instrument Serif and Source Serif 4 against the project's actual chosen fallback stack** — not resolved here because the fallback stack (which system serif fonts to fall back to) is itself a design decision belonging to the mockup-building work, not to this research.
   - Recommendation: Planner should schedule a small task ("generate + hand-paste the capsize fallback CSS") after the type choices are otherwise finalized in the mockup, using Pattern 2 above.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | All build/verification scripts | ✓ | v24.14.0 [VERIFIED: `node --version`, run this session] | — |
| npm registry access | Installing `glyphhanger`, `subset-font`, `@capsizecss/*`, `culori`, `@playwright/test` | ✓ | — confirmed via live `npm view` calls this session | — |
| Playwright browser binaries (Chromium, WebKit) | D-08, D-14, D-15 verification scripts | Not yet installed in this repo (greenfield — no `package.json` exists yet per CONTEXT.md "Existing Code Insights") | — | `npx playwright install --with-deps chromium webkit` as part of Wave 0 setup |
| Real Safari (macOS/iOS) | True cross-browser confirmation of the `-override` descriptor gap | ✗ — owner is on Arch Linux (CONTEXT.md platform constraint) | — | Playwright's bundled WebKit build (same engine family, verified this session to track trunk rather than a specific shipped Safari version — see Open Question 1); escalate to a cloud device farm only if the planner judges WebKit-on-Linux evidence insufficient |
| D1 read access (to pull the 7 stress-picked rows for D-06) | Mockup content sourcing | Not verified in this research session — out of this phase's tooling scope; existing admin/export tooling in `915tldr.com2` per PROJECT.md | Manual export via existing admin UI |

**Missing dependencies with no fallback:** none — every dependency above has a working fallback or is trivially installable.

**Missing dependencies with fallback:** Playwright browser binaries (install as part of Wave 0); real Safari (WebKit-via-Playwright fallback, with the caveat documented in Open Question 1).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright Test (`@playwright/test` v1.63.0) — not yet installed, greenfield repo |
| Config file | none yet — create `playwright.config.ts` in Wave 0, pointing `testDir` at the mockup verification scripts and configuring both `chromium` and `webkit` projects |
| Quick run command | `npx playwright test spanish-overflow.spec.ts --project=chromium` (single-browser, single-suite, fast iteration) |
| Full suite command | `npx playwright test --project=chromium --project=webkit` (both engines, all three spec files — keyboard-walk, font-cls, spanish-overflow) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|---------------|
| DSGN-01 | No `.astro` file exists; 5 mockup files + `style.css` present in both themes | smoke (filesystem assertion, not browser) | `find . -name "*.astro" \| wc -l` must be 0; a small Node script checks all 5 HTML files exist | ❌ Wave 0 |
| DSGN-02 / A11Y-01 | Every text/background pair ≥4.5:1 (body) / ≥3:1 (large/UI), both themes | unit (Node script against parsed CSS) | `node scripts/check-contrast.mjs` (exits non-zero on any failure) | ❌ Wave 0 |
| DSGN-02 | Every interactive element keyboard-reachable, visible + unclipped focus ring | integration (Playwright, both browsers) | `npx playwright test keyboard-walk.spec.ts --project=chromium --project=webkit` | ❌ Wave 0 |
| DSGN-03 | Instrument Serif / Source Serif 4 present; Playfair Display / Merriweather absent | smoke (grep `style.css` and rendered `@font-face` declarations) | `grep -iE "Playfair|Merriweather" mockups/style.css` must return nothing | ❌ Wave 0 |
| DSGN-06 | Article grid subtree contains zero `<script>` tags / `on*` attributes | smoke (DOM scan) | small Node/Playwright script scanning the grid container's `innerHTML` | ❌ Wave 0 |
| I18N-07 | Spanish +25% copy causes no overflow/clipping in cards/headlines | integration (Playwright) | `npx playwright test spanish-overflow.spec.ts --project=chromium --project=webkit` | ❌ Wave 0 |
| PERF-07 | Fonts self-hosted, subset, woff2-only; `size-adjust` fallback produces zero measurable CLS on swap | integration (Playwright, network-throttled) | `npx playwright test font-cls.spec.ts --project=chromium --project=webkit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run of the relevant single spec file against `chromium` only, for fast local iteration while building each mockup page.
- **Per wave merge (e.g., "all 5 mockups drafted" → "verification wave"):** full suite (`--project=chromium --project=webkit`), all three spec files, plus `check-contrast.mjs`.
- **Phase gate (before `01-APPROVAL.md` is written):** full suite green on both engines, contrast script exit 0, `.astro`-absence check, zero-JS grid-scan check — this collection of commands *is* the D-16 "single runner."

### Wave 0 Gaps
- [ ] `package.json` + `playwright.config.ts` — none exist yet (greenfield repo, confirmed via CONTEXT.md "no `package.json`, no source tree, no build")
- [ ] `scripts/check-contrast.mjs` — D-13's contrast-from-tokens script, becomes the Phase 3 CI guard
- [ ] `scripts/keyboard-walk.spec.ts`, `scripts/font-cls.spec.ts`, `scripts/spanish-overflow.spec.ts` — the three Playwright suites (Patterns 3–5 above are their core logic)
- [ ] `scripts/generate-fallback-css.mjs` — capsize one-off script (Pattern 2)
- [ ] Font subsetting invocation script/command (Pattern 1, or the `subset-font` fallback)
- [ ] Playwright browser install: `npx playwright install --with-deps chromium webkit`
- [ ] A single top-level runner script (shell or npm script) that D-16 calls "one command" — e.g. `npm run verify:phase-1` chaining contrast check → Playwright full suite → `.astro`-absence check → zero-JS grid scan, printing a criterion-by-criterion verdict

## Security Domain

**Applicability note:** This phase produces static HTML/CSS with no server-side logic, no user input handling beyond a placeholder contact form markup (the `contact.html` mockup — actual form submission/validation is out of scope per CONTEXT.md's phase boundary: "any wiring to real data at build time" is explicitly NOT in this phase). The ASVS categories below are therefore largely **not applicable yet** — they apply once Phase 10 wires the real subscribe/contact forms to Astro Actions. This section is included per `security_enforcement: true` in project config, with applicability stated honestly rather than filled in with inapplicable boilerplate.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth surface in this phase |
| V3 Session Management | No | No sessions in static HTML |
| V4 Access Control | No | No access-controlled resources in this phase |
| V5 Input Validation | No — deferred | `contact.html` is markup-only in this phase (no live submission handler); real validation belongs to the Astro Actions + Zod work already researched for the project's later phases (see project TECH-STACK research, §6) |
| V6 Cryptography | No | Nothing to encrypt in static HTML |
| V11 Client-side Security (XSS via inline content) | Marginally — self-inflicted risk only | Since this phase authors raw HTML by hand from real D1 content (D-06), ensure any article headline/summary text pulled from the corpus is HTML-escaped when hand-pasted into the mockup, even though it's a one-time manual copy — a stray `<` or `&` in a real headline could break the markup, not a security vulnerability per se but a correctness one worth a mention here since it's adjacent |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| None specific to this phase's static-HTML-only surface | — | Re-evaluate ASVS applicability at Phase 10 (forms) and Phase 3 (Astro Actions), where real input-handling surface first appears |

## Sources

### Primary (HIGH confidence)
- npm registry, `npm view <pkg> version / time.created / time.modified / repository.url / scripts.postinstall`, live queries this session (2026-09-16) — `glyphhanger`, `subset-font`, `fontaine`, `culori`, `colorjs.io`, `@capsizecss/core`, `@capsizecss/metrics`, `@playwright/test`, `playwright` version/age/download/postinstall data.
- `node --version`, run directly this session — confirmed Node v24.14.0 in the environment.
- `github.com/seek-oss/capsize/blob/master/packages/metrics/src/entireMetricsCollection.json`, fetched directly via `curl` this session — confirmed `instrumentSerif` and `sourceSerif4` metric keys exist.

### Secondary (MEDIUM confidence)
- `caniuse.com/mdn-css_at-rules_font-face_size-adjust` and `caniuse.com/mdn-css_at-rules_font-face_ascent-override`, fetched directly via WebFetch this session — Safari/iOS-Safari version support for `size-adjust` (17.0+) vs `ascent-override` (not shipped through 27.1, TP only).
- `bugs.webkit.org/show_bug.cgi?id=219735`, fetched directly via WebFetch this session — confirmed `RESOLVED FIXED`, 2026-08-05/06, feature flag pending removal, not yet in a shipped Safari release.
- `w3.org/WAI/WCAG22/Understanding/focus-appearance.html`, `focus-not-obscured-minimum.html`, `non-text-contrast.html`, fetched directly via WebFetch this session — exact SC 2.4.13, 2.4.11, and 1.4.11 requirement text.
- `github.com/unjs/fontaine` README, fetched directly via WebFetch this session — confirmed no standalone Node API, only Vite/webpack/PostCSS transforms.
- `github.com/seek-oss/capsize` README, fetched directly via WebFetch this session — confirmed `createFontStack()` API shape and usage example.

### Tertiary (LOW confidence)
- WebSearch results (not independently re-verified against a primary source) — glyphhanger CLI invocation examples and crawl-mode behaviour on local multi-file HTML; Playwright WebKit-vs-Safari architecture claims; `toBeVisible()` ancestor-overflow-clipping limitation; `scrollWidth`/`clientWidth` truncation-detection pattern; CSS Grid intrinsic-responsive editorial layout patterns; `culori`/`colorjs.io` OKLCH→sRGB conversion API shape; WCAG relative-luminance formula restated from secondary sources rather than fetched directly from the WCAG 2.2 spec text itself in this session.

## Metadata

**Confidence breakdown:**
- Standard stack (tool choice/versions): MEDIUM — versions and package existence are `[VERIFIED: npm registry]`; the recommendation that these are the *right* tools for the job is `[ASSUMED]` per the package-name-provenance rule, since discovery was via WebSearch/training data, not official docs.
- Font-fallback cross-browser support (the phase's highest-priority open question): MEDIUM-HIGH — directly re-verified against MDN/caniuse/WebKit's own bug tracker this session, resolving the project's prior LOW-confidence flag with primary-source evidence.
- Architecture/verification patterns (Playwright scripts): LOW-MEDIUM — technique is sound and standard, but specific API details (e.g., glyphhanger's local-multi-file crawl syntax, Playwright's exact `toBeVisible()` behaviour) were not independently re-verified against first-party docs and are flagged `[ASSUMED]` with recommended `checkpoint:human-verify` spot-checks.
- Pitfalls: MEDIUM-HIGH — the two most consequential pitfalls (Safari `-override` gap, WebKit-trunk-vs-Safari divergence) are grounded in primary-source verification (WebKit bug tracker, caniuse).

**Research date:** 2026-09-16
**Valid until:** 2026-10-16 (30 days) for the tooling recommendations; the WebKit `ascent-override` shipping status specifically should be re-checked immediately before D-08 is executed, since it is actively in flux (feature-flag removal pending as of this research date) and could ship in a Safari point release at any time.

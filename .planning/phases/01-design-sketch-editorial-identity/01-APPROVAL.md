# Phase 01 Approval Packet — Design Sketch & Editorial Identity

Generated: 2026-09-17T23:37:53.308Z

Machine evidence: PASS (5/5, Chromium + WebKit (Playwright)). Owner sign-off: pending.

---

## Owner review focus (round 2)

1. **Real-Safari/Georgia is still open.** WebKit (Playwright 26.6, docker) is not Safari — it tracks WebKit trunk on Linux, ahead of any shipped Safari release. Georgia is not installed on this Linux machine or in the pinned Playwright Docker image (`mcr.microsoft.com/playwright:v1.63.0-noble`), so the fallback face most real macOS/iOS/Windows readers actually get was never directly measured. A real macOS or iOS Safari pass, including the Georgia fallback, remains open (WINDOWS.md entry 1).
2. **The new Business photo and hue.** Subject as recorded: "a saturated turquoise or teal painted storefront, wall or mural in El Paso or Ciudad Juárez"; licence CC BY-SA 4.0; final sampled hue 152.1°, a forest green (see hue-sources.json / palette.json, and the Palette provenance section below). Two things for the owner to weigh: the record's own subject wording still says "turquoise or teal" even though the photo that was actually used and sampled reads as green at 152° — the subject text was not updated to match the photo that replaced the marigold record (D-GAP-C, 01-16); and at the palette's "block" stop, Business and Health are the closest pair of all eight categories (OKLab distance 0.0559 against the 0.05 floor — comfortably a PASS, but the tightest margin in the palette; see design/evidence/palette.md "Minimum pairwise distance"). Separately, `design/evidence/palette-swatches-*.png`'s captions still read "Instrument Serif" in the swatch heading text, even though 01-14 moved headlines to Source Serif 4 Bold — a stale caption, not a design change; flagged here rather than silently left for the owner to notice.
3. **The Politics photo (Santa Fe dusk).** "the Franklin Mountains or the El Paso skyline under a deep indigo night sky" — no objection was raised in round 1; please confirm (WINDOWS.md entry 2).
4. **What D-GAP-A looks like in practice.** Under `font-display: optional`, a slow first visit keeps the fallback face for that page view rather than swapping mid-render (no more font-swap CLS). With Source Serif 4's `opsz` axis pinned to shrink the subsets, display-size headlines render at the font's default optical size rather than a size-matched one — see `design/evidence/font-subset.md` for the byte-size trade and the accepted optical-size trade-off (also flagged at the next phase transition, below).
5. **Planner decisions to accept or overturn.** Resolutions 8–10 (external-link new-tab cue; the ≥1024px reading column plus right rail; home feed lead + 6 cards then Load More pages of 6); the changelog adopting the article's right-rail layout; the rendered Key Details list (no more raw markdown asterisks); the category lead's typographic fallback when no usable image exists.
6. **New Spanish strings to read.** `rail-heading`, `load-more-button`, `load-more-status`, `new-tab-cue` (design/fixtures/spanish-stress.json).
7. **Any other open WINDOWS.md entries.** At packet-generation time: entry 1 (real-Safari spot-check), entry 2 (Politics photo), entry 13 (the italic face outside D-GAP-A's two preloads essentially always renders in its fallback), entry 16 (the category lead image needs a real-network visual check — tests block third-party requests, so this was never automatable). Review `.planning/WINDOWS.md` directly before signing.

## Runner output

```
| Criterion | Chromium | WebKit (Playwright 26.6, docker) | Node checks | Verdict |
|---|---|---|---|---|
| 1 | PASS | PASS | PASS | PASS |
| 2 | n/a | n/a | PASS | PASS |
| 3 | PASS | PASS | — | PASS |
| 4 | PASS | PASS | — | PASS |
| 5 | PASS | PASS | PASS | PASS |
```

## Criteria and evidence

| Criterion | What it checks | Evidence |
|---|---|---|
| 1 | Mockups + both themes + no .astro files | [contrast.md](../../../design/evidence/contrast.md), [pages/](../../../design/evidence/pages/) |
| 2 | Contrast (D-13) | [contrast.md](../../../design/evidence/contrast.md) |
| 3 | Keyboard walk (D-14, scripted half) | [keyboard/ contact sheets](../../../design/evidence/keyboard/), [tab-order-chromium.json](../../../design/evidence/keyboard/tab-order-chromium.json), [tab-order-webkit.json](../../../design/evidence/keyboard/tab-order-webkit.json) |
| 4 | Spanish overflow (D-15) | [pages/ (320px screenshots)](../../../design/evidence/pages/), spanish-overflow.spec.ts results — see Runner output above |
| 5 | Font subsetting + swap CLS (D-08, D-GAP-A) | [font-cls.md](../../../design/evidence/font-cls.md), [font-subset.md](../../../design/evidence/font-subset.md) |
| — | Palette swatches (both themes) | [palette-swatches-light.png](../../../design/evidence/palette-swatches-light.png), [palette-swatches-dark.png](../../../design/evidence/palette-swatches-dark.png) |
| — | Layout / chrome / lead-fallback / load-more regression | covered by `layout.spec.ts`, `chrome.spec.ts`, `lead-fallback.spec.ts`, `load-more.spec.ts` in the Runner output above |

## Environment

- **Node:** v24.14.0
- **pnpm:** pnpm@11.26.0
- **@playwright/test:** 1.63.0
- **Chromium:** 153.0.8010.12
- **WebKit (Playwright):** 26.6 (from font-cls.md; `design/.webkit-mode.json` records 26.6); mode: `docker`; image: `mcr.microsoft.com/playwright:v1.63.0-noble`; image digest: `mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`
- **Fallback faces exercised per engine (from font-cls.md):** Noto Serif, Times New Roman

WebKit (Playwright) is not Safari. A pass on real macOS or iOS Safari, including the Georgia fallback, remains open.

## Palette provenance

| Category | Subject | Photo | Licence | Sampled hue | Note |
|---|---|---|---|---|---|
| crime | ocotillo in bloom | [source](https://commons.wikimedia.org/wiki/File:Ocotillo_(50619242221).jpg) | Public domain | 30.7° | A fully open ocotillo (Fouquieria splendens) flower photographed against a neutral rock backdrop rather than open sky. This close focus on a single flower was chosen over wider ocotillo-spike photographs because the individual tube-shaped flowers in a spike are naturally gappy — even a tight crop around a spike still lets high-chroma blue sky show through at full resolution, which pulled the circular mean hue toward blue in early trials (rejected: circularStdDev ~65-70 against a plain sky background). This region is a clean single cluster. License note: this is a US National Park Service work (PD-USGov), which is public domain and at least as freely reusable as the four license types named in the plan; it was accepted on that basis rather than strictly one of the four listed strings. |
| politics | the Franklin Mountains or the El Paso skyline under a deep indigo night sky | [source](https://commons.wikimedia.org/wiki/File:Sunset_over_desert_outside_Santa_Fe.jpg) | CC BY-SA 3.0 | 265.5° | SUBSTITUTION FLAGGED FOR OWNER REVIEW: this photograph is high-desert dusk sky near Santa Fe, New Mexico, not the Franklin Mountains or the El Paso skyline as the subject calls for. A genuine search across Wikimedia Commons (queries covering 'El Paso night sky', 'Franklin Mountains night/moon/dusk', 'Cityscape of El Paso at Dusk', 'ElPasoEveningMarch2008', 'HUS 4312', and the full 'Cityscapes of El Paso, Texas' category) did not produce a usable indigo-sky source: literal full-darkness night-sky photographs of El Paso have near-zero chroma (a real physical property of true darkness, not a search failure), and the one dusk skyline shot found low-resolution enough to sample (Cityscape_of_El_Paso_at_Dusk.jpg, 420x190) yielded only 70 kept pixels against the required 500. This Santa Fe high-desert dusk sky is the same Southwestern register (clear, dry, high-elevation blue hour) and produced a clean, well-sampled indigo-blue hue; it is offered as the closest defensible substitute, not hidden as if it were El Paso. Owner judgement requested at the human-check step and before final sign-off. |
| sports | a saturated storefront or neon sign in El Paso or Ciudad Juárez (orange for sports) | [source](https://commons.wikimedia.org/wiki/File:Painting_mural_in_El_Paso_2022_12.jpg) | CC BY-SA 4.0 | 43.4° | A large, unobstructed, daylight block of vivid orange paint from a real El Paso street mural (color-block/checkerboard pattern), photographed in daylight. Not UTEP-specific, but a genuine saturated El Paso storefront/street-art orange as the subject calls for. |
| business | a saturated turquoise or teal painted storefront, wall or mural in El Paso or Ciudad Juárez | [source](https://commons.wikimedia.org/wiki/File:Bar_Kentucky_02.jpg) | CC BY-SA 4.0 | 152.1° | D-GAP-C REPLACEMENT (2026-09-17): replaces the marigold record after the owner's round-1 review flagged both Sports and Business as reading brown ('business and sports both read as brown. sports is more redish, thats ok') -- Sports was accepted as-is, Business was sent back for a new photo and re-sample. Physics explains the marigold's failure: any final hue in roughly 40-100deg drops to amber/olive at the block stop's L 0.46, reading as brown regardless of which photo supplies it -- so the replacement had to land outside that band, not just be a different yellow-orange. The new subject is the neon tube-light border of the real 'Kentucky Club & Grill' bar sign (operating since 1920) in downtown Ciudad Juárez, Mexico -- a genuine saturated storefront colour, one of C-01's own named registers, and squarely on-subject for this category's 'a saturated storefront or neon sign in El Paso or Ciudad Juárez' family already used for sports/weather/community. The sampled region is a single vertical run of the sign's green-cyan neon tubing (left border of the 'World Famous' panel, visible through the shop window), chosen after probing several candidate regions/photos: night-lit mural photographs from the same photo set as sports/weather (artificial worksite lighting) and a mural's shaded agave plant were both rejected first -- the mural photos' visually 'blue' paint measured chroma too low to clear the sampler's own 0.08 floor once downscaled, and a broader crop of this same neon sign pulled in window-glass reflections that pushed circularStdDev over 60deg. This tight region stays entirely on one clean run of tube glass and clears both sampler gates with margin (see hue-sources.json). Photographed 2019-04-06 in daylight (not night, so no artificial-light colour cast risk); the neon itself is self-illuminated tube light, not a painted or dyed surface, noted for completeness alongside 01-03's storefront/neon precedent (sports, weather). |
| education | a violet desert sunset | [source](https://commons.wikimedia.org/wiki/File:Desert_Sunset_in_Saguaro4.jpg) | CC BY 2.0 | 295.9° | Genuine violet-magenta sky band above a saguaro-silhouetted desert sunset in Saguaro National Park (Sonoran Desert, Arizona) — not Chihuahuan desert specifically, but the plan's own subject wording for this category names only 'a violet desert sunset' with no place tied to it, unlike the other seven categories. Region chosen to sit clearly in the magenta-violet band (hue ~296) rather than the more blue-violet band closer to the horizon (hue ~265-275), which sampled too close to the politics hue during trial regions. |
| community | a saturated storefront or neon sign in El Paso or Ciudad Juárez (magenta or pink for community) | [source](https://commons.wikimedia.org/wiki/File:2010_Ciudad_Juarez_Mexico_5161988454.jpg) | CC BY 2.0 | 359.9° | A saturated pink storefront building on a street corner in Ciudad Juárez, visible past a row of Policía Federal motorcycles. Sampled hue reads as pink-red (hue ~0.8, at the red/magenta boundary) rather than a deeper magenta — an honest photographic reading, not adjusted toward magenta by eye. |
| health | sotol or creosote bush | [source](https://commons.wikimedia.org/wiki/File:Creosote_bush,_Larrea_tridentata_(15205639513).jpg) | CC BY-SA 2.0 | 120.7° | Larrea tridentata (creosote bush) foliage in direct sun; region targets the dense green leaf mass, avoiding the yellow flowers so the sampled hue is the leaf green named in the subject. Creosote bush ranges across the Chihuahuan, Sonoran and Mojave deserts; this specimen was photographed in Nevada (Mojave Desert) rather than the Chihuahuan desert specifically — same species, different desert region, noted for completeness. |
| weather | a hard turquoise midday sky over El Paso | [source](https://commons.wikimedia.org/wiki/File:Painting_mural_in_El_Paso_2022.jpg) | CC BY-SA 4.0 | 246.5° | A real clear midday sky over El Paso, TX (photographed through a car windshield at a street mural project; region avoids clouds, wires and the windshield's own reflections). The measured hue reads as a saturated azure/sky blue (~245-246) rather than the colloquially 'turquoise' the subject wording anticipates — an honest outcome of D-02's photo-first methodology (hue comes from the photo, not from what the design brief expected to see), flagged for the owner's C-01 judgement alongside the other notes rather than nudged toward cyan by eye. |

### C-01 review (verbatim from palette.md)

Block stops whose final hue lies in 40-100° turn dark amber or olive at block lightness, which can read as brown — the owner should judge these directly against C-01 rather than the script silently excluding them (D-01 applies to all eight categories).

| Category | Final hue | Block hex | Note |
|---|---|---|---|
| Sports | 49.4° | #8c3e01 | dark amber or olive at block lightness — may read as brown; owner to judge at approval |

## Deviations to raise at the next phase transition

- **D-10** drops PRD §5.1 pull quotes in favour of a standfirst deck (see `01-CONTEXT.md` D-10 for the full rationale — machine-generated summary text at display size would misrepresent it as editorial voice).
- **C-01** supersedes the "Chihuahuan desert palette" wording in `REQUIREMENTS.md` DSGN-04 and in `ROADMAP.md` Phase 1 criterion 2. Recommend rewording both — the owner's call, not edited mid-phase.
- **D-GAP-A**: PRD §6.5 amended to `font-display: optional`. The amendment is committed (`docs/PRD.md` tracked since 2026-09-17).
- **D-GAP-B**: DSGN-03 ("Display type is Instrument Serif") and ROADMAP criterion 5's "(display)" now describe the wordmark only; headlines are Source Serif 4 Bold; D-09 and PRD §5.2 amended; PRD §6.8's share-card headline face is to be re-decided when share cards are built.
- **D-05**: the mockups directory has eight entries (`feed/`).
- **DSGN-06 / criterion 5 wording** "the article grid is pure HTML with zero JavaScript": the server-rendered grid stays script-free, and the PRD §5.5 load-more island appends pre-built static cards. Recommend rewording DSGN-06 to say exactly that.

## Planner resolutions of open items

The following ten items from `01-CONTEXT.md`'s "Open Within This Phase" list, and the round-1 gap-closure plan, are repeated here verbatim for the owner to accept or overturn:

1. Link and focus colour: links are ink with a visible underline; there is no link hue. The focus ring is `--focus-ring` (ink-family, 3 px solid, 2 px offset) on paper, and switches to `--focus-ring-on-block` (= `--block-ink`) inside colour blocks. The contrast gate checks the ring against both papers and all eight blocks, and the keyboard walk checks it against the real rendered background.
2. Brand colour: 915 TLDR owns no ninth hue. Its signature is the eight-segment spectrum rule under the wordmark.
3. Masthead and nav: the Instrument Serif wordmark — its only use, at weight 400 with font synthesis off — with a dateline and the spectrum rule closing the masthead (no ink rule). The nav wraps to 2, then 4, then 8 columns, with no scroll container and no disclosure JavaScript.
4. Category masthead: a full-bleed `--cat-<slug>-block` panel with the display-size name, description and public story count in `--block-ink`.
5. Subsetting toolchain: `subset-font` with a Playwright glyph crawl plus a fixed Spanish baseline set; `@capsizecss/core` + `@capsizecss/metrics` for fallback faces. glyphhanger and fontaine are not used (reasons in 01-01). Source Serif 4 ships with `opsz` pinned to its default (Roman keeps wght 400–700; Italic is pinned to 400); Instrument Serif Italic is retired.
6. Images: real source URLs, hotlinked, in fixed 3:2 frames with explicit dimensions. Junk images render as imageless. Automated tests block third-party requests.
7. Theme toggle and Load more: one inline head script, identical on all five pages. It is chrome, not grid: every grid's server-rendered HTML is script-free and identical with JavaScript disabled; the toggle and the Load more button are hidden without JavaScript; Load more appends pre-built cards from same-origin static JSON with DOM APIs only.
8. External links: `target="_blank"`, `rel="noopener"`, a decorative icon and visually hidden "(opens in a new tab)".
9. Text pages at ≥1024px: a reading column capped at ~70ch plus a 20rem right rail (article and changelog); contact is a centred 44rem column; at 320 and 768px these pages run full width.
10. Home feed: lead plus 6 cards, then Load more pages of 6.

## Flagged assumptions

- Probe rows left unresolved because they were unclassified: DSGN-01, DSGN-02, DSGN-03, DSGN-05, DSGN-06, PERF-07. The generic edge probe could not classify them; their requirements are covered by explicit truths across 01-02 through 01-22, but no edge-probe category was resolved for them.
- A-01: WebKit (Playwright) on Linux tracks trunk and is not Safari. The Georgia fallback is not exercised on Linux. A real macOS/iOS pass remains open.
- A-02: 200% zoom is emulated as 640 CSS px at devicePixelRatio 2, backed by the owner's manual Ctrl+ check.
- A-03: D-02's fixed chroma is implemented as a shared requested chroma, clamped per hue to sRGB (reported in palette.md).
- A-04: yellow and orange block stops may read as brown (C-01). This is the owner's call, flagged in palette.md.
- A-05: D-15's real Spanish was translated in-session with no paid API. The owner reviews its quality.
- A-06: images are hotlinked; tests block third-party requests.
- A-07: planner-chosen thresholds — OKLab distance ≥ 0.05; "zero layout shift" means below 0.005, i.e. reported CLS rounds to 0.00; synthetic width window 1.25–1.30 (wider only for short labels); woff2 at most 150 KB per file, with per-file ceilings of 60 KB (roman) / 30 KB (italic) applied during the D-GAP-A shrink.
- A-08: research corrections — WebKit has no layout-shift API, so the geometry instrument is used; the observer is installed with addInitScript; glyphhanger was replaced.
- A-09: the home feed starts with 6 initial cards, then Load More pages of 6.
- A-10: without JavaScript the home page shows the lead and 6 cards; older stories stay reachable through the category pages; Phase 4 should add a static pagination link as the no-JS fallback.
- A-11: optional fonts mean slow first visits keep the fallback face for that view.
- A-12: the Business subject target arc (150–225°) was a planner choice.
- A-13: the owner's "768px" changelog observation versus what 01-20 measured — 01-20 reproduced the dispatch squeeze as real, but confined to ≥80em (1280/1920px), not 768px as the owner's screenshot label suggested (see 01-20-SUMMARY.md).
- A-14: contact page centring at 1280/1920px in both themes was a planner/orchestrator visual call (01-20), not separately re-confirmed by the owner since round 1 — flagged for round-2 confirmation.

## File fingerprints

Recomputed by `pnpm run verify:approval`. Any change to a listed file after this packet is generated invalidates the approval — re-run `verify:phase-1`, regenerate this packet, and re-sign.

| File | sha256 |
|---|---|
| `design/mockups/style.css` | `0dfd5fdfe3d739871c959c1ed7c52423354051638ed74b6fe82fc09e03b6590c` |
| `design/mockups/index.html` | `f9b705667f9173c31f6fa3b6ade07aa0f0164f4b6b3c9a437acb56a0e7eb24f4` |
| `design/mockups/category.html` | `60647a507d98e966ec0d048b0097b2cf79344ac13ff4701fc09fbd74fa7ceade` |
| `design/mockups/article.html` | `fd3e44ee879b921fd3437b3b4b015342a37e239429fff6aa7613080f33c2a5d5` |
| `design/mockups/changelog.html` | `f56c014ba283f838aa87b59a9fe6273cb48c67eab23e48df2fca2a8e81fbbe26` |
| `design/mockups/contact.html` | `80038789c947cb2514145ed1d2a5e54ca31eeb20235365df955eeae24ba1165f` |
| `design/palette/palette.json` | `9adb2498ad120c47ac9143a9ddcdcca5142c4a0d0746d79b51d80bb2856eb0ab` |
| `design/mockups/fonts/subset-manifest.json` | `f2ebb25d180ec03a5499cd54e68e6aac85e8f1bd09a472de1382784f2e109612` |
| `design/fixtures/home-feed.json` | `bd58075eb6047d5dcdf1654e4484f0fa4df90b1c51b19bbfaad41be4e6e622e3` |
| `design/mockups/feed/page-2.json` | `c83c53b90468a2c5e377305230850e6335af9ea5fda3900fa367b9bbccf950ee` |
| `design/mockups/feed/page-3.json` | `624614fb362f74a7b2750d9150e1d08d9df1a566e79d72ef06160f4a45c19e19` |
| `design/mockups/feed/page-4.json` | `a35810036c6e9930b0a3429fe38ddddb34941620a57a0c5ea2189abcbc33cf5b` |
| `design/mockups/feed/page-5.json` | `9690bb7f2ad93f8d0d00dd8a81ab47b20064f26eb929c10b1dd2a2777bc54427` |
| `design/mockups/feed/page-6.json` | `d2c0b3cd42f97f2c8bc87920f277a64d669afe5fa5c22e8c60e9ea2a7afcba32` |

## Owner review checklist

- [ ] Start `pnpm run serve:mockups` in your own pane and open http://127.0.0.1:4319/mockups/index.html
- [ ] Review all five pages in light and dark at 320, 768, 1280 and 1920px
- [ ] Review each page at real 200% browser zoom
- [ ] Keyboard-walk every page in both themes (Tab, Shift+Tab, Enter, Space), including pressing Load more until it disappears and confirming focus and footer reachability
- [ ] Open an external link and confirm it opens in a new tab
- [ ] Check each round-1 item 1–10 in the closure table
- [ ] Review the Business block and swatches against C-01
- [ ] Read the new Spanish strings
- [ ] Accept or overturn each planner resolution and decision above

## Owner sign-off

To approve, add one line directly below this paragraph, yourself, giving your name
and the date after the `Approved-by:` label (label, a space, your name, an em dash,
then the date as `YYYY-MM-DD`) — for example: `Approved-by: Jaime Aleman — 2026-09-17`.

Then leave this section otherwise empty. This generator never writes that line.

## Round 2 owner review notes

**Outcome (2026-09-17): APPROVED.** The owner reviewed the round-2 packet and replied, verbatim:

> "article page is much better."
> "changelog is great. can the latest stories be made to float? is that a sticky? so as the reader scrolls, the latest stories remains visible?"
> "contact looks good too."
> "load more stories on homepage, nice."
> "since the site is astro. i would like view transitions. a nice subtle fade in/out of content as the navigation remains static/visible with no transition."
> "APPROVED."

These comments confirm article, changelog, contact and the homepage Load More as reviewed and approved. They do not individually re-confirm every line of the "Owner review focus (round 2)" list (the Business subject-wording/palette-caption staleness, the Politics photo, real-Safari/Georgia, or the remaining open WINDOWS.md entries) — the approval covers the design as packaged, but this packet does not claim the owner separately re-addressed each of those specific items this round, and no WINDOWS.md entry was marked accepted on the strength of this reply alone. The owner review checklist above is left unticked by this generator/executor, as it always is; ticking it is the owner's own act.

Two items raised during this review are forward-carried scope, not round-2 revision requests — see "## Follow-ups captured at approval" below. Recording them here does not reopen this round's gate: the round-2 machine evidence and mockups are approved as-is, unchanged.

## Follow-ups captured at approval

Captured 2026-09-17, scoped by owner decision the same day, both targeting the Astro build phase (**Phase 8: Server Islands & Interactivity**) rather than a Phase 1 mockup revision. Phase 1's approved mockups are unchanged by either item.

1. **Sticky "Latest Stories" rail.** Owner: "can the latest stories be made to float? is that a sticky? so as the reader scrolls, the latest stories remains visible?" (raised against changelog.html; article.html's `aside[data-rail]` carries the same rail, 01-19/01-20). Owner decision: build in the Astro build phase (Phase 8), not as a Phase 1 addition — the rail's scroll behaviour is deliberately unproven until then. Implementation note: `position: sticky` on the rail column, a `top` offset clearing the masthead, disabled below the 64em breakpoint where the rail stacks below the reading column. No existing requirement ID covers this; flagged as an unmapped requirement candidate for whoever scopes Phase 8 — not silently added to REQUIREMENTS.md or ROADMAP.md by this session. Sticky positioning and view transitions interact (owner's own framing, see below) — build both together.
2. **Astro view transitions.** Owner: "since the site is astro. i would like view transitions. a nice subtle fade in/out of content as the navigation remains static/visible with no transition." Maps to existing requirement **ISL-06** ("Page transitions use `<ClientRouter />` from `astro:transitions`", REQUIREMENTS.md) and ROADMAP.md Phase 8 success criterion 5 — already scoped, no new requirement needed. Implementation note for that phase: Astro 7 uses `<ClientRouter />` from `astro:transitions` (`<ViewTransitions />` was removed in v5); the persistent masthead/nav needs `transition:persist` (or a named transition) so it never animates, matching "navigation remains static/visible with no transition."

## Revision requests

(none — round 2 reviewed and approved 2026-09-17. See "Round 2 owner review notes", "Owner sign-off" and "Follow-ups captured at approval" above.)

## Revision history

### Round 1 — 2026-09-17 — revisions requested (not approved)

**Outcome of the Task 2 review (2026-09-17): revisions requested. Not approved.**
The owner reviewed all five pages in a real browser (light/dark, 320/768/1280, 200% zoom,
keyboard walk) and gave the notes below. Owner quotes are verbatim; bracketed text is the
orchestrator's description of the owner's screenshots.

### Owner decisions (answered 2026-09-17)

| Item | Decision |
|---|---|
| Criterion 5 — font-swap CLS | **C + shrink fonts.** Reopen PRD §6.5: switch `font-display: swap` → `optional` (keep the preloads), and reduce the Source Serif 4 subsets (currently 108 KB roman / 91 KB italic). |
| Headline typeface | **Source Serif 4 bold for headlines; Instrument Serif kept for the "915 TLDR" wordmark only.** Owner: "not too crazy about the thin font for the headings". [Owner's screenshot shows the headline computed as "Instrument Serif – 700": Instrument Serif ships one weight, so the bold is browser-synthesised.] Revisits D-09 / PRD §5.2. |
| Business hue (C-01) | **New photo, re-sample.** Owner: "business and sports both read as brown. sports is more redish, thats ok." → Business changes; Sports stays. |
| Package manager | **pnpm.** A `pnpm install` was run 2026-09-17 08:56; `pnpm-lock.yaml` is now alongside `package-lock.json`. Keep pnpm, retire `package-lock.json`, update `npm run …` references in scripts/docs to pnpm where they matter. |
| Spanish copy | Accepted — "looks good to me." |
| Keyboard walk | Accepted — "[skip to content] and then category navigation, nice then dark/light toggle. adn then each article heading. well done." |
| Politics photo (Santa Fe sky), Weather hue (azure) | No objection raised; treated as accepted. |
| Real-Safari / Georgia spot-check | Still outstanding. |

### Revision requests

1. **Header border.** "i love the color stripe at the top. maybe remove the black/white bottom border in header." — keep the category colour stripe; remove the black (light) / white (dark) rule under the header.
2. **Category lead needs an image, always, or a layout that survives without one.** "as long as it always has an image on the side, so the layout doesnt break." — the image-led lead must only be used for an article with a usable image, with a defined text-only fallback.
3. **Article page whitespace.** "article page. too much whitespace. how do other news websites handle this?!" [1280px: single text column with a large empty right side.] Direction agreed in session: no ads; at ≥1024px add a right rail (e.g. "Latest" / "More in {category}"); keep body measure ~70ch.
4. **Changelog whitespace / layout.** [768px: each dispatch's body text is squeezed into the narrow date column while the title sits alone on the right — a layout bug.]
5. **Contact page.** "looks great, should be centerer?" [Also: the "Send message" button touches the "Latest Stories" heading — spacing bug.]
6. **External links open in a new tab.** "all external links should be in a new tab. links to 915website.com jjaimealeman.com external news sources, etc." (Use `target="_blank" rel="noopener"` with an accessible "opens in a new tab" cue.)
7. **768px width.** "index, category both look great. article and changelog, needs to span the full width … contact also."
8. **Homepage is overwhelming on first load.** "i counted 10+ rows with 3 columns each. first load is overwhelming. maybe a (load more) button at the bottom? start with maybe 2-3 rows?! … and if they keep clicking that, it would become one of those infinite scroll pages." Direction agreed in session: start with 2–3 rows plus an explicit **Load more** button that fetches pre-built static JSON (zero D1 reads); keep it a button rather than auto-infinite-scroll so the footer stays reachable by keyboard.

### Defects found by the orchestrator in the owner's screenshots

9. **Raw markdown in the article body:** `**Key Details:**` renders with literal asterisks — the summary's markdown is not converted to HTML.
10. **Theme toggle placement:** at 1920px the "Dark theme" button sits outside the page column, at the far left edge.

#### Round 1 fingerprints (superseded)

Recomputed by `npm run verify:approval`. Any change to a listed file after this packet is generated invalidates the approval — re-run `verify:phase-1`, regenerate this packet, and re-sign.

| File | sha256 |
|---|---|
| `design/mockups/style.css` | `e03f3f006a3f46a7bc5508000bd57dcdbcc080a391d6af9329cdbd39d6c63ee9` |
| `design/mockups/index.html` | `0a3cf6ce579d2976af0487f4b1607d3dedf1ff60fe8a22e1874fda36a30a33ea` |
| `design/mockups/category.html` | `c20cb301fc3cd400f3986237a6c0c305077e216011fb8257e46a98c161022c4e` |
| `design/mockups/article.html` | `36f714d326054ba49f25554c3874cf446a3a599aa3a5c460e4e5af128149f92a` |
| `design/mockups/changelog.html` | `9e260c61bc704333d0c521346a979fc9cebc50353778bc0db00124e84f089229` |
| `design/mockups/contact.html` | `d56db9660d0cf3afce0403235a1c34be0769fd2e12f1678751f02efb538fb038` |
| `design/palette/palette.json` | `50763a4dfcbb095302c7b42c5aaae070cd2dd4dd812d9058a5c476ac09923024` |
| `design/mockups/fonts/subset-manifest.json` | `3f784947394760a2b869a6408e72c7d2d9d46543e3af97f9be16167e81d44614` |

#### Round 1 closure

| Round-1 item | Plans | Evidence |
|---|---|---|
| A — criterion 5: font-display optional + shrink Source Serif 4 | 01-13, 01-14 | font-cls.md (paths + positive control), font-subset.md |
| B — Source Serif 4 Bold headlines; Instrument Serif wordmark only | 01-14, 01-15 | structure.spec "type roles"; recalibrated spanish-stress.json |
| C — Business: new photo, re-sample | 01-16 | palette.md, swatches, photo-sources.json |
| D — pnpm | 01-11 | pnpm-lock.yaml, pw.mjs, lockfile parity |
| 1 — remove the header rule | 01-17 | chrome.spec.ts |
| 2 — category lead image or fallback | 01-18 | lead-fallback.spec.ts, content.spec lead contract |
| 3 — article right rail | 01-19 | layout.spec.ts (article) |
| 4 — changelog layout | 01-20 | layout.spec.ts (changelog) |
| 5 — contact centring and spacing | 01-20 | layout.spec.ts (contact) |
| 6 — external links, new tab | 01-17 | content.spec, keyboard-walk new-tab test |
| 7 — 768px full width | 01-19, 01-20 | layout.spec.ts |
| 8 — Load more | 01-21, 01-22 | load-more.spec.ts, keyboard-walk load-more tests, expanded-feed checks |
| 9 — raw markdown | 01-12, 01-18 | summary-markdown unit tests; content.spec markdown test |
| 10 — toggle outside column | 01-17 | chrome.spec.ts |
| Accepted as-is in round 1 | — | Spanish copy; keyboard walk order; Weather hue. Politics photo: no objection raised, to be confirmed. Real-Safari/Georgia: still open |

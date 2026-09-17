# Phase 01 Approval Packet — Design Sketch & Editorial Identity

Generated: 2026-09-17T14:11:20.795Z

Machine evidence: 4/5 PASS (Chromium + WebKit (Playwright)) — criterion 5 (font-swap CLS) FAILS, root-caused and owner-decision-pending (see "Owner decisions required" below). Owner sign-off: pending.

---

## Owner decisions required

These are the unresolved, owner-only calls this packet cannot resolve on its own. **Criterion 5 is listed first** because it is the one that currently makes the machine-evidence line above read less than 5/5.

### 1. Criterion 5 — font-swap CLS (FIRST — resolve this one first)

The full swap matrix (page × width × scroll[top,mid] × variant × fallback face), run in both Chromium and WebKit (Playwright) as part of this packet's own evidence run, shows real, substantial layout shift on all five pages once below-the-fold (`scroll=mid`) reflow is measured — up to Chromium native CLS ~0.17, well above even the field 0.05 budget, let alone the project's 0.005 per-swap threshold. This was investigated and root-caused in 01-09 (see `01-09-SUMMARY.md`, `design/evidence/font-cls.md`, and WINDOWS.md entries 1, 4, 5, 7, 8): capsize's `size-adjust` equalizes average character width between two typefaces but cannot guarantee identical per-line word-wrap points, so real reflow remains once a paragraph's line breaks diverge between the served font and its fallback. This is inherent to font-substitution under `font-display: swap`, not a CSS bug — no fix was attempted that would change the qualitative outcome, and no threshold was weakened.

**Options:**
- **A — Accept and document.** Keep `font-display: swap` as PRD §6.5 specifies. Record the measured CLS honestly in the approved evidence and carry it forward as a known, accepted cost. Simplest; ships the finding as-is; the 0.05 mobile-p75 CWV budget (PROJECT.md) may still be missed on first paint for readers who see a swap.
- **B — Change the fallback stack.** Try a different fallback face ordering or metrics tuning. 01-09 already ruled out the override descriptors (ascent/descent/line-gap) as the primary driver — full vs size-adjust-only variants produced near-identical magnitudes — so this is **unlikely to help** and is offered only for completeness.
- **C — Reopen PRD §6.5 and switch to `font-display: optional`** with the existing preloads. This eliminates swap-triggered CLS entirely (a client either gets the webfont before first paint or keeps the fallback for that view — no mid-render swap). Trade-off: slow first visits keep the fallback face for the whole view rather than eventually swapping in the real font. **Orchestrator recommendation: C**, paired with shrinking the Source Serif 4 subsets (currently 108 KB roman / 91 KB italic vs Instrument Serif's ~17 KB) since a smaller file arrives faster and narrows the window where the fallback is shown at all. `font-display` is currently `swap` in `design/mockups/style.css` and has **not** been changed by this packet — that edit is the owner's call to authorize, not something this task performed silently.

This packet reports the failure exactly as measured. **No threshold was weakened and no criterion was special-cased to pass.**

### 2. Real-Safari / Georgia spot-check (outstanding)

WebKit (Playwright 26.6, docker) is **not** Safari — it tracks WebKit trunk on Linux, ahead of any shipped Safari release. Georgia is not installed on this Linux machine or in the pinned Playwright Docker image (`mcr.microsoft.com/playwright:v1.63.0-noble`), so the fallback face the majority of real macOS/iOS/Windows readers actually get was never directly measured — only its capsize metric arithmetic was exercised. A real macOS or iOS Safari pass, including the Georgia fallback, remains open (WINDOWS.md entries 1, 4, 5, 7).

### 3. Palette C-01 judgement

Photo-sampled hues sometimes diverged from their intended subject or register — the owner's call, not resolved unilaterally:
- **Politics'** photo is a Santa Fe, NM dusk sky, not the Franklin Mountains/El Paso skyline the subject names (WINDOWS.md entry 2) — genuine full-darkness El Paso night photos measured near-zero chroma, so no literal substitute was found.
- **Weather's** sampled hue reads as azure/sky blue (~246°), not the colloquially "turquoise" the subject wording anticipated (an honest outcome of D-02's photo-first methodology).
- **Sports** (block hex `#8c3e01`, hue 49.4°) and **Business** (block hex `#695701`, hue 94.5°) sit near the amber-olive-reading-as-brown risk C-01 explicitly flags (WINDOWS.md entry 3).

See `design/evidence/palette-swatches-light.png` and `-dark.png`, and the "Palette provenance" section below.

### 4. Spanish translation naturalness

The 22 Spanish strings in `design/fixtures/spanish-stress.json` (01-04) were translated in-session with no paid translation API (A-05). Programmatic checks (overflow, truncation, diacritic coverage) all pass, but naturalness of the phrasing itself is a native-fluency judgement this packet cannot make.

### 5. Any other open WINDOWS.md entries

At packet-generation time, `.planning/WINDOWS.md` has open entries beyond the ones named above (see the full ledger). Review it directly before signing — this packet does not attempt to re-summarize entries not already called out by name here.

---

## Runner output

```
| Criterion | Chromium | WebKit (Playwright 26.6, docker) | Node checks | Verdict |
|---|---|---|---|---|
| 1 | PASS | PASS | PASS | PASS |
| 2 | n/a | n/a | PASS | PASS |
| 3 | PASS | PASS | — | PASS |
| 4 | PASS | PASS | — | PASS |
| 5 | FAIL | FAIL | FAIL | FAIL |
|  |  |  | report-font-cls.mjs exited non-zero — see design/evidence/font-cls.md |  |
```

## Criteria and evidence

| Criterion | What it checks | Evidence |
|---|---|---|
| 1 | Mockups + both themes + no .astro files | [contrast.md](../../../design/evidence/contrast.md), [pages/](../../../design/evidence/pages/) |
| 2 | Contrast (D-13) | [contrast.md](../../../design/evidence/contrast.md) |
| 3 | Keyboard walk (D-14, scripted half) | [keyboard/ contact sheets](../../../design/evidence/keyboard/), [tab-order-chromium.json](../../../design/evidence/keyboard/tab-order-chromium.json), [tab-order-webkit.json](../../../design/evidence/keyboard/tab-order-webkit.json) |
| 4 | Spanish overflow (D-15) | [pages/ (320px screenshots)](../../../design/evidence/pages/), spanish-overflow.spec.ts results — see Runner output above |
| 5 | Font subsetting + swap CLS (D-08) | [font-cls.md](../../../design/evidence/font-cls.md) |
| — | Palette swatches (both themes) | [palette-swatches-light.png](../../../design/evidence/palette-swatches-light.png), [palette-swatches-dark.png](../../../design/evidence/palette-swatches-dark.png) |

## Environment

- **Node:** v24.14.0
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
| business | marigold (cempasúchil, as used for Día de Muertos in the region) | [source](https://commons.wikimedia.org/wiki/File:Tagetes_erecta_26122014_(2).jpg) | CC BY-SA 3.0 | 98.5° | Tagetes erecta (the cempasúchil/Mexican marigold used for Día de Muertos) in full bloom, bright golden-orange, photographed in direct sun. The photograph itself is not from the El Paso/Juárez region (species is exactly on-subject; the specific specimen photographed is not geographically local), noted for completeness. An earlier candidate (a mustard-yellow painted band in an El Paso mural, hue ~82-85) was considered but rejected in favor of this on-species real flower, which is the more literal C-01 subject match. |
| education | a violet desert sunset | [source](https://commons.wikimedia.org/wiki/File:Desert_Sunset_in_Saguaro4.jpg) | CC BY 2.0 | 295.9° | Genuine violet-magenta sky band above a saguaro-silhouetted desert sunset in Saguaro National Park (Sonoran Desert, Arizona) — not Chihuahuan desert specifically, but the plan's own subject wording for this category names only 'a violet desert sunset' with no place tied to it, unlike the other seven categories. Region chosen to sit clearly in the magenta-violet band (hue ~296) rather than the more blue-violet band closer to the horizon (hue ~265-275), which sampled too close to the politics hue during trial regions. |
| community | a saturated storefront or neon sign in El Paso or Ciudad Juárez (magenta or pink for community) | [source](https://commons.wikimedia.org/wiki/File:2010_Ciudad_Juarez_Mexico_5161988454.jpg) | CC BY 2.0 | 359.9° | A saturated pink storefront building on a street corner in Ciudad Juárez, visible past a row of Policía Federal motorcycles. Sampled hue reads as pink-red (hue ~0.8, at the red/magenta boundary) rather than a deeper magenta — an honest photographic reading, not adjusted toward magenta by eye. |
| health | sotol or creosote bush | [source](https://commons.wikimedia.org/wiki/File:Creosote_bush,_Larrea_tridentata_(15205639513).jpg) | CC BY-SA 2.0 | 120.7° | Larrea tridentata (creosote bush) foliage in direct sun; region targets the dense green leaf mass, avoiding the yellow flowers so the sampled hue is the leaf green named in the subject. Creosote bush ranges across the Chihuahuan, Sonoran and Mojave deserts; this specimen was photographed in Nevada (Mojave Desert) rather than the Chihuahuan desert specifically — same species, different desert region, noted for completeness. |
| weather | a hard turquoise midday sky over El Paso | [source](https://commons.wikimedia.org/wiki/File:Painting_mural_in_El_Paso_2022.jpg) | CC BY-SA 4.0 | 246.5° | A real clear midday sky over El Paso, TX (photographed through a car windshield at a street mural project; region avoids clouds, wires and the windshield's own reflections). The measured hue reads as a saturated azure/sky blue (~245-246) rather than the colloquially 'turquoise' the subject wording anticipates — an honest outcome of D-02's photo-first methodology (hue comes from the photo, not from what the design brief expected to see), flagged for the owner's C-01 judgement alongside the other notes rather than nudged toward cyan by eye. |

### C-01 review (verbatim from palette.md)

Block stops whose final hue lies in 40-100° turn dark amber or olive at block lightness, which can read as brown — the owner should judge these directly against C-01 rather than the script silently excluding them (D-01 applies to all eight categories).

| Category | Final hue | Block hex | Note |
|---|---|---|---|
| Sports | 49.4° | #8c3e01 | dark amber or olive at block lightness — may read as brown; owner to judge at approval |
| Business | 94.5° | #695701 | dark amber or olive at block lightness — may read as brown; owner to judge at approval |

## Deviations to raise at the next phase transition

- **D-10** drops PRD §5.1 pull quotes in favour of a standfirst deck (see `01-CONTEXT.md` D-10 for the full rationale — machine-generated summary text at display size would misrepresent it as editorial voice).
- **C-01** supersedes the "Chihuahuan desert palette" wording in `REQUIREMENTS.md` DSGN-04 and in `ROADMAP.md` Phase 1 criterion 2. Recommend rewording both — the owner's call, not edited mid-phase.

## Planner resolutions of open items

The following seven items from `01-CONTEXT.md`'s "Open Within This Phase" list were resolved by the planner during 01-01 through 01-09. They are repeated here verbatim for the owner to accept or overturn:

1. Link and focus colour: links are ink with a visible underline; there is no link hue. The focus ring is `--focus-ring` (ink-family, 3 px solid, 2 px offset) on paper, and switches to `--focus-ring-on-block` (= `--block-ink`) inside colour blocks. The contrast gate checks the ring against both papers and all eight blocks, and the keyboard walk checks it against the real rendered background.
2. Brand colour: 915 TLDR owns no ninth hue. Its signature is the eight-segment spectrum rule under the wordmark.
3. Masthead and nav: the Instrument Serif wordmark with rules and a dateline. The nav wraps to 2, then 4, then 8 columns, with no scroll container and no disclosure JavaScript.
4. Category masthead: a full-bleed `--cat-<slug>-block` panel with the display-size name, description and public story count in `--block-ink`.
5. Subsetting toolchain: `subset-font` with a Playwright glyph crawl plus a fixed Spanish baseline set; `@capsizecss/core` + `@capsizecss/metrics` for fallback faces. glyphhanger and fontaine are not used (reasons in 01-01).
6. Images: real source URLs, hotlinked, in fixed 3:2 frames with explicit dimensions. Junk images render as imageless. Automated tests block third-party requests.
7. Theme toggle: one inline head script per page. It is chrome, not grid; every grid is script-free and identical with JavaScript disabled, and the toggle is hidden without JavaScript.

## Flagged assumptions

- Probe rows left unresolved because they were unclassified: DSGN-01, DSGN-02, DSGN-03, DSGN-05, DSGN-06, PERF-07. The generic edge probe could not classify them; their requirements are covered by explicit truths in 01-02 and 01-05 through 01-09, but no edge-probe category was resolved for them.
- A-01: WebKit (Playwright) on Linux tracks trunk and is not Safari. The Georgia fallback is not exercised on Linux. A real macOS/iOS pass remains open.
- A-02: 200% zoom is emulated as 640 CSS px at devicePixelRatio 2, backed by the owner's manual Ctrl+ check.
- A-03: D-02's fixed chroma is implemented as a shared requested chroma, clamped per hue to sRGB (reported in palette.md).
- A-04: yellow and orange block stops may read as brown (C-01). This is the owner's call, flagged in palette.md.
- A-05: D-15's real Spanish was translated in-session with no paid API. The owner reviews its quality.
- A-06: images are hotlinked; tests block third-party requests.
- A-07: planner-chosen thresholds — OKLab distance ≥ 0.05; "zero layout shift" means below 0.005, i.e. reported CLS rounds to 0.00; synthetic width window 1.25–1.30 (wider only for short labels); woff2 at most 150 KB.
- A-08: research corrections — WebKit has no layout-shift API, so the geometry instrument is used; the observer is installed with addInitScript; glyphhanger was replaced.

## File fingerprints

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

## Owner review checklist

- [x] Start `npm run serve:mockups` in your own pane and open http://127.0.0.1:4319/mockups/index.html
- [x] Review each of the five pages in light and dark at 320, 768 and 1280 px
- [x] Review each page at real 200% browser zoom
- [x] Do your own keyboard walk (Tab, Shift+Tab, Enter, Space) of each page in both themes, judging tab order and operability
- [x] Review the keyboard contact sheets
- [x] Review the palette swatches and photo sources against C-01
- [x] Read the real Spanish copy
- [x] Accept or overturn each planner resolution above
- [x] Resolve the criterion-5 decision (A, B, or C) above

## Owner sign-off

To approve, add one line directly below this paragraph, yourself, giving your name
and the date after the `Approved-by:` label (label, a space, your name, an em dash,
then the date as `YYYY-MM-DD`) — for example: `Approved-by: Jaime Aleman — 2026-09-17`.

Then leave this section otherwise empty. This generator never writes that line.

## Revision requests

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

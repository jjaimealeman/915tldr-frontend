# Phase 1: Design Sketch & Editorial Identity - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

An approved, accessible visual system exists as **static HTML/CSS** — and is *accepted* —
before any Astro code is written.

Delivers: hand-written flat mockups for home, category, article, changelog and contact, in
light (default) and dark themes; the colour and type system they embody; and the measured
evidence that they meet the contrast, keyboard, Spanish-overflow and font-CLS criteria.

Explicitly NOT in this phase: any `.astro` file, any component extraction, any wiring to
real data at build time, any image generation, any Spanish content pipeline. Those are
Phases 3, 4, 6 and 7.

</domain>

<decisions>
## Implementation Decisions

### Palette & Category Colour System

- **D-01:** Category colour is **tiered**, not uniform. Vivid category colour appears as
  stripes, rules and small labels throughout the article grid, where text always stays on
  the neutral ink/paper pair. Darkened, contrast-verified colour **blocks** are reserved for
  two contexts only: the category index masthead and the article category header.
  Rationale: PRD §5.1 states verbatim *"Bold in the chrome, disciplined in the grid."*
  Stripes-only forfeits the bold chrome; blocks-everywhere puts colour into the grid, which
  is the failure mode §5.1 names by name (*"photographs beautifully and reads badly"*). Also
  bounds the contrast burden and keeps the above-fold LCP surface light.

- **D-02:** The eight hues are derived by **sampling hue from real photography, then forcing
  all eight onto fixed lightness/chroma stops in OKLCH**. Hue comes from the photo; lightness
  comes from the scale. Contrast therefore passes by construction.
  Rationale: sequencing. Picking by eye and fixing failures afterwards drags yellows and
  cyans furthest from their reference, breaking family coherence and forcing a second palette
  pass. This is the concrete risk behind PROJECT.md's *"the bold category palette is
  constrained by this, not the reverse."*

- **D-03:** Dark mode gets a **third lightness ramp on the same eight hues** — pushed lighter
  and slightly less saturated for a dark ground. Three stops per hue: vivid-on-light (grid
  stripe), text-safe (block background), vivid-on-dark (grid stripe). Category identity is
  constant across themes.
  Rationale: satisfies DSGN-05 (*"both themes fully designed"*) at the cost of one extra
  verified table row rather than eight new colour decisions. Reusing the light ramp would
  make dark the weaker theme — precisely what v1 is being rebuilt away from.

- **D-04:** Neutrals are **near-neutral, barely warm**. Light: paper ~`#FAFAF8` (reads as
  white, not cream), ink ~`#14161A`. Dark: paper ~`#121417` (charcoal, **not** warm
  brown-black), ink ~`#E8EAED`.
  Rationale: keeps the "printed page, not screen" quality and avoids pure-black halation
  behind Source Serif 4 in dark mode, while staying clear of the earth-tone register. Cool
  neutrals would dull the warm end of the palette; pure white/black reads as screen.
  **Supersedes** an earlier warm-bone (`#F7F3EC`) decision taken and withdrawn in the same
  session — see C-01.

### Mockup Fidelity & File Structure

- **D-05:** **7 files.** `index.html`, `category.html`, `article.html`, `changelog.html`,
  `contact.html`, one shared `style.css`, and `fonts/`. Themes flip via `data-theme` on
  `<html>`, driven by CSS custom properties — the same mechanism the real site will use.
  Both themes exist in every file without duplicating markup.
  Rationale: satisfies criterion 1 without markup drift. The custom-property layer ports to
  Astro verbatim, so the design translates rather than being rebuilt in Phase 3. The theme
  toggle is itself a keyboard-operable control, so it gets exercised by the criterion-3
  keyboard walk for free.
  — **Reversibility:** reversible — file layout is local to the mockup directory.

- **D-06:** Content is **real rows from the live D1 corpus, deliberately stress-picked** to
  span extremes rather than taking a recent slice: longest headline in corpus, shortest
  headline, a 200-word padded summary, a genuinely thin ~40-word summary, an article with 5
  tags and one with 0, a no-image case, a junk-image case, and a Spanish headline running
  +25% longer.
  Rationale: read-only, costs nothing, and surfaces layout failures now instead of in Phase 4
  with 41k pages built. A recent slice is too narrow a sample to contain the pathological
  cases.
  **CRITICAL for the planner:** Phase 2 **removes** the 100–200 word summary floor. 39.3% of
  sources are under 90 words and are currently padded to hit that floor. After Phase 2 those
  produce genuinely *short* summaries. Cards must survive both a two-line and a six-line
  summary. Do **not** design against today's uniformly-padded lengths — the distribution is
  about to widen at the bottom end.

- **D-07:** **Mobile-first, three widths, one stylesheet.** Base CSS written for 320px, then
  `min-width` media queries at ~768 and ~1280. No extra files — review by resizing. The worst
  case is drawn explicitly: 320px + Spanish copy + longest-in-corpus headline, simultaneously.
  Rationale: CWV targets are mobile p75, so mobile is the primary target, not the adaptation.
  PRD §6.1 makes 320px and 200% zoom acceptance criteria, and 320px is where Spanish +25%
  breaks first. Desktop-first makes narrow a subtraction problem, which is how 320px acquires
  a horizontal scrollbar.
  **Note:** 200% zoom is **not** a viewport width. It reflows differently from a narrow
  window and must be verified by driving a real browser, not by drawing a file for it.

- **D-08:** "Zero layout shift on font swap" is proven **empirically**. Load each mockup with
  the network throttled so the fallback paints before the woff2 arrives, and record CLS
  across the swap with a `PerformanceObserver`. Run in Chrome **and** a WebKit engine.
  Produces a number per page per browser — the artifact criterion 5 asks for.
  Rationale: settles two open research questions rather than assuming them — whether
  `size-adjust` holds in Safari, and whether `ascent-override`/`descent-override` do.
  PROJECT.md flags the Safari claim as a single unverified WebSearch result with an explicit
  *"do not ship a fallback strategy that depends on this without re-verifying."* Analytical
  computation would prove the CSS arithmetically correct, not that the browser honours it.

### Editorial Furniture & Grid

- **D-09:** Cards are **type-led**: category stripe, headline in Instrument Serif, summary,
  source, time. An image is an enhancement the card is complete without — never an empty
  slot. One **lead story** at larger scale tops the homepage, image-led when a usable image
  exists, falling back to a purely typographic treatment when not. **The imageless lead is
  designed as its own deliberate treatment**, not as a card missing a picture.
  Rationale: measured from PRD §9.1 over 37,180 processed articles — 58.0% usable image,
  39.1% **no image at all**, 1.5% emoji sprite, 1.5% generic station art. 42% imageless is
  not an edge case. Generated imagery is Phase 7, six phases out, so an image-led design
  would be validated against placeholders. Type-led also keeps the above-fold LCP candidate a
  text block rather than a remote image, against a release-blocking 1.5s mobile-p75 target.

- **D-10:** The oversized structural type role is played by a **standfirst deck** — one
  sentence between headline and body at intermediate display size, drawn from the summary's
  own opening sentence. **Pull quotes are dropped entirely.**
  Rationale: PRD §5.1 names pull quotes as a structural device, but the device does not
  survive contact with the content model. The article body *is* an AI-generated summary;
  setting machine-written text at display size presents it as editorial voice — the exact
  credibility problem Phase 2 exists to fix, and inconsistent with the per-article
  AI-disclosure requirement. Extracting genuine attributed speech would need a pipeline
  capability that does not exist, and PROJECT.md's legal posture warns specifically against
  verbatim-heavy excerpting. The deck is honest: presented as summary, where readers expect
  a summary.
  **This is a deliberate deviation from PRD §5.1 as written.** Flag at the next phase
  transition.

- **D-11:** `/changelog` (DSGN-07) renders as **dated dispatches**: date as editorial
  furniture, title as an Instrument Serif headline, and the existing `items[]` set as flowing
  prose rather than a `<ul>`. **No change to the entry format or to `/jja-commit`.**
  Rationale: verified against the real data rather than DSGN-07's wording. Two layers exist —
  `changelog/*.md` (61 developer-voiced entries) and `public/changelog.json`
  (`{date, title, items[]}`). The public `items` are **already complete plain-English
  sentences**, not release-note fragments; the editorial writing is largely done. What makes
  the page read as a changelog is that it renders as a bulleted list. DSGN-07 is therefore a
  narrower problem than its wording implies, and all 61 back entries render identically to
  new ones.

- **D-12:** Below the lead, the homepage is a **single reverse-chronological feed**, all
  categories mixed. The category stripe does the wayfinding; a persistent category nav gives
  access to the eight sections as their own pages. **No category-reserved space anywhere on
  the homepage.**
  Rationale: ~40 articles/day across 8 unevenly-distributed categories (Crime alone holds
  3,803 of ~37,000). Any layout reserving space per category produces thin or empty sections
  on a normal day; Health or Weather may have zero. Reverse-chron is the only shape that
  *structurally cannot* produce an empty section. The magazine feel is already carried by the
  lead, the display type and the chrome.

### Approval & Verification

- **D-13:** The contrast table is **generated from the CSS tokens**, not hand-written. A
  script reads the custom properties out of `style.css`, computes every ratio that matters
  (each ramp against its ground, ink on paper, focus ring against both grounds and against
  the block backgrounds), emits markdown, and **exits non-zero on any failure**.
  Rationale: it cannot drift from the stylesheet because it *is* the stylesheet, and it is
  re-runnable every time a hue is tuned — which will happen. Makes criterion 2's *"not
  accepted until this passes"* literally executable. The same script becomes the Phase 3 CI
  guard.
  **Table shape:** 3 verified rows, not 16 per-colour checks — lightness is held constant
  across each ramp, so all eight hues inherit the result. Re-verify each ramp against the
  **final** neutrals, not against pure white.

- **D-14:** The keyboard walk is **scripted, asserting against clipping, plus the owner's own
  pass**. A Playwright script tabs every focusable element on every mockup in both themes,
  screenshots each focus state, and asserts per element that (a) a visible focus indicator
  exists and (b) its box plus outline offset is not clipped by any `overflow` ancestor. The
  owner's manual pass then judges tab order and operability — the things no script decides —
  and that pass constitutes the criterion-1 approval.
  Rationale: criterion 3 says *"not by inspecting CSS"* because of a real prior failure — a
  focus ring clipped on two sides, "verified" by grepping HTML, caught by the owner. Clipping
  is the specific failure mode and it is programmatically detectable. Script for coverage and
  regression; human for judgment.

- **D-15:** Spanish test copy is **real translated Spanish plus a synthetic +25% floor**.
  Real Spanish for the stress set exercises true diacritics and word shapes — which also
  tests the font subset. One synthetic case per component, padded to exactly +25% over its
  English source, guarantees the requirement is actually exercised. Both asserted
  programmatically (`scrollWidth > clientWidth`, truncation detection, card height grows
  rather than clips).
  Rationale: only 565 of 37,180 articles (1.5%) originate in Spanish and Phase 6 has
  generated none, so there is no ready corpus. Real translation alone is unreliable for this
  test — some strings come out only ~10% longer, which would not exercise criterion 4 at all.
  Synthetic padding alone lacks real diacritics in real positions, which is exactly what
  PERF-07's Spanish-diacritic subsetting exists to protect against.

- **D-16:** Approval is **one runner plus a signed `01-APPROVAL.md`**. A single command runs
  all five criteria and prints a criterion-by-criterion verdict (mockups + both themes +
  no-`.astro`; contrast; keyboard/clipping; Spanish overflow; font subset + CLS).
  `01-APPROVAL.md` pastes that output, links the screenshot evidence, and carries the owner's
  explicit dated sign-off line.
  Rationale: machine evidence for what machines can judge, the owner's signature for what
  they cannot — whether it actually looks good. Criterion 1 is the gate Phase 3 builds on, so
  "approved" must mean something checkable later. Re-runnable, so a hue tuned in week two
  means re-run and re-sign rather than guessing what still holds.
  — **Reversibility:** one-way — Phase 3 onward treats this approval as settled; reopening
  the visual system after `.astro` components exist means redoing component work, not just
  CSS.

### Owner Constraints (override defaults)

- **C-01 — PALETTE REGISTER.** Stated 2026-09-16, verbatim: *"just because the project is
  community based in el paso texas, we dont have to always resort to desert colors, themes,
  palettes, etc. the shades of tan, brown, beige ... i dont really like those."*

  **Meaning:** sense of place is retained; the sun-bleached earth-tone register is rejected.
  Tan, brown, beige, adobe and sun-bleached terracotta are **out** as a palette direction and
  **out** of the neutrals. Source the eight hues from the **saturated** end of the real
  place — deep indigo night sky, hard turquoise daylight, ocotillo red, sotol and creosote
  green, marigold and violet sunset, and saturated El Paso/Juárez storefront and neon colour.

  **This does not conflict with PRD §5.1's intent.** §5.1 warns against *"a generic retro
  template"* and *"Memphis-pattern retro pastiche"* — and tan/adobe *is* the generic
  Southwest template. The constraint arguably makes the palette more place-specific:
  indigo-and-neon reads as El Paso/Juárez; tan reads as generic Southwest.

  **⚠ DOWNSTREAM WARNING:** DSGN-04 in REQUIREMENTS.md literally reads *"a distinct colour
  from a Chihuahuan desert palette."* An agent reading that wording alone **will** re-import
  the tan assumption. **C-01 overrides the plain reading of DSGN-04.** Recommend revising the
  DSGN-04 wording at the next phase transition — owner's call, not edited mid-phase.

  **Invalidated by this constraint:** the earlier warm-bone paper decision
  (`#F7F3EC` / `#1A1714`), withdrawn and re-decided as D-04.

### Claude's Discretion

None claimed — every decision above was selected by the owner from presented options.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design direction (the governing spec for this phase)
- `docs/PRD.md` §5.1 — Direction: editorial 1990s magazine, *"bold in the chrome,
  disciplined in the grid"*, sense of place, explicitly not a generic retro template.
  **Read alongside C-01, which narrows the palette register.**
- `docs/PRD.md` §5.2 — Typography: Instrument Serif (display), Source Serif 4 (body);
  Playfair Display and Merriweather explicitly forbidden.
- `docs/PRD.md` §5.3 — Theme: light default, dark secondary, both fully designed.
- `docs/PRD.md` §5.4 — Motion: `prefers-reduced-motion` honoured without exception; no
  animation may affect LCP or CLS.
- `docs/PRD.md` §5.5 — Interactivity: islands for genuine interaction only; **the article
  grid stays pure HTML** — if it renders as an island, the architecture has failed.
- `docs/PRD.md` §5.6 — Process: static HTML/CSS mockups first, before anything touches Astro
  or real data.

### Quality gates this phase must satisfy
- `docs/PRD.md` §6.1 — Accessibility: WCAG 2.2 AA; contrast 4.5:1 body / 3:1 large and UI;
  keyboard reachability with **visible, unclipped** focus indicators; 200% zoom and 320px
  width with no horizontal scroll or content loss.
- `docs/PRD.md` §6.5 — Fonts: self-hosted, subset including Spanish diacritics, woff2 only,
  preload above-the-fold faces, `font-display: swap` with `size-adjust` metric-compatible
  fallbacks.
- `docs/PRD.md` §6.2 — Core Web Vitals: LCP < 1.5s, CLS < 0.05, mobile p75, release-blocking.

### Content model that shapes the design
- `docs/PRD.md` §9.1 — Measured imagery state over 37,180 articles: 58.0% usable, 39.1% no
  image, 1.5% emoji sprite, 1.5% generic station art. **Drives D-09.**
- `docs/PRD.md` §8.1–8.3 — Content quality: the padding defect, the 100–200 word floor that
  Phase 2 removes, and the posture against verbatim-heavy excerpting. **Drives D-06 and
  D-10.**

### Project-level
- `.planning/PROJECT.md` — Constraints and Key Decisions; the Safari `size-adjust` /
  `ascent-override` caveat; the `glyphhanger` / `fontaine` LOW-confidence flag.
- `.planning/REQUIREMENTS.md` — DSGN-01…07, A11Y-01, PERF-07, I18N-07.
  **DSGN-04's wording is overridden by C-01.**
- `.planning/ROADMAP.md` — Phase 1 goal and its five success criteria.

### Reference material (read-only; do not modify)
- `docs/screenshots/before/` — 12 before-shots of the v1 site (6 pages × light/dark). The
  thing being replaced.
- `/home/jaime/www/_github/915tldr.com2/server/db/seeds/001-categories.sql` — the eight
  canonical categories: Crime, Politics, Sports, Business, Education, Community, Health,
  Weather (with slugs and sort order).
- `/home/jaime/www/_github/915tldr.com2/public/changelog.json` — the public changelog data
  shape that D-11 renders.
- `/home/jaime/www/_github/915tldr.com2/changelog/*.md` — 61 internal entries (richer, but
  developer-voiced; **not** the source for D-11).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

**None in this repository.** This repo is greenfield — it contains only `docs/` and
`.planning/`. There is no `package.json`, no source tree, and no build.

### Established Patterns

- The v1 implementation lives in `/home/jaime/www/_github/915tldr.com2` and is **reference
  only** for this phase. Nothing in it is reused: v1 is Nuxt/Vue, dark-first, and uses
  Playfair Display — all three of which this phase exists to replace.
- `jja-playwright` and `jja-lighthouse` are installed and are the intended harnesses for
  D-08, D-14 and D-15.

### Integration Points

- The CSS custom-property layer written in D-05 is the **single artifact that crosses into
  Phase 3**. It should be authored as if it were already the production token file, because
  it will be copied rather than re-derived.
- The contrast script (D-13) is written here and **becomes the Phase 3 CI guard**. Author it
  as a standalone check with a non-zero exit, not as a one-off report generator.

### Platform Constraint — flagged for the planner

**Safari is not available.** The owner is on Arch Linux. D-08 calls for a WebKit pass to
settle the `size-adjust` / `ascent-override` question. The substitute is Playwright's WebKit
build — the same engine, but **not** identical to Safari on macOS/iOS. A WebKit pass is
strong evidence, not the final word. The planner must either accept WebKit-on-Linux as
sufficient and say so explicitly, or schedule one confirmation pass on a borrowed iOS device.
**Do not report "Safari verified" from a Linux run.**

</code_context>

<specifics>
## Specific Ideas

- **Reference for the direction:** *Wired* circa 1993–96 editorial design — oversized display
  type, confident colour blocking, visible rules and section furniture. Explicitly **not**
  Memphis-pattern retro pastiche (PRD §5.1).
- **Palette sources named by the owner's constraint (C-01):** deep indigo night sky, hard
  turquoise daylight, ocotillo red, sotol and creosote green, marigold and violet sunset,
  saturated El Paso/Juárez storefront and neon colour. **Not** adobe, sand or terracotta.
- **The stress set is the phase's safety net.** If the grid holds for the seven pathological
  cases in D-06, it holds for 41,233 articles. Build it first, design against it throughout.
- **The imageless lead story is a first-class design**, not a fallback. It will be on screen
  roughly 42% of the time.

</specifics>

<deferred>
## Deferred Ideas

None — the discussion stayed within phase scope. No new capabilities were proposed.

## Open Within This Phase (not deferred — unresolved)

These were surfaced and deliberately left open. They need a decision during research or
planning, not from the owner:

1. **Link colour and focus-ring colour**, including focus-indicator contrast against the
   *coloured block* backgrounds — the fiddly case, since the ring must clear 3:1 against
   whatever it sits on, and the blocks are eight different colours.
2. **Whether 915 TLDR itself owns a brand colour** distinct from the eight category hues.
3. **Masthead / wordmark treatment**, and how an eight-category nav behaves at 320px.
4. **Category index masthead** — one of the two contexts using a darkened colour block
   (D-01).
5. **Subsetting toolchain.** `glyphhanger` and `fontaine` were both flagged **LOW confidence,
   WebSearch-only** in project research, never checked against Vite/Astro docs. Verify before
   committing, or pick a substitute.
6. **Whether mockups carry real images or placeholders**, given the junk-image problem
   (1,098 emoji-sprite and station-art images) that Phase 7 filters.
7. **Theme toggle needs a few lines of JS** to flip `data-theme`. DSGN-06's zero-JS rule
   applies to the **article grid**, not the chrome. Confirm that reading holds before
   building.

</deferred>

## Amendments after owner review (2026-09-17)

The owner reviewed all five mockups in a real browser on 2026-09-17 and chose **revise, not
approve** (see `01-APPROVAL.md`, "Revision requests" and "Owner decisions (answered
2026-09-17)" for the owner's own words). This section records how that review amended the
decisions above.

- **D-08 is superseded in method by D-GAP-A**: `font-display: optional` + preloads, with
  zero swap-triggered layout shift proven by classified measurement plus a positive control
  (01-13).
- **D-09 is amended by D-GAP-B**: headlines move to Source Serif 4 Bold; Instrument Serif is
  kept for the "915 TLDR" wordmark only (01-14). The type-led card rule (D-09's other half) is
  unchanged.
- **C-01 is applied by D-GAP-C**: Business is re-sampled from a new photo; Sports is accepted
  by the owner as-is (01-16).
- **D-GAP-D**: pnpm is the sole package manager (01-11).
- **Round-1 revision requests 1–10**, by number, with the plan that closes each:

  | Item | Closed by |
  |---|---|
  | 1 — remove the black/white header rule | 01-17 |
  | 2 — category lead image only when usable; typographic fallback | 01-18 |
  | 3 — article right rail at >=1024px | 01-19 |
  | 4 — changelog layout bug and whitespace | 01-20 |
  | 5 — contact centred; button/heading spacing | 01-20 |
  | 6 — external links open in a new tab with an accessible cue | 01-17 |
  | 7 — full width at 768px for article, changelog and contact | 01-19, 01-20 |
  | 8 — Load more (static JSON, button) | 01-21, 01-22 |
  | 9 — raw markdown in summaries | 01-12, 01-18 |
  | 10 — theme toggle outside the column at 1920px | 01-17 |

- **DSGN-03's wording** ("Display type is Instrument Serif") needs rewording to reflect
  D-GAP-B at the phase transition. This is the owner's call and is not edited mid-phase.

- **D-05 amended (01-21):** the mockups directory gains an eighth entry, `feed/` — static JSON
  pages (`page-2.json … page-N.json`) for the homepage's load-more control. Rationale
  unchanged from D-05's own reversibility note: the file layout is local to the mockup
  directory and reversible; the real site will serve pre-built feed JSON beside its pages, so
  keeping the mockup in that shape lets Phase 3 copy the contract instead of redesigning it.

- **D-12 amended (01-21):** the home grid now server-renders the lead plus the first 6 cards
  of the reverse-chronological feed, then a Load more button appends further pre-built cards
  from static same-origin JSON, in pages of 6, continuing the same true reverse-chronological
  order across pages (revision request 8 — "first load is overwhelming... maybe a load more
  button? start with maybe 2-3 rows?!"). D-12's other rule — no category-reserved space
  anywhere on the homepage — is unchanged; load-more only paginates the single mixed feed, it
  does not introduce per-category sections.

- **DSGN-06 / ROADMAP criterion 5 wording flagged for the phase transition:** the requirement
  text ("article grid is pure HTML with zero JavaScript") should be reworded once this phase
  transitions. The server-rendered grid stays script-free and identical with JavaScript
  disabled (proven by structure.spec.ts's "grid renders identically with JavaScript disabled"
  test, now covering the trimmed 6-card grid); the PRD §5.5 load-more island is a separate,
  explicitly-named genuine interaction that appends pre-built cards on request, not part of
  the pure-HTML grid claim. This is the owner's call, not edited mid-phase.

---

*Phase: 1-Design Sketch & Editorial Identity*
*Context gathered: 2026-09-16*

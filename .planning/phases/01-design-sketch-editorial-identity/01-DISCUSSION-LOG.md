# Phase 1: Design Sketch & Editorial Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 1-design-sketch-editorial-identity
**Areas discussed:** Palette + category colour system, Mockup fidelity + file structure, Editorial furniture + grid, Approval + verification method

---

## Palette + Category Colour System

### Where are the eight category colours allowed to appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered: stripes + blocks | Vivid stripes in the article grid, darkened contrast-verified blocks in category/article headers | ✓ |
| Stripes only | Colour never sits behind text; palette stays fully vivid, contrast near-automatic | |
| Blocks everywhere | Colour is a filled background wherever a category appears | |

**User's choice:** Tiered.
**Notes:** Presented as effectively pre-decided by PRD §5.1's *"Bold in the chrome, disciplined in the grid"* — stripes-only forfeits the bold chrome, blocks-everywhere triggers the named failure mode. The owner asked for a recommendation before choosing; the recommendation and its reasoning were given, then selected.

### How do the eight desert colours get picked?

| Option | Description | Selected |
|--------|-------------|----------|
| Sample photos, snap to OKLCH scale | Hue from real photography, lightness forced onto a fixed scale; contrast passes by construction | ✓ |
| Pick by eye, fix failures after | Choose what looks right, run the contrast table afterwards, adjust what fails | |
| Even wheel spacing, no photos | Eight hues spaced around the wheel at fixed lightness, named after desert things | |

**User's choice:** Sample photos, snap to scale.
**Notes:** Deciding factor was sequencing — fixing failures afterwards drags yellows and cyans furthest and breaks family coherence, forcing a second palette pass.

### How does the palette behave in dark mode?

| Option | Description | Selected |
|--------|-------------|----------|
| Third ramp, same eight hues | New lightness stop tuned for a dark ground; three stops per hue | ✓ |
| Reuse the light ramp | Same values both themes, only background and text flip | |
| Desaturate dark mode | Categories become tinted greys, colour only in block headers | |

**User's choice:** Third ramp.
**Notes:** Cost framed as one extra verified table row rather than eight new colour decisions, because hue was already locked separately from lightness.

### What are the neutral paper and ink colours? *(asked twice — see below)*

**First pass:**

| Option | Description | Selected |
|--------|-------------|----------|
| Warm paper, warm ink | Bone `#F7F3EC` / warm black `#1A1714`; "sense of place" neutral | ✓ *(later withdrawn)* |
| Pure white / pure black | Maximum contrast, colours pop hardest | |
| Cool grey neutrals | Modern-web default; cool cast | |

**Second pass, after the owner's constraint:**

| Option | Description | Selected |
|--------|-------------|----------|
| Near-neutral, barely warm | `#FAFAF8` / `#14161A`; reads as white, no cream | ✓ |
| Slightly cool | Faint cool cast, maximum distance from earth tones | |
| Pure white / pure black | Zero tint, maximum contrast | |

**User's choice:** Warm bone first, then near-neutral after raising the constraint below.
**Notes:** The owner selected the warm-bone option and then immediately flagged, unprompted, that they dislike tan/brown/beige generally. Since bone *is* a beige, the decision was re-opened in the same session rather than carried forward. This is the only decision in the phase that was taken and then withdrawn.

### Owner constraint raised mid-area

> *"just because the project is community based in el paso texas, we dont have to always resort to desert colors, themes, palettes, etc. the shades of tan, brown, beige ... i dont really like those."*

**Handling:** Recorded as constraint C-01 in CONTEXT.md rather than treated as a passing remark, because it overrides the plain reading of requirement DSGN-04 (*"a distinct colour from a Chihuahuan desert palette"*). Reconciled with PRD §5.1 rather than presented as a conflict — §5.1 already warns against a "generic retro template," and tan/adobe is that template. Flagged for a DSGN-04 wording revision at the next phase transition; not edited mid-phase.

---

## Mockup Fidelity + File Structure

### What do the mockup files look like on disk?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 pages + 1 CSS, theme by attribute | 7 files, `data-theme` on `<html>`, custom properties | ✓ |
| 10 files — page × theme | Separate light/dark files, mirrors `docs/screenshots/before/` naming | |
| Style guide first, pages after | Component specimen page, then assembled layouts | |

**User's choice:** 7 files, theme by attribute.
**Notes:** Selected on the grounds that the custom-property layer ports to Astro verbatim, and that the theme toggle gets exercised by the criterion-3 keyboard walk for free.

### What content fills the mockups?

| Option | Description | Selected |
|--------|-------------|----------|
| Real corpus, stress-picked | Extremes: longest/shortest headline, padded/thin summary, 5 tags/0 tags, no image/junk image, Spanish | ✓ |
| Real corpus, recent slice | Last ~20 articles as they are | |
| Hand-written placeholder | Invented El Paso headlines at chosen lengths | |

**User's choice:** Stress-picked.
**Notes:** Question was prefaced with a finding the owner had not raised — Phase 2 removes the 100–200 word summary floor, so designing against today's uniformly-padded lengths designs for a distribution about to widen. Recorded in CONTEXT.md as a critical note for the planner.

### Which viewports get designed?

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile-first, 320/768/1280 | Base CSS at 320, min-width queries up; worst case drawn explicitly | ✓ |
| Desktop-first, adapt down | Design at 1280, collapse with max-width queries | |
| 320 and 1280 only | Skip the tablet width | |

**User's choice:** Mobile-first, three widths.
**Notes:** Noted that 200% zoom is not a viewport width and reflows differently — verified by driving a browser, not by drawing a file.

### How is "zero layout shift on font swap" proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Real browser, throttled, CLS observed | PerformanceObserver across the swap, Chrome + WebKit | ✓ |
| Compute and assert the metrics | Analytical `size-adjust` calculation from font tables | |
| Screenshot diff across the swap | Visual before/after comparison | |

**User's choice:** Real browser, throttled.
**Notes:** Framed around two unresolved research questions — PROJECT.md flags the Safari `size-adjust`/`ascent-override` claim as a single unverified WebSearch result, and `fontaine` as LOW confidence. After selection, a platform problem was surfaced: Safari does not run on Arch Linux, so the WebKit pass must come from Playwright's build, which is the same engine but not identical to Safari on macOS/iOS. Recorded as a planner-facing constraint rather than resolved here.

---

## Editorial Furniture + Grid

### What is an article card made of, and what leads the homepage?

| Option | Description | Selected |
|--------|-------------|----------|
| Type-led grid, lead may go image-led | Image is an enhancement, never an empty slot; imageless lead designed deliberately | ✓ |
| Type-led throughout, no lead | Uniform grid, safest LCP, no focal point | |
| Image-led throughout | Conventional news grid | |

**User's choice:** Type-led with an image-optional lead.
**Notes:** Question was re-framed after checking PRD §9.1 rather than recalling it — 58.0% usable image, 39.1% none at all, 3% junk. The 42% imageless figure turned this from a style question into a content-model question.

### What plays the "oversized structural type" role inside an article?

| Option | Description | Selected |
|--------|-------------|----------|
| Standfirst deck, no pull quotes | One sentence at display size between headline and body | ✓ |
| Key-fact callout | A number or hard fact pulled out of the flow | |
| Pull quotes, source-attributed only | Render only when genuine attributed speech exists | |

**User's choice:** Standfirst deck.
**Notes:** Raised as a case where the PRD's named device does not survive the content model — the article body is AI-generated, so a pull quote would set machine text as editorial voice. Recorded in CONTEXT.md as a deliberate deviation from PRD §5.1 for flagging at phase transition.

### What is the editorial treatment for `/changelog` (DSGN-07)?

| Option | Description | Selected |
|--------|-------------|----------|
| Dated dispatches from existing items | Items rendered as prose rather than a `<ul>`; no pipeline change | ✓ |
| Add a standfirst field per entry | Richer, but needs a `/jja-commit` change and 61 backfills | |
| Promote the internal "Why" sections | Best writing, but developer-voiced and cites file paths | |

**User's choice:** Dated dispatches.
**Notes:** The two changelog layers were inspected in `915tldr.com2` before the question was asked. Finding: `public/changelog.json` items are already complete plain-English sentences, so DSGN-07 is a rendering problem, not a writing problem — narrower than the requirement's wording implies.

### How is the homepage organised below the lead story?

| Option | Description | Selected |
|--------|-------------|----------|
| Reverse-chron feed, stripe + nav | One feed, no category-reserved space | ✓ |
| Category-sectioned departments | Eight labelled sections down the page | |
| Hybrid — feed plus live sections | Sections render only when they have enough stories | |

**User's choice:** Reverse-chron feed.
**Notes:** Decided on distribution data — ~40 articles/day across 8 uneven categories (Crime alone holds 3,803 of ~37,000) means reserved sections would be thin or empty on a normal day.

---

## Approval + Verification Method

### How is the contrast table produced?

| Option | Description | Selected |
|--------|-------------|----------|
| Generated from the CSS tokens | Script parses custom properties, computes ratios, exits non-zero | ✓ |
| Hand-recorded after manual checks | Markdown table committed as a snapshot | |
| Automated axe/Lighthouse report | Broader coverage, but only tests pairs that appear on rendered pages | |

**User's choice:** Generated from tokens.
**Notes:** Deciding factor was drift — a hand-written table still says PASS after a hue is tuned. Also makes criterion 2's "not accepted until this passes" executable, and becomes the Phase 3 CI guard.

### How does the keyboard walk get done and evidenced?

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted walk asserting clipping + owner's pass | Playwright tabs every focusable, asserts ring exists and is unclipped; owner judges tab order | ✓ |
| Manual keyboard walk only | ~140 states inspected by hand, no regression value | |
| Scripted walk only | Exhaustive but cannot judge tab-order sensibility | |

**User's choice:** Scripted plus owner's pass.
**Notes:** Framed against the owner's own documented history — a focus ring clipped on two sides, previously "verified" by grepping HTML. Clipping is programmatically detectable by comparing the focus box against `overflow` ancestors, so the specific past failure gets an assertion.

### Where does the Spanish test copy come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Real Spanish + guaranteed +25% floor | Real translation for diacritics, synthetic padding to exercise the spec | ✓ |
| Owner writes the Spanish | Hand-written, natural to a local reader | |
| Synthetic padding only | Fully controlled, but no real diacritics in real positions | |

**User's choice:** Real plus synthetic floor.
**Notes:** Raised that real translation alone is unreliable for this test — some strings come out only ~10% longer and would not exercise criterion 4 at all. Only 565 of 37,180 articles (1.5%) originate in Spanish, and Phase 6 has generated none.

### What form does phase approval take?

| Option | Description | Selected |
|--------|-------------|----------|
| One runner + signed APPROVAL.md | Single command, five criteria, verdict pasted with dated sign-off | ✓ |
| Separate artifacts, no runner | Each check its own report; approval noted in STATE.md | |
| Conversational approval | Owner says approved, recorded in CONTEXT.md | |

**User's choice:** One runner plus signed APPROVAL.md.
**Notes:** Rated one-way in CONTEXT.md — Phase 3 onward treats the approval as settled, so reopening the visual system after `.astro` components exist means redoing component work, not just CSS.

---

## Claude's Discretion

None. Every decision in this phase was selected by the owner from presented options. No
question was answered with "you decide," and no area was delegated.

---

## Deferred Ideas

None. The discussion stayed within the phase boundary — no new capabilities were proposed at
any point, so nothing needed redirecting to the roadmap backlog.

Seven items were left **open within the phase** rather than deferred out of it (link and
focus-ring colour, brand colour, masthead and 320px nav, category index masthead, subsetting
toolchain, real-vs-placeholder images, theme-toggle JS against DSGN-06). These are recorded in
CONTEXT.md's `<deferred>` section under "Open Within This Phase" and need resolution during
research or planning — not from the owner.

---

## Process Notes

- **One decision was withdrawn and re-taken:** the paper/ink neutrals, after the owner raised
  the tan/brown/beige constraint immediately following their selection. Re-opened in-session
  rather than carried forward, since the chosen value contradicted the stated constraint.
- **Three questions were re-framed after checking source data** rather than being asked from
  recall: the card/lead question (PRD §9.1 imagery measurements), the changelog question
  (inspecting both changelog layers in `915tldr.com2`), and the content question (Phase 2's
  removal of the summary floor).
- **Two clarification requests** were made by the owner early on ("eli5 choices", "what is
  your recommendation?"), after which every subsequent question carried a plain-language
  framing, a marked recommendation with reasoning, and an ASCII preview where a visual
  comparison helped.


# 2026-10-08 - Share cards: EN and ES 1200x630 PNGs rendered offline from one hand-composed source

**Keywords:** [FEATURE] [DESIGN] [FRONTEND] [TESTING]
**Session:** Night, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2235_og-card-renderer-en-es.md`

## What Changed

- File: `tools/og-card/card.html`
  - Hand-composed V1 masthead card (logo, 188px Instrument Serif wordmark, italic tagline, rule, credit line, 8-segment category stripe) using the v2 token values
  - One source, two languages via `?lang=en|es`; throws on any other value
  - Unique `@font-face` names ("OG Card Display" / "OG Card Serif") so locally installed same-named fonts cannot win
- File: `tools/og-card/render.mjs`
  - Offline Chromium renderer (`@playwright/test`), serves card.html, the three woff2 files and the logo from an allow-list under an `.invalid` origin; any other request is aborted and fails the run
  - Self-checks: all fonts loaded, credit line is one line within 1028px, tagline ends left of the wordmark, leftmost ink of each band within 84..88, stripe colours within 3 per channel
- File: `tools/og-card/logo-light.png`
  - Byte copy of the v1 bubble mark, so the render no longer needs the 915tldr.com2 checkout
- File: `public/og-image.png`, `public/og-image-es.png`
  - 1200x630 8-bit RGB PNGs, 41,539 and 42,524 bytes

## Why

SOC-05 and SOC-06: one static share card per language, composed by hand from the v2 tokens with no AI-rendered text, reproducible from committed source. This is the tracer of plan 07-02; the icon set and the asset test follow.

## Issues Encountered

No major issues encountered. The first draft of card.html used `\u` escapes for the accented ES copy; they were replaced with literal characters so the exact copy strings are greppable and testable.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `node tools/og-card/render.mjs` exits 0 with every self-check passing and zero aborted requests; both PNGs viewed
- What wasn't tested: real scraper previews (07-09); the asset unit test arrives in Task 3
- Edge cases: ES credit line (979px) fits one line inside the 1028px rule

## Next Steps

- [ ] Icon set: favicon.svg, favicon.ico (32x32), apple-touch-icon
- [ ] Asset test pinning formats, sizes, tokens and copy
- [ ] Owner sign-off of the rendered pair at the 07-06 checkpoint

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - new public assets and a render tool; no runtime code changed

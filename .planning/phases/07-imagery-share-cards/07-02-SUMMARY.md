---
phase: 07-imagery-share-cards
plan: 02
subsystem: share-assets
tags: [share-cards, og-image, favicon, apple-touch-icon, chromium-render, ico]
requires: []
provides:
  - public/og-image.png and public/og-image-es.png (1200x630 RGB share cards, EN and ES)
  - public/favicon.svg, public/favicon.ico (32x32), public/apple-touch-icon.png (180x180)
  - tools/og-card/{card.html, render.mjs, ico.mjs, logo-light.png} (one offline command regenerates all five public files)
  - tests/unit/share-card-assets.test.mjs
affects: [07-03, 07-04, 07-06, 07-07, 07-08, 07-09]
tech-stack:
  added: []
  patterns:
    - hand-composed HTML card rendered by Chromium under an .invalid origin with an allow-listed route table
    - renderer that checks its own output (fonts, single-line credit, ink alignment, stripe colours) and exits non-zero
    - dependency-free ICO container encoder with PNG-compressed entries
key-files:
  created:
    - tools/og-card/card.html
    - tools/og-card/render.mjs
    - tools/og-card/ico.mjs
    - tools/og-card/logo-light.png
    - public/og-image.png
    - public/og-image-es.png
    - public/favicon.svg
    - public/favicon.ico
    - public/apple-touch-icon.png
    - tests/unit/share-card-assets.test.mjs
  modified: []
key-decisions:
  - "Card copy lives in card.html as literal UTF-8 (not \\u escapes) so the exact strings are greppable and pinned by the asset test"
  - "Unique @font-face family names (OG Card Display / OG Card Serif) so this machine's locally installed Instrument Serif and Source Serif 4 can never win over the woff2 files"
  - "favicon.ico is one 32x32 entry rasterised from favicon.svg (D-23); v1's Nuxt-logo .ico is not ported"
requirements-completed: []
duration: ~20 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 9700
  tasks: 3
  commits: 4
---

# Phase 7 Plan 02: Share cards and icon set Summary

Two 1200x630 RGB share cards (EN, ES) and the favicon.svg / 32x32 favicon.ico / 180px apple-touch-icon now exist in `public/`, produced by one offline command (`node tools/og-card/render.mjs`) from a committed hand-composed HTML source, with the renderer failing loudly on a wrong font, a wrapped credit line, a misaligned edge or a wrong stripe colour.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Card source, offline renderer, EN and ES PNGs with self-checks | dfab257 | tools/og-card/{card.html, render.mjs, logo-light.png}, public/og-image.png, public/og-image-es.png |
| 2 RED | Failing encodeIco tests | 1ac7635 | tests/unit/share-card-assets.test.mjs |
| 2 GREEN | ICO encoder, favicon.svg port, icons step in render.mjs | 69f5dc0 | tools/og-card/ico.mjs, tools/og-card/render.mjs, public/favicon.{svg,ico}, public/apple-touch-icon.png |
| 3 | Asset test (formats, sizes, tokens, copy, hygiene, redirects) | 83da77a | tests/unit/share-card-assets.test.mjs |

Each commit carries its `changelog/` entry and the README index row. The public `changelog.json` was not touched (the cards are not live until Jaime merges at 07-08; same choice as 07-01).

## Acceptance results (real output)

Task 1:
- `node tools/og-card/render.mjs` exit 0, "render ok", zero aborted requests. Fonts: all 3 FontFace entries `loaded`; `document.fonts.check("188px OG Card Display")` true.
- Measured geometry, EN: credit scrollWidth 885, left 86, right 971; tagline right 508.0; wordmark text-range right 650.0. ES: credit scrollWidth 979, right 1065; tagline right 642.0; wordmark right 650.0. Credit line is 1 client rect on both. (The UI-SPEC's wordmark ink edge x=654 is the ink extent; the text range reads 650.0. ES tagline clears it by 8px on the range measure.)
- Leftmost ink (want 84..88): EN logo 86, wordmark 84, tagline 86, credit 86; ES logo 86, wordmark 84, tagline 85, credit 87.
- Stripe at y=620, all 8 segments within 3 per channel of the UI-SPEC values on both cards (e.g. segment 0 rgb(202,85,81) vs #CA5551).
- `file public/og-image.png public/og-image-es.png | grep -c '1200 x 630, 8-bit/color RGB,'` printed `2`.
- Byte sizes: `og-image.png` 41,539; `og-image-es.png` 42,524 (UI-SPEC measured about 43,228 / 45,319 for the 24px mockup pair). Both far under 5,000,000.
- `cmp tools/og-card/logo-light.png .../915tldr.com2/public/logo-light.png` exit 0.
- `grep -c 'Noticias de El Paso, en breve.' tools/og-card/card.html` = 1; `grep -c 'siempre con crédito, siempre con enlace.'` = 1.
- `grep -cE 'file:|/home/'` on card.html and render.mjs: 0 and 0 (also 0 for ico.mjs).
- A second full render left both PNGs byte-identical (`git status --short public tools` clean after re-run): the render is deterministic on this machine.
- Both PNGs were opened and looked at: Spanish accents and the EN em dash render in the intended faces (no missing-glyph boxes).

Task 2:
- `node --test tests/unit/share-card-assets.test.mjs` after GREEN: 10 pass, 0 fail (RED 1ac7635 failed with ERR_MODULE_NOT_FOUND before GREEN 69f5dc0).
- `cmp public/favicon.svg .../915tldr.com2/public/favicon.svg` exit 0 (byte-identical).
- `file public/favicon.ico`: `MS Windows icon resource - 1 icon, 32x32 with PNG image data, 32 x 32, 8-bit/color RGBA` (922 bytes).
- `cmp -s public/favicon.ico .../915tldr.com2/public/favicon.ico` exit 1 (differs from v1's Nuxt-logo .ico, as D-23 requires).
- `file public/apple-touch-icon.png`: `180 x 180, 8-bit/color RGB, non-interlaced` (4,389 bytes). Renderer log: alpha ink box 797x457 scaled to 148x84.9; ink x 16..163 (width 148), y 48..131; margins L16 R16 T48 B48.
- `fc-match Arial` on this machine: `Arimo[wght].ttf: "Arimo" "Regular"`. The "915" glyphs baked into favicon.ico are Arimo, not Arial; the live favicon.svg uses the viewer's own Arial mapping.
- Small-size check (UI-SPEC asks for 16 and 32): rendered favicon.svg at 16px (pixelated), 32px and 128px in Chromium and looked at it. At 16px the "915" is very small but still reads as three digits; 32px is clean. No surprise, but it is a judgement from one screenshot.

Task 3:
- `node --test tests/unit/share-card-assets.test.mjs`: 23 tests, 23 pass, 0 fail.
- Check 5 sensitivity: on a temporary in-memory mutation (`oklch(0.600 0.150 269.5)` changed to `270.5`) the same stripe-vs-global.css comparison failed as expected; on the unmodified card.html it passed. Nothing about this was committed.
- `pnpm run test:fast`: 1134 tests, 1125 pass, 0 fail, 9 skipped (07-01 baseline 1111 / 1102 / 0 / 9, so +23 tests, no new failures).

## Provenance and regeneration

The one-time copies in this plan read two external locations: `~/.claude/cache/og-card/` (the approved mockup `v1-masthead.html` and its renderer, read for porting only, nothing copied byte-for-byte) and `/home/jaime/www/_github/915tldr.com2/public/` (`logo-light.png` and `favicon.svg`, copied verbatim and `cmp`-verified). Every later render (`node tools/og-card/render.mjs`, any mode) reads only files inside this repo: `tools/og-card/` (card.html, logo-light.png), `public/fonts/` and `public/favicon.svg`. No external path is needed to regenerate the assets.

## Deviations from Plan

**1. [Process] Tracer gate substituted by the automated re-run.** Same as 07-01: auto mode is off, so the executor spec calls for a `checkpoint:human-verify` after the tracer commit. The orchestrator's instruction for this run was to execute all tasks, so after committing the tracer (dfab257) I re-ran its `<verify>` (render ok, `file` count 2, PNGs byte-identical) and continued. No human looked at the tracer before Task 2 and 3; those do not build on the card layout. Jaime's eyes on the pair are the 07-06 checkpoint anyway.

**2. [Plan premise] `git diff --quiet ef4318a -- src/layouts/Base.astro src/styles/global.css` cannot pass as written.** 07-01 (commit 87eb5d6, after ef4318a) intentionally edited Base.astro, so that diff exits 1 regardless of this plan. Measured instead: `global.css` is unchanged against ef4318a (exit 0), and both files are unchanged against `HEAD~4` (the commit before this plan's first commit) and against HEAD. This plan touches neither.

**3. [Rule 1 - Bug] Accented ES copy written as `\u` escapes in the first card.html draft.** The acceptance greps and asset test need the literal strings, so I rewrote the draft with literal UTF-8 (em dash, é, ú) before the first render and commit. No separate fix commit.

No other deviations. No threshold in the renderer was loosened and the logo `left` stayed at the UI-SPEC's 78px (it measured x=86 first time).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-07-05 holds: zero aborted requests, every request served from the allow-list under `http://og-card.invalid`. T-07-06: asset test rejects `file:` and `/home/` in the three source files. T-07-07: asset test caps size, actual 41.5 KB and 42.5 KB. T-07-08: no `_redirects` rule matches the five asset paths.

## Owner decisions still open (carried to the 07-06 checkpoint)

- Credit line at 20px instead of the mockup's 24px, plus the non-multiple-of-4 geometry: shipped on the planner's assumption, needs Jaime's eye on the rendered pair.
- ES wording on the rendered ES card.
- favicon identity: favicon.svg (and so favicon.ico) is v1's blue rounded "915" tile, not the bubble mark; D-23's wording called it "the bubble mark". Jaime confirms the tile or asks for a switch (applied in 07-07).

## Not verified

- No real scraper, WhatsApp, iMessage, Slack or Facebook preview (that is 07-09). Thumbnail legibility at 600/300/150px is the UI-SPEC's prediction, not re-measured here.
- The apple-touch-icon was not seen on an iOS device (square corners, opaque; iOS masking not exercised).
- The assets are not yet referenced by a deployed page and the URLs 404 on dev until merge and deploy.
- The 16px favicon judgement comes from one screenshot on this machine's Arimo mapping; other OS fonts for Arial will differ slightly.
- No `pnpm build`, no typecheck, no dev server, no database access (all forbidden for this run). The static file count (+5, about 59,621 against a 70,000 warn line) is arithmetic from the plan, not a measured build.
- REQUIREMENTS.md not touched: SOC-05 also needs the cards wired and validated, and SOC-06 is only fully shown after owner sign-off, so neither was marked complete here (the plan's own success criteria stop at the files existing).

## Cleanup needed

None.

## Self-Check: PASSED

- FOUND: tools/og-card/card.html, tools/og-card/render.mjs, tools/og-card/ico.mjs, tools/og-card/logo-light.png, public/og-image.png, public/og-image-es.png, public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png, tests/unit/share-card-assets.test.mjs
- FOUND commits: dfab257, 1ac7635, 69f5dc0, 83da77a

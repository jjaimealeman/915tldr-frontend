# Phase 7 review packet (plan 07-06)

Everything here is rendered from the committed files in `public/` by
`node tools/og-card/render.mjs --review docs/phase-07/evidence/review`. Review mode writes only
into this directory; `git status --porcelain public/` stays empty. Nothing has been pushed and
nothing ships until 07-08.

Also look at the full-size cards: `public/og-image.png` (EN) and `public/og-image-es.png` (ES),
both 1200x630.

## Already settled, not asked

D-21 (og:image origin constant), D-22 (og:locale:alternate on every page) and D-23 (32x32
favicon.ico rasterised from favicon.svg) were settled on 2026-10-08. Do not re-open them here.

## The images

Legibility rule from the UI-SPEC: the wordmark and the tagline must read at 300px wide, the
wordmark alone at 150px, and the credit line is exempt at every thumbnail size.

| File | What it shows | What to judge |
|------|---------------|---------------|
| `card-en-600.png` | EN card at 600x315 | Overall composition at a typical feed size |
| `card-en-300.png` | EN card at 300x158 | Wordmark and tagline must read; credit line may not |
| `card-en-150.png` | EN card at 150x79 | Wordmark must read; nothing else is required |
| `card-en-square-crop.png` | EN card, centre 630x630 (x 285..915) | What a platform shows if it square-crops. The "915" and the logo mark are cut off. Not a failure by itself (1.91:1 is the standard large-image shape); say if it bothers you |
| `card-es-600.png` | ES card at 600x315 | As EN |
| `card-es-300.png` | ES card at 300x158 | As EN; also confirm the Spanish tagline reads |
| `card-es-150.png` | ES card at 150x79 | As EN |
| `card-es-square-crop.png` | ES card, centre 630x630 | As EN |
| `favicon-16.png` | `public/favicon.svg` at 16x16 on white | Does the "915" still read as a tab icon (the blue tile with white "915") |
| `favicon-32.png` | `public/favicon.svg` at 32x32 on white | Same, at the size the .ico carries |
| `apple-touch-60.png` | `public/apple-touch-icon.png` (180x180) scaled to 60px | The bubble mark on paper, as a small home-screen icon |

## Copy as rendered

| | EN | ES |
|---|----|----|
| Tagline | El Paso news, in brief. | Noticias de El Paso, en breve. |
| Credit line | Summaries of reporting by KTSM, KVIA and other El Paso outlets — always credited, always linked. | Resúmenes de reportajes de KTSM, KVIA y otros medios de El Paso: siempre con crédito, siempre con enlace. |
| og:image:alt (= "915 TLDR — " + tagline, pinned by a test) | 915 TLDR — El Paso news, in brief. | 915 TLDR — Noticias de El Paso, en breve. |

Card geometry as built: logo left edge at 78px (leftmost ink x=86), wordmark x=84, tagline
x=85/86, credit x=86/87. These positions are not multiples of 4; they come from the approved
mockup. Credit line is 20px on both cards (EN 885px wide, ES 979px wide, rule is 1028px).

## Share block in the built head (harness output)

Taken verbatim from `tests/fixtures/head-harness/dist/`. The harness is built with
`SHARE_ORIGIN=https://dev.915tldr.com`, so `og:image` shows the dev origin here. On a production
build it is `https://915tldr.com/og-image.png`.

`en-article.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="Fixture story — 915 TLDR">
<meta property="og:description" content="An English article fixture.">
<meta property="og:url" content="https://915tldr.com/crime/fixture-story-00000000-0000-0000-0000-000000000002">
<meta property="og:site_name" content="915 TLDR">
<meta property="og:type" content="article">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="es_US">
<meta property="og:image" content="https://dev.915tldr.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="915 TLDR — El Paso news, in brief.">
<meta property="article:published_time" content="2026-09-20T08:15:00-06:00">
<meta property="article:modified_time" content="2026-09-20T08:15:00-06:00">
<meta property="article:section" content="Crime">
<meta property="article:tag" content="El Paso Police">
<meta property="article:tag" content="Arrest">
<meta property="article:author" content="https://915tldr.com/about">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image:alt" content="915 TLDR — El Paso news, in brief.">
```

`en-self.html` (an English page with no Spanish counterpart):

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="Self fixture — 915 TLDR">
<meta property="og:description" content="An English-only page.">
<meta property="og:url" content="https://915tldr.com/crime/self-fixture-00000000-0000-0000-0000-000000000001">
<meta property="og:site_name" content="915 TLDR">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="es_US">
<meta property="og:image" content="https://dev.915tldr.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="915 TLDR — El Paso news, in brief.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image:alt" content="915 TLDR — El Paso news, in brief.">
```

## The five open items (defaults marked)

Reply "defaults", or one choice per item, e.g. `1a 2a 3a 4a 5a`.

1. Rendered card pair.
   - 1a (default): approve both cards as rendered, including the Spanish copy and the
     non-multiple-of-4 positions from the approved mockup.
   - 1b: change copy or layout. Write the exact wording or position change out. A tagline change
     also changes the og:image:alt text (D-10 parity).
2. Credit-line size.
   - 2a (default): 20px on both cards (both fit on one line; the ES credit needs it).
   - 2b: EN at 24px, ES at 20px. EN at 24px overruns the rule by 33px and the two footers differ.
3. twitter:image:alt.
   - 3a (default): keep it. Removes doubt about whether X reads og:image:alt.
   - 3b: drop it. Strictly D-14's list; relies on an unverified fallback on X.
4. Local full build before merge.
   - 4a (default): none. Rely on the harness, the pure tests and 07-08's live check of the
     deployed site. No production KV writes from this machine.
   - 4b: run `pnpm test:unit` then `pnpm test:regression` locally before merge (07-07 runs them).
     Three builds, each bulk-writing production render-manifest KV (06-15 deviation 2).
5. favicon.svg identity (D-23 calls it "the bubble mark"; v1's favicon.svg is a blue rounded
   "915" tile).
   - 5a (default): keep v1's blue "915" tile; rasterise the .ico from it.
   - 5b: "bubble": make favicon.svg the bubble mark too. 07-07 checks whether
     `915tldr.com2/public/915tldr.com_logo-.svg` is that mark and stops to ask if it is not.

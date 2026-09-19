# 2026-09-17 - Extend structure.spec.ts: Landmarks, DSGN-05, Reduced Motion, Fonts, Head-Script Drift, Page Evidence

**Keywords:** [FEATURE] [TESTING] [ACCESSIBILITY] [BUG_FIX] [STYLING]
**Session:** Early morning, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0533_structure-spec-landmarks-tokens-fonts-drift-guard.md`

## What Changed

- File: `design/tests/structure.spec.ts` (extended)
  - `@c1`: landmarks — exactly one page-level `header` (`body > header`), `nav[aria-label="Sections"]`,
    `main#main` and `footer`; exactly one `h1`; `html[lang="en"]`; every `[data-variant^="es"]`
    element carries `lang="es"`
  - `@c1`: DSGN-05 — `--paper`, `--ink`, `--ink-muted`, `--rule-strong`, `--block-ink` and all
    eight `--cat-<slug>` aliases (via the shared `CANONICAL_SLUGS` list) resolved and converted
    to sRGB hex per theme, asserting light and dark differ for every one
  - `@c1`: reduced motion — a `reducedMotion: 'reduce'` context, every element's computed
    `transition-duration`/`animation-duration` must be `0s`
  - `@c1`: every element with a direct, non-whitespace text node has a computed `line-height`
    that is not `normal`
  - `@c1`: head-script drift guard — fetches the raw HTML of all five pages via the `request`
    fixture, asserts each has exactly one `<script>...</script>` block and all five are
    byte-identical
  - `@c1` `@c5`: full-page JPEG evidence (quality 70) at 320/768/1280px, both themes, all five
    pages, captured once from Chromium (guarded with a plain `if (testInfo.project.name ===
    'chromium')` inside the test body — never a runner-level skip, which the plan forbids)
  - `@c5`: `document.fonts` (after `document.fonts.ready`) contains only "Instrument Serif",
    "Source Serif 4", or a name starting with one of their `... Fallback` variants
  - `@c5`: no font (`.woff2`/`.woff`/`.ttf`/`.otf`) or stylesheet (`.css`) request, and no
    request to `fonts.googleapis.com`/`fonts.gstatic.com`, appears in `blockThirdParty`'s
    blocked-URL list
  - `@c5`: `style.css`, fetched raw, contains no `@import`
  - Extended the existing font-family test to also check `[data-dispatch] h2` (changelog
    headlines), alongside the already-covered `h1`/`[data-card] h3`/`[data-lead] h2`
  - De-duplicated the `firstFamily` helper and the `pagePath(name)` helper to module scope
    (both existed as copy-pasted inline closures in two/three separate tests)
- File: `design/mockups/category.html`
  - Moved the D-01 masthead block (`<header data-block data-category="business">`) from a
    body-level sibling of `<main>` to the first child *inside* `<main>`
- File: `design/mockups/style.css`
  - Added `body[data-page="category"] main > header[data-block] { margin: 0 calc(var(--space-4)
    * -1); }` to cancel out `main`'s own horizontal padding, so the masthead's full-bleed look
    (edge-to-edge background block) is pixel-identical to before the landmark fix

## Why

Writing the new landmarks test caught a real accessibility bug it wasn't specifically looking
for: `body > header` matched **two** elements on category.html, not one. HTML-ARIA maps a
`<header>` to the `banner` role unless it is a descendant of `article`/`aside`/`main`/`nav`/
`section` — category.html's D-01 masthead block sat directly under `<body>`, before `<main>`,
so it computed to a second `banner` landmark on the same page, alongside the site's own chrome
header. A screen-reader user navigating by landmark would see two identically-named regions
with no way to tell them apart. article.html's own block header was already correctly nested
inside `main > article` (not a banner) — category.html's was the outlier, not the pattern.

Per the plan's own rule ("a failing check is fixed in the mockups or CSS — never by weakening
the assertion"), the fix moves the masthead inside `<main>` rather than loosening the landmark
selector to tolerate two headers. Document order was already correct (the masthead sat exactly
where it now sits, just one level up in the tree), so this move does not change tab order, focus
sequence, or any accessible name — confirmed by re-running the full keyboard-walk suite (Task 1
of this same plan) in both engines afterward. It does change nesting relative to `<main>`'s own
horizontal padding, which would have visually inset the masthead and broken its intentional
full-bleed look (D-01: "bold in the chrome") — restored with a scoped negative margin, verified
by measuring the block's rendered `left`/`right` against the viewport at 320/768/1280px.

## Issues Encountered

- **Real bug: duplicate `banner` landmark on category.html**, described above. Fixed in the
  mockup, not the test.
- **Full-bleed regression introduced by the landmark fix itself**, caught before commit by
  re-measuring the masthead's rendered box at all three test widths (all three came back
  `left: 0, right: <viewport width>` after the CSS fix, matching the pre-fix bleed exactly).
- Re-ran the full Task 1 keyboard-walk suite (both engines, all 5 pages) after the category.html
  DOM change, since it landed after that task's own commit — confirmed no regression in tab
  order, coverage, or evidence content; only the category page's own evidence PNGs changed
  (the visual content the landmark fix touches), and neither `tab-order-*.json` file changed
  (accessible names and focus sequence were unaffected — confirms the move was structurally
  transparent to the walk itself).

## Dependencies

No dependencies added. Reuses `culori`'s `formatHex`, this project's own
`design/scripts/lib/css-tokens.mjs` (`CANONICAL_SLUGS`, `resolveTheme`, `toSrgb`), and
`@playwright/test`'s `request`/`browser.newContext({ reducedMotion })` fixtures, all already in
use elsewhere in the suite.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=chromium|webkit
  design/tests/structure.spec.ts` — 96/96 passing in both engines (in a single full run each,
  after the category.html fix). The plan's own evidence-completeness check (30 JPEGs in
  `design/evidence/pages/`) passed. Re-ran the full `keyboard-walk.spec.ts` suite in both
  engines afterward (31/31 both) to confirm the category.html DOM move didn't regress Task 1.
  `npm run check:contrast` (PASS, same two pre-existing C-01 warnings) and `npm run test:unit`
  (17/17) both still green.
- What wasn't tested: real Safari (not available on this machine); the owner's own visual
  judgement of the masthead's full-bleed treatment, deferred to 01-10 per `human_verify_mode:
  end-of-phase` (unchanged in substance — this fix restores, not alters, the prior visual
  result).

## Next Steps

- [ ] Continue with Task 3 (content.spec.ts) of this plan
- [ ] Carry the DOM-nesting pattern forward: any future block-style `<header>` should be
      written inside its sectioning-content ancestor (`main`/`article`/`section`) from the
      start, not added as a body-level sibling, to avoid re-introducing a duplicate `banner`

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - fixes a real duplicate-landmark accessibility defect on the category page
that would have shipped to Phase 3 unnoticed by any of criteria 1/2/3's existing checks; adds
the DSGN-05, reduced-motion, font-hygiene and head-script-drift coverage this plan requires.

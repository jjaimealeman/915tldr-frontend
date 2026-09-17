# 2026-09-17 - Headlines Move to Source Serif 4 Bold, Instrument Serif Kept Only for the Wordmark

**Keywords:** [FEATURE] [STYLING] [BUG_FIX] [TESTING] [DOCUMENTATION]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1250_01-14-source-serif-4-bold-headlines-instrument-ser.md`

## What Changed

- `design/mockups/style.css`: added `--font-headline` (aliases `--font-body`),
  `--weight-headline: 700` and `--leading-headline: 1.15` tokens. Every
  headline role (page `h1`s, category masthead `h1`, lead `h2`, card `h3`,
  dispatch `h2`, grid heading) now renders in Source Serif 4 Bold through
  those tokens instead of Instrument Serif. The wordmark rules
  (`header:not([data-block]) h1`, `[data-wordmark]`) keep Instrument Serif
  but now pin `font-weight: 400; font-synthesis: none` so a browser can never
  fake a bold weight the font doesn't ship. The standfirst deck moves to
  Source Serif 4 italic 400.
- `design/tests/structure.spec.ts`: replaced the old "headlines are set in
  Instrument Serif" test with "type roles: Source Serif 4 body, Source
  Serif 4 Bold headlines, Instrument Serif wordmark only @c5" — it checks
  computed weight 700 on every headline element, walks the whole page to
  prove no element outside the wordmark contract renders Instrument Serif
  (right container, right weight/style, font-synthesis disabled), and checks
  the standfirst deck's italic Source Serif 4 400. Passes on all five pages
  in Chromium and WebKit.
- `docs/PRD.md`: SS5.2's typography table amended (wordmark vs. headline vs.
  body face, dated D-GAP-B note); SS6.8 flags the share-card headline face as
  under review pending the same decision.
- `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md`: added
  an "Amendments after owner review" section recording how D-08, D-09, C-01
  and D-GAP-D were resolved, and mapping the ten round-1 revision requests to
  their closing plans.
- `design/evidence/pages/*.jpg`: regenerated screenshots reflecting the new
  headline typeface.

### Bug fixed along the way (Rule 1)

`design/scripts/lib/css-tokens.mjs`'s `isColorValue()` misclassified a bare
numeric CSS value like `700` as a hex colour — culori's hex parser accepts
hex digits with no leading `#`, so `parse('700')` silently returns a real RGB
colour instead of `undefined`. That broke `check:contrast`'s coverage gate
(and `structure.spec.ts`'s token reader) the moment `--weight-headline: 700`
was added. Fixed by requiring the `#` prefix a real CSS hex colour always
carries before ever handing the value to culori — a correctness fix, not a
loosened check. Also added `parseFontsRootVars()` so `--font-headline`'s
alias of `--font-body` (a value owned by the fonts region, not the tokens
region) resolves instead of throwing "missing reference".

## Why

The owner's screenshot showed a headline computed as "Instrument Serif —
700". Instrument Serif ships a single weight, so that bold was
browser-synthesised, not real — and the owner said plainly they weren't
keen on the thin headline face. D-GAP-B moves headlines to Source Serif 4's
own bold weight (a real 700 on the variable axis) and keeps Instrument Serif
for exactly one job: the "915 TLDR" wordmark, at its real weight.

## Issues Encountered

The new `--weight-headline: 700` token tripped a pre-existing, previously
dormant bug in the shared CSS-token library (see above) — caught immediately
by `check:contrast` failing where it should have passed, not by a silent
wrong result.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run check:contrast` (exit 0); `structure.spec.ts`'s
  full suite (96 tests) in both Chromium and WebKit (Docker); the unit suite
  for `check-contrast.mjs` (17 tests, still green after the `isColorValue`
  fix).
- What wasn't tested: font subsetting/CLS re-verification — that is Task 3
  of this plan, not this task.

## Next Steps

- [ ] Task 2: fvar axis reader (test-first)
- [ ] Task 3: shrink Source Serif 4, retire Instrument Serif Italic, record
      lever evidence

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - changes the rendered headline typeface across all five mockup pages

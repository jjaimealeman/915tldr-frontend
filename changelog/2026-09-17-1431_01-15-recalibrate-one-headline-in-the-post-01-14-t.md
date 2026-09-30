# 2026-09-17 - One Headline Recalibrated in the New Type System, Proven in Both Engines

**Keywords:** [FEATURE] [TESTING] [BUG_FIX]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1431_01-15-recalibrate-one-headline-in-the-post-01-14-t.md`

## What Changed

- `design/scripts/calibrate-spanish.mjs`: `measureWidth()` now sets the real
  headline weight (`var(--weight-headline)`, 700) for `fontRole: "headline"`
  components instead of a fixed 400 — a headline measured at the wrong
  weight isn't measuring what actually ships. The old hardcoded
  family-x-style "is it loaded" loop is replaced with `assertWebfontsInUse`
  (the same guard `spanish-overflow.spec.ts`'s `widthRatio()` uses), scoped
  to exactly the faces the components being calibrated need — Instrument
  Serif normal 400 only if a display-role component is present, Source
  Serif 4 normal 400 / normal 700 / italic 400 as the roles/styles require.
  Added `--only=<id>[,<id>]` to recalibrate a subset while writing every
  other component's JSON back unchanged (key order included); an unknown id
  exits 1 before the browser ever launches.
- `design/fixtures/spanish-stress.json`: `fontRole` set to `"headline"` for
  the seven components that now render Source Serif 4 Bold (`card-headline`,
  `lead-headline`, `category-masthead-title`, `category-lead-headline`,
  `article-headline`, `changelog-title`, `worst-case`) and `"body"` for
  `article-standfirst` (keeps `fontStyle: "italic"`) — these role changes
  are applied on every run, independent of `--only`, so the field is never
  left stale. `card-headline` was recalibrated against the real Source
  Serif 4 Bold: `widthRatio` 1.2543 → 1.2545 (essentially unchanged in this
  case, but now measured at the correct weight rather than the old
  Instrument-Serif-era default).
- `design/tests/spanish-overflow.spec.ts`: `componentsForPage()` now honours
  an optional `SPANISH_COMPONENTS` env var (comma-separated id list), same
  spirit as `MOCKUP_PAGES`, so a single component can be exercised in
  isolation.

### Bug found and fixed along the way (Rule 1)

Running the new focused test (`MOCKUP_PAGES=index SPANISH_COMPONENTS=card-headline`)
surfaced a real, deterministic failure at 1280px: injecting `card-headline`'s
`es_real` text — identical, character for character, to what was already in
the markup — made its card shrink from 1244px to 1206px tall. Bisected with a
minimal repro (`setAttribute('lang', 'es')` alone, no text change at all,
reproduces the exact same shrink): headline elements carry
`hyphens: auto` (01-08's long-word overflow defense), which only actually
engages a hyphenation dictionary once an element's `lang` is known, and
`injectText()` always sets `lang="es"` as part of every injection. A
hyphenation-eligible headline can legitimately re-wrap onto *fewer* lines for
the same (or longer) text once hyphenation activates — shrinking its
container with nothing lost or clipped. This is a real, desired effect of
the CSS (confirmed with a fonts-free, text-identical control), not a
regression. Reproduced on the full (un-narrowed) component set too, so it
was already latent after 01-14's font change, not introduced by this task's
edits — the new `SPANISH_COMPONENTS` filter just made it easy to isolate.

Fixed by adding `hyphensAuto` to `design/tests/support/i18n.ts`'s
`OverflowReport` (computed `hyphens: auto` on the resolved element) and
skipping the container-growth heuristic in
`spanish-overflow.spec.ts` when it's true. `vClipped` — the code's own
documented "authoritative did-it-actually-clip signal" — is unaffected and
still asserted for every variant; only the secondary, no-longer-sound
growth heuristic is scoped to elements where it's actually meaningful.

## Why

01-14 moved headlines to Source Serif 4 Bold and pinned `opsz`, which the
plan's own objective flagged as invalidating the existing width calibration
(a string sized for Instrument Serif may no longer clear +25% in a
different, bolder face). This task proves the calibration method holds for
one headline component, in the real shipped fonts, in both engines, before
Task 2 recalibrates everything else.

## Issues Encountered

The hyphenation/container-height interaction above — found by the plan's own
new focused-test capability doing exactly what it was built to do.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node design/scripts/calibrate-spanish.mjs --only=does-not-exist`
  (exits 1); `node design/scripts/calibrate-spanish.mjs --only=card-headline`
  (writes only role fields + card-headline's calibration, confirmed via
  `git diff`); the focused injected-Spanish test
  (`MOCKUP_PAGES=index SPANISH_COMPONENTS=card-headline ... --grep "injected"`)
  in Chromium and WebKit (Docker) — 3/3 passing in each engine, re-verified
  fresh from a clean fixture checkout before commit.
- What wasn't tested: the other 21 fixture components' recalibration — that
  is Task 2, not this task.

## Next Steps

- [ ] Task 2: recalibrate every remaining component, sync the drawn
      `index.html` cards, and prove criterion 4 end to end

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - proves the recalibration method and fixes a latent
container-height false-positive in the Spanish overflow test harness;
does not yet touch the drawn mockup markup.

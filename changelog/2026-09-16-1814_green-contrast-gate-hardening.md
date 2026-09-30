# 2026-09-16 - GREEN: Implement the Hardened D-13 Contrast Gate

**Keywords:** [FEATURE] [STYLING] [ACCESSIBILITY] [TESTING] [DESIGN]
**Session:** Evening, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1814_green-contrast-gate-hardening.md`

## What Changed

- File: `design/scripts/lib/css-tokens.mjs`
  - Exported `CANONICAL_SLUGS` (the eight categories in required seed order) and a new
    `TokenError` class carrying `token`/`reason` fields
  - `resolveTheme` now throws `TokenError` (not a bare `Error`) for a missing reference or a
    resolution cycle, naming the offending property
  - `toSrgb` now throws `TokenError` with reason `"outside sRGB gamut"` or `"unparseable"`
  - Added `isColorValue(value)` — true when culori can parse `value` as a colour; used by both
    the gamut pass and the coverage rule to decide what counts as a "colour-valued declaration"
- File: `design/scripts/check-contrast.mjs` (full rewrite of the rule engine)
  - **Manifest:** a `REQUIRED_MANIFEST` list (all neutrals, `--block-ink`,
    `--focus-ring-on-block`, the six `--stop-*` numbers, and per canonical slug
    `--hue-<slug>` / three stop literals / the theme alias) checked present in both themes
    before anything else runs
  - **Gamut:** every colour-valued resolved token, both themes, run through `toSrgb`; failures
    name the token and theme
  - **Structure:** category discovery compared to `CANONICAL_SLUGS` for exact set-and-order;
    each stop literal's parsed OKLCH `l`/`c`/`h` checked against the shared `--stop-*` numbers
    and `--hue-<slug>` (D-02)
  - **Distinctness:** `differenceEuclidean('oklab')` over all 28 pairs per stop, worst pair
    reported, `>= 0.05` required (DSGN-04)
  - **Coverage:** an undirected union-find over "pure `var()` alias" edges (gathered from both
    theme regions) — any colour-valued declaration whose alias-component doesn't intersect the
    set of tokens actually used in a comparison pair fails as "not covered", unless it's in the
    two-entry `EXEMPT` map (`--rule`, `--link-underline`). This one structure naturally handles
    both directions the plan's rule describes: an alias of a checked token (`--cat-crime` ->
    `--cat-crime-vivid-light`) and a checked token that resolves through another
    (`--cat-none` -> `--rule-strong`)
  - **C-01 guards:** the six load-bearing neutrals fail if their OKLCH hue falls in 35-110deg
    with chroma over 0.006; block stops with hue in 40-100deg print a **warning**, not a
    failure, naming the category
  - **Literals:** everything in `style.css` outside the `fonts:*`/`tokens:*` regions is
    comment-stripped and scanned for colour-literal patterns in declaration *values* only
    (selectors are never matched, since they have no trailing `;` to complete the pattern)
  - `--json` now prints `{ ok, failures, warnings, rows }` to stdout instead of the markdown
    (the markdown file is still written to `--out` either way)
  - Every failure also prints to stderr as `FAIL <rule>: <token or pair> — <detail>`
- File: `design/tests/unit/check-contrast.test.mjs`
  - Fixed the RED-phase `withBusinessHue` test helper: it was swapping only the hue while
    keeping the original chroma, which pushed the vivid-light stop out of the sRGB gamut at
    hue 85deg (the gamut boundary moves with hue — same floor-truncation lesson 01-03 already
    documented for `build-palette.mjs`). Now re-clamps and floor-truncates chroma per stop at
    the new hue before writing the fixture.
- File: `design/evidence/contrast.md` (regenerated)
  - Now has the 7 required sections: Neutrals, Ramps, Focus, Distinctness, D-02 structure,
    C-01 guards, Warnings — all PASS on the real palette, with the same two C-01 review
    warnings (Sports 49.4°, Business 94.5°) already flagged in `palette.md` from 01-03

## Why

Task 1 (RED) described the complete gate contract as failing tests; this task makes every one
of them pass by implementing the actual rule, not by relaxing the test. The coverage rule in
particular needed a structural approach (alias-connectivity via union-find) rather than a list
of special cases, since the plan's two named examples (`--cat-crime` aliasing a checked token,
`--cat-none` resolving through `--rule-strong`) are the same relationship in opposite
directions — one graph handles both without hand-enumerating every alias chain in the palette.

## Issues Encountered

- **RED test helper produced an out-of-gamut fixture it didn't intend to test.** Found when
  the "C-01 review warning" test failed with three `FAIL gamut` lines instead of the expected
  exit 0. Root cause: `withBusinessHue(css, 85)` changed the hue for all three business stops
  but kept the original chroma (0.123, itself already near business's own gamut ceiling at its
  real hue of 94.5°); at hue 85° the true sRGB boundary is ~0.1229, so 0.123 was ~0.0001 over.
  Fixed by having the test helper call culori's `clampChroma` and floor-truncate per stop at
  the new hue, mirroring `build-palette.mjs`'s already-documented pattern, rather than assuming
  a chroma safe at one hue stays safe at another.
- **Markdown table collision in the RED-phase assertion.** The Distinctness table's stop-name
  column (`vivid-light` / `block` / `vivid-dark`) collided with the Ramps table's row-prefix
  match used by `valid.css exits 0 with three ramp rows`, since both tables led with the same
  three literal strings. Fixed by reordering the Distinctness table to lead with the category
  pair instead of the stop name — a display change only, no rule-logic change.
- **Pre-existing `--css`/`--out` CLI parsing bug** (fixed in the RED commit, not this one) is
  what let the previous fixture-based failures be diagnosed accurately once corrected.

## Dependencies

No dependencies added. Uses `culori`'s `differenceEuclidean`, `clampChroma`, `converter`,
`displayable`, `parse`, `wcagContrast` — all already installed.

## Testing Notes

- What was tested: `npm run test:unit` (17/17 pass), `npm run check:contrast` on the real
  `design/mockups/style.css` (exit 0, all 7 sections PASS), and the plan's `--json` structural
  check (`ok: true`, exactly 3 `rows` with `group: 'ramp'`, 2 warnings reported) — all three
  commands from the plan's `<verify>` block for this task.
- What wasn't tested: visual/owner review of the two C-01 review warnings (Sports, Business
  amber/olive block hues) — that judgement is explicitly deferred to the phase's approval step
  per 01-03-SUMMARY.md, unchanged by this plan.
- Edge cases: `node design/scripts/check-contrast.mjs --css design/tests/unit/fixtures/warm-bone.css --out /dev/null` exits 1 as required by the plan's acceptance criteria.

## Next Steps

- [ ] Carry the two existing C-01 review flags (Sports/Business amber-olive block hues) and
      the two subject-fidelity notes from 01-03 into the phase's combined `01-APPROVAL.md`
      owner sign-off — unchanged by this plan, just re-confirmed still present
- [ ] This script is ready to become the Phase 3 CI guard as-is (01-CONTEXT.md) — no further
      hardening anticipated before then

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - the contrast gate every later phase-1 mockup change must pass through is
substantially rewritten; the real stylesheet still passes with no changes required to
`style.css` or `palette.json`

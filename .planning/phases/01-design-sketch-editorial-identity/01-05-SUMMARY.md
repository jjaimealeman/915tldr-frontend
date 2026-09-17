---
phase: 01-design-sketch-editorial-identity
plan: 05
subsystem: testing
tags: [contrast, wcag, oklch, culori, node-test, tdd, accessibility, ci-guard]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-02: tracer D-13 contrast gate (check-contrast.mjs, css-tokens.mjs); 01-03: photo-sampled palette (palette.json, style.css palette regions)"
provides:
  - "Hardened D-13 gate: required manifest, coverage (alias-connectivity union-find), gamut, DSGN-04 distinctness, D-02 structure, C-01 fail + review guards, colour-literal-outside-tokens scan, --json output"
  - "17-test node:test suite (design/tests/unit/check-contrast.test.mjs) + 13 CSS fixtures covering every failure mode"
  - "css-tokens.mjs: CANONICAL_SLUGS export, TokenError typed error, isColorValue helper"
affects: [03-foundation-read-budget-guardrails, 01-10-approval-packet]

actuals:
  tokens: 25400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Coverage (D-13 anti-bypass rule) is computed as connected components over an undirected graph of 'pure var() alias' edges, not a hand-enumerated list of special cases — a token is covered if its alias-component intersects the set of tokens actually used in a comparison pair. This handles both directions the plan's rule describes (an alias of a checked token, and a checked token that itself resolves through another) with one structure."
    - "Swapping a hue in a test/build fixture must re-clamp and floor-truncate chroma for the new hue, never reuse a chroma that was only proven safe at the old hue — the sRGB gamut boundary moves with hue. Same lesson 01-03 documented for build-palette.mjs, recurring here in a test helper instead of production code."
    - "check-contrast.mjs's --css/--out CLI flags must be parsed in the documented space-separated form (--css path), not just --flag=value — every fixture-based test silently falls back to the default path otherwise, which looks like a passing gate rather than a broken harness."

key-files:
  created:
    - design/tests/unit/check-contrast.test.mjs
    - design/tests/unit/fixtures/valid.css
    - design/tests/unit/fixtures/missing-token.css
    - design/tests/unit/fixtures/unresolved-var.css
    - design/tests/unit/fixtures/out-of-gamut.css
    - design/tests/unit/fixtures/uncovered-colour.css
    - design/tests/unit/fixtures/collide.css
    - design/tests/unit/fixtures/nine-categories.css
    - design/tests/unit/fixtures/wrong-order.css
    - design/tests/unit/fixtures/stop-mismatch.css
    - design/tests/unit/fixtures/warm-bone.css
    - design/tests/unit/fixtures/low-contrast.css
    - design/tests/unit/fixtures/dark-inherit.css
    - design/tests/unit/fixtures/literal-outside.css
  modified:
    - package.json
    - design/scripts/check-contrast.mjs
    - design/scripts/lib/css-tokens.mjs
    - design/evidence/contrast.md

key-decisions:
  - "Coverage rule implemented as union-find over pure var() alias edges rather than a hand-written list, so --cat-<slug> (alias of a checked vivid-light/vivid-dark token) and --rule-strong (backing --cat-none, which is directly checked) are both covered by the same mechanism without special-casing either."
  - "Gamut, manifest, and per-token checks are pre-computed into lookup caches (srgbCache, theme.has() guards) before any ratio comparison runs, so a missing or out-of-gamut token produces one clean named failure instead of an unhandled crash partway through a comparison loop."
  - "Fixed a pre-existing (01-02 tracer) CLI arg-parsing bug in check-contrast.mjs's parseArgs: it only recognised --css=path, not the documented space-separated --css path form the plan's own CLI interface and this plan's test harness both use. Left uncaught, every fixture test would have silently read the real style.css instead of its fixture, making RED meaningless. Fixed inline as part of Task 1 before confirming RED (Rule 1/3 auto-fix)."
  - "Fixed a RED-phase test helper bug (found before it was ever committed as green): withBusinessHue swapped only the hue while keeping the original chroma, which is unsafe near a gamut boundary that moves with hue. Re-clamped and floor-truncated per stop instead."

patterns-established:
  - "check-contrast.mjs's rule engine pre-resolves both themes eagerly, fails cleanly (named token, no crash) on a missing manifest entry or unparseable/out-of-gamut colour before any comparison runs, and only then computes ratios/distinctness/structure against pre-validated data. Later extensions to this gate should keep that ordering — manifest and gamut first, comparisons second — rather than letting a comparison loop discover a missing token via a crash."

requirements-completed: [A11Y-01, DSGN-02, DSGN-04, DSGN-05]

coverage:
  - id: D1
    description: "A required colour token missing, or an unresolved var() reference, makes check-contrast exit non-zero naming the token — never silently skipped"
    requirement: "A11Y-01"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#missing-token.css exits 1 and names --cat-weather-block; #unresolved-var.css exits 1 and names --nope"
        status: pass
    human_judgment: false
  - id: D2
    description: "Contrast is computed on the sRGB colour each token actually renders as; out-of-gamut OKLCH values are rejected by name"
    requirement: "A11Y-01"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#out-of-gamut.css exits 1, names the token and says gamut; #lib: toSrgb for an oklch() token matches culori wcagContrast to within 1e-9"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pair of category colours at the same stop is >=0.05 apart in OKLab distance; a collision fails naming both slugs"
    requirement: "DSGN-04"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#collide.css exits 1 and names both colliding slugs and the distance"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly the eight canonical categories exist, in seed order, each with all three stops and a theme alias"
    requirement: "DSGN-04"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#nine-categories.css exits 1; #wrong-order.css exits 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "A colour-valued token not covered by any checked pair fails the gate unless it is on the two-entry, reasoned EXEMPT list"
    requirement: "A11Y-01"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#uncovered-colour.css exits 1, names --accent and says not covered"
        status: pass
    human_judgment: false
  - id: D6
    description: "Outside the fonts and tokens regions, style.css contains no colour literal — every rendered colour passes through the gate"
    requirement: "A11Y-01"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#literal-outside.css exits 1 and says colour literal outside tokens"
        status: pass
    human_judgment: false
  - id: D7
    description: "Each category stop has exactly its stop's lightness, never exceeds its stop's chroma, and uses its own --hue-<slug> (D-02)"
    requirement: "DSGN-04"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#stop-mismatch.css exits 1 and names the mismatched token"
        status: pass
    human_judgment: false
  - id: D8
    description: "A warm neutral (hue 35-110deg, chroma >0.006) fails the gate (C-01); a block stop in the 40-100deg band warns without failing"
    requirement: "DSGN-05"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#warm-bone.css exits 1 and says C-01; #a business hue of 85 prints a C-01 review warning and still exits 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "A dark-theme token not overridden inherits the light value and is still checked against the dark paper"
    requirement: "A11Y-01"
    verification:
      - kind: unit
        ref: "design/tests/unit/check-contrast.test.mjs#dark-inherit.css exits 1 because the inherited value fails against the dark paper"
        status: pass
    human_judgment: false
  - id: D10
    description: "npm run test:unit and npm run check:contrast both pass on the real design/mockups/style.css, with the gate's --json output structurally correct (3 ramp rows, ok:true)"
    requirement: "A11Y-01"
    verification:
      - kind: integration
        ref: "npm run test:unit (17/17 pass); npm run check:contrast (exit 0); node design/scripts/check-contrast.mjs --json structural check (ok:true, 3 ramp rows)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-16
status: complete
---

# Phase 1 Plan 5: Harden the D-13 Contrast Gate (TDD) Summary

**The D-13 contrast gate now fails loudly on every silent-failure mode the plan named — missing token, unresolved var, out-of-gamut colour, uncovered colour, hue collision, wrong category count/order, broken D-02 structure, a warm neutral, a colour literal outside the tokens region — verified by a 17-test node:test suite against 13 fixtures, with the real stylesheet still passing unchanged.**

## Performance

- **Duration:** ~40 min this continuation session (a prior session was cut off by an API rate
  limit mid-Task-1, before any commit; this session reviewed the uncommitted RED-phase work,
  fixed two bugs found in it, confirmed RED, then completed Task 2)
- **Started:** 2026-09-16T17:50:00Z (approx., continuation start)
- **Completed:** 2026-09-16T18:14:00Z (Task 2 commit `3a795cf`)
- **Tasks:** 2/2
- **Files modified:** 18 (14 created, 4 modified across both task commits)

## Accomplishments

- Reviewed and corrected uncommitted RED-phase work left by the interrupted prior session
  (test suite + 13 fixtures) against the plan's Task 1 spec before trusting or committing any
  of it — found and fixed two real bugs in the process (see Deviations)
- Confirmed RED for the right reasons: 15 of 17 tests failed on missing gate logic (manifest,
  coverage, distinctness, structure, C-01, literal scan, `--json`), not on a broken test
  harness; the 2 that already passed did so because the pre-existing tracer genuinely already
  handled those cases
- Implemented the full hardened gate: required manifest, gamut pass, DSGN-04 distinctness
  (union-find alias-connectivity coverage), D-02 structure check, C-01 fail + review-warning
  guards, colour-literal-outside-tokens scan, `--json` output, `FAIL <rule>: <token> — <detail>`
  stderr lines
- `npm run test:unit` (17/17), `npm run check:contrast` on the real stylesheet, and the plan's
  `--json` structural check all pass with zero changes required to `style.css` or
  `palette.json` — the real photo-sampled palette from 01-03 was already structurally sound

## Task Commits

1. **Task 1 (RED): Write the failing suite and fixtures for every gate rule** - `20d67ab` (test)
2. **Task 2 (GREEN): Implement the hardened gate and pass it on the real stylesheet** - `3a795cf` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

_Note: this plan's execution was itself interrupted once — a prior agent was cut off by an API
rate limit partway through Task 1, before any commit. Its uncommitted work (the test file and
all 13 fixtures) was reviewed against the plan spec rather than trusted blindly; two real bugs
were found in it before RED was confirmed (see Deviations)._

## Files Created/Modified

- `design/tests/unit/check-contrast.test.mjs` - 17-test `node:test` suite, one per behavior
  bullet in the plan's context block; `run()`/`runCss()` spawn the real CLI against a fixture
  or an in-memory variant
- `design/tests/unit/fixtures/*.css` (13 files) - `valid.css` copies the real tokens region
  verbatim; each other fixture is `valid.css` with exactly the one change its behavior bullet
  names
- `package.json` - Added `"test:unit": "node --test \"design/tests/unit/**/*.test.mjs\""`
- `design/scripts/lib/css-tokens.mjs` - Exported `CANONICAL_SLUGS`, added `TokenError` class
  and `isColorValue` helper; `resolveTheme`/`toSrgb` now raise typed errors naming the token
- `design/scripts/check-contrast.mjs` - Full rule-engine rewrite: manifest, gamut, structure,
  distinctness, coverage (union-find), C-01 fail/review, literal scan, `--json`, stderr `FAIL`
  lines; also fixed the pre-existing `--css`/`--out` CLI parsing bug (see Deviations)
- `design/evidence/contrast.md` - Regenerated with the 7 required sections (Neutrals, Ramps,
  Focus, Distinctness, D-02 structure, C-01 guards, Warnings), all PASS

## Decisions Made

- Coverage is computed as connected components over an undirected "pure var() alias" graph
  rather than a hand-written list of special cases, so the plan's two named coverage examples
  (`--cat-<slug>` aliasing a checked stop token; `--cat-none` resolving through `--rule-strong`)
  are the same relationship in opposite directions, handled by one structure.
- Manifest and gamut checks run first and populate lookup caches before any ratio comparison,
  so a missing or out-of-gamut token produces one clean named failure rather than an unhandled
  crash partway through a loop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug/Blocking] Pre-existing `check-contrast.mjs` CLI arg parsing only accepted `--flag=value`**
- **Found during:** Task 1 continuation, first `npm run test:unit` run against the uncommitted RED-phase test suite
- **Issue:** `parseArgs` (written in 01-02, unchanged since) only matched `--css=path`/`--out=path`. The plan's documented CLI interface and this plan's own test harness both use the space-separated form (`--css path`). Every fixture-based test was silently falling back to the real `design/mockups/style.css` and the default `--out` path — all 15 fixture tests failed identically (wrong evidence file, generic ENOENT/status mismatches) instead of failing for their intended, rule-specific reasons. RED carried no diagnostic value until this was fixed.
- **Fix:** `parseArgs` now accepts both `--flag value` and `--flag=value`.
- **Files modified:** design/scripts/check-contrast.mjs
- **Verification:** Re-ran the suite; fixture tests began failing/passing for their actual, rule-specific reasons (confirmed by manually inspecting stderr for missing-token.css, out-of-gamut.css, low-contrast.css, dark-inherit.css before touching any gate logic).
- **Committed in:** `20d67ab` (RED)

**2. [Rule 1 - Bug] RED-phase test helper produced an out-of-gamut fixture it didn't intend to test**
- **Found during:** Task 2, first `npm run test:unit` run after implementing the gamut pass
- **Issue:** The "C-01 review warning" test's `withBusinessHue` helper swapped hue to 85° but kept the original chroma (0.123, itself near business's own gamut ceiling at its real hue of 94.5°). The true sRGB gamut boundary at hue 85° is ~0.1229 — the gamut check correctly rejected 0.123 as ~0.0001 over, an unintended side effect of the fixture, not the C-01 behavior the test meant to exercise.
- **Fix:** The test helper now calls culori's `clampChroma` and floor-truncates (never rounds) per stop at the new hue before writing the fixture — the same lesson 01-03 already documented for `build-palette.mjs`, recurring here in test code.
- **Files modified:** design/tests/unit/check-contrast.test.mjs
- **Verification:** Test passes; fixture stays inside gamut at hue 85° for all three stops.
- **Committed in:** `3a795cf` (GREEN)

**3. [Rule 1 - Bug] Distinctness table's stop-name column collided with the Ramps table's row-prefix match**
- **Found during:** Task 2, first full test run
- **Issue:** Both the Ramps and Distinctness markdown tables led with the literal strings `vivid-light`/`block`/`vivid-dark`, so the `valid.css exits 0 with three ramp rows` test's line-prefix filter matched 6 rows instead of the intended 3.
- **Fix:** Reordered the Distinctness table to lead with the category pair instead of the stop name — display-only change, no rule logic affected.
- **Files modified:** design/scripts/check-contrast.mjs
- **Verification:** Test now finds exactly 3 matching lines.
- **Committed in:** `3a795cf` (GREEN)

---

**Total deviations:** 3 auto-fixed (2 bugs found in uncommitted work from the interrupted prior session, 1 bug found in this session's own implementation). No scope creep — all fixes stayed inside the D-13 gate and its test suite; no changes were made to `style.css` or `palette.json`.
**Impact on plan:** All three fixes were necessary for the RED/GREEN cycle to carry real diagnostic meaning rather than passing or failing for accidental reasons. The real palette from 01-03 needed no changes at all — every hardened rule already held.

## Issues Encountered

- The prior session's rate-limit interruption left substantial uncommitted work (a 176-line
  test file and 13 fixtures) with no review yet performed. Per this session's resume
  instructions, every fixture was diffed against `valid.css` and checked against the plan's
  literal behavior bullets before being trusted; all 13 fixtures were found correct as written.
  Only the test file itself (the `withBusinessHue` helper, fixed above as Deviation 2) needed
  a correction.

## Known Stubs

None. All acceptance criteria for both tasks pass against the real implementation; no data is
mocked, stubbed, or deferred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The hardened gate is ready to become the Phase 3 CI guard as-is (01-CONTEXT.md's stated
  purpose for this script) — no further hardening anticipated before then.
- The real palette (`style.css`, `palette.json`) required zero changes to pass every new rule;
  the two existing C-01 review warnings (Sports 49.4°, Business 94.5°) carry forward unchanged
  from 01-03 and remain flagged for the owner's combined approval-packet sign-off.
- No blockers for 01-06 (home/category mockups) or any later phase-1 plan — all consume the
  same token layer and gate this plan hardened in place.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 18 files listed in Files Created/Modified verified present on disk; both task commits
(`20d67ab`, `3a795cf`) verified present in git history.

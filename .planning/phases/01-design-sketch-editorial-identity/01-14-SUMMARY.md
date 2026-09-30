---
phase: 01-design-sketch-editorial-identity
plan: 14
subsystem: design-system
tags: [css, fonts, subsetting, playwright, capsize, fvar, variable-fonts, typography]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "font-display:optional confirmed working in both engines, two-preload D-GAP-A scope, full swap matrix passing (01-13)"
provides:
  - "D-GAP-B closed: headlines render Source Serif 4 Bold (real 700 on the variable axis, not browser-synthesised); Instrument Serif is the '915 TLDR' wordmark only, weight 400, font-synthesis:none"
  - "D-GAP-A part 2 closed: SourceSerif4-Roman.woff2 108,164 -> 44,156 bytes (40.8%); SourceSerif4-Italic.woff2 91,096 -> 20,216 bytes (22.2%), via opsz pinned to each source's own fvar default"
  - "design/scripts/lib/font-axes.mjs — readVariationAxes(buffer), a dependency-free, no-I/O sfnt fvar table reader"
  - "InstrumentSerif-Italic.woff2 retired from the git index (untracked, file remains on disk); no @font-face or fallback face for it remains"
  - "design/evidence/font-subset.md — the size-lever table and chosen configuration for both Source Serif 4 faces"
  - "A build-time crawl guard (build-fonts.mjs) that fails loudly if any Source Serif 4 italic element ever renders above weight 400, or any Instrument Serif element ever renders italic"
affects: [01-15, any later plan touching design/mockups/style.css headline rules, font subsetting, or the wordmark/headline type roles]

actuals:
  tokens: 12953
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pin a variable font's opsz axis to the source's own fvar default (read at build time, not guessed) when the display use no longer needs optical size to track rendered font size — the single lever, of everything measured, that materially shrinks a variable-font subset; hinting removal and range-restriction (vs. full pinning) both saved under 2%"
    - "A build-time crawl guard that asserts the runtime precondition (\"no page renders X above weight Y\ / in style Z\") a subsetting pin depends on, so the pin can never silently go stale as later plans touch the CSS"
    - "css-tokens.mjs's resolveTheme() eagerly resolves every var() in the tokens region; a token that aliases a value owned by a different marked CSS region (e.g. the fonts region) needs that region's :root vars merged in first (parseFontsRootVars()), or every consumer of readTokens()/resolveTheme() throws on a 'missing reference' that isn't actually missing from the full stylesheet"
    - "culori's parse() accepts a bare 3/4/6/8-digit hex string with no leading '#' (e.g. parse('700') returns a real colour) — isColorValue() gates in this codebase must reject that case explicitly, since a CSS custom property routinely holds a bare number (font-weight, line-height) that must never be treated as colour-valued"

key-files:
  created:
    - design/scripts/lib/font-axes.mjs
    - design/tests/unit/font-axes.test.mjs
    - design/evidence/font-subset.md
  modified:
    - design/mockups/style.css
    - design/tests/structure.spec.ts
    - design/scripts/lib/css-tokens.mjs
    - design/scripts/check-contrast.mjs
    - design/scripts/build-fonts.mjs
    - design/mockups/fonts/subset-manifest.json
    - design/mockups/fonts/SourceSerif4-Roman.woff2
    - design/mockups/fonts/SourceSerif4-Italic.woff2
    - docs/PRD.md
    - .planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "D-GAP-B implemented literally as approved: --font-headline aliases --font-body (Source Serif 4) at weight 700 for every headline role; the two wordmark rules keep --font-display (Instrument Serif) at its real weight 400 with font-synthesis:none so a browser can never fake a bold it doesn't ship."
  - "Source Serif 4 Italic's wght axis is pinned to 400 (not kept as a 400-700 range like Roman) because Task 3's own crawl guard proves no page ever renders Source Serif 4 italic above weight 400 — carrying the wider range would cost bytes for a value nothing uses."
  - "Fixed a real, previously dormant bug in the shared css-tokens.mjs library (Rule 1): isColorValue('700') was true because culori's hex parser accepts hex digits with no leading '#'. This broke check:contrast's coverage gate and structure.spec.ts's readTokens() the moment --weight-headline:700 was added. Tightened to require the '#' prefix — a correctness fix, not a loosened check."
  - "Instrument Serif Italic is retired via git rm --cached only, per the plan's explicit prohibition against deleting the file from disk; the on-disk file is listed in this SUMMARY's Cleanup section for the owner."
  - "WINDOWS.md entry 13 (open, about article.html's standfirst deck missing preload for its italic face) was re-checked per the prior-context instruction: its Instrument-Serif-specific framing is now stale (the standfirst renders Source Serif 4 italic after D-GAP-B, and Instrument Serif Italic no longer exists as a built face at all), but the underlying non-preload risk still applies in kind to the smaller Source Serif 4 Italic file. Updated in place rather than closed, since no fresh preload-timing measurement was taken in this plan."

requirements-completed: [DSGN-03, PERF-07]

coverage:
  - id: D1
    description: "Every headline role (page h1s, category masthead h1, lead h2, card h3, dispatch h2, grid heading) renders Source Serif 4 at computed weight 700"
    requirement: "DSGN-03"
    verification:
      - kind: e2e
        ref: "design/tests/structure.spec.ts — 'type roles: Source Serif 4 body, Source Serif 4 Bold headlines, Instrument Serif wordmark only @c5', all 5 pages, chromium + webkit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Instrument Serif renders only the wordmark, weight 400, style normal, font-synthesis disabled; no other element renders it"
    requirement: "DSGN-03"
    verification:
      - kind: e2e
        ref: "design/tests/structure.spec.ts — same test, DOM-wide TreeWalker assertion, all 5 pages, chromium + webkit"
        status: pass
    human_judgment: false
  - id: D3
    description: "SourceSerif4-Roman.woff2 <= 60,000 bytes; SourceSerif4-Italic.woff2 <= 30,000 bytes; opsz pinned to each source's fvar default; wght kept 400-700 (Roman) / pinned 400 (Italic)"
    requirement: "PERF-07"
    verification:
      - kind: other
        ref: "design/mockups/fonts/subset-manifest.json faces[].bytes/axes; design/evidence/font-subset.md lever table"
        status: pass
    human_judgment: false
  - id: D4
    description: "InstrumentSerif-Italic.woff2 is no longer generated, referenced, or tracked"
    verification:
      - kind: other
        ref: "git ls-files design/mockups/fonts (absent); grep for 'InstrumentSerif-Italic' in style.css/mockups (no matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every rendered character (all 5 pages, Spanish fixture) is still in the subset, both engines; criterion 5 (font-swap CLS, including the positive control) still passes honestly after the shrink"
    requirement: "PERF-07"
    verification:
      - kind: e2e
        ref: "design/tests/font-cls.spec.ts 'every rendered character...' (both engines); pnpm run verify:phase-1 --pages=index,article --criteria=5"
        status: pass
    human_judgment: false
  - id: D6
    description: "PRD SS5.2/SS6.8 and 01-CONTEXT.md carry dated amendments for the owner's D-GAP-B/D-GAP-A decisions; DSGN-03's stale wording is recorded as a deviation for the phase transition, not edited mid-phase"
    verification:
      - kind: other
        ref: "docs/PRD.md SS5.2 'Amended 2026-09-17' note, SS6.8 bracketed note; 01-CONTEXT.md '## Amendments after owner review (2026-09-17)'"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 14: Source Serif 4 Bold Headlines, Instrument Serif Wordmark Only, and a Halved Font Subset Summary

**Headlines now render Source Serif 4 at a real, non-synthesised weight 700; Instrument Serif is the "915 TLDR" wordmark alone; and Source Serif 4's variable-font subsets shrink by more than half (Roman 108,164 -> 44,156 bytes, Italic 91,096 -> 20,216 bytes) by pinning the opsz axis to each source's own fvar default.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-17T18:40:00Z (approx.)
- **Completed:** 2026-09-17T19:05:00Z (approx.)
- **Tasks:** 3 of 3
- **Files modified:** 15 (excluding regenerated evidence screenshots and changelog entries)

## Accomplishments

- D-GAP-B closed end to end: `--font-headline`/`--weight-headline`/`--leading-headline` tokens, every headline rule switched to them, the wordmark rules pinned to weight 400 with `font-synthesis: none`, and a rewritten structure spec proving the contract in both engines on all five pages.
- D-GAP-A part 2 closed: a tested, dependency-free fvar reader (`readVariationAxes`) lets `build-fonts.mjs` pin Source Serif 4's `opsz` axis to the source's own default instead of a guessed number — the one lever that actually shrinks the subset, confirmed against four other candidate levers (baseline, no-hinting, restricted opsz range, and for italic, weight-pinned-only) recorded in `design/evidence/font-subset.md`.
- Instrument Serif Italic retired: no longer subsetted, built, or referenced anywhere; removed from the git index while the file itself stays on disk.
- Criterion 5 (font-swap CLS) re-verified after the shrink and still passes honestly, including the positive control that proves the instrument isn't blind — no threshold or guard was weakened to get there.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Source Serif 4 Bold headlines end to end** - `1e631fc` (feat)
2. **Task 2: fvar axis reader (test-first)** - `725bfb8` (test, RED) then `d97e8d1` (feat, GREEN)
3. **Task 3: Shrink Source Serif 4, retire Instrument Serif Italic, record lever evidence** - `7fd57f7` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 2 is TDD — two real commits (RED then GREEN), not one combined commit._

## Files Created/Modified

- `design/scripts/lib/font-axes.mjs` - `readVariationAxes(buffer)`, a dependency-free, no-I/O sfnt `fvar` table reader
- `design/tests/unit/font-axes.test.mjs` - 6 `node:test` cases covering the reader's full behavior contract
- `design/evidence/font-subset.md` - the size-lever table (baseline/noHinting/opsz-range/opsz-pinned, plus italic's extra wght-pinned levers), chosen configuration, and measured axis defaults
- `design/mockups/style.css` - headline tokens (`--font-headline`, `--weight-headline`, `--leading-headline`); every headline rule switched to them; wordmark rules pinned to weight 400 + `font-synthesis: none`; standfirst moved to body face italic 400; fonts region regenerated (one Instrument Serif face, Source Serif 4 italic at a single `font-weight: 400`)
- `design/tests/structure.spec.ts` - rewrote the headline test into "type roles: Source Serif 4 body, Source Serif 4 Bold headlines, Instrument Serif wordmark only @c5"; `readTokens()` now merges the fonts region's `:root` vars so `--font-headline`'s alias of `--font-body` resolves
- `design/scripts/lib/css-tokens.mjs` - `isColorValue()` fixed (Rule 1, see Deviations); added `parseFontsRootVars()`
- `design/scripts/check-contrast.mjs` - merges `parseFontsRootVars()` output into the resolution scope, same fix as `structure.spec.ts`
- `design/scripts/build-fonts.mjs` - crawl guard (weight/style violations fail the build); `SUBSET_JOBS` drops Instrument Serif Italic and pins Source Serif 4's axes via `readAxisDefault()`; `primaryFontFaceBlocks`/`buildFallbacksAndRoot` drop the Instrument Serif italic face; `MAX_BYTES_BY_FILE` per-file ceilings; `--levers` flag writing `design/evidence/font-subset.md`
- `design/mockups/fonts/subset-manifest.json`, `SourceSerif4-Roman.woff2`, `SourceSerif4-Italic.woff2` - regenerated at the new, smaller sizes with `axes` recorded
- `docs/PRD.md` - SS5.2 typography table amended (wordmark/headline/body split, dated D-GAP-B note); SS6.8 share-card note flagged for re-review
- `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` - "Amendments after owner review (2026-09-17)" section added
- `.planning/WINDOWS.md` - entry 13 updated (see Deviations)

## Decisions Made

- `--font-headline: var(--font-body)` rather than a literal duplicate of the Source Serif 4 stack, so geometry.ts's fallback-override mechanism (which rewrites `--font-display`/`--font-body` inside the fonts region for CLS testing) continues to reach headlines automatically.
- Source Serif 4 Italic pins `wght: 400` (a single value), not a range, because the new crawl guard proves italic never renders heavier — carrying the 400-700 range would have cost bytes for an unused value.
- The opsz-pinning tradeoff (display-size headlines no longer track optical size with font size) is documented in `font-subset.md` verbatim per the plan's required sentence, flagged for the owner to re-review at re-approval — not silently accepted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `isColorValue()` misclassified a bare font-weight value as a colour**
- **Found during:** Task 1, running `pnpm run check:contrast` after adding `--weight-headline: 700`
- **Issue:** culori's `parse()` accepts a bare 3/4/6/8-digit hex-digit string with no leading `#` (`parse('700')` returns a real RGB colour), which silently contradicted `isColorValue()`'s own documented contract ("a bare number... parse to undefined") and broke `check:contrast`'s coverage gate and `structure.spec.ts`'s `readTokens()` the moment the new token was added.
- **Fix:** Require the `#` prefix a real CSS hex colour always carries before ever handing the value to culori.
- **Files modified:** `design/scripts/lib/css-tokens.mjs`
- **Verification:** `pnpm run check:contrast` exits 0; the existing 17-test unit suite for `check-contrast.mjs` stayed green.
- **Committed in:** `1e631fc` (Task 1 commit)

**2. [Rule 3 - Blocking] `--font-headline: var(--font-body)` was an unresolvable reference to `resolveTheme()`**
- **Found during:** Task 1, same `check:contrast` run
- **Issue:** `--font-body` is owned by the fonts region, not the tokens region; `resolveTheme()` eagerly resolves every declaration in the tokens region and threw "missing reference" the moment a tokens-region declaration aliased it.
- **Fix:** Added `parseFontsRootVars()` to `css-tokens.mjs`, merged into both call sites (`check-contrast.mjs`, `structure.spec.ts`'s `readTokens()`) before resolution.
- **Files modified:** `design/scripts/lib/css-tokens.mjs`, `design/scripts/check-contrast.mjs`, `design/tests/structure.spec.ts`
- **Verification:** Both consumers resolve cleanly; full `structure.spec.ts` (96 tests) passes in both engines.
- **Committed in:** `1e631fc` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1/3 — bugs blocking the plan's own stated acceptance criteria, not scope creep). No threshold, gate, or guard was weakened; `isColorValue()` became stricter, not looser.

**WINDOWS.md entry 13 (re-checked per prior-context instruction, not a deviation from this plan but a required documentation correction):** article.html's `[data-standfirst]` deck no longer renders italic Instrument Serif at all — D-GAP-B (Task 1) moved it to Source Serif 4 italic weight 400, and Instrument Serif Italic no longer exists as a built face (Task 3). The entry's original framing is now stale. The underlying risk it named — an italic face outside D-GAP-A's two preloaded resources likely missing the optional block period and rendering in fallback — still applies in kind to Source Serif 4 Italic, which shrank substantially in this same plan (91,096 -> 20,216 bytes) but was not re-measured for its actual preload-miss rate (out of this plan's scope). Updated in place, left `open`, not closed or resolved unilaterally.

## Issues Encountered

None beyond the two auto-fixed bugs above — both were caught immediately by the plan's own verification steps failing where they should, not by a silent wrong result.

## Cleanup

- `design/mockups/fonts/InstrumentSerif-Italic.woff2` is untracked from git (`git rm --cached`) but still exists on disk. Per the plan's explicit prohibition, this executor did not delete it. **Cleanup needed (run yourself):**
  ```
  rm design/mockups/fonts/InstrumentSerif-Italic.woff2
  ```

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 01-15 (Spanish width recalibration) is unblocked and necessary: this plan's font-size changes make the existing Spanish width calibration stale, as the plan's own `<objective>` flagged. `spanish-overflow.spec.ts` was deliberately not run here.
- WINDOWS.md entry 13 remains open, now correctly scoped to Source Serif 4 Italic rather than the retired Instrument Serif Italic — a candidate for whoever next touches D-GAP-A's preload scope or the standfirst treatment.
- DSGN-03's wording ("Display type is Instrument Serif") and ROADMAP criterion 5's "(display)" wording remain queued for the phase-transition edit, per the 01-13/01-14 precedent — not edited mid-phase.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: design/scripts/lib/font-axes.mjs
- FOUND: design/tests/unit/font-axes.test.mjs
- FOUND: design/evidence/font-subset.md
- FOUND: .planning/phases/01-design-sketch-editorial-identity/01-14-SUMMARY.md
- FOUND commit: 1e631fc (Task 1)
- FOUND commit: 725bfb8 (Task 2 RED)
- FOUND commit: d97e8d1 (Task 2 GREEN)
- FOUND commit: 7fd57f7 (Task 3)

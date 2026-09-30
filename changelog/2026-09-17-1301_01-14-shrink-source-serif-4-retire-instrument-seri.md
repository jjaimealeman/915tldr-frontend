# 2026-09-17 - Source Serif 4 Shrinks by More Than Half, Instrument Serif Italic Retired

**Keywords:** [PERFORMANCE] [FEATURE] [TESTING] [DOCUMENTATION]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1301_01-14-shrink-source-serif-4-retire-instrument-seri.md`

## What Changed

- `design/scripts/build-fonts.mjs`:
  - Added a crawl guard, run during the existing Playwright glyph crawl,
    that fails the build (naming the page and a short selector) if any
    Source Serif 4 italic element ever renders at a computed weight other
    than 400, or any Instrument Serif element ever renders italic. This is
    what makes the pins below safe.
  - Source Serif 4's variable-font `opsz` axis is now pinned to each
    source's own fvar default (read via `design/scripts/lib/font-axes.mjs`,
    Task 2), instead of being left to vary with rendered font size. Roman
    keeps `wght: 400-700` (headlines need a real bold); Italic pins `wght`
    to 400 as well, since the new crawl guard proves it never renders
    heavier.
  - Instrument Serif Italic is no longer subsetted, built, or referenced —
    D-GAP-B moved every italic display use onto Source Serif 4.
  - Added `MAX_BYTES_BY_FILE` (Roman <= 60,000 bytes, Italic <= 30,000
    bytes) as an additional, stricter per-file ceiling; the existing
    150 KB / 25%-of-source gate is unchanged.
  - Added a `--levers` flag that subsets the identical glyph set through
    every candidate configuration (baseline, no-hinting, restricted opsz
    range, pinned opsz; plus, for italic, pinned weight with variable vs.
    pinned opsz) and writes `design/evidence/font-subset.md`.
- `design/mockups/fonts/`: `SourceSerif4-Roman.woff2` 108,164 -> 44,156
  bytes (40.8% of its old size); `SourceSerif4-Italic.woff2` 91,096 ->
  20,216 bytes (22.2%). `InstrumentSerif-Italic.woff2` removed from the git
  index (`git rm --cached`) — the file stays on disk, nothing references it.
- `design/mockups/style.css`: fonts region regenerated — one Instrument
  Serif `@font-face` (normal, 400), one Source Serif 4 italic face at a
  single `font-weight: 400` (previously a `400 700` range it never used).
- `design/evidence/font-subset.md`: new — the lever table, chosen
  configuration, and measured axis defaults for both faces.
- `design/evidence/pages/*.jpg`, `design/evidence/font-cls.md`: regenerated
  against the smaller fonts.

## Why

The owner asked for the Source Serif 4 subsets to shrink (D-GAP-A, paired
with reopening `font-display` to `optional` in 01-13 — a smaller preloaded
file is more likely to arrive inside the short `optional` block period).
Pinning `opsz` was the only lever, of everything measured, that moved the
byte count materially: dropping hinting saved nothing (the source is
unhinted) and restricting the opsz *range* saved under 2%; pinning it to a
single value is what cut the file in half. Retiring Instrument Serif Italic
was possible because D-GAP-B (same session) already moved every italic
display use onto Source Serif 4, so the face served nothing.

## Issues Encountered

None — the fvar-based opsz defaults measured almost exactly what planning
estimated (Roman 44,156 bytes vs. a planning-time estimate of 44,156;
Italic 20,216 vs. an estimated 20,180).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run fonts:build --levers` once, then
  `pnpm run fonts:build` twice in a row — confirmed `style.css`, the fonts
  directory and `font-subset.md` are byte-identical between the two plain
  runs. `font-cls.spec.ts`'s full coverage test (every rendered character,
  both engines). The full `structure.spec.ts` suite (96 tests, both
  engines). `pnpm run verify:phase-1 --pages=index,article --criteria=5`,
  including the positive control — criterion 5 stays honestly green with no
  threshold weakened.
- What wasn't tested: the Spanish width calibration
  (`spanish-overflow.spec.ts`) — it is stale after this change (the fonts'
  widths changed) and is explicitly out of scope; 01-15 recalibrates it.

## Next Steps

- [ ] 01-15: recalibrate the Spanish width guard against the new font
      metrics

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - halves the font payload and retires an unused font file

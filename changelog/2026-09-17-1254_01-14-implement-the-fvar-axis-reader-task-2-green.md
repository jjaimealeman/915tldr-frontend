# 2026-09-17 - GREEN: Implement the Font Variation-Axis Reader

**Keywords:** [FEATURE] [TESTING]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1254_01-14-implement-the-fvar-axis-reader-task-2-green.md`

## What Changed

- `design/scripts/lib/font-axes.mjs`: new `readVariationAxes(buffer)`
  library function — a dependency-free, no-file-I/O parser of an sfnt font's
  `fvar` (variable-font axis) table. It validates the sfnt version signature
  (accepts TrueType/Apple/`OTTO`; rejects `wOFF`/`wOF2`/`ttcf` with a clear
  error naming the format), walks the table directory to find `fvar`,
  returns `[]` when the font has no `fvar` table (a static font, e.g.
  Instrument Serif), and otherwise returns each axis as
  `{ tag, min, default, max }` in font order. Every multi-byte read is
  bounds-checked and throws mentioning "sfnt" on any overflow.
- Measured, real axis defaults for both Source Serif 4 sources in
  `design/fonts-src/` (identical for Roman and Italic): `wght` min 200 /
  default 400 / max 900; `opsz` min 8 / default 20 / max 60.

## Why

Task 3 needs to pin Source Serif 4's `opsz` axis to shrink the subset — the
one lever that actually moves the byte count materially (measured at
planning time: Roman 108,164 -> 44,156 bytes with `opsz` pinned). Pinning to
a *guessed* number would be fragile if Google Fonts ever revises the
source's default; reading the real fvar default straight from the font file
means the pin always matches what the font itself considers "normal."

## Issues Encountered

None — the RED test suite (previous commit) passed unmodified once the
implementation existed.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test design/tests/unit/font-axes.test.mjs` — all
  6 tests green. Confirmed no package import and no file I/O in the library
  itself (`grep -c "from 'node:fs'" design/scripts/lib/font-axes.mjs` prints
  `0`).
- What wasn't tested: wiring this reader into `build-fonts.mjs` — that's
  Task 3.

## Next Steps

- [ ] Task 3: shrink Source Serif 4 using the measured opsz defaults,
      retire Instrument Serif Italic, record the lever evidence

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - new build-time capability, no production surface changed yet

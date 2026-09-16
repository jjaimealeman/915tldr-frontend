# Contrast evidence (D-13)

Generated from `design/mockups/style.css` — re-run `npm run check:contrast` after any token edit.

## Neutral pairs

| Theme | Pair | Threshold | Ratio | Verdict |
|---|---|---|---|---|
| light | ink / paper | 4.5:1 | 17.33:1 | PASS |
| light | ink-muted / paper | 4.5:1 | 4.83:1 | PASS |
| light | link / paper | 4.5:1 | 17.33:1 | PASS |
| light | focus-ring / paper | 3:1 | 17.33:1 | PASS |
| light | cat-none / paper | 3:1 | 3.23:1 | PASS |
| dark | ink / paper | 4.5:1 | 15.31:1 | PASS |
| dark | ink-muted / paper | 4.5:1 | 5.05:1 | PASS |
| dark | link / paper | 4.5:1 | 15.31:1 | PASS |
| dark | focus-ring / paper | 3:1 | 15.31:1 | PASS |
| dark | cat-none / paper | 3:1 | 3.50:1 | PASS |

## Category ramps

Lightness is held constant across each ramp (D-02/D-03); every hue is checked and the worst one is reported — equal OKLCH lightness does not guarantee equal WCAG contrast.

| Ramp | Pairing | Threshold | Worst hue | Ratio | Verdict |
|---|---|---|---|---|---|
| vivid-light | vs light paper | 3:1 | health | 3.63:1 | PASS |
| vivid-dark | vs dark paper | 3:1 | community | 8.65:1 | PASS |
| block | vs --block-ink (worst theme: dark) | 4.5:1 | health | 5.73:1 | PASS |

**Overall: PASS**

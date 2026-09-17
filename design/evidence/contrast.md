# Contrast evidence (D-13)

Generated from `design/mockups/style.css` — re-run `npm run check:contrast` after any token edit.

## Neutrals

| Theme | Pair | Threshold | Ratio | Verdict |
|---|---|---|---|---|
| light | ink / paper | 4.5:1 | 17.33:1 | PASS |
| light | ink-muted / paper | 4.5:1 | 4.83:1 | PASS |
| light | link / paper | 4.5:1 | 17.33:1 | PASS |
| light | cat-none / paper | 3:1 | 3.23:1 | PASS |
| dark | ink / paper | 4.5:1 | 15.31:1 | PASS |
| dark | ink-muted / paper | 4.5:1 | 5.05:1 | PASS |
| dark | link / paper | 4.5:1 | 15.31:1 | PASS |
| dark | cat-none / paper | 3:1 | 3.50:1 | PASS |

## Ramps

Lightness is held constant across each ramp (D-02/D-03); every hue is checked and the worst one is reported.

| Ramp | Pairing | Threshold | Worst hue | Ratio | Verdict |
|---|---|---|---|---|---|
| vivid-light | vs light paper | 3:1 | health | 3.63:1 | PASS |
| block | vs --block-ink (worst theme: dark) | 4.5:1 | health | 5.73:1 | PASS |
| vivid-dark | vs dark paper | 3:1 | community | 8.65:1 | PASS |

## Focus

| Theme | Pair | Threshold | Ratio | Verdict |
|---|---|---|---|---|
| light | focus-ring / paper | 3:1 | 17.33:1 | PASS |
| dark | focus-ring / paper | 3:1 | 15.31:1 | PASS |
| dark | focus-ring-on-block vs block (worst: health) | 3:1 | 5.73:1 | PASS |

## Distinctness

Minimum pairwise OKLab distance per stop (>= 0.05 required).

| Closest pair | Stop | Distance | Verdict |
|---|---|---|---|
| crime / sports | vivid-light | 0.0642 | PASS |
| business / health | block | 0.0581 | PASS |
| politics / weather | vivid-dark | 0.0554 | PASS |

## D-02 structure

All stop literals match their shared stop L/C and per-category hue.

## C-01 guards

| Theme | Token | Hue | Chroma | Verdict |
|---|---|---|---|---|
| light | --paper | 106.4deg | 0.0026 | PASS |
| light | --ink | 264.4deg | 0.0086 | PASS |
| light | --ink-muted | 247.9deg | 0.0040 | PASS |
| light | --rule | 264.5deg | 0.0029 | PASS |
| light | --rule-strong | 258.3deg | 0.0050 | PASS |
| light | --block-ink | 106.4deg | 0.0026 | PASS |
| dark | --paper | 258.4deg | 0.0069 | PASS |
| dark | --ink | 258.3deg | 0.0046 | PASS |
| dark | --ink-muted | 247.9deg | 0.0038 | PASS |
| dark | --rule | 247.9deg | 0.0025 | PASS |
| dark | --rule-strong | 247.9deg | 0.0040 | PASS |
| dark | --block-ink | 258.3deg | 0.0046 | PASS |

## Warnings

- C-01 review: sports block stop hue 49.4deg falls in the 40-100deg amber/olive band — may read as brown; owner to judge
- C-01 review: business block stop hue 94.5deg falls in the 40-100deg amber/olive band — may read as brown; owner to judge

**Overall: PASS**

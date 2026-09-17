# Font-Swap CLS Evidence (D-08, criterion 5)

Chromium 153.0.8010.12, WebKit (Playwright) 26.6, docker.

Strategy: `font-display: optional` with `<link rel="preload">` for the above-the-fold primary faces (owner decision D-GAP-A, 2026-09-17, PRD §6.5 amended). Each page view renders either the primary webfont from first paint (the face was ready before the block period elapsed) or the metric-compatible fallback throughout the rest of that view — there is no mid-render swap, so no swap-triggered layout shift.

The two user-visible paths this matrix classifies (`pathObserved`) are `fallback-kept` (the webfont missed the block period; the fallback face renders for the whole view) and `webfont-at-first-paint` (the webfont was ready in time; it renders from the very first frame). Neither path involves a visible transition. Each load is classified by comparing its own before/after layout snapshots against a REFERENCE load of the same page/width/theme/scroll/variant/fallback combination with no artificial network hold — a plain load whose primary webfont is proven in use (`assertWebfontsInUse`) before its snapshot and native CLS (`referenceNativeCls`) are trusted as the "what does a correctly-rendered webfont-first view of this exact combination look like" baseline.

WebKit (Playwright) tracks WebKit trunk on Linux. It is not Safari on macOS or iOS. These results are not Safari verification.

size-adjust is supported in Safari 17+. ascent-override, descent-override and line-gap-override are not in any shipped Safari (caniuse, checked 2026-09-17: preview). The size-adjust-only rows are the proxy for today's Safari readers.

Georgia is not installed on this Linux development host (nor in the pinned WebKit Docker image), so it is not exercised by either engine below — covered only by capsize's metric arithmetic. A real macOS/iOS/Windows/Safari pass remains an open item (WINDOWS.md entry 1).

## Swap matrix

| page | width | scroll | variant | fallback face | font-display | path | Chromium native CLS | Chromium geometry | Chromium ref. native CLS | WebKit geometry | WebKit ref. native CLS | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| article | 1280 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 1280 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 1280 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 1280 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 1280 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 1280 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 1280 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 1280 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 320 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 320 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 320 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 320 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 320 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 320 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| article | 320 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| article | 320 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 1280 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 1280 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 1280 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 1280 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 1280 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 1280 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 1280 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 1280 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 320 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 320 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 320 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 320 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 320 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 320 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| category | 320 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| category | 320 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 1280 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 1280 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 1280 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 1280 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 1280 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 1280 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 1280 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 1280 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 320 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 320 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 320 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 320 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 320 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 320 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| changelog | 320 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| changelog | 320 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 1280 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 1280 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 1280 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 1280 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 1280 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 1280 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 1280 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 1280 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 320 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 320 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 320 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 320 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 320 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 320 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| contact | 320 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| contact | 320 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 1280 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 1280 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 1280 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 1280 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 1280 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 1280 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 1280 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 1280 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 320 | mid | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 320 | mid | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 320 | mid | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 320 | mid | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 320 | top | full | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 320 | top | full | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |
| index | 320 | top | size-adjust-only | Noto Serif | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | — | — | pass |
| index | 320 | top | size-adjust-only | Times New Roman | optional | fallback-kept | 0.0000 | 0.0000 | 0.0000 | 0.0000 | unsupported | pass |

## Positive control

Proves the instrument is not blind: the same index@320px/scroll=mid load, measured with every `font-display` descriptor in the fonts region rewritten to `swap` for this one load only (the `swap-control` variant), must show a REAL swap when the engine has a pre-release paint to diff against.

| engine | prePaintObserved | pathObserved | geometryScore | verdict |
|---|---|---|---|---|
| chromium | true | swapped | 0.6722 | detected |
| webkit | true | swapped | 1.1908 | detected |

## Per-engine prePaintObserved

- Chromium: prePaintObserved was true across the matrix.
- WebKit (Playwright): prePaintObserved was mixed (true, false) across the matrix.

## Fallback faces exercised

- Chromium: Noto Serif, Times New Roman
- WebKit (Playwright): Times New Roman

## Not exercised

- Georgia — not installed on this Linux machine or in the Playwright image; covered only by capsize metric arithmetic. macOS, iOS and Windows readers get this face. A real-Safari / Georgia pass on a macOS or iOS device remains an open item.

## Summary

- Chromium: max geometryScore = 0.0000
- WebKit (Playwright): max geometryScore = 0.0000

Under font-display: swap (01-09) the same matrix measured geometry scores up to 1.19 (WebKit) and 0.70 (Chromium); superseded by D-GAP-A.


# Font-Swap CLS Evidence (D-08, criterion 5)

Chromium 153.0.8010.12, WebKit (Playwright) 26.6, docker.

WebKit (Playwright) tracks WebKit trunk on Linux. It is not Safari on macOS or iOS. These results are not Safari verification.

size-adjust is supported in Safari 17+. ascent-override, descent-override and line-gap-override are not in any shipped Safari (caniuse, checked 2026-09-17: preview). The size-adjust-only rows are the proxy for today's Safari readers.

## Swap matrix

| page | width | scroll | variant | fallback face | Chromium native CLS | Chromium geometry | WebKit geometry | verdict |
|---|---|---|---|---|---|---|---|---|
| article | 1280 | mid | full | Noto Serif | 0.0066 | 0.0225 | — | FAIL |
| article | 1280 | mid | full | Times New Roman | 0.0165 | 0.0347 | 0.0471 | FAIL |
| article | 1280 | mid | size-adjust-only | Noto Serif | 0.0109 | 0.0225 | — | FAIL |
| article | 1280 | mid | size-adjust-only | Times New Roman | 0.0183 | 0.0347 | 0.0477 | FAIL |
| article | 1280 | top | full | Noto Serif | 0.0024 | 0.0025 | — | pass |
| article | 1280 | top | full | Times New Roman | 0.0030 | 0.0046 | 0.0010 | pass |
| article | 1280 | top | size-adjust-only | Noto Serif | 0.0045 | 0.0030 | — | pass |
| article | 1280 | top | size-adjust-only | Times New Roman | 0.0055 | 0.0054 | 0.0021 | FAIL |
| article | 320 | mid | full | Noto Serif | 0.0001 | 0.0004 | — | pass |
| article | 320 | mid | full | Times New Roman | 0.0601 | 0.0845 | 0.2328 | FAIL |
| article | 320 | mid | size-adjust-only | Noto Serif | 0.0004 | 0.0489 | — | FAIL |
| article | 320 | mid | size-adjust-only | Times New Roman | 0.0601 | 0.0885 | 0.2372 | FAIL |
| article | 320 | top | full | Noto Serif | 0.0001 | 0.0004 | — | pass |
| article | 320 | top | full | Times New Roman | 0.0112 | 0.0271 | 0.1111 | FAIL |
| article | 320 | top | size-adjust-only | Noto Serif | 0.0019 | 0.0236 | — | FAIL |
| article | 320 | top | size-adjust-only | Times New Roman | 0.0196 | 0.0311 | 0.1550 | FAIL |
| category | 1280 | mid | full | Noto Serif | 0.0638 | 0.1124 | — | FAIL |
| category | 1280 | mid | full | Times New Roman | 0.0659 | 0.1126 | 0.2041 | FAIL |
| category | 1280 | mid | size-adjust-only | Noto Serif | 0.0642 | 0.1124 | — | FAIL |
| category | 1280 | mid | size-adjust-only | Times New Roman | 0.0502 | 0.0899 | 0.2052 | FAIL |
| category | 1280 | top | full | Noto Serif | 0.0000 | 0.0000 | — | pass |
| category | 1280 | top | full | Times New Roman | 0.0000 | 0.0014 | 0.0144 | FAIL |
| category | 1280 | top | size-adjust-only | Noto Serif | 0.0020 | 0.0114 | — | FAIL |
| category | 1280 | top | size-adjust-only | Times New Roman | 0.0023 | 0.0149 | 0.0376 | FAIL |
| category | 320 | mid | full | Noto Serif | 0.1560 | 0.0084 | — | FAIL |
| category | 320 | mid | full | Times New Roman | 0.0780 | 0.0020 | 0.0000 | FAIL |
| category | 320 | mid | size-adjust-only | Noto Serif | 0.1563 | 0.0195 | — | FAIL |
| category | 320 | mid | size-adjust-only | Times New Roman | 0.0780 | 0.1888 | 0.0000 | FAIL |
| category | 320 | top | full | Noto Serif | 0.0000 | 0.0000 | — | pass |
| category | 320 | top | full | Times New Roman | 0.0000 | 0.0000 | 0.0000 | pass |
| category | 320 | top | size-adjust-only | Noto Serif | 0.0005 | 0.0056 | — | FAIL |
| category | 320 | top | size-adjust-only | Times New Roman | 0.0006 | 0.0052 | 0.0000 | FAIL |
| changelog | 1280 | mid | full | Noto Serif | 0.1483 | 0.0307 | — | FAIL |
| changelog | 1280 | mid | full | Times New Roman | 0.1694 | 0.0310 | 0.0000 | FAIL |
| changelog | 1280 | mid | size-adjust-only | Noto Serif | 0.1483 | 0.0305 | — | FAIL |
| changelog | 1280 | mid | size-adjust-only | Times New Roman | 0.1696 | 0.0308 | 0.0000 | FAIL |
| changelog | 1280 | top | full | Noto Serif | 0.0085 | 0.0029 | — | FAIL |
| changelog | 1280 | top | full | Times New Roman | 0.0085 | 0.0041 | 0.0000 | FAIL |
| changelog | 1280 | top | size-adjust-only | Noto Serif | 0.0103 | 0.0046 | — | FAIL |
| changelog | 1280 | top | size-adjust-only | Times New Roman | 0.0486 | 0.0059 | 0.0000 | FAIL |
| changelog | 320 | mid | full | Noto Serif | 0.0441 | 0.2248 | — | FAIL |
| changelog | 320 | mid | full | Times New Roman | 0.0411 | 0.2627 | 0.0000 | FAIL |
| changelog | 320 | mid | size-adjust-only | Noto Serif | 0.0445 | 0.2248 | — | FAIL |
| changelog | 320 | mid | size-adjust-only | Times New Roman | 0.0415 | 0.2624 | 0.0000 | FAIL |
| changelog | 320 | top | full | Noto Serif | 0.0125 | 0.0068 | — | FAIL |
| changelog | 320 | top | full | Times New Roman | 0.0123 | 0.0080 | 0.0000 | FAIL |
| changelog | 320 | top | size-adjust-only | Noto Serif | 0.0132 | 0.0108 | — | FAIL |
| changelog | 320 | top | size-adjust-only | Times New Roman | 0.0288 | 0.0132 | 0.0000 | FAIL |
| contact | 1280 | mid | full | Noto Serif | 0.0007 | 0.0008 | — | pass |
| contact | 1280 | mid | full | Times New Roman | 0.0001 | 0.0008 | 0.0000 | pass |
| contact | 1280 | mid | size-adjust-only | Noto Serif | 0.0013 | 0.0028 | — | pass |
| contact | 1280 | mid | size-adjust-only | Times New Roman | 0.0007 | 0.0038 | 0.0000 | pass |
| contact | 1280 | top | full | Noto Serif | 0.0008 | 0.0002 | — | pass |
| contact | 1280 | top | full | Times New Roman | 0.0062 | 0.0036 | 0.0000 | FAIL |
| contact | 1280 | top | size-adjust-only | Noto Serif | 0.0065 | 0.0005 | — | FAIL |
| contact | 1280 | top | size-adjust-only | Times New Roman | 0.0109 | 0.0039 | 0.0000 | FAIL |
| contact | 320 | mid | full | Noto Serif | 0.0001 | 0.0004 | — | pass |
| contact | 320 | mid | full | Times New Roman | 0.0372 | 0.0737 | 0.0000 | FAIL |
| contact | 320 | mid | size-adjust-only | Noto Serif | 0.0003 | 0.0034 | — | pass |
| contact | 320 | mid | size-adjust-only | Times New Roman | 0.0497 | 0.0777 | 0.0000 | FAIL |
| contact | 320 | top | full | Noto Serif | 0.0005 | 0.0000 | — | pass |
| contact | 320 | top | full | Times New Roman | 0.0041 | 0.0124 | 0.0000 | FAIL |
| contact | 320 | top | size-adjust-only | Noto Serif | 0.0010 | 0.0008 | — | pass |
| contact | 320 | top | size-adjust-only | Times New Roman | 0.0068 | 0.0145 | 0.0000 | FAIL |
| index | 1280 | mid | full | Noto Serif | 0.0718 | 0.2478 | — | FAIL |
| index | 1280 | mid | full | Times New Roman | 0.0732 | 0.2410 | 0.3770 | FAIL |
| index | 1280 | mid | size-adjust-only | Noto Serif | 0.0720 | 0.2478 | — | FAIL |
| index | 1280 | mid | size-adjust-only | Times New Roman | 0.0747 | 0.2410 | 0.3779 | FAIL |
| index | 1280 | top | full | Noto Serif | 0.0000 | 0.0000 | — | pass |
| index | 1280 | top | full | Times New Roman | 0.0000 | 0.0025 | 0.0056 | FAIL |
| index | 1280 | top | size-adjust-only | Noto Serif | 0.0013 | 0.0174 | — | FAIL |
| index | 1280 | top | size-adjust-only | Times New Roman | 0.0015 | 0.0199 | 0.0334 | FAIL |
| index | 320 | mid | full | Noto Serif | 0.3790 | 0.6722 | — | FAIL |
| index | 320 | mid | full | Times New Roman | 0.2482 | 0.5953 | 1.1908 | FAIL |
| index | 320 | mid | size-adjust-only | Noto Serif | 0.3816 | 0.6760 | — | FAIL |
| index | 320 | mid | size-adjust-only | Times New Roman | 0.2546 | 0.5953 | 1.1948 | FAIL |
| index | 320 | top | full | Noto Serif | 0.0000 | 0.0000 | — | pass |
| index | 320 | top | full | Times New Roman | 0.0000 | 0.0000 | 0.7587 | FAIL |
| index | 320 | top | size-adjust-only | Noto Serif | 0.0008 | 0.0627 | — | FAIL |
| index | 320 | top | size-adjust-only | Times New Roman | 0.0010 | 0.0594 | 0.7812 | FAIL |

## Fallback faces exercised

- Chromium: Noto Serif, Times New Roman
- WebKit (Playwright): Times New Roman

## Not exercised

- Georgia — not installed on this Linux machine or in the Playwright image; covered only by capsize metric arithmetic. macOS, iOS and Windows readers get this face. A real-Safari / Georgia pass on a macOS or iOS device remains an open item.

## Summary

- Chromium: max geometryScore = 0.6760
- WebKit (Playwright): max geometryScore = 1.1948


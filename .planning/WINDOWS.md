---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-16T20:48:47.571Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | design/tests/support/geometry.ts |  | WebKit (Playwright 26.6, Docker) never composites/paints while a primary @font-face resource is pending, regardless of font-display:swap or hold duration — measureFontSwap reports prePaintObserved:false and geometryScore:0 honestly rather than measuring a never-painted layout artifact; not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off. | open |  | 2026-09-16T19:32:05.866Z |  |
| 2 | 01 | deviation | design/palette/photo-sources.json |  | politics' photo is Santa Fe NM dusk sky, not literally the Franklin Mountains/El Paso skyline the subject names -- flagged for owner review before 01-APPROVAL.md | open |  | 2026-09-16T20:48:47.479Z |  |
| 3 | 01 | deviation | design/evidence/palette.md |  | Sports (49.4deg) and Business (94.5deg) block-stop hues visually sit near the amber-olive-reading-as-brown risk C-01 flags -- flagged for owner review, not resolved unilaterally | open |  | 2026-09-16T20:48:47.571Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/support/geometry.ts",
    "line": null,
    "description": "WebKit (Playwright 26.6, Docker) never composites/paints while a primary @font-face resource is pending, regardless of font-display:swap or hold duration — measureFontSwap reports prePaintObserved:false and geometryScore:0 honestly rather than measuring a never-painted layout artifact; not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T19:32:05.866Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "01",
    "file": "design/palette/photo-sources.json",
    "line": null,
    "description": "politics' photo is Santa Fe NM dusk sky, not literally the Franklin Mountains/El Paso skyline the subject names -- flagged for owner review before 01-APPROVAL.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T20:48:47.479Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "01",
    "file": "design/evidence/palette.md",
    "line": null,
    "description": "Sports (49.4deg) and Business (94.5deg) block-stop hues visually sit near the amber-olive-reading-as-brown risk C-01 flags -- flagged for owner review, not resolved unilaterally",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T20:48:47.571Z",
    "resolved_at": null
  }
]
````

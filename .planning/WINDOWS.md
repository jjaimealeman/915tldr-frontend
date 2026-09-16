---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-16T19:32:05.866Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | design/tests/support/geometry.ts |  | WebKit (Playwright 26.6, Docker) never composites/paints while a primary @font-face resource is pending, regardless of font-display:swap or hold duration — measureFontSwap reports prePaintObserved:false and geometryScore:0 honestly rather than measuring a never-painted layout artifact; not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off. | open |  | 2026-09-16T19:32:05.866Z |  |

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
  }
]
````

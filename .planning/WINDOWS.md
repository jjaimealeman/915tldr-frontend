---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 1
total_count: 8
last_updated: 2026-09-17T06:33:06.507Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | design/tests/support/geometry.ts |  | UPDATED by 01-09: the original "never composites, regardless of hold duration" claim was based on a single page/scenario and is not universal. 01-09's full swap matrix shows prePaintObserved:false (WebKit-Docker never paints a pre-swap frame) specifically on category.html@320px, changelog.html and contact.html, but prePaintObserved:true (it does composite and geometryScore is real, non-zero) on index.html, article.html and category.html@1280px -- page-dependent, not a blanket engine limitation. measureFontSwap still reports the flag honestly either way. Not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off. | open |  | 2026-09-16T19:32:05.866Z |  |
| 2 | 01 | deviation | design/palette/photo-sources.json |  | politics' photo is Santa Fe NM dusk sky, not literally the Franklin Mountains/El Paso skyline the subject names -- flagged for owner review before 01-APPROVAL.md | open |  | 2026-09-16T20:48:47.479Z |  |
| 3 | 01 | deviation | design/evidence/palette.md |  | Sports (49.4deg) and Business (94.5deg) block-stop hues visually sit near the amber-olive-reading-as-brown risk C-01 flags -- flagged for owner review, not resolved unilaterally | open |  | 2026-09-16T20:48:47.571Z |  |
| 4 | 01 | deviation | design/tests/font-cls.spec.ts |  | UPDATED by 01-09 (see entry 7 for the full evidence): the "Docker lacking Georgia/Noto Serif" root cause is real but incomplete -- 01-09's full swap matrix shows index.html/category.html ALSO fail in native Chromium (not just Docker WebKit) once scroll=mid is measured (never tested before 01-09), with the same Noto Serif/Times New Roman tiers this entry names. Chromium was only ever measured at scroll=top previously, which is why it "passed cleanly." Non-blocking per human_verify_mode:end-of-phase; needs real-Safari spot-check before 01-APPROVAL.md. | open |  | 2026-09-17T00:46:16.920Z |  |
| 5 | 01 | deviation | design/mockups/article.html |  | UPDATED by 01-09 (see entry 7 for the full evidence): same broadened root cause as entry 4 -- article.html ALSO fails in native Chromium (not just Docker WebKit) once scroll=mid is measured (e.g. Chromium geometryScore 0.0347 @1280px/mid, previously untested). Non-blocking per human_verify_mode:end-of-phase; same real-Safari spot-check as entry 4 covers this. | open |  | 2026-09-17T01:20:11.946Z |  |
| 6 | 01 | deviation | design/mockups/changelog.html |  | Chromium reports native CLS 0.0125 (vs 0.005 threshold) on changelog.html @320px font swap, but this project's own geometry-based instrument (the primary, engine-independent D-08 measurement) reports geometryScore 0 for the same swap, and a direct check confirmed zero elements moved within the visible viewport -- all reflow is below the fold. WebKit passes cleanly on the same page. Investigated with layout-shift source attribution, which showed unchanged before/after rects for the reported sources, consistent with a Chromium native-CLS attribution quirk on text-dense pages rather than a real user-visible shift. No CSS bug found (line-heights, margins and centering all checked) and no threshold weakened. Flagged for owner judgement per human_verify_mode:end-of-phase. | fixed |  | 2026-09-17T01:20:12.039Z | 2026-09-17T06:32:42.431Z |
| 7 | 01 | deviation | design/tests/font-cls.spec.ts |  | 01-09's full swap matrix (scroll=top/mid, variant=full/size-adjust-only, fallback=Noto Serif/Times New Roman) shows real, substantial font-swap CLS on ALL FIVE mockup pages, in BOTH Chromium (native) and WebKit -- not a Docker-missing-font-specific problem: entries 4/5's root cause (Docker lacking Georgia/Noto Serif) is real but incomplete. Georgia is unavailable via local() in native Chromium on this machine too (confirmed via document.fonts.load, contradicting fc-match's own unrelated Gelasio substitution); and the SAME corrected Times-New-Roman/Liberation-Serif tier, when forced in native Chromium (not just Docker WebKit), shows comparable-magnitude CLS once scroll=mid is measured (e.g. index.html: Chromium geometryScore up to 0.70, WebKit up to 1.19). variant=size-adjust-only vs full show near-identical magnitudes, ruling out the ascent/descent/line-gap overrides as the primary driver. Root cause: capsize's size-adjust is a single average-character-width scale factor: it cannot guarantee identical per-line word-wrap points between two visually distinct typefaces, so real reflow remains once you look below the initial viewport (scroll=mid, never tested before this plan). This is inherent to the font-substitution strategy, not a CSS bug -- no fix attempted (font-display:swap is a locked PRD Section 6.5 decision; changing it would be architectural, Rule 4). Flagged for owner judgement. | open |  | 2026-09-17T06:32:55.674Z |  |
| 8 | 01 | deviation | design/mockups/changelog.html |  | Supersedes entry 6's conclusion. 01-09 investigated the instrument itself per this plan's own instruction rather than trusting the prior 'Chromium native-CLS attribution quirk' dismissal, and found a real bug in the geometry instrument (design/tests/support/geometry.ts's snapshotLayout): it measured each candidate element's single getBoundingClientRect() envelope, not per-rendered-line getClientRects() fragments -- so a multi-line-wrapping inline element (changelog.html's [data-item-sentence] spans, several sentences long) could have individual LINES reflow onto different positions after a font swap while the element's overall envelope stayed nearly unchanged, hiding real shift from the geometry score entirely (matching a failure mode this project's own focus.ts already documented for wrapped focus rings in 01-08). Fixed (Rule 1) to compare per-fragment rects, the same standard 01-08 established. After the fix, changelog.html@320px/top/full/Noto-Serif now measures geometryScore 0.0068 (previously 0.0000) against native CLS 0.0125 -- both now agree this is a real violation of the 0.005 threshold, not an attribution quirk to dismiss. A residual gap between geometry (0.0068) and native (0.0125) remains, most likely finer-than-line-fragment paint-box granularity in the browser's own native measurement; not further chased given time cost and that both signals already agree on the qualitative conclusion. Folds into entry 7's broader finding -- flagged for owner judgement, no threshold weakened. | open |  | 2026-09-17T06:33:06.507Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/support/geometry.ts",
    "line": null,
    "description": "UPDATED by 01-09: the original \"never composites, regardless of hold duration\" claim was based on a single page/scenario and is not universal. 01-09's full swap matrix shows prePaintObserved:false (WebKit-Docker never paints a pre-swap frame) specifically on category.html@320px, changelog.html and contact.html, but prePaintObserved:true (it does composite and geometryScore is real, non-zero) on index.html, article.html and category.html@1280px -- page-dependent, not a blanket engine limitation. measureFontSwap still reports the flag honestly either way. Not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off.",
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
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/font-cls.spec.ts",
    "line": null,
    "description": "WebKit font-swap CLS gate fails on index.html/category.html (geometryScore up to 0.76 vs 0.005 threshold) — root-caused to the pinned Docker WebKit test image lacking Georgia/Noto Serif (only Liberation family installed per fc-list), forcing the worst-compatible fallback tier; Chromium passes cleanly. Non-blocking per human_verify_mode:end-of-phase; needs real-Safari spot-check before 01-APPROVAL.md.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T00:46:16.920Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/article.html",
    "line": null,
    "description": "WebKit font-swap CLS gate fails on article.html (geometryScore 0.143 @320px vs 0.005 threshold) -- same root cause as entry 4 (pinned Docker WebKit test image lacks Georgia/Noto Serif, falls to Liberation Serif fallback tier); Chromium passes cleanly (0.0096 worst case after fixing a centering bug that used a font-relative ch unit with margin:auto). Non-blocking per human_verify_mode:end-of-phase; same real-Safari spot-check as entry 4 covers this.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T01:20:11.946Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/changelog.html",
    "line": null,
    "description": "Chromium reports native CLS 0.0125 (vs 0.005 threshold) on changelog.html @320px font swap, but this project's own geometry-based instrument (the primary, engine-independent D-08 measurement) reports geometryScore 0 for the same swap, and a direct check confirmed zero elements moved within the visible viewport -- all reflow is below the fold. WebKit passes cleanly on the same page. Investigated with layout-shift source attribution, which showed unchanged before/after rects for the reported sources, consistent with a Chromium native-CLS attribution quirk on text-dense pages rather than a real user-visible shift. No CSS bug found (line-heights, margins and centering all checked) and no threshold weakened. Flagged for owner judgement per human_verify_mode:end-of-phase.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T01:20:12.039Z",
    "resolved_at": "2026-09-17T06:32:42.431Z"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/font-cls.spec.ts",
    "line": null,
    "description": "01-09's full swap matrix (scroll=top/mid, variant=full/size-adjust-only, fallback=Noto Serif/Times New Roman) shows real, substantial font-swap CLS on ALL FIVE mockup pages, in BOTH Chromium (native) and WebKit -- not a Docker-missing-font-specific problem: entries 4/5's root cause (Docker lacking Georgia/Noto Serif) is real but incomplete. Georgia is unavailable via local() in native Chromium on this machine too (confirmed via document.fonts.load, contradicting fc-match's own unrelated Gelasio substitution); and the SAME corrected Times-New-Roman/Liberation-Serif tier, when forced in native Chromium (not just Docker WebKit), shows comparable-magnitude CLS once scroll=mid is measured (e.g. index.html: Chromium geometryScore up to 0.70, WebKit up to 1.19). variant=size-adjust-only vs full show near-identical magnitudes, ruling out the ascent/descent/line-gap overrides as the primary driver. Root cause: capsize's size-adjust is a single average-character-width scale factor: it cannot guarantee identical per-line word-wrap points between two visually distinct typefaces, so real reflow remains once you look below the initial viewport (scroll=mid, never tested before this plan). This is inherent to the font-substitution strategy, not a CSS bug -- no fix attempted (font-display:swap is a locked PRD Section 6.5 decision; changing it would be architectural, Rule 4). Flagged for owner judgement.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T06:32:55.674Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/changelog.html",
    "line": null,
    "description": "Supersedes entry 6's conclusion. 01-09 investigated the instrument itself per this plan's own instruction rather than trusting the prior 'Chromium native-CLS attribution quirk' dismissal, and found a real bug in the geometry instrument (design/tests/support/geometry.ts's snapshotLayout): it measured each candidate element's single getBoundingClientRect() envelope, not per-rendered-line getClientRects() fragments -- so a multi-line-wrapping inline element (changelog.html's [data-item-sentence] spans, several sentences long) could have individual LINES reflow onto different positions after a font swap while the element's overall envelope stayed nearly unchanged, hiding real shift from the geometry score entirely (matching a failure mode this project's own focus.ts already documented for wrapped focus rings in 01-08). Fixed (Rule 1) to compare per-fragment rects, the same standard 01-08 established. After the fix, changelog.html@320px/top/full/Noto-Serif now measures geometryScore 0.0068 (previously 0.0000) against native CLS 0.0125 -- both now agree this is a real violation of the 0.005 threshold, not an attribution quirk to dismiss. A residual gap between geometry (0.0068) and native (0.0125) remains, most likely finer-than-line-fragment paint-box granularity in the browser's own native measurement; not further chased given time cost and that both signals already agree on the qualitative conclusion. Folds into entry 7's broader finding -- flagged for owner judgement, no threshold weakened.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T06:33:06.507Z",
    "resolved_at": null
  }
]
````

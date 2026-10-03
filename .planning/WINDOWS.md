---
schema_version: 1
open_count: 14
waived_count: 0
fixed_count: 13
total_count: 27
last_updated: 2026-10-01T21:39:54.964Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | design/tests/support/geometry.ts |  | UPDATED by 01-09: the original "never composites, regardless of hold duration" claim was based on a single page/scenario and is not universal. 01-09's full swap matrix shows prePaintObserved:false (WebKit-Docker never paints a pre-swap frame) specifically on category.html@320px, changelog.html and contact.html, but prePaintObserved:true (it does composite and geometryScore is real, non-zero) on index.html, article.html and category.html@1280px -- page-dependent, not a blanket engine limitation. measureFontSwap still reports the flag honestly either way. Not independently confirmable against real Safari on this Arch Linux machine. Spot-check before 01-APPROVAL.md sign-off. | open |  | 2026-09-16T19:32:05.866Z |  |
| 2 | 01 | deviation | design/palette/photo-sources.json |  | politics' photo is Santa Fe NM dusk sky, not literally the Franklin Mountains/El Paso skyline the subject names -- flagged for owner review before 01-APPROVAL.md | open |  | 2026-09-16T20:48:47.479Z |  |
| 3 | 01 | deviation | design/evidence/palette.md |  | UPDATED by 01-16 (D-GAP-C): Sports (49.4deg) was accepted by the owner in round-1 review in their own words ("sports is more redish, thats ok" -- 01-APPROVAL.md). Business (formerly 94.5deg, marigold-sourced) was re-sampled from a new photo (the neon sign of the real "Kentucky Club & Grill" bar in Ciudad Juárez) and now sits at 152.1deg, outside the 40-100deg amber/olive band entirely -- it no longer reads as brown by construction, not by owner acceptance of a borderline colour. | fixed |  | 2026-09-16T20:48:47.571Z | 2026-09-17T21:14:35.114Z |
| 4 | 01 | deviation | design/tests/font-cls.spec.ts |  | WebKit font-swap CLS gate fails on index.html/category.html (geometryScore up to 0.76 vs 0.005 threshold) — root-caused to the pinned Docker WebKit test image lacking Georgia/Noto Serif (only Liberation family installed per fc-list), forcing the worst-compatible fallback tier; Chromium passes cleanly. Non-blocking per human_verify_mode:end-of-phase; needs real-Safari spot-check before 01-APPROVAL.md. | fixed |  | 2026-09-17T00:46:16.920Z | 2026-09-17T18:31:44.285Z |
| 5 | 01 | deviation | design/mockups/article.html |  | WebKit font-swap CLS gate fails on article.html (geometryScore 0.143 @320px vs 0.005 threshold) -- same root cause as entry 4 (pinned Docker WebKit test image lacks Georgia/Noto Serif, falls to Liberation Serif fallback tier); Chromium passes cleanly (0.0096 worst case after fixing a centering bug that used a font-relative ch unit with margin:auto). Non-blocking per human_verify_mode:end-of-phase; same real-Safari spot-check as entry 4 covers this. | fixed |  | 2026-09-17T01:20:11.946Z | 2026-09-17T18:31:44.383Z |
| 6 | 01 | deviation | design/mockups/changelog.html |  | Chromium reports native CLS 0.0125 (vs 0.005 threshold) on changelog.html @320px font swap, but this project's own geometry-based instrument (the primary, engine-independent D-08 measurement) reports geometryScore 0 for the same swap, and a direct check confirmed zero elements moved within the visible viewport -- all reflow is below the fold. WebKit passes cleanly on the same page. Investigated with layout-shift source attribution, which showed unchanged before/after rects for the reported sources, consistent with a Chromium native-CLS attribution quirk on text-dense pages rather than a real user-visible shift. No CSS bug found (line-heights, margins and centering all checked) and no threshold weakened. Flagged for owner judgement per human_verify_mode:end-of-phase. | fixed |  | 2026-09-17T01:20:12.039Z | 2026-09-17T06:32:42.431Z |
| 7 | 01 | deviation | design/tests/font-cls.spec.ts |  | 01-09's full swap matrix (scroll=top/mid, variant=full/size-adjust-only, fallback=Noto Serif/Times New Roman) shows real, substantial font-swap CLS on ALL FIVE mockup pages, in BOTH Chromium (native) and WebKit -- not a Docker-missing-font-specific problem: entries 4/5's root cause (Docker lacking Georgia/Noto Serif) is real but incomplete. Georgia is unavailable via local() in native Chromium on this machine too (confirmed via document.fonts.load, contradicting fc-match's own unrelated Gelasio substitution); and the SAME corrected Times-New-Roman/Liberation-Serif tier, when forced in native Chromium (not just Docker WebKit), shows comparable-magnitude CLS once scroll=mid is measured (e.g. index.html: Chromium geometryScore up to 0.70, WebKit up to 1.19). variant=size-adjust-only vs full show near-identical magnitudes, ruling out the ascent/descent/line-gap overrides as the primary driver. Root cause: capsize's size-adjust is a single average-character-width scale factor: it cannot guarantee identical per-line word-wrap points between two visually distinct typefaces, so real reflow remains once you look below the initial viewport (scroll=mid, never tested before this plan). This is inherent to the font-substitution strategy, not a CSS bug -- no fix attempted (font-display:swap is a locked PRD Section 6.5 decision; changing it would be architectural, Rule 4). Flagged for owner judgement. | fixed |  | 2026-09-17T06:32:55.674Z | 2026-09-17T18:31:44.478Z |
| 8 | 01 | deviation | design/mockups/changelog.html |  | Supersedes entry 6's conclusion. 01-09 investigated the instrument itself per this plan's own instruction rather than trusting the prior 'Chromium native-CLS attribution quirk' dismissal, and found a real bug in the geometry instrument (design/tests/support/geometry.ts's snapshotLayout): it measured each candidate element's single getBoundingClientRect() envelope, not per-rendered-line getClientRects() fragments -- so a multi-line-wrapping inline element (changelog.html's [data-item-sentence] spans, several sentences long) could have individual LINES reflow onto different positions after a font swap while the element's overall envelope stayed nearly unchanged, hiding real shift from the geometry score entirely (matching a failure mode this project's own focus.ts already documented for wrapped focus rings in 01-08). Fixed (Rule 1) to compare per-fragment rects, the same standard 01-08 established. After the fix, changelog.html@320px/top/full/Noto-Serif now measures geometryScore 0.0068 (previously 0.0000) against native CLS 0.0125 -- both now agree this is a real violation of the 0.005 threshold, not an attribution quirk to dismiss. A residual gap between geometry (0.0068) and native (0.0125) remains, most likely finer-than-line-fragment paint-box granularity in the browser's own native measurement; not further chased given time cost and that both signals already agree on the qualitative conclusion. Folds into entry 7's broader finding -- flagged for owner judgement, no threshold weakened. | fixed |  | 2026-09-17T06:33:06.507Z | 2026-09-17T18:31:44.575Z |
| 9 | 01 | deviation | design/scripts/build-fonts.mjs |  | 01-13 Task 1: font-display:optional switch does NOT prevent late font swaps in Chromium -- a clean, single-navigation, no-JS-API reproduction (network hold released on already-painted text, with AND without link rel=preload) shows Chromium applies a delayed optional webfont to already-painted text, a real passively-observable layout shift indistinguishable from font-display:swap once the resource is slow but does not fail. WebKit (Playwright 26.6) correctly keeps the fallback for the whole view in the same scenario (clean fallback-kept classification, geometryScore 0.0000 across the index matrix). This measurably contradicts 01-APPROVAL.md option C's stated rationale ('eliminates swap-triggered CLS entirely') for Chromium. Task 1's own instrument (fonts-in-use.ts, geometry.ts pathObserved classification, layoutsMatch) is built and validated correct via the WebKit control; Tasks 2-3 (full matrix, positive control, PRD amendment, ledger closure) are paused pending an owner decision on how to proceed given this finding. | fixed |  | 2026-09-17T17:20:53.230Z | 2026-09-17T18:11:56.906Z |
| 10 | 01 | deviation | design/tests/support/geometry.ts |  | 01-13 Task 1 DIAGNOSIS (continuation, owner directive: diagnose). Refines/confirms entry 9's finding with a bisected, deterministic minimal reproduction — the cause is genuine Chromium behavior, not the test harness or a race. Method: an independent orchestrator repro of a single isolated element/font did NOT reproduce a swap (font-display:optional behaved per spec: hold 3000/300/50ms all correctly kept the fallback with no preload, or correctly adopted the webfont only when FCP had not yet occurred, matching spec). Growing the repro toward the real index.html page (5 rounds, hold swept 50-3000ms, scroll top vs mid, both scripted under design/.cache/, not committed) found: document.fonts status for the primary Instrument Serif and Source Serif 4 FontFace objects transitions to loaded and IS applied by Chromium in every tested case, regardless of scroll position or how long the font resource was held (identical outcome at 50ms and 3000ms) -- i.e. Chromium's optional does not enforce a hard commit-to-fallback-forever cutoff once the block period elapses; it applies the font on the next reflow whenever the resource finishes, indistinguishable from font-display:swap once a load is genuinely slow. This reflow is real and document-wide (confirmed via forced getClientRects() layout snapshots showing off-screen paragraph height deltas even with no scrolling), but its IMPACT AREA is correctly viewport-clipped by this project's own CLS-style geometryScore (matching the W3C Layout Instability API's own convention) -- so scroll=top shows score 0 only because the affected paragraphs' cascading word-wrap height deltas (the pre-existing, already-documented entries-7/8 capsize size-adjust word-wrap defect) land below the 900px viewport at that scroll position, while scroll=mid's viewport happens to sit inside the accumulated shift. Scroll is therefore not the cause, only the measurement vantage point that reveals a shift that is always occurring. WebKit (Playwright 26.6) does not exhibit this because it correctly commits to the fallback forever once the block period elapses (or never composites before it, entry 1), unlike Chromium. CONCLUSION: this is genuine Chromium non-compliant behavior under a condition real pages will hit (any user on a connection slow enough that a preloaded optional face misses the ~100ms block period, then later loads and triggers ANY subsequent reflow/paint -- scrolling is the most common trigger but not the only one). Per owner instruction, strategy is NOT changed unilaterally; Tasks 2-3 of 01-13 remain paused pending owner decision. Minimal reproduction scripts: design/.cache/optional-probe.mjs (owner's original isolated-element repro, does not show the effect) and design/.cache/optional-scroll-probe.mjs (2-element top/below-fold repro, also does not show it at hold>=400ms -- the effect requires the real page's paragraph-wrapping content, not a single short text run) -- the decisive repro is the real design/mockups/index.html page itself, run via the ad hoc diagnostic spec (not committed) with holdFonts()/snapshotLayout() from geometry.ts, at 320px, hold 50-3000ms, scroll top and mid, reading document.fonts statuses and forced layout snapshots before/after release. | fixed |  | 2026-09-17T17:44:24.094Z | 2026-09-17T18:11:48.398Z |
| 11 | 01 | deviation | design/scripts/pw.mjs |  | 01-13 Task 1 CORRECTION (supersedes entries 9 and 10, both now marked fixed as refuted misdiagnoses). The coordinator ran an independent, more rigorous reproduction (design/.cache/reflow-probe.mjs, run in bundled Chromium AND real Chrome 153: held font, released, then scroll + forced reflow + a brand-new same-family span) and found NO font swap at all under font-display:optional once FCP has occurred, in either browser -- directly contradicting entry 10's claim. Re-investigating with the authoritative CDP CSS.getPlatformFontsForNode call (which reports the actual rendered font, unlike document.fonts status, which can read loaded while a different font is still painted) confirmed the coordinator's finding was right and entries 9/10 were wrong: on this specific development machine, fc-list/fc-match show Instrument Serif and Source Serif 4 -- this project's own primary webfont family names -- installed as LOCAL user fonts under ~/.local/share/fonts (leftover from earlier design work), separate from the project's own @font-face declarations. A locally-installed font sharing the exact family name of a held/pending @font-face causes Chromium's font-display:optional implementation to behave like swap (verified via getPlatformFontsForNode: the rendered font visibly changes after release, matching entry 9/10's symptom) -- but ONLY when that local name collision exists. Bisection proof: the identical SourceSerif4-Roman.woff2 file, held and released identically, shows NO change when declared under a made-up family name (W, no local collision) but DOES swap when declared as Instrument Serif (a real local collision) -- confirmed with a minimal 2-line CSS change toggling the outcome. Isolating the browser font-config environment (overriding XDG_DATA_HOME to an empty, project-local directory for native/non-Docker Playwright launches, leaving HOME and all system font directories under /usr/share/fonts untouched) eliminates the swap entirely, confirmed via CDP: rendered font stays the fallback both before and after release, matching the coordinator reflow-probe result. This was a TEST-ENVIRONMENT contamination bug, not a Chromium engine defect and not a page/CSS bug. FIXED (Rule 1) in design/scripts/pw.mjs: both native Chromium and native-mode WebKit launches now pass XDG_DATA_HOME pointing at design/.cache/fontconfig-isolated-xdg-data-home (auto-created, gitignored) to the spawned Playwright test-runner process, isolating font-family matching from this host user-level font installs while preserving system-level fallback fonts (Noto Serif, Times New Roman/Liberation Serif, Georgia when present) the fallback matrix depends on. Docker WebKit was already isolated (HOME=/tmp inside the container) and needed no change. Re-run of MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/font-cls.spec.ts now passes cleanly and repeatably (3 consecutive full runs, both engines): every index row classifies pathObserved=fallback-kept, prePaintObserved=true, fontDisplay=optional -- font-display:optional works as intended in Chromium once the test host font contamination is removed. | fixed |  | 2026-09-17T18:12:32.341Z | 2026-09-17T18:12:44.468Z |
| 12 | 01 | deviation | design/mockups/style.css |  | 01-13 Task 1: a second, unrelated, real native-CLS bug surfaced by the same investigation, found while getting the referenceNativeCls check (this plan Task 1 own addition) to pass honestly after entry 11 fixed the swap misdiagnosis. Chromium native CLS on a completely UNTHROTTLED reference load (index.html, no font hold at all) intermittently exceeded the 0.005 threshold (0.038-0.042) at both 320px and 1280px. Bisected with layout-shift source attribution (main pushed down by 58-65px, 60-70ms after navigation) and confirmed with a fonts-free control (the entire fonts:start/fonts:end region replaced with plain serif, zero @font-face rules at all) that STILL reproduced the identical shift -- proving fonts, font-display, and this whole D-GAP-A investigation are unrelated to this bug. Root cause: index.html (line 69) has a button[data-theme-toggle hidden] revealed by JS (toggle.hidden = false) on DOMContentLoaded; style.css previously mapped [data-theme-toggle][hidden] to display:none, so the button occupied zero layout space until JS removed the hidden attribute, at which point its box (padding+margin+content) appeared for the first time and pushed nav/main down by its own height -- a plain progressive-enhancement CLS bug, invisible to every earlier test in this project because all prior font-swap measurements only observed native CLS starting well after DOMContentLoaded (after the artificial font hold/release sequence), and no prior test measured native CLS from true navigation start on an unthrottled load until this task added referenceNativeCls. FIXED (Rule 1) in design/mockups/style.css: [data-theme-toggle][hidden] now uses display:inline-block; visibility:hidden; pointer-events:none instead of display:none, reserving the identical box before JS reveals it (visibility:hidden is equivalent to display:none for accessibility tree/tab order purposes, so no a11y regression). Verified with 5/5 clean runs of the fonts-free control and 3/3 clean full font-cls.spec.ts runs (both engines) after the fix, with zero threshold changes. | fixed |  | 2026-09-17T18:12:57.069Z | 2026-09-17T18:13:05.444Z |
| 13 | 01 | deviation | design/mockups/article.html |  | 01-13 Tasks 2-3: discovered while fixing entry 11/getting the new referenceNativeCls and Spanish-width guards to pass honestly. article.html (data-standfirst], the prominent above-the-fold standfirst deck) is set in italic Instrument Serif, but D-GAP-A preloads exactly two resources -- InstrumentSerif-Regular.woff2 and SourceSerif4-Roman.woff2 -- both font-style normal; InstrumentSerif-Italic.woff2 is not preloaded. Confirmed deterministic (not a timing flake: an explicit extra 2s wait before checking does not change the outcome, and it reproduces identically in both Chromium and WebKit): under font-display optional, the italic face consistently misses the very short block period on every load tested, held or not, because nothing accelerates its fetch start the way preload does for the other two -- so in practice the standfirst deck almost always renders in its metric-compatible fallback, not Instrument Serif Italic, even on a plain, unthrottled load. This is a real, permanent, content-visible consequence of the fixed 2-preload D-GAP-A scope (Task 1s own acceptance criteria require exactly 2 preloads per page), not a bug in the harness -- the size-adjust metric-compatible fallback should look acceptably close, but the intended italic display face is not what most readers will actually see for that element. Worked around narrowly in this plans own new checks (geometry.ts measureReferenceLoad, i18n.ts widthRatio) by scoping their prove-the-webfont-is-in-use guard to font-style normal only, since italic can never satisfy that guard under the current preload scope and enforcing it there would make every measurement of that element throw unconditionally rather than catching a genuine silent-fallback risk. Flagged for owner judgement: either accept the italic fallback as the de facto standfirst display face, or add a third preload for the italic weight actually used above the fold (an architectural/PRD-scope change, Rule 4, not applied here). UPDATED by 01-14: D-GAP-B (this plan, Task 1) moves article.html's [data-standfirst] deck off Instrument Serif entirely -- it now renders font-family: var(--font-body) (Source Serif 4), italic, weight 400, never Instrument Serif. Instrument Serif Italic is retired outright (Task 3): no longer subsetted, built, referenced in style.css, or tracked in git (git rm --cached; the file stays on disk). The original claim ("set in italic Instrument Serif") is now factually superseded and this entry's file/font-name framing is stale. The underlying risk this entry named -- an italic face that is not among D-GAP-A's two preloaded resources (still exactly InstrumentSerif-Regular.woff2 and SourceSerif4-Roman.woff2, both font-style normal) likely misses the short optional block period and renders in its fallback -- still applies in kind, now to Source Serif 4 Italic (weight 400) rather than Instrument Serif Italic. Source Serif 4 Italic shrank substantially in this same plan (91,096 -> 20,216 bytes, Task 3), which should narrow but not eliminate the window, since a non-preloaded resource's fetch start is unaffected by its own size. Not re-measured against the smaller file here -- Task 3's own verification targeted the coverage (font-cls.spec.ts) and CLS (criterion 5) gates, not a fresh preload-timing measurement of the standfirst specifically -- left open for whoever next touches D-GAP-A/preload scope or the standfirst treatment to measure the smaller file's actual pathObserved rate, or make the same accept-fallback-vs-add-a-third-preload call 01-13 already flagged. | open |  | 2026-09-17T18:32:05.084Z |  |
| 14 | 01 | deviation | design/tests/spanish-overflow.spec.ts |  | 01-15: fixed container-growth heuristic false positive from headline hyphens:auto engaging on lang=es injection — vClipped remains authoritative, no threshold weakened | fixed |  | 2026-09-17T20:43:10.476Z | 2026-09-17T20:43:14.594Z |
| 15 | 01 | deviation | design/scripts/calibrate-spanish.mjs |  | 01-15: 100px calibration proxy under-predicted real in-page ratio for short strings at small UI sizes; added dense 12-58px sweep to widen hi (9/22 components widened) | fixed |  | 2026-09-17T20:43:10.568Z | 2026-09-17T20:43:14.690Z |
| 16 | 01 | unrun-verify | design/mockups/category.html |  | 01-18 Task 3 human-check outstanding: owner must view category.html with real network access at 1280px light/dark to confirm the lead's loaded KTSM photo sits comfortably beside the text column (tests block third-party requests, so this was never automatable) | open |  | 2026-09-17T22:14:16.814Z |  |
| 17 | 02 | todo | 915tldr.com2/server/utils/queue-processor.ts |  | Queue-mode consumer (disabled by default) still uses old concatenated-summary shape and has no grounding gate — needs reconciling with 02-04's changes before queue mode is ever enabled | open |  | 2026-09-20T01:05:59.110Z |  |
| 18 | 02 | todo | 915tldr.com/.planning/phases/02-content-quality-grounding/02-04-PLAN.md |  | CONT-01 corpus-level truncation-marker validation (near-zero on newly ingested articles) is proven only for n=1 in this tracer; full validation deferred to plan 02-05+ | fixed |  | 2026-09-20T01:05:59.206Z | 2026-09-20T02:08:18.708Z |
| 19 | 02 | unmet-truth | 915tldr.com2/docs/phase-02/extraction-sample.md |  | CONT-01 validated at 0% on 112 real, network-fetched articles (El Paso Matters + KVIA), but corpus-wide bar not met (35/162 = 21.6% blended) because KTSM's canonical fetch is 100% network-blocked (50/50, PerimeterX, confirmed at scale — not a one-off). CONT-01 left PENDING pending the KTSM block's resolution or a future production deploy/re-measurement. | open |  | 2026-09-20T02:08:25.116Z |  |
| 20 | 02 | deviation | 915tldr.com2/server/utils/ai-processor.ts |  | 02-08 Task 3 (D-09 live gating: retry-once-then-hold, grounding_status='held', review queue admin route) is DEFERRED to a later plan — owner decision 2026-09-19 (Option D), made after calibration (Task 2) found the full-cascade false-positive rate at ~88-90% against genuinely faithful known-good production summaries (see 915tldr.com2/docs/phase-02/grounding-calibration.md). Unblocked by: a small batch of articles processed under the 02-06 prompt, measured against this same cascade, showing the rate at or near the 15% D-09 target ceiling. | open |  | 2026-09-20T04:19:30.695Z |  |
| 21 | 02 | unmet-truth | 915tldr.com2/docs/phase-02/september-backfill-run-manifest.json |  | September backfill final: of 873 held rows (post attribution-wrapper-fix, post rejudge-held), 155 (17.8%) have source content under 120 chars — a truncated feed teaser genuinely too thin to summarise faithfully, not a judge false positive. By source: KVIA 475, KTSM 389, El Paso Matters 9. Two examples sampled by the owner as genuinely off-topic/unusable source material remain held: id 38769 (Spanish-language Markey/Moulton Massachusetts-politics article, unrelated to El Paso) and id 38830 (hotel-loyalty listicle whose own source text is truncated mid-sentence, 'The article ends during the Best Western section'). These are the gate working correctly on unusable input, not a defect to fix — recorded per plan instruction to quantify and not fix. | open |  | 2026-09-21T08:05:04.788Z |  |
| 22 | 02 | deviation | 915tldr.com2/scripts/september-backfill-execute.mjs |  | manifest.actualCostUsd/estimatedJudgeCostUsd only reflect the LAST completing invocation's judge-call fraction (judgeCallCount is scoped per-invocation, not accumulated across resumes), so the manifest's own reported $4.9932 understates true cumulative spend across a run resumed 4 times (original pass, --rejudge-held, a crashed resume, and the final completing resume). True total estimated spend, computed by hand from the full call count (2703 first-pass + 149 rejudge = 2852 judge calls at $0.0015983/call, plus $1.3465 real batch cost): approximately $5.90 — still well inside the $10.42 ceiling, but the manifest field itself should not be trusted as the authoritative total for a multi-invocation run without this correction. Not fixed in this session (out of scope, cost was within ceiling either way) — flagged for whoever next touches this script's cost accounting. | open |  | 2026-09-21T08:05:13.681Z |  |
| 23 | 02 | deviation | 915tldr.com2/server/utils/grounding-check.ts |  | CONT-06 gap closure (02-VERIFICATION.md gap 1, found by /gsd-verify-work 2026-09-21): 253/1,830 (13.8%) of the September backfill's clean rows had LENGTH(summary) > LENGTH(content) because the D-07 attribution wrapper counted toward the length ceiling and the 02-08 Option C decoupling let a clean judge verdict clear a length violation the judge never evaluates. FIXED: stripAttributionWrapper() (text-metrics.ts) excludes the wrapper from the length comparison; checkGrounding() carves the length flag out of Option C as an independent hard gate (grounding-check.ts, commit d77e7ef, 915tldr.com2). REMEDIATED: scripts/cont06-remediate.mjs re-evaluated all 253 rows against production D1 (149 real judge calls, ~$0.22-0.44) -- 113 cleared, 140 held with summary/key_points cleared to NULL (commit 579085f, 915tldr.com2). Verified: raw LENGTH(summary)>LENGTH(content) query now returns 113 (all attribution-wrapper cases, by design -- see next entry), and a wrapper-aware query mirroring the code's actual gate returns 0. Calibration recall held 7/7. Full suite 260/260, typecheck (pre-existing unrelated failure only), lint (0 errors) all pass. | open |  | 2026-09-21T16:04:08.654Z |  |
| 24 | 02 | unmet-truth | 915tldr.com2/server/utils/text-metrics.ts |  | The RAW production query 'SELECT COUNT(*) FROM articles WHERE ... LENGTH(summary) > LENGTH(content)' (used verbatim in 02-VERIFICATION.md and matching roadmap SC1 clause 2's literal wording) still returns 113, not 0, after the CONT-06 fix (see prior entry) -- BY DESIGN, not a residual defect. All 113 rows are exactly the cases where the required D-07 attribution wrapper text ('According to <outlet>, ') itself accounts for the entire excess (confirmed: 0 of the 113 fail to match the wrapper pattern). The code's actual CONT-06 gate (grounding-check.ts) correctly excludes this wrapper via stripAttributionWrapper() and measures 0 violations. Whoever next re-runs the literal roadmap SC1 raw-SQL check will see a nonzero number and should use the wrapper-aware query instead (documented in 02-11-SUMMARY.md), or the roadmap's own success-criterion wording should be updated to state the wrapper-aware definition explicitly so this is not re-investigated from scratch. | open |  | 2026-09-21T16:04:15.933Z |  |
| 25 | 04 | unmet-truth | astro.config.mjs |  | SEO-04 sitemap ordering-determinism was not verified across two separate builds (@astrojs/sitemap documents no stable ordering guarantee); single-build correctness (URL count, no leaked non-HTML/404 URLs) was proven instead. | open |  | 2026-09-27T15:56:27.187Z |  |
| 26 | 05 | unmet-truth | src/worker.ts |  | ARCH-08 CPU-max: a single real request in the 05-12 gate window (2026-10-01T20:34:05.536Z-21:16:29.049Z) measured 49.966ms Worker CPU, over the 20ms hard-fail ceiling, even though p50 (0.764ms) and p99 (2.846ms) are comfortably within the 5ms budget. Disclosed in docs/phase-05/zero-reads-gate.md Result section; not investigated further (out of scope for this plan); tracked for /gsd-verify-work. | open |  | 2026-10-01T21:39:46.909Z |  |
| 27 | 05 | unmet-truth | docs/phase-05/archive-latency.md |  | Criterion 2 (05-11): canonical lab-LCP measurement reports R2_LATENCY_EXCEEDS_LCP -- archived-article p95 LCP 1,788ms vs the 1,500ms budget. The archive tier's own R2/KV cost is small and not the cause (p95 172ms/155ms); hot pages also sit close to the 1.5s line in this lab proxy (p95 1,484ms), pointing at general page-weight/render cost, not the archive-serving mechanism. Flagged for owner review before Phase 11's real field-LCP release gate; does not block Phase 5 completion (05-12). | open |  | 2026-10-01T21:39:54.964Z |  |

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
    "description": "UPDATED by 01-16 (D-GAP-C): Sports (49.4deg) was accepted by the owner in round-1 review in their own words (\"sports is more redish, thats ok\" -- 01-APPROVAL.md). Business (formerly 94.5deg, marigold-sourced) was re-sampled from a new photo (the neon sign of the real \"Kentucky Club & Grill\" bar in Ciudad Juárez) and now sits at 152.1deg, outside the 40-100deg amber/olive band entirely -- it no longer reads as brown by construction, not by owner acceptance of a borderline colour.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-16T20:48:47.571Z",
    "resolved_at": "2026-09-17T21:14:35.114Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/font-cls.spec.ts",
    "line": null,
    "description": "WebKit font-swap CLS gate fails on index.html/category.html (geometryScore up to 0.76 vs 0.005 threshold) — root-caused to the pinned Docker WebKit test image lacking Georgia/Noto Serif (only Liberation family installed per fc-list), forcing the worst-compatible fallback tier; Chromium passes cleanly. Non-blocking per human_verify_mode:end-of-phase; needs real-Safari spot-check before 01-APPROVAL.md.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T00:46:16.920Z",
    "resolved_at": "2026-09-17T18:31:44.285Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/article.html",
    "line": null,
    "description": "WebKit font-swap CLS gate fails on article.html (geometryScore 0.143 @320px vs 0.005 threshold) -- same root cause as entry 4 (pinned Docker WebKit test image lacks Georgia/Noto Serif, falls to Liberation Serif fallback tier); Chromium passes cleanly (0.0096 worst case after fixing a centering bug that used a font-relative ch unit with margin:auto). Non-blocking per human_verify_mode:end-of-phase; same real-Safari spot-check as entry 4 covers this.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T01:20:11.946Z",
    "resolved_at": "2026-09-17T18:31:44.383Z"
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T06:32:55.674Z",
    "resolved_at": "2026-09-17T18:31:44.478Z"
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/changelog.html",
    "line": null,
    "description": "Supersedes entry 6's conclusion. 01-09 investigated the instrument itself per this plan's own instruction rather than trusting the prior 'Chromium native-CLS attribution quirk' dismissal, and found a real bug in the geometry instrument (design/tests/support/geometry.ts's snapshotLayout): it measured each candidate element's single getBoundingClientRect() envelope, not per-rendered-line getClientRects() fragments -- so a multi-line-wrapping inline element (changelog.html's [data-item-sentence] spans, several sentences long) could have individual LINES reflow onto different positions after a font swap while the element's overall envelope stayed nearly unchanged, hiding real shift from the geometry score entirely (matching a failure mode this project's own focus.ts already documented for wrapped focus rings in 01-08). Fixed (Rule 1) to compare per-fragment rects, the same standard 01-08 established. After the fix, changelog.html@320px/top/full/Noto-Serif now measures geometryScore 0.0068 (previously 0.0000) against native CLS 0.0125 -- both now agree this is a real violation of the 0.005 threshold, not an attribution quirk to dismiss. A residual gap between geometry (0.0068) and native (0.0125) remains, most likely finer-than-line-fragment paint-box granularity in the browser's own native measurement; not further chased given time cost and that both signals already agree on the qualitative conclusion. Folds into entry 7's broader finding -- flagged for owner judgement, no threshold weakened.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T06:33:06.507Z",
    "resolved_at": "2026-09-17T18:31:44.575Z"
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "01",
    "file": "design/scripts/build-fonts.mjs",
    "line": null,
    "description": "01-13 Task 1: font-display:optional switch does NOT prevent late font swaps in Chromium -- a clean, single-navigation, no-JS-API reproduction (network hold released on already-painted text, with AND without link rel=preload) shows Chromium applies a delayed optional webfont to already-painted text, a real passively-observable layout shift indistinguishable from font-display:swap once the resource is slow but does not fail. WebKit (Playwright 26.6) correctly keeps the fallback for the whole view in the same scenario (clean fallback-kept classification, geometryScore 0.0000 across the index matrix). This measurably contradicts 01-APPROVAL.md option C's stated rationale ('eliminates swap-triggered CLS entirely') for Chromium. Task 1's own instrument (fonts-in-use.ts, geometry.ts pathObserved classification, layoutsMatch) is built and validated correct via the WebKit control; Tasks 2-3 (full matrix, positive control, PRD amendment, ledger closure) are paused pending an owner decision on how to proceed given this finding.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T17:20:53.230Z",
    "resolved_at": "2026-09-17T18:11:56.906Z"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/support/geometry.ts",
    "line": null,
    "description": "01-13 Task 1 DIAGNOSIS (continuation, owner directive: diagnose). Refines/confirms entry 9's finding with a bisected, deterministic minimal reproduction — the cause is genuine Chromium behavior, not the test harness or a race. Method: an independent orchestrator repro of a single isolated element/font did NOT reproduce a swap (font-display:optional behaved per spec: hold 3000/300/50ms all correctly kept the fallback with no preload, or correctly adopted the webfont only when FCP had not yet occurred, matching spec). Growing the repro toward the real index.html page (5 rounds, hold swept 50-3000ms, scroll top vs mid, both scripted under design/.cache/, not committed) found: document.fonts status for the primary Instrument Serif and Source Serif 4 FontFace objects transitions to loaded and IS applied by Chromium in every tested case, regardless of scroll position or how long the font resource was held (identical outcome at 50ms and 3000ms) -- i.e. Chromium's optional does not enforce a hard commit-to-fallback-forever cutoff once the block period elapses; it applies the font on the next reflow whenever the resource finishes, indistinguishable from font-display:swap once a load is genuinely slow. This reflow is real and document-wide (confirmed via forced getClientRects() layout snapshots showing off-screen paragraph height deltas even with no scrolling), but its IMPACT AREA is correctly viewport-clipped by this project's own CLS-style geometryScore (matching the W3C Layout Instability API's own convention) -- so scroll=top shows score 0 only because the affected paragraphs' cascading word-wrap height deltas (the pre-existing, already-documented entries-7/8 capsize size-adjust word-wrap defect) land below the 900px viewport at that scroll position, while scroll=mid's viewport happens to sit inside the accumulated shift. Scroll is therefore not the cause, only the measurement vantage point that reveals a shift that is always occurring. WebKit (Playwright 26.6) does not exhibit this because it correctly commits to the fallback forever once the block period elapses (or never composites before it, entry 1), unlike Chromium. CONCLUSION: this is genuine Chromium non-compliant behavior under a condition real pages will hit (any user on a connection slow enough that a preloaded optional face misses the ~100ms block period, then later loads and triggers ANY subsequent reflow/paint -- scrolling is the most common trigger but not the only one). Per owner instruction, strategy is NOT changed unilaterally; Tasks 2-3 of 01-13 remain paused pending owner decision. Minimal reproduction scripts: design/.cache/optional-probe.mjs (owner's original isolated-element repro, does not show the effect) and design/.cache/optional-scroll-probe.mjs (2-element top/below-fold repro, also does not show it at hold>=400ms -- the effect requires the real page's paragraph-wrapping content, not a single short text run) -- the decisive repro is the real design/mockups/index.html page itself, run via the ad hoc diagnostic spec (not committed) with holdFonts()/snapshotLayout() from geometry.ts, at 320px, hold 50-3000ms, scroll top and mid, reading document.fonts statuses and forced layout snapshots before/after release.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T17:44:24.094Z",
    "resolved_at": "2026-09-17T18:11:48.398Z"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "01",
    "file": "design/scripts/pw.mjs",
    "line": null,
    "description": "01-13 Task 1 CORRECTION (supersedes entries 9 and 10, both now marked fixed as refuted misdiagnoses). The coordinator ran an independent, more rigorous reproduction (design/.cache/reflow-probe.mjs, run in bundled Chromium AND real Chrome 153: held font, released, then scroll + forced reflow + a brand-new same-family span) and found NO font swap at all under font-display:optional once FCP has occurred, in either browser -- directly contradicting entry 10's claim. Re-investigating with the authoritative CDP CSS.getPlatformFontsForNode call (which reports the actual rendered font, unlike document.fonts status, which can read loaded while a different font is still painted) confirmed the coordinator's finding was right and entries 9/10 were wrong: on this specific development machine, fc-list/fc-match show Instrument Serif and Source Serif 4 -- this project's own primary webfont family names -- installed as LOCAL user fonts under ~/.local/share/fonts (leftover from earlier design work), separate from the project's own @font-face declarations. A locally-installed font sharing the exact family name of a held/pending @font-face causes Chromium's font-display:optional implementation to behave like swap (verified via getPlatformFontsForNode: the rendered font visibly changes after release, matching entry 9/10's symptom) -- but ONLY when that local name collision exists. Bisection proof: the identical SourceSerif4-Roman.woff2 file, held and released identically, shows NO change when declared under a made-up family name (W, no local collision) but DOES swap when declared as Instrument Serif (a real local collision) -- confirmed with a minimal 2-line CSS change toggling the outcome. Isolating the browser font-config environment (overriding XDG_DATA_HOME to an empty, project-local directory for native/non-Docker Playwright launches, leaving HOME and all system font directories under /usr/share/fonts untouched) eliminates the swap entirely, confirmed via CDP: rendered font stays the fallback both before and after release, matching the coordinator reflow-probe result. This was a TEST-ENVIRONMENT contamination bug, not a Chromium engine defect and not a page/CSS bug. FIXED (Rule 1) in design/scripts/pw.mjs: both native Chromium and native-mode WebKit launches now pass XDG_DATA_HOME pointing at design/.cache/fontconfig-isolated-xdg-data-home (auto-created, gitignored) to the spawned Playwright test-runner process, isolating font-family matching from this host user-level font installs while preserving system-level fallback fonts (Noto Serif, Times New Roman/Liberation Serif, Georgia when present) the fallback matrix depends on. Docker WebKit was already isolated (HOME=/tmp inside the container) and needed no change. Re-run of MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/font-cls.spec.ts now passes cleanly and repeatably (3 consecutive full runs, both engines): every index row classifies pathObserved=fallback-kept, prePaintObserved=true, fontDisplay=optional -- font-display:optional works as intended in Chromium once the test host font contamination is removed.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T18:12:32.341Z",
    "resolved_at": "2026-09-17T18:12:44.468Z"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/style.css",
    "line": null,
    "description": "01-13 Task 1: a second, unrelated, real native-CLS bug surfaced by the same investigation, found while getting the referenceNativeCls check (this plan Task 1 own addition) to pass honestly after entry 11 fixed the swap misdiagnosis. Chromium native CLS on a completely UNTHROTTLED reference load (index.html, no font hold at all) intermittently exceeded the 0.005 threshold (0.038-0.042) at both 320px and 1280px. Bisected with layout-shift source attribution (main pushed down by 58-65px, 60-70ms after navigation) and confirmed with a fonts-free control (the entire fonts:start/fonts:end region replaced with plain serif, zero @font-face rules at all) that STILL reproduced the identical shift -- proving fonts, font-display, and this whole D-GAP-A investigation are unrelated to this bug. Root cause: index.html (line 69) has a button[data-theme-toggle hidden] revealed by JS (toggle.hidden = false) on DOMContentLoaded; style.css previously mapped [data-theme-toggle][hidden] to display:none, so the button occupied zero layout space until JS removed the hidden attribute, at which point its box (padding+margin+content) appeared for the first time and pushed nav/main down by its own height -- a plain progressive-enhancement CLS bug, invisible to every earlier test in this project because all prior font-swap measurements only observed native CLS starting well after DOMContentLoaded (after the artificial font hold/release sequence), and no prior test measured native CLS from true navigation start on an unthrottled load until this task added referenceNativeCls. FIXED (Rule 1) in design/mockups/style.css: [data-theme-toggle][hidden] now uses display:inline-block; visibility:hidden; pointer-events:none instead of display:none, reserving the identical box before JS reveals it (visibility:hidden is equivalent to display:none for accessibility tree/tab order purposes, so no a11y regression). Verified with 5/5 clean runs of the fonts-free control and 3/3 clean full font-cls.spec.ts runs (both engines) after the fix, with zero threshold changes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T18:12:57.069Z",
    "resolved_at": "2026-09-17T18:13:05.444Z"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "01",
    "file": "design/mockups/article.html",
    "line": null,
    "description": "01-13 Tasks 2-3: discovered while fixing entry 11/getting the new referenceNativeCls and Spanish-width guards to pass honestly. article.html (data-standfirst], the prominent above-the-fold standfirst deck) is set in italic Instrument Serif, but D-GAP-A preloads exactly two resources -- InstrumentSerif-Regular.woff2 and SourceSerif4-Roman.woff2 -- both font-style normal; InstrumentSerif-Italic.woff2 is not preloaded. Confirmed deterministic (not a timing flake: an explicit extra 2s wait before checking does not change the outcome, and it reproduces identically in both Chromium and WebKit): under font-display optional, the italic face consistently misses the very short block period on every load tested, held or not, because nothing accelerates its fetch start the way preload does for the other two -- so in practice the standfirst deck almost always renders in its metric-compatible fallback, not Instrument Serif Italic, even on a plain, unthrottled load. This is a real, permanent, content-visible consequence of the fixed 2-preload D-GAP-A scope (Task 1s own acceptance criteria require exactly 2 preloads per page), not a bug in the harness -- the size-adjust metric-compatible fallback should look acceptably close, but the intended italic display face is not what most readers will actually see for that element. Worked around narrowly in this plans own new checks (geometry.ts measureReferenceLoad, i18n.ts widthRatio) by scoping their prove-the-webfont-is-in-use guard to font-style normal only, since italic can never satisfy that guard under the current preload scope and enforcing it there would make every measurement of that element throw unconditionally rather than catching a genuine silent-fallback risk. Flagged for owner judgement: either accept the italic fallback as the de facto standfirst display face, or add a third preload for the italic weight actually used above the fold (an architectural/PRD-scope change, Rule 4, not applied here). UPDATED by 01-14: D-GAP-B (this plan, Task 1) moves article.html's [data-standfirst] deck off Instrument Serif entirely -- it now renders font-family: var(--font-body) (Source Serif 4), italic, weight 400, never Instrument Serif. Instrument Serif Italic is retired outright (Task 3): no longer subsetted, built, referenced in style.css, or tracked in git (git rm --cached; the file stays on disk). The original claim (\"set in italic Instrument Serif\") is now factually superseded and this entry's file/font-name framing is stale. The underlying risk this entry named -- an italic face that is not among D-GAP-A's two preloaded resources (still exactly InstrumentSerif-Regular.woff2 and SourceSerif4-Roman.woff2, both font-style normal) likely misses the short optional block period and renders in its fallback -- still applies in kind, now to Source Serif 4 Italic (weight 400) rather than Instrument Serif Italic. Source Serif 4 Italic shrank substantially in this same plan (91,096 -> 20,216 bytes, Task 3), which should narrow but not eliminate the window, since a non-preloaded resource's fetch start is unaffected by its own size. Not re-measured against the smaller file here -- Task 3's own verification targeted the coverage (font-cls.spec.ts) and CLS (criterion 5) gates, not a fresh preload-timing measurement of the standfirst specifically -- left open for whoever next touches D-GAP-A/preload scope or the standfirst treatment to measure the smaller file's actual pathObserved rate, or make the same accept-fallback-vs-add-a-third-preload call 01-13 already flagged.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T18:32:05.084Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "01",
    "file": "design/tests/spanish-overflow.spec.ts",
    "line": null,
    "description": "01-15: fixed container-growth heuristic false positive from headline hyphens:auto engaging on lang=es injection — vClipped remains authoritative, no threshold weakened",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T20:43:10.476Z",
    "resolved_at": "2026-09-17T20:43:14.594Z"
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "01",
    "file": "design/scripts/calibrate-spanish.mjs",
    "line": null,
    "description": "01-15: 100px calibration proxy under-predicted real in-page ratio for short strings at small UI sizes; added dense 12-58px sweep to widen hi (9/22 components widened)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-17T20:43:10.568Z",
    "resolved_at": "2026-09-17T20:43:14.690Z"
  },
  {
    "id": 16,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "design/mockups/category.html",
    "line": null,
    "description": "01-18 Task 3 human-check outstanding: owner must view category.html with real network access at 1280px light/dark to confirm the lead's loaded KTSM photo sits comfortably beside the text column (tests block third-party requests, so this was never automatable)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-17T22:14:16.814Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "todo",
    "phase": "02",
    "file": "915tldr.com2/server/utils/queue-processor.ts",
    "line": null,
    "description": "Queue-mode consumer (disabled by default) still uses old concatenated-summary shape and has no grounding gate — needs reconciling with 02-04's changes before queue mode is ever enabled",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T01:05:59.110Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "todo",
    "phase": "02",
    "file": "915tldr.com/.planning/phases/02-content-quality-grounding/02-04-PLAN.md",
    "line": null,
    "description": "CONT-01 corpus-level truncation-marker validation (near-zero on newly ingested articles) is proven only for n=1 in this tracer; full validation deferred to plan 02-05+",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-20T01:05:59.206Z",
    "resolved_at": "2026-09-20T02:08:18.708Z"
  },
  {
    "id": 19,
    "kind": "unmet-truth",
    "phase": "02",
    "file": "915tldr.com2/docs/phase-02/extraction-sample.md",
    "line": null,
    "description": "CONT-01 validated at 0% on 112 real, network-fetched articles (El Paso Matters + KVIA), but corpus-wide bar not met (35/162 = 21.6% blended) because KTSM's canonical fetch is 100% network-blocked (50/50, PerimeterX, confirmed at scale — not a one-off). CONT-01 left PENDING pending the KTSM block's resolution or a future production deploy/re-measurement.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T02:08:25.116Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "02",
    "file": "915tldr.com2/server/utils/ai-processor.ts",
    "line": null,
    "description": "02-08 Task 3 (D-09 live gating: retry-once-then-hold, grounding_status='held', review queue admin route) is DEFERRED to a later plan — owner decision 2026-09-19 (Option D), made after calibration (Task 2) found the full-cascade false-positive rate at ~88-90% against genuinely faithful known-good production summaries (see 915tldr.com2/docs/phase-02/grounding-calibration.md). Unblocked by: a small batch of articles processed under the 02-06 prompt, measured against this same cascade, showing the rate at or near the 15% D-09 target ceiling.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T04:19:30.695Z",
    "resolved_at": null
  },
  {
    "id": 21,
    "kind": "unmet-truth",
    "phase": "02",
    "file": "915tldr.com2/docs/phase-02/september-backfill-run-manifest.json",
    "line": null,
    "description": "September backfill final: of 873 held rows (post attribution-wrapper-fix, post rejudge-held), 155 (17.8%) have source content under 120 chars — a truncated feed teaser genuinely too thin to summarise faithfully, not a judge false positive. By source: KVIA 475, KTSM 389, El Paso Matters 9. Two examples sampled by the owner as genuinely off-topic/unusable source material remain held: id 38769 (Spanish-language Markey/Moulton Massachusetts-politics article, unrelated to El Paso) and id 38830 (hotel-loyalty listicle whose own source text is truncated mid-sentence, 'The article ends during the Best Western section'). These are the gate working correctly on unusable input, not a defect to fix — recorded per plan instruction to quantify and not fix.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T08:05:04.788Z",
    "resolved_at": null
  },
  {
    "id": 22,
    "kind": "deviation",
    "phase": "02",
    "file": "915tldr.com2/scripts/september-backfill-execute.mjs",
    "line": null,
    "description": "manifest.actualCostUsd/estimatedJudgeCostUsd only reflect the LAST completing invocation's judge-call fraction (judgeCallCount is scoped per-invocation, not accumulated across resumes), so the manifest's own reported $4.9932 understates true cumulative spend across a run resumed 4 times (original pass, --rejudge-held, a crashed resume, and the final completing resume). True total estimated spend, computed by hand from the full call count (2703 first-pass + 149 rejudge = 2852 judge calls at $0.0015983/call, plus $1.3465 real batch cost): approximately $5.90 — still well inside the $10.42 ceiling, but the manifest field itself should not be trusted as the authoritative total for a multi-invocation run without this correction. Not fixed in this session (out of scope, cost was within ceiling either way) — flagged for whoever next touches this script's cost accounting.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T08:05:13.681Z",
    "resolved_at": null
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "02",
    "file": "915tldr.com2/server/utils/grounding-check.ts",
    "line": null,
    "description": "CONT-06 gap closure (02-VERIFICATION.md gap 1, found by /gsd-verify-work 2026-09-21): 253/1,830 (13.8%) of the September backfill's clean rows had LENGTH(summary) > LENGTH(content) because the D-07 attribution wrapper counted toward the length ceiling and the 02-08 Option C decoupling let a clean judge verdict clear a length violation the judge never evaluates. FIXED: stripAttributionWrapper() (text-metrics.ts) excludes the wrapper from the length comparison; checkGrounding() carves the length flag out of Option C as an independent hard gate (grounding-check.ts, commit d77e7ef, 915tldr.com2). REMEDIATED: scripts/cont06-remediate.mjs re-evaluated all 253 rows against production D1 (149 real judge calls, ~$0.22-0.44) -- 113 cleared, 140 held with summary/key_points cleared to NULL (commit 579085f, 915tldr.com2). Verified: raw LENGTH(summary)>LENGTH(content) query now returns 113 (all attribution-wrapper cases, by design -- see next entry), and a wrapper-aware query mirroring the code's actual gate returns 0. Calibration recall held 7/7. Full suite 260/260, typecheck (pre-existing unrelated failure only), lint (0 errors) all pass.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T16:04:08.654Z",
    "resolved_at": null
  },
  {
    "id": 24,
    "kind": "unmet-truth",
    "phase": "02",
    "file": "915tldr.com2/server/utils/text-metrics.ts",
    "line": null,
    "description": "The RAW production query 'SELECT COUNT(*) FROM articles WHERE ... LENGTH(summary) > LENGTH(content)' (used verbatim in 02-VERIFICATION.md and matching roadmap SC1 clause 2's literal wording) still returns 113, not 0, after the CONT-06 fix (see prior entry) -- BY DESIGN, not a residual defect. All 113 rows are exactly the cases where the required D-07 attribution wrapper text ('According to <outlet>, ') itself accounts for the entire excess (confirmed: 0 of the 113 fail to match the wrapper pattern). The code's actual CONT-06 gate (grounding-check.ts) correctly excludes this wrapper via stripAttributionWrapper() and measures 0 violations. Whoever next re-runs the literal roadmap SC1 raw-SQL check will see a nonzero number and should use the wrapper-aware query instead (documented in 02-11-SUMMARY.md), or the roadmap's own success-criterion wording should be updated to state the wrapper-aware definition explicitly so this is not re-investigated from scratch.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T16:04:15.933Z",
    "resolved_at": null
  },
  {
    "id": 25,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "astro.config.mjs",
    "line": null,
    "description": "SEO-04 sitemap ordering-determinism was not verified across two separate builds (@astrojs/sitemap documents no stable ordering guarantee); single-build correctness (URL count, no leaked non-HTML/404 URLs) was proven instead.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T15:56:27.187Z",
    "resolved_at": null
  },
  {
    "id": 26,
    "kind": "unmet-truth",
    "phase": "05",
    "file": "src/worker.ts",
    "line": null,
    "description": "ARCH-08 CPU-max: a single real request in the 05-12 gate window (2026-10-01T20:34:05.536Z-21:16:29.049Z) measured 49.966ms Worker CPU, over the 20ms hard-fail ceiling, even though p50 (0.764ms) and p99 (2.846ms) are comfortably within the 5ms budget. Disclosed in docs/phase-05/zero-reads-gate.md Result section; not investigated further (out of scope for this plan); tracked for /gsd-verify-work.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T21:39:46.909Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "unmet-truth",
    "phase": "05",
    "file": "docs/phase-05/archive-latency.md",
    "line": null,
    "description": "Criterion 2 (05-11): canonical lab-LCP measurement reports R2_LATENCY_EXCEEDS_LCP -- archived-article p95 LCP 1,788ms vs the 1,500ms budget. The archive tier's own R2/KV cost is small and not the cause (p95 172ms/155ms); hot pages also sit close to the 1.5s line in this lab proxy (p95 1,484ms), pointing at general page-weight/render cost, not the archive-serving mechanism. Flagged for owner review before Phase 11's real field-LCP release gate; does not block Phase 5 completion (05-12).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T21:39:54.964Z",
    "resolved_at": null
  }
]
````

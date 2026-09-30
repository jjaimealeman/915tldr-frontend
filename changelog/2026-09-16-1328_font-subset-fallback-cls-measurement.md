# 2026-09-16 - Phase 1 Plan 2 Task 2: Self-Hosted Subset Fonts, Metric-Compatible Fallbacks, Font-Swap CLS Measurement

**Keywords:** [FEATURE] [STYLING] [TESTING] [PERFORMANCE] [ACCESSIBILITY]
**Session:** Afternoon, Duration (~2.5 hours, continuation after an API rate-limit interruption)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1328_font-subset-fallback-cls-measurement.md`

## What Changed

- File: `design/scripts/fetch-fonts.mjs`
  - Downloads the 6 upstream Instrument Serif / Source Serif 4 font + OFL files from pinned `google/fonts` commits into gitignored `design/fonts-src/`, verifying each one's git blob SHA-1 before it ever reaches a font parser; exports `FILES` (guarded behind an `isMain` check so importing it for reuse never triggers a network fetch as a side effect)
- File: `design/scripts/lib/glyphs.mjs`
  - `SPANISH_BASELINE` (ASCII + Spanish diacritics/punctuation/typography), `collectPageText` (serialisable into `page.evaluate`: body innerText + `::before`/`::after` computed content + form control text), `closeOverCase`
- File: `design/scripts/build-fonts.mjs`
  - Crawls every existing mockup page for rendered text, closes the glyph set over case, subsets both families to exactly that set with `subset-font` (woff2, Source Serif 4's `wght` axis reduced to 400-700, `opsz` left variable), gates on the 150KB/25%-of-source size ceiling, generates 15 capsize metric-compatible fallback `@font-face` rules (Georgia/Noto Serif/Times-metric per style/weight, with the Times-metric face's `src` swapped for real `local()` names covering Times New Roman/Liberation Serif/Tinos), and rewrites `style.css`'s `fonts:start/end` region and `index.html`'s two font preloads — idempotently, verified by running it twice and diffing byte-for-byte
- File: `design/mockups/fonts/{InstrumentSerif-Regular,InstrumentSerif-Italic,SourceSerif4-Roman,SourceSerif4-Italic}.woff2`, `OFL-InstrumentSerif.txt`, `OFL-SourceSerif4.txt`, `subset-manifest.json`
  - Subset output (16.8KB-108KB, 9-24% of source) plus provenance/manifest (source SHA-1s, glyph-set SHA-256, codepoints, per-face byte/ratio)
- File: `design/tests/support/geometry.ts`
  - `installClsObserver`, `holdFonts` (network-level pending-request tracking, not FontFace-status), `snapshotLayout`, `layoutShiftScore` (from-scratch W3C Layout Instability formula, engine-independent), `measureFontSwap` (the full hold/release/snapshot/compare sequence)
- File: `design/tests/font-cls.spec.ts`
  - `@c5`-tagged: font-swap CLS-safety at 320px/1280px per page, plus a codepoint-coverage check (every character `collectPageText` finds on the page is in `subset-manifest.json`)
- File: `design/tests/structure.spec.ts`
  - Fixed a pre-existing font-family assertion (`startsWith('"Instrument Serif"')`) that Task 2's much longer capsize-generated font stack exposed as engine-fragile: WebKit re-serialises `getComputedStyle().fontFamily` to the minimal-quoting form (dropping quotes around names that don't strictly need them), Chromium preserves the authored quoting. Now strips optional quotes before comparing the first family name, in both engines.

## Why

PERF-07 requires self-hosted, subset, `size-adjust`-fallback fonts with a font-swap that produces effectively zero CLS, verified empirically rather than assumed — this is exactly what D-08 and 01-RESEARCH.md's Patterns 2/3 call for. Building the whole pipeline (fetch -> subset -> fallback -> measure) on the tracer page first, per the plan's own stated purpose, surfaced three real cross-engine surprises before this became the copied-forward pattern for the other four pages.

## Issues Encountered

- **Preload blocks the `load` event when a font request is held pending.** `openPage()`'s default `page.goto()` wait (`'load'`) hung indefinitely once `index.html` gained `<link rel="preload" as="font">` tags, because a *preloaded* resource (unlike an ordinary `@font-face`-triggered fetch) delays `load`. Fixed by navigating directly with `waitUntil: 'domcontentloaded'` inside `geometry.ts` (reusing `harness.ts`'s `blockThirdParty`/theme-seeding rather than its frozen `openPage()` export, which doesn't expose `waitUntil`).
- **`document.fonts` `FontFace.family` is never CSS-quoted**, unlike `getComputedStyle().fontFamily` — an early assertion comparing it against a quoted string (`'"Instrument Serif"'`) always failed. Fixed by matching on the plain family name, and — separately — by checking only the style/weight variants actually in active use (`status !== 'unloaded'`) rather than requiring every declared `@font-face` (including an unused italic) to be `'loading'`.
- **The most significant finding:** this specific Playwright-WebKit build (26.6, via the pinned Docker image) defers compositing — and therefore every `requestAnimationFrame` callback — entirely for as long as *any* `@font-face` resource on the page is still in flight, regardless of `font-display: swap` and regardless of delay length (verified up to 20s; a pending `<img>` request to the same URL does not reproduce it, confirming it's font-specific, not a general pending-subresource block). Chromium composites and fires `rAF` normally regardless. Consequence: there is no observable "painted with fallback, primary still loading" frame to snapshot in this WebKit build — a naive `getBoundingClientRect()` read before release() would force a layout the engine never actually composited, producing a number that doesn't correspond to anything a user was ever shown. Fixed by having `measureFontSwap` detect (via `nextTwoFrames`'s return value) whether a real frame was produced before `release()`, and report `geometryScore: 0` with a new `prePaintObserved: false` field when it wasn't, instead of measuring an artifact. The "hold is actually in effect" pre-release assertion was also switched from `document.fonts` FontFace status to network-level `pendingUrls()` tracking, since it's the one thing both engines agree on.
- The `sed`-adjacent bug: a JSDoc comment containing the literal substring `**/fonts/*.woff2` closed its own block comment early (`**/` contains `*/`), turning the rest of the doc comment into broken executable code (`ReferenceError: fonts is not defined`). Reworded to avoid the sequence.
- `fetch-fonts.mjs`'s `main()` ran unconditionally at import time (no `isMain` guard), so `build-fonts.mjs`'s `import { FILES } from './fetch-fonts.mjs'` re-ran the entire network fetch+verify as a side effect on every build. Guarded behind the same `isMain` pattern `serve-mockups.mjs` already uses.
- A leftover `serve-mockups.mjs --port 4319` process and a mismatched-version (`playwright@1.62.1`) orphaned `run-server` process from an earlier session were bound to the port `verify-phase-1.mjs`'s Playwright `webServer` needs; killed before re-running.

## Dependencies

No dependencies added — `subset-font`, `@capsizecss/core`, `@capsizecss/metrics`, `@playwright/test` were already installed and owner-approved in 01-01. `wrangler` (npx-only) and font network fetches were the only external resources touched, both read-only/already-approved per the plan.

## Testing Notes

- What was tested: `npm run fonts:fetch && npm run fonts:build` (verified idempotent via a second run diffed byte-for-byte against the first), `npm run verify:phase-1 -- --pages=index --criteria=1,2,5` — 9/9 Playwright tests green in both Chromium and WebKit (Docker, v26.6), all three Node checks (C1/C2/C5) passing
- What wasn't tested: real Safari (only Playwright's WebKit build is available on this Arch machine, per 01-CONTEXT.md's platform constraint) — the `prePaintObserved: false` finding is specific to this WebKit build/environment and is explicitly flagged as unverified against a real Safari device
- Edge cases: a subset built from the crawled tracer copy plus the full Spanish baseline set (ñ/Ñ/¿/¡/accented vowels) all present in the manifest; control characters (line breaks from `innerText`) correctly excluded from both the subset and the coverage check; Georgia/Noto Serif genuinely absent as local fonts on this machine while Noto Serif (Chromium) and the Tinos/Liberation Serif alias (WebKit) resolve successfully — real `local()` fallback-matching behaviour, not simulated

## Next Steps

- [ ] Plan 01-03 onward: expand the palette/token work and the remaining four mockup pages on top of this now-proven pipeline
- [ ] Confirm the WebKit `prePaintObserved: false` finding doesn't need a real-Safari spot-check before Phase 1's final `01-APPROVAL.md` sign-off (01-RESEARCH.md already flags Playwright-WebKit-on-Linux as strong evidence, not the final word, for exactly this class of question)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - completes the Phase 1 tracer (01-02) end to end: D1 row -> tokens -> fonts -> contrast gate -> both browser engines -> runner verdict, all green

# 2026-09-16 - Phase 1 Design Sketch Research

**Keywords:** [DOCUMENTATION] [STYLING] [TESTING] [ENHANCEMENT]
**Session:** Morning, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1051_phase-1-design-research.md`

## What Changed

- File: `.planning/phases/01-design-sketch-editorial-identity/01-RESEARCH.md`
  - Answered the eight tooling questions CONTEXT.md left open for Phase 1 (Design Sketch & Editorial Identity): font subsetting toolchain, `size-adjust`/`ascent-override` cross-browser support, empirical CLS-on-font-swap measurement, the Playwright-WebKit-vs-real-Safari gap, contrast-table generation from OKLCH tokens, scripted keyboard-walk/focus-clip detection, Spanish +25% overflow detection, and a pure-HTML zero-JS article grid pattern
  - Re-verified the project's own prior LOW-confidence flag directly against MDN, caniuse, and the WebKit bug tracker: `size-adjust` is Baseline/Safari 17+; `ascent-override`/`descent-override`/`line-gap-override` are `RESOLVED FIXED` in WebKit engine (2026-08-05) but not yet shipped in any released Safari
  - Confirmed via direct GitHub fetch that `@capsizecss/metrics` carries font-metric data for both `instrumentSerif` and `sourceSerif4`, resolving the fallback-library choice in favor of `capsize` over `fontaine` (whose core package has no standalone Node API outside a bundler)
  - Ran the package-legitimacy gate on `glyphhanger`, `subset-font`, `fontaine`, `culori`, `colorjs.io`, `@playwright/test` — flagged four false-positive `SUS` verdicts (all long-established packages, heuristic tripped on recent-version-publish and low-download signals) and documented the true package ages
  - Included Validation Architecture (Playwright Test framework, Wave 0 gaps) and a Security Domain section explaining why most ASVS categories don't yet apply to a static-HTML-only phase

## Why

Phase 1's design decisions are locked in `01-CONTEXT.md`; what remained open was the tooling and measurement approach for eight technical questions the discussion explicitly deferred to research. This document gives the planner concrete, sourced answers (with confidence tags) so `/gsd-plan-phase` can produce task-level plans without re-opening design decisions.

## Issues Encountered

No major issues encountered. One notable finding worth flagging forward: the WebKit `ascent-override` fix landed in the engine on 2026-08-05 but its feature flag has not yet been removed, meaning Playwright's WebKit build (which tracks trunk) may already exercise behavior that real shipped Safari does not have — this asymmetry needs to be stated explicitly in the eventual `01-APPROVAL.md`, not glossed over as "Safari verified."

## Dependencies

No dependencies added yet (research phase only). Recommended for the build/verification toolchain, versions confirmed live against npm this session: `glyphhanger@6.0.0`, `subset-font@2.7.0`, `@capsizecss/core@4.1.3`, `@capsizecss/metrics@4.3.0`, `culori@4.0.2`, `@playwright/test@1.63.0`.

## Testing Notes

- What was tested: All npm package versions/ages verified live against the registry; `size-adjust`/`ascent-override` support verified directly against caniuse.com and MDN; WCAG 2.2 SC 2.4.11/2.4.13/1.4.11 text verified directly against W3C Understanding docs; `@capsizecss/metrics` font coverage verified by fetching the raw metrics JSON from GitHub.
- What wasn't tested: `glyphhanger`'s multi-file local-HTML crawl syntax (only single-URL usage was directly confirmed) and Playwright's exact ancestor-overflow-clipping behavior in `toBeVisible()` — both flagged as assumptions requiring a `checkpoint:human-verify` spot-check during planning/execution.
- Edge cases: Documented in the Assumptions Log and Open Questions sections of the research doc.

## Next Steps

- [ ] `/gsd-plan-phase 1` to turn this research into a task-level PLAN.md
- [ ] Wave 0: scaffold `package.json`, `playwright.config.ts`, and install Playwright browser binaries (`npx playwright install --with-deps chromium webkit`)
- [ ] Verify `glyphhanger`'s local multi-file crawl syntax against the actual mockup HTML once built
- [ ] Decide (planner-level) whether Playwright-WebKit-on-Linux is sufficient D-08 evidence or a real Safari confirmation pass is needed

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - planning-stage research artifact, no application code changed

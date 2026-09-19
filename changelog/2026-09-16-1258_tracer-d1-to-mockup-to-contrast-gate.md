# 2026-09-16 - Phase 1 Plan 2 Task 1: Tracer — Real D1 Row to Mockup to Contrast Gate

**Keywords:** [FEATURE] [TESTING] [STYLING] [DATABASE] [ACCESSIBILITY] [SECURITY]
**Session:** Afternoon, Duration (~2 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1258_tracer-d1-to-mockup-to-contrast-gate.md`

## What Changed

- File: `design/scripts/d1.wrangler.jsonc`
  - Read-only wrangler config pointing at the production `915tldr-db` D1 database (same `database_id` as the live `915tldr.com2` app)
- File: `design/scripts/lib/d1-read.mjs`
  - `d1Query(sql, { label })` — refuses anything that isn't a single SELECT/WITH statement, refuses multiple statements, refuses a denylist of write keywords, all *before* spawning `wrangler`; redacts token-shaped strings from any error output
- File: `design/scripts/fetch-stress-set.mjs`
  - Defines the `tracer-pair` case (2 real, processed, non-duplicate rows from the live corpus), asserts the invariant post-query, writes `design/fixtures/stress-set.json` with `_meta.rowsReadTotal`
- File: `design/fixtures/stress-set.json`
  - Real production rows (a screwworm-health article and an Obama's-dog community article) — no `articles.content` column ever selected
- File: `design/mockups/style.css`
  - Production token layer: `fonts:start/end`, `tokens:start/end` (`:root` + `[data-theme="dark"]`), `palette:start/end` and `palette-dark:start/end` sub-regions for all 8 categories, mobile-first component CSS
  - Palette hues sampled per 01-CONTEXT.md's initial values, run through culori `clampChroma` (with floor-truncation to 3 decimals so rounding never pushes a value back out of the sRGB gamut)
  - Hand-picked near-neutral ink-muted/rule/rule-strong values verified against the D-13 gate
- File: `design/mockups/index.html`
  - The real tracer-pair rows rendered as a typographic lead + one grid card, theme toggle (inline head script, the page's only `<script>`), skip link, 8-category nav
- File: `design/scripts/lib/css-tokens.mjs`
  - `extractRegion`, `parseTokenRules`, `resolveTheme` (var() resolution incl. nested in `oklch()`, with cycle detection), `toSrgb` (culori `parse`/`displayable`) — no hand-rolled WCAG or OKLCH math
- File: `design/scripts/check-contrast.mjs`
  - D-13 gate: generates `design/evidence/contrast.md` from the CSS tokens directly, checks neutral pairs plus 3 category-ramp rows (worst hue reported per ramp), exits non-zero on any failure
- File: `design/tests/structure.spec.ts`
  - `@c1`/`@c5`-tagged Playwright spec: page load/one-h1, theme attribute + computed `--paper` per theme, keyboard-operable persistent toggle, JS-disabled parity, font-family assertions
- File: `design/scripts/verify-phase-1.mjs`
  - D-16 single runner: `--pages`/`--criteria`/`--engines` flags, per-criterion Chromium/WebKit/Node verdict table, SCOPED banner, JSON+text evidence output
- File: `package.json`
  - Added npm scripts: `data:stress`, `check:contrast`, `verify:phase-1`, `fonts:fetch`, `fonts:build`

## Why

Phase 1's plan is ten plans deep before anything gets approved; this tracer proves every architectural layer (real D1 access, the token/CSS contract, the contrast gate, both browser engines, the single runner) end to end on one page first, so a wrong assumption shows up after two commits instead of after nine plans of expansion work.

## Issues Encountered

- Rounding OKLCH chroma to the spec's 3-decimal-place format pushed 2 of 24 category/stop combinations just outside the sRGB gamut (culori's `displayable()` failed on the rounded value even though the pre-rounding clamp was valid) — fixed by floor-truncating instead of round-to-nearest.
- The runner initially forwarded an absolute host filesystem path as `PW_JSON_OUT` into the WebKit Docker container, where the repo is mounted at `/work` — the reporter tried to `mkdir` the host's home directory path inside the container and failed with EACCES. Fixed by always passing a relative path.
- The "toggle persists across reload" test initially used `page.reload()`, which re-triggers the shared test harness's `addInitScript` (bound to the page for its lifetime) and silently overwrote the user's own toggle choice back to the harness's original seed value. Fixed by asserting persistence via a fresh page in the same browser context instead, which exercises the mockup's own inline theme script rather than the test harness's seeding mechanism.
- Criterion 2 (the D-13 contrast gate) has no browser component by design — the runner originally required at least one matching Playwright tag per criterion per engine, which made C2 fail unconditionally. Added an explicit node-only criteria set so its engine columns report `n/a` without gating the verdict.

## Dependencies

No dependencies added — all packages (`@playwright/test`, `culori`) were already installed and approved in 01-01.

## Testing Notes

- What was tested: `npm run data:stress -- --only=tracer-pair && npm run check:contrast && npm run verify:phase-1 -- --pages=index --criteria=1,2` — all green, both Chromium and WebKit (Docker, v26.6)
- What wasn't tested: criteria 3 and 4 (keyboard walk, Spanish overflow) have no specs yet — later plans (01-08, 01-09) own them
- Edge cases: refusing a `DELETE` statement without ever spawning wrangler; the JS-disabled browser context showing identical grid content and a hidden toggle

## Next Steps

- [ ] Task 2 of this plan: self-hosted subset fonts, metric-compatible fallbacks, and the font-swap CLS measurement (criterion 5)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH - proves the full Phase 1 architecture end to end on one real page before the remaining 8 plans expand it

# 2026-09-26 - Spike 1: a Loader throw does fail astro build; warm-window cost and trailing-slash recorded

**Keywords:** [DOCUMENTATION] [BACKEND] [TESTING] [PERFORMANCE] [BUG_FIX]
**Session:** Afternoon, phase 04 plan 01 execution (Task 3)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1735_04-01-spike1-loader-throw-confirmed-fails-build.md`

## What Changed

- File: `docs/phase-04/spikes.md` (new)
  - **Spike 1**: `CLOUDFLARE_API_TOKEN=invalid-token-for-spike pnpm run build` exits `1` and the
    output names the `d1-client` 401 failure directly, thrown inside `articlesLoader().load()` —
    04-RESEARCH.md Open Question 1 / Assumption A1 is CONFIRMED: a Content Layer `Loader` throw
    fails `astro build` identically to a `getStaticPaths()` throw
  - **Warm window cost**: a real `pnpm run build` synced 324 articles, `rowsRead=5,926`, 6.16s
    total wall time — 0.036x PROJECT.md's daily soft budget even at 12 cycles/day
  - **Trailing slash**: re-confirms Task 1's live measurement (`/path` -> 200 no Location;
    `/path/` -> 307 to the no-slash path) and records it as a **named deviation** from CONTEXT.md's
    literal "301" wording — Cloudflare's native `html_handling` never emits 301 in any mode
    (04-RESEARCH.md Common Pitfall 2)
- File: `docs/phase-03/render-manifest.md`
  - Added a "v2 (Phase 4, D-08)" section documenting the `slug` field, the version bump, and why
    no separate `categorySlug` field was needed (`category` already holds the slug)
- File: `package.json`
  - Added `"test:fast"` script — unit tests without a full build first, for faster per-task
    feedback once builds carry the whole corpus
- File: `tests/unit/build-stamp.test.mjs`
  - Fixed `findArticleHtmlFiles()` (Rule 1 — directly caused by Task 1's `build.format: 'file'`
    change): it looked for `index.html` under `dist/client`, a shape that stopped existing the
    moment `astro.config.mjs` set `build.format: 'file'`. All 3 cross-surface tests in this file
    were failing with `ERR_INVALID_ARG_TYPE` before this fix (confirmed by running
    `pnpm run test:fast` before editing). Now matches the same `<slug>-<uuid>.html` shape
    `tests/tracer/tracer.test.mjs` uses.

## Why

Answers RESEARCH Open Question 1 by measurement rather than assumption, records the measured
warm-window D1 cost for later phases to budget against, and names the trailing-slash status-code
gap explicitly for the end-of-phase owner review instead of letting it pass silently. The
`build-stamp.test.mjs` fix keeps `pnpm run test:fast` — the exact script this task adds — actually
green.

## Issues Encountered

`tests/unit/build-stamp.test.mjs` was failing before this commit, exposed by running the newly
added `test:fast` script for the first time against Task 1's `build.format: 'file'` change. Fixed
per Rule 1 (bug directly caused by this plan's own earlier change, in scope).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the invalid-token build spike (captured exit code and output), a normal
  `pnpm run build` (captured the loader's log line and wall time), `pnpm run test:fast` (121/121
  passing after the build-stamp fix), `pnpm run test:build-gate` (6/6 passing), and
  `TRACER_LIVE_ORIGIN=https://dev.915tldr.com node --test tests/tracer/tracer.test.mjs` (5/5
  passing)
- What wasn't tested: a genuinely cold-cache build (no `node_modules/.astro` at all) — would
  require `rm -rf`, which is sandbox-blocked in this execution environment; recorded as a Cleanup
  needed item in `docs/phase-04/spikes.md` and 04-01-SUMMARY.md
- Edge cases: the D1-import assertion's zero-candidate guard also correctly fired during the
  invalid-token spike (the build aborted before any page candidate was walked) — a second,
  independent confirmation that the build failed as early as the loader throw intended, not a
  false positive from this spike

## Next Steps

- [ ] 04-01-SUMMARY.md and STATE.md updates close out this plan
- [ ] A follow-up manual cold-cache build measurement (owner-run, `rm -rf node_modules/.astro`
      then `pnpm run build`) to confirm the cold-vs-warm rowsRead delta stays within budget

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - closes 04-RESEARCH.md's Open Question 1 with a measured answer, plus a real test-suite regression fix

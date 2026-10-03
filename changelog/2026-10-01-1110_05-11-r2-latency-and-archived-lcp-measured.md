# 2026-10-01 - R2 latency and archived-page LCP measured against the 1.5s budget

**Keywords:** [PERFORMANCE] [TESTING] [DOCUMENTATION]
**Session:** Morning, Duration (~50 min, mostly measurement wall-clock)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1110_05-11-r2-latency-and-archived-lcp-measured.md`

## What Changed

- File: `tools/measure-archive-latency.mjs` (new)
  - CLI (`--json`, `--evidence <dir>`) measuring: (1) Worker→R2 `get()` latency at p50/p95 over
    200 distinct, never-before-requested archived article URLs (cache-miss confirmed via
    `Server-Timing: archive;desc=r2`); (2) client TTFB across three classes (archived cache-miss,
    archived edge-hit, hot static); (3) lab LCP in real Chromium (Playwright's `Pixel 7` mobile
    device descriptor) for 20 archived vs. 20 hot article pages, via
    `PerformanceObserver({ buffered: true })`.
  - Verdict `R2_LATENCY_FITS_LCP` / `R2_LATENCY_EXCEEDS_LCP` against the 1,500ms p95 LCP budget.
- File: `tests/helpers/archive-sample.mjs`
  - Added `pickHotArticles(plan, n)` — the `n` most-recently-published never-archived articles,
    for the TTFB/LCP hot-page comparison group.
- File: `docs/phase-05/archive-latency.md` (new)
  - Full methodology, results tables, and the `R2_LATENCY_EXCEEDS_LCP` verdict with owner-review
    notes.
- File: `docs/phase-05/evidence/latency/` (new)
  - Raw per-request sample arrays and the canonical `result.json` from the recorded run.

## Why

ROADMAP criterion 2 requires evidence, not assumption, that the archive tier's Worker→R2 read
cost fits inside the 1.5s LCP budget. 05-09 already measured cold R2/KV latency in isolation
(150 samples); this plan adds a larger sample (200) plus the piece 05-09 didn't cover — actual
LCP impact in a real browser, archived vs. hot, mobile-emulated.

## Issues Encountered

- **Object size silently read as 0.** `Number(null)` evaluates to `0`, not `NaN` — the first
  version of the tool coerced `res.headers.get('content-length')` (which is `null` when the
  header is absent, as it always is here: the Worker streams the R2 body with no Content-Length)
  straight into `Number()`, producing a false "0 bytes" reading instead of falling back to the
  local build's own `dist/archive-plan.json` `bytes` field. Fixed by checking for `null`
  explicitly before coercing. Caught before the number was recorded in the doc.
- **`performance.getEntriesByType('largest-contentful-paint')` always returns empty.** LCP is a
  buffered-only Performance Timeline entry type — entries are only ever delivered through a
  `PerformanceObserver({ buffered: true })` callback, confirmed live against this exact host
  during development. Fixed by switching to the observer pattern with a short settle delay.
- **Real, disclosed run-to-run LCP variance on the operator machine.** Four back-to-back full
  measurement runs produced archived p95 LCP of 1200ms, 1212ms, 2108ms, and 1788ms — straddling
  the 1,500ms budget depending on run, while R2/KV durations stayed tight (p95 118-184ms across
  the three bug-fixed runs). The fourth run was committed to as canonical BEFORE it ran, to avoid
  selecting the most favorable of the four. Analysis in the doc shows the gap tracks hot pages'
  own LCP (which also sits close to 1.5s, p95 1,484ms, with zero archive-tier involvement) plus
  the archive tier's own measured TTFB tax (~300ms) — not R2/KV cost compounding further
  downstream. Flagged for owner review, not silently resolved.

## Dependencies

No dependencies added (`@playwright/test` already a dependency, used for its `chromium`/`devices`
exports, same as the existing browser-journeys suite).

## Testing Notes

- What was tested: the tool itself, run four full times against the live deployed site
  (200 R2 samples + 50 edge-hit + 50 hot TTFB + 40 Chromium page loads per run).
- What wasn't tested: field LCP (Phase 11's own release gate, out of this plan's scope).
- Edge cases: confirmed genuinely cold reads via 0 edge-cache hits on first touch of each of the
  200 sampled URLs; confirmed genuinely warm reads via `archive;desc=edge-cache` on the 50
  repeat requests.

## Next Steps

- [ ] Owner review: `R2_LATENCY_EXCEEDS_LCP` on the canonical run — general page-weight/render
      optimization (not the archive tier itself) is the likely lever, per the doc's analysis.
- [ ] Phase 11's field LCP measurement remains the actual release gate.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new measurement tooling and documented evidence; flags a real, disclosed
performance risk for owner review rather than hiding it.

# 2026-09-22 - Per-Page Render Cost Measurement Harness

**Keywords:** [BACKEND] [PERFORMANCE] [TESTING] [BUG_FIX]
**Session:** Late evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2306_render-cost-measurement-harness.md`

## What Changed

- File: `tools/measure-render-cost.mjs`
  - New CLI that times the REAL tracer slice (D1 read, render, KV manifest write) across a
    stratified sample of N articles, spawning a child `astro build` with harness-mode env vars
    the harness owns exclusively.
  - Samples articles at evenly-spaced ranks of a corpus-wide `ORDER BY LENGTH(summary)` (not the
    newest N articles) via one lightweight bulk D1 request, so the sample spans the real
    summary-length distribution instead of clustering at one end of it.
  - Reports min/p50/p95/max/sample count for D1 read, render, and manifest write SEPARATELY, a
    total, and fixed Astro/Vite build-startup cost isolated from per-page cost — reuses
    `tools/lib/percentile.mjs`'s `nearestRank`/`distributionStats` (03-06 Task 1), not a second
    implementation.
- File: `src/lib/render-cost-harness.ts` (new)
  - `HARNESS_MODE`/`harnessSamples`/`registerHarnessExit()`, extracted into their own module
    after a real bundler bug (see Issues Encountered).
- File: `src/pages/[category]/[slug].astro`
  - `getStaticPaths` branches on harness mode: when `MEASURE_RENDER_COST` is set (only by the
    harness's own child build), it renders N sampled articles instead of one, timing each
    article's D1 read and manifest build/write; the component body times its own frontmatter
    execution as a render-cost proxy. Absent in every normal build — verified a plain
    `pnpm build` afterward still emits exactly one article.
- File: `docs/phase-03/render-cost-report.md`
  - Generated report from a real 50-article `--count 50` run against live production D1 and KV.

## Why

Phase 3's D-02 requires per-page render cost to be measured against the real tracer slice, not
a synthetic Astro benchmark — the project's verification standard and a 2026-08-27 incident
both call out that a different code path measures the wrong thing. This harness produces that
distribution and separates the three components so 03-07 can see WHERE the cost sits: the
measured 50-article run puts manifest write (KV network PUT) as the dominant cost (p50 338ms,
p95 415ms), D1 read second (p50 231ms, p95 335ms), and the component's own render computation
essentially free (p50 0.07ms) — a materially different picture than a single blended number
would show, and directly relevant to where 03-07 decides the render step should run.

## Issues Encountered

- A frontmatter-local `const HARNESS_MODE = ...` declared directly in `[slug].astro` and
  referenced only from inside `getStaticPaths` was silently dropped by Astro 7.3.3's
  rolldown-based bundler — `ReferenceError: HARNESS_MODE is not defined` at build time. This is
  the SAME bundler defect 03-01-SUMMARY.md documented for a frontmatter-local `slugify()`
  function (Deviation #8 there), not a new bug — a recurrence of an already-known one. Fixed the
  same way: extracted the declaration into its own module (`src/lib/render-cost-harness.ts`)
  and imported it normally. Verified by re-running the harness successfully after the fix.
- The plan's own verify script glob (`dist/*/*/index.html`) predates 03-01's proven finding that
  this Astro/adapter version pair emits output under `dist/client/`, not `dist/` directly — the
  glob was adjusted to `dist/client/*/*/index.html` when running verification manually; both
  paths still confirm exactly one article HTML file after a plain `pnpm build`.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `--count 10` and `--count 50` runs against live production D1/KV, both
  producing a complete report with all four required top-level JSON fields
  (`sampleCount`/`p50`/`p95`/`fixedStartupMs`/`components`); a plain `pnpm build` immediately
  after each harness run, confirmed to emit exactly one article HTML file both times;
  `pnpm test:unit` (87/87), `pnpm test:build-gate` (4/4), `pnpm test:tracer` (4/4) all run after
  this change with no regression.
- What wasn't tested: behavior when the sampled article count exceeds the corpus's distinct
  summary-length rank count (would produce fewer than `--count` samples via the dedup guard in
  `pickStratifiedSample`) — not exercised at `--count 50` against ~39,687 candidates.
- Edge cases: a `--count` larger than the candidate pool is handled (`Math.min(count, pool
  size)`) but not exercised in this session.

## Next Steps

- [ ] 03-06 Task 3: cron CPU ceiling probe, then `docs/phase-03/measurements.md` combining all
      three numbers — including this task's finding that manifest write, not the render itself,
      dominates per-page cost — for 03-07's render-step decision.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - measurement tooling and a real per-page cost breakdown; the tracer's
normal (non-harness) behaviour is unchanged and re-verified.

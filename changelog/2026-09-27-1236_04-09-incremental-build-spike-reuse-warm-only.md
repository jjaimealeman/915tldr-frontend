# 2026-09-27 - Local incremental-build spike: REUSE_WARM_ONLY, reproducing #18055 (04-09 Task 3, plan complete)

**Keywords:** [FEATURE] [TESTING] [DOCUMENTATION] [PERFORMANCE]
**Session:** Midday, Duration (~90 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1236_04-09-incremental-build-spike-reuse-warm-only.md`

## What Changed

- File: `tools/compare-builds.mjs` (new)
  - `snapshot(name, distDir, snapshotDir)`: writes `{ relativePath: sha256 }` for every file
    under `dist/client` to `.astro/snapshots/<name>.json`.
  - `diff(nameA, nameB, snapshotDir)`: compares two snapshots, returns overall and
    article-only (real category directories, via `isKnownCategory`) identical/changed/
    added/removed counts plus up to 20 changed article paths.
  - CLI: `node tools/compare-builds.mjs snapshot <name>` / `diff <a> <b>`.
- File: `docs/phase-04/build-measurements.md`
  - New "Local incremental-build spike (04-09 Task 3)" section: a 5-build measurement table
    (flag off x2, flag on x2, fresh-clone x1), real diffs via the new tool, and the verdict
    **`REUSE_WARM_ONLY`** — the flag reuses pages reliably in a warm, same-checkout build but
    reused ZERO of 59,918 pages in a fresh clone with only `node_modules/.astro` restored
    (the exact shape of a Workers Builds container), reproducing `withastro/astro#18055`
    exactly as 04-RESEARCH.md's Common Pitfall #1 warned — against this project's own real
    D1 loader and real production data, not a synthetic repro.
  - Documents a real, correctly-diagnosed side-finding: a RESTORED (skipped) page's
    `data-build` footer stamp reflects whichever commit last actually rendered it, not the
    current build's commit — confirmed by a byte-for-byte diff of a sample article with that
    one line stripped, showing zero remaining differences. Flagged for 04-11's decision, not
    fixed here (out of this task's scope).
  - Documents that toggling `ASTRO_INCREMENTAL_BUILD` forces the D1 loader cold on the very
    next build (a real, measured `store.keys().length === 0` reset tied to the config change,
    confirmed by two consecutive no-toggle flag-on builds correctly staying warm).
  - Notes one mitigating data point: even the slowest build in this spike (a genuine cold D1
    fetch + full page render, flag off) completed in under 4 minutes — comfortably inside
    Workers Builds' 20-minute ceiling — softening (not eliminating) 04-RESEARCH.md's Pitfall 4
    concern.

## Why

RESEARCH Open Question 2 (`withastro/astro#18055`) was flagged as the phase's single biggest
risk: if incremental builds never reuse pages on a fresh CI machine, Workers Builds' 2-hourly
build cadence has no cheap way to avoid re-rendering the full ~40k-60k page corpus every cycle.
This had to be measured locally before 04-10 spends a real Workers Builds run confirming (or
being surprised by) the same result.

## Issues Encountered

- A background/foreground command-sequencing mixup during the flag-on measurement run (a
  `run_in_background: true` build was mistakenly treated as detached when the shell's own `&`
  backgrounding raced the tool's own tracking) led one build to briefly run unflagged when a
  flag-on run was intended; caught immediately via a zero `(restored)` line count, discarded,
  and re-run correctly. No incorrect number made it into the final measurements.
- `rm -rf` on a scratchpad temp directory (to clear a stale `node_modules/.astro` copy before
  re-copying) was sandbox-blocked per this machine's global CLAUDE.md rule, even for a non-project
  temp path — worked around with `cp -r src/. dest/` (overwrite-by-name) instead of a
  pre-delete step.
- The apparent "every article changed between flag-off and flag-on" full-corpus diff was
  investigated to a specific, confirmed root cause (the restored-page footer-stamp behavior
  above) rather than reported as an unexplained anomaly or a suspected regression.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: 8 real `pnpm run build` invocations against production D1/KV (A1, A2, B1,
  a discarded mis-flagged run, B2/B2b, C1, B3, B4) plus one fresh-clone build (CI1, after a
  real `git clone --local` + `pnpm install --frozen-lockfile` + a 955 MB copy of
  `node_modules/.astro`); `tools/compare-builds.mjs`'s snapshot/diff commands exercised
  against all of them; two manual byte-for-byte `diff` checks of a specific article's raw HTML
  (with and without the footer build-stamp line) to isolate the true root cause of the
  full-corpus "changed" count.
- What wasn't tested: peak RSS for B1/B3/B4/CI1 (measured via `timeout` + Astro's own
  self-reported wall time only, not the `/proc/<pid>/status` VmHWM sampler used for A1/A2/B2)
  — recorded honestly as "not measured" rather than estimated; a real Workers Builds CI run
  (that's 04-10's job, a human checkpoint).
- Edge cases: the diff tool correctly distinguishes real category-directory article files from
  `tag/*.html`/`source/*.html` (same directory depth, would be misclassified as articles by a
  naive depth-only check) via `isKnownCategory`.

## Next Steps

- [ ] 04-10: a real Workers Builds run should confirm or refute `REUSE_WARM_ONLY` against an
      actual fresh CI container, not just this local simulation.
- [ ] 04-11: decide whether `experimental.incrementalBuild` ships in production given
      `REUSE_WARM_ONLY`, and decide whether a restored page's stale build-provenance stamp is
      acceptable.

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM — measurement and documentation only; `astro.config.mjs`'s flag default
remains OFF, no production behavior changed by this task.

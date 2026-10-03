# 2026-10-02 - Stale Pending Build State Reset at Build Start

**Keywords:** [BUGFIX] [BUILD] [TEST]
**Session:** Evening, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2355_stale-pending-build-state-reset-at-build-start.md`

## What Changed

- File: `src/lib/server/build-state.ts`
  - Added `resetPendingBuildState()`: removes the pending-state file (if present) and any stray
    write-temp file matching the `PENDING_TEMP_PREFIX`/`PENDING_TEMP_SUFFIX` naming convention,
    without touching any other entry in `.astro/` (Astro's own content-layer data store,
    `ci-build-started-at`, etc.). Returns `{ removed, bytes, strayTempFiles }`. Its doc comment
    states the contract explicitly: call it only at the very start of a build, before any
    loader runs — `tools/reset-pending-build-state.mjs` is its only intended caller.
- File: `tools/reset-pending-build-state.mjs` (new)
  - The first step of `pnpm run build`. Prints exactly one stdout line on success
    (`[build-state] reset pending build state: removed previous file (<bytes> bytes)` or
    `...: no previous file`, with a stray-temp-file count appended when nonzero), or a
    `build-state:`-prefixed message to stderr and exit 1 on an unexpected fs error. Reads no
    env, no credentials.
- File: `package.json`
  - `scripts.build` now starts with `node tools/reset-pending-build-state.mjs && `, ahead of
    `guard:config` — every exit path of a build, even one that fails at `guard:config`, leaves
    either no pending file or one written entirely by that build.
- File: `tests/unit/build-state.test.mjs`
  - Added T9-T13: reset clears the pending file plus stray temp files while leaving other
    `.astro/` entries untouched; a missing `.astro/` directory resolves cleanly with no throw;
    a stale section cleared by reset can no longer satisfy `commitLastGood`'s required-section
    check; the real tool (invoked via `execFileSync`) removes a corrupt file, prints one line,
    and reports "no previous file" on a second run; `package.json`'s `scripts.build` runs the
    reset before `astro build`.
- File: `docs/phase-04/build-pipeline.md`
  - Added the reset as the first line under `pnpm run build:ci` in the pipeline diagram, added
    step `1a.` to the Phase 5 BUILD step list (no existing step renumbered), and added a "Pending
    build state (quick 261002-tl2)" paragraph covering serialized/atomic writes, the build-start
    reset, and the 2026-10-02 incident.

## Why

Completes quick task 261002-tl2: a stale or corrupt pending build-state file restored from the
Workers Builds `.astro/` cache (D-06) must never be able to crash a build or silently satisfy
the D-14 never-shrink baseline with a leftover section from a previous run. Proven against the
REAL corrupt file left on disk from the 2026-10-02 incident (1,867,745 bytes, parse error at
byte 1867519): `pnpm run test:regression` ran two real builds through this exact file and both
succeeded, with the resulting pending file parsing cleanly (40,601 articles,
`ids.length === count`, changelog present).

## Issues Encountered

No major issues encountered. All 28 tests in `tests/unit/build-state.test.mjs` pass (T1-T13).
`pnpm run test:fast` shows the same 2 pre-existing, out-of-scope failures as the Task 1 baseline
(stale `dist/client` tag/sitemap counts from an earlier local build artifact, unrelated to this
task) — no new failures.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/build-state.test.mjs` (28/28 pass), `pnpm run
  test:fast` (772 total, 763 pass, 2 pre-existing fails, 7 skipped — no new failures vs. the
  759-total/750-pass Task 1 baseline), and `pnpm run test:regression` (5/5 pass) with the real
  corrupt pending file present at the start.
- What wasn't tested: a real Workers Builds CI run (this was proven locally via
  `pnpm run build`, which is the exact command Workers Builds' `build:ci` step spawns).
- Edge cases: already covered by T9-T13 (sentinel files untouched, no `.astro/` directory,
  stale-section D-14 refusal, the real CLI tool end-to-end, build-script ordering).

## Next Steps

- [ ] None — quick task 261002-tl2 is complete.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH (closes the window where a cached, corrupt `.astro/` pending file could crash
or silently poison the next production build's D-14 baseline)

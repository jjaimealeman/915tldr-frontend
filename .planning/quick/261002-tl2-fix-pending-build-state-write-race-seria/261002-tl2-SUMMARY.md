---
phase: quick-261002-tl2
plan: 01
subsystem: build
tags: [nodejs, filesystem, concurrency, tdd, build-pipeline, cloudflare-workers]

requires:
  - phase: 04
    provides: "build-state.ts (D-14 last-good KV baseline, pending-state file), tools/ci-build.mjs"
provides:
  - "Serialized, atomic writePendingBuildState (per-process FIFO queue + temp-file-then-rename)"
  - "resetPendingBuildState() and tools/reset-pending-build-state.mjs — build-start cleanup of a stale/corrupt pending file"
  - "pnpm run build now resets pending build state before any loader runs"
affects: [phase-05-ops, phase-06-corpus-growth]

actuals:
  tokens: 7244
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-process FIFO write queue on globalThis via Symbol.for(...), so two module instances of the same file in one process (Vite module runner vs. Node native loader) still share one lock"
    - "Atomic file replace: write to a temp file in the same directory, then rename() onto the real path"

key-files:
  created:
    - tools/reset-pending-build-state.mjs
  modified:
    - src/lib/server/build-state.ts
    - tests/unit/build-state.test.mjs
    - package.json
    - docs/phase-04/build-pipeline.md

key-decisions:
  - "Reset point is the first command of package.json's scripts.build, not ci-build.mjs's markBuildStart or an Astro integration hook — pnpm run build is the one entry point shared by Workers Builds, pnpm run test:regression, and local builds, and running first means it can never discard the current build's own state."
  - "Queue tail lives on globalThis under Symbol.for('915tldr.build-state.pending-write-queue'), not a module-local variable, because Astro can load this file through both Vite's module runner and Node's native loader in one process."

requirements-completed: [REND-02, REND-05]

coverage:
  - id: D1
    description: "Concurrent writePendingBuildState calls never lose a section or corrupt the pending file (serialized, atomic writes)"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/build-state.test.mjs#T1-T8"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stale or corrupt pending file from an earlier run is cleared at the start of every pnpm run build, proven against the real 2026-10-02 corrupt file"
    requirement: "REND-05"
    verification:
      - kind: unit
        ref: "tests/unit/build-state.test.mjs#T9-T13"
        status: pass
      - kind: integration
        ref: "pnpm run test:regression (byte-identity.test.mjs, two real builds against the real corrupt .astro/build-state.pending.json)"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-10-02
status: complete
---

# Quick Task 261002-tl2: Fix Pending Build-State Write Race Summary

**Serialized the pending build-state file's read-merge-write behind a per-process FIFO queue with atomic temp-file-then-rename replacement, and added a build-start reset that clears a stale or corrupt pending file before any loader runs — proven against the actual 1,867,745-byte corrupt file left by the 2026-10-02 incident.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-10-02T21:38:03-06:00 (commits) + ~2 min for the `pnpm run test:regression` proof run afterward
- **Tasks:** 2
- **Files modified:** 5 (plus 3 changelog entries)

## Pre-existing state recorded (per plan's Step 0 baseline)

- `pnpm run test:fast` baseline (before any change): **759 tests total, 750 pass, 2 fail, 7 skipped.**
  The 2 failures (`tests/unit/listing-pages.test.mjs`, `tests/unit/news-sitemap.test.mjs`) are
  pre-existing, caused by a stale `dist/client` artifact from an earlier local build, and are
  out of scope for this task (Scope Boundary rule) — confirmed unchanged after both tasks.
- The real `.astro/build-state.pending.json` on disk at task start: **1,867,745 bytes**, parse
  error `Unexpected non-whitespace character after JSON at position 1867519 (line 40606 column
  6)` — exactly the signature named in the plan's objective. Left untouched (per plan
  instruction) until Task 2's real-build proof.

## Accomplishments

- **Task 1 (tracer, TDD):** Reproduced the 2026-10-02 race deterministically (T1, T2, T4, T5
  failed against the current code; T6 also failed in this run — all five are explained by the
  same unlocked read-merge-write), then fixed it with a per-process FIFO write queue
  (`globalThis` + `Symbol.for(...)`) and an atomic temp-file-then-rename replace in
  `writePendingBuildState`. All 8 new tests (T1-T8) plus the 15 existing tests pass (23/23).
- **Task 2:** Added `resetPendingBuildState()` and `tools/reset-pending-build-state.mjs`, wired
  as the first command of `pnpm run build` (ahead of `guard:config`). Proved end-to-end against
  the real corrupt file: `pnpm run test:regression` ran two real builds through it and both
  succeeded; the resulting pending file parses, has both sections, and
  `articles.ids.length === articles.count` (40,601 articles, changelog count 18).

## RED tests that failed before the Task 1 fix

Against the current (unfixed) `writePendingBuildState`, run via
`node --test tests/unit/build-state.test.mjs`:

- **T1** (lost update, no file on disk) — `SyntaxError: Unexpected non-whitespace character
  after JSON at position 40` when parsing the raw file after two concurrent writes.
- **T2** (the exact observed corruption signature — a shorter concurrent write landing over a
  longer seeded state) — `SyntaxError: Unexpected non-whitespace character after JSON at
  position 2300103` — the same failure class as the real 2026-10-02 incident, reproduced
  deterministically in the test harness.
- **T4** (read-your-writes) — `readPendingBuildState()` returned `undefined` for a section an
  un-awaited concurrent write had already started.
- **T5** (atomic replace) — the inode did not change between two sequential writes (in-place
  `writeFile`, not a replace).
- **T6** (no torn reads during a ~3MB in-flight write) — `SyntaxError: Unexpected end of JSON
  input` on a raw poll mid-write.

T3 (FIFO order), T7 (queue recovers after a rejection) and T8 (a corrupt file is never treated
as empty) already passed against the unfixed code — they pin the contract that had to keep
holding after the fix, and still do.

## Task Commits

Each task was committed atomically via the `/jja-commit` skill (test → fix for the TDD cycle):

1. **Task 1 (RED):** `acd7020` — `test(05-ops): pending build-state write race reproduced (quick 261002-tl2)`
2. **Task 1 (GREEN):** `6494f96` — `fix(05-ops): pending build-state writes serialized and atomic (quick 261002-tl2)`
3. **Task 2:** `2c49dd4` — `fix(05-ops): stale pending build state reset at build start (quick 261002-tl2)`

_TDD tasks have multiple commits (test → fix) per `/jja-commit`'s convention — same pattern as
`feat`/`fix` elsewhere in this project's TDD history._

## Files Created/Modified

- `src/lib/server/build-state.ts` - Per-process FIFO write queue, atomic temp+rename replace,
  `resetPendingBuildState()`; `commitLastGood`'s required-section validation unchanged.
- `tools/reset-pending-build-state.mjs` (new) - The build's first step: one log line,
  `build-state:`-prefixed error + exit 1 on an unexpected fs error.
- `tests/unit/build-state.test.mjs` - T1-T13: concurrency, atomicity, queue-recovery, reset,
  stale-section, and build-script-order tests.
- `package.json` - `scripts.build` now starts with
  `node tools/reset-pending-build-state.mjs && `, ahead of `guard:config`.
- `docs/phase-04/build-pipeline.md` - Pipeline diagram and Phase 5 BUILD step list (new `1a.`
  step) updated; new "Pending build state (quick 261002-tl2)" paragraph.

## Decisions Made

- Reset point is the first command of `scripts.build`, not `ci-build.mjs`'s `markBuildStart` or
  an Astro integration hook (full rationale already recorded in the plan's objective; executed
  exactly as specified, no deviation).
- Queue tail lives on `globalThis` via `Symbol.for(...)`, not a module-local variable, per the
  plan's explicit instruction (Astro can load this file through two different module loaders in
  one process).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the plan's own
specification was precise enough that the RED tests reproduced the race on the first attempt and
the GREEN implementation passed on the first attempt.

## Issues Encountered

None beyond what the plan anticipated. The real-build proof (`pnpm run test:regression`) took
~115s (two full builds against production D1/KV, read-only) and was run in the background per
its expected duration; both builds succeeded on the first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The pending-build-state write race (REND-02) and the stale-file hazard (REND-05, Phase 5's
  Workers Builds `.astro/` cache, D-06) are both closed and proven against the real corrupt
  file that caused the 2026-10-02 `test:regression` failure.
- `commitLastGood`'s D-14 never-shrink baseline can no longer be silently poisoned by a leftover
  section from a previous build — a stale section is now provably refused (T11).
- No blockers for continuing Phase 5 or moving to Phase 6. `WR-10`-style vigilance: this fix is
  isolated to `src/lib/server/build-state.ts`, `tools/reset-pending-build-state.mjs`, and the
  build script wiring — no loader logic, no D1/KV schema, no deploy-path code was touched.

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task commits (`acd7020`,
`6494f96`, `2c49dd4`) confirmed present in git history.

---
*Phase: quick-261002-tl2*
*Completed: 2026-10-02*

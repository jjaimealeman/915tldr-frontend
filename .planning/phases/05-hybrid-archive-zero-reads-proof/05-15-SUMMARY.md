---
phase: 05-hybrid-archive-zero-reads-proof
plan: 15
subsystem: infra
tags: [hot-window, derive-hot-window, partition-archive, tdd, cloudflare-analytics, rend-10]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-05's hot-window derivation and owner-approved 202-day window; 05-06's partition-archive.mjs (ARCHIVE_DIR); 05-REVIEW.md's WR-08 finding; 05-VERIFICATION.md's REND-10 gap"
provides:
  - "countOtherFiles(distDir, facts, archiveDir) — counts both dist/client AND dist/archive, with a negative-result guard naming all four counts"
  - "DEFAULT_DIST_ARCHIVE export (= tools/partition-archive.mjs's ARCHIVE_DIR), re-exported from tools/derive-hot-window.mjs"
  - "A live-proven, preview-only re-derivation run against real Cloudflare Zone Analytics on today's partitioned build"
affects: ["05-21"]

# Actuals (#2632)
actuals:
  tokens: 6400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Count-both-trees-not-one: whenever a build-time partition step moves a subset of output files from one directory to another, a file-count-based arithmetic check must sum across every directory the partition can place a file in, not just the pre-partition directory — otherwise a routine partition produces a silent undercount, and an in-progress/reverted partition produces a silently WRONG (not obviously broken) count."
    - "Negative-result guard as a correctness check, not just an error path: when a derived quantity (otherFiles) is structurally non-negative by definition, a negative result is proof the two inputs it's computed from (build output, tier facts) have drifted out of sync — fail loudly naming both inputs' raw counts, never clamp to zero or let it propagate."

key-files:
  created: []
  modified:
    - tools/derive-hot-window.mjs
    - tests/unit/derive-hot-window.test.mjs
    - docs/phase-05/hot-window-derivation.md

key-decisions:
  - "DEFAULT_DIST_ARCHIVE is imported from tools/partition-archive.mjs's own ARCHIVE_DIR export (not a second hardcoded 'dist/archive' string) — the two tools can never drift apart on what directory the archive tier lives in."
  - "The negative guard fires on countOtherFiles's combined total going negative, not on either tree's individual count — a page counted once in either tree is correct, so only the facts-vs-build-output mismatch (not the partition split itself) should ever trip it."
  - "No --write was run in Task 2, as instructed — the preview path proves the capability without touching the owner-approved 202-day window. Task 2's achieved-coverage figure (78.6% at 202 days, down from the original 92.7%) is recorded and explained but does not change the in-force window; adopting a new value is an explicit future owner decision, not this plan's job."

requirements-completed: []  # REND-10 is NOT marked complete here (left for 05-21 per repo convention) even though this plan closes its ONLY recorded blocking gap (05-VERIFICATION.md gap 3 / WR-08) — see "Requirements status" below

coverage:
  - id: D1
    description: "countOtherFiles counts both dist/client and dist/archive together; a page moved back from dist/archive into dist/client is still counted exactly once"
    requirement: "REND-10"
    verification:
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#countOtherFiles: WR-08 — partitioned tree (dist/client + dist/archive) counts both, returns 3"
        status: pass
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#countOtherFiles: WR-08 — moved-back page (archived page moved from dist/archive into dist/client) still returns 3"
        status: pass
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#countOtherFiles: WR-08 — unpartitioned tree (no dist/archive directory) still counts correctly"
        status: pass
    human_judgment: false
  - id: D2
    description: "A negative otherFiles result (facts claiming more pages than both trees hold) throws a derive-hot-window: error naming dist/client count, dist/archive count, and both fact counts, instead of silently going negative"
    requirement: "REND-10"
    verification:
      - kind: unit
        ref: "tests/unit/derive-hot-window.test.mjs#countOtherFiles: WR-08 — negative guard rejects with derive-hot-window: and all four counts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-tree countOtherFiles() against the current partitioned build returns a small non-negative integer (37), not -30,467"
    requirement: "REND-10"
    verification:
      - kind: other
        ref: "node --input-type=module -e \"import('./tools/derive-hot-window.mjs').then(async (m) => console.log(await m.countOtherFiles()))\" — printed 37, captured in this SUMMARY"
        status: pass
    human_judgment: false
  - id: D4
    description: "The real, non-probe re-derivation path runs end to end against live Cloudflare analytics (no --write) and exits 0, printing a preview record — the capability 05-VERIFICATION.md found broken"
    requirement: "REND-10"
    verification:
      - kind: other
        ref: "node tools/derive-hot-window.mjs --json --evidence docs/phase-05/evidence/hot-window-rederive-20261002 — exit 0, stdout quoted in this SUMMARY, 30 day-*.json evidence files captured"
        status: pass
    human_judgment: false
  - id: D5
    description: "src/lib/archive/hot-window.json is byte-identical before and after the live preview run — the owner-approved 202-day window stays in force"
    requirement: "REND-10"
    verification:
      - kind: other
        ref: "sha256sum src/lib/archive/hot-window.json (before/after, identical) + git diff --exit-code src/lib/archive/hot-window.json (exit 0) — both captured in this SUMMARY"
        status: pass
    human_judgment: false

duration: ~35min (commit timestamps 15:12 to 15:22 for the two task commits; total session time longer, including the ~70s live 30-day Cloudflare Analytics run paced at 1 request/second)
completed: 2026-10-02
status: complete
---

# Phase 5 Plan 15: Restore REND-10's re-derivation capability (WR-08) Summary

**`countOtherFiles` now sums `dist/client` + `dist/archive` with a negative-result guard, and the real, non-probe `derive-hot-window.mjs` path was proven live end to end (preview only) against current Cloudflare Zone Analytics — the capability 05-VERIFICATION.md's gap 3 found broken is working again.**

## Performance

- **Duration:** ~35 min (commit timestamps 15:12-15:22 MDT for the two task commits; the live 30-day analytics run itself took ~70s, paced at 1 request/second per day)
- **Started:** 2026-10-02T21:07:45Z (per STATE.md `last_updated` at plan start)
- **Completed:** 2026-10-02T21:22:02-06:00 (second task commit)
- **Tasks:** 2
- **Files modified:** 3 (`tools/derive-hot-window.mjs`, `tests/unit/derive-hot-window.test.mjs`, `docs/phase-05/hot-window-derivation.md`) + 30 new evidence files

## Accomplishments

- Fixed WR-08: `countOtherFiles(distDir, facts, archiveDir)` now counts files under BOTH `dist/client` AND `dist/archive` (archiveDir defaults to the new `DEFAULT_DIST_ARCHIVE` export, re-exported from `tools/partition-archive.mjs`'s own `ARCHIVE_DIR`), instead of walking `dist/client` alone and undercounting by exactly the number of archived pages.
- Added a negative-result guard: a facts/build-output mismatch that would otherwise produce a negative `otherFiles` now throws `derive-hot-window: countOtherFiles went negative (...)` naming all four raw counts (dist/client files, dist/archive files, article facts, tag facts), instead of silently propagating a negative number into `deriveHotWindow`.
- Pinned the fix with 5 new regression tests under a new "countOtherFiles — WR-08 (05-15)" section: a partitioned-tree case, a moved-back-page case (archive-sync's own move-back scenario), an unpartitioned-tree case (no `dist/archive` directory at all), the negative guard, and the `DEFAULT_DIST_ARCHIVE` constant. All 34 tests in the file pass; full `pnpm run test:fast` is 694/694 green.
- Proved the fix on the real build: `countOtherFiles()` against the live tree (`dist/client` 29,867 files, `dist/archive` 30,713 files, 40,585 article facts, 19,958 tag facts) now returns **37** — a small non-negative integer of the same order as 05-05's originally recorded 36 — instead of throwing on -30,467.
- Ran the real, non-probe re-derivation end to end against live Cloudflare Zone Analytics, preview only (no `--write`): `node tools/derive-hot-window.mjs --json --evidence docs/phase-05/evidence/hot-window-rederive-20261002` exited 0 and printed `[derive-hot-window] preview (pass --write to commit): [archive] hot window: derived from 2026-09-02 to 2026-10-01, 202 days, 79% coverage (D-07b)`. `src/lib/archive/hot-window.json`'s sha256 (`47f20eb5ac8237195a6ad139f448b716ca7f449b10c01a7bd3c74311798e1fcf`) is confirmed identical before and after; `git diff --exit-code src/lib/archive/hot-window.json` exits 0 — the owner-approved window is untouched.
- Recorded a "Re-derivation capability (05-15, 2026-10-02)" section in `docs/phase-05/hot-window-derivation.md`: the bug, the fix, the measured `otherFiles`, the exact command, the full preview result, and the verbatim not-written statement the plan required.

## Task Commits

Each task was committed atomically (via `/jja-commit`):

1. **Task 1: Tracer — count both trees, guard negatives, prove it on the real partitioned tree** - `17a33ad` (fix)
2. **Task 2: Run the real re-derivation end to end — preview only — and record it** - `a3bc960` (docs)

**Plan metadata:** (final commit hash recorded after this SUMMARY is written)

## Files Created/Modified

- `tools/derive-hot-window.mjs` — new `DEFAULT_DIST_ARCHIVE` export; `countOtherFiles` gains a third `archiveDir` parameter and a negative-result guard; `main()` passes `DEFAULT_DIST_ARCHIVE` explicitly
- `tests/unit/derive-hot-window.test.mjs` — new "countOtherFiles — WR-08 (05-15)" section, 5 tests
- `docs/phase-05/hot-window-derivation.md` — new "Re-derivation capability (05-15, 2026-10-02)" section
- `docs/phase-05/evidence/hot-window-rederive-20261002/` — 30 `day-YYYY-MM-DD.json` evidence files from the live preview run (created, not modified)

## Decisions Made

See `key-decisions` in frontmatter: `DEFAULT_DIST_ARCHIVE` is imported from `partition-archive.mjs`'s own `ARCHIVE_DIR` rather than a second hardcoded path; the negative guard fires on the combined total, not either tree individually; no `--write` was run, and the preview's differing achieved-coverage figure (78.6% vs. the original 92.7%, same 202-day cap) is recorded for information but changes nothing about the in-force window.

## RED Failure (quoted)

Task 1's RED was an import error rather than a failing assertion, because the new test file imports `DEFAULT_DIST_ARCHIVE`, which does not exist pre-fix — the whole suite fails to load before any assertion runs:

```
file:///home/jaime/www/_github/915tldr.com/tests/unit/derive-hot-window.test.mjs:32
  DEFAULT_DIST_ARCHIVE,
  ^^^^^^^^^^^^^^^^^^^^
SyntaxError: The requested module '../../tools/derive-hot-window.mjs' does not provide an export named 'DEFAULT_DIST_ARCHIVE'
```

This is the correct RED signal for this change — it's the direct manifestation of the pre-fix state (the export this fix adds doesn't exist yet), not an artificially induced intermediate failure. After implementing GREEN, all 34 tests in the file passed (29 pre-existing + 5 new).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were met without needing any Rule 1-3 auto-fixes.

## Issues Encountered

`CLOUDFLARE_API_TOKEN` was not present in `.dev.vars` (the plan's stated precondition source) — it is instead already exported in this machine's shell profile. The precondition ("`.dev.vars` provides `CLOUDFLARE_API_TOKEN`") is functionally met: `tools/lib/cf-graphql.mjs` reads the credential from `process.env` regardless of how it got there, and the plan's documented `set -a; . ./.dev.vars; set +a;` invocation was still run for fidelity (it contributed no conflicting value — `.dev.vars` doesn't define `CLOUDFLARE_API_TOKEN` at all, so sourcing it is a no-op for this variable). Not a blocker; disclosed for the record.

## Requirements status

**REND-10 is left `[ ]` / "Gaps Found" in `.planning/REQUIREMENTS.md`, unchanged by this plan**, per the repo's established gap-closure convention (05-13, 05-14 both did the same) — final requirement closure is 05-21's job, after all remaining gap-closure plans (05-16 through 05-20) land. That said, for the record: **05-VERIFICATION.md's REND-10 gap listed exactly one "missing" item** — "Count dist/client + dist/archive together (or otherwise account for partitioned pages) before the re-derivation path is exercised again" — **and this plan closes it**, with live evidence (D1-D5 in the `coverage` block above): the fix is in place, pinned by 5 regression tests, the real-tree count is a sane small integer, and the real non-probe re-derivation path now runs end to end against live Cloudflare analytics and exits 0, without touching the owner-approved 202-day window. No other blocking item for REND-10 was recorded anywhere in 05-REVIEW.md or 05-VERIFICATION.md.

## Next Phase Readiness

- REND-10's re-derivation capability is restored and live-proven; no further work against this specific gap is anticipated before 05-21's requirement-closure pass.
- `docs/phase-05/hot-window-derivation.md` now carries a second, up-to-date measurement of `otherFiles` (37) and a second live coverage-curve snapshot, available to 05-21 or any future hot-window revisit without re-running the live query.
- 05-16 through 05-20 remain open; this plan does not block any of them.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-02*

## Self-Check: PASSED

- FOUND: tools/derive-hot-window.mjs
- FOUND: tests/unit/derive-hot-window.test.mjs
- FOUND: docs/phase-05/hot-window-derivation.md
- FOUND: docs/phase-05/evidence/hot-window-rederive-20261002/day-2026-09-02.json
- FOUND: .planning/phases/05-hybrid-archive-zero-reads-proof/05-15-SUMMARY.md
- FOUND: 17a33ad (Task 1 commit)
- FOUND: a3bc960 (Task 2 commit)

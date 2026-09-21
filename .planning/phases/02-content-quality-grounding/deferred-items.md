# Phase 2 — Deferred Items (Out-of-Scope Discoveries)

Issues discovered during execution that are NOT directly caused by the current task's own
changes, and are therefore not auto-fixed per the executor's scope-boundary rule. Logged here
rather than fixed silently.

## Plan 02-09

- **`pnpm format:check` fails on 3 pre-existing files not touched by 02-09**:
  `tests/grounding/fixture-set.test.ts`, `tests/grounding/judge.test.ts`,
  `tests/grounding/verbatim-overlap.test.ts` (all committed in earlier plans — 02-07/02-08,
  confirmed via `git log` showing no uncommitted changes to any of the three during 02-09's
  execution). Out of scope for 02-09 to fix; note for whichever later plan next touches those
  files, or a dedicated formatting cleanup pass.

# 2026-09-22 - Permanent negative fixtures prove the D1-import assertion actually rejects

**Keywords:** [TESTING] [SECURITY] [BACKEND] [CRITICAL]
**Session:** Afternoon, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1342_phase-03-02-d1-negative-fixtures.md`

## What Changed

- File: `tests/ci-fixtures/assert-no-d1.test.mjs` (new)
  - 4-case `node:test` suite driving the real `assertNoD1Plugin().buildEnd` hook directly against
    a synthesized Rollup PluginContext stub
  - Case 1 (ARCH-02): a page-shaped fixture that reaches `d1-client.ts` transitively through a
    helper module is rejected
  - Case 2 (ARCH-03): an island-shaped fixture that reaches `d1-client.ts` transitively through a
    `.vue` component is rejected, and the message names the `.vue` file specifically
  - Case 3 (T-03-06 control): a clean fixture importing only a harmless helper is accepted —
    proves the checker does not reject everything
  - Case 4 (D-06 non-vacuity / A1 regression guard): a build matching zero page/island/middleware
    candidates fails loudly in an isolated child process, never silently
  - Module graph fed to the stub is built by reading each fixture's real `import` statements off
    disk (`buildGraph`), not hand-typed — an edit to a fixture's own import is reflected
    automatically
- File: `tests/ci-fixtures/page-with-d1-import.astro` (new) — deliberate ARCH-02 violation fixture
- File: `tests/ci-fixtures/clean-page.astro` (new) — deliberate clean-control fixture
- File: `tests/ci-fixtures/island-wrapper.astro` (new) — deliberate ARCH-03 violation fixture, `.astro` wrapper
- File: `tests/ci-fixtures/island-with-d1-import.vue` (new) — deliberate ARCH-03 violation fixture, `.vue` component
- File: `tests/ci-fixtures/helper-reaching-d1.ts` (new) — shared transitive-violation helper, imports the real `src/lib/server/d1-client.ts`
- File: `tests/ci-fixtures/harmless-helper.ts` (new) — shared clean-control helper
- File: `tools/assert-no-d1.mjs`
  - Rejection message now reports the full BFS chain from entrypoint to forbidden module
    (`entry -> ... -> d1-client.ts`), not just the two endpoints — the previous message named
    only the entrypoint and the terminal forbidden module, which was silent about which
    intermediate `.vue`/`.ts` file the violation crossed through. This is the exact gap ARCH-03's
    island coverage needs to prove, and the new permanent fixture suite asserts on it directly.

## Why

Phase 2's CONT-06 defect is the precedent this whole task exists to prevent: 248 tests passed
while 253 production rows violated the requirement, because a check existed but had silently
stopped gating. 03-01 built `tools/assert-no-d1.mjs` and proved it worked once, by hand, against
one real build. This task turns that one-time proof into something that runs — and can fail — on
every commit, with negative fixtures for both the page-shaped and island-shaped violation, plus a
non-vacuity guard for the specific way this exact checker could go quietly blind (matching zero
entrypoints after an Astro upgrade changes its resolved module-id shape).

## Issues Encountered

The original error message only named the entrypoint and the terminal forbidden module, not any
intermediate file the walk passed through. This meant the island case's rejection message could
not be asserted to name `island-with-d1-import.vue` specifically — a checker that only ever
reports "some entrypoint eventually reaches d1-client.ts" doesn't actually demonstrate ARCH-03's
`.astro` -> `.vue` boundary-crossing coverage; it just demonstrates *a* violation was found
somewhere. Fixed by tracking the BFS parent chain and reporting it in full.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: all 4 cases pass in isolation (`node --test tests/ci-fixtures/assert-no-d1.test.mjs`); `pnpm build` still exits 0 and does not pick up any fixture (fixtures live entirely outside `src/`); the full Phase 1 unit suite (43 tests) still passes unmodified
- One-time manual control inversion performed by hand: temporarily pointed `clean-page.astro`'s
  import at `helper-reaching-d1.ts` (the violating helper) instead of `harmless-helper.ts`, reran
  the suite, confirmed Case 3 flips to a rejection (`AssertionError: a clean tree must not be
  rejected ... true !== false`), then reverted the fixture back to its clean import and confirmed
  all 4 cases pass again. This confirms Case 3's PASS is caused by the clean import, not by the
  checker accepting every input unconditionally (T-03-06).
- What wasn't tested: a full `astro build` invocation of the fixture tree (deliberately — the
  plugin's `buildEnd` hook is invoked directly against a synthesized module graph instead, per
  03-02-PLAN.md's explicit instruction, to stay inside the 90-second feedback ceiling); this
  decision and its rationale are recorded in full in `03-02-SUMMARY.md`

## Next Steps

- [ ] Task 2 of 03-02: the config guard (`tools/check-config-guards.mjs`) for the D1-binding gap
      the module-graph walk cannot see by construction
- [ ] Task 3 of 03-02: wire `guard:config` and `test:build-gate` into `package.json`'s `test:unit`

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** HIGH - closes the D-06 gap (permanent CI proof, not a one-time demonstration) for the
project's core architectural guarantee (zero D1 reads on the public request path)

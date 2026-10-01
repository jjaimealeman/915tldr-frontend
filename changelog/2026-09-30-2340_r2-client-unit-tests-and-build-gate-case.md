# 2026-09-30 - Unit tests for r2-client.ts key discipline/secret hygiene, plus a build-gate case proving the Worker guard covers it

**Keywords:** [BACKEND] [TESTING] [SECURITY] [ARCHITECTURE]
**Session:** Late evening, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2340_r2-client-unit-tests-and-build-gate-case.md`

## What Changed

- File: `tests/unit/r2-client.test.mjs` (new)
  - 26 tests pinning `assertArchiveKey`'s full accept/reject matrix (including traversal,
    uppercase, leading-slash, unknown-prefix, trailing-garbage, and empty-string rejections,
    each proven to never reach the fake `send()`), `putObject`'s exact `PutObjectCommand`
    shape, `headObject`'s not-found-returns-null and other-error-rethrows-with-code-only
    branches, `deleteObjects`' 1,000-key batching (2,500 keys -> 3 batched commands), the
    secret-hygiene guarantee (a `send()` rejection whose message embeds a sentinel secret never
    leaks it into the thrown error), and `hasR2Credentials`' all-three-required behavior.
- File: `tests/ci-fixtures/helper-reaching-r2.ts` (new)
  - Fixture mirroring `helper-reaching-kv.ts`'s shape: imports the real `r2-client.ts` directly.
- File: `tests/ci-fixtures/worker-with-r2-import.ts` (new)
  - Fixture mirroring `worker-with-kv-import.ts`'s shape: a Worker entrypoint reaching
    `r2-client.ts` transitively through the helper above.
- File: `tests/ci-fixtures/assert-no-d1.test.mjs`
  - Registered both new fixtures in `FIXTURE_ID_MAP` (mapped to the same synthetic
    `src/worker.ts` id `worker-with-kv-import.ts` already uses — safe, since each scenario
    builds its own fresh module graph) and added Case 9 (T-05-08), proving the existing
    directory-wide guard rejects a Worker-shaped fixture reaching `r2-client.ts` — a module the
    guard was never specifically written for, since `r2-client.ts` postdates the T-03-02a
    directory-wide fix.

## Why

Proves two things the build-time R2 client must never do: write outside its four allowed
archive key shapes, and leak its own credentials through a thrown error — plus proves the
module-graph build-gate guard's whole-directory scope covers a brand-new module placed under
`src/lib/server/` automatically, with zero changes to `tools/assert-no-d1.mjs` itself.

## Issues Encountered

No major issues encountered. One disclosed TDD-process note, not a bug: the full test suite
passed on its first run against the implementation already written and committed in this same
plan's prior (Task 3) commit, rather than genuinely failing first against not-yet-written code —
see this plan's SUMMARY.md "TDD Gate Compliance" section for the honest accounting (same
disclosed pattern as 05-04's own SUMMARY).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the full `assertArchiveKey` accept/reject matrix, `putObject`/`headObject`
  request shapes and error branches, `deleteObjects` batching, secret-hygiene, and
  `hasR2Credentials`. The new build-gate case (`node --test tests/ci-fixtures/assert-no-d1.test.mjs`).
- What wasn't tested: `getText`/`getJson`/`putJson`/`listKeys` have no dedicated unit test in
  this commit — `putJson`/`getJson` are thin wrappers over `putObject`/`getText`, and
  `listKeys`'s pagination loop is exercised only implicitly; flagged here rather than silently
  assumed covered.
- Edge cases: traversal, uppercase, leading-slash, unknown-prefix, trailing-garbage and
  empty-string keys are all explicitly covered by named tests.

## Next Steps

- [ ] 05-07 (archive sync): the real caller of `createArchiveStore` — will exercise `getJson`/
      `putJson`/`listKeys` against real archive-tier content for the first time.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - test-only change plus a fixture addition; no production code path affected.

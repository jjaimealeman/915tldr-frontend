# 2026-09-27 - Failing tests for article-redirect and the Worker (04-06 Task 1, RED)

**Keywords:** [TESTING] [FEATURE] [SECURITY] [BACKEND]
**Session:** Morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0904_04-06-worker-redirect-tests-red.md`

## What Changed

- File: `tests/unit/article-redirect.test.mjs` (new)
  - Coverage for `extractArticleUuid` (case-insensitive uuid extraction, `/article/<uuid>`,
    trailing slash, `.html` suffix, no-uuid paths, D-09 short-id rejection, malformed
    percent-encoding) and `resolveRedirect` (redirect to canonical, loop guard on the canonical
    path itself, invalid/null entry, stale schema version, slug containing `/`, invalid
    category, T-04-22 open-redirect safety)
- File: `tests/unit/worker.test.mjs` (new)
  - Coverage for the Worker's `fetch` handler: 301 with canonical Location + original query
    string on a non-canonical hit (exactly one KV call), uuid-less fallthrough to
    `env.ASSETS.fetch` with zero KV calls, KV-throw fallthrough (never a 500), non-GET
    fallthrough, not-found-entry fallthrough
- File: `src/lib/article-redirect.ts` (new, stub)
  - `extractArticleUuid`/`resolveRedirect` both throw `not implemented` — RED phase only
- File: `src/worker.ts` (new, stub)
  - Default `fetch` export throws `not implemented` — RED phase only

## Why

Phase 4 Plan 06, Task 1 (`tdd="true"`): this project's first Worker (D-08) needs a pure,
independently-tested redirect-decision module before the Worker itself is written, since the
Worker's own request path is capped at 5ms CPU and must stay trivially small. Test-first per the
plan's own instruction.

## Issues Encountered

None — both test files were confirmed genuinely RED (`node --test
tests/unit/article-redirect.test.mjs tests/unit/worker.test.mjs`, all 21 cases failing with
`Error: not implemented`) before this commit, per the TDD gate.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/article-redirect.test.mjs tests/unit/worker.test.mjs`
  — 21/21 failing as expected (RED)
- What wasn't tested: nothing runs yet against real implementations — that's the immediately
  following GREEN commit
- Edge cases: none applicable yet (stub phase)

## Next Steps

- [ ] GREEN commit: implement `extractArticleUuid`/`resolveRedirect` and the real Worker `fetch`
      handler so all 21 tests pass
- [ ] Task 2: wire the Worker into `wrangler.jsonc` and extend `tools/assert-no-d1.mjs`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-only + stub scaffolding, no behavior shipped yet

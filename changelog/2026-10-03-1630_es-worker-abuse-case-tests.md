# 2026-10-03 - Abuse-case tests pin the /es Worker against open redirect, key injection and Accept-Language/Cookie selection

**Keywords:** [BACKEND] [TESTING] [SECURITY]
**Session:** Afternoon, Duration (~30 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1630_es-worker-abuse-case-tests.md`

## What Changed

- File: `tests/unit/article-redirect.test.mjs`
  - Added two open-redirect tests (T-06-06): `/es//evil.example/...` and `/es/%2F%2Fevil.example/...`
    both redirect to a clean `/es/<category>/...` location with no `//` and no host — the
    Location is still built only from validated manifest fields via `articlePath`
- File: `tests/unit/archive-route.test.mjs`
  - Added `/es/tag/<slug>` language-match, path-traversal (`%2e%2e`), empty-slug and
    `/es/tags`-index-page rejection tests (T-06-08)
  - Added malformed-language tests for `articleArchiveKey`/`tagArchiveKey` — trailing whitespace
    and uppercase both throw (T-06-07: closed enum, no trimming or case-folding)
- File: `tests/unit/worker.test.mjs`
  - Added a malformed-percent-encoding fallthrough test for `/es/%E0%A4%A` (zero KV reads)
  - Added a broader Accept-Language/Cookie equivalence sweep across `/`, an archived English
    article, an archived Spanish article and a non-canonical `/es` path (T-06-09/D-13)

## Why

06-02-PLAN.md Task 2 pins the language-aware Worker (shipped in Task 1) against its named threat
register entries (T-06-06..T-06-10): open redirect via a crafted `/es` path, R2 key injection via
a malformed language value, path traversal through `/es/tag/<slug>`, and any form of automatic
language selection from request headers or cookies. All tests pass against Task 1's
implementation unchanged — the existing `articlePath`-only Location construction, the closed
`assertLanguage` enum, and the header-free Worker already satisfied every abuse case; no
implementation deviation was needed.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in Task 2 has a named passing test. Full suite run:
  `node --test` on the three touched unit files (79/79 pass), `pnpm run test:fast` (809/809 pass),
  `pnpm run test:build-gate` (9/9 pass). The acceptance-criteria grep
  (`headers\.get\(|request\.cf|cookie` across `src/worker.ts`, `src/lib/article-redirect.ts`,
  `src/lib/archive/archive-route.ts`, excluding comments) prints nothing, confirming no header,
  geo or cookie read exists anywhere in the Worker's import graph.
- What wasn't tested: live production behavior (no `/es` content is deployed yet — this phase's
  later plans wire the route tree and backfill content).
- Edge cases: doubled-slash and percent-encoded-slash open-redirect attempts, uppercase/
  whitespace-padded language values, `/es/tag/` with no slug, `/es/tags` (the index page).

## Next Steps

- [ ] Later Phase 6 plans: write Spanish manifest entries and `article_translations` content,
      wire the `/es` route tree, and run the D-10 archive backfill

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** LOW - test-only commit; no production behavior change (Task 1 already implemented
the behavior these tests pin).

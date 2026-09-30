# 2026-09-26 - Todo filed: tracer test fails on apostrophes in titles

**Keywords:** [TESTING] [PLANNING]
**Session:** Afternoon, Duration (~0.1 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1420_todo-tracer-html-entity-title.md`

## What Changed

- File: `.planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md`
  - New todo, `resolves_phase: 4`: `test:tracer` compares the raw D1 title against HTML that Astro escapes (`'` → `&#39;`)

## Why

The bug was only recorded in the Phase 3 completion changelog, which the Phase 4 planner doesn't read. A pending todo tagged to Phase 4 shows up in `/gsd-progress` and closes itself when Phase 4 completes.

## Issues Encountered

No major issues encountered

## Dependencies

No dependencies added

## Testing Notes

- What was tested: nothing. This commit only records the bug.
- What wasn't tested: the fix
- Edge cases: titles containing `&`, `<` and `"` escape the same way

## Next Steps

- [ ] Phase 4: compare escaped titles in the tracer's successor test

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** Low. Planning record only.

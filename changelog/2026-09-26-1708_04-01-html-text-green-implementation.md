# 2026-09-26 - GREEN: implement html-text decodeEntities/textOf

**Keywords:** [TESTING] [BUG_FIX]
**Session:** Afternoon, phase 04 plan 01 execution (TDD Task 2, GREEN half)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1708_04-01-html-text-green-implementation.md`

## What Changed

- File: `tests/helpers/html-text.mjs` (new)
  - `decodeEntities(html)` — decodes the named entities Astro's default text escaping produces
    (`&amp; &lt; &gt; &quot; &#39;`), plus generic numeric decimal/hex entities (`&#x27;` included
    explicitly)
  - `textOf(html)` — strips HTML tags, then decodes entities

## Why

Makes the RED commit's `tests/unit/html-text.test.mjs` pass. This helper is what the rewritten
`tests/tracer/tracer.test.mjs` (later in this same task) uses to compare a live D1 title against
rendered HTML by decoding both sides, instead of comparing raw D1 text against Astro-escaped HTML
— the exact bug in the folded todo
`.planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md`.

## Issues Encountered

None.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/html-text.test.mjs` — 5/5 passing
- What wasn't tested: entities beyond the five Astro's default escaper produces plus the hex
  apostrophe form (deliberately scoped — this is not a general HTML entity decoder)
- Edge cases: apostrophe + ampersand combined, hex entity form, tag-stripping combined with entity
  decoding

## Next Steps

- [ ] Continue Task 2: `tests/unit/d1-client.test.mjs`, `tests/unit/articles-loader-window.test.mjs`,
      update `tests/unit/manifest-schema.test.mjs` fixtures for schema v2, rewrite
      `tests/tracer/tracer.test.mjs`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-helper-only change, no application code affected

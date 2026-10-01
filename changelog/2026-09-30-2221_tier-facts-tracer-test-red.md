# 2026-09-30 - Add the tier-facts tracer test (RED)

**Keywords:** [TESTING] [BACKEND] [PLANNING]
**Session:** Evening, Duration (~5 min, part of a longer session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2221_tier-facts-tracer-test-red.md`

## What Changed

- File: `tests/unit/tier-facts.test.mjs`
  - New dist-based test suite (skips cleanly when `dist/client` or the tier-facts files are
    absent, same pattern as `tests/unit/listing-pages.test.mjs`)
  - Asserts one article tier fact per built article HTML file, with a valid uuid/path/publishedAt
  - Asserts tag tier fact count matches `.astro/tag-build-log.json`'s authoritative tag count,
    each with a valid slug and a positive full (uncapped) article count
  - Asserts `node tools/tier-report.mjs --json` exits 0 and classifies `tags.hot` as the count of
    tags with `count >= 10`, with `hotWindow.provisional` true

## Why

Phase 5 (Hybrid Archive & Zero-Reads Proof) needs a decision layer for which articles and tags
stay static vs. move to R2. This is the RED half of plan 05-01's Task 1 tracer: the test is
written against `src/lib/archive/tier-facts.ts` and `tools/tier-report.mjs`, neither of which
exist on disk yet in this commit — importing the test module fails until the next (GREEN) commit
implements them.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the test file itself is the artifact under test here — it is expected to fail
  (module not found) until the implementation commit lands.
- What wasn't tested: nothing yet; the GREEN commit proves it against a real `pnpm run build`.
- Edge cases: none covered by this commit alone.

## Next Steps

- [ ] Implement `src/lib/archive/{tiering,hot-window,tier-facts}.ts`, `hot-window.json`,
      `tools/tier-report.mjs`, and wire `writeArticleFacts`/`writeTagFacts` into the article and
      tag routes (GREEN commit)

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW — test-only change, no runtime behavior yet

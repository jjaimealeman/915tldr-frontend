# 2026-09-26 - Lock the tracer slice: d1-client stitch, loader window, manifest v2, entity-safe tracer

**Keywords:** [TESTING] [BACKEND] [DATABASE] [BUG_FIX]
**Session:** Afternoon, phase 04 plan 01 execution (Task 2, remainder)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1720_04-01-lock-slice-with-unit-and-tracer-tests.md`

## What Changed

- File: `tests/unit/d1-client.test.mjs` (new)
  - Pins `fetchPublicArticlesWindow()`'s stitch rules (processed+non-duplicate+categorized ->
    public; duplicate/not-processed/no-category -> the correct `nonPublic` reason), `chunkIds()`
    100-param chunking for a 250-id window, `rowsRead` summation across every statement, the
    throw-on-missing-`meta.rows_read` guarantee, and `key_points` JSON parsing (array, null,
    malformed-naming-the-uuid) — all via a stubbed sequential `fetchImpl`, no real D1 access
- File: `tests/unit/articles-loader-window.test.mjs` (new)
  - Drives the real `articlesLoader()` against a minimal Map-backed fake `LoaderContext`
    (store/meta), pinning: `SYNC_WINDOW_SECONDS` is 3 days, `fetchWindow` is called with
    `since = now() - SYNC_WINDOW_SECONDS`, public rows are stored with a digest, a non-public uuid
    already in the store is deleted, an empty store after sync throws naming "store is empty"
    (D-14), and `writeManifest` is called only with changed entries (unchanged digest excluded),
    each carrying `schemaVersion: "2"` and `slug`
- File: `tests/unit/manifest-schema.test.mjs`
  - Fixtures now carry `slug` (this file's `makeRow()` was failing against Task 1's schema-v2
    change before this commit — 3 pre-existing test failures, confirmed by running the suite
    unmodified first)
  - Added: missing-slug rejection, uppercase-slug rejection, slash-in-slug rejection,
    `MANIFEST_SCHEMA_VERSION === '2'`, and a drift guard comparing the exported
    `RENDER_MANIFEST_NAMESPACE_ID` against the `RENDER_MANIFEST` binding id actually committed in
    `wrangler.jsonc` (comments stripped via `tools/check-config-guards.mjs`'s `stripComments`)
- File: `tests/tracer/tracer.test.mjs` (rewritten)
  - Replaced the single-hand-picked-article D-02 tracer (which asserted exactly one
    `index.html`, a shape `build.format: 'file'` no longer produces) with a corpus-sampling
    version: at least one article HTML file exists, every emitted filename's slug segment matches
    `ARTICLE_SLUG_RE`, and up to 3 sampled files each get a live KV manifest check (`schemaVersion
    === '2'`, `slug` equal to the filename's slug) plus a decoded-title round-trip check via the
    new `tests/helpers/html-text.mjs` — reading the title straight from the page's own `<h1>`
    (manifest-independent) and confirming it decodes and appears in the page's decoded text,
    never comparing raw D1 text against Astro's HTML-escaped output
  - Added a `TRACER_LIVE_ORIGIN`-gated live check: the canonical path returns 200 with no
    `Location` header, and the trailing-slash variant returns one 3xx whose `Location` resolves
    back to the no-slash path

## Why

Locks the Task 1 tracer slice down with characterization tests before any expansion plan builds
on it, and folds the pending todo
`.planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md` (tracer test breaking on a
title containing an apostrophe or ampersand) into the rewrite rather than leaving it as a
separate, still-open bug.

## Issues Encountered

`tests/unit/manifest-schema.test.mjs` was genuinely red before this commit — its fixtures
predated Task 1's `MANIFEST_SCHEMA_VERSION` bump to `'2'` (which requires `slug`), so 3 of its 25
existing tests failed until this commit's fixture update. Confirmed by running
`node --test tests/unit/manifest-schema.test.mjs` unmodified before editing it. Every other new
test file passed on first run against Task 1's already-implemented code — no other Task 1 defects
were exposed.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: all four unit files (`node --test tests/unit/html-text.test.mjs
  tests/unit/d1-client.test.mjs tests/unit/articles-loader-window.test.mjs
  tests/unit/manifest-schema.test.mjs`) — 52/52 passing, no network access; the rewritten tracer
  test both locally (`node --test tests/tracer/tracer.test.mjs`, live KV only) and live
  (`TRACER_LIVE_ORIGIN=https://dev.915tldr.com node --test tests/tracer/tracer.test.mjs`) — 5/5
  passing
- What wasn't tested: `pnpm run test:fast` (the package.json script Task 3 adds) and
  `docs/phase-04/spikes.md` (Task 3, not yet executed at this commit)
- Edge cases: a 250-article-id window's category/tag IN-list chunking at exactly the 100-param
  D1 ceiling (100/100/50 split), a digest-unchanged article correctly excluded from a manifest
  bulk-write, key_points as a JSON array / null / malformed JSON naming the offending uuid

## Next Steps

- [ ] Task 3: the Loader-throw-fails-build spike, warm-window cost and trailing-slash findings
      recorded in `docs/phase-04/spikes.md`, and the `test:fast` package.json script

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - test-only change (plus fixing 3 pre-existing failing tests against Task 1's schema change), locks down the Phase 4 tracer slice before expansion plans build on it

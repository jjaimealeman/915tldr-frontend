# 2026-10-03 - Language-aware article-url/redirect/archive-route/worker for /es archive-tier serving

**Keywords:** [BACKEND] [FEATURE] [TESTING] [SECURITY]
**Session:** Afternoon, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1600_language-aware-es-archive-tier-worker.md`

## What Changed

- File: `src/lib/article-url.ts`
  - Added the closed `LANGUAGES = ['en', 'es']` enum, `Language` type, `isLanguage`, `assertLanguage` (throws, never coerces), `SPANISH_PREFIX`, `languageOfPath` (case-sensitive, exact-first-segment `/es` detection), and `localizedPath`
  - `articlePath` gained a 4th `language: Language = 'en'` parameter; builds the `/es`-prefixed canonical via `localizedPath`
  - No `src/lib/server/` imports added — module stays Worker-safe
- File: `src/lib/article-redirect.ts`
  - `resolveRedirect` now derives `language` from the pathname alone (`languageOfPath`) and threads it into the canonical-path comparison and the returned `canonical` decision
  - `RedirectDecision`'s `canonical` variant gained a `language` field
- File: `src/lib/archive/archive-route.ts`
  - Added `ARCHIVE_ES_PREFIX = 'es/'`
  - `articleArchiveKey`/`tagArchiveKey` take an optional `language` parameter (default `'en'`, existing keys unchanged); both validate via `assertLanguage`
  - `matchTagPath` now matches `/es/tag/<slug>` in addition to `/tag/<slug>` and reports `language` on the match
- File: `src/worker.ts`
  - Tag-suffix 307 redirect and archived-serve branches now build the Location/R2 key using the detected language
  - The one `RENDER_MANIFEST.get` KV read stays keyed by `manifest:${uuid}` alone (shared translation-group identity entry) — still exactly one KV read per request
- File: `tests/unit/article-url.test.mjs` (new)
  - Full coverage for `LANGUAGES`/`isLanguage`/`assertLanguage`/`languageOfPath`/`localizedPath`/`articlePath`'s new parameter
- File: `tests/unit/article-redirect.test.mjs`
  - Updated 2 pre-existing assertions for the new `language` field on canonical decisions
  - Added `/es` canonical, non-canonical-`/es`-redirect, wrong-category, and doubled-`/es/es/` cases
- File: `tests/unit/archive-route.test.mjs`
  - Updated 3 pre-existing `matchTagPath` assertions for the new `language` field
- File: `tests/unit/worker.test.mjs`
  - Added `/es` archive-tier article/tag serving, non-canonical `/es` 301, and an Accept-Language-indifference test (D-13)
- File: `docs/phase-06/language-key-scheme.md` (new)
  - Records the no-change (KV manifest identity)/add-alongside (R2 archive keys) decision, the rejected `promote` alternative, the key table, reversibility rating, and the invariants the tests pin

## Why

Phase 6 (bilingual) research found that the render manifest and R2 archive tier were keyed on
article uuid alone, with no language dimension — an archived `/es` request would have silently
301-redirected to the English canonical. This is the tracer task (06-02 Task 1) that makes the
canonical-path builder, the Worker's redirect decision, and the R2 archive keys language-aware
before any Spanish page exists, so the fix lands before the Phase 6 backfill (D-10) depends on it.

## Issues Encountered

No major issues encountered. The implementation matched the plan's assumption-delta decision
(no-change for the KV identity entry, add-alongside for R2 keys) without needing a deviation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: every behavior bullet in 06-02-PLAN.md Task 1 has a named passing test —
  one-KV-read-per-request parity for `/es`, non-canonical `/es` redirect staying inside `/es`,
  unchanged English key shapes, `languageOfPath` prefix-adjacency edge cases
  (`/escuela`, `/es-mx`, `/ES`), and response-identity with/without an `Accept-Language` header.
  Full suite run: `node --test` on the four touched unit files (85/85 pass), `pnpm run test:fast`
  (799/799 pass), `pnpm run test:build-gate` (9/9 pass, confirms no new `src/lib/server/` reach
  from the Worker's import graph).
- What wasn't tested: abuse cases (open redirect via `/es//evil.example/...`, malformed-language
  key injection, path-traversal through `/es/tag/...`) — deferred to Task 2 of this plan per its
  own task split.
- Edge cases: doubled `/es/es/` prefix, wrong-category `/es/article/<uuid>`, uppercase/adjacent
  prefixes (`/ES`, `/es-mx`, `/escuela`).

## Next Steps

- [ ] Task 2 of 06-02-PLAN.md: abuse-case tests (open redirect, malformed language enum injection,
      Accept-Language/cookie indifference across more request shapes)
- [ ] Later phase-6 plans: write Spanish manifest entries and `article_translations` content,
      wire the `/es` route tree, and run the D-10 archive backfill

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - internal Worker/archive-tier plumbing for the upcoming Spanish launch; no
user-facing change yet (no `/es` content exists until later Phase 6 plans ship).

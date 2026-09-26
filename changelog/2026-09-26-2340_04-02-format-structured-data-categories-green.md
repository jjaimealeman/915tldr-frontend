# 2026-09-26 - GREEN: implement format.ts, structured-data.ts, categories.ts

**Keywords:** [FEATURE] [FRONTEND] [SEO] [BUG_FIX]
**Session:** Evening, phase 04 plan 02 execution (Task 1, GREEN half of the TDD pair)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-2340_04-02-format-structured-data-categories-green.md`

## What Changed

- File: `src/lib/format.ts` (new)
  - `TIME_ZONE = 'America/Denver'`; `formatBylineTime()` (AP-style byline, e.g. "Sept. 16, 1:06
    p.m.", with an optional `withYear` variant), `formatDateline()` ("Wednesday, September 16,
    2026"), `isoWithOffset()` (local wall time plus the zone's real UTC offset at that instant,
    via `Intl.DateTimeFormat`'s `longOffset`). Every function builds its output from
    `Intl.DateTimeFormat(..., { timeZone: TIME_ZONE }).formatToParts()` — never a host-zone getter
    or the Date locale-string convenience methods — so the same epoch renders identically
    regardless of the build machine's own time zone
- File: `src/lib/structured-data.ts` (new)
  - `SITE_NAME`, `SITE_ORIGIN`, `toSafeJsonLd()` (escapes `<`, `>`, `&`, and the line/paragraph
    separator code points after `JSON.stringify` so untrusted AI-generated text can never close a
    `<script type="application/ld+json">` element), `organizationNode()`, `websiteNode()`,
    `newsArticleNode()` (author/publisher always the site Organization's `@id`, never a Person;
    `isBasedOn` carries the original outlet; sorted `keywords`, omitted when empty),
    `breadcrumbNode()`
- File: `src/lib/categories.ts` (new)
  - `CATEGORIES` (the fixed 8-category nav list in the approved mockup order), `categoryName()`,
    `isKnownCategory()`

## Why

TDD GREEN half of Task 1 (`tdd="true"`) — makes the RED commit's two test files pass. These three
pure modules (no dependency on the D1-access boundary the rest of this project enforces) are the
formatting/schema/nav-list foundation every Phase 4 page template builds on, starting with
`Base.astro` in the next commit.

## Issues Encountered

Two real bugs found and fixed before landing, both caught by re-running the test suite rather than
assumed fixed:

1. **Escape-sequence corruption on write.** A single-backslash ` `/` `-style escape
   sequence typed directly into this session's file-write tool call gets silently decoded into the
   actual (invisible) Unicode character before it reaches disk — confirmed by `grep -P
   '[\x{2028}\x{2029}]'` finding the real characters embedded in the written file, which broke a
   regex literal (`Invalid regular expression: missing /`) and silently corrupted a doc comment
   (`<` became `<`). Fixed by building both code points via `String.fromCharCode(0x2028)` /
   `String.fromCharCode(0x2029)` at runtime instead of typing the escape sequence into source text
   — applied in both `structured-data.ts` and its test file, with a comment explaining why for the
   next editor. Double-backslash sequences (`'\\u003c'`, intentionally producing literal 6-character
   output) were unaffected and needed no change.
2. **Wrong hand-computed epoch-second test fixtures.** Two of the three epoch constants in
   `format.test.mjs` (for `2026-09-16T19:06:48Z` and `2026-09-16T18:00:00Z`) were off by ~2 hours —
   hand arithmetic, not the plan's own worked answer. Recomputed via `node -e "new
   Date('...').getTime()/1000"` and fixed; the third (`2025-12-15T20:00:00Z`) was already correct.
   `src/lib/format.ts` itself needed no change once the fixtures were right — first-run failures
   were bad test data, not a broken implementation.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/format.test.mjs tests/unit/structured-data.test.mjs` —
  22/22 passing. Acceptance greps also verified: `toLocaleString` count 0 in `format.ts`,
  `timeZone` count >=1 (5), and a directory-boundary comment-wording check (`lib/server`
  substring) count 0 in all three new files — the first two greps passed only after wording fixes
  to `format.ts`'s own comments (the acceptance grep is textual and doesn't distinguish code from
  a comment mentioning the string)
- What wasn't tested: Task 2's `Base.astro`/`ArticleCard.astro` consumption of these modules (next
  commit); `pnpm run build` (also Task 2)
- Edge cases: the full 12-month AP abbreviation table, `withYear`, winter vs. summer DST offset,
  TZ-independence via two real child `node` processes (`TZ=UTC` and `TZ=Asia/Tokyo`), JSON-LD
  round-trip through `JSON.parse` after escaping, keyword sorting and omission, `@id` uniqueness
  across two same-headline articles

## Next Steps

- [ ] Task 2: port the approved chrome into `Base.astro`, add `ArticleCard.astro`, extend
      `build-info.ts` with `resolveCommitDate()`, add `committedAt` to `/version.json`

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - new pure foundation modules with no visible behavior change yet (nothing
imports them until the next commit), but the escape-sequence write-corruption bug found here is a
process risk worth flagging beyond this file

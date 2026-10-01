# 2026-09-30 - Source slug validation guard (04-REVIEW WR-01)

**Keywords:** [SECURITY] [BACKEND] [TESTING]
**Session:** Evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1812_source-slug-guard-wr-01.md`

## What Changed

- File: `src/lib/article-url.ts`
  - Added `SOURCE_SLUG_RE` (identical shape to the existing `TAG_SLUG_RE`), exported from this
    shared module per the project's own bundler-safety convention (a frontmatter-local const can
    be silently dropped by Astro 7.3.3's bundler).
- File: `src/pages/source/[slug].astro`
  - `getStaticPaths()` now validates every source slug against `SOURCE_SLUG_RE` before it becomes
    a `dist/client/source/*.html` file name, throwing (naming the offending slug) on a mismatch —
    mirroring `tag/[slug].astro`'s existing `TAG_SLUG_RE` guard exactly.
- File: `tests/unit/listing-pages.test.mjs`
  - Added a direct regex unit test (`SOURCE_SLUG_RE` accepts lowercase-hyphen-digit slugs, rejects
    uppercase/path-traversal/slashes/empty string) and a real-build test proving every built
    `dist/client/source/*.html` file name satisfies the regex.

## Why

`04-REVIEW.md` (WR-01) flagged `source/[slug].astro` as the one route missing the slug-as-file-path
tampering guard the project's own documented threat model (T-04-18) requires — `tag/[slug].astro`
already enforces it, but `source/[slug].astro` passed D1's `sources.slug` straight into
`getStaticPaths()`'s `params` with no check at all. Practical exploitability is low today (`sources`
is a 3-row, migration-seeded table with no public write path), but the guard was asymmetric
relative to the project's own stated policy, and that premise erodes silently if a source is ever
added by hand without the same review tag slugs already receive.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `SOURCE_SLUG_RE`'s accept/reject behavior directly, and every real built source
  page file name against the same regex, via `pnpm run test:unit` (390/390 passing) and
  `pnpm run test:build-gate` (8/8), with all 04-followups changes applied together.
- What wasn't tested: the actual `throw` path inside `getStaticPaths()` (would require a malformed
  slug reaching the loader, which the 3 fixed, migration-seeded production sources never produce)
  — the regex itself is tested directly instead, matching this project's own established pattern
  for `TAG_SLUG_RE` (also untested at the throw-site, only exercised implicitly by production data).
- Edge cases: path-traversal (`../etc/passwd`), uppercase, slashes, and empty string all confirmed
  rejected.

## Next Steps

- [ ] None — this follow-up task is complete.

---

**Branch:** feature/fix/phase-04-followups
**Issue:** N/A
**Impact:** LOW - closes a documented policy-asymmetry gap; the fixed 3-row source table was never
practically exploitable, but the project's own threat model now holds for both slug types.

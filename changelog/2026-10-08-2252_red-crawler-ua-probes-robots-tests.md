# 2026-10-08 - RED: failing tests for crawler User-Agent probes and robots.txt group resolution

**Keywords:** [TESTING] [TOOLING]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2252_red-crawler-ua-probes-robots-tests.md`

## What Changed

- File: `tests/unit/verify-share-meta.test.mjs`
  - Added cases for `robotsRulesFor` (facebookexternalhit resolves to the `*` group, FacebookBot to its own group with Disallow `/`, case-insensitive token, shared groups, no `*` group means no rules), `isPathAllowed` (longest match wins, Disallow `/` blocks the card), `SCRAPER_USER_AGENTS`, and the per-crawler UA probes of the article page and the EN card through an injected fetch
  - The file fails to load until the tool exports these names
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-05 Task 2 (D-20, edge half), RED step of the TDD pair. The robots.txt case that matters is that `FacebookBot` (disallowed) must not be mistaken for `facebookexternalhit` (not named, falls under `*`).

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: confirmed RED, the test file fails with `does not provide an export named 'SCRAPER_USER_AGENTS'`
- What wasn't tested: the GREEN implementation (next commit)
- Edge cases: exact product-token match, merged groups, empty Disallow

## Next Steps

- [ ] GREEN: implement the exports and the UA/robots section of `runShareChecks`

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tests only

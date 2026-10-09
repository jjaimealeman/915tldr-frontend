# 2026-10-08 - GREEN: crawler User-Agent probes and robots.txt group resolution in verify-share-meta

**Keywords:** [FEATURE] [TOOLING] [TESTING]
**Session:** Night, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2253_green-crawler-ua-probes-robots-resolution.md`

## What Changed

- File: `tools/verify-share-meta.mjs`
  - Exported `SCRAPER_USER_AGENTS` (facebook, x, slack, whatsapp), documented as representative strings, not the platforms' own
  - Exported `robotsRulesFor(text, token)`: exact, case-insensitive product-token match, consecutive User-agent lines share a group, falls back to `*`, null group when nothing applies
  - Exported `isPathAllowed(rules, path)`: longest matching rule wins, Allow wins ties, `*` and `$` supported, empty Disallow ignored
  - `runShareChecks` now probes the article page and the EN card once per crawler User-Agent (a non-200 is a FAIL naming the crawler and status) and reports, per crawler token, which robots.txt group applies and whether `/`, the article and `/og-image.png` are allowed; the section is labelled edge-side only
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-05 Task 2 (D-20, edge half). The robots.txt file disallows `FacebookBot` and `meta-externalagent` but names no group for the link-preview crawlers, so they fall under `*`. The tool now states that from the file instead of from memory, without claiming it proves what the platforms' own fetchers receive.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 23 unit tests pass; `pnpm run test:fast` 1196 tests, 1182 pass, 0 fail, 14 skipped; a live read-only run against dev.915tldr.com shows every crawler UA getting 200 for the article page, 404 for the card (not deployed yet), and all four tokens resolving to group `*`
- What wasn't tested: the platforms' own crawlers; the UA strings are representative only
- Edge cases: FacebookBot versus facebookexternalhit, merged groups, wildcard patterns

## Next Steps

- [ ] Add the zone-analytics measurement tool (07-05 Task 3)

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tooling only

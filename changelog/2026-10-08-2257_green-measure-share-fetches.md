# 2026-10-08 - GREEN: measure-share-fetches reports who fetched the cards, with status and bytes, from zone analytics

**Keywords:** [FEATURE] [TOOLING] [SECURITY] [TESTING]
**Session:** Night, Duration (~20 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2257_green-measure-share-fetches.md`

## What Changed

- File: `tools/measure-share-fetches.mjs`
  - New. `buildShareFetchQuery` (host, paths and window validated and sent as GraphQL variables, never concatenated), `summariseShareFetches` (one row per path, raw User-Agent and status, with count, bytes per request and file size), `verifyShareFetchSchema` (rejects naming the first missing field), `fetchShareGroups`, and a live introspection helper that reads both `fields` and `inputFields`
  - CLI `--host`, `--since`, `--until`, `--paths`, `--json`; it introspects the real schema before every query and says the data is sampled
- File: `package.json`
  - Added the `measure:share` script
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-05 Task 3 (SOC-08, D-20). The human validator passes in 07-09 need the edge's own record of which crawlers fetched the cards and how many bytes they received. The zone's `httpRequestsAdaptiveGroups` dataset exposes the needed fields on this plan; the tool fails loudly if that changes. The token is read from the environment only, errors go through `redact()`, and the tool contains no mutation.

## Issues Encountered

`cf-graphql.mjs`'s `introspectType` reads only `fields`, which is empty for the filter input type, so the tool has its own introspection helper that also reads `inputFields`. The shared library is unchanged.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 9 unit tests pass; `pnpm run test:fast` 1205 tests, 1191 pass, 0 fail, 14 skipped; live read-only queries passed the schema check and showed a dev-host `/version.json` request in analytics within about 74 seconds
- What wasn't tested: real crawler traffic against deployed cards (nothing is deployed yet)
- Edge cases: 304 rows with zero bytes, token-shaped text in a GraphQL error, bad host and path arguments

## Next Steps

- [ ] Run `pnpm run measure:share` after 07-08 deploys the cards and the validators have fetched them (07-09)

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tooling only

# 2026-10-08 - RED: failing tests for the zone-analytics share-fetch measurement

**Keywords:** [TESTING] [TOOLING]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2254_red-measure-share-fetches-tests.md`

## What Changed

- File: `tests/unit/measure-share-fetches.test.mjs`
  - New. Cases for `buildShareFetchQuery` (host, paths and window travel in variables, never in the query text; argument validation; `until` defaults to now), `summariseShareFetches` (one row per path, raw user agent and status; bytes per request; file size; sort order), `verifyShareFetchSchema` (resolves, or rejects naming the first missing field) and `fetchShareGroups` (bearer token sent, GraphQL error comes back redacted)
  - GraphQL is faked through an injected fetch, so the suite never touches the network
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-05 Task 3 (SOC-08, D-20), RED step. The measurement must report what Cloudflare counted and fail loudly on a schema gap rather than estimate.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: confirmed RED, the suite fails with `ERR_MODULE_NOT_FOUND` for `tools/measure-share-fetches.mjs`
- What wasn't tested: the implementation (next commit)
- Edge cases: 304 rows with zero bytes, a token-shaped string inside a GraphQL error message

## Next Steps

- [ ] GREEN: implement `tools/measure-share-fetches.mjs` and the `measure:share` script

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tests only

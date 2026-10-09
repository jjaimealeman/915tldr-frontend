# 2026-10-08 - RED: failing tests for the og:image origin build guard

**Keywords:** [TESTING] [SECURITY] [CONFIG]
**Session:** Night, Duration (~5 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2231_red-share-origin-guard-tests.md`

## What Changed

- File: `tests/unit/share-origin-guard.test.mjs`
  - Pure-function cases for `customDomainHosts()` (real wrangler.jsonc, key order, non-custom-domain routes, commented-out routes)
  - `checkShareOrigin()` cases: clean on the real file, and one `SOC-05-ORIGIN` violation each for http, path, port, credentials, query, trailing slash, host mismatch, unparseable, no custom_domain route, and two custom_domain routes
  - CLI cases: exit 0 with the ok line on the real repo, exit 1 for a temp wrangler file whose custom domain is 915tldr.com

## Why

TDD RED step for the D-21 guard: the og:image origin is a committed constant that must equal the Worker's single primary custom domain, otherwise cards keep pointing at the dev host after cutover. The tests fail now because `tools/assert-share-origin.mjs` does not exist yet (ERR_MODULE_NOT_FOUND).

## Issues Encountered

No major issues encountered. The failure observed is the intended one (module missing).

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `node --test tests/unit/share-origin-guard.test.mjs` fails with ERR_MODULE_NOT_FOUND, as required for RED
- What wasn't tested: the implementation (next commit)
- Edge cases: more than one custom_domain route always fails, even when one matches

## Next Steps

- [ ] GREEN: implement `tools/assert-share-origin.mjs` and wire it into `guard:config`

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - test file only; `pnpm run test:fast` is red until the GREEN commit

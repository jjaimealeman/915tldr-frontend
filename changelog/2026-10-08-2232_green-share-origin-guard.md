# 2026-10-08 - GREEN: build guard ties the og:image origin to the single custom domain

**Keywords:** [FEATURE] [SECURITY] [CONFIG] [TESTING]
**Session:** Night, Duration (~10 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2232_green-share-origin-guard.md`

## What Changed

- File: `tools/assert-share-origin.mjs`
  - New guard (D-21): `SHARE_IMAGE_ORIGIN` must be a bare https origin and its host must equal the one `custom_domain` route in `wrangler.jsonc`
  - Exports `customDomainHosts()` (comment-stripped, key-order independent) and `checkShareOrigin()`; fails on zero or more than one custom domain routes
  - CLI prints `[assert-share-origin] ok: ...` or one `[SOC-05-ORIGIN]` line per violation, exit 0 or 1
- File: `package.json`
  - `guard:config` now runs `node tools/check-config-guards.mjs && node tools/assert-share-origin.mjs`, so every `pnpm build` (including Workers Builds) runs the guard first

## Why

The og:image origin is a committed constant, not Astro.site, so that cards can be validated on the dev host. Without a guard, the constant would silently keep pointing at the dev host after the route moves to 915tldr.com at cutover. The guard forces the constant to follow, which re-renders every page because the constant is module code. It is a separate script because `tests/unit/astro-config.test.mjs` spawns `check-config-guards.mjs` against temp wrangler files with no custom domain.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 17 new guard tests pass; `pnpm run guard:config` exits 0 with the ok line; `astro-config` and `ci-build` suites still pass (91); `pnpm run test:fast` 1111 tests, 0 failures
- What wasn't tested: a real `pnpm build` (forbidden, writes production KV), so the guard running as the build's first step is shown by the script wiring only
- Edge cases: two custom domains where one matches still fails; commented-out routes are ignored

## Next Steps

- [ ] At cutover change `SHARE_IMAGE_ORIGIN` to `https://915tldr.com` (carried by the 07-09 Phase 12 todo)
- [ ] 07-02: the card PNG files

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** MEDIUM - every build now runs a new guard

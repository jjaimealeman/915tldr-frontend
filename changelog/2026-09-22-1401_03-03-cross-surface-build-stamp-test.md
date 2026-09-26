# 2026-09-22 - Permanent test proves /version.json and the footer cannot disagree

**Keywords:** [TESTING] [SECURITY] [BACKEND]
**Session:** Afternoon, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1401_03-03-cross-surface-build-stamp-test.md`

## What Changed

- File: `tests/unit/build-stamp.test.mjs` (new)
  - 8-case `node:test` suite for `src/lib/build-info.ts` and its two consuming surfaces
  - `resolveBuildHash(env)` unit cases (no build required): `WORKERS_CI_COMMIT_SHA` present ->
    `workers-ci`; absent + `CI` present -> `unknown` (fallback refused); absent + `WORKERS_CI`
    present (no `CI`) -> also `unknown`; no CI markers -> `local-git` with a valid 7-char hex
    hash; `BUILD_TIMESTAMP` is a valid, round-trippable ISO 8601 string
  - Cross-surface cases (real build required): `dist/client/version.json`'s `commit` appears
    verbatim in the built article's `data-build` element; the footer's rendered date matches
    `version.json`'s `builtAt` date; exactly one `data-build` element exists in the built page.
    These read the two *emitted artifacts* directly, not the shared module twice — a hardcoded
    footer is confirmed (by hand, see Testing Notes) to fail the first two cases
  - Cross-surface cases skip with an explicit named reason (`dist/client/version.json not found
    — run pnpm build first`) when `dist/` hasn't been built — never a silent pass
- File: `package.json`
  - `test:unit` now runs `pnpm run build` before the `node --test` glob, so the cross-surface
    skip path is not the one `pnpm test:unit` normally takes

## Why

03-03-PLAN.md's own warning: a test that re-reads the shared build-info constant for "both"
surfaces would pass even if the footer rendered nothing at all. This suite instead reads the
real `dist/client/version.json` and a real built `index.html`, so it proves the two surfaces
this project actually ships — not just the module they're both supposed to import from — agree.

## Issues Encountered

None. `resolveBuildHash`'s `env` parameter only gates which of the three resolution branches
runs; it does not control what environment the `git rev-parse` child process itself sees (that's
always the real `process.env`), which is correct — the exported pure function's contract is the
resolution *order*, not process isolation, and the local-git case only needs the test to run
inside a real git working tree, which `pnpm test:unit`/`node --test` both do.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/build-stamp.test.mjs` — 8/8 pass against a real build;
  `pnpm test:unit` — 64/64 (56 prior + 8 new), picked up via the existing glob with no config
  change beyond the new `pnpm run build` step; `pnpm test:build-gate` — 4/4 unaffected
- Skip-path check performed by hand: renamed `dist/` aside (never deleted — this repo's own
  destructive-command rules forbid `rm -r` on directories), reran the suite standalone, confirmed
  all three cross-surface cases report the named skip reason rather than a silent pass or a
  false failure, then restored `dist/`
- One-time hardcoded-footer inversion performed by hand (03-03-PLAN.md's required control):
  temporarily replaced the footer's `{BUILD_HASH} · {buildDate}` interpolation with the literal
  string `0000000 · 2026-09-16`, rebuilt, reran the suite — the commit-agreement and
  date-agreement cross-surface cases both failed with the expected `AssertionError` (the
  exactly-one-`data-build` case still passed, correctly, since that case doesn't check content).
  Reverted the edit, confirmed `git diff --stat src/layouts/Base.astro` was empty, rebuilt, reran
  — all 8 cases pass again. This confirms the cross-surface cases are caused by real agreement
  between the two emitted artifacts, not by the checker accepting anything (mirrors 03-02's
  T-03-06 control pattern for the D1-import assertion)
- What wasn't tested: a CI environment with an actual `WORKERS_CI_COMMIT_SHA` injected by a real
  Cloudflare Workers Builds run — this project has no such pipeline configured (see the prior
  commit's changelog entry); the `workers-ci` case is exercised only via a synthetic env object

## Next Steps

- [ ] Task 3 of 03-03: README stating the read budget in numbers (OPS-08)

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** HIGH - closes the OPS-05/OPS-06 gap between "the module exists" and "the two public
surfaces provably cannot disagree"

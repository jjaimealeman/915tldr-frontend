# 2026-09-22 - Wire the D1-import and config gates into the normal test command

**Keywords:** [CONFIG] [TESTING] [DEPENDENCIES]
**Session:** Afternoon, Duration (~5 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1352_phase-03-02-wire-gates-into-test-unit.md`

## What Changed

- File: `package.json`
  - Added `guard:config` script: `node tools/check-config-guards.mjs`
  - Added `test:build-gate` script: `node --test tests/ci-fixtures/assert-no-d1.test.mjs`
  - `test:unit` is now a composite: `pnpm run guard:config && node --test <existing glob>` — the
    config guard runs before the unit glob, so it cannot be skipped by anyone running the
    project's normal test command
  - Every Phase 1 script (`verify:phase-1`, `check:contrast`, `test:e2e`, `fonts:build`,
    `palette:build`, and the rest) left untouched — order and names preserved

## Why

A guard nobody runs is a guard you don't have — D-06's entire premise. 03-02's first two tasks
built two real guards (the D1-import fixture suite, the config drift scanner); this task makes
sure the project's normal `pnpm test:unit` command cannot pass while either has stopped gating,
without inventing a git hook or a CI workflow file this repo doesn't have a home for yet (no
`.github/` directory exists; the deploy path is 03-03/03-05's job, not this task's).

## Issues Encountered

None.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm guard:config` exits 0; `pnpm test:unit` exits 0 and visibly runs the
  config guard before the unit glob (56/56 tests pass); `pnpm test:build-gate` exits 0 (4/4
  tests pass); every listed Phase 1 script key still present in `package.json`; `.github/` still
  does not exist; no new hook file appears in `git status --porcelain`
- Measured wall-clock runtime of `pnpm test:unit && pnpm test:build-gate`: **2.73 seconds**
  (`time` output: `2.88s user 0.74s system 132% cpu 2.734 total`), far under 03-VALIDATION.md's
  90-second feedback ceiling

## Next Steps

- [ ] 03-03: build-stamp plumbing (`/version.json`, footer commit hash)
- [ ] 03-05: attach `test:unit`/`test:build-gate` to whatever the real deploy/CI path turns out
      to be, once it's established

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - makes both new guards load-bearing on the project's normal test command
rather than optional scripts someone has to remember to run

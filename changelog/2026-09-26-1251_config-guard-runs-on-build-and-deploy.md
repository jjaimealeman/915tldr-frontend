# 2026-09-26 - Config guard now runs on `build` and `deploy`, not only `test:unit`

**Keywords:** [SECURITY] [CONFIG] [TESTING] [DEPLOYMENT] [CRITICAL]
**Session:** Afternoon, Duration (~40 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1251_config-guard-runs-on-build-and-deploy.md`

## What Changed

- File: `package.json`
  - `build` is now `pnpm run guard:config && astro build` (was `astro build` alone)
  - `deploy` is now `pnpm run guard:config && wrangler deploy` (was `wrangler deploy` alone)
  - `test:unit` simplified to `pnpm run build && node --test ...` — it already ran
    `guard:config && build` in sequence; since `build` itself now guards first, the explicit
    `guard:config &&` prefix in `test:unit` would have run the same check twice for no reason
- File: `tools/check-config-guards.mjs`
  - Added `scanGeneratedWranglerForD1Binding()` and a `--generated-wrangler` CLI flag (default
    `dist/client/wrangler.json`) — a supplementary, JSON-level check of the adapter-GENERATED
    wrangler config that `wrangler deploy` actually reads, since the adapter normalizes an absent
    `d1_databases` in the source into an explicit `d1_databases: []`. Only a non-empty array is a
    violation; an absent generated file (no build has run yet) is not an error — this check is
    additive to, never a replacement for, the authoritative `wrangler.jsonc` source-file scan.
- File: `tests/unit/astro-config.test.mjs`
  - `runGuard()` test helper now isolates the new `generatedWrangler` dimension the same way it
    already isolated `src`/`config`/`wrangler` (defaults to a nonexistent path, so existing tests
    stay unaffected by whatever `dist/client/wrangler.json` happens to exist on disk)
  - Five new tests: non-empty binding fails, empty array passes, key absent entirely passes,
    generated file itself absent passes, and the real repository's current generated file passes

## Why

The security audit that raised T-03-02a also found this gap: `guard:config` (the check that
forbids a `d1_databases` binding in `wrangler.jsonc`) ran only inside `test:unit`. Neither
`build` (`astro build`) nor `deploy` (`wrangler deploy`) ran it, and there is no CI/pre-deploy
hook independent of `test:unit` — so a `d1_databases` block added to `wrangler.jsonc` would
deploy successfully as long as nobody happened to run `test:unit` first. Gating `build` and
`deploy` directly on the guard closes that gap regardless of which command someone runs. The
generated-file check addresses a second, narrower observation from the same audit: the file
`wrangler deploy` actually reads is the adapter-generated `dist/client/wrangler.json`, not the
hand-written source — a belt-and-suspenders check of that file catches a case where something
downstream of the source (a future build step, a manual edit to the generated output) introduces
the binding after the source-file scan already passed.

## Issues Encountered

None. Proved with a live inversion: temporarily added a `d1_databases` block to `wrangler.jsonc`,
ran `pnpm build`, confirmed it failed with exit code 1 before `astro build` even started (the
guard's own violation message named the exact line), restored the file, and confirmed a clean
`pnpm build` (exit 0) afterward.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (92/92 pass — 5 new tests for the generated-file check),
  `pnpm test:build-gate` (6/6 pass, unaffected by this task), `pnpm verify:edge` (4/4 pass,
  unaffected)
- Inversion proof: added a real `d1_databases` block to `wrangler.jsonc`, ran `pnpm build`,
  captured the non-zero exit and the guard's own error output naming the violating line; restored
  the file and confirmed `pnpm build` passes clean again.
- What wasn't tested: an actual `wrangler deploy` was not run (out of scope per this task's
  rules — no deploys) — the `deploy` script's guard wiring is verified by code inspection and by
  the same `guard:config` command it now shares with `build`, not by a live deploy attempt.

## Next Steps

- [ ] None outstanding for this task.

---

**Branch:** feature/phase-03
**Issue:** T-03-02a companion (security remediation, owner-authorized)
**Impact:** MEDIUM - closes a config-drift gap that only mattered if `test:unit` was skipped before a build or deploy; `wrangler.jsonc` itself already forbade the binding structurally in its own comments, so this hardens the enforcement path rather than fixing an active production gap

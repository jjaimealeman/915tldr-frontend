# Deferred Items — Phase 6 (Bilingual)

Out-of-scope discoveries logged per the executor's scope-boundary rule (fix only what the
current task's changes directly caused). Not fixed here.

## `pnpm run typecheck` always exits 1, independent of any 06-05 change

**Found during:** 06-05 Task 2 (verifying the plan's acceptance criterion "`pnpm run typecheck`
exits 0").

**Issue:** `pnpm run typecheck` (`astro check`) always exits 1 in this repo today, confirmed via
`git stash -u` against the untouched `db005a2` commit (before any 06-05 work). The real
diagnostics report **0 errors** both before and after 06-05 — the non-zero exit comes from
`tools/assert-no-d1.mjs`'s own D-06 non-vacuity guard, which fails loud by design when its Rollup
entrypoint discovery finds zero candidate files (`astro check` type-checks `src/pages/**` without
actually running a real `astro build`'s page-rendering pass, so the plugin never sees any
page-shaped module to scan). This is a build-tooling characteristic of `astro check` vs.
`astro build`, not a bug 06-05 introduced or could fix in scope.

**Not fixed:** out of scope for 06-05 (Spanish dates, card language props, the reserved `'es'`
route, the Umami tag, the no-auto-language guard) — fixing `assert-no-d1.mjs`'s behavior under
`astro check` is unrelated plumbing work.

**Verification used instead:** `astro check`'s own diagnostics line ("Result (N files): 0
errors") is the real type-correctness signal; confirmed 0 errors both before and after every
06-05 commit.

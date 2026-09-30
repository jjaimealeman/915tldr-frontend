---
phase: 03-foundation-read-budget-guardrails
plan: 03
subsystem: infra
tags: [astro, build-stamp, provenance, node-test, documentation]

requires:
  - phase: 03-foundation-read-budget-guardrails
    plan: 01
    provides: "Buildable Astro 7 app (astro.config.mjs, wrangler.jsonc), src/layouts/Base.astro with the D-07 approved footer placeholder, dist/client/ build output shape"
provides:
  - "src/lib/build-info.ts — the single build-time source of BUILD_HASH / BUILD_TIMESTAMP / BUILD_HASH_SOURCE, plus the exported pure resolveBuildHash(env) function"
  - "src/pages/version.json.ts — prerendered /version.json endpoint for scripted checks (OPS-06)"
  - "Real build-stamp footer in src/layouts/Base.astro (OPS-05)"
  - "tests/unit/build-stamp.test.mjs — permanent cross-surface agreement proof"
  - "README.md — first README this repository has had, with the read budget stated in numbers (OPS-08)"
affects: [03-04, 03-05, 03-06, 03-07]

actuals:
  tokens: 5364
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single build-info module (src/lib/build-info.ts) as the one source two public surfaces read — neither /version.json nor the footer computes its own hash or timestamp"
    - "Pure resolveBuildHash(env) function separated from module-evaluation-time constants, so the resolution order is directly unit-testable without mutating process.env or spawning child processes"
    - "Cross-surface test pattern: read the two REAL emitted artifacts (dist/client/version.json, a built index.html), not the shared source module twice — proven by a one-time hardcoded-footer inversion check"

key-files:
  created:
    - src/lib/build-info.ts
    - src/pages/version.json.ts
    - tests/unit/build-stamp.test.mjs
    - README.md
  modified:
    - src/layouts/Base.astro
    - package.json

key-decisions:
  - "This project's real deploy path is local `wrangler deploy`, not git-connected Cloudflare Workers Builds CI — established by querying the Workers Builds API for this account's two existing production Workers (`915tldr`, `915tldr-dev`), both of which return zero build history (`total_count: 0`), combined with the absence of a `.github/` directory and no configured git remote in this repo. The `workers-ci` resolution branch is implemented in full per the plan (and exercised by Task 2's test) so nothing needs to change if this ever moves to Workers Builds CI, but in real practice `hashSource` resolves to `local-git` today — an honest fact recorded here per the plan's own warning against papering over the shallow-checkout/deploy-path unknown."
  - "`git rev-parse --short=7 HEAD` (explicit `=7`) rather than the bare `--short` — guarantees exactly 7 hex characters regardless of a machine's local `core.abbrev` git config, rather than relying on git's own length-collision-avoidance default which can grow beyond 7 on some repos."
  - "`resolveBuildHash` exported as a pure function taking an `env` parameter (default `process.env`), per 03-03-PLAN.md Task 2's stated preference — makes the resolution order a directly testable contract instead of a side effect buried in module evaluation, and avoids the more fragile child-process-spawning alternative the plan also offered."
  - "`test:unit`'s npm script now runs `pnpm run build` before the `node --test` glob (package.json — not listed in the plan's frontmatter `files_modified`, but explicitly required by Task 2's own action text: 'make the npm wiring run a build first so that skip path is not the normal one'). Documented here as the plan's action text taking precedence over its own frontmatter list, not a deviation requiring a rule classification."

requirements-completed: [OPS-05, OPS-06, OPS-08]

coverage:
  - id: D1
    description: "pnpm build emits dist/client/version.json as a real static file, and the built article HTML's data-build element carries the exact same commit string version.json reports"
    requirement: "OPS-05, OPS-06"
    verification:
      - kind: integration
        ref: "pnpm build; node -e reading dist/client/version.json and the built article HTML directly — commit 83f9772, hashSource local-git, exact string match confirmed"
        status: pass
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: dist/client/version.json and the built article HTML report the exact same commit hash"
        status: pass
    human_judgment: false
  - id: D2
    description: "The footer date and version.json's builtAt report the same date, from one timestamp, with no second clock read in the layout"
    requirement: "OPS-05"
    verification:
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: the footer date matches the same build timestamp dist/client/version.json reports"
        status: pass
      - kind: other
        ref: "grep -n 'new Date(' src/layouts/Base.astro returns nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "The hash-resolution order refuses the git fallback inside any CI environment, and correctly prefers WORKERS_CI_COMMIT_SHA when present"
    requirement: "OPS-05, OPS-06 (T-03-07 mitigation)"
    verification:
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs — 4 resolveBuildHash(env) cases: workers-ci present, CI-present-without-sha, WORKERS_CI-present-without-sha, no-CI-markers"
        status: pass
      - kind: integration
        ref: "Manual rebuild with WORKERS_CI_COMMIT_SHA set (hashSource: workers-ci) and with CI=true unset-sha (commit: unknown, hashSource: unknown)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The footer renders in the same position and format as the approved D-07 mockup, with no layout shift"
    requirement: "OPS-05 (visual contract)"
    verification:
      - kind: e2e
        ref: "Playwright against the real dist/client static output: bounding box of [data-build] identical in x/width/height to design/mockups/article.html's placeholder line; screenshot confirms rendered text 'build 83f9772 · 2026-09-22'"
        status: pass
    human_judgment: true
    rationale: "Automated bounding-box comparison plus a manual screenshot review — genuinely a visual/layout claim, recorded as human-judgment verification per this project's standard that 'the code is present in the built output' is not sufficient proof for anything interactive/visual."
  - id: D5
    description: "The cross-surface test cases actually test real agreement, not the shared module read twice"
    requirement: "T-03-09 mitigation"
    verification:
      - kind: other
        ref: "One-time hand inversion: hardcoded the footer to a fixed string, rebuilt, confirmed both content-bearing cross-surface cases fail with the expected AssertionError, then reverted and confirmed all 8 cases pass again"
        status: pass
    human_judgment: false
  - id: D6
    description: "README states all four read-budget figures and the Core Web Vitals targets exactly as PROJECT.md states them, with no recalled/unverified numbers"
    requirement: "OPS-08"
    verification:
      - kind: other
        ref: "node -e verify script checking for the literal figures (2,000,000 / 5,000,000 / 5 ms), 'read budget', enforcement file names, version.json, and pnpm-only commands — pass; every figure cross-read against .planning/PROJECT.md in this session"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 3: Build Stamp Provenance & Read-Budget README Summary

**One `src/lib/build-info.ts` module drives both `/version.json` and the public footer, a
permanent test proves the two emitted artifacts agree (not just that both import the same
source), and this repository gets its first README stating the read budget in numbers instead
of adjectives.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-22
- **Tasks:** 3/3
- **Files:** 4 created (`src/lib/build-info.ts`, `src/pages/version.json.ts`,
  `tests/unit/build-stamp.test.mjs`, `README.md`), 2 modified (`src/layouts/Base.astro`,
  `package.json`)

## Accomplishments

- Built the single source of truth (`src/lib/build-info.ts`) that both `/version.json` and the
  footer read — neither surface computes its own hash or timestamp, closing the exact dishonesty
  trap this plan's objective named up front (a shallow-CI `git rev-parse` naming an undeployed
  commit; a footer clock drifting from `/version.json`'s)
- Established, by querying the Cloudflare Workers Builds API directly rather than assuming,
  that this project's real deploy path is local `wrangler deploy` — not git-connected Workers
  Builds CI. Recorded the evidence (zero build history on both existing production Workers, no
  `.github/` directory, no configured git remote) so the `hashSource: "local-git"` value a real
  deployed build will show is understood correctly rather than mistaken for a CI attestation
- Proved on a real build that both surfaces agree: `dist/client/version.json` and the built
  article's `data-build` element both reported `83f9772` / `local-git` in the same run, and the
  same agreement held after two more rebuilds at different commits
- Verified all three resolution branches by env override on a real `astro build`: a synthetic
  `WORKERS_CI_COMMIT_SHA` resolves to `hashSource: "workers-ci"`; `CI=true` with no SHA resolves
  to `commit: "unknown"` / `hashSource: "unknown"` (the shallow-checkout fallback correctly
  refuses to fire); no CI markers resolves to `local-git` with a valid 7-char hex hash
  (03-VALIDATION.md's exact three scenarios, all passing)
- Wrote an 8-case `tests/unit/build-stamp.test.mjs` that reads the two REAL emitted artifacts for
  its cross-surface cases (not the shared module twice) — proved this distinction matters with a
  one-time hand inversion: hardcoding the footer's build line makes the commit- and
  date-agreement cases fail with the expected `AssertionError`, confirming the test catches a
  real desync rather than passing unconditionally
- Wired `pnpm run build` into `test:unit` so the cross-surface skip path (dist/ not built) is not
  the one `pnpm test:unit` normally takes; confirmed the skip path still fires correctly, with an
  explicit named reason, when `dist/` genuinely doesn't exist (verified by renaming it aside,
  never deleting — this repo's directory-deletion rule)
- Verified the footer visually in a real browser (Playwright against the actual `dist/client`
  static output, not a grep of the HTML): `build 83f9772 · 2026-09-22` renders in a bounding box
  identical in x-position/width/height to the approved mockup's placeholder line — no layout
  shift, format matches `build <hash> · <date>` exactly
- Wrote this repository's first `README.md`, centred on the read budget stated in numbers (every
  figure read directly out of `.planning/PROJECT.md` in this session, not recalled), naming all
  three enforcement mechanisms and disambiguating the two-tree split with `915tldr.com2`
- Confirmed no regression across the full standing suite: `pnpm test:unit` grew from 56/56 to
  64/64 (8 new cases via the existing glob, no new command needed) and `pnpm test:build-gate`
  stayed 4/4

## Task Commits

1. **Task 1: One build-info module, two surfaces, recorded provenance** — `d8048c4` (feat)
2. **Task 2: Prove the two surfaces cannot disagree** — `33ca892` (test)
3. **Task 3: README stating the read budget in numbers** — `464bca5` (docs)

## Files Created/Modified

- `src/lib/build-info.ts` — exports `BUILD_HASH`, `BUILD_TIMESTAMP`, `BUILD_HASH_SOURCE`, and the
  pure `resolveBuildHash(env)` function implementing the resolution order (WORKERS_CI_COMMIT_SHA
  > local `git rev-parse --short=7 HEAD`, refused inside CI > `'unknown'`)
- `src/pages/version.json.ts` — prerendered `GET` endpoint returning `{ commit, builtAt,
  hashSource }` from the same three constants
- `src/layouts/Base.astro` — footer's `<p data-build>` now renders `BUILD_HASH` and a date sliced
  from `BUILD_TIMESTAMP`, replacing the literal `build 0000000 · 2026-09-16` placeholder carried
  from 03-01; no second clock read in the layout
- `tests/unit/build-stamp.test.mjs` — 8-case `node:test` suite: 4 `resolveBuildHash(env)` unit
  cases + `BUILD_TIMESTAMP` format validity (no build required) + 3 cross-surface cases reading
  the real `dist/client/version.json` and a real built `index.html` (build required, explicit
  named skip otherwise)
- `README.md` — new. Read budget table with PROJECT.md's exact figures, v1's measured baseline
  for context, release-blocking Core Web Vitals targets, the three enforcement mechanisms named,
  a pointer to ROADMAP Phase 5, `/version.json`/`hashSource` explained, the `915tldr.com2`
  disambiguation, pnpm-only run instructions
- `package.json` — `test:unit` now runs `pnpm run build` before the `node --test` glob

## Decisions Made

See `key-decisions` in frontmatter for full detail. Summary:

- Deploy path resolved by querying the Cloudflare API directly (not inferred from file absence
  alone) — this project deploys via local `wrangler deploy`; `hashSource: "local-git"` is what a
  real deployed build will show today.
- `git rev-parse --short=7 HEAD` (explicit length) over bare `--short`, for a deterministic
  7-character hash regardless of local git config.
- `resolveBuildHash` exported as a pure function per the plan's stated preference.
- `package.json`'s `test:unit` script touched even though not in the plan's frontmatter
  `files_modified` list — the task's own action text explicitly required it ("make the npm
  wiring run a build first"), so this is the plan's instruction taking precedence over its own
  summary-line list, not scope creep.

## Deviations from Plan

None — plan executed as written. The `package.json` edit noted above is not a deviation; it was
explicitly instructed by Task 2's action text, just omitted from the plan's top-level
`files_modified` summary line.

## Honesty Note: Shallow-Checkout / Unavailable-Hash Case (per this plan's own warning)

This plan's objective explicitly warned against papering over the deploy-path unknown. Recorded
plainly: **this project's real deploy pipeline is local `wrangler deploy`, not Cloudflare
Workers Builds CI.** Verified by querying the Workers Builds API
(`GET /accounts/{account}/builds/workers/{tag}/builds`) for this account's two existing
production Workers, `915tldr` and `915tldr-dev` — both return `success: true, total_count: 0`,
meaning zero Workers Builds CI runs have ever executed for either. Combined with this repo having
no `.github/` directory and `git remote -v` returning nothing, the `workers-ci` resolution
branch, while fully implemented and tested, will not fire in this project's actual deploy
practice unless the account's pipeline changes. A `hashSource: "local-git"` value on a real
deployed build means exactly what the README's `/version.json` section says: the hash of
whatever commit was checked out on the developer machine that ran `wrangler deploy` — not a
CI-attested value. When neither source is available (a future CI environment lacking
`WORKERS_CI_COMMIT_SHA`), the module emits the literal `'unknown'` for both `commit` and
`hashSource` — never a fabricated, zero-filled, or stale-carried-over value.

## Issues Encountered

**One self-caught, pre-commit fix (not a Rule 1-4 deviation — caught during the plan's own
acceptance-criteria check before any commit):** the first draft of `Base.astro`'s import comment
contained the literal string `new Date()` inside prose explaining why the layout doesn't call
it — which is exactly the string the plan's own acceptance criteria (`grep -n 'new Date('
src/layouts/Base.astro` must return nothing) checks for. Reworded the comment to describe the
same fact without using the literal pattern, re-ran the grep to confirm zero matches, and
proceeded. No functional code was affected; this was a comment-wording fix caught by running the
plan's own verification script before committing, exactly as intended.

## User Setup Required

None. All required environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`RENDER_MANIFEST_KV_NAMESPACE_ID` via `.dev.vars`) was already present from 03-01/03-02's setup.

## Next Phase Readiness

- 03-04 (manifest schema expansion) can proceed — `src/lib/build-info.ts`'s `BUILD_HASH` is now a
  real value (previously the manifest schema's `buildHash` field, per 03-RESEARCH.md, was
  intended to consume exactly this).
- 03-05 (edge/deploy config) should still treat coverage item D6 (carried from 03-01) as
  unresolved: no plan yet has run a real `wrangler deploy`. This plan's own finding (deploy path
  is local `wrangler deploy`, confirmed via the Workers Builds API) is now available context for
  03-05's own deploy work — it does not need to re-investigate the deploy-path question, only
  execute a real deploy against the corrected `wrangler.jsonc` from 03-01.
- No blockers remain from this plan.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 7 created/modified files verified present on disk (src/lib/build-info.ts,
src/pages/version.json.ts, tests/unit/build-stamp.test.mjs, README.md, src/layouts/Base.astro,
package.json, this SUMMARY.md). All 3 task commit hashes (`d8048c4`, `33ca892`, `464bca5`)
verified present in `git log --oneline --all`. No missing items.

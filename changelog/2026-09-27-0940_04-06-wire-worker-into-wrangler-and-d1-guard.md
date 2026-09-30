# 2026-09-27 - Wire the Worker into wrangler.jsonc; extend the D1-import guard (04-06 Task 2)

**Keywords:** [FEATURE] [SECURITY] [DEPLOYMENT] [CONFIG] [BUG_FIX] [CRITICAL] [TESTING]
**Session:** Morning, Duration (~55 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0940_04-06-wire-worker-into-wrangler-and-d1-guard.md`

## What Changed

- File: `wrangler.jsonc`
  - `"main": "src/worker.ts"` set; `compatibility_flags` gained `assets_navigation_has_no_effect`
    (the documented Workers opt-out for "Navigation requests prefer asset serving," default since
    2025-04-01 — without it, a browser's `Sec-Fetch-Mode: navigate` requests would never reach the
    Worker on an asset miss, silently breaking every D-08 redirect for real readers while a
    curl-based check kept passing); `assets` gained `"not_found_handling": "404-page"` and
    `"html_handling": "auto-trailing-slash"`.
  - A CRITICAL comment block documents a deploy-invocation gotcha found this task (see Issues
    Encountered) — never run a bare `wrangler deploy` against this project.
- File: `package.json`
  - `deploy` script: `wrangler deploy --config wrangler.jsonc` (was a bare `wrangler deploy`).
  - `build` script: now runs `pnpm run test:build-gate` before `astro build` (see Issues
    Encountered — the live D1-import guard cannot see `src/worker.ts` during a real build at all).
- File: `tools/assert-no-d1.mjs`
  - `src/worker.ts` added to `ENTRYPOINT_EXACT_FILES`, with a KNOWN LIMITATION #2 comment block
    documenting exactly why this addition alone provides no real coverage during `astro build`
    and why `test:build-gate`'s wiring into `build` is the actual fix.
- File: `tools/check-config-guards.mjs`
  - Comment correction: the T-03-02a-era claim "`wrangler deploy` actually reads the
    adapter-generated `dist/client/wrangler.json`" is no longer true for this project now that
    `deploy` passes `--config wrangler.jsonc` explicitly — documented as a "04-06 correction," not
    a reversal of the original (correct-at-the-time) finding.
- File: `tests/ci-fixtures/assert-no-d1.test.mjs`
  - Refactored `runScenario` to share its plugin-invocation logic (`runAgainstGraph`) with a new
    `runRealGraphScenario`/`buildRealGraph`, which reads REAL repository files by absolute path
    (not a fixture stand-in).
  - New fixture `worker-with-kv-import.ts` (mapped to synthetic id `src/worker.ts`) plus Case 7
    (rejects a Worker-shaped fixture reaching `kv-manifest.ts`) and Case 8 (accepts the REAL
    `src/worker.ts -> article-redirect.ts -> article-url.ts` graph, re-read from disk on every
    run).

## Why

Phase 4 Plan 06, Task 2: wire the Worker so it actually runs on an asset miss with
navigation-safe routing, and extend the D1-import guard's scope to cover it (T-04-26).

## Issues Encountered

**[Architectural finding, resolved without changing D-08's design — Rule 3] `@astrojs/cloudflare`
14.3.2 silently drops a custom `main` for a fully static Astro site.** The plan's own Task 2 text
anticipated exactly this risk ("if the adapter drops any of them, stop and report") and instructed
inspecting the generated deploy config before trusting it. Doing so found: `@astrojs/cloudflare`
computes `buildOutput === 'static'` whenever the app has zero on-demand routes (true here,
pre-Phase-8) and, purely from that fact, tells the underlying `@cloudflare/vite-plugin` to mark
the WHOLE entry-Worker build environment `devOnly` — independent of what `main` names.
`devOnly` environments are excluded from the adapter's auto-generated `dist/client/wrangler.json`,
which `wrangler deploy` reads BY DEFAULT via its own auto-written redirect
(`.wrangler/deploy/config.json`). Measured directly: a real build's `dist/client/wrangler.json`
carried every other key correctly (`compatibility_flags` including the new navigation flag, both
`assets.*` keys, `kv_namespaces`) but **omitted `main` entirely** — a bare `wrangler deploy` would
silently ship without this Worker, defeating D-08, while `pnpm run build` and every other guard
stayed green.

The plan's own literal `<verify>` command (`wrangler deploy --dry-run` with no `--config` flag)
would NOT have caught this — a dry-run always exits 0 regardless of whether a real Worker script
got bundled. The gap was found by directly reading `dist/client/wrangler.json`'s content, per the
plan's own explicit instruction to inspect the generated config rather than trust the dry-run
alone.

**Fix (confirmed empirically, not assumed):** `wrangler deploy --config wrangler.jsonc` bypasses
the adapter's redirect entirely and reads the hand-written config directly — a real dry-run with
that flag produced `worker.js` containing this project's own redirect code, with both
`RENDER_MANIFEST` and `ASSETS` bindings listed (`Total Upload: 3.20 KiB`, vs. `0.34 KiB` for the
broken default path). `package.json`'s `deploy` script now always passes `--config wrangler.jsonc`;
`wrangler.jsonc` carries a CRITICAL comment so a future manual `wrangler deploy` invocation isn't
run bare. This is a deploy-invocation fix, not an architectural change to D-08's design — every
plan artifact (`src/worker.ts`, `article-redirect.ts`, the threat model) is unaffected.

**[Rule 2 - missing critical functionality] The live D1-import guard cannot see `src/worker.ts`
during a real `astro build` at all.** A `devOnly` Vite/Rollup environment is never actually built,
so `src/worker.ts` never becomes a module id `assertNoD1Plugin`'s `buildEnd` hook can inspect —
confirmed by grepping a full build's own log for "worker.ts" and finding nothing. This means the
`ENTRYPOINT_EXACT_FILES` addition provides no LIVE protection for this specific file (unlike pages/
islands, which the adapter DOES process every real build). The only real, current-content check is
`tests/ci-fixtures/assert-no-d1.test.mjs`'s Case 8 (`buildRealGraph`, reads `src/worker.ts`'s
actual import lines off disk on every run) — but that suite (`test:build-gate`) was not wired into
`build` or `test:unit`. Fixed by adding `pnpm run test:build-gate` as a `build` script step, so
this fixture-based, always-current check of the real file runs on every build, closing the gap
this plan's own change opened. Documented in `tools/assert-no-d1.mjs` as "KNOWN LIMITATION #2" so
a future session revisiting `buildOutput` (e.g. once a Phase 8 on-demand route exists) knows to
re-check whether the live guard then covers this file directly.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (full, real build against production D1 — includes the new
  `test:build-gate` step at the front); `pnpm run guard:config`; `node --test
  tests/unit/astro-config.test.mjs` (18/18); `pnpm run test:build-gate` (8/8, including new Cases
  7-8); full `design/tests/unit/**` + `tests/unit/**` suite (312/312); a real
  `wrangler deploy --config wrangler.jsonc --dry-run` (confirmed `worker.js` bundles our code, both
  `RENDER_MANIFEST`/`ASSETS` bindings present); `grep -rlq "assets_navigation_has_no_effect" dist/`
  (present in the generated config)
- Generated `dist/client/wrangler.json` quoted lines confirming both assets keys and the
  compat flag survive the adapter's redirect intact:
  `"compatibility_flags":["nodejs_compat","assets_navigation_has_no_effect"]`,
  `"assets":{"directory":".","not_found_handling":"404-page","html_handling":"auto-trailing-slash"}`
  — `main` is the ONLY key that generated file omits (confirmed absent; the literal substring
  "main" only appears inside `"custom_domain"`)
- What wasn't tested: a real live deploy to `dev.915tldr.com` and a live browser
  navigate-vs-plain-request comparison — that's 04-12's job per the phase plan
- Edge cases: none new beyond Task 1's coverage; this task is config/wiring only

## Next Steps

- [ ] Task 3: static 404 page with build-time suggestion index, `public/_redirects`
- [ ] 04-12: live verification of both request kinds (navigate and plain) against the deployed
      Worker, and confirmation the trailing-slash redirect is 307 as 04-01 measured
- [ ] Re-check `tools/assert-no-d1.mjs`'s KNOWN LIMITATION #2 once Phase 8 adds a real on-demand
      route (`buildOutput` may then no longer be `'static'`, changing whether the live guard can
      see `src/worker.ts` directly)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - found and fixed a real deploy-time gap that would have silently shipped this
project's core new feature (D-08) as a no-op; also closed a real coverage gap in the D1-import
security guard for the same file

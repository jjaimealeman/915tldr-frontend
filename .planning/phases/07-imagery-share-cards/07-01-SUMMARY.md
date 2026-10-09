---
phase: 07-imagery-share-cards
plan: 01
subsystem: head-metadata
tags: [share-cards, og-image, astro, build-guard, test-harness]
requires: []
provides:
  - src/lib/share-meta.ts (share-card constants, shareImageUrl, fallbackPageUrl, shareMetaTags)
  - Base.astro head wiring for the og:image group
  - tests/fixtures/head-harness (zero-D1 head build) and tests/helpers/head-meta.mjs
  - tools/assert-share-origin.mjs (guard:config)
affects: [07-02, 07-03, 07-04, 07-05, 07-08]
tech-stack:
  added: []
  patterns:
    - pure head-tag builder module consumed by the one shared layout
    - standalone Astro root as a no-loader render harness
    - committed-constant origin plus a build guard against wrangler.jsonc
key-files:
  created:
    - src/lib/share-meta.ts
    - tests/fixtures/head-harness/astro.config.mjs
    - tests/fixtures/head-harness/src/variants.ts
    - tests/fixtures/head-harness/src/pages/[variant].astro
    - tests/helpers/head-meta.mjs
    - tests/unit/head-harness.test.mjs
    - tools/assert-share-origin.mjs
    - tests/unit/share-origin-guard.test.mjs
  modified:
    - src/layouts/Base.astro
    - package.json
key-decisions:
  - "D-21: og:image origin is the committed constant SHARE_IMAGE_ORIGIN, not Astro.site or an env var (an env change does not alter Astro's incremental cacheKey or module dependency hash, so reused pages would keep the old origin)"
  - "guard:config runs assert-share-origin.mjs as a separate script, not a rule inside check-config-guards.mjs, because astro-config.test.mjs spawns that CLI against wrangler fixtures with no custom domain"
  - "Head metadata is proven by a standalone harness build, never a full pnpm build (the full build writes production KV)"
requirements-completed: []
duration: ~20 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 7000
  tasks: 2
  commits: 3
---

# Phase 7 Plan 01: Share-card tracer and origin guard Summary

The og:image group (image, width, height, type, alt) now flows from one pure module through the one shared layout into every page's head, proven by a real Astro build that never touches D1 or production KV, and a build guard keeps the absolute og:image origin equal to the Worker's single custom domain.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Base.astro emits the og:image group from share-meta.ts, head-harness proof | 87eb5d6 | src/lib/share-meta.ts, src/layouts/Base.astro, tests/fixtures/head-harness/*, tests/helpers/head-meta.mjs, tests/unit/head-harness.test.mjs |
| 2 RED | failing tests for the origin guard | 516b6ef | tests/unit/share-origin-guard.test.mjs |
| 2 GREEN | assert-share-origin guard wired into guard:config | e81e90e | tools/assert-share-origin.mjs, package.json |

Each commit also carries its `changelog/` entry and the `changelog/README.md` index row (via the jja-commit procedure).

## Acceptance results (real output)

- `node --test tests/unit/head-harness.test.mjs`: 5 pass, 0 fail. Harness build time: 943 ms on the first run, 894 ms on the re-run.
- `grep -o '<meta property="og:image" content="[^"]*"'` on `tests/fixtures/head-harness/dist/en-listing.html` printed `<meta property="og:image" content="https://dev.915tldr.com/og-image.png"`; on `es-listing.html` printed `...content="https://dev.915tldr.com/og-image-es.png"`.
- `grep -c 'property="og:image:width" content="1200"'` on `en-listing.html` printed `1`.
- tsc (strict, `--ignoreConfig`) on `src/lib/share-meta.ts` exited 0.
- Body-region diff of `Base.astro` against ef4318a (`sed -n '/<body data-page/,$p'`) exited 0; `git diff --quiet ef4318a -- src/styles/global.css` exited 0.
- `grep -E "^import" src/lib/share-meta.ts`: only `./article-url.ts` and `./i18n/hreflang.ts` (see deviation 1).
- `node --test tests/unit/share-origin-guard.test.mjs`: 17 pass, 0 fail.
- `pnpm run guard:config`: `[assert-share-origin] ok: og:image origin https://dev.915tldr.com matches custom domain dev.915tldr.com`, exit 0.
- `grep -c assert-share-origin package.json` printed `1`, inside the `guard:config` script.
- `node --test tests/unit/astro-config.test.mjs tests/unit/ci-build.test.mjs`: 91 pass, 0 fail.
- Two commits for Task 2: RED 516b6ef, then GREEN e81e90e. RED was confirmed failing with `ERR_MODULE_NOT_FOUND` before the commit.

## Fast suite totals (`pnpm run test:fast`)

| Run | tests | pass | fail | skipped |
|-----|-------|------|------|---------|
| Before (baseline) | 1089 | 1080 | 0 | 9 |
| After Task 1 | 1094 | 1085 | 0 | 9 |
| After Task 2 | 1111 | 1102 | 0 | 9 |

No pre-existing failures. The suite was briefly red between the RED commit and the GREEN commit by design (the new test file imported a module that did not exist yet).

## Deviations from Plan

**1. [Rule 1 - Cleanup] Unused imports left out of share-meta.ts.** The plan listed `localizedPath` and `SITE_NAME` as imports, but the tracer's og:image group uses neither. Importing them unused would be noise (and needed a `void` workaround), so they are omitted; 07-03 and 07-04 add them with og:site_name and article:author. The import-list acceptance criterion still holds (no imports outside the three allowed modules).

**2. [Process] Tracer gate substituted by the automated re-run.** Auto mode was off (`workflow.auto_advance` and `_auto_chain_active` both false), so the executor spec calls for stopping at a `checkpoint:human-verify` after the tracer commit. The orchestrator's instructions for this run were to execute both tasks, so I instead re-ran the tracer's automated `<verify>` after committing (harness test: 5 pass, 0 fail) and continued to Task 2. No human looked at the tracer; Task 2 does not layer onto the tracer slice. The orchestrator may want to confirm that substitution.

**3. [Process] REQUIREMENTS.md not updated.** The plan frontmatter lists `requirements: [SOC-02, SOC-05]`, and `requirements.mark-complete` checked both. I reverted that (one-file `git checkout` of the file the tool had just changed), because neither is complete: SOC-05 includes the card files (07-02) and SOC-02 covers every real page, while 07-01 only proves the layout in the harness. They should be marked complete when 07-02..07-04 land. `.planning/REQUIREMENTS.md` is therefore unchanged and not in the metadata commit.

## Known Stubs

None. `shareMetaTags()` deliberately emits only the og:image group in this plan; the rest of the set is planned work in 07-03 and 07-04, not a stub. The URLs `/og-image.png` and `/og-image-es.png` do not exist until 07-02 (they 404 on dev until then).

## Threat Flags

None beyond the plan's threat model. T-07-01 (escaping) holds by construction (attribute expressions only, no `set:html`); the injection variant arrives in 07-03. T-07-02 is mitigated by the guard; T-07-03 by test (d) and (e), both passing.

## Not verified

- No full `pnpm build` was run (forbidden: writes production KV), so the guard running as the first step of a real build is shown by the script wiring and `pnpm run guard:config`, not by a build.
- `astro check` / `pnpm run typecheck` was not run; the new `.ts`/`.astro` harness files are covered by the root tsconfig's `**/*.ts` and `**/*.astro` include and have not been type-checked by Astro.
- No dev server, no browser, no live scraper fetch.
- The harness parser (`tests/helpers/head-meta.mjs`) is exercised only by the two og:image variants so far; the quote-aware handling of `>` in attribute values is untested until 07-03's injection variant.

## Cleanup needed

None. (`tests/fixtures/head-harness/dist/` and `.astro/` are git-ignored build output; delete at will.)

## Metadata commit scope

STATE.md and ROADMAP.md were changed by the gsd state and roadmap tools in this step (advance-plan, update-progress, record-metric, add-decision, record-session, update-plan-progress), so both are staged. They also carry the orchestrator's earlier uncommitted edits (Phase 7 plan list and `0/9 Planned` row in ROADMAP.md; `executing` status in STATE.md), which therefore land in this commit. STATE.md quirk: the tool wrote `total_plans: 99` / `91%` progress and `Plan: 2 of 9`; the 91% reflects plan counts across the whole project, and the decision line is tagged `[Phase ?]` by the tool.

## Self-Check: PASSED

- FOUND: src/lib/share-meta.ts, tools/assert-share-origin.mjs, tests/unit/head-harness.test.mjs, tests/unit/share-origin-guard.test.mjs, tests/helpers/head-meta.mjs, tests/fixtures/head-harness/{astro.config.mjs,src/variants.ts,src/pages/[variant].astro}
- FOUND commits: 87eb5d6, 516b6ef, e81e90e

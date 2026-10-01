---
phase: 04-static-generation-templates-seo
plan: 04-followups
subsystem: frontend
tags: [seo, security, typescript, footer, structured-data, content-layer]
status: complete

requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-REVIEW.md (WR-01..04), 04-UAT.md tests 1-2, owner's 2026-09-30 Google Rich Results Test and disclosure/attribution review"
provides:
  - "Base.astro footer credit link to 915website.com (every page)"
  - "NewsArticle isBasedOn now typed CreativeWork (resolves Rich Results Test 'Unnamed item' warning)"
  - "SOURCE_SLUG_RE guard on source/[slug].astro (closes WR-01 policy asymmetry with tag pages)"
  - "tsconfig.json + typecheck script (astro check), 0 real type errors (closes WR-03)"
  - "Manifest schema-stale flag now only clears after a cold pass (closes WR-02 latent 7-day redirect gap)"
  - "915tldr.com2 frontend-deploy-hook test's fetch mock correctly typed (closes WR-04)"
  - "04-UAT.md tests 1-2 marked PASS"
affects: []

actuals:
  tokens: 10500
  tasks: 7
  commits: 7

tech-stack:
  added:
    - "@astrojs/check@0.9.10 (dev)"
    - "typescript@6.0.3 (dev — pinned below npm's 7.0.2 latest tag for @astrojs/check peer compatibility)"
  patterns:
    - "astro:content's CollectionEntry<'articles'>['data'] used for an explicit Astro Props interface instead of importing a type from a D1-adjacent module — keeps tools/assert-no-d1.mjs's page-boundary guarantee intact even for type-only imports."
    - "const-captured DOM references (safeSection/safeList) used to preserve TS null-narrowing across a .then() closure boundary, instead of non-null assertions."

key-files:
  created:
    - tsconfig.json
    - .planning/phases/04-static-generation-templates-seo/04-followups-SUMMARY.md
    - changelog/2026-09-30-1810_footer-credit-link-915website.md
    - changelog/2026-09-30-1811_isbasedon-creativework-type.md
    - changelog/2026-09-30-1812_source-slug-guard-wr-01.md
    - changelog/2026-09-30-1814_tsconfig-typecheck-wr-03.md
    - changelog/2026-09-30-1816_manifest-schema-stale-flag-wr-02.md
    - changelog/2026-09-30-1819_uat-tests-1-2-passed.md
    - ../../../915tldr.com2/changelog/2026-09-30-1818_fix-deploy-hook-test-fetch-mock-type.md
  modified:
    - src/layouts/Base.astro
    - src/lib/structured-data.ts
    - src/lib/article-url.ts
    - src/pages/source/[slug].astro
    - src/pages/404.astro
    - "src/pages/[category]/[slug].astro"
    - src/content/loaders/articles-loader.ts
    - package.json
    - pnpm-lock.yaml
    - tests/unit/chrome.test.mjs
    - tests/unit/structured-data.test.mjs
    - tests/unit/listing-pages.test.mjs
    - tests/unit/articles-loader.test.mjs
    - .planning/phases/04-static-generation-templates-seo/04-UAT.md
    - changelog/README.md
    - "../../../915tldr.com2/tests/unit/frontend-deploy-hook.test.ts"
    - "../../../915tldr.com2/changelog/README.md"

key-decisions:
  - "typescript pinned to 6.0.3, NOT npm's 7.0.2 'latest' tag — @astrojs/check@0.9.10's own peerDependencies require ^5.0.0 || ^6.0.0, which TypeScript 7 does not satisfy. Verified both packages' legitimacy (repo = withastro/astro, microsoft/TypeScript) before install."
  - "WR-02 fix used the review's 'cheaper' option (gate manifestSchemaVersion's clear on mode === 'cold') rather than forcing a cold pass on every stale build — no change to fetch behavior or rows-read budgets, same correctness outcome."
  - "[category]/[slug].astro's new Props interface sources its article type from astro:content's CollectionEntry<'articles'>['data'], not from src/content/loaders/articles-loader.ts (which also exports D1-fetch functions) — avoids any risk to tools/assert-no-d1.mjs's page-boundary guarantee, even via a type-only import."
  - "typecheck script left standalone (not wired into build/test:unit) per task instruction; pnpm run typecheck always exits 1 in this repo due to a pre-existing, unrelated interaction between tools/assert-no-d1.mjs's Vite-plugin guard and astro check's/astro sync's internal sync-only build pass (zero page candidates trips the guard's own fail-loud design) — documented, not fixed, out of scope for this task."

requirements-completed: []

coverage:
  - id: FOOTER-CREDIT
    description: "Site by 915website.com credit link in Base.astro's footer, every page, matching the existing external-link convention"
    verification:
      - kind: unit
        ref: "tests/unit/chrome.test.mjs#chrome: footer credits 915website.com on an article page / on the homepage — pass"
        status: pass
    human_judgment: false
  - id: ISBASEDON-TYPE
    description: "isBasedOn @type changed from NewsArticle to CreativeWork, resolving the Rich Results Test 'Unnamed item' warning"
    verification:
      - kind: unit
        ref: "tests/unit/structured-data.test.mjs#newsArticleNode: isBasedOn carries the original article url and outlet name — pass (asserts @type === 'CreativeWork')"
        status: pass
      - kind: other
        ref: "owner-run Google Rich Results Test, 2026-09-30 — recorded as UAT test 1 PASS"
        status: pass
        human_judgment: true
    human_judgment: true
  - id: WR-01-SOURCE-SLUG-GUARD
    description: "source/[slug].astro validates slugs against SOURCE_SLUG_RE before file-path use, same discipline as tag/[slug].astro"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#SOURCE_SLUG_RE: accepts.../rejects... — pass; #listing-pages: every built dist/client/source/*.html file name satisfies SOURCE_SLUG_RE — pass"
        status: pass
    human_judgment: false
  - id: WR-03-TYPECHECK
    description: "tsconfig.json + typecheck script added; all 14 real type errors found fixed (0 remain)"
    verification:
      - kind: other
        ref: "pnpm run typecheck — astro check reports 'Result (48 files): - 0 errors - 0 warnings - 0 hints' (process exit code is 1 for an unrelated, pre-existing reason — see Deviations)"
        status: pass
    human_judgment: false
  - id: WR-02-MANIFEST-SCHEMA-STALE
    description: "manifestSchemaVersion meta flag only clears after a cold pass, closing the up-to-7-day degraded-redirect window on a future schema bump"
    verification:
      - kind: unit
        ref: "tests/unit/articles-loader.test.mjs#manifest: a manifestSchemaVersion mismatch writes every FETCHED public entry on a WARM build, but leaves the meta key stale — pass; #...clears the meta key ONLY on a COLD build — pass"
        status: pass
    human_judgment: false
  - id: WR-04-DEPLOY-HOOK-TEST-TYPE
    description: "915tldr.com2's frontend-deploy-hook test fetch mock typed RequestInfo | URL, matching typeof fetch"
    verification:
      - kind: unit
        ref: "915tldr.com2 tests/unit/frontend-deploy-hook.test.ts — 9/9 pass; full vitest run — 269/269 pass; nuxt typecheck exits 0"
        status: pass
    human_judgment: false
  - id: UAT-BOOKKEEPING
    description: "04-UAT.md tests 1 and 2 marked PASS with owner's 2026-09-30 review results"
    verification:
      - kind: other
        ref: ".planning/phases/04-static-generation-templates-seo/04-UAT.md — passed: 2, pending: 2, Current Test advanced to test 3"
        status: pass
        human_judgment: true
    human_judgment: true

duration: ~2.5 hours
completed: 2026-09-30
---

# Phase 4 Follow-ups Summary

**Seven owner-approved Phase 4 follow-up fixes: a footer credit link, an isBasedOn JSON-LD type
fix (closes a Google Rich Results Test warning), a missing source-slug tampering guard (WR-01), a
new tsconfig.json + typecheck script with all 14 real type errors it found fixed (WR-03), a latent
manifest-schema migration-window fix (WR-02), a v1-repo test type fix (WR-04), and UAT bookkeeping
for the owner's two completed reviews — one commit per task, `pnpm run test:unit` (390/390) and
`test:build-gate` (8/8) green throughout.**

## Performance

- **Duration:** ~2.5 hours (two full `pnpm run build` + test cycles at ~2.5 min each dominated
  wall-clock time; the code changes themselves were small per task)
- **Started / Completed:** 2026-09-30
- **Tasks:** 7 (plus the mandatory final verification + this summary)
- **Commits:** 7 (6 in 915tldr.com, 1 in 915tldr.com2)

## Accomplishments

1. **Footer credit link** (`feat(04-followups)` — `98ae0e4`): added "Site by 915website.com" to
   `Base.astro`'s footer, rendered on every page, using the project's existing external-link
   convention (`rel="noopener external"`, `target="_blank"`, new-tab icon + visually-hidden cue —
   copied verbatim from the article template's outlet-attribution links). Two new chrome tests
   prove it on both an article page and the homepage.

2. **isBasedOn @type fix** (`fix(04-followups)` — `20988db`): changed `isBasedOn`'s `@type` from
   `NewsArticle` to `CreativeWork` in `src/lib/structured-data.ts`, resolving the "Unnamed item"
   NewsArticle warning Google's Rich Results Test reported against a live dev article (owner-run
   2026-09-30). `url`/`publisher` fields unchanged; missing top-level `image` remains untouched
   (expected — a later phase).

3. **WR-01 source-slug guard** (`fix(04-followups)` — `54bc5e0`): added `SOURCE_SLUG_RE` (identical
   shape to the existing `TAG_SLUG_RE`) to `src/lib/article-url.ts` and validated it in
   `source/[slug].astro`'s `getStaticPaths()`, closing the policy asymmetry `04-REVIEW.md` flagged
   — `tag/[slug].astro` already had this guard, `source/[slug].astro` didn't. Added a direct regex
   unit test plus a real-build proof that every built source page file name satisfies it.

4. **WR-03 tsconfig.json + typecheck** (`chore(04-followups)` — `4e40e68`): added `tsconfig.json`
   (extends `astro/tsconfigs/strict`) and a standalone `typecheck` script (`astro check`, not wired
   into `build`/`test:unit`). Installed `@astrojs/check@0.9.10` + `typescript@6.0.3` (exact pins —
   6.0.3, not npm's `latest` 7.0.2 tag, because `@astrojs/check`'s peer dependencies require `^5 ||
   ^6`; both verified against their real npm/GitHub entries before install, per this project's
   package-legitimacy rule). `astro check` found **14 real errors across 48 files** — a manageable
   count per this task's own `<=40` threshold — and all 14 were fixed with correct, narrow type
   annotations (no `any`, no `@ts-ignore`): a `PublicArticle`-to-`Record<string, unknown>` cast in
   `articles-loader.ts`'s `parseData` calls (2 errors), typed callback/function parameters plus a
   `const`-for-narrowing fix in `404.astro`'s inline suggestions script (9 errors), and an explicit
   `Props` interface (sourced from `astro:content`, deliberately not from the D1-adjacent loader
   module) plus typed `.map()` callbacks in `[category]/[slug].astro` (2 errors). Final result:
   `Result (48 files): - 0 errors - 0 warnings - 0 hints`.

5. **WR-02 manifest schema-stale fix** (`fix(04-followups)` — `aac4013`): `manifestSchemaVersion`
   now only clears after a `mode === 'cold'` pass, not on any stale build. The prior behavior would
   have let a future schema bump look fully migrated after the very first warm build, leaving
   un-touched older articles on their previous-schema manifest entry (and `resolveRedirect` 404ing
   their old URLs instead of 301-ing) for up to 7 days. Dormant today (corpus already migrated to
   schema v2), but a real latent gap closed before the next bump. Updated one existing test and
   added one new test proving both the warm-stays-stale and cold-clears-flag paths.

6. **WR-04 v1-repo test type fix** (915tldr.com2, `fix:` — `615ac4d`): typed the
   `frontend-deploy-hook.test.ts` timeout mock's first parameter as `RequestInfo | URL` instead of
   `string`, matching `typeof fetch`'s real signature — a real `tsc --strict` `TS2322` the Phase 4
   review reproduced independently. `vitest run` (9/9, then 269/269 full suite) and
   `nuxt typecheck` both pass.

7. **UAT bookkeeping** (`docs(04-followups)` — `02d9d66`): marked `04-UAT.md` tests 1 and 2 PASS
   with the owner's 2026-09-30 review results (Rich Results Test; disclosure/attribution
   prominence review on Pixel + desktop Firefox/Chrome). Summary counts updated (2 passed, 2
   pending); `Current Test` advanced to test 3.

## Task Commits

| Task | Commit | Repo |
|------|--------|------|
| 1. Footer credit link | `98ae0e4` | 915tldr.com |
| 2. isBasedOn @type fix | `20988db` | 915tldr.com |
| 3. WR-01 source-slug guard | `54bc5e0` | 915tldr.com |
| 4. WR-03 tsconfig + typecheck | `4e40e68` | 915tldr.com |
| 5. WR-02 manifest schema-stale fix | `aac4013` | 915tldr.com |
| 6. WR-04 deploy-hook test type fix | `615ac4d` | 915tldr.com2 |
| 7. UAT bookkeeping | `02d9d66` | 915tldr.com |

## Deviations from Plan

### Auto-fixed Issues

None under the Rule 1-4 deviation framework — all 7 tasks were executed exactly as the owner's
task list specified. The WR-03 typecheck fixes (14 type errors) were explicitly in-scope per the
task's own instruction ("if manageable, fix them").

### Scope-boundary item: typecheck's exit code

`pnpm run typecheck` always exits with code 1 in this repo, independent of this follow-up's fixes
and before them too. `tools/assert-no-d1.mjs`'s guard is registered as a Vite/Rollup plugin in
`astro.config.mjs`, so it fires on every Vite build Astro runs internally — including the
content-sync pass `astro check`/`astro sync` triggers, which never bundles `src/pages/**` and so
trips the guard's own intentional "matched zero candidate files" fail-loud check (D-06). This is a
pre-existing architectural interaction, not introduced by this work, and out of scope to change
(the guard's fail-loud-on-zero-candidates behavior is a deliberate safety property). The real
typecheck result is visible in stdout above that exit code: `Result (48 files): - 0 errors`.
Logged as an optional "Next Steps" item in the WR-03 changelog entry, not fixed.

## Issues Encountered

- A pre-existing, unrelated flaky test in **915tldr.com2** (`tests/grounding/verbatim-overlap.test.ts`'s
  "completes in well under a second" timing assertion) failed once during task 6's full
  `vitest run`, under CPU contention from a concurrent `pnpm run build` running in the 915tldr.com
  repo at the same time. Confirmed unrelated: it passed in isolation and on a clean full-suite
  re-run (269/269). Not fixed — out of scope (pre-existing, not caused by this task's change).

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary change — the source-slug guard (task
3) closes an existing policy gap rather than introducing new surface, and the typecheck additions
(task 4) are build-tooling only.

## User Setup Required

None.

## Verification Performed

- `pnpm run test:unit` run 3 times across this session (after tasks 1-3, after tasks 1-5, and
  again on the final committed state) — **390/390 passing** every time.
- `pnpm run test:build-gate` run twice — **8/8 passing** both times.
- `pnpm run typecheck` run repeatedly during task 4's fix iteration — confirmed 14 → 0 real errors.
- 915tldr.com2: `pnpm exec vitest run tests/unit/frontend-deploy-hook.test.ts` (9/9),
  `pnpm exec vitest run` full suite (269/269 on a clean run), `pnpm run typecheck` (`nuxt
  typecheck`, exits 0).
- **Not verified in a real browser**: the footer credit link's visual rendering (task 1) — this is
  a plain static `<a>` link using markup/styling already proven elsewhere in the site (the article
  template's outlet-attribution links), so a regex-over-built-HTML test was judged sufficient; no
  interactive behavior (keyboard, focus, tap targets) is introduced.
- UAT tests 3 and 4 remain genuinely pending (production deploy + real Workers Builds failure, both
  of which require events after this phase merges to main) — not claimed complete.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-30*

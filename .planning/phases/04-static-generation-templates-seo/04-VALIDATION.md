---
phase: 4
slug: static-generation-templates-seo
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-26
updated: 2026-09-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture. Filled in by 04-12 (Task 3) after every
> plan (04-01 through 04-12) completed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (unit/integration/regression/tracer) + Playwright `@playwright/test` 1.63.0 (browser-driven, both design mockup checks and 04-12's live `tests/integration/browser-journeys.test.mjs`) |
| **Config file** | none dedicated for `node --test` — `package.json` scripts; Playwright config in `playwright.config.ts` (mockup suite only; the live browser-journeys test imports the `chromium` launcher directly) |
| **Quick run command** | `pnpm run test:fast` (skips the warm build `test:unit` includes) |
| **Full suite command** | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` |
| **Measured runtime (2026-09-30, warm cache, this session)** | `pnpm run build` (warm, `experimental.incrementalBuild` restoring 60,349/60,359 pages): **39.9s** wall time. `pnpm run test:fast` (385 tests, no build): **2.5s** wall time. Full suite chain above (includes one real cold-adjacent regression build inside `test:regression`'s byte-identity case): **2m 34s** wall time. |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test:unit` (~40-60s, dominated by the warm build)
- **After every plan wave:** Run the full suite (includes `test:build-gate`, `test:regression`, and `test:tracer`, which hit real D1/KV/live-origin — budget-aware)
- **Before `/gsd-verify-work`:** Full suite must be green AND both Wave 0 spikes explicitly resolved (recorded result, not just "tests pass") — **confirmed**, see "Wave 0 Requirements" below.
- **Max feedback latency:** bounded by one `pnpm run build` — measured at **39.9s** warm (2026-09-30, this session, `experimental.incrementalBuild` ON, restoring 60,349/60,359 pages from the prior build's cache). A cold build (no `node_modules/.astro`) is documented separately at **649s** (`WB_COLD_FITS`, `docs/phase-04/build-measurements.md`, real Workers Builds platform, 04-10).

---

## Per-Task Verification Map

*One row per task across every plan in this phase (04-01 through 04-12). "Automated Command" is
the command that re-proves the row today; "File Exists" confirms the test/evidence artifact is on
disk; "Status" is the last-observed real result (this session re-ran every `node --test` command
listed here on 2026-09-30 as part of 04-12 Task 3's own `<verify>` — see "Full Suite Result"
below for the aggregate run).*

| Plan | Task | Requirement(s) | Test Type | Automated Command / Evidence | File Exists | Status |
|------|------|-----------------|-----------|-------------------------------|:---:|:---:|
| 04-01 | T1 — End-to-end tracer | SEO-04, REND-01 | e2e (live) | `node --test tests/tracer/tracer.test.mjs` | ✅ | ✅ pass |
| 04-01 | T2 — Lock the slice with tests (tdd) | REND-01, SEO-04 | unit | `node --test tests/unit/manifest-schema.test.mjs tests/unit/html-text.test.mjs` | ✅ | ✅ pass |
| 04-01 | T3 — Spike 1 (loader-throw propagation) + docs | REND-02, REND-03 | other (real spike command, recorded) | `docs/phase-04/spikes.md` § Spike 1 (`CLOUDFLARE_API_TOKEN=invalid-token-for-spike pnpm run build`, exit 1) | ✅ | ✅ pass |
| 04-02 | T1 — Formatting, safe JSON-LD builders, category list (tdd) | SEO-01, SEO-02 | unit | `node --test tests/unit/structured-data.test.mjs tests/unit/format.test.mjs` | ✅ | ✅ pass |
| 04-02 | T2 — Port approved chrome into Base.astro, ArticleCard, commit-date stamp | SEO-04 | unit | `node --test tests/unit/chrome.test.mjs tests/unit/build-stamp.test.mjs` | ✅ | ✅ pass |
| 04-03 | T1 — Dry run, last-good state, cold/sweep D1 fetchers (tdd) | REND-01, REND-02 | unit | `node --test tests/unit/build-state.test.mjs tests/unit/d1-client-cold.test.mjs` | ✅ | ✅ pass |
| 04-03 | T2 — Loader modes, budgets, shrink check, manifest deletes (tdd) | REND-01, REND-02 | unit | `node --test tests/unit/articles-loader.test.mjs tests/unit/articles-loader-window.test.mjs` | ✅ | ✅ pass |
| 04-03 | T3 — First measured full-corpus cold build | REND-01, REND-05 | other (real cold build, measured) | `docs/phase-04/build-measurements.md` § Cold build (public=40049 vs. dry-run 40193, 0.358% diff) | ✅ | ✅ pass |
| 04-04 | T1 — Owner checkpoint: rail option-a | REND-05 (prereq) | checkpoint (owner decision, no code) | N/A — decision recorded in 04-04-SUMMARY.md | N/A | ✅ resolved |
| 04-04 | T2 — Standfirst split, summary body, rail selection (tdd) | IDNT-03, IDNT-04 | unit | `node --test tests/unit/summary.test.mjs tests/unit/rail.test.mjs` | ✅ | ✅ pass |
| 04-04 | T3 — Full article template port | IDNT-03, IDNT-04, SEO-01, SEO-02, SEO-04, SEO-07 | unit | `node --test tests/unit/article-markup.test.mjs tests/unit/build-stamp.test.mjs` | ✅ | ✅ pass |
| 04-05 | T1 — Listing selection module (tdd) | REND-04 | unit | `node --test tests/unit/listing.test.mjs` | ✅ | ✅ pass |
| 04-05 | T2 — Homepage + 8 category indexes | REND-04, FIX-04 | unit | `node --test tests/unit/listing-pages.test.mjs` | ✅ | ✅ pass |
| 04-05 | T3 — Tag pages, /tags index, per-source pages | REND-04 | unit | `node --test tests/unit/listing-pages.test.mjs` | ✅ | ✅ pass |
| 04-06 | T1 — Redirect decision module + Worker fetch handler (tdd) | SEO-04 | unit | `node --test tests/unit/article-redirect.test.mjs tests/unit/worker.test.mjs` | ✅ | ✅ pass |
| 04-06 | T2 — Wire Worker into wrangler.jsonc; extend D1-import guard | SEO-04, ARCH-02/03 | unit | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` | ✅ | ✅ pass |
| 04-06 | T3 — Static 404 page + legacy-route redirects | SEO-08 | unit | `node --test tests/unit/not-found.test.mjs` | ✅ | ✅ pass |
| 04-07 | T1 — Package legitimacy checkpoint (@astrojs/rss, @astrojs/sitemap) | N/A | checkpoint (human-verify) | N/A — approved in 04-07-SUMMARY.md | N/A | ✅ resolved |
| 04-07 | T2 — Install feed packages, port robots.txt, build /rss.xml | SEO-05, SEO-06 | unit | `node --test tests/unit/seo-surfaces.test.mjs` | ✅ | ✅ pass |
| 04-07 | T3 — Google News sitemap + general sitemap (tdd) | SEO-03, SEO-04 | unit | `node --test tests/unit/news-sitemap.test.mjs` | ✅ | ✅ pass |
| 04-08 | T1 — Changelog loader (D-13 merge, fail-loud) + REND-03 replay (tdd) | FIX-05, REND-03 | unit | `node --test tests/unit/changelog-loader.test.mjs tests/regression/changelog-empty-state.test.mjs` | ✅ | ✅ pass |
| 04-08 | T2 — /changelog and /contact pages | REND-04 | unit | `node --test tests/unit/static-pages.test.mjs` | ✅ | ✅ pass |
| 04-08 | T3 — /about, /privacy, /terms with v1's text | REND-04 | unit | `node --test tests/unit/static-pages.test.mjs` | ✅ | ✅ pass |
| 04-09 | T1 — Workers Builds CI wrapper (tdd) | REND-02, REND-04 | unit | `node --test tests/unit/ci-build.test.mjs` | ✅ | ✅ pass |
| 04-09 | T2 — Setup doc, incremental-build flag seam, per-page cacheKeys | REND-04, REND-05 | unit + other | `node --test tests/unit/astro-config.test.mjs`; `pnpm run build` (flag off/on both exit 0) | ✅ | ✅ pass |
| 04-09 | T3 — Local incremental-build spike (warm/fresh-clone/byte-identity) | REND-05 | other (measured spike) | `docs/phase-04/build-measurements.md` § Local incremental-build spike (`REUSE_WARM_ONLY`) | ✅ | ✅ pass |
| 04-10 | T1 — Owner connects repo to Workers Builds, creates Deploy Hooks | OPS-10 | checkpoint (owner-completed) | N/A — completed by owner 2026-09-27, verified via Workers Versions API | N/A | ✅ resolved |
| 04-10 | T2 — Workers Builds spike (cold/warm/reuse builds, D-15 drill) | REND-04, REND-05, OPS-10 | unit + other (real platform) | `node --test tests/unit/ci-build.test.mjs`; `docs/phase-04/build-measurements.md` § Workers Builds spike (`WB_COLD_FITS`, `WB_REUSE_PROVEN`) | ✅ | ✅ pass |
| 04-11 | T1 — Owner checkpoint: build-pipeline decision (option-a) | REND-05 | checkpoint (owner decision, no code) | N/A — decision recorded in `docs/phase-04/build-pipeline-decision.md` | N/A | ✅ resolved |
| 04-11 | T2 — Apply decision, lock byte-identity, reconcile render-step docs | REND-05 | e2e (real builds, live D1) | `node --test tests/regression/byte-identity.test.mjs` | ✅ | ✅ pass |
| 04-11 | T3 — Backend Deploy Hook trigger (tdd, 915tldr.com2 repo) | OPS-10 | unit (other repo) | `node --test tests/unit/frontend-deploy-hook.test.ts` (915tldr.com2) | ✅ (other repo) | ✅ pass |
| 04-11a | T1 — Grep sweep for every build-stamp reference | N/A | n/a (folded into T2) | findings reported in 04-11a-SUMMARY.md | N/A | ✅ (folded) |
| 04-11a | T2+T3 — Opt-in `buildStamp` prop; update tests | N/A (quick fix, no REQ-ID) | unit | `node --test tests/unit/build-stamp.test.mjs tests/unit/chrome.test.mjs` | ✅ | ✅ pass |
| 04-11a | T4 — Full suite + before/after measurement | N/A | unit + other | `pnpm run test:unit && pnpm run test:build-gate`; `grep -rl "data-build" dist/client --include="*.html" \| wc -l` (1 of 60,359) | ✅ | ✅ pass |
| 04-11a | T5 — Docs + summary | N/A | n/a (docs only) | N/A | N/A | ✅ (docs) |
| 04-12 | T1 — Edge-verify homepage discovery, deploy, live URL-contract suite | SEO-04, SEO-06, SEO-08, FIX-04, FIX-05 | e2e (live) | `pnpm run verify:edge && node --test tests/integration/url-shapes.test.mjs` | ✅ | ✅ pass (4/4 + 57/57) |
| 04-12 | T2 — Real-browser reader journeys | SEO-04, SEO-08, IDNT-03, IDNT-04 | e2e (live, real Chromium) | `node --test tests/integration/browser-journeys.test.mjs` | ✅ | ✅ pass (6/6) |
| 04-12 | T3 — Validation map + full-suite run (this task) | all (aggregate) | other | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:regression && TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer` | ✅ | ✅ pass |
| 04-followups | Footer credit link to 915website.com | N/A (owner request) | unit | `node --test tests/unit/chrome.test.mjs` | ✅ | ✅ pass |
| 04-followups | isBasedOn `@type` → CreativeWork | SEO-01, SEO-02 | unit + manual | `node --test tests/unit/structured-data.test.mjs`; owner Rich Results Test (UAT 1) | ✅ | ✅ pass |
| 04-followups | WR-01 `SOURCE_SLUG_RE` guard on source pages | REND-04 | unit | `node --test tests/unit/listing-pages.test.mjs` | ✅ | ✅ pass |
| 04-followups | WR-03 tsconfig + `typecheck` script | N/A (review finding) | other | `pnpm run typecheck` → `Result (48 files): 0 errors` (process exit 1 is the documented, unrelated assert-no-d1 interaction) | ✅ | ✅ pass |
| 04-followups | WR-02 manifest schema-stale flag clears only on cold pass | REND-01, SEO-04 | unit | `node --test tests/unit/articles-loader.test.mjs` | ✅ | ✅ pass |
| 04-followups | WR-04 deploy-hook test fetch-mock type (915tldr.com2) | OPS-10 | unit (other repo) | `node --test tests/unit/frontend-deploy-hook.test.ts` (915tldr.com2) | ✅ (other repo) | ✅ pass (per 04-followups-SUMMARY; not re-run 2026-09-30 validate pass) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — every row above is ✅ as of 2026-09-30 (this
session re-ran every automated command listed, plus the aggregate full-suite chain — see "Full
Suite Result" below).*

---

## Wave 0 Requirements

- [x] `tests/regression/changelog-empty-state.test.mjs` — REND-02 / REND-03 / FIX-05 (04-08 T1)
- [x] `tests/unit/articles-loader.test.mjs` — REND-01 (04-03 T2)
- [x] `tests/integration/url-shapes.test.mjs` — SEO-04 / FIX-04 (04-12 T1, live; supersedes the
      original unit-level placeholder this row named at planning time)
- [x] `tests/unit/seo-surfaces.test.mjs` — SEO-05 / SEO-06 (04-07 T2)
- [x] `tests/unit/structured-data.test.mjs` — SEO-01 / SEO-02 (04-02 T1)
- [x] `tests/unit/news-sitemap.test.mjs` — SEO-03 (04-07 T3)
- [x] `tests/unit/article-markup.test.mjs` — IDNT-03 / IDNT-04 / SEO-07 (04-04 T3)
- [x] Spike: minimal Loader-throw reproduction against real `astro build` (Open Question #1) —
      **CONFIRMED**, `docs/phase-04/spikes.md` § Spike 1 (04-01 T3): a throw inside a real Content
      Layer `Loader.load()` fails `astro build` with exit code 1, naming the `d1-client` module.
- [x] Spike: two consecutive Workers Builds runs proving `experimental.incrementalBuild` reuse
      (Open Question #2) — **CONFIRMED on the real platform**, `docs/phase-04/build-measurements.md`
      § Workers Builds spike, Build 4 (04-10 T2): verdict `WB_REUSE_PROVEN`, ≥34,871/~60,349 pages
      restored on a genuinely fresh Workers Builds container, superseding 04-09's local
      `REUSE_WARM_ONLY` finding (which used the same spike mechanism locally first, 04-09 T3).

All Wave 0 references now exist on disk and pass. `wave_0_complete: true` set in this file's
frontmatter.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Structured data validates clean in Google Rich Results Test | SEO-01 / SEO-02 | No CI-friendly API within budget | Run a real live article URL from `dev.915tldr.com` through search.google.com/test/rich-results; record the result. **Handed to the owner as 04-12 Task 3's human-check item 1.** |
| Canonical outlet link and AI disclosure are *prominent* | SEO-07 / IDNT-03 / IDNT-04 | Prominence is visual | Screenshots captured this session at 320px and 1280px (`tests/integration/browser-journeys.test.mjs`, session scratchpad, not committed) — owner reviews these plus the live article in both system themes. **Handed to the owner as human-check item 2.** |

---

## Live Verification (04-12)

Deployed the phase to `dev.915tldr.com` (`pnpm run ci:local`, Version ID
`2b16cdeb-9eb5-4930-bc68-d68fda98a26f`) and re-proved every public URL/SEO contract against the
real deployment:

- `pnpm run verify:edge` — 4/4 checks pass. Check 4's live-article discovery no longer lists the
  KV render manifest (which does not scale past a handful of keys per its own doc comment, and
  Phase 4 has now populated ~40k+ keys) — it parses the live homepage's first `[data-card]` link
  instead. Zero D1/KV credentials needed for discovery any more.
- `tests/integration/url-shapes.test.mjs` — 57/57 pass (both navigation-header and plain-request
  variants). Observed trailing-slash redirect status: **307** (Cloudflare's native
  `html_handling`, matches the already-documented deviation from CONTEXT.md's literal "301"
  wording, `docs/phase-04/spikes.md`). `/changelog` renders 15 entries, matching the already
  owner-approved `CHANGELOG_MIN_EXPECTED` floor from 04-08 (not the plan's stale "18" figure,
  which predates that finding).
- `tests/integration/browser-journeys.test.mjs` — 6/6 pass, real Chromium: home → Crime nav click
  → first article card click (no redirects); a non-canonical `/article/<uuid>` URL resolves to
  canonical after exactly one real 301 hop (walked via the browser's own
  `request.redirectedFrom()` chain); an unknown-uuid path shows `[data-404-suggestions]` visible
  with a link within 5s; `/categories` → homepage; `/crime/` → `/crime`; 320px/1280px screenshots
  captured for the owner's prominence review.

---

## Full Suite Result (2026-09-30, this session)

```
pnpm run test:unit          -> 385/385 pass
pnpm run test:build-gate    -> 8/8 pass
pnpm run test:regression    -> 5/5 pass (includes the real two-build byte-identity replay, ~109s)
TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer -> 5/5 pass (live check against
  the deployment from this plan's Task 1)
```

All four commands chained (`&&`) exited 0. Total wall time: **2m 34s** (warm build feedback,
39.9s, is the dominant per-task-commit cost; the byte-identity regression's two real builds
dominate the full-suite cost).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are a documented checkpoint/owner-decision with no
      code change (04-04 T1, 04-07 T1, 04-10 T1, 04-11 T1 — each immediately followed by an
      automated-verify task within the same plan; no 3 consecutive tasks anywhere in this phase
      lack automated verification)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (checked across the
      full 04-01→04-12 execution order above)
- [x] Wave 0 covers all MISSING references (all 7 test files + both spikes now exist and pass)
- [x] No watch-mode flags anywhere in this phase's test commands
- [x] Feedback latency measured and recorded (39.9s warm build; 2.5s `test:fast`; 2m34s full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** executor-validated 2026-09-30 (04-12 Task 3). `status:` remains `draft` per this
file's own lifecycle comment — `validated` is set by a separate `/gsd-validate-phase` pass if the
owner runs one; this plan's own scope is filling the map and the Wave 0/Nyquist flags, not
changing that field.
**Validated:** `/gsd-validate-phase 4`, 2026-09-30 — `status: validated` (see audit below).

---

## Validation Audit 2026-09-30

`/gsd-validate-phase 4` (State A — audit existing). Re-checked the map against code that landed
after 04-12 wrote it (04-followups: `articles-loader.ts`, `404.astro`, `[category]/[slug].astro`,
`source/[slug].astro`, `structured-data.ts`, `Base.astro`). The security pass (`e9c0c19`) changed
docs only. Added six 04-followups rows above.

Requirement coverage: all 18 Phase 4 IDs (REND-01..05, SEO-01..08, IDNT-03, IDNT-04, OPS-10,
FIX-04, FIX-05) map to at least one automated row. **COVERED: 18 · PARTIAL: 0 · MISSING: 0.**

Re-ran the full suite fresh in this pass rather than relying on the 04-12 result:

```
pnpm run test:unit          -> 390/390 pass (warm build + tests, 44s; +5 tests from 04-followups)
pnpm run test:build-gate    -> 8/8 pass
pnpm run test:regression    -> 5/5 pass (byte-identity two-build replay included, 112s)
TRACER_LIVE_ORIGIN=https://dev.915tldr.com pnpm run test:tracer -> 5/5 pass
pnpm run typecheck          -> astro check: 0 errors (48 files)
```

Not re-run in this pass: the live `tests/integration/url-shapes.test.mjs` and
`browser-journeys.test.mjs` suites (last green 2026-09-30 in 04-12), and 915tldr.com2's
frontend-deploy-hook test (last green in 04-followups).

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

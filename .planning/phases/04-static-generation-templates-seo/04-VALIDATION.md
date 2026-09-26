---
phase: 4
slug: static-generation-templates-seo
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node --test` (unit/integration) + Playwright `@playwright/test` 1.63.0 (browser-driven) |
| **Config file** | none dedicated — `package.json` scripts; Playwright config in `design/scripts/pw.mjs` |
| **Quick run command** | `pnpm run test:unit` |
| **Full suite command** | `pnpm run test:unit && pnpm run test:build-gate && pnpm run test:tracer && pnpm run test:e2e` |
| **Estimated runtime** | quick: dominated by `pnpm run build` (measure in Wave 0); full: includes live D1/KV tracer |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test:unit`
- **After every plan wave:** Run the full suite (includes `test:build-gate` and `test:tracer`, which hit real D1/KV — budget-aware)
- **Before `/gsd-verify-work`:** Full suite must be green AND the Open Question #1/#2 spikes explicitly resolved (recorded result, not just "tests pass")
- **Max feedback latency:** bounded by one `pnpm run build`; measure in Wave 0 and record here

---

## Per-Task Verification Map

*Filled in by the planner/executor as tasks are assigned. Requirement → test mapping from research:*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| REND-02 / REND-03 / FIX-05 | Loader throws on zero rows / fewer than last-good count; `/changelog` empty-state regression | unit | `node --test tests/regression/changelog-empty-state.test.mjs` | ❌ W0 | ⬜ pending |
| REND-01 | Loader reads D1 incrementally via `meta` watermark (stubbed `fetchImpl`) | unit | `node --test tests/unit/articles-loader.test.mjs` | ❌ W0 | ⬜ pending |
| REND-05 | Unchanged articles not re-rendered | integration (two consecutive builds) | spike first — not yet a fixed test | ❌ W0 spike | ⬜ pending |
| SEO-04 / FIX-04 | `/crime` and `/crime/**` resolve; old UUID URLs resolve with no trailing-slash redirect | integration | `node --test tests/integration/url-shapes.test.mjs` | ❌ W0 | ⬜ pending |
| SEO-05 / SEO-06 | `robots.txt` / `rss.xml` match preserved policy; RSS links have no trailing slash | unit | `node --test tests/unit/seo-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| SEO-01 / SEO-02 | JSON-LD present and schema-shaped | unit | `node --test tests/unit/structured-data.test.mjs` | ❌ W0 | ⬜ pending |
| SEO-03 | Google News sitemap: last 48h only, ≤1000 entries | unit | `node --test tests/unit/news-sitemap.test.mjs` | ❌ W0 | ⬜ pending |
| IDNT-03 / IDNT-04 / SEO-07 | AI disclosure + outlet attribution markup on every article | unit (DOM via `linkedom`) | `node --test tests/unit/article-markup.test.mjs` | ❌ W0 | ⬜ pending |
| ARCH-02/03 (guard) | D1-import assertion still passes with new pages/loader | existing | `node --test tests/ci-fixtures/assert-no-d1.test.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/regression/changelog-empty-state.test.mjs` — REND-02 / REND-03 / FIX-05
- [ ] `tests/unit/articles-loader.test.mjs` — REND-01
- [ ] `tests/integration/url-shapes.test.mjs` — SEO-04 / FIX-04
- [ ] `tests/unit/seo-surfaces.test.mjs` — SEO-05 / SEO-06
- [ ] `tests/unit/structured-data.test.mjs` — SEO-01 / SEO-02
- [ ] `tests/unit/news-sitemap.test.mjs` — SEO-03
- [ ] `tests/unit/article-markup.test.mjs` — IDNT-03 / IDNT-04 / SEO-07
- [ ] Spike: minimal Loader-throw reproduction against real `astro build` (Open Question #1)
- [ ] Spike: two consecutive Workers Builds runs proving `experimental.incrementalBuild` reuse (Open Question #2) — recorded experiment result

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Structured data validates clean in Google Rich Results Test | SEO-01 / SEO-02 | No CI-friendly API within budget | Run a real built article from a preview deploy through the Rich Results Test; record the result |
| Canonical outlet link and AI disclosure are *prominent* | SEO-07 / IDNT-03 / IDNT-04 | Prominence is visual | Check a real article in a browser at 320px and ≥1024px, both themes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency measured and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

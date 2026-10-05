---
phase: 6
slug: bilingual
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-03
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node --test` (frontend repo); pipeline repo `../915tldr.com2` uses its own existing test setup |
| **Config file** | none — plain glob invocation |
| **Quick run command** | `pnpm run test:fast` |
| **Full suite command** | `pnpm run test:unit && pnpm run test:regression && pnpm run test:tracer` |
| **Estimated runtime** | quick: seconds (no build); full: includes `pnpm run build` |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run test:fast`
- **After every plan wave:** Run `pnpm run test:unit && pnpm run test:regression`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual Umami check (I18N-10) and a live `/es` page browser check
- **Max feedback latency:** quick suite only (no build) per task

---

## Per-Task Verification Map

*Filled in by the planner / execute-phase — one row per task.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | — | — | branch + dev-server consent | manual | checkpoint | — | ⬜ pending |
| 6-01-02 | 01 | 1 | I18N-01/02 | T-06-01/02 | Spanish grounded before publishable; English unaffected | unit + local e2e | `pnpm exec vitest run tests/bilingual.test.ts tests/ai-processor-store.test.ts tests/prompt-shape.test.ts` (pipeline) + local D1 row query | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | I18N-01 | T-06-02/03 | Spanish lexicon + cross-language judge; measured token budget | unit | `pnpm exec vitest run tests/grounding …` (pipeline) | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | I18N-04/08 | T-06-06/07 | /es archive key + /es canonical redirect | unit | `node --test tests/unit/worker.test.mjs tests/unit/article-url.test.mjs …` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | I18N-08 | T-06-06/09 | open redirect, enum, Accept-Language indifference | unit | `node --test tests/unit/article-redirect.test.mjs tests/unit/archive-route.test.mjs tests/unit/worker.test.mjs` | ✅ extend | ⬜ pending |
| 6-03-01 | 03 | 2 | — | T-06-11 | production schema consent | manual | checkpoint | — | ⬜ pending |
| 6-03-02 | 03 | 2 | I18N-01/02 | T-06-11 | additive migration, articles untouched | live read-back | `wrangler d1 execute … pragma_table_info('article_translations')` | — | ⬜ pending |
| 6-04-01 | 04 | 2 | I18N-04 | T-06-14 | Spanish partition onto es/ keys | unit | `node --test tests/unit/tier-facts.test.mjs tests/unit/partition-archive.test.mjs` | ✅ extend | ⬜ pending |
| 6-04-02 | 04 | 2 | I18N-04 | T-06-15/16 | es keys validated; manifest keys cannot collide | unit | `node --test tests/unit/r2-client.test.mjs tests/unit/archive-sync.test.mjs tests/unit/manifest-schema.test.mjs` | ✅ extend | ⬜ pending |
| 6-05-01 | 05 | 2 | I18N-03/05 | T-06-20 | / ↔ /es reciprocal hreflang, lang=es | build + dist | `pnpm run build && node --test tests/unit/i18n.test.mjs tests/unit/hreflang.test.mjs` | ❌ W0 | ⬜ pending |
| 6-05-02 | 05 | 2 | I18N-08/10 | T-06-21 | no auto language selection; Umami tag | build + dist | `node --test tests/unit/format.test.mjs tests/unit/chrome.test.mjs tests/unit/no-auto-language.test.mjs` | ❌ W0 | ⬜ pending |
| 6-06-01 | 06 | 3 | I18N-01/04 | T-06-24 | build-time-only Spanish collection | build | `node --test tests/unit/d1-client-translations.test.mjs tests/unit/spanish-view.test.mjs && pnpm run build` | ❌ W0 | ⬜ pending |
| 6-06-02 | 06 | 3 | I18N-04 | T-06-25 | held text never stored; never-shrink | unit | `node --test tests/unit/articles-es-loader.test.mjs tests/unit/build-state.test.mjs` | ❌ W0 | ⬜ pending |
| 6-07-01..02 | 07 | 4 | I18N-04/10 | T-06-26/27 | static /es pages; truthful privacy | build + dist | `node --test tests/unit/es-static-pages.test.mjs` | ❌ W0 | ⬜ pending |
| 6-07-03 | 07 | 4 | — | T-06-27 | fluent human approval (D-16) | manual | checkpoint | — | ⬜ pending |
| 6-08-01 | 08 | 3 | I18N-01/02 | T-06-30 | measured dry run, no spend beyond sample | unit + script | `pnpm exec vitest run tests/translation/translation-prompt.test.ts && node scripts/backfill-translations.mjs dry-run` | ❌ W0 | ⬜ pending |
| 6-08-02 | 08 | 3 | I18N-01 | T-06-29 | escaped pilot write | unit + live read-back | `pnpm exec vitest run tests/translation/backfill-sql.test.ts tests/batch/execute-write.test.ts` | ❌ W0 | ⬜ pending |
| 6-09-01..02 | 09 | 4 | I18N-02/03/04/05/09 | T-06-33/34/35 | article pairs, D-05 fallback, disclosure parity | build + dist | `node --test tests/unit/article-page-model.test.mjs tests/unit/es-article-pages.test.mjs tests/unit/article-markup.test.mjs tests/unit/structured-data.test.mjs && pnpm run test:regression` | ❌ W0 | ⬜ pending |
| 6-10-01..02 | 10 | 5 | I18N-04/05 | T-06-37/38 | /es listings + 404 | build + dist | `node --test tests/unit/es-listing-pages.test.mjs tests/unit/not-found.test.mjs` | ❌ W0 | ⬜ pending |
| 6-11-01..02 | 11 | 6 | I18N-06 | T-06-40/41 | per-language RSS/sitemaps | build + dist | `node --test tests/unit/es-feeds.test.mjs tests/unit/news-sitemap.test.mjs tests/unit/seo-surfaces.test.mjs` | ✅ extend | ⬜ pending |
| 6-12-01..02 | 12 | 7 | I18N-04/05 | T-06-43 | measured budget; full-corpus pair invariant | build + dist | `node --test tests/unit/hreflang-pairs.test.mjs tests/unit/es-lang-and-links.test.mjs` | ❌ W0 | ⬜ pending |
| 6-13-01..03 | 13 | 8 | I18N-01/02 | T-06-45/46 | owner decision, deployable pipeline | unit + manual | `pnpm exec vitest run && pnpm build` (pipeline) | — | ⬜ pending |
| 6-14-01..03 | 14 | 9 | I18N-01/02 | T-06-48/49 | live ingest rows; ceiling-enforced backfill | live + unit | `pnpm exec vitest run tests/translation && node scripts/backfill-translations.mjs status` (pipeline) | ❌ W0 | ⬜ pending |
| 6-15-01..03 | 15 | 8 | I18N-04/05/06 | T-06-52/54 | es-only pre-population; owner-routed deploy | live | R2 listKeys counts | — | ⬜ pending |
| 6-16-01..02 | 16 | 9 | I18N-03/04/05/06/08/09 | T-06-55 | real-browser journeys; Accept-Language → English | live | `node --test tests/integration/browser-journeys.test.mjs tests/integration/url-shapes.test.mjs` | ✅ extend | ⬜ pending |
| 6-16-03 | 16 | 9 | I18N-10 | T-06-57 | Umami language report seen live | manual | checkpoint | — | ⬜ pending |
| 6-17-01..03 | 17 | 10 | I18N-01/02/04 | T-06-58/59 | backfill complete under ceiling; live convergence | live | `node scripts/backfill-translations.mjs status` + convergence doc | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement → Test Map (from research)

| Req ID | Behavior | Test Type | Where | Exists? |
|--------|----------|-----------|-------|---------|
| I18N-01 | EN + ES summaries in the same model call | unit (pipeline repo) | extend openai/grounding tests in `915tldr.com2` | ❌ W0 |
| I18N-02 | source language stored and retrievable | unit | new `article_translations` / schema test | ❌ W0 |
| I18N-03 | `lang="es"` on the correct element | unit + integration | `tests/integration/url-shapes.test.mjs`-style live check | ❌ W0 |
| I18N-04 | `/es/...` exists for every page type | integration | extend `tests/integration/url-shapes.test.mjs` | ✅ extend |
| I18N-05 | hreflang + x-default pairs | unit | new test against `Base.astro` rendered `<head>` | ❌ W0 |
| I18N-06 | per-language sitemap + RSS | unit | extend `tests/unit/news-sitemap.test.mjs` | ✅ extend |
| I18N-08 | no auto-redirect on Spanish `Accept-Language` | integration | extend `url-shapes.test.mjs` or `tools/verify-edge-headers.mjs` | ✅ extend |
| I18N-09 | AI disclosure present in Spanish | unit | extend `tests/unit/article-markup.test.mjs` | ✅ extend |
| I18N-10 | Accept-Language informs launch decision (Umami) | manual | live Umami dashboard | — manual |

---

## Wave 0 Requirements

- [ ] Test proving the manifest/R2 key collision is fixed — EN and ES `ManifestEntry` for the same uuid are independently readable
- [ ] Test proving `/es` archive-tier requests do NOT redirect to English
- [ ] `article_translations` schema test (shape, grounding-status values, D-05 fallback)
- [ ] hreflang / x-default rendering test against `Base.astro`
- [ ] Framework install: none — `node --test` already wired

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spanish-preferring request share visible | I18N-10 | Signal lives in the third-party Umami dashboard UI | Open stats.915websites.com, confirm a Languages/locale report exists and shows 915tldr traffic |
| `/es` page and switcher work in a real browser | I18N-04, I18N-08 | Project verification standard: drive a real page, not the built output | Load an EN page, click "Español", confirm `/es` URL, `lang="es"`, internal links stay `/es`; send `Accept-Language: es` and confirm English is served |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (quick suite has no build step)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

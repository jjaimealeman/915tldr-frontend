---
phase: 06-bilingual
verified: 2026-10-05T12:50:00Z
status: passed
score: 5/7 must-haves verified
behavior_unverified: 0
overrides_applied: 1
re_verification: false
gaps:
  - truth: "Every article exists in English and Spanish (phase goal; ROADMAP SC1 'the Spanish backfill of the archive runs via the Batch API')"
    status: partial
    reason: "Backfill ran as shape B (translation-only, newest 10,000, flagged rows written 'held' with no judge pass), by owner decision on cost. Production D1 read-back 2026-10-05: 3,608 clean Spanish rows (8.8% of 40,912 public articles), 6,470 held (15.8%), about 30,800 articles (75%) have no Spanish row at all. 64.4% of backfilled rows were held. A reader sees clean Spanish for about 1 article in 11; the rest get the English fallback note. Process requirements of SC1 (costed dry run, approval, Batch API only) were met."
    artifacts:
      - path: "/home/jaime/www/_github/915tldr.com2/docs/phase-06/translation-backfill-report.md"
        issue: "Records the 10,000-row scope, $3.4114 spend, 3,563 clean / 6,437 held"
      - path: "/home/jaime/www/_github/915tldr.com2/docs/phase-06/go-live-decision.md"
        issue: "Machine-readable approval: backfillShape translation-only-newest, maxRows 10000; the full archive (40,529 priceable rows) is explicitly not approved"
    missing:
      - "Either an owner-accepted override of this truth (recommend: add to frontmatter as an override, see below) with ROADMAP SC1/goal and D-10 amended to the shipped scope"
      - "Or a gap-closure plan: extend backfill to the 30,579 older eligible articles (13,243 archive-tier) once credits allow, plus a decision on the 64% held rate (judge pass over held rows; measured rescue rate so far 1 of 18, n=18)"
  - truth: "SC5: a report of Spanish-preferring request share is available to inform the /es launch decision on 2-4 weeks of measured data (I18N-10)"
    status: partial
    reason: "Umami tag is live on every v2 page with navigator.language in the payload (confirmed in the served script.js), and the Privacy page (EN+ES) discloses it. But D-11 required the Languages report to be CONFIRMED before I18N-10 is marked met. Jaime looked on mobile and saw no Languages panel; Filter and Breakdown views were not checked. Separately, the Umami tag is NOT on public v1 (915tldr.com homepage HTML has no stats.915websites.com script; the 'quick task in 915tldr.com2' of D-11 was not done), so only dev.915tldr.com traffic is being measured until cutover and no 2-4 week window of real reader data can accrue."
    artifacts:
      - path: "https://dev.915tldr.com/ (served HTML)"
        issue: "tag present with data-website-id 8e82b1af-..., defer"
      - path: "https://915tldr.com/ (v1)"
        issue: "no Umami script in served HTML"
    missing:
      - "Human check of Umami: Overview Location/Environment tabs, Filter and Breakdown (Languages / 'language' field) for website 8e82b1af-925f-4a5a-b0d1-e02f616ae077"
      - "If no Languages view exists: D-11 fallback (aggregate es-first/en-first/other counter, no IPs, no D1) as a gap plan"
      - "Decide whether the v1 Umami tag is installed now (to gather real language data before cutover) or accepted as post-cutover"
deferred: []
human_verification:
  - test: "Open the self-hosted Umami (stats.915websites.com), website 8e82b1af-925f-4a5a-b0d1-e02f616ae077; look for a Languages breakdown on desktop (Overview tabs, Filter > Language, Breakdown report on field 'language')"
    expected: "A view that lists browser languages (es-MX, en-US, ...) and includes the es-MX test visits from 2026-10-05T01:55:25Z-01:55:28Z (3 page views on dev.915tldr.com)"
    why_human: "Requires authenticated access to the Umami dashboard; I have no credentials and the API is auth-gated"
  - test: "Keyboard Tab check on https://dev.915tldr.com/ (Tab 1 skip link, Tab 2 logo, Tab 3 Español with a visible focus ring)"
    expected: "Focus ring visible and unclipped on the Español link"
    why_human: "06-16 Task 3 step 2 was never recorded as done by Jaime; automated test measured the ring but a human look is the stated gate"
  - test: "Mobile (390px) look at /es: category nav, switcher, a translated article, a fallback article"
    expected: "Two-column nav, no overflow; switcher reachable"
    why_human: "All recorded screenshots are 1280px; the nav fix test is asserted but I did not drive a browser (a Playwright run would add Umami page views)"
overrides:
  - must_have: "Every article exists in English and Spanish; the Spanish backfill of the archive runs via the Batch API"
    reason: "Shape B accepted on cost: newest 10,000 articles, translation-only, flagged rows held; remainder serves the D-05 English fallback until a later extension"
    accepted_by: "Jaime Aleman"
    accepted_at: "2026-10-07T21:37:00-06:00"
---

# Phase 6: Bilingual Verification Report

**Phase Goal:** Every article exists in English and Spanish, and the reader, never an IP lookup, chooses which one they see.
**Verified:** 2026-10-05T12:50Z
**Status:** gaps_found
**Re-verification:** No, initial verification

Verifier stance: SUMMARY claims were not trusted. Everything below was re-measured on 2026-10-05 against live `https://dev.915tldr.com` (GET only), `https://915tldr.com` (v1, GET only), read-only production D1 queries, `wrangler deployments list`, and the source in both repos. No writes, no deploys, no builds, no commits.

## Headline

The reader-choice half of the goal is solidly achieved and independently re-verified. The "every article exists in Spanish" half is not: by deliberate, owner-approved scope reduction only 8.8% of public articles have a Spanish version a reader can see. The measurement system for the launch decision (SC5/I18N-10) is installed but unconfirmed, and absent from the live public site.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1a | SC1 (ingest): each newly ingested article carries an English and a Spanish summary from the same model call, source language detected and stored | VERIFIED | `server/utils/openai.ts` lines 190-194: one prompt returns `sourceLanguage`, `titleEs`, `summaryEs`; `ai-processor.ts` writes `article_translations` with `storeTranslation`. Production Worker `a8e4451e` live since 2026-10-04T20:23Z (`wrangler deployments list`). D1: 43 articles processed since 20:30Z, 0 without a translation row; 48 `origin='ingest'` rows from 22:01Z to 12:12Z today (32 clean / 16 held); `source_language` populated on all 10,078 rows (en 8,074 / es 2,004 / und 0) |
| 1b | SC1 (backfill) / goal: the Spanish backfill of the archive runs via the Batch API after a costed dry run and approval, so every article exists in Spanish | FAILED (partial; owner-approved deviation) | Process met: dry run (`translation-backfill-dry-run.md`), approval record (`go-live-decision.md`), Batch API, $3.4114 vs $7.50 ceiling. Coverage not met: D1 read-back shows clean 3,608 / held 6,470 / no row about 30,800 of 40,912 public. Held rate by month rises with age (Oct 40.7%, Sep 53.1%, Aug 70.9%, Jul 71.1%) |
| 2 | SC2: `/es/...` for every public page type; self-referencing hreflang pairs plus x-default; separate sitemaps and RSS per language | VERIFIED | Route tree: all 15 English page types (excluding language-neutral `version.json`) have an `src/pages/es/` twin. Live 200: `/es`, `/es/crime`, `/es/about|contact|privacy|terms|changelog|tags`, `/es/source/kvia`, `/es/rss.xml`, `/es/news-sitemap.xml`, Spanish 404 with `lang="es"`. Hreflang en/es/x-default (x-default to English) seen on `/`, `/crime`, `/about`, `/es`, `/es/crime`, `/es/about`, `/es/tags`, a translated article pair, `/es/tag/*`. Held article: English page emits en + x-default only, `/es` twin is `noindex` with self canonical (correct: no fake pair). `sitemap-index.xml` lists `sitemap-en-0/1` and `sitemap-es-0`; `sitemap-es-0` has 23,730 URLs, all `/es`, and omits a held article. `/es/rss.xml` `<language>es-us</language>`, `/es/news-sitemap.xml` 85 entries. Caveat: hreflang/canonical hosts are `https://915tldr.com`, where `/es` is still 404 (v1), so pairs resolve only after cutover |
| 3 | SC3: a Spanish `Accept-Language` request lands on the English page; no IP or browser auto-redirect anywhere | VERIFIED | Live GET with `Accept-Language: es-MX,es;q=0.9` on `/`, `/crime`, `/about` (dev) and `/` (v1): 200, no redirect, `<html lang="en">`. Same on an English article. Source: `src/worker.ts` never reads the header/cookie/`request.cf` (comment-only mentions); `tests/unit/no-auto-language.test.mjs` scans `src/` for all five forbidden surfaces and asserts no Astro `i18n` config key. 06-16 browser journey C (es-MX context, one navigation, no redirect) recorded green. IP/country redirect cannot be simulated from one machine; covered structurally by the source scan |
| 4 | SC4: Spanish articles render `lang="es"` on the correct element and carry the same AI disclosure | VERIFIED | Translated `/es` article: `<html lang="es">`, "Este resumen fue redactado por IA a partir de la cobertura de KVIA. Puede omitir detalles - lea la nota original." (EN equivalent: "This summary was written by AI from reporting by KVIA."). Fallback `/es` article: `<html lang="es">`, content elements `lang="en"`, Spanish disclosure present, "No disponible en espanol todavia." note, `noindex`. Spanish-origin English page: source link `lang="es" hreflang="es"` and "Originally reported in Spanish" (D-07). Tags `lang="en"` on `/es` pages (D-02). JSON-LD `inLanguage` es/en correct |
| 5 | SC5: Accept-Language / language data is available to inform the `/es` launch decision | UNCERTAIN (human needed, plus gap, see gaps) | Tag live on every v2 page; `script.js` payload sends `language: navigator.language`; Privacy EN and ES disclose Umami and browser language. Not met: Languages report not seen by Jaime (mobile Overview only); tag absent from v1 `915tldr.com`. Requirement as stated in D-11 ("research must confirm") is not satisfied by evidence |
| 6 | Goal clause: the reader, not an IP lookup, chooses (switcher present on every page and article, plain links, `/es` links stay in `/es`) | VERIFIED | `data-lang-switch` on pages; article-level "Leer en espanol"/"Read in English" `data-lang-link` live; 06-16 journeys A/B (real Chromium clicks) and D-14 assertion (0 of 32 links leave `/es`) recorded green; `data-site-nav="sections"` and 7 matching selectors in the live stylesheet (nav defect fix deployed) |

**Score:** 5/7 rows verified (1a, 2, 3, 4, 6); 1b failed (override-eligible), 5 uncertain. Against the roadmap's five criteria: SC2, SC3, SC4 verified; SC1 split (ingest met, backfill coverage not met); SC5 uncertain.

### Override suggestion (for 1b)

This looks intentional and owner-approved (Jaime, 2026-10-04 12:55 MDT, "lets go with your recommend, i trust you bro"; balance was $7.15). To accept it, add to frontmatter (I cannot accept it on Jaime's behalf):

```yaml
overrides:
  - must_have: "Every article exists in English and Spanish; the Spanish backfill of the archive runs via the Batch API"
    reason: "Shape B accepted on cost: newest 10,000 articles, translation-only, flagged rows held; remainder serves the D-05 English fallback until a later extension"
    accepted_by: "Jaime Aleman"
    accepted_at: "<ISO timestamp>"
```

Even with the override, ROADMAP goal/SC1 and CONTEXT D-10 should be amended so the contract matches what shipped. Note that D-10 said an almost empty `/es` "would be a weak first impression"; what shipped is 8.8% clean, which the owner chose knowingly.

### Required Artifacts / Key Links (spot-verified, not exhaustive; the 17 plans' artifacts were exercised through the live site)

| Artifact | Status | Details |
|----------|--------|---------|
| `article_translations` table (prod D1) | VERIFIED | Queried live: 10,078 rows, columns per migration, PK (article_id, language) |
| `src/pages/es/**` (15 files) | VERIFIED | Complete mirror of English page types; live 200s |
| Pipeline bilingual call + storeTranslation | VERIFIED | Source read; live rows from the production Worker |
| `articlesEs` loader to `/es` pages | VERIFIED | Translated pages render Spanish content from D1 rows; held rows produce fallback (negative control: 6,437 held, sampled held page shows fallback) |
| Fix 908ee79 (`data-site-nav`) | VERIFIED | Live CSS has 7 `nav[data-site-nav=sections]` selectors, no `aria-label` selectors |
| Zero D1 on public path for `/es` | VERIFIED (partial) | No `cloudflare:workers`/D1 import in `src/`; Spanish data enters at build time only. I did not re-run `assert-no-d1` (needs a build) |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| I18N-01 same-call bilingual summaries | PARTIALLY MET | Ingest path verified live (1a). Archive: 3,608 clean of 40,912 public; 6,470 held; about 30,800 none (1b) |
| I18N-02 source language detected and stored | PARTIALLY MET | Detected in the same call, stored on all 10,078 rows (en/es/und, no nulls). Not stored for the about 30,800 articles with no translation row |
| I18N-03 `lang="es"` on appropriate element | MET | Live: `<html lang="es">` on all `/es` pages, `lang="en"` on English-fallback content and tags, `lang="es"` on Spanish-origin source link |
| I18N-04 `/es/...` for every public page type | MET | 15 of 15 page types mirrored; live 200s; Spanish 404. REQUIREMENTS.md still says Pending (traceability stale) |
| I18N-05 hreflang pairs incl. x-default | MET | Live pairs on every sampled page type; reciprocal; fallback pages correctly emit no fake pair. Hosts point at the not-yet-cut-over production domain. Stale tracker status |
| I18N-06 per-language sitemaps and RSS | MET | Live; REQUIREMENTS.md already Complete. Warning below on `/es/tag` sitemap entries |
| I18N-08 reader chooses; no IP/browser redirect | MET | Live Accept-Language test, source scan test, journeys. Stale tracker status |
| I18N-09 same AI disclosure in Spanish | MET | Live, translated and fallback Spanish pages |
| I18N-10 Accept-Language logged to inform `/es` decision | NOT CONFIRMED | Tag live on v2 only, Languages report unseen, v1 untagged. See gaps |
| I18N-07 (Phase 1, not claimed here) | n/a | Already Complete |

All 9 IDs from the phase are accounted for; no orphaned requirement found (REQUIREMENTS.md maps exactly these 9 to Phase 6).

### Data-Flow Trace

Translated `/es` article text traces to a D1 `article_translations` row (title/summary/key_points) via the build-time loader; confirmed by matching the live Spanish title against the D1 title for article 35193 (clean) and the fallback behavior for held article 36000. No static fallbacks pretending to be data.

### Behavioral Spot-Checks (live, GET)

| Behavior | Result | Status |
|----------|--------|--------|
| Accept-Language es-MX on `/`, `/crime`, `/about`, article, v1 `/` | 200, `lang="en"`, no Location | PASS |
| `/es/` | 307 to `/es` (documented static-assets behaviour) | PASS |
| `/es/<wrong-category>/<slug>-<uuid>` | one 301 to the `/es` canonical | PASS |
| Unknown `/es/zz-nope` | 404 Spanish page | PASS |
| Stylesheet freshness, 25 archived EN tags + 25 archived EN articles (24/25 tags and 8/25 articles served from `archive`) | all 50 reference current `Base.h88la9Hn.css` (200), all 50 have `data-lang-switch` | PASS (window closed for now) |
| Held vs clean read-back in D1 vs live render | consistent | PASS |
| `node --test tests/integration/url-shapes.test.mjs` (live) | 87 pass / 3 fail (see anti-patterns) | WARNING |

### Probe Execution

None declared by the phase plans; SKIPPED.

### Anti-Patterns / Warnings

| Item | Severity | Detail |
|------|----------|--------|
| `url-shapes.test.mjs` fails 3 of 90 live (was 90/90 in 06-16) | Warning (test fragility, not a product defect) | (1) T-04-48 stale-deploy guard: deployed `90d8dfa` vs local HEAD `8e059a5` on `feature/phase-06-backfill`, git reports neither is an ancestor of the other; `git diff 90d8dfa HEAD -- src public tools wrangler.jsonc astro.config.mjs package.json` is empty, so the code deployed equals the local code. (2)(3) the fallback-article tests sample 5 RSS items and now find none un-translated (the backfill translated the recent window), so they cannot find a fallback page; a held page exists and I confirmed its behavior by hand. Suite should pick a known held uuid from D1 |
| `/es/tag/*` (20,105 URLs in `sitemap-es-0.xml`) are indexable with no `noindex` | Warning | e.g. `/es/tag/fifa`: 18 of 30 cards are English fallback (`lang="en"`). Mixed-language near-duplicate pages in the sitemap from day one (D-09 accepted `/es` public). Consider noindex or sitemap exclusion until a tag has mostly translated cards |
| Quality sample: clean Spanish article 35193 says "las elecciones en March" | Info | One untranslated month name passed the grounding/deterministic gates ("clean"). n=1, not a measured rate |
| Held-rate cause unknown | Warning | 6,437 of 10,000 held; top reason `proper-noun-absent` (4,215). Not measured whether these are real defects or a strict check against thin stored sources |
| Debt markers (TBD/FIXME/XXX) | none checked in depth | Not scanned across all phase files; no markers surfaced in the files read |

### Open items weighed (not gaps, but carry forward)

- Stale archived-asset window: observed twice during the phase; today 0 of 50 sampled archived English pages are stale and old hashes `Base.BlHo0D5C`/`Base.BFxpEvBV` return 404, confirming old CSS is never retained. The window recurs after every CSS-changing deploy (about 2 builds); pre-cutover item, not Phase 6 scope. Convergence of the deferred 19,252 backlog is now observed (resolved for this deploy), not the rate.
- Batch enqueued-token limit: still `null` (unverified); 50 chunks of 200 rows accepted. Matters only if the backfill is extended with larger chunks.
- Production KV written by local builds: 06-15 disclosed `buildHash afb5f4b` written to production manifest entries; no reader of `buildHash` found, effect not proven for the incremental path. Informational.
- 1,200s Workers Builds ceiling: total build about 1,070s (130s margin), whether the ceiling covers only the build command (631s) or the whole build is unverified. Static files 59,306 of 80,000 fail line (planning budget 60,000). Spanish translation growth adds pages as backfill is extended, so re-measure then.
- 06-02/06-04 left I18N-04/05/08 Pending by design; they are met and REQUIREMENTS.md/ROADMAP should be updated at phase close (ROADMAP line 32 still shows Phase 6 unchecked and SC5 still says "2-4 weeks of measured data", superseded by D-09/D-11).
- Production cutover is not part of this phase: public `915tldr.com` has no `/es` (404) and no Umami; `dev.915tldr.com` is the only place the work is live.

### Human Verification Required

1. **Umami Languages report (I18N-10).** Test: look in Overview, Filter, and Breakdown for a language view on website 8e82b1af-...; look for the es-MX visits of 2026-10-05T01:55Z. Expected: language list visible. Why human: authenticated dashboard.
2. **Keyboard focus on the Espanol link** (06-16 Task 3 step 2, not recorded as done).
3. **Mobile 390px look at `/es`** (nav, switcher, fallback article); only 1280px was ever eyeballed.
4. **Decisions only Jaime can make:** accept the shape-B coverage as the Phase 6 deliverable (override) or open a gap plan to extend; install the v1 Umami tag now or accept post-cutover measurement; whether `/es/tag/*` should be noindex while mostly English.

### Gaps Summary

Two things keep this from `passed`. First, the phase goal says every article exists in Spanish, and 91% do not appear in Spanish to a reader; this was a conscious cost-driven decision with approvals on record, so the right move is an explicit override plus roadmap amendment, or a funded extension, not silence. Second, I18N-10 cannot be called met: the data path is wired but the report that makes it useful was not seen, and the public v1 site does not carry the tag, so even a confirmed report would currently describe only dev traffic. Everything else in the phase (routing, hreflang, sitemaps/feeds, lang attributes, disclosure, no auto language, ingest bilingual write, switcher, nav fix) was re-verified live and holds.

---

_Verified: 2026-10-05T12:50:00Z_
_Verifier: Claude (gsd-verifier)_


## Owner decisions (2026-10-07, ~21:37 MDT, orchestrator session)

Jaime replied "1. confirmed. 2. confirmed. 3. confirmed. 4. confirmed. all approved." to the four open decisions listed in the orchestrator's verification summary. Interpretation recorded here so it can be corrected:

1. **Coverage**: accepted as the Phase 6 deliverable (override above); ROADMAP goal, SC1 and SC5 and CONTEXT D-10 amended to the shipped scope. Extending to the 30,579 older articles remains a possible later, separately approved step (about $1.40 per extra month, higher hold rate with age).
2. **Umami**: Jaime confirmed the language-view check and approved installing the v1 Umami tag (D-11's never-done quick task in 915tldr.com2). The language view itself was NOT independently verified (Umami needs auth); I18N-10 is recorded as owner-confirmed. The v1 tag is a post-phase quick task: until it ships, only dev traffic is measured.
3. **Spanish tag pages**: approved to be noindex and dropped from the Spanish sitemap while their cards are mostly English fallback (20,105 `/es/tag/*` URLs today). Post-phase quick task.
4. **Phone check**: confirmed; four screenshots emailed 2026-10-07 21:33 MDT (English and Spanish home and article, two-column nav live on the real phone).

Post-phase quick tasks (each needs a feature branch from Jaime): (a) `/es/tag/*` noindex + remove from `sitemap-es`; (b) fix the 3 fragile live tests in `url-shapes.test.mjs` (ancestry guard after the merge shape; two fallback-page samples now all translated); (c) v1 Umami tag in 915tldr.com2; (d) Umami opt-out page on 915tldr.com. Pre-cutover items still open: stale-asset window recurs after every CSS change; Batch enqueued-token limit unverified; production KV written by local builds.

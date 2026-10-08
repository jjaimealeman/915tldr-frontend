# Phase 6 live verification (06-16)

Verified against `https://dev.915tldr.com` on 2026-10-04 (evening MDT), serving production Workers
Build of `main` at commit `454aab4` (`/version.json` `builtAt` 2026-10-05T00:29:55Z). GET-only. The
one deliberate side effect is Journey C's three Umami page views (section 4).

Tests: `tests/integration/browser-journeys.test.mjs` (14 tests, all pass, includes every
pre-existing journey) and `tests/integration/url-shapes.test.mjs` (90 tests, all pass, includes the
T-04-48 guard and every pre-existing check). Evidence screenshots are in
`docs/phase-06/evidence/`.

## 0. Read this first: two defects found on the live site

Neither is fixed by this plan (06-16 verifies, it does not change `src/`). Both are on the live site
right now.

### 0.1 Archived English pages that have not been re-uploaded are UNSTYLED (404 stylesheet)

This is the exact gap 06-05 suspected. It is real and visible.

- Archived English pages that the post-deploy sync has not reached yet still reference the previous
  build's stylesheet `/_astro/Base.BFxpEvBV.css`, which now answers **404**. The current stylesheet is
  `/_astro/Base.BlHo0D5C.css` (200).
- Measured over an evenly spread sample of 25 archived English articles and 25 archived English
  tags (plus their `/es` twins), 2026-10-04 about 20:00 MDT:

  | Page set | Stylesheet | Status | Pages |
  |---|---|---|---|
  | archived EN article | `Base.BlHo0D5C.css` | 200 | 23 of 25 |
  | archived EN article | `Base.BFxpEvBV.css` | **404** | 2 of 25 |
  | archived EN tag | `Base.BFxpEvBV.css` | **404** | **25 of 25** |
  | archived /es article | `Base.BlHo0D5C.css` | 200 | 25 of 25 |
  | archived /es tag | `Base.BlHo0D5C.css` | 200 | 25 of 25 |
  | hot EN article / hot /es article | `Base.BlHo0D5C.css` | 200 | all sampled |

  (The committed suite samples 12 + 12 and recorded 11 EN articles at 200, 1 at 404, 12 EN tags at
  404, all `/es` at 200.)
- The same stale pages also have the pre-Phase-6 chrome: no "Español" header link, no hreflang.
  Example `/tag/1099-forms`: no `data-lang-switch`, no `hreflang`. 27 of 50 sampled archived English
  pages were stale this way; the 23 that were fresh all had the switch.
- Screenshot of the effect: `docs/phase-06/evidence/06-16-archived-en-tag-stale.png` (plain unstyled
  HTML) against `06-16-archived-es-tag-fresh.png` (same tag, `/es`, styled).
- Cause, from the 06-15 facts: the first deploy changed the CSS hash, the Spanish objects were
  pre-populated with the new hash, but the 31,018 changed English archive objects only converge
  through the post-deploy sync. That sync uploaded 11,959 and **deferred 19,252** (backlog count
  19,252 since 2026-10-05T00:45:52Z). `/version.json` was still `454aab4` at 02:00Z, so no later
  build had run when I measured; I have not seen the backlog shrink.
- Baseline: any CSS-changing deploy creates this window, and the old hash is not retained in the new
  deploy. I did not measure how long a window lasted after an earlier CSS change, so "pre-existing
  design behaviour" is an inference, not a measurement.
- For Jaime, pre-cutover: re-run the stylesheet check after the next one or two production builds
  (`node --test tests/integration/url-shapes.test.mjs`, look for the `FINDING:` lines and the
  `stylesheet status codes` block). It is not Phase 6 scope to change asset retention; it is a
  pre-cutover item.
- **Unmeasured:** whether the backlog actually drains in about 2 builds (derived by 06-12/06-15, still
  not observed), and whether the edge cache is holding some stale copies independently of R2.

### 0.2 The Spanish category nav is unstyled on every `/es` page

- On every `/es` page the category list (Crimen, Política, Deportes, ...) renders as a plain vertical
  bulleted list, where the English page shows one row of eight. See
  `docs/phase-06/evidence/06-16-es-article-translated-1280px.png` against
  `06-16-header-switch-focused.png`.
- Cause (read from source, not yet proven by a fix): `src/styles/global.css` styles the nav with
  `nav[aria-label="Sections"]` (lines 488, 494, 504, 515, 831, 841, 855), and the Spanish page's
  nav carries `aria-label="Secciones"` (`src/lib/i18n/dictionary.ts:34`, `navLabel`). The selector
  never matches on `/es`.
- Everything else on `/es` looked styled. This is a Phase 6 defect (the nav label went through the
  dictionary in 06-05/06-08); a fix is a small CSS selector change plus a deploy. Not done here.

## 1. Build timings: real Workers Build vs 06-12's projection

Source: the orchestrator's read of the Workers Builds log for build
`bf7b3a62-caff-4252-9b3d-f94a64698167` (second-resolution timestamps; I did not read the log myself,
the orchestrator had a helper read it). The `develop` build's figures are from the same read.

| Measurement | 06-12 projection (`build-budget.md` section 8.3 / 8.7) | Measured, main build `454aab4` |
|---|---|---|
| Mode | cold | cold: `[d1-articles] mode=cold public=40741 changed=40741 rowsRead=516204 budget=1500000` |
| Comparable quantity: `renderEnd` (partition-archive done, from build start) | about **643s** (about **688s** after the Spanish backfill) | **667s** |
| vs projection | | +24s (+3.7%) over 643s; 21s under 688s |
| Build command `pnpm run build:ci` | not projected separately | 631s |
| Astro "Completed in" | not projected separately | 7m55s |
| Astro page render | not projected separately | "121678 page(s) built in 10m18s" |
| Sitemap (`astro:build:done`) | about 93s (isolated benchmark, local) | about 80s |
| Total build | not projected | about **1,070s** (17m50s) from 00:28:12Z; success |
| File-count gate | 59,572 (06-12), 59,616 (06-15) | 59,306 / 100,000 (fail 80,000), ok |
| Spanish loader | | `[articles-es] mode=cold rows=49 available=26 held=23 rowsRead=98 budget=200000`; `[es-article] pages=40741 translated=26 fallback=40715 invalidSpanish=0` |

The projection held: 667s against 643s is inside the projection's own stated uncertainty and under
the 688s post-backfill figure. Verdicts `PHASE6_BUILD_FITS`, `PHASE6_FILES_WITHIN_BUDGET` stand on a
real measurement for the first time (one sample).

Deploy steps (same log read):

| Step | Result |
|---|---|
| archive-sync `pre` | uploaded 179, failed 0, deferred 0 |
| `wrangler deploy` | about 146s, 19,299 new or modified files, Version ID `c6495544-37f7-4a55-b813-b1e8ed3e5c29` |
| archive-sync `post` | about 3m44s: uploaded 11,959, failed 0, **deferred 19,252**, alerts `[]` |
| Archive totals | 13,460 articles + 17,737 tags archived (es: 13,460 + 17,737); 27,281 articles + 2,342 tags static |
| Concurrent `develop` build `ccf115e7` | `wrangler versions upload`, not activated; about 818s; version `e6bf5135-...` (preview only). Contention between the two builds was **not** tested |

Only warnings: three Vite font-resolution warnings (InstrumentSerif and SourceSerif4 woff2 "will be
resolved at runtime"). No errors, timeouts or alerts.

**Unmeasured, stated plainly:**
- Whether the 1,200s Workers Builds ceiling applies to the build command only (631s) or the whole
  build (1,070s, 130s margin).
- The effect of the 19,252 deferred backlog on later builds.
- Whether two builds running at once (main plus develop) slow each other.
- Workers Builds speed variance: this is one sample.

Live ingest evidence: production `article_translations` grew from 30 pilot rows to 49 rows by this
build, so about 19 rows were written by live cron ingest since the 06-13 deploy, about 13 clean and
6 held. **DERIVED** from `available=26 held=23` here against the pilot's 13/17, not counted
directly.

## 2. Browser journeys (Chromium, real locator clicks)

`node --test tests/integration/browser-journeys.test.mjs`: 14 tests, 14 pass (10 pre-existing, 4 new).
Default Playwright Chromium, same fontconfig isolation as the existing journeys. Each new journey
runs in its own browser context.

| Journey | Result | URLs |
|---|---|---|
| **A** English article, header "Español" | pass | `/crime/john-daniel-gallegos-...-12428b79-8dc7-4d35-9eb4-b78a14f0013c` -> click `[data-lang-switch] a` -> `/es/crime/john-daniel-gallegos-...-12428b79-...` (200, no redirect, `<html lang="es">`) |
| A: first rail card stays in `/es` | pass | click `[data-rail] [data-card] a` -> `/es/crime/evaristo-mora-arrested-in-chaparral-...-305cb0fc-d9d9-4c15-b19e-c245f791d1d3` (200, no redirect, `lang="es"`) |
| A: "Read in English" | pass | click `[data-lang-link] a` ("Read in English") -> `/crime/evaristo-mora-...-305cb0fc-...` (200, no redirect, `lang="en"`) |
| A: D-14, links on `/es` pages | pass | 32 links on the first `/es` article, 0 leave `/es` (excluding the two switch links); same assertion on the rail-card page |
| **B** `/es` -> Crimen -> first card | pass | `/es` -> click "Crimen" -> `/es/crime` -> click first card -> `/es/crime/john-daniel-gallegos-...-12428b79-...` (all 200, no redirects, `lang="es"`) |
| **C** es-MX browser (D-13) | pass | see section 3 |
| **Keyboard** | pass | Tab 1 = skip link; Tab 2 = "915 TLDR"; Tab 3 = "Español" |

Keyboard detail: the focused "Español" link matches `:focus-visible` and has a solid 3px outline,
colour `rgb(20, 22, 26)`, offset 2px, box-shadow none. Screenshot
`docs/phase-06/evidence/06-16-header-switch-focused.png` (header only, 1280px): the ring is clear, not
clipped, and the text is readable. This is a measurement plus my own look at the screenshot; Jaime's
own keyboard check is still Task 3 step 2.

Screenshots taken from the journey: a translated `/es` article
(`06-16-es-article-translated-1280px.png`, the Gallegos article) and a fallback one
(`06-16-es-article-fallback-1280px.png`, the Evaristo Mora article: English content, "No disponible
en español todavía.", `robots noindex`). The translated page is genuinely Spanish, including the AI
disclosure. Note the page also shows defect 0.2 (the bulleted nav).

Observation, not a defect: the first rail card on the translated article was a fallback article,
because only 26 articles are translated so far.

## 3. Journey C and Accept-Language (D-13)

Browser context `locale: 'es-MX'`, `extraHTTPHeaders: Accept-Language: es-MX,es;q=0.9`. For each of
`/`, `/crime` and the first RSS article: status 200, final URL unchanged, `<html lang="en">`,
`redirectedFrom() === null`, exactly one main-frame navigation, the request really carried
`Accept-Language: es-MX`, and `navigator.language` was `es-MX`.

The `url-shapes` suite repeats this with plain `fetch` under both header kinds (navigation headers
and plain) for `/`, `/crime` and an English article: 200, no `location` header, English body.

I18N-08's IP/country-based redirect cannot be simulated from one machine; it stays covered
structurally by the 06-02 Worker test and the 06-05 code scan (as the plan flagged).

## 4. Umami: the es-MX test visits (for Task 3)

- Journey C ran **2026-10-05T01:55:25Z to 01:55:28Z = 2026-10-04 19:55:25 to 19:55:28 MDT**, three page
  views (`/`, `/crime`, the Gallegos article) on `dev.915tldr.com`, language `es-MX`, screen 1280x900.
- The test context uses an ordinary desktop-Chrome user agent string. Headless Chromium's default
  `HeadlessChrome` user agent is the kind Umami's server-side bot filter discards, which would have
  made these visits invisible to the Languages report. All three `POST stats.915websites.com/api/send`
  calls returned HTTP 200 with a `cache` token (the response a discarded bot visit does not get), so
  Umami accepted them. Whether the Languages report then shows them is exactly what Task 3 asks
  Jaime to confirm.
- Every other test visit in this suite (the journeys that are not C) used the default headless user
  agent, so I expect them not to be counted; I did not verify that.
- **I18N-10 is NOT marked met here.** It stays open until Jaime sees the Languages report (D-11).

## 5. `/es` URL contract (`url-shapes.test.mjs`, live)

90 tests, 90 pass. T-04-48 guard: deployed `454aab4`, local HEAD `e6c48d8` is an ancestor, zero diff
under the guarded paths, so the deploy is trusted.

| Check | Result |
|---|---|
| `/es` and all 8 `/es/<category>`: 200, `lang="es"`, canonical `https://915tldr.com/es...`, hreflang en/es/x-default, English partner names it back (reciprocal) | pass |
| `/es/tag/<static>`: same contract | pass |
| `/es/tag/<archived>` (`/es/tag/1099-forms`): 200, `lang="es"`, hreflang, served from the archive tier (`archive;desc=...`) under both header kinds | pass, but its English partner `/tag/1099-forms` is STALE (no hreflang), logged as a `FINDING` (section 0.1) |
| `/es/tags`, `/es/source/kvia`, `/es/about`, `/es/contact`, `/es/privacy`, `/es/terms`, `/es/changelog`: same contract | pass |
| Translated `/es` article: indexable, Spanish AI disclosure (I18N-09), "Read in English" link, reciprocal hreflang | pass |
| Fallback `/es` article: `robots noindex`, "No disponible en español todavía", self canonical, no hreflang alternates | pass |
| ARCHIVED `/es` article (`/es/business/implications-of-paramounts-merger-...-0000e250-...`): 200, `Server-Timing: archive;desc=r2` on the first request, `archive;desc=edge-cache` after, `lang="es"` body, Read in English link, under both header kinds | pass. The sample is a D-05 fallback (English content): **no archived article has a Spanish translation yet** (only 26 articles are translated, all recent), so "Spanish content when translated" could not be observed on an archived page |
| Non-canonical `/es/<wrong-category>/<slug>-<uuid>`: exactly one 301 to the `/es` canonical, target answers 200 (hot and archived, both header kinds) | pass |
| `/es/` | 307 to `/es` (one hop, both header kinds); same redirect family as the English hot-page trailing slash (307 is the documented static-assets behaviour, `docs/phase-04/spikes.md`) |
| Unknown `/es/zz-no-such-page-0616` and `/es/crime/this-page-has-no-uuid-at-all-0616`: 404 with the Spanish 404 page (`lang="es"`, suggestions markup) | pass |
| Accept-Language `es-MX` on `/`, `/crime`, an English article: 200, English, no `location` | pass |
| `/es/rss.xml`: well-formed, `<language>es-us</language>`, items are `https://915tldr.com/es/...` | pass (2 items at the time, matching the 2 translated articles in the last window) |
| `sitemap-index.xml` lists `sitemap-es-0.xml`; all 20,123 `<url><loc>` in it start with `https://915tldr.com/es` | pass |
| `/es/news-sitemap.xml`: well-formed, every `<news:language>` is `es` | pass (22 entries at the first look) |

### Stylesheet check

See section 0.1 for the table. In the committed suite the check fails only for current-build pages
(archived `/es`, hot pages), which all pass; stale archived English pages are reported as a
`FINDING` line, not a failure, so the suite stays green while the backlog drains. This means the
suite does not fail on the live defect in 0.1; re-run it and read the `FINDING` lines.

## 6. What was and was not checked

Checked: real Chromium clicks for A, B, C and the keyboard path; HTTP contract for every `/es` page
type; archived Spanish serving; redirects under both header kinds; feeds; stylesheet status codes;
screenshots viewed.

Not checked: mobile viewports (all screenshots are 1280px; the 320px layout of the `/es` nav is not
seen); screen reader; Safari/Firefox; Lighthouse on `/es`; whether the Umami Languages report exists
(Task 3); the backlog draining; build contention; the 1,200s ceiling's scope.

## 7. Open items for Jaime

1. Task 3: Umami Languages report and your own keyboard check on `https://dev.915tldr.com/`.
2. Pre-cutover: stale archived English pages are unstyled (0.1). Re-check after the next one or two
   production builds.
3. Defect 0.2: the Spanish category nav is unstyled on every `/es` page (selector bound to the
   English `aria-label`). Fixed in source on `feature/phase-06-gaps` (section 8); needs the merge and deploy.
4. ROADMAP Phase 6 criterion 5's "launch decision on 2-4 weeks of data" wording is superseded by
   D-09/D-11 (PROJECT.md updated; ROADMAP not touched by this plan).

## 8. Defect 2 fix (06-16 gap closure, branch `feature/phase-06-gaps`)

Defect 0.2 (the unstyled Spanish category nav) is fixed in source. **It is not deployed**: it goes
live only after Jaime merges and the production build runs. Until then dev.915tldr.com still shows
the bulleted list on every `/es` page.

What changed:

- `src/layouts/Base.astro`: the header section nav now also carries `data-site-nav="sections"`. The
  translated `aria-label` (`Sections` / `Secciones`) is kept for assistive technology.
- `src/styles/global.css`: all 7 `nav[aria-label="Sections"]` selectors (base, `ul`, `a`,
  `a[aria-current]`, the 48em and 80em `ul` rules, and the 80em width group) are now
  `nav[data-site-nav="sections"]`. Specificity is unchanged (element plus one attribute).
- `tests/unit/chrome.test.mjs`, `tests/unit/listing-pages.test.mjs`: the built-page nav regex no
  longer requires `aria-label` to be the only attribute on `<nav>`.

Same class of bug elsewhere in `src/`: none. Every `[aria-label=`, `[title=`, `[alt=`,
`[placeholder=` selector in `src/**/*.css` and every `<style>` block in `src/**/*.astro` was
checked; the seven above were the only ones, and there are no `<style>` blocks in `src` at all.
Not touched, reported: `design/mockups/style.css` and `design/tests/*.spec.ts` still use
`nav[aria-label="Sections"]`. They run against the English-only Phase 1 mockup HTML, not the
shipped site, so they are not affected by this defect.

Regression guards:

| Guard | Where | Status |
|---|---|---|
| No CSS selector may depend on a dictionary string (EN or ES): scans `src/**/*.css` and `<style>` in `.astro`/`.vue` | `tests/unit/css-no-translated-selectors.test.mjs` | Written first: 4 of 5 tests failed (7 selectors named). After the fix: 5 of 5 pass |
| Nav markup carries the hook for both languages; `global.css` styles through it at every breakpoint | same file | pass (source-level, see limits below) |
| Real Chromium on the live origin: `/` and `/es`, 1280px one row of 8 and `list-style-type: none`, 390px exactly 2 columns | `tests/integration/browser-journeys.test.mjs` (`06-16 gap`) | **RED on dev now, by design.** Goes green after the deploy |

Red run recorded 2026-10-04, before the fix, against `https://dev.915tldr.com`:

- Default selector `nav[data-site-nav="sections"]`: both tests fail, `no element matches
  nav[data-site-nav="sections"]` (the hook is not deployed yet).
- Layout only, `SITE_NAV_SELECTOR='body > nav'` (the pre-fix deploy has no hook): English passes
  (1280px offsetTops all 220, `list-style: none`, 390px lefts 16/203). **Spanish fails** with
  `at 1280px all 8 links must share one visual row on /es; offsetTops=[219,247,275,303,330,358,386,414]
  labels=Crimen|Política|Deportes|Negocios|Educación|Comunidad|Salud|Clima`. This is the defect,
  reproduced by the test.

Fix check without a deploy (a simulation, not the real thing): live `/` and `/es` HTML with the hook
added and the stylesheet replaced by the fixed `src/styles/global.css`, in Chromium. Both pages: 1280px
one row of 8, `list-style-type: none`; 390px two distinct left positions. `/es` laid out identically to `/`.

Suites after the fix: `pnpm run test:fast` 1026 of 1026 pass (was 1021, plus the 5 new tests);
`pnpm run test:build-gate` 9 of 9 pass. No local `pnpm run build` was run (it writes to production KV).

Limits: the markup guard reads `Base.astro` source, not a rendered page, and the stale local `dist/`
was not rebuilt, so no rendered `/es` HTML has been checked against the new attribute. The first real
confirmation is the live test going green after the deploy:
`node --test --test-name-pattern="06-16 gap" tests/integration/browser-journeys.test.mjs`.

## Post-phase closeout

Branch `feature/phase-06-closeout`. Written without a local full build (it writes to production KV),
so every rendered-HTML claim below is unverified until the deploy.

### A. Spanish tag pages: noindex, out of the Spanish sitemap (owner decision 2026-10-07)

- `/es/tag/*` (20,105 URLs) now render `<meta name="robots" content="noindex">` and no hreflang
  alternates; the decision lives in `src/lib/i18n/tag-page.ts` (`tagPageSeo`) and is spread onto
  `<Base>` by both tag templates, the same `noindex`/`alternates` props the fallback `/es` article
  pages use.
- English `/tag/*` pages declare `self` alternates (en + x-default, no `es`): a noindex page is not
  advertised as a language alternate (held-article precedent).
- `astro.config.mjs` sitemap filter drops `/es/tag/<slug>` via `isSitemapExcludedPath`
  (`src/lib/i18n/sitemap.ts`). Kept: `/es/tags` and `/es/source/*` (not touched; see the report).
- Tests, written first: `tests/unit/tag-noindex.test.mjs` (pure decision, sitemap predicate, source
  wiring, then full-corpus rendered output and sitemap files), plus one `astro-config` assertion and
  the sitemap URL-count cross-check in `news-sitemap.test.mjs` now subtracting the `/es/tag/*` pages.
- The full-corpus tests that read `dist/` are gated by `tests/helpers/dist-fresh.mjs`: against the
  stale local `dist/` (built 2026-10-04) they report a visible skip, they do not pass vacuously.
  After any real `pnpm build` they run in full.
- Expected consequence, not a defect: these pages re-render on the next builds, so the archived
  `es/tags/*` (about 17.7k) and the English tag objects re-upload through the post-sync chain over
  about 2 builds. No CSS change, so no stale-stylesheet window.

### B. Fragile live tests in `url-shapes.test.mjs` (the 3 that failed on 2026-10-07)

- **T-04-48 stale-deploy guard** now compares content: `git diff` over the guarded paths between the
  deployed commit and local HEAD (`tests/helpers/deploy-guard.mjs`), not ancestry. A merge commit on
  develop/main and a feature-branch HEAD are not ancestors of each other even with identical code.
  Deployed commit not present locally: fails with the `git fetch` remedy. `/version.json` commit
  `"main"` (or any non-hex ref, cron rebuilds): the test reports a visible skip with that reason, it
  is not trusted. Unit tests with a throwaway temp repo reproduce the no-ancestry shape:
  `tests/unit/deploy-guard.test.mjs`.
- **Fallback `/es` article search** looks at the 5 newest RSS items, then 300 evenly spread canonical
  article paths from `/sitemap-en-0.xml` (deterministic stride, `tests/helpers/live-samples.mjs`), and
  requires `[data-fallback-note]` plus robots noindex. None found: the test FAILS and says how many
  candidates were searched. The dependent "a fallback /es article is 200..." test fails (not skips)
  if the search found nothing. First fallback found after 6 of 305 candidates.
- **Tag pair contract** (follow-up to A): the old live test required reciprocal hreflang on
  `/es/tag/*`, which is now deliberately gone. Replaced by `assertTagPairContract`: `/es/tag/*` is 200,
  lang es, noindex, no alternates; the English twin is indexable with en + x-default only. Archived
  objects not yet re-uploaded are logged as a FINDING (REND-12 backlog), static pages are strict.
- Live run against `https://dev.915tldr.com` (GET only), 2026-10-07 22:0x MDT: 88 of 90 pass. The 2
  failures are both correct pre-deploy: the guard reports a real guarded-path diff (task A's five
  files are not deployed yet) and the tag-pair test reports `/es/tag/2028-election must be robots
  noindex` (old markup still live). Both go green once the closeout branch is deployed.

### C. Umami opt-out pages `/opt-out` and `/es/opt-out`

- Tracker semantics, read from the served `https://stats.915websites.com/script.js` on 2026-10-07: it
  reads `window.localStorage` inside try/catch and, before every send, `getItem("umami.disabled")`;
  any truthy value (any non-empty string) means do not send. Per origin, so each host needs one visit.
- Pages: `src/pages/opt-out.astro`, `src/pages/es/opt-out.astro`, shared body
  `src/components/OptOut.astro`, logic `src/lib/opt-out.ts` (unit-tested with fake, throwing and
  write-ignoring storages), copy in the fixed dictionary (`optOut*` keys). noindex, no hreflang
  alternates, excluded from both sitemaps (`isSitemapExcludedPath`), absent from RSS/news feeds,
  linked from no nav or footer. No CSS change (reuses `data-contact-column`, `data-lede`,
  `data-form-note`, `data-feed-controls`, `data-load-more` hooks), so no stale-stylesheet window.
- Spanish copy is Claude-drafted, not human-reviewed.
- Live test (written first): `tests/integration/browser-journeys.test.mjs`, 4 tests named
  `closeout`. Recorded RED on 2026-10-07 22:0x MDT against `https://dev.915tldr.com` before the pages
  existed: all 4 fail with `/opt-out must answer 200` / `404 !== 200` (and the same for `/es/opt-out`).
  Not skipped. Run again after the deploy:
  `node --test --test-name-pattern="closeout" tests/integration/browser-journeys.test.mjs`.
  Creates at most 2 Umami page views per run (the first, opted-in load per language).
- Rehearsal without a deploy (a simulation, not the real thing): the two pages built in an isolated
  scratch Astro project (no D1, no KV), served to Chromium at 390px through request routing with the
  REAL tracker script and a stubbed `/api/send`: status flips, flag set, reload keeps it, no POST after
  opting out, one POST while counted, keyboard Enter restores, button 44px tall inside the viewport,
  throwing `localStorage` gives the clear message with no toggle and no page error. English and
  Spanish both pass.

### D. Privacy pages no longer name the Umami host (owner decision 2026-10-08)

- `src/pages/privacy.astro` and `src/pages/es/privacy.astro`: the linked `stats.915websites.com`
  (anchor, rel/target, new-tab icon) is now plain text, "self-hosted by 915website.com" /
  "alojada por 915website.com". The `docs.umami.is` citation is unchanged. The tracker `<script src>`
  in `Base.astro` is unchanged on purpose (the host still appears in page source there; that is the
  owner-accepted tracker tag, not visible text).
- The brief also said to keep a sentence "Prefer not to be counted? ... /opt-out". Neither privacy
  page contained it (the opt-out pages were built unlinked, owner-only, in section C), so nothing
  was kept or added. If a public link to `/opt-out` is wanted, that is a separate decision.
- Test: `tests/unit/privacy-no-analytics-host.test.mjs` (written first, recorded 5 red, then green).
  Source-based; one built-output check is a deliberate dist-fresh skip until a real build.
- Unverified until deploy: the rendered HTML of `/privacy` and `/es/privacy` (no local build was
  run). After deploy: `curl -s https://915tldr.com/privacy | grep -c stats.915websites.com` should
  print 1 (the tracker tag in `<head>`) and the host must not appear in the page body. No CSS change.

### E. Spanish source pages: noindex, out of the Spanish sitemap (owner decision 2026-10-07/08)

- `/es/source/<slug>` now renders robots `noindex` with NO alternates; `/source/<slug>` emits en +
  x-default only (no `es`); `isSitemapExcludedPath` also drops `/es/source/<slug>` (segment-exact;
  `/es/tags` stays). Decision body: `sourcePageSeo` in `src/lib/i18n/tag-page.ts`, sharing one private
  function with `tagPageSeo` (tag behaviour unchanged, pinned by a test).
- Expected consequence, corrected against the build: source pages are NOT archived. There are exactly
  3 per language (`kvia`, `ktsm`, `el-paso-matters`), all static files in `dist/client`;
  `archive-plan.json` has only `article` and `tag` entries. So the "archived objects re-upload over
  about 2 builds" window that applies to tags does NOT apply here: after one deploy all 6 pages are
  correct at once, and the live check is strict. No archived English article/tag object embeds a
  source-page alternate, so nothing archived needs re-rendering for this change. No CSS change, so no
  stylesheet window either. The sitemap drops 3 URLs (and the 3 English twins lose their `es`
  xhtml:link).
- Tests (written first, seen red): `tests/unit/source-noindex.test.mjs` (new; pure decision, sitemap
  predicate, wiring, dist-gated rendered/sitemap checks), `tests/unit/es-listing-pages.test.mjs`
  (the old reciprocal-hreflang assertion for `/es/source` replaced; dist-gated), the sitemap count
  cross-check in `tests/unit/news-sitemap.test.mjs` (now also subtracts the built `/es/source` pages),
  `tests/unit/tag-noindex.test.mjs` (`/es/source/ktsm` is now excluded), and a live test in
  `tests/integration/url-shapes.test.mjs` (`url-shapes polish: ...`); `/es/source/kvia` was removed
  from the old 06-16 reciprocal list.
- Live run once, pre-deploy, against `https://dev.915tldr.com` (GET only), 2026-10-08 01:4x MDT:
  91 tests, 89 pass, 1 fail, 1 skip. The fail is the new source test, `/es/source/kvia must be robots
  noindex` (old markup is still live), correct pre-deploy; it should go green after deploy (it also
  checks ktsm and el-paso-matters, the English twins, and that no sitemap child mentions
  `/es/source/`). The skip is the deploy guard: `/version.json` reports `main` (cron-built), so the
  stale-deploy comparison is not satisfied for that run. Nothing else was red.
- Unverified until a real build + deploy: the rendered HTML (no local build was run), the real
  sitemap files, and the sitemap count cross-check (dist-gated, visible skips locally).

### 2026-10-08 - Opt-out sentence on both Privacy pages

- Owner decision (2026-10-08, "yes, add the opt-out sentence to v2"): the Umami paragraph of
  `/privacy` and `/es/privacy` now ends with a visitor-facing opt-out sentence, mirroring v1
  (`app/pages/privacy.vue`). EN: "Prefer not to be counted? You can turn analytics off for this
  browser." linking `/opt-out`; ES: "¿Prefiere que no se cuenten sus visitas? Puede desactivar el
  análisis en este navegador." linking `/es/opt-out`. Plain same-origin links (no new tab); hrefs are
  literal, like the page's existing `/contact` link. The Spanish copy is Claude-drafted and NOT
  human-reviewed; the owner waived review of the opt-out copy.
- Tests (written first, seen red): `tests/unit/privacy-no-analytics-host.test.mjs` (sentence and exact
  hrefs in both languages, placed after the existing text, plain link, target route exists and stays
  noindex, dashboard host still absent, no cross-language opt-out link). The dist-gated check in
  `tests/unit/opt-out.test.mjs` ("no static page links to them") is narrowed on purpose to "only the
  two Privacy pages link to them", and now also requires both Privacy pages to carry the link.
  The `/es` link-containment invariant (`es-lang-and-links`) is satisfied by `/es/opt-out`; it only
  checks that /es pages stay under /es and English pages are lang="en".
- The opt-out pages stay noindex and out of every sitemap; Base.astro and the tracker are untouched.
- Unverified until a real build + deploy: the rendered HTML of both Privacy pages, the dist-gated
  link-containment and opt-out checks (visible skips locally).

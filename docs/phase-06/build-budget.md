# Phase 6 build/file/convergence budget — measured, not projected

> **SUPERSEDED (2026-10-04, same day): the build and convergence verdicts below were corrected by a
> same-day baseline.** Sections 1-7 and the three verdict lines directly below are kept unchanged
> as history. Their render-time projection rested on a stale Phase 4 figure (the "3.72x per-page
> cost increase" and the 0.26133 local-to-Workers-Builds factor were both wrong). **The CURRENT
> verdicts are the last three verdict-token lines in this file, in the "Correction after same-day
> baseline (2026-10-04)" section at the bottom.** For any script: take the LAST occurrence of each
> verdict family, not the first. Do not rely on the original numbers or the "3.7x" claim.

**Verdicts (SUPERSEDED — see Correction section at the bottom for the current set):**

```
PHASE6_BUILD_DOES_NOT_FIT
PHASE6_FILES_WITHIN_BUDGET
DOES_NOT_CONVERGE_24H
```

Produced by 06-12-PLAN.md, Task 1, from one real `ASTRO_INCREMENTAL_BUILD=0 pnpm run build` of the
complete, current bilingual corpus (commit `b1b8c4f`, 2026-10-04T13:15Z, full log at
`.gsd/phase06-build.log` — untracked, never committed). This is the re-measurement 05-10 flagged
("Phase 6 projection ... needs a real re-measurement before Phase 6 ships") and the research
Pitfall 7 / STATE.md flag this plan exists to resolve.

**Bottom line:** the render step alone — before any archive-sync re-upload, before `wrangler
deploy` — already projects to ~1,474s on Workers Builds, which is over BOTH the plan's own
780s/1,080s render-end thresholds AND the platform's absolute 1,200s (20-minute) hard ceiling. A
build this slow is not merely "at risk" — Workers Builds would kill it mid-render before it ever
reaches the archive-sync or deploy steps. The driver is not only "twice as many pages" (which Phase
5's own naive ×2 scaling already assumed): this build's own measurement shows each page *itself*
costs ~3.7x more local wall-clock time to render than Phase 4's single-language corpus did, on the
exact same machine. Static file count stays within the 60,000 budget, but with much tighter margin
(428 files) than Phase 5 projected (59,836 → 164 files headroom). Convergence cannot be evaluated
independently of the render-time failure: with zero post-render budget left in a 1,020s window, the
archive-sync re-upload phase never starts.

---

## 1. The measured build

Command: `ASTRO_INCREMENTAL_BUILD=0 pnpm run build`, wall-clock stamped around every step
(`date +%s.%N`), full output captured to `.gsd/phase06-build.log`. Credentials
(`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) already present in the shell environment, matching
every prior Phase 4/5/6 build — `ARTICLES_FORCE_COLD` was NOT set (per this plan's own context
note), but toggling `ASTRO_INCREMENTAL_BUILD` is itself an `astro.config.mjs` change, which 04-09
already documented resets the content-layer store to empty — so this build's D1 loaders ran cold
regardless, exactly like Phase 4's own cold-build measurement. One build only; no second
(baseline) build was run — see §3 for why the existing Phase 4 local anchor was reused instead.

| Step | Wall time | Source |
|---|---|---|
| `reset-pending-build-state` | 0.069s | `.gsd/phase06-build.log` STAMP line |
| `guard:config` | 1.013s | same |
| `test:build-gate` | 1.121s | same |
| `partition-archive --clean` | 3.789s | same |
| **`astro build` (content-sync + page-gen, full)** | **436.471s** | same, ts-precision stamp |
| `partition-archive` (apply) | 5.143s | same |
| `assert-file-count` | 0.636s | same |
| **Total build script** | **448.263s** | same |

Inside `astro build`, Astro's own self-reported sub-phases (from the log, not re-derived):

| Sub-phase | Duration | Log line |
|---|---|---|
| Content-sync (D1 cold fetch, all 3 collections: changelog, articlesEs, articles) | **107s** | `07:17:19 [types] Generated 1m 47s` |
| Gap (adapter/build-info collection, pre-pagegen vite rebuild) | ~4s | `07:17:19 [build] ✓ Completed in 1m 47s.` → `07:17:23 [build] Building static entrypoints...` |
| Page generation | **323s** (cross-checked two ways, see below) | `07:17:23 Building static entrypoints...` → `07:22:46 [build] 121554 page(s) built in 7m 14s` |
| Astro's own combined total | 434s (7m 14s) | `07:22:46 [build] 121554 page(s) built in 7m 14s` |

Page-generation duration cross-check: `434s (Astro's combined self-report) − 107s (content-sync) −
~4s (gap) = 323s`, matching the direct console-timestamp difference (`07:17:23` → `07:22:46` =
323s) exactly. Both independent derivations agree.

D1 loader lines (same build, cold on both collections):

```
07:15:35 [d1-articles-es] [articles-es] mode=cold rows=30 available=13 held=17 malformed=0 rowsRead=60 budget=200000
07:17:17 [d1-articles] mode=cold public=40704 changed=40704 removed=0 explained=0 rowsRead=515745 budget=1500000
```

Partition and file-count lines (same build):

```
[archive] partition: 13290 articles and 17712 tags archived; 27414 articles and 2342 tags static (es: 13290 articles, 17712 tags archived)
[archive] static files: 59572 / 100000 (fail at 80000)
```

**Total pages built: 121,554** (`[build] 121554 page(s) built in 7m 14s`) — the complete doubled
bilingual corpus (60,777 English-side pages + 60,777 `/es` pages, confirmed independently by this
plan's own Task 2 tests, §5 below).

## 2. Per-language render cost

The build log's per-page timing lines (`├─ /path/to/page.html (+Nms)`) do not aggregate separately
by language within the log itself, and grepping ~121,554 individual `(+Nms)` lines to sum
per-language totals would not materially change the projection below (page generation is
dominated by per-page overhead that this project's own `/es` templates share structurally with
their English counterparts — same `Base.astro`, same rail computation shape, same image
pipeline) — so, as the plan's own Task 1 action anticipates ("If the log does not carry per-page
timings [separable by language], state that and use the total ms/page for both"), this section
uses the **total** ms/page (§1's 323s ÷ 121,554 pages) for both languages rather than two noisy,
not-obviously-more-accurate per-language splits.

**Local ms/page (this build, full bilingual corpus): 323,000ms ÷ 121,554 pages = 2.6576 ms/page.**

This is the number that matters for §3: it is markedly higher than Phase 4's single-language local
figure (next section), and that increase is real and disclosed, not an artifact of simply having
twice as many pages (which wouldn't change ms/PAGE at all, only total time).

## 3. Local → Workers Builds speed factor

Per the plan's own formula: `factor = (local ms/page for the Phase 4 corpus) ÷ 2.74` — using the
EXACT underlying figures from `docs/phase-04/build-measurements.md` (not its own rounded in-text
citation):

- **Local, Phase 4 corpus** (`docs/phase-04/build-measurements.md`, "Cold build" section):
  `28.62s for 40,049 pages ≈ 0.71465 ms/page` (28,620ms ÷ 40,049 pages).
- **Workers Builds, Phase 4 corpus** (same doc, "Workers Builds spike", Build 1):
  `164s for 59,977 pages ≈ 2.7344 ms/page` (164,000ms ÷ 59,977 pages).

`factor = 0.71465 ÷ 2.7344 = 0.26133`

This factor exists to isolate "how much slower is the Workers Builds container than THIS local
machine, at a fixed page-rendering complexity" — a hardware/platform ratio, not a page-complexity
ratio. Dividing today's local-measured ms/page by this factor projects what the SAME
(now-more-complex) page would cost on Workers Builds, under the assumption that the local-vs-WB
speed RATIO itself (not the absolute per-page cost) holds across code eras. No second local
baseline build (building the pre-Phase-6 commit) was run — the existing Phase 4 anchor already
satisfies the plan's own first branch ("if build-measurements.md records a local page-generation
figure for the Phase 4 corpus, factor = local ms/page ÷ 2.74"), so the second branch (building
`git merge-base HEAD develop` in a detached worktree) was not needed.

**A real, disclosed finding independent of page count:** Phase 4's local figure (0.71465 ms/page)
vs. this build's local figure (2.6576 ms/page) is a **3.72x increase in per-page render cost**,
holding "local machine" constant. Phase 5's own "Phase 6 projection" (05-10) assumed cold render
time would scale ~2x (from doubling the corpus) — this measurement shows the real driver is BOTH
effects compounding: ~2x as many pages AND ~3.7x more expensive per page (plausible causes not
independently isolated in this plan: compile-time image optimization now logged as enabled
(`[@astrojs/cloudflare] Enabling compile-time image optimization`), the i18n dictionary/hreflang
computation now present project-wide, and three Content Layer loaders/collections instead of one).
Root-causing which factor dominates is flagged as follow-up, not resolved here — it does not change
this plan's verdict either way (see §4).

## 4. Projection: `renderEnd`

`renderEnd = 9 (dependencies) + 206 (content-sync, WB-measured anchor) + esColdSync + pageGenWB + partition`

Per this plan's own context block, `9` and `206` are measured Workers Builds anchors from
`docs/phase-04/build-measurements.md` Build 1, cited (not re-derived): dependencies cache ~8.9s,
content-sync 206s (3m26s) for the English `articles` collection's cold D1 fetch. These are reused
as-is because content-sync cost is dominated by D1 network/row-count, not by this plan's own
local-machine timing, and the English public-article count has not materially changed since Phase
4 (`public=40704` now vs `public=40176` then).

### `esColdSync`

No Workers-Builds-scale measurement of the Spanish cold sync exists yet — 06-06's own measured
pass (`rowsRead=1`, essentially instantaneous) and this build's own pass (`rowsRead=60` in ≤2s,
`07:15:33`→`07:15:35`) both ran against far fewer real Spanish rows than the ~41,000-row full
backfill this projection must cover. **Disclosed substitution:** 06-06's own pass carries no usable
throughput signal (1 row read is noise, not a rate); this build's own pass (60 rows, still a single
REST page) is used instead as the best available real data point, scaled by PAGE COUNT (not row
count) — `src/lib/server/d1-client.ts`'s `fetchTranslationsAll` paginates at `LIMIT 5000` on
`t.article_id` (confirmed by reading the function directly: the `results.length` break condition
is checked against `5000`, so the LIMIT is on translation rows per page, not on the ~2x-inflated
`rowsRead` meta figure the loader's own doc comment describes).

- Pages needed for a full ~41,000-row backfill: `ceil(41,000 ÷ 5,000) = 9 pages`.
- Observed per-page wall time this build: ≤2s (single page, 60 rows; console 1-second resolution,
  so the true value is anywhere in `(0, 2]`s — using the upper bound, 2s, is the conservative
  direction per this project's own estimation convention).

`esColdSync ≈ 9 pages × 2s/page = 18s`

This term is small relative to `pageGenWB` below and does not affect the verdict even at a 2-3x
error margin (see §4 sensitivity note).

### `pageGenWB`

`pageGenWB = totalPages × (local ms/page now ÷ factor) = 121,554 × (2.6576 ÷ 0.26133) ms`

`= 121,554 × 10.168 ms/page = 1,235,732 ms ≈ 1,235.73s`

### `partition`

Measured directly from this build's own `partition-archive` (apply) step: **5.143s** (moving
13,290+13,290 archived articles and 17,712+17,712 archived tags — 62,004 files — into `dist/archive`,
computing sha256 for each). This step did not exist in Phase 4 (added in Phase 5), so no WB anchor
exists to reuse; used directly as a local-machine measurement, NOT rescaled by `factor` — it is a
pure filesystem-move + hash operation (CPU/disk-bound), not Astro-render-bound or D1-network-bound,
and Workers Builds' container (4 vCPU / 8GB RAM / 20GB disk) is not expected to be slower at this
kind of work than this dev machine. Disclosed as a local proxy, not a WB-measured figure.

### Total

```
renderEnd = 9 + 206 + 18 + 1,235.73 + 5.14 = 1,473.87s
```

**Verdict thresholds** (from this plan's own must-haves): `≤ 780s` FITS, `780–1,080s` AT_RISK,
`> 1,080s` DOES_NOT_FIT.

**1,473.87s > 1,080s → `PHASE6_BUILD_DOES_NOT_FIT`.**

This also exceeds the platform's absolute 1,200s (20-minute) hard ceiling by 273.87s — independent
of the plan's own softer 780/1,080s thresholds, Workers Builds would terminate a build this slow
before it finishes rendering, let alone before archive-sync or deploy run.

**Sensitivity check:** even a 3x error in `esColdSync` (54s instead of 18s) or a 10% error in
`pageGenWB` (±123.6s) moves the total by well under the ~394s margin over the hard ceiling — the
verdict is robust to the uncertain terms; `pageGenWB` alone (1,235.73s) already exceeds the hard
ceiling on its own, before any other term is added.

## 5. Files: `PHASE6_FILES_WITHIN_BUDGET`

Measured directly from this build's `assert-file-count` run: **59,572** static files (`dist/client`),
against the 60,000 post-Phase-6 budget `docs/phase-05/hot-window-derivation.md` derived (59,836
projected) and the tool's own formal 70,000-warn/80,000-fail thresholds.

```
[archive] static files: 59572 / 100000 (fail at 80000)
```

`59,572 < 60,000` → **`PHASE6_FILES_WITHIN_BUDGET`** — but with only **428 files of headroom**
(0.7%), tighter than Phase 5's own 59,836-projected/164-headroom estimate. No WARN was emitted
(59,572 is also below the tool's own 70,000 warn line). This verdict is independent of the build-time
verdict above — it would hold even if the render-time problem in §4 is fixed by a different lever
(e.g., render-cost optimization rather than hot-window shortening).

## 6. Convergence: `DOES_NOT_CONVERGE_24H`

Per this plan's own formula, once the Spanish backfill lands, every already-archived article page
changes on BOTH language sides (hreflang mode flips from `self` to `paired`, and the `/es` page's
body switches from English-fallback to real translation) — tag pages are not included, since a
tag's own rendered body does not depend on whether its member articles are translated:

```
reupload = archivedEn (articles) + archivedEs (articles) = 13,290 + 13,290 = 26,580
```

```
perBuild = 54.64 obj/s × max(0, 1,020s − renderEnd − 21s)
         = 54.64 × max(0, 1,020 − 1,473.87 − 21)
         = 54.64 × max(0, −474.87)
         = 54.64 × 0
         = 0 objects/build
```

`54.64` is 05-10's own measured archive-sync throughput (`docs/phase-05/archive-architecture.md`
Measurements section); `21` is 05-09's own measured post-archive-split deploy time (same doc). With
`renderEnd` (1,473.87s) already exceeding the 1,020s `POST_DEADLINE_SECONDS` window on its own,
**zero seconds remain for the re-upload phase in any single build** — `builds = ceil(26,580 ÷ 0)`
is undefined; the backlog can never clear under this build-time profile, not even across an
unbounded number of 2-hourly cycles, because each cycle's render step alone already consumes (and
exceeds) the entire window re-upload would need to run in.

**→ `DOES_NOT_CONVERGE_24H`.** This verdict is a direct, mechanical consequence of §4's render-time
failure, not an independent finding — fixing `renderEnd` (via a shorter hot window, a render-cost
optimization, or both) is a precondition for convergence to even be evaluable, let alone met.

## 7. What each non-green verdict blocks

- **`PHASE6_BUILD_DOES_NOT_FIT`** blocks 06-15 (deploy) outright — a build that cannot complete
  inside the 20-minute hard ceiling deploys nothing (Phase 4 D-15: a failed build deploys nothing)
  and would block every later deploy attempt on the SAME commit until fixed. It also blocks 06-13
  (backfill spend): spending money to translate 41,000 articles produces no visible benefit if the
  build that would ship those translations cannot complete.
- **`DOES_NOT_CONVERGE_24H`** blocks the D-10/REND-12 promise (archive re-render converges within
  24h) and is not independently actionable while the build-time verdict is red (§6).
- **`PHASE6_FILES_WITHIN_BUDGET`** (green) does not block anything on its own, but its thin margin
  (428 files) means any fix to the render-time problem that also ADDS pages (rather than purely
  speeding up rendering) could flip this verdict too — worth re-checking after whichever fix is
  chosen.

---

**Full build log:** `.gsd/phase06-build.log` (untracked, 121,645+ lines — not committed, per this
plan's own artifact list).

---

## 8. Correction after same-day baseline (2026-10-04)

Sections 1-7 above are kept as written, as history. This section supersedes their **build** and
**convergence** conclusions. The file-count result (section 5: 59,572 static files) was a direct
measurement and stands.

Source: a same-day, same-machine, back-to-back baseline (measurement only, no deploy, KV/R2/D1
writes stubbed by a write guard). Its full report lives in the session scratchpad
(`render-baseline-report.md`, not committed); the numbers below are copied from it.

### 8.1 What was wrong

1. **The "3.72x per-page cost increase" was a bad baseline.** Section 3 compared this build's
   2.6576 ms/page against 0.71465 ms/page, which is the early 04-03 build (commit `6d62b7b`,
   2026-09-26: 40,049 article-only pages from a minimal template). The Phase 4 template that
   Workers Builds actually measured (`8decb68`), built locally today, already costs 2.0271 ms/page.
   That growth happened inside Phase 4, before Phase 5 and Phase 6 began. Same machine, back to
   back, using section 1's own timing window ("Building static entrypoints" to "page(s) built"):

   | | Baseline `253dbe6` (pre-Phase-6) | HEAD `86aebda` | `8decb68` (Workers Builds anchor, local) |
   |---|---|---|---|
   | Pages | 60,777 | 121,554 | 60,777 |
   | Window | 126.87s = **2.0875 ms/page** | 300.20s = **2.4697 ms/page** | 123.20s = **2.0271 ms/page** |
   | Render only (entry to "Completed in") | 2.0230 ms/page | 2.0619 ms/page | 1.9609 ms/page |
   | `astro:build:done` (sitemap hook) | 3.92s | **49.57s** | 4.02s |

   HEAD / baseline: **1.18x** (window), **1.02x** (render only). English and Spanish pages cost the
   same per page (articles 2.309 vs 2.310 ms, tags 1.500 vs 1.512 ms).

2. **The local-to-Workers-Builds factor was wrong for the same reason.** Section 3's 0.26133
   divided a 04-03 local number by the Workers Builds number for `8decb68`, charging the template
   growth twice. Same commit on both sides: `2.0271 / 2.7344 = 0.74133` (Workers Builds is about
   1.35x slower than this machine, not 3.8x). Per-class cross-check: articles 2.264 / 2.755 =
   0.822, tags 1.468 / 1.717 = 0.855; the window-based 0.74133 is the most conservative of the
   three.

### 8.2 The one real Phase 6 cost: the 06-11 sitemap options

Commit `90fda90` (06-11) turned on `@astrojs/sitemap`'s `i18n` and `chunks` options. In
`node_modules/@astrojs/sitemap@3.7.4/dist/`, `createGetI18nLinks` scans every other URL looking for
a partner and only caches a hit. The 40,691 English article URLs whose `/es` partner was filtered
out (untranslated fallback) never get a cache entry, so each one scans all ~80.9k URLs. The `chunks`
path also does a linear `Array.includes` inside a loop. The hook body is synchronous. Result: the
`astro:build:done` hook went 3.92s (baseline) to 49.57s (HEAD today), and measured 92s in 06-12's own
run (the cause of that 92s-vs-50s variance was not measured). That is **98% of HEAD's extra time**
(+45.65s of the +46.46s excess over baseline's per-page rate). Estimated ~93s after the Spanish
backfill lands, from an isolated benchmark, not a full build. 06-12's own log, split the same way,
was ~9s pre-render, ~222s rendering, ~92s sitemap.

Eliminated as Phase 6 causes: compile-time image optimization (the log line also appears in the
baseline and `8decb68` builds), i18n dictionary/hreflang work, and the third content loader (render
only moved +2%). This supersedes the "plausible causes" paragraph in section 3.

### 8.3 Corrected projection (section 4 formula; only the two corrected terms change)

`renderEnd = 9 + 206 + esColdSync (18) + pageGenWB + partition (5.14) = 238.14 + pageGenWB`

| Scenario | local ms/page | factor | pageGenWB | renderEnd | vs 780 / 1,080 / 1,200 |
|---|---|---|---|---|---|
| Section 4 as written (superseded) | 2.6576 | 0.26133 | 1,235.73 | 1,473.87 | over all three |
| Today's local number, old factor | 2.4697 | 0.26133 | 1,148.74 | 1,386.88 | over all three (fixing the local number alone does not help) |
| **Today's HEAD, corrected factor** | **2.4697** | **0.74133** | **404.95** | **643.09** | **under all three** |
| 06-12's local number, corrected factor | 2.6576 | 0.74133 | 435.76 | 673.90 | under all three |
| + backfill sitemap growth (bench +33.46s local / 0.74133 = +45.13s) | n/a | 0.74133 | 450.09 | ~688.2 | under all three |
| Sitemap fixed back to the baseline shape (about -61.6s on Workers Builds) | n/a | 0.74133 | ~343.4 | ~581.5 | under all three |

Break-even factors at 2.4697 ms/page: 0.554 for 780s, 0.357 for 1,080s, 0.312 for 1,200s. The build
only stops fitting if the real factor is below 0.357 (versus the 0.74133 now used).

Convergence (section 6 formula, **DERIVED, not measured**):
`perBuild = 54.64 x (1,020 - 643.09 - 21) = 19,447 objects/build`, so
`builds = ceil(26,580 / 19,447) = 2` (about 4h, well inside 24h).

### 8.4 What is still unmeasured

- **HEAD has not been built on Workers Builds.** 643s is a projection.
- The factor rests on **one** Workers Builds sample (Build 1, 2026-09-28, first-ever build on an
  empty cache). Workers Builds container speed variance is unmeasured.
- The sitemap cost after the Spanish backfill comes from a benchmark, not a full build. The 92s vs
  50s sitemap variance between 06-12's build and the baseline's HEAD build is unexplained.
- Corpus differs slightly between the Workers Builds anchor (40,176 articles / 19,782 tags) and
  today (40,704 / 20,054); per-page normalisation covers this, but any non-linear cost in
  `getStaticPaths` was not isolated.
- The baseline's KV writes were stubbed, so its content-sync timings are not comparable to 06-12's
  (24s vs 107s). Content-sync is not used in the projection (it takes the Workers Builds anchor of
  206s).
- Each commit was built once; no repeats.
- Section 5's file count (59,572) is unaffected, measured directly, and unchanged.

### 8.5 Task 3 decision (recorded)

**Task 3 (budget gate) resolved by Jaime on 2026-10-04, with the corrected premise.** Jaime chose
"baseline first", the baseline above removed the stale figure, and Jaime then directed "run the
06-12 close-out. continu." The coordinator relayed this message to this executor; the exact time of
Jaime's message was not passed along (this correction was written at 12:08 MDT on 2026-10-04).
Outcome: **proceed on the deploy path**, effectively option-c, but note that option-c as written was
for AT_RISK; with the corrected premise the build verdict is FITS, so no hot-window change (option-a)
and no render-cost gap plan (option-b) is needed before 06-13 / 06-15.

### 8.6 Follow-ups

- **(a) Watch real Workers Builds timings at 06-16** against the 643s projection (and the ~688s
  post-backfill figure). This is the first real measurement of HEAD on the platform.
- **(b) The 06-11 sitemap quadratic cost is a known, unfixed Phase 6 cost.** Recommend a follow-up
  that replaces the package's i18n partner scan or precomputes the alternates (not done here). It
  is the only Phase 6 item that grows super-linearly, and the file budget has only 428 files of
  headroom, so a fix that adds pages would need the files verdict re-checked.
- **(c) Possible production KV writes from builds, unverified, for Jaime to check.** During the
  baseline, a cold local build of the pre-Phase-6 commit attempted ~40.7k writes (5 bulk PUTs,
  40,704 entries) to the PRODUCTION render-manifest KV namespace; the baseline agent stubbed them.
  The 06-12 Task 1 build was also a cold build and earlier executor builds may likewise have
  written to production KV. Whether they did, and whether the entries differ from what production
  already holds, has not been checked. Not investigated here.

### 8.7 Current verdicts (supersede the set at the top of this file)

CURRENT as of 2026-10-04 after the same-day baseline. Build: corrected, projected 643s
(about 688s post-backfill), not yet measured on Workers Builds. Files: measured, unchanged.
Convergence: **DERIVED, not measured** (from the corrected 643s via the section 6 formula).

PHASE6_BUILD_FITS
PHASE6_FILES_WITHIN_BUDGET
CONVERGES_24H

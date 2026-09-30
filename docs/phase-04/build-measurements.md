# Phase 4 Plan 03 — Build Measurements

Measured, not projected, figures for the full loader (`src/content/loaders/articles-loader.ts`)
and the first full-corpus build. Every section below states what was run and when.

## Dry run

Generated 2026-09-26T23:43:49.955Z by `tools/sync-dry-run.mjs` (read-only — 4 SELECT COUNT(*) statements).

- Public article count (`status = 'processed' AND is_duplicate = 0`): **40183**
- Total articles: **43063**
- `article_tags` rows: **191514**
- Primary `article_categories` rows (`is_primary = 1`): **40274**
- Dry run's own rows read (sum of all 4 `meta.rows_read`): **315035**

- Projected cold request count at 5,000 rows/page: ceil(43063/5000) [articles] + ceil(191514/5000) [tags] + ceil(40274/5000) [categories] + 1 [sources] = **58 requests**
- Projected cold rows read: totalArticles (43063) × (Phase 3's measured 957,008 rows / 39,867 stitched articles ≈ 24.005 rows/article, docs/phase-03/d1-pagination-report.md) = **1,033,728 rows**
- Projected KV writes (= public article count, first v2 manifest rollout): **40,183**

### Projected cost (current Cloudflare list prices, fetched live 2026-09-26)

- D1 rows read: 25,000,000,000/month included (Workers Paid) then $0.001/million — 1,033,728 rows is entirely inside the included allotment ⇒ **$0.000000**. Source: https://developers.cloudflare.com/d1/platform/pricing/
- KV writes: 1,000,000/month included (Workers Paid) then $5/million — 40,183 writes is entirely inside the included allotment ⇒ **$0.000000**. Source: https://developers.cloudflare.com/kv/platform/pricing/
- **Projected total cost: $0.000000** — well under the $1 CLAUDE.md approval threshold.

**Budget gate cleared before any cold-capable code was written.** Recorded before Task 1 wrote a
single line of `build-state.ts` or the cold-fetch shapes in `d1-client.ts`, per CLAUDE.md's "no
bulk corpus operation runs without a dry run reporting row count and projected cost" — the
sequencing itself (dry run first, code second) is the point, not just the number.

## Task 3: re-run dry run (same-day cross-check baseline)

Generated 2026-09-27T00:11:34.750Z by `tools/sync-dry-run.mjs`, immediately before the cold build
below (step 1 of Task 3's action list) — the production corpus grows continuously (the ingest
cron runs every 2 hours), so this is re-run same-day rather than reusing Task 1's now-stale
numbers for the cross-check in the next section.

- Public article count (`status = 'processed' AND is_duplicate = 0`): **40193**
- Total articles: **43071**
- `article_tags` rows: **191563**
- Primary `article_categories` rows (`is_primary = 1`): **40284**
- Projected cold rows read: **1,033,920** (formula unchanged from Task 1)
- Projected total cost: **$0.000000**

## Cold build (`BUILD_STATE_BOOTSTRAP=1 ARTICLES_FORCE_COLD=1 pnpm run build`)

Run 2026-09-26 against real production D1/KV (`/usr/bin/time -v` is not installed on this
machine — verified via `pacman -Q time` / `which time`; peak RSS below was instead measured by
polling `/proc/<astro-pid>/status`'s `VmHWM` field, the kernel's own monotonic high-water-mark, at
1-second intervals for the whole run and taking the final/maximum sample, which is equivalent to
what `/usr/bin/time -v`'s "Maximum resident set size" reports).

**Loader log line:**
```
[d1-articles] mode=cold public=40049 changed=0 removed=0 explained=0 rowsRead=506806 budget=1500000
```

| Metric | Value |
|---|---|
| Wall time (outer measurement, includes `guard:config` + `astro build`) | 65.35s |
| Astro's own reported total | 40,049 page(s) built in 1m 3s |
| Content-sync phase (D1 cold fetch + manifest bulk write, from the "Syncing content" log to the loader's own line) | ~27s |
| Astro's page-generation phase ("Building static entrypoints...") | 28.62s for 40,049 pages ≈ 0.71ms/page |
| **Maximum resident set size** (peak RSS, `/proc/<pid>/status` `VmHWM`, polled every 1s) | **2,604,176 kB (≈ 2.54 GB)** |
| D1 rows read (loader-reported) | 506,806 — 0.34x `COLD_ROWS_READ_BUDGET` (1,500,000) |
| Total files under `dist/client` | 40,058 |
| Content-layer data store location | `node_modules/.astro/data-store.json` |
| Content-layer data store size | 63 MB (65,566,953 bytes) |

**Data-store location answers D-06 directly: YES, inside the Workers Builds auto-cached
directory.** D-06 asked research to confirm Astro's content-layer store lives inside the directory
Workers Builds build caching auto-detects and caches for Astro projects
(`developers.cloudflare.com/workers/ci-cd/builds/build-caching/` says it caches `node_modules/.astro`
plus the pnpm store) — confirmed directly by locating the real file on disk after a real build:
`node_modules/.astro/data-store.json`, not `.astro/` (that directory holds only build-scratch
files: `content.d.ts`, `content-modules.mjs`, `collections/`, and this plan's own
`build-state.pending.json`).

**Cross-check (Task 3 step 3): the loader's cold `public=` count is within 1% of the dry run's
independent public count.** Loader: **40,049**. Dry run: **40,193**. Difference: **144 (0.358%)**
— well under the 1% gate, and the difference is fully explained: the dry run's filter is only
`status = 'processed' AND is_duplicate = 0` (no category or summary check), while the loader's
public set additionally excludes articles with no resolved primary category and articles with a
NULL/empty `summary` (140 of those — see the Task 2 changelog entry's Rule 1/2 bug fix; ~4 more
account for `no-primary-category`). 40,193 − 144 ≈ 40,049. No investigation needed; proceeding to
step 5.

**Interesting non-finding worth recording:** unlike Phase 3's per-request measurement (where the
D1 read/KV write dominated wall time), this build's wall time is now dominated by Astro's own
static-entrypoint rendering/writing (28.62s for 40,049 pages) and Vite/content-sync overhead, not
the D1 read itself — the cold fetch's 506,806-row read completes in roughly the same ~27s window
that also includes the manifest bulk-write and Astro's own collection sync bookkeeping. The
loader's own D1 cost is comfortably inside budget regardless of which phase dominates wall time.

**A genuine measurement bug found and fixed during this task, not shipped:** the loader
originally also set `meta.lastSweep` on every cold build ("a cold pass subsumes what a sweep would
catch"), which is a real design choice but directly contradicts Task 3's own expected verification
sequence (cold → warm+sweep → warm) — the build immediately after cold would have shown `mode=warm`
instead of `mode=warm+sweep`, silently skipping the sweep-mode code path on every real deployment's
first post-cold build. Removed before this measurement was taken; see the 04-03 Task 2 changelog
entry / `src/content/loaders/articles-loader.ts`'s meta-update comment for the corrected behavior.
An earlier (now-superseded) run of this exact cold build had already exercised the old, buggy
lastSweep-on-cold behavior and left a stale `lastSweep` value in the local `node_modules/.astro`
content-layer cache from that run; that stale value was cleared programmatically (parsing and
rewriting `node_modules/.astro/data-store.json`'s `devalue`-serialized `meta:articles` collection
to delete the one stale key — no file was deleted, per this project's "never `rm`" rule) so the
warm-build sequence below genuinely exercises the corrected code, not leftover state from the bug.

## Warm builds (`pnpm run build`, no env overrides)

**First warm build after the cold build above — expected and observed `mode=warm+sweep`** (no
sweep had run yet):
```
[d1-articles] mode=warm+sweep public=40049 changed=0 removed=0 explained=0 rowsRead=49178 budget=100000
```
Wall time: 42.04s total (`time pnpm run build`). 49,178 rows is 0.49x `SWEEP_ROWS_READ_BUDGET`
(100,000).

**Second warm build, immediately after — expected and observed `mode=warm`** (the sweep that just
ran satisfies `SWEEP_INTERVAL_SECONDS` for the next 24h):
```
[d1-articles] mode=warm public=40049 changed=0 removed=0 explained=0 rowsRead=5928 budget=25000
```
Wall time: 42.54s total. 5,928 rows is 0.24x `WARM_ROWS_READ_BUDGET` (25,000) — consistent with
`docs/phase-04/spikes.md`'s earlier 04-01 measurement of 5,926 rows for a near-identical
3-day/324-article window.

`changed=0` on every one of the three builds above (cold, warm+sweep, warm) is the digest-based
skip working correctly at full-corpus scale — the content-layer store already held every synced
article at its current digest from the very first cold pass in this session, so zero manifest
writes were issued on any of the three follow-up builds. This is the steady-state behavior a real
deployment will see on every cron cycle where nothing actually changed.

## Baseline committed to KV

After the cross-check passed (step 3) and the three sync modes were proven (step 4), the articles
last-good baseline was committed for real:

```
node --input-type=module -e "
const m = await import('./src/lib/server/build-state.ts');
await m.commitLastGood({ buildHash: 'phase-04-baseline', requiredSections: ['articles'] });
"
```

Stored: `articles.count = 40049`, `buildHash = 'phase-04-baseline'`,
`recordedAt = 2026-09-27T00:18:19.382Z`, at KV key `build:last-good` in the real
`915tldr-render-manifest` namespace. **Verified per the acceptance criterion:**
`BUILD_STATE_REQUIRE_BASELINE=1 pnpm run build` (no `BUILD_STATE_BOOTSTRAP`) succeeded
immediately after, logging `mode=warm ... rowsRead=5911 budget=25000` with no shrink-check
failure — the baseline is real and load-bearing, not just written and never read.

## Budgets replaced with measured values

`WARM_ROWS_READ_BUDGET` (25,000), `SWEEP_ROWS_READ_BUDGET` (100,000) and `COLD_ROWS_READ_BUDGET`
(1,500,000) in `src/content/loaders/articles-loader.ts` were already, by coincidence, round
numbers at or above 2x every measured figure above (2x cold = 1,013,612 ≤ 1,500,000; 2x
warm+sweep = 98,356 ≤ 100,000; 2x warm = 11,856 ≤ 25,000) — no numeric change was needed, only
replacing the "provisional" comment with one citing this session's real measurements next to each
constant (see the source file).

## Local incremental-build spike (04-09 Task 3)

**Verdict: `REUSE_WARM_ONLY`.** `experimental.incrementalBuild` reuses unchanged pages reliably
in a warm, same-checkout build — but in a fresh clone with only `node_modules/.astro` restored
(the exact shape of a Workers Builds container: build caching restores that one directory, not a
whole prior `node_modules`), it reused **zero** pages and re-rendered the full corpus. This
reproduces `withastro/astro#18055` exactly as 04-RESEARCH.md's Common Pitfall #1 warned, against
this project's own real D1-backed loader and real production data — not assumed, measured.

All five builds ran against real production D1/KV (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`
already in the shell environment), on 2026-09-27, same machine, same git commit (`89730f0`)
throughout. Wall time and peak RSS for A1/A2/B2 were measured by polling
`/proc/<astro-pid>/status`'s `VmHWM` every 1s (04-03's own method — `/usr/bin/time -v` is still
not installed on this machine). B1/B3/B4/CI1 were run under a plain `timeout`, without the RSS
sampler — their wall time below is Astro's own self-reported total (`X page(s) built in Y`),
which is honest but excludes the `guard:config`/`test:build-gate` steps that run before
`astro build` itself starts; peak RSS for those four is not measured and is left blank rather
than estimated.

| Build | Flag | D1 loader mode | rowsRead | Wall time | Peak RSS | Pages built | Pages restored |
|---|---|---|---|---|---|---|---|
| A1 | off | cold | 507,677 | 237s (outer) | 2,877,072 KB (≈2.81 GB) | 59,907 | n/a (flag off) |
| A2 | off | warm+sweep | 48,922 | 134s (outer) | 2,797,264 KB (≈2.73 GB) | 59,907 | n/a (flag off) |
| B1 | on (first, after a flag off→on toggle) | cold | 507,677 | 2m 4s (Astro-reported) | not measured | 59,907 | 59,888 / 59,907 |
| B2 | on (second, no toggle) | cold\* | 507,804 | 2m 16s (Astro-reported) | 2,888,628 KB (≈2.82 GB) | 59,918 | 59,850 / 59,918 |
| CI1 (fresh clone) | on (no toggle vs. its restored cache) | warm | 5,715 | 2m 11s (Astro-reported) | not measured | 59,918 | **0 / 59,918** |

\* B2's D1 loader also logged `mode=cold` — see "A real, measured side-finding" below; this
reflects the `astro.config.mjs` change itself resetting the content-layer store, not a data
problem, and is unrelated to the incremental-build page-restore numbers in the last two columns.

Two additional flag-on builds (B3, B4) were run in the SAME checkout, back-to-back with **no**
config toggle between them, specifically to get one clean, steady-state (non-toggle) number
before the fresh-clone test: B3 (`mode=cold`, 507,804 rows, `59918 page(s) built in 2m 19s`,
following C1 below) then B4 immediately after (`mode=warm+sweep`, 49,043 rows,
**`59918 page(s) built in 35.97s`**, 59,899/59,918 pages restored) — the fastest of every build in
this spike, and the number that matters for "what does steady-state 2-hourly Workers Builds look
like if the D1 loader AND the flag both stay warm." C1 (an extra flag-OFF build, `mode=cold`,
507,804 rows, `59918 page(s) built in 2m 4s`) sits between B2 and B3 and exists only because a
config toggle (on→off) was needed to test the toggle's own effect on the D1 loader a second time
in the opposite direction — its own build was not otherwise part of the five-build table above.

### Diffs (via `tools/compare-builds.mjs`)

- **A1 vs A2 (flag off, no data change expected):** `identical=59923 changed=1 added=0 removed=0`;
  **articles: identical=40118, changed=0.** The one non-article file that changed is
  `version.json` — expected and explained: `src/lib/build-info.ts`'s `BUILD_TIMESTAMP` is
  `new Date().toISOString()` captured fresh at every build, by design (OPS-05/06). **Zero
  unexplained changed article files.**
- **B1 vs B2 (flag on, no toggle, real production drift of +10 articles between them):**
  `identical=59871 changed=53 added=11 removed=0`; **articles: identical=40118, changed=0.** The
  53 changed + 11 added files are the home feed, the 8 category listing pages, `tags.astro`,
  `rss.xml`, `sitemap-index.xml`, `news-sitemap.xml`, `404-index.json`, `version.json`, and a
  handful of `tag/*.html` pages picking up the 10 newly-ingested articles — fully explained by
  real production ingestion during the ~15 minutes this spike ran (public count rose from 40,118
  to 40,128 mid-sequence; the ingest cron runs every 2 hours and does not pause for a local
  build). **Zero unexplained changed article files.**
- **B4 vs CI1 (flag on, same commit, warm checkout vs. fresh clone):** overall
  `identical=83 changed=59852`; **articles: identical=10, changed=40118** — this large number is
  explained in full below (build-provenance stamp, not content), not left as a mystery.

### A real, measured side-finding: the footer's build stamp on a RESTORED page is not "now"

Investigating why the article-level sha256 diffs above (and an earlier A2-vs-B1 diff, not shown
in the table since it mixed a real +10-article production change with the effect below) looked
like "every article changed" even when `evaluateShrink`/the loader's own digest tracking showed
no article content had changed, a byte-for-byte diff of one specific article
(`business/2026-toyota-tacoma-...html`) between two builds found exactly one line differing:

```
< <p data-build data-stamp="commit">build 89730f0 · 2026-09-27</p>   (a build that actually re-rendered this page)
> <p data-build data-stamp="commit">build 5b0db41 · 2026-09-27</p>   (a build that RESTORED this page, unchanged)
```

**This is not a bug — it is the correct, unavoidable consequence of page restoration.** A
restored page is copied byte-for-byte from whenever it was **last actually rendered**, including
whatever `BUILD_HASH` (`src/lib/build-info.ts`, `local-git` fallback: `git rev-parse --short=7
HEAD` at that earlier build's own run) was baked into it then — not the current build's commit.
`5b0db41` was two commits behind the actual current HEAD (`89730f0`) at the time these builds
ran; the article showing it had simply not been re-rendered since that earlier commit. Confirmed
directly: stripping the `data-build` line and re-diffing the same two files
(`diff flagoff.stripped.html flagon.stripped.html`) showed **zero** remaining differences — every
other byte (content, rail, structured data, canonical) was identical.

**Consequence for 04-11's decision, if `experimental.incrementalBuild` is ever turned on in
production:** an article's visible `data-build` footer stamp would report whichever commit last
caused THAT SPECIFIC article to actually re-render — not necessarily the commit currently live —
for as long as the page keeps getting restored unchanged. Whether that is acceptable (arguably
more honest: "this content was last verified/rendered at commit X") or undesirable (the owner may
expect the footer to always reflect the current deploy) is a real, disclosed product question for
04-11, not something this measurement task decides. It does **not** affect correctness of the
article's own content, rail, or structured data, which are proven byte-identical above once this
one expected field is set aside.

**Why this does not implicate the D1-loader's own cold/warm state:** the loader logging
`mode=cold` on B1/B2/B3/C1 is a separate, also-real observation — every one of those four builds
followed an `astro.config.mjs` change (the `ASTRO_INCREMENTAL_BUILD` env var toggling), and each
one found `store.keys().length === 0` (an empty content-layer store) at the start of `load()`,
triggering `articlesLoader`'s own `storeEmpty` cold-trigger (`src/content/loaders/
articles-loader.ts`). B4, run immediately after B3 with **no** toggle, correctly logged
`mode=warm+sweep` — confirming the reset is tied to the config change, not to the
`incrementalBuild` feature itself being "on." **Practical implication:** if the owner ever A/B
tests this flag by toggling it on a non-production branch (exactly what `docs/phase-04/
workers-builds-setup.md` step 3 sets up), the FIRST build after each toggle pays a full cold
D1 resync (~508k rows, well inside `COLD_ROWS_READ_BUDGET`, but a real one-time cost) — flagged
for awareness, not a defect to fix in this plan.

### Fresh-clone CI simulation (step 3)

`git clone --local` this repo at `89730f0` into the session scratchpad, `pnpm install
--frozen-lockfile` there (fresh `node_modules`, 9.5s), then copied ONLY this checkout's
`node_modules/.astro` (955 MB) into the clone — the exact directory Workers Builds' own build
caching restores (D-06) — before running `ASTRO_INCREMENTAL_BUILD=1 pnpm run build` inside the
clone.

**Result: the D1 content layer survived the copy correctly (`mode=warm`, `rowsRead=5,715` — D-06
re-confirmed for the third time this phase), but Astro's own page-restore mechanism found `0` of
59,918 pages reusable** — every page was rendered fresh (`2m 11s`, matching the full-render cost
of a cold/toggle build, not the `35.97s` steady-state warm-checkout number). Byte-identity was
independently confirmed for the correctness of that full re-render: the same sample article
(`business/2026-toyota-tacoma-...html`), diffed between the warm-checkout build (B4) and the
fresh-clone build (CI1) with the `data-build` line stripped, was **byte-identical** — the fresh
clone rendered the exact same correct output, it just could not reuse any of it.

**This directly confirms 04-RESEARCH.md's flagged risk (Open Question 2, Common Pitfall #1,
`withastro/astro#18055`) at real scale, against this project's own loader and real production
data — not a synthetic reproduction.** A genuine Workers Builds container is a fresh checkout on
every build; this local simulation is the closest approximation available without spending a
real Workers Builds run, and it reproduces zero reuse exactly as the cited upstream issue
describes.

**One local mitigating data point, not a recommendation:** even the slowest build measured in
this entire spike (A1, a genuinely cold D1 fetch **and** a full page render with the flag off)
completed in under 4 minutes wall time — comfortably inside Workers Builds' 20-minute hard
ceiling (`docs/phase-03/render-step-location.md`'s Pitfall 4 concern). This local machine's CPU
and disk I/O may not match a Workers Builds container's, so this is not a substitute for a real
Workers Builds timing run (04-10), but it means the WORST case observed here — full cold fetch +
full render, no reuse of any kind — is not obviously incompatible with the 20-minute ceiling
either, softening (not eliminating) the urgency RESEARCH originally flagged for Pitfall 4.

### Summary for 04-11

- `experimental.incrementalBuild` works exactly as documented in a warm, same-checkout dev loop.
- It provides **no measured benefit** in the one environment that actually matters for D-05
  (Workers Builds, fresh container per build, cache-restore of `node_modules/.astro` only) — local
  evidence says assume `REUSE_WARM_ONLY` (effectively `NO_REUSE` in production) until a real
  Workers Builds run (04-10) proves otherwise.
- Byte-identity holds in every configuration tested once the expected, disclosed
  build-provenance-stamp difference is accounted for — turning the flag on does not corrupt or
  change article content, rail, or structured data.
- The flag's default stays OFF (`astro.config.mjs`, unchanged by this task) pending 04-11's
  decision, which should treat this section's `REUSE_WARM_ONLY` verdict as the working assumption
  for Workers Builds, not the warm-checkout numbers.

## Workers Builds spike (04-10 Task 2)

Measured on the REAL, newly-connected Workers Builds pipeline (`915tldr-v2` Worker, repository
`915tldr-frontend`, branch `feature/phase-04`), triggered via the Deploy Hook exactly as D-02
describes. Read via the `cloudflare-builds` MCP (full build logs, saved to the gitignored
`.gsd/build{1,2}-log.txt` — never committed) cross-checked independently against the Workers
Versions REST API (`GET /accounts/{id}/workers/scripts/915tldr-v2/versions`), which this session's
own `CLOUDFLARE_API_TOKEN` CAN read (unlike the Workers Builds API itself, which returned
`403 {"code":12004,"message":"Forbidden"}` for every builds/logs endpoint — this token lacks the
"Workers CI Read" permission scope; flagged for the owner if a future session needs to read builds
without MCP access).

### Build 1 — cold (first-ever connection, empty cache)

| Field | Value |
|---|---|
| Trigger → deployed | 2026-09-28T05:03:48.905Z → 05:14:38Z (build log) / 05:14:32.448Z (new version created_on) |
| **Total wall time (hook POST → deployed version)** | **649s (10m49s)** |
| Dependencies cache | Empty (first build) — fresh install, 347 packages, **8.9s** |
| `guard:config` + `test:build-gate` | Pass, 8/8, ~1-4s |
| D1 loader | `mode=cold public=40176 changed=40176 removed=0 explained=0 rowsRead=508421 budget=1500000` |
| Content-sync phase (D1 cold fetch + type-gen) | **3m26s** (05:04:36 → 05:08:02) |
| Astro page-generation | **2m44s** (05:08:02 → 05:10:46), 59,977 pages ≈ 2.74ms/page |
| Astro's own self-reported total | 6m11s (content-sync + page-gen combined) |
| Deploy (`wrangler versions upload --config wrangler.jsonc`) | **3m46s** (05:10:47 → 05:14:33), 59,985 assets uploaded |
| Build/dependency cache upload (for next build) | ~5s |
| Result | **SUCCESS** — version `58c11ea8` (number 5), alias `feature-phase-04` |

**D-08 held on the real platform**: the deployed version's own `resources.script_runtime` (read via
the Versions API) shows `handlers:["fetch"]` and the real `_redirects` rules (`/categories`→`/`,
`/sources`→`/`, `/sitemap.xml`→`/sitemap-index.xml`, etc.) — confirming 04-06's mandatory
`--config wrangler.jsonc` deploy-flag fix (without which `@astrojs/cloudflare` silently drops the
custom Worker) also holds on a genuine Workers Builds run, not just local `wrangler deploy`.

**Verdict: `WB_COLD_FITS`** — 649s (10.8min) is well under the 900s (15min) threshold, leaving
~9.2 minutes of margin to the hard 20-minute ceiling.

### Build 2 — warm (build cache restored, D1 loader warm+sweep)

Triggered immediately after Build 1 completed, no config change (flag still off) — this build
tests D-06's build-cache-restore claim cleanly, separate from the `experimental.incrementalBuild`
question (04-09 already found that toggling that flag forces the D1 loader cold on the very next
build, which would have confounded this specific measurement).

| Field | Value |
|---|---|
| Trigger → deployed | 2026-09-28T05:18:02.405Z → new version `e58f7fde` created 05:21:59.031Z |
| **Total wall time (hook POST → deployed version)** | **~237s (3m57s)** |
| Dependencies + build-output cache | **RESTORED** (`Success: Build output restored from build cache.` / `Success: Dependencies restored from build cache.`, 05:18:12/05:18:14) — **D-06 confirmed on the real platform**, not just locally |
| Changelog loader | `[d1-changelog] sources=json:9,d1:6 total=15` |
| D1 articles loader | `mode=warm+sweep public=40176 changed=0 removed=0 explained=0 rowsRead=48748 budget=100000` |
| Content-sync phase | **15.19s** (vs. 3m26s cold — the cache-restore payoff) |
| Vite warnings (benign, pre-existing, unrelated to this spike) | 3× `fonts/*.woff2 referenced ... didn't resolve at build time, it will remain unchanged to be resolved at runtime` |

**CAVEAT — this build's own returned log is truncated.** The Workers Builds API's log response for
this build ends mid-render at 05:21:15 (still individually re-rendering article routes, no final
"page(s) built" line, no asset-upload lines, no closing "Success!" line) even though the build's
own recorded outcome is SUCCESS. The **total wall time above is derived from the Workers Versions
API's `created_on` timestamp for the new deployed version**, not from the (incomplete) build log —
this is a real, disclosed measurement-source substitution, not a gap in what was checked. Per-phase
timing breakdown for the render/upload portion of Build 2 is therefore not available; only the
aggregate total is.

This second build's D1 loader confirms warm-mode reuse cleanly (rowsRead dropped from 508,421 to
48,748, matching 04-03's warm+sweep pattern) with the flag off — no page-render reuse was expected
or observed (pages were still being individually re-rendered per the truncated log's `(+Nms)`
lines), consistent with `experimental.incrementalBuild` being off for this build.

### D-15 failure-notification drill

The owner did not grant a token scoped to edit Cloudflare dashboard build variables (04-10 Task 1
checkpoint), so per the plan's own documented fallback, this drill ran **locally**
(`WORKERS_CI=1 V1_CHANGELOG_URL=<empty-entries data: URL> NTFY_TOPIC=<real topic>
node tools/ci-build.mjs build`), not on Workers Builds itself. **The in-container (real Workers
Builds) notification path remains unproven** — flagged for the 04-12 human-check, exactly as the
plan anticipates for this fallback path.

Three consecutive real local runs, each confirmed by reading the real ntfy topic back:

1. **Drill 1** — build correctly failed at the changelog-loader's zero-entries guard (D-13/REND-03,
   working as designed) and a real ntfy push WAS delivered — but with the WRONG title
   (`915 TLDR build failed: $ node --test tests/ci-fixtures/assert-no-d1.test.mjs`). Root cause: a
   real bug in `classifyFailure()` (04-09) — it picked the FIRST line anywhere in the build's tail
   output that substring-matched a `CHECK_PATTERNS` name, and `assert-no-d1` is both a pattern name
   AND the literal filename of an earlier, successful `test:build-gate` step, so that step's own
   command echo won the match every time. **Fixed** (Rule 1; `classifyFailure` now anchors on this
   codebase's own `` `${moduleName}: ${message}` `` throw convention first, falling back to the old
   substring scan; regression test added using the real log lines).
2. **Drill 2** (post-fix #1) — the now-CORRECT title
   (`changelog-loader: v1 changelog.json has zero entries — refusing to build (...)`) crashed the
   ENTIRE `ci-build` process with an uncaught `TypeError: Cannot convert argument to a ByteString
   because the character at index 76 has a value of 8212 which is greater than 255` — the message's
   em-dash (this codebase's own routine punctuation style) is not a valid HTTP header byte, and
   `defaultNotify()` passed it into the ntfy `Title` header unsanitized. This defeated D-15's own
   "never fails silently" guarantee at the exact moment it mattered. **Fixed** (Rule 1;
   `toHeaderSafe()` added — normalizes em/en-dash, curly quotes, ellipsis to ASCII, strips anything
   else outside Latin1 — applied to the `Title` header only; the POST body keeps the real UTF-8
   text unchanged).
3. **Drill 3** (post-fix #2) — clean exit code 1, correct sanitized ntfy title delivered:
   `915 TLDR build failed: changelog-loader: v1 changelog.json has zero entries - refusing to build
   (the /changelog empty-state failure, REND-03)`, with the real em-dash preserved in the message
   body (confirmed by reading the ntfy topic back). **This is the passing result.**

Both bugs were found only because this drill used a REAL failure message in this codebase's own
real prose style, not a synthetic ASCII-only fixture — see
`changelog/2026-09-27-2333_fix-classifyfailure-misattribution.md` and
`changelog/2026-09-27-2337_fix-notifier-bytestring-crash.md` for full writeups.

### Account limits and cost (Task 2 item 5)

Fetched 2026-09-28 from `developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/`
(page last updated 2026-05-29):

| Limit | Value |
|---|---|
| Build minutes/month (Paid plan) | 6,000, shared across **every** Workers Builds project on this account, then $0.005/min overage |
| Concurrent builds | 6 |
| Build timeout | 20 minutes (hard) |
| Deploy Hooks | 10/min per Worker, 100/min per account |
| Build container | 4 vCPU, 8GB RAM, 20GB disk |
| Env vars | 64 max |

**Projection** (worst case, every build costs Build 1's cold-build time): 12 builds/day (2-hourly
ingest cron per D-02) × 30 days × ~11 min ≈ **3,960 min/month** — under the 6,000-min allowance,
with real steady-state likely far cheaper (Build 2's warm ~4-minute number, if representative of
most cycles, projects to ~1,440 min/month). This account's allowance is shared with the owner's
other Workers Builds projects, so this projection is a floor on total usage, not a ceiling
specific to 915tldr.

**Owner cost input for 04-11 (not the decision itself)** — Jaime, 2026-09-27 23:25 MDT: *"$0 to $5
per month is acceptable, but I would definitely want to look into optimizing later."*

### `experimental.incrementalBuild` platform reuse test — PENDING (owner morning action needed)

**Not yet measured.** Testing whether Astro's page-reuse mechanism works in a genuinely fresh
Workers Builds container (mirroring 04-09's local fresh-clone CI simulation, but on the real
platform) requires two more hook-triggered builds against a commit with the flag ON. Deploy Hooks
build whatever is currently on GitHub's `feature/phase-04` tip; this session cannot push (project
git rules reserve pushes for the owner via lazygit), and the owner was asleep when this spike
reached this point. **Two ready paths, recorded for the owner to choose from (see
04-10-SUMMARY.md's checkpoint):**

- **(a) Push the prepared commit.** Commit `cc1b050` (`chore(astro-config): TEMPORARY hardcode
  incrementalBuild=true for 04-10 spike`) is already committed locally on `feature/phase-04`,
  clearly marked temporary. Owner pushes via lazygit; a continuation session then triggers Build 3
  (expected `mode=cold` again — 04-09's own documented toggle-reset behavior, not a new bug) and
  Build 4 immediately after with no further toggle (the real test — does a genuinely fresh
  container reuse pages via the flag, unlike local's warm-checkout-only success), records
  `WB_REUSE_PROVEN`/`WB_REUSE_ABSENT` here, then commits a revert back to the env-var seam.
- **(b) Dashboard variable.** Owner temporarily sets `ASTRO_INCREMENTAL_BUILD=1` in the Cloudflare
  dashboard's (unscoped) build variables. Currently low-risk for production since `main` is still
  only the initial commit with no `build:ci` script configured to do anything meaningful with it —
  but this must be removed immediately after Builds 3/4, and unlike (a) it has no self-reverting
  commit to make that obvious later. (a) is the safer default; (b) is faster if the owner is at a
  computer without wanting to touch `git push`.

### Build 3 — flag-on, first toggle (owner pushed `cc1b050` 2026-09-30)

The owner chose option (a): pushed `feature/phase-04` (tip `e95a734`, including the temporary
`incrementalBuild=true` hardcode). Non-production branch builds are enabled, so the push itself
auto-triggered this build — no Deploy Hook POST was needed.

| Field | Value |
|---|---|
| Build | `f4b05473-ebd4-4883-9d59-293451dbc63f`, commit `e95a734` |
| Trigger (push) → deployed | 2026-09-30T21:02:56Z → "Success! Build completed" 21:12:10Z |
| **Total wall time** | **~9m14s (554s)** |
| Dependencies + build-output cache | Restored (21:03:13/21:03:15) |
| Changelog loader | `[d1-changelog] sources=json:9,d1:6 total=15` |
| D1 articles loader | `mode=cold public=40449 changed=40449 removed=0 rowsRead=512125` — **cold again, as documented**: 04-09 already found that any `astro.config.mjs` change (this commit's flag toggle) resets the content-layer store to empty, forcing `storeEmpty` cold-trigger regardless of the flag's own value. Not a new bug. |
| Astro page-generation | 60,349 pages built in 4m43s |
| Pages restored (incrementalBuild) | **0 of 60,349** — expected: this is the FIRST build since the flag flipped on, and Astro's own restore mechanism has nothing to restore from (no prior build ran with the flag on) |
| Deploy (`wrangler versions upload --config wrangler.jsonc`) | `Success! Uploaded 60355 files (7 already uploaded) (131.56 sec)` |
| Result | SUCCESS — version `b5f423fc` (number 7) |

### Finding: near-total asset re-upload on every commit change (cost-relevant for 04-11)

Build 3's deploy uploaded 60,355 of 60,355 files (only 7 already present) — essentially a full
re-upload, not the small delta (`40449 − 40176 = 273` new/changed articles, `60355 − 59985 = 370`
new/changed pages overall) a content-hash-based dedup should have produced if most pages were
byte-identical to what Build 1/2 already stored.

**Root cause, confirmed directly from source (not fixed in this plan — see below):**
`src/layouts/Base.astro` (the layout every page in this project renders through) unconditionally
embeds the build's commit hash in the footer of every single page:

```
// src/layouts/Base.astro line 152
<p data-build data-stamp={stamp}>build {BUILD_HASH} · {stampDate}</p>
```

`stampDate` is correctly stamp-gated (`stamp="commit"` articles use the STABLE
`BUILD_COMMIT_DATE`, not the per-build `BUILD_TIMESTAMP` — this is exactly what 04-09's SUMMARY
already documented and this session independently re-confirmed). **But `BUILD_HASH` itself has no
such gate** — it is printed on every page regardless of `stamp` mode, and
`src/lib/build-info.ts`'s `resolveBuildHash()` derives it from `WORKERS_CI_COMMIT_SHA` (Workers
Builds' own injected commit SHA) or a `git rev-parse` fallback. **Any commit change between two
builds changes `BUILD_HASH`, which changes the raw HTML bytes of literally every page on the
site — including every article whose actual content, category, tags, and structured data are
100% unchanged** — defeating Cloudflare's content-hash-based asset-upload deduplication for that
entire deploy.

**Effect on upload time / build minutes (this build):** the 131.56s upload phase re-sent ~60,000
files that (content-wise) did not need to change. Compared to a hypothetical dedup-eligible
deploy uploading only the ~370 genuinely new/changed pages, this is a large, avoidable per-deploy
cost multiplier on the upload phase specifically (not on the D1-loader/render phase, which is
governed by the separate cold/warm mechanics already measured above).

**Open question this plan does not resolve:** whether this only bites on an actual code push (a
new commit, as happened here — Build 1/2 vs Build 3 differ by commit) or ALSO on a same-commit
steady-state rebuild (the D-02 ingest-cron-triggered case, which redeploys without a new commit).
If `WORKERS_CI_COMMIT_SHA` stays constant across two builds of the identical commit,
`BUILD_HASH` would also stay constant and unchanged articles should dedupe normally in that
scenario — meaning this finding would apply only to actual code deploys, not every 2-hourly cron
cycle. This was not verified in this session (would require two consecutive same-commit
Deploy-Hook-triggered builds, which risks conflating with the flag-toggle-cold-reset variable
already at play here) and is flagged as follow-up verification before 04-11 finalizes its cost
model.

**Not fixed in this plan** — per the coordinator's explicit instruction, this is a real,
diagnosed finding for 04-11's cost picture, not an in-scope fix. A fix (e.g., gating `BUILD_HASH`
in the footer the same way `stampDate` already is, or omitting it from `stamp="commit"` pages
entirely) is a product/design decision about what the footer should show on an unchanged article,
not a mechanical bug fix — Rule 4 territory, left for 04-11 or a dedicated follow-up.

**FIXED in `89bbe38` (04-11a, owner-approved quick fix, 2026-09-30).** `Base.astro` gained a new
`buildStamp` boolean prop, default `false`, gating the entire `<p data-build>` element — not just
`stampDate` — so `BUILD_HASH` no longer renders anywhere by default. Only `src/pages/index.astro`
passes `buildStamp={true}`; every article, category, tag, and static page now omits the footer
build stamp entirely, and `/version.json` is untouched (it reads `build-info.ts` directly,
independent of this prop). The owner's rationale: the homepage already regenerates in full on
every build regardless of commit (its feed reflects "now"), so the stamp costs nothing there,
while every other page can now stay byte-identical across commits when its own content is
unchanged. Measured directly against a real build: before this fix, all ~60,359 built HTML files
carried the commit hash; after, exactly 1 (`dist/client/index.html`) does. See
`.planning/phases/04-static-generation-templates-seo/04-11a-SUMMARY.md` for full verification detail.

### Build 4 — flag-on, no toggle (the real reuse test)

Triggered via the `feature/phase-04` Deploy Hook against the SAME tip (`e95a734`, no new commit,
no further config toggle) immediately after Build 3 — the real test of whether Astro's
`experimental.incrementalBuild` reuses pages in a genuinely fresh Workers Builds container.

| Field | Value |
|---|---|
| Build | `6c35446d-a4d4-4f2c-90e9-caccdf74d498`, commit `e95a734` (unchanged from Build 3) |
| Trigger (hook POST) → deployed | 2026-09-30T21:18:26.775Z → new version `509fbcee` created 21:20:53.888Z |
| **Total wall time** | **~147s (2m27s)** |
| Dependencies cache | Restored (21:18:43) |
| Build-output cache | Restored (21:18:46) |
| D1 articles loader | `mode=warm+sweep public=40449 changed=0 removed=0 rowsRead=49503 budget=100000` |
| Changelog loader | `[d1-changelog] sources=json:9,d1:6 total=15` |
| **Pages restored (confirmed in the returned log)** | **34,871** |
| Pages rendered (confirmed, always-render pages: `/404.html`, `/404-index.json`, `/about.html`, `/changelog.html`, `/contact.html`, `/news-sitemap.xml`, `/privacy.html`, `/rss.xml`, 3× `/source/*.html`, `/tags.html`, `/terms.html`, `/version.json`) | 14 |
| Result | SUCCESS — version `509fbcee` (number 8) |

**CAVEAT — this build's own returned log is truncated a second time.** It ends mid page-list at
21:20:06 (34,974 lines), before Astro's own "page(s) built" summary line, before the deploy/upload
phase, and before the closing "Success!" line. **34,871 is therefore a confirmed LOWER BOUND on
the true restored-page count, not the final total** — out of Build 3's ~60,349 pages, the log
simply stops recording before the remaining ~25,000+ pages' restore/render status is captured.
Total wall time above (147s) is independently confirmed via the Workers Versions API's
`created_on` timestamp, the same substitution method used for Build 2.

### Verdict: `WB_REUSE_PROVEN`

Even as a confirmed lower bound, 34,871 of ~60,349 pages restored (57%+ of the entire site,
overwhelmingly article pages with an unchanged `cacheKey`) on a **genuinely fresh Workers Builds
container** — not a warm, same-checkout dev loop — is unambiguous evidence that
`experimental.incrementalBuild` DOES reuse unchanged pages on the real platform. This is further
corroborated by the wall-time collapse: Build 4 (147s) vs. Build 3 (554s) — a 3.8x speedup for
effectively the same page count and an unchanged public-article count (`40449` both builds), with
the D1 loader itself already warm in both cases (Build 3's D1 loader was `mode=cold` only because
of the config-toggle reset, not because the cache was actually unavailable). The only plausible
explanation for that much wall-time collapse, on top of the directly-observed `(restored)` lines,
is large-scale page reuse.

**This contradicts 04-09's local fresh-clone simulation**, which found ZERO of 59,918 pages
restored under what was believed to be an equivalent test (a `git clone --local`, a fresh
`pnpm install --frozen-lockfile`, with only `node_modules/.astro` manually copied in from a prior
warm build). The likely explanation, not exhaustively proven but grounded in what actually
differed between the two experiments: **Workers Builds restores TWO separate caches — a
"dependencies cache" (the full `node_modules` / pnpm store) AND a "build output cache"
(`node_modules/.astro`) — both written by the SAME prior build (Build 3) and restored together by
the SAME platform for Build 4.** 04-09's local simulation only ever reproduced the second half:
it ran a FRESH `pnpm install` (producing a node_modules tree that is functionally equivalent under
the frozen lockfile, but not byte-identical or cache-lineage-identical to the tree that originally
produced the copied `node_modules/.astro`) and manually copied in only the build-output side. If
Astro's `incrementalBuild` cache-validity check depends on anything about the surrounding
`node_modules` tree being the SAME one that produced the cache (not merely dependency-equivalent),
a fresh install would invalidate it even with `node_modules/.astro` physically present — exactly
matching the zero-reuse result 04-09 found. This was not independently verified with a controlled
diff of the two `node_modules` trees in this session (out of scope for this plan), so it is
recorded as the leading, evidence-grounded explanation rather than a proven root cause.

**Practical implication for 04-11:** treat `WB_REUSE_PROVEN` as the real Workers Builds behavior,
not 04-09's local `REUSE_WARM_ONLY` finding — the local fresh-clone simulation understated the
real platform's reuse capability because it didn't reproduce Workers Builds' own dependencies-cache
restore, only the build-output half.

### `WB_REUSE_PROVEN` / `WB_REUSE_ABSENT`: **`WB_REUSE_PROVEN`**

This plan's remaining must-have is now satisfied. Both required verdict tokens are on file:
`WB_COLD_FITS` (Build 1) and `WB_REUSE_PROVEN` (Build 4, with the truncated-log lower-bound
caveat disclosed above).

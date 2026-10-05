# Phase 6 deploy record (06-15)

Status at the time of writing: **R2 pre-population done and verified. Nothing deployed, merged or
pushed.** The deploy itself is Jaime's merge and push (route option-a). This file is completed by
06-16 once the first real build has run.

## 1. Decision (Task 1)

Recorded from the orchestrator's relay of a real message from Jaime, 2026-10-04 14:32 MDT
("go 06-15"), which accepted the orchestrator's recommendation:

- **Route: option-a.** Jaime merges `feature/phase-06` into `develop` into `main` in this repo and
  pushes. No local `deploy:ci`, no local deploy of any kind.
- **"pre-populate ok":** upload the new Spanish archive objects to production R2 first.

Conditions set with that approval, and what happened to each:

| Condition | Result |
|---|---|
| Full suite green first | Yes, see section 2 |
| Projected Class A cost at or under 1 USD, counts as expected | Yes, see section 3 |
| No `deploy:ci` under option-a | Not run. Only the dry-run deploy step was run, which deploys nothing (section 4) |
| R2 writes limited to new `es/` keys, English keys unchanged | Verified, section 5 |

## 2. Suite result (before any upload)

Run on `feature/phase-06` at HEAD `afb5f4b`, working tree clean apart from the three untracked
paths that are never staged (`.gsd/`, `docs/screenshots/`, `docs/TODO-llms-txt.md`).

| Command | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| `pnpm run test:unit` (runs `pnpm run build` first, exit 0) | 1021 | 1021 | 0 | 0 |
| `pnpm run test:build-gate` | 9 | 9 | 0 | 0 |
| `pnpm run test:regression` | 5 | 5 | 0 | 0 |

The `test:unit` build rendered 121,630 pages in 3m 45s on this machine and ended with
`[archive] static files: 59616 / 100000 (fail at 80000)`. One line in the `test:unit` output reads
`[measure-worker-kv-cpu] verdict: FAIL (kv: KV_READS_OVER_BUDGET ...)`. It is the printout of a
test over a recorded fixture window (2026-09-30), not a live measurement, and the test passed.

## 3. Pre-population size and cost

From the latest build's `dist/archive-plan.json` (plan `generatedAt` 2026-10-04T20:43:18.727Z):

| Counter | Value |
|---|---|
| `archivedArticles` / `archivedArticlesEs` | 13,290 / 13,290 |
| `archivedTags` / `archivedTagsEs` | 17,728 / 17,728 |
| **Spanish objects to upload** (`archivedArticlesEs + archivedTagsEs`) | **31,018** |
| Spanish bytes to upload | 321,839,698 (about 322 MB) |
| Plan entries in total | 62,036 |

Before uploading I ran a read-only preflight that reproduces `runPreSync`'s own diff (plan against
`_meta/archive-index.json`, plus the index self-heal against a real listing of all four prefixes):

- R2 held 13,290 `articles/`, 17,728 `tags/`, **0** `es/articles/`, **0** `es/tags/`.
- The archive index held 31,018 entries, all English.
- The pre-sync would upload **31,018 keys, every one an `es/` key** (13,290 `es/articles/`,
  17,728 `es/tags/`) and **zero** English keys.
- 31,018 English entries have a changed sha256 against the index (new chrome and hreflang). `pre`
  never touches changed keys, only new ones, so they stay as they are until the post-deploy chain
  re-uploads them (REND-12, about 2 builds, watched by 06-16).

Class A cost, with the price checked on Cloudflare's R2 pricing page today (Standard storage:
**4.50 USD per million Class A requests**, free tier 1 million per month):

| Operation | Count (approx.) |
|---|---|
| PutObject, Spanish pages | 31,018 |
| PutObject, archive index | 1 |
| ListObjectsV2 (self-heal in `pre`, my preflight runs, my verification run) | about 160 |
| **Total Class A** | **about 31,200** |

Projected at list price: 31,200 x 4.50 / 1,000,000 = **about 0.14 USD, as an upper bound**. It is
0 USD if the account is still inside its monthly free million; I did not read the account's
month-to-date usage, so that is not verified. Storage added: about 322 MB, inside the 10 GB-month
free tier. Both figures are under the 1 USD gate, so I proceeded. The measured figure is the
operation count above (the PUT count is exact, from `uploaded: 31018`; the list count is an
estimate from page sizes). Cloudflare's billing page was not read afterwards.

## 4. Pre-sync pass

Command shape (R2 credentials loaded from `.dev.vars` into the process environment only, never
printed; only the two `R2_` variables were loaded, not the rest of `.dev.vars`):

```
CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy
```

Started 2026-10-04T20:45:04Z, finished before 20:52:24Z (the `pre` marker was written at
20:51:52Z), so one pass of about 7 minutes. One pass was enough; no second pass was needed.

```
ARCHIVE_SYNC_RESULT {"phase":"pre","uploaded":31018,"failed":0,"deferred":0,"movedBack":0,"deleted":0,"backlog":null,"alerts":[],"dailyReport":null,"disabled":false}
{"count":59616,"ceiling":100000,"failAt":80000,"status":"ok"}
[assert-archive-synced] ok: archive-sync pre confirmed this build
wrangler 4.136.3 --dry-run: exiting now.
[ci-build] dry run: skipping archive-sync post
```

Order of events inside that command, from the code and the log: archive-sync `pre`, the file-count
gate, the archive-synced guard, `wrangler deploy --dry-run` (exited without deploying),
`commitLastGood` skipped, `archive-sync post` skipped. Nothing was deployed and the last-good state
in KV was not committed.

## 5. Verification after the pass

Read through the project's own `createArchiveStore` read path (`listKeys`, `getJson`):

| Check | Result |
|---|---|
| `es/articles/` keys in R2 | **13,290** (plan: 13,290) |
| `es/tags/` keys in R2 | **17,728** (plan: 17,728) |
| English keys in R2 | `articles/` 13,290, `tags/` 17,728, unchanged from before |
| Archive index after | 62,036 entries: 31,018 English (unchanged count) + 31,018 Spanish |
| English index entries with `uploadedAt` at or after the pass start | **0**, so no English entry was rewritten |
| Preflight re-run after the pass | would upload 0 new keys |
| Orphans in the index that are not in the plan | 0 |

The uploaded set is `es/`-only by two independent means: the preflight showed the only new keys
were `es/` before the run, and the index shows no English entry touched by it. The pass result
itself reports counts only (it has no key list), so the first is the stronger evidence. English
objects were not re-read byte for byte; the claim rests on the pass only ever writing keys the
diff classified as new, and the index timestamps.

Stated plainly: T-06-52 (English archive objects changed before deploy) is mitigated for the
`pre` phase. The 31,018 changed English objects are the post phase's job after the deploy and were
deliberately not touched here.

## 6. Production KV writes (disclosed, project's designed path)

The `pnpm run build` inside `test:unit` ran **cold** on this machine (the loader logged
`Astro config changed - Clearing content store`, `[d1-articles] mode=cold public=40726
changed=40726`, and `[d1-articles-es] mode=cold rows=30`). By the loader's own code
(`src/content/loaders/articles-loader.ts`, `writeManifest(manifestEntries)`), a cold pass writes
every public article's manifest entry to the production `915tldr-render-manifest` KV namespace
through the bulk REST endpoint (up to 10,000 entries per call). I did not count the writes
independently; the loader logged `changed=40726`.

- **Confirmed by a read:** the production manifest entry for one sampled article now carries
  `buildHash: 'afb5f4b'`, this local checkout's HEAD, not a Workers Builds commit.
- Nothing in `src/worker.ts` reads `buildHash`, and the content hash and schema version that the
  incremental logic depends on come from the D1 row, so I do not expect an effect. I have not
  proved that for the incremental-build comparison path; 06-16 should keep it in mind when it reads
  the first real build's `mode=` line.
- This is the same effect 06-12 flagged as unverified. It is now verified for this build.
- I did **not** run a second cold build: the dry-run deploy step was run directly against the
  `test:unit` build output instead of `ci:local` (which would have rebuilt and rewritten about
  40.7k production KV entries again). See the deviation below.
- No D1 writes. No KV writes other than the manifest above. The dry-run deploy committed no
  last-good state.

## 7. Deviation from the plan's literal command

The plan's step 1 says `CI_BUILD_DEPLOY_DRY_RUN=1 pnpm run ci:local`. I ran
`CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` against the build that `test:unit` had
just produced (same tree, same corpus), which is the 05-08 precedent's shape. Reason: `ci:local`
adds a second cold build and a second bulk rewrite of about 40.7k production KV manifest entries
for no new information. The one thing `ci:local` does that I replaced by hand: it writes
`.astro/ci-build-started-at` (epoch seconds) before building, and `archive-sync`'s 840 s pre
deadline is measured from it. I wrote the current epoch seconds into that file myself, in the same
format, immediately before the run, because the existing value was hours old and would have made
`pre` upload nothing. The deadline was therefore measured from the run's own start, as designed.

## 8. Count watch: static files

| Measurement | Files |
|---|---|
| 06-12 build | 59,572 |
| This build (gate count) | 59,616 |
| Wrangler's own "Read N files from the assets directory" | 59,639 |
| Phase 6 budget (soft) | 60,000 |
| Gate thresholds | warn 70,000, fail 80,000, hard platform limit 100,000 |

Static files grew by 44 between 06-12's build and this one (about 7 hours; the corpus went from
40,704 to 40,726 public articles, and the archived counts did not change, so the growth is all in
the hot tier). Headroom to the 60,000 planning budget is 384 by the gate's count and 361 by
Wrangler's. Neither the 70,000 warn line nor the 80,000 fail line is near, so nothing blocks the
deploy, but the 60,000 figure is a planning number that will be passed by new articles alone in
roughly days at this rate. Whether the hot window re-derives itself is not something I checked.

## 9. Task 3: what Jaime does (not done by Claude)

Claude does not merge, push or switch branches.

1. In lazygit, merge `feature/phase-06` into `develop`, then `develop` into `main`, and push both.
2. In the Cloudflare dashboard, Workers & Pages, `915tldr-v2`, Settings, Build, Variables, confirm
   these three are **not set**: `ARTICLES_FORCE_COLD`, `ASTRO_INCREMENTAL_BUILD`,
   `ALLOW_FALLBACK_HOT_WINDOW`.
3. The push to `main` triggers the production Workers Build. `archive-sync` runs as designed on
   `main` (the pre phase will find nothing new to upload, because the Spanish keys are already in
   R2), then `wrangler deploy`, then the post phase starts re-uploading the 31,018 changed English
   objects and the Spanish objects whose content differs, over about 2 builds (REND-12).

What to compare the first build against: 06-12's corrected projection, `renderEnd` about **643 s**
(about **688 s** after the Spanish backfill), against the **1,200 s** Workers Builds ceiling. This
is a projection from one Workers Builds sample, not a measurement of this code on the platform.

Resume signal: "pushed" with the merge commit hash.

## 10. Still open (for 06-16)

- First real Workers Builds timing of this code (projection above).
- Post-phase convergence of the changed English archive objects (about 2 builds derived, not
  measured).
- Whether the first cold production build rewrites manifest entries that now carry `buildHash`
  `afb5f4b`, and whether that matters (section 6).
- The static-file headroom (section 8).

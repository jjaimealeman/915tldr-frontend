# Build Pipeline — End to End (Phase 4)

This is the single place that describes how a new article becomes a deployed page, from ingest to
the live Worker. It supersedes any narrower per-plan writeup (`docs/phase-04/loader.md`,
`docs/phase-04/workers-builds-setup.md`, `docs/phase-04/build-measurements.md`) for the
end-to-end shape — those documents remain the detailed reference for the loader's own budgets and
the raw measurements this pipeline's numbers come from.

## The pipeline

```
915tldr.com2 ingest cron (every 2 hours, "0 */2 * * *")
  -> fetch RSS, AI-process, detect duplicates (server/tasks/fetch-articles.ts)
  -> triggerFrontendBuild() posts the `main` Deploy Hook, ONLY when public articles changed
     (server/utils/frontend-deploy-hook.ts — D-02, OPS-10)
       |
       v
Cloudflare Workers Builds (915tldr-frontend repo -> 915tldr-v2 Worker)
  -> `pnpm run build:ci` (tools/ci-build.mjs build)
       -> guard:config, test:build-gate
       -> astro build
            -> D1 articles loader (src/content/loaders/articles-loader.ts): cold / warm /
               warm+sweep mode, each capped by its own measured rows-read budget
               (docs/phase-04/loader.md)
            -> D1 changelog loader (src/content/loaders/changelog-loader.ts)
            -> page render, with experimental.incrementalBuild ON by default
               (docs/phase-04/build-pipeline-decision.md) — unchanged pages restored from the
               Workers Builds build-output cache instead of re-rendered
  -> `pnpm run deploy:ci` (tools/ci-build.mjs deploy)
       -> `wrangler versions upload --config wrangler.jsonc` (mandatory --config flag, 04-06)
       -> commitLastGood() — ONLY after a real, successful deploy (D-14 never-shrink baseline)
  -> ntfy push on ANY failure at any step (D-15, tools/ci-build.mjs's classifyFailure/redact/
     toHeaderSafe), watchdog warning at 18 minutes ahead of the 20-minute hard ceiling
```

**Non-production branches** (`feature/*`, `develop`) build with the "Version command"
`pnpm exec wrangler versions upload --config wrangler.jsonc` instead of `deploy:ci` — this never
calls `commitLastGood`, so a preview build can never advance the production never-shrink baseline.

## Phase 5 amendment (05-08) — the archive tier in the real deploy path

Phase 5 adds a hybrid hot/archive tier (REND-07/REND-09) on top of this same pipeline, without
replacing any of the above. Full design record: `docs/phase-05/archive-architecture.md`.

**Updated pipeline (build step, every branch, unchanged command: `pnpm run build:ci`):**

```
BUILD step
  1. write .astro/ci-build-started-at (epoch seconds) — both archive-sync deadlines below
     measure from here
  2. node tools/partition-archive.mjs --clean        — clears stale tier-facts/dist/archive/plan
  3. astro build                                      — renders every page (hot AND archive-tier)
  4. node tools/partition-archive.mjs                  — moves archive-tier pages OUT of
                                                          dist/client into dist/archive, writes
                                                          dist/archive-plan.json
  5. node tools/assert-file-count.mjs                  — fails the build at 80,000 dist/client
                                                          files, warns at 70,000 (D-13/REND-11)
```

**Updated pipeline (deploy step, production branch ONLY — `pnpm run deploy:ci`, i.e.
`tools/ci-build.mjs deploy`):**

```
DEPLOY step
  0. hot-window guard — a fallback-provisional hot window (D-07) refuses to ship without
     ALLOW_FALLBACK_HOT_WINDOW=1; checked before anything below is spawned
  1. node tools/archive-sync.mjs pre                  — uploads NEW-to-archive pages; anything
                                                          that fails/times out/sits beyond a limit
                                                          is moved BACK into dist/client first.
                                                          Writes dist/archive-synced.json on every
                                                          exit-0 path (CR-02, 05-20) — proof this
                                                          build's partition has been confirmed.
  2. node tools/assert-file-count.mjs (re-run)         — on the FINAL dist/client, after any
                                                          move-back in step 1
  3. node tools/assert-archive-synced.mjs              — refuses a partitioned dist/ that
                                                          archive-sync pre has not confirmed for
                                                          this build (CR-02, 05-20); a refusal
                                                          aborts the deploy here, before wrangler
  4. wrangler deploy --config wrangler.jsonc           — ships dist/client (every page confirmed
                                                          static OR confirmed in R2)
  5. commitLastGood                                    — only after a REAL, successful deploy
                                                          (unchanged from 04-09) (skipped entirely
                                                          in a dry run — CI_BUILD_DEPLOY_DRY_RUN=1
                                                          deploys nothing, so nothing may be
                                                          committed or deleted; CR-01, 05-13)
  6. node tools/archive-sync.mjs post                  — re-uploads CHANGED archived pages,
                                                          deletes orphans, tracks backlog, reports
                                                          once/day; NEVER alters the deploy's own
                                                          exit code (D-10/D-12) (skipped entirely
                                                          in a dry run — CI_BUILD_DEPLOY_DRY_RUN=1
                                                          deploys nothing, so nothing may be
                                                          committed or deleted; CR-01, 05-13)
  7. ntfy alerts/daily report — every archive outcome from steps 1-6 (failed uploads, a disabled
     tier, a backlog older than 20h, the file-count warn alarm, the once-daily REND-11 report)
     reaches the owner exactly once, sent AFTER the deploy itself succeeds — never gating it
```

**Manual deploys (CR-02, 05-20).** `pnpm run deploy` now runs `pnpm run guard:config && node
tools/ci-build.mjs deploy` — the SAME sequence as Workers Builds' own `deploy:ci`
(`tools/ci-build.mjs deploy`), not a bare `wrangler deploy`. Before this fix, `pnpm run deploy` was
`guard:config && wrangler deploy --config wrangler.jsonc`, which skipped steps 1-3, 5 and 6 entirely
— a `pnpm run build` followed by that command could ship a partitioned `dist/` with every newly
archived page confirmed neither static nor in R2 (05-REVIEW.md CR-02). A bare `wrangler deploy`
remains forbidden (wrangler.jsonc's own comment already says so); `pnpm run guard:archive-synced`
runs step 3's check by hand against any `dist/` without deploying anything.

**Deadlines:** `PRE_DEADLINE_SECONDS` 840 (14 min), `POST_DEADLINE_SECONDS` 1020 (17 min), both
measured from `.astro/ci-build-started-at` — comfortably inside Workers Builds' 20-minute hard
ceiling alongside `astro build`/partition/the file-count gate/`wrangler deploy` itself. A backlog
older than 20h (`BACKLOG_ALERT_HOURS`) alerts every run until it clears (D-10). A build-start
marker older than `BUILD_START_MARKER_MAX_AGE_SECONDS` (1,800s) — or more than 60s in the future —
is ignored; both deadlines are then measured from this process's own start instead (IN-06, 05-20):
a standalone `ci-build deploy` run after an earlier `pnpm run build` must never inherit a stale
marker and treat both deadlines as already expired.

**What non-production (preview) branches do:** the build step (steps 1-5 above) runs
unconditionally on every branch — partitioning and the file-count gate both run on a preview
build too. **The deploy step's archive-sync phases never run on a preview build at all** —
non-production branches deploy via the "Version command"
(`pnpm exec wrangler versions upload --config wrangler.jsonc`, unchanged from the table above),
never `tools/ci-build.mjs deploy`, so `archive-sync.mjs` is never spawned and R2 is never
touched. (Independently, `archive-sync.mjs` also carries its own write-boundary guard that
refuses R2 writes on any non-`main` Workers CI branch even if it were somehow invoked — defense
in depth, not the primary mechanism.)

**Forced-full-rebuild runbook, archive-tier addendum (extends the section below):**

- **A template/redesign change needs no extra step for the archive tier.** The build step
  re-renders every page as usual; `post`'s own `changed`-key diff (sha256 comparison) picks up
  every archived page whose rendered bytes changed and re-uploads it automatically, bounded by
  `POST_DEADLINE_SECONDS` per run with backlog carry-forward (alerted past 20h) — no
  `ARTICLES_FORCE_COLD`-style flag needed for this tier.
- **To force a full re-upload of every already-archived page regardless of whether its content
  changed** (e.g. after changing `ARCHIVE_CONTENT_TYPE` or another upload-side property that
  `post`'s sha256 diff would never notice), run
  `node tools/archive-sync.mjs request-full --reason "..."` — the next production `post` run
  treats every indexed key as `changed` until the backlog clears.

## The decision this pipeline runs under

**Workers Builds does all builds, including forced full rebuilds (option-a).**
`experimental.incrementalBuild` is ON by default (`WB_REUSE_PROVEN`, Build 4: 147s vs Build 3's
554s, ≥34,871/~60,349 pages restored on a genuinely fresh container). A cold build comfortably
fits the 20-minute hard ceiling (`WB_COLD_FITS`, Build 1: 649s, ~9.2min margin). Full reasoning
and every measurement this rests on: `docs/phase-04/build-pipeline-decision.md`.

## Budgets (from the loader, docs/phase-04/loader.md)

| Mode | Trigger | Rows-read budget | Measured (build-measurements.md) |
|---|---|---|---|
| cold | empty store, `LOADER_STATE_VERSION` bump, 7-day resync, or `ARTICLES_FORCE_COLD=1` | 1,500,000 | 506,806–512,125 |
| warm+sweep | daily `SWEEP_INTERVAL_SECONDS` catch-up | 100,000 | 48,748–49,503 |
| warm | every build, rolling window | 25,000 | 5,715–5,928 |

## Staleness bound

**7 days, worst case.** The loader forces a cold resync at least every `COLD_RESYNC_INTERVAL_SECONDS`
(7 days) regardless of how the warm/warm+sweep signals behave, self-healing anything those two
cheaper signals missed (including hard deletes, which neither window nor sweep observes). In
practice, the steady-state path (a 2-hourly cron-triggered Deploy Hook) keeps the site far fresher
than that bound — the worst-case figure exists for the scenario where the Deploy Hook itself stops
firing (a backend outage) and the 7-day cold resync is the only remaining self-heal mechanism.

## Forced-full-rebuild runbook

A forced full rebuild is needed for: the initial backfill, a `LOADER_STATE_VERSION`/manifest
schema bump, a template change invalidating the whole render (a redesign, a font/layout change),
or disaster recovery.

**Procedure (option-a — entirely on Workers Builds, no owner-machine step):**

1. Cloudflare dashboard -> **Workers & Pages** -> `915tldr-v2` -> **Settings** -> **Build** ->
   **Variables** -> add `ARTICLES_FORCE_COLD` = `1`, scoped to the branch about to build (`main`
   for a production forced rebuild).
2. Trigger the build — either push the commit that needs the forced rebuild, or use the `main`
   Deploy Hook directly (no new commit needed for a "re-render everything from current D1 state"
   rebuild).
3. Confirm the build's own `[d1-articles] mode=cold ...` log line, and that it completes and
   deploys within the 20-minute ceiling (`WB_COLD_FITS` gives ~9.2 minutes of margin at the
   current corpus size — re-verify this margin per the "re-measure" note below before relying on
   it against a substantially larger corpus).
4. **Remove the `ARTICLES_FORCE_COLD` build variable immediately after the rebuild completes.**
   Leaving it set forces every subsequent build cold indefinitely — a large, avoidable D1-read and
   build-time cost on every future 2-hourly trigger.
5. A redesign / template change does NOT require any additional step beyond a normal code push —
   the next Workers Builds build (triggered by that push, or by the following ingest cycle's
   Deploy Hook) re-renders every page whose `cacheKey` the change invalidates automatically. No
   `ARTICLES_FORCE_COLD` is needed for a template-only change; it is needed only when the D1 data
   itself must be re-observed in full (schema bump, backfill, recovery).

**Escape hatch (not the documented runbook path):** if Workers Builds itself is unavailable or
misbehaving, `pnpm run ci:local` (equivalent to `build:ci` + `deploy:ci` run locally) or
`wrangler deploy --config wrangler.jsonc` from the owner's machine remain available, exactly as
Phase 3 used them. This is a manual fallback, not part of the automated pipeline this document
describes.

**Re-measure when the corpus grows.** `WB_COLD_FITS` was measured against ~40,000–60,000 pages
(the current corpus). Phase 6 is projected to roughly double the corpus (STATE.md's ~82,000-row
bilingual estimate). Re-run a real forced-cold Workers Builds build after that growth and confirm
the cold build still comfortably clears the 20-minute ceiling before relying on this runbook
unchanged — if it does not, `docs/phase-04/build-pipeline-decision.md`'s "What would reopen this
decision" note applies (option-b or option-c become live alternatives again).

## The footer build stamp (context for future readers of byte-identity tests)

Every page's footer (`src/layouts/Base.astro`) currently prints `BUILD_HASH`
(`src/lib/build-info.ts`'s `resolveBuildHash()`) unconditionally, alongside a stamp-gated date
(`stampDate`, already STABLE for `stamp="commit"` articles per 04-09). `BUILD_HASH` itself is NOT
stamp-gated — it changes on every commit, which defeats Cloudflare's content-hash asset-upload
dedup on any code push (04-10's finding, `docs/phase-04/build-measurements.md`). **Not fixed in
this plan** — the owner decided (2026-09-30, out-of-scope note in
`docs/phase-04/build-pipeline-decision.md`) to keep the commit hash on the homepage footer and
`/version.json` only, showing a stable stamp everywhere else, as a separate follow-up quick fix
before 04-12. This does not affect this plan's own byte-identity regression test
(`tests/regression/byte-identity.test.mjs`): both builds it runs check out the SAME commit
(no push happens mid-test), so `BUILD_HASH` is identical across both snapshots regardless of
where the stamp is shown.

## Cutover dependencies for Phase 12

- **`V1_CHANGELOG_URL`** must be repointed once `915tldr.com2`'s own `/changelog.json` route is
  the source of truth for the split repos (currently defaults to
  `https://915tldr.com/changelog.json`, `src/content/loaders/changelog-loader.ts`) — confirm the
  target URL is still correct once the repo split lands.
- **The backend secret uses the `main` Deploy Hook**, not the `feature/phase-04` spike hook used
  during 04-10's measurement — `FRONTEND_DEPLOY_HOOK_URL` (set via `wrangler secret put` in
  `915tldr.com2`) must be the production (`main`) hook from `docs/phase-04/workers-builds-setup.md`
  step 5, never the non-production spike hook.
- Both of the above are listed for **04-12's end-of-phase check**, not resolved by this plan —
  activation (deploying the backend, setting the secret) waits until `915tldr-frontend`'s `main`
  branch carries Phase 4.

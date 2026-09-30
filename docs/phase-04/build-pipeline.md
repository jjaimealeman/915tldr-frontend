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

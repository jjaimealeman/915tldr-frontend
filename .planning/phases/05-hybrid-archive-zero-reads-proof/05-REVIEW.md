---
phase: 05-hybrid-archive-zero-reads-proof
reviewed: 2026-10-01T21:55:37Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/worker.ts
  - src/lib/archive/archive-route.ts
  - src/lib/archive/hot-window.ts
  - src/lib/archive/tier-facts.ts
  - src/lib/archive/tiering.ts
  - src/lib/article-redirect.ts
  - src/lib/server/r2-client.ts
  - src/pages/[category]/[slug].astro
  - src/pages/tag/[slug].astro
  - wrangler.jsonc
  - tools/archive-sync.mjs
  - tools/ci-build.mjs
  - tools/partition-archive.mjs
  - tools/assert-file-count.mjs
  - tools/lib/run-pool.mjs
  - tools/lib/cf-graphql.mjs
  - tools/derive-hot-window.mjs
  - tools/load-test-zero-reads.mjs
  - tools/measure-worker-kv-cpu.mjs
  - tools/measure-archive-latency.mjs
  - tools/verify-edge-headers.mjs
  - tools/compare-builds.mjs
  - tools/r2-roundtrip.mjs
  - tools/tier-report.mjs
findings:
  critical: 3
  warning: 9
  info: 10
  total: 22
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-01T21:55:37Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

I reviewed the Worker's archive-serving path, the R2 write pipeline (partition, then pre-sync, then deploy, then post-sync), and the Phase 5 measurement tools. I checked them against 05-CONTEXT.md (D-01..D-13) and against evidence recorded under `docs/phase-05/evidence/`.

**What holds up (checked, not assumed):**
- **Zero-D1 invariant.** `node tools/assert-no-d1.mjs` exits 0. The deployed bundle (`.wrangler/ci-dry-run/worker.js`, 8,544 bytes) contains exactly four modules: `article-url.ts`, `article-redirect.ts`, `archive/archive-route.ts` and `worker.ts`. Every `lib/server` match in the Worker-reachable files is a comment. `r2-client.ts` is reached only through dynamic `import()` from `tools/archive-sync.mjs` and `tools/r2-roundtrip.mjs`.
- **Secret hygiene.** No tool logs a credential value or the full env:
  - `r2-client.ts` builds its error text from `name`/`Code`/status only.
  - `cf-graphql.mjs` and `ci-build.mjs` both redact by name and with the 40-plus-character sweep.
  - Every ntfy body goes through `redact()`.
  - No tool prints `process.env`.
- **Key scheme.** `assertArchiveKey` runs before every put, head, get and delete, and its anchored regexes reject traversal. The Worker builds keys only from a manifest-validated uuid or a `TAG_SLUG_RE`-validated slug.
- **Ordering inside one production run is correct:**
  - hot to archive: the upload happens before deploy, and anything that failed is moved back.
  - archive to hot: the delete happens only after a successful `wrangler deploy`.
  - changed content: the old copy keeps serving.

**What does not hold up.** The "no 404 for a reachable archived URL" invariant is enforced only on the single CI path. Three routes break it:
1. The dry-run rehearsal still runs the destructive post-sync.
2. The documented manual `pnpm run deploy` skips the pre-sync entirely.
3. Post-sync decides what to delete from its own local `dist/client`, never from what is actually deployed.

The zero-reads gate also measures its load window over fewer 5-minute buckets than its baseline, which biases it toward PASS. The recorded `ZERO_READS_PROVEN` verdict still holds once this is corrected; the arithmetic is in CR-03.

## Orchestrator Focus Areas

**1. Worker CPU on the archive path (26-49 ms outliers).** I found nothing in the code that plausibly costs tens of milliseconds:
- The whole bundle is 8.5 KB.
- Per request, the archive path does one `new URL()`, one `decodeURIComponent`, two small anchored regexes, and a `JSON.parse` of a 4-field KV value.
- It then builds one `Headers` (3-4 entries), runs a 3-element `formatServerTiming` map/join, makes one `Response`, and calls `Response.clone()`, which tees the native R2 stream.
- `cache.put` runs inside `waitUntil`.

None of this is loop-heavy or data-size-dependent beyond the stream tee, and the tee is a native operation in workerd.

The data pattern points away from code. p50 is 0.76 ms and p99 is 2.85 ms. The same URL took 26 ms on one request and 37 ms on another; if those two were within 300 s at the same colo, the second would have been the cheaper edge-cache-hit path. That pattern is consistent with per-isolate one-time cost (script compile, global and binding setup on a cold isolate), not with the request logic.

I could not confirm this from the code alone. To settle it, correlate each outlier's `cpuTime` in Workers Logs (observability is enabled) with its response `Server-Timing` (`archive;desc=r2` vs `edge-cache`) and with whether it was the isolate's first request. See IN-01 and IN-02. One cheap experiment: `nodejs_compat` is not needed by this bundle, but whether removing it reduces startup cost is unverified.

**2. R2 write safety.**
- **Branch guard.** It is correct where it is applied: it fails closed and throws before any request. It covers only stores wrapped inside `archive-sync.mjs`; `createArchiveStore` itself is unguarded (WR-05).
- **Key scheme.** Enforced, as described above.
- **Orphan deletion.** Index entries are dropped only for confirmed deletes. Two exceptions: a mid-run throw can leave the index claiming objects that no longer exist (WR-02), and deletion is not gated on what is actually deployed (CR-01, WR-01).
- **Deadline.** Not a hard bound, because there is no per-request timeout (WR-04). The force-full path does not keep its progress between runs (WR-03).
- **404 during a sync.** Possible via CR-01, CR-02, WR-01 and WR-02. The KV-outage path also returns a 404 where the R2-outage path returns a 503 (WR-06).

**3. Secret hygiene.** Clean. No findings.

**4. Zero-D1 invariant.** Verified clean, as described above.

## Critical Issues

### CR-01: Dry-run "rehearsal" deploys still run the destructive post-sync against the production bucket

**File:** `tools/ci-build.mjs:506-522` (and `tools/archive-sync.mjs:545-576`)

**Issue:** With `CI_BUILD_DEPLOY_DRY_RUN=1`, `wrangler deploy --dry-run` ships nothing. Only `commitImpl` is skipped, though: `archive-sync post` is still spawned at line 522, unconditionally.

Post-sync then does two things against the production bucket:
- It re-uploads "changed" archive pages from a build that was never deployed.
- It deletes, without any cap (line 550: "promoted orphans delete freely"), the R2 copy of every indexed page that happens to exist in this undeployed build's `dist/client`. It also removes those keys from the index.

Production is still serving the previous deployment, in which those pages are not static. Every such URL therefore goes Worker, then KV canonical, then R2 miss, then a 404 page ("archived article missing from R2"). This lasts until the next real deploy.

The trigger is easy to hit. A local rehearsal counts as "production" (no `WORKERS_CI`), R2 credentials are loaded the documented way (`set -a; . ./.dev.vars`), and `.wrangler/ci-dry-run/` exists in this tree, so the dry-run path has been used. A rehearsal with a candidate hot window of more days would delete thousands of objects. For example, re-deriving from 202 to the uncapped 234 days moves roughly 30 days of articles into the "promoted" set.

**Fix:** Never run post-sync after a dry run. Also make post-sync refuse to delete unless the live deployment is this build:

```js
// tools/ci-build.mjs
if (dryRun) {
  log('[ci-build] dry run: skipping archive-sync post (it mutates the production bucket)');
  return 0; // after sending pendingAlerts
}
await commitImpl({ buildHash: ... });
const postResult = await spawnImpl('node', ['tools/archive-sync.mjs', 'post', '--json'], { env });
```

```js
// tools/archive-sync.mjs runPostSync, before computing toDelete:
const live = await fetch(`https://dev.915tldr.com/version.json`).then((r) => r.json());
if (live.commit !== localVersion.commit || live.builtAt !== localVersion.builtAt) {
  alerts.push('archive-sync: live deployment is not this build — skipping all deletions');
  promotedKeys = []; vanishedKeys = [];
}
```

### CR-02: `pnpm run build` followed by the documented `pnpm run deploy` ships archived pages with no R2 upload

**File:** `tools/partition-archive.mjs:116-141` (with `package.json:46,49`; `wrangler.jsonc:23-28` directs operators to the `deploy` script)

**Issue:** `pnpm run build` now always runs `partition-archive.mjs`, which moves every archive-tier page out of `dist/client`. Only `archive-sync pre` (inside `ci-build.mjs deploy`) uploads the pages that are new to the archive and moves failures back. The plain `deploy` script (`guard:config && wrangler deploy --config wrangler.jsonc`) skips that step.

As a result, every page newly crossing the hot cutoff since the last CI sync (about 90 articles per day at the current ingest rate) is deployed as neither static nor in R2, and returns 404. So does every tag that fell below 10 articles. This lasts until the next CI build's pre-sync. Nothing in `check-config-guards.mjs` or the `deploy` script detects that `dist/` was partitioned but not synced.

**Fix:** Make the partitioned output undeployable until pre-sync has confirmed it. Either point `deploy` at the wrapper, or have pre-sync write a marker that a guard checks:

```json
"deploy": "node tools/ci-build.mjs deploy"
```

or

```js
// archive-sync pre, on success: writeFileSync('dist/.archive-synced', plan.generatedAt)
// new guard run by "deploy" before wrangler:
if (existsSync('dist/archive-plan.json') &&
    readFileSync('dist/.archive-synced','utf8') !== JSON.parse(readFileSync('dist/archive-plan.json')).generatedAt) {
  throw new Error('deploy-guard: dist/ was partitioned but archive-sync pre has not run — refusing to deploy');
}
```

### CR-03: The zero-reads gate measures its load window over fewer D1 buckets than its baseline windows (biased toward PASS)

**File:** `tools/load-test-zero-reads.mjs:873-881` (query at `154-160`, alignment at `84-86`)

**Issue:** The two sides of the comparison cover different spans:
- `comparableWindows` aligns the 7 baseline windows outward to 5-minute boundaries (floor the start, ceil the end).
- The load window is passed raw (`{ start: windowStart.toISOString(), end: windowEnd.toISOString() }`) into a query filtered on `datetimeFiveMinutes_geq: start, datetimeFiveMinutes_lt: end`. Because `datetimeFiveMinutes` is a bucket start, the bucket containing the window's start is always excluded.

So the load window systematically covers 1-2 fewer buckets than every baseline window. In the recorded run (`docs/phase-05/evidence/gate-20261001T203348Z/`), the load window 20:34:05 to 21:16:29 sums 9 buckets (20:35 to 21:15), while each baseline sums 10 (20:30 to 21:20). That is about a 10% undercount on the measured side. For a shorter pass, such as the default 3,000 requests at 10 rps (about 5 minutes), the load window covers 1 bucket against the baseline's 2-3. That is a 50-67% bias toward PASS.

This contradicts the function's own claim that "nothing here can turn an unreliable measurement into a PASS". The recorded verdict survives correction: 1,684,090 × 10/9 ≈ 1.87M, which is still below the lowest baseline window (2,399,162) and far below the 3σ threshold (9,913,212).

**Fix:**

```js
const alignedLoad = {
  start: floorToFiveMinutes(windowStart).toISOString(),
  end: ceilToFiveMinutes(windowEnd).toISOString(),
};
const loadRowsRead = analyticsNotCaughtUp ? null : await fetchD1RowsRead(alignedLoad, resolvedDeps);
const baselineWindows = comparableWindows(alignedLoad, 7);
// and wait for analytics catch-up against alignedLoad.end, not windowEnd
```

Add a unit test asserting that the load window and each baseline window have identical `end - start`.

## Warnings

### WR-01: Post-sync deletes "promoted" R2 copies based on its own `dist/client`, not on what is deployed (overlapping or out-of-order builds produce 404s)

**File:** `tools/archive-sync.mjs:518-521, 545-562`

**Issue:** `pathExists` checks this build's local `dist/client`. It does not check the deployment that is live when the delete runs. The code itself treats concurrent builds as possible (the `mergeWriteIndex` comment refers to "a concurrent build's own write").

Here is how it goes wrong:
1. Build A starts just before a UTC day boundary, so article K is still hot in A.
2. Build B starts after the boundary. Its pre-sync uploads K and adds it to the index, and B deploys with K absent from static.
3. A's post then runs. K is in the fresh index, missing from A's plan, and present in A's `dist/client`, so A classifies K as a promoted orphan.
4. A deletes K from R2 and removes it from the index.

Production (B) now 404s on K until the next build's pre-sync re-uploads it as "new". The same applies to a local `ci:local` run overlapping a CI build.

**Fix:** Gate all deletions on the live `/version.json` matching this build (same fix as CR-01). Better still, record in the index the build commit that last confirmed each key archived, and only delete a key whose recorded commit is older than the live commit.

### WR-02: Uncaught R2 failures in post-sync can leave the index claiming objects that were deleted, which later becomes a 404

**File:** `tools/archive-sync.mjs:562, 575, 600, 634`; `src/lib/server/r2-client.ts:239-258`; `tools/archive-sync.mjs:740-742`

**Issue:** Several R2 calls in `runPostSync` sit outside any try/catch: `store.deleteObjects` (562), `mergeWriteIndex` (575), and the two `putJson` calls (600, 634). `main()` is called without a `.catch`. Two consequences:
- **Delete succeeds, index write fails.** If `deleteObjects` succeeds but `mergeWriteIndex` then throws (a transient R2 5xx), the index still lists keys whose objects are gone. If such a key later re-enters the archive tier, `diffAgainstIndex` classifies it as `unchanged` or `changed`, not `new`. Pre-sync does not upload it, the deploy removes it from static, and the Worker 404s on it. If the content is unchanged, that 404 is permanent.
- **Multi-batch delete fails part-way.** `deleteObjects` in `r2-client.ts` throws away the count of keys already deleted by earlier batches when a later batch fails (lines 255-257). The index then keeps entries for objects that batch 1 really deleted.

Pre-sync has the same pattern: `mergeWriteIndex` at line 400 is uncaught, so an index-write failure exits non-zero and blocks the deploy. That contradicts the docstring at 292-294 ("Exits 1 ONLY when the plan is missing").

**Fix:**
- Make the index self-healing: in pre-sync, treat any non-`new` key whose `headObject` returns null as `new`. That costs one HEAD per archived key, or a `listKeys('articles/')` / `listKeys('tags/')` diff once per run.
- Wrap each post-sync R2 call so a failure becomes an alert.
- Have `deleteObjects` return partial results instead of throwing mid-loop:

```js
} catch (err) {
  for (const key of batch) errors.push({ key, code: describeError(err) });
}
```

### WR-03: Force-full re-upload restarts from zero every run, so it can fail to converge on slow builds

**File:** `tools/archive-sync.mjs:214, 516, 616-622`

**Issue:** When the marker is set, every indexed key counts as `changed` on every run, regardless of whether an earlier run already re-uploaded it. A deadline-truncated run therefore re-uploads the same plan-order prefix next time. The marker is cleared only once a single run finishes everything.

Measured in `docs/phase-05/evidence/forced-full-reupload/`: the post phase took about 558 s for 30,501 objects. That build was warm (`astro build` about 105 s), so the 1,020 s deadline left about 335 s of headroom. A cold build (649 s per `docs/phase-04/build-measurements.md`) starts post-sync at about 670 s, leaving about 350 s against roughly 558 s of work. While builds stay slow the run never completes, and the backlog alert fires indefinitely.

There is a second problem. Under force-full, an entry whose upload failed has a sha equal to its index entry. Once the marker is cleared, that entry is `unchanged` and is never retried.

**Fix:** Record progress against the marker. Treat a key as forced only if it was uploaded before the marker was requested:

```js
} else if ((forceFullSince && Date.parse(existing.uploadedAt ?? 0) < forceFullSince) || existing.sha256 !== entry.sha256) {
  changedKeys.push(entry);
}
```

Keep the marker until no index entry predates `requestedAt`.

### WR-04: The upload deadline is not a bound, because the S3 client has no request timeout

**File:** `src/lib/server/r2-client.ts:157-166`; `tools/lib/run-pool.mjs:57-68`

**Issue:** `runPool` stops claiming new items at the deadline but waits for in-flight items. `new S3Client({...})` configures no `requestHandler` timeouts, and the SDK retries up to 3 times by default. A stalled connection can therefore hold pre-sync (840 s deadline) or post-sync (1,020 s) past Workers Builds' 20-minute ceiling.
- In pre-sync, that kills the build before deploy. This is safe, but the deploy is lost.
- In post-sync, it kills the job after deploy, with no RESULT line and no index write.

**Fix:**

```ts
import { NodeHttpHandler } from '@smithy/node-http-handler';
new S3Client({ ..., maxAttempts: 2,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 5_000, requestTimeout: 30_000 }) });
```

Optionally, also race each worker against `deadlineAt + grace` inside `runPool`.

### WR-05: The non-main branch guard is not in the chokepoint module, so `createArchiveStore` callers can bypass it

**File:** `tools/archive-sync.mjs:82-87`; `src/lib/server/r2-client.ts:153-166`; `tools/r2-roundtrip.mjs:28,42,64`

**Issue:** The header comment says the guard is placed so that "a future caller that reaches for the store directly still can't bypass it". That holds only for callers inside `archive-sync.mjs` that remember to call `wrapStoreForBranchGuard`. `createArchiveStore()` in `r2-client.ts` performs puts and deletes with no guard. `tools/r2-roundtrip.mjs` already writes and deletes through it directly, as would any new tool that imports the module.

**Fix:** Enforce the guard in `createArchiveStore`, on `putObject` and `deleteObjects`, using the same predicate (export it from a shared module):

```ts
function assertWritesAllowed(env: EnvLike) {
  const ci = env.WORKERS_CI;
  if (ci && ci !== '0' && ci !== 'false' && env.WORKERS_CI_BRANCH !== 'main') {
    throw new Error(`r2-client: refusing R2 write — WORKERS_CI_BRANCH is ${JSON.stringify(env.WORKERS_CI_BRANCH ?? null)}, not "main"`);
  }
}
```

### WR-06: A KV read failure on an archived article URL serves a 404, while an R2 failure serves a 503

**File:** `src/worker.ts:235-241`

**Issue:** T-05-10's rationale ("an R2 outage on an archived page answers 503 ... so crawlers never drop the page as a 404") applies equally to the KV read that comes before it. When `RENDER_MANIFEST.get` throws, the Worker returns `env.ASSETS.fetch(request)`, which is the 404 page. Every archived article (about 12,900 today) therefore returns 404 during a KV incident.

At this point the request has already missed the static layer and carries a uuid, so a 503 is the safe answer.

**Fix:**

```ts
} catch (err) {
  console.error(...);
  return new Response(null, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
}
```

### WR-07: `cache.match()` is unguarded, so a Cache API failure becomes an uncaught exception on archive paths

**File:** `src/worker.ts:208-211, 223-226`

**Issue:** Both `await cache.match(cacheKey)` calls run outside any try/catch. A rejection from the Cache API surfaces as a Worker exception (1101/500) on every archived tag and archived article request. The code is meant to degrade to direct R2 serving instead.

**Fix:**

```ts
let cached: Response | undefined;
try { cached = await cache.match(cacheKey); } catch { cached = undefined; }
if (cached) return fromCacheHit(cached);
```

Also attach `.catch(() => {})` to the `cache.put` promise passed to `waitUntil`.

### WR-08: `derive-hot-window` cannot run against a partitioned build, which blocks D-07b's re-derivation

**File:** `tools/derive-hot-window.mjs:674-680` (used at `800-808`, validated at `360-362`)

**Issue:** `countOtherFiles` computes `walk(dist/client) - all article facts - all tag facts`. After `pnpm run build`, the archived pages (12,912 articles and 17,591 tags) are no longer in `dist/client`. Measured on the current tree, `countOtherFiles()` returns **-30,466**, so `deriveHotWindow` throws "requires a non-negative integer deps.otherFiles".

D-07b point 2 says the cutoff is re-derived by re-running this tool. That now fails after every normal build. A partially moved-back build is worse: it silently produces a too-small `otherFiles`, so the cap projection allows a larger window than the budget really permits.

**Fix:** Subtract only the hot pages that are actually present, or count both trees:

```js
const total = (await walkFileCount(distDir)) + (await walkFileCount('dist/archive'));
return total - facts.articles.length - facts.tags.length;
```

### WR-09: The gate's preflight and pass do not verify the archived URLs actually measured

**File:** `tools/load-test-zero-reads.mjs:819-824, 656-665, 516-556`

**Issue:** There are three gaps:
- **Preflight checks the wrong URLs.** It checks `hotArticlePaths.slice(0, 20)` and `archivedArticlePaths.slice(0, 20)`, the first 20 of each list. The mix uses `seededSample(...)` of those lists, a different set, so the URLs that are measured are never preflighted. Archived tag paths are not preflighted at all.
- **The pass ignores status codes.** `runPass` counts any response as `completed`. A pass in which every archived URL 404s, or is served statically, would still produce PASS. This contradicts D-03's requirement that the archive path be inside the measured pass. The recorded run is unaffected: 20,000 responses, all 200, 8,450 carrying `archive`.
- **A D1 binding can be masked.** `hasD1Binding` is evaluated after the validity rules, so a structural FAIL is reported as INCONCLUSIVE whenever any validity rule trips. The doc comment says leg 1b "fails the gate regardless".

**Fix:**
- Preflight exactly the `mix` entries drawn from the archived article, archived tag and hot sets.
- In `decideZeroReadsVerdict`, treat any non-2xx response, or any archived path response missing `archive;`, as INCONCLUSIVE.
- Move the `hasD1Binding` check above the validity rules.

## Info

### IN-01: Archive-path CPU outliers have no code-level cause; correlate them before acting

**File:** `src/worker.ts:103-168, 181-273`

**Issue:** See Focus Area 1. Everything on the request path is constant-size work. The data pattern (p50 0.76 ms; outliers on repeated URLs) is consistent with cold-isolate cost, but I have not verified that.

**Fix:** Pull Workers Logs for the outlier invocations. Compare `cpuTime` against the response's `Server-Timing` `desc` and against whether it was the isolate's first request, before changing any code.

### IN-02: `nodejs_compat` is enabled but nothing in the Worker's import graph uses Node APIs

**File:** `wrangler.jsonc:38`

**Issue:** The bundle has zero `node:` imports and does not reference `process` or `Buffer`. The flag may add per-isolate global setup. Its effect on the measured startup CPU is unverified.

**Fix:** Try removing it in a preview version and compare `cpuTimeP99` and `max`.

### IN-03: Every miss on an archive-shaped tag path costs an uncached R2 read

**File:** `src/worker.ts:198-213, 133-139`

**Issue:** Any `/tag/<valid-slug>` request that misses the static layer does a `cache.match` and then an R2 `get`. Misses are never cached, so bot scans of nonexistent tags generate Class B operations without bound. The cost is small per million, but it is unbounded.

**Fix:** Cache 404s for tag paths briefly: `cache.put` a 404 with `max-age=300`.

### IN-04: `/static-budget.json` publishes the full hot-window record

**File:** `tools/assert-file-count.mjs:122-132, 174-176`

**Issue:** The public file embeds all of `hot-window.json`: `topArticles` traffic counts, per-day eyeball and human totals, and the exact bot-filter description. This may be intended under "built in the open"; flagging it so the choice is deliberate.

**Fix:** Publish only `{status, days, derivedAt, achievedCoverage}`.

### IN-05: Uuid case normalization is inconsistent across partition, R2 client and Worker

**File:** `tools/partition-archive.mjs:83`; `src/lib/server/r2-client.ts:64-65`; `src/lib/archive/archive-route.ts:34`

**Issue:** Each layer treats case differently:
- Partition builds `articles/${fact.uuid}.html` from a fact validated by the case-insensitive `UUID_RE`.
- `r2-client` accepts lowercase keys only.
- The Worker lowercases.

An uppercase uuid would fail upload on every build and stay static forever, silently. There are zero such uuids today (checked `.astro/tier-facts-articles.json`).

**Fix:** Lowercase `fact.uuid` in `planPartition`.

### IN-06: A standalone `deploy` step reuses a stale build-start marker

**File:** `tools/archive-sync.mjs:89-97`; `tools/ci-build.mjs:409-413`

**Issue:** `markBuildStart` runs only for `build`/`all`. A later `ci-build deploy` (local, or a re-run) measures its deadlines from an old `.astro/ci-build-started-at`. Both deadlines are then already past: pre-sync moves every new page back, and post-sync defers every change, which raises false backlog alerts. `partition-archive --clean` does not remove the marker.

**Fix:** Have `--clean` delete the marker, or have the deploy step reject a marker older than, for example, 30 minutes.

### IN-07: `verify-edge-headers` check 5 does not prove the response came from the Worker or R2, and a SKIP exits 0

**File:** `tools/verify-edge-headers.mjs:312, 332`

**Issue:** The check asserts only status 200 plus `noindex`. A stale local plan whose sampled article is now hot would pass via the static layer. A missing plan reports SKIP and still exits 0.

**Fix:** Also assert `server-timing` contains `archive;`.

### IN-08: `measure-archive-latency` hardcodes sample offsets

**File:** `tools/measure-archive-latency.mjs:254-255, 365`

**Issue:** The `< 200` cold-sample check ignores `--r2-sample-size`. The LCP sample offset `.slice(220)` overlaps the R2 sample once `--r2-sample-size` exceeds 210, and the LCP pages would then be measured from edge cache.

**Fix:** Derive both from `args.r2SampleSize`.

### IN-09: A non-integer `ARCHIVE_SYNC_CONCURRENCY` aborts the deploy

**File:** `tools/archive-sync.mjs:381, 523`; `tools/lib/run-pool.mjs:42-44`

**Issue:** `Number('2.5') > 0` passes the guard, then `runPool` throws. In pre-sync that becomes an uncaught rejection and blocks the deploy.

**Fix:** Use `Number.isInteger(n) && n > 0 ? n : ARCHIVE_SYNC_CONCURRENCY`.

### IN-10: Some comments point the wrong way or state guarantees the code does not provide

**File:** `wrangler.jsonc:105`; `src/worker.ts:33`; `tools/archive-sync.mjs:292-294`

**Issue:**
- `wrangler.jsonc` says D1's absence is documented "below"; it is at line 82, above.
- `worker.ts` says "same reasoning as `Env` above"; `Env` is at line 61, below.
- The `runPreSync` docstring claims exit 1 only when the plan is missing; see WR-02.

**Fix:** Correct the comments.

---

_Reviewed: 2026-10-01T21:55:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

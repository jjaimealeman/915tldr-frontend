# Archive Architecture — R2 Key Scheme, Worker Routing, Sync Sequence, and the REND-12 Ceiling

Produced by 05-07-PLAN.md. Records how the archive tier actually ships: the R2 key scheme (05-03),
the Worker's read-only serving branch (05-03), and `tools/archive-sync.mjs`'s pre/post write
phases (05-07, this plan). 05-08 wires the sync tool into the real deploy step
(`tools/ci-build.mjs`); 05-09/05-10 run it against production and fill in the Measurements section
below.

## R2 key scheme, and why keys are derived, not stored in the manifest

Four key shapes, enforced at the chokepoint (`src/lib/server/r2-client.ts`'s `assertArchiveKey` —
every write throws before a request is built if a key doesn't match):

| Shape | Regex | Example |
|---|---|---|
| Article | `^articles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$` | `articles/0000e250-e1d1-431c-b2dc-bad7dc7404ce.html` |
| Tag | `^tags/[a-z0-9-]+\.html$` | `tags/el-paso.html` |
| Bookkeeping | `^_meta/[a-z0-9-]+\.json$` | `_meta/archive-index.json` |
| Probe (05-02) | `^_probe/[a-z0-9-]+\.txt$` | `_probe/roundtrip-....txt` |

**Keys are derived fresh from the validated articleId/slug on every Worker request
(`articleArchiveKey(uuid)` / `tagArchiveKey(slug)` in `src/lib/archive/archive-route.ts`), never
stored in a render-manifest field.** 05-RESEARCH.md's Pattern 1 originally proposed a manifest-v3
field (`r2Key`) bumped alongside `tier`. 05-03-PLAN.md overrode that proposal deliberately:

- The Worker already holds a validated `articleId` after its one `RENDER_MANIFEST` KV read
  (ARCH-08's existing budget) — deriving the key from that id costs nothing extra and needs no
  second field to keep in sync with the manifest.
- **Race-free across both transition directions.** If the key were stored in the manifest, a
  page moving hot→archive or archive→hot would need the manifest write and the R2
  upload/deletion to agree on which tier is current — two independent writes that could observe
  each other out of order. Deriving the key fresh means there is nothing to desynchronize: the
  manifest only ever needs to say "this uuid resolves to this canonical path," which it already
  said before this phase existed.
- Avoids a schema bump (`MANIFEST_SCHEMA_VERSION` stays whatever 04/03 already set it to) for a
  field that adds no information the uuid/slug didn't already carry.

## Worker routing on a static-asset miss

`src/worker.ts` (unchanged shape since 05-03, this plan writes nothing new into it — the sync tool
is entirely a build-time writer, never a runtime caller):

```
request
  │
  ├─ method ∉ {GET, HEAD} ─────────────────────────────────────────► ASSETS.fetch (0 KV, 0 R2)
  │
  ├─ tag-shaped path (matchTagPath) ─── BEFORE uuid extraction, so a tag path NEVER touches KV
  │     ├─ has a redirect suffix (`/`, `.html`) ───────────────────► 307 to the bare canonical path
  │     ├─ edge cache hit ─────────────────────────────────────────► cached response (0 KV, 0 R2)
  │     └─ cache miss ─► ARCHIVE_BUCKET.get/head(tags/<slug>.html)
  │           ├─ found ────────────────────────────────────────────► 200, static-parity headers, cache.put
  │           ├─ missing ──────────────────────────────────────────► ASSETS.fetch (the normal 404 page; silent — "not archived" is the common case for a tag)
  │           └─ R2 throws ────────────────────────────────────────► 503 + Retry-After: 60 + Cache-Control: no-store
  │
  └─ extractArticleUuid(path) finds a uuid
        ├─ edge cache hit ───────────────────────────────────────────► cached response (0 KV, 0 R2)
        ├─ cache miss ─► RENDER_MANIFEST.get(`manifest:${uuid}`)  ← the ONE KV read, ARCH-08's ceiling
        │     ├─ KV throws ──────────────────────────────────────────► ASSETS.fetch
        │     ├─ not-found/invalid entry ────────────────────────────► ASSETS.fetch (the 404 page)
        │     ├─ non-canonical path ─────────────────────────────────► 301 to the canonical path
        │     └─ canonical path ─► ARCHIVE_BUCKET.get/head(articles/<uuid>.html)
        │           ├─ found ─────────────────────────────────────────► 200, static-parity headers, cache.put
        │           ├─ missing ───────────────────────────────────────► ASSETS.fetch + console.error (sync-bug signal — the manifest said this exists)
        │           └─ R2 throws ─────────────────────────────────────► 503 + Retry-After: 60 + Cache-Control: no-store
```

**Header parity (measured live against `dev.915tldr.com`, 05-03 Task 2):** an archived 200 carries
`Content-Type: text/html` (no charset parameter — the live static layer sends none either) and
`Cache-Control: public, max-age=0, must-revalidate`, plus an `ETag` sourced from the R2 object. A
browser or crawler cannot distinguish an archived response from a static one by headers alone.

**Server-Timing contract:** every served response (hot or archived) carries a `Server-Timing`
header built by `formatServerTiming()`. An archived article's header includes both `kv;dur=<ms>`
(the manifest read) and `r2;dur=<ms>` (the object read), plus `archive;desc=r2` naming the source;
an archived tag's header has `r2;dur` and `archive;desc=r2` but no `kv;dur` (the tag branch never
reads KV); a cache hit of either shape reports only `archive;desc=edge-cache` — no per-read timing,
because no read happened.

**Edge cache (05-03 Task 3):** only R2-sourced 200s for a canonical path are ever cached (never a
301, 404, or 503), keyed on `origin + pathname` with the query string and headers excluded (every
query-string variant of one archived path shares one cache entry). The stored copy's
`Cache-Control` is rewritten to `public, max-age=300`; the client always sees the static-parity
header regardless of whether the response came from R2 or the cache.

## The build sequence

```
BUILD step (tools/ci-build.mjs, 05-08's wiring — this plan's own tracer ran the equivalent by hand)
  1. write .astro/ci-build-started-at (epoch seconds) — both archive-sync deadlines measure from here
  2. node tools/partition-archive.mjs --clean   — deletes stale tier-facts/dist/archive/plan
  3. astro build                                 — renders every page (hot AND archive-tier) into dist/client
  4. node tools/partition-archive.mjs             — moves archive-tier pages OUT of dist/client into dist/archive,
                                                      writes dist/archive-plan.json
  5. node tools/assert-file-count.mjs             — fails the build at 80,000 dist/client files (D-13)

DEPLOY step (tools/ci-build.mjs's deploy path, 05-08's wiring)
  6. node tools/archive-sync.mjs pre              — uploads NEW-to-archive pages; anything that fails,
                                                      times out, or sits beyond --limit is moved BACK into
                                                      dist/client (file-count re-check after this, per 05-08)
  7. node tools/assert-file-count.mjs (re-check)   — the move-back in step 6 can only ever LOWER the count
                                                      further from the build step's own number, never raise it
  8. wrangler deploy                               — ships dist/client (every page confirmed static OR confirmed in R2)
  9. commitLastGood                                — only after a REAL, successful deploy (04-09's existing guarantee)
 10. node tools/archive-sync.mjs post             — re-uploads CHANGED archived pages, deletes orphans,
                                                      tracks backlog, reports once/day; never alters the
                                                      deploy's own exit code (D-10/D-12)
```

**Step 10's own gate (CR-01/WR-01, 05-14):** before `post` does anything else, it refuses in two
ways. First, a dry run (`CI_BUILD_DEPLOY_DRY_RUN` set) is refused outright — zero network calls,
zero R2 calls — independent of 05-13's ci-build-side guard, so a direct
`CI_BUILD_DEPLOY_DRY_RUN=1 node tools/archive-sync.mjs post` invocation is refused too, not just
the ci-build-orchestrated path. Second, once past the dry-run check and the existing
credentials/branch-guard check, `post` requires the live deployment's own `/version.json`
(`commit` AND `builtAt` — `builtAt` differs between a local build and the deployed build of the
same commit, so `commit` alone would under-detect) to exactly match this build's own
`dist/client/version.json`, polling up to 6 attempts 10 seconds apart to absorb post-deploy
propagation delay. Only once that gate passes does `post` touch R2 at all. Immediately before the
delete step specifically, it re-checks liveness one more time (a single attempt) — if a deploy
landed during the upload phase above, the delete is skipped entirely (not partial) and every
orphan's index entry is kept, while this run's own uploads/index-adds from earlier in the same run
still stand.

### The two invariants this sequence exists to hold

1. **A page leaves `dist/client` (the static tier) only after its R2 PUT is confirmed.** Step 4
   (partition) moves every archive-tier page out of `dist/client` unconditionally; step 6 (pre)
   immediately moves back anything it could NOT confirm in R2 — a failed upload, a deadline
   cutoff, or a page beyond `--limit`. By the time step 8 (`wrangler deploy`) runs, every page in
   `dist/client` is either genuinely hot, or archive-tier-but-unconfirmed-so-served-static-this-
   cycle. There is no window where a page is neither static nor in R2 (REND-08's no-404-window
   guarantee).
2. **An R2 copy is removed only after the static page replacing it is already live.** Step 10
   (post) runs AFTER `wrangler deploy` (step 8) and `commitLastGood` (step 9) — a "promoted
   orphan" (a page that moved hot this cycle) is only deleted from R2 once the deploy that made it
   static has already shipped. The reverse direction (archive→hot) is exactly how step 6 behaves:
   a page never leaves static before R2 confirms it archived.

Both invariants hold even when `WORKERS_CI`/branch-guard disables archive-sync entirely (see
"Failure modes" below) — a disabled run degrades to "ship fully static, like Phase 4," never to a
half-migrated state.

## Index / state / marker / daily-report object formats

All four live under `_meta/` — a prefix the deployed Worker can never read (`ARCHIVE_META_KEY_RE`
is not one of the two prefixes `src/worker.ts`'s read path recognizes; only build-time code with
the write credential ever touches `_meta/*`).

```jsonc
// _meta/archive-index.json — read once, merge-written once per sync phase run
{
  "version": 1,
  "updatedAt": "2026-10-01T07:20:00.000Z",
  "entries": {
    "articles/<uuid>.html": { "sha256": "...", "bytes": 12980, "path": "/business/...-<uuid>", "uploadedAt": "..." },
    "tags/<slug>.html":     { "sha256": "...", "bytes": 9112,  "path": "/tag/<slug>",            "uploadedAt": "..." }
  }
}

// _meta/archive-state.json — backlog bookkeeping (D-10)
{ "backlogCount": 0, "backlogSince": null, "lastConvergedAt": "2026-10-01T06:00:00.000Z", "updatedAt": "..." }

// _meta/force-full.json — present means "treat every indexed plan key as changed"; written by
// requestFullReupload({reason}), cleared by post only once a run ends with zero backlog
{ "requestedAt": "2026-10-01T05:00:00.000Z", "reason": "template change — redesign ship" }

// _meta/daily-report.json — one field, the last America/Denver calendar date a report fired
{ "lastReportDate": "2026-10-01" }
```

**Merge-on-write discipline:** the index is read once at the start of a sync phase and
merge-written once at the end — `mergeWriteIndex()` re-reads the index immediately before writing
and applies ONLY this run's own additions/removals, so a concurrent build's own write in between
is never clobbered. The accepted cost of a race: at worst, a page both builds happened to upload
gets re-uploaded again on a later cycle (harmless — content is byte-identical if nothing else
changed) — never a lost/corrupted index.

## Deadlines and the backlog/alert rule

| Constant | Value | Measured from |
|---|---|---|
| `PRE_DEADLINE_SECONDS` | 840 (14 min) | `.astro/ci-build-started-at`, or this process's own start if that file is absent (the documented weaker local-run behavior) |
| `POST_DEADLINE_SECONDS` | 1020 (17 min) | same |
| `BACKLOG_ALERT_HOURS` | 20 | `archive-state.json`'s `backlogSince` |
| Platform watchdog warning | 18 min (`tools/ci-build.mjs`'s `DEFAULT_WATCHDOG_MS`) | — |
| Platform hard ceiling | 20 min (Workers Builds) | `developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing` |

Both deadlines sit inside the 20-minute hard ceiling with margin for the rest of the build (`astro
build`, partition, file-count gate, `wrangler deploy` itself) to also fit in the same window —
they are not "840/1020 seconds of archive work plus however long everything else takes."

**The backlog rule (D-10):** when `post`'s deadline is reached mid-run, every still-`changed` key
that never got a chance to start lands in `notStarted` → reported as `deferred`. `archive-
state.json`'s `backlogCount` is set to that count; `backlogSince` is set to now **only if there
wasn't already a backlog** (an existing `backlogSince` survives — the clock for "how long has this
been stuck" starts at the FIRST deferral, not the latest one). The next run tries the same changed
keys again (nothing is lost — they stay `changed` in the index diff until they actually upload). A
run that clears the backlog (`deferred === 0`) sets `backlogCount: 0`, `backlogSince: null`, and
stamps `lastConvergedAt`. If `backlogSince` is ever older than `BACKLOG_ALERT_HOURS` (20h), an
alert fires every run until the backlog clears — this is the mechanism that would have caught
D-10's "within 24 hours" promise being missed, the same "measure it or it drifts" discipline
PROJECT.md's own Context section names as the root cause of the v1 D1-reads incident.

## Decision → mechanism table

| Decision | Mechanism |
|---|---|
| **D-09** — archived tag pages touched by newly ingested articles update the same cycle | `post`'s `diffAgainstIndex` classifies any plan key whose sha256 changed as `changed`; a touched tag page's rendered HTML (and therefore its sha256) changes whenever its member-article list changes, so it's re-uploaded automatically — no separate "which tags were touched" tracking needed |
| **D-10** — redesign/template change re-renders the archive in the background within 24h, never blocking a deploy | `requestFullReupload({reason})` writes the force-full marker; `post`'s `diffAgainstIndex(forceFull=true)` treats every already-indexed plan key as `changed`, bounded by `POST_DEADLINE_SECONDS` per run with backlog carry-forward across runs; `pre`/`post` never return a non-zero exit for this reason, so the deploy itself is never blocked |
| **D-11** — a content change to an archived article re-renders just that article the same cycle | Same `changed`-key mechanism as D-09 — the article's own sha256 differs once its content changes, independent of any tag |
| **D-12** — a partial R2 write failure keeps the old copy and alerts | A failed `putObject` in either phase is never written to the index — the previous R2 object (whatever the index still names) keeps serving; `failed.length > 0` adds one alert naming the count; one bad page never stops the others (`runPool`'s per-item isolation) |
| **D-13** (deletion-side extension) — mass deletion is capped | Vanished-orphan deletion is capped at `max(50, 1% of the index)` per run; above the cap, NONE are deleted this run (not a partial delete) and an alert fires naming the count and the cap |

## Failure-mode table

| Failure | What serves | What's recorded |
|---|---|---|
| R2 credentials missing (`hasR2Credentials()` false) | Every planned page served fully static, like Phase 4 — `pre` moves every plan entry back into `dist/client` before `wrangler deploy` runs | `disabled: true`, one alert naming the reason; `post` also reports `disabled: true` and does nothing |
| Non-`main` CI branch with `WORKERS_CI` set, even WITH valid credentials (the leaked-secret scenario this guard exists for) | Same as missing credentials — the branch guard is checked FIRST, before credentials, and short-circuits identically | `disabled: true`, alert names the branch guard explicitly; the underlying store is never even constructed |
| `_meta/archive-index.json` unreadable (R2 outage, malformed JSON) | `pre`: every planned page moves back to static, same as disabled. `post`: aborts before touching anything — no upload, no delete, no state write, so a transient read failure can never cause a wrong write | One alert naming "archive index unreadable"; exit code 0 either way |
| Partial upload failure (some keys) | The failed keys' PREVIOUS state keeps serving (old R2 object for `changed`, or static for `new`/`pre`); everything else in the same run still succeeds | `failed` count in the result; one alert naming the count; the index is never touched for a failed key |
| Deadline hit mid-run | `pre`: untouched new keys moved back to static (never left static in the first place). `post`: untouched changed keys keep their OLD R2 object serving, tracked as backlog | `movedBack`/`deferred` counts; `post` additionally updates `archive-state.json`'s backlog fields |
| Concurrent builds (two builds racing the same cycle) | Both builds' own writes land; the merge-on-write index read happens right before each write, so neither build's upload is lost — at worst, a page both builds happened to touch gets uploaded twice (harmless, same bytes either way) | No special alert — this is the accepted, documented race in "Merge-on-write discipline" above |
| Run interrupted entirely (process killed, container recycled) mid-phase | Whatever had already been confirmed via a successful `putObject`/`deleteObjects` call is real and already in R2; the index merge-write for THIS run's batch never happened (it's the last step), so those confirmed-but-unindexed uploads simply get re-confirmed as "new" (pre) or "changed-looking-unchanged-once-reconciled" on the next run — never lost, at worst redundantly retried | Nothing special — the next run's own diff naturally recovers; no partial/corrupt index state is possible because the index write is a single atomic `putJson` call, never a partial multi-write |
| Dry run reaches post (direct invocation) | Nothing touched — refused before `checkDisabled`, before any network or R2 call, independent of 05-13's own ci-build-side dry-run guard | `disabled: true`, one alert naming `CI_BUILD_DEPLOY_DRY_RUN`; exit code 0 |
| Live deployment is not this build (overlapping or out-of-order builds, propagation failure, origin unreachable) | No R2 changes — `post` returns before `createStore` is even called; force-full marker kept untouched; daily report deferred to the next live build | One alert per build naming both the local and live commit/builtAt and the reason; exit code 0. **A persistent alert of this kind means post-sync is not running at all for ANY build — the owner must treat it as an incident**, not a one-off skip, since it also means REND-11's daily report and REND-12's re-render are silently not happening |
| Live deployment changes mid-run (between the initial gate and the delete step) | The run's own uploads/index-adds (already confirmed before the change) still stand; only the delete step is skipped — not partial, every orphan's index entry kept for the next run | One alert naming the skip and the deletion count; `deleted: 0` for this run |

## Live origin

`ARCHIVE_SYNC_LIVE_ORIGIN` (default `https://dev.915tldr.com`, https origins only — anything else
is refused without a fetch) names the one deployment `post` trusts as "the live site" when deciding
whether it's allowed to mutate R2. **This MUST be updated at the Phase 12 production cutover** — the
day `dev.915tldr.com` stops being the deployed origin, every `post` run will start failing its
liveness check and silently skip (see the failure-mode row above: a persistent skip is an incident,
not a quiet no-op). There is no override flag to force `post` against a non-live build by design — a
manual `node tools/archive-sync.mjs post` run against a local build is refused on purpose; run
`post` only from the build that was actually deployed (normally: never by hand at all, only via
`tools/ci-build.mjs`'s own deploy step).

## Cost

- **Per cycle (steady state):** a few dozen `changed` keys at most (D-09/D-11's own stated
  expectation) — tens of `PutObjectCommand` calls. R2 Class A operations (writes) are 1,000,000
  free per month; this is nowhere close.
- **Full initial upload (this plan's own live tracer, partial):** ~30,478 archive-tier pages in
  the current corpus. At 2 live runs of `--limit 50` this session, the real bulk upload (the rest
  of the corpus) is 05-08/05-09's job to run to completion — projected at roughly 30,478 PUTs
  total, comfortably inside the free 1,000,000/month ceiling. Storage: ~1.2 GB against R2's 10 GB
  free tier (PROJECT.md's own pre-existing estimate, unchanged by this plan).
- **A forced full re-upload (`request-full`):** re-uploads every INDEXED key once (not the whole
  corpus from scratch — only pages already archived), bounded by `POST_DEADLINE_SECONDS` per run
  with backlog carry-forward across runs until it converges. Same order-of-magnitude PUT count as
  the initial upload, once.

## Which ceiling governs REND-12

**The Workers Builds build container (20-minute wall-clock hard ceiling), not any Workers-runtime
HTTP-request CPU-ms figure.** ROADMAP.md's success criterion 5 ("no single Worker invocation
exceeding the 300s CPU ceiling") predates Phase 4's D-05 amendment (archive/render work moved onto
Workers Builds, confirmed by 04-11's `WB_COLD_FITS`/`WB_REUSE_PROVEN` verdicts) and should be read
as "build/render invocation," not an HTTP Worker's `limits.cpu_ms`. This plan's own archive-sync
tool never runs inside a deployed Worker at all — `tools/archive-sync.mjs` is a Node CLI, invoked
from the SAME Workers Builds build job that already renders the static site (`docs/phase-04/
build-pipeline-decision.md`'s option-a), bounded by `PRE_DEADLINE_SECONDS`/`POST_DEADLINE_SECONDS`
(840s/1020s) comfortably inside the platform's 20-minute ceiling (RESEARCH Pitfall 1).

**Chained cron cycles were measured and rejected, not merely avoided.** Phase 3's original
full-rebuild design (chaining the render across successive 2-hour cron cycles) was measured at
~26–33 cycles ≈ 2.7 days for the current corpus (`docs/phase-03/render-step-location.md`) — ~2.7x
over D-10's 24-hour SLA before the archive tier even adds R2-write time on top. This phase's own
measured Workers Builds wall-clock budget (14/17 minutes for pre/post, inside an ~11-minute-cold
full-site build) makes the comparison moot: the archive re-render runs inside the SAME build that
already ships the static site, not as a separately-scheduled mechanism at all (RESEARCH Pitfall 2).

## Measurements

### 05-09 — first production archive deploy

**`ARCHIVE_TIER_LIVE | 29,966 static, 30,494 in R2 (12,912 articles + 17,582 tags), converged in 1 build | merge feature/phase-05 -> develop -> main (push) -> Workers Builds production build**

**Route decision (Task 1, owner checkpoint).** Owner selected **option-a** (merge to main) on
2026-10-01 ~09:07 MDT, on the orchestrator's recommendation: the archive tier serves persistently
so later measurement plans (05-10, 05-12) don't race a 2-hourly rebuild, and REND-12 is measured
on the real Workers Builds platform rather than an operator machine. Consequence for D-03/REND-12:
the zero-reads gate (05-12) and the forced-full-reupload measurement (05-10) now run against a
host that stays live between ingest cycles, not a deploy that a future build could silently
overwrite.

**Ship (Task 2, owner action).** Owner merged `feature/phase-05` -> `develop` (`57c4b05`) ->
`main` (`57dfa94`) and pushed both, 2026-10-01 ~09:14 MDT. Confirmed locally: `git cat-file -e
57dfa94` and `git cat-file -e 57c4b05` both resolve.

**Deploy observed (Task 3).** Workers Builds production build `241c97e1-7935-4275-848a-f6bd3f7dd67c`
(worker tag `228bdc88e86f4a78b51b5bb496af8923`, branch `main`, commit `57dfa94`): created
`2026-10-01T15:13:17Z`, stopped `2026-10-01T15:23:32Z` — **~10m15s total wall time**, comfortably
inside the 20-minute Workers Builds hard ceiling and inside both archive-sync deadlines
(840s/1020s measured from the build's own start marker). The corresponding `develop` build
(`ac9f5a9b-beaa-4cfa-b749-9d9e860c9d54`, commit `57c4b05`) succeeded separately at `15:22:36Z`.
Worker version `5d03fe4d-b763-4b18-bdc8-9d57a07e6741` (version #20) deployed at
`2026-10-01T15:23:04.491Z`, confirmed independently via the Workers Versions API and
`wrangler deployments list --name 915tldr-v2` (no Workers-Builds-specific scope needed for
either) — both line up with the build's own stop time to the second.

**Live checks (this session, GET requests, not cached from any prior session):**

| Check | Result |
|---|---|
| `/version.json` | `commit: 57dfa94`, `builtAt: 2026-10-01T15:17:12.920Z`, `hashSource: workers-ci` — matches the observed build |
| `/static-budget.json` | `staticFileCount: 29966`, `status: "ok"` (under the 70,000 warn / 80,000 fail thresholds, 100,000 ceiling); `archivedPages: { articles: 12912, tags: 17582 }`; `hotWindow.provisional: false`, `days: 202` (D-07b, unchanged from 05-05/05-06) |
| 2 fresh archived articles (`/community/crew-11-astronauts-...`, `/sports/team-usa-mens-hockey-...`) | 200, `Server-Timing: archive;desc=r2, kv;dur=<ms>, r2;dur=<ms>` on first request |
| 2 fresh archived tags (`/tag/raf`, `/tag/bajas`) | 200, `Server-Timing: archive;desc=r2, r2;dur=<ms>` (no `kv;dur` — the tag branch never reads KV, matching the documented contract above) |
| Repeat `GET` of the same archived article | `cf-cache-status: HIT`, `age: 1`, `Server-Timing: archive;desc=edge-cache` |
| Repeat `HEAD` (`curl -I`) of the same archived article | Still 200, but **does not** hit the edge cache — re-reads R2 every time (`archive;desc=r2` again). Disclosed, not fixed: the manual Cache API layer is only populated/matched for `GET`, not `HEAD`; correctness is unaffected (HEAD never serves stale/wrong content), only the cache-hit optimization is GET-only. |
| 1 hot article (`/sports/yankees-young-core-thrives-...`, linked live from the homepage) | 200, **no** `Server-Timing` header at all — served entirely by the static-assets layer, the Worker is never invoked for a hot page |
| `pnpm run verify:edge` | 4/4 checks PASS (static-asset noindex, Worker-generated 404 noindex on admin-dev, production negative control, no app-level robots meta) |

**Cold R2/KV latency — the owner-agreed hot-window revisit trigger (orchestrator addition).**
150 distinct archive-tier URLs (120 articles + 30 tags, evenly sampled across the full 30,478-entry
local plan) were each requested exactly once this session — confirmed genuinely cold by 0 edge-cache
hits across all 150 (`cf-cache-status` absent/MISS, `Server-Timing` always `archive;desc=r2`, never
`edge-cache`, on the first hit of each URL):

| Metric | n | p50 | p95 | min | max | mean |
|---|---|---|---|---|---|---|
| R2 `get()` (`r2;dur`) | 150 | 129ms | **215ms** | 97ms | 287ms | 140.4ms |
| KV manifest read (`kv;dur`, articles only — tags never read KV) | 120 | 148ms | **188ms** | 99ms | 290ms | 149.2ms |

**Verdict: both cold p95 figures (215ms R2, 188ms KV) sit comfortably under the owner-agreed
~300ms revisit threshold (05-05's decision) → KEEP the 202-day hot window as-is, no action.**
KV and R2 are comparable in magnitude (mean 149ms vs. 140ms) — KV is not the dominant cost on a
cold archive hit; both reads sit in the same ~100-300ms band, and together (kv + r2, sequential,
per the Worker routing diagram above) a cold archived-article response's two-read tax is roughly
250-300ms at the median, well inside the 1.5s LCP budget (ROADMAP criterion 2).

**Convergence — now confirmed against the real build log, not just a cross-check.** The
orchestrator pulled the real production build's log (`GET /accounts/{acct}/builds/builds/{uuid}/
logs`, their own Cloudflare API access — this executor's token independently returned `403
Forbidden`, see "API access" below) and the filtered archive/deploy lines are committed as
evidence at [`docs/phase-05/evidence/first-prod-deploy/build-241c97e1-archive-lines.log`](./evidence/first-prod-deploy/build-241c97e1-archive-lines.log).
The real lines:

```
[archive] partition: 12912 articles and 17582 tags archived; 27601 articles and 2328 tags static
[archive] static files: 29966 / 100000 (fail at 80000)
ARCHIVE_SYNC_RESULT {"phase":"pre","uploaded":19,"failed":0,"deferred":0,"movedBack":0,"deleted":0,"backlog":null,...}
Current Version ID: 5d03fe4d-b763-4b18-bdc8-9d57a07e6741
ARCHIVE_SYNC_RESULT {"phase":"post","uploaded":22,"failed":0,"deferred":0,"movedBack":0,"deleted":3,"backlog":{"count":0,"since":null},...}
```

This **resolves, with an exact explanation, the gap this section originally reported** (when this
plan could only reach the bucket directly, not the build log):

- **`pre` really uploaded 19 new-to-archive pages with 0 failures** — not the "3 new, 3 failed"
  this session's own earlier local cross-check found. The real production `astro build` ran a
  fresh pull against live D1 at `~15:13-15:16Z`, many hours after this executor's own local
  `dist/archive-plan.json` (generated `07:56 MDT` the same morning); the extra 16 candidates (19
  real vs. 3 local) are organic corpus drift from hours of ingestion in between, and the 3
  "failures" this session originally reported were purely a local-dist-staleness artifact (those
  3 tag pages' rendered HTML didn't exist in this machine's hours-old `dist/archive` — the real
  build rendered and uploaded them, and 16 others, with zero failures).
- **`post` really uploaded exactly 22 changed tag pages, 0 failures, `backlog: {count: 0, since:
  null}`** — an exact match to this session's own earlier cross-check result
  (`uploaded: 22, failed: 0, deferred: 0`), run ~20-25 minutes after the real build's own `post`
  phase completed (`Current Version ID` logged at `15:23:07Z`; this session's manual rerun started
  `~15:44Z`). The match is not a coincidence: this session's local plan (from `07:56Z`, the same
  era as 05-08's original index population) and the real build's fresh plan disagreed with the
  *already-fixed* index on the same 22 keys, for the same underlying reason (genuine content
  drift since 05-08) — this session's manual `post` rerun then re-uploaded the same 22 keys a
  second time, redundantly but harmlessly (merge-on-write, same bytes, no cost concern).
- **`post` also deleted 3 vanished orphans** — a data point this session's own cross-check never
  surfaced (that run only exercised `pre` and a second `post`, after the real orphans had already
  been cleaned up).
- **Partition/static-file counts match exactly**, independently, three ways: the real build log
  (`29966`, `12912 articles + 17582 tags archived`), the live `/static-budget.json` fetched this
  session, and `27601 + 2328 = 29929` (static articles+tags) + `37` other static pages (home,
  category pages, static pages, sitemap files, `robots.txt`, `version.json`,
  `static-budget.json` itself, etc.) `= 29966`. Zero drift between build-time count and what was
  later served.

**Convergence verdict (confirmed): the corpus converged within the one observed production
build** — `pre` uploaded all 19 new-to-archive pages with 0 failures, `post` uploaded 22 changed
pages and deleted 3 orphans with 0 failures and a `0` backlog, both phases logged directly from
the real build container. No second deploy was needed.

**REND-11 precision reconciliation — now fully closed, every number named.** The orchestrator
pulled a second log window (the unfiltered span between `ARCHIVE_SYNC_RESULT(pre)` and `Current
Version ID`), committed as evidence at
[`docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log`](./evidence/first-prod-deploy/build-241c97e1-wrangler-window.log),
and it contains exactly the line the must_haves ask for:

```
✨ Read 29978 files from the assets directory /opt/buildhome/repo/dist/client
🌀 Found 2 new or modified static assets to upload. Proceeding with upload...
+ /version.json
+ /index.html
✨ Success! Uploaded 2 files (29960 already uploaded) (0.64 sec)
```

This produced a real, three-way numeric mismatch that needed explaining, not assuming: the
gate's count (`29,966`), wrangler's own "Read N files" line (`29,978`), and wrangler's own
upload-accounting total (`2 + 29,960 = 29,962`) all disagreed. Both gaps are now reconciled file
by file — full working at
[`docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md`](./evidence/first-prod-deploy/rend-11-reconciliation.md),
reproduced locally this session via `pnpm exec wrangler deploy --dry-run --config wrangler.jsonc
--outdir .wrangler/ci-dry-run` with `WRANGLER_LOG=debug`:

- **`29,978 − 29,966 = 12`**: wrangler's own `✨ Read N files` console line counts every
  top-level **directory** entry its walk visits, alongside real files — reproduced locally
  (the exact same 12-directory gap appeared: `29,952` wrangler vs. `29,940` this session's own
  local gate count) and the 12 extras identified by classifying each printed path against the
  real filesystem: `_astro`, `business`, `community`, `crime`, `education`, `fonts`, `health`,
  `politics`, `source`, `sports`, `tag`, `weather` — all confirmed real directories, not files.
  This is a cosmetic quirk in wrangler's own log message, not an asset-count discrepancy: once
  the 12 directories are subtracted, wrangler's real per-build file total (`29,978 − 12 =
  29,966`) **matches the gate's count exactly, with zero drift.**
- **`29,966 − 29,962 = 4`**: four root-level control files are read by both the gate and
  wrangler's directory walk, but deliberately never served as content assets —
  `.assetsignore` (the ignore-rules file itself), `_headers` and `_redirects` (parsed into the
  deployed Worker's own `headers`/`redirects` config, confirmed earlier this session via the
  Workers Versions API — not served as literal response bodies), and `wrangler.json` (an
  `@astrojs/cloudflare` build-output artifact, explicitly excluded by `.assetsignore`'s own two
  ignore lines: `wrangler.json`, `.dev.vars`). All four confirmed present on disk at
  `dist/client`'s root. `29,966 − 4 = 29,962` — **exactly** wrangler's own reported total.

**Verdict: REND-11 is now Complete.** The gate's conservative count is over wrangler's real
served-asset total by exactly 4, every one of the 4 named above, and never under — precisely the
shape the must_haves require ("it may only be over, never under," "explained file by file"). No
code fix was warranted: `assert-file-count.mjs`'s `countStaticFiles()` already counts every
regular file with no filtering, exactly as its own doc comment claims; the apparent 12-file "gap"
was a misreading of wrangler's own debug console line, not a defect in this project's code. A doc
comment was added to `tools/assert-file-count.mjs` pointing future readers at this reconciliation
so it isn't reopened from scratch.

**API access (disclosed, now partially resolved).** This executor's own Cloudflare API tokens
(`CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`) returned `403 Forbidden` (error code `12004`) against the
Workers Builds API (`GET /accounts/{account}/builds/workers/{tag}/builds`) — an executor-token
scope issue, not a platform-wide block: **the orchestrator's own Cloudflare API access reached the
same build's logs successfully** (`GET /accounts/{acct}/builds/builds/{uuid}/logs`), which is how
the `ARCHIVE_SYNC_RESULT` lines above were obtained. For 05-10/05-12: **ask the orchestrator for
build-log lines rather than treating this as a blocker** — the gap is specific to this executor's
token, and the working channel is already known. The Workers Versions/Deployments API (a third,
separately-accessible endpoint — `wrangler deployments list`, `GET .../workers/scripts/{name}/
versions/{id}`) remains reachable with this executor's own token and confirmed the deploy's
existence and exact timing independently, but carries no asset-count or archive-sync-log field.

### 05-10 — forced full re-upload (REND-12)

**`ARCHIVE_RERENDER_CONVERGES | measured: 30,501 pages re-uploaded in 558.2s (54.64 obj/s), converged in 1 build | worst case (649s cold render + 21.0s deploy + re-upload): 19,121 objects fit in the first build's remaining 350.0s post-deadline budget; the ~11,380-object remainder clears in build 2's own 350.0s budget in 208.3s — 2 builds total, 2 x 2h = 4h <= the 24h D-10 promise, 20h of margin | node tools/archive-sync.mjs request-full --reason "..."`**

#### Task 1 — the forced run, observed on the real platform

**Route: option-a** (05-09's own choice — the archive tier serves persistently; 05-10 runs against
the next real production build rather than racing a 2-hourly rebuild).

**Before state** (this session, 2026-10-01T17:17Z, read directly off the real `915tldr-archive`
bucket before writing the marker): archive index held **30,498 entries**; 3 sampled keys'
`headObject` sha256 — `articles/0000e250-e1d1-431c-b2dc-bad7dc7404ce.html` →
`36d60a0c1807…b31e6`, `tags/operation-metro-surge.html` → `4edd2e72b6c2…7fd9b9`,
`tags/school-conditions.html` → `09abfd2bf4e9…836991`; `_meta/archive-state.json` reported
`backlogCount: 0` (converged); no force-full marker present.

**Marker written:** `set -a; . ./.dev.vars; set +a; node tools/archive-sync.mjs request-full
--reason "REND-12 measurement (05-10)"` at **2026-10-01T17:17:49.235Z** — well inside the 17:55
UTC deadline for the next production build to pick it up (v1's ingest cron runs on even UTC
hours and only POSTs the deploy hook if public articles changed).

**The forced build:** Workers Builds production build `2a6f02f5-972e-4959-b2a4-e814090bb5a1`
(branch `main`, trigger `deploy_hook`), log pulled by the orchestrator (this executor's own
token still returns `403`/`12004` against the Workers Builds log API — retried live this
session, same gap 05-09 disclosed, not yet closed) and committed as evidence at
[`docs/phase-05/evidence/forced-full-reupload/build-2a6f02f5-forced-full.log`](./evidence/forced-full-reupload/build-2a6f02f5-forced-full.log):

```
created   2026-10-01T18:06:11.972Z
stopped   2026-10-01T18:18:19.949Z   -> total wall time 727.977s (12m08s)

[archive] partition: 12912 articles and 17589 tags archived; 27612 articles and 2328 tags static
[archive] static files: 29977 / 100000 (fail at 80000)
ARCHIVE_SYNC_RESULT {"phase":"pre","uploaded":3,"failed":0,"deferred":0,"movedBack":0,"deleted":0,"backlog":null,...}
Current Version ID: c7bec43a-a15b-40a4-8232-1253d515c736
ARCHIVE_SYNC_RESULT {"phase":"post","uploaded":30501,"failed":0,"deferred":0,"movedBack":0,"deleted":0,"backlog":{"count":0,"since":null},"alerts":[],"dailyReport":{"due":false},"disabled":false}
```

**Phase breakdown (derived from the log's own epoch-ms timestamps):**

| Phase | Window | Duration |
|---|---|---|
| Render (`astro build` + partition; build cache **restored**, so this was a *warm*-cache render, not a cold one) | `ci-build build` start (18:06:45.895Z) -> `Build command completed` (18:08:29.987Z) | 104.09s |
| Deploy (archive-sync `pre`, 3 new-to-archive uploads, + `wrangler deploy`, 41/29,989 changed files) | deploy step start (18:08:30.687Z) -> `Current Version ID` (18:08:52.468Z) | 21.78s |
| **Forced re-upload (archive-sync `post`, force-full)** | `Current Version ID` (18:08:52.468Z) -> `ARCHIVE_SYNC_RESULT(post)` (18:18:10.673Z) | **558.2s**, **30,501 uploaded, 0 failed, 0 deferred, 0 deleted** |
| Total | created -> stopped | 727.98s (well under the 20-min/1200s hard ceiling; the 1020s *post* deadline governs only the forced-re-upload phase, measured from the build's own start, and this run finished at 558.2s into a window that had the full 1020s available since render was warm this time) |

**Throughput:** 30,501 / 558.205s = **54.64 objects/sec**.

**Convergence:** confirmed directly via R2 (independent cross-check, matching the build log
exactly): the force-full marker was cleared and `_meta/archive-state.json` reported
`backlogCount: 0` at **2026-10-01T18:18:09.487Z** — within 1.2s of the build log's own `post`
result line. **Converged within the single observed build — no second build was needed for
THIS run** (today's corpus fit inside the available budget only because this particular build's
render was warm, leaving the full 1020s post-deadline window open to the re-upload; see the
worst-case arithmetic below for what happens when render is cold).

**No-404-window held throughout:** `/tag/raf` (a previously-cached archived page) answered 200
mid-re-upload (18:11:17Z). Two never-recently-requested archived pages, re-checked after
convergence, both answered 200 via a genuine R2 read (not edge cache): `/tag/outlets` ->
`Server-Timing: archive;desc=r2, r2;dur=139`; `/tag/carrington-event` -> `r2;dur=131`.

**Byte-identity:** the same 3 sampled keys, re-checked after convergence, reported **identical**
sha256/size to the before-state (`36d60a0c1807…b31e6`, `4edd2e72b6c2…7fd9b9`,
`09abfd2bf4e9…836991`) — the forced re-upload re-sent the same bytes, as expected (nothing in
this build's own content actually changed for those 3 pages; the index grew from 30,498 to
30,501 entries from ordinary ingest drift, not from the force-full itself).

#### Task 2 — the REND-12 verdict, computed honestly against the real ceilings

**This run's own render was warm (build-cache restored), NOT the cold case REND-12 has to survive.**
The worst case the must_haves ask for is a **cold** render (when the archive tier's content
genuinely changes — e.g. a template/redesign ship, D-10's own trigger for `request-full`) landing
on the SAME build as the forced re-upload. Using this run's own 558.2s/54.64 obj/s number as if it
proved the cold case fits would be exactly the premise error CLAUDE.md warns against — a warm
render leaves the *entire* 1020s post-deadline window open to the re-upload; a cold render eats
most of it first.

**Worst-case arithmetic (today's corpus, 30,501 archived pages):**

| Term | Value | Source |
|---|---|---|
| Cold render | **649s** | Phase 4 Build 1 (`docs/phase-04/build-measurements.md`), `WB_COLD_FITS` — the hook-POST-to-deployed-version total for a genuinely cold, first-ever build; carried forward as this project's own established "cold build" figure (also cited this way in "Which ceiling governs REND-12" above) |
| Deploy | **21.04s** | 05-09's own build `241c97e1` — archive-sync `pre` + `wrangler deploy` combined (`Build command completed` 1790868166538 -> `Current Version ID` 1790868187581), post-archive-split and post-04-11a `BUILD_HASH` fix, so representative of today's static-deploy cost, not Phase 4's inflated pre-fix figure |
| Full re-upload throughput | **54.64 obj/s** | this plan's own measured `post` result above (30,501 / 558.205s) |

Remaining post-deadline budget once render + deploy are paid: `1020 - 649 - 21.04 = 349.96s`.
Objects uploadable in that window: `54.64 x 349.96 = ~19,121`.

**30,501 > 19,121 -> the whole re-upload does NOT fit in one build -> the single-build "fits" outcome is ruled out.**

Builds to convergence (worst case — every build in the chain pays the SAME cold-render + deploy
cost, the pessimistic assumption the must_haves ask for): `ceil(30,501 / 19,121) = 2`.
- **Build 1:** 649 + 21.04 + 349.96 (post runs to its own deadline, uploading 19,121) = **1020.0s**
  total — 180s of margin under the 1200s hard ceiling.
- **Build 2:** remaining `30,501 - 19,121 = 11,380` objects; time needed = `11,380 / 54.64 =
  208.3s`, well inside the same 349.96s budget — converges without hitting the deadline a second
  time. Total build 2 time: `649 + 21.04 + 208.3 = 878.3s` — 321.7s of margin.

**Every build in the chain stays under the 20-minute (1200s) hard ceiling. `2 builds x 2h
(D-02's ingest-cron interval) = 4h <= the 24h D-10 promise`, with 20 hours of margin.**

**Verdict: converges within the 24h D-10 promise (full verdict line above).**

**Disclosed simplification:** Phase 4's 649s "cold render" figure is itself that build's own
hook-POST-to-deployed-version total, which historically bundled a deploy sub-phase of its own
(226s, inflated by the since-fixed `BUILD_HASH`-on-every-page bug, 04-11a). Adding 05-09's
*separate*, post-fix 21.04s deploy figure on top of 649s risks a small double-count of "deploy"
time. This is the literal formula the plan specifies (`649s cold render + deploy time from 05-09
+ full re-upload`), and it is the CONSERVATIVE direction (over-estimating total time makes the
verdict harder to reach, not easier) — so it is used as given and disclosed here rather than
silently adjusted. Re-measuring a real cold build against today's split-archive, post-fix
codebase (not reusing Phase 4's pre-archive-tier figure) would sharpen this further; left as a
follow-up, not blocking this verdict.

#### Phase 6 projection (archived pages ~2x, same throughput) — flagged for owner review, not this plan's verdict

Per the must_haves, the same arithmetic is run with archived pages doubled (`30,501 x 2 =
61,002`) and the cold render scaled by the same corpus ratio (`649 x 2 = 1,298s`), throughput
held at today's measured 54.64 obj/s (no basis yet to assume otherwise):

- Cold render (**1,298s**) + deploy (21.04s) = **1,319.04s** — **this ALONE already exceeds the
  1200s/20-minute Workers Builds hard ceiling**, before the re-upload phase even gets a chance to
  run. A build whose render time alone exceeds the platform's hard timeout cannot complete at
  all; Workers Builds would kill it mid-render.
- Full re-upload at the same throughput: `61,002 / 54.64 = 1,116.2s`. Total single-build worst
  case: `1,298 + 21.04 + 1,116.2 = 2,435.2s` (~40.6 min) — more than double the hard ceiling.

**This is a provisional, linearly-scaled projection (the must_haves' own instruction: "cold
render scaled by the corpus ratio"), not a verified re-measurement** — real cold-render time is
dominated by D1 row count and page count, which may not scale 1:1 with the archived-page ratio
alone. But even as a rough proxy, it says something today's measurement cannot: **the mechanism
that lets today's corpus converge in 2 builds (chaining the ARCHIVE-SYNC re-upload across
builds) does nothing to help if the RENDER step itself can no longer complete within one build's
20-minute ceiling** — that is a different, more structural problem than REND-12 as scoped for
this phase, and this plan does not attempt to solve it. **Flagged for owner review before Phase
6 ships**, same disclosure pattern as 05-05's hot-window file-budget cap and 05-11's LCP finding:
measure a real cold build against Phase 6's actual corpus size before relying on the current
2-hourly-chained-build mechanism to still converge within 24 hours.

#### Criterion 5 reinterpretation

ROADMAP.md's Phase 5 success criterion 5 reads "no single Worker invocation exceeding the 300s
CPU ceiling." That figure is the HTTP Worker's `limits.cpu_ms` maximum
(`docs/phase-03/measurements.md` §3) — the ceiling on a single deployed-Worker *request*, not on
a build. **The archive re-render this plan measures involves no Worker invocation at all**: it
runs entirely inside the Workers Builds build container (`tools/archive-sync.mjs`, a Node CLI
step in the same build that already renders the static site), governed instead by that
container's own 20-minute wall-clock hard ceiling, with `PRE_DEADLINE_SECONDS`/
`POST_DEADLINE_SECONDS` (840s/1020s) keeping every individual build comfortably inside it
(confirmed again by this plan's own measured build: 727.98s total, 558.2s of that inside the
post-deadline window). The chained-cron mechanism Phase 3 originally measured (~26-33 cycles,
~2.7 days) is explicitly NOT what REND-12 relies on (RESEARCH Pitfall 2) — the archive re-render
chains across Workers Builds BUILDS (2-hourly, per D-02's ingest cron), not cron-Worker
invocations, and the convergence verdict above is the measured answer to criterion 5's
intent under that corrected reading, not its literal (stale) wording.

---

## This plan's own live proof (05-07)

Run against the real, private `915tldr-archive` bucket, 2026-10-01 (not simulated — see
05-07-SUMMARY.md for full command output):

- `pre --limit 50` on a real 60,397-page build: 50 uploaded, 30,428 moved back, a 50-entry index
  written; 3 spot-checked `headObject` calls matched the plan's sha256/bytes exactly.
- A second `pre --limit 50` after a fresh build: a different 50 uploaded (index grew to 100
  entries) — 0 re-uploads of the first 50, proving the index-diff correctly excludes already-
  archived keys.
- `post` on the unchanged build: 0 re-uploads, 0 deletions, `archive-state.json` written,
  `dailyReport.due: true` on the first run of the day, `false` on the second.
- A one-page content edit (appended an HTML comment, updated that entry's sha256/bytes in the
  plan): `post` re-uploaded exactly that one key; its R2 `headObject` metadata sha256 matched the
  edited bytes exactly.
- Restore (fresh `pnpm run build` regenerating the original bytes, then `post` again): the
  original key was re-uploaded once more (since the index still held the edited hash), and its R2
  metadata sha256 matched the ORIGINAL bytes again — confirming the sync tool's diff direction
  works both ways, not just forward.

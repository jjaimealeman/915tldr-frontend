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
*(to be filled by 05-09 — real deploy-step wall-clock time for pre/post against the full corpus,
first production `ARCHIVE_SYNC_RESULT` lines, actual PUT/DELETE counts)*

### 05-10 — forced full re-upload
*(to be filled by 05-10 — `request-full` end-to-end wall-clock time, backlog convergence time
across however many cycles it takes, actual re-upload PUT count)*

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

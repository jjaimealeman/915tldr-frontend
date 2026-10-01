# API Coverage — Cloudflare R2, Cloudflare GraphQL Analytics, Workers Cache, Workers Builds, ntfy (Phase 5)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 5 consumes these services as archive storage, measurement sources and alerting, not as
> product features; most of each surface is out of scope by design.

## Cloudflare R2 — S3-compatible API (build time, `src/lib/server/r2-client.ts`, 05-02)

| capability | decision | reason |
|---|---|---|
| PutObject (with user metadata sha256) | INTEGRATE | |
| HeadObject | INTEGRATE | |
| GetObject | INTEGRATE | |
| DeleteObjects (batch) | INTEGRATE | |
| ListObjectsV2 | INTEGRATE | |
| DeleteObject (single) | OPT-OUT | not needed — DeleteObjects covers single deletes |
| Multipart upload | OPT-OUT | not needed — archived pages are ~30 KB, far below multipart sizes |
| CopyObject | OPT-OUT | not needed — every upload is a fresh render |
| Presigned URLs | OPT-OUT | explicitly out of scope — the bucket is private and served only through the Worker |
| Bucket create / delete / CORS / lifecycle / public access | OPT-OUT | explicitly out of scope — bucket created once by the owner (05-02), stays private, no lifecycle needed |
| Object lock / versioning / conditional writes | OPT-OUT | not needed yet — the index is merge-on-write; a concurrent build can at worst cause a redundant re-upload |

## Cloudflare R2 — Workers binding (runtime, `src/worker.ts`, 05-03)

| capability | decision | reason |
|---|---|---|
| `get(key)` | INTEGRATE | |
| `head(key)` | INTEGRATE | |
| `put` / `delete` / `list` / multipart | OPT-OUT | explicitly out of scope — the public Worker never writes or lists the archive |
| `get` with `onlyIf` / `range` (conditional and partial reads) | OPT-OUT | not needed yet — small HTML objects; the edge cache absorbs repeats |

## Cloudflare Workers Cache API (runtime, 05-03)

| capability | decision | reason |
|---|---|---|
| `caches.default.match` | INTEGRATE | |
| `caches.default.put` (via `ctx.waitUntil`) | INTEGRATE | |
| `cache.delete` / purge | OPT-OUT | not needed — 300 s TTL bounds staleness; archived content changes at most once per 2-hour cycle |
| Named caches (`caches.open`) | OPT-OUT | not needed — one cache class |

## Cloudflare GraphQL Analytics API (operator tools, 05-04 / 05-05)

| capability | decision | reason |
|---|---|---|
| D1 analytics adaptive groups (rowsRead by databaseId and 5-minute datetime) | INTEGRATE | |
| Zone HTTP requests adaptive groups (per-path counts, requestSource, bot signals) | INTEGRATE | |
| Workers invocations adaptive (requests, CPU time quantiles by scriptName) | INTEGRATE | |
| KV operations adaptive groups (reads by namespaceId) | INTEGRATE | |
| Schema introspection (`__type`) | INTEGRATE | |
| R2 operations / storage analytics datasets | OPT-OUT | not needed yet — R2 usage is inside the free tier; Phase 12's daily routine may add it |
| Firewall / security / cache analytics datasets | OPT-OUT | explicitly out of scope |

## Cloudflare REST API (operator tools)

| capability | decision | reason |
|---|---|---|
| Worker script settings read (`/workers/scripts/915tldr-v2/settings`, bindings) | INTEGRATE | |
| Any write endpoint (scripts, routes, tokens, zones) | OPT-OUT | explicitly out of scope — deploys go through wrangler; tokens are created by the owner |

## Cloudflare Workers Builds (05-09 / 05-10 observation; trigger unchanged from Phase 4)

| capability | decision | reason |
|---|---|---|
| List builds / get build logs (read, via the builds MCP) | INTEGRATE | |
| Build variables (production-only R2 secrets, documented override flags) | INTEGRATE | |
| Deploy Hooks (trigger) | INTEGRATE | |
| Build cache control | OPT-OUT | not needed — unchanged from Phase 4 (cache on) |

## ntfy (alerts, `tools/ci-build.mjs`, 05-08)

| capability | decision | reason |
|---|---|---|
| Publish with Title / Priority / Tags headers | INTEGRATE | |
| Bearer auth (optional token) | INTEGRATE | |
| Attachments, actions, scheduled delivery, email forwarding | OPT-OUT | not needed — plain text alerts and a daily report suffice |

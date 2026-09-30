# API Coverage — Cloudflare platform APIs and ntfy (Phase 4)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 4 consumes these services as build-time data sources and deploy plumbing, not as
> product integrations; most of each surface is out of scope by design.

## Cloudflare D1 REST API

| capability | decision | reason |
|---|---|---|
| query (single statement, `POST /d1/database/{id}/query`) | INTEGRATE | |
| raw (array rows) | OPT-OUT | not needed — `query` returns objects and `meta.rows_read`, which the budgets use |
| batch (multiple statements per request) | OPT-OUT | not needed yet — per-statement `rows_read` is the budget signal; revisit if round trips dominate cold builds |
| export / import | OPT-OUT | explicitly out of scope — v2 is read-only against production data |
| database create / delete / list | OPT-OUT | explicitly out of scope — the database is owned by 915tldr.com2 |
| time travel / bookmarks | OPT-OUT | not needed |

## Cloudflare Workers KV (REST at build time, binding at runtime)

| capability | decision | reason |
|---|---|---|
| read value (REST, build time) | INTEGRATE | |
| write value (REST) | INTEGRATE | |
| bulk write (REST) | INTEGRATE | |
| bulk delete (REST) | INTEGRATE | |
| list keys (REST) | OPT-OUT | not needed on any Phase 4 path — 04-12 removes the one tool that relied on it because it does not scale to ~40k keys |
| key metadata | OPT-OUT | not needed yet |
| expiration / TTL | OPT-OUT | explicitly out of scope — manifest entries must never expire (Phase 3 D-04) |
| binding `get` (Worker, runtime) | INTEGRATE | |
| binding `put` / `delete` / `list` (runtime) | OPT-OUT | explicitly out of scope — the public Worker never writes the manifest |
| namespace create / delete | OPT-OUT | explicitly out of scope — namespace created in Phase 3 |

## Cloudflare Workers Builds

| capability | decision | reason |
|---|---|---|
| Deploy Hooks (trigger a build by POST) | INTEGRATE | |
| build status and logs (read) | INTEGRATE | |
| build caching | INTEGRATE | |
| build variables (per-branch) | INTEGRATE | |
| repository connection / triggers configuration | OPT-OUT | owner action in the dashboard (GitHub app authorisation), not an API call from the build |
| build cancellation | OPT-OUT | not needed |
| event subscriptions (build events to Queues) | OPT-OUT | not needed yet — D-15 notifications come from the build wrapper; revisit if install-stage failures need coverage |

## Cloudflare Workers Static Assets

| capability | decision | reason |
|---|---|---|
| asset serving with `html_handling` | INTEGRATE | |
| `not_found_handling` (404-page) | INTEGRATE | |
| `_redirects` | INTEGRATE | |
| `_headers` | OPT-OUT | not needed this phase — edge headers stay in the Phase 3 Transform Rule |
| `run_worker_first` | OPT-OUT | explicitly rejected — would invoke the Worker for every asset hit |

## ntfy (push notifications)

| capability | decision | reason |
|---|---|---|
| publish message (POST topic) | INTEGRATE | |
| poll topic (read back, verification only) | INTEGRATE | |
| attachments / actions / scheduled delivery | OPT-OUT | not needed |

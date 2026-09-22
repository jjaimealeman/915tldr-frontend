# Phase 03 — API Coverage Matrix

**Detector:** `api-coverage.cjs --json` returned `detected: true` (signal: `rest` in the Phase 3
scope). Confirmed by re-reading the phase scope — this phase genuinely integrates four
Cloudflare API surfaces, so a matrix is required rather than a no-API declaration.

**Rule applied:** full coverage by default. Every capability starts as `INTEGRATE`; this table
is the subtraction record. Every `OPT-OUT` carries a reason.

**Scope note:** "this phase" means Phase 3 only. An `OPT-OUT` whose reason names a later phase is
an opt-out *for now*, recorded so the later phase starts from this same full-coverage baseline
rather than inheriting the omission silently.

---

## Cloudflare D1 REST API

Used at build time from Node. Never from a Worker — the Astro app declares no database binding,
which is the phase's core value expressed as configuration.

| capability | decision | reason |
|---|---|---|
| `POST /accounts/{a}/d1/database/{db}/query` | INTEGRATE | The loader's single read path (`src/lib/server/d1-client.ts`) and the pagination measurement harness. |
| `POST .../query` with a `{ batch: [...] }` body | OPT-OUT | The loader issues one paginated statement at a time, so the measurement must time that shape. A batched measurement would report a latency the production loader never pays. |
| `POST .../raw` | OPT-OUT | Returns a column-array form; this project's proven convention is the `results` array from `/query`, established in Phase 2. Two response shapes would mean two parsers. |
| `GET .../d1/database` (list databases) | OPT-OUT | The database id is pinned in configuration. Runtime discovery would add a failure mode without adding a capability. |
| `GET .../d1/database/{db}` (details) | OPT-OUT | No phase-3 need for database metadata; size and version are not inputs to any decision here. |
| `POST .../d1/database` (create) | OPT-OUT | The database exists and holds 42k production rows. PROJECT.md scopes v2 as read-only against production data. |
| `PATCH .../d1/database/{db}` (update settings) | OPT-OUT | Changing production database settings is outside a phase whose migration constraint is "zero-risk by construction". |
| `DELETE .../d1/database/{db}` | OPT-OUT | Destructive against the production corpus. Never in scope. |
| `POST .../d1/database/{db}/import` | OPT-OUT | This phase writes nothing to D1. |
| `GET .../d1/database/{db}/export` | OPT-OUT | Evaluated in `.claude/CLAUDE.md` as a fallback loader strategy (export a SQLite snapshot, read it locally). Not adopted this phase: D-01 requires the REST pagination path be measured first, and adopting the fallback before measuring would discard the measurement's purpose. Phase 4 may revisit it with the numbers 03-06 produces. |
| Time Travel / bookmark endpoints | OPT-OUT | Point-in-time recovery is an operational concern with no phase-3 trigger; nothing here mutates D1. |

## Cloudflare Workers KV API

The render manifest (REND-06). Build/render-time access only — these reads and writes do not sit
on the public request path and do not consume PROJECT.md's budget of at most 1 KV read/request.

| capability | decision | reason |
|---|---|---|
| `POST .../storage/kv/namespaces` (create namespace) | INTEGRATE | Creates the dedicated `915tldr-render-manifest` namespace (03-RESEARCH.md Open Question 2) rather than sharing the Nuxt app's existing namespace during the Phase 3-12 coexistence window. |
| `GET .../storage/kv/namespaces` (list) | INTEGRATE | Used to confirm the namespace exists and to record its id in `docs/phase-03/render-manifest.md`. |
| `PUT .../values/{key}` (write one) | INTEGRATE | The tracer's single-entry manifest write. |
| `PUT .../bulk` (write up to 10,000 pairs) | INTEGRATE | The corpus-scale write path. Per-key writes at 42k articles would be 42,000 round trips against a 1,200-requests-per-5-minutes API rate limit. |
| `GET .../values/{key}` (read one) | INTEGRATE | Staleness comparison against the stored content hash, and the tracer's read-back assertion. |
| `GET .../metadata/{key}` | OPT-OUT | All eight fields live in the value. A split value/metadata shape would create two schemas for one entry and two places for a reader to look. |
| `metadata` field on write | OPT-OUT | Same reason as above. |
| `expiration` / `expiration_ttl` on write | OPT-OUT | **Deliberately never used.** A manifest entry that expires silently erases render state, which inverts the manifest's purpose. Asserted by a guard in 03-04's acceptance criteria, not just documented here. |
| `GET .../keys` (list keys) | OPT-OUT | The render step derives its key set from the D1 row set it just read. Listing keys would create a second, divergeable source of truth for "what exists", and at 42k keys it is a paginated crawl to answer a question the caller already knows. |
| `DELETE .../values/{key}` / `.../bulk/delete` | OPT-OUT | No article-deletion or manifest-eviction path exists in this phase — nothing is ever removed, only added or overwritten. Eviction belongs with Phase 4's incremental build (REND-02/REND-03), which owns the lifecycle. Recorded so Phase 4 starts from full coverage rather than from this omission. |

## Cloudflare Rulesets API (Transform Rules)

Serves OPS-02's `X-Robots-Tag: noindex` on the dev host at the edge (D-08).

| capability | decision | reason |
|---|---|---|
| `GET /zones/{z}/rulesets/phases/http_response_headers_transform/entrypoint` | INTEGRATE | Read before write — a `PUT` to an entrypoint ruleset replaces every rule in it, so existing zone policy must be read and preserved. Also the read-back verification. |
| `PUT .../http_response_headers_transform/entrypoint` | INTEGRATE | Creates the noindex rule scoped to the exact dev hostname. |
| `http_request_transform` phase (request header / URL rewrite) | OPT-OUT | This phase rewrites no requests. The `/[category]/[slug]-[uuid]` URL contract carries over unchanged by requirement, so a rewrite rule would be a second, competing routing authority. |
| `http_request_firewall_custom` (WAF rules) | OPT-OUT | No access control is in scope for the dev host this phase (recorded as accepted threat T-03-14 with its rationale). Adding WAF policy here would be an undiscussed product decision. |
| `http_ratelimit` | OPT-OUT | No rate-limiting requirement in this phase; the public path is static assets served by the CDN. |
| Ruleset versioning / rollback endpoints | OPT-OUT | The rule's definition is recorded in `docs/phase-03/edge-config.md` and recreated from there, which is the recovery mechanism D-08's tradeoff calls for. Cloudflare-side version history is a second recovery path that would not be exercised or tested. |

## Workers platform (wrangler CLI and deployment API)

| capability | decision | reason |
|---|---|---|
| `wrangler deploy` | INTEGRATE | Deploys `915tldr-v2` to `dev.915tldr.com`. |
| `wrangler kv namespace create` / `kv bulk put` | INTEGRATE | Manifest namespace and bulk writes. |
| Custom-domain route binding | INTEGRATE | Binds the dev hostname, and only that hostname. |
| Workers Static Assets (`assets` directory binding, `run_worker_first: false`) | INTEGRATE | The mechanism by which a public request never invokes the Worker, which is how zero D1 reads is achieved structurally rather than by policy. |
| `wrangler delete` | INTEGRATE | Removes the CPU-ceiling probe Worker after 03-06's measurement. A leftover CPU-burning Worker on a cron schedule is a standing cost with no owner. |
| Cron Triggers | INTEGRATE | Only for 03-06's throwaway measurement probe, at a 2-hour interval matching production's so it falls in the same CPU-ceiling row. |
| Workers Observability / `wrangler tail` | INTEGRATE | Reads the existing production cron Worker's real CPU time per invocation, so headroom is measured rather than estimated. |
| Workers Builds CI environment variables (`WORKERS_CI_COMMIT_SHA`, `WORKERS_CI_BRANCH`, `CI`, `WORKERS_CI`) | INTEGRATE | The build stamp's primary hash source (OPS-05/OPS-06), with a documented local-git fallback and a `hashSource` field recording which fired. |
| `wrangler versions upload` / gradual deployments | OPT-OUT | PROJECT.md states rollback is a DNS/route change and v1 keeps serving throughout, so a gradual-rollout mechanism has nothing to roll back to within v2 this phase. Phase 12's cutover is where it becomes relevant. |
| Queues | OPT-OUT | **For this phase only, and not as a rejection.** Queues is one of the three candidate render-step locations under D-01, and that decision is made in 03-07 from measured numbers. Implementing it before the measurement would pre-empt the decision D-01 deliberately deferred. |
| Durable Objects | OPT-OUT | No coordination or shared mutable state requirement in this phase. |
| R2 bucket bindings | OPT-OUT | The R2 archive tier is Phase 5 (REND-07 through REND-12). Binding it here would add a reachable storage surface with no consumer. |
| Workers AI binding | OPT-OUT | Summarisation runs in the pipeline app (sibling repo, OpenAI), not in the public site. Out of scope by architecture, not by omission. |
| Hyperdrive / Vectorize / Browser Rendering bindings | OPT-OUT | No requirement in this phase touches any of them; binding an unused service would widen the deployed Worker's reachable surface against the phase's own core value. |

---

## Baseline note for later integrations

Per the coverage rule, a second integration against the same need starts from this same
full-coverage baseline. Phases 4, 5 and 6 each touch D1 and KV again; they inherit the
capability list above but **not** these opt-out decisions. Three in particular are marked
explicitly as this-phase-only and must be re-decided rather than carried: KV key deletion
(Phase 4's eviction), the D1 export/snapshot loader strategy (Phase 4, once 03-06's pagination
numbers exist), and Queues (03-07's render-step decision).

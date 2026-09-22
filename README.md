# 915 TLDR — v2 Rebuild

915 TLDR is a local news aggregator for El Paso. It pulls RSS from three local outlets,
summarises each article with an LLM, tags and categorises it, detects cross-source duplicates,
and publishes the result as a free, ad-free community news site.

**This repository is the v2 public site and its delivery architecture** — the Astro app that
readers actually hit. It is a rebuild of the public site and how it's served, not of the
ingestion/summarisation pipeline behind it.

**The pipeline and admin app live in the sibling `915tldr.com2` tree, not here.** RSS ingestion,
LLM summarisation, tagging, dedup, and the Nuxt-based admin UI are a separate repository. This
repo reads the same production D1 database that pipeline writes to, but contains none of its
ingestion or generation code. If you're looking for "how does an article get summarised," you
want the other tree.

## The read budget, in numbers

This is the centrepiece of the rebuild. v1 measured **784,000,000 D1 reads/day** against a PRD
that forecast ~50,000/day — a 15,680× miss, on traffic that matched the original forecast almost
exactly. v2 exists to make that architecturally impossible to repeat, not just less likely.

**Zero D1 reads on the public request path. Not "fewer" — architecturally zero, enforced
structurally at build time. Everything else in this rebuild is negotiable; this is not.**

| Budget line | Limit | Enforcement |
|---|---|---|
| D1 reads per public request | **0** — hard fail above 0 | Build-time assertion; no public route can import the D1 binding |
| D1 reads per day | under 2,000,000 sustained; **hard fail above 5,000,000** | Measured in Phase 5 (see below) |
| Worker CPU per request | under 5 ms | Measured in Phase 5 |
| KV reads per request | at most 1 | Measured in Phase 5 |

### Core Web Vitals (release-blocking, not aspirational)

| Metric | Target |
|---|---|
| LCP | under 1.5 s |
| INP | under 100 ms |
| CLS | under 0.05 |
| FCP | under 1.0 s |

All four are measured mobile, p75, field data — not lab scores, and not negotiable at release.

## How the zero is enforced

A budget with no enforcement named is an aspiration, not a guarantee. Three mechanisms, in
order of what they can see:

- **`tools/assert-no-d1.mjs`** — a Vite/Rollup plugin registered in `astro.config.mjs` that runs
  inside `astro build`'s own module-resolution pass. It walks the real, already-resolved module
  graph from every public entrypoint (every non-prerendered `.astro` page, every server island,
  every middleware and API endpoint) and fails the build if any of them can reach the single D1
  chokepoint module (`src/lib/server/d1-client.ts`). Prerendered pages are exempt by design —
  their D1 access runs once, at build time, in Node, and is never bundled into the deployed
  Worker.
- **`tests/ci-fixtures/`** — permanent negative fixtures that drive the real checker above
  against deliberately-violating and deliberately-clean inputs on every commit, plus a
  non-vacuity guard so the checker can't silently start matching zero entrypoints and pass by
  doing nothing. This exists because Phase 2 shipped a check that had silently stopped gating
  while 253 production rows violated the requirement it was supposed to enforce — a check that
  exists is not a guard; a check proven to reject a real violation, on every commit, is.
- **`tools/check-config-guards.mjs`** — a config scan for the one class of drift the module-graph
  walk cannot see by construction: a `d1_databases` binding declared directly in `wrangler.jsonc`
  is not a module import, so it's invisible to a graph walk. This guard also catches two removed
  Astro/adapter APIs (`Astro.locals.runtime.env`, the `output: 'hybrid'` keyword) reverting into
  the codebase.

Run all three: `pnpm test:unit` (wires in `guard:config` and the build) and
`pnpm test:build-gate` (the CI-fixture suite).

## Where each number gets proven

Everything above is a build-time guarantee or a claim. **ROADMAP Phase 5: Hybrid Archive &
Zero-Reads Proof** is where these numbers stop being claims and become measured gates — it halts
the project on a non-zero or over-budget result rather than letting a miss ship quietly.

## `/version.json`

A static, prerendered endpoint (`src/pages/version.json.ts`) exposing the deployed build's
identity for scripted checks. Example shape (values change every build):

```json
{ "commit": "83f9772", "builtAt": "2026-09-22T19:56:04.418Z", "hashSource": "local-git" }
```

It costs zero D1 reads and zero Worker invocations to fetch — it's a real file in `dist/client/`,
not an on-demand route, the same architecture every other public path in this app uses. The
public footer (`src/layouts/Base.astro`) renders the same `commit` and `builtAt` values, read
from the same source module (`src/lib/build-info.ts`) — neither surface computes its own hash or
timestamp, so they cannot disagree.

`hashSource` tells you whether to trust the hash:

- **`workers-ci`** — the hash came from Cloudflare Workers Builds' own injected
  `WORKERS_CI_COMMIT_SHA` variable. The platform vouches for this value; it cannot be wrong about
  what it deployed.
- **`local-git`** — the hash came from `git rev-parse --short=7 HEAD` on the machine that ran
  `wrangler deploy`. This is the value you'll actually see today: this project deploys via local
  `wrangler deploy`, not git-connected Workers Builds CI (confirmed by querying the Workers
  Builds API for this account's existing Workers, which show zero build history, plus the
  absence of a `.github/` directory or configured git remote in this repo). A `local-git` hash is
  only as trustworthy as the developer's own checkout at deploy time.
- **`unknown`** — no source was available, or the build ran inside a CI environment (`CI` or
  `WORKERS_CI` set) without `WORKERS_CI_COMMIT_SHA` present. The git fallback is deliberately
  refused inside any CI environment, because a shallow CI checkout's `git rev-parse` can return a
  hash that was never the deploy target — an `unknown` stamp is safer than a silently wrong one.

## How to run it

```bash
pnpm install
pnpm dev              # local dev server
pnpm build             # astro build — emits dist/client/
pnpm preview           # preview the built output
pnpm test:unit         # builds, then runs the full node:test unit suite
pnpm test:build-gate   # permanent D1-import negative-fixture suite
pnpm guard:config      # config-drift guard alone (ARCH-04/ARCH-05/D1-binding)
pnpm deploy            # wrangler deploy
```

This project's package manager is **pnpm** — `npm run` and `yarn` are not supported here.

# 2026-09-22 - 915tldr-v2 deployed to dev.915tldr.com, production untouched

**Keywords:** [DEPLOYMENT] [INFRA] [BUG_FIX] [SECURITY] [CONFIG]
**Session:** Evening continuation, Task 1 of 03-05-PLAN.md (executed after Task 2's noindex rule)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2235_03-05-deploy-915tldr-v2-to-dev-hostname.md`

## What Changed

- File: `wrangler.jsonc`
  - Added `"workers_dev": false` — omitting it defaults to `true` and hands the Worker a free
    public `915tldr-v2.jjaimealeman.workers.dev` hostname outside the noindex Transform Rule's
    exact-hostname match (Rule 2 deviation)
  - Added `"routes": [{"pattern": "dev.915tldr.com", "custom_domain": true}]`
- File: `astro.config.mjs`
  - Moved `session: false` from inside the `cloudflare({...})` adapter call to Astro's own
    top-level `defineConfig({...})` key, where the adapter actually reads it (Rule 1 bug fix —
    see "Issues Encountered")
- Cloudflare zone/account changes (not in git, recorded here and in `docs/phase-03/edge-config.md`):
  - Reassigned the `dev.915tldr.com` Custom Domain from service `915tldr-dev` to `915tldr-v2`
  - Deleted the stale zone Worker Route `dev.915tldr.com/*` -> `915tldr-dev` (id
    `db8baf2b1b6d49428a88699e8708b09d`) — see "Issues Encountered"

## Why

PLAN.md 03-05 Task 1: put the tracer on a real, publicly reachable host
(`dev.915tldr.com`) without disturbing production or the newly-bound `admin-dev.915tldr.com`.
The Worker itself is now live and reachable at its real article URL, reading the same D1 row it
proved in 03-01, with the build-stamp footer (03-03) agreeing with `/version.json`.

## Issues Encountered

**1. [Rule 1 - Bug] `session: false` was a no-op — 03-01's session-disabling fix never worked.**
`@astrojs/cloudflare`'s `astro:config:setup` hook reads `config.session` (Astro's own top-level
config field, per `astro/dist/types/public/config.d.ts`), not an adapter option. 03-01 had set
`session: false` *inside* the `cloudflare({...})` call, where the adapter's
`...cloudflareOptions` spread silently absorbed and ignored it. First real `wrangler deploy`
(this task) still showed `env.SESSION` bound with no id and logged "Enabling sessions with
Cloudflare KV" on every build — contradicting 03-01-SUMMARY.md's claim that this was fixed.
Root-caused by reading the adapter's own source (`node_modules/@astrojs/cloudflare/dist/index.js`)
rather than assuming the prior fix held. Corrected by moving the key to where Astro itself reads
it; rebuild confirmed the log line gone and `dist/client/wrangler.json`'s `kv_namespaces` no
longer lists `SESSION`.

**2. [Rule 1 - Bug] Custom Domain reassignment did not take effect while a stale zone Worker
Route for the same hostname still existed, despite Cloudflare's own docs stating Custom Domains
take precedence over Routes.** After reassigning `dev.915tldr.com`'s Custom Domain to
`915tldr-v2` (confirmed correct via `GET /accounts/.../workers/domains`), live traffic kept
serving the old `915tldr-dev` Nuxt app (`x-powered-by: Nuxt`) for 3+ minutes across 17 polling
attempts with fresh `cf-ray` IDs each time — ruling out both propagation lag and HTTP caching
(no `cf-cache-status` header was present, so the response was not a cached object). The zone
still carried a pre-existing Worker Route, `dev.915tldr.com/*` -> `915tldr-dev`
(id `db8baf2b1b6d49428a88699e8708b09d`), predating this plan. PLAN.md's own Task 1 step 5
anticipated exactly this cleanup ("remove the now-redundant dev.915tldr.com binding for
915tldr-dev"); deleting that Route via the API immediately resolved it — the next request served
`915tldr-v2` correctly. Recorded as a real, live-observed exception to the documented precedence
rule on this account, not assumed from the docs alone.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested (all live, against the real deployed edge, not inspection):
  - `https://dev.915tldr.com/version.json` — 200, `{"commit":"a083d12","builtAt":"...","hashSource":"local-git"}`
  - The real tracer article page — 200, headline `<h1>` matches the live D1 row, footer stamp
    `build a083d12` matches `/version.json`'s commit
  - `X-Robots-Tag: noindex` present on `/` (404 — this tracer has no homepage yet, expected), the
    article page (200), and a nonexistent path (404, Worker-generated)
  - `admin-dev.915tldr.com` still serves Nuxt with `noindex` intact after the dev.915tldr.com
    change
  - `915tldr.com` and `www.915tldr.com` both still 200, `x-powered-by: Nuxt`, no
    `X-Robots-Tag` — production genuinely unaffected by either the Custom Domain reassignment or
    the Route deletion
  - `https://915tldr-v2.jjaimealeman.workers.dev/` returns 404 — confirms `workers_dev: false`
    took effect, no duplicate crawlable host was created
  - `node tools/check-config-guards.mjs` and the wildcard/production-pattern grep both pass
- What wasn't tested: `tools/verify-edge-headers.mjs` (Task 3, not yet built at this point in
  the plan) and the one-time production-control inversion (also Task 3).

## Next Steps

- [ ] Build `tools/verify-edge-headers.mjs` and wire the `verify:edge` npm script (Task 3)
- [ ] Consider whether the Route-vs-Custom-Domain precedence exception found here is
      account-wide or specific to this hostname's history — worth a note in
      `jja-cloudflare-deploy` if it recurs on another zone

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** HIGH - first real `wrangler deploy` of a new production-adjacent app; two real bugs
found and fixed (session KV binding, Route/Custom-Domain precedence); production verified
unaffected throughout

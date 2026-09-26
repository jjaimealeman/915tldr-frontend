---
phase: 03-foundation-read-budget-guardrails
plan: 05
subsystem: infra
tags: [cloudflare, wrangler, transform-rules, workers-custom-domains, astro, edge-security, noindex]

requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "03-01's buildable Astro app and wrangler.jsonc shape; 03-02's config guards; 03-03's build-stamp module (/version.json + footer); 03-04's render manifest"
provides:
  - "915tldr-v2 (Astro tracer) live and publicly reachable on dev.915tldr.com, its own Custom Domain, workers_dev disabled"
  - "A Cloudflare zone Transform Rule (http_response_headers_transform phase) setting X-Robots-Tag: noindex on dev.915tldr.com AND admin-dev.915tldr.com, recorded and recreatable from docs/phase-03/edge-config.md"
  - "tools/verify-edge-headers.mjs / `pnpm verify:edge` — a standing, re-runnable live proof of the edge noindex policy across a static response, a genuinely Worker-generated response, and a production negative control"
  - "A real, deploy-proven wrangler.jsonc shape (workers_dev: false, custom_domain route) — closes 03-01's open coverage item D6"
  - "A corrected astro.config.mjs: session: false moved to Astro's own top-level config key, where the adapter actually reads it (03-01's original fix never worked)"
affects: [03-06, 03-07, phase-08-server-islands, phase-12-cutover]

actuals:
  tokens: 10387
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Zone-level Cloudflare Transform Rule (http_response_headers_transform phase) for noindex, not a _headers file and not a Worker-set header — covers both static-asset and Worker-generated responses on hosts with `run_worker_first: false`"
    - "A live verification script (tools/verify-edge-headers.mjs) that checks real HTTP responses against the deployed edge, never the Rulesets API's own description of a rule — proves behavior, not configuration presence"
    - "Custom Domain reassignment via the Workers Custom Domains API (PUT /accounts/{account}/workers/domains) plus wrangler.jsonc's `routes: [{pattern, custom_domain: true}]` declaration for documentation/future-deploy safety"

key-files:
  created:
    - docs/phase-03/edge-config.md
    - tools/verify-edge-headers.mjs
  modified:
    - wrangler.jsonc
    - astro.config.mjs
    - package.json

key-decisions:
  - "Extended the noindex Transform Rule to cover admin-dev.915tldr.com as well as dev.915tldr.com (deviation Rule 2) — admin-dev didn't exist when PLAN.md's Task 2 was scoped, and this same plan's Task 1 bound it to the Nuxt pipeline/admin app; shipping the rule as originally scoped would have left a new crawlable admin surface."
  - "Task order executed as noindex rule FIRST, then deploy, per the orchestrator's mandatory ordering (not PLAN.md's literal Task-1-then-Task-2 numbering) — proven safe here because admin-dev.915tldr.com was already live, letting the rule be verified by response header before any v2 code existed."
  - "The Worker-generated-response check in tools/verify-edge-headers.mjs deliberately targets admin-dev.915tldr.com's real Nuxt SSR 404, not a same-app static-asset-miss on dev.915tldr.com — the Astro tracer currently ships zero server-rendered routes of its own (no server:defer islands yet), so admin-dev's genuine SSR 404 is a strictly more rigorous proof of D-08's rationale than anything available on the app Task 1 deployed."
  - "The stale zone Worker Route (dev.915tldr.com/* -> 915tldr-dev) was deleted after confirming it was actively out-prioritizing the freshly-reassigned Custom Domain in practice, contrary to Cloudflare's documented Custom-Domain-over-Route precedence — this exception is recorded as a live-observed finding, not assumed from docs alone."

patterns-established:
  - "Live-response verification pattern for zone-level config that lives outside version control: record the exact API definition + recreation procedure in a docs/ file, then back it with a CLI that asserts on real HTTP responses, never on the config API's own echo of what it thinks is configured."

requirements-completed: [OPS-02]

coverage:
  - id: D1
    description: "Cloudflare zone Transform Rule sets X-Robots-Tag: noindex on dev.915tldr.com and admin-dev.915tldr.com; absent on 915tldr.com and www.915tldr.com; fires on both a static-asset response and a genuinely Worker-generated response"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "pnpm verify:edge (tools/verify-edge-headers.mjs) — 4/4 checks pass against the live edge"
        status: pass
      - kind: other
        ref: "manual curl -sS -D - against dev.915tldr.com, admin-dev.915tldr.com, 915tldr.com, www.915tldr.com — recorded in changelog/2026-09-22-2223_* and 2026-09-22-2235_*"
        status: pass
    human_judgment: false
  - id: D2
    description: "915tldr-v2 deployed and serving the real tracer article on dev.915tldr.com; workers_dev disabled; production and admin-dev unaffected"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "live curl https://dev.915tldr.com/version.json, the real article page, and https://915tldr-v2.jjaimealeman.workers.dev/ (404, confirming workers_dev:false took effect) — recorded in changelog/2026-09-22-2235_*"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/phase-03/edge-config.md records the rule's exact definition and a from-scratch recreation procedure sufficient to survive the rule's deletion"
    requirement: "OPS-02"
    verification:
      - kind: manual_procedural
        ref: "docs/phase-03/edge-config.md — contains ruleset id, rule id, exact expression/action JSON, pre-existing-ruleset finding (none existed), and the curl-based recreation steps"
        status: pass
    human_judgment: false
  - id: D4
    description: "tools/verify-edge-headers.mjs is a re-runnable one-command check, proven causal (not always-green) via a one-time production-control inversion, and does not swallow network failures into a pass"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "manual run with --prod-host=dev.915tldr.com — correctly fails (exit 1); manual run with unreachable hostnames — correctly fails (exit 1, network error reported per check)"
        status: pass
    human_judgment: false

duration: ~65min (this continuation, resumed after the Rulesets API scope was granted)
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 5: Edge Noindex + First Real Deploy Summary

**915tldr-v2 is live on dev.915tldr.com behind a Cloudflare Transform Rule that noindexes both dev.915tldr.com and admin-dev.915tldr.com at the edge, re-provable on every deploy by `pnpm verify:edge` — and the first real `wrangler deploy` surfaced two genuine bugs (a no-op session config, a stale route silently out-prioritizing a Custom Domain reassignment) that no build-only test had ever exercised.**

## Performance

- **Duration:** ~65 min (this continuation; resumed after the CLOUDFLARE_API_TOKEN gained Zone Rulesets scope — Step 1 of the mandatory ordering, `admin-dev.915tldr.com` -> `915tldr-dev`, was already live and verified from a prior session)
- **Completed:** 2026-09-23T04:42:00Z
- **Tasks:** 3 (executed noindex-rule-first per the orchestrator's mandatory ordering, not PLAN.md's literal Task 1/Task 2 numbering)
- **Files modified:** 5 (2 new: `docs/phase-03/edge-config.md`, `tools/verify-edge-headers.mjs`; 3 modified: `wrangler.jsonc`, `astro.config.mjs`, `package.json`)

## Accomplishments
- Created the zone-level `http_response_headers_transform` Transform Rule (ruleset `3a5a0393fd8243e1ae3f22bd900533dc`, rule `noindex_dev_hosts`) setting `X-Robots-Tag: noindex` on **both** `dev.915tldr.com` and `admin-dev.915tldr.com` — verified live on `admin-dev.915tldr.com` (already serving) before any v2 code existed, closing the window PLAN.md's mandatory ordering exists to prevent
- Deployed `915tldr-v2` for the first time ever: `wrangler.jsonc` now declares `workers_dev: false` and a `custom_domain` route; the Custom Domain for `dev.915tldr.com` was reassigned from `915tldr-dev` to `915tldr-v2` via the Workers Custom Domains API
- Found and fixed two real bugs this deploy surfaced that no prior build-only test could see: (1) `session: false` was a no-op in the wrong config location — 03-01's claimed fix never actually worked; (2) a stale zone Worker Route silently out-prioritized the freshly-reassigned Custom Domain for 3+ minutes, contrary to Cloudflare's own documented precedence — closes 03-01's flagged coverage item D6
- Built `tools/verify-edge-headers.mjs` (`pnpm verify:edge`): four live HTTP checks (static asset, genuinely Worker-generated 404 on admin-dev's real Nuxt SSR, production negative control, app-level-meta-tag absence), proven causal via a one-time production-control inversion and an unreachable-host non-zero-exit test
- Confirmed throughout: `915tldr.com` and `www.915tldr.com` untouched (200, Nuxt, no noindex header) at every checkpoint; `admin-dev.915tldr.com` still serves Nuxt after the `dev.915tldr.com` reassignment

## Task Commits

1. **Task 2 (executed first, per mandatory ordering): Edge noindex Transform Rule, extended to cover admin-dev.915tldr.com** - `a083d12` (docs)
2. **Task 1: Deploy 915tldr-v2 to dev.915tldr.com** - `03d4e35` (feat)
3. **Task 3: verify:edge command** - `5bcc358` (test)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `docs/phase-03/edge-config.md` - Exact Transform Rule definition, pre-existing-ruleset finding (none existed on this zone's `http_response_headers_transform` phase before this plan), full curl-based recreation procedure, required token scopes, and a never-broaden-past-exact-hostnames warning
- `tools/verify-edge-headers.mjs` - Four-check live edge verifier (`pnpm verify:edge`); `--json` support; exits non-zero on any failure or network error
- `wrangler.jsonc` - Added `workers_dev: false` and `routes: [{pattern: "dev.915tldr.com", custom_domain: true}]`
- `astro.config.mjs` - Moved `session: false` from inside the Cloudflare adapter call to Astro's own top-level config key (the location the adapter actually reads); added a comment warning future editors not to write the adapter-call-name-plus-paren sequence inside a comment above the real call (this exact mistake broke `tests/unit/astro-config.test.mjs`'s ARCH-06 check mid-task and was caught and fixed before considering the plan done)
- `package.json` - Added `verify:edge` script

## Decisions Made
- Extended noindex scope to `admin-dev.915tldr.com` (Rule 2 deviation) — see frontmatter `key-decisions` for full rationale.
- Executed the noindex-rule task before the deploy task, per the orchestrator's mandatory ordering, so the rule was proven live on `admin-dev.915tldr.com` before any v2 code shipped to `dev.915tldr.com` — no unprotected crawlable window ever existed.
- `tools/verify-edge-headers.mjs`'s Worker-generated-response check targets `admin-dev.915tldr.com` rather than `dev.915tldr.com` itself, because the Astro tracer has no server-rendered routes of its own yet. Documented at length in the script's own header comment so a future editor doesn't "fix" the expected 404 or relocate the check without understanding why the current target is the more rigorous proof.
- Deleted the stale zone Worker Route for `dev.915tldr.com/*` -> `915tldr-dev` after confirming (17 polling attempts over 3+ minutes, fresh `cf-ray` IDs, no `cf-cache-status` header — ruling out both propagation lag and HTTP caching) that it was actively out-prioritizing the correctly-reassigned Custom Domain. PLAN.md's own Task 1 step 5 anticipated exactly this cleanup.
- `verify:edge` deliberately NOT added to `pnpm test:unit` — it depends on live network access to the real deployed zone and would fail the unit suite offline or the instant zone config changes; it is a standing, separately-run deploy check instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Noindex rule scope extended to `admin-dev.915tldr.com`**
- **Found during:** Task 2 (noindex rule creation, executed first)
- **Issue:** PLAN.md's Task 2 named only `dev.915tldr.com`, written before this same plan's Task 1 bound `admin-dev.915tldr.com` to the Nuxt pipeline/admin app. Shipping the rule as originally scoped would leave a brand-new, publicly reachable admin surface fully crawlable.
- **Fix:** The rule's `http.host in {}` expression lists both exact hostnames.
- **Files modified:** `docs/phase-03/edge-config.md` (new)
- **Verification:** Live `curl` header check on both hosts, both static and Worker-generated (Nuxt SSR) responses, before any v2 code existed.
- **Committed in:** `a083d12`

**2. [Rule 1 - Bug] `session: false` was a no-op in the wrong config location**
- **Found during:** Task 1 (first real `wrangler deploy`)
- **Issue:** `@astrojs/cloudflare`'s `astro:config:setup` hook reads `config.session` — Astro's own top-level `defineConfig()` key — not an adapter option. 03-01 had set `session: false` *inside* the `cloudflare({...})` call, where the adapter's `...cloudflareOptions` spread silently absorbed and ignored it. 03-01-SUMMARY.md's claim that this was fixed did not hold: the first real deploy still showed `env.SESSION` bound with no id and logged "Enabling sessions with Cloudflare KV" on every build.
- **Fix:** Moved `session: false` to Astro's top-level config key.
- **Files modified:** `astro.config.mjs`
- **Verification:** Rebuild no longer logs the sessions-enabled line; `dist/client/wrangler.json`'s `kv_namespaces` no longer lists `SESSION`; the real deploy's binding table shows only `env.RENDER_MANIFEST`.
- **Committed in:** `03d4e35`

**3. [Rule 1 - Bug] Stale zone Worker Route out-prioritized the reassigned Custom Domain**
- **Found during:** Task 1 (first real `wrangler deploy`)
- **Issue:** After reassigning `dev.915tldr.com`'s Custom Domain to `915tldr-v2` (confirmed correct via the Workers Custom Domains API), live traffic kept serving the old `915tldr-dev` Nuxt app for 3+ minutes across repeated polls — contrary to Cloudflare's documented "Custom Domain takes precedence over Route" behavior. A pre-existing zone Worker Route (`dev.915tldr.com/*` -> `915tldr-dev`, predating this plan) was still present.
- **Fix:** Deleted the stale Route via the API, per PLAN.md's own anticipated cleanup step (Task 1, "remove the now-redundant dev.915tldr.com binding for 915tldr-dev").
- **Files modified:** None (Cloudflare zone config only; recorded here and in the changelog).
- **Verification:** Immediately after deletion, `dev.915tldr.com` began serving `915tldr-v2` (confirmed via `/version.json` and the article page).
- **Committed in:** `03d4e35` (documented in its changelog entry; the API-level change itself has no git diff)

**4. [Rule 1 - Bug] Self-inflicted test regression from the session-fix's own explanatory comment**
- **Found during:** Task 3, final `pnpm test:unit` run before considering the plan complete
- **Issue:** The comment explaining deviation #2 above literally contained the adapter-factory-name-immediately-followed-by-an-open-paren sequence, which `tests/unit/astro-config.test.mjs`'s non-comment-aware `indexOf()`-based ARCH-06 check searches for — the comment's mention was matched instead of the real adapter call, breaking the test.
- **Fix:** Reworded the comment to describe the sequence without forming it.
- **Files modified:** `astro.config.mjs`
- **Verification:** `pnpm test:unit` is 87/87 again.
- **Committed in:** `5bcc358`

---

**Total deviations:** 4 auto-fixed (1 Rule 2 missing-critical, 3 Rule 1 bugs). Two of the Rule 1 bugs (#2, #3) were pre-existing defects this plan's first real deploy exposed, not defects this plan's own new code introduced; the third (#4) was self-inflicted mid-task and caught before completion.
**Impact on plan:** All fixes were necessary for the deploy to actually work as intended or for the test suite to hold. No scope creep — every fix stayed inside `wrangler.jsonc`/`astro.config.mjs`, files this plan was already touching, or Cloudflare zone config this plan was already managing.

## Issues Encountered

Beyond the four deviations documented above (all resolved within budget, no task exceeded 3 auto-fix attempts): none. The two blocking gates from the prior session (hostname decision, Zone Rulesets token scope) were both already resolved by the owner before this continuation started.

## User Setup Required

None further. `CLOUDFLARE_API_TOKEN` now carries every scope this plan needed (`Account Rulesets:Edit`, `Transform Rules:Edit` on all zones, plus the pre-existing `Workers Scripts:Edit`, `Workers KV Storage:Edit`, `D1:Edit`).

**Separate, deliberately untouched:** `/home/jaime/www/_github/915tldr.com2/wrangler.dev.jsonc` (a different repo, on `develop`, a protected branch) was edited by the orchestrator in a prior turn to change its route pattern from `dev.915tldr.com/*` to `admin-dev.915tldr.com/*` — closing the risk that a future deploy of that Nuxt app would silently re-claim `dev.915tldr.com`. That edit is left uncommitted for the owner to review in lazygit. Not touched, not committed, not revisited by this plan.

## Next Phase Readiness
- OPS-02 is fully satisfied and re-verifiable on every future deploy via `pnpm verify:edge` — no phase downstream needs to re-derive this.
- `wrangler.jsonc`'s real deploy shape is now proven against a live `wrangler deploy` for the first time, closing 03-01's flagged coverage item D6. Future phases building on this app's config no longer need to treat `assets.directory: "dist/client"`, the absent `main` field, or `session: false`'s correct location as unverified inferences.
- Phase 8 (Server Islands & Interactivity) will introduce this app's first `server:defer` islands and its first genuinely Worker-generated responses of its own. When that lands, `tools/verify-edge-headers.mjs`'s Worker-generated-response check should be revisited — it may become appropriate to add a same-app check on `dev.915tldr.com` at that point, alongside (not instead of) the existing `admin-dev.915tldr.com` check.
- Phase 12's cutover plan (Astro takes `915tldr.com`, Nuxt moves to `admin.915tldr.com`) is unaffected by this plan's work — `dev.915tldr.com` and `admin-dev.915tldr.com` are both non-production hostnames scoped entirely within Phase 3's guardrails.
- No blockers remain from this plan.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 5 created/modified files verified present on disk (`docs/phase-03/edge-config.md`,
`tools/verify-edge-headers.mjs`, `wrangler.jsonc`, `astro.config.mjs`, `package.json`). All 3
task commit hashes (`a083d12`, `03d4e35`, `5bcc358`) verified present in `git log --oneline
--all`. No missing items.

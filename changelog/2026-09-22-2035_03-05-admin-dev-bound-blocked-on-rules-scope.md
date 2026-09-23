# 2026-09-22 - Plan 03-05 resumed on owner's hostname decision; halted again at the noindex rule (token scope)

**Keywords:** [DOCUMENTATION] [INFRA] [DEPLOYMENT] [SECURITY]
**Session:** Evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2035_03-05-admin-dev-bound-blocked-on-rules-scope.md`

## What Changed

- File: `.planning/STATE.md`
  - Replaced the prior "needs a human hostname decision" blocker with a new one recording
    live infrastructure progress and a new, different blocker.
  - No application code, `wrangler.jsonc`, or `package.json` touched — Tasks 1-3 of
    03-05-PLAN.md are still fully unexecuted. This session executed a preparatory
    infrastructure step ahead of Task 1, per the owner's resolution of the prior halt.
- Cloudflare account infrastructure (not a repo file — recorded here for the audit trail
  `docs/phase-03/edge-config.md` will formalize once the plan resumes):
  - Created an account-level Workers Custom Domain: `admin-dev.915tldr.com` -> service
    `915tldr-dev` (id `fc443b5c9166df401f32c69cc856ccc57bcbf413`), zone `915tldr.com`.
    Verified live: HTTP 200, `x-powered-by: Nuxt` — the v1 Nuxt app is now reachable at
    both `dev.915tldr.com` (unchanged) and `admin-dev.915tldr.com` (new).

## Why

The owner resolved the prior halt (see `2026-09-22-1422_03-05-blocked-dev-hostname-already-taken.md`):
`dev.915tldr.com` goes to v2 (matching the project's established dev-tier naming and the
fact that v2 is the site being built); the v1 Nuxt app moves to `admin-dev.915tldr.com`,
one step of the eventual Phase 12 cutover (PROJECT.md: Nuxt retained "for pipeline/admin")
done early rather than a new convention.

The resolution came with a mandatory five-step ordering so the Nuxt app never loses its
home and no host is ever crawlable-and-unprotected: (1) bind `admin-dev` to the Nuxt
Worker without removing `dev.`'s existing binding yet, (2) create the noindex Transform
Rule covering both hostnames, (3) only then deploy v2 and rebind `dev.`, (4) verify by
live header, (5) remove the now-redundant `dev.` binding on the old Worker. Step 1 is
done and verified. Step 2 is where this session stopped: the Cloudflare Rulesets API
(`http_response_headers_transform` phase, needed for the noindex rule) returned
`{code: 10000, message: "Authentication error"}` on two independent calls (`GET
.../rulesets/phases/http_response_headers_transform/entrypoint` and `GET .../rulesets`),
while a control call against the same token (`GET .../settings/always_use_https`)
succeeded — confirming a genuine scope gap (missing Zone Transform Rules / Rulesets-API
permission), not a broken or expired token. 03-05-PLAN.md's own Task 1 action block and
this session's checkpoint instructions both require stopping and naming the exact missing
scope rather than working around it, so execution halted here rather than deploying v2
to `dev.915tldr.com` ahead of the rule that is supposed to protect it — the plan is
explicit that doing so would open an unprotected crawlable window.

## Issues Encountered

`CLOUDFLARE_API_TOKEN` needs an added scope before this plan can continue: Zone >
Transform Rules > Edit (the permission group backing the Rulesets API's
`http_response_headers_transform` phase) on the `915tldr.com` zone. The token otherwise
works correctly — Workers Custom Domains, Zone Settings reads, and `wrangler whoami` all
succeeded in this same session with the same token.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the new `admin-dev.915tldr.com` binding, live, by polling for HTTP 200
  and inspecting response headers (`x-powered-by: Nuxt` present, matching the existing
  `dev.915tldr.com` response). The Rulesets-API failure was confirmed with two independent
  endpoints plus a same-token control call that succeeded, to rule out a token-wide
  problem before concluding it's scope-specific.
- What wasn't tested: the Transform Rule (not yet created), the v2 deploy (not yet
  attempted, deliberately, per the mandatory ordering), and production — `915tldr.com`
  and `www.915tldr.com` were not touched or queried this session beyond the read-only
  zone-level API calls already covered by 03-01 through 03-04.
- Edge cases: N/A — this is infrastructure sequencing, not application code.

## Next Steps

- [ ] Owner (or whoever holds the Cloudflare dashboard) adds Zone > Transform Rules >
      Edit to `CLOUDFLARE_API_TOKEN` on the `915tldr.com` zone.
- [ ] Resume 03-05 from mandatory-ordering Step 2 (create the Transform Rule covering
      both `dev.915tldr.com` and `admin-dev.915tldr.com`) — do not redo Step 1.
- [ ] Separately, flag for the owner: `915tldr.com2/wrangler.dev.jsonc` (a different git
      repo, currently on its protected `develop` branch) still declares
      `routes: [{ pattern: "dev.915tldr.com/*", ... }]` for the `915tldr-dev` Worker. The
      live Custom Domain move in Step 3 will not update that file. A future
      `wrangler deploy --config wrangler.dev.jsonc` from that repo would re-assert the old
      route and could silently revert this migration. That file was intentionally left
      unedited and uncommitted here — per this account's branch-aware permission rules,
      committing to `develop` requires the owner's explicit say-so, and it lives in a
      separate repository outside this plan's declared file scope.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** LOW for this repo (docs-only commit, no app code). MEDIUM for live
infrastructure: `admin-dev.915tldr.com` is now a new, real, un-noindexed public host
serving the same unreviewed-content exposure `dev.915tldr.com` already carries (T-03-14,
accepted risk) — time-sensitive until the Transform Rule (Step 2) lands.

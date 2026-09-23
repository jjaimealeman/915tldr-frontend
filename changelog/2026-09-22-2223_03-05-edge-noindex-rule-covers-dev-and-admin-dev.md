# 2026-09-22 - Edge noindex Transform Rule now covers dev and admin-dev

**Keywords:** [INFRA] [SECURITY] [DEPLOYMENT] [DOCUMENTATION]
**Session:** Evening continuation, resumed after the Rulesets API scope was granted
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-2223_03-05-edge-noindex-rule-covers-dev-and-admin-dev.md`

## What Changed

- File: `docs/phase-03/edge-config.md` (new)
  - Recorded the exact Cloudflare zone Transform Rule definition (ruleset id
    `3a5a0393fd8243e1ae3f22bd900533dc`, rule id `2bb6fe1c04bc4d69aba07b5569cefb85`) that sets
    `X-Robots-Tag: noindex` on every response for `dev.915tldr.com` **and**
    `admin-dev.915tldr.com`
  - Recorded the pre-existing (empty) state of the zone's `http_response_headers_transform`
    phase before this rule was added
  - Recorded the full recreation procedure (GET-then-PUT-or-POST) and the required token scopes,
    since this rule lives outside version control by D-08's accepted tradeoff
  - Documented why the rule's scope was extended to `admin-dev.915tldr.com` beyond PLAN.md's
    literal text, and a standing warning never to broaden the hostname match

## Why

PLAN.md 03-05 Task 2 scoped the noindex rule to `dev.915tldr.com` only, written before Task 1 of
the same plan bound `admin-dev.915tldr.com` (the Nuxt pipeline/admin app's dev host) as a new
Custom Domain. Shipping the rule as originally scoped would have left a brand-new, publicly
reachable admin surface fully crawlable — the exact failure class this plan exists to prevent,
just on a hostname the plan hadn't anticipated. Extended under deviation Rule 2 (auto-add missing
critical functionality): the same `in {}` expression already generalizes to more than one
hostname, so covering both cost nothing beyond a second string literal.

## Issues Encountered

None. The blocking issue from the prior session (CLOUDFLARE_API_TOKEN missing Zone Rulesets
scope) was already resolved by the owner before this continuation started; `GET
.../rulesets` and `POST .../rulesets` both succeeded on the first attempt.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: live `curl -sS -D -` response headers against `admin-dev.915tldr.com` (both
  a static `/` response and a Worker-generated 404), `dev.915tldr.com` `/`, `915tldr.com` `/`,
  and `www.915tldr.com` `/` — confirmed `X-Robots-Tag: noindex` present on both non-production
  hosts and absent on both production hosts, before any v2 code was deployed.
- What wasn't tested: the rule's behavior against a v2 Astro-rendered response (v2 isn't
  deployed yet at this point in the plan — that verification is Task 1/Task 3's job, done next).
- Edge cases: verified the rule fires on a 404 (Worker-generated), not just a 200 (which could
  pass under a `_headers`-file approach that this rule was specifically chosen over).

## Next Steps

- [ ] Deploy `915tldr-v2` and rebind `dev.915tldr.com` to it (Task 1)
- [ ] Build `tools/verify-edge-headers.mjs` and the `verify:edge` npm script (Task 3)
- [ ] Remove the now-redundant `dev.915tldr.com` Worker Route pointing at `915tldr-dev` once the
      Custom Domain rebind is confirmed live

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - zone-level security/SEO config change (additive, non-production hosts only), no application code changed

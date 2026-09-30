# Edge Config: The `noindex` Transform Rule

**Source of truth:** the Cloudflare zone config for `915tldr.com`, not this file. This document
exists precisely because that source of truth is outside version control (D-08's accepted
tradeoff) — it is the recreation procedure for a rule that can be silently deleted or altered by
an unrelated zone edit, with no diff and no reviewer. If the rule and this document ever
disagree, re-run the verification (`pnpm verify:edge`) to find out which one is stale, then fix
the rule and correct this file.

## What the rule does

Sets `X-Robots-Tag: noindex` on every HTTP response — static asset, Worker-generated page, or
error — for two hostnames on the `915tldr.com` zone:

- `dev.915tldr.com` — the v2 Astro tracer/build target this plan (03-05) deploys
- `admin-dev.915tldr.com` — the Nuxt pipeline/admin app's dev host (bound in this plan's Task 1,
  before this rule existed — see "Why both hostnames" below)

Production hostnames (`915tldr.com`, `www.915tldr.com`) are never in the matched set. No
wildcard, no suffix match — each hostname is listed by exact literal value.

## Why both hostnames

PLAN.md's Task 2 as originally scoped named only `dev.915tldr.com`. Between that plan being
written and this execution, Task 1 of this same plan bound `admin-dev.915tldr.com` to the
existing `915tldr-dev` Worker (Nuxt pipeline/admin app) as a Custom Domain — a new publicly
reachable, crawlable admin surface that did not exist when Task 2's scope was fixed. Leaving it
out of this rule would have shipped a new indexable admin host as a side effect of a plan whose
entire purpose is de-indexing non-production hosts. Extended under deviation Rule 2 (auto-add
missing critical functionality): the risk is the same class D-08 already accepted for
`dev.915tldr.com` (crawl discovery of an unreviewed non-production host), just on a second
hostname the plan hadn't foreseen. The single-rule design already generalizes to an arbitrary
set of non-production hosts, so covering both cost nothing beyond a second string in the
expression's `in {}` set.

## Why a zone Transform Rule and not a `_headers` file or a Worker-set header

Two lines, per D-08:

1. Static asset requests bypass the Worker entirely under `run_worker_first: false` (the
   Astro v2 app) and under this account's routing generally (the Nuxt admin app) — a
   Worker-set header would miss most responses on both apps.
2. `_headers` file rules do not apply to responses the Worker itself generates (its own routes,
   its own error pages) — a file would miss the rest. A zone-level rule is the only mechanism
   that covers both static and Worker-generated responses on both hostnames, verified below.

## Exact rule definition

Zone: `915tldr.com` (zone id `70a6176e850ecde50ab6f41d56ffddb4`)
Ruleset phase: `http_response_headers_transform` (a zone-level phase entrypoint ruleset)
Ruleset id: `3a5a0393fd8243e1ae3f22bd900533dc`
Rule id: `2bb6fe1c04bc4d69aba07b5569cefb85` (ref: `noindex_dev_hosts`)

```json
{
  "ref": "noindex_dev_hosts",
  "expression": "(http.host in {\"dev.915tldr.com\" \"admin-dev.915tldr.com\"})",
  "description": "OPS-02/D-08: noindex the dev and admin-dev hosts; production hostnames are never in this set",
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "X-Robots-Tag": {
        "operation": "set",
        "value": "noindex"
      }
    }
  }
}
```

## Pre-existing ruleset contents (recorded before this rule was added)

There was nothing. Before this plan ran:

- `GET /zones/{zone_id}/rulesets/phases/http_response_headers_transform/entrypoint` returned
  `{"code":10003,"message":"could not find entrypoint ruleset in the http_response_headers_transform phase"}`
  — no entrypoint ruleset existed for this phase on this zone at all.
- `GET /zones/{zone_id}/rulesets` listed exactly three zone rulesets, all Cloudflare-managed and
  in unrelated phases: `Cloudflare Normalization Ruleset` (`http_request_sanitize`), `Cloudflare
  Managed Free Ruleset` (`http_request_firewall_managed`), `DDoS L7 ruleset` (`ddos_l7`). None
  touch response headers.

So creating this rule required a `POST` (create a new phase entrypoint ruleset), not a `PUT`
against an existing one — there was no pre-existing zone response-header policy to preserve or
collide with.

## How to recreate it from scratch

Requires an API token with **Zone > Transform Rules > Edit** (or the broader **Account Rulesets
> Edit**) on the `915tldr.com` zone. Both scopes are already on the token used by this project
(see 03-05-SUMMARY.md for the scope-grant history).

**1. Check whether the phase entrypoint ruleset already exists:**

```bash
curl -sS "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/phases/http_response_headers_transform/entrypoint" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

If it returns `{"errors":[{"code":10003,...}]}` ("could not find entrypoint ruleset"), there is
nothing to preserve — go to step 2. If it returns a ruleset with an `id` and a `rules` array,
**do not blindly overwrite it** — a `PUT` to `/zones/{zone_id}/rulesets/{ruleset_id}` replaces
the entire `rules` array. Read what's there, append this rule's object to the existing `rules`
array, and `PUT` the combined array back.

**2. If nothing exists yet, create the phase entrypoint ruleset directly with this rule:**

```bash
curl -sS "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets" \
  --request POST \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "Zone-level Response Headers Transform Ruleset",
    "description": "OPS-02: noindex non-production hosts at the edge (D-08)",
    "kind": "zone",
    "phase": "http_response_headers_transform",
    "rules": [
      {
        "ref": "noindex_dev_hosts",
        "expression": "(http.host in {\"dev.915tldr.com\" \"admin-dev.915tldr.com\"})",
        "description": "OPS-02/D-08: noindex the dev and admin-dev hosts; production hostnames are never in this set",
        "action": "rewrite",
        "action_parameters": {
          "headers": {
            "X-Robots-Tag": {
              "operation": "set",
              "value": "noindex"
            }
          }
        }
      }
    ]
  }'
```

**3. Verify it was created and is live:**

```bash
pnpm verify:edge
```

or by hand:

```bash
curl -sS -D - -o /dev/null https://dev.915tldr.com/ | grep -i x-robots-tag        # expect: noindex
curl -sS -D - -o /dev/null https://admin-dev.915tldr.com/ | grep -i x-robots-tag  # expect: noindex
curl -sS -D - -o /dev/null https://915tldr.com/ | grep -i x-robots-tag            # expect: nothing
```

## Re-checked on every deploy, not once at sign-off

The rule lives outside version control and an unrelated zone-config change (a new redirect
rule, a WAF change, anyone editing zone rules in the dashboard) can remove or re-scope it
silently — no diff, no pull request, no reviewer. `pnpm verify:edge` (`tools/verify-edge-headers.mjs`,
Task 3 of this plan) re-proves it by live response header and should be run after every deploy
to either app on this zone, not trusted from this document alone.

## ⚠ Never broaden this rule's scope past the exact hostnames listed

The expression matches `dev.915tldr.com` and `admin-dev.915tldr.com` by **exact literal string**,
inside an `in {}` set. It must never become a suffix match (`ends_with(http.host, "915tldr.com")`)
or a wildcard pattern. A rule that matched `915tldr.com` or `www.915tldr.com` would noindex
production — the single worst outcome available in this plan, and one that would be invisible
until search traffic fell off, likely days or weeks later. If a third non-production hostname is
ever added to this zone, add its exact literal string to the `in {}` set; do not switch to a
pattern-based match to save a line.

## Robots.txt (adjacent, not this rule, checked for completeness)

`noindex` is only effective if crawling is permitted (Google: "for the noindex rule to be
effective, the page ... must not be blocked by a robots.txt file"). Checked live during this
plan: `dev.915tldr.com/robots.txt` and `admin-dev.915tldr.com/robots.txt` both serve
`User-Agent: *` / `Disallow:` (crawl allowed, empty disallow) — inherited from the Nuxt app
`915tldr-dev` currently serves at both hostnames. This is correct and required no change; it is
recorded here only so a future session does not "harden" it into a `Disallow: /` that would
defeat this rule's entire purpose.

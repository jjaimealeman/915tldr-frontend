---
status: testing
phase: 03-foundation-read-budget-guardrails
source: [03-VERIFICATION.md]
started: 2026-09-23T14:00:00Z
updated: 2026-09-23T14:00:00Z
---

## Current Test

number: 1
name: Trailing-slash deferral to Phase 4 — scope decision
expected: |
  An explicit owner decision, recorded in STATE.md or ROADMAP Phase 4 context, that this is
  intentionally Phase 4's problem (SEO-04/FIX-04/FIX-05 are already mapped to Phase 4, not
  Phase 3, per REQUIREMENTS.md), not a silently-carried gap.
awaiting: user response

## Tests

### 1. Trailing-slash deferral to Phase 4 — scope decision

v2 serves `/path` → 307 → `/path/`; v1 serves `/path` → 200 directly. PROJECT.md requires
"nine months of indexed URLs must keep resolving — `/[category]/[slug]-[uuid]` carries over
unchanged." Measured live on 2026-09-23:

```
v1 (Nuxt, prod)    /path   200      /path/  200
v2 (Astro, dev)    /path   307 →    /path/  200
```

`astro.config.mjs` sets no `trailingSlash`. The fix is `trailingSlash: 'never'` with
`build.format: 'file'`.

expected: An explicit owner decision that this is Phase 4's scope, recorded rather than carried silently.
why_human: Judgment call about scope boundary and URL-compatibility risk tolerance.
result: [pending]

### 2. `pnpm verify:edge` false negative — tooling-trust decision

The standing OPS-02 check built by 03-05 currently fails 1 of its 4 checks. Root cause: it
auto-discovers an article URL from the local `dist/client/` build, which drifts as D1 ingests
new articles and as anyone runs `pnpm build` without redeploying. Confirmed by the orchestrator:
a build on 2026-09-23 emitted `/crime/legal-team-prepares-...` where the deployed site serves
`/education/canutillo-isd-...`.

The underlying OPS-02 requirement is independently confirmed working via direct `curl`
(`x-robots-tag: noindex` present on both `dev.915tldr.com` and `admin-dev.915tldr.com`). This is
a false negative in the tool, not a requirement violation.

expected: Either harden the script to discover the article path from the live site (or `/version.json`), or accept the fragility as a known limitation and always deploy immediately before running it.
why_human: Tooling-trust decision — is a "cry wolf" false negative acceptable in a guard this project explicitly built to avoid guards that silently misbehave?
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None blocking. Score is 5/5 must-haves verified; both items are judgment calls routed to the
owner rather than defects.

## Orchestrator note — cleanup required before any deploy

The verifier created build fixtures under `src/` to prove the D1 guard fires on a real build, and
could not delete them (sandbox-blocked). Their contents were neutered to harmless placeholders, so
`pnpm build` passes — but they ARE emitted into `dist/client/` and would ship on the next deploy:

```
├─ /verifiertemp/bad/index.html
├─ /verifiertemp/island-page/index.html
```

Remove before deploying:

```
rm -rf /home/jaime/www/_github/915tldr.com/src/pages/verifiertemp
rm -rf /home/jaime/www/_github/915tldr.com/src/pages/__verifier_temp__
rm -rf /home/jaime/www/_github/915tldr.com/src/islands
```

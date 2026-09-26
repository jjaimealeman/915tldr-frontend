---
phase: 03-foundation-read-budget-guardrails
verified: 2026-09-23T13:56:38Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Decide whether trailing-slash behaviour (v2 serves `/path` -> 307 -> `/path/`, v1 serves `/path` -> 200 directly) is acceptable to leave deferred to Phase 4, given PROJECT.md's 'nine months of indexed URLs must keep resolving... unchanged' constraint."
    expected: "An explicit owner decision, recorded in STATE.md or ROADMAP Phase 4 context, that this is intentionally Phase 4's problem (SEO-04/FIX-04/FIX-05 are already mapped to Phase 4, not Phase 3, per REQUIREMENTS.md), not a silently-carried gap."
    why_human: "This is a judgment call about scope boundary and URL-compatibility risk tolerance that the verifier cannot make unilaterally — it was raised as an open question in the verification brief itself."

  - test: "Decide whether `pnpm verify:edge`'s 4th check (no app-level robots meta tag) needs hardening before Phase 4, since it currently fails on a fresh clone/build cycle for a reason unrelated to OPS-02 itself (see Gaps Summary)."
    expected: "Either the script is hardened to discover the article path from the live deployed site (or `/version.json`) instead of the local `dist/client/` build output, or the owner accepts the current fragility as a known limitation to work around manually (always deploy immediately before running `pnpm verify:edge`)."
    why_human: "This is a tooling-trust decision (is a 'cry wolf' false-negative acceptable in a guard this project explicitly built to avoid guards that silently misbehave), not a code-correctness question — the underlying OPS-02 requirement (edge noindex header) is independently confirmed working via direct curl."
---

# Phase 3: Foundation & Read-Budget Guardrails Verification Report

**Phase Goal:** The project cannot silently reintroduce D1 on the public path, and every layer (deploy / render / cache) can be told apart when debugging.
**Verified:** 2026-09-23T13:56:38Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Adding a D1 import to a `.astro` page **and** to an island component file fails the build, both times | ✓ VERIFIED | Independently reproduced live: created `src/pages/verifiertemp/bad.astro` (prerender=false, imports `d1-client.ts`) → real `pnpm build` failed with `[assert-no-d1] D1-import assertion violated ... ELIFECYCLE ... exit code 1`. Created `src/islands/BadIsland.vue` reached from a wrapper `.astro` page → real `pnpm build` failed the same way, naming the intermediate `.vue` file. Not just unit fixtures — an actual `astro build` against this exact repo state. Also confirmed causal by disabling `isForbidden()`'s check (one-line inversion): `tests/ci-fixtures/assert-no-d1.test.mjs` Cases 1 and 2 turn red immediately, green again on revert. |
| 2 | `output: 'static'` + per-route `prerender = false`; explicit `imageService`; `cloudflare:workers` env import; zero live `'hybrid'`/`Astro.locals.runtime.env` hits | ✓ VERIFIED | `astro.config.mjs` reads exactly as required. `grep` across `src/`, `astro.config.mjs`, `wrangler.jsonc`, `tools/`, `tests/` for `'hybrid'` and `Astro.locals.runtime.env` finds zero live occurrences (only in test fixtures/comments describing the ban). `tools/check-config-guards.mjs` run directly: `no violations found`. `tests/unit/astro-config.test.mjs` (13 cases incl. look-alike/absent-key ARCH-06 edges) — all pass. |
| 3 | Render manifest exists in KV with a documented schema carrying the Spanish-counterpart identity from day one | ✓ VERIFIED | `src/lib/kv-manifest.ts` implements `translationGroupId`/`language` (Option C, never null); `docs/phase-03/render-manifest.md` documents every field, the Option A/B/C reasoning, versioning, validation, bulk-write contract, and explicit "what this does not guarantee". `tests/unit/manifest-schema.test.mjs` (23 cases) and `tests/tracer/tracer.test.mjs` pass against the real KV namespace. |
| 4 | `curl -I https://dev.915tldr.com` returns `X-Robots-Tag: noindex` from the edge; `/version.json` + footer agree on commit/timestamp; README states the read budget | ✓ VERIFIED | Live `curl -I https://dev.915tldr.com/` → `x-robots-tag: noindex` (edge Transform Rule, confirmed absent on `915tldr.com`/`www.915tldr.com`). `https://dev.915tldr.com/version.json` → `{"commit":"a083d12",...}`. Local rebuild's footer and `dist/client/version.json` agree on the current commit hash (`7692ad2`), proven by a real cross-surface test with a one-time hand-inversion regression check. README's "read budget, in numbers" section states 0 / 2,000,000 / 5,000,000 / 5ms / 1 KV read, matching PROJECT.md exactly, naming all three enforcement mechanisms. |
| 5 | Three numbers recorded (cron CPU headroom, per-page render cost, D1 pagination p50/p95 at full corpus); render-step location decided from them and written down | ✓ VERIFIED | `docs/phase-03/measurements.md` (386 lines) records all three, each with method/date/reproduction command, measured against live production D1/Cloudflare infrastructure (not modeled): offset pagination 49.4M rows-read (9.9x over budget), render cost p50 573ms (KV write dominates), cron CPU ceiling 902,000ms (STATE.md's carried 300s figure corrected 3x). `docs/phase-03/render-step-location.md` records Option A, chosen from a real owner checkpoint plus a targeted follow-up production measurement (real 7-day ingest volume), with rejected alternatives and a numeric reopening threshold. `.planning/STATE.md`'s D-01 blocker is resolved in place, pointing at the decision document. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `astro.config.mjs` | Static output, Cloudflare adapter, explicit imageService, assert-no-d1 plugin wired | ✓ VERIFIED | Read directly; `assertNoD1Plugin()` registered in `vite.plugins`, confirmed logging on every real build pass. |
| `wrangler.jsonc` | Worker config, KV binding, no D1 binding | ✓ VERIFIED | No `d1_databases` key; `kv_namespaces` has one dedicated `RENDER_MANIFEST` binding; deploy-proven shape (`workers_dev: false`, `routes` custom_domain, `assets.directory: dist/client`) per 03-05's real `wrangler deploy`. |
| `tools/assert-no-d1.mjs` | Module-graph D1-import assertion | ✓ VERIFIED | Read in full; independently proven causal via a live inversion test and two live `astro build` failures I triggered myself (page-shaped and island-shaped). |
| `src/lib/server/d1-client.ts` | Single D1 chokepoint, build-time REST reads | ✓ VERIFIED | Read in full; throws rather than silently returning empty on non-2xx/`success:false` (closes the `/changelog` empty-state failure mode by design). |
| `src/lib/kv-manifest.ts` | Manifest construction/validation/bulk-write | ✓ VERIFIED | Read in full; `validateManifestEntry()` gates both single and bulk write paths; 23 passing unit tests. |
| `docs/phase-03/render-manifest.md` | Documented schema (SC3) | ✓ VERIFIED | Read in full; substantive, field-by-field, with the required Option A/B/C reasoning. |
| `docs/phase-03/edge-config.md` | Transform Rule definition + recreation procedure | ✓ VERIFIED | Read in full; exact rule JSON, zone/ruleset/rule IDs, curl-based recreation steps. |
| `docs/phase-03/measurements.md` | Three D-01 numbers | ✓ VERIFIED | Read in full; methods, dates, reproduction commands, an internal consistency cross-check, and a post-hoc addendum recorded as an addendum (not silently folded into the original numbers). |
| `docs/phase-03/render-step-location.md` | D-01 decision | ✓ VERIFIED | Read in full; decision, figures by reference, rejected alternatives, numeric reopening threshold. |
| `tools/verify-edge-headers.mjs` | Re-runnable live edge check | ⚠️ ORPHANED-BEHAVIOR (see Gaps Summary) | Exists, wired to `pnpm verify:edge`, 3 of 4 checks pass against live production right now; the 4th check is currently failing for a reason unrelated to OPS-02 itself — see below. |
| `README.md` | Read budget stated in numbers | ✓ VERIFIED | Read in full; figures match PROJECT.md exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `tests/ci-fixtures/assert-no-d1.test.mjs` | `tools/assert-no-d1.mjs` | Invokes the real `buildEnd` hook against fixture-derived module graphs | ✓ WIRED | Ran the suite; ran it again after a one-line inversion of the real checker to confirm the tests actually go red (not vacuously green). |
| `package.json` | `tools/check-config-guards.mjs` | `guard:config` script, run first in `test:unit` | ✓ WIRED | `pnpm run guard:config` runs and exits 0; confirmed it's in the `test:unit` chain by reading `package.json`. |
| `src/pages/[category]/[slug].astro` | `src/lib/kv-manifest.ts` | Every rendered page writes a manifest entry | ✓ WIRED | Confirmed via `tests/tracer/tracer.test.mjs` passing against the real D1 row and real KV namespace, and by reading 62 real manifest entries currently in the `915tldr-render-manifest` KV namespace. |
| `src/pages/version.json.ts` / `src/layouts/Base.astro` | `src/lib/build-info.ts` | Both surfaces import the same constants | ✓ WIRED | Cross-surface test passes; confirmed live on `dev.915tldr.com/version.json` and the footer of a local rebuild sharing the same commit hash. |
| `package.json` | `tools/verify-edge-headers.mjs` | `verify:edge` script | ✓ WIRED (partially failing) | Ran live: 3/4 checks pass against production edge config right now; see Gaps Summary for check 4. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `src/pages/[category]/[slug].astro` | `row` (article) | `fetchLatestArticle()`/`fetchArticleById()` → live D1 REST query | Yes — headline in built HTML matches live D1 row | ✓ FLOWING |
| `src/pages/[category]/[slug].astro` | manifest entry | `buildManifestEntry(row, ...)` → `putManifestEntry()` → live KV PUT | Yes — read back from real KV namespace after build | ✓ FLOWING |
| `src/pages/version.json.ts` | `commit`/`builtAt`/`hashSource` | `src/lib/build-info.ts`'s `resolveBuildHash(process.env)` | Yes — matches `git rev-parse --short=7 HEAD` at build time | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| D1-import assertion fails a real build on a page-shaped violation | Created `src/pages/verifiertemp/bad.astro` (prerender=false, imports d1-client.ts), ran `pnpm build` | `[assert-no-d1] D1-import assertion violated ... via .../bad.astro -> .../d1-client.ts`, `ELIFECYCLE ... exit code 1` | ✓ PASS |
| D1-import assertion fails a real build on an island-shaped violation crossing `.astro` → `.vue` | Created `src/islands/BadIsland.vue` (imports d1-client.ts) wrapped by an `.astro` page, ran `pnpm build` | `[assert-no-d1] D1-import assertion violated ... via .../BadIsland.vue -> .../d1-client.ts`, exit code 1 | ✓ PASS |
| Fixture suite is causal, not vacuous | One-line inversion of `isForbidden()` in `tools/assert-no-d1.mjs`, re-ran `tests/ci-fixtures/assert-no-d1.test.mjs` | Cases 1 and 2 fail red; reverted, all 4 pass green again | ✓ PASS |
| Edge noindex header is live and scoped correctly | `curl -I` against `dev.915tldr.com`, `admin-dev.915tldr.com`, `915tldr.com`, `www.915tldr.com` | noindex present on the first two, absent on production, exactly as documented | ✓ PASS |
| `pnpm verify:edge` (the phase's own standing check) | `pnpm verify:edge` run against the current live edge | 3/4 checks PASS, 1 FAILS (404 on a guessed article path — see Gaps Summary) | ✗ FAIL (see below) |
| Full test suites | `pnpm test:unit` (87/87), `pnpm test:build-gate` (4/4), `pnpm test:tracer` (4/4) | All green, run once each, matching the orchestrator's independently-reported figures | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| ARCH-02 | 03-01, 03-02 | Build fails if any public route/island/middleware/endpoint can reach D1 | ✓ SATISFIED | Live build failure reproduced twice (page + island); causal fixture suite. |
| ARCH-03 | 03-01, 03-02 | D1-import assertion scans island files, not only `.astro` pages | ✓ SATISFIED | Island-shaped violation reproduced live, message names the intermediate `.vue` file. |
| ARCH-04 | 03-01, 03-02 | `cloudflare:workers` env import; no `Astro.locals.runtime.env` | ✓ SATISFIED | Zero live occurrences; config guard enforces it. |
| ARCH-05 | 03-01, 03-02 | `output: 'static'` + per-route `prerender=false`; no `'hybrid'` | ✓ SATISFIED | Confirmed in `astro.config.mjs`; zero live `'hybrid'` occurrences. |
| ARCH-06 | 03-01, 03-02 | `imageService` explicit two-key object, not the adapter default | ✓ SATISFIED | Confirmed in `astro.config.mjs`; 6 look-alike/absent-key test cases pass via `node:vm` evaluation of the real adapter call argument. |
| REND-06 | 03-01, 03-04, 03-06, 03-07 | Render manifest in KV, documented schema, three measurements, render-step decision | ✓ SATISFIED | See Truths 3 and 5 above. |
| OPS-02 | 03-05 | `dev.915tldr.com` returns `X-Robots-Tag: noindex` at the edge | ✓ SATISFIED (header itself); ⚠️ tooling caveat | Header confirmed live via direct curl; the phase's own standing verification script (`pnpm verify:edge`) is currently red on one of its four checks — see Gaps Summary. |
| OPS-05 | 03-03 | Deployed commit hash + build timestamp in the public footer | ✓ SATISFIED | Confirmed via cross-surface test and live footer inspection. |
| OPS-06 | 03-03 | `/version.json` exposes the build hash | ✓ SATISFIED | Confirmed live on `dev.915tldr.com/version.json`. |
| OPS-08 | 03-03 | Read budget stated in the README | ✓ SATISFIED | README figures match PROJECT.md exactly. |

No orphaned requirements: the union of `requirements:` fields across all 7 plans (ARCH-02/03/04/05/06, REND-06, OPS-02/05/06/08) matches exactly the 10 requirement IDs REQUIREMENTS.md's traceability table maps to Phase 3.

### Anti-Patterns Found

No `TODO`/`FIXME`/`XXX`/`TBD`/`HACK`/`PLACEHOLDER` markers found in any phase-modified file (`src/`, `tools/`, `tests/unit`, `tests/ci-fixtures`, `tests/tracer`, `astro.config.mjs`, `wrangler.jsonc`). No stub returns (`return null`/`return {}`/`return []`) found outside test fixtures. `d1-client.ts` throws rather than returning an empty array on failure, by design, closing the exact `/changelog`-empty-state failure class REND-02/03 exist to prevent later.

### Human Verification Required

#### 1. Trailing-slash URL compatibility — Phase 3 or Phase 4's problem?

**Test:** Compare `curl -I https://dev.915tldr.com/<article-path>` (no trailing slash) against v1's behavior for the same URL shape.
**Expected:** A recorded owner decision on whether the observed `/path` → 307 → `/path/` redirect (vs. v1's direct 200) is acceptable to leave deferred, given PROJECT.md's explicit "nine months of indexed URLs must keep resolving... unchanged" constraint.
**Why human:** `SEO-04` (URL preservation) and `FIX-04`/`FIX-05` are formally mapped to Phase 4 in REQUIREMENTS.md's traceability table, not Phase 3 — my own reading is that deferring is consistent with the phase's declared scope ("Not in scope: generating the public pages themselves (Phase 4)"), since Phase 3 only ever built one tracer article, not the URL-preservation guarantee itself. But this is a judgment call about risk tolerance on a hard compatibility constraint, and the verification brief asked for it explicitly — routing to the owner rather than deciding it unilaterally.

#### 2. `pnpm verify:edge`'s 4th check is currently failing — is this acceptable as-is?

**Test:** Run `pnpm verify:edge` on a freshly cloned/rebuilt checkout without deploying first (i.e., the state any future session will likely find itself in).
**Expected:** Either all 4 checks pass, or the owner explicitly accepts that check 4 is only meaningful immediately after a `wrangler deploy` and knows to disregard a FAIL there otherwise.
**Why human:** This is a tool-design/trust tradeoff (see Gaps Summary for the mechanism), not a code-correctness defect in OPS-02 itself — the underlying noindex header is independently confirmed live and correct via direct `curl`.

### Gaps Summary

**No BLOCKER-level gap was found.** All 5 ROADMAP success criteria are independently verified true against the live codebase and live production infrastructure, not merely claimed in SUMMARY.md files. The single most safety-critical mechanism — the D1-import build assertion — was proven causal by triggering two real `pnpm build` failures myself (a page-shaped and an island-shaped violation) and by inverting the checker's own forbidden-target logic to confirm the CI fixture suite actually goes red when it should, closing exactly the Phase 2 CONT-06 failure mode ("248 tests passed while 253 production rows violated the requirement") this phase was explicitly designed to prevent.

**One real, independently-discovered tooling gap (WARNING, not a BLOCKER):** `pnpm verify:edge` — the standing, re-runnable check 03-05 built specifically so "OPS-02 can be checked on every deploy rather than once at sign-off" — currently fails 1 of its 4 checks when run against the repository's present state. The failing check ("no app-level `<meta name="robots">` on the dev host") auto-discovers an article URL by walking the **local** `dist/client/` build output rather than querying the live deployed site, and then asserts that URL returns `status 200` on `dev.915tldr.com`. Because (a) `fetchLatestArticle()` always fetches whatever is currently the newest row in production D1, which changes as the pipeline ingests new articles every ~2 hours, and (b) nothing has run `wrangler deploy` since 03-05's original deploy (03-06's and my own `pnpm build`/`pnpm test:unit` runs since then only rebuilt `dist/client/` locally), the locally-discovered article path no longer matches what is actually live on `dev.915tldr.com`, and the check 404s. This is a real, reproducible defect in the script's robustness — not a violation of OPS-02 itself, which I confirmed independently and directly: `curl -I https://dev.915tldr.com/` returns `x-robots-tag: noindex` right now, and `915tldr.com`/`www.915tldr.com` correctly do not. But a verification script that gives a false "FAILED" reading after routine, expected local development activity (a build without an immediately-following deploy) risks training whoever runs it to distrust or ignore its output — the same class of erosion-of-guard-trust this whole phase exists to prevent, just manifesting as a false negative rather than Phase 2's false positive. Recommend hardening the script (e.g., discover the article path from the live site's own manifest/version endpoint, or document explicitly that check 4 is only meaningful immediately post-deploy) before relying on it as a routine regression gate in Phase 4+.

**Known items acknowledged, not re-litigated as new findings (per the verification brief):**

- Trailing-slash URL behavior — routed to human verification above with my own judgment that it is correctly Phase 4's scope, not a Phase 3 gap.
- No `tsconfig.json` / no `@types/node` — confirmed still true (`npx tsc --noEmit -p .` errors with "cannot find tsconfig.json"). None of Phase 3's 10 requirement IDs concern type-checking, and every `.ts` file in scope builds and every test passes; this is real but pre-existing tooling debt, not a Phase 3 must-have failure. Flagged as acceptable debt, owner's call on when to address it.
- KV bulk-write batching investigation — correctly flagged as unscoped Phase 4 work, not silently dropped (`docs/phase-03/render-step-location.md` §3 names it explicitly).
- ROADMAP Phase 5's "300s CPU ceiling" — correctly flagged for Phase 5's own planner to confirm rather than assumed either way.
- Bulk-fetch in-memory stitch peak heap (128.4MB vs. 128MB Workers isolate limit) — correctly disclosed as a Node-process proxy measurement, not a Worker-verified figure, and does not change the phase's own conclusions since it was an addendum exploring a Phase-4-relevant hypothesis, not a Phase 3 deliverable.

**Cleanup needed** (verifier test artifacts, sandbox-blocked from self-deleting; content already neutered to harmless placeholders, safe to leave briefly but should be removed before the next commit):

```
rm -rf /home/jaime/www/_github/915tldr.com/src/pages/verifiertemp
rm -rf /home/jaime/www/_github/915tldr.com/src/pages/__verifier_temp__
rm -rf /home/jaime/www/_github/915tldr.com/src/islands
```

---

*Verified: 2026-09-23T13:56:38Z*
*Verifier: Claude (gsd-verifier)*

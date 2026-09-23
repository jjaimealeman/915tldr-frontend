---
phase: 03-foundation-read-budget-guardrails
plan: 06
subsystem: infra
tags: [cloudflare, workers, cron-triggers, d1, kv, wrangler, performance-measurement, observability]

requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "03-01's real tracer slice (src/pages/[category]/[slug].astro, d1-client.ts, kv-manifest.ts); 03-04's manifest schema; 03-05's proven deploy shape"
provides:
  - "tools/measure-d1-pagination.mjs — dry-run-gated D1 REST pagination latency/rows-read harness, offset vs keyset, against live production D1"
  - "tools/measure-render-cost.mjs — per-page render cost distribution (D1 read / render / manifest write, separated) against the real tracer slice"
  - "tools/cpu-ceiling-probe/ — a reusable, delete-after-use CPU-ceiling probe methodology for this account's Cron Triggers"
  - "docs/phase-03/measurements.md — the three D-01 measurements 03-07's render-step decision depends on, each with method, date, and reproduction command"
  - "STATE.md's 300-second cron CPU ceiling blocker line, corrected in full to the measured ~900-second figure"
affects: [03-07, phase-04-full-content-model]

actuals:
  tokens: 26326
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shared nearest-rank percentile helper (tools/lib/percentile.mjs) — one definition, imported by both measurement harnesses, per this project's own house convention of not reimplementing a stats method already established in 915tldr.com2/docs/phase-02/corpus-measurements.md"
    - "Harness-mode env-var hook into a real Astro page's getStaticPaths, gated so it never leaks into a normal build — measure the real production code path (D-02) instead of a synthetic benchmark"
    - "Deploy-measure-delete pattern for a throwaway Cloudflare Worker probe: distinct name, no bindings, deleted and confirmed absent via a full account Workers listing immediately after the measurement it existed for"
    - "Platform-reported cpuTime/wallTime/outcome (via wrangler tail / GraphQL Analytics workersInvocationsAdaptive) as the sole source of truth for a CPU-limit measurement — in-Worker self-timing is unreliable at the exact moment of a forced termination"

key-files:
  created:
    - tools/measure-d1-pagination.mjs
    - tools/measure-render-cost.mjs
    - tools/lib/percentile.mjs
    - src/lib/render-cost-harness.ts
    - tools/cpu-ceiling-probe/index.mjs
    - tools/cpu-ceiling-probe/run.mjs
    - tools/cpu-ceiling-probe/wrangler.jsonc
    - tools/cpu-ceiling-probe/wrangler.limits-high.jsonc
    - tools/cpu-ceiling-probe/wrangler.limits-low.jsonc
    - docs/phase-03/d1-pagination-report.md
    - docs/phase-03/render-cost-report.md
    - docs/phase-03/measurements.md
  modified:
    - package.json
    - "src/pages/[category]/[slug].astro"
    - .planning/STATE.md

key-decisions:
  - "Sampled the render-cost harness by summary length (what the page actually renders), not content length (what corpus-measurements.md's headline distribution reports) — a deliberate, stated departure from a literal reading of the plan's read_first pointer, because content length does not determine this page's render cost and summary length does."
  - "Kept the standalone measurement tools' own D1 REST query logic independent of src/lib/server/d1-client.ts (duplicated the joined-query shape rather than importing it) — consistent with 03-01's tools/ precedent, and necessary since these are plain .mjs scripts without a TypeScript toolchain to import a .ts module."
  - "Used offset cron expressions (:00, :15, :50) across the three wrangler.*.jsonc probe variants, each individually a genuine 2-hour-interval pattern, to get more than one real firing inside one session rather than waiting a full 2 hours per variant — documented as an inference (per-expression, not per-Worker-aggregate, ceiling classification) in the config's own comments, and the result obtained is consistent with that inference holding."
  - "Verified probe deletion via a direct Cloudflare Workers account listing rather than the plan's own <verify> grep pattern, which is stale against the current wrangler CLI's error wording ('This Worker does not exist on your account' matches neither 'not found' nor 'no worker') — a stronger, more direct proof of the same fact."

patterns-established:
  - "Percentile helper (tools/lib/percentile.mjs): nearestRank()/distributionStats(), shared across every measurement harness in this repo — do not add a second implementation."
  - "Harness-mode env var pattern: a real production page's getStaticPaths checks a harness-only env var (never set in a normal build) to switch into a measurement path that still exercises the real D1/KV code, with state extracted to its own module (src/lib/render-cost-harness.ts) after a real Astro bundler bug dropping frontmatter-local declarations recurred."
  - "For any future live-Worker CPU/timing measurement on this account: never tear down a wrangler tail capture immediately after a target event time — this session found real observability delivery lag of up to ~37 minutes past the actual invocation."

requirements-completed: [REND-06]

coverage:
  - id: D1
    description: "D1 REST pagination p50/p95 at the full live corpus is recorded, preceded by a dry run reporting row count and projected cost, with a real finding that offset pagination reads 49.4M rows against a 5M hard-fail budget"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "node tools/measure-d1-pagination.mjs --dry-run --json (automated verify script from 03-06-PLAN.md Task 1) — dry run OK: 39827 rows / 80 requests"
        status: pass
      - kind: other
        ref: "node tools/measure-d1-pagination.mjs --execute — full run, docs/phase-03/d1-pagination-report.md"
        status: pass
      - kind: other
        ref: "node tools/measure-d1-pagination.mjs --db-id <invalid> — forced-failure test, confirmed non-zero exit with HTTP status, not a silently-degraded distribution"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-page render cost is measured as a distribution against the real tracer slice (D1 read / render / manifest write timed separately), sampled across the real summary-length distribution, with fixed build-startup cost isolated"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "node tools/measure-render-cost.mjs --count 10 --json (automated verify script from 03-06-PLAN.md Task 2), followed by plain pnpm build emitting exactly 1 article at dist/client/*/*/index.html"
        status: pass
      - kind: other
        ref: "node tools/measure-render-cost.mjs --count 50 — full run, docs/phase-03/render-cost-report.md"
        status: pass
      - kind: unit
        ref: "pnpm test:tracer (4/4) — tracer behaviour unchanged after the harness-mode hook was added"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cron-worker CPU ceiling for this project's real 2-hour-interval cron is measured empirically (not read off a docs table), cross-checked against Cloudflare's own platform-reported cpuTime, with the limits.cpu_ms open question answered and STATE.md's 300-second figure corrected"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "Real Cron-Trigger-fired invocation of 915tldr-cpu-probe, captured via wrangler tail: outcome=exceededCpu, cpuTime=902000ms, wallTime=979952ms, limits.cpu_ms=300000 configured and had no effect — see docs/phase-03/measurements.md section 3"
        status: pass
      - kind: other
        ref: "Production 915tldr Worker's own real cron invocations, read-only via wrangler tail (n=2, 06:00 UTC 2026-09-23 firing) — Part B existing-headroom figure"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CPU-burn probe Worker is deleted from the Cloudflare account after measurement, confirmed by a listing that no longer shows it"
    verification:
      - kind: other
        ref: "GET /accounts/{id}/workers/scripts — 915tldr-cpu-probe absent from the full account Workers list; 915tldr, 915tldr-dev, 915tldr-v2 confirmed present and unaffected"
        status: pass
    human_judgment: false

duration: ~2h15min (includes ~1h35min of real elapsed time waiting for genuine Cloudflare Cron Trigger firings, not active work)
completed: 2026-09-23
status: complete
---

# Phase 3 Plan 6: The Three Measurements — Render Manifest Write Dominates, Offset Pagination Blows the Budget, and STATE.md's Cron Ceiling Was Wrong By 3x

**All three D-01 numbers measured against live production infrastructure (not modeled): D1 offset pagination reads 49.4M rows for a single 39,827-row pass (9.9x PROJECT.md's 5M hard-fail budget); per-page render cost is dominated by the KV manifest write (p50 338ms), not the render itself (p50 0.07ms); and the real 2-hour-interval Cron Trigger CPU ceiling is ~902,000ms (confirmed by a real cron-triggered burn test), not the 300,000ms STATE.md had been reasoning from — a full-corpus rebuild would take 6.3-8.1 hours against that ceiling, 25-33x over.**

## Performance

- **Duration:** ~2h15min total session time; ~1h35min of that was real elapsed wall-clock time waiting for genuine Cloudflare Cron Trigger firings (no synthetic trigger route exists for real edge CPU enforcement), not active development work
- **Started:** 2026-09-22T22:50:00-06:00 (approx, following 03-05's completion)
- **Completed:** 2026-09-23T00:59:25-06:00
- **Tasks:** 3
- **Files modified:** 17 (14 new, 3 modified)

## Accomplishments
- Built `tools/measure-d1-pagination.mjs`: dry-run-gated D1 REST pagination harness mirroring `d1-client.ts`'s real joined query, measuring offset vs. keyset pagination against the live 39,827-row corpus. Found offset pagination reads **49,420,384 rows** for one pass — **9.9x** PROJECT.md's 5,000,000-row hard-fail budget — and that offset and keyset differ materially in both latency (53.2% at p95) and rows-read (4.3x), refuting 03-RESEARCH.md's "no measurable difference" prediction.
- Built `tools/measure-render-cost.mjs`: measures the real tracer slice's per-page cost (D1 read, render, manifest write, separated) across a 50-article sample stratified by summary length. Found manifest write (the KV network PUT) dominates at p50 338ms/p95 415ms — the render itself is negligible at p50 0.07ms. Fixed build-startup cost isolated at ~1.8s.
- Deployed and measured a throwaway CPU-ceiling probe Worker against a real Cron Trigger firing: **cpuTime = 902,000ms** before `outcome: "exceededCpu"` — confirming Cloudflare's own documented 900,000ms (15-minute) ceiling for a >=1-hour-interval cron, and answering 03-RESEARCH.md's Open Question 1 (`limits.cpu_ms`, even set to its own platform-enforced maximum of 300,000ms, had zero effect on the cron invocation's actual termination point).
- Corrected STATE.md's carried-forward "300-second Worker CPU ceiling" / "~4ms/page" blocker line in full — both original figures were wrong (the ceiling by 3x, the per-page cost by ~140-180x) in ways that happened to point toward a similar qualitative conclusion, which is exactly the coincidence this whole plan exists to catch.
- Wrote `docs/phase-03/measurements.md`, combining all three measurements plus a consistency check: a full-corpus rebuild at today's 39,827 rows projects to 6.3-8.1 hours (p50/p95) against the measured ~902-second ceiling — 25-33x over — independently confirming the D1 rows-read finding from a completely different angle.
- Deleted the probe Worker and confirmed its absence via a full Cloudflare Workers account listing; production `915tldr`, `915tldr-dev`, and `915tldr-v2` confirmed untouched throughout.

## Task Commits

1. **Task 1: D1 REST pagination p50/p95 at the full corpus — dry run first** - `de2ef60` (feat)
2. **Task 2: Per-page render cost against the real tracer slice** - `cba2463` (feat)
3. **Task 3: The cron CPU ceiling, measured — then written down with the other two** - `4bfbca0` (feat)

**Plan metadata:** pending (this SUMMARY's own commit)

## Files Created/Modified
- `tools/measure-d1-pagination.mjs` - Dry-run-gated D1 REST pagination harness (offset + keyset), nearest-rank p50/p95, fails loudly on any non-2xx/`success:false` response
- `tools/measure-render-cost.mjs` - Per-page render cost harness: spawns a child `astro build` with harness-only env vars, samples across the real summary-length distribution
- `tools/lib/percentile.mjs` - `nearestRank()`/`distributionStats()` — the one percentile implementation both harnesses import
- `src/lib/render-cost-harness.ts` - Harness-mode state/exit-write hook, extracted into its own module after a recurrence of 03-01's known bundler bug
- `src/pages/[category]/[slug].astro` - `getStaticPaths` branches on harness mode to render N sampled articles instead of one, timing D1 read/manifest build/manifest write separately; unchanged in normal builds
- `tools/cpu-ceiling-probe/index.mjs` - The CPU-burn Worker (`scheduled` + `fetch` handlers)
- `tools/cpu-ceiling-probe/wrangler.jsonc`, `wrangler.limits-high.jsonc`, `wrangler.limits-low.jsonc` - Baseline, high-limit (300,000ms, the platform's own max), and low-limit (5,000ms, prepared but not run) config variants
- `tools/cpu-ceiling-probe/run.mjs` - Deploy/status/delete convenience wrapper (does not automate the real-firing wait — see Issues Encountered)
- `docs/phase-03/d1-pagination-report.md`, `docs/phase-03/render-cost-report.md` - Generated per-tool reports
- `docs/phase-03/measurements.md` - The combined three-number document 03-07 decides from
- `package.json` - Added `measure:d1`, `measure:render`, `measure:cpu` scripts
- `.planning/STATE.md` - Corrected the 300-second cron CPU ceiling blocker line with the measured figures

## Decisions Made
- Sampled the render-cost harness by SUMMARY length (what the page renders), not CONTENT length (what corpus-measurements.md's headline distribution reports) — a deliberate, stated departure from a literal reading of the plan's read_first pointer.
- Kept the measurement tools' D1 query logic independent of `d1-client.ts` (duplicated the joined shape) rather than importing a `.ts` module into a plain `.mjs` script — consistent with 03-01's own `tools/` precedent.
- Used three offset cron expressions (`:00`, `:15`, `:50`, each individually a genuine 2-hour-interval pattern) across the probe's config variants to get more than one real firing within one session, rather than waiting a full 2 hours per variant — documented as an inference in the configs' own comments, and the obtained result is consistent with that inference holding.
- Verified probe deletion via a direct Cloudflare Workers account listing rather than the plan's own `<verify>` grep, which is stale against the current `wrangler` CLI's error wording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A frontmatter-local `const HARNESS_MODE` was silently dropped by Astro's bundler**
- **Found during:** Task 2
- **Issue:** The same class of bundler defect 03-01-SUMMARY.md documented for a frontmatter-local `slugify()` function recurred for a `const` declared directly in `[slug].astro`'s frontmatter and referenced only inside `getStaticPaths` — `ReferenceError: HARNESS_MODE is not defined` at build time.
- **Fix:** Extracted the declaration into its own module, `src/lib/render-cost-harness.ts`, imported normally — the same fix pattern 03-01 already established.
- **Files modified:** `src/lib/render-cost-harness.ts` (new), `src/pages/[category]/[slug].astro`
- **Verification:** Re-ran the harness successfully after the fix; `pnpm test:tracer` (4/4) confirms normal behaviour unchanged.
- **Committed in:** `cba2463`

**2. [Rule 3 - Blocking] `limits.cpu_ms` cannot be configured above 300,000ms**
- **Found during:** Task 3
- **Issue:** `wrangler deploy` rejected `tools/cpu-ceiling-probe/wrangler.limits-high.jsonc`'s original `limits.cpu_ms: 3000000` with "Cannot set CPU time limit higher than 300 seconds (300000 ms) [code: 10206]".
- **Fix:** Corrected to 300,000ms (the platform's own configuration-time maximum) and redeployed. This finding is itself a direct, partial answer to Open Question 1, documented in `docs/phase-03/measurements.md`.
- **Files modified:** `tools/cpu-ceiling-probe/wrangler.limits-high.jsonc`
- **Verification:** Redeploy succeeded; the resulting cron-triggered burn measured `cpuTime: 902000ms`, well past the configured 300,000ms cap, confirming `limits.cpu_ms` has no effect on cron invocations.
- **Committed in:** `4bfbca0`

**3. [Rule 1 - Bug] The plan's own verify glob (`dist/*/*/index.html`) does not match this project's real build output shape**
- **Found during:** Task 2, running the plan's own `<verify>` command
- **Issue:** 03-01-SUMMARY.md already found and documented that this Astro/adapter version pair emits output under `dist/client/`, not `dist/` directly (coverage item D6). The plan's `<verify>` block for Task 2 was written before that finding and still globs the flatter, incorrect shape.
- **Fix:** Ran the verification manually against the corrected path (`dist/client/*/*/index.html`), confirming exactly one article HTML file. No code change needed — the harness's own behaviour was already correct; only the stale verify command needed the correction.
- **Files modified:** None (verification-only; documented here rather than silently worked around).
- **Verification:** `test $(ls dist/client/*/*/index.html | wc -l) -eq 1` — passes.
- **Committed in:** N/A (verification note, not a code change)

**4. [Rule 1 - Bug] The plan's own deletion-verify grep does not match the current `wrangler` CLI's error wording**
- **Found during:** Task 3, running the plan's own `<verify>` command
- **Issue:** `wrangler deployments list --name 915tldr-cpu-probe` now errors with "This Worker does not exist on your account", which matches neither `not found` nor `no worker` — the two substrings the plan's grep checks for.
- **Fix:** Verified deletion via a stronger, more direct check instead: `GET /accounts/{id}/workers/scripts`, confirming `915tldr-cpu-probe` absent from the full account listing while `915tldr`/`915tldr-dev`/`915tldr-v2` remain present.
- **Files modified:** None (verification-only).
- **Verification:** Listing response confirmed absence directly; see docs/phase-03/measurements.md's "Cost of this measurement" section for the full listing check.
- **Committed in:** N/A (verification note, not a code change)

---

**Total deviations:** 4 (2 Rule 1 bugs requiring code fixes, 1 Rule 3 blocking config fix, 1 Rule 1 stale-verify-script finding with no code change). None required a Rule 4 architectural decision or a new checkpoint.
**Impact on plan:** All fixes were necessary for the measurement to run at all or to be verified correctly. No scope creep — every fix stayed inside this task's own file set.

## Issues Encountered

- **The documented `/cdn-cgi/local/scheduled` Cron Trigger test route does not work under `wrangler dev --remote`** (confirmed 404, 3x). It is a local-Miniflare-only convenience that does not exercise real Cloudflare edge CPU enforcement — using it would have measured the wrong thing. Abandoned in favour of waiting for genuine Cron Trigger firings, which is the reason this task's real elapsed time (~1h35min of waiting) is far longer than its active-work time.
- **A real, previously-undiscovered-in-this-project observability delivery lag.** The FIRST probe attempt (baseline config, registered ~50 minutes before its 06:00 UTC target) appeared to produce zero data from both `wrangler tail` and the GraphQL Analytics API for 30+ minutes past the expected firing — indistinguishable at the time from a silent firing failure. The SECOND attempt's data eventually arrived via `wrangler tail` ~37 minutes after its actual `scheduledTime`, revealing the true cause: observability delivery lag, not a firing failure. The first attempt's tail session had already been torn down by this session's own wait script before that delay window could have delivered its data. Documented explicitly in `docs/phase-03/measurements.md` as a lesson for future live-Worker measurement work: never tear down a tail capture immediately after a target event time.
- **In-Worker self-reported `console.log` timing proved unreliable at the exact moment of a forced CPU-limit termination** — only the first log line of each burn run survived to the delivered tail event. Cloudflare's own platform-reported `cpuTime`/`wallTime`/`outcome` fields were used as the sole source of truth instead, exactly as the plan's own read_first guidance anticipated by requiring a platform cross-check.
- **Not resolved this session, stated as a real gap:** whether an explicitly LOW `limits.cpu_ms` (5,000ms) would be honored for a cron invocation remains untested — the session's practical time budget for additional real cron-firing waits (each 15-40+ minutes given the delivery-lag finding) was exhausted after securing the load-bearing high-limit result. `tools/cpu-ceiling-probe/wrangler.limits-low.jsonc` is prepared and ready if this becomes load-bearing for 03-07's decision.

## User Setup Required

None. `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (already present per prior plans) were sufficient for every D1, KV, Workers deploy/delete, `wrangler tail`, and GraphQL Analytics API call this task made.

## Next Phase Readiness

- `docs/phase-03/measurements.md` carries all three D-01 measurements, a consistency check, and STATE.md's correction — 03-07 can proceed directly to the render-step location checkpoint from this document.
- Phase 4's loader must NOT page through the full corpus with naive `LIMIT/OFFSET` pagination shaped like this task's test query — it reads ~1,241x more rows than a naive projection assumes and independently blows PROJECT.md's D1 rows-read budget on its own, before rendering even begins.
- Phase 4's render step must NOT assume a single cron invocation can rebuild the full corpus — the measured per-page cost (573-736ms, dominated by the KV manifest write) makes a full rebuild take 6.3-8.1 hours against the measured ~902-second cron CPU ceiling. An INCREMENTAL cron-triggered render (only new/changed articles per 2-hour cycle) remains plausible — roughly 1,200-1,570 articles fit inside one invocation at the measured per-page cost — but a full rebuild needs either ~26-33 cron cycles back-to-back, a Queues fan-out mechanism, or a CI job outside the Workers CPU-limited runtime.
- `tools/cpu-ceiling-probe/wrangler.limits-low.jsonc` is ready to deploy if 03-07 needs the untested low-`limits.cpu_ms` data point.
- No blockers remain from this plan. STATE.md's blocker line is corrected, not just flagged.

## Addendum (2026-09-23, post-completion, owner-authorized)

After this plan completed, the orchestrator checked the query planner directly and found the
plan already optimal (no missing index) — the 49.4M/11.5M rows-read costs above are a
**query-shape** problem (a per-row correlated tags subquery + per-row category LEFT JOIN), not an
indexing one. A narrow, scoped addendum measured a third pagination variant — bulk-fetch
`articles` alone (no JOIN/subquery) + separate bulk passes over `article_tags`/`tags` and
`article_categories`/`categories`, stitched in memory — to test whether eliminating the per-row
mechanisms fits the rows-read budget.

**Result:** yes, on the rows-read axis. `tools/measure-d1-pagination.mjs --execute` (extended,
same tool) now also runs this bulk pass by default (`--skip-bulk` restores this plan's original
offset/keyset-only scope). Measured: **957,008 total rows read** for the full corpus (24.01
rows/article) — 0.19x the 5,000,000-row hard-fail budget, vs. offset's 49.5M (9.9x over) and
keyset's 11.5M (2.3x over) this session. Output verified equivalent to the original joined query
on a 20-record sample (field-for-field match). Peak Node heap during the in-memory stitch measured
128.4 MB — marginally OVER the 128 MB Workers isolate memory limit (a Node-process proxy, not a
Worker-verified figure). Recomputing §4's render-time projection under this shape's assumptions
(D1-read cost amortized to one upfront pass) projects 3.8-4.5h for a full rebuild vs. the original
6.3-8.1h — roughly halved, but still 15-18x over the 902,000ms cron CPU ceiling, so this does NOT
change the plan's core conclusion that a full-corpus rebuild cannot run in a single cron
invocation. Full detail: `docs/phase-03/measurements.md` §1b and §4b.

This addendum did not re-litigate or change this plan's own three measurements (§1/§2/§3 above)
or its `status: complete` — it added a fourth, narrower measurement answering a question this
plan's own findings raised but did not itself answer.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 13 created/modified files listed above verified present on disk. All 3 task commit hashes
(`de2ef60`, `cba2463`, `4bfbca0`) verified present in `git log --oneline --all`. No missing items.

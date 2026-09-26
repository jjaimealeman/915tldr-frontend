# 2026-09-23 - Cron CPU Ceiling Measured — STATE.md's 300s Figure Was Wrong By 3x

**Keywords:** [BACKEND] [PERFORMANCE] [SECURITY] [DOCUMENTATION] [BUG_FIX]
**Session:** Overnight, Duration (~2h including real cron-firing wait time)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-0058_cron-cpu-ceiling-measured.md`

## What Changed

- File: `tools/cpu-ceiling-probe/index.mjs`
  - A deliberately CPU-bound Worker (`scheduled` + `fetch` handlers) that burns CPU in a tight
    synchronous loop, logging elapsed time at ~1s intervals, for observing the platform's real
    termination point.
- File: `tools/cpu-ceiling-probe/wrangler.jsonc`, `wrangler.limits-high.jsonc`,
  `wrangler.limits-low.jsonc`
  - Three config variants: baseline (no `limits.cpu_ms`), high (`cpu_ms: 300000`, the platform's
    own configuration-time maximum — see Issues Encountered), and low (`cpu_ms: 5000`, prepared
    but not run this session — see Deferred below). Each uses a distinct minute-offset of the
    real `"*/2"`-hour cron pattern so multiple real firings could be observed within one session
    without waiting a full 2 hours per variant.
- File: `tools/cpu-ceiling-probe/run.mjs`
  - Deploy/status/delete convenience wrapper — does not attempt to synchronously automate the
    wait for a real cron firing, since that genuinely cannot be scripted (see Issues Encountered).
- File: `docs/phase-03/measurements.md`
  - Completed sections 3 (cron CPU ceiling) and 4 (consistency check), joining the two sections
    already written for Task 1 (D1 pagination) and Task 2 (render cost). Full three-number
    picture for 03-07's render-step decision.
- File: `.planning/STATE.md`
  - Corrected the carried-forward "300 s Worker CPU ceiling" / "~4 ms/page" blocker line with
    the real measured figures and an explicit statement that both original numbers were wrong.

## Why

Phase 3's success criterion 5 requires the cron-worker CPU ceiling to be measured, not assumed —
STATE.md had been reasoning from a flat 300-second figure that Cloudflare's own documentation
(fetched directly this session) already contradicted: the real ceiling for a 2-hour-interval
Cron Trigger on the Workers Paid plan is 900,000ms (15 minutes), not 300,000ms. This task
confirmed that figure empirically (a real cron-triggered burn ran to 902,000ms of CPU before
termination) and, combining it with Task 2's per-page cost measurement, found that a full-corpus
rebuild would take 6.3-8.1 hours against a ~902-second ceiling — 25-33x over, not the "~330s vs.
300s" near-miss STATE.md's original arithmetic described. Both of STATE.md's original numbers
were wrong (the ceiling by 3x, the per-page cost by ~140-180x) in ways that happened to point to
a similar qualitative conclusion — exactly the kind of coincidence this whole plan exists to
catch rather than accept on faith.

## Issues Encountered

- **`limits.cpu_ms` has a hard 300,000ms configuration ceiling, discovered from `wrangler
  deploy`'s own validation, not from documentation.** The original `wrangler.limits-high.jsonc`
  requested 3,000,000ms; the deploy was rejected outright with "Cannot set CPU time limit higher
  than 300 seconds (300000 ms) [code: 10206]". Corrected to 300,000ms (the platform's own
  maximum) and redeployed. This is itself a partial, direct answer to 03-RESEARCH.md's Open
  Question 1: the knob cannot even be configured high enough to test whether it can RAISE the
  cron ceiling.
- **The documented `/cdn-cgi/local/scheduled` testing route does not work under `wrangler dev
  --remote`** — it 404s (confirmed 3x). That route is a local-Miniflare-only convenience; it
  does not exercise real Cloudflare edge CPU enforcement, so a result from it would have measured
  the wrong thing. Abandoned in favour of waiting for genuine Cron Trigger firings.
- **A real, previously-undocumented (in this project) observability delivery lag.** The FIRST
  attempt (baseline config, no `limits.cpu_ms`, registered ~50 minutes before its 06:00 UTC
  target) appeared to produce zero data from either `wrangler tail` or the GraphQL Analytics API
  in the 30+ minutes following the expected firing — looking exactly like a silent firing
  failure. The SECOND attempt's data eventually arrived via `wrangler tail` ~37 minutes after its
  actual `scheduledTime`. Conclusion: the first attempt's Cron Trigger most likely DID fire on
  schedule; its `wrangler tail` session had already been torn down (by this session's own wait
  script) before the ~37-minute delivery lag could surface its data. Documented explicitly in
  `docs/phase-03/measurements.md` as a lesson for future live-Worker measurement work in this
  project: never tear down a tail capture immediately after a target event time.
- **In-Worker self-reported `console.log` timing is unreliable at the exact moment of a forced
  CPU-limit termination.** Only the FIRST log line of each burn run survived to the delivered
  tail event; every subsequent per-second interval log from a ~902-second run was lost. This held
  for both the HTTP-triggered control runs and the cron-triggered run, so it is a structural
  property of a hard CPU-limit kill (buffered logs are not flushed on forced termination), not a
  bug in this probe. Cloudflare's own platform-reported `cpuTime`/`wallTime`/`outcome` fields
  were used as the sole source of truth instead — exactly what the plan's own read_first
  guidance anticipated by requiring a platform cross-check rather than trusting self-timing alone.
- **The plan's own deletion-verification grep is stale against the current `wrangler` CLI's error
  wording.** `pnpm exec wrangler deployments list --name 915tldr-cpu-probe` now errors with "This
  Worker does not exist on your account" — which matches neither `not found` nor `no worker`, the
  two substrings the plan's `<verify>` block greps for. Verified deletion instead via a direct,
  stronger check: the full Cloudflare Workers account listing (`GET
  /accounts/{id}/workers/scripts`), confirming `915tldr-cpu-probe` absent while `915tldr`,
  `915tldr-dev`, and `915tldr-v2` remain present and untouched.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: a real HTTP-triggered control burn (confirming the harness/`wrangler tail`
  methodology against the well-known 30-second default HTTP CPU ceiling — measured 32,500ms,
  matching); a real Cron-Trigger-triggered burn with `limits.cpu_ms: 300000` configured
  (measured 902,000ms CPU, `outcome: "exceededCpu"` — the load-bearing result); production
  `915tldr` Worker's own real cron invocations, read-only, via `wrangler tail` (n=2, one 2-hour
  firing window, for Part B's existing-headroom figure); `pnpm test:unit` (87/87),
  `pnpm test:build-gate` (4/4), `pnpm test:tracer` (4/4) all run after this change with no
  regression (this task touched no application code, only `tools/` and `docs/`).
- What wasn't tested (deferred, stated explicitly rather than silently skipped): whether an
  explicitly LOW `limits.cpu_ms` (5,000ms, `wrangler.limits-low.jsonc`, already prepared) would
  be honored for a cron invocation — the session's practical time budget for waiting on
  additional real cron firings (each requiring a 15-40+ minute wait, per the delivery-lag finding
  above) was exhausted after securing the load-bearing high-limit result. `docs/phase-03/
  measurements.md` states this gap explicitly rather than reporting a false completeness.
- Edge cases: none applicable — this is a one-shot measurement tool, not a library with an
  input-validation surface.

## Next Steps

- [ ] 03-07: use the three completed measurements in `docs/phase-03/measurements.md` to decide
      the render-step location (cron worker / separate Worker via Queues / CI) — the owner's
      checkpoint, not decided by this task.
- [ ] If the low-`limits.cpu_ms` question becomes load-bearing for that decision,
      `tools/cpu-ceiling-probe/wrangler.limits-low.jsonc` is ready to deploy and re-run.

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** HIGH - corrects a 3x-wrong CPU ceiling assumption and a ~140-180x-wrong per-page
cost assumption that the entire render-step architectural decision depends on; no production
code path changed (probe Worker deployed and deleted, production `915tldr`/`915tldr-v2` verified
untouched throughout).

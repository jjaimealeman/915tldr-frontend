# 2026-10-01 - Zero-reads gate + ARCH-08 evidence captured against the real deployed Worker

**Keywords:** [TESTING] [PERFORMANCE] [DOCUMENTATION] [CRITICAL]
**Session:** Afternoon, Duration (~50 min, mostly the 20,000-request pass itself)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1531_05-12-zero-reads-gate-evidence-captured.md`

## What Changed

- File: `docs/phase-05/evidence/gate-20261001T203348Z/request-pass.json`
  - Full per-request log (20,000 entries: path, status, Server-Timing) from the real load-test
    pass against `dev.915tldr.com`.
- File: `docs/phase-05/evidence/gate-20261001T203348Z/baseline-windows.json`
  - The 7 comparable prior-day baseline windows and their `rowsRead` totals, used for the leg 2
    delta measurement.
- File: `docs/phase-05/evidence/gate-20261001T203348Z/load-window.json`
  - The load window's own measured `rowsRead`.
- File: `docs/phase-05/evidence/gate-20261001T203348Z/deployed-bindings.json`
  - Leg 1b: the deployed `915tldr-v2` Worker's real binding list (`r2_bucket`, `assets`,
    `kv_namespace` — no `d1`), captured via a standalone `fetchDeployedBindings()` call.
- File: `docs/phase-05/evidence/gate-20261001T203348Z/workers-invocations.json`,
  `kv-operations.json`
  - ARCH-08's raw Cloudflare GraphQL Analytics responses (invocations, CPU quantiles/max, KV
    read count) for the identical window.
- File: `docs/phase-05/evidence/gate-20261001T203348Z/verdict-result.json`
  - The zero-reads load test's full JSON output (window, baseline stats, verdict: `PASS`).

## Why

This is the real measurement run for 05-12 — the gate the entire 915 TLDR v2 rebuild exists to
pass ("architecturally zero D1 reads on the public request path"). Ran
`node tools/load-test-zero-reads.mjs --requests 20000 --archive-plan dist/archive-plan.json
--evidence docs/phase-05/evidence/gate-20261001T203348Z --json` (20,000 requests across the
roadmap's 71-path mix: homepage, 8 categories, 20 hot articles, 20 archived articles, 10 static
tags, 10 archived tags, sitemap, RSS — 19,999/20,000 completed) during a valid window
(2026-10-01T20:34:05.536Z – 21:16:29.049Z), chosen to sit safely after the 20:00 UTC ingest cron's
deploy-hook build finished and well before the next one at 22:00 UTC. Followed immediately by
`node tools/measure-worker-kv-cpu.mjs --from <same start> --to <same end> --assume-no-build --json
--evidence docs/phase-05/evidence/gate-20261001T203348Z` for ARCH-08 over the identical window, and
a standalone `fetchDeployedBindings()` call for leg 1b.

Two real, pre-existing bugs in the measurement tool itself (`tools/load-test-zero-reads.mjs`) were
found and fixed in two prior commits this same session, before this run: the documented analytics
catch-up wait was dead code on the live CLI path (fixed in `4fb3d1a`), and `--archive-plan` was
parsed but never actually used to build a request mix at all — meaning the documented CLI usage
could never have run a full pass before today, on any invocation (fixed in `bb15a28`). This
evidence is the product of the FIRST successful real run after both fixes landed, including the
raw GraphQL responses and the full request-log confirmed with zero tokens/secrets leaked
(`grep -rli "Bearer" docs/phase-05/evidence/` returns nothing).

## Issues Encountered

ARCH-08's CPU-max measurement over this window shows a single outlier (49.966ms, over the 20ms
hard-fail ceiling) despite p50/p99 both being comfortably within budget (0.764ms / 2.846ms) — see
the full write-up and disclosure in `docs/phase-05/zero-reads-gate.md`'s "Result" section
(committed separately).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the real deployed `915tldr-v2` Worker and production D1 database
  (`552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77`), live, no mocks.
- What wasn't tested: n/a — this IS the live test.
- Edge cases: one of 20,000 requests failed at the network level (not a 5xx) — within the 95%
  completion floor, disclosed in the full write-up.

## Next Steps

- [ ] Compute and record the verdict write-up in `docs/phase-05/zero-reads-gate.md` (next commit).
- [ ] Close the phase's validation map (05-VALIDATION.md) once the verdict is confirmed `PROVEN`.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - this is the premise-proving measurement the whole v2 rebuild was commissioned
around; a FAIL here would halt the project for architecture review per D-02.

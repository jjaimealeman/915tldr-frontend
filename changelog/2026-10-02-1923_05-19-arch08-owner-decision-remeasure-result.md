# 2026-10-02 - Plan 05-19: ARCH-08 CPU-axis owner decision (re-measure) recorded, with result

**Keywords:** [DOCUMENTATION] [TESTING] [ARCHITECTURE] [CRITICAL]
**Session:** Evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1923_05-19-arch08-owner-decision-remeasure-result.md`

## What Changed

- File: `docs/phase-05/arch-08-cpu-outliers.md`
  - Appended "Owner decision (05-19, 2026-10-02)" section: Jaime's verbatim reply, the chosen
    option (c, re-measure), the pass criterion fixed before measuring, the exact commands run, a
    results table, the mechanical MET verdict against the pre-stated criterion, and a disclosed
    finding that the 3-invocation sample contained zero archive-page traffic (all 3 were bot-scan
    / favicon 404 probes) — so the MET result does not actually speak to the disputed
    archive-serving CPU-outlier code path.
- File: `docs/phase-05/zero-reads-gate.md`
  - Appended "ARCH-08 per-request correction and decision (05-19)" note under the existing 2026-10-01
    ARCH-08 result: the per-request count correction from 05-17 (4 ≥20ms, not 1) and a pointer to
    the 05-19 decision/result in arch-08-cpu-outliers.md. Purely additive — no existing text removed.
- File: `docs/phase-05/evidence/cpu-outliers-remeasure/` (new)
  - `events.normalized.json`, `summary.json`, `correlation.json` — per-request output from
    `tools/measure-worker-cpu-outliers.mjs --from 2026-10-02T00:00:00Z --to 2026-10-03T00:00:00Z --correlate --json`
  - `aggregate/workers-invocations.json`, `aggregate/kv-operations.json` — aggregate output from
    `tools/measure-worker-kv-cpu.mjs` for the same window (`--assume-no-build`, since the window is
    entirely in the past)

## Why

ARCH-08's CPU axis failed the 05-12 zero-reads gate (one request measured at 49.966ms Worker CPU,
over the 20ms PRD hard-fail line). 05-17 produced per-request evidence settling the true outlier
count (4 ≥20ms, 5 ≥5ms, not the "single outlier" the gate doc's aggregate-max framing implied) and
left three undecided options for the owner. This plan (05-19) is the blocking owner-decision
checkpoint: Jaime chose option (c) — re-measure natural traffic over the last full UTC day on
`dev.915tldr.com`, with the pass criterion (population p99 CPU < 5ms AND invocations ≥20ms CPU
under 0.1% of total) fixed before any measurement ran, per the plan's own repudiation-threat
mitigation (T-05-64). The re-measurement was then executed and the mechanical result recorded
exactly as the pre-stated formula computes it — including the disclosure that the window sampled
contained no real archive-page requests at all, so a literal MET verdict should not be read as
confirming the outlier pattern is resolved.

## Issues Encountered

The 24-hour natural-traffic window on `dev.915tldr.com` produced only 3 total Worker invocations,
and all three were automated 404 probes (`/.git/HEAD`, `/favicon.ico` x2) rather than requests to
an archived article or archived tag — the code path ARCH-08's CPU dispute is actually about. This
was disclosed in full rather than treated as a clean pass; WINDOWS.md #26 is intentionally left
open under option (c) per the plan's own design (only option (a), accept-cold-start, would waive
it) — no change to WINDOWS.md was made in this commit.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the re-measurement itself is the test — two read-only, $0 CLI invocations
  against the live Cloudflare Workers Observability API (`measure-worker-kv-cpu.mjs`,
  `measure-worker-cpu-outliers.mjs`), both already covered by existing unit test suites from 05-04
  and 05-17.
- What wasn't tested: no code changed in this plan, so no new test coverage was needed; the
  acceptance criteria were verified by `grep -c` against both doc files and a
  `git diff --quiet -- src tools wrangler.jsonc package.json` check confirming zero code/config
  diff.
- Edge cases: confirmed evidence files contain no account id or credential (grep against
  `$CLOUDFLARE_ACCOUNT_ID` returned 0 matches in the evidence directory); confirmed the window
  (`2026-10-02T00:00:00Z`..`2026-10-03T00:00:00Z`) was a genuinely completed UTC day at
  measurement time (`2026-10-03T01:22:17Z`), not one still in progress.

## Next Steps

- [ ] 05-21 translates this owner decision into REQUIREMENTS.md's ARCH-08 status (this plan
      deliberately does not touch REQUIREMENTS.md)
- [ ] If a stronger natural-traffic re-measurement is ever wanted, it needs a window that actually
      samples archive-article/archive-tag requests, not just whatever the Worker happens to receive
      on a low-traffic dev host

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - documentation and evidence only; no code or config changed; ARCH-08 CPU axis
remains an open gap per WINDOWS.md #26 regardless of this plan's mechanical MET result

# 2026-09-27 - Real Workers Builds spike measurements: cold/warm builds, D-15 drill, account limits

**Keywords:** [DOCUMENTATION] [CI_CD] [PERFORMANCE] [DEPLOYMENT]
**Session:** Late evening, Duration (~1.5 hours, spanning Task 2's real Workers Builds runs)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-2345_workers-builds-spike-measurements.md`

## What Changed

- File: `docs/phase-04/build-measurements.md`
  - Added a "Workers Builds spike" section (04-10 Task 2) documenting:
    - Build 1 (cold, first-ever connection): 649s total, `WB_COLD_FITS` verdict
    - Build 2 (warm, cache restored): ~237s total, D-06 build-cache-restore confirmed on the
      real platform, loader `mode=warm+sweep`
    - The D-15 failure-notification drill: three consecutive real local runs, two real bugs
      found and fixed along the way (see the two prior commits this session), final passing
      result with the ntfy topic read back
    - Account build-minute allowance (6,000 min/month, Paid plan, account-wide) and cost
      projection
    - The owner's cost-tolerance input for 04-11 ("$0-$5/month acceptable, optimize later")
    - A `WB_REUSE_PROVEN`/`WB_REUSE_ABSENT` section marked explicitly PENDING, with the two
      options recorded for the owner to choose from in the morning

## Why

04-10 Task 2 requires measuring the real Workers Builds pipeline's cold/warm build behavior, the
D-15 failure-notification path, and whether `experimental.incrementalBuild` reuses pages in a
genuinely fresh Workers Builds container. The first two are now measured and recorded here; the
third is blocked on pushing a commit to GitHub (this session cannot push — project git rules
reserve pushes for the owner via lazygit — and the owner is asleep), so it's recorded as pending
rather than fabricated or skipped silently.

## Issues Encountered

Two real bugs were found and fixed during the D-15 drill (documented in this doc's own drill
writeup, and in `changelog/2026-09-27-2333_fix-classifyfailure-misattribution.md` and
`changelog/2026-09-27-2337_fix-notifier-bytestring-crash.md`). Build 2's own returned log was
truncated mid-render (a Workers Builds API log-response limitation, not a build failure) — the
total wall time for that build was instead derived from the Workers Versions API's `created_on`
timestamp, disclosed explicitly in the doc rather than presented as a full log-derived figure.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: Every number in the new doc section traces to either a real Workers Builds log
  line (Build 1, fully captured) or a real Workers Versions/Scripts REST API response (Build 1
  cross-check, Build 2's total duration, account limits fetched live from Cloudflare's own docs).
- What wasn't tested: `WB_REUSE_PROVEN`/`WB_REUSE_ABSENT` — explicitly deferred, not measured.
- Edge cases: Grepped the new doc section for the real Deploy Hook URL and ntfy topic value before
  committing — confirmed neither appears anywhere under `docs/`, `.planning/`, `src/`, `tools/`,
  or `changelog/`.

## Next Steps

- [ ] Owner reviews the two options in the "PENDING" section and picks one
- [ ] Continuation session triggers Builds 3-4, records `WB_REUSE_PROVEN`/`WB_REUSE_ABSENT`, then
      reverts the temporary `incrementalBuild=true` hardcode
- [ ] 04-10-SUMMARY.md written only once the plan is fully complete (both verdict tokens present)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - documents real, measured infrastructure behavior that directly feeds 04-11's
production decision; plan not yet complete pending the owner's morning input

# Build Pipeline Decision — D-05 Forced-Full-Rebuild Mechanism & REND-05 Render Layer

**Decision: option-a — Workers Builds does all builds, including forced full rebuilds.** No
owner-machine step is part of the normal runbook; a forced full rebuild is a one-off Workers
Builds run with `ARTICLES_FORCE_COLD=1` set as a build variable for that single build. Page reuse
(`experimental.incrementalBuild`) is turned ON by default, since `WB_REUSE_PROVEN` was recorded.

Owner decision (Jaime), 2026-09-30 ~15:40 MDT, made from this plan's Task 1 checkpoint — a
one-way door per this plan's own `<reversibility>` note (04-11-PLAN.md Task 2): undoing this
later changes the operational runbook for the rest of the project.

## The measurements this was decided from

Every figure below is a reference into `docs/phase-04/build-measurements.md` — reproduce there,
not here, before trusting a number that may have changed since 2026-09-30.

| Figure | Value | Source |
|---|---|---|
| Local cold build (04-03, this machine) | 65.35s wall, 506,806 rows read | build-measurements.md "Cold build" |
| Workers Builds cold build (Build 1) | 649s (10.8min) total, `mode=cold rowsRead=508421` | build-measurements.md "Build 1" |
| **`WB_COLD_FITS` verdict** | 649s comfortably fits the 20-minute hard ceiling (~9.2min margin over the 900s/15min threshold) | build-measurements.md "Verdict: WB_COLD_FITS" |
| Workers Builds warm rebuild (Build 4) | 147s total, 34,871/~60,349 pages restored (confirmed lower bound — truncated log) | build-measurements.md "Build 4" |
| **`WB_REUSE_PROVEN` verdict** | `experimental.incrementalBuild` DOES reuse pages on a genuinely fresh Workers Builds container | build-measurements.md "Verdict: WB_REUSE_PROVEN" |
| Byte-identity (04-04, full corpus) | Confirmed byte-identical across the full 40,108-article corpus over two consecutive real builds | STATE.md 04-04 decision log |
| Byte-identity (04-09, local incremental spike) | Byte-identity holds in every flag-on/flag-off configuration tested, once the disclosed build-provenance-stamp field is set aside | build-measurements.md "Local incremental-build spike" |
| Projected daily D1 rows (loader) | Warm ~5,928–48,922 rows/build; cold ~506,806–512,125 rows/build — all well under `COLD_ROWS_READ_BUDGET` (1,500,000) | docs/phase-04/loader.md; build-measurements.md |
| Account build-minute allowance | 6,000 min/month (Paid, shared across every Workers Builds project on this account) | build-measurements.md "Account limits and cost" |
| Projected monthly usage (12 builds/day, worst case) | ~3,960 min/month if every build were cold; ~1,440 min/month at Build 2's warm ~4min figure | build-measurements.md "Account limits and cost" |
| Owner's cost tolerance | "$0 to $5 per month is acceptable, but I would definitely want to look into optimizing later." (2026-09-27 23:25 MDT) | build-measurements.md "Owner cost input for 04-11" |

## What was decided and why

- **Forced full rebuilds run entirely on Workers Builds** — no owner-machine step, no
  `pnpm run ci:local` invocation as the primary path. A forced rebuild (initial backfill, a
  manifest schema bump, a template change invalidating the whole manifest, or disaster recovery)
  is a one-off build triggered with the `ARTICLES_FORCE_COLD=1` build variable set for that single
  run (see "Forced-full-rebuild runbook" in `docs/phase-04/build-pipeline.md`).
- **Page reuse is ON by default** (`experimental.incrementalBuild`), since `WB_REUSE_PROVEN` — the
  real platform measurably restores unchanged pages from a fresh container, collapsing warm build
  wall time from 554s to 147s in the one direct A/B comparison available (Build 3 vs Build 4).
  `ASTRO_INCREMENTAL_BUILD=0` remains the off switch if a future regression is found.
- **Owner's specific concern, answered and accepted**: a redesign (font/layout change) re-renders
  every page on the next Workers Builds build automatically — no local step needed. The evidence
  the owner reviewed before deciding: `WB_COLD_FITS` (649s/554s cold builds vs the 20-minute hard
  limit) and `WB_REUSE_PROVEN` (≥34,871/~60,349 pages restored, 147s warm).
- **The owner's machine remains a manual escape hatch** (`wrangler deploy --config wrangler.jsonc`
  locally, or `pnpm run ci:local`), but it is not the documented runbook path. It exists only for
  an emergency where Workers Builds itself is unavailable or misbehaving.

## Consequences

1. **`astro.config.mjs`**: `experimental.incrementalBuild` now defaults ON
   (`process.env.ASTRO_INCREMENTAL_BUILD !== '0'`) — the inverse of 04-09/04-10's OFF-by-default
   seam, since the decision this plan exists to make has now been made. `ASTRO_INCREMENTAL_BUILD=0`
   is the documented off switch, not removed.
2. **No `rebuild:full` package.json script was added** — that script belongs to option-b (owner's
   machine as the primary forced-rebuild path), which was not selected. The forced-rebuild runbook
   lives entirely in `docs/phase-04/build-pipeline.md` as a Workers Builds build-variable
   procedure, not a local command.
3. **Byte-identity (criterion 3) is now enforced by a regression test**
   (`tests/regression/byte-identity.test.mjs`) — output byte-identity holds regardless of which
   option was chosen, since it is a property of the render layer (Astro's `cacheKey` +
   `railFingerprint`), not of where the build runs.
4. **`docs/phase-03/render-step-location.md`** is amended (not rewritten) to record that D-05
   moved the render step itself onto Workers Builds — the cron Worker now only triggers.
5. **Re-measure when the corpus grows.** Option-a's own stated con: it is only valid while
   `WB_COLD_FITS` holds. Phase 6 is expected to roughly double the corpus (STATE.md's 82,000-row
   bilingual projection) — re-run a real cold Workers Builds build at that point and confirm the
   649s figure has not grown past a margin the 20-minute ceiling can absorb. If a future cold
   build approaches or exceeds `WB_COLD_EXCEEDS` territory, this decision must be reopened (option-b
   or option-c become live alternatives again at that point, not before).

## Why the other options were not chosen

- **Option-b (owner's machine runs forced rebuilds)** was the research-recommended default before
  this plan's measurements existed. It remains viable but was not selected — the owner chose the
  fully-automated path (option-a) now that `WB_COLD_FITS` and `WB_REUSE_PROVEN` are both confirmed
  on the real platform, removing the main reason (an unmeasured cold-build risk) to keep a human
  at a terminal for a rare event.
- **Option-c (chunked build chain on Workers Builds)** was not selected — it is new engineering
  (partial-deploy semantics, chain state, stuck-chain alerts) that only pays off if
  `WB_COLD_EXCEEDS`, which this plan's own measurement (`WB_COLD_FITS`) rules out for the current
  corpus size.
- **Option-d (hand-rolled output carry-forward)** was not selected — `WB_REUSE_PROVEN` means
  Astro's own `experimental.incrementalBuild` already satisfies REND-05's "unchanged articles are
  not recomputed" on the real platform; hand-rolling the same guarantee would be pure duplicated
  engineering with no measured gap to close.

No gap-closure plan is required — this decision selected option-a outright, not option-c or
option-d's carry-forward variant, so `/gsd-plan-phase 04 --gaps` is not needed for this finding.

---

## Out of scope for this plan (owner-approved, deferred)

The BUILD_HASH footer stamp printed on every page (04-10's asset-dedup finding — near-total asset
re-upload on every commit change because `src/layouts/Base.astro` unconditionally prints
`BUILD_HASH`, defeating Cloudflare's content-hash dedup) is **not** fixed in this plan. Owner
decision: keep the commit hash only on the homepage footer (plus `/version.json`), everywhere else
show a stable stamp. This will be a separate, focused quick fix after 04-11, before 04-12. Any
test in this plan that exercises the footer stamp (none currently do — `byte-identity.test.mjs`
diffs whole-file bytes without stripping the `data-build` line, matching 04-09's own established
method of accounting for it as an expected/disclosed field rather than masking it) is written to
keep holding once that fix lands, since the fix only changes what stays STABLE across builds, not
whether it stays stable — see `docs/phase-04/build-pipeline.md`'s note on the footer stamp for the
mechanism this depends on.

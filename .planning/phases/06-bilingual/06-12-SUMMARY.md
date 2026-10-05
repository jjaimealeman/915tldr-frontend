---
phase: 06-bilingual
plan: 12
subsystem: testing
tags: [build-budget, performance, hreflang, i18n, workers-builds, astro]

# Dependency graph
requires:
  - phase: 06-bilingual (06-11)
    provides: "every /es page type plus per-language feeds and sitemaps, so one build covers the whole bilingual corpus"
  - phase: 05-archive-tier
    provides: "archive-sync throughput (54.64 obj/s), deadlines (840s/1,020s), file-count gate and the 60,000 post-Phase-6 budget"
provides:
  - "docs/phase-06/build-budget.md: measured build/file/convergence budget, projection formula, and a same-day correction section; input to 06-13 and 06-15"
  - "tests/unit/hreflang-pairs.test.mjs: full-corpus reciprocal hreflang invariant over 121,554 pages"
  - "tests/unit/es-lang-and-links.test.mjs: full-corpus lang attribute and /es link-containment invariant over 121,554 pages"
  - "A measured, same-machine render baseline showing Phase 6 itself costs about 1.18x per page, and that the only super-linear Phase 6 cost is the 06-11 sitemap options"
affects: [06-13-backfill, 06-15-deploy, 06-16-first-real-build]

# Actuals (#2632)
actuals:
  tokens: 9900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-corpus invariant tests walk dist/client plus dist/archive-plan.json entries (dist/archive/<key>) and map files to URL paths with the build.format:'file' rule, instead of sampling pages"
    - "Reciprocity is checked with the independent pairedPath() helper, never by trusting either page's own self-reported href (an /es page's own 'es' alternate is a self-reference)"
    - "A projection doc that is later corrected keeps its original sections and verdicts as labeled history, and the current verdict set is the LAST occurrence of each verdict-token family"

key-files:
  created:
    - docs/phase-06/build-budget.md
    - tests/unit/hreflang-pairs.test.mjs
    - tests/unit/es-lang-and-links.test.mjs
  modified: []

key-decisions:
  - "Task 3 (budget gate) resolved by Jaime on 2026-10-04 with a corrected premise: proceed on the deploy path (effectively option-c). The original DOES_NOT_FIT verdict was an artifact of comparing against the wrong 04-03 baseline; no hot-window change and no render-cost gap plan is needed first."
  - "The current verdicts are PHASE6_BUILD_FITS (projected 643s, about 688s post-backfill, NOT measured on Workers Builds), PHASE6_FILES_WITHIN_BUDGET (measured 59,572) and CONVERGES_24H (DERIVED, not measured)."
  - "The 06-11 @astrojs/sitemap i18n+chunks cost is recorded as a known, unfixed Phase 6 cost with a follow-up recommendation, not fixed in this plan."

patterns-established:
  - "Before trusting a 'cost went up Nx' finding, rebuild the baseline commit on the same machine back to back; a stale figure from an earlier plan can be off by 3x."

requirements-completed: []  # I18N-04/I18N-05 evidence is supplied below (full-corpus tests pass); marking is left to the orchestrator, which owns REQUIREMENTS.md writes for this run.

coverage:
  - id: D1
    description: "A full local render of the complete bilingual site (ASTRO_INCREMENTAL_BUILD=0) was measured: 121,554 pages, content-sync 107s, page generation 323s window, partition 5.14s, 59,572 static files, 13,290+13,290 archived articles and 17,712+17,712 archived tags"
    verification:
      - kind: integration
        ref: ".gsd/phase06-build.log (untracked): '121554 page(s) built in 7m 14s', '[archive] static files: 59572 / 100000', partition line; docs/phase-06/build-budget.md sections 1-2"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/phase-06/build-budget.md projects the Workers Builds cold build with every formula term written out and states three verdict tokens"
    verification:
      - kind: integration
        ref: "grep -E verdict-token regex over docs/phase-06/build-budget.md prints the superseded set (lines 14-16) then the current set (lines 402-404)"
        status: pass
    human_judgment: false
  - id: D3
    description: "I18N-05 adjacency, full corpus: every built page that declares alternates has reciprocal en/es hrefs, x-default equals English, every alternate target is a built page, no noindex page declares alternates"
    requirement: "I18N-05"
    verification:
      - kind: integration
        ref: "tests/unit/hreflang-pairs.test.mjs — 1/1 pass; 121,554 pages checked (20,085 paired, 40,691 self, 0 with no alternates) in about 5.7s"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every built /es page is <html lang=\"es\"> with /es-only internal links (switch link excepted); every other built page is <html lang=\"en\">"
    requirement: "I18N-03"
    verification:
      - kind: integration
        ref: "tests/unit/es-lang-and-links.test.mjs — 1/1 pass; 121,554 pages checked (60,777 /es, 60,777 other) in about 4.3s"
        status: pass
    human_judgment: false
  - id: D5
    description: "If any verdict is not green, execution stops at a decision checkpoint with the measured numbers"
    verification:
      - kind: manual
        ref: "Task 3 checkpoint:decision returned with docs/phase-06/build-budget.md numbers; resolved by Jaime 2026-10-04 after a same-day baseline corrected the premise"
        status: pass
    human_judgment: true

duration: ~2h (including a coordinator-run baseline and the correction)
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 12: Build Budget Measurement and Full-Corpus Invariants Summary

**One real full-corpus build measured 121,554 pages, the first verdict set (DOES_NOT_FIT) was overturned by a same-day same-machine baseline, and two full-corpus tests now prove hreflang reciprocity and lang/link containment across every built page. The corrected projection is 643s, derived and not yet measured on Workers Builds.**

## Performance

- **Tasks:** 3 of 3 (Task 3 resolved by Jaime's decision, no commit)
- **Commits:** 3 task/correction commits (plus the orchestrator's own tracking commit)
- **Files created:** 3 (1 doc, 2 tests) plus 3 changelog entries

## Accomplishments

- **Task 1 (tracer): a real full bilingual build, measured.** `ASTRO_INCREMENTAL_BUILD=0 pnpm run
  build` against production D1: 121,554 pages in 448.26s total (`astro build` 436.47s; content-sync
  107s; page-generation window 323s = 2.6576 ms/page; partition 5.14s), 59,572 static files,
  13,290 archived articles and 17,712 archived tags per language. `docs/phase-06/build-budget.md`
  holds the table, every formula term, and the verdict tokens.
- **Task 2: two full-corpus invariant tests, no violations in the real templates.**
  `hreflang-pairs.test.mjs` (121,554 pages, 20,085 paired, 40,691 self, about 5.7s) and
  `es-lang-and-links.test.mjs` (60,777 /es + 60,777 other, about 4.3s). Combined run about 6s,
  inside the 60s ceiling. `pnpm test:fast` was 1021/1021 after the tests were added.
- **The first verdicts were wrong, and the correction is on record.** Original: `PHASE6_BUILD_DOES_NOT_FIT`
  (projected 1,474s), `PHASE6_FILES_WITHIN_BUDGET`, `DOES_NOT_CONVERGE_24H`. A same-day baseline
  (coordinator-run, same machine, back to back) showed the "3.72x per-page cost increase" compared
  today against the early 04-03 minimal template. Real per-page growth from Phase 6 is 1.18x (1.02x
  render-only), and the corrected local-to-Workers-Builds factor is 0.74133, not 0.26133.
- **Current verdicts (last occurrence of each token in the doc):**

  ```
  PHASE6_BUILD_FITS          (projected 643s, about 688s post-backfill; NOT measured on Workers Builds)
  PHASE6_FILES_WITHIN_BUDGET (measured 59,572 of 60,000; 428 files of headroom)
  CONVERGES_24H              (DERIVED, not measured: about 19,447 objects/build, 2 builds, about 4h)
  ```

- **One real Phase 6 render cost identified.** 06-11's `@astrojs/sitemap` `i18n` + `chunks` options
  (commit `90fda90`) make the `astro:build:done` hook super-linear: 3.92s at baseline, 49.57s at
  HEAD, 92s in this plan's own build, estimated about 93s after the Spanish backfill (benchmark,
  not a full build). That is 98% of HEAD's excess over baseline's per-page rate.

## Task Commits

1. **Task 1: Tracer, measure the full bilingual build** - `b98e520` (feat)
2. **Task 2: Full-corpus hreflang/lang/link invariant tests** - `86aebda` (test)
3. **Task 3: Budget gate (checkpoint:decision)** - no commit. Returned as a blocking checkpoint
   after Task 1's original verdicts were not green, then resolved by Jaime on 2026-10-04.
4. **Correction after the same-day baseline** - `d159288` (docs)

**Plan metadata:** this file's own commit.

Tracer gate: not auto-continued under Jaime's standing approval (2026-10-03), because that approval
covers only all-green fully automated evidence and Task 1's first verdicts were not green. Task 2
still ran (read-only measurement), then execution stopped at Task 3, as instructed.

## Files Created/Modified

- `docs/phase-06/build-budget.md` - measured budget, formulas, original verdicts (superseded) and
  the section 8 correction with the current verdicts
- `tests/unit/hreflang-pairs.test.mjs` - full-corpus reciprocal hreflang invariant
- `tests/unit/es-lang-and-links.test.mjs` - full-corpus lang/link-containment invariant
- `changelog/2026-10-04-0732_...`, `-0733_...`, `-1208_...` plus `changelog/README.md` - changelog entries

## Decisions Made

See `key-decisions` in the frontmatter. In brief: Task 3 resolved as "proceed on the deploy path"
with the premise corrected; the three current verdicts and how they are labeled; the sitemap cost
recorded as a known unfixed Phase 6 cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, test logic, caught before commit] Reciprocity check compared a page with itself**
- **Found during:** Task 2, first run of `hreflang-pairs.test.mjs` (20,085 false failures).
- **Issue:** the first draft parsed an `/es` page's own "es" alternate to find "the other page", but
  that href is a self-reference by design.
- **Fix:** compute the counterpart with `pairedPath()` (imported from `src/lib/i18n/hreflang.ts`,
  the helper `tests/unit/hreflang.test.mjs` already uses) and check each side against it.
- **Files modified:** `tests/unit/hreflang-pairs.test.mjs` (only the new test; no production code).
- **Commit:** `86aebda`

### Other departures, disclosed

**2. [Plan wording no longer literally true] "Exactly one verdict line per family."** Task 1's
acceptance criterion asked for exactly one build, one files and one convergence verdict line. After
the correction the doc holds two sets (superseded, then current), so the plan's grep prints six
lines. The file labels the superseded set, and the rule for scripts is: use the LAST occurrence of
each token family.

**3. [Substitution, disclosed in the doc] `esColdSync` basis.** The plan asked for 06-06's measured
Spanish cold pass scaled to 41,000 rows, but 06-06's pass read 1 row (no usable rate). This build's
own 60-row pass, scaled by REST page count (9 pages x about 2s = 18s), was used instead. It does not
affect any verdict.

**4. [Process] Commits were made through the `/jja-commit` skill's process, with explicit staging.**
The skill was invoked for Task 1; its default `git add -A` was overridden with explicit paths per the
repo rules. For Task 2, the correction and the unlinked changelog entries I followed the same
process manually (changelog entry, README index row, explicit staging, `git commit`) rather than
re-invoking the skill each time.

---

**Total deviations:** 1 auto-fixed (Rule 1, test only), 3 disclosed departures.
**Impact on plan:** none on scope. The real impact is the verdict reversal, which came from the
coordinator's baseline and is documented in the doc, not from a change to this plan's tasks.

## Issues Encountered

- **The first projection was wrong.** My own Task 1 doc reported a 3.72x per-page cost increase and
  a 1,474s renderEnd. I compared against the figure in the plan's context block (0.71 ms/page,
  from `docs/phase-04/build-measurements.md`'s early cold-build section) without checking which
  commit it was measured on. That figure was the 04-03 minimal template, not the Phase 4 template
  Workers Builds measured. The baseline run caught it. Task 1's root-cause paragraph in the doc
  (image optimization, i18n work, third loader) was also wrong and is superseded in section 8.2.
- Both claims were precise-looking and internally consistent, which is why they survived until a
  same-machine baseline was run.

## Known Stubs

None. No source files were created or modified, only tests and docs.

## Threat Flags

None. No new network endpoints, auth paths or schema changes. Read-only D1 access during builds.

## Open follow-ups (for Jaime / later plans)

- **06-16:** compare the first real Workers Builds timings of HEAD against the 643s projection (and
  about 688s post-backfill). HEAD has not been built on Workers Builds; the factor rests on one
  sample (Build 1, 2026-09-28).
- **06-11 sitemap cost:** known, unfixed. Recommend replacing the package's i18n partner scan or
  precomputing alternates. The file budget has only 428 files of headroom, so a fix that adds pages
  needs the files verdict re-checked.
- **Possible production KV writes from builds (unverified, for Jaime to check):** during the
  baseline, a cold local build of the pre-Phase-6 commit attempted about 40.7k writes (5 bulk PUTs)
  to the PRODUCTION render-manifest KV namespace, which the baseline agent stubbed. This plan's
  Task 1 build was also a cold build, and earlier executor builds may likewise have written to
  production KV. Not investigated here.
- **Clock note:** this plan's changelog entries are stamped 0732, 0733 and 1208 from `date` output
  at the time; the gap between the first two and the third is real wall time, not an invented value.

## Next Phase Readiness

- 06-13 (Spanish backfill spend) and 06-15 (deploy) are no longer blocked by a build verdict; the
  corrected build verdict is FITS with the stated caveats (projection only).
- I18N-04/I18N-05 evidence: every built page pair is proven reciprocal and every /es page proven
  lang="es" with /es-only links across the full corpus. Marking the requirements is left to the
  orchestrator.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

Files verified on disk: `docs/phase-06/build-budget.md`, `tests/unit/hreflang-pairs.test.mjs`,
`tests/unit/es-lang-and-links.test.mjs`. Commits verified in `git log`: `b98e520`, `86aebda`,
`d159288`. The plan's verdict grep prints six lines (superseded set at 14-16, current set at
402-404). Test numbers (121,554 pages; about 5.7s and 4.3s) are from this session's own runs.
Not re-run after the correction commit: builds and tests (docs-only change, per instruction).

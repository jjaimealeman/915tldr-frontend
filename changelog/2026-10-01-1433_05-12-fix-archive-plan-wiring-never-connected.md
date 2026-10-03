# 2026-10-01 - Fix: the zero-reads gate's --archive-plan CLI flag was parsed but never used

**Keywords:** [BUG_FIX] [TESTING] [CRITICAL]
**Session:** Afternoon, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1433_05-12-fix-archive-plan-wiring-never-connected.md`

## What Changed

- File: `tools/load-test-zero-reads.mjs`
  - Added `loadArchivePlanFile(archivePlanPath)` — loads and validates a real
    `dist/archive-plan.json`, mirroring `tests/helpers/archive-sample.mjs`'s own validation
    (never a bare `ENOENT`).
  - Added `buildRequestMixInputFromArchivePlan(archivePlanPath, deps)` — builds the full
    `requestMixInput` (`categories`, `hotArticlePaths`, `archivedArticlePaths`,
    `staticTagPaths`, `archivedTagPaths`) `buildRequestMix` needs, directly from a real local
    build's `dist/archive-plan.json` + `.astro/tier-facts-*.json` (via `src/lib/archive/
    tier-facts.ts`'s `readTierFacts`, injectable as `readTierFactsFn` for tests) and
    `src/lib/categories.ts`'s `CATEGORIES`. Same tier-boundary safety margins as 05-11's
    `archive-sample.mjs` (2-day article margin, ≤5-count archived-tag ceiling, ≥25-count
    static-tag floor).
  - Wired `main()` to call `buildRequestMixInputFromArchivePlan(args.archivePlan)` and pass the
    result into `runLoadTest({ ..., requestMixInput })` for every non-`--baseline-only` run.
- File: `tests/unit/load-test-zero-reads.test.mjs`
  - Added 4 new tests (`loadArchivePlanFile` validation + missing-file error message,
    `buildRequestMixInputFromArchivePlan` building a real `buildRequestMix`-compatible input
    from the existing `tests/fixtures/archive-plan.sample.json` fixture with an injected fake
    tier-facts function, and confirming an archived article is excluded from `hotArticlePaths`).

## Why

Found immediately after fixing the analytics-catch-up bug (see the prior changelog entry this
same session), on the FIRST live attempt at 05-12's real gate: `node tools/load-test-zero-reads.mjs
--requests 20000 --archive-plan dist/archive-plan.json --evidence ... --json` — the exact command
this file's own header comment and `docs/phase-05/zero-reads-gate.md` document as the real usage
— threw immediately: `a full pass requires requestMixInput (categories/hot/archived/tag paths) —
see --archive-plan`. `parseArgs` correctly parsed `--archive-plan` into `args.archivePlan`, but
`main()` never used it for anything — `requestMixInput` was never constructed from it and never
passed to `runLoadTest()`. The documented CLI usage for a full (non-baseline) pass could never
have worked, on any invocation, ever — this was caught on the very first live attempt at running
the gate this whole project exists to pass. Fixed by reusing the same real `dist/archive-plan.json`
+ `.astro/tier-facts-*.json` reading approach 05-11's test helper already proved live, as
production code `main()` can actually call.

Verified fixed with both a pure smoke test against the real `dist/archive-plan.json` (71-path
mix built correctly) and a tiny 8-request live CLI run against `dev.915tldr.com`, which completed
end-to-end (preflight passed, pass ran, analytics catch-up resolved quickly, verdict
`INCONCLUSIVE` on the expected `zero-total-window` rule for a 12-second window — exactly the
correct outcome at that scale, not a crash).

## Issues Encountered

None beyond the bug itself.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `loadArchivePlanFile` (valid fixture + missing-file message),
  `buildRequestMixInputFromArchivePlan` (fixture-driven, injected tier facts, confirms exclusion
  of archived uuids from the hot list), plus a live smoke test (8 requests) and a direct
  programmatic smoke test against the real `dist/archive-plan.json` (12,536 archived articles,
  27,616 hot articles, 16,331 archived tags, 1,034 static tags all discovered correctly). All 53
  tests in `tests/unit/load-test-zero-reads.test.mjs` pass (49 + 4 new); full `pnpm run test:fast`
  (676/676), `guard:config`, `test:build-gate` (9/9) all clean.
- What wasn't tested: the full 20,000-request live pass — that's 05-12's own real gate run,
  about to run next with this fix in place.
- Edge cases: n/a beyond what's listed above.

## Next Steps

- [ ] Proceed with 05-12's real 20,000-request gate run now that both blocking bugs in this
  instrument are fixed and verified live.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** HIGH - without this fix, the documented zero-reads gate CLI command could never run
at all; this was only discovered by actually attempting the real gate run, not by code review.

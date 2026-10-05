# 2026-10-02 - build step's per-page listing reduced to counts (REND-11 follow-up, Task 3)

**Keywords:** [TESTING] [MONITORING] [BUG_FIX] [BACKEND] [PERFORMANCE]
**Session:** Evening, ~40 min
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2310_rend11-task3-perpage-listing-filtered.md`

## What Changed

- File: `tools/ci-build.mjs`
  - New exported `PER_PAGE_LINE_RE` + `isPerPageBuildLine(line)` — matches exactly one `astro build`-emitted per-page progress line (`├─ /path (+Nms|cached|restored)`), ANSI-stripped and `\r`-tolerant, anchored end-to-end so a line with anything appended after the closing paren (Astro's own "file not created" notice, or glued console output) does NOT match and stays visible.
  - New exported `createPageLineFilter({ write, progressEvery = 5000 })` — a stateful line filter: every complete per-page line is suppressed and counted (one progress line per `progressEvery` suppressed lines); everything else is written verbatim with its newline, in order. `end()` flushes any trailing partial line (written only if it's not itself a page line) and returns the total suppressed count.
  - `defaultSpawn` renamed to exported `spawnTee`, gaining `filterPageLines` (default false) and overridable `writeStdout`/`writeStderr`. stderr is never filtered. When `filterPageLines` is true, stdout is routed through `createPageLineFilter` and the promise resolves on the child's `close` event (after stdio drains) instead of `exit`, so the filter's summary line is written last. Tail collection (for `classifyFailure`) stays on raw, unfiltered text either way.
  - `runCi`'s build spawn now passes `filterPageLines: !isTruthyFlag(env.CI_BUILD_FULL_LOG)`. No deploy-step spawn (pre, file-count, synced guard, wrangler, post, mark-daily-report) ever carries this option. `package.json`'s `build`/`build:ci` scripts are untouched — a local `pnpm run build` is unaffected.
- File: `tests/unit/ci-build.test.mjs`
  - C1/C2: `isPerPageBuildLine` against real production line shapes (including ANSI-wrapped and `\r`-terminated) and against lines that must survive (warnings, build-step echoes, the file-not-created notice, glued console output).
  - C3/C3b: `createPageLineFilter` behavior across split chunks, progress-line cadence, and the trailing-partial-line edge case.
  - C4: `runCi` wiring — `filterPageLines` true by default, false under `CI_BUILD_FULL_LOG=1`, and absent entirely from every deploy-step spawn.
- File: `tests/unit/ci-build-spawn.test.mjs` (new)
  - S1/S2: a REAL child process (`process.execPath -e <script>`) proves `spawnTee` preserves the real exit code, passes stderr through verbatim, suppresses only exact-shape page lines (the file-not-created variant survives), and that `result.tail` still carries the raw lines `classifyFailure` needs — this is the one file in the suite allowed to spawn a real process.
- File: `docs/phase-04/build-pipeline.md`
  - Documented the per-page listing filter under the build step, and updated step 7's daily-report wording to describe the confirmed-send `mark-daily-report` handoff (Task 2).

## Why

The production build log downloaded 2026-10-02 (53,523 lines) ended mid per-page listing with zero `[ci-build]`/`archive-sync`/deploy-step lines visible — the ~53,425-line `astro build` page listing was pushing everything after it (including Task 1/2's new ntfy-outcome lines) past what the downloadable Workers Builds log retains. This task closes that gap without losing any real signal: warnings, errors, and the exact failure shape `classifyFailure` depends on all survive untouched.

## Issues Encountered

No major issues encountered. Verified the filter's regex against the real downloaded production log (`/home/jaime/Downloads/build.log`, read only via `grep`/a scripted count, never printed wholesale): 53,425/53,425 real `├─` lines matched, 0/98 other real lines matched — exactly the counts predicted during planning.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the pure regex/filter functions against both synthetic fixtures and the real production log's line shapes; `runCi`'s wiring (filterPageLines true/false/absent per step); a real child process end-to-end (exit code, stderr passthrough, suppression, tail integrity) via the new real-spawn test file.
- What wasn't tested: a real `pnpm run build:ci` invocation against this filter in Workers Builds itself (will be observed on the next production deploy, per this plan's SUMMARY).
- Edge cases: ANSI-wrapped lines, trailing `\r`, a page line split across two stream chunks, a page line with no trailing newline at stream end, and Astro's "(file not created...)" notice (deliberately excluded from the match so it stays visible).

## Next Steps

- [ ] Confirm on the next real production deploy that the Workers Builds log now shows the suppression summary line, the ntfy outcome lines (Task 1), and the daily-report marker line (Task 2) — see the quick-plan SUMMARY for the exact lines to look for.

---

**Branch:** feature/phase-05
**Issue:** REND-11 follow-up (`.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`)
**Impact:** MEDIUM - observability-only change to build-step stdout; no change to build correctness, exit codes, or `package.json` scripts

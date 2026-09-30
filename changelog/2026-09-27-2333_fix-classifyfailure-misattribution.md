# 2026-09-27 - Fix classifyFailure() misattributing a real build failure to a benign line

**Keywords:** [BUG_FIX] [BACKEND] [CI_CD] [TESTING] [CRITICAL]
**Session:** Late evening, Duration (~20 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-2333_fix-classifyfailure-misattribution.md`

## What Changed

- File: `tools/ci-build.mjs`
  - `classifyFailure()` now scans build output in two passes: first for a line ANCHORED on this
    project's own `${moduleName}: ${message}` throw convention (after trimming, and after
    skipping `$ `-prefixed shell command echoes, which are never a failure), then falls back to
    the original loose substring-anywhere-in-line scan for any error shape that doesn't follow
    that convention
- File: `tests/unit/ci-build.test.mjs`
  - Added a regression test using real (trimmed) log lines from an actual failing local
    `node tools/ci-build.mjs build` run, pinning that a benign command echo and a passing test's
    own description (both of which substring-match a `CHECK_PATTERNS` name) are not picked over
    the real failing `changelog-loader:` line

## Why

While running 04-10 Task 2's D-15 failure-notification drill (`V1_CHANGELOG_URL` pointed at an
empty-entries `data:` URL to force a real build failure), the resulting ntfy push was titled
"915 TLDR build failed: $ node --test tests/ci-fixtures/assert-no-d1.test.mjs" instead of naming
the actual failure (`changelog-loader: v1 changelog.json has zero entries — refusing to build`).

Root cause: `classifyFailure()` (04-09) scanned the build's tail output for the FIRST line
containing any `CHECK_PATTERNS` substring anywhere in the line. `assert-no-d1` is both a
`CHECK_PATTERNS` entry and the literal filename of an earlier, SUCCESSFUL build step
(`test:build-gate` runs `node --test tests/ci-fixtures/assert-no-d1.test.mjs`), so that step's own
command echo — which appears well before the real failure in the output — won the "first match"
race every time a failure happened later in the same build (i.e., during `astro build` itself,
which is the majority of realistic failure scenarios). This directly undermined D-15's entire
purpose: an operator reading the ntfy push needs to know which check actually failed, not which
check's name happened to appear first in a successful earlier step's log.

Every real thrown error in this codebase follows one consistent convention —
`` `${moduleName}: ${message}` `` at the start of the line (confirmed across
`src/content/loaders/changelog-loader.ts`, `src/lib/server/d1-client.ts`,
`src/lib/server/kv-manifest.ts`, `src/lib/server/build-state.ts`, `src/lib/listing.ts`) — so
anchoring the match on that convention (while still falling back to the old loose scan for
anything that doesn't follow it) correctly identifies the real failure without breaking any
existing synthetic-fixture test.

## Issues Encountered

The existing unit tests used synthetic fixtures (`Error: ${check} threw during build`) that don't
match this codebase's real throw convention, so they never would have caught this in isolation —
only a real build failure (this session's D-15 drill) surfaced it. The fix preserves those
existing tests via its fallback pass rather than rewriting them, since they still exercise
legitimate fallback behavior.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/ci-build.test.mjs` (20/20 pass, up from 19 — the new
  regression test added); full suite `node --test "design/tests/unit/**/*.test.mjs"
  "tests/unit/**/*.test.mjs"` (378/378 pass).
- What wasn't tested: The fix has not yet been re-verified against a second real Workers Builds
  failure drill (only the local reproduction is confirmed); a fresh failure drill against the
  actual Workers Builds platform would be a nice-to-have but not required, since the fix operates
  purely on string content, not the build environment.
- Edge cases: A build failing with an error message that does NOT follow the
  `${moduleName}: ${message}` convention (e.g., `articles-loader.ts`'s bare
  `${mode} rows-read budget exceeded` throw, a known pre-existing gap not addressed here) still
  falls through to the loose substring fallback pass, unchanged from before.

## Next Steps

- [ ] Consider standardizing `articles-loader.ts`'s budget-exceeded throw to the same
      `${moduleName}: ${message}` convention as every other module, so it's covered by the
      anchored pass too (out of scope for this fix).

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - fixes a real diagnostic-quality bug in the D-15 build-failure notification
path; discovered and fixed during 04-10 Task 2's own real-build verification drill

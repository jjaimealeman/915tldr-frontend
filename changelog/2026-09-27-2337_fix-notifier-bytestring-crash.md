# 2026-09-27 - Fix ntfy notifier crashing on non-Latin1 characters in the failure title

**Keywords:** [BUG_FIX] [BACKEND] [CI_CD] [TESTING] [CRITICAL] [SECURITY]
**Session:** Late evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-2337_fix-notifier-bytestring-crash.md`

## What Changed

- File: `tools/ci-build.mjs`
  - Added `toHeaderSafe()`: normalizes em-dash/en-dash/curly quotes/ellipsis to ASCII equivalents,
    then strips any remaining code point above 255
  - `defaultNotify()` now passes the ntfy `Title` header through `toHeaderSafe()`; the POST
    `body` (not a header) is left as real UTF-8, unchanged
- File: `tests/unit/ci-build.test.mjs`
  - Added `toHeaderSafe` unit tests, including one using the exact real message that crashed the
    notifier, round-tripped through a real `Headers` object

## Why

Immediately after fixing `classifyFailure()` (previous commit, same session) to correctly name the
real failing check, re-running the same D-15 drill a second time exposed a WORSE bug: the
corrected failure title —
`changelog-loader: v1 changelog.json has zero entries — refusing to build (...)` — contains an
em-dash (U+2014), and Node's `fetch()` (undici) throws
`TypeError: Cannot convert argument to a ByteString because the character at index 76 has a value
of 8212 which is greater than 255` for any HTTP header value containing a code point above 255.
This crashed the ENTIRE `ci-build` process with an uncaught exception — no clean exit code, and
critically, it's unclear whether the ntfy push itself was even sent before the crash, since the
`Headers` construction happens inside the same `fetch()` call. This directly defeated D-15's core
guarantee ("a failure never fails silently") at the exact moment it mattered most: a real build
failure, with a message written in this codebase's own normal prose style (which uses em-dashes
constantly — see this very file's comments), would silently crash the notifier instead of
reliably paging the owner.

Confirmed the fix end-to-end against three consecutive real local `node tools/ci-build.mjs build`
runs: the first (pre-fix baseline, plain `classifyFailure` bug) worked but titled wrong; the
second (post-`classifyFailure`-fix, pre-`toHeaderSafe`) crashed with the ByteString `TypeError`;
the third (post-`toHeaderSafe`-fix) exited cleanly (code 1) and delivered a correctly-titled ntfy
push with the em-dash normalized to a hyphen in the `Title` header while the real em-dash was
preserved in the message body (confirmed by reading the ntfy topic back).

## Issues Encountered

Found only because the D-15 drill was actually run against a REAL failure message from this
codebase's real prose style, not a synthetic ASCII-only fixture — the existing unit test suite's
notification tests all stub `notifyImpl` entirely and never exercise the real `defaultNotify()`
HTTP-header-construction path, so this class of bug was invisible to the existing suite by
construction.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/ci-build.test.mjs` (25/25 pass); full suite
  `node --test "design/tests/unit/**/*.test.mjs" "tests/unit/**/*.test.mjs"`; three real
  end-to-end local drill runs against the real ntfy topic (pre-fix crash, then confirmed clean
  post-fix delivery).
- What wasn't tested: Re-confirming this fix against a real Workers Builds failure (only the
  local reproduction is confirmed) — not required since the fix is pure string-handling, not
  environment-dependent, but flagged as a nice-to-have.
- Edge cases: `toHeaderSafe` handles `null`/`undefined` without throwing (returns empty string);
  arbitrary non-Latin1 characters (e.g., emoji) are stripped rather than causing a second crash.

## Next Steps

- [ ] None required — both this fix and the prior `classifyFailure` fix are complete and verified.

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - a real build failure using this codebase's own normal writing style would have
silently crashed the D-15 notifier instead of paging the owner; found and fixed before any real
Workers Builds failure could hit it

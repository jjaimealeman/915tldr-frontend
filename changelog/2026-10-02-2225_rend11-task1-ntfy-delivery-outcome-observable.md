# 2026-10-02 - ntfy delivery outcome now observable (REND-11 follow-up, Task 1)

**Keywords:** [TESTING] [MONITORING] [BUG_FIX] [BACKEND]
**Session:** Evening, ~30 min
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2225_rend11-task1-ntfy-delivery-outcome-observable.md`

## What Changed

- File: `tools/ci-build.mjs`
  - `defaultNotify` now awaits the real `fetch()` response and checks `res.status` (not `res.ok`, so a plain-object fake works in tests): a 2xx logs exactly `[ci-build] ntfy "<title>": HTTP <status>` via the injected `log`, anything else throws `new Error('HTTP <status>')` with no logging of its own.
  - `runCi` gained a `fetchImpl` option (default: `globalThis.fetch`), threaded through to `notifyImpl` alongside the existing `env`/`title`/`body`/`priority`/`tags`/`log` fields.
  - `sendNotification` now returns a `delivered: boolean`. The no-`NTFY_TOPIC` logging-only branch still returns `false`. A real send wraps `notifyImpl` in try/catch — resolve means `true`; a throw is caught, the reason is redacted and has the literal topic and its URL-encoded form scrubbed to `[topic]` via split/join, logged as `[ci-build] ntfy "<title>": <reason> (not delivered)`, and returns `false`. No caller can be rejected by a notifier failure, so `runCi`'s own return code is unaffected.
- File: `tests/unit/ci-build.test.mjs`
  - Two pre-existing tests whose `notifyImpl` threw to prove "notify is never called" now record calls into an array and assert zero length instead — the new try/catch around `notifyImpl` would otherwise swallow that throw and silently defeat the test's detection power.
  - Five new tests (REND-11 follow-up section) drive `runCi -> sendNotification -> the REAL defaultNotify -> an injected fake fetchImpl -> log`, none passing `notifyImpl`: HTTP 200 success, HTTP 429 (not delivered), a rejected fetch (not delivered, topic never logged), secret-scrubbing across all of the above plus a `NTFY_TOKEN` Bearer-header case, and the deploy-path daily-report send on a non-2xx response.

## Why

Production's daily file-count report (REND-11) has not arrived for two days running. Root cause diagnosed in `.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`: `defaultNotify` never checked the ntfy response status, so a rejected send was indistinguishable from a successful one — nothing logged, nothing alerted. This is step 1 of a 3-task fix (quick plan 261002-s2r): make every send's outcome observable before changing anything about when the report marker gets written (Task 2) or how much of the build log survives to show it (Task 3).

## Issues Encountered

No major issues encountered. The two existing "notify must never be called" tests needed updating specifically because the new try/catch (added for D-10/D-12/D-15's existing guarantee that a notification failure never changes `runCi`'s return code) would have swallowed their detection throw, so they were converted to call-recording assertions to preserve their original intent.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: real `defaultNotify` behavior end-to-end through `runCi`, driven only by a fake `fetchImpl` (never a fake `notifyImpl`) — HTTP 200/429, a rejected fetch, NTFY_TOKEN handling, and the deploy-path daily-report send on failure. Confirmed no log line ever contains the topic, token, or notification body text across all five new tests.
- What wasn't tested: real production ntfy delivery (explicitly out of scope — no real network send during execution, per plan constraints).
- Edge cases: a thrown fetch error whose message embeds the raw topic URL is scrubbed via split/join on both the literal topic and its `encodeURIComponent` form before logging.

## Next Steps

- [ ] Task 2: daily-report marker written only after a confirmed 2xx (currently written before the send attempt)
- [ ] Task 3: suppress the ~60k-line per-page build listing so deploy-step output (including these new outcome lines) survives in the Workers Builds log

---

**Branch:** feature/phase-05
**Issue:** REND-11 follow-up (`.planning/todos/pending/2026-10-02-rend-11-daily-report-delivery-unconfirmed.md`)
**Impact:** MEDIUM - observability-only change; no production behavior change until the next deploy's log is read

---
status: testing
phase: 05-hybrid-archive-zero-reads-proof
source: [05-VERIFICATION.md]
started: 2026-10-03T03:50:37Z
updated: 2026-10-03T03:50:37Z
---

## Current Test

number: 2
name: ARCH-08 CPU axis stays tracked at Phase 12's soak (owner acknowledgment)
expected: |
  Owner confirms WINDOWS.md #26 stays open and is judged in Phase 12's 7-day soak on real
  traffic (population p99 CPU < 5ms AND invocations >= 20ms under 0.1%), with no further Phase 5 action.
awaiting: user response

## Tests

### 1. Real ntfy daily file-count report arrives after merge to main (REND-11)
expected: Report arrives on the owner's ntfy client; build log shows the three [ci-build] lines above in order. If not delivered, the log names the HTTP status and the next deploy re-sends.
result: pass — real production report arrived 2026-10-03 00:08 MDT from the 00:06 deploy of `main` (static files 29788 / 100000, archived 30836, hot window derived 202 days, backlog 0); owner confirmed on device. The build-log lines apply only after feature/phase-05 reaches main; delivery itself is proven without them.

### 2. ARCH-08 CPU axis stays tracked at Phase 12's soak (owner acknowledgment)
expected: Owner confirms WINDOWS.md #26 stays open and is judged in Phase 12's 7-day soak on real traffic (population p99 CPU < 5ms AND invocations >= 20ms under 0.1%), with no further Phase 5 action.
result: [pending]

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

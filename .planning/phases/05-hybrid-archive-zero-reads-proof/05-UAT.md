---
status: testing
phase: 05-hybrid-archive-zero-reads-proof
source: [05-VERIFICATION.md]
started: 2026-10-03T03:50:37Z
updated: 2026-10-03T03:50:37Z
---

## Current Test

number: 1
name: Real ntfy daily file-count report arrives after merge to main (REND-11)
expected: |
  After feature/phase-05 is merged to main and the next production Workers Builds deploy runs,
  a low-priority ntfy notification titled "915 TLDR archive daily report" arrives with the
  current static file count against 100,000 (fail at 80,000). The build log shows, in order:
  "[ci-build] astro build: suppressed <N> per-page output lines ...",
  "[ci-build] ntfy \"915 TLDR archive daily report\": HTTP 200",
  "[ci-build] daily-report marker set to <YYYY-MM-DD>".
awaiting: user response

## Tests

### 1. Real ntfy daily file-count report arrives after merge to main (REND-11)
expected: Report arrives on the owner's ntfy client; build log shows the three [ci-build] lines above in order. If not delivered, the log names the HTTP status and the next deploy re-sends.
result: [pending]

### 2. ARCH-08 CPU axis stays tracked at Phase 12's soak (owner acknowledgment)
expected: Owner confirms WINDOWS.md #26 stays open and is judged in Phase 12's 7-day soak on real traffic (population p99 CPU < 5ms AND invocations >= 20ms under 0.1%), with no further Phase 5 action.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

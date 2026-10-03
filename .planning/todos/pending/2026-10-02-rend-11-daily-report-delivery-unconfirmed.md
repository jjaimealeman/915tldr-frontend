---
created: 2026-10-02T19:45:00Z
title: REND-11 daily file-count report — delivery unconfirmed, verify after next production deploy
area: ops
severity: major
files:
  - tools/ci-build.mjs
resolves_phase: 5
---

## Problem

REND-11 requires the deployed static-asset file count to be reported daily via ntfy, alarming
before 100,000 (fail threshold 80,000). The send mechanism exists and is unit-tested
(`tools/ci-build.mjs`'s `dailyReport` logic), and the R2 marker `_meta/daily-report.json` shows
`{"lastReportDate":"2026-10-02"}` — a production post-sync run on 2026-10-02 decided a report was
due and attempted to send it. But actual delivery has never been confirmed:

- A 72h ntfy poll of the local shell's `NTFY_TOPIC` (`M75s_notifications` — not in `.dev.vars`,
  sourced from the shell environment) found 0 messages titled "915 TLDR archive daily report" and
  0 archive alerts.
- The owner (2026-10-02 ~19:42 MDT) searched all 6 of his personal ntfy topics (`M75s_alerts`,
  `M75s_log`, `M75s_mindjogapp`, `M75s_notifications`, `M75s_reminders`, `M75s_scout`) and found no
  "915 TLDR archive daily report" message on any day. The only related message was a build-failure
  alert dated 2026-10-01 01:42 AM from a **local** `ci-build` run — proving local ci-build→ntfy
  delivery works with the shell's topic, but saying nothing about the production daily report.
- Workers Builds' own `NTFY_TOPIC` is configured in the Cloudflare dashboard (separately from the
  local shell environment), and the local API token cannot read Builds' variable configuration
  (403) — so which topic production actually sends the daily report to is unverified from this
  machine.

**Conclusion: REND-11 is not complete.** The mechanism is wired and unit-tested; recurring
delivery in production is unproven.

## Required follow-up

1. **Owner checks the production topic configuration.** In the Cloudflare dashboard: Workers
   Builds → `915tldr-v2` → Settings → Build → Variables and secrets → confirm `NTFY_TOPIC` on the
   **production** trigger, and that it matches a topic the owner actually has subscribed/watched
   on his phone or ntfy web client.
2. **After the next production deploy**, confirm the daily report notification actually arrives —
   check the day after deploy (reports send once per America/Denver day, on the first post-deploy
   sync of that day) and record the date + count line in `.planning/phases/
   05-hybrid-archive-zero-reads-proof/05-VALIDATION.md`'s Manual-Only Verifications table,
   replacing this "OPEN" resolution with a dated "Resolved" one.
3. **Consider making a daily-report send failure visible.** Today, if `daily-report.json`'s write
   fails or the ntfy send itself silently fails, there is no distinct alert for "the daily report
   did not go out" — it just doesn't arrive, and nothing escalates. A failed send is currently
   indistinguishable from "no deploy happened today" from the owner's side. Worth a small
   improvement (e.g. an explicit alert if a day passes with no report when a deploy did occur) in
   a future pipeline-hardening pass.

## Resolution criteria

This todo resolves when a real daily report has been confirmed arriving on the owner's phone/ntfy
client, with its date and count line recorded in 05-VALIDATION.md, replacing REND-11's "Gaps
Found — daily report delivery not observed" status in `.planning/REQUIREMENTS.md` with "Complete".

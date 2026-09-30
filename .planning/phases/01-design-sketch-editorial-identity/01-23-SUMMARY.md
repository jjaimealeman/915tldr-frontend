---
phase: 01-design-sketch-editorial-identity
plan: 23
subsystem: testing
tags: [approval-packet, playwright, d16, owner-review, round-2, gap-closure]
outcome: approved-pending-signature

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-11..01-22: the full gap-closure set addressing all 14 round-1 items (pnpm, criterion 5/font-display, headline typeface, Business hue, header rule, category lead fallback, article rail, changelog layout, contact centring, new-tab links, 768px width, Load more, markdown rendering, toggle placement)"
provides:
  - "design/scripts/write-approval-packet.mjs: D-16's strict 5/5 gate restored (the 01-10 criterion-5 exception removed); --packet flag; refuses to regenerate over a signed packet; carries the existing packet's Revision requests + File fingerprints forward into a new Revision history section instead of discarding them"
  - "design/evidence/verify-phase-1.json / .txt: full unscoped run, 5/5 PASS, both engines, no SCOPED banner, no .astro file found"
  - ".planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md: round-2 packet — owner review focus, deviations, ten planner resolutions, flagged assumptions A-01..A-14, 14 fingerprinted files, round-2 owner review notes (verbatim, APPROVED), two follow-ups captured at approval, unsigned pending the owner's own Approved-by line"
  - ".planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md: per-task rows 01-11-T1..01-23-T3, plus a requirement-map addition for chrome.spec.ts, layout.spec.ts, lead-fallback.spec.ts, load-more.spec.ts, summary-markdown.test.mjs, font-axes.test.mjs"
affects: [Phase 8 (Server Islands & Interactivity) — two follow-ups captured: sticky rail, Astro view transitions/ISL-06]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "An approval-packet generator that carries forward its own prior output (Revision requests, File fingerprints) into a dated 'Revision history' section on every regeneration, rather than overwriting — the owner's words survive a gate restoration or any future re-run."

key-files:
  created: []
  modified:
    - design/scripts/write-approval-packet.mjs
    - design/evidence/verify-phase-1.json
    - design/evidence/verify-phase-1.txt
    - design/evidence/font-cls.md
    - .planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md
    - .planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md

key-decisions:
  - "Removed the 01-10 criterion-5 exception outright, per the plan: the owner's D-GAP-A decision (reopen PRD §6.5 to font-display:optional, shrink Source Serif 4) was implemented and verified in 01-13/01-14, so criterion 5 now passes honestly and there is no remaining reason to special-case it."
  - "Fixed a real bug (Rule 1, found while reviewing the freshly generated packet, not by a failing test) in readFallbackFacesPerEngine: font-cls.md grew a second table since round 1 (01-13's positive control) sharing the swap-matrix table's column index for an unrelated field, corrupting the Environment section's fallback-face list with 'verdict'/'detected'/'not observable'. Scoped collection to rows strictly inside the swap-matrix table."
  - "Surfaced two owner-facing items beyond the plan's own fixed checklist, per the orchestrator's explicit instruction not to bury them: the Business palette record's subject text still reads 'turquoise or teal' though the photo actually used and sampled is a 152° green (D-GAP-C, 01-16), and design/evidence/palette-swatches-*.png's swatch-heading captions still read 'Instrument Serif' though 01-14 moved headlines to Source Serif 4 Bold."
  - "The owner's round-2 decision, relayed through the orchestrator, was APPROVED — recorded verbatim in a new '## Round 2 owner review notes' section in 01-APPROVAL.md. The executor did NOT write, pre-fill, or simulate the 'Approved-by:' sign-off line itself: the plan's own Task 3 action and threat model (T-01-32/T-01-33) require that line to be the owner's own act on the file, not something an executor adds on a relayed instruction. pnpm run verify:approval therefore still correctly exits 1 (unsigned) — this is the expected, honest state, not a defect."
  - "Two forward-carried feature requests from the owner's review (sticky Latest Stories rail; Astro view transitions) were captured as a new '## Follow-ups captured at approval' section in 01-APPROVAL.md and as STATE.md Pending Todos, both scoped by the owner to Phase 8 (Server Islands & Interactivity) rather than reopening Phase 1. View transitions maps to the existing ISL-06 requirement (already Phase-8-mapped); the sticky rail has no existing requirement ID and is flagged as an unmapped candidate rather than silently added to REQUIREMENTS.md/ROADMAP.md."
  - "Corrected a stale progress-calculation side effect from this plan's own earlier roadmap.update-plan-progress call: STATE.md frontmatter's progress.completed_phases had been set to 1 purely because plan_count === summary_count (23/23), without regard to 01-23-SUMMARY.md's own status field. Reset to 0 by hand — Phase 1 is not complete until the owner's Approved-by line lands and verify:approval exits 0. Flagged for the orchestrator/gsd-tools maintainers as a likely calculation gap: phase-completion counting should read each SUMMARY's status field, not just count file existence."
  - "Did not run requirements.mark-complete, state.advance-plan, or any phase-completion verb — per explicit instruction, that step belongs to the orchestrator once the owner's physical sign-off is on disk."

requirements-completed: []

coverage: []

duration: ~2h13m (includes a pause between Task 1's checkpoint and the coordinator relaying the owner's Task 2/3 reply)
completed: 2026-09-17
status: halted
---

# Phase 01 Plan 23: D-16 Round-2 Close — Strict Gate, Unscoped Run, Owner Approved, Signature Pending Summary

**Restored D-16's strict 5/5 approval gate, ran the full unscoped verification suite clean (5/5 PASS, Chromium + WebKit, 353 tests), regenerated 01-APPROVAL.md as a round-2 packet, and recorded the owner's verbatim APPROVED decision plus two forward-carried follow-ups (sticky rail, Astro view transitions — both deferred to Phase 8). The one remaining step — the owner's own `Approved-by:` line on the file — was deliberately left for the owner to add themselves; this executor does not write that line on a relayed instruction, per the plan's own non-negotiable rule.**

## Performance

- **Duration:** ~2h13m (Task 1 executed continuously; the plan then paused at its Task 2 checkpoint until the coordinator relayed the owner's reply)
- **Started:** 2026-09-17T23:33:00Z (approx, first read of plan/context files)
- **Completed:** 2026-09-18T01:46:00Z (this SUMMARY's final commit)
- **Tasks:** 3 of 3 addressed (Task 1 complete; Task 2 recorded from the owner's own words; Task 3's decision is recorded but its literal sign-off line remains the owner's own act, not yet on disk)
- **Files modified:** 23 tracked files across the whole plan (1 script, 3 planning docs, 19 evidence artifacts) + 3 changelog files

## Accomplishments

- Restored `write-approval-packet.mjs`'s original D-16 gate: every criterion must PASS in every engine, no criterion-5 exception.
- Ran `pnpm run verify:phase-1` fully unscoped: **5/5 PASS**, Chromium + WebKit (Playwright 26.6, docker), no SCOPED banner, no `.astro` file anywhere in the repo. 353 Playwright tests, ~3m10s wall clock.
- Regenerated `01-APPROVAL.md` as a round-2 packet: Owner review focus (7 items, including two staleness issues surfaced beyond the plan's own checklist), deviations, ten planner resolutions, flagged assumptions A-01 through A-14, 14 fingerprinted files, an unchecked owner review checklist, and a Revision history section carrying round 1 forward verbatim (owner quotes byte-identical) plus the 14-item closure table.
- Confirmed the three required refusal paths still work (scoped evidence, criterion-5 FAIL, signed packet), and that the fresh packet's fingerprints verify clean.
- **Recorded the owner's round-2 decision: APPROVED.** Added a "## Round 2 owner review notes" section to `01-APPROVAL.md` with the owner's reply quoted verbatim (article page, changelog float/sticky question, contact, homepage Load More, Astro view transitions, "APPROVED"), and an honest note that these comments don't individually re-confirm every "Owner review focus" line item (Business subject wording, Politics photo, real-Safari/Georgia, other open WINDOWS.md entries) — the approval covers the design as packaged, not a line-by-line re-audit this reply didn't perform.
- **Captured two forward-carried follow-ups** in a new `01-APPROVAL.md` section and in `STATE.md` Pending Todos, both scoped by the owner to Phase 8 (Server Islands & Interactivity): a sticky "Latest Stories" rail (no existing requirement ID — flagged as unmapped, not silently added), and Astro view transitions (maps to the existing ISL-06 requirement, already Phase-8-scoped in REQUIREMENTS.md/ROADMAP.md — no new requirement needed).
- **Did not write the `Approved-by:` sign-off line.** Per the plan's own Task 3 action ("the owner adds the sign-off line ... themselves ... In neither case does the executor write or alter a sign-off line") and the threat model's T-01-32/T-01-33 mitigation, an instruction relayed through the orchestrator is not the owner's own hand on the file. `pnpm run verify:approval` still correctly exits 1 (unsigned) — reported honestly, not forced to a false pass.
- Corrected a stale `completed_phases: 1` value in `STATE.md`'s frontmatter (a side effect of an earlier `roadmap.update-plan-progress` call counting plan/summary file parity without checking each SUMMARY's own status) back to `0` — Phase 1 genuinely is not complete until the sign-off lands.
- Appended a gap-closure per-task validation map (01-11-T1 … 01-23-T3) and a requirement-map addition to `01-VALIDATION.md`, without touching its frontmatter status.

## Task Commits

1. **Task 1: Strict generator with revision history → full unscoped run → round-2 packet → validation map** — `8749ae2` (feat)
2. **Task 1 SUMMARY (interim, superseded by this file's final state):** `33f3e4c` (docs)
3. **Tasks 2/3: Owner's round-2 review recorded (APPROVED), follow-ups captured, state corrected** — committed with this SUMMARY (see below)

## Files Created/Modified

- `design/scripts/write-approval-packet.mjs` — strict 5/5 gate, `--packet` flag, signed-packet refusal, revision-history carry-over, fallback-face parsing bug fix
- `design/evidence/verify-phase-1.json` / `.txt` — full unscoped 5/5 PASS evidence
- `design/evidence/font-cls.md`, `design/evidence/keyboard/*.png`, `design/evidence/pages/index-*.jpg` — regenerated as a side effect of the unscoped run
- `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` — round-2 packet, plus "Round 2 owner review notes" and "Follow-ups captured at approval" sections; still unsigned
- `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md` — gap-closure per-task map, requirement-map additions
- `.planning/STATE.md` — decisions, corrected progress frontmatter, two Pending Todos, updated blocker text

## Decisions Made

See `key-decisions` in frontmatter above — summarized: strict gate restoration, the fallback-face bug fix, surfacing two staleness items beyond the fixed checklist, recording APPROVED without self-signing, capturing two Phase-8-scoped follow-ups, and correcting a stale `completed_phases` frontmatter value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fallback-face parsing polluted by a second font-cls.md table**
- **Found during:** Task 1, reviewing the freshly generated packet before committing it
- **Issue:** `readFallbackFacesPerEngine` treated any markdown table row with more than 5 pipe-delimited columns as a swap-matrix row. `font-cls.md` grew a second table in 01-13 (the D-GAP-A positive control) sharing the swap-matrix table's column index for an unrelated field, corrupting the Environment section's fallback-face list.
- **Fix:** Scoped collection to rows strictly inside the swap-matrix table via an `inSwapTable` state flag.
- **Files modified:** design/scripts/write-approval-packet.mjs
- **Verification:** Regenerated the packet; Environment section reads "Noto Serif, Times New Roman" cleanly.
- **Committed in:** 8749ae2

**2. [Rule 1 - Bug] STATE.md progress.completed_phases falsely set to 1**
- **Found during:** reviewing STATE.md after the coordinator's Task 2/3 message, before recording the approval
- **Issue:** An earlier `roadmap.update-plan-progress 1` call (run as part of Task 1's own state-recording step) set `progress.completed_phases: 1` in STATE.md's frontmatter, apparently because plan_count (23) equalled summary_count (23) — without checking that 01-23-SUMMARY.md's own `status` field was `halted`, not `complete`. This directly contradicted this plan's explicit instruction never to mark the phase complete.
- **Fix:** Hand-corrected the frontmatter field back to `0`. Flagged in key-decisions as a likely gap in gsd-tools' phase-completion calculation for a future fix (phase completion should check each SUMMARY's status, not just file-count parity).
- **Files modified:** .planning/STATE.md
- **Verification:** Re-read STATE.md frontmatter after the edit; confirmed `completed_phases: 0`.
- **Committed in:** this SUMMARY's commit

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — one in the packet generator, one in this session's own state bookkeeping)
**Impact on plan:** Both necessary for correctness/honesty of the evidence and state trail; no scope creep, no gate or threshold weakened.

## Issues Encountered

- The coordinator relayed the owner's APPROVED decision and two follow-up scoping decisions across two separate messages mid-task. Both were incorporated before finishing the plan's own artifacts, per the messages' own instructions — see "How the owner's decision was recorded" below for what was and wasn't done on the owner's behalf.

## How the owner's decision was recorded (read this before assuming Task 3 is fully closed)

- **What is recorded:** the owner's verbatim APPROVED reply, dated 2026-09-17, quoted in `01-APPROVAL.md`'s new "Round 2 owner review notes" section; the two follow-up items, scoped to Phase 8 per the owner's own further decision; `STATE.md` decisions and Pending Todos reflecting all of this.
- **What is NOT recorded, and why:** the `Approved-by: <name> — 2026-09-17` sign-off line itself. The plan's Task 3 action is explicit and repeated: "the owner adds the sign-off line ... themselves" and "In neither case does the executor write or alter a sign-off line" — this is the T-01-32/T-01-33 mitigation for a HIGH-severity spoofing/repudiation threat (an automated actor forging the human decision). A decision relayed through the orchestrator, however clearly quoted, is not the owner's own hand on the file. `pnpm run verify:approval` therefore still correctly exits 1 (unsigned) — this is expected and honest, not a bug.
- **Remaining step (owner-only, mechanical):** add one line to the "## Owner sign-off" section of `01-APPROVAL.md`:
  ```
  Approved-by: Jaime Aleman — 2026-09-17
  ```
  After that line is on disk, `pnpm run verify:approval` will exit 0 (14/14 fingerprints already match — nothing else needs to change), and a trivial follow-up commit (adding just that one file) finalizes Task 3 and the phase's approval record.

## User Setup Required

None — no external service configuration required. The one remaining manual step is the owner's own edit to `01-APPROVAL.md`, described above.

## Next Phase Readiness

**Design approved by the owner; the phase's formal record is one line short of matching that approval.** Per explicit instruction, this executor does not mark the phase itself complete or run any phase-completion verb — the orchestrator owns that step, and it should wait until the `Approved-by:` line is actually on disk and `pnpm run verify:approval` exits 0.

Two items are now queued for Phase 8 (Server Islands & Interactivity), captured in both `01-APPROVAL.md` and `STATE.md`:
- Sticky "Latest Stories" rail (article + changelog) — no requirement ID yet; needs scoping when Phase 8 is planned.
- Astro view transitions — maps to existing requirement ISL-06, already Phase-8-scoped; implementation note (ClientRouter, transition:persist on the masthead/nav) recorded for that phase's planner.

**Cleanup needed** (sandbox-blocked from this session; run manually):
```
rm -rf design/.cache/approval-check
```
(Contents are three synthetic evidence-fixture JSON files and one signed-packet test copy, used only to prove the generator's three refusal paths exit 1. `design/.cache/` is gitignored — nothing here is tracked or was at risk of being committed.)

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17 (owner approved; formal sign-off line still pending the owner's own edit)*

## Self-Check: PASSED

- Commit `8749ae2` found in `git log --oneline --all`.
- `design/scripts/write-approval-packet.mjs` — found
- `design/evidence/verify-phase-1.json` — found
- `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` — found, contains "Round 2 owner review notes" and "Follow-ups captured at approval"; no `Approved-by:` line present (confirmed via grep)
- `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md` — found
- `.planning/phases/01-design-sketch-editorial-identity/01-23-SUMMARY.md` — found
- `.planning/STATE.md` — `progress.completed_phases: 0` confirmed after correction

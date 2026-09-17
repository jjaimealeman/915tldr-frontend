---
phase: 01-design-sketch-editorial-identity
plan: 23
subsystem: testing
tags: [approval-packet, playwright, d16, owner-review, round-2, gap-closure]
outcome: halted

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-11..01-22: the full gap-closure set addressing all 14 round-1 items (pnpm, criterion 5/font-display, headline typeface, Business hue, header rule, category lead fallback, article rail, changelog layout, contact centring, new-tab links, 768px width, Load more, markdown rendering, toggle placement)"
provides:
  - "design/scripts/write-approval-packet.mjs: D-16's strict 5/5 gate restored (the 01-10 criterion-5 exception removed); --packet flag; refuses to regenerate over a signed packet; carries the existing packet's Revision requests + File fingerprints forward into a new Revision history section instead of discarding them"
  - "design/evidence/verify-phase-1.json / .txt: full unscoped run, 5/5 PASS, both engines, no SCOPED banner, no .astro file found"
  - ".planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md: round-2 packet — owner review focus, deviations, ten planner resolutions, flagged assumptions A-01..A-14, 14 fingerprinted files, empty owner sign-off, unsigned, round-1 history preserved verbatim"
  - ".planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md: per-task rows 01-11-T1..01-23-T3, plus a requirement-map addition for chrome.spec.ts, layout.spec.ts, lead-fallback.spec.ts, load-more.spec.ts, summary-markdown.test.mjs, font-axes.test.mjs"
affects: []

actuals:
  tokens: 23000
  tasks: 1
  commits: 1

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
  - "Did not run requirements.mark-complete or state.advance-plan — the plan is halted mid-execution (Task 1 only); the phase is not approved and the plan counter should not advance until the owner's Task 3 decision is recorded in a follow-up session."

requirements-completed: []

coverage: []

duration: 33min
completed: 2026-09-17
status: halted
---

# Phase 01 Plan 23: D-16 Round-2 Close — Strict Gate, Unscoped Run, Packet Regenerated (Task 1 of 3) Summary

**Restored D-16's strict 5/5 approval gate, ran the full unscoped verification suite clean (5/5 PASS, Chromium + WebKit, 353 tests), and regenerated 01-APPROVAL.md as a round-2 packet that preserves the owner's round-1 revision history verbatim. Halted before Task 2 (owner keyboard walk and visual review) — that task requires the owner's own hands on a keyboard and eyes on a screen, which this executor cannot substitute for.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-09-17T23:33:00Z (approx, first read of plan/context files preceded this)
- **Completed:** 2026-09-17T23:40:22Z (Task 1 commit)
- **Tasks:** 1 of 3 (Task 1 complete; Task 2 and Task 3 require the owner and are not executable by this agent)
- **Files modified:** 22 tracked files (1 script, 2 planning docs, 19 evidence artifacts) + 2 changelog files

## Accomplishments

- Restored `write-approval-packet.mjs`'s original D-16 gate: every criterion must PASS in every engine, no criterion-5 exception. The 01-10 widening (which let a root-caused, architecturally-blocked FAIL through) is now dead code, removed rather than merely bypassed.
- Ran `pnpm run verify:phase-1` fully unscoped: **5/5 PASS**, Chromium + WebKit (Playwright 26.6, docker), no SCOPED banner, no `.astro` file anywhere in the repo. 353 Playwright tests, ~3m10s wall clock.
- Regenerated `01-APPROVAL.md` as a round-2 packet with: a 7-item "Owner review focus (round 2)" section (including two staleness issues found beyond the plan's own checklist — see Decisions); the D-GAP-A/D-GAP-B/D-05/DSGN-06 deviations to raise at the next phase transition; all ten planner resolutions; flagged assumptions A-01 through A-14; 14 fingerprinted files (the original 8 plus `home-feed.json` and 5 feed pages); an unchecked owner review checklist; an empty `(none yet — round 2)` Revision requests section; and a "Revision history" section carrying round 1 forward verbatim (the owner's ten revision requests and four decisions, byte-identical quotes) plus the 14-item closure table mapping each round-1 item to the gap-closure plan and evidence that addressed it.
- Confirmed the three required refusal paths still work: scoped evidence, a full-scope evidence file with criterion 5 forced to FAIL, and a signed packet (via the new `--packet` flag) each exit 1.
- Confirmed the packet's fingerprints verify clean: `pnpm run verify:approval --pending-ok` exits 0 (14/14 unchanged); `pnpm run verify:approval` with no flag exits 1 (correctly unsigned).
- Appended a gap-closure per-task validation map (01-11-T1 … 01-23-T3) and a requirement-map addition for the six new spec/test files to `01-VALIDATION.md`, without touching its frontmatter status.

## Task Commits

1. **Task 1: Strict generator with revision history → full unscoped run → round-2 packet → validation map** — `8749ae2` (feat)

_Task 2 (owner keyboard walk and visual review) and Task 3 (owner's approve/revise decision) are checkpoints this executor stopped at and did not perform — see "Next Phase Readiness" below._

## Files Created/Modified

- `design/scripts/write-approval-packet.mjs` — strict 5/5 gate, `--packet` flag, signed-packet refusal, revision-history carry-over, fallback-face parsing bug fix
- `design/evidence/verify-phase-1.json` / `.txt` — full unscoped 5/5 PASS evidence
- `design/evidence/font-cls.md`, `design/evidence/keyboard/*.png`, `design/evidence/pages/index-*.jpg` — regenerated as a side effect of the unscoped run
- `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` — round-2 packet
- `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md` — gap-closure per-task map, requirement-map additions

## Decisions Made

- Removed the 01-10 criterion-5 exception outright rather than adding a new exception on top of it — the owner's architectural decision (D-GAP-A) that the exception existed to accommodate has since been implemented and verified, so keeping the exception would misrepresent an honestly-passing criterion as still-special-cased.
- Surfaced two items beyond the plan's own fixed checklist in "Owner review focus (round 2)" item 2, per the orchestrator's explicit instruction that outstanding owner-facing items must be surfaced, not buried: the Business palette record's subject wording ("turquoise or teal") no longer matches the photo actually sampled (a 152° green, D-GAP-C/01-16); and `palette-swatches-*.png`'s captions still say "Instrument Serif" though headlines moved to Source Serif 4 Bold in 01-14. Neither is in `WINDOWS.md`, so without this addition they would have gone unmentioned in the packet.
- Did not call `requirements.mark-complete` or `state.advance-plan` for this SUMMARY — those already reflect earlier gap-closure plans' work (REQUIREMENTS.md already shows DSGN-01..A11Y-01/PERF-07/I18N-07 as Complete from prior plans), and advancing the plan counter here would falsely claim this plan finished when the owner's review and decision (Tasks 2-3) are still outstanding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fallback-face parsing polluted by a second font-cls.md table**
- **Found during:** Task 1, reviewing the freshly generated packet before committing it
- **Issue:** `readFallbackFacesPerEngine` (carried over from the round-1 script) treated any markdown table row with more than 5 pipe-delimited columns as a swap-matrix row. `font-cls.md` grew a second table in 01-13 (the D-GAP-A positive control) whose own column 5 lands on "verdict"/"detected"/"not observable" — the same column index the swap-matrix table uses for "fallback face" — so the Environment section's fallback-face list read "Noto Serif, Times New Roman, verdict, detected, not observable".
- **Fix:** Scoped collection to rows strictly inside the swap-matrix table, tracked via an `inSwapTable` state flag that starts on the header row (`cols[5] === 'fallback face'`) and resets on any line that isn't a table row.
- **Files modified:** design/scripts/write-approval-packet.mjs
- **Verification:** Regenerated the packet after the fix; Environment section now reads "Noto Serif, Times New Roman" cleanly. Full acceptance-check script re-run, still passing.
- **Committed in:** 8749ae2 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Necessary for the packet's Environment section to report evidence honestly; no scope creep, no threshold or gate weakened.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required. Task 2 requires the owner's own browser session (`pnpm run serve:mockups` run in their own terminal pane, per this project's standing rule that the executor never starts a dev/preview server).

## Next Phase Readiness

**Not ready — this plan is halted, not complete.** Task 1's evidence and packet are done and committed. Two owner-only checkpoints remain:

- **Task 2** (`checkpoint:human-verify`, gate=blocking): the owner reviews all five mockups in a real browser (light/dark, 320/768/1280/1920px, real 200% zoom, a full keyboard walk including Load more, an external-link new-tab check) and works through the round-1 closure table and "Owner review focus (round 2)" list in `01-APPROVAL.md`. Any problems get recorded verbatim under "## Revision requests" in the owner's own words.
- **Task 3** (`checkpoint:decision`, gate=blocking, reversibility=one-way): the owner approves and signs (`Approved-by:` line, added by the owner only) or requests another round of revisions. Approval is the one-way door this phase exists to reach — Phase 3 treats the tokens, markup contract and type system as settled once it is given.

Neither checkpoint was answered on the owner's behalf. No `Approved-by:` line was written, pre-filled, or simulated. `01-APPROVAL.md`'s Revision requests section still reads `(none yet — round 2)`.

**Cleanup needed** (sandbox-blocked from this session; run manually):
```
rm -rf design/.cache/approval-check
```
(Contents are three synthetic evidence-fixture JSON files and one signed-packet test copy, used only to prove the generator's three refusal paths exit 1. `design/.cache/` is gitignored — nothing here is tracked or was at risk of being committed.)

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17 (Task 1 only — plan halted pending owner review)*

## Self-Check: PASSED

- Commit `8749ae2` found in `git log --oneline --all`.
- `design/scripts/write-approval-packet.mjs` — found
- `design/evidence/verify-phase-1.json` — found
- `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` — found
- `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md` — found
- `.planning/phases/01-design-sketch-editorial-identity/01-23-SUMMARY.md` — found
